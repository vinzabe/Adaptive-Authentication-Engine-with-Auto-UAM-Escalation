import type { User } from '../types';

const JWT_SECRET = 'adaptive-auth-jwt-secret-key';

interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export async function generateJWT(user: User): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    iat: now,
    exp: now + (24 * 60 * 60) // 24 hours
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerEncoded}.${payloadEncoded}`;

  const signature = await sign(data);
  return `${data}.${signature}`;
}

async function sign(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );

  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function verifyJWT(token: string): Promise<any> {
  const [headerEncoded, payloadEncoded, signature] = token.split('.');

  if (!headerEncoded || !payloadEncoded || !signature) {
    throw new Error('Invalid token format');
  }

  const data = `${headerEncoded}.${payloadEncoded}`;
  const expectedSignature = await sign(data);

  if (signature !== expectedSignature) {
    throw new Error('Invalid signature');
  }

  const payload = JSON.parse(atob(payloadEncoded));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp < now) {
    throw new Error('Token expired');
  }

  return payload;
}

export function extractBearerToken(authHeader: string): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export function extractApiKeyToken(authHeader: string): string | null {
  if (!authHeader?.startsWith('ApiKey ')) {
    return null;
  }
  return authHeader.slice(7);
}