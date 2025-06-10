import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import MetricsOverview from "@/components/dashboard/metrics-overview";
import SitesTable from "@/components/dashboard/sites-table";
import PerformanceChart from "@/components/dashboard/performance-chart";
import ActivityFeed from "@/components/dashboard/activity-feed";
import AddSiteModal from "@/components/modals/add-site-modal";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AlertItem } from "@/lib/types";

export default function Dashboard() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: alerts = [] } = useQuery<AlertItem[]>({
    queryKey: ["/api/alerts"],
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  const recentDownAlerts = alerts.filter(alert => 
    alert.alertType === 'down' && 
    new Date(alert.sentAt) > new Date(Date.now() - 60 * 60 * 1000) // Last hour
  );

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
                Last updated: <span>2 minutes ago</span>
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

          {/* Alerts Section */}
          {recentDownAlerts.length > 0 && (
            <div className="mb-8">
              {recentDownAlerts.map((alert) => (
                <div key={alert.id} className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
                    <div className="flex-1">
                      <h4 className="font-medium text-red-800">Site Down Alert</h4>
                      <p className="text-sm text-red-700">{alert.message}</p>
                      <p className="text-xs text-red-600 mt-1">
                        {new Date(alert.sentAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

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
