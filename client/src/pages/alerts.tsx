import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, XCircle, Clock, Trash2, Eye, EyeOff, PlusCircle } from "lucide-react";

interface Alert {
  id: number;
  websiteId: number;
  alertType: 'down' | 'up' | 'error' | 'website_added' | 'website_deleted';
  message: string;
  sentAt: string;
  emailSent: boolean;
  read: boolean;
  website?: {
    name: string;
    url: string;
  };
}

export default function Alerts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRead, setShowRead] = useState(false);

  const { data: alerts, isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (alertId: number) => {
      await apiRequest("PUT", `/api/alerts/${alertId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "Alert marked as read",
        description: "The alert has been marked as read.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to mark alert as read",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/alerts/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "All alerts marked as read",
        description: "All alerts have been marked as read.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to mark all alerts as read",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAlertMutation = useMutation({
    mutationFn: async (alertId: number) => {
      await apiRequest("DELETE", `/api/alerts/${alertId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "Alert deleted",
        description: "The alert has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete alert",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredAlerts = alerts?.filter(alert => showRead || !alert.read) || [];
  const unreadCount = alerts?.filter(alert => !alert.read).length || 0;

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'down':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'up':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'website_added':
        return <PlusCircle className="h-5 w-5 text-blue-500" />;
      case 'website_deleted':
        return <Trash2 className="h-5 w-5 text-purple-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getAlertBadge = (alertType: string) => {
    switch (alertType) {
      case 'down':
        return <Badge variant="destructive">Down</Badge>;
      case 'up':
        return <Badge variant="default" className="bg-green-500">Up</Badge>;
      case 'error':
        return <Badge variant="secondary" className="bg-yellow-500">Error</Badge>;
      case 'website_added':
        return <Badge variant="default" className="bg-blue-500">Added</Badge>;
      case 'website_deleted':
        return <Badge variant="default" className="bg-purple-500">Deleted</Badge>;
      default:
        return <Badge variant="outline">{alertType}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-gray-600">
            {unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowRead(!showRead)}
            className="flex items-center space-x-2"
          >
            {showRead ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span>{showRead ? 'Hide Read' : 'Show Read'}</span>
          </Button>
          {unreadCount > 0 && (
            <Button
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="flex items-center space-x-2"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Mark All Read</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-grow p-4 overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts</h3>
            <p className="text-gray-600">
              {showRead ? 'No alerts found.' : 'No unread alerts.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAlerts.map((alert) => (
              <Card key={alert.id} className={`${!alert.read ? 'border-l-4 border-l-blue-500' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getAlertIcon(alert.alertType)}
                      <div>
                        <CardTitle className="text-lg">
                          {alert.website?.name || `Website ${alert.websiteId}`}
                        </CardTitle>
                        <CardDescription>
                          {alert.website?.url || 'Unknown URL'}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getAlertBadge(alert.alertType)}
                      {!alert.read && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          New
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 mb-3">{alert.message}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center space-x-4">
                      <span>
                        {new Date(alert.sentAt).toLocaleString()}
                      </span>
                      {alert.emailSent && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Email Sent
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {!alert.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsReadMutation.mutate(alert.id)}
                          disabled={markAsReadMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Mark Read
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAlertMutation.mutate(alert.id)}
                        disabled={deleteAlertMutation.isPending}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 