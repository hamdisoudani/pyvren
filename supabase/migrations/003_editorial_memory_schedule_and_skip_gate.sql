-- Migration 003: Recommended Editorial Schedule Windows, Newsworthiness/Novelty Gate,
-- Post Deduplication Memory, and 'skipped' Agent Run Status.

-- 1. Add recommended schedule windows, daily post cap, and novelty threshold to site_settings
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS preferred_hours_utc_json JSONB NOT NULL DEFAULT '[8, 14, 20]'::jsonb,
  ADD COLUMN IF NOT EXISTS max_posts_per_day INTEGER NOT NULL DEFAULT 2 CHECK (max_posts_per_day BETWEEN 1 AND 24),
  ADD COLUMN IF NOT EXISTS min_novelty_score INTEGER NOT NULL DEFAULT 68 CHECK (min_novelty_score BETWEEN 0 AND 100);

UPDATE public.site_settings
SET
  runs_per_day = COALESCE(runs_per_day, 3),
  preferred_hours_utc_json = COALESCE(preferred_hours_utc_json, '[8, 14, 20]'::jsonb),
  max_posts_per_day = COALESCE(max_posts_per_day, 2),
  min_novelty_score = COALESCE(min_novelty_score, 68),
  updated_at = NOW()
WHERE id = 1;

-- 2. Allow 'skipped' status and decision_reason on agent_runs (when there is no worthy news or topic was already covered)
ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS decision_reason TEXT;

DO $$
DECLARE
  con_name TEXT;
BEGIN
  FOR con_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'agent_runs'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.agent_runs DROP CONSTRAINT IF EXISTS %I', con_name);
  END LOOP;
END $$;

ALTER TABLE public.agent_runs
  ADD CONSTRAINT agent_runs_status_check
  CHECK (status IN ('queued', 'running', 'completed', 'skipped', 'failed'));

-- 3. Upgrade category_skills research_feeds_json to use category-specialized live news & trending collectors
UPDATE public.category_skills
SET
  research_feeds_json = '["github_trending_ai_agents", "hn_ai_coding", "arxiv_ai"]'::jsonb,
  updated_at = NOW()
WHERE slug = 'ai-coding-agents-mcp';

UPDATE public.category_skills
SET
  research_feeds_json = '["arxiv_ai_sec", "github_advisories_ai", "hn_ai_security", "cisa_kev"]'::jsonb,
  updated_at = NOW()
WHERE slug = 'ai-security-jailbreaks';

UPDATE public.category_skills
SET
  research_feeds_json = '["openrouter_newest_models", "huggingface_trending", "github_llm_releases", "arxiv_ai"]'::jsonb,
  updated_at = NOW()
WHERE slug = 'ai-llms';

UPDATE public.category_skills
SET
  research_feeds_json = '["cloudflare_changelog_rss", "hn_cloud_gpu", "hn_top_infra"]'::jsonb,
  updated_at = NOW()
WHERE slug = 'cloud-gpu-infra';

UPDATE public.category_skills
SET
  research_feeds_json = '["github_trending_web_agents", "arxiv_ir_rag", "hn_top_infra"]'::jsonb,
  updated_at = NOW()
WHERE slug = 'agentic-browser-web-data';

UPDATE public.category_skills
SET
  research_feeds_json = '["cisa_kev", "github_advisories", "hn_top_infra"]'::jsonb,
  updated_at = NOW()
WHERE slug = 'dev-tooling-benchmarks';
