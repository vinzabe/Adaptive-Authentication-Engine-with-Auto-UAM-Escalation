import type { Env } from '../types';
import type { LoginAttempt } from '../types';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DIFFERENT_USERS_THRESHOLD = 3; // 3+ different users
const ATTEMPTS_PER_USER_THRESHOLD = 2; // 2+ attempts per user

export class CredentialStuffingDetector {
  constructor(private env: Env) {}

  async detect(attempt: LoginAttempt): Promise<number> {
    if (!attempt.username) return 0;
    
    const history = await this.getIPHistory(attempt.ipAddress);
    const userCount = new Set(history.map(h => h.username)).size;
    const failedAttempts = history.filter(h => !h.success);
    
    // Calculate risk score
    let score = 0;
    
    // High number of different users attempted
    if (userCount >= DIFFERENT_USERS_THRESHOLD) {
      score += 50;
    }
    
    // Many failed attempts across different users
    if (failedAttempts.length >= DIFFERENT_USERS_THRESHOLD * ATTEMPTS_PER_USER_THRESHOLD) {
      score += 30;
    }
    
    // Rapid fire attempts
    const recentAttempts = history.filter(
      h => Date.now() - h.timestamp < 60000 // last minute
    );
    if (recentAttempts.length > 10) {
      score += 20;
    }
    
    return Math.min(100, score);
  }

  async recordAttempt(attempt: LoginAttempt): Promise<void> {
    const key = `stuffing:${attempt.ipAddress}`;
    const history = await this.getIPHistory(attempt.ipAddress);
    
    history.push(attempt);
    
    // Clean old attempts
    const recent = history.filter(a => Date.now() - a.timestamp < WINDOW_MS);
    
    await this.env.RATE_LIMITS.put(key, JSON.stringify(recent), {
      expirationTtl: Math.floor(WINDOW_MS / 1000) + 60
    });
  }

  private async getIPHistory(ip: string): Promise<LoginAttempt[]> {
    const key = `stuffing:${ip}`;
    const data = await this.env.RATE_LIMITS.get(key, 'json');
    return (data as LoginAttempt[]) || [];
  }
}