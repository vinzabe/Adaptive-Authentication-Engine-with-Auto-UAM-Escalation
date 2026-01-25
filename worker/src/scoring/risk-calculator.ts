import type { RiskFactors, RiskLevel } from '../types';

export interface RiskWeights {
  bruteForce: number;
  credentialStuffing: number;
  geoVelocity: number;
  anomaly: number;
  deviceReputation: number;
}

export const DEFAULT_WEIGHTS: RiskWeights = {
  bruteForce: 0.30,
  credentialStuffing: 0.25,
  geoVelocity: 0.20,
  anomaly: 0.15,
  deviceReputation: 0.10
};

export class RiskCalculator {
  constructor(private weights: RiskWeights = DEFAULT_WEIGHTS) {}

  calculate(factors: {
    bruteForce: number;
    credentialStuffing: number;
    geoVelocity: number;
    anomaly: number;
    deviceReputation: number;
  }): RiskFactors {
    const composite =
      factors.bruteForce * this.weights.bruteForce +
      factors.credentialStuffing * this.weights.credentialStuffing +
      factors.geoVelocity * this.weights.geoVelocity +
      factors.anomaly * this.weights.anomaly +
      factors.deviceReputation * this.weights.deviceReputation;

    return {
      bruteForce: factors.bruteForce,
      credentialStuffing: factors.credentialStuffing,
      geoVelocity: factors.geoVelocity,
      anomaly: factors.anomaly,
      deviceReputation: factors.deviceReputation,
      composite: Math.min(100, Math.max(0, composite)),
      level: this.getRiskLevel(composite)
    };
  }

  getRiskLevel(score: number): RiskLevel {
    if (score < 30) return 'low';
    if (score < 60) return 'medium';
    if (score < 85) return 'high';
    return 'critical';
  }

  updateWeights(newWeights: Partial<RiskWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
  }

  getWeights(): RiskWeights {
    return { ...this.weights };
  }
}