-- Migration 007: Upgrade Pyvren editorial coverage to 7 trending beats + live feeds
-- Adds Category #7 (generative-media-comfyui: ComfyUI workflows, AI video & open media models),
-- upgrades ai-llms with openrouter_free_models & hn_ai_benchmarks, and upgrades
-- dev-tooling-benchmarks with real-world breach feeds (bleepingcomputer_rss, thehackernews_rss).

UPDATE public.category_skills
SET
  research_feeds_json = '["openrouter_free_models","openrouter_newest_models","huggingface_trending","github_llm_releases","hn_ai_benchmarks"]'::jsonb,
  search_queries_json = '["new LLM model release OpenRouter free model benchmark tokens per second","open weights local LLM coding benchmark quantization VRAM context rot","frontier LLM leaderboard ARC-AGI SWE-bench GPQA cost comparison"]'::jsonb,
  updated_at = now()
WHERE slug = 'ai-llms';

UPDATE public.category_skills
SET
  name = 'Cyber Breaches, Zero-Days & CISA KEV Patch Logs',
  description = 'Rapid-response technical teardowns of major cybersecurity breaches, newly exploited CISA KEV zero-days, critical GitHub Security Advisories, supply-chain attacks, and defensive remediation logs.',
  priority = 90,
  target_audience = 'DevSecOps engineers, incident responders, CISOs, and backend maintainers',
  system_instructions = 'Lead immediately with verified incident facts and blast radius: affected organizations/systems, CVE IDs, CVSS scores, CISA KEV due dates, initial access vector, affected version ranges, and confirmed fixes. Keep framing strictly defensive and AdSense-safe (never publish working exploit payloads or attack instructions). Provide the technical root cause from primary advisories/incident reports, a clear affected-systems & remediation Markdown table, and exact defensive upgrade/detection commands.',
  research_feeds_json = '["bleepingcomputer_rss","thehackernews_rss","cisa_kev","github_advisories"]'::jsonb,
  search_queries_json = '["major cybersecurity breach incident technical root cause remediation 2026","CISA KEV newly added zero-day exploited vulnerability patch guidance","GitHub Security Advisory critical npm python supply-chain attack fix"]'::jsonb,
  required_sections_json = '["Incident Timeline & Blast-Radius Table","Technical Root Cause & Attack Vector (Defensive Analysis)","Exact Patch, Upgrade & Verification Commands","Detection Rules & Hardening Checklist"]'::jsonb,
  updated_at = now()
WHERE slug = 'dev-tooling-benchmarks';

INSERT INTO public.category_skills (
  slug,
  name,
  description,
  enabled,
  priority,
  target_audience,
  system_instructions,
  research_feeds_json,
  search_queries_json,
  preferred_archetypes_json,
  required_sections_json,
  quality_rubric_json,
  banned_patterns_json
)
VALUES (
  'generative-media-comfyui',
  'ComfyUI Workflows, AI Video & Open Media Models',
  'Hands-on engineering guides to ComfyUI custom nodes & production graphs, newly dropped open and frontier AI video/image/audio models (Wan, Flux, LTX-Video, Kling, Veo), VRAM quantization, and workflow best practices.',
  true,
  92,
  'Creative technologists, generative media engineers, ComfyUI builders, and AI video teams',
  'Write like an engineer running local & cloud ComfyUI graphs on real GPUs. Lead with concrete specs: model architecture, parameter count, resolution/FPS limits, VRAM footprint at FP16/FP8/GGUF Q4, seconds-per-clip on RTX 4090/5090/H100, and exact ComfyUI node wiring or JSON workflow parameters (sampler, scheduler, CFG, TeaCache/SageAttention flags). Always include a Markdown comparison table across competing video/image models or node setups, reference grounded visual samples from crawled model cards when available, and include a candid "Failure Modes & VRAM Traps" section.',
  '["comfyui_releases","github_trending_comfyui_video","huggingface_trending_media","hn_ai_video_media"]'::jsonb,
  '["ComfyUI custom nodes workflow best practices FP8 GGUF VRAM benchmark 2026","new open source AI video model release Wan LTX-Video HunyuanVideo benchmark","Flux Qwen-Image Veo Kling Sora video generation quality latency comparison"]'::jsonb,
  '["benchmark-index","architecture-analysis"]'::jsonb,
  '["Model & Workflow Verdict","VRAM, Speed & Quality Comparison Table","ComfyUI Node Graph & Reproducible Settings","Failure Modes, Artifacts & VRAM Optimization","Best-Practice Production Checklist"]'::jsonb,
  '{"min_primary_sources":3,"require_table_or_code":true,"min_words":700,"geo_faq_count":3,"require_concrete_metrics":true}'::jsonb,
  '["hollywood is dead","stunning visuals with one click","unleash your creativity","magic prompt"]'::jsonb
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
  updated_at = now();
