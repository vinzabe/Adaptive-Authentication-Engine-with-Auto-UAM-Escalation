import type { Env } from '../types';
import type { LoginAttempt, Metrics, RiskLevel } from '../types';

export class AnalyticsCollector {
  constructor(private env: Env) {}

  async recordAttempt(attempt: LoginAttempt, riskScore: number, riskLevel: RiskLevel): Promise<void> {
    const event = {
      timestamp: attempt.timestamp,
      ipAddress: attempt.ipAddress,
      success: attempt.success,
      authMethod: attempt.authMethod,
      riskScore,
      riskLevel,
      location: attempt.location,
      userAgent: attempt.userAgent
    };

    // Store in Analytics Engine
    if (this.env.AUTH_EVENTS) {
      await this.env.AUTH_EVENTS.writeDataPoint({
        blobs: [attempt.ipAddress, attempt.authMethod, riskLevel],
        doubles: [riskScore],
        indexes: [attempt.timestamp]
      });
    }

    // Update KV metrics
    await this.updateMetrics(event);
  }

  private async updateMetrics(event: any): Promise<void> {
    const date = new Date(event.timestamp).toISOString().split('T')[0];
    const hour = new Date(event.timestamp).getHours();

    // Get current metrics
    const metricsKey = `metrics:${date}`;
    const existing = await this.env.METRICS.get(metricsKey, 'json') as any || {
      totalAttempts: 0,
      successfulLogins: 0,
      failedLogins: 0,
      blockedAttempts: 0,
      challengesIssued: 0,
      challengeCompletions: 0,
      riskScoreDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
      attackTypes: {},
      topRiskIPs: {},
      hourlyAttempts: {}
    };

    // Update basic counters
    existing.totalAttempts++;
    if (event.success) {
      existing.successfulLogins++;
    } else {
      existing.failedLogins++;
    }

    // Update risk distribution
    existing.riskScoreDistribution[event.riskLevel]++;

    // Update hourly attempts
    if (!existing.hourlyAttempts[hour]) {
      existing.hourlyAttempts[hour] = { attempts: 0, blocked: 0 };
    }
    existing.hourlyAttempts[hour].attempts++;

    // Track risk IPs
    if (event.riskScore > 30) {
      if (!existing.topRiskIPs[event.ipAddress]) {
        existing.topRiskIPs[event.ipAddress] = { score: 0, attempts: 0 };
      }
      existing.topRiskIPs[event.ipAddress].score += event.riskScore;
      existing.topRiskIPs[event.ipAddress].attempts++;
    }

    // Store updated metrics
    await this.env.METRICS.put(metricsKey, JSON.stringify(existing), {
      expirationTtl: 30 * 24 * 60 * 60 // 30 days
    });
  }

  async getMetrics(date?: string): Promise<Metrics | null> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const data = await this.env.METRICS.get(`metrics:${targetDate}`, 'json');
    return data as Metrics | null;
  }

  async recordChallengeIssued(_ip: string): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const metricsKey = `metrics:${date}`;
    const existing = await this.env.METRICS.get(metricsKey, 'json') as any || {
      totalAttempts: 0,
      successfulLogins: 0,
      failedLogins: 0,
      blockedAttempts: 0,
      challengesIssued: 0,
      challengeCompletions: 0,
      riskScoreDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
      attackTypes: {},
      topRiskIPs: {},
      hourlyAttempts: {}
    };

    existing.challengesIssued++;
    await this.env.METRICS.put(metricsKey, JSON.stringify(existing), {
      expirationTtl: 30 * 24 * 60 * 60
    });
  }

  async recordChallengeCompleted(_ip: string, success: boolean): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const metricsKey = `metrics:${date}`;
    const existing = await this.env.METRICS.get(metricsKey, 'json') as any || {
      totalAttempts: 0,
      successfulLogins: 0,
      failedLogins: 0,
      blockedAttempts: 0,
      challengesIssued: 0,
      challengeCompletions: 0,
      riskScoreDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
      attackTypes: {},
      topRiskIPs: {},
      hourlyAttempts: {}
    };

    if (success) {
      existing.challengeCompletions++;
    }

    await this.env.METRICS.put(metricsKey, JSON.stringify(existing), {
      expirationTtl: 30 * 24 * 60 * 60
    });
  }

  async recordBlockedAttempt(_ip: string, reason: string): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const metricsKey = `metrics:${date}`;
    const existing = await this.env.METRICS.get(metricsKey, 'json') as any || {
      totalAttempts: 0,
      successfulLogins: 0,
      failedLogins: 0,
      blockedAttempts: 0,
      challengesIssued: 0,
      challengeCompletions: 0,
      riskScoreDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
      attackTypes: {},
      topRiskIPs: {},
      hourlyAttempts: {}
    };

    existing.blockedAttempts++;
    
    if (!existing.attackTypes[reason]) {
      existing.attackTypes[reason] = 0;
    }
    existing.attackTypes[reason]++;

    await this.env.METRICS.put(metricsKey, JSON.stringify(existing), {
      expirationTtl: 30 * 24 * 60 * 60
    });
  }
}