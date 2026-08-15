DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'book_metadata' AND column_name = 'mangabaka_id') THEN
    ALTER TABLE "book_metadata" ADD COLUMN "mangabaka_id" varchar(50);
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'book_metadata' AND column_name = 'mangabaka_series_id') THEN
    ALTER TABLE "book_metadata" ADD COLUMN "mangabaka_series_id" varchar(50);
  END IF;
END $$;
