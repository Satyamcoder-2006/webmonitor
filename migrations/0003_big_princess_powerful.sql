ALTER TABLE "websites" ADD COLUMN "compression_value" integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "compression_unit" text DEFAULT 'minutes';--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "retention_value" integer DEFAULT 90;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "retention_unit" text DEFAULT 'days';