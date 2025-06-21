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
  compressionInterval: text("compression_interval").default('10 minutes'),
  retentionPeriod: text("retention_period").default('90 days'),
  compressionValue: integer("compression_value").default(10),
  compressionUnit: text("compression_unit").default('minutes'),
  retentionValue: integer("retention_value").default(90),
  retentionUnit: text("retention_unit").default('days'),
  retentionScheduleValue: integer("retention_schedule_value").default(1),
  retentionScheduleUnit: text("retention_schedule_unit").default('days'),
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
export const insertWebsiteSchema = z.object({
  name: z.string(),
  url: z.string(),
  email: z.string(),
  checkInterval: z.number(),
  isActive: z.boolean().optional(),
  customTags: z.array(z.string()).optional(),
  // add other fields as needed
});
export const selectWebsiteSchema = createSelectSchema(websites);
export const updateWebsiteSchema = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
  email: z.string().optional(),
  checkInterval: z.number().optional(),
  isActive: z.boolean().optional(),
  customTags: z.record(z.string()).optional(),
  lastStatus: z.string().optional(),
  lastAlertSent: z.date().optional().nullable(),
  lastEmailSent: z.date().optional().nullable(),
  sslValid: z.boolean().optional().nullable(),
  sslExpiryDate: z.date().optional().nullable(),
  sslDaysLeft: z.number().optional().nullable(),
  compressionInterval: z.string().optional(),
  retentionPeriod: z.string().optional(),
  compressionValue: z.number().optional(),
  compressionUnit: z.string().optional(),
  retentionValue: z.number().optional(),
  retentionUnit: z.string().optional(),
  retentionScheduleValue: z.number().optional(),
  retentionScheduleUnit: z.string().optional(),
});

// Plain Zod schema for compression/retention fields
export const compressionRetentionSchema = z.object({
  compressionValue: z.number().min(1),
  compressionUnit: z.enum(["minutes", "hours", "days"]),
  retentionValue: z.number().min(1),
  retentionUnit: z.enum(["minutes", "hours", "days"]),
  retentionScheduleValue: z.number().min(1).optional(),
  retentionScheduleUnit: z.enum(["minutes", "hours", "days"]).optional(),
});

export const insertMonitoringLogSchema = z.object({
  websiteId: z.number(),
  status: z.string(),
  httpStatus: z.number().nullable().optional(),
  responseTime: z.number().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  checkedAt: z.coerce.date(),
  changeType: z.string(),
  previousStatus: z.string().nullable().optional(),
});

export const selectMonitoringLogSchema = createSelectSchema(monitoringLogs);
export const insertAlertSchema = createInsertSchema(alerts);
export const selectAlertSchema = createSelectSchema(alerts);

export const insertTagSchema = createInsertSchema(tags);
export const selectTagSchema = createSelectSchema(tags);
