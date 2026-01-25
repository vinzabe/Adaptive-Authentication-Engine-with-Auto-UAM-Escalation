import { create } from 'zustand';

interface Metrics {
  totalAttempts: number;
  successfulLogins: number;
  failedLogins: number;
  blockedAttempts: number;
  challengesIssued: number;
  challengeCompletions: number;
  riskScoreDistribution: Record<string, number>;
  attackTypes: Record<string, number>;
  topRiskIPs: Array<{ ip: string; score: number; attempts: number }>;
  hourlyAttempts: Array<{ hour: number; attempts: number; blocked: number }>;
}

interface MetricsState {
  metrics: Metrics | null;
  loading: boolean;
  error: string | null;
  fetchMetrics: () => Promise<void>;
}

export const useMetricsStore = create<MetricsState>((set) => ({
  metrics: null,
  loading: false,
  error: null,
  fetchMetrics: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/metrics');
      if (response.ok) {
        const data = await response.json();
        set({ metrics: data, loading: false });
      }
    } catch (error) {
      set({ error: 'Failed to fetch metrics', loading: false });
    }
  },
}));