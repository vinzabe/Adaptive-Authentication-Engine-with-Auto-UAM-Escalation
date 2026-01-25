import type { RiskLevel } from '../types';

export interface ChallengeConfig {
  riskLevel: RiskLevel;
  challengeType: 'turnstile' | 'managed';
  difficulty: 'easy' | 'medium' | 'hard';
  timeout: number; // seconds
}

export const CHALLENGE_CONFIGS: Record<RiskLevel, ChallengeConfig> = {
  low: {
    riskLevel: 'low',
    challengeType: 'turnstile',
    difficulty: 'easy',
    timeout: 300
  },
  medium: {
    riskLevel: 'medium',
    challengeType: 'turnstile',
    difficulty: 'medium',
    timeout: 600
  },
  high: {
    riskLevel: 'high',
    challengeType: 'managed',
    difficulty: 'medium',
    timeout: 900
  },
  critical: {
    riskLevel: 'critical',
    challengeType: 'managed',
    difficulty: 'hard',
    timeout: 1200
  }
};

export class ChallengeRouter {
  getChallengeForRisk(riskLevel: RiskLevel): ChallengeConfig {
    return CHALLENGE_CONFIGS[riskLevel];
  }

  shouldRequireChallenge(riskLevel: RiskLevel): boolean {
    return riskLevel !== 'low';
  }

  getChallengeType(riskLevel: RiskLevel): 'turnstile' | 'managed' {
    if (riskLevel === 'low') return 'turnstile';
    if (riskLevel === 'medium') return 'turnstile';
    return 'managed';
  }
}