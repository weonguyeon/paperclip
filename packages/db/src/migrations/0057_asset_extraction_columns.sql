ALTER TABLE "assets" ADD COLUMN "extracted_text" text;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "extraction_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "extraction_meta" jsonb;