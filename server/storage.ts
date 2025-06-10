import { websites, monitoringLogs, alerts, type Website, type InsertWebsite, type MonitoringLog, type InsertMonitoringLog, type Alert, type InsertAlert } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte } from "drizzle-orm";

export interface IStorage {
  // Website operations
  createWebsite(website: InsertWebsite): Promise<Website>;
  getWebsites(): Promise<Website[]>;
  getWebsite(id: number): Promise<Website | undefined>;
  getActiveWebsites(): Promise<Website[]>;
  updateWebsite(id: number, updates: Partial<InsertWebsite>): Promise<Website | undefined>;
  deleteWebsite(id: number): Promise<boolean>;

  // Monitoring log operations
  createMonitoringLog(log: InsertMonitoringLog): Promise<MonitoringLog>;
  getMonitoringLogs(websiteId?: number, limit?: number): Promise<MonitoringLog[]>;
  getLatestLogForWebsite(websiteId: number): Promise<MonitoringLog | undefined>;
  getRecentLogs(hours: number): Promise<(MonitoringLog & { website: Website })[]>;

  // Alert operations
  createAlert(alert: InsertAlert): Promise<Alert>;
  getRecentAlerts(limit?: number): Promise<(Alert & { website: Website })[]>;

  // Analytics
  getWebsiteStats(): Promise<{
    totalSites: number;
    sitesUp: number;
    sitesDown: number;
    averageResponseTime: number;
    uptime: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async createWebsite(website: InsertWebsite): Promise<Website> {
    const [result] = await db
      .insert(websites)
      .values({ ...website, updatedAt: new Date() })
      .returning();
    return result;
  }

  async getWebsites(): Promise<Website[]> {
    return await db.select().from(websites).orderBy(desc(websites.createdAt));
  }

  async getWebsite(id: number): Promise<Website | undefined> {
    const [website] = await db.select().from(websites).where(eq(websites.id, id));
    return website || undefined;
  }

  async getActiveWebsites(): Promise<Website[]> {
    return await db.select().from(websites).where(eq(websites.isActive, true));
  }

  async updateWebsite(id: number, updates: Partial<InsertWebsite>): Promise<Website | undefined> {
    const [website] = await db
      .update(websites)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(websites.id, id))
      .returning();
    return website || undefined;
  }

  async deleteWebsite(id: number): Promise<boolean> {
    try {
      await db.delete(websites).where(eq(websites.id, id));
      return true;
    } catch {
      return false;
    }
  }

  async createMonitoringLog(log: InsertMonitoringLog): Promise<MonitoringLog> {
    const [result] = await db
      .insert(monitoringLogs)
      .values(log)
      .returning();
    return result;
  }

  async getMonitoringLogs(websiteId?: number, limit = 50): Promise<MonitoringLog[]> {
    if (websiteId) {
      return await db.select().from(monitoringLogs)
        .where(eq(monitoringLogs.websiteId, websiteId))
        .orderBy(desc(monitoringLogs.checkedAt))
        .limit(limit);
    }
    
    return await db.select().from(monitoringLogs)
      .orderBy(desc(monitoringLogs.checkedAt))
      .limit(limit);
  }

  async getLatestLogForWebsite(websiteId: number): Promise<MonitoringLog | undefined> {
    const [log] = await db
      .select()
      .from(monitoringLogs)
      .where(eq(monitoringLogs.websiteId, websiteId))
      .orderBy(desc(monitoringLogs.checkedAt))
      .limit(1);
    return log || undefined;
  }

  async getRecentLogs(hours: number): Promise<(MonitoringLog & { website: Website })[]> {
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await db
      .select({
        id: monitoringLogs.id,
        websiteId: monitoringLogs.websiteId,
        status: monitoringLogs.status,
        httpStatus: monitoringLogs.httpStatus,
        responseTime: monitoringLogs.responseTime,
        errorMessage: monitoringLogs.errorMessage,
        checkedAt: monitoringLogs.checkedAt,
        website: websites,
      })
      .from(monitoringLogs)
      .innerJoin(websites, eq(monitoringLogs.websiteId, websites.id))
      .where(gte(monitoringLogs.checkedAt, hoursAgo))
      .orderBy(desc(monitoringLogs.checkedAt));
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [result] = await db
      .insert(alerts)
      .values(alert)
      .returning();
    return result;
  }

  async getRecentAlerts(limit = 10): Promise<(Alert & { website: Website })[]> {
    return await db
      .select({
        id: alerts.id,
        websiteId: alerts.websiteId,
        alertType: alerts.alertType,
        message: alerts.message,
        sentAt: alerts.sentAt,
        emailSent: alerts.emailSent,
        website: websites,
      })
      .from(alerts)
      .innerJoin(websites, eq(alerts.websiteId, websites.id))
      .orderBy(desc(alerts.sentAt))
      .limit(limit);
  }

  async getWebsiteStats(): Promise<{
    totalSites: number;
    sitesUp: number;
    sitesDown: number;
    averageResponseTime: number;
    uptime: number;
  }> {
    const totalSites = await db
      .select({ count: sql<number>`count(*)` })
      .from(websites)
      .then(rows => rows[0]?.count || 0);

    // Get latest status for each website - simplified approach
    const latestStatuses = await db
      .select({
        websiteId: monitoringLogs.websiteId,
        status: monitoringLogs.status,
        responseTime: monitoringLogs.responseTime,
      })
      .from(monitoringLogs)
      .orderBy(desc(monitoringLogs.checkedAt));

    // Group by website ID to get only the latest status for each
    const latestStatusByWebsite = new Map();
    latestStatuses.forEach(status => {
      if (!latestStatusByWebsite.has(status.websiteId)) {
        latestStatusByWebsite.set(status.websiteId, status);
      }
    });
    
    const uniqueLatestStatuses = Array.from(latestStatusByWebsite.values());

    const sitesUp = uniqueLatestStatuses.filter(s => s.status === 'up').length;
    const sitesDown = uniqueLatestStatuses.filter(s => s.status === 'down').length;
    
    const validResponseTimes = uniqueLatestStatuses
      .filter(s => s.responseTime !== null)
      .map(s => s.responseTime!);
    
    const averageResponseTime = validResponseTimes.length > 0 
      ? Math.round(validResponseTimes.reduce((a, b) => a + b, 0) / validResponseTimes.length)
      : 0;

    // Calculate uptime from last 24 hours
    const last24h = await db
      .select({ status: monitoringLogs.status })
      .from(monitoringLogs)
      .where(gte(monitoringLogs.checkedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
    
    const uptime = last24h.length > 0 
      ? Math.round((last24h.filter(l => l.status === 'up').length / last24h.length) * 100 * 10) / 10
      : 100;

    return {
      totalSites,
      sitesUp,
      sitesDown,
      averageResponseTime,
      uptime,
    };
  }
}

export const storage = new DatabaseStorage();
