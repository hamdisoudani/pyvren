-- 008_distribution_and_syndication.sql
-- Distribution & Syndication settings + per-post syndication ledger (IndexNow, DEV.to, Bluesky, Mastodon, Hashnode)

-- 1. Distribution & Syndication controls on site_settings
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS syndication_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS syndication_delay_hours INTEGER NOT NULL DEFAULT 24 CHECK (syndication_delay_hours BETWEEN 0 AND 168),
  ADD COLUMN IF NOT EXISTS syndication_mode TEXT NOT NULL DEFAULT 'teaser' CHECK (syndication_mode IN ('teaser', 'full_canonical')),
  ADD COLUMN IF NOT EXISTS syndication_channels_json JSONB NOT NULL DEFAULT '["indexnow"]'::jsonb,
  ADD COLUMN IF NOT EXISTS devto_publish_as_draft BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Per-post syndication ledger (prevents duplicate cross-posts across channels)
CREATE TABLE IF NOT EXISTS post_syndications (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('indexnow', 'devto', 'bluesky', 'mastodon', 'hashnode')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed', 'skipped')),
  mode TEXT NOT NULL DEFAULT 'teaser' CHECK (mode IN ('teaser', 'full_canonical')),
  remote_id TEXT,
  remote_url TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  syndicated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_post_syndications_post_id
  ON post_syndications (post_id);

CREATE INDEX IF NOT EXISTS idx_post_syndications_status_updated
  ON post_syndications (status, updated_at DESC);

-- 3. Strict RLS: lock anon & authenticated completely out of post_syndications
ALTER TABLE post_syndications ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_syndications FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE post_syndications FROM anon, authenticated;
