import { websites, monitoringLogs, alerts, type Website, type NewWebsite, type MonitoringLog, type NewMonitoringLog, type Alert, type NewAlert, tags, type Tag, type NewTag } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte } from "drizzle-orm";

export interface IStorage {
  // Website operations
  createWebsite(website: NewWebsite): Promise<Website>;
  getWebsites(): Promise<Website[]>;
  getWebsite(id: number): Promise<Website | undefined>;
  getActiveWebsites(): Promise<Website[]>;
  updateWebsite(id: number, updates: Partial<Website>): Promise<Website | undefined>;
  deleteWebsite(id: number): Promise<boolean>;

  // Monitoring log operations
  createMonitoringLog(log: NewMonitoringLog): Promise<MonitoringLog>;
  getMonitoringLogs(websiteId?: number, limit?: number): Promise<MonitoringLog[]>;
  getLatestLogForWebsite(websiteId: number): Promise<MonitoringLog | undefined>;
  getRecentLogs(hours: number): Promise<(MonitoringLog & { website: Website | null })[]>;

  // Analytics
  getWebsiteStats(): Promise<{
    totalSites: number;
    sitesUp: number;
    sitesDown: number;
    averageResponseTime: number;
    uptime: number;
  }>;

  // Clear monitoring logs
  clearMonitoringLogs(): Promise<void>;

  // Clear all websites and their data
  clearAllWebsitesAndData(): Promise<void>;

  // Tag operations
  createTag(tag: NewTag): Promise<Tag>;
  getTags(): Promise<Tag[]>;
  getTag(id: number): Promise<Tag | undefined>;
  updateTag(id: number, updates: Partial<Tag>): Promise<Tag | undefined>;
  deleteTag(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async createWebsite(website: NewWebsite): Promise<Website> {
    const [result] = await db
      .insert(websites)
      .values({ ...website, updatedAt: new Date(), createdAt: new Date(), lastStatus: 'unknown', isActive: true, checkInterval: website.checkInterval || 60 })
      .returning();
    return result;
  }

  async getWebsites(): Promise<Website[]> {
    return await db.select().from(websites).orderBy(desc(websites.createdAt));
  }

  async getWebsite(id: number): Promise<Website | undefined> {
    const [website] = await db
      .select()
      .from(websites)
      .where(eq(websites.id, id));
    return website;
  }

  async getActiveWebsites(): Promise<Website[]> {
    return db
      .select()
      .from(websites)
      .where(eq(websites.isActive, true))
      .orderBy(websites.name);
  }

  async updateWebsite(id: number, updates: Partial<Website>): Promise<Website | undefined> {
    const [updated] = await db
      .update(websites)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(websites.id, id))
      .returning();
    return updated;
  }

  async deleteWebsite(id: number): Promise<boolean> {
    return db.transaction(async (tx) => {
      try {
        // Delete related records first due to foreign key constraints
        await tx.delete(monitoringLogs).where(eq(monitoringLogs.websiteId, id));
        await tx.delete(alerts).where(eq(alerts.websiteId, id));
        // Now delete the website. If no error is thrown, it's successful.
        await tx.delete(websites).where(eq(websites.id, id));
        return true;
      } catch (error) {
        console.error(`Error deleting website ${id} and related data:`, error);
        return false;
      }
    });
  }

  async createMonitoringLog(log: NewMonitoringLog): Promise<MonitoringLog> {
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
    const [latestLog] = await db.select().from(monitoringLogs)
      .where(eq(monitoringLogs.websiteId, websiteId))
      .orderBy(desc(monitoringLogs.checkedAt))
      .limit(1);
    return latestLog;
  }

  async getRecentLogs(hours: number): Promise<(MonitoringLog & { website: Website | null })[]> {
    const cutOff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await db.select({
      id: monitoringLogs.id,
      websiteId: monitoringLogs.websiteId,
      status: monitoringLogs.status,
      httpStatus: monitoringLogs.httpStatus,
      responseTime: monitoringLogs.responseTime,
      errorMessage: monitoringLogs.errorMessage,
      checkedAt: monitoringLogs.checkedAt,
      changeType: monitoringLogs.changeType,
      previousStatus: monitoringLogs.previousStatus,
      website: websites,
    })
    .from(monitoringLogs)
    .leftJoin(websites, eq(monitoringLogs.websiteId, websites.id))
    .where(gte(monitoringLogs.checkedAt, cutOff))
    .orderBy(desc(monitoringLogs.checkedAt));
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

    // Get the latest status for each website using a subquery or DISTINCT ON
    const latestWebsiteStatuses = await db
      .selectDistinctOn([monitoringLogs.websiteId], {
        websiteId: monitoringLogs.websiteId,
        status: monitoringLogs.status,
        responseTime: monitoringLogs.responseTime,
        checkedAt: monitoringLogs.checkedAt,
      })
      .from(monitoringLogs)
      .orderBy(monitoringLogs.websiteId, desc(monitoringLogs.checkedAt));

    const sitesUp = latestWebsiteStatuses.filter(s => s.status === 'up').length;
    const sitesDown = latestWebsiteStatuses.filter(s => s.status === 'down').length;

    const validResponseTimes = latestWebsiteStatuses
      .filter(s => s.responseTime !== null)
      .map(s => s.responseTime!);

    const averageResponseTime = validResponseTimes.length > 0 
      ? Math.round(validResponseTimes.reduce((a, b) => a + b, 0) / validResponseTimes.length) 
      : 0;

    const uptime = totalSites > 0 ? Math.round((sitesUp / totalSites) * 100) : 0;

    return {
      totalSites,
      sitesUp,
      sitesDown,
      averageResponseTime,
      uptime
    };
  }

  async clearMonitoringLogs(): Promise<void> {
    await db.delete(monitoringLogs);
  }

  async clearAllWebsitesAndData(): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(monitoringLogs);
      await tx.delete(alerts);
      await tx.delete(websites);
    });
  }

  async createTag(tag: NewTag): Promise<Tag> {
    const [result] = await db.insert(tags).values(tag).returning();
    return result;
  }

  async getTags(): Promise<Tag[]> {
    return await db.select().from(tags).orderBy(tags.name);
  }

  async getTag(id: number): Promise<Tag | undefined> {
    const [tag] = await db.select().from(tags).where(eq(tags.id, id));
    return tag;
  }

  async updateTag(id: number, updates: Partial<Tag>): Promise<Tag | undefined> {
    const [updated] = await db.update(tags).set(updates).where(eq(tags.id, id)).returning();
    return updated;
  }

  async deleteTag(id: number): Promise<boolean> {
    const result = await db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
