CREATE TABLE "deadline_done" (
	"deadline_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deadline_done_deadline_id_user_id_pk" PRIMARY KEY("deadline_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "deadline_done" ADD CONSTRAINT "deadline_done_deadline_id_deadlines_id_fk" FOREIGN KEY ("deadline_id") REFERENCES "public"."deadlines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_done" ADD CONSTRAINT "deadline_done_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deadline_done_user_id_index" ON "deadline_done" USING btree ("user_id");