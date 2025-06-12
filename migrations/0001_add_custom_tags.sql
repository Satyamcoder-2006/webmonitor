ALTER TABLE "websites" ADD COLUMN IF NOT EXISTS "custom_tags" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "websites" ADD COLUMN IF NOT EXISTS "ssl_valid" boolean;
ALTER TABLE "websites" ADD COLUMN IF NOT EXISTS "ssl_expiry_date" timestamp;
ALTER TABLE "websites" ADD COLUMN IF NOT EXISTS "ssl_days_left" integer; 