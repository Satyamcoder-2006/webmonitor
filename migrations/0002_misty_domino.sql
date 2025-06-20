ALTER TABLE "monitoring_logs" ALTER COLUMN "checked_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "monitoring_logs" ALTER COLUMN "checked_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "compression_interval" text DEFAULT '10 minutes';--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "retention_period" text DEFAULT '90 days';