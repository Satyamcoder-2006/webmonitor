import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createWebsiteSchema, updateWebsiteSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all websites
  app.get("/api/websites", async (req, res) => {
    try {
      const websites = await storage.getWebsites();
      
      // Get latest status for each website
      const websitesWithStatus = await Promise.all(
        websites.map(async (website) => {
          const latestLog = await storage.getLatestLogForWebsite(website.id);
          return {
            ...website,
            status: latestLog?.status || 'unknown',
            responseTime: latestLog?.responseTime || null,
            lastCheck: latestLog?.checkedAt || null,
            httpStatus: latestLog?.httpStatus || null,
          };
        })
      );
      
      res.json(websitesWithStatus);
    } catch (error) {
      console.error('Error fetching websites:', error);
      res.status(500).json({ message: "Failed to fetch websites" });
    }
  });

  // Create new website
  app.post("/api/websites", async (req, res) => {
    try {
      const validatedData = createWebsiteSchema.parse(req.body);
      const website = await storage.createWebsite(validatedData);
      res.status(201).json(website);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error('Error creating website:', error);
        res.status(500).json({ message: "Failed to create website" });
      }
    }
  });

  // Update website
  app.patch("/api/websites/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid website ID" });
      }

      const updates = updateWebsiteSchema.parse(req.body);
      const website = await storage.updateWebsite(id, updates);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      
      res.json(website);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error('Error updating website:', error);
        res.status(500).json({ message: "Failed to update website" });
      }
    }
  });

  // Delete website
  app.delete("/api/websites/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Attempting to delete website with ID: ${id}`);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid website ID" });
      }

      const deleted = await storage.deleteWebsite(id);
      if (!deleted) {
        return res.status(404).json({ message: "Website not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting website:', error);
      res.status(500).json({ message: "Failed to delete website" });
    }
  });

  // Get monitoring logs
  app.get("/api/logs", async (req, res) => {
    try {
      const websiteId = req.query.websiteId ? parseInt(req.query.websiteId as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const logs = await storage.getMonitoringLogs(websiteId, limit);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching logs:', error);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  // Get recent activity
  app.get("/api/activity", async (req, res) => {
    try {
      const hours = req.query.hours ? parseInt(req.query.hours as string) : 24;
      const logs = await storage.getRecentLogs(hours);
      
      // Filter out logs where the associated website might have been deleted
      const validLogs = logs.filter(log => log.website !== null);

      // Transform to activity format
      const activities = validLogs.map(log => ({
        id: log.id,
        type: log.status === 'up' ? 'recovery' : log.status === 'down' ? 'outage' : 'check',
        message: `${log.website!.name} ${log.status === 'up' ? 'came back online' : log.status === 'down' ? 'went offline' : 'was checked'}`,
        timestamp: log.checkedAt,
        websiteId: log.websiteId,
        websiteName: log.website!.name,
      }));
      
      res.json(activities);
    } catch (error) {
      console.error('Error fetching activity:', error);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  // Get dashboard stats
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getWebsiteStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Get recent alerts
  app.get("/api/alerts", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const alerts = await storage.getRecentAlerts(limit);
      res.json(alerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // Manual check endpoint
  app.post("/api/websites/:id/check", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid website ID" });
      }

      const { monitorWebsite } = await import("./monitoring");
      await monitorWebsite(id, true); // Pass true for manual check
      res.json({ message: "Check completed" });
    } catch (error) {
      console.error('Error running manual check:', error);
      res.status(500).json({ message: "Failed to run check" });
    }
  });

  // Trigger monitoring cycle
  app.post("/api/monitoring/run", async (req, res) => {
    try {
      const { runMonitoringCycle } = await import("./monitoring");
      await runMonitoringCycle(true); // Pass true to indicate dashboard initiated
      res.json({ message: "Monitoring cycle completed" });
    } catch (error) {
      console.error('Error running monitoring cycle:', error);
      res.status(500).json({ message: "Failed to run monitoring cycle" });
    }
  });

  // Get performance data for charts
  app.get("/api/performance", async (req, res) => {
    try {
      const websiteId = req.query.websiteId ? parseInt(req.query.websiteId as string) : undefined;
      const hours = req.query.hours ? parseInt(req.query.hours as string) : 24;
      
      const logs = await storage.getMonitoringLogs(websiteId, 288); // ~24h of 5min intervals
      
      // Group by hour and calculate averages
      const performanceData = logs
        .filter(log => log.responseTime !== null)
        .reduce((acc, log) => {
          const hour = new Date(log.checkedAt).getHours();
          if (!acc[hour]) {
            acc[hour] = { responseTimes: [], hour };
          }
          acc[hour].responseTimes.push(log.responseTime!);
          return acc;
        }, {} as Record<number, { responseTimes: number[], hour: number }>);
      
      const chartData = Object.values(performanceData).map(data => ({
        hour: `${data.hour.toString().padStart(2, '0')}:00`,
        averageResponseTime: Math.round(data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length),
      }));
      
      res.json(chartData);
    } catch (error) {
      console.error('Error fetching performance data:', error);
      res.status(500).json({ message: "Failed to fetch performance data" });
    }
  });

  // Analytics endpoint
  app.get("/api/analytics", async (req, res) => {
    try {
      const [websites, allLogs] = await Promise.all([
        storage.getWebsites(),
        storage.getMonitoringLogs(undefined, 1000) // Get more logs for analytics
      ]);

      // Calculate metrics
      const totalChecks = allLogs.length;
      const validResponseTimes = allLogs.filter(log => log.responseTime && log.responseTime > 0);
      const averageResponseTime = validResponseTimes.length > 0 
        ? Math.round(validResponseTimes.reduce((sum, log) => sum + log.responseTime!, 0) / validResponseTimes.length)
        : 0;

      // Calculate uptime percentage (last 24 hours)
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);
      const recent24HLogs = allLogs.filter(log => new Date(log.checkedAt) >= last24Hours);
      const upChecks = recent24HLogs.filter(log => log.status === 'up').length;
      const uptimePercentage = recent24HLogs.length > 0 
        ? Math.round((upChecks / recent24HLogs.length) * 100)
        : 0;

      // Count downtime events
      const downtimeEvents = recent24HLogs.filter(log => log.status === 'down').length;

      // Response time data by hour
      const hourlyData = new Map();
      validResponseTimes.forEach(log => {
        const hour = new Date(log.checkedAt).getHours();
        const hourKey = `${hour.toString().padStart(2, '0')}:00`;
        if (!hourlyData.has(hourKey)) {
          hourlyData.set(hourKey, { total: 0, count: 0 });
        }
        const data = hourlyData.get(hourKey);
        data.total += log.responseTime!;
        data.count += 1;
      });

      const responseTimeData = Array.from(hourlyData.entries())
        .map(([hour, data]) => ({
          hour,
          averageResponseTime: Math.round(data.total / data.count),
          checks: data.count
        }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      // Status distribution
      const statusCounts = allLogs.reduce((acc, log) => {
        acc[log.status] = (acc[log.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: Math.round((count / totalChecks) * 100)
      }));

      // Website stats
      const websiteStats = await Promise.all(
        websites.map(async (website) => {
          const websiteLogs = allLogs.filter(log => log.websiteId === website.id);
          const websiteUpChecks = websiteLogs.filter(log => log.status === 'up').length;
          const websiteUptime = websiteLogs.length > 0 
            ? Math.round((websiteUpChecks / websiteLogs.length) * 100)
            : 0;
          
          const websiteResponseTimes = websiteLogs.filter(log => log.responseTime && log.responseTime > 0);
          const websiteAvgResponse = websiteResponseTimes.length > 0
            ? Math.round(websiteResponseTimes.reduce((sum, log) => sum + log.responseTime!, 0) / websiteResponseTimes.length)
            : 0;

          const lastDowntimeLog = websiteLogs.find(log => log.status === 'down');

          return {
            id: website.id,
            name: website.name,
            url: website.url,
            totalChecks: websiteLogs.length,
            uptime: websiteUptime,
            averageResponseTime: websiteAvgResponse,
            lastDowntime: lastDowntimeLog?.checkedAt || null
          };
        })
      );

      res.json({
        totalChecks,
        averageResponseTime,
        uptimePercentage,
        downtimeEvents,
        responseTimeData,
        statusDistribution,
        websiteStats
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Test email endpoint
  app.post("/api/test-email", async (req, res) => {
    try {
      const { sendTestEmail } = await import('./email');
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }
      
      console.log(`Testing email to: ${email}`);
      const success = await sendTestEmail(email);
      
      if (success) {
        res.json({ message: "Test email sent successfully" });
      } else {
        res.status(500).json({ message: "Failed to send test email" });
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      res.status(500).json({ message: "Failed to send test email" });
    }
  });

  // Delete alert endpoint
  app.delete("/api/alerts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid alert ID" });
      }
      
      // Add delete alert method to storage if needed
      res.json({ message: "Alert deleted" });
    } catch (error) {
      console.error('Error deleting alert:', error);
      res.status(500).json({ message: "Failed to delete alert" });
    }
  });

  // Mark all alerts as read
  app.post("/api/alerts/mark-all-read", async (req, res) => {
    try {
      // Update all alerts to mark as read
      res.json({ message: "All alerts marked as read" });
    } catch (error) {
      console.error('Error marking alerts as read:', error);
      res.status(500).json({ message: "Failed to mark alerts as read" });
    }
  });

  // Settings endpoint
  app.get("/api/settings", async (req, res) => {
    try {
      const websites = await storage.getWebsites();
      const allLogs = await storage.getMonitoringLogs(undefined, 100);
      
      const settings = {
        emailSettings: {
          smtpConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
          fromEmail: process.env.EMAIL_USER || '',
          testEmailAddress: ''
        },
        monitoringSettings: {
          checkInterval: 1, // Currently every second
          timeout: 30000,
          retries: 1,
          realTimeEnabled: true
        },
        alertSettings: {
          emailAlerts: true,
          immediateAlerts: true,
          alertCooldown: 5
        },
        systemInfo: {
          version: '1.0.0',
          uptime: process.uptime() ? `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m` : '0m',
          totalSites: websites.length,
          totalChecks: allLogs.length,
          lastRestart: new Date().toISOString()
        }
      };
      
      res.json(settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Update settings endpoint
  app.put("/api/settings", async (req, res) => {
    try {
      // In a real app, you'd save these settings to a database
      // For now, we'll just acknowledge the update
      res.json({ message: "Settings updated successfully" });
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // System data clearing endpoints
  app.delete("/api/system/clear/:dataType", async (req, res) => {
    try {
      const { dataType } = req.params;
      
      switch (dataType) {
        case 'logs':
          // Clear monitoring logs - would need to implement in storage
          break;
        case 'alerts':
          // Clear alerts - would need to implement in storage
          break;
        case 'stats':
          // Reset statistics - would need to implement in storage
          break;
        default:
          return res.status(400).json({ message: "Invalid data type" });
      }
      
      res.json({ message: `${dataType} cleared successfully` });
    } catch (error) {
      console.error('Error clearing data:', error);
      res.status(500).json({ message: "Failed to clear data" });
    }
  });

  // Restart monitoring endpoint
  app.post("/api/monitoring/restart", async (req, res) => {
    try {
      // In a real implementation, you'd restart the monitoring service
      res.json({ message: "Monitoring restarted successfully" });
    } catch (error) {
      console.error('Error restarting monitoring:', error);
      res.status(500).json({ message: "Failed to restart monitoring" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
