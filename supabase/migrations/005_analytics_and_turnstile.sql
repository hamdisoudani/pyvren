-- 005_analytics_and_turnstile.sql
-- Add Google Analytics 4 (GA4) Measurement ID to site_settings for public visitor tracking.
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS ga_measurement_id TEXT;
