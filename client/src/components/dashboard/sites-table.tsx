import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, Edit, Pause, Trash2, Globe, Play } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { WebsiteWithStatus } from "@/lib/types";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

interface SitesTableProps {
  searchQuery: string;
  selectedTags: string[];
  websites: WebsiteWithStatus[];
  isLoading: boolean;
}

export default function SitesTable({ searchQuery, selectedTags, websites, isLoading }: SitesTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // WebSocket setup function
  const setupWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsPort = import.meta.env.VITE_WS_PORT || '5001';
    const ws = new WebSocket(`${protocol}//${window.location.hostname}:${wsPort}`);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status_update') {
          queryClient.setQueryData<WebsiteWithStatus[]>(['/api/websites'], (oldData) => {
            if (!oldData) return oldData;
            
            return oldData.map(website => {
              if (website.id === data.websiteId) {
                const updatedWebsite = {
                  ...website,
                  status: data.status,
                  responseTime: data.responseTime,
                  lastCheck: data.timestamp,
                };

                if (website.url.startsWith('https://')) {
                  updatedWebsite.sslValid = data.sslValid;
                  updatedWebsite.sslExpiryDate = data.sslExpiryDate;
                  updatedWebsite.sslDaysLeft = data.sslDaysLeft;
                }

                return updatedWebsite;
              }
              return website;
            });
          });
    
          queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      
      setTimeout(() => {
        if (ws === websocket) {
          setupWebSocket();
        }
      }, 5000);
    };
    
    setWebsocket(ws);
  }, [queryClient]);

  useEffect(() => {
    setupWebSocket();
    return () => {
      if (websocket) {
        websocket.close();
      }
    };
  }, [setupWebSocket]);

  const toggleWebsiteMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/websites/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/websites"] });
      toast({
        title: "Website updated",
        description: "Monitoring status has been changed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update website",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteWebsiteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/websites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/websites"] });
      toast({
        title: "Website deleted",
        description: "The website has been removed from monitoring.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete website",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const checkWebsiteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/websites/${id}/check`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/websites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
      toast({
        title: "Website checked",
        description: "Status check completed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to check website",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'up':
        return <Badge className="bg-green-500/10 text-green-500 border border-green-500/20 dark:bg-green-400/10 dark:text-green-400 dark:border-green-400/20">Online</Badge>;
      case 'down':
        return <Badge className="bg-red-500/10 text-red-500 border border-red-500/20 dark:bg-red-400/10 dark:text-red-400 dark:border-red-400/20">Offline</Badge>;
      default:
        return <Badge className="bg-gray-100/10 text-gray-800 border border-gray-200/20 dark:bg-gray-700/10 dark:text-gray-400 dark:border-gray-600/20">Unknown</Badge>;
    }
  };

  const formatResponseTime = (responseTime: number | null) => {
    if (responseTime === null) return 'N/A';
    return `${responseTime}ms`;
  };

  const formatLastCheck = (lastCheck: string | null) => {
    if (!lastCheck) return 'Never';
    const date = new Date(lastCheck);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const formatSSLExpiryDate = (expiryDate: string) => {
    const date = new Date(expiryDate);
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Monitored Websites</h2>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center space-x-4 p-4">
              <div className="w-8 h-8 bg-gray-200/50 dark:bg-gray-700/50 rounded-lg"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200/50 dark:bg-gray-700/50 rounded w-48"></div>
                <div className="h-3 bg-gray-200/50 dark:bg-gray-700/50 rounded w-32"></div>
              </div>
              <div className="w-16 h-6 bg-gray-200/50 dark:bg-gray-700/50 rounded"></div>
              <div className="w-16 h-4 bg-gray-200/50 dark:bg-gray-700/50 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Monitored Websites</h2>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Website</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Response Time</TableHead>
              <TableHead>Last Check</TableHead>
              <TableHead>SSL Status</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {websites.length > 0 ? (
              websites.map((website) => (
                <TableRow key={website.id} className="group data-[state=selected]:bg-gray-100 dark:data-[state=selected]:bg-gray-800">
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <Globe className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{website.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400"><a href={website.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{website.url}</a></p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(website.status)}</TableCell>
                  <TableCell>{formatResponseTime(website.responseTime)}</TableCell>
                  <TableCell>{formatLastCheck(website.lastCheck)}</TableCell>
                  <TableCell>
                    {website.url.startsWith('https://') ? (
                      website.sslValid ? (
                        <Badge variant="success" title={`SSL valid until ${formatSSLExpiryDate(website.sslExpiryDate!)}`}>Valid</Badge>
                      ) : (
                        <Badge variant="danger" title={website.sslValid === false && website.sslDaysLeft !== null ? `SSL expired: ${website.sslDaysLeft} days ago` : 'SSL Invalid'}>Invalid</Badge>
                      )
                    ) : (
                      <Badge className="bg-gray-100/10 text-gray-800 border border-gray-200/20 dark:bg-gray-700/10 dark:text-gray-400 dark:border-gray-600/20">N/A</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {website.customTags && Object.keys(website.customTags).length > 0 ? (
                        Object.keys(website.customTags).map(tag => (
                          <Badge key={tag} variant="outline" className="text-gray-700 dark:text-gray-300">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <div className="flex items-center justify-end gap-4">
                      <Switch
                        checked={website.isActive}
                        onCheckedChange={(checked) => toggleWebsiteMutation.mutate({ id: website.id, isActive: checked })}
                        className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-200 dark:data-[state=unchecked]:bg-gray-700"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/edit/${website.id}`)}
                        title="Edit Website"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => checkWebsiteMutation.mutate(website.id)}
                        title="Run Manual Check"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteWebsiteMutation.mutate(website.id)}
                        title="Delete Website"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-gray-500 dark:text-gray-400">
                  No websites found matching your criteria.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}


