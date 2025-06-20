import { CheckCircle, XCircle, Clock, TrendingUp, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "@/lib/types";

export default function MetricsOverview() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card rounded-lg p-6 animate-pulse">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gray-200/50 dark:bg-gray-700/50 rounded-lg mr-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200/50 dark:bg-gray-700/50 rounded w-16"></div>
                <div className="h-8 bg-gray-200/50 dark:bg-gray-700/50 rounded w-12"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Calculate SSL health percentage if available in stats
  const sslHealth = stats?.sslHealth !== undefined ? stats.sslHealth : 100;
  
  const metrics = [
    {
      title: "Sites Up",
      value: stats?.sitesUp || 0,
      icon: CheckCircle,
      bgColor: "bg-green-500/10",
      iconColor: "text-green-500",
      borderColor: "border-green-500/20",
    },
    {
      title: "Sites Down",
      value: stats?.sitesDown || 0,
      icon: XCircle,
      bgColor: "bg-red-500/10",
      iconColor: "text-red-500",
      borderColor: "border-red-500/20",
    },
    {
      title: "SSL Health",
      value: `${sslHealth}%`,
      icon: Shield,
      bgColor: sslHealth > 90 ? "bg-green-500/10" : sslHealth > 70 ? "bg-orange-500/10" : "bg-red-500/10",
      iconColor: sslHealth > 90 ? "text-green-500" : sslHealth > 70 ? "text-orange-500" : "text-red-500",
      borderColor: sslHealth > 90 ? "border-green-500/20" : sslHealth > 70 ? "border-orange-500/20" : "border-red-500/20",
    },
    {
      title: "Uptime",
      value: `${stats?.uptime || 0}%`,
      icon: TrendingUp,
      bgColor: "bg-blue-500/10",
      iconColor: "text-blue-500",
      borderColor: "border-blue-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div 
            key={metric.title} 
            className={`glass-card rounded-lg p-6 border ${metric.borderColor} hover-card`}
          >
            <div className="flex items-center">
              <div className={`w-12 h-12 ${metric.bgColor} rounded-lg flex items-center justify-center`}>
                <Icon className={`${metric.iconColor} text-xl h-6 w-6`} />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">{metric.title}</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{metric.value}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


