import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, Edit, Pause, Trash2, Globe, Play } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { WebsiteWithStatus } from "@/lib/types";
import { useLocation } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SitesTableProps {
  searchQuery: string;
  selectedTags: string[];
}

export default function SitesTable({ searchQuery, selectedTags }: SitesTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const { data: websites = [], isLoading } = useQuery<WebsiteWithStatus[]>({
    queryKey: ["/api/websites"],
  });

  const filteredWebsites = websites.filter(website => {
    console.log(`Website: ${website.name}, Custom Tags:`, website.customTags);
    const matchesSearch = website.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          website.url.toLowerCase().includes(searchQuery.toLowerCase());

    const hasSelectedTags = selectedTags.length === 0 ||
                            (
                              website.customTags && 
                              selectedTags.some(selectedTag => 
                                Object.keys(website.customTags).includes(selectedTag)
                              )
                            );

    return matchesSearch && hasSelectedTags;
  });

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
        console.log('[WebSocket Client - SitesTable] Received message:', data);
        
        if (data.type === 'status_update') {
          // Update the website status in the cache
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

                // Only update SSL information for HTTPS URLs
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
    
          // Also invalidate the stats query to update metrics
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
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Online</Badge>;
      case 'down':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Offline</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Unknown</Badge>;
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
      <Card>
        <CardHeader>
          <CardTitle>Monitored Websites</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center space-x-4 p-4">
                <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-48"></div>
                  <div className="h-3 bg-gray-200 rounded w-32"></div>
                </div>
                <div className="w-16 h-6 bg-gray-200 rounded"></div>
                <div className="w-16 h-4 bg-gray-200 rounded"></div>
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
        <div className="flex items-center justify-between">
          <CardTitle>Monitored Websites</CardTitle>
          <div className="flex items-center space-x-2">
            {/* Removed reconnection status display */}
            {/* {!isConnected && (
              <Badge variant="destructive" className="animate-pulse">
                Reconnecting...
              </Badge>
            )} */}
          </div>
        </div>
      </CardHeader>
      
      {websites.length === 0 ? (
        <CardContent className="p-0">
          <div className="text-center py-12">
            <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No websites monitored yet</h3>
            <p className="text-gray-500">Add your first website to start monitoring its status.</p>
          </div>
        </CardContent>
      ) : (
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Website</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Response Time</TableHead>
                  <TableHead>Last Check</TableHead>
                  <TableHead>SSL Status</TableHead>
                  <TableHead>SSL Expiry</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWebsites.map((website) => (
                  <TableRow key={website.id}>
                    <TableCell className="font-medium">
                      <a href={`/website/${website.id}`} className="hover:underline">
                        {website.name}
                      </a>
                      <p className="text-gray-500 text-sm truncate w-48">
                        {website.url}
                      </p>
                    </TableCell>
                    <TableCell>{getStatusBadge(website.status)}</TableCell>
                    <TableCell>{formatResponseTime(website.responseTime)}</TableCell>
                    <TableCell>{formatLastCheck(website.lastCheck)}</TableCell>
                    <TableCell>
                      {website.sslValid === true && <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Valid</Badge>}
                      {website.sslValid === false && <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Invalid</Badge>}
                      {website.sslValid === null && <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">N/A</Badge>}
                    </TableCell>
                    <TableCell>
                      {website.sslExpiryDate && website.sslDaysLeft !== null ? (
                        <span className={website.sslDaysLeft <= 30 ? "text-red-500 font-semibold" : ""}>
                          {formatSSLExpiryDate(website.sslExpiryDate)} ({website.sslDaysLeft} days left)
                        </span>
                      ) : (
                        <span>N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {website.customTags && Object.keys(website.customTags).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(website.customTags).map(tag => (
                            <Badge key={tag} variant="outline">
                              {website.customTags[tag]}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500">No tags</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => checkWebsiteMutation.mutate(website.id)}
                        title="Check Now"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (website.isActive) {
                            toggleWebsiteMutation.mutate({ id: website.id, isActive: false });
                          } else {
                            toggleWebsiteMutation.mutate({ id: website.id, isActive: true });
                          }
                        }}
                        title={website.isActive ? "Pause Monitoring" : "Resume Monitoring"}
                      >
                        {website.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/edit/${website.id}`)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteWebsiteMutation.mutate(website.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}


