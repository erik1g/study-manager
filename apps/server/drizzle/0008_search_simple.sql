-- The search reads words as they stand ('simple') instead of German stems, so
-- that it works alike for documents in every language. Replacing the
-- generated column recomputes it for every passage, which rewrites the table
-- once; the index goes with the column and is made again.
ALTER TABLE "chunks" DROP COLUMN "words";--> statement-breakpoint
ALTER TABLE "chunks" ADD COLUMN "words" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', text)) STORED;--> statement-breakpoint
CREATE INDEX "chunks_words_idx" ON "chunks" USING gin ("words");
