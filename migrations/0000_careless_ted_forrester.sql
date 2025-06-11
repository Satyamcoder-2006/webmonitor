CREATE TABLE "alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_id" integer NOT NULL,
	"alert_type" text NOT NULL,
	"message" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"email_sent" boolean DEFAULT false NOT NULL,
	"read" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitoring_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_id" integer NOT NULL,
	"status" text NOT NULL,
	"http_status" integer,
	"response_time" integer,
	"error_message" text,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_id" integer NOT NULL,
	"status" text NOT NULL,
	"response_time" integer,
	"last_checked" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "websites" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"check_interval" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_status" text DEFAULT 'unknown' NOT NULL,
	"last_alert_sent" timestamp,
	"last_email_sent" timestamp,
	CONSTRAINT "websites_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_logs" ADD CONSTRAINT "monitoring_logs_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_status" ADD CONSTRAINT "site_status_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;