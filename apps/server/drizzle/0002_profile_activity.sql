CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"course_id" uuid,
	"actor_id" uuid,
	"via" text NOT NULL,
	"action" text NOT NULL,
	"subject_id" uuid,
	"subject" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "avatar_path" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "avatar_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "studies" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "semester" smallint;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_course_id_at_index" ON "activity" USING btree ("course_id","at");--> statement-breakpoint
CREATE INDEX "activity_actor_id_at_index" ON "activity" USING btree ("actor_id","at");--> statement-breakpoint
CREATE INDEX "activity_at_index" ON "activity" USING btree ("at");