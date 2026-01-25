import type { Env } from '../types';
import type { LoginAttempt } from '../types';

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export class BruteForceDetector {
  constructor(private env: Env) {}

  async detect(attempt: LoginAttempt): Promise<number> {
    const attempts = await this.getRecentAttempts(attempt.ipAddress, attempt.username);
    const recentFails = attempts.filter(a => !a.success);
    
    // Calculate risk score (0-100)
    const score = Math.min(100, recentFails.length * 20);
    
    // Store this attempt
    await this.storeAttempt(attempt);
    
    return score;
  }

  private async getRecentAttempts(ip: string, username?: string): Promise<LoginAttempt[]> {
    const key = username ? `bruteforce:${username}` : `bruteforce:ip:${ip}`;
    const data = await this.env.RATE_LIMITS.get(key, 'json');
    return (data as LoginAttempt[]) || [];
  }

  private async storeAttempt(attempt: LoginAttempt): Promise<void> {
    const key = attempt.username ? `bruteforce:${attempt.username}` : `bruteforce:ip:${attempt.ipAddress}`;
    const attempts = await this.getRecentAttempts(attempt.ipAddress, attempt.username);
    
    // Clean old attempts
    const recent = attempts.filter(a => Date.now() - a.timestamp < WINDOW_MS);
    recent.push(attempt);
    
    await this.env.RATE_LIMITS.put(key, JSON.stringify(recent), {
      expirationTtl: Math.floor(WINDOW_MS / 1000) + 60
    });
  }

  async reset(ip: string, username?: string): Promise<void> {
    const key = username ? `bruteforce:${username}` : `bruteforce:ip:${ip}`;
    await this.env.RATE_LIMITS.delete(key);
  }
}