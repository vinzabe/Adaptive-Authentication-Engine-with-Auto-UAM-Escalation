import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMetricsStore } from '../stores/metricsStore';

export function AttemptsChart() {
  const { metrics } = useMetricsStore();

  if (!metrics || !metrics.hourlyAttempts) {
    return null;
  }

  const data = metrics.hourlyAttempts.map(h => ({
    hour: `${h.hour}:00`,
    attempts: h.attempts,
    blocked: h.blocked
  }));

  if (data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Hourly Attempts</h3>
        <p className="text-gray-400">No hourly data available</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Hourly Attempts</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="hour" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
            itemStyle={{ color: '#f3f4f6' }}
          />
          <Line type="monotone" dataKey="attempts" stroke="#3b82f6" name="Total Attempts" strokeWidth={2} />
          <Line type="monotone" dataKey="blocked" stroke="#ef4444" name="Blocked" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}