import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import MetricsOverview from "@/components/dashboard/metrics-overview";
import SitesTable from "@/components/dashboard/sites-table";
import PerformanceChart from "@/components/dashboard/performance-chart";
import ActivityFeed from "@/components/dashboard/activity-feed";
import AddSiteModal from "@/components/modals/add-site-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Search, X } from "lucide-react";
import { useQuery, useQueryClient, UseQueryOptions } from "@tanstack/react-query";
import { Website } from "@shared/schema";

export default function Dashboard() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(new Date().toLocaleTimeString());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  useEffect(() => {
    console.log("Selected Tags:", selectedTags);
  }, [selectedTags]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Trigger backend monitoring on dashboard load
  useEffect(() => {
    fetch("/api/monitoring/run", { method: "POST" });
  }, []);

  const handleRefresh = () => {
    queryClient.invalidateQueries();
    fetch("/api/monitoring/run", { method: "POST" });
    setLastUpdatedTime(new Date().toLocaleTimeString());
  };

  const queryOptions: UseQueryOptions<Website[], Error> = {
    queryKey: ["/api/websites"],
    queryFn: async () => {
      const response = await fetch("/api/websites");
      if (!response.ok) {
        throw new Error('Failed to fetch websites');
      }
      return response.json();
    },
  };

  const { data: websites } = useQuery(queryOptions);

  // Extract available tags from websites once data is fetched
  useEffect(() => {
    if (websites) {
      const allTags = new Set<string>();
      websites.forEach((website: Website) => {
        if (website.customTags) {
          if (typeof website.customTags === 'object' && website.customTags !== null) {
            Object.keys(website.customTags).forEach(tag => allTags.add(tag));
          }
        }
      });
      setAvailableTags(Array.from(allTags));
    }
  }, [websites]);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
              <p className="text-gray-600">Monitor your websites in real-time</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Last updated: <span>{lastUpdatedTime}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </Button>
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Website</span>
              </Button>
            </div>
          </div>
          
          {/* Search and Filter */}
          <div className="mt-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Search by name or URL..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex-1">
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by tags" />
                </SelectTrigger>
                <SelectContent>
                  {availableTags.map(tag => (
                    <SelectItem 
                      key={tag} 
                      value={tag}
                      onSelect={(e) => e.preventDefault()}
                    >
                      <div className="flex items-center w-full">
                        <Checkbox 
                          checked={selectedTags.includes(tag)}
                          onCheckedChange={(checkedState) => {
                            setSelectedTags(prev => 
                              checkedState 
                                ? [...prev, tag] 
                                : prev.filter(t => t !== tag)
                            );
                          }} 
                          className="mr-2"
                        />
                        {tag}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Selected Tags */}
          {selectedTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedTags.map(tag => (
                <Badge key={tag} variant="secondary" className="px-3 py-1">
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
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <MetricsOverview />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2">
              <SitesTable 
                searchQuery={searchQuery} 
                selectedTags={selectedTags} 
              />
            </div>
            <div className="space-y-6">
              <PerformanceChart />
              <ActivityFeed />
            </div>
          </div>
        </main>
      </div>

      <AddSiteModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
    </div>
  );
}


