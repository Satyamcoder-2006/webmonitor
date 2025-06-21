import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Pie as PieRecharts, Cell, BarChart, Bar, PieChart } from "recharts";
import { TrendingUp, TrendingDown, Clock, Globe, AlertTriangle, CheckCircle, Zap, Shield, Database, AlertCircle, Timer, BarChart3, FileWarning, Tag, Server } from "lucide-react";
import { PieChart as PieChartIcon } from "lucide-react";
import PerformanceChart from "@/components/dashboard/performance-chart";
import ActivityFeed from "@/components/dashboard/activity-feed";

interface AnalyticsData {
  totalChecks: number;
  averageResponseTime: number;
  uptimePercentage: number;
  downtimeEvents: number;
  responseTimeData: Array<{
    hour: string;
    averageResponseTime: number;
    checks: number;
  }>;
  statusDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  websiteStats: Array<{
    id: number;
    name: string;
    url: string;
    totalChecks: number;
    uptime: number;
    averageResponseTime: number;
    lastDowntime: string | null;
  }>;
  statusCodeCounts: Record<string, number>;
  mostFrequentErrorCodes: Array<{
    code: string;
    count: number;
  }>;
  expiringSSLs: Array<{
    id: number;
    url: string;
    sslDaysLeft: number;
  }>;
  expiredSSLs: Array<{
    id: number;
    url: string;
  }>;
  tagAnalytics: Array<{
    tag: string;
    avgUptime: number;
    avgResponseTime: number;
  }>;
}

