-- Recommended schema for calculation result saves used by js/saved-cats.js.
-- Run this manually in the Supabase SQL Editor if feeding_records does not already
-- have these columns. This repository file is documentation/helper SQL only.
CREATE TABLE IF NOT EXISTS public.feeding_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cat_id uuid NOT NULL,
  recorded_date date NOT NULL DEFAULT current_date,
  result_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
