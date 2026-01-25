import { Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { useMetricsStore } from '../stores/metricsStore';

export function MetricCard({ title, value, icon: Icon, color }: { title: string; value: number | string; icon: any; color: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-white mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

export function DashboardOverview() {
  const { metrics, loading } = useMetricsStore();

  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-6 border border-gray-700 animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-700 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        title="Total Attempts"
        value={metrics.totalAttempts || 0}
        icon={Shield}
        color="bg-blue-600"
      />
      <MetricCard
        title="Successful Logins"
        value={metrics.successfulLogins || 0}
        icon={CheckCircle}
        color="bg-green-600"
      />
      <MetricCard
        title="Failed Attempts"
        value={metrics.failedLogins || 0}
        icon={AlertTriangle}
        color="bg-yellow-600"
      />
      <MetricCard
        title="Blocked Attacks"
        value={metrics.blockedAttempts || 0}
        icon={Shield}
        color="bg-red-600"
      />
    </div>
  );
}