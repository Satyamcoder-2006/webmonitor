import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Pie as PieRecharts, Cell, BarChart, Bar, PieChart } from "recharts";
import { TrendingUp, TrendingDown, Clock, Globe, AlertTriangle, CheckCircle, Zap, Shield, Database, AlertCircle, Timer, BarChart3, FileWarning, Tag, Server, ExternalLink, Settings } from "lucide-react";
import { PieChart as PieChartIcon } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

interface WebsiteAnalyticsData {
  website: {
    id: number;
    name: string;
    url: string;
    checkInterval: number;
    isActive: boolean;
    customTags: Record<string, string> | null;
  };
  totalChecks: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  slowestResponseTime: number;
  fastestResponseTime: number;
  uptimePercentage: number;
  downtimeEvents: number;
  totalDowntime: number;
  statusCodeCounts: Record<string, number>;
  mostFrequentErrorCodes: Array<{
    code: number;
    count: number;
  }>;
  numberOfAlerts: number;
  averageTimeToRecovery: number;
  missedChecks: number;
  sslInfo: {
    sslValid: boolean | null;
    sslExpiryDate: string | null;
    sslDaysLeft: number | null;
    isExpiring: boolean;
    isExpired: boolean;
  } | null;
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
  recentActivity: Array<{
    timestamp: string;
    status: string;
    responseTime: number | null;
    httpStatus: number | null;
    errorMessage: string | null;
  }>;
}

const timeRangeOptions = [
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
];

