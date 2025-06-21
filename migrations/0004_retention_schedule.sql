ALTER TABLE "websites" ADD COLUMN "retention_schedule_value" integer DEFAULT 1;
ALTER TABLE "websites" ADD COLUMN "retention_schedule_unit" text DEFAULT 'days'; 