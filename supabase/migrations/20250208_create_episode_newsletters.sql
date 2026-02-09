-- Create episode_newsletters table for PROJ-5: Newsletter Generation
-- Add newsletter_sent_at column to episodes for PROJ-6: Email Delivery

CREATE TABLE IF NOT EXISTS episode_newsletters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE UNIQUE,
  intro TEXT NOT NULL,
  bullet_points TEXT[] NOT NULL,
  key_takeaways TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for episode lookup
CREATE INDEX IF NOT EXISTS idx_episode_newsletters_episode
  ON episode_newsletters(episode_id);

-- Enable Row Level Security
ALTER TABLE episode_newsletters ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view only newsletters for their own episodes
CREATE POLICY "Users can view own newsletters"
  ON episode_newsletters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM episodes
      JOIN podcast_subscriptions ON podcast_subscriptions.id = episodes.subscription_id
      WHERE episodes.id = episode_newsletters.episode_id
      AND podcast_subscriptions.user_id = auth.uid()
    )
  );

-- Add newsletter_sent_at to episodes table (PROJ-6)
ALTER TABLE episodes
ADD COLUMN IF NOT EXISTS newsletter_sent_at TIMESTAMPTZ;

-- Partial index for unsent newsletters (used by delivery cronjob)
CREATE INDEX IF NOT EXISTS idx_episodes_newsletter_ready
  ON episodes(status) WHERE status = 'newsletter_ready';

COMMENT ON TABLE episode_newsletters IS 'AI-generated newsletter content (intro, bullet points, key takeaways) for each episode';
