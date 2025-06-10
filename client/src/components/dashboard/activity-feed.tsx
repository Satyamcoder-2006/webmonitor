import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import type { ActivityItem } from "@/lib/types";

export default function ActivityFeed() {
  const { data: activities = [], isLoading } = useQuery<ActivityItem[]>({
    queryKey: ["/api/activity"],
  });

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'recovery':
        return 'bg-green-500';
      case 'outage':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-start space-x-3 animate-pulse">
                <div className="w-2 h-2 bg-gray-200 rounded-full mt-2"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No recent activity</p>
            <p className="text-sm">Activity will appear when websites are monitored</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.slice(0, 10).map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`w-2 h-2 ${getActivityColor(activity.type)} rounded-full mt-2`}></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500">{formatTime(activity.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
