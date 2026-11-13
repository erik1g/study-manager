-- Existing courses were written in German so far and keep it; new courses get
-- their creator's language when they are created.
ALTER TABLE "courses" ADD COLUMN "locale" text DEFAULT 'de' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "locale" SET DEFAULT 'en';
