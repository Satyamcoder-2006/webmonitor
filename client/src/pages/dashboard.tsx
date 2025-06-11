import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/sidebar";
import MetricsOverview from "@/components/dashboard/metrics-overview";
import SitesTable from "@/components/dashboard/sites-table";
import PerformanceChart from "@/components/dashboard/performance-chart";
import ActivityFeed from "@/components/dashboard/activity-feed";
import AddSiteModal from "@/components/modals/add-site-modal";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(new Date().toLocaleTimeString());
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
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <MetricsOverview />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2">
              <SitesTable />
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


