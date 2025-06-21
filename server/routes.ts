import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWebsiteSchema, selectWebsiteSchema, updateWebsiteSchema, insertTagSchema, selectTagSchema, Website, NewWebsite, compressionRetentionSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { WebSocketServer } from 'ws';
import { setBroadcastFunction } from "./monitoring";
import WebSocket from 'ws';
import { and, eq, gte, desc, sql } from "drizzle-orm";
import { monitoringBuffer } from "./monitoring";
import { db } from "./db";

let wss: WebSocketServer;

// Helper to convert interval to minutes
function intervalToMinutes(value: number, unit: string): number {
  switch (unit) {
    case 'minutes': return value;
    case 'hours': return value * 60;
    case 'days': return value * 1440;
    default: return value;
  }
}

// Helper to convert interval to a valid SQL interval string
function toSqlInterval(value: number, unit: string): string {
  return `${value} ${unit}`;
}

// Helper to update global compression and retention policies and schedule
async function updateGlobalPolicies(
  compressionValue: number,
  compressionUnit: string,
  retentionValue: number,
  retentionUnit: string,
  retentionScheduleValue: number,
  retentionScheduleUnit: string
) {
  const compressionInterval = toSqlInterval(compressionValue, compressionUnit);
  const retentionPeriod = toSqlInterval(retentionValue, retentionUnit);
  const retentionSchedule = toSqlInterval(retentionScheduleValue, retentionScheduleUnit);
  // Update compression and retention policies (inline intervals)
  await db.execute(`
    ALTER TABLE monitoring_logs SET (timescaledb.compress = true);
    SELECT remove_compression_policy('monitoring_logs');
    SELECT add_compression_policy('monitoring_logs', INTERVAL '${compressionInterval}');
    SELECT remove_retention_policy('monitoring_logs');
    SELECT add_retention_policy('monitoring_logs', INTERVAL '${retentionPeriod}');
  `);
  // Update the retention job schedule
  const jobs = await db.execute(sql`
    SELECT job_id FROM timescaledb_information.jobs WHERE proc_name = 'policy_retention' AND hypertable_name = 'monitoring_logs';
  `);
  if (jobs.length > 0) {
    const jobId = jobs[0].job_id;
    await db.execute(`
      SELECT alter_job(${jobId}, schedule_interval => INTERVAL '${retentionSchedule}');
    `);
  }
}

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
      const website = await storage.createWebsite(validatedData);
      
      // Create alert for website addition
      try {
        const { alerts } = await import("@shared/schema");
        await db.insert(alerts).values({
          websiteId: website.id,
          alertType: 'website_added',
          message: `Website "${website.name}" (${website.url}) has been added to monitoring`,
          sentAt: new Date(),
          emailSent: false,
          read: false
        });
        
        // Send email alert for website addition
        const { sendAlert } = await import('./email');
        await sendAlert(website.email, {
          websiteName: website.name,
          websiteUrl: website.url,
          status: 'added',
          message: `Website "${website.name}" has been successfully added to WebMonitor and will be monitored every ${website.checkInterval} minutes.`,
          timestamp: new Date(),
          responseTime: undefined,
          errorMessage: undefined
        });
        
        console.log(`[Alert] Website addition alert sent for ${website.name}`);
      } catch (alertError) {
        console.error(`[Alert] Failed to send website addition alert for ${website.name}:`, alertError);
      }
      
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

      // Always convert customTags from array to record, or undefined
      let reqBody = { ...req.body };
      if (Array.isArray(reqBody.customTags)) {
        reqBody.customTags = reqBody.customTags.reduce((acc: Record<string, string>, tagName: string) => ({ ...acc, [tagName]: tagName }), {});
      } else {
        reqBody.customTags = undefined;
      }

      const baseUpdates = updateWebsiteSchema.parse(reqBody);
      const dataForStorage: Partial<Website> = { ...baseUpdates };

      // Ensure compressionInterval and retentionPeriod are set
      if (dataForStorage.compressionInterval) {
        dataForStorage.compressionInterval = dataForStorage.compressionInterval;
      }
      if (dataForStorage.retentionPeriod) {
        dataForStorage.retentionPeriod = dataForStorage.retentionPeriod;
      }

      const website = await storage.updateWebsite(id, dataForStorage);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      
      // Update monitoring schedule if check_interval changed
      if (dataForStorage.checkInterval !== undefined) {
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

      // Stop monitoring before deleting
      const { stopWebsiteMonitoring } = await import("./monitoring");
      stopWebsiteMonitoring(id);
      
      const website = await storage.getWebsite(id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      
      await storage.deleteWebsite(id);

      // Create alert for website deletion
      try {
        const { alerts } = await import("@shared/schema");
        await db.insert(alerts).values({
          websiteId: id,
          alertType: 'website_removed',
          message: `Website "${website.name}" (${website.url}) has been removed from monitoring.`,
          sentAt: new Date(),
          emailSent: false,
          read: false
        });
      } catch (alertError) {
        console.error(`[Alert] Failed to create website deletion alert for ${website.name}:`, alertError);
      }
      
      console.log(`Website with ID: ${id} deleted successfully`);
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting website with ID: ${req.params.id}`, error);
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
        storage.getMonitoringLogs(undefined, 10000, startDate),
      ]);

      // --- Uptime & Downtime ---
      const totalChecks = filteredLogs.length;
      const upChecks = filteredLogs.filter(log => log.status === 'up').length;
      const downtimeEvents = filteredLogs.filter(log => log.status === 'down').length;
      const uptimePercentage = totalChecks > 0 ? Math.round((upChecks / totalChecks) * 100) : 0;
      const totalDowntime = filteredLogs.filter(log => log.status === 'down').length * 5; // 5 min interval assumed

      // --- Performance ---
      const validResponseTimes = filteredLogs.filter(log => log.responseTime && log.responseTime > 0).map(log => log.responseTime!);
      const averageResponseTime = validResponseTimes.length > 0 ? Math.round(validResponseTimes.reduce((sum, v) => sum + v, 0) / validResponseTimes.length) : 0;
      const sortedResponseTimes = [...validResponseTimes].sort((a, b) => a - b);
      const percentile = (arr: number[], p: number) => arr.length ? arr[Math.floor((p / 100) * arr.length)] : 0;
      const p95ResponseTime = percentile(sortedResponseTimes, 95);
      const p99ResponseTime = percentile(sortedResponseTimes, 99);
      const slowestResponseTime = sortedResponseTimes[sortedResponseTimes.length - 1] || 0;
      const fastestResponseTime = sortedResponseTimes[0] || 0;

      // --- Status Codes ---
      const statusCodeCounts = filteredLogs.reduce((acc, log) => {
        if (log.httpStatus) acc[log.httpStatus] = (acc[log.httpStatus] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      const mostFrequentErrorCodes = Object.entries(statusCodeCounts)
        .filter(([code]) => Number(code) >= 400)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([code, count]) => ({ code: Number(code), count }));

      // --- Alerts ---
      let alerts: any[] = [];
      let numberOfAlerts = 0;
      // If you implement storage.getAlerts in the future, you can fetch real alert data here.
      // For now, alerts and numberOfAlerts are always empty/zero.
      // Average time to recovery: time between a down and next up
      let recoveryTimes: number[] = [];
      let lastDownTime: Date | null = null;
      for (const log of filteredLogs) {
        if (log.status === 'down') {
          lastDownTime = new Date(log.checkedAt);
        } else if (log.status === 'up' && lastDownTime) {
          const upTime = new Date(log.checkedAt);
          recoveryTimes.push((upTime.getTime() - lastDownTime.getTime()) / 60000); // in minutes
          lastDownTime = null;
        }
      }
      const averageTimeToRecovery = recoveryTimes.length > 0 ? Math.round(recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length) : 0;

      // --- Checks ---
      // Missed checks: if there is a gap > expected interval (5 min) between logs for a website
      let missedChecks = 0;
      const logsByWebsite = websites.reduce((acc, w) => {
        acc[w.id] = filteredLogs.filter(l => l.websiteId === w.id).sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime());
        return acc;
      }, {} as Record<number, typeof filteredLogs>);
      for (const logs of Object.values(logsByWebsite)) {
        for (let i = 1; i < logs.length; i++) {
          const prev = new Date(logs[i - 1].checkedAt).getTime();
          const curr = new Date(logs[i].checkedAt).getTime();
          if (curr - prev > 6 * 60 * 1000) missedChecks++; // >6min gap
        }
      }

      // --- SSL ---
      const now = new Date();
      const sslExpiries = websites.map(w => ({
        id: w.id,
        name: w.name,
        url: w.url,
        sslExpiryDate: w.sslExpiryDate,
        sslDaysLeft: w.sslDaysLeft,
      })).filter(w => w.sslExpiryDate);
      const expiringSSLs = sslExpiries.filter(w => w.sslDaysLeft !== null && w.sslDaysLeft !== undefined && w.sslDaysLeft <= 30 && w.sslDaysLeft > 0);
      const expiredSSLs = sslExpiries.filter(w => w.sslDaysLeft !== null && w.sslDaysLeft <= 0);

      // --- Tags ---
      const tagStats: Record<string, { uptime: number; avgResponseTime: number; count: number }> = {};
      for (const website of websites) {
        const tags = website.customTags ? Object.keys(website.customTags) : [];
        const websiteLogs = filteredLogs.filter(l => l.websiteId === website.id);
        const upChecks = websiteLogs.filter(l => l.status === 'up').length;
        const avgResp = websiteLogs.filter(l => l.responseTime && l.responseTime > 0).map(l => l.responseTime!);
        for (const tag of tags) {
          if (!tagStats[tag]) tagStats[tag] = { uptime: 0, avgResponseTime: 0, count: 0 };
          tagStats[tag].uptime += websiteLogs.length > 0 ? (upChecks / websiteLogs.length) * 100 : 0;
          tagStats[tag].avgResponseTime += avgResp.length > 0 ? avgResp.reduce((a, b) => a + b, 0) / avgResp.length : 0;
          tagStats[tag].count++;
        }
      }
      const tagAnalytics = Object.entries(tagStats).map(([tag, stats]) => ({
        tag,
        avgUptime: stats.count > 0 ? Math.round(stats.uptime / stats.count) : 0,
        avgResponseTime: stats.count > 0 ? Math.round(stats.avgResponseTime / stats.count) : 0,
      }));

      // --- Response time data by hour (or day for longer ranges) ---
      const groupedData = new Map();
      const formatKey = (date: Date) => {
        if (timeRange === "24h") {
          return `${date.getHours().toString().padStart(2, '0')}:00`;
        } else {
          return date.toLocaleDateString(); // Group by day for longer ranges
        }
      };
      validResponseTimes.forEach((rt, i) => {
        const log = filteredLogs.filter(l => l.responseTime && l.responseTime > 0)[i];
        const key = formatKey(new Date(log.checkedAt));
        if (!groupedData.has(key)) {
          groupedData.set(key, { total: 0, count: 0 });
        }
        const data = groupedData.get(key);
        data.total += rt;
        data.count += 1;
      });
      const responseTimeData = Array.from(groupedData.entries())
        .map(([key, data]) => ({
          hour: key,
          averageResponseTime: Math.round(data.total / data.count),
          checks: data.count
        }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      // --- Status distribution ---
      const statusCounts = filteredLogs.reduce((acc, log) => {
        acc[log.status] = (acc[log.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: totalChecks > 0 ? Math.round((count / totalChecks) * 100) : 0
      }));

      // --- Website stats ---
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
        p95ResponseTime,
        p99ResponseTime,
        slowestResponseTime,
        fastestResponseTime,
        uptimePercentage,
        downtimeEvents,
        totalDowntime,
        statusCodeCounts,
        mostFrequentErrorCodes,
        numberOfAlerts,
        averageTimeToRecovery,
        missedChecks,
        expiringSSLs,
        expiredSSLs,
        tagAnalytics,
        responseTimeData,
        statusDistribution,
        websiteStats
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Individual website analytics endpoint
  app.get("/api/analytics/website/:websiteId", async (req, res) => {
    try {
      const websiteId = parseInt(req.params.websiteId);
      const timeRange = req.query.timeRange as string || "24h";
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
          startDate = undefined;
      }

      const [website, filteredLogs] = await Promise.all([
        storage.getWebsite(websiteId),
        storage.getMonitoringLogs(websiteId, 10000, startDate),
      ]);

      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      // --- Uptime & Downtime ---
      const totalChecks = filteredLogs.length;
      const upChecks = filteredLogs.filter(log => log.status === 'up').length;
      const downtimeEvents = filteredLogs.filter(log => log.status === 'down').length;
      const uptimePercentage = totalChecks > 0 ? Math.round((upChecks / totalChecks) * 100) : 0;
      const totalDowntime = filteredLogs.filter(log => log.status === 'down').length * 5; // 5 min interval assumed

      // --- Performance ---
      const validResponseTimes = filteredLogs.filter(log => log.responseTime && log.responseTime > 0).map(log => log.responseTime!);
      const averageResponseTime = validResponseTimes.length > 0 ? Math.round(validResponseTimes.reduce((sum, v) => sum + v, 0) / validResponseTimes.length) : 0;
      const sortedResponseTimes = [...validResponseTimes].sort((a, b) => a - b);
      const percentile = (arr: number[], p: number) => arr.length ? arr[Math.floor((p / 100) * arr.length)] : 0;
      const p95ResponseTime = percentile(sortedResponseTimes, 95);
      const p99ResponseTime = percentile(sortedResponseTimes, 99);
      const slowestResponseTime = sortedResponseTimes[sortedResponseTimes.length - 1] || 0;
      const fastestResponseTime = sortedResponseTimes[0] || 0;

      // --- Status Codes ---
      const statusCodeCounts = filteredLogs.reduce((acc, log) => {
        if (log.httpStatus) acc[log.httpStatus] = (acc[log.httpStatus] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      const mostFrequentErrorCodes = Object.entries(statusCodeCounts)
        .filter(([code]) => Number(code) >= 400)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([code, count]) => ({ code: Number(code), count }));

      // --- Alerts for this website ---
      const alerts = await storage.getAlerts(websiteId, 50);
      const numberOfAlerts = alerts.length;

      // --- Recovery times ---
      let recoveryTimes: number[] = [];
      let lastDownTime: Date | null = null;
      for (const log of filteredLogs) {
        if (log.status === 'down') {
          lastDownTime = new Date(log.checkedAt);
        } else if (log.status === 'up' && lastDownTime) {
          const upTime = new Date(log.checkedAt);
          recoveryTimes.push((upTime.getTime() - lastDownTime.getTime()) / 60000); // in minutes
          lastDownTime = null;
        }
      }
      const averageTimeToRecovery = recoveryTimes.length > 0 ? Math.round(recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length) : 0;

      // --- Missed checks ---
      let missedChecks = 0;
      const sortedLogs = filteredLogs.sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime());
      for (let i = 1; i < sortedLogs.length; i++) {
        const prev = new Date(sortedLogs[i - 1].checkedAt).getTime();
        const curr = new Date(sortedLogs[i].checkedAt).getTime();
        if (curr - prev > 6 * 60 * 1000) missedChecks++; // >6min gap
      }

      // --- SSL info for this website ---
      const sslInfo = website.url.startsWith('https://') ? {
        sslValid: website.sslValid,
        sslExpiryDate: website.sslExpiryDate,
        sslDaysLeft: website.sslDaysLeft,
        isExpiring: website.sslDaysLeft !== null && website.sslDaysLeft <= 30 && website.sslDaysLeft > 0,
        isExpired: website.sslDaysLeft !== null && website.sslDaysLeft <= 0
      } : null;

      // --- Response time data by hour (or day for longer ranges) ---
      const groupedData = new Map();
      const formatKey = (date: Date) => {
        if (timeRange === "24h") {
          return `${date.getHours().toString().padStart(2, '0')}:00`;
        } else {
          return date.toLocaleDateString(); // Group by day for longer ranges
        }
      };
      validResponseTimes.forEach((rt, i) => {
        const log = filteredLogs.filter(l => l.responseTime && l.responseTime > 0)[i];
        const key = formatKey(new Date(log.checkedAt));
        if (!groupedData.has(key)) {
          groupedData.set(key, { total: 0, count: 0 });
        }
        const data = groupedData.get(key);
        data.total += rt;
        data.count += 1;
      });
      const responseTimeData = Array.from(groupedData.entries())
        .map(([key, data]) => ({
          hour: key,
          averageResponseTime: Math.round(data.total / data.count),
          checks: data.count
        }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      // --- Status distribution ---
      const statusCounts = filteredLogs.reduce((acc, log) => {
        acc[log.status] = (acc[log.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: totalChecks > 0 ? Math.round((count / totalChecks) * 100) : 0
      }));

      // --- Recent activity ---
      const recentActivity = filteredLogs
        .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())
        .slice(0, 20)
        .map(log => ({
          timestamp: log.checkedAt,
          status: log.status,
          responseTime: log.responseTime,
          httpStatus: log.httpStatus,
          errorMessage: log.errorMessage
        }));

      res.json({
        website: {
          id: website.id,
          name: website.name,
          url: website.url,
          checkInterval: website.checkInterval,
          isActive: website.isActive,
          customTags: website.customTags
        },
        totalChecks,
        averageResponseTime,
        p95ResponseTime,
        p99ResponseTime,
        slowestResponseTime,
        fastestResponseTime,
        uptimePercentage,
        downtimeEvents,
        totalDowntime,
        statusCodeCounts,
        mostFrequentErrorCodes,
        numberOfAlerts,
        averageTimeToRecovery,
        missedChecks,
        sslInfo,
        responseTimeData,
        statusDistribution,
        recentActivity
      });
    } catch (error) {
      console.error('Error fetching website analytics:', error);
      res.status(500).json({ message: "Failed to fetch website analytics" });
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

  // Get alerts endpoint
  app.get("/api/alerts", async (req, res) => {
    try {
      const websiteId = req.query.websiteId ? parseInt(req.query.websiteId as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const alerts = await storage.getAlerts(websiteId, limit);
      res.json(alerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // Get unread alerts endpoint
  app.get("/api/alerts/unread", async (req, res) => {
    try {
      const alerts = await storage.getUnreadAlerts();
      res.json(alerts);
    } catch (error) {
      console.error('Error fetching unread alerts:', error);
      res.status(500).json({ message: "Failed to fetch unread alerts" });
    }
  });

  // Mark alert as read endpoint
  app.put("/api/alerts/:id/read", async (req, res) => {
    try {
      const alertId = parseInt(req.params.id);
      const alert = await storage.markAlertAsRead(alertId);
      
      if (alert) {
        res.json(alert);
      } else {
        res.status(404).json({ message: "Alert not found" });
      }
    } catch (error) {
      console.error('Error marking alert as read:', error);
      res.status(500).json({ message: "Failed to mark alert as read" });
    }
  });

  // Mark all alerts as read endpoint
  app.put("/api/alerts/read-all", async (req, res) => {
    try {
      await storage.markAllAlertsAsRead();
      res.json({ message: "All alerts marked as read" });
    } catch (error) {
      console.error('Error marking all alerts as read:', error);
      res.status(500).json({ message: "Failed to mark all alerts as read" });
    }
  });

  // Delete alert endpoint
  app.delete("/api/alerts/:id", async (req, res) => {
    try {
      const alertId = parseInt(req.params.id);
      const success = await storage.deleteAlert(alertId);
      
      if (success) {
        res.json({ message: "Alert deleted successfully" });
      } else {
        res.status(404).json({ message: "Alert not found" });
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
      res.status(500).json({ message: "Failed to delete alert" });
    }
  });

  // Settings endpoint
  app.get("/api/settings", async (req, res) => {
    try {
      const websites = await storage.getWebsites();
      const first = websites[0];
      const allLogs = await storage.getMonitoringLogs(undefined, 100);
      const settings = {
        emailSettings: {
          smtpConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
          fromEmail: process.env.EMAIL_USER || '',
          testEmailAddress: ''
        },
        monitoringSettings: {
          checkInterval: first?.checkInterval || 1, // Use the first website's interval or default to 1
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
        },
        compressionValue: first?.compressionValue ?? 10,
        compressionUnit: first?.compressionUnit ?? "minutes",
        retentionValue: first?.retentionValue ?? 90,
        retentionUnit: first?.retentionUnit ?? "days",
        retentionScheduleValue: first?.retentionScheduleValue ?? 1,
        retentionScheduleUnit: first?.retentionScheduleUnit ?? "days",
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
      // Backend validation for compression/retention intervals and schedule
      const bufferFlushMinutes = 5;
      const compressionMinutes = intervalToMinutes(req.body.compressionValue, req.body.compressionUnit);
      const retentionMinutes = intervalToMinutes(req.body.retentionValue, req.body.retentionUnit);
      const retentionScheduleMinutes = intervalToMinutes(req.body.retentionScheduleValue, req.body.retentionScheduleUnit);
      if (compressionMinutes < bufferFlushMinutes) {
        return res.status(400).json({ message: "Compression interval cannot be less than 5 minutes (the buffer flush interval)." });
      }
      if (compressionMinutes > retentionMinutes) {
        return res.status(400).json({ message: "Compression interval cannot be greater than the retention period." });
      }
      if (retentionScheduleMinutes < 1) {
        return res.status(400).json({ message: "Retention schedule cannot be less than 1 minute." });
      }
      if (retentionScheduleMinutes > retentionMinutes) {
        return res.status(400).json({ message: "Retention schedule cannot be greater than the retention period." });
      }
      const websites = await storage.getWebsites();
      if (websites.length === 0) {
        return res.status(404).json({ message: "No websites found" });
      }
      for (const website of websites) {
        await storage.updateWebsite(website.id, {
          compressionValue: req.body.compressionValue,
          compressionUnit: req.body.compressionUnit,
          retentionValue: req.body.retentionValue,
          retentionUnit: req.body.retentionUnit,
          retentionScheduleValue: req.body.retentionScheduleValue,
          retentionScheduleUnit: req.body.retentionScheduleUnit,
        });
      }
      // Update global TimescaleDB policies and schedule ONCE after all websites are updated
      await updateGlobalPolicies(
        req.body.compressionValue,
        req.body.compressionUnit,
        req.body.retentionValue,
        req.body.retentionUnit,
        req.body.retentionScheduleValue,
        req.body.retentionScheduleUnit
      );
      res.json({ message: "Settings updated for all websites and global policies/schedule updated" });
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
      const validatedData = insertTagSchema.pick({ name: true }).parse(req.body);
      const tag = await storage.updateTag(id, validatedData);
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
      await storage.deleteTag(id);
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting tag with ID: ${req.params.id}`, error);
      res.status(500).json({ message: "Failed to delete tag" });
    }
  });

  // Endpoint to get global compression and retention policies
  app.get("/api/settings/retention", async (req, res) => {
    try {
      const policies = await db.execute(sql`
        SELECT * FROM timescaledb_information.jobs WHERE proc_name = 'policy_retention' AND hypertable_name = 'monitoring_logs';
      `);
      res.json(policies);
    } catch (error) {
      console.error('Error fetching retention settings:', error);
      res.status(500).json({ message: "Failed to fetch retention settings" });
    }
  });

  // Endpoint to update global compression and retention policies
  app.post("/api/settings/retention", async (req, res) => {
    try {
      const {
        compressionValue,
        compressionUnit,
        retentionValue,
        retentionUnit,
        retentionScheduleValue,
        retentionScheduleUnit,
      } = compressionRetentionSchema.parse(req.body);

      await updateGlobalPolicies(
        compressionValue,
        compressionUnit,
        retentionValue,
        retentionUnit,
        retentionScheduleValue,
        retentionScheduleUnit
      );

      res.json({ message: "Global compression and retention policies updated successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error('Error updating retention settings:', error);
      res.status(500).json({ message: "Failed to update retention settings" });
    }
  });

  return server;
}
