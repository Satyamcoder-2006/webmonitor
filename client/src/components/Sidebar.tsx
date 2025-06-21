import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  ChartLine, 
  PlusCircle, 
  ChartBar, 
  Cog,
  Monitor,
  Tag,
  Bell,
  BarChart3
} from 'lucide-react';

interface SidebarProps {
  isExpanded: boolean;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

const Sidebar = ({ isExpanded, setIsExpanded }: SidebarProps) => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: ChartLine, label: 'Dashboard' },
    { path: '/websites/new', icon: PlusCircle, label: 'Add Website' },
    { path: '/analytics', icon: ChartBar, label: 'Analytics' },
    { path: '/website-analytics', icon: BarChart3, label: 'Website Analytics' },
    { path: '/alerts', icon: Bell, label: 'Alerts' },
    { path: '/tags', icon: Tag, label: 'Tags' },
    { path: '/settings', icon: Cog, label: 'Settings' },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-500 ease-out z-[9999] ${
        isExpanded ? 'w-64' : 'w-20'
      }`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center gap-3 h-16 px-4 border-b border-gray-200 dark:border-gray-800 overflow-hidden">
          <Monitor className="w-8 h-8 text-primary flex-shrink-0" />
          <span 
            className={`text-xl font-semibold text-gray-900 dark:text-white whitespace-nowrap transition-[width,opacity] duration-500 ease-out ${
              isExpanded ? 'opacity-100 w-[180px]' : 'opacity-0 w-0'
            }`}
          >
            WebMonitor
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 overflow-hidden ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6" />
                </div>
                <span 
                  className={`text-sm font-medium whitespace-nowrap transition-[width,opacity] duration-500 ease-out ${
                    isExpanded ? 'opacity-100 w-[172px]' : 'opacity-0 w-0'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar; 