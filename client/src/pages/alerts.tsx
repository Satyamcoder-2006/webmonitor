import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AlertItem } from "@/lib/types";
import { AlertTriangle, CheckCircle, Clock, Search, Filter, Mail, Trash2 } from "lucide-react";

export default function Alerts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: alerts = [], isLoading } = useQuery<AlertItem[]>({
    queryKey: ["/api/alerts", { limit: 100 }],
    refetchInterval: 2000, // Real-time updates
  });

  const deleteAlertMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/alerts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "Alert deleted",
        description: "The alert has been removed.",
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

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/alerts/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "All alerts marked as read",
        description: "Alert status updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update alerts",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      await apiRequest("POST", "/api/test-email", { email });
    },
    onSuccess: () => {
      toast({
        title: "Test email sent",
        description: "Check your inbox for the test email.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send test email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter alerts based on search and filters
  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.website.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === "all" || alert.alertType === filterType;
    
    const matchesStatus = filterStatus === "all" || 
                         (filterStatus === "sent" && alert.emailSent) ||
                         (filterStatus === "pending" && !alert.emailSent);
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case "down":
      case "manual_check":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "up":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getAlertBadge = (alertType: string) => {
    switch (alertType) {
      case "down":
        return <Badge variant="destructive">Down</Badge>;
      case "up":
        return <Badge variant="default" className="bg-green-600">Up</Badge>;
      case "manual_check":
        return <Badge variant="secondary">Manual Check</Badge>;
      default:
        return <Badge variant="outline">{alertType}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Alerts</h1>
        </div>
        
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Alerts</h1>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            Mark All Read
          </Button>
          <Button
            variant="outline"
            onClick={() => testEmailMutation.mutate("test@example.com")}
            disabled={testEmailMutation.isPending}
          >
            <Mail className="h-4 w-4 mr-2" />
            Test Email
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Down Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.filter(a => a.alertType === "down" || a.alertType === "manual_check").length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recovery Alerts</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.filter(a => a.alertType === "up").length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Mail className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.filter(a => a.emailSent).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search alerts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="down">Down</SelectItem>
                <SelectItem value="up">Up</SelectItem>
                <SelectItem value="manual_check">Manual Check</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="sent">Email Sent</SelectItem>
                <SelectItem value="pending">Email Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts found</h3>
              <p className="text-gray-500">
                {alerts.length === 0 
                  ? "No alerts have been generated yet." 
                  : "No alerts match your current filters."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAlerts.map((alert) => (
            <Card key={alert.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getAlertIcon(alert.alertType)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-medium">{alert.website.name}</h3>
                        {getAlertBadge(alert.alertType)}
                        {alert.emailSent && (
                          <Badge variant="outline" className="text-green-600 border-green-200">
                            <Mail className="h-3 w-3 mr-1" />
                            Sent
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{alert.message}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{alert.website.url}</span>
                        <span>•</span>
                        <span>{new Date(alert.sentAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
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
          ))
        )}
      </div>
    </div>
  );
}