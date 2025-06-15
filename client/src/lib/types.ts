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
  customTags: Record<string, string>;
  sslValid: boolean | null;
  sslExpiryDate: string | null;
  sslDaysLeft: number | null;
  errorMessage: string | null;
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
  sslHealth: number;
}

export interface PerformanceData {
  hour: string;
  averageResponseTime: number;
}
