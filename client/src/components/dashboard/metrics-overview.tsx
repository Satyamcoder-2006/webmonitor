import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Clock, TrendingUp } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DashboardStats } from "@/lib/types";
import { useState, useEffect, useCallback } from "react";

export default function MetricsOverview() {
  const queryClient = useQueryClient();
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });

  // WebSocket setup function
  const setupWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsPort = import.meta.env.VITE_WS_PORT || '5001';
    const ws = new WebSocket(`${protocol}//${window.location.hostname}:${wsPort}`);
    
    ws.onopen = () => {
      console.log('MetricsOverview WebSocket connected');
      setIsConnected(true);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          console.log('MetricsOverview WebSocket connection confirmed:', data.message);
          return;
        }
        
        if (data.type === 'status_update') {
          // Invalidate the /api/stats query to refetch latest metrics
          queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
        }
      } catch (error) {
        console.error('Error processing MetricsOverview WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('MetricsOverview WebSocket error:', error);
      setIsConnected(false);
    };
    
    ws.onclose = () => {
      console.log('MetricsOverview WebSocket disconnected');
      setIsConnected(false);
      
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (ws === websocket) { // Only reconnect if this is still the current WebSocket
          setupWebSocket();
        }
      }, 5000);
    };
    
    setWebsocket(ws);
  }, [queryClient]);

  // Initialize WebSocket connection
  useEffect(() => {
    setupWebSocket();
    
    return () => {
      if (websocket) {
        websocket.close();
      }
    };
  }, [setupWebSocket]);

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
      value: `${stats?.uptime || 0}%`,
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


