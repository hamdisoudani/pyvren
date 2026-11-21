import type { WorkerEnv } from '../env';
import type {
  AdminUser,
  AgentRunRecord,
  AgentRunStatus,
  Archetype,
  CategorySkill,
  DatabaseAdapter,
  IpBlock,
  PostCreateRecord,
  PostImage,
  PostMutationContext,
  PostRecord,
  PostStatus,
  QualityBreakdown,
  SecurityAuditLog,
  SecurityEventType,
  SiteSettings,
  TriggerSource,
} from '../types';
import { slugify } from './security';

const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

export const DEFAULT_SEEDED_SETTINGS: SiteSettings = {
  id: 1,
  publishing_mode: 'draft_review',
  min_publish_score: 78,
  free_models_only: true,
  schedule_enabled: false,
  runs_per_day: 3,
  preferred_hours_utc_json: [8, 14, 20],
  max_posts_per_day: 2,
  min_novelty_score: 68,
  openrouter_model: 'openrouter/free',
  fallback_model_1: 'google/gemma-4-31b-it:free',
  fallback_model_2: 'nvidia/nemotron-3.5-super-vl:free',
  judge_model: 'openrouter/free',
  default_topic_feed:
    'CLI coding agents & MCP, LLM security & prompt injection defense, open-weights & local SLMs, Cloudflare Workers & GPU economics, CISA KEV advisories, and live web-data browser agents',
  default_author: 'Hamdi Soudani',
  author_bio:
    'Systems engineer & technical writer exploring AI infrastructure, security, and edge craft in daily collaboration with Pyvren.',
  site_name: 'The Pyvren Dispatch',
  site_tagline:
    'Field notes, benchmarks, and deep dives into AI systems, security, and cloud craft — co-crafted by Hamdi Soudani & Pyvren.',
  base_url: 'https://pyvren.com',
  adsense_client_id: null,
  ga_measurement_id: null,
  cta_headline: 'Honest engineering stories — co-crafted with primary benchmarks & real code',
  cta_body:
    'Every dispatch blends hands-on engineering judgment with verified primary sources, reproducible configs, and clear tradeoffs.',
  cta_url: '/about',
  contact_email: 'editorial@pyvren.com',
  last_scheduled_run_at: null,
  updated_at: SEED_TIMESTAMP,
};

export const DEFAULT_SEEDED_SKILLS: CategorySkill[] = [
  {
    id: 1,
    slug: 'ai-coding-agents-mcp',
    name: 'CLI Coding Agents, MCP & Multi-Agent Harnesses',
    description:
      'Field-tested engineering analysis of terminal coding agents, MCP vs CLI token economics, A2A coordination protocols, agent harnesses, and verifiable coding benchmarks.',
    enabled: true,
    priority: 100,
    target_audience:
      'Staff software engineers, developer-platform leads, and teams adopting autonomous coding workflows',
    system_instructions:
      'Write like a staff engineer who actually runs terminal agents and MCP servers in CI. Ground claims in concrete numbers: SWE-bench Pro / Terminal-Bench 2.0 pass rates, exact token overhead (CLI vs MCP schema loading), exit-code feedback loops, OAuth/multi-tenant boundaries, and real config snippets (JSON/TOML/CLI). Always include an explicit "When NOT to use this" engineering tradeoff section. Mix short 6-10 word verdicts with deeper architectural explanations. Never use filler transitions like Furthermore/Moreover/Additionally or walls of bold-colon bullets.',
    research_feeds_json: ['github_trending_ai_agents', 'hn_ai_coding', 'arxiv_ai'],
    search_queries_json: [
      'CLI coding agents vs IDE Terminal-Bench SWE-bench Pro 2026 benchmark',
      'MCP Model Context Protocol token overhead security OAuth production',
      'multi-agent harness A2A protocol orchestration production architecture',
    ],
    preferred_archetypes_json: ['benchmark-index', 'architecture-analysis'],
    required_sections_json: [
      'Direct Engineering Verdict',
      'Token, Latency & Accuracy Comparison Table',
      'Failure Modes & Context Pollution',
      'Minimal Reproducible Config / Harness Snippet',
      'When NOT to Adopt This Pattern',
    ],
    quality_rubric_json: {
      min_primary_sources: 3,
      require_table_or_code: true,
      min_words: 700,
      geo_faq_count: 3,
      require_concrete_metrics: true,
    },
    banned_patterns_json: [
      'vibe coding revolution',
      'replaces all developers',
      'magic bullet',
      'seamless integration',
    ],
    created_at: SEED_TIMESTAMP,
    updated_at: SEED_TIMESTAMP,
  },
  {
    id: 2,
    slug: 'ai-security-jailbreaks',
    name: 'AI Security, Prompt Injection & Jailbreak Defense',
    description:
      'Defensive engineering teardowns of indirect prompt injection, tool-result smuggling, unauthenticated MCP exposure, red-team benchmarks, OWASP LLM Top 10, and sandboxed agent isolation.',
    enabled: true,
    priority: 98,
    target_audience:
      'Application security engineers, AI red-teamers, CISOs, and developers shipping tool-calling agents',
    system_instructions:
      'Write strictly from a defensive security engineering perspective (100% AdSense and safety compliant). Analyze real failure mechanics—indirect prompt injection via fetched web/tool outputs, multi-turn guardrail drift, unauthenticated MCP servers, data exfiltration channels, and privilege escalation in autonomous agents—citing OWASP LLM Top 10, NIST AI RMF, Anthropic/Google threat intelligence, and arXiv security papers. NEVER publish weaponized exploit strings or bypass recipes. Always deliver: (1) an explicit threat model table mapping attack surface -> blast radius -> concrete control, (2) runnable defensive code/policy/sandbox config, and (3) latency/false-positive overhead numbers for guardrails.',
    research_feeds_json: ['arxiv_ai_sec', 'github_advisories_ai', 'hn_ai_security', 'cisa_kev'],
    search_queries_json: [
      'OWASP LLM Top 10 indirect prompt injection tool calling defense',
      'MCP server authentication vulnerability security audit mitigation',
      'AI agent sandbox isolation guardrail latency benchmark arxiv',
    ],
    preferred_archetypes_json: ['advisory-teardown', 'architecture-analysis'],
    required_sections_json: [
      'Threat Model & Attack Surface Matrix',
      'Why Naive Prompt Filters Fail',
      'Defense-in-Depth & Sandbox Isolation Architecture',
      'Runnable Guardrail Policy / Verification Code',
      'Operational Tradeoffs & False-Positive Budget',
    ],
    quality_rubric_json: {
      min_primary_sources: 3,
      require_table_or_code: true,
      min_words: 700,
      geo_faq_count: 3,
      defensive_only: true,
    },
    banned_patterns_json: [
      'unbreakable security',
      '100% immune',
      'silver bullet',
      'stay ahead of bad actors',
    ],
    created_at: SEED_TIMESTAMP,
    updated_at: SEED_TIMESTAMP,
  },
  {
    id: 3,
    slug: 'ai-llms',
    name: 'Frontier LLMs, Local SLMs & Context Engineering',
    description:
      'Quantitative benchmarks of frontier & open-weights LLMs, 1B-32B Small Language Models, context rot / lost-in-the-middle mitigation, Recursive Language Models, and inference engines.',
    enabled: true,
    priority: 94,
    target_audience: 'ML infrastructure engineers, AI architects, and cost-conscious product teams',
    system_instructions:
      'Lead with hard numbers: tokens/second, TTFT, $/1M input & output tokens, VRAM footprint at FP8/Q4_K_M, effective context accuracy before context rot (~32K+ tokens), and real latency tradeoffs across vLLM, SGLang, llama.cpp, or OpenRouter routing. Compare at least 3 models or runtimes in a crisp Markdown table. Explain exact failure modes (context poisoning, distraction, KV-cache OOM) rather than repeating vendor press releases. Vary sentence length naturally like a real benchmark engineer.',
    research_feeds_json: [
      'openrouter_newest_models',
      'huggingface_trending',
      'github_llm_releases',
      'arxiv_ai',
    ],
    search_queries_json: [
      'open weights local LLM coding benchmark quantization VRAM tokens per second',
      'context engineering context rot long context benchmark LLM',
      'small language models SLM vs frontier LLM latency cost enterprise',
    ],
    preferred_archetypes_json: ['benchmark-index', 'architecture-analysis'],
    required_sections_json: [
      'Benchmark Verdict & Cost Math',
      'Model / Runtime Quantitative Comparison Table',
      'Context Window & Memory Bottlenecks',
      'Reproducible Inference / Routing Config',
      'Selection Rubric by Workload',
    ],
    quality_rubric_json: {
      min_primary_sources: 3,
      require_table_or_code: true,
      min_words: 700,
      geo_faq_count: 3,
      require_concrete_metrics: true,
    },
    banned_patterns_json: [
      'unprecedented capabilities',
      'redefines artificial intelligence',
      'next-generation powerhouse',
    ],
    created_at: SEED_TIMESTAMP,
    updated_at: SEED_TIMESTAMP,
  },
  {
    id: 4,
    slug: 'cloud-gpu-infra',
    name: 'Cloudflare Edge, Sovereign AI & GPU Economics',
    description:
      'Production architecture studies on Cloudflare Workers & Workflows limits, serverless Postgres scaling, spot H100/B200 GPU economics, and sovereign AI residency deployments.',
    enabled: true,
    priority: 88,
    target_audience: 'Platform engineers, SREs, staff backend engineers, and FinOps architects',
    system_instructions:
      'Anchor every paragraph in verified platform limits, cold-start milliseconds, egress math, and hourly $/GPU or $/million-request pricing tables. Include real copy-pasteable configs (`wrangler.jsonc`, SQL RLS/indexes, Terraform, or curl benchmarks). Explicitly expose hidden billing traps (idle compute wakeups, egress fees, per-step workflow retries, connection pool exhaustion) and state exact thresholds where containers or bare-metal beat serverless.',
    research_feeds_json: ['cloudflare_changelog_rss', 'hn_cloud_gpu', 'hn_top_infra'],
    search_queries_json: [
      'Cloudflare Workers Workflows CPU limits durable execution pricing benchmark',
      'cloud GPU H100 B200 hourly spot pricing comparison 2026',
      'Supabase PostgREST vs Neon Postgres serverless cold start pooling',
    ],
    preferred_archetypes_json: ['benchmark-index', 'migration-fix-log'],
    required_sections_json: [
      'Cost & Platform Limits Table',
      'Measured Bottlenecks & Hidden Billing Traps',
      'Production Configuration Snippet',
      'Migration Checklist & Break-Even Thresholds',
    ],
    quality_rubric_json: {
      min_primary_sources: 3,
      require_table_or_code: true,
      min_words: 650,
      geo_faq_count: 3,
    },
    banned_patterns_json: ['infinite scalability', 'zero effort deployment', 'future-proof cloud'],
    created_at: SEED_TIMESTAMP,
    updated_at: SEED_TIMESTAMP,
  },
  {
    id: 5,
    slug: 'agentic-browser-web-data',
    name: 'Live Web Data, Browser Agents & GEO Retrieval',
    description:
      'Technical evaluations of web-grounding pipelines for AI agents, headless browser automation, clean Markdown extraction (Jina/Firecrawl/Playwright), and Generative Engine Optimization (llms.txt).',
    enabled: true,
    priority: 84,
    target_audience: 'AI search engineers, data pipeline architects, and technical SEO/GEO leads',
    system_instructions:
      'Focus on measurable retrieval quality: extraction fidelity on tables and code blocks, token savings vs raw HTML, anti-bot / SSRF boundaries, latency per URL, and how ChatGPT Search, Gemini, and Perplexity parse structured JSON-LD, Markdown mirrors, and llms.txt. Provide real curl/TypeScript/Python snippets and comparative extraction tables. Avoid marketing fluff or SEO folklore without primary documentation.',
    research_feeds_json: ['github_trending_web_agents', 'arxiv_ir_rag', 'hn_top_infra'],
    search_queries_json: [
      'AI agent live web data retrieval benchmark Firecrawl Jina Playwright',
      'llms.txt structured data GEO AI search citation study 2026',
      'browser automation AI agents reliability benchmark failure modes',
    ],
    preferred_archetypes_json: ['benchmark-index', 'architecture-analysis'],
    required_sections_json: [
      'Retrieval & Token Efficiency Table',
      'Where HTML Extraction & Browser Agents Break',
      'SSRF-Safe Pipeline Implementation',
      'GEO & Citation Verification Checklist',
    ],
    quality_rubric_json: {
      min_primary_sources: 3,
      require_table_or_code: true,
      min_words: 650,
      geo_faq_count: 3,
    },
    banned_patterns_json: [
      'skyrocket your rankings',
      'secret hack',
      'dominate search overnight',
    ],
    created_at: SEED_TIMESTAMP,
    updated_at: SEED_TIMESTAMP,
  },
  {
    id: 6,
    slug: 'dev-tooling-benchmarks',
    name: 'Critical CVEs, CISA KEV & Supply-Chain Patch Logs',
    description:
      'Rapid-response technical teardowns of newly exploited CISA KEV vulnerabilities, critical GitHub Security Advisories, npm/PyPI supply-chain attacks, and zero-downtime upgrade logs.',
    enabled: true,
    priority: 82,
    target_audience: 'DevSecOps engineers, incident responders, and backend maintainers',
    system_instructions:
      'Lead immediately with the blast-radius summary: exact CVE ID, CVSS score, CISA KEV due date, affected version ranges, and fixed version. Never pad the opening with generic security platitudes ("cybersecurity is more important than ever"). Provide the exact root-cause mechanism from the primary advisory/commit, copy-paste upgrade & lockfile verification commands, and a concrete regression test or CI check.',
    research_feeds_json: ['cisa_kev', 'github_advisories', 'hn_top_infra'],
    search_queries_json: [
      'CISA KEV newly added exploited vulnerability remediation 2026',
      'GitHub Security Advisory critical npm python rust vulnerability patch',
    ],
    preferred_archetypes_json: ['advisory-teardown', 'migration-fix-log'],
    required_sections_json: [
      'Affected Versions & Remediation Matrix',
      'Technical Root Cause (Primary Advisory)',
      'Exact Upgrade & Verification Commands',
      'CI Detection & Regression Guard',
    ],
    quality_rubric_json: {
      min_primary_sources: 3,
      require_table_or_code: true,
      min_words: 600,
      geo_faq_count: 3,
    },
    banned_patterns_json: [
      'cybersecurity is more important than ever',
      'stay vigilant',
      'bad actors are always evolving',
    ],
    created_at: SEED_TIMESTAMP,
    updated_at: SEED_TIMESTAMP,
  },
];

export class AdminAlreadyExistsError extends Error {
  constructor(
    message = 'An administrator account already exists. Registration is permanently locked.',
  ) {
    super(message);
    this.name = 'AdminAlreadyExistsError';
  }
}

export class AdminOnlyMutationError extends Error {
  constructor(
    message = 'Only an authenticated admin can modify post title, tags, keywords, or body.',
  ) {
    super(message);
    this.name = 'AdminOnlyMutationError';
  }
}

export const ADMIN_PROTECTED_POST_FIELDS = [
  'title',
  'tags_json',
  'keywords_json',
  'body_markdown',
] as const;

function touchesAdminProtectedPostFields(patch: Partial<PostRecord>): boolean {
  return ADMIN_PROTECTED_POST_FIELDS.some((field) => patch[field] !== undefined);
}

export function assertAdminOnlyPostMutation(
  patch: Partial<PostRecord>,
  ctx?: PostMutationContext,
): void {
  if (touchesAdminProtectedPostFields(patch) && ctx?.actor !== 'admin') {
    throw new AdminOnlyMutationError(
      'Only an authenticated admin can modify post title, tags, keywords, or body.',
    );
  }
}

export async function ensureUniqueSlug(
  db: DatabaseAdapter,
  desiredSlug: string,
  excludeId?: number,
): Promise<string> {
  const maxLen = 70;
  const base = slugify(desiredSlug, maxLen) || 'untitled-post';

  if (!(await db.slugExists(base, excludeId))) {
    return base;
  }

  for (let suffix = 2; suffix <= 1000; suffix++) {
    const suffixPart = `-${suffix}`;
    const trimmedBase = base
      .slice(0, Math.max(1, maxLen - suffixPart.length))
      .replace(/-+$/g, '');
    const candidate = `${trimmedBase}${suffixPart}`;
    if (!(await db.slugExists(candidate, excludeId))) {
      return candidate;
    }
  }

  const randBytes = crypto.getRandomValues(new Uint8Array(4));
  let randHex = '';
  for (let i = 0; i < randBytes.length; i++) {
    randHex += randBytes[i].toString(16).padStart(2, '0');
  }
  const suffixPart = `-${randHex}`;
  const trimmedBase = base
    .slice(0, Math.max(1, maxLen - suffixPart.length))
    .replace(/-+$/g, '');
  return `${trimmedBase}${suffixPart}`;
}

// ---------------------------------------------------------------------------
// Row Normalization Helpers
// ---------------------------------------------------------------------------

const DEFAULT_QUALITY_BREAKDOWN: QualityBreakdown = {
  overall: 0,
  seo_structure: 0,
  geo_citation_readiness: 0,
  information_gain: 0,
  source_grounding: 0,
  anti_slop_cleanliness: 0,
  adsense_compliance: 0,
  warnings: [],
};

function normalizeAdminRow(row: AdminUser): AdminUser {
  return {
    ...row,
    id: Number(row.id),
    failed_attempts: Number(row.failed_attempts ?? 0),
    locked_until: row.locked_until ?? null,
    last_login_at: row.last_login_at ?? null,
  };
}

function normalizePreferredHoursUtc(raw: unknown): number[] {
  let candidate: unknown = raw;
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    if (!trimmed) {
      return [...DEFAULT_SEEDED_SETTINGS.preferred_hours_utc_json];
    }
    try {
      candidate = JSON.parse(trimmed);
    } catch {
      return [...DEFAULT_SEEDED_SETTINGS.preferred_hours_utc_json];
    }
  }

  if (!Array.isArray(candidate)) {
    return [...DEFAULT_SEEDED_SETTINGS.preferred_hours_utc_json];
  }

  // Preserve explicit empty array [] so interval-based scheduling remains selectable
  if (candidate.length === 0) {
    return [];
  }

  const validHours = new Set<number>();
  for (const item of candidate) {
    const num = typeof item === 'number' ? item : Number(item);
    if (Number.isInteger(num) && num >= 0 && num <= 23) {
      validHours.add(num);
    }
  }

  if (validHours.size === 0) {
    return [...DEFAULT_SEEDED_SETTINGS.preferred_hours_utc_json];
  }

  return Array.from(validHours).sort((a, b) => a - b);
}

function clampInteger(raw: unknown, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(num)));
}

function normalizeSettingsRow(row: Partial<SiteSettings>): SiteSettings {
  return {
    ...DEFAULT_SEEDED_SETTINGS,
    ...row,
    id: 1,
    min_publish_score: Number(row.min_publish_score ?? DEFAULT_SEEDED_SETTINGS.min_publish_score),
    free_models_only:
      row.free_models_only === undefined || row.free_models_only === null
        ? DEFAULT_SEEDED_SETTINGS.free_models_only
        : Boolean(row.free_models_only),
    runs_per_day: clampInteger(row.runs_per_day, DEFAULT_SEEDED_SETTINGS.runs_per_day, 1, 24),
    preferred_hours_utc_json: normalizePreferredHoursUtc(row.preferred_hours_utc_json),
    max_posts_per_day: clampInteger(
      row.max_posts_per_day,
      DEFAULT_SEEDED_SETTINGS.max_posts_per_day,
      1,
      24,
    ),
    min_novelty_score: clampInteger(
      row.min_novelty_score,
      DEFAULT_SEEDED_SETTINGS.min_novelty_score,
      0,
      100,
    ),
    schedule_enabled: Boolean(row.schedule_enabled ?? DEFAULT_SEEDED_SETTINGS.schedule_enabled),
    fallback_model_1: row.fallback_model_1 ?? null,
    fallback_model_2: row.fallback_model_2 ?? null,
    adsense_client_id: row.adsense_client_id ?? null,
    ga_measurement_id: row.ga_measurement_id ?? null,
    last_scheduled_run_at: row.last_scheduled_run_at ?? null,
  };
}

function normalizeSkillRow(row: CategorySkill): CategorySkill {
  return {
    ...row,
    id: Number(row.id),
    enabled: Boolean(row.enabled),
    priority: Number(row.priority ?? 50),
    research_feeds_json: Array.isArray(row.research_feeds_json) ? row.research_feeds_json : [],
    search_queries_json: Array.isArray(row.search_queries_json) ? row.search_queries_json : [],
    preferred_archetypes_json: Array.isArray(row.preferred_archetypes_json)
      ? row.preferred_archetypes_json
      : (['benchmark-index', 'architecture-analysis'] as Archetype[]),
    required_sections_json: Array.isArray(row.required_sections_json)
      ? row.required_sections_json
      : [],
    quality_rubric_json:
      row.quality_rubric_json && typeof row.quality_rubric_json === 'object'
        ? row.quality_rubric_json
        : {},
    banned_patterns_json: Array.isArray(row.banned_patterns_json) ? row.banned_patterns_json : [],
  };
}

function normalizePostImages(raw: unknown): PostImage[] {
  if (!Array.isArray(raw)) return [];
  const out: PostImage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Partial<PostImage>;
    if (typeof obj.url !== 'string' || !obj.url.trim()) continue;
    out.push({
      url: obj.url.trim(),
      alt: typeof obj.alt === 'string' ? obj.alt.trim() : '',
      ...(typeof obj.caption === 'string' && obj.caption.trim()
        ? { caption: obj.caption.trim() }
        : {}),
      ...(typeof obj.source_page_url === 'string' && obj.source_page_url.trim()
        ? { source_page_url: obj.source_page_url.trim() }
        : {}),
    });
  }
  return out;
}

function normalizePostRow(row: PostCreateRecord & { id: number; created_at: string; updated_at: string }): PostRecord {
  return {
    ...row,
    id: Number(row.id),
    tldr_summary: row.tldr_summary ?? '',
    key_facts_json: Array.isArray(row.key_facts_json) ? row.key_facts_json : [],
    faq_json: Array.isArray(row.faq_json) ? row.faq_json : [],
    body_markdown: row.body_markdown ?? '',
    body_html: row.body_html ?? '',
    cover_image_url:
      typeof row.cover_image_url === 'string' && row.cover_image_url.trim()
        ? row.cover_image_url.trim()
        : null,
    cover_image_alt:
      typeof row.cover_image_alt === 'string' && row.cover_image_alt.trim()
        ? row.cover_image_alt.trim()
        : null,
    images_json: normalizePostImages(row.images_json),
    tags_json: Array.isArray(row.tags_json) ? row.tags_json : [],
    keywords_json: Array.isArray(row.keywords_json) ? row.keywords_json : [],
    sources_json: Array.isArray(row.sources_json) ? row.sources_json : [],
    review_notes_json: Array.isArray(row.review_notes_json) ? row.review_notes_json : [],
    lint_passed: Boolean(row.lint_passed),
    lint_errors_json: Array.isArray(row.lint_errors_json) ? row.lint_errors_json : [],
    quality_score: Number(row.quality_score ?? 0),
    quality_breakdown_json:
      row.quality_breakdown_json && typeof row.quality_breakdown_json === 'object'
        ? {
            ...DEFAULT_QUALITY_BREAKDOWN,
            ...row.quality_breakdown_json,
            warnings: Array.isArray(row.quality_breakdown_json.warnings)
              ? row.quality_breakdown_json.warnings
              : [],
          }
        : { ...DEFAULT_QUALITY_BREAKDOWN, warnings: [] },
    reading_time_minutes: Number(row.reading_time_minutes ?? 1),
    word_count: Number(row.word_count ?? 0),
    admin_locked: Boolean(row.admin_locked ?? false),
    last_edited_by: row.last_edited_by ?? null,
    published_at: row.published_at ?? null,
  };
}

const VALID_AGENT_RUN_STATUSES: ReadonlySet<AgentRunStatus> = new Set([
  'queued',
  'running',
  'completed',
  'skipped',
  'failed',
]);

function normalizeAgentRunRow(row: AgentRunRecord): AgentRunRecord {
  const status: AgentRunStatus = VALID_AGENT_RUN_STATUSES.has(row.status) ? row.status : 'running';
  return {
    ...row,
    id: Number(row.id),
    workflow_instance_id: row.workflow_instance_id ?? null,
    status,
    trace_json: Array.isArray(row.trace_json) ? row.trace_json : [],
    quality_score:
      row.quality_score === null || row.quality_score === undefined
        ? null
        : Number(row.quality_score),
    post_id: row.post_id === null || row.post_id === undefined ? null : Number(row.post_id),
    token_usage_json:
      row.token_usage_json && typeof row.token_usage_json === 'object' ? row.token_usage_json : {},
    decision_reason: row.decision_reason ?? null,
    error_message: row.error_message ?? null,
    completed_at: row.completed_at ?? null,
  };
}

function sanitizePostgrestSearchToken(input: string): string {
  // Strip PostgREST filter syntax delimiters to prevent filter injection
  return input.replace(/[(),*"'\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// 25s Isolate Read Cache & Lightweight Projection Constants
// ---------------------------------------------------------------------------

const SUPABASE_READ_CACHE_TTL_MS = 25_000;
const MAX_SUPABASE_CACHE_ENTRIES = 64;

const LIGHTWEIGHT_POST_COLUMNS =
  'id,slug,title,description,tldr_summary,key_facts_json,faq_json,body_markdown,cover_image_url,cover_image_alt,images_json,author,category_slug,archetype,tags_json,keywords_json,sources_json,review_notes_json,lint_passed,lint_errors_json,quality_score,quality_breakdown_json,reading_time_minutes,word_count,status,admin_locked,last_edited_by,published_at,created_at,updated_at';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const settingsReadCache = new Map<string, CacheEntry<SiteSettings>>();
const skillsReadCache = new Map<string, CacheEntry<CategorySkill[]>>();

function cloneSettings(s: SiteSettings): SiteSettings {
  return {
    ...s,
    preferred_hours_utc_json: [...s.preferred_hours_utc_json],
  };
}

function cloneSkill(s: CategorySkill): CategorySkill {
  return {
    ...s,
    research_feeds_json: [...s.research_feeds_json],
    search_queries_json: [...s.search_queries_json],
    preferred_archetypes_json: [...s.preferred_archetypes_json],
    required_sections_json: [...s.required_sections_json],
    quality_rubric_json: { ...s.quality_rubric_json },
    banned_patterns_json: [...s.banned_patterns_json],
  };
}

function setBoundedCacheEntry<T>(
  map: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
): void {
  const now = Date.now();
  if (map.size >= MAX_SUPABASE_CACHE_ENTRIES && !map.has(key)) {
    for (const [k, entry] of map) {
      if (entry.expiresAt <= now) {
        map.delete(k);
      }
    }
    while (map.size >= MAX_SUPABASE_CACHE_ENTRIES) {
      const oldest = map.keys().next().value;
      if (oldest === undefined) break;
      map.delete(oldest);
    }
  }
  map.set(key, { value, expiresAt: now + ttlMs });
}

function invalidateSettingsCache(restBaseUrl: string): void {
  settingsReadCache.delete(restBaseUrl);
}

function invalidateSkillsCache(restBaseUrl: string): void {
  skillsReadCache.delete(`${restBaseUrl}::enabled`);
  skillsReadCache.delete(`${restBaseUrl}::all`);
}

export function clearSupabaseReadCache(): void {
  settingsReadCache.clear();
  skillsReadCache.clear();
}

// ---------------------------------------------------------------------------
// Supabase PostgREST Database Adapter
// ---------------------------------------------------------------------------

interface SupabaseRequestError extends Error {
  status: number;
  bodyText: string;
}

export class SupabaseRestDatabase implements DatabaseAdapter {
  private readonly restBaseUrl: string;
  private readonly secretKey: string;

  constructor(supabaseUrl: string, supabaseSecretKey: string) {
    this.restBaseUrl = `${supabaseUrl.trim().replace(/\/+$/, '')}/rest/v1`;
    this.secretKey = supabaseSecretKey.trim();
  }

  private buildHeaders(extra?: Record<string, string>, hasBody = false): Record<string, string> {
    const headers: Record<string, string> = {
      apikey: this.secretKey,
      Authorization: `Bearer ${this.secretKey}`,
      Accept: 'application/json',
    };
    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }
    if (extra) {
      Object.assign(headers, extra);
    }
    return headers;
  }

  private async requestJson<T>(
    pathAndQuery: string,
    opts?: {
      method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'HEAD';
      body?: unknown;
      prefer?: string;
      extraHeaders?: Record<string, string>;
    },
  ): Promise<{ data: T; response: Response }> {
    const method = opts?.method ?? 'GET';
    const hasBody = opts?.body !== undefined;
    const extraHeaders: Record<string, string> = { ...(opts?.extraHeaders ?? {}) };
    if (opts?.prefer) {
      extraHeaders.Prefer = opts.prefer;
    }

    const response = await fetch(`${this.restBaseUrl}${pathAndQuery}`, {
      method,
      headers: this.buildHeaders(extraHeaders, hasBody),
      body: hasBody ? JSON.stringify(opts?.body) : undefined,
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      const err = new Error(
        `Supabase REST ${method} ${pathAndQuery} failed (${response.status}): ${bodyText}`,
      ) as SupabaseRequestError;
      err.status = response.status;
      err.bodyText = bodyText;
      throw err;
    }

    if (method === 'HEAD' || response.status === 204) {
      return { data: undefined as T, response };
    }

    const text = await response.text();
    const data = text ? (JSON.parse(text) as T) : (undefined as T);
    return { data, response };
  }

  // Admin User (single-admin lock)
  async getAdminUser(): Promise<AdminUser | null> {
    const { data } = await this.requestJson<AdminUser[]>(
      '/admin_users?id=eq.1&select=*&limit=1',
    );
    return data && data.length > 0 ? normalizeAdminRow(data[0]) : null;
  }

  async createSingleAdminUser(input: {
    email: string;
    display_name: string;
    password_hash: string;
    password_salt: string;
  }): Promise<AdminUser> {
    try {
      const { data } = await this.requestJson<AdminUser[]>('/admin_users', {
        method: 'POST',
        prefer: 'return=representation',
        body: {
          id: 1,
          email: input.email.trim().toLowerCase(),
          display_name: input.display_name.trim(),
          password_hash: input.password_hash,
          password_salt: input.password_salt,
          failed_attempts: 0,
          locked_until: null,
          last_login_at: null,
        },
      });
      if (!data || data.length === 0) {
        throw new Error('Failed to create admin user: empty response from Supabase');
      }
      return normalizeAdminRow(data[0]);
    } catch (err) {
      const reqErr = err as Partial<SupabaseRequestError>;
      if (
        reqErr.status === 409 ||
        (typeof reqErr.bodyText === 'string' &&
          (reqErr.bodyText.includes('23505') ||
            reqErr.bodyText.toLowerCase().includes('duplicate key')))
      ) {
        throw new AdminAlreadyExistsError();
      }
      throw err;
    }
  }

  async updateAdminLoginState(
    patch: Partial<Pick<AdminUser, 'failed_attempts' | 'locked_until' | 'last_login_at'>>,
  ): Promise<void> {
    await this.requestJson<void>('/admin_users?id=eq.1', {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: {
        ...patch,
        updated_at: new Date().toISOString(),
      },
    });
  }

  // Settings
  async getSettings(): Promise<SiteSettings> {
    const cached = settingsReadCache.get(this.restBaseUrl);
    if (cached && cached.expiresAt > Date.now()) {
      return cloneSettings(cached.value);
    }

    const { data } = await this.requestJson<SiteSettings[]>(
      '/site_settings?id=eq.1&select=*&limit=1',
    );
    if (data && data.length > 0) {
      const normalized = normalizeSettingsRow(data[0]);
      setBoundedCacheEntry(
        settingsReadCache,
        this.restBaseUrl,
        cloneSettings(normalized),
        SUPABASE_READ_CACHE_TTL_MS,
      );
      return cloneSettings(normalized);
    }

    const { data: seeded } = await this.requestJson<SiteSettings[]>(
      '/site_settings?on_conflict=id',
      {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=representation',
        body: { id: 1 },
      },
    );
    const resolved =
      seeded && seeded.length > 0
        ? normalizeSettingsRow(seeded[0])
        : cloneSettings(DEFAULT_SEEDED_SETTINGS);

    setBoundedCacheEntry(
      settingsReadCache,
      this.restBaseUrl,
      cloneSettings(resolved),
      SUPABASE_READ_CACHE_TTL_MS,
    );
    return cloneSettings(resolved);
  }

  async updateSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
    invalidateSettingsCache(this.restBaseUrl);
    const { id: _ignoreId, ...rest } = patch;
    const payload = {
      ...rest,
      updated_at: new Date().toISOString(),
    };
    const { data } = await this.requestJson<SiteSettings[]>('/site_settings?id=eq.1', {
      method: 'PATCH',
      prefer: 'return=representation',
      body: payload,
    });
    invalidateSettingsCache(this.restBaseUrl);
    if (data && data.length > 0) {
      return normalizeSettingsRow(data[0]);
    }
    const { data: upserted } = await this.requestJson<SiteSettings[]>(
      '/site_settings?on_conflict=id',
      {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=representation',
        body: { ...DEFAULT_SEEDED_SETTINGS, ...payload, id: 1 },
      },
    );
    invalidateSettingsCache(this.restBaseUrl);
    return upserted && upserted.length > 0
      ? normalizeSettingsRow(upserted[0])
      : normalizeSettingsRow(payload);
  }

  // Skills
  async listSkills(onlyEnabled = false): Promise<CategorySkill[]> {
    const cacheKey = `${this.restBaseUrl}::${onlyEnabled ? 'enabled' : 'all'}`;
    const cached = skillsReadCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value.map(cloneSkill);
    }

    const filter = onlyEnabled ? '&enabled=eq.true' : '';
    const { data } = await this.requestJson<CategorySkill[]>(
      `/category_skills?select=*${filter}&order=priority.desc,slug.asc`,
    );
    const normalized = (data ?? []).map(normalizeSkillRow);
    setBoundedCacheEntry(
      skillsReadCache,
      cacheKey,
      normalized.map(cloneSkill),
      SUPABASE_READ_CACHE_TTL_MS,
    );
    return normalized.map(cloneSkill);
  }

  async getSkillBySlug(slug: string): Promise<CategorySkill | null> {
    const { data } = await this.requestJson<CategorySkill[]>(
      `/category_skills?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`,
    );
    return data && data.length > 0 ? normalizeSkillRow(data[0]) : null;
  }

  async upsertSkill(
    skill: Partial<CategorySkill> & {
      slug: string;
      name: string;
      description: string;
      system_instructions: string;
    },
  ): Promise<CategorySkill> {
    invalidateSkillsCache(this.restBaseUrl);
    const { id: _ignoreId, created_at: _ignoreCreated, ...rest } = skill;
    const cleanSlug = slugify(skill.slug, 64) || skill.slug.trim().toLowerCase();

    const body: Record<string, unknown> = {
      slug: cleanSlug,
      name: skill.name.trim(),
      description: skill.description.trim(),
      system_instructions: skill.system_instructions.trim(),
      updated_at: new Date().toISOString(),
    };

    if (rest.enabled !== undefined) body.enabled = Boolean(rest.enabled);
    if (rest.priority !== undefined) body.priority = Number(rest.priority);
    if (rest.target_audience !== undefined) body.target_audience = rest.target_audience;
    if (rest.research_feeds_json !== undefined) body.research_feeds_json = rest.research_feeds_json;
    if (rest.search_queries_json !== undefined) body.search_queries_json = rest.search_queries_json;
    if (rest.preferred_archetypes_json !== undefined) {
      body.preferred_archetypes_json = rest.preferred_archetypes_json;
    }
    if (rest.required_sections_json !== undefined) {
      body.required_sections_json = rest.required_sections_json;
    }
    if (rest.quality_rubric_json !== undefined) body.quality_rubric_json = rest.quality_rubric_json;
    if (rest.banned_patterns_json !== undefined) {
      body.banned_patterns_json = rest.banned_patterns_json;
    }

    const { data } = await this.requestJson<CategorySkill[]>(
      '/category_skills?on_conflict=slug',
      {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=representation',
        body,
      },
    );
    invalidateSkillsCache(this.restBaseUrl);
    if (!data || data.length === 0) {
      throw new Error(`Failed to upsert skill "${cleanSlug}"`);
    }
    return normalizeSkillRow(data[0]);
  }

  async deleteSkill(slug: string): Promise<boolean> {
    invalidateSkillsCache(this.restBaseUrl);
    const { data } = await this.requestJson<CategorySkill[]>(
      `/category_skills?slug=eq.${encodeURIComponent(slug)}`,
      {
        method: 'DELETE',
        prefer: 'return=representation',
      },
    );
    invalidateSkillsCache(this.restBaseUrl);
    return Array.isArray(data) && data.length > 0;
  }

  // Posts
  async listPosts(opts?: {
    status?: PostStatus;
    category_slug?: string;
    limit?: number;
    offset?: number;
    search?: string;
    excludeHeavyHtml?: boolean;
  }): Promise<PostRecord[]> {
    const selectParam = opts?.excludeHeavyHtml
      ? `select=${LIGHTWEIGHT_POST_COLUMNS}`
      : 'select=*';
    const params: string[] = [selectParam];
    if (opts?.status) {
      params.push(`status=eq.${encodeURIComponent(opts.status)}`);
    }
    if (opts?.category_slug) {
      params.push(`category_slug=eq.${encodeURIComponent(opts.category_slug)}`);
    }
    if (opts?.search) {
      const cleaned = sanitizePostgrestSearchToken(opts.search);
      if (cleaned) {
        const pattern = encodeURIComponent(`*${cleaned}*`);
        params.push(
          `or=(title.ilike.${pattern},description.ilike.${pattern},tldr_summary.ilike.${pattern},category_slug.ilike.${pattern},body_markdown.ilike.${pattern})`,
        );
      }
    }

    const limit = Math.max(1, Math.min(200, Math.floor(opts?.limit ?? 50)));
    const offset = Math.max(0, Math.floor(opts?.offset ?? 0));
    params.push('order=published_at.desc.nullslast,created_at.desc,id.desc');
    params.push(`limit=${limit}`);
    params.push(`offset=${offset}`);

    const { data } = await this.requestJson<PostRecord[]>(`/posts?${params.join('&')}`);
    return (data ?? []).map(normalizePostRow);
  }

  async countPosts(opts?: { status?: PostStatus; category_slug?: string }): Promise<number> {
    const params: string[] = ['select=id'];
    if (opts?.status) {
      params.push(`status=eq.${encodeURIComponent(opts.status)}`);
    }
    if (opts?.category_slug) {
      params.push(`category_slug=eq.${encodeURIComponent(opts.category_slug)}`);
    }

    const { response } = await this.requestJson<void>(`/posts?${params.join('&')}`, {
      method: 'HEAD',
      prefer: 'count=exact',
    });

    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      const slashIdx = contentRange.lastIndexOf('/');
      if (slashIdx !== -1) {
        const total = Number(contentRange.slice(slashIdx + 1));
        if (Number.isFinite(total)) return total;
      }
    }

    const { data } = await this.requestJson<Array<{ id: number }>>(`/posts?${params.join('&')}`);
    return Array.isArray(data) ? data.length : 0;
  }

  async getPostById(id: number): Promise<PostRecord | null> {
    const { data } = await this.requestJson<PostRecord[]>(
      `/posts?id=eq.${encodeURIComponent(String(id))}&select=*&limit=1`,
    );
    return data && data.length > 0 ? normalizePostRow(data[0]) : null;
  }

  async getPostBySlug(slug: string, onlyPublished = false): Promise<PostRecord | null> {
    const pubFilter = onlyPublished ? '&status=eq.published' : '';
    const { data } = await this.requestJson<PostRecord[]>(
      `/posts?slug=eq.${encodeURIComponent(slug)}${pubFilter}&select=*&limit=1`,
    );
    return data && data.length > 0 ? normalizePostRow(data[0]) : null;
  }

  async slugExists(slug: string, excludeId?: number): Promise<boolean> {
    const excludeFilter =
      excludeId !== undefined ? `&id=neq.${encodeURIComponent(String(excludeId))}` : '';
    const { data } = await this.requestJson<Array<{ id: number }>>(
      `/posts?slug=eq.${encodeURIComponent(slug)}${excludeFilter}&select=id&limit=1`,
    );
    return Array.isArray(data) && data.length > 0;
  }

  async createPost(record: PostCreateRecord): Promise<PostRecord> {
    const payload = {
      ...record,
      cover_image_url:
        typeof record.cover_image_url === 'string' && record.cover_image_url.trim()
          ? record.cover_image_url.trim()
          : null,
      cover_image_alt:
        typeof record.cover_image_alt === 'string' && record.cover_image_alt.trim()
          ? record.cover_image_alt.trim()
          : null,
      images_json: normalizePostImages(record.images_json),
      keywords_json: Array.isArray(record.keywords_json) ? record.keywords_json : [],
      admin_locked: Boolean(record.admin_locked ?? false),
      last_edited_by: record.last_edited_by ?? null,
    };
    const { data } = await this.requestJson<PostRecord[]>('/posts', {
      method: 'POST',
      prefer: 'return=representation',
      body: payload,
    });
    if (!data || data.length === 0) {
      throw new Error('Failed to create post: empty response from Supabase');
    }
    return normalizePostRow(data[0]);
  }

  async updatePost(
    id: number,
    patch: Partial<PostRecord>,
    ctx?: PostMutationContext,
  ): Promise<PostRecord | null> {
    assertAdminOnlyPostMutation(patch, ctx);

    const { id: _ignoreId, created_at: _ignoreCreated, ...rest } = patch;
    const adminLockPatch: Partial<PostRecord> =
      ctx?.actor === 'admin' && touchesAdminProtectedPostFields(patch)
        ? {
            admin_locked: true,
            last_edited_by: ctx.adminEmail || 'admin',
          }
        : {};

    const { data } = await this.requestJson<PostRecord[]>(
      `/posts?id=eq.${encodeURIComponent(String(id))}`,
      {
        method: 'PATCH',
        prefer: 'return=representation',
        body: {
          ...rest,
          ...adminLockPatch,
          updated_at: new Date().toISOString(),
        },
      },
    );
    return data && data.length > 0 ? normalizePostRow(data[0]) : null;
  }

  async deletePost(id: number): Promise<boolean> {
    const { data } = await this.requestJson<PostRecord[]>(
      `/posts?id=eq.${encodeURIComponent(String(id))}`,
      {
        method: 'DELETE',
        prefer: 'return=representation',
      },
    );
    return Array.isArray(data) && data.length > 0;
  }

  // Agent Runs
  async listAgentRuns(limit = 30): Promise<AgentRunRecord[]> {
    const clamped = Math.max(1, Math.min(200, Math.floor(limit)));
    const { data } = await this.requestJson<AgentRunRecord[]>(
      `/agent_runs?select=*&order=created_at.desc,id.desc&limit=${clamped}`,
    );
    return (data ?? []).map(normalizeAgentRunRow);
  }

  async getAgentRunById(id: number): Promise<AgentRunRecord | null> {
    const { data } = await this.requestJson<AgentRunRecord[]>(
      `/agent_runs?id=eq.${encodeURIComponent(String(id))}&select=*&limit=1`,
    );
    return data && data.length > 0 ? normalizeAgentRunRow(data[0]) : null;
  }

  async createAgentRun(run: {
    workflow_instance_id?: string | null;
    trigger_source: TriggerSource;
    category_slug: string;
    topic: string;
    archetype: string;
    model_used: string;
    status?: AgentRunStatus;
    current_stage?: string;
    decision_reason?: string | null;
  }): Promise<AgentRunRecord> {
    const status: AgentRunStatus =
      run.status && VALID_AGENT_RUN_STATUSES.has(run.status) ? run.status : 'running';
    const { data } = await this.requestJson<AgentRunRecord[]>('/agent_runs', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        workflow_instance_id: run.workflow_instance_id ?? null,
        trigger_source: run.trigger_source,
        category_slug: run.category_slug,
        topic: run.topic,
        archetype: run.archetype,
        model_used: run.model_used,
        status,
        current_stage: run.current_stage ?? 'initializing',
        trace_json: [],
        quality_score: null,
        post_id: null,
        token_usage_json: {},
        decision_reason: run.decision_reason ?? null,
        error_message: null,
        completed_at: null,
      },
    });
    if (!data || data.length === 0) {
      throw new Error('Failed to create agent run: empty response from Supabase');
    }
    return normalizeAgentRunRow(data[0]);
  }

  async updateAgentRun(
    id: number,
    patch: Partial<AgentRunRecord>,
  ): Promise<AgentRunRecord | null> {
    const { id: _ignoreId, created_at: _ignoreCreated, ...rest } = patch;
    const { data } = await this.requestJson<AgentRunRecord[]>(
      `/agent_runs?id=eq.${encodeURIComponent(String(id))}`,
      {
        method: 'PATCH',
        prefer: 'return=representation',
        body: rest,
      },
    );
    return data && data.length > 0 ? normalizeAgentRunRow(data[0]) : null;
  }

  async recordSecurityLog(entry: {
    event_type: SecurityEventType;
    ip_address: string;
    country?: string | null;
    user_agent?: string | null;
    email?: string | null;
    path?: string | null;
    method?: string | null;
    status_code?: number | null;
    reason?: string | null;
  }): Promise<SecurityAuditLog> {
    const payload = {
      event_type: entry.event_type,
      ip_address: (entry.ip_address || 'unknown').slice(0, 128),
      country: entry.country ? entry.country.slice(0, 16) : null,
      user_agent: entry.user_agent ? entry.user_agent.slice(0, 300) : null,
      email: entry.email ? entry.email.slice(0, 200) : null,
      path: entry.path ? entry.path.slice(0, 300) : null,
      method: entry.method ? entry.method.slice(0, 16) : null,
      status_code: entry.status_code ?? null,
      reason: entry.reason ? entry.reason.slice(0, 400) : null,
    };
    const { data } = await this.requestJson<SecurityAuditLog[]>('/security_audit_logs', {
      method: 'POST',
      prefer: 'return=representation',
      body: payload,
    });
    if (data && data.length > 0) {
      return { ...data[0], id: Number(data[0].id) };
    }
    return {
      id: 0,
      ...payload,
      created_at: new Date().toISOString(),
    };
  }

  async listSecurityLogs(opts?: {
    limit?: number;
    event_type?: string;
  }): Promise<SecurityAuditLog[]> {
    const limit = Math.min(250, Math.max(1, opts?.limit ?? 100));
    const params = new URLSearchParams();
    params.set('select', '*');
    params.set('order', 'created_at.desc');
    params.set('limit', String(limit));
    if (opts?.event_type && opts.event_type !== 'all') {
      params.set('event_type', `eq.${opts.event_type}`);
    }
    const { data } = await this.requestJson<SecurityAuditLog[]>(
      `/security_audit_logs?${params.toString()}`,
    );
    return (data || []).map((row) => ({ ...row, id: Number(row.id) }));
  }

  async getActiveIpBlock(ip: string): Promise<IpBlock | null> {
    const cleanIp = (ip || '').trim();
    if (!cleanIp) return null;
    const nowIso = new Date().toISOString();
    const params = new URLSearchParams();
    params.set('select', '*');
    params.set('ip_address', `eq.${cleanIp}`);
    params.set('blocked_until', `gt.${nowIso}`);
    params.set('limit', '1');
    const { data } = await this.requestJson<IpBlock[]>(`/ip_blocks?${params.toString()}`);
    return data && data.length > 0 ? data[0] : null;
  }

  async listIpBlocks(): Promise<IpBlock[]> {
    const { data } = await this.requestJson<IpBlock[]>(
      '/ip_blocks?select=*&order=blocked_until.desc&limit=200',
    );
    return data || [];
  }

  async upsertIpBlock(input: {
    ip_address: string;
    reason: string;
    blocked_until: string;
    hit_count?: number;
  }): Promise<IpBlock> {
    const nowIso = new Date().toISOString();
    const payload = {
      ip_address: input.ip_address.trim().slice(0, 128),
      reason: input.reason.slice(0, 400),
      hit_count: Math.max(1, Math.round(input.hit_count ?? 1)),
      blocked_until: input.blocked_until,
      updated_at: nowIso,
    };
    const { data } = await this.requestJson<IpBlock[]>('/ip_blocks?on_conflict=ip_address', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: payload,
    });
    if (data && data.length > 0) {
      return data[0];
    }
    return { ...payload, created_at: nowIso };
  }

  async deleteIpBlock(ip: string): Promise<boolean> {
    const cleanIp = (ip || '').trim();
    if (!cleanIp) return false;
    const { data } = await this.requestJson<IpBlock[]>(
      `/ip_blocks?ip_address=eq.${encodeURIComponent(cleanIp)}`,
      {
        method: 'DELETE',
        prefer: 'return=representation',
      },
    );
    return Boolean(data && data.length > 0);
  }
}

// ---------------------------------------------------------------------------
// In-Memory Database Adapter (for unit / E2E tests)
// ---------------------------------------------------------------------------

export class InMemoryDatabase implements DatabaseAdapter {
  private adminUser: AdminUser | null = null;
  private settings: SiteSettings;
  private skills: Map<string, CategorySkill>;
  private posts: Map<number, PostRecord>;
  private agentRuns: Map<number, AgentRunRecord>;

  private nextSkillId: number;
  private nextPostId = 1;
  private nextRunId = 1;

  constructor() {
    this.settings = structuredClone(DEFAULT_SEEDED_SETTINGS);
    this.skills = new Map();
    for (const skill of DEFAULT_SEEDED_SKILLS) {
      this.skills.set(skill.slug, structuredClone(skill));
    }
    this.nextSkillId = DEFAULT_SEEDED_SKILLS.length + 1;
    this.posts = new Map();
    this.agentRuns = new Map();
  }

  // Admin User (single-admin lock)
  async getAdminUser(): Promise<AdminUser | null> {
    return this.adminUser ? structuredClone(this.adminUser) : null;
  }

  async createSingleAdminUser(data: {
    email: string;
    display_name: string;
    password_hash: string;
    password_salt: string;
  }): Promise<AdminUser> {
    if (this.adminUser !== null) {
      throw new AdminAlreadyExistsError();
    }
    const now = new Date().toISOString();
    this.adminUser = {
      id: 1,
      email: data.email.trim().toLowerCase(),
      display_name: data.display_name.trim(),
      password_hash: data.password_hash,
      password_salt: data.password_salt,
      failed_attempts: 0,
      locked_until: null,
      last_login_at: null,
      created_at: now,
      updated_at: now,
    };
    return structuredClone(this.adminUser);
  }

  async updateAdminLoginState(
    patch: Partial<Pick<AdminUser, 'failed_attempts' | 'locked_until' | 'last_login_at'>>,
  ): Promise<void> {
    if (!this.adminUser) return;
    if (patch.failed_attempts !== undefined) {
      this.adminUser.failed_attempts = patch.failed_attempts;
    }
    if (patch.locked_until !== undefined) {
      this.adminUser.locked_until = patch.locked_until;
    }
    if (patch.last_login_at !== undefined) {
      this.adminUser.last_login_at = patch.last_login_at;
    }
    this.adminUser.updated_at = new Date().toISOString();
  }

  // Settings
  async getSettings(): Promise<SiteSettings> {
    return structuredClone(this.settings);
  }

  async updateSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
    const { id: _ignoreId, ...rest } = patch;
    this.settings = normalizeSettingsRow({
      ...this.settings,
      ...rest,
      id: 1,
      updated_at: new Date().toISOString(),
    });
    return structuredClone(this.settings);
  }

  // Skills
  async listSkills(onlyEnabled = false): Promise<CategorySkill[]> {
    const items = Array.from(this.skills.values()).filter((s) =>
      onlyEnabled ? s.enabled : true,
    );
    items.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.slug.localeCompare(b.slug);
    });
    return items.map((s) => structuredClone(s));
  }

  async getSkillBySlug(slug: string): Promise<CategorySkill | null> {
    const found = this.skills.get(slug);
    return found ? structuredClone(found) : null;
  }

  async upsertSkill(
    skill: Partial<CategorySkill> & {
      slug: string;
      name: string;
      description: string;
      system_instructions: string;
    },
  ): Promise<CategorySkill> {
    const cleanSlug = slugify(skill.slug, 64) || skill.slug.trim().toLowerCase();
    const existing = this.skills.get(cleanSlug);
    const now = new Date().toISOString();

    if (existing) {
      const updated: CategorySkill = {
        ...existing,
        slug: cleanSlug,
        name: skill.name.trim(),
        description: skill.description.trim(),
        system_instructions: skill.system_instructions.trim(),
        enabled: skill.enabled !== undefined ? Boolean(skill.enabled) : existing.enabled,
        priority: skill.priority !== undefined ? Number(skill.priority) : existing.priority,
        target_audience:
          skill.target_audience !== undefined ? skill.target_audience : existing.target_audience,
        research_feeds_json:
          skill.research_feeds_json !== undefined
            ? structuredClone(skill.research_feeds_json)
            : existing.research_feeds_json,
        search_queries_json:
          skill.search_queries_json !== undefined
            ? structuredClone(skill.search_queries_json)
            : existing.search_queries_json,
        preferred_archetypes_json:
          skill.preferred_archetypes_json !== undefined
            ? structuredClone(skill.preferred_archetypes_json)
            : existing.preferred_archetypes_json,
        required_sections_json:
          skill.required_sections_json !== undefined
            ? structuredClone(skill.required_sections_json)
            : existing.required_sections_json,
        quality_rubric_json:
          skill.quality_rubric_json !== undefined
            ? structuredClone(skill.quality_rubric_json)
            : existing.quality_rubric_json,
        banned_patterns_json:
          skill.banned_patterns_json !== undefined
            ? structuredClone(skill.banned_patterns_json)
            : existing.banned_patterns_json,
        updated_at: now,
      };
      this.skills.set(cleanSlug, updated);
      return structuredClone(updated);
    }

    const created: CategorySkill = {
      id: this.nextSkillId++,
      slug: cleanSlug,
      name: skill.name.trim(),
      description: skill.description.trim(),
      enabled: skill.enabled !== undefined ? Boolean(skill.enabled) : true,
      priority: skill.priority !== undefined ? Number(skill.priority) : 50,
      target_audience:
        skill.target_audience ??
        'Senior software engineers, AI practitioners, and security architects',
      system_instructions: skill.system_instructions.trim(),
      research_feeds_json: structuredClone(skill.research_feeds_json ?? []),
      search_queries_json: structuredClone(skill.search_queries_json ?? []),
      preferred_archetypes_json: structuredClone(
        skill.preferred_archetypes_json ?? (['benchmark-index', 'architecture-analysis'] as Archetype[]),
      ),
      required_sections_json: structuredClone(skill.required_sections_json ?? []),
      quality_rubric_json: structuredClone(skill.quality_rubric_json ?? {}),
      banned_patterns_json: structuredClone(skill.banned_patterns_json ?? []),
      created_at: now,
      updated_at: now,
    };
    this.skills.set(cleanSlug, created);
    return structuredClone(created);
  }

  async deleteSkill(slug: string): Promise<boolean> {
    return this.skills.delete(slug);
  }

  // Posts
  async listPosts(opts?: {
    status?: PostStatus;
    category_slug?: string;
    limit?: number;
    offset?: number;
    search?: string;
    excludeHeavyHtml?: boolean;
  }): Promise<PostRecord[]> {
    const query = opts?.search?.trim().toLowerCase() ?? '';
    let items = Array.from(this.posts.values());

    if (opts?.status) {
      items = items.filter((p) => p.status === opts.status);
    }
    if (opts?.category_slug) {
      items = items.filter((p) => p.category_slug === opts.category_slug);
    }
    if (query) {
      items = items.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.tldr_summary.toLowerCase().includes(query) ||
          p.category_slug.toLowerCase().includes(query) ||
          p.body_markdown.toLowerCase().includes(query) ||
          p.tags_json.some((t) => t.toLowerCase().includes(query)) ||
          p.keywords_json.some((k) => k.toLowerCase().includes(query)),
      );
    }

    items.sort((a, b) => {
      // published_at DESC NULLS LAST
      if (a.published_at && b.published_at) {
        if (a.published_at !== b.published_at) {
          return b.published_at.localeCompare(a.published_at);
        }
      } else if (a.published_at && !b.published_at) {
        return -1;
      } else if (!a.published_at && b.published_at) {
        return 1;
      }

      if (a.created_at !== b.created_at) {
        return b.created_at.localeCompare(a.created_at);
      }
      return b.id - a.id;
    });

    const offset = Math.max(0, Math.floor(opts?.offset ?? 0));
    const limit = Math.max(1, Math.min(200, Math.floor(opts?.limit ?? 50)));
    return items.slice(offset, offset + limit).map((p) => {
      const cloned = structuredClone(p);
      if (opts?.excludeHeavyHtml) {
        cloned.body_html = '';
      }
      return cloned;
    });
  }

  async countPosts(opts?: { status?: PostStatus; category_slug?: string }): Promise<number> {
    let count = 0;
    for (const post of this.posts.values()) {
      if (opts?.status && post.status !== opts.status) continue;
      if (opts?.category_slug && post.category_slug !== opts.category_slug) continue;
      count++;
    }
    return count;
  }

  async getPostById(id: number): Promise<PostRecord | null> {
    const found = this.posts.get(id);
    return found ? structuredClone(found) : null;
  }

  async getPostBySlug(slug: string, onlyPublished = false): Promise<PostRecord | null> {
    for (const post of this.posts.values()) {
      if (post.slug === slug) {
        if (onlyPublished && post.status !== 'published') return null;
        return structuredClone(post);
      }
    }
    return null;
  }

  async slugExists(slug: string, excludeId?: number): Promise<boolean> {
    for (const post of this.posts.values()) {
      if (post.slug === slug && (excludeId === undefined || post.id !== excludeId)) {
        return true;
      }
    }
    return false;
  }

  async createPost(record: PostCreateRecord): Promise<PostRecord> {
    if (await this.slugExists(record.slug)) {
      throw new Error(`Post with slug "${record.slug}" already exists`);
    }
    const now = new Date().toISOString();
    const created: PostRecord = normalizePostRow({
      ...structuredClone(record),
      id: this.nextPostId++,
      created_at: now,
      updated_at: now,
    });
    this.posts.set(created.id, created);
    return structuredClone(created);
  }

  async updatePost(
    id: number,
    patch: Partial<PostRecord>,
    ctx?: PostMutationContext,
  ): Promise<PostRecord | null> {
    assertAdminOnlyPostMutation(patch, ctx);

    const existing = this.posts.get(id);
    if (!existing) return null;

    if (patch.slug && patch.slug !== existing.slug && (await this.slugExists(patch.slug, id))) {
      throw new Error(`Post with slug "${patch.slug}" already exists`);
    }

    const { id: _ignoreId, created_at: _ignoreCreated, ...rest } = patch;
    const adminLockPatch: Partial<PostRecord> =
      ctx?.actor === 'admin' && touchesAdminProtectedPostFields(patch)
        ? {
            admin_locked: true,
            last_edited_by: ctx.adminEmail || 'admin',
          }
        : {};

    const updated = normalizePostRow({
      ...existing,
      ...structuredClone(rest),
      ...adminLockPatch,
      id: existing.id,
      created_at: existing.created_at,
      updated_at: new Date().toISOString(),
    });
    this.posts.set(id, updated);
    return structuredClone(updated);
  }

  async deletePost(id: number): Promise<boolean> {
    return this.posts.delete(id);
  }

  // Agent Runs
  async listAgentRuns(limit = 30): Promise<AgentRunRecord[]> {
    const clamped = Math.max(1, Math.min(200, Math.floor(limit)));
    const items = Array.from(this.agentRuns.values());
    items.sort((a, b) => {
      if (a.created_at !== b.created_at) {
        return b.created_at.localeCompare(a.created_at);
      }
      return b.id - a.id;
    });
    return items.slice(0, clamped).map((r) => structuredClone(r));
  }

  async getAgentRunById(id: number): Promise<AgentRunRecord | null> {
    const found = this.agentRuns.get(id);
    return found ? structuredClone(found) : null;
  }

  async createAgentRun(run: {
    workflow_instance_id?: string | null;
    trigger_source: TriggerSource;
    category_slug: string;
    topic: string;
    archetype: string;
    model_used: string;
    status?: AgentRunStatus;
    current_stage?: string;
    decision_reason?: string | null;
  }): Promise<AgentRunRecord> {
    const now = new Date().toISOString();
    const status: AgentRunStatus =
      run.status && VALID_AGENT_RUN_STATUSES.has(run.status) ? run.status : 'running';
    const created: AgentRunRecord = {
      id: this.nextRunId++,
      workflow_instance_id: run.workflow_instance_id ?? null,
      trigger_source: run.trigger_source,
      category_slug: run.category_slug,
      topic: run.topic,
      archetype: run.archetype,
      model_used: run.model_used,
      status,
      current_stage: run.current_stage ?? 'initializing',
      trace_json: [],
      quality_score: null,
      post_id: null,
      token_usage_json: {},
      decision_reason: run.decision_reason ?? null,
      error_message: null,
      created_at: now,
      completed_at: null,
    };
    this.agentRuns.set(created.id, created);
    return structuredClone(created);
  }

  async updateAgentRun(
    id: number,
    patch: Partial<AgentRunRecord>,
  ): Promise<AgentRunRecord | null> {
    const existing = this.agentRuns.get(id);
    if (!existing) return null;

    const { id: _ignoreId, created_at: _ignoreCreated, ...rest } = patch;
    const updated = normalizeAgentRunRow({
      ...existing,
      ...structuredClone(rest),
      id: existing.id,
      created_at: existing.created_at,
    });
    this.agentRuns.set(id, updated);
    return structuredClone(updated);
  }

  private securityLogs: SecurityAuditLog[] = [];
  private nextSecurityLogId = 1;
  private ipBlocks = new Map<string, IpBlock>();

  async recordSecurityLog(entry: {
    event_type: SecurityEventType;
    ip_address: string;
    country?: string | null;
    user_agent?: string | null;
    email?: string | null;
    path?: string | null;
    method?: string | null;
    status_code?: number | null;
    reason?: string | null;
  }): Promise<SecurityAuditLog> {
    const row: SecurityAuditLog = {
      id: this.nextSecurityLogId++,
      event_type: entry.event_type,
      ip_address: entry.ip_address || 'unknown',
      country: entry.country ?? null,
      user_agent: entry.user_agent ?? null,
      email: entry.email ?? null,
      path: entry.path ?? null,
      method: entry.method ?? null,
      status_code: entry.status_code ?? null,
      reason: entry.reason ?? null,
      created_at: new Date().toISOString(),
    };
    this.securityLogs.unshift(row);
    if (this.securityLogs.length > 500) {
      this.securityLogs.length = 500;
    }
    return structuredClone(row);
  }

  async listSecurityLogs(opts?: {
    limit?: number;
    event_type?: string;
  }): Promise<SecurityAuditLog[]> {
    const limit = Math.min(250, Math.max(1, opts?.limit ?? 100));
    const filtered =
      opts?.event_type && opts.event_type !== 'all'
        ? this.securityLogs.filter((l) => l.event_type === opts.event_type)
        : this.securityLogs;
    return filtered.slice(0, limit).map((l) => structuredClone(l));
  }

  async getActiveIpBlock(ip: string): Promise<IpBlock | null> {
    const existing = this.ipBlocks.get((ip || '').trim());
    if (!existing) return null;
    if (new Date(existing.blocked_until).getTime() <= Date.now()) {
      return null;
    }
    return structuredClone(existing);
  }

  async listIpBlocks(): Promise<IpBlock[]> {
    return Array.from(this.ipBlocks.values())
      .sort((a, b) => b.blocked_until.localeCompare(a.blocked_until))
      .map((b) => structuredClone(b));
  }

  async upsertIpBlock(input: {
    ip_address: string;
    reason: string;
    blocked_until: string;
    hit_count?: number;
  }): Promise<IpBlock> {
    const nowIso = new Date().toISOString();
    const key = input.ip_address.trim();
    const existing = this.ipBlocks.get(key);
    const record: IpBlock = {
      ip_address: key,
      reason: input.reason,
      hit_count: input.hit_count ?? (existing ? existing.hit_count + 1 : 1),
      blocked_until: input.blocked_until,
      created_at: existing?.created_at || nowIso,
      updated_at: nowIso,
    };
    this.ipBlocks.set(key, record);
    return structuredClone(record);
  }

  async deleteIpBlock(ip: string): Promise<boolean> {
    return this.ipBlocks.delete((ip || '').trim());
  }
}

export async function recoverStaleAndFindActiveRun(
  db: DatabaseAdapter,
  staleMinutes = 20,
): Promise<AgentRunRecord | null> {
  const runs = await db.listAgentRuns(15);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const staleThresholdMs = Math.max(1, staleMinutes) * 60 * 1000;

  let activeRun: AgentRunRecord | null = null;

  for (const run of runs) {
    if (run.status !== 'running' && run.status !== 'queued') {
      continue;
    }

    const createdMs = new Date(run.created_at).getTime();
    const isStale = Number.isFinite(createdMs) && nowMs - createdMs > staleThresholdMs;

    if (isStale) {
      await db.updateAgentRun(run.id, {
        status: 'failed',
        current_stage: 'stale_timeout',
        error_message: 'Recovered stale agent run exceeding 20-minute window',
        completed_at: nowIso,
      });
    } else if (!activeRun) {
      activeRun = run;
    }
  }

  return activeRun;
}

export async function countPostsCreatedInLastHours(
  db: DatabaseAdapter,
  hours = 24,
): Promise<number> {
  const posts = await db.listPosts({ limit: 50, excludeHeavyHtml: true });
  const cutoffMs = Date.now() - Math.max(0, hours) * 60 * 60 * 1000;

  let count = 0;
  for (const post of posts) {
    const createdMs = new Date(post.created_at).getTime();
    if (Number.isFinite(createdMs) && createdMs >= cutoffMs) {
      count++;
    }
  }
  return count;
}

export function createDatabase(env: WorkerEnv): DatabaseAdapter {
  if (env.__TEST_DB__) {
    return env.__TEST_DB__;
  }
  const url = (env.SUPABASE_URL ?? '').trim();
  const secretKey = (env.SUPABASE_SECRET_KEY ?? '').trim();
  if (url && secretKey) {
    return new SupabaseRestDatabase(url, secretKey);
  }
  throw new Error(
    'Supabase database is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY in Cloudflare Worker secrets or .dev.vars.',
  );
}
