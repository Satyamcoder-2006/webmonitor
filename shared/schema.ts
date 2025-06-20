import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const websites = pgTable("websites", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  checkInterval: integer("check_interval").notNull().default(60), // minutes
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastStatus: text("last_status").default('unknown').notNull(),
  lastAlertSent: timestamp("last_alert_sent"),
  lastEmailSent: timestamp("last_email_sent"),
  customTags: jsonb("custom_tags").default({}).notNull(),
  sslValid: boolean("ssl_valid"),
  sslExpiryDate: timestamp("ssl_expiry_date"),
  sslDaysLeft: integer("ssl_days_left"),
});

// Modified to track all checks
export const monitoringLogs = pgTable("monitoring_logs", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").references(() => websites.id, { onDelete: 'cascade' }).notNull(),
  status: text("status").notNull(), // 'up', 'down', 'error'
  httpStatus: integer("http_status"),
  responseTime: integer("response_time"), // milliseconds
  errorMessage: text("error_message"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
  changeType: text("change_type").notNull(), // 'status_change', 'regular_check', 'website_added', 'website_deleted'
  previousStatus: text("previous_status"), // Only populated for status changes
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

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

// Types
export type Website = typeof websites.$inferSelect;
export type NewWebsite = typeof websites.$inferInsert;
export type MonitoringLog = typeof monitoringLogs.$inferSelect;
export type NewMonitoringLog = typeof monitoringLogs.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;

// Zod schemas
export const insertWebsiteSchema = createInsertSchema(websites).extend({
  customTags: z.array(z.string()).optional(),
});
export const selectWebsiteSchema = createSelectSchema(websites);
export const updateWebsiteSchema = createSelectSchema(websites).partial().extend({
  customTags: z.array(z.string()).optional(),
});
export const insertMonitoringLogSchema = createInsertSchema(monitoringLogs);
export const selectMonitoringLogSchema = createSelectSchema(monitoringLogs);
export const insertAlertSchema = createInsertSchema(alerts);
export const selectAlertSchema = createSelectSchema(alerts);

export const insertTagSchema = createInsertSchema(tags);
export const selectTagSchema = createSelectSchema(tags);
