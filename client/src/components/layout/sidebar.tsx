import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Globe, BarChart3, Plus, Activity, Bell, Settings } from "lucide-react";
import BharatBenzLogo from "@/assets/bharatbenz-logo.png";

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3, current: true },
  { name: 'Add Website', href: '/add', icon: Plus, current: false },
  { name: 'Analytics', href: '/analytics', icon: Activity, current: false },
  { name: 'Settings', href: '/settings', icon: Settings, current: false },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-white shadow-lg border-r border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <img src={BharatBenzLogo} alt="DICVMONITOR Logo" className="w-24 h-24 rounded-lg bg-white" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">DICVMONITOR</h1>
            <p className="text-sm text-gray-500">Status Dashboard</p>
          </div>
        </div>
      </div>
      
      <nav className="p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
