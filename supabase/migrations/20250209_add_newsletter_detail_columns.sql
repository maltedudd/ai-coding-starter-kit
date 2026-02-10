-- Add new columns for richer newsletter content
ALTER TABLE episode_newsletters
  ADD COLUMN IF NOT EXISTS action_items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quotes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS speakers JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reflection TEXT;
