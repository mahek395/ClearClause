-- Run once against your PostgreSQL database
-- docker exec -i lexsimple-pg psql -U postgres -d lexsimple < migration.sql

-- Add updated_at if it doesn't exist
ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 'ready' is the handoff signal: worker done → AI can start
-- Only needed if your status column is an enum (skip if it's VARCHAR)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'document_status'
  ) THEN
    ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'ready';
    ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'failed';
  END IF;
END$$;
