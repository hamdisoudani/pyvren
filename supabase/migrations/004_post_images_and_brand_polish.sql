-- =============================================================================
-- 004_post_images_and_brand_polish.sql
-- Adds primary-source reference image columns to posts and updates default
-- publication identity to "The Pyvren Dispatch" (human + Pyvren co-craft).
-- =============================================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_alt TEXT,
  ADD COLUMN IF NOT EXISTS images_json JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.site_settings
SET
  site_name = 'The Pyvren Dispatch',
  site_tagline = 'Field notes, benchmarks, and deep dives into AI systems, security, and cloud craft — co-crafted by Hamdi Soudani & Pyvren.',
  author_bio = 'Systems engineer & technical writer exploring AI infrastructure, security, and edge craft in daily collaboration with Pyvren.',
  cta_headline = 'Honest engineering stories — co-crafted with primary benchmarks & real code',
  cta_body = 'Every dispatch blends hands-on engineering judgment with verified primary sources, reproducible configs, and clear tradeoffs.',
  cta_url = '/about',
  updated_at = NOW()
WHERE id = 1;
