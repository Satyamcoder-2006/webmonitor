import { useState, useEffect } from "react";
import MetricsOverview from "@/components/dashboard/metrics-overview";
import SitesTable from "@/components/dashboard/sites-table";
import AddSiteModal from "@/components/modals/add-site-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Search, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { WebsiteWithStatus } from "@/lib/types";
import { useNavigate } from "react-router-dom";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Tag } from "@shared/schema";

export default function Dashboard() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(new Date().toLocaleTimeString());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { lastMessage } = useWebSocket();

  // Fetch available tags directly from the API
  const { data: availableTags, isLoading: isLoadingTags } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/tags");
      if (!response.ok) {
        throw new Error("Failed to fetch tags");
      }
      return response.json();
    }
  });

  // Define queryOptions before useQuery
  const queryOptions = {
    queryKey: ["/api/websites"],
    queryFn: async () => {
      const response = await fetch("/api/websites");
      if (!response.ok) {
        throw new Error('Failed to fetch websites');
      }
      const data: WebsiteWithStatus[] = await response.json();
      return data;
    },
  };

  const { data: websitesData, isLoading } = useQuery(queryOptions);

  // Trigger backend monitoring on dashboard load
  useEffect(() => {
    fetch("/api/monitoring/run", { method: "POST" });
  }, []);

  useEffect(() => {
    if (lastMessage) {
      const data = JSON.parse(lastMessage.data);
      if (data.type === 'status_update') {
        queryClient.setQueryData<WebsiteWithStatus[]>(['/api/websites'], (oldData) => {
          if (!oldData) return oldData;
          return oldData.map(website => {
            if (website.id === data.websiteId) {
              // Ensure all WebsiteWithStatus properties are present and correctly typed
              return {
                ...website,
                lastStatus: data.status,
                updatedAt: new Date().toISOString(),
                status: data.status,
                responseTime: data.responseTime || null,
                lastCheck: data.timestamp || null,
                sslValid: data.sslValid !== undefined ? data.sslValid : website.sslValid,
                sslExpiryDate: data.sslExpiryDate || null,
                sslDaysLeft: data.sslDaysLeft !== undefined ? data.sslDaysLeft : website.sslDaysLeft,
                httpStatus: data.httpStatus !== undefined ? data.httpStatus : website.httpStatus || null,
                errorMessage: data.errorMessage || website.errorMessage || null,
              };
            }
            return website;
          });
        });
      }
    }
  }, [lastMessage, queryClient]);

  const handleRefresh = () => {
    queryClient.invalidateQueries();
    fetch("/api/monitoring/run", { method: "POST" });
    setLastUpdatedTime(new Date().toLocaleTimeString());
  };

  // Filter websites based on search query and selected tags
  const filteredWebsites = websitesData?.filter(website => {
    const matchesSearch = website.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          website.url.toLowerCase().includes(searchQuery.toLowerCase());

    const hasSelectedTags = selectedTags.length === 0 ||
                          (
                            website.customTags && 
                            typeof website.customTags === 'object' &&
                            !Array.isArray(website.customTags) &&
                            selectedTags.some(selectedTag => 
                              Object.keys(website.customTags as Record<string, unknown>).some(websiteTagKey =>
                                websiteTagKey.toLowerCase().trim() === selectedTag.toLowerCase().trim()
                              )
                            )
                          );

    return matchesSearch && hasSelectedTags;
  }) || [];

  // Debugging logs for filtering
  useEffect(() => {
    console.log('--- Dashboard Filtering Debug ---');
    console.log('Current selectedTags:', selectedTags);
    console.log('Total websites (from API):', websitesData?.length || 0);
    console.log('Filtered websites count:', filteredWebsites.length);
    if (websitesData) {
      console.log('Website customTags examples:', websitesData.map(w => ({ name: w.name, customTags: w.customTags })));
    }
    console.log('---------------------------------');
  }, [selectedTags, websitesData, filteredWebsites]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h2>
            <p className="text-gray-600 dark:text-gray-400">Monitor your websites in real-time</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: <span>{lastUpdatedTime}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="glass-button text-gray-900 dark:text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2 text-gray-900 dark:text-white" />
              <span>Refresh</span>
            </Button>
            <Button 
              onClick={() => navigate('/websites/new')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span>Add Website</span>
            </Button>
          </div>
        </div>
        
        {/* Search and Filter */}
        <div className="mt-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400" size={18} />
            <Input
              placeholder="Search by name or URL..."
              className="pl-10 glass-button text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex-1">
            <Select open={isTagDropdownOpen} onOpenChange={setIsTagDropdownOpen}>
              <SelectTrigger className="glass-button text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600">
                <SelectValue placeholder="Filter by tags">
                  {selectedTags.length > 0 ? selectedTags.join(', ') : "Filter by tags"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg">
                <div className="p-1">
                  <div 
                    className="flex items-center w-full p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedTags([]);
                      setIsTagDropdownOpen(false);
                    }}
                  >
                    <Checkbox
                      checked={selectedTags.length === 0}
                      onCheckedChange={(checked) => {
                        setSelectedTags([]);
                        setIsTagDropdownOpen(false);
                      }}
                      className="mr-2"
                    />
                    <span className="text-gray-900 dark:text-white">All Websites</span>
                  </div>
                  {isLoadingTags ? (
                    <div className="p-2 text-sm text-gray-500 dark:text-gray-400">
                      Loading tags...
                    </div>
                  ) : availableTags && availableTags.length > 0 ? (
                    availableTags.map((tag) => (
                      <div 
                        key={tag.id}
                        className="flex items-center w-full p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedTags(prev => {
                            const newTags = prev.includes(tag.name)
                              ? prev.filter(t => t !== tag.name)
                              : [...prev, tag.name];
                            return newTags;
                          });
                        }}
                      >
                        <Checkbox 
                          checked={selectedTags.includes(tag.name)}
                          onCheckedChange={(checked) => {
                            setSelectedTags(prev => {
                              const newTags = checked 
                                ? [...prev, tag.name]
                                : prev.filter(t => t !== tag.name);
                              return newTags;
                            });
                          }} 
                          className="mr-2"
                        />
                        <span className="text-gray-900 dark:text-white">{tag.name}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-gray-500 dark:text-gray-400">
                      No tags available. Create tags from the Tags page.
                    </div>
                  )}
                </div>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Selected Tags */}
        {selectedTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedTags.map(tag => (
              <Badge key={tag} variant="secondary" className="glass-button px-3 py-1">
                {tag}
                <X 
                  className="ml-2 h-3 w-3 cursor-pointer" 
                  onClick={() => setSelectedTags(prev => prev.filter(t => t !== tag))}
                />
              </Badge>
            ))}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedTags([])}
              className="text-xs"
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Metrics Overview */}
      <MetricsOverview />

      {/* Main Content - Full Width Table */}
      <div className="glass-card rounded-lg p-6">
        <SitesTable 
          searchQuery={searchQuery} 
          selectedTags={selectedTags} 
          websites={filteredWebsites}
          isLoading={isLoading}
        />
      </div>

      {filteredWebsites.length === 0 && (
        <div className="glass-card rounded-lg p-12 text-center">
          <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">No websites added yet</h2>
          <p className="text-muted-foreground mb-4">
            Start monitoring your websites by adding them to the system.
          </p>
          <Button 
            onClick={() => navigate('/websites/new')}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Website
          </Button>
        </div>
      )}

      <AddSiteModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
    </div>
  );
}


