import { AlertTriangle, XCircle } from 'lucide-react';
import { useMetricsStore } from '../stores/metricsStore';

export function ThreatTable() {
  const { metrics } = useMetricsStore();

  if (!metrics || !metrics.topRiskIPs) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Top Risk IPs</h3>
        <p className="text-gray-400">No threat data available</p>
      </div>
    );
  }

  const sortedIPs = [...metrics.topRiskIPs]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (sortedIPs.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Top Risk IPs</h3>
        <p className="text-gray-400">No threats detected</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Top Risk IPs</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-400 font-medium">IP Address</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Risk Score</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Attempts</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedIPs.map((ip) => (
              <tr key={ip.ip} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-3 px-4 text-white">{ip.ip}</td>
                <td className="py-3 px-4 text-white">
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          ip.score > 70 ? 'bg-red-600' : ip.score > 40 ? 'bg-yellow-600' : 'bg-green-600'
                        }`}
                        style={{ width: `${ip.score}%` }}
                      />
                    </div>
                    <span className="text-sm">{ip.score.toFixed(0)}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-white">{ip.attempts}</td>
                <td className="py-3 px-4">
                  {ip.score > 70 ? (
                    <span className="flex items-center gap-1 text-red-400">
                      <XCircle className="w-4 h-4" />
                      High Risk
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-yellow-400">
                      <AlertTriangle className="w-4 h-4" />
                      Suspicious
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}