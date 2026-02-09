-- Create episodes table for PROJ-3: New Episode Detection
-- Extended with transcript fields for PROJ-4: Episode Transcription

CREATE TABLE IF NOT EXISTS episodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES podcast_subscriptions(id) ON DELETE CASCADE,
  guid TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  audio_url TEXT NOT NULL,
  duration_seconds INT,
  published_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending_transcription',
  transcript TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subscription_id, guid)
);

-- Index for status queries (worker fetches pending episodes)
CREATE INDEX IF NOT EXISTS idx_episodes_status ON episodes(status);

-- Index for published_at (filter recent episodes)
CREATE INDEX IF NOT EXISTS idx_episodes_published_at ON episodes(published_at DESC);

-- Index for subscription lookups
CREATE INDEX IF NOT EXISTS idx_episodes_subscription_id ON episodes(subscription_id);

-- Enable Row Level Security
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view only episodes belonging to their subscriptions
CREATE POLICY "Users can view own episodes"
  ON episodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM podcast_subscriptions
      WHERE podcast_subscriptions.id = episodes.subscription_id
      AND podcast_subscriptions.user_id = auth.uid()
    )
  );

-- Feed check logs for error tracking (PROJ-3)
CREATE TABLE IF NOT EXISTS feed_check_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES podcast_subscriptions(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  error_message TEXT,
  episodes_found INT DEFAULT 0,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for recent errors query
CREATE INDEX IF NOT EXISTS idx_feed_check_logs_subscription
  ON feed_check_logs(subscription_id, checked_at DESC);

COMMENT ON TABLE episodes IS 'Podcast episodes detected from RSS feeds, with transcription status and text';
COMMENT ON TABLE feed_check_logs IS 'Log of RSS feed check results for error tracking';
