import { websites, monitoringLogs, alerts, siteStatus, type Website, type CreateWebsite, type UpdateWebsite, type MonitoringLog, type InsertMonitoringLog, type Alert, type InsertAlert } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte, isNotNull } from "drizzle-orm";

export interface IStorage {
  // Website operations
  createWebsite(website: CreateWebsite): Promise<Website>;
  getWebsites(): Promise<Website[]>;
  getWebsite(id: number): Promise<Website | undefined>;
  getActiveWebsites(): Promise<Website[]>;
  updateWebsite(id: number, updates: UpdateWebsite): Promise<Website | undefined>;
  deleteWebsite(id: number): Promise<boolean>;

  // Monitoring log operations
  createMonitoringLog(log: InsertMonitoringLog): Promise<MonitoringLog>;
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

  // Visitor tracking
  createVisitorLog(visitor: InsertVisitor): Promise<Visitor>;
  updateVisitorSession(visitorId: string, websiteId: number, duration: number): Promise<boolean>;
  getVisitorStats(websiteId: number, days: number): Promise<{
    totalVisitors: number;
    uniqueVisitors: number;
    averageDuration: number;
    bounceRate: number;
    topReferrers: { referrer: string; count: number }[];
  }>;
}

export class DatabaseStorage implements IStorage {
  async createWebsite(website: CreateWebsite): Promise<Website> {
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

  async updateWebsite(id: number, updates: UpdateWebsite): Promise<Website | undefined> {
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
        await tx.delete(siteStatus).where(eq(siteStatus.websiteId, id));

        // Now delete the website. If no error is thrown, it's successful.
        await tx.delete(websites).where(eq(websites.id, id));
        return true; // Successfully deleted (or website didn't exist, which is fine for delete op)
      } catch (error) {
        console.error(`Error deleting website ${id} and related data:`, error);
        // If an error occurs, the transaction will be rolled back automatically
        return false;
      }
    });
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
      website: websites, // Include website data
    })
    .from(monitoringLogs)
    .leftJoin(websites, eq(monitoringLogs.websiteId, websites.id))
    .where(and(
      gte(monitoringLogs.checkedAt, cutOff),
      // isNotNull(websites.id) // Removed this as it changes leftJoin to innerJoin behavior
    ))
    .orderBy(desc(monitoringLogs.checkedAt));
  }

  async getWebsiteStats(): Promise<{
    totalSites: number;
    sitesUp: number;
    sitesDown: number;
    averageResponseTime: number;
    uptime: number;
    sslHealth: number;
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

    // Calculate uptime from all historical logs
    const allLogs = await db
      .select({ status: monitoringLogs.status })
      .from(monitoringLogs);
    
    const uptime = allLogs.length > 0 
      ? Math.round((allLogs.filter(l => l.status === 'up').length / allLogs.length) * 100 * 10) / 10
      : 100;
      
    // Get all websites for SSL health calculation
    const allWebsites = await this.getWebsites();
    
    // Calculate SSL health percentage
    const httpsWebsites = allWebsites.filter(site => site.url.startsWith('https://'));
    const httpsCount = httpsWebsites.length;
    
    if (httpsCount === 0) {
      // No HTTPS websites to check
      return {
        totalSites,
        sitesUp,
        sitesDown,
        averageResponseTime,
        uptime,
        sslHealth: 100 // Default to 100% if no HTTPS sites
      };
    }
    
    // Count websites with valid SSL certificates
    const validSSL = httpsWebsites.filter(site => site.sslValid === true).length;
    
    // Count websites with SSL certificates expiring soon (within 30 days)
    const expiringSoon = httpsWebsites.filter(site => 
      site.sslValid === true && 
      site.sslDaysLeft !== null && 
      site.sslDaysLeft <= 30
    ).length;
    
    // Calculate SSL health percentage
    // Formula: (valid certs - (expiring soon * 0.5)) / total https sites * 100
    // This penalizes sites with expiring certificates but doesn't count them as completely invalid
    const sslHealth = Math.round(((validSSL - (expiringSoon * 0.5)) / httpsCount) * 100);

    return {
      totalSites,
      sitesUp,
      sitesDown,
      averageResponseTime,
      uptime,
      sslHealth: Math.max(0, Math.min(100, sslHealth)) // Ensure value is between 0-100
    };
  }
  
  async createVisitorLog(visitor: InsertVisitor): Promise<Visitor> {
    // Check if it's a bot based on user agent
    const botPattern = /bot|googlebot|crawler|spider|robot|crawling/i;
    const isBot = botPattern.test(visitor.userAgent || '');
    
    const [result] = await db
      .insert(visitors)
      .values({ ...visitor, isBot })
      .returning();
    return result;
  }
  
  async updateVisitorSession(visitorId: string, websiteId: number, duration: number): Promise<boolean> {
    try {
      await db
        .update(visitors)
        .set({ duration })
        .where(
          and(
            eq(visitors.visitorId, visitorId),
            eq(visitors.websiteId, websiteId)
          )
        );
      return true;
    } catch (error) {
      console.error('Error updating visitor session:', error);
      return false;
    }
  }
  
  async getVisitorStats(websiteId: number, days: number): Promise<{
    totalVisitors: number;
    uniqueVisitors: number;
    averageDuration: number;
    bounceRate: number;
    topReferrers: { referrer: string; count: number }[];
  }> {
    const cutOff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Get all visitors for this website in the time period
    const allVisitors = await db
      .select()
      .from(visitors)
      .where(
        and(
          eq(visitors.websiteId, websiteId),
          gte(visitors.timestamp, cutOff),
          eq(visitors.isBot, false)
        )
      );
    
    // Count total visitors
    const totalVisitors = allVisitors.length;
    
    // Count unique visitors
    const uniqueVisitorIds = new Set(allVisitors.map(v => v.visitorId));
    const uniqueVisitors = uniqueVisitorIds.size;
    
    // Calculate average duration
    const visitorsWithDuration = allVisitors.filter(v => v.duration !== null && v.duration > 0);
    const averageDuration = visitorsWithDuration.length > 0
      ? Math.round(visitorsWithDuration.reduce((sum, v) => sum + (v.duration || 0), 0) / visitorsWithDuration.length)
      : 0;
    
    // Calculate bounce rate (visitors who stayed less than 10 seconds)
    const bouncedVisitors = allVisitors.filter(v => v.duration !== null && v.duration < 10).length;
    const bounceRate = totalVisitors > 0
      ? Math.round((bouncedVisitors / totalVisitors) * 100)
      : 0;
    
    // Get top referrers
    const referrerCounts: Record<string, number> = {};
    allVisitors.forEach(v => {
      if (v.referrer) {
        const domain = new URL(v.referrer).hostname;
        referrerCounts[domain] = (referrerCounts[domain] || 0) + 1;
      }
    });
    
    const topReferrers = Object.entries(referrerCounts)
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      totalVisitors,
      uniqueVisitors,
      averageDuration,
      bounceRate,
      topReferrers,
    };
  }
}

export const storage = new DatabaseStorage();
