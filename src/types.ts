export type PublishingMode = 'draft_review' | 'auto_publish';
export type PostStatus = 'draft' | 'published';
export type Archetype =
  | 'advisory-teardown'
  | 'benchmark-index'
  | 'migration-fix-log'
  | 'architecture-analysis';

export type AgentRunStatus = 'queued' | 'running' | 'completed' | 'failed';
export type TriggerSource = 'manual' | 'scheduled' | 'api';

export interface AdminUser {
  id: number;
  email: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  failed_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteSettings {
  id: number;
  publishing_mode: PublishingMode;
  min_publish_score: number;
  schedule_enabled: boolean;
  runs_per_day: number;
  openrouter_model: string;
  judge_model: string;
  default_topic_feed: string;
  default_author: string;
  author_bio: string;
  site_name: string;
  site_tagline: string;
  base_url: string;
  adsense_client_id: string | null;
  cta_headline: string;
  cta_body: string;
  cta_url: string;
  contact_email: string;
  last_scheduled_run_at: string | null;
  updated_at: string;
}

export interface CategorySkill {
  id: number;
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  target_audience: string;
  system_instructions: string;
  research_feeds_json: string[];
  search_queries_json: string[];
  preferred_archetypes_json: Archetype[];
  required_sections_json: string[];
  quality_rubric_json: Record<string, unknown>;
  banned_patterns_json: string[];
  created_at: string;
  updated_at: string;
}

export interface KeyFact {
  label: string;
  value: string;
  source_url?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface QualityBreakdown {
  overall: number;
  seo_structure: number;
  geo_citation_readiness: number;
  information_gain: number;
  source_grounding: number;
  anti_slop_cleanliness: number;
  adsense_compliance: number;
  warnings: string[];
  judge_notes?: string;
}

export interface PostRecord {
  id: number;
  slug: string;
  title: string;
  description: string;
  tldr_summary: string;
  key_facts_json: KeyFact[];
  faq_json: FaqItem[];
  body_markdown: string;
  body_html: string;
  author: string;
  category_slug: string;
  archetype: Archetype;
  tags_json: string[];
  sources_json: string[];
  review_notes_json: string[];
  lint_passed: boolean;
  lint_errors_json: string[];
  quality_score: number;
  quality_breakdown_json: QualityBreakdown;
  reading_time_minutes: number;
  word_count: number;
  status: PostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TraceEntry {
  timestamp: string;
  stage: string;
  tool_name: string;
  input: string;
  url?: string;
  summary: string;
  chars_extracted?: number;
  ok: boolean;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  calls: number;
}

export interface AgentRunRecord {
  id: number;
  workflow_instance_id: string | null;
  trigger_source: TriggerSource;
  category_slug: string;
  topic: string;
  archetype: string;
  model_used: string;
  status: AgentRunStatus;
  current_stage: string;
  trace_json: TraceEntry[];
  quality_score: number | null;
  post_id: number | null;
  token_usage_json: Partial<TokenUsage>;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface PostInput {
  slug?: string;
  title: string;
  description: string;
  tldr_summary?: string;
  key_facts?: KeyFact[];
  faq?: FaqItem[];
  body_markdown: string;
  author?: string;
  category_slug?: string;
  archetype: Archetype;
  tags?: string[];
  sources?: string[];
  review_notes?: string[];
  status?: PostStatus | null;
}

export interface LintResult {
  passed: boolean;
  errors: string[];
  quality_score: number;
  quality_breakdown: QualityBreakdown;
  word_count: number;
  reading_time_minutes: number;
}

export interface AgentDispatchPayload {
  topic?: string;
  category_slug?: string;
  archetype?: Archetype | 'auto';
  trigger_source?: TriggerSource;
  model_override?: string;
  run_id?: number;
}

export interface DatabaseAdapter {
  // Admin User (single-admin lock)
  getAdminUser(): Promise<AdminUser | null>;
  createSingleAdminUser(data: {
    email: string;
    display_name: string;
    password_hash: string;
    password_salt: string;
  }): Promise<AdminUser>;
  updateAdminLoginState(patch: Partial<Pick<AdminUser, 'failed_attempts' | 'locked_until' | 'last_login_at'>>): Promise<void>;

  // Settings
  getSettings(): Promise<SiteSettings>;
  updateSettings(patch: Partial<SiteSettings>): Promise<SiteSettings>;

  // Skills
  listSkills(onlyEnabled?: boolean): Promise<CategorySkill[]>;
  getSkillBySlug(slug: string): Promise<CategorySkill | null>;
  upsertSkill(skill: Partial<CategorySkill> & { slug: string; name: string; description: string; system_instructions: string }): Promise<CategorySkill>;
  deleteSkill(slug: string): Promise<boolean>;

  // Posts
  listPosts(opts?: { status?: PostStatus; category_slug?: string; limit?: number; offset?: number; search?: string }): Promise<PostRecord[]>;
  countPosts(opts?: { status?: PostStatus; category_slug?: string }): Promise<number>;
  getPostById(id: number): Promise<PostRecord | null>;
  getPostBySlug(slug: string, onlyPublished?: boolean): Promise<PostRecord | null>;
  slugExists(slug: string, excludeId?: number): Promise<boolean>;
  createPost(record: Omit<PostRecord, 'id' | 'created_at' | 'updated_at'>): Promise<PostRecord>;
  updatePost(id: number, patch: Partial<PostRecord>): Promise<PostRecord | null>;
  deletePost(id: number): Promise<boolean>;

  // Agent Runs
  listAgentRuns(limit?: number): Promise<AgentRunRecord[]>;
  getAgentRunById(id: number): Promise<AgentRunRecord | null>;
  createAgentRun(run: {
    workflow_instance_id?: string | null;
    trigger_source: TriggerSource;
    category_slug: string;
    topic: string;
    archetype: string;
    model_used: string;
    status?: AgentRunStatus;
    current_stage?: string;
  }): Promise<AgentRunRecord>;
  updateAgentRun(id: number, patch: Partial<AgentRunRecord>): Promise<AgentRunRecord | null>;
}
