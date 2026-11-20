-- Migration 002: OpenRouter Free-Models-Only Mode, Post Keywords & Admin-Only Lock,
-- and SOTA 2026 Trending Category Skills (6 tracks).

-- 1. Enforce OpenRouter free-models-only governance on site_settings
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS free_models_only BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.site_settings
SET
  free_models_only = TRUE,
  openrouter_model = CASE
    WHEN openrouter_model LIKE '%:free' OR openrouter_model = 'openrouter/free' THEN openrouter_model
    ELSE 'google/gemma-4-31b-it:free'
  END,
  judge_model = CASE
    WHEN judge_model LIKE '%:free' OR judge_model = 'openrouter/free' THEN judge_model
    ELSE 'openrouter/free'
  END,
  default_topic_feed = 'CLI coding agents & MCP, LLM security & prompt injection defense, open-weights & local SLMs, Cloudflare Workers & GPU economics, CISA KEV advisories, and live web-data browser agents',
  updated_at = NOW()
WHERE id = 1;

-- 2. Add explicit keywords_json and admin-only edit tracking on posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS keywords_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS admin_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_edited_by TEXT;

-- Explicitly revoke any public/anon write privileges on posts (defense-in-depth alongside RLS)
REVOKE INSERT, UPDATE, DELETE ON public.posts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.site_settings FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.category_skills FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.admin_users FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.agent_runs FROM anon, authenticated;

-- 3. Upsert all 6 SOTA Late-2026 High-Demand Category Skills
INSERT INTO public.category_skills (
  slug, name, description, enabled, priority, target_audience,
  system_instructions, research_feeds_json, search_queries_json,
  preferred_archetypes_json, required_sections_json, quality_rubric_json, banned_patterns_json
) VALUES
(
  'ai-coding-agents-mcp',
  'CLI Coding Agents, MCP & Multi-Agent Harnesses',
  'Field-tested engineering analysis of terminal coding agents, MCP vs CLI token economics, A2A coordination protocols, agent harnesses, and verifiable coding benchmarks.',
  TRUE, 100,
  'Staff software engineers, developer-platform leads, and teams adopting autonomous coding workflows',
  'Write like a staff engineer who actually runs terminal agents and MCP servers in CI. Ground claims in concrete numbers: SWE-bench Pro / Terminal-Bench 2.0 pass rates, exact token overhead (CLI vs MCP schema loading), exit-code feedback loops, OAuth/multi-tenant boundaries, and real config snippets (JSON/TOML/CLI). Always include an explicit "When NOT to use this" engineering tradeoff section. Mix short 6-10 word verdicts with deeper architectural explanations. Never use filler transitions like Furthermore/Moreover/Additionally or walls of bold-colon bullets.',
  '["hn_top_infra", "github_advisories", "arxiv_ai"]'::jsonb,
  '["CLI coding agents vs IDE Terminal-Bench SWE-bench Pro 2026 benchmark", "MCP Model Context Protocol token overhead security OAuth production", "multi-agent harness A2A protocol orchestration production architecture"]'::jsonb,
  '["benchmark-index", "architecture-analysis"]'::jsonb,
  '["Direct Engineering Verdict", "Token, Latency & Accuracy Comparison Table", "Failure Modes & Context Pollution", "Minimal Reproducible Config / Harness Snippet", "When NOT to Adopt This Pattern"]'::jsonb,
  '{"min_primary_sources": 3, "require_table_or_code": true, "min_words": 700, "geo_faq_count": 3, "require_concrete_metrics": true}'::jsonb,
  '["vibe coding revolution", "replaces all developers", "magic bullet", "seamless integration"]'::jsonb
),
(
  'ai-security-jailbreaks',
  'AI Security, Prompt Injection & Jailbreak Defense',
  'Defensive engineering teardowns of indirect prompt injection, tool-result smuggling, unauthenticated MCP exposure, red-team benchmarks, OWASP LLM Top 10, and sandboxed agent isolation.',
  TRUE, 98,
  'Application security engineers, AI red-teamers, CISOs, and developers shipping tool-calling agents',
  'Write strictly from a defensive security engineering perspective (100% AdSense and safety compliant). Analyze real failure mechanics—indirect prompt injection via fetched web/tool outputs, multi-turn guardrail drift, unauthenticated MCP servers, data exfiltration channels, and privilege escalation in autonomous agents—citing OWASP LLM Top 10, NIST AI RMF, Anthropic/Google threat intelligence, and arXiv security papers. NEVER publish weaponized exploit strings or bypass recipes. Always deliver: (1) an explicit threat model table mapping attack surface -> blast radius -> concrete control, (2) runnable defensive code/policy/sandbox config, and (3) latency/false-positive overhead numbers for guardrails.',
  '["arxiv_ai_sec", "github_advisories", "cisa_kev"]'::jsonb,
  '["OWASP LLM Top 10 indirect prompt injection tool calling defense", "MCP server authentication vulnerability security audit mitigation", "AI agent sandbox isolation guardrail latency benchmark arxiv"]'::jsonb,
  '["advisory-teardown", "architecture-analysis"]'::jsonb,
  '["Threat Model & Attack Surface Matrix", "Why Naive Prompt Filters Fail", "Defense-in-Depth & Sandbox Isolation Architecture", "Runnable Guardrail Policy / Verification Code", "Operational Tradeoffs & False-Positive Budget"]'::jsonb,
  '{"min_primary_sources": 3, "require_table_or_code": true, "min_words": 700, "geo_faq_count": 3, "defensive_only": true}'::jsonb,
  '["unbreakable security", "100% immune", "silver bullet", "stay ahead of bad actors"]'::jsonb
),
(
  'ai-llms',
  'Frontier LLMs, Local SLMs & Context Engineering',
  'Quantitative benchmarks of frontier & open-weights LLMs, 1B-32B Small Language Models, context rot / lost-in-the-middle mitigation, Recursive Language Models, and inference engines.',
  TRUE, 94,
  'ML infrastructure engineers, AI architects, and cost-conscious product teams',
  'Lead with hard numbers: tokens/second, TTFT, $/1M input & output tokens, VRAM footprint at FP8/Q4_K_M, effective context accuracy before context rot (~32K+ tokens), and real latency tradeoffs across vLLM, SGLang, llama.cpp, or OpenRouter routing. Compare at least 3 models or runtimes in a crisp Markdown table. Explain exact failure modes (context poisoning, distraction, KV-cache OOM) rather than repeating vendor press releases. Vary sentence length naturally like a real benchmark engineer.',
  '["huggingface_trending", "arxiv_ai", "hn_top_infra"]'::jsonb,
  '["open weights local LLM coding benchmark quantization VRAM tokens per second", "context engineering context rot long context benchmark LLM", "small language models SLM vs frontier LLM latency cost enterprise"]'::jsonb,
  '["benchmark-index", "architecture-analysis"]'::jsonb,
  '["Benchmark Verdict & Cost Math", "Model / Runtime Quantitative Comparison Table", "Context Window & Memory Bottlenecks", "Reproducible Inference / Routing Config", "Selection Rubric by Workload"]'::jsonb,
  '{"min_primary_sources": 3, "require_table_or_code": true, "min_words": 700, "geo_faq_count": 3, "require_concrete_metrics": true}'::jsonb,
  '["unprecedented capabilities", "redefines artificial intelligence", "next-generation powerhouse"]'::jsonb
),
(
  'cloud-gpu-infra',
  'Cloudflare Edge, Sovereign AI & GPU Economics',
  'Production architecture studies on Cloudflare Workers & Workflows limits, serverless Postgres scaling, spot H100/B200 GPU economics, and sovereign AI residency deployments.',
  TRUE, 88,
  'Platform engineers, SREs, staff backend engineers, and FinOps architects',
  'Anchor every paragraph in verified platform limits, cold-start milliseconds, egress math, and hourly $/GPU or $/million-request pricing tables. Include real copy-pasteable configs (`wrangler.jsonc`, SQL RLS/indexes, Terraform, or curl benchmarks). Explicitly expose hidden billing traps (idle compute wakeups, egress fees, per-step workflow retries, connection pool exhaustion) and state exact thresholds where containers or bare-metal beat serverless.',
  '["hn_top_infra", "github_advisories"]'::jsonb,
  '["Cloudflare Workers Workflows CPU limits durable execution pricing benchmark", "cloud GPU H100 B200 hourly spot pricing comparison 2026", "Supabase PostgREST vs Neon Postgres serverless cold start pooling"]'::jsonb,
  '["benchmark-index", "migration-fix-log"]'::jsonb,
  '["Cost & Platform Limits Table", "Measured Bottlenecks & Hidden Billing Traps", "Production Configuration Snippet", "Migration Checklist & Break-Even Thresholds"]'::jsonb,
  '{"min_primary_sources": 3, "require_table_or_code": true, "min_words": 650, "geo_faq_count": 3}'::jsonb,
  '["infinite scalability", "zero effort deployment", "future-proof cloud"]'::jsonb
),
(
  'agentic-browser-web-data',
  'Live Web Data, Browser Agents & GEO Retrieval',
  'Technical evaluations of web-grounding pipelines for AI agents, headless browser automation, clean Markdown extraction (Jina/Firecrawl/Playwright), and Generative Engine Optimization (llms.txt).',
  TRUE, 84,
  'AI search engineers, data pipeline architects, and technical SEO/GEO leads',
  'Focus on measurable retrieval quality: extraction fidelity on tables and code blocks, token savings vs raw HTML, anti-bot / SSRF boundaries, latency per URL, and how ChatGPT Search, Gemini, and Perplexity parse structured JSON-LD, Markdown mirrors, and llms.txt. Provide real curl/TypeScript/Python snippets and comparative extraction tables. Avoid marketing fluff or SEO folklore without primary documentation.',
  '["hn_top_infra", "arxiv_ai"]'::jsonb,
  '["AI agent live web data retrieval benchmark Firecrawl Jina Playwright", "llms.txt structured data GEO AI search citation study 2026", "browser automation AI agents reliability benchmark failure modes"]'::jsonb,
  '["benchmark-index", "architecture-analysis"]'::jsonb,
  '["Retrieval & Token Efficiency Table", "Where HTML Extraction & Browser Agents Break", "SSRF-Safe Pipeline Implementation", "GEO & Citation Verification Checklist"]'::jsonb,
  '{"min_primary_sources": 3, "require_table_or_code": true, "min_words": 650, "geo_faq_count": 3}'::jsonb,
  '["skyrocket your rankings", "secret hack", "dominate search overnight"]'::jsonb
),
(
  'dev-tooling-benchmarks',
  'Critical CVEs, CISA KEV & Supply-Chain Patch Logs',
  'Rapid-response technical teardowns of newly exploited CISA KEV vulnerabilities, critical GitHub Security Advisories, npm/PyPI supply-chain attacks, and zero-downtime upgrade logs.',
  TRUE, 82,
  'DevSecOps engineers, incident responders, and backend maintainers',
  'Lead immediately with the blast-radius summary: exact CVE ID, CVSS score, CISA KEV due date, affected version ranges, and fixed version. Never pad the opening with generic security platitudes ("cybersecurity is more important than ever"). Provide the exact root-cause mechanism from the primary advisory/commit, copy-paste upgrade & lockfile verification commands, and a concrete regression test or CI check.',
  '["cisa_kev", "github_advisories", "hn_top_infra"]'::jsonb,
  '["CISA KEV newly added exploited vulnerability remediation 2026", "GitHub Security Advisory critical npm python rust vulnerability patch"]'::jsonb,
  '["advisory-teardown", "migration-fix-log"]'::jsonb,
  '["Affected Versions & Remediation Matrix", "Technical Root Cause (Primary Advisory)", "Exact Upgrade & Verification Commands", "CI Detection & Regression Guard"]'::jsonb,
  '{"min_primary_sources": 3, "require_table_or_code": true, "min_words": 600, "geo_faq_count": 3}'::jsonb,
  '["cybersecurity is more important than ever", "stay vigilant", "bad actors are always evolving"]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled,
  priority = EXCLUDED.priority,
  target_audience = EXCLUDED.target_audience,
  system_instructions = EXCLUDED.system_instructions,
  research_feeds_json = EXCLUDED.research_feeds_json,
  search_queries_json = EXCLUDED.search_queries_json,
  preferred_archetypes_json = EXCLUDED.preferred_archetypes_json,
  required_sections_json = EXCLUDED.required_sections_json,
  quality_rubric_json = EXCLUDED.quality_rubric_json,
  banned_patterns_json = EXCLUDED.banned_patterns_json,
  updated_at = NOW();
