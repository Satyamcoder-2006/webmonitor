import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Clock, Globe, AlertTriangle, CheckCircle } from "lucide-react";

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
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
    refetchInterval: 5000, // Refresh every 5 seconds for real-time data
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Analytics</h1>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
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
        <h1 className="text-3xl font-bold">Analytics</h1>
        <Badge variant="outline" className="text-sm">
          Real-time monitoring active
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Checks</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalChecks || 0}</div>
            <p className="text-xs text-muted-foreground">
              Since monitoring started
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.averageResponseTime || 0}ms</div>
            <p className="text-xs text-muted-foreground">
              Across all websites
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.uptimePercentage || 0}%</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Downtime Events</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.downtimeEvents || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Response Time Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics?.responseTimeData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip formatter={(value, name) => [`${value}ms`, 'Response Time']} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="averageResponseTime" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Avg Response Time (ms)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>

      {/* Website Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Website Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4">Website</th>
                  <th className="text-left p-4">Total Checks</th>
                  <th className="text-left p-4">Uptime</th>
                  <th className="text-left p-4">Avg Response</th>
                  <th className="text-left p-4">Last Downtime</th>
                </tr>
              </thead>
              <tbody>
                {analytics?.websiteStats?.map((website) => (
                  <tr key={website.id} className="border-b">
                    <td className="p-4">
                      <div>
                        <div className="font-medium">{website.name}</div>
                        <div className="text-sm text-muted-foreground">{website.url}</div>
                      </div>
                    </td>
                    <td className="p-4">{website.totalChecks}</td>
                    <td className="p-4">
                      <Badge variant={website.uptime >= 99 ? "default" : website.uptime >= 95 ? "secondary" : "destructive"}>
                        {website.uptime}%
                      </Badge>
                    </td>
                    <td className="p-4">{website.averageResponseTime}ms</td>
                    <td className="p-4">
                      {website.lastDowntime ? new Date(website.lastDowntime).toLocaleString() : "Never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}