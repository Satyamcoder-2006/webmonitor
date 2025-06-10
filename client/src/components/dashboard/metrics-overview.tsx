import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Clock, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "@/lib/types";

export default function MetricsOverview() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-200 rounded-lg mr-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                  <div className="h-8 bg-gray-200 rounded w-12"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      title: "Sites Up",
      value: stats?.sitesUp || 0,
      icon: CheckCircle,
      bgColor: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      title: "Sites Down",
      value: stats?.sitesDown || 0,
      icon: XCircle,
      bgColor: "bg-red-100",
      iconColor: "text-red-600",
    },
    {
      title: "Avg Response",
      value: `${stats?.averageResponseTime || 0}ms`,
      icon: Clock,
      bgColor: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      title: "Uptime",
      value: `${stats?.uptime || 100}%`,
      icon: TrendingUp,
      bgColor: "bg-yellow-100",
      iconColor: "text-yellow-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card key={metric.title} className="border border-gray-100">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`w-12 h-12 ${metric.bgColor} rounded-lg flex items-center justify-center`}>
                  <Icon className={`${metric.iconColor} text-xl h-6 w-6`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">{metric.title}</p>
                  <p className="text-2xl font-semibold text-gray-900">{metric.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
