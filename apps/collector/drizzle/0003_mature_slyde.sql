ALTER TABLE "analytics_events" ADD COLUMN "lcp_ms" integer;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "cls" real;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "fid_ms" integer;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "inp_ms" integer;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "ttfb_ms" integer;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "fcp_ms" integer;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "dom_interactive_ms" integer;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "scroll_depth_percent" integer;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "click_count" integer;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "engagement_time_ms" integer;