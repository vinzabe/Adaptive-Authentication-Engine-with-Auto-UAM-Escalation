import type { Env } from '../types';
import type { User, Session, APIKey } from '../types';

export class KVStorage {
  constructor(private env: Env) {}

  async getUser(userId: string): Promise<User | null> {
    const data = await this.env.USERS.get(`user:${userId}`, 'json');
    return data as User | null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const userId = await this.env.USERS.get(`email:${email}`);
    if (!userId) return null;
    return this.getUser(userId);
  }

  async createUser(user: User): Promise<void> {
    await this.env.USERS.put(`user:${user.id}`, JSON.stringify(user));
    await this.env.USERS.put(`email:${user.email}`, user.id);
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');
    
    const updated = { ...user, ...updates };
    await this.env.USERS.put(`user:${userId}`, JSON.stringify(updated));
  }

  async createSession(session: Session): Promise<void> {
    const TTL = 24 * 60 * 60; // 24 hours
    await this.env.SESSIONS.put(`session:${session.id}`, JSON.stringify(session), {
      expirationTtl: TTL
    });
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const data = await this.env.SESSIONS.get(`session:${sessionId}`, 'json');
    return data as Session | null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.env.SESSIONS.delete(`session:${sessionId}`);
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    const sessions: Session[] = [];
    const list = await this.env.SESSIONS.list({ prefix: `session:` });
    
    for (const key of list.keys) {
      const session = await this.getSession(key.name.replace('session:', ''));
      if (session && session.userId === userId) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }

  async createApiKey(apiKey: APIKey): Promise<void> {
    await this.env.USERS.put(`apikey:${apiKey.key}`, JSON.stringify(apiKey));
  }

  async getApiKey(key: string): Promise<APIKey | null> {
    const data = await this.env.USERS.get(`apikey:${key}`, 'json');
    return data as APIKey | null;
  }

  async deleteApiKey(key: string): Promise<void> {
    await this.env.USERS.delete(`apikey:${key}`);
  }
}