import { useEffect } from 'react';
import { Shield, Lock, Zap } from 'lucide-react';
import { DashboardOverview, MetricCard } from '../components/MetricCard';
import { RiskDistributionChart } from '../components/RiskDistributionChart';
import { AttemptsChart } from '../components/AttemptsChart';
import { ThreatTable } from '../components/ThreatTable';
import { useMetricsStore } from '../stores/metricsStore';

export function Dashboard() {
  const { metrics, fetchMetrics } = useMetricsStore();

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Security Dashboard</h1>
          <p className="text-gray-400">Real-time authentication and threat monitoring</p>
        </div>

        <DashboardOverview />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <RiskDistributionChart />
          <AttemptsChart />
        </div>

        <div className="mt-6">
          <ThreatTable />
        </div>

        {metrics && metrics.challengesIssued > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <MetricCard
              title="Challenges Issued"
              value={metrics.challengesIssued}
              icon={Lock}
              color="bg-purple-600"
            />
            <MetricCard
              title="Challenge Completions"
              value={metrics.challengeCompletions}
              icon={Zap}
              color="bg-indigo-600"
            />
          </div>
        )}

        <div className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6">
          <div className="flex items-center gap-4">
            <Shield className="w-12 h-12 text-white" />
            <div>
              <h3 className="text-xl font-bold text-white">Adaptive Protection Active</h3>
              <p className="text-blue-100 mt-1">
                Your authentication engine is actively monitoring and protecting against threats
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}