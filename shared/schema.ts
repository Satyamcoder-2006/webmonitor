import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const websites = pgTable("websites", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  checkInterval: integer("check_interval").notNull().default(5), // minutes
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const monitoringLogs = pgTable("monitoring_logs", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").references(() => websites.id).notNull(),
  status: text("status").notNull(), // 'up', 'down', 'error'
  httpStatus: integer("http_status"),
  responseTime: integer("response_time"), // milliseconds
  errorMessage: text("error_message"),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").references(() => websites.id).notNull(),
  alertType: text("alert_type").notNull(), // 'down', 'up', 'slow'
  message: text("message").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  emailSent: boolean("email_sent").notNull().default(false),
});

export const insertWebsiteSchema = createInsertSchema(websites).pick({
  url: true,
  name: true,
  email: true,
  checkInterval: true,
  isActive: true,
}).extend({
  url: z.string().url("Please enter a valid URL"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  checkInterval: z.number().min(1).max(60).default(5),
});

export const insertMonitoringLogSchema = createInsertSchema(monitoringLogs).pick({
  websiteId: true,
  status: true,
  httpStatus: true,
  responseTime: true,
  errorMessage: true,
});

export const insertAlertSchema = createInsertSchema(alerts).pick({
  websiteId: true,
  alertType: true,
  message: true,
  emailSent: true,
});

export type Website = typeof websites.$inferSelect;
export type InsertWebsite = z.infer<typeof insertWebsiteSchema>;
export type MonitoringLog = typeof monitoringLogs.$inferSelect;
export type InsertMonitoringLog = z.infer<typeof insertMonitoringLogSchema>;
export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
