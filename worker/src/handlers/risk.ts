import type { Env } from '../types';
import type { LoginAttempt, RiskFactors } from '../types';
import { BruteForceDetector } from '../detection/brute-force';
import { CredentialStuffingDetector } from '../detection/credential-stuffing';
import { calculateGeoVelocityScore } from '../detection/geo-velocity';
import { AnomalyDetector } from '../detection/anomaly';
import { RiskCalculator } from '../scoring/risk-calculator';
import { DeviceReputationTracker } from '../scoring/device-reputation';
import { AnalyticsCollector } from '../analytics/collector';

export class RiskEngine {
  private bruteForceDetector: BruteForceDetector;
  private credentialStuffingDetector: CredentialStuffingDetector;
  private anomalyDetector: AnomalyDetector;
  private riskCalculator: RiskCalculator;
  private deviceReputation: DeviceReputationTracker;
  private analytics: AnalyticsCollector;

  constructor(env: Env) {
    this.bruteForceDetector = new BruteForceDetector(env);
    this.credentialStuffingDetector = new CredentialStuffingDetector(env);
    this.anomalyDetector = new AnomalyDetector();
    this.riskCalculator = new RiskCalculator();
    this.deviceReputation = new DeviceReputationTracker();
    this.analytics = new AnalyticsCollector(env);
  }

  async assessRisk(attempt: LoginAttempt, userId?: string, lastLocation?: any): Promise<RiskFactors> {
    // Run all detection engines
    const bruteForceScore = await this.bruteForceDetector.detect(attempt);
    
    await this.credentialStuffingDetector.recordAttempt(attempt);
    const credentialStuffingScore = await this.credentialStuffingDetector.detect(attempt);
    
    // Geo-velocity calculation
    let timeDiffHours = 24; // Default to 24 hours if no previous login
    const userLastLogin = lastLocation?.lastLogin || 0;
    if (userLastLogin > 0) {
      timeDiffHours = (attempt.timestamp - userLastLogin) / (1000 * 60 * 60);
    }
    const geoVelocityScore = calculateGeoVelocityScore(
      attempt.location,
      lastLocation?.location,
      timeDiffHours
    );
    
    const anomalyScore = await this.anomalyDetector.detect(attempt, userId);
    
    // Device reputation
    this.deviceReputation.updateReputation(attempt.deviceFingerprint, attempt.success);
    const deviceReputationScore = this.deviceReputation.getRiskScore(attempt.deviceFingerprint);

    // Calculate composite risk score
    const riskFactors = this.riskCalculator.calculate({
      bruteForce: bruteForceScore,
      credentialStuffing: credentialStuffingScore,
      geoVelocity: geoVelocityScore,
      anomaly: anomalyScore,
      deviceReputation: deviceReputationScore
    });

    // Record analytics
    await this.analytics.recordAttempt(attempt, riskFactors.composite, riskFactors.level);

    return riskFactors;
  }

  getChallengeRouter() {
    return {
      shouldRequireChallenge: (riskLevel: string) => riskLevel !== 'low',
      getChallengeType: (riskLevel: string) => {
        if (riskLevel === 'medium') return 'turnstile';
        return 'managed';
      }
    };
  }

  async recordChallengeIssued(ip: string): Promise<void> {
    await this.analytics.recordChallengeIssued(ip);
  }

  async recordChallengeCompleted(ip: string, success: boolean): Promise<void> {
    await this.analytics.recordChallengeCompleted(ip, success);
  }

  async recordBlockedAttempt(ip: string, reason: string): Promise<void> {
    await this.analytics.recordBlockedAttempt(ip, reason);
  }

  getAnalytics() {
    return this.analytics;
  }
}