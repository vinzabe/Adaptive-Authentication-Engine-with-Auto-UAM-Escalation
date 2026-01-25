import type { Env } from './types';
import type { LoginAttempt } from './types';
import { AuthHandler } from './handlers/auth';
import { RiskEngine } from './handlers/risk';
import { KVStorage } from './utils/kv-storage';
import { generateDeviceFingerprint, getClientLocation } from './utils/request';
import { verifyTurnstileToken } from './integrations/turnstile';
import { verifyJWT, extractBearerToken } from './utils/jwt';

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Initialize handlers
      const storage = new KVStorage(env);
      const authHandler = new AuthHandler(storage);
      const riskEngine = new RiskEngine(env);

      // Public routes
      if (path === '/api/register' && request.method === 'POST') {
        return handleRegister(request, authHandler, corsHeaders);
      }

      if (path === '/api/login' && request.method === 'POST') {
        return handleLogin(request, authHandler, riskEngine, env, corsHeaders);
      }

      if (path === '/api/verify-challenge' && request.method === 'POST') {
        return handleVerifyChallenge(request, riskEngine, env, corsHeaders);
      }

      if (path === '/api/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'healthy', timestamp: Date.now() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Protected routes
      const authHeader = request.headers.get('Authorization');
      
      if (path === '/api/user' && request.method === 'GET') {
        return handleGetUser(request, authHeader, authHandler, corsHeaders);
      }

      if (path === '/api/logout' && request.method === 'POST') {
        return handleLogout(request, authHeader, authHandler, corsHeaders);
      }

      if (path === '/api/apikeys' && request.method === 'POST') {
        return handleCreateApiKey(request, authHeader, authHandler, corsHeaders);
      }

      if (path === '/api/metrics' && request.method === 'GET') {
        return handleGetMetrics(riskEngine, corsHeaders);
      }

      // 404
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

async function handleRegister(
  request: Request,
  authHandler: AuthHandler,
  headers: HeadersInit
): Promise<Response> {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const { email, password } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    const result = await authHandler.register(email, password);

    return new Response(JSON.stringify(result), {
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }
}

async function handleLogin(
  request: Request,
  authHandler: AuthHandler,
  riskEngine: RiskEngine,
  env: Env,
  headers: HeadersInit
): Promise<Response> {
  try {
    const body = await request.json() as { email?: string; password?: string; turnstileToken?: string };
    const { email, password, turnstileToken } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // Create login attempt for risk assessment
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || 'Unknown';
    const location = getClientLocation(request);

    const loginAttempt: LoginAttempt = {
      timestamp: Date.now(),
      ipAddress: ip,
      success: false, // Will update after actual auth
      username: email,
      userAgent,
      location: location || undefined,
      deviceFingerprint: await generateDeviceFingerprint(userAgent, ip),
      authMethod: 'form'
    };

    // Assess risk first
    const user = await authHandler['storage'].getUserByEmail(email);
    const userId = user?.id;
    const riskFactors = await riskEngine.assessRisk(loginAttempt, userId);

    // Check if challenge is required
    const challengeRouter = riskEngine.getChallengeRouter();
    const requiresChallenge = challengeRouter.shouldRequireChallenge(riskFactors.level);

    // If medium/high risk and no turnstile token, require challenge
    if (requiresChallenge && !turnstileToken) {
      await riskEngine.recordChallengeIssued(ip);
      
      return new Response(JSON.stringify({
        success: false,
        message: 'Challenge required',
        requireChallenge: true,
        challengeType: riskFactors.level === 'medium' ? 'turnstile' : 'managed',
        riskScore: riskFactors.composite
      }), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // If turnstile token provided, verify it
    if (turnstileToken && riskFactors.level === 'medium') {
      const verification = await verifyTurnstileToken(turnstileToken, env.TURNSTILE_SECRET, ip);
      if (!verification.success) {
        await riskEngine.recordChallengeCompleted(ip, false);
        
        return new Response(JSON.stringify({
          success: false,
          message: 'Challenge failed',
          requireChallenge: true
        }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      await riskEngine.recordChallengeCompleted(ip, true);
    }

    // Critical risk - block immediately
    if (riskFactors.level === 'critical') {
      await riskEngine.recordBlockedAttempt(ip, 'critical-risk');
      
      return new Response(JSON.stringify({
        success: false,
        message: 'Access denied due to security concerns',
        riskScore: riskFactors.composite
      }), {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // Attempt login
    const result = await authHandler.login(email, password, request);

    // Update login attempt based on result
    loginAttempt.success = result.response.success;
    if (result.user) {
      loginAttempt.userId = result.user.id;
    }

    // Re-assess with actual login result
    await riskEngine.assessRisk(loginAttempt, userId);

    if (!result.response.success) {
      return new Response(JSON.stringify(result.response), {
        status: 401,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(result.response), {
      headers: { ...headers, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }
}

async function handleVerifyChallenge(
  request: Request,
  riskEngine: RiskEngine,
  env: Env,
  headers: HeadersInit
): Promise<Response> {
  try {
    const body = await request.json() as { turnstileToken?: string; managedResponse?: string };
    const { turnstileToken, managedResponse } = body;
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    if (turnstileToken) {
      const verification = await verifyTurnstileToken(turnstileToken, env.TURNSTILE_SECRET, ip);
      
      await riskEngine.recordChallengeCompleted(ip, verification.success);
      
      return new Response(JSON.stringify({
        success: verification.success,
        message: verification.success ? 'Challenge passed' : 'Challenge failed'
      }), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // Handle managed challenge response (simplified)
    await riskEngine.recordChallengeCompleted(ip, !!managedResponse);

    return new Response(JSON.stringify({
      success: true,
      message: 'Challenge passed'
    }), {
      headers: { ...headers, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }
}

async function handleGetUser(
  _request: Request,
  authHeader: string | null,
  authHandler: AuthHandler,
  headers: HeadersInit
): Promise<Response> {
  const token = extractBearerToken(authHeader || '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }

  try {
    const payload = await verifyJWT(token);
    const user = await authHandler.getUser(payload.userId);

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // Return user without sensitive data
    const { passwordHash, ...safeUser } = user;
    return new Response(JSON.stringify(safeUser), {
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }
}

async function handleLogout(
  _request: Request,
  authHeader: string | null,
  authHandler: AuthHandler,
  headers: HeadersInit
): Promise<Response> {
  const token = extractBearerToken(authHeader || '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }

  try {
    const payload = await verifyJWT(token);
    await authHandler.logout(payload.userId);

    return new Response(JSON.stringify({ success: true, message: 'Logged out' }), {
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }
}

async function handleCreateApiKey(
  request: Request,
  authHeader: string | null,
  authHandler: AuthHandler,
  headers: HeadersInit
): Promise<Response> {
  const token = extractBearerToken(authHeader || '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }

  try {
    const payload = await verifyJWT(token);
    const body = await request.json() as { name?: string };
    const { name } = body;

    const result = await authHandler.createApiKey(payload.userId, name || 'API Key');

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ key: result.key }), {
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }
}

async function handleGetMetrics(
  riskEngine: RiskEngine,
  headers: HeadersInit
): Promise<Response> {
  const analytics = riskEngine.getAnalytics();
  const metrics = await analytics.getMetrics();

  return new Response(JSON.stringify(metrics || {}), {
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}