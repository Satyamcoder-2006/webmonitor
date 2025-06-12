CREATE TABLE "visitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"website_id" integer NOT NULL,
	"url" text NOT NULL,
	"referrer" text,
	"user_agent" text,
	"ip" text,
	"screen_width" integer,
	"screen_height" integer,
	"language" text,
	"duration" integer,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "custom_tags" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "ssl_valid" boolean;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "ssl_expiry_date" timestamp;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "ssl_days_left" integer;--> statement-breakpoint
ALTER TABLE "visitors" ADD CONSTRAINT "visitors_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;