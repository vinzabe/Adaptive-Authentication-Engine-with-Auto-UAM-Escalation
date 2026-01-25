

export interface DeviceReputation {
  fingerprint: string;
  reputationScore: number; // 0-100, higher is better
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  challengePasses: number;
  challengeFails: number;
  lastSeen: number;
}

export class DeviceReputationTracker {
  private reputation = new Map<string, DeviceReputation>();

  getReputation(fingerprint: string): DeviceReputation | null {
    return this.reputation.get(fingerprint) || null;
  }

  updateReputation(
    fingerprint: string,
    success: boolean,
    challengePassed?: boolean
  ): DeviceReputation {
    let rep = this.reputation.get(fingerprint);
    
    if (!rep) {
      rep = {
        fingerprint,
        reputationScore: 50, // Start at neutral
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        challengePasses: 0,
        challengeFails: 0,
        lastSeen: Date.now()
      };
    }

    rep.totalAttempts++;
    rep.lastSeen = Date.now();

    if (success) {
      rep.successfulAttempts++;
      // Boost reputation for successful logins
      rep.reputationScore = Math.min(100, rep.reputationScore + 2);
    } else {
      rep.failedAttempts++;
      // Decrease reputation for failures
      rep.reputationScore = Math.max(0, rep.reputationScore - 10);
    }

    if (challengePassed !== undefined) {
      if (challengePassed) {
        rep.challengePasses++;
        rep.reputationScore = Math.min(100, rep.reputationScore + 5);
      } else {
        rep.challengeFails++;
        rep.reputationScore = Math.max(0, rep.reputationScore - 15);
      }
    }

    this.reputation.set(fingerprint, rep);
    return rep;
  }

  getRiskScore(fingerprint: string): number {
    const rep = this.reputation.get(fingerprint);
    if (!rep) return 50; // Neutral for unknown devices

    // Invert reputation: 100 reputation = 0 risk, 0 reputation = 100 risk
    return 100 - rep.reputationScore;
  }

  async loadFromStorage(data: string): Promise<void> {
    try {
      const reps = JSON.parse(data) as DeviceReputation[];
      for (const rep of reps) {
        this.reputation.set(rep.fingerprint, rep);
      }
    } catch (e) {
      console.error('Failed to load device reputation:', e);
    }
  }

  async saveToStorage(): Promise<string> {
    const reps = Array.from(this.reputation.values());
    return JSON.stringify(reps);
  }
}