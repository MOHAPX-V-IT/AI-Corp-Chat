-- token_usage — per-incident LLM token spend (Sales Gyroscope-compatible structure).
CREATE TABLE IF NOT EXISTS "token_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" varchar(255) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"model" varchar(100) NOT NULL,
	"purpose" varchar(50) NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_input" varchar(20),
	"cost_output" varchar(20),
	"report_id" integer,
	"host" varchar(255),
	"host_ip" varchar(64),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "token_usage_created_at_idx" ON "token_usage" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "token_usage_domain_idx" ON "token_usage" ("domain");
