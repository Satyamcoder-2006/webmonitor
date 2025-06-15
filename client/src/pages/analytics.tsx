import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Clock, Globe, AlertTriangle, CheckCircle } from "lucide-react";
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
}

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("24h");
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics", { timeRange }],
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </div>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
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

  const timeRangeOptions = [
    { value: "24h", label: "Last 24 Hours" },
    { value: "7d", label: "Last 7 Days" },
    { value: "30d", label: "Last 30 Days" },
    { value: "90d", label: "Last 90 Days" }
  ];

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

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card rounded-lg p-6 hover-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Total Checks</h3>
            <Globe className="h-4 w-4 text-gray-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics?.totalChecks || 0}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Since monitoring started
          </p>
        </div>
        
        <div className="glass-card rounded-lg p-6 hover-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Avg Response Time</h3>
            <Clock className="h-4 w-4 text-gray-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics?.averageResponseTime || 0}ms</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Across all websites
          </p>
        </div>
        
        <div className="glass-card rounded-lg p-6 hover-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Uptime</h3>
            <CheckCircle className="h-4 w-4 text-success" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics?.uptimePercentage || 0}%</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last 24 hours
          </p>
        </div>
        
        <div className="glass-card rounded-lg p-6 hover-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Downtime Events</h3>
            <AlertTriangle className="h-4 w-4 text-danger" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics?.downtimeEvents || 0}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last 24 hours
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass-card rounded-lg p-6 hover-card">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Response Time Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics?.responseTimeData || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="hour" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                formatter={(value, name) => [`${value}ms`, 'Response Time']}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="averageResponseTime" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Avg Response Time (ms)"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="glass-card rounded-lg p-6 hover-card">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analytics?.statusDistribution || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ status, percentage }) => `${status}: ${percentage}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
              >
                {analytics?.statusDistribution?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={statusColors[entry.status as keyof typeof statusColors] || "#6b7280"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Moved Components */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass-card rounded-lg p-6 hover-card">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">24h Response Time</h3>
          <PerformanceChart />
        </div>
        <div className="glass-card rounded-lg p-6 hover-card">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Recent Activity</h3>
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}