export default function WebsiteAnalytics() {
  const [timeRange, setTimeRange] = useState("24h");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Handle websiteId from URL query parameter
  useEffect(() => {
    const websiteIdFromUrl = searchParams.get('websiteId');
    if (websiteIdFromUrl && websiteIdFromUrl !== selectedWebsiteId) {
      setSelectedWebsiteId(websiteIdFromUrl);
    }
  }, [searchParams, selectedWebsiteId]);

  // Fetch websites for dropdown
  const { data: websites } = useQuery({
    queryKey: ["/api/websites"],
    queryFn: async () => {
      const response = await fetch("/api/websites");
      if (!response.ok) throw new Error("Failed to fetch websites");
      return response.json();
    },
  });

  // Fetch analytics for selected website
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["/api/analytics/website", selectedWebsiteId, timeRange],
    queryFn: async (): Promise<WebsiteAnalyticsData | null> => {
      if (!selectedWebsiteId) return null;
      const response = await fetch(`/api/analytics/website/${selectedWebsiteId}?timeRange=${timeRange}`);
      if (!response.ok) throw new Error("Failed to fetch website analytics");
      const data = await response.json();
      return data as WebsiteAnalyticsData;
    },
    enabled: !!selectedWebsiteId,
    refetchInterval: 60000,
  });

  const statusColors = {
    up: "#10b981",
    down: "#ef4444",
    error: "#f59e0b",
    unknown: "#6b7280"
  };

  const getStatusColor = (status: string) => {
    return statusColors[status as keyof typeof statusColors] || "#6b7280";
  };

  if (!websites || websites.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Website Analytics</h1>
        </div>
        <div className="glass-card rounded-lg p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400">No websites found. Please add some websites first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Website Analytics</h1>
        <div className="flex items-center space-x-4">
          <Select value={selectedWebsiteId} onValueChange={setSelectedWebsiteId}>
            <SelectTrigger className="w-[300px] glass-button">
              <SelectValue placeholder="Select a website" />
            </SelectTrigger>
            <SelectContent>
              {websites.map((website: any) => (
                <SelectItem key={website.id} value={website.id.toString()}>
                  <div className="flex items-center space-x-2">
                    <span>{website.name}</span>
                    <Badge variant={website.isActive ? "default" : "secondary"}>
                      {website.isActive ? "Active" : "Paused"}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedWebsiteId && (
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
          )}
        </div>
      </div>

      {!selectedWebsiteId && (
        <div className="glass-card rounded-lg p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400">Please select a website to view its analytics.</p>
        </div>
      )}

      {selectedWebsiteId && isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      )}

      {analytics && (
        <>
          {/* Website Info Header */}
          <div className="glass-card rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                  {analytics.website.name}
                  <Badge variant={analytics.website.isActive ? "default" : "secondary"} className="ml-2">
                    {analytics.website.isActive ? "Active" : "Paused"}
                  </Badge>
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1 flex items-center">
                  <Globe className="h-4 w-4 mr-2" />
                  {analytics.website.url}
                  <a 
                    href={analytics.website.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-500 hover:text-blue-600"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </p>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <span>Check Interval: {analytics.website.checkInterval} minutes</span>
                  {analytics.website.customTags && Object.keys(analytics.website.customTags).length > 0 && (
                    <div className="flex items-center space-x-1">
                      <Tag className="h-4 w-4" />
                      {Object.entries(analytics.website.customTags).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="text-xs">
                          {key}: {value}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate(`/edit/${analytics.website.id}`)}
                className="glass-button flex items-center space-x-2"
              >
                <Settings className="h-4 w-4" />
                <span>Edit</span>
              </button>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Uptime Percentage */}
            <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Uptime %</span>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.uptimePercentage}%</div>
              <span className="text-xs text-gray-500 dark:text-gray-400">In selected period</span>
            </div>

            {/* Total Downtime */}
            <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Total Downtime</span>
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.totalDowntime} min</div>
              <span className="text-xs text-gray-500 dark:text-gray-400">In selected period</span>
            </div>

            {/* Downtime Events */}
            <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Downtime Events</span>
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.downtimeEvents}</div>
              <span className="text-xs text-gray-500 dark:text-gray-400">In selected period</span>
            </div>

            {/* Total Checks */}
            <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Total Checks</span>
                <BarChart3 className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.totalChecks}</div>
              <span className="text-xs text-gray-500 dark:text-gray-400">In selected period</span>
            </div>

            {/* Alerts Sent */}
            <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Alerts Sent</span>
                <Zap className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.numberOfAlerts}</div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Triggered in period</span>
            </div>

            {/* Missed Checks */}
            <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Missed Checks</span>
                <Timer className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.missedChecks}</div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Gaps &gt;6min</span>
            </div>

            {/* Average Response Time */}
            <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Avg Response</span>
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.averageResponseTime} ms</div>
              <span className="text-xs text-gray-500 dark:text-gray-400">In selected period</span>
            </div>

            {/* 95th/99th Percentile Response Time */}
            <div className="glass-card rounded-lg p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">95th/99th Percentile</span>
                <TrendingUp className="h-5 w-5 text-pink-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.p95ResponseTime} / {analytics.p99ResponseTime} ms</div>
              <span className="text-xs text-gray-500 dark:text-gray-400">High latency</span>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Response Time Chart */}
            <div className="glass-card rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-pink-500" /> Response Time
              </h3>
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
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white flex items-center">
                <PieChartIcon className="h-5 w-5 mr-2 text-blue-500" /> Status Distribution
              </h3>
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
                      <Cell key={`cell-${index}`} fill={getStatusColor(entry.status)} />
                    ))}
                  </PieRecharts>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* HTTP Status Codes Bar Chart */}
            <div className="glass-card rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-blue-500" /> HTTP Status Codes
              </h3>
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

          {/* SSL Information */}
          {analytics.sslInfo && (
            <div className="glass-card rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
                <Shield className="h-5 w-5 mr-2 text-blue-500" /> SSL Certificate Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant={analytics.sslInfo.sslValid ? "default" : "destructive"}>
                    {analytics.sslInfo.sslValid ? "Valid" : "Invalid"}
                  </Badge>
                </div>
                {analytics.sslInfo.sslDaysLeft !== null && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Days Left:</span>
                    <Badge variant={
                      analytics.sslInfo.isExpired ? "destructive" : 
                      analytics.sslInfo.isExpiring ? "secondary" : "default"
                    }>
                      {analytics.sslInfo.sslDaysLeft} days
                    </Badge>
                  </div>
                )}
                {analytics.sslInfo.sslExpiryDate && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Expires:</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(analytics.sslInfo.sslExpiryDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tables Section */}
          <div className="grid gap-8">
            {/* Most Frequent Error Codes */}
            <div className="glass-card rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
                <FileWarning className="h-5 w-5 mr-2 text-red-500" /> Most Frequent Error Codes
              </h3>
              {analytics.mostFrequentErrorCodes && analytics.mostFrequentErrorCodes.length > 0 ? (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 dark:text-gray-400">
                      <th className="py-2 pr-4">Code</th>
                      <th className="py-2 pr-4">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.mostFrequentErrorCodes.map((err) => (
                      <tr key={err.code} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 pr-4 font-mono text-red-600 dark:text-red-400">{err.code}</td>
                        <td className="py-2 pr-4">{err.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-gray-500">No error codes in this period.</div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="glass-card rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center">
                <Database className="h-5 w-5 mr-2 text-green-500" /> Recent Activity
              </h3>
              {analytics.recentActivity && analytics.recentActivity.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {analytics.recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline" style={{ backgroundColor: getStatusColor(activity.status) + '20', color: getStatusColor(activity.status) }}>
                          {activity.status.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(activity.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        {activity.responseTime && (
                          <span className="text-gray-600 dark:text-gray-400">
                            {activity.responseTime}ms
                          </span>
                        )}
                        {activity.httpStatus && (
                          <span className="font-mono text-gray-600 dark:text-gray-400">
                            {activity.httpStatus}
                          </span>
                        )}
                        {activity.errorMessage && (
                          <span className="text-red-600 dark:text-red-400 max-w-xs truncate" title={activity.errorMessage}>
                            {activity.errorMessage}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500">No recent activity in this period.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
} 