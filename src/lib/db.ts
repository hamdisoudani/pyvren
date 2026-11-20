import type { WorkerEnv } from '../env';
import type {
  AdminUser,
  AgentRunRecord,
  AgentRunStatus,
  Archetype,
  CategorySkill,
  DatabaseAdapter,
  PostRecord,
  PostStatus,
  QualityBreakdown,
  SiteSettings,
  TriggerSource,
} from '../types';
import { slugify } from './security';

const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

export const DEFAULT_SEEDED_SETTINGS: SiteSettings = {
  id: 1,
  publishing_mode: 'draft_review',
  min_publish_score: 78,
  schedule_enabled: false,
  runs_per_day: 3,
  openrouter_model: 'google/gemini-2.5-flash',
  judge_model: 'google/gemini-2.5-flash',
  default_topic_feed:
    'AI model releases, LLM security & prompt injection defense, cloud GPU economics, and CISA KEV engineering advisories',
  default_author: 'Hamdi Soudani',
  author_bio:
    'Systems engineer and technical editor researching AI infrastructure, model security, and edge web performance.',
  site_name: 'Pyvren Research',
  site_tagline:
    'Primary-source technical research on AI systems, LLM security, and cloud infrastructure.',
  base_url: 'https://pyvren.com',
  adsense_client_id: null,
  cta_headline: 'Get verified technical briefings without the noise',
  cta_body:
    'Every briefing cites primary benchmarks, advisories, and reproducible configurations—reviewed by engineers before publication.',
  cta_url: '/about',
  contact_email: 'editorial@pyvren.com',
  last_scheduled_run_at: null,
  updated_at: SEED_TIMESTAMP,
};

export const DEFAULT_SEEDED_SKILLS: CategorySkill[] = [
  {
    id: 1,
    slug: 'ai-llms',
    name: 'AI Models & LLM Engineering',
    description:
      'Deep technical teardowns of frontier and open-weights LLMs, inference engines, quantization, context scaling, and real cost/latency benchmarks.',
    enabled: true,
    priority: 100,
    target_audience:
      'AI engineers, ML infra teams, and developers selecting production LLM stacks',
    system_instructions:
      'Focus on measurable metrics: tokens/sec, TTFT, context window retention, API $/1M token pricing, KV-cache memory math, and reproducible evaluation harnesses. Compare against at least 2 competing models in a Markdown table. Avoid hype adjectives.',
    research_feeds_json: ['hn_top_infra', 'arxiv_ai', 'huggingface_trending'],
    search_queries_json: [
      'open weights LLM benchmark inference latency cost comparison',
      'vLLM SGLang llama.cpp quantization throughput benchmark',
      'OpenRouter new frontier model API pricing context window',
    ],
    preferred_archetypes_json: ['benchmark-index', 'architecture-analysis'],
    required_sections_json: [
      'Direct Answer & TL;DR',
      'Quantitative Comparison Table',
      'Production Tradeoffs & Failure Modes',
      'Reproducible Configuration / Code',
    ],
    quality_rubric_json: {
      min_primary_sources: 3,
      require_table_or_code: true,
      min_words: 650,
      geo_faq_count: 3,
    },
    banned_patterns_json: [],
    created_at: SEED_TIMESTAMP,
    updated_at: SEED_TIMESTAMP,
  },
  {
    id: 2,
    slug: 'ai-security-jailbreaks',
    name: 'AI Security & Jailbreak Defense',
    description:
      'Defensive research on LLM prompt injection, jailbreak taxonomies, red-teaming benchmarks, OWASP LLM Top 10, guardrails, and sandboxed agent architectures.',
    enabled: true,
    priority: 95,
    target_audience:
      'Security engineers, AI safety researchers, and teams deploying tool-calling agents',
    system_instructions:
      'Write strictly from a defensive engineering and security research perspective. Analyze attack classes (indirect prompt injection, multi-turn jailbreak drift, tool-call smuggling, system prompt extraction) using peer-reviewed papers, OWASP LLM Top 10, NIST AI RMF, and public advisories. NEVER publish copy-paste exploit payloads designed to bypass safety controls for harm; instead show detection rules, architectural isolation patterns, guardrail latency benchmarks, and mitigation code.',
    research_feeds_json: ['arxiv_ai_sec', 'github_advisories', 'cisa_kev'],
    search_queries_json: [
      'LLM prompt injection defense benchmark guardrail evaluation',
      'OWASP LLM Top 10 agent tool-calling security mitigation',
      'jailbreak red teaming taxonomy defense arxiv paper',
    ],
    preferred_archetypes_json: ['advisory-teardown', 'architecture-analysis'],
    required_sections_json: [
      'Threat Model & Mechanism',
      'Observed Failure Vectors (Defensive Analysis)',
      'Guardrail & Mitigation Architecture',
      'Verification & Hardening Checklist',
    ],
    quality_rubric_json: {
      min_primary_sources: 3,
      require_table_or_code: true,
      min_words: 650,
      geo_faq_count: 3,
    },
    banned_patterns_json: [],
    created_at: SEED_TIMESTAMP,
    updated_at: SEED_TIMESTAMP,
  },
  {
    id: 3,
    slug: 'cloud-gpu-infra',
    name: 'Cloud, Edge & GPU Infrastructure',
    description:
      'Serverless edge runtimes, Cloudflare Workers economics, spot GPU cluster pricing, Postgres scaling, and latency architecture studies.',
    enabled: true,
    priority: 85,
    target_audience:
      'Platform engineers, SREs, and CTOs optimizing cloud spend and edge latency',
    system_instructions:
      'Ground every architectural claim in documented vendor limits, concrete pricing tables, cold-start numbers, and real deployment configs (wrangler.jsonc, SQL, Terraform, or CLI commands). Highlight hidden billing traps and migration tradeoffs.',
    research_feeds_json: ['hn_top_infra', 'github_advisories'],
    search_queries_json: [
      'Cloudflare Workers Workflows limits latency benchmark',
      'cloud GPU spot pricing H100 B200 hourly comparison',
      'serverless Postgres connection pooling cold start latency',
    ],
    preferred_archetypes_json: ['benchmark-index', 'migration-fix-log'],
    required_sections_json: [
      'Runtime & Cost Breakdown Table',
      'Bottleneck Analysis',
      'Production Configuration',
      'When NOT to Use This Stack',
    ],
    quality_rubric_json: {
      min_primary_sources: 3,
      require_table_or_code: true,
      min_words: 600,
      geo_faq_count: 3,
    },
    banned_patterns_json: [],
    created_at: SEED_TIMESTAMP,
    updated_at: SEED_TIMESTAMP,
  },
  {
    id: 4,
    slug: 'dev-tooling-benchmarks',
    name: 'Security Advisories & Dev Tooling',
    description:
      'High-urgency CVE teardowns, CISA KEV patch logs, framework migration postmortems, and runtime performance comparisons.',
    enabled: true,
    priority: 80,
    target_audience:
      'Full-stack developers, DevSecOps teams, and engineering leads',
    system_instructions:
      'Lead with exact affected versions, fixed versions, CVSS/KEV status, and a copy-paste remediation diff or command. Verify every package version and advisory URL from primary vendor disclosures before writing.',
    research_feeds_json: ['cisa_kev', 'github_advisories', 'hn_top_infra'],
    search_queries_json: [
      'CISA KEV newly added web cloud vulnerability remediation',
      'GitHub Security Advisory critical npm python patch analysis',
    ],
    preferred_archetypes_json: ['advisory-teardown', 'migration-fix-log'],
    required_sections_json: [
      'Affected Versions & Blast Radius Table',
      'Root Cause Analysis',
      'Exact Patch & Verification Commands',
      'Detection & Regression Guard',
    ],
    quality_rubric_json: {
      min_primary_sources: 3,
      require_table_or_code: true,
      min_words: 550,
      geo_faq_count: 3,
    },
    banned_patterns_json: [],
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

function normalizeSettingsRow(row: Partial<SiteSettings>): SiteSettings {
  return {
    ...DEFAULT_SEEDED_SETTINGS,
    ...row,
    id: 1,
    min_publish_score: Number(row.min_publish_score ?? DEFAULT_SEEDED_SETTINGS.min_publish_score),
    runs_per_day: Number(row.runs_per_day ?? DEFAULT_SEEDED_SETTINGS.runs_per_day),
    schedule_enabled: Boolean(row.schedule_enabled ?? DEFAULT_SEEDED_SETTINGS.schedule_enabled),
    adsense_client_id: row.adsense_client_id ?? null,
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

function normalizePostRow(row: PostRecord): PostRecord {
  return {
    ...row,
    id: Number(row.id),
    tldr_summary: row.tldr_summary ?? '',
    key_facts_json: Array.isArray(row.key_facts_json) ? row.key_facts_json : [],
    faq_json: Array.isArray(row.faq_json) ? row.faq_json : [],
    tags_json: Array.isArray(row.tags_json) ? row.tags_json : [],
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
    published_at: row.published_at ?? null,
  };
}

function normalizeAgentRunRow(row: AgentRunRecord): AgentRunRecord {
  return {
    ...row,
    id: Number(row.id),
    workflow_instance_id: row.workflow_instance_id ?? null,
    trace_json: Array.isArray(row.trace_json) ? row.trace_json : [],
    quality_score: row.quality_score === null || row.quality_score === undefined
      ? null
      : Number(row.quality_score),
    post_id: row.post_id === null || row.post_id === undefined ? null : Number(row.post_id),
    token_usage_json:
      row.token_usage_json && typeof row.token_usage_json === 'object' ? row.token_usage_json : {},
    error_message: row.error_message ?? null,
    completed_at: row.completed_at ?? null,
  };
}

function sanitizePostgrestSearchToken(input: string): string {
  // Strip PostgREST filter syntax delimiters to prevent filter injection
  return input.replace(/[(),*"'\\]/g, ' ').replace(/\s+/g, ' ').trim();
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
    const { data } = await this.requestJson<SiteSettings[]>(
      '/site_settings?id=eq.1&select=*&limit=1',
    );
    if (data && data.length > 0) {
      return normalizeSettingsRow(data[0]);
    }
    const { data: seeded } = await this.requestJson<SiteSettings[]>('/site_settings?on_conflict=id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: { id: 1 },
    });
    return seeded && seeded.length > 0
      ? normalizeSettingsRow(seeded[0])
      : structuredClone(DEFAULT_SEEDED_SETTINGS);
  }

  async updateSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
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
    return upserted && upserted.length > 0
      ? normalizeSettingsRow(upserted[0])
      : normalizeSettingsRow(payload);
  }

  // Skills
  async listSkills(onlyEnabled = false): Promise<CategorySkill[]> {
    const filter = onlyEnabled ? '&enabled=eq.true' : '';
    const { data } = await this.requestJson<CategorySkill[]>(
      `/category_skills?select=*${filter}&order=priority.desc,slug.asc`,
    );
    return (data ?? []).map(normalizeSkillRow);
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
    if (!data || data.length === 0) {
      throw new Error(`Failed to upsert skill "${cleanSlug}"`);
    }
    return normalizeSkillRow(data[0]);
  }

  async deleteSkill(slug: string): Promise<boolean> {
    const { data } = await this.requestJson<CategorySkill[]>(
      `/category_skills?slug=eq.${encodeURIComponent(slug)}`,
      {
        method: 'DELETE',
        prefer: 'return=representation',
      },
    );
    return Array.isArray(data) && data.length > 0;
  }

  // Posts
  async listPosts(opts?: {
    status?: PostStatus;
    category_slug?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<PostRecord[]> {
    const params: string[] = ['select=*'];
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
          `or=(title.ilike.${pattern},description.ilike.${pattern},tldr_summary.ilike.${pattern})`,
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

  async createPost(
    record: Omit<PostRecord, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<PostRecord> {
    const { data } = await this.requestJson<PostRecord[]>('/posts', {
      method: 'POST',
      prefer: 'return=representation',
      body: record,
    });
    if (!data || data.length === 0) {
      throw new Error('Failed to create post: empty response from Supabase');
    }
    return normalizePostRow(data[0]);
  }

  async updatePost(id: number, patch: Partial<PostRecord>): Promise<PostRecord | null> {
    const { id: _ignoreId, created_at: _ignoreCreated, ...rest } = patch;
    const { data } = await this.requestJson<PostRecord[]>(
      `/posts?id=eq.${encodeURIComponent(String(id))}`,
      {
        method: 'PATCH',
        prefer: 'return=representation',
        body: {
          ...rest,
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
  }): Promise<AgentRunRecord> {
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
        status: run.status ?? 'running',
        current_stage: run.current_stage ?? 'initializing',
        trace_json: [],
        quality_score: null,
        post_id: null,
        token_usage_json: {},
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
          p.body_markdown.toLowerCase().includes(query) ||
          p.tags_json.some((t) => t.toLowerCase().includes(query)),
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
    return items.slice(offset, offset + limit).map((p) => structuredClone(p));
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

  async createPost(
    record: Omit<PostRecord, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<PostRecord> {
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

  async updatePost(id: number, patch: Partial<PostRecord>): Promise<PostRecord | null> {
    const existing = this.posts.get(id);
    if (!existing) return null;

    if (patch.slug && patch.slug !== existing.slug && (await this.slugExists(patch.slug, id))) {
      throw new Error(`Post with slug "${patch.slug}" already exists`);
    }

    const { id: _ignoreId, created_at: _ignoreCreated, ...rest } = patch;
    const updated = normalizePostRow({
      ...existing,
      ...structuredClone(rest),
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
  }): Promise<AgentRunRecord> {
    const now = new Date().toISOString();
    const created: AgentRunRecord = {
      id: this.nextRunId++,
      workflow_instance_id: run.workflow_instance_id ?? null,
      trigger_source: run.trigger_source,
      category_slug: run.category_slug,
      topic: run.topic,
      archetype: run.archetype,
      model_used: run.model_used,
      status: run.status ?? 'running',
      current_stage: run.current_stage ?? 'initializing',
      trace_json: [],
      quality_score: null,
      post_id: null,
      token_usage_json: {},
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
