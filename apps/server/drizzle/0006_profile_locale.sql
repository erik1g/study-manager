-- Existing accounts have used the German interface so far and keep it;
-- new accounts get their language when they are created.
ALTER TABLE "profiles" ADD COLUMN "locale" text DEFAULT 'de' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "locale" SET DEFAULT 'en';
