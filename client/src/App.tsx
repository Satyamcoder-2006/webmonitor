import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/dashboard";
import AddWebsite from "@/pages/add-website";
import EditWebsite from "@/pages/edit-website";
import Analytics from "@/pages/analytics";
import WebsiteAnalytics from "@/pages/website-analytics";
import Settings from "@/pages/settings";
import TagsPage from "@/pages/tags";
import Alerts from "@/pages/alerts";
import NotFound from "@/pages/not-found";

function App() {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 group ${isSidebarExpanded ? 'sidebar-expanded' : ''} relative z-0`}>
            <Sidebar isExpanded={isSidebarExpanded} setIsExpanded={setIsSidebarExpanded} />
            <main className="relative z-10 pl-20 transition-all duration-500 ease-out group-[.sidebar-expanded]:pl-72">
              <div className="container mx-auto px-4 py-8">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/websites/new" element={<AddWebsite />} />
                  <Route path="/edit/:id" element={<EditWebsite />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/website-analytics" element={<WebsiteAnalytics />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="/tags" element={<TagsPage />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </main>
            <Toaster />
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;



