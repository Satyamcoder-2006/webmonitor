import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWebsiteSchema } from "@shared/schema";
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
      const validatedData = insertWebsiteSchema.parse(req.body);
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

      const updates = insertWebsiteSchema.partial().parse(req.body);
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
      
      // Transform to activity format
      const activities = logs.map(log => ({
        id: log.id,
        type: log.status === 'up' ? 'recovery' : log.status === 'down' ? 'outage' : 'check',
        message: `${log.website.name} ${log.status === 'up' ? 'came back online' : log.status === 'down' ? 'went offline' : 'was checked'}`,
        timestamp: log.checkedAt,
        websiteId: log.websiteId,
        websiteName: log.website.name,
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
      await monitorWebsite(id);
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

  const httpServer = createServer(app);
  return httpServer;
}
