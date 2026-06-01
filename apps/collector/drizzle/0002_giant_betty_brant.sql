CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_name" text,
	"url" text NOT NULL,
	"referrer" text,
	"title" text NOT NULL,
	"browser" text NOT NULL,
	"os" text NOT NULL,
	"device" text NOT NULL,
	"language" text NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"duration_ms" integer,
	"is_bounce" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"timestamp" timestamp NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_tenant_idx" ON "analytics_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "analytics_events_project_idx" ON "analytics_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "analytics_events_session_idx" ON "analytics_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "analytics_events_event_type_idx" ON "analytics_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "analytics_events_received_at_idx" ON "analytics_events" USING btree ("received_at");