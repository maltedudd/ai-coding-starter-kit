-- Create podcast_subscriptions table for PROJ-2: Podcast Subscription Management

CREATE TABLE IF NOT EXISTS podcast_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feed_url) -- Prevents duplicate subscriptions
);

-- Index for user_id lookups (podcast list)
CREATE INDEX IF NOT EXISTS idx_podcast_subscriptions_user_id
  ON podcast_subscriptions(user_id);

-- Enable Row Level Security
ALTER TABLE podcast_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view only their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON podcast_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can create only their own subscriptions
CREATE POLICY "Users can create own subscriptions"
  ON podcast_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete only their own subscriptions
CREATE POLICY "Users can delete own subscriptions"
  ON podcast_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at on every update
CREATE TRIGGER update_podcast_subscriptions_updated_at
  BEFORE UPDATE ON podcast_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE podcast_subscriptions IS 'User podcast subscriptions with RSS feed metadata';
