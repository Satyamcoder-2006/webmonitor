import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWebsiteSchema, selectWebsiteSchema, updateWebsiteSchema, insertTagSchema, selectTagSchema, Website, NewWebsite } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { WebSocketServer } from 'ws';
import { setBroadcastFunction } from "./monitoring";
import WebSocket from 'ws';
import { and, eq, gte, desc, sql } from "drizzle-orm";
import { monitoringBuffer } from "./monitoring";

let wss: WebSocketServer;

export async function registerRoutes(app: Express): Promise<Server> {
  const server = createServer(app);
  
  // Set up WebSocket server
  const wsPort = process.env.WS_PORT || 5001;
  wss = new WebSocketServer({ 
    port: Number(wsPort),
    perMessageDeflate: false
  });
  
  console.log(`WebSocket server running on port ${wsPort}`);
  
  // WebSocket connection handler
  wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
  });
  
  // Broadcast function to send updates to all connected clients
  const broadcastUpdate = (data: any) => {
    if (wss) {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    }
  };
  
  // Set the broadcast function in the monitoring module
  setBroadcastFunction(broadcastUpdate);

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

  // Get a single website by ID
  app.get("/api/websites/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid website ID" });
      }

      const website = await storage.getWebsite(id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      res.json(website);
    } catch (error) {
      console.error('Error fetching website by ID:', error);
      res.status(500).json({ message: "Failed to fetch website" });
    }
  });

  // Create new website
  app.post("/api/websites", async (req, res) => {
    try {
      const validatedData = insertWebsiteSchema.parse(req.body);

      const dataForStorage: NewWebsite = { ...validatedData };

      if (Array.isArray(validatedData.customTags)) {
        dataForStorage.customTags = validatedData.customTags.reduce((acc, tagName) => ({ ...acc, [tagName]: tagName }), {});
      } else {
        dataForStorage.customTags = {}; // Ensure it's an empty object if no tags or not an array
      }

      const website = await storage.createWebsite(dataForStorage);
      
      // Schedule monitoring for the new website
      const { updateWebsiteMonitoring } = await import("./monitoring");
      updateWebsiteMonitoring(website);
      
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

      const dataForStorage: Partial<Website> = { ...updates };

      if (Array.isArray(updates.customTags)) {
        dataForStorage.customTags = updates.customTags.reduce((acc, tagName) => ({ ...acc, [tagName]: tagName }), {});
      }

      const website = await storage.updateWebsite(id, dataForStorage);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      
      // Update monitoring schedule if check_interval changed
      if (updates.checkInterval !== undefined) {
        const { updateWebsiteMonitoring } = await import("./monitoring");
        updateWebsiteMonitoring(website);
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

      // Stop monitoring for this website
      const { stopWebsiteMonitoring } = await import("./monitoring");
      stopWebsiteMonitoring(id);
      
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

  // Get hourly statistics
  app.get("/api/stats/hourly", async (req, res) => {
    try {
      const websiteId = req.query.websiteId ? parseInt(req.query.websiteId as string) : undefined;
      const hours = req.query.hours ? parseInt(req.query.hours as string) : 24;
      
      if (!websiteId) {
        return res.status(400).json({ message: "Website ID is required" });
      }
      
      const stats = await storage.getHourlyStats(websiteId, hours);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching hourly stats:', error);
      res.status(500).json({ message: "Failed to fetch hourly stats" });
    }
  });

  // Get daily statistics
  app.get("/api/stats/daily", async (req, res) => {
    try {
      const websiteId = req.query.websiteId ? parseInt(req.query.websiteId as string) : undefined;
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      
      if (!websiteId) {
        return res.status(400).json({ message: "Website ID is required" });
      }
      
      const stats = await storage.getDailyStats(websiteId, days);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching daily stats:', error);
      res.status(500).json({ message: "Failed to fetch daily stats" });
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
      // Get all websites
      const websites = await storage.getWebsites();

      // Get latest DB log for each website
      const dbLatestLogs = await Promise.all(
        websites.map(async (website) => ({
          websiteId: website.id,
          log: await storage.getLatestLogForWebsite(website.id)
        }))
      );

      // Build a map of latest DB logs
      const latestStatus: Record<number, any> = {};
      dbLatestLogs.forEach(({ websiteId, log }) => {
        if (log) latestStatus[websiteId] = log;
      });

      // Update with buffer logs if newer
      for (const log of monitoringBuffer) {
        const dbLog = latestStatus[log.websiteId];
        const dbCheckedAt = dbLog && dbLog.checkedAt ? new Date(dbLog.checkedAt) : undefined;
        const bufferCheckedAt = log.checkedAt ? new Date(log.checkedAt) : undefined;
        if (
          !dbLog ||
          (bufferCheckedAt && (!dbCheckedAt || bufferCheckedAt > dbCheckedAt))
        ) {
          latestStatus[log.websiteId] = log;
        }
      }

      // Calculate stats
      let sitesUp = 0, sitesDown = 0, totalSites = websites.length, totalResponseTime = 0, upCount = 0;
      for (const website of websites) {
        const log = latestStatus[website.id];
        if (log) {
          if (log.status === "up") sitesUp++;
          if (log.status === "down") sitesDown++;
          if (log.status === "up" && log.responseTime) {
            totalResponseTime += log.responseTime;
            upCount++;
          }
        }
      }
      const averageResponseTime = upCount > 0 ? Math.round(totalResponseTime / upCount) : 0;
      const uptime = totalSites > 0 ? Math.round((sitesUp / totalSites) * 100) : 0;

      res.json({
        totalSites,
        sitesUp,
        sitesDown,
        averageResponseTime,
        uptime
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ message: "Failed to fetch stats" });
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
      const result = await monitorWebsite(id);
      
      // Broadcast the update to all connected clients
      if (result) {
        broadcastUpdate({
          type: 'status_update',
          websiteId: id,
          status: result.status,
          responseTime: result.responseTime,
          timestamp: new Date().toISOString()
        });
      }
      
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
      await runMonitoringCycle();
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
      const timeRange = req.query.timeRange as string || "24h"; // Default to 24 hours
      let startDate: Date | undefined;

      switch (timeRange) {
        case "24h":
          startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = undefined; // No filter
      }

      const [websites, filteredLogs] = await Promise.all([
        storage.getWebsites(),
        storage.getMonitoringLogs(undefined, 10000, startDate) // Get logs filtered by timeRange
      ]);

      // Calculate metrics from filteredLogs
      const totalChecks = filteredLogs.length;
      const validResponseTimes = filteredLogs.filter(log => log.responseTime && log.responseTime > 0);
      const averageResponseTime = validResponseTimes.length > 0 
        ? Math.round(validResponseTimes.reduce((sum, log) => sum + log.responseTime!, 0) / validResponseTimes.length)
        : 0;

      // Calculate uptime percentage and downtime events from filteredLogs
      const upChecks = filteredLogs.filter(log => log.status === 'up').length;
      const downtimeEvents = filteredLogs.filter(log => log.status === 'down').length;
      const uptimePercentage = filteredLogs.length > 0 
        ? Math.round((upChecks / filteredLogs.length) * 100)
        : 0;

      // Response time data by hour (or day for longer ranges)
      const groupedData = new Map();
      const formatKey = (date: Date) => {
        if (timeRange === "24h") {
          return `${date.getHours().toString().padStart(2, '0')}:00`;
        } else {
          return date.toLocaleDateString(); // Group by day for longer ranges
        }
      };

      validResponseTimes.forEach(log => {
        const key = formatKey(new Date(log.checkedAt));
        if (!groupedData.has(key)) {
          groupedData.set(key, { total: 0, count: 0 });
        }
        const data = groupedData.get(key);
        data.total += log.responseTime!;
        data.count += 1;
      });

      const responseTimeData = Array.from(groupedData.entries())
        .map(([key, data]) => ({
          hour: key,
          averageResponseTime: Math.round(data.total / data.count),
          checks: data.count
        }))
        .sort((a, b) => a.hour.localeCompare(b.hour)); // Sort by time/date

      // Status distribution
      const statusCounts = filteredLogs.reduce((acc, log) => {
        acc[log.status] = (acc[log.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: totalChecks > 0 ? Math.round((count / totalChecks) * 100) : 0
      }));

      // Website stats
      const websiteStats = await Promise.all(
        websites.map(async (website) => {
          const websiteLogs = filteredLogs.filter(log => log.websiteId === website.id);
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
          checkInterval: websites[0]?.checkInterval || 1, // Use the first website's interval or default to 1
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
      const dataType = req.params.dataType;
      if (!["logs", "websites"].includes(dataType)) {
        return res.status(400).json({ message: "Invalid data type" });
      }

      if (dataType === "logs") {
        await storage.clearMonitoringLogs();
      } else if (dataType === "websites") {
        await storage.clearAllWebsitesAndData();
      }

      res.status(200).json({ message: `${dataType} cleared successfully.` });
    } catch (error) {
      console.error(`Error clearing ${req.params.dataType} data:`, error);
      res.status(500).json({ message: `Failed to clear ${req.params.dataType} data` });
    }
  });

  // Restart monitoring endpoint
  app.post("/api/monitoring/restart", async (req, res) => {
    try {
      // Restart the monitoring service
      const { startMonitoring } = await import("./monitoring");
      await startMonitoring();
      res.json({ message: "Monitoring restarted successfully" });
    } catch (error) {
      console.error('Error restarting monitoring:', error);
      res.status(500).json({ message: "Failed to restart monitoring" });
    }
  });

  // Get all tags
  app.get("/api/tags", async (req, res) => {
    try {
      const tags = await storage.getTags();
      res.json(tags);
    } catch (error) {
      console.error('Error fetching tags:', error);
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  // Get a single tag by ID
  app.get("/api/tags/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid tag ID" });
      }

      const tag = await storage.getTag(id);
      if (!tag) {
        return res.status(404).json({ message: "Tag not found" });
      }
      res.json(tag);
    } catch (error) {
      console.error('Error fetching tag by ID:', error);
      res.status(500).json({ message: "Failed to fetch tag" });
    }
  });

  // Create new tag
  app.post("/api/tags", async (req, res) => {
    try {
      const validatedData = insertTagSchema.parse(req.body);
      const tag = await storage.createTag(validatedData);
      res.status(201).json(tag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error('Error creating tag:', error);
        res.status(500).json({ message: "Failed to create tag" });
      }
    }
  });

  // Update tag
  app.patch("/api/tags/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid tag ID" });
      }

      const updates = selectTagSchema.partial().parse(req.body);
      const tag = await storage.updateTag(id, updates);
      
      if (!tag) {
        return res.status(404).json({ message: "Tag not found" });
      }
      
      res.json(tag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        console.error('Error updating tag:', error);
        res.status(500).json({ message: "Failed to update tag" });
      }
    }
  });

  // Delete tag
  app.delete("/api/tags/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid tag ID" });
      }

      const deleted = await storage.deleteTag(id);
      if (!deleted) {
        return res.status(404).json({ message: "Tag not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting tag:', error);
      res.status(500).json({ message: "Failed to delete tag" });
    }
  });

  app.get("/api/monitoring/buffer", (req, res) => {
    res.json(monitoringBuffer);
  });

  // Compression status endpoint
  app.get("/api/compression-status", async (req, res) => {
    try {
      const { verifyCompressionPolicies } = await import("./monitoring");
      const result = await verifyCompressionPolicies();
      res.json(result);
    } catch (error) {
      console.error("Error fetching compression status:", error);
      res.status(500).json({ message: "Failed to fetch compression status" });
    }
  });

  return server;
}
