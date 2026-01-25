import type { LoginAttempt, Location } from '../types';

interface UserBaseline {
  typicalLocations: Location[];
  typicalTimeOfDay: number[]; // Hours when user typically logs in
  typicalDevices: string[];
  lastUpdated: number;
}

export class AnomalyDetector {
  private baselines = new Map<string, UserBaseline>();

  async detect(attempt: LoginAttempt, userId?: string): Promise<number> {
    if (!userId) return 0; // Can't detect anomalies for unknown users

    let baseline = this.baselines.get(userId);
    
    if (!baseline) {
      baseline = await this.buildBaseline(userId);
      this.baselines.set(userId, baseline);
    }

    let score = 0;

    // Check if location is new
    if (attempt.location && baseline.typicalLocations.length > 0) {
      const isNewLocation = this.isNewLocation(attempt.location, baseline.typicalLocations);
      if (isNewLocation) {
        score += 30;
      }
    }

    // Check if time is unusual
    const currentHour = new Date(attempt.timestamp).getHours();
    if (!baseline.typicalTimeOfDay.includes(currentHour)) {
      score += 20;
    }

    // Check if device is new
    if (!baseline.typicalDevices.includes(attempt.deviceFingerprint)) {
      score += 25;
    }

    // Update baseline periodically
    if (Date.now() - baseline.lastUpdated > 7 * 24 * 60 * 60 * 1000 && userId) {
      // Rebuild baseline weekly
      this.updateBaseline(userId, attempt);
    }

    return Math.min(100, score);
  }

  private isNewLocation(current: Location, typical: Location[]): boolean {
    const R = 6371; // Earth's radius in km
    const toleranceKm = 50;

    for (const loc of typical) {
      const dLat = this.toRad(current.latitude - loc.latitude);
      const dLon = this.toRad(current.longitude - loc.longitude);
      
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.toRad(loc.latitude)) * Math.cos(this.toRad(current.latitude)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      if (distance < toleranceKm) {
        return false;
      }
    }

    return true;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private async buildBaseline(_userId: string): Promise<UserBaseline> {
    // In a real implementation, this would query historical data
    // For now, return empty baseline
    return {
      typicalLocations: [],
      typicalTimeOfDay: [],
      typicalDevices: [],
      lastUpdated: Date.now()
    };
  }

  private updateBaseline(_userId: string, attempt: LoginAttempt): void {
    const baseline = this.baselines.get(_userId);
    if (!baseline) return;

    if (attempt.location) {
      baseline.typicalLocations.push(attempt.location);
      // Keep only last 10 locations
      if (baseline.typicalLocations.length > 10) {
        baseline.typicalLocations.shift();
      }
    }

    const hour = new Date(attempt.timestamp).getHours();
    if (!baseline.typicalTimeOfDay.includes(hour)) {
      baseline.typicalTimeOfDay.push(hour);
    }

    if (!baseline.typicalDevices.includes(attempt.deviceFingerprint)) {
      baseline.typicalDevices.push(attempt.deviceFingerprint);
    }

    baseline.lastUpdated = Date.now();
  }
}