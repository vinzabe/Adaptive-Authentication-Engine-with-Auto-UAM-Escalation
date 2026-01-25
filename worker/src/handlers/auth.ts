import type { AuthResponse, User, Session } from '../types';
import { hashPassword, verifyPassword, generateId, generateApiKey } from '../utils/crypto';
import { generateJWT } from '../utils/jwt';
import { generateDeviceFingerprint, getClientIP, getClientLocation } from '../utils/request';
import { KVStorage } from '../utils/kv-storage';

export class AuthHandler {
  constructor(private storage: KVStorage) {}

  async register(email: string, password: string): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.storage.getUserByEmail(email);
    if (existingUser) {
      return {
        success: false,
        message: 'User already exists'
      };
    }

    // Create new user
    const passwordHash = await hashPassword(password);
    const user: User = {
      id: generateId(),
      email,
      passwordHash,
      createdAt: Date.now(),
      reputation: 50,
      sessions: [],
      apiKeys: [],
      settings: {
        require2FA: false,
        geoRestrictions: [],
        allowedDevices: [],
        notificationEmail: email
      }
    };

    await this.storage.createUser(user);

    return {
      success: true,
      message: 'User registered successfully'
    };
  }

  async login(
    email: string,
    password: string,
    request: Request
  ): Promise<{ response: AuthResponse; user?: User; riskScore?: number }> {
    const user = await this.storage.getUserByEmail(email);
    if (!user) {
      return {
        response: {
          success: false,
          message: 'Invalid credentials'
        }
      };
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return {
        response: {
          success: false,
          message: 'Invalid credentials'
        },
        user
      };
    }

    // Create session
    const ip = getClientIP(request);
    const location = getClientLocation(request) || undefined;
    const userAgent = request.headers.get('User-Agent') || 'Unknown';
    const deviceFingerprint = await generateDeviceFingerprint(userAgent, ip);

    const session: Session = {
      id: generateId(),
      userId: user.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      ipAddress: ip,
      userAgent,
      location,
      deviceFingerprint
    };

    await this.storage.createSession(session);

    // Update user
    user.lastLogin = Date.now();
    user.sessions.push(session.id);
    await this.storage.updateUser(user.id, { lastLogin: user.lastLogin, sessions: user.sessions });

    // Generate JWT
    const token = await generateJWT(user);

    return {
      response: {
        success: true,
        token,
        message: 'Login successful',
        session
      },
      user
    };
  }

  async createApiKey(userId: string, name: string): Promise<{ key: string; error?: string }> {
    const user = await this.storage.getUser(userId);
    if (!user) {
      return { key: '', error: 'User not found' };
    }

    const key = generateApiKey();
    const apiKey = {
      key,
      userId,
      name,
      createdAt: Date.now(),
      rateLimit: 1000, // 1000 requests per hour
      scopes: ['read', 'write']
    };

    await this.storage.createApiKey(apiKey);

    // Update user
    user.apiKeys.push(key);
    await this.storage.updateUser(userId, { apiKeys: user.apiKeys });

    return { key };
  }

  async validateApiKey(apiKey: string): Promise<User | null> {
    const keyData = await this.storage.getApiKey(apiKey);
    if (!keyData) {
      return null;
    }

    // Update last used
    keyData.lastUsed = Date.now();
    await this.storage.createApiKey(keyData);

    const user = await this.storage.getUser(keyData.userId);
    return user;
  }

  async logout(sessionId: string): Promise<void> {
    await this.storage.deleteSession(sessionId);
  }

  async getUser(userId: string): Promise<User | null> {
    return this.storage.getUser(userId);
  }
}