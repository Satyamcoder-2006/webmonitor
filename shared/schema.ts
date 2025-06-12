import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const websites = pgTable("websites", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  checkInterval: integer("check_interval").notNull().default(60), // seconds
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastStatus: text("last_status").default('unknown').notNull(),
  lastAlertSent: timestamp("last_alert_sent"), // Track when the last alert was sent
  lastEmailSent: timestamp("last_email_sent"),
  // Add custom tags field
  customTags: jsonb("custom_tags").default({}).notNull(),
  // Add SSL monitoring fields
  sslValid: boolean("ssl_valid"),
  sslExpiryDate: timestamp("ssl_expiry_date"),
  sslDaysLeft: integer("ssl_days_left"),
});

export const monitoringLogs = pgTable("monitoring_logs", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").references(() => websites.id, { onDelete: 'cascade' }).notNull(),
  status: text("status").notNull(), // 'up', 'down', 'error'
  httpStatus: integer("http_status"),
  responseTime: integer("response_time"), // milliseconds
  errorMessage: text("error_message"),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").references(() => websites.id, { onDelete: 'cascade' }).notNull(),
  alertType: text("alert_type").notNull(), // 'down', 'up', 'slow'
  message: text("message").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  emailSent: boolean("email_sent").notNull().default(false),
  read: boolean("read").notNull().default(false),
});

export const siteStatus = pgTable("site_status", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").references(() => websites.id, { onDelete: 'cascade' }).notNull(),
  status: text("status").notNull(), // 'up', 'down', 'error'
  responseTime: integer("response_time"), // milliseconds
  lastChecked: timestamp("last_checked").defaultNow().notNull(),
});

// Schema for creating a new website (only fields required from user input)
export const createWebsiteSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  checkInterval: z.number().min(1).max(3600).default(60), // 1 second to 1 hour
  isActive: z.boolean().default(true),
  // Add custom tags
  customTags: z.record(z.string()).optional().default({}),
});

export type CreateWebsite = z.infer<typeof createWebsiteSchema>;

// Schema for updating an existing website (all fields are optional)
export const updateWebsiteSchema = createInsertSchema(websites).partial();

export type UpdateWebsite = z.infer<typeof updateWebsiteSchema>;

export const selectWebsiteSchema = createSelectSchema(websites);
export type Website = z.infer<typeof selectWebsiteSchema>;

export const insertMonitoringLogSchema = createInsertSchema(monitoringLogs).pick({
  websiteId: true,
  status: true,
  httpStatus: true,
  responseTime: true,
  errorMessage: true,
});
export type InsertMonitoringLog = z.infer<typeof insertMonitoringLogSchema>;
export type MonitoringLog = typeof monitoringLogs.$inferSelect;

export const insertAlertSchema = createInsertSchema(alerts).pick({
  websiteId: true,
  alertType: true,
  message: true,
  emailSent: true,
});
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

export const insertSiteStatusSchema = createInsertSchema(siteStatus).pick({
  id: true,
  websiteId: true,
  status: true,
  responseTime: true,
  lastChecked: true,
});
export type InsertSiteStatus = z.infer<typeof insertSiteStatusSchema>;
export type SiteStatus = typeof siteStatus.$inferSelect;

export const visitors = pgTable("visitors", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  websiteId: integer("website_id").references(() => websites.id, { onDelete: 'cascade' }).notNull(),
  url: text("url").notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  ip: text("ip"),
  screenWidth: integer("screen_width"),
  screenHeight: integer("screen_height"),
  language: text("language"),
  duration: integer("duration"), // in seconds
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  isBot: boolean("is_bot").default(false).notNull(),
});

export const insertVisitorSchema = createInsertSchema(visitors).pick({
  visitorId: true,
  websiteId: true,
  url: true,
  referrer: true,
  userAgent: true,
  ip: true,
  screenWidth: true,
  screenHeight: true,
  language: true,
  duration: true,
  isBot: true,
});
export type InsertVisitor = z.infer<typeof insertVisitorSchema>;
export type Visitor = typeof visitors.$inferSelect;