const timeRangeOptions = [
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
];

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("24h");
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["/api/analytics", timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/analytics?timeRange=${timeRange}`);
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <div className="glass-card rounded-lg p-6">
            <Skeleton className="h-6 w-48 mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="glass-card rounded-lg p-6">
            <Skeleton className="h-6 w-48 mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const statusColors = {
    up: "#10b981",
    down: "#ef4444",
    unknown: "#6b7280"
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <div className="flex items-center space-x-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px] glass-button">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              {timeRangeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      )}

      {analytics && (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Uptime Percentage */}
          <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">Uptime %</span>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.uptimePercentage ?? 0}%</div>
            <span className="text-xs text-gray-500 dark:text-gray-400">In selected period</span>
          </div>
          {/* Total Downtime */}
          <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">Total Downtime</span>
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.totalDowntime ?? 0} min</div>
            <span className="text-xs text-gray-500 dark:text-gray-400">In selected period</span>
          </div>
          {/* Downtime Events */}
          <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">Downtime Events</span>
              <AlertCircle className="h-5 w-5 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.downtimeEvents ?? 0}</div>
            <span className="text-xs text-gray-500 dark:text-gray-400">In selected period</span>
          </div>
          {/* Total Checks */}
          <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">Total Checks</span>
              <BarChart3 className="h-5 w-5 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.totalChecks ?? 0}</div>
            <span className="text-xs text-gray-500 dark:text-gray-400">In selected period</span>
          </div>
          {/* Number of Alerts */}
          <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">Alerts Sent</span>
              <Zap className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.numberOfAlerts ?? 0}</div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Triggered in period</span>
          </div>
          {/* Missed Checks */}
          <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">Missed Checks</span>
              <Timer className="h-5 w-5 text-purple-500" />
        </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.missedChecks ?? 0}</div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Gaps &gt;6min</span>
          </div>
          {/* Average Response Time */}
          <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">Avg Response</span>
              <Clock className="h-5 w-5 text-blue-400" />
        </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.averageResponseTime ?? 0} ms</div>
            <span className="text-xs text-gray-500 dark:text-gray-400">In selected period</span>
          </div>
          {/* 95th/99th Percentile Response Time */}
          <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">95th/99th Percentile</span>
              <TrendingUp className="h-5 w-5 text-pink-500" />
        </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.p95ResponseTime ?? 0} / {analytics.p99ResponseTime ?? 0} ms</div>
            <span className="text-xs text-gray-500 dark:text-gray-400">High latency</span>
          </div>
        </div>
      )}

      {/* Charts Section */}
      {analytics && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-8">
          {/* Response Time Chart */}
          <div className="glass-card rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white flex items-center"><TrendingUp className="h-5 w-5 mr-2 text-pink-500" /> Response Time</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={analytics.responseTimeData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <YAxis yAxisId={1} orientation="right" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="averageResponseTime" stroke="#6366f1" name="Avg Response (ms)" />
                <Line type="monotone" dataKey="checks" stroke="#f59e42" name="Checks" yAxisId={1} />
              </LineChart>
            </ResponsiveContainer>
      </div>
          {/* Status Distribution Pie Chart */}
          <div className="glass-card rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white flex items-center"><PieChartIcon className="h-5 w-5 mr-2 text-blue-500" /> Status Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
            <PieChart>
                <PieRecharts
                  data={analytics.statusDistribution}
                  dataKey="count"
                  nameKey="status"
                cx="50%"
                cy="50%"
                  outerRadius={70}
                  label={({ status, percentage }: any) => `${status}: ${percentage}%`}
              >
                  {analytics.statusDistribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={['#22c55e', '#ef4444', '#f59e42', '#6366f1', '#6b7280'][index % 5]} />
                ))}
                </PieRecharts>
              <Tooltip />
                <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
          {/* HTTP Status Codes Bar Chart */}
          <div className="glass-card rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white flex items-center"><BarChart3 className="h-5 w-5 mr-2 text-blue-500" /> HTTP Status Codes</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={Object.entries(analytics.statusCodeCounts).map(([code, count]) => ({ code, count }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="code" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#6366f1" name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tables/Lists Section */}
      {analytics && (
        <div className="grid gap-8 mt-8">
          {/* Most Frequent Error Codes */}
          <div className="glass-card rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white flex items-center"><FileWarning className="h-5 w-5 mr-2 text-red-500" /> Most Frequent Error Codes</h3>
            {analytics.mostFrequentErrorCodes && analytics.mostFrequentErrorCodes.length > 0 ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 dark:text-gray-400">
                    <th className="py-1 pr-4">Code</th>
                    <th className="py-1 pr-4">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.mostFrequentErrorCodes.map((err: any) => (
                    <tr key={err.code} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-1 pr-4 font-mono text-red-600 dark:text-red-400">{err.code}</td>
                      <td className="py-1 pr-4">{err.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="text-gray-500">No error codes in this period.</div>}
          </div>
          {/* Expiring/Expired SSLs */}
          <div className="glass-card rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white flex items-center"><Shield className="h-5 w-5 mr-2 text-blue-500" /> Expiring/Expired SSLs</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-1 text-yellow-600">Expiring Soon (≤30 days)</h4>
                {analytics.expiringSSLs && analytics.expiringSSLs.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {analytics.expiringSSLs.map((ssl: any) => (
                      <li key={ssl.id} className="mb-1">
                        <span className="font-mono text-blue-700 dark:text-blue-300">{ssl.url}</span> - <span className="font-semibold">{ssl.sslDaysLeft} days left</span>
                      </li>
                    ))}
                  </ul>
                ) : <div className="text-gray-500">No expiring SSLs.</div>}
              </div>
              <div>
                <h4 className="font-semibold mb-1 text-red-600">Expired</h4>
                {analytics.expiredSSLs && analytics.expiredSSLs.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {analytics.expiredSSLs.map((ssl: any) => (
                      <li key={ssl.id} className="mb-1">
                        <span className="font-mono text-blue-700 dark:text-blue-300">{ssl.url}</span> - <span className="font-semibold">Expired</span>
                      </li>
                    ))}
                  </ul>
                ) : <div className="text-gray-500">No expired SSLs.</div>}
              </div>
            </div>
          </div>
          {/* Tag Analytics */}
          <div className="glass-card rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white flex items-center"><Tag className="h-5 w-5 mr-2 text-green-500" /> Tag Analytics</h3>
            {analytics.tagAnalytics && analytics.tagAnalytics.length > 0 ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 dark:text-gray-400">
                    <th className="py-1 pr-4">Tag</th>
                    <th className="py-1 pr-4">Avg Uptime %</th>
                    <th className="py-1 pr-4">Avg Response (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.tagAnalytics.map((tag: any) => (
                    <tr key={tag.tag} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-1 pr-4">{tag.tag}</td>
                      <td className="py-1 pr-4">{tag.avgUptime}</td>
                      <td className="py-1 pr-4">{tag.avgResponseTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="text-gray-500">No tag analytics in this period.</div>}
          </div>
          {/* Website Stats */}
          <div className="glass-card rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white flex items-center"><Server className="h-5 w-5 mr-2 text-blue-600" /> Website Stats</h3>
            {analytics.websiteStats && analytics.websiteStats.length > 0 ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 dark:text-gray-400">
                    <th className="py-1 pr-4">Name</th>
                    <th className="py-1 pr-4">URL</th>
                    <th className="py-1 pr-4">Checks</th>
                    <th className="py-1 pr-4">Uptime %</th>
                    <th className="py-1 pr-4">Avg Response (ms)</th>
                    <th className="py-1 pr-4">Last Downtime</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.websiteStats.map((site: any) => (
                    <tr key={site.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-1 pr-4 font-semibold">{site.name}</td>
                      <td className="py-1 pr-4 font-mono text-blue-700 dark:text-blue-300">{site.url}</td>
                      <td className="py-1 pr-4">{site.totalChecks}</td>
                      <td className="py-1 pr-4">{site.uptime}</td>
                      <td className="py-1 pr-4">{site.averageResponseTime}</td>
                      <td className="py-1 pr-4">{site.lastDowntime ? new Date(site.lastDowntime).toLocaleString() : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="text-gray-500">No website stats in this period.</div>}
        </div>
      </div>
      )}

      {/* Moved Components */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass-card rounded-lg p-6 hover-card">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Recent Activity</h3>
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
