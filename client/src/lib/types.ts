export interface WebsiteWithStatus {
  id: number;
  url: string;
  name: string;
  email: string;
  checkInterval: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  status: 'up' | 'down' | 'unknown';
  responseTime: number | null;
  lastCheck: string | null;
  httpStatus: number | null;
}

export interface ActivityItem {
  id: number;
  type: 'recovery' | 'outage' | 'check';
  message: string;
  timestamp: string;
  websiteId: number;
  websiteName: string;
}

export interface DashboardStats {
  totalSites: number;
  sitesUp: number;
  sitesDown: number;
  averageResponseTime: number;
  uptime: number;
}

export interface PerformanceData {
  hour: string;
  averageResponseTime: number;
}

export interface AlertItem {
  id: number;
  websiteId: number;
  website: {
    id: number;
    name: string;
    url: string;
  };
  alertType: string;
  message: string;
  emailSent: boolean;
  sentAt: string;
  read: boolean;
  createdAt: string;
}
