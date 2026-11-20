-- Pyvren Autonomous Editorial Platform - Initial Supabase Schema
-- Enforces: single-admin database lock, RLS isolation for drafts/secrets,
-- category skills registry, GEO/SEO article fields, and deep quality scoring.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Single-Admin User Table (mathematically locked to 1 row via CHECK (id = 1))
CREATE TABLE IF NOT EXISTS public.admin_users (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Singleton Site Settings Table
CREATE TABLE IF NOT EXISTS public.site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  publishing_mode TEXT NOT NULL DEFAULT 'draft_review' CHECK (publishing_mode IN ('draft_review', 'auto_publish')),
  min_publish_score INTEGER NOT NULL DEFAULT 78 CHECK (min_publish_score BETWEEN 50 AND 100),
  schedule_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  runs_per_day INTEGER NOT NULL DEFAULT 3 CHECK (runs_per_day BETWEEN 1 AND 24),
  openrouter_model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  judge_model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  default_topic_feed TEXT NOT NULL DEFAULT 'AI model releases, LLM security & prompt injection defense, cloud GPU economics, and CISA KEV engineering advisories',
  default_author TEXT NOT NULL DEFAULT 'Hamdi Soudani',
  author_bio TEXT NOT NULL DEFAULT 'Systems engineer and technical editor researching AI infrastructure, model security, and edge web performance.',
  site_name TEXT NOT NULL DEFAULT 'Pyvren Research',
  site_tagline TEXT NOT NULL DEFAULT 'Primary-source technical research on AI systems, LLM security, and cloud infrastructure.',
  base_url TEXT NOT NULL DEFAULT 'https://pyvren.com',
  adsense_client_id TEXT,
  cta_headline TEXT NOT NULL DEFAULT 'Get verified technical briefings without the noise',
  cta_body TEXT NOT NULL DEFAULT 'Every briefing cites primary benchmarks, advisories, and reproducible configurations—reviewed by engineers before publication.',
  cta_url TEXT NOT NULL DEFAULT '/about',
  contact_email TEXT NOT NULL DEFAULT 'editorial@pyvren.com',
  last_scheduled_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Per-Category Agent Skills Table
CREATE TABLE IF NOT EXISTS public.category_skills (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 50,
  target_audience TEXT NOT NULL DEFAULT 'Senior software engineers, AI practitioners, and security architects',
  system_instructions TEXT NOT NULL,
  research_feeds_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  search_queries_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_archetypes_json JSONB NOT NULL DEFAULT '["benchmark-index","architecture-analysis"]'::jsonb,
  required_sections_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  quality_rubric_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  banned_patterns_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Posts Table (SSR + Headless + GEO/AEO + Quality Assessment)
CREATE TABLE IF NOT EXISTS public.posts (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tldr_summary TEXT NOT NULL DEFAULT '',
  key_facts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  faq_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  body_markdown TEXT NOT NULL,
  body_html TEXT NOT NULL,
  author TEXT NOT NULL,
  category_slug TEXT NOT NULL DEFAULT 'ai-llms',
  archetype TEXT NOT NULL CHECK (archetype IN ('advisory-teardown', 'benchmark-index', 'migration-fix-log', 'architecture-analysis')),
  tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  review_notes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  lint_passed BOOLEAN NOT NULL DEFAULT FALSE,
  lint_errors_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  quality_score INTEGER NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100),
  quality_breakdown_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  reading_time_minutes INTEGER NOT NULL DEFAULT 4,
  word_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_status_published_at ON public.posts (status, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_posts_category_status ON public.posts (category_slug, status, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON public.posts (slug);

-- 5. Agent Runs & Full Source Audit Trace Table
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id BIGSERIAL PRIMARY KEY,
  workflow_instance_id TEXT,
  trigger_source TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_source IN ('manual', 'scheduled', 'api')),
  category_slug TEXT NOT NULL DEFAULT 'auto',
  topic TEXT NOT NULL,
  archetype TEXT NOT NULL DEFAULT 'auto',
  model_used TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  current_stage TEXT NOT NULL DEFAULT 'initializing',
  trace_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  quality_score INTEGER,
  post_id BIGINT REFERENCES public.posts(id) ON DELETE SET NULL,
  token_usage_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_created_at ON public.agent_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON public.agent_runs (status);

-- Seed Singleton Site Settings (Idempotent)
INSERT INTO public.site_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Seed High-Intent Category Skills (Idempotent)
INSERT INTO public.category_skills (
  slug, name, description, enabled, priority, target_audience,
  system_instructions, research_feeds_json, search_queries_json,
  preferred_archetypes_json, required_sections_json, quality_rubric_json
) VALUES
(
  'ai-llms',
  'AI Models & LLM Engineering',
  'Deep technical teardowns of frontier and open-weights LLMs, inference engines, quantization, context scaling, and real cost/latency benchmarks.',
  TRUE, 100,
  'AI engineers, ML infra teams, and developers selecting production LLM stacks',
  'Focus on measurable metrics: tokens/sec, TTFT, context window retention, API $/1M token pricing, KV-cache memory math, and reproducible evaluation harnesses. Compare against at least 2 competing models in a Markdown table. Avoid hype adjectives.',
  '["hn_top_infra", "arxiv_ai", "huggingface_trending"]'::jsonb,
  '["open weights LLM benchmark inference latency cost comparison", "vLLM SGLang llama.cpp quantization throughput benchmark", "OpenRouter new frontier model API pricing context window"]'::jsonb,
  '["benchmark-index", "architecture-analysis"]'::jsonb,
  '["Direct Answer & TL;DR", "Quantitative Comparison Table", "Production Tradeoffs & Failure Modes", "Reproducible Configuration / Code"]'::jsonb,
  '{"min_primary_sources": 3, "require_table_or_code": true, "min_words": 650, "geo_faq_count": 3}'::jsonb
),
(
  'ai-security-jailbreaks',
  'AI Security & Jailbreak Defense',
  'Defensive research on LLM prompt injection, jailbreak taxonomies, red-teaming benchmarks, OWASP LLM Top 10, guardrails, and sandboxed agent architectures.',
  TRUE, 95,
  'Security engineers, AI safety researchers, and teams deploying tool-calling agents',
  'Write strictly from a defensive engineering and security research perspective. Analyze attack classes (indirect prompt injection, multi-turn jailbreak drift, tool-call smuggling, system prompt extraction) using peer-reviewed papers, OWASP LLM Top 10, NIST AI RMF, and public advisories. NEVER publish copy-paste exploit payloads designed to bypass safety controls for harm; instead show detection rules, architectural isolation patterns, guardrail latency benchmarks, and mitigation code.',
  '["arxiv_ai_sec", "github_advisories", "cisa_kev"]'::jsonb,
  '["LLM prompt injection defense benchmark guardrail evaluation", "OWASP LLM Top 10 agent tool-calling security mitigation", "jailbreak red teaming taxonomy defense arxiv paper"]'::jsonb,
  '["advisory-teardown", "architecture-analysis"]'::jsonb,
  '["Threat Model & Mechanism", "Observed Failure Vectors (Defensive Analysis)", "Guardrail & Mitigation Architecture", "Verification & Hardening Checklist"]'::jsonb,
  '{"min_primary_sources": 3, "require_table_or_code": true, "min_words": 650, "geo_faq_count": 3}'::jsonb
),
(
  'cloud-gpu-infra',
  'Cloud, Edge & GPU Infrastructure',
  'Serverless edge runtimes, Cloudflare Workers economics, spot GPU cluster pricing, Postgres scaling, and latency architecture studies.',
  TRUE, 85,
  'Platform engineers, SREs, and CTOs optimizing cloud spend and edge latency',
  'Ground every architectural claim in documented vendor limits, concrete pricing tables, cold-start numbers, and real deployment configs (wrangler.jsonc, SQL, Terraform, or CLI commands). Highlight hidden billing traps and migration tradeoffs.',
  '["hn_top_infra", "github_advisories"]'::jsonb,
  '["Cloudflare Workers Workflows limits latency benchmark", "cloud GPU spot pricing H100 B200 hourly comparison", "serverless Postgres connection pooling cold start latency"]'::jsonb,
  '["benchmark-index", "migration-fix-log"]'::jsonb,
  '["Runtime & Cost Breakdown Table", "Bottleneck Analysis", "Production Configuration", "When NOT to Use This Stack"]'::jsonb,
  '{"min_primary_sources": 3, "require_table_or_code": true, "min_words": 600, "geo_faq_count": 3}'::jsonb
),
(
  'dev-tooling-benchmarks',
  'Security Advisories & Dev Tooling',
  'High-urgency CVE teardowns, CISA KEV patch logs, framework migration postmortems, and runtime performance comparisons.',
  TRUE, 80,
  'Full-stack developers, DevSecOps teams, and engineering leads',
  'Lead with exact affected versions, fixed versions, CVSS/KEV status, and a copy-paste remediation diff or command. Verify every package version and advisory URL from primary vendor disclosures before writing.',
  '["cisa_kev", "github_advisories", "hn_top_infra"]'::jsonb,
  '["CISA KEV newly added web cloud vulnerability remediation", "GitHub Security Advisory critical npm python patch analysis"]'::jsonb,
  '["advisory-teardown", "migration-fix-log"]'::jsonb,
  '["Affected Versions & Blast Radius Table", "Root Cause Analysis", "Exact Patch & Verification Commands", "Detection & Regression Guard"]'::jsonb,
  '{"min_primary_sources": 3, "require_table_or_code": true, "min_words": 550, "geo_faq_count": 3}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Enable Row Level Security (RLS) on ALL tables
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

-- Public read-only RLS policies (drafts, admin_users, site_settings, agent_runs stay strictly private)
DROP POLICY IF EXISTS "public_read_published_posts" ON public.posts;
CREATE POLICY "public_read_published_posts"
  ON public.posts
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "public_read_enabled_skills" ON public.category_skills;
CREATE POLICY "public_read_enabled_skills"
  ON public.category_skills
  FOR SELECT
  TO anon, authenticated
  USING (enabled = TRUE);
