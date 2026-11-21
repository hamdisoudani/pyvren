import type { WorkerEnv } from '../env';
import type {
  AgentDispatchPayload,
  AgentRunRecord,
  Archetype,
  CategorySkill,
  DatabaseAdapter,
  DualCriticEntry,
  DualCriticReviewSummary,
  FaqItem,
  KeyFact,
  LintResult,
  PostImage,
  PostRecord,
  PostStatus,
  QualityBreakdown,
  SiteSettings,
  TokenUsage,
  TraceEntry,
  TriggerSource,
} from '../types';
import { ensureUniqueSlug } from './db';
import {
  filterUncoveredCandidates,
  findDuplicatePost,
  normalizeCanonicalUrl,
} from './dedup';
import { lintPostPayload } from './linter';
import { compileMarkdown } from './markdown';
import {
  CURATED_FREE_MODELS,
  callOpenRouter,
  extractJsonObject,
  getFastestHealthyModelsFromCache,
  getOpenRouterModelFamily,
  pickDistinctFreeCriticPair,
  probeWorkingModelPool,
  resolveFreeModelChain,
} from './openrouter';
import { isSafePublicUrl, slugify } from './security';
import { buildSkillSystemPrompt, selectArchetype, selectSkillForRun } from './skills';
import {
  fetchAuthoritativeFeed,
  isValidReferenceImageUrl,
  readPrimaryWebpage,
  searchWebSources,
  type ExtractedWebImage,
  type FeedItem,
  type SearchSourceItem,
} from './tools';

export interface AgentContext {
  settings: SiteSettings;
  skill: CategorySkill;
  archetype: Archetype;
  model: string;
  judgeModel: string;
  fastestModels?: string[];
  recentTitles: string[];
  recentSlugs: string[];
  recentPosts: PostRecord[];
  recentRunTopics: string[];
  postsCreatedLast24h: number;
  categoryPostsCreatedLast24h: number;
  forceWrite: boolean;
  triggerSource: TriggerSource;
}

export type TopicHuntDecision =
  | 'publish_worthy'
  | 'skip_no_news'
  | 'skip_already_covered'
  | 'skip_daily_cap';

export interface TopicHuntOutput {
  decision: TopicHuntDecision;
  noveltyScore: number;
  skipReason?: string;
  topic: string;
  angle: string;
  searchQueries: string[];
  feedItems: FeedItem[];
  resolvedModel?: string;
  fastestModels?: string[];
}

export interface PrimarySourceDoc {
  url: string;
  title: string;
  markdown: string;
  chars: number;
  snippet?: string;
  images?: ExtractedWebImage[];
}

export interface DraftArticlePayload {
  title: string;
  slug: string;
  description: string;
  tldr_summary: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  images: PostImage[];
  key_facts: KeyFact[];
  faq: FaqItem[];
  body_markdown: string;
  tags: string[];
  keywords: string[];
  sources: string[];
  review_notes: string[];
}

export interface DraftAndRefineOutput {
  draft: DraftArticlePayload;
  lintResult: LintResult;
  attempts: number;
  resolvedModel?: string;
}

export interface QualityAssessmentOutput {
  finalScore: number;
  finalBreakdown: QualityBreakdown;
  resolvedJudgeModel?: string;
  revisedDraft?: DraftArticlePayload;
  revisedLintResult?: LintResult;
}

export interface PersistGateOutput {
  post: PostRecord;
  run: AgentRunRecord | null;
}

export function createEmptyTokenUsage(): TokenUsage {
  return {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    calls: 0,
  };
}

function addTokenUsage(
  target: TokenUsage,
  delta: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
): void {
  target.prompt_tokens += delta.prompt_tokens || 0;
  target.completion_tokens += delta.completion_tokens || 0;
  target.total_tokens += delta.total_tokens || 0;
  target.calls += 1;
}

function pushTrace(trace: TraceEntry[], entry: Omit<TraceEntry, 'timestamp'>): void {
  trace.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isDeepUrl(rawUrl: string): boolean {
  const check = isSafePublicUrl(rawUrl);
  if (!check.ok || !check.url) return false;
  if (check.url.protocol !== 'https:') return false;
  const trimmedPath = check.url.pathname.replace(/\/+$/, '');
  return check.url.pathname.length > 1 && trimmedPath.length > 0;
}

const KEYWORD_STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'into',
  'onto',
  'over',
  'under',
  'about',
  'using',
  'used',
  'how',
  'why',
  'what',
  'when',
  'where',
  'your',
  'their',
  'more',
  'most',
  'less',
  'than',
  'then',
  'will',
  'should',
  'could',
  'would',
  'have',
  'been',
  'being',
  'does',
  'without',
  'versus',
]);

function deriveCleanKeywords(
  rawKeywords: unknown,
  tags: string[],
  title: string,
  fallbackTopic: string,
): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  const pushKeyword = (value: string) => {
    const cleaned = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.\-+/# ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 64);
    if (cleaned.length < 2 || seen.has(cleaned)) return;
    seen.add(cleaned);
    normalized.push(cleaned);
  };

  if (Array.isArray(rawKeywords)) {
    for (const kw of rawKeywords) {
      if (typeof kw === 'string' && kw.trim().length > 0) {
        pushKeyword(kw);
      }
      if (normalized.length >= 8) break;
    }
  }

  // Backfill from tags (converting kebab-case to natural search phrases)
  if (normalized.length < 5) {
    for (const tag of tags) {
      pushKeyword(tag.replace(/-/g, ' '));
      if (normalized.length >= 8) break;
    }
  }

  // Backfill from title & fallback topic phrases if still short
  if (normalized.length < 5) {
    const tokens = `${title} ${fallbackTopic}`
      .toLowerCase()
      .replace(/[^a-z0-9.\-+/# ]+/g, ' ')
      .split(/\s+/)
      .filter((tok) => tok.length >= 3 && !KEYWORD_STOP_WORDS.has(tok));

    for (let i = 0; i < tokens.length - 1 && normalized.length < 6; i++) {
      pushKeyword(`${tokens[i]} ${tokens[i + 1]}`);
    }
    for (const tok of tokens) {
      if (normalized.length >= 8) break;
      pushKeyword(tok);
    }
  }

  return normalized.slice(0, 8);
}

function collectCrawledImages(primarySources: PrimarySourceDoc[]): ExtractedWebImage[] {
  const seen = new Set<string>();
  const out: ExtractedWebImage[] = [];
  for (const doc of primarySources) {
    if (!Array.isArray(doc.images)) continue;
    for (const img of doc.images) {
      if (!img?.url || seen.has(img.url)) continue;
      const check = isValidReferenceImageUrl(img.url, img.alt);
      if (!check.ok) continue;
      seen.add(check.url);
      out.push({
        url: check.url,
        alt: (img.alt || doc.title || 'Primary source figure').trim().slice(0, 220),
        ...(img.caption ? { caption: img.caption.trim().slice(0, 240) } : {}),
        source_page_url: img.source_page_url || doc.url,
      });
      if (out.length >= 10) return out;
    }
  }
  return out;
}

function normalizeDraftPayload(
  raw: Partial<DraftArticlePayload>,
  fallbackTopic: string,
  primarySources: PrimarySourceDoc[],
): DraftArticlePayload {
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : fallbackTopic.slice(0, 68);
  const slugSource = typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug.trim() : title;
  const slug = slugify(slugSource, 80) || slugify(title, 80) || 'technical-briefing';
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  const tldr_summary = typeof raw.tldr_summary === 'string' ? raw.tldr_summary.trim() : '';
  let body_markdown = typeof raw.body_markdown === 'string' ? raw.body_markdown.trim() : '';

  const crawledImages = collectCrawledImages(primarySources);
  const crawledUrlMap = new Map<string, ExtractedWebImage>(
    crawledImages.map((img) => [img.url, img]),
  );
  const allowedSourceHosts = new Set<string>();
  for (const doc of primarySources) {
    try {
      allowedSourceHosts.add(new URL(doc.url).hostname.toLowerCase());
    } catch {
      // ignore
    }
  }

  const isTrustedDraftImage = (rawUrl: string, altText = ''): { ok: boolean; url: string } => {
    const check = isValidReferenceImageUrl(rawUrl, altText);
    if (!check.ok) return { ok: false, url: '' };
    if (crawledUrlMap.has(check.url)) return { ok: true, url: check.url };
    // Allow images hosted on the same domain/CDN as a crawled primary source or opengraph.githubassets.com
    try {
      const host = new URL(check.url).hostname.toLowerCase();
      if (host === 'opengraph.githubassets.com' || allowedSourceHosts.has(host)) {
        return { ok: true, url: check.url };
      }
      for (const srcHost of allowedSourceHosts) {
        const rootParts = srcHost.split('.').slice(-2).join('.');
        if (rootParts.length >= 4 && host.endsWith(rootParts)) {
          return { ok: true, url: check.url };
        }
      }
    } catch {
      return { ok: false, url: '' };
    }
    return crawledUrlMap.size === 0 && allowedSourceHosts.size === 0
      ? { ok: true, url: check.url }
      : { ok: false, url: '' };
  };

  // Sanitize inline ![alt](url) in body_markdown so hallucinated/broken image URLs never appear
  body_markdown = body_markdown
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (full, alt: string, url: string) => {
      const trusted = isTrustedDraftImage(url, alt);
      if (!trusted.ok) return '';
      const cleanAlt = (alt || title).trim().replace(/[\[\]]/g, '');
      return `![${cleanAlt}](${trusted.url})`;
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const images: PostImage[] = [];
  const seenImgUrls = new Set<string>();
  if (Array.isArray(raw.images)) {
    for (const item of raw.images) {
      if (!item || typeof item !== 'object') continue;
      const candidateUrl = typeof item.url === 'string' ? item.url.trim() : '';
      const candidateAlt = typeof item.alt === 'string' ? item.alt.trim() : '';
      const trusted = isTrustedDraftImage(candidateUrl, candidateAlt);
      if (!trusted.ok || seenImgUrls.has(trusted.url)) continue;
      seenImgUrls.add(trusted.url);
      const crawledMeta = crawledUrlMap.get(trusted.url);
      images.push({
        url: trusted.url,
        alt: (candidateAlt || crawledMeta?.alt || title).slice(0, 220),
        ...(typeof item.caption === 'string' && item.caption.trim()
          ? { caption: item.caption.trim().slice(0, 240) }
          : crawledMeta?.caption
            ? { caption: crawledMeta.caption }
            : {}),
        ...(typeof item.source_page_url === 'string' && isDeepUrl(item.source_page_url)
          ? { source_page_url: item.source_page_url.trim() }
          : crawledMeta?.source_page_url
            ? { source_page_url: crawledMeta.source_page_url }
            : {}),
      });
      if (images.length >= 6) break;
    }
  }

  // Backfill up to 4 verified crawled reference images if the LLM omitted the images array
  if (images.length === 0 && crawledImages.length > 0) {
    for (const crawled of crawledImages.slice(0, 4)) {
      if (seenImgUrls.has(crawled.url)) continue;
      seenImgUrls.add(crawled.url);
      images.push({
        url: crawled.url,
        alt: crawled.alt,
        ...(crawled.caption ? { caption: crawled.caption } : {}),
        source_page_url: crawled.source_page_url,
      });
    }
  }

  let cover_image_url: string | null = null;
  let cover_image_alt: string | null = null;
  if (typeof raw.cover_image_url === 'string' && raw.cover_image_url.trim()) {
    const rawCoverAlt = typeof raw.cover_image_alt === 'string' ? raw.cover_image_alt.trim() : '';
    const trustedCover = isTrustedDraftImage(raw.cover_image_url, rawCoverAlt);
    if (trustedCover.ok) {
      cover_image_url = trustedCover.url;
      cover_image_alt =
        (rawCoverAlt || crawledUrlMap.get(trustedCover.url)?.alt || title).slice(0, 220);
    }
  }
  if (!cover_image_url && images.length > 0) {
    cover_image_url = images[0].url;
    cover_image_alt = images[0].alt || title;
  }

  const key_facts: KeyFact[] = Array.isArray(raw.key_facts)
    ? raw.key_facts
        .filter(
          (kf): kf is KeyFact =>
            Boolean(kf) &&
            typeof kf.label === 'string' &&
            kf.label.trim().length > 0 &&
            typeof kf.value === 'string' &&
            kf.value.trim().length > 0,
        )
        .map((kf) => ({
          label: kf.label.trim(),
          value: kf.value.trim(),
          ...(typeof kf.source_url === 'string' && isDeepUrl(kf.source_url)
            ? { source_url: kf.source_url.trim() }
            : {}),
        }))
        .slice(0, 8)
    : [];

  const faq: FaqItem[] = Array.isArray(raw.faq)
    ? raw.faq
        .filter(
          (item): item is FaqItem =>
            Boolean(item) &&
            typeof item.question === 'string' &&
            item.question.trim().length > 0 &&
            typeof item.answer === 'string' &&
            item.answer.trim().length > 0,
        )
        .map((item) => ({
          question: item.question.trim(),
          answer: item.answer.trim(),
        }))
        .slice(0, 6)
    : [];

  const tags: string[] = Array.isArray(raw.tags)
    ? Array.from(
        new Set(
          raw.tags
            .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
            .map((t) => slugify(t.trim(), 32))
            .filter(Boolean),
        ),
      ).slice(0, 8)
    : [];

  const keywords = deriveCleanKeywords(raw.keywords, tags, title, fallbackTopic);

  const sourceSet = new Set<string>();
  if (Array.isArray(raw.sources)) {
    for (const s of raw.sources) {
      if (typeof s === 'string' && isDeepUrl(s)) {
        sourceSet.add(s.trim());
      }
    }
  }
  // Backfill verified primary source URLs if the LLM omitted them from the sources array
  if (sourceSet.size < 2) {
    for (const doc of primarySources) {
      if (isDeepUrl(doc.url)) {
        sourceSet.add(doc.url);
      }
      if (sourceSet.size >= 4) break;
    }
  }

  const review_notes: string[] = Array.isArray(raw.review_notes)
    ? raw.review_notes
        .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
        .map((n) => n.trim())
        .slice(0, 6)
    : [];

  return {
    title,
    slug,
    description,
    tldr_summary,
    cover_image_url,
    cover_image_alt,
    images,
    key_facts,
    faq,
    body_markdown,
    tags,
    keywords,
    sources: Array.from(sourceSet).slice(0, 10),
    review_notes,
  };
}

/**
 * Stage 1: Load site settings, select category skill & archetype, and load recent posts + runs for editorial memory & dedup.
 */
export async function stageLoadContext(
  db: DatabaseAdapter,
  payload: AgentDispatchPayload,
): Promise<AgentContext> {
  const [settings, skills, rawRecentPosts, recentRuns] = await Promise.all([
    db.getSettings(),
    db.listSkills(false),
    db.listPosts({ limit: 100, excludeHeavyHtml: true }),
    db.listAgentRuns(50),
  ]);

  const recentPosts: PostRecord[] = rawRecentPosts.map((p) => ({
    ...p,
    body_markdown: '',
    body_html: '',
  }));

  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
  const postsLast24hRecords = rawRecentPosts.filter((p) => {
    const ts = Date.parse(p.created_at);
    return Number.isFinite(ts) && ts >= cutoff24h;
  });
  const postsCreatedLast24h = postsLast24hRecords.length;

  const recentRunTopics = Array.from(
    new Set(
      recentRuns
        .filter((r) => r.status === 'completed' && typeof r.topic === 'string')
        .map((r) => r.topic.trim())
        .filter(
          (t) =>
            t.length > 0 &&
            t.toLowerCase() !== 'auto' &&
            t.toLowerCase() !== 'scheduled autonomous briefing' &&
            !t.toLowerCase().startsWith('skipped'),
        ),
    ),
  ).slice(0, 30);

  const maxPostsPerCategory = Math.max(1, settings.max_posts_per_day || 2);
  const skill = selectSkillForRun(
    skills,
    payload.category_slug,
    recentPosts,
    maxPostsPerCategory,
    recentRuns,
  );
  const categoryPostsCreatedLast24h = postsLast24hRecords.filter(
    (p) => (p.category_slug || '').trim().toLowerCase() === skill.slug.toLowerCase(),
  ).length;

  const lastArchetype = recentPosts[0]?.archetype;
  const archetype = selectArchetype(skill, payload.archetype, lastArchetype);
  const freeModelsOnly = settings.free_models_only !== false;
  const requestedModel =
    payload.model_override?.trim() ||
    settings.openrouter_model?.trim() ||
    CURATED_FREE_MODELS[0];
  const model = resolveFreeModelChain(requestedModel, freeModelsOnly)[0] || CURATED_FREE_MODELS[0];
  const requestedJudge = settings.judge_model?.trim() || model;
  const judgeModel = resolveFreeModelChain(requestedJudge, freeModelsOnly)[0] || model;

  return {
    settings,
    skill,
    archetype,
    model,
    judgeModel,
    recentTitles: recentPosts.map((p) => p.title).slice(0, 25),
    recentSlugs: recentPosts.map((p) => p.slug).slice(0, 25),
    recentPosts,
    recentRunTopics,
    postsCreatedLast24h,
    categoryPostsCreatedLast24h,
    forceWrite: Boolean(payload.force),
    triggerSource: payload.trigger_source || 'manual',
  };
}

/**
 * Stage 2: Enforce per-category daily post cap, query real-time category feeds + recency-filtered news search,
 * filter uncovered candidates, and run skeptical Editor-in-Chief LLM triage + deterministic duplicate gates.
 */
function getConfiguredFallbackModels(settings: SiteSettings): string[] {
  return [settings.fallback_model_1, settings.fallback_model_2]
    .map((m) => (typeof m === 'string' ? m.trim() : ''))
    .filter(Boolean);
}

function getEffectiveFallbackModels(ctx: AgentContext): string[] {
  const configured = getConfiguredFallbackModels(ctx.settings);
  const fastest = Array.isArray(ctx.fastestModels)
    ? ctx.fastestModels
    : getFastestHealthyModelsFromCache();
  return Array.from(new Set([...configured, ...fastest])).filter((m) => m && m !== ctx.model);
}

export async function stageHuntTopics(
  env: WorkerEnv,
  ctx: AgentContext,
  requestedTopic: string | undefined,
  trace: TraceEntry[],
  usage: TokenUsage,
): Promise<TopicHuntOutput> {
  const cleanRequested = (requestedTopic || '').trim();
  const lowerRequested = cleanRequested.toLowerCase();
  const hasExplicitTopic = Boolean(
    cleanRequested.length > 0 &&
      lowerRequested !== 'scheduled autonomous briefing' &&
      lowerRequested !== 'auto',
  );
  const mustEnforceNewsGate = !ctx.forceWrite && !hasExplicitTopic;

  // Guard 1 (Per-Category Daily Cap on Scheduled Runs)
  const maxPostsPerCategory = Math.max(1, ctx.settings.max_posts_per_day || 2);
  if (
    ctx.triggerSource === 'scheduled' &&
    !ctx.forceWrite &&
    ctx.categoryPostsCreatedLast24h >= maxPostsPerCategory
  ) {
    const skipReason = `Per-category daily cap (${maxPostsPerCategory}/day) already reached for "${ctx.skill.slug}" (${ctx.categoryPostsCreatedLast24h}/${maxPostsPerCategory}) in the last 24 hours.`;
    pushTrace(trace, {
      stage: 'hunt_topics',
      tool_name: 'editorial_daily_cap_gate',
      input: `${ctx.skill.slug}: ${ctx.categoryPostsCreatedLast24h}/${maxPostsPerCategory}`,
      summary: skipReason,
      ok: true,
    });
    return {
      decision: 'skip_daily_cap',
      noveltyScore: 0,
      skipReason,
      topic: 'Skipped (Category Daily Cap)',
      angle: '',
      searchQueries: [],
      feedItems: [],
    };
  }

  const feedNames = (ctx.skill.research_feeds_json || []).slice(0, 5);
  const feedResults = await Promise.all(
    feedNames.map((feed) => fetchAuthoritativeFeed(feed, trace)),
  );
  const rawFeedItems: FeedItem[] = feedResults.flat().slice(0, 32);

  const seedQueries = hasExplicitTopic
    ? [cleanRequested]
    : (ctx.skill.search_queries_json || []).slice(0, 2);

  const shouldSearchSeed =
    hasExplicitTopic || Boolean(env.SERPER_API_KEY?.trim()) || rawFeedItems.length < 3;
  const rawSearchHits: SearchSourceItem[] = shouldSearchSeed
    ? (
        await Promise.all(
          seedQueries.map((q) =>
            searchWebSources(q, env, trace, { freshness: 'week', mode: 'news' }),
          ),
        )
      ).flat()
    : [];

  type TaggedCandidate =
    | ({ _sourceKind: 'feed' } & FeedItem)
    | ({ _sourceKind: 'search' } & SearchSourceItem);

  const allCandidates: TaggedCandidate[] = [
    ...rawFeedItems.map((item) => ({ ...item, _sourceKind: 'feed' as const })),
    ...rawSearchHits.map((hit) => ({ ...hit, _sourceKind: 'search' as const })),
  ];

  const { fresh: uncoveredCandidates, filteredOutCount } = filterUncoveredCandidates(
    allCandidates,
    ctx.recentPosts,
    ctx.recentRunTopics,
  );

  const uncoveredFeedItems: FeedItem[] = uncoveredCandidates
    .filter((c): c is { _sourceKind: 'feed' } & FeedItem => c._sourceKind === 'feed')
    .map(({ _sourceKind: _ignore, ...rest }) => rest);

  const uncoveredSearchHits: SearchSourceItem[] = uncoveredCandidates
    .filter((c): c is { _sourceKind: 'search' } & SearchSourceItem => c._sourceKind === 'search')
    .map(({ _sourceKind: _ignore, ...rest }) => rest);

  pushTrace(trace, {
    stage: 'hunt_topics',
    tool_name: 'filterUncoveredCandidates',
    input: `${allCandidates.length} candidates (${rawFeedItems.length} feed, ${rawSearchHits.length} search)`,
    summary: `Filtered out ${filteredOutCount} already-covered/duplicate item(s); ${uncoveredFeedItems.length} fresh feed items and ${uncoveredSearchHits.length} fresh search hits remain`,
    ok: true,
  });

  // Guard 2 (Zero Uncovered News Fast Skip — 0 LLM tokens burned!)
  if (
    mustEnforceNewsGate &&
    uncoveredFeedItems.length === 0 &&
    uncoveredSearchHits.length === 0
  ) {
    const skipReason = `No fresh uncovered news or primary releases found for category "${ctx.skill.slug}".`;
    pushTrace(trace, {
      stage: 'hunt_topics',
      tool_name: 'editorial_news_gate',
      input: ctx.skill.slug,
      summary: skipReason,
      ok: true,
    });
    return {
      decision: 'skip_no_news',
      noveltyScore: 0,
      skipReason,
      topic: 'Skipped (No Fresh News)',
      angle: '',
      searchQueries: [],
      feedItems: [],
    };
  }

  const feedItems = uncoveredFeedItems.length > 0 ? uncoveredFeedItems : rawFeedItems.slice(0, 10);

  const feedDigest = uncoveredFeedItems
    .slice(0, 16)
    .map(
      (item, i) =>
        `[${i + 1}] ${item.title} (${item.published || 'recent'})\nURL: ${item.url}\nSummary: ${item.summary.slice(0, 220)}`,
    )
    .join('\n\n');

  const searchDigest = uncoveredSearchHits
    .slice(0, 10)
    .map((hit, i) => `[S${i + 1}] ${hit.title}\nURL: ${hit.url}\nSnippet: ${hit.snippet}`)
    .join('\n\n');

  const editorialMemoryLedger =
    ctx.recentPosts.length > 0
      ? ctx.recentPosts
          .slice(0, 25)
          .map((p) => {
            const kws =
              Array.isArray(p.keywords_json) && p.keywords_json.length > 0
                ? p.keywords_json.slice(0, 6).join(', ')
                : (p.tags_json || []).slice(0, 5).join(', ') || 'none';
            return `- [${p.category_slug}] ${p.title} — Keywords: ${kws}`;
          })
          .join('\n')
      : '(none yet)';

  const todayUtc = new Date().toISOString().slice(0, 10);

  // Guard 3 (Skeptical Editor-in-Chief LLM Triage + Post Memory)
  const gateDirective = mustEnforceNewsGate
    ? `STRICT NEWS & NOVELTY GATE (MANDATORY):
- CURRENT DATE (UTC): ${todayUtc}. Any release, breach, CVE, benchmark, model drop, or paper published within the last 14 days of ${todayUtc} is FRESH and TIMELY — never call dates matching ${todayUtc.slice(0, 7)} "stale".
- Act as a sharp Principal Editor-in-Chief. Approve "publish_worthy" (novelty_score 65-95) whenever the uncovered feed/search items contain a real, concrete software/model release, cybersecurity breach, CVE/KEV advisory, benchmark, ComfyUI/tooling workflow, or technical incident worth a dedicated engineering briefing.
- Return "decision": "skip_no_news" ONLY when ALL candidates are trivial minor patch notes, empty marketing fluff, or lack verifiable technical substance.
- Return "decision": "skip_already_covered" ONLY when a candidate covers the EXACT SAME specific incident, CVE, model release, or thesis already present in the EDITORIAL MEMORY LEDGER (having a different security or AI post in the ledger does NOT make a new breach/CVE/model a duplicate).`
    : ctx.forceWrite
      ? `FORCE-WRITE MODE ACTIVE (CURRENT DATE UTC: ${todayUtc}): Select the strongest, most concrete primary-source engineering angle and return "decision": "publish_worthy".`
      : `EXPLICIT TOPIC MODE (CURRENT DATE UTC: ${todayUtc}): Shape the requested topic into a focused, primary-source-verifiable thesis ("decision": "publish_worthy"), unless it directly duplicates an existing post in the EDITORIAL MEMORY LEDGER ("decision": "skip_already_covered").`;

  const systemPrompt = `You are the Principal Editor-in-Chief and Chief Research Strategist for ${ctx.settings.site_name}.
CURRENT DATE (UTC): ${todayUtc}.
Your job is to triage candidate signals for category "${ctx.skill.name}" (${ctx.skill.slug}) using archetype "${ctx.archetype}".

${gateDirective}

Return ONLY valid JSON matching this schema:
{
  "decision": "publish_worthy" | "skip_no_news" | "skip_already_covered",
  "novelty_score": 0-100,
  "skip_reason": "Concise explanation if skipping, or empty string when publish_worthy",
  "topic": "Specific technical topic headline or working thesis (no fluff)",
  "angle": "1-2 sentences describing the concrete engineering angle, metrics, or remediation focus",
  "search_queries": ["3 to 5 targeted web search queries to find primary documentation, benchmarks, papers, or vendor advisories"]
}`;

  const userPrompt = hasExplicitTopic
    ? `CURRENT DATE (UTC): ${todayUtc}
EXPLICIT REQUESTED TOPIC: ${cleanRequested}
CATEGORY INSTRUCTIONS: ${ctx.skill.system_instructions}
ARCHETYPE: ${ctx.archetype}

EDITORIAL MEMORY LEDGER (ONLY these exact past articles are already covered):
${editorialMemoryLedger}

UNCOVERED FEED CONTEXT:
${feedDigest || '(no uncovered feed items)'}

UNCOVERED NEWS/WEB SEARCH HITS:
${searchDigest || '(no uncovered seed search hits)'}

Keep the requested topic focused, factual, and verifiable, and produce 3 to 5 targeted search queries for primary documentation, benchmarks, papers, or advisories.`
    : `CURRENT DATE (UTC): ${todayUtc}
CATEGORY: ${ctx.skill.name} — ${ctx.skill.description}
CATEGORY INSTRUCTIONS: ${ctx.skill.system_instructions}
TARGET AUDIENCE: ${ctx.skill.target_audience}
ARCHETYPE: ${ctx.archetype}
DEFAULT EDITORIAL FOCUS: ${ctx.settings.default_topic_feed}

EDITORIAL MEMORY LEDGER (ONLY these exact past articles are already covered):
${editorialMemoryLedger}

UNCOVERED AUTHORITATIVE FEED CANDIDATES:
${feedDigest || '(no uncovered feed items)'}

UNCOVERED NEWS/WEB SEARCH HITS:
${searchDigest || '(no uncovered search hits)'}

Evaluate novelty against today's date (${todayUtc}) and the Editorial Memory Ledger. Pick the single highest-value fresh, non-duplicate technical story if one exists (score 65-95); only return "skip_no_news" if genuinely nothing substantive is in the candidates.`;

  const minNoveltyThreshold = ctx.settings.min_novelty_score ?? 68;

  // Live Working-Model Pool Probe (cached 15m; skipped in unit-test mock mode when cache is empty)
  let fastestModels = getFastestHealthyModelsFromCache();
  if (
    fastestModels.length === 0 &&
    !env.__TEST_DB__ &&
    (Boolean(env.NVIDIA_NIM_API_KEY?.trim()) || Boolean(env.OPENROUTER_API_KEY?.trim()))
  ) {
    try {
      const probePool = Array.from(
        new Set(
          [
            ctx.model,
            ...getConfiguredFallbackModels(ctx.settings),
            ctx.judgeModel,
          ].filter(Boolean),
        ),
      ).slice(0, 5);
      const probeResults = await probeWorkingModelPool(env, probePool, { timeoutMs: 7_000 });
      const working = probeResults.filter((r) => r.ok && r.json_ok);
      fastestModels = working.map((r) => r.id);
      const configuredFailed = probeResults.some((r) => r.id === ctx.model && !r.ok);
      if (configuredFailed && fastestModels.length > 0) {
        ctx.model = fastestModels[0];
      }
      pushTrace(trace, {
        stage: 'hunt_topics',
        tool_name: 'probe_working_model_pool',
        input: `${probeResults.length} models`,
        summary:
          working.length > 0
            ? `${working.length}/${probeResults.length} working — fastest: ${working
                .slice(0, 3)
                .map((r) => `${r.id} (${r.latency_ms}ms)`)
                .join(', ')}`
            : `0/${probeResults.length} models passed fast probe; falling back to provider failover chain`,
        ok: working.length > 0,
      });
    } catch {
      // Never block editorial run if live probe encounters transient network error
    }
  }
  if (fastestModels.length > 0) {
    ctx.fastestModels = fastestModels;
  }

  try {
    const completion = await callOpenRouter(env, {
      model: ctx.model,
      fallbackModels: getEffectiveFallbackModels(ctx),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.25,
      maxTokens: 2_048,
      jsonMode: true,
      freeModelsOnly: ctx.settings.free_models_only !== false,
    });
    addTokenUsage(usage, completion.usage);
    const resolvedModel = completion.model || ctx.model;
    ctx.model = resolvedModel;

    const parsed = extractJsonObject<{
      decision?: string;
      novelty_score?: number | string;
      skip_reason?: string;
      topic?: string;
      angle?: string;
      search_queries?: string[];
    }>(completion.content);

    const rawDecision = typeof parsed.decision === 'string' ? parsed.decision.trim().toLowerCase() : '';
    let decision: TopicHuntDecision =
      rawDecision === 'skip_no_news' || rawDecision === 'skip_already_covered'
        ? rawDecision
        : 'publish_worthy';

    const rawNovelty =
      typeof parsed.novelty_score === 'number'
        ? parsed.novelty_score
        : typeof parsed.novelty_score === 'string' && parsed.novelty_score.trim() !== ''
          ? Number(parsed.novelty_score)
          : NaN;
    const noveltyScore = Number.isFinite(rawNovelty)
      ? clampScore(rawNovelty)
      : decision === 'publish_worthy'
        ? 82
        : 20;

    let skipReason =
      typeof parsed.skip_reason === 'string' && parsed.skip_reason.trim()
        ? parsed.skip_reason.trim()
        : undefined;

    const selectedTopic =
      (parsed.topic || '').trim() ||
      (hasExplicitTopic
        ? cleanRequested
        : uncoveredFeedItems[0]?.title || uncoveredSearchHits[0]?.title || ctx.skill.name);
    const angle = (parsed.angle || '').trim() || ctx.skill.description;
    const rawQueries = Array.isArray(parsed.search_queries)
      ? parsed.search_queries.filter((q): q is string => typeof q === 'string' && q.trim().length > 2)
      : [];

    const searchQueries = Array.from(
      new Set([
        ...rawQueries.map((q) => q.trim()),
        ...(hasExplicitTopic ? [cleanRequested] : []),
        ...(ctx.skill.search_queries_json || []).slice(0, 2),
      ]),
    ).slice(0, 5);

    // Guard 4 (Deterministic Novelty & Duplicate Override)
    if (mustEnforceNewsGate) {
      const dup = findDuplicatePost({ title: selectedTopic }, ctx.recentPosts, 0.48);
      if (dup.isDuplicate) {
        decision = 'skip_already_covered';
        skipReason = dup.reason;
      } else if (noveltyScore < minNoveltyThreshold && decision !== 'skip_already_covered') {
        decision = 'skip_no_news';
        skipReason =
          skipReason ||
          `Novelty score (${noveltyScore}/100) below editorial threshold (${minNoveltyThreshold}/100).`;
      } else if (decision !== 'publish_worthy' && !skipReason) {
        skipReason =
          decision === 'skip_already_covered'
            ? 'Topic overlaps with recent editorial coverage.'
            : `Novelty score (${noveltyScore}/100) below editorial threshold (${minNoveltyThreshold}/100).`;
      }
    } else if (hasExplicitTopic && !ctx.forceWrite) {
      const dupSelected = findDuplicatePost({ title: selectedTopic }, ctx.recentPosts, 0.62);
      const dupRequested = findDuplicatePost({ title: cleanRequested }, ctx.recentPosts, 0.62);
      const dup = dupSelected.isDuplicate ? dupSelected : dupRequested;
      if (dup.isDuplicate) {
        decision = 'skip_already_covered';
        skipReason = dup.reason;
      } else {
        decision = 'publish_worthy';
        skipReason = undefined;
      }
    } else if (ctx.forceWrite) {
      decision = 'publish_worthy';
      skipReason = undefined;
    }

    pushTrace(trace, {
      stage: 'hunt_topics',
      tool_name: 'openrouter_topic_selection',
      input: resolvedModel,
      summary:
        decision === 'publish_worthy'
          ? `Approved topic "${selectedTopic}" (novelty=${noveltyScore}/100) via ${resolvedModel} with ${searchQueries.length} search queries`
          : `Editorial gate skipped (${decision}, novelty=${noveltyScore}/100): ${skipReason || 'below editorial bar'}`,
      ok: true,
    });

    return {
      decision,
      noveltyScore,
      ...(skipReason ? { skipReason } : {}),
      topic: selectedTopic,
      angle,
      searchQueries,
      feedItems,
      resolvedModel,
      ...(fastestModels.length > 0 ? { fastestModels } : {}),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const fallbackTopic = hasExplicitTopic
      ? cleanRequested
      : uncoveredFeedItems[0]?.title ||
        uncoveredSearchHits[0]?.title ||
        `${ctx.skill.name} Engineering Analysis`;
    const fallbackQueries = Array.from(
      new Set([
        fallbackTopic,
        ...(ctx.skill.search_queries_json || []),
      ]),
    ).slice(0, 4);

    if (mustEnforceNewsGate) {
      const dup = findDuplicatePost({ title: fallbackTopic }, ctx.recentPosts, 0.48);
      if (dup.isDuplicate) {
        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'openrouter_topic_selection',
          input: ctx.skill.slug,
          summary: `Topic selection LLM failed (${message}) and fallback duplicated existing post: ${dup.reason}`,
          ok: false,
        });
        return {
          decision: 'skip_already_covered',
          noveltyScore: 0,
          skipReason: dup.reason,
          topic: fallbackTopic,
          angle: '',
          searchQueries: [],
          feedItems,
        };
      }
    } else if (hasExplicitTopic && !ctx.forceWrite) {
      const dup = findDuplicatePost({ title: fallbackTopic }, ctx.recentPosts, 0.62);
      if (dup.isDuplicate) {
        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'openrouter_topic_selection',
          input: ctx.skill.slug,
          summary: `Explicit topic duplicated existing post: ${dup.reason}`,
          ok: true,
        });
        return {
          decision: 'skip_already_covered',
          noveltyScore: 0,
          skipReason: dup.reason,
          topic: fallbackTopic,
          angle: '',
          searchQueries: [],
          feedItems,
        };
      }
    }

    pushTrace(trace, {
      stage: 'hunt_topics',
      tool_name: 'openrouter_topic_selection',
      input: ctx.skill.slug,
      summary: `Topic selection LLM fallback (${message}); using "${fallbackTopic}"`,
      ok: false,
    });

    return {
      decision: 'publish_worthy',
      noveltyScore: 75,
      topic: fallbackTopic,
      angle: ctx.skill.description,
      searchQueries: fallbackQueries,
      feedItems,
    };
  }
}

/**
 * Stage 3: Execute web searches and read 3-5 full primary webpages via readPrimaryWebpage.
 */
export async function stageDeepResearch(
  env: WorkerEnv,
  topic: string,
  searchQueries: string[],
  feedItems: FeedItem[],
  trace: TraceEntry[],
): Promise<PrimarySourceDoc[]> {
  const hasSerperKey = Boolean(env.SERPER_API_KEY?.trim());
  const queries = Array.from(
    new Set([topic, ...searchQueries].map((q) => q.trim()).filter(Boolean)),
  ).slice(0, hasSerperKey ? 3 : 2);

  // Conserve Cloudflare Workers Free-plan subrequest budget: skip DuckDuckGo HTML scraping when
  // authoritative feeds already supply >= 3 deep candidates and SERPER_API_KEY is not configured.
  const searchBatches =
    hasSerperKey || feedItems.length < 3
      ? await Promise.all(queries.map((q) => searchWebSources(q, env, trace)))
      : [];
  const searchResults = searchBatches.flat();

  // Build deduplicated candidate list prioritizing deep https:// URLs
  const candidates: Array<{ url: string; title: string; snippet: string; score: number }> = [];
  const seenUrls = new Set<string>();

  const topicTokens = topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);

  const scoreCandidate = (url: string, title: string, snippet: string, baseBoost: number): number => {
    let score = baseBoost;
    const lowerText = `${title} ${snippet} ${url}`.toLowerCase();
    for (const tok of topicTokens) {
      if (lowerText.includes(tok)) score += 3;
    }
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (
        host.includes('github.com') ||
        host.includes('arxiv.org') ||
        host.includes('huggingface.co') ||
        host.includes('cisa.gov') ||
        host.includes('nist.gov') ||
        host.includes('owasp.org') ||
        host.includes('cloudflare.com') ||
        host.includes('anthropic.com') ||
        host.includes('openai.com') ||
        host.includes('docs.')
      ) {
        score += 6;
      }
      if (parsed.pathname.length > 12) {
        score += 2;
      }
    } catch {
      // ignore
    }
    return score;
  };

  for (const hit of searchResults) {
    const canon = normalizeCanonicalUrl(hit.url);
    if (!isDeepUrl(hit.url) || !canon || seenUrls.has(canon)) continue;
    seenUrls.add(canon);
    candidates.push({
      url: hit.url,
      title: hit.title,
      snippet: hit.snippet,
      score: scoreCandidate(hit.url, hit.title, hit.snippet, 10),
    });
  }

  for (const item of feedItems) {
    const canon = normalizeCanonicalUrl(item.url);
    if (!isDeepUrl(item.url) || !canon || seenUrls.has(canon)) continue;
    seenUrls.add(canon);
    candidates.push({
      url: item.url,
      title: item.title,
      snippet: item.summary,
      score: scoreCandidate(item.url, item.title, item.summary, 6),
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const primarySources: PrimarySourceDoc[] = [];
  const maxReadsToAttempt = Math.min(candidates.length, 6);
  const targetSourceCount = 4;

  for (let i = 0; i < maxReadsToAttempt && primarySources.length < targetSourceCount; i++) {
    const candidate = candidates[i];
    const read = await readPrimaryWebpage(candidate.url, env, trace);
    if (read.ok && read.markdown.trim().length >= 200) {
      primarySources.push({
        url: read.url || candidate.url,
        title: read.title || candidate.title,
        markdown: read.markdown,
        chars: read.chars,
        snippet: candidate.snippet,
        images: read.images || [],
      });
    }
  }

  // If fewer than 3 full reads succeeded (e.g., paywalls/rate limits), include high-signal snippets
  // from remaining verified deep candidates so citations remain grounded in real fetched URLs.
  if (primarySources.length < 3) {
    const alreadyAdded = new Set(primarySources.map((s) => s.url));
    for (const candidate of candidates) {
      if (primarySources.length >= 3) break;
      if (alreadyAdded.has(candidate.url) || !candidate.snippet) continue;
      primarySources.push({
        url: candidate.url,
        title: candidate.title,
        markdown: `${candidate.title}\n\n${candidate.snippet}`,
        chars: candidate.snippet.length,
        snippet: candidate.snippet,
        images: [],
      });
      alreadyAdded.add(candidate.url);
    }
  }

  const totalCrawledImages = collectCrawledImages(primarySources).length;
  pushTrace(trace, {
    stage: 'deep_research',
    tool_name: 'stageDeepResearch',
    input: topic,
    summary: `Collected ${primarySources.length} primary sources and ${totalCrawledImages} verified reference image(s) from ${maxReadsToAttempt} attempted reads`,
    ok: primarySources.length >= 3,
  });

  return primarySources;
}

/**
 * Stage 4: Draft structured JSON article via OpenRouter, run deterministic lintPostPayload,
 * and perform up to 2 targeted self-correction passes if lint errors remain.
 */
export async function stageDraftAndRefine(
  env: WorkerEnv,
  ctx: AgentContext,
  topic: string,
  sources: PrimarySourceDoc[],
  trace: TraceEntry[],
  usage: TokenUsage,
): Promise<DraftAndRefineOutput> {
  const systemPrompt = buildSkillSystemPrompt(ctx.skill, ctx.archetype, ctx.settings);

  const sourceDossier =
    sources.length > 0
      ? sources
          .map((src, idx) => {
            const excerpt = src.markdown.slice(0, 4_200);
            return `=== PRIMARY SOURCE ${idx + 1} ===\nTITLE: ${src.title}\nURL: ${src.url}\nCONTENT EXCERPT:\n${excerpt}`;
          })
          .join('\n\n')
      : 'No external full-page excerpts were fetched. Cite only verified deep primary documentation URLs and note any verification caveats in review_notes.';

  const crawledImages = collectCrawledImages(sources);
  const crawledImageList =
    crawledImages.length > 0
      ? crawledImages
          .slice(0, 8)
          .map(
            (img, idx) =>
              `[IMG ${idx + 1}] URL: ${img.url}\nAlt/Caption: ${img.alt}\nFrom Primary Source: ${img.source_page_url}`,
          )
          .join('\n\n')
      : '(none extracted — leave cover_image_url empty and images as [])';

  const userPrompt = `TOPIC TO COVER:
${topic}

TARGET ARCHETYPE: ${ctx.archetype}
HUMAN AUTHOR BYLINE: ${ctx.settings.default_author}
RECENT ARTICLES ON THIS SITE (do not repeat):
${ctx.recentTitles.slice(0, 10).map((t) => `- ${t}`).join('\n') || '(none)'}

VERIFIED CRAWLED REFERENCE IMAGES (ONLY use exact URLs from this list for cover_image_url, images, or ![Caption](https://...) in body_markdown):
${crawledImageList}

PRIMARY SOURCE DOSSIER (ground every factual claim, benchmark, version, and inline citation in these URLs):
${sourceDossier}

Write the complete publication-ready article now as a single valid JSON object adhering strictly to all schema, GEO/AEO, citation, reference image, and anti-slop rules.`;

  const freeModelsOnly = ctx.settings.free_models_only !== false;

  const draftRes = await callOpenRouter(env, {
    model: ctx.model,
    fallbackModels: getEffectiveFallbackModels(ctx),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 8_192,
    jsonMode: true,
    freeModelsOnly,
  });
  addTokenUsage(usage, draftRes.usage);
  let resolvedModel = draftRes.model || ctx.model;
  ctx.model = resolvedModel;

  pushTrace(trace, {
    stage: 'draft_and_refine',
    tool_name: 'openrouter_draft',
    input: resolvedModel,
    summary: `Generated initial draft via ${resolvedModel} (${draftRes.usage.total_tokens} tokens)`,
    ok: true,
  });

  let parsedDraftRaw: Partial<DraftArticlePayload>;
  try {
    parsedDraftRaw = extractJsonObject<Partial<DraftArticlePayload>>(draftRes.content);
  } catch (firstParseErr) {
    const parseMsg = firstParseErr instanceof Error ? firstParseErr.message : String(firstParseErr);
    pushTrace(trace, {
      stage: 'draft_and_refine',
      tool_name: 'json_parse_retry',
      input: resolvedModel,
      summary: `Initial draft JSON from ${resolvedModel} malformed (${parseMsg}); retrying with strict JSON formatting`,
      ok: false,
    });
    const retryJsonRes = await callOpenRouter(env, {
      model: resolvedModel,
      fallbackModels: getEffectiveFallbackModels(ctx),
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `${userPrompt}\n\nIMPORTANT: Your previous response had invalid JSON (${parseMsg}). Ensure ALL double quotes and backslashes inside body_markdown are properly JSON-escaped, and output strictly one valid RFC 8259 JSON object.`,
        },
      ],
      temperature: 0.2,
      maxTokens: 8_192,
      jsonMode: true,
      freeModelsOnly,
    });
    addTokenUsage(usage, retryJsonRes.usage);
    resolvedModel = retryJsonRes.model || resolvedModel;
    ctx.model = resolvedModel;
    pushTrace(trace, {
      stage: 'draft_and_refine',
      tool_name: 'openrouter_json_retry',
      input: resolvedModel,
      summary: `Retried JSON draft via ${resolvedModel} (${retryJsonRes.usage.total_tokens} tokens)`,
      ok: true,
    });
    parsedDraftRaw = extractJsonObject<Partial<DraftArticlePayload>>(retryJsonRes.content);
  }

  let draft = normalizeDraftPayload(parsedDraftRaw, topic, sources);

  let lintResult = lintPostPayload({
    title: draft.title,
    description: draft.description,
    tldr_summary: draft.tldr_summary,
    key_facts: draft.key_facts,
    faq: draft.faq,
    body_markdown: draft.body_markdown,
    author: ctx.settings.default_author,
    archetype: ctx.archetype,
    sources: draft.sources,
    banned_patterns: ctx.skill.banned_patterns_json,
  });

  let attempts = 1;
  pushTrace(trace, {
    stage: 'draft_and_refine',
    tool_name: 'lintPostPayload',
    input: `attempt ${attempts}`,
    summary: lintResult.passed
      ? `Draft passed lint on attempt 1 (score=${lintResult.quality_score}, words=${lintResult.word_count})`
      : `Draft failed lint on attempt 1 (${lintResult.errors.length} error(s), score=${lintResult.quality_score}): ${lintResult.errors.slice(0, 3).join(' | ')}`,
    ok: lintResult.passed,
  });

  const maxCorrectionPasses = 2;
  for (let pass = 1; pass <= maxCorrectionPasses && !lintResult.passed; pass++) {
    attempts++;
    const allowedUrls = sources.map((s) => `- ${s.url} (${s.title})`).join('\n');
    const correctionPrompt = `Your previous JSON article draft failed deterministic editorial linting.

LINT ERRORS THAT MUST BE FIXED (EVERY SINGLE ONE):
${lintResult.errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

QUALITY WARNINGS TO IMPROVE IF POSSIBLE:
${lintResult.quality_breakdown.warnings.map((w, i) => `${i + 1}. ${w}`).join('\n') || '(none)'}

VERIFIED DEEP PRIMARY SOURCE URLS AVAILABLE FOR CITATION:
${allowedUrls || '(use verified deep https:// documentation URLs)'}

PREVIOUS DRAFT JSON:
${JSON.stringify(draft, null, 2)}

Return the FULL corrected JSON object with ALL lint errors resolved while preserving factual accuracy, tables/code blocks, and deep inline https:// citations. Return ONLY valid JSON.`;

    const retryRes = await callOpenRouter(env, {
      model: resolvedModel,
      fallbackModels: getEffectiveFallbackModels(ctx),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: correctionPrompt },
      ],
      temperature: 0.2,
      maxTokens: 6_000,
      jsonMode: true,
      freeModelsOnly,
    });
    addTokenUsage(usage, retryRes.usage);
    resolvedModel = retryRes.model || resolvedModel;
    ctx.model = resolvedModel;

    pushTrace(trace, {
      stage: 'draft_and_refine',
      tool_name: 'openrouter_lint_correction',
      input: resolvedModel,
      summary: `Executed lint self-correction pass ${pass} via ${resolvedModel} (${retryRes.usage.total_tokens} tokens)`,
      ok: true,
    });

    draft = normalizeDraftPayload(
      extractJsonObject<Partial<DraftArticlePayload>>(retryRes.content),
      topic,
      sources,
    );

    lintResult = lintPostPayload({
      title: draft.title,
      description: draft.description,
      tldr_summary: draft.tldr_summary,
      key_facts: draft.key_facts,
      faq: draft.faq,
      body_markdown: draft.body_markdown,
      author: ctx.settings.default_author,
      archetype: ctx.archetype,
      sources: draft.sources,
      banned_patterns: ctx.skill.banned_patterns_json,
    });

    pushTrace(trace, {
      stage: 'draft_and_refine',
      tool_name: 'lintPostPayload',
      input: `self-correction pass ${pass}`,
      summary: lintResult.passed
        ? `Passed lint on attempt ${attempts} (score=${lintResult.quality_score}, words=${lintResult.word_count})`
        : `Still failing lint on attempt ${attempts} (${lintResult.errors.length} error(s), score=${lintResult.quality_score}): ${lintResult.errors.slice(0, 3).join(' | ')}`,
      ok: lintResult.passed,
    });
  }

  return { draft, lintResult, attempts, resolvedModel };
}

function hasMarkdownDataTable(markdown: string): boolean {
  if (!markdown) return false;
  return /\|.+\|\s*\n\s*\|[\s:|-]+\|/m.test(markdown);
}

function hasGroundedReferenceImages(draft: DraftArticlePayload): boolean {
  if (draft.cover_image_url && draft.cover_image_url.trim().length > 0) return true;
  if (Array.isArray(draft.images) && draft.images.length > 0) return true;
  return /!\[[^\]]*\]\(https?:\/\/[^)\s]+\)/i.test(draft.body_markdown || '');
}

function sanitizeStringList(val: unknown, limit = 5): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 260))
    .slice(0, limit);
}

/**
 * Stage 5: Cross-Family Dual-Model Critic & Refinement Loop.
 * Runs TWO distinct $0 OpenRouter model families in parallel:
 *   - Critic 1 (Family A): Pyvren writing tone, anti-slop stylometry, verified reference images, Markdown tables & factual depth
 *   - Critic 2 (Family B): SEO structure, GEO/AEO extractability, Google AdSense publisher safety & E-E-A-T compliance
 * If either critic flags blocking issues (or missing reference images/tables), runs a targeted 1-pass refinement
 * via the writer model and adopts the revised draft if it preserves or improves deterministic lint compliance.
 */
export async function stageQualityAssessment(
  env: WorkerEnv,
  ctx: AgentContext,
  draft: DraftArticlePayload,
  lintResult: LintResult,
  trace: TraceEntry[],
  usage: TokenUsage,
  sources?: PrimarySourceDoc[],
): Promise<QualityAssessmentOutput> {
  const freeModelsOnly = ctx.settings.free_models_only !== false;
  const crawledImages = sources ? collectCrawledImages(sources) : [];
  let activeDraft = draft;
  let activeLint = lintResult;

  const sourceExcerpts =
    sources && sources.length > 0
      ? sources
          .slice(0, 5)
          .map((s, idx) => `[${idx + 1}] ${s.url} — ${s.title}\n${s.markdown.slice(0, 1_100)}`)
          .join('\n\n')
      : activeDraft.sources.map((u, idx) => `[${idx + 1}] ${u}`).join('\n');

  const initialHasImages = hasGroundedReferenceImages(activeDraft);
  const initialHasTable = hasMarkdownDataTable(activeDraft.body_markdown);

  const criticPair = pickDistinctFreeCriticPair({
    writerModel: ctx.model,
    preferredJudgeModel: ctx.judgeModel,
    fallbackModels: getEffectiveFallbackModels(ctx),
    fastestHealthyIds: ctx.fastestModels || getFastestHealthyModelsFromCache(),
    nimAvailable: Boolean(env.NVIDIA_NIM_API_KEY?.trim()),
    freeModelsOnly,
  });

  const todayUtc = new Date().toISOString().slice(0, 10);

  const sharedDraftBrief = `CURRENT DATE (UTC): ${todayUtc}
CATEGORY: ${ctx.skill.name} (${ctx.archetype})
TITLE (${activeDraft.title.length} chars): ${activeDraft.title}
META DESCRIPTION (${activeDraft.description.length} chars): ${activeDraft.description}
TLDR: ${activeDraft.tldr_summary}
KEY FACTS (${activeDraft.key_facts.length}): ${JSON.stringify(activeDraft.key_facts)}
FAQ (${activeDraft.faq.length}): ${JSON.stringify(activeDraft.faq)}
COVER IMAGE: ${activeDraft.cover_image_url || '(none)'}
INLINE IMAGES COUNT: ${activeDraft.images.length} | AVAILABLE CRAWLED SOURCE IMAGES: ${crawledImages.length}
HAS MARKDOWN DATA TABLE: ${initialHasTable ? 'YES' : 'NO'}
DETERMINISTIC LINT PASSED: ${activeLint.passed} (score=${activeLint.quality_score})

ARTICLE BODY:
${activeDraft.body_markdown.slice(0, 8_500)}

PRIMARY SOURCES:
${sourceExcerpts}`;

  const criticASystem = `You are Critic 1 (Principal Technical Editor) reviewing a draft for ${ctx.settings.site_name}.
CURRENT DATE (UTC): ${todayUtc}. Dates and source URLs on or before ${todayUtc} are CURRENT, NOT future-dated.
Audit STRICTLY on four dimensions:
1. editorial_tone (0-100): Does it match Pyvren's crisp, human-sounding staff-engineer voice (varied sentence length, concrete verdicts, zero AI slop, zero filler transitions like "Furthermore/Moreover/In conclusion", zero walls of bold-colon bullets)?
2. factual_grounding (0-100): Are benchmarks, versions, pricing, dates, and technical claims genuinely supported by the primary sources?
3. visuals_and_tables (0-100): Does the article include at least one concrete Markdown comparison/spec/timeline table AND (when AVAILABLE CRAWLED SOURCE IMAGES > 0) grounded reference images with accurate captions?
4. verdict: "pass" ONLY if ready to publish as-is; otherwise "revise" with exact concrete_fixes.

Return ONLY valid JSON:
{
  "editorial_tone": 0-100,
  "factual_grounding": 0-100,
  "visuals_and_tables": 0-100,
  "verdict": "pass" | "revise",
  "blocking_issues": ["short specific issue if any"],
  "concrete_fixes": ["exact actionable fix if any"],
  "notes": "1-3 concrete sentences of editorial critique"
}`;

  const criticBSystem = `You are Critic 2 (SEO, GEO/AEO & Google AdSense Publisher Compliance Auditor) reviewing a draft for ${ctx.settings.site_name}.
CURRENT DATE (UTC): ${todayUtc}. Dates and source URLs on or before ${todayUtc} are CURRENT, NOT future-dated.
Audit STRICTLY on four dimensions:
1. seo_score (0-100): Search-intent headline (45-75 chars), compelling meta description (120-160 chars), logical H2/H3 hierarchy, scannable formatting, deep inline source links, zero keyword stuffing.
2. geo_clarity (0-100): Answer-first opening, crisp TL;DR, factual key_facts with units/numbers, and genuinely useful FAQ answers extractable by Google AI Overviews, Perplexity, and ChatGPT Search.
3. adsense_safety (0-100): High original value / E-E-A-T commentary (not thin news rehash), clean attribution, strictly defensive framing on cybersecurity/breach topics (zero working exploit payloads or policy-violating attack steps).
4. verdict: "pass" ONLY if SEO, GEO, and AdSense standards are met; otherwise "revise" with exact concrete_fixes.

Return ONLY valid JSON:
{
  "seo_score": 0-100,
  "geo_clarity": 0-100,
  "adsense_safety": 0-100,
  "verdict": "pass" | "revise",
  "blocking_issues": ["short specific issue if any"],
  "concrete_fixes": ["exact actionable fix if any"],
  "notes": "1-3 concrete sentences of SEO/AdSense/GEO critique"
}`;

  const [criticASettled, criticBSettled] = await Promise.allSettled([
    callOpenRouter(env, {
      model: criticPair.criticA,
      fallbackModels: criticPair.criticAFallbacks,
      messages: [
        { role: 'system', content: criticASystem },
        { role: 'user', content: sharedDraftBrief },
      ],
      temperature: 0.1,
      maxTokens: 2_048,
      jsonMode: true,
      freeModelsOnly,
    }),
    callOpenRouter(env, {
      model: criticPair.criticB,
      fallbackModels: criticPair.criticBFallbacks,
      messages: [
        { role: 'system', content: criticBSystem },
        { role: 'user', content: sharedDraftBrief },
      ],
      temperature: 0.1,
      maxTokens: 2_048,
      jsonMode: true,
      freeModelsOnly,
    }),
  ]);

  let criticAOk = false;
  let criticBOk = false;
  let criticAModel = criticPair.criticA;
  let criticBModel = criticPair.criticB;

  let criticATone = activeLint.quality_breakdown.anti_slop_cleanliness;
  let criticAGrounding = activeLint.quality_breakdown.source_grounding;
  let criticAVisuals = activeLint.quality_breakdown.information_gain;
  let criticBSeo = activeLint.quality_breakdown.seo_structure;
  let criticBGeo = activeLint.quality_breakdown.geo_citation_readiness;
  let criticBAdsense = activeLint.quality_breakdown.adsense_compliance;

  const criticEntries: DualCriticEntry[] = [];
  const combinedBlocking: string[] = [];
  const combinedFixes: string[] = [];
  const combinedWarnings: string[] = [];

  if (criticASettled.status === 'fulfilled') {
    const resA = criticASettled.value;
    addTokenUsage(usage, resA.usage);
    criticAModel = resA.model || criticPair.criticA;
    try {
      const parsedA = extractJsonObject<{
        editorial_tone?: number;
        anti_slop_tone?: number;
        factual_grounding?: number;
        visuals_and_tables?: number;
        verdict?: string;
        blocking_issues?: string[];
        concrete_fixes?: string[];
        warnings?: string[];
        notes?: string;
        judge_notes?: string;
      }>(resA.content);
      criticAOk = true;
      const toneRaw = parsedA.editorial_tone ?? parsedA.anti_slop_tone;
      if (typeof toneRaw === 'number' && Number.isFinite(toneRaw)) criticATone = clampScore(toneRaw);
      if (typeof parsedA.factual_grounding === 'number' && Number.isFinite(parsedA.factual_grounding)) {
        criticAGrounding = clampScore(parsedA.factual_grounding);
      }
      if (typeof parsedA.visuals_and_tables === 'number' && Number.isFinite(parsedA.visuals_and_tables)) {
        criticAVisuals = clampScore(parsedA.visuals_and_tables);
      }
      const blockingA = sanitizeStringList(parsedA.blocking_issues, 4);
      const fixesA = sanitizeStringList(parsedA.concrete_fixes, 4);
      const warnA = sanitizeStringList(parsedA.warnings, 4);
      const verdictA: 'pass' | 'revise' =
        parsedA.verdict === 'revise' || blockingA.length > 0 ? 'revise' : 'pass';
      const notesA = (parsedA.notes || parsedA.judge_notes || '').trim();

      combinedBlocking.push(...blockingA);
      combinedFixes.push(...fixesA);
      combinedWarnings.push(...warnA, ...blockingA);
      criticEntries.push({
        role: 'editorial_visuals_tone',
        model: criticAModel,
        family: getOpenRouterModelFamily(criticAModel),
        verdict: verdictA,
        scores: {
          editorial_tone: criticATone,
          factual_grounding: criticAGrounding,
          visuals_and_tables: criticAVisuals,
        },
        blocking_issues: blockingA,
        concrete_fixes: fixesA,
        notes: notesA || 'Editorial, tone & structure checked.',
      });
      pushTrace(trace, {
        stage: 'quality_assessment',
        tool_name: 'dual_critic_editorial',
        input: `${criticAModel} (${getOpenRouterModelFamily(criticAModel)})`,
        summary: `Critic 1 [${getOpenRouterModelFamily(criticAModel)}] verdict=${verdictA} (tone=${criticATone}, grounding=${criticAGrounding}, visuals/tables=${criticAVisuals})`,
        ok: true,
      });
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      criticEntries.push({
        role: 'editorial_visuals_tone',
        model: criticAModel,
        family: getOpenRouterModelFamily(criticAModel),
        verdict: 'unavailable',
        scores: {},
        blocking_issues: [],
        concrete_fixes: [],
        notes: `Critic 1 JSON parse failed: ${msg}`,
      });
    }
  } else {
    const msg = criticASettled.reason instanceof Error ? criticASettled.reason.message : String(criticASettled.reason);
    criticEntries.push({
      role: 'editorial_visuals_tone',
      model: criticAModel,
      family: getOpenRouterModelFamily(criticAModel),
      verdict: 'unavailable',
      scores: {},
      blocking_issues: [],
      concrete_fixes: [],
      notes: `Critic 1 unavailable: ${msg}`,
    });
    pushTrace(trace, {
      stage: 'quality_assessment',
      tool_name: 'dual_critic_editorial',
      input: criticAModel,
      summary: `Critic 1 failed (${msg})`,
      ok: false,
    });
  }

  if (criticBSettled.status === 'fulfilled') {
    const resB = criticBSettled.value;
    addTokenUsage(usage, resB.usage);
    criticBModel = resB.model || criticPair.criticB;
    try {
      const parsedB = extractJsonObject<{
        seo_score?: number;
        geo_clarity?: number;
        adsense_safety?: number;
        verdict?: string;
        blocking_issues?: string[];
        concrete_fixes?: string[];
        warnings?: string[];
        notes?: string;
        judge_notes?: string;
      }>(resB.content);
      criticBOk = true;
      if (typeof parsedB.seo_score === 'number' && Number.isFinite(parsedB.seo_score)) {
        criticBSeo = clampScore(parsedB.seo_score);
      }
      if (typeof parsedB.geo_clarity === 'number' && Number.isFinite(parsedB.geo_clarity)) {
        criticBGeo = clampScore(parsedB.geo_clarity);
      }
      if (typeof parsedB.adsense_safety === 'number' && Number.isFinite(parsedB.adsense_safety)) {
        criticBAdsense = clampScore(parsedB.adsense_safety);
      }
      const blockingB = sanitizeStringList(parsedB.blocking_issues, 4);
      const fixesB = sanitizeStringList(parsedB.concrete_fixes, 4);
      const warnB = sanitizeStringList(parsedB.warnings, 4);
      const verdictB: 'pass' | 'revise' =
        parsedB.verdict === 'revise' || blockingB.length > 0 ? 'revise' : 'pass';
      const notesB = (parsedB.notes || parsedB.judge_notes || '').trim();

      combinedBlocking.push(...blockingB);
      combinedFixes.push(...fixesB);
      combinedWarnings.push(...warnB, ...blockingB);
      criticEntries.push({
        role: 'seo_geo_adsense',
        model: criticBModel,
        family: getOpenRouterModelFamily(criticBModel),
        verdict: verdictB,
        scores: {
          seo_score: criticBSeo,
          geo_clarity: criticBGeo,
          adsense_safety: criticBAdsense,
        },
        blocking_issues: blockingB,
        concrete_fixes: fixesB,
        notes: notesB || 'SEO, GEO & AdSense compliance checked.',
      });
      pushTrace(trace, {
        stage: 'quality_assessment',
        tool_name: 'dual_critic_seo_adsense',
        input: `${criticBModel} (${getOpenRouterModelFamily(criticBModel)})`,
        summary: `Critic 2 [${getOpenRouterModelFamily(criticBModel)}] verdict=${verdictB} (seo=${criticBSeo}, geo=${criticBGeo}, adsense=${criticBAdsense})`,
        ok: true,
      });
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      criticEntries.push({
        role: 'seo_geo_adsense',
        model: criticBModel,
        family: getOpenRouterModelFamily(criticBModel),
        verdict: 'unavailable',
        scores: {},
        blocking_issues: [],
        concrete_fixes: [],
        notes: `Critic 2 JSON parse failed: ${msg}`,
      });
    }
  } else {
    const msg = criticBSettled.reason instanceof Error ? criticBSettled.reason.message : String(criticBSettled.reason);
    criticEntries.push({
      role: 'seo_geo_adsense',
      model: criticBModel,
      family: getOpenRouterModelFamily(criticBModel),
      verdict: 'unavailable',
      scores: {},
      blocking_issues: [],
      concrete_fixes: [],
      notes: `Critic 2 unavailable: ${msg}`,
    });
    pushTrace(trace, {
      stage: 'quality_assessment',
      tool_name: 'dual_critic_seo_adsense',
      input: criticBModel,
      summary: `Critic 2 failed (${msg})`,
      ok: false,
    });
  }

  // Deterministic structural checks to combine with critic verdicts
  const structuralTriggers: string[] = [];
  if (crawledImages.length > 0 && !initialHasImages) {
    structuralTriggers.push(
      `Missing verified reference image even though ${crawledImages.length} crawled source image(s) are available`,
    );
  }
  if (!initialHasTable) {
    structuralTriggers.push('Missing structured Markdown comparison/spec table');
  }

  const anyCriticRequestsRevision = criticEntries.some((c) => c.verdict === 'revise');
  const lowCriticDimension =
    (criticAOk && (criticATone < 78 || criticAGrounding < 78 || criticAVisuals < 75)) ||
    (criticBOk && (criticBSeo < 78 || criticBGeo < 78 || criticBAdsense < 80));

  const revisionReasons: string[] = [
    ...structuralTriggers,
    ...combinedBlocking.slice(0, 4),
    ...(lowCriticDimension ? ['One or more cross-family critic dimensions scored below 78'] : []),
  ];
  const shouldAttemptRevision =
    (criticAOk || criticBOk) &&
    (anyCriticRequestsRevision || structuralTriggers.length > 0 || lowCriticDimension);

  let revisionApplied = false;
  let revisedDraft: DraftArticlePayload | undefined;
  let revisedLintResult: LintResult | undefined;

  if (shouldAttemptRevision) {
    const systemPrompt = buildSkillSystemPrompt(ctx.skill, ctx.archetype, ctx.settings);
    const availableImagesText =
      crawledImages.length > 0
        ? crawledImages
            .slice(0, 6)
            .map(
              (img, idx) =>
                `[IMG ${idx + 1}] URL: ${img.url} | Alt: ${img.alt} | From: ${img.source_page_url}`,
            )
            .join('\n')
        : '(none available — keep cover_image_url null and images [])';

    const revisionPrompt = `Two independent editorial critics from different LLM families audited your draft and requested targeted improvements before publication.

CRITIC 1 (${getOpenRouterModelFamily(criticAModel)} — Editorial, Tone, Visuals & Tables):
${criticEntries[0]?.notes || '(n/a)'}
Blocking issues: ${JSON.stringify(criticEntries[0]?.blocking_issues || [])}
Concrete fixes: ${JSON.stringify(criticEntries[0]?.concrete_fixes || [])}

CRITIC 2 (${getOpenRouterModelFamily(criticBModel)} — SEO, GEO & AdSense Compliance):
${criticEntries[1]?.notes || '(n/a)'}
Blocking issues: ${JSON.stringify(criticEntries[1]?.blocking_issues || [])}
Concrete fixes: ${JSON.stringify(criticEntries[1]?.concrete_fixes || [])}

STRUCTURAL CHECKS TO SATISFY:
${structuralTriggers.length > 0 ? structuralTriggers.map((t, i) => `${i + 1}. ${t}`).join('\n') : '1. Preserve all verified reference images, Markdown comparison tables, deep inline citations, and Pyvren voice.'}

VERIFIED CRAWLED REFERENCE IMAGES (ONLY use exact URLs from this list):
${availableImagesText}

CURRENT DRAFT JSON:
${JSON.stringify(activeDraft, null, 2)}

Apply ALL requested editorial, table, reference-image, SEO, GEO, and AdSense refinements while preserving factual accuracy and Pyvren's crisp human tone. Return ONLY the complete revised RFC 8259 JSON object.`;

    try {
      const reviseRes = await callOpenRouter(env, {
        model: ctx.model,
        fallbackModels: getEffectiveFallbackModels(ctx),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: revisionPrompt },
        ],
        temperature: 0.25,
        maxTokens: 7_500,
        jsonMode: true,
        freeModelsOnly,
      });
      addTokenUsage(usage, reviseRes.usage);
      const revModel = reviseRes.model || ctx.model;

      const candidateDraft = normalizeDraftPayload(
        extractJsonObject<Partial<DraftArticlePayload>>(reviseRes.content),
        activeDraft.title,
        sources || [],
      );
      const candidateLint = lintPostPayload({
        title: candidateDraft.title,
        description: candidateDraft.description,
        tldr_summary: candidateDraft.tldr_summary,
        key_facts: candidateDraft.key_facts,
        faq: candidateDraft.faq,
        body_markdown: candidateDraft.body_markdown,
        author: ctx.settings.default_author,
        archetype: ctx.archetype,
        sources: candidateDraft.sources,
        banned_patterns: ctx.skill.banned_patterns_json,
      });

      const improvesOrMaintainsLint =
        (candidateLint.passed && !activeLint.passed) ||
        (candidateLint.passed === activeLint.passed &&
          candidateLint.quality_score >= activeLint.quality_score - 3);

      if (improvesOrMaintainsLint) {
        activeDraft = candidateDraft;
        activeLint = candidateLint;
        revisedDraft = candidateDraft;
        revisedLintResult = candidateLint;
        revisionApplied = true;
        // Boost critic scores modestly only where deterministic checks now confirm fixes
        if (hasMarkdownDataTable(activeDraft.body_markdown) && !initialHasTable) {
          criticAVisuals = clampScore(Math.max(criticAVisuals, 84));
        }
        if (hasGroundedReferenceImages(activeDraft) && !initialHasImages) {
          criticAVisuals = clampScore(Math.max(criticAVisuals, 86));
        }
        pushTrace(trace, {
          stage: 'quality_assessment',
          tool_name: 'dual_critic_revision_pass',
          input: revModel,
          summary: `Applied cross-family critic revision via ${revModel} (lint=${candidateLint.passed ? 'PASS' : 'FAIL'}, score=${candidateLint.quality_score}, table=${hasMarkdownDataTable(candidateDraft.body_markdown)}, images=${hasGroundedReferenceImages(candidateDraft)})`,
          ok: true,
        });
      } else {
        pushTrace(trace, {
          stage: 'quality_assessment',
          tool_name: 'dual_critic_revision_pass',
          input: revModel,
          summary: `Discarded critic revision because it regressed deterministic lint (${candidateLint.errors.length} errors, score=${candidateLint.quality_score} vs ${activeLint.quality_score})`,
          ok: false,
        });
      }
    } catch (revErr) {
      const msg = revErr instanceof Error ? revErr.message : String(revErr);
      pushTrace(trace, {
        stage: 'quality_assessment',
        tool_name: 'dual_critic_revision_pass',
        input: ctx.model,
        summary: `Critic revision pass skipped due to error (${msg}); keeping validated draft`,
        ok: false,
      });
    }
  }

  const baseBreakdown: QualityBreakdown = {
    ...activeLint.quality_breakdown,
    warnings: [...activeLint.quality_breakdown.warnings],
  };

  const finalHasImages = hasGroundedReferenceImages(activeDraft);
  const finalHasTable = hasMarkdownDataTable(activeDraft.body_markdown);
  const famA = getOpenRouterModelFamily(criticAModel);
  const famB = getOpenRouterModelFamily(criticBModel);
  const crossFamilyVerified = criticAOk && criticBOk && famA !== famB && famA !== 'router' && famB !== 'router';

  const dualReview: DualCriticReviewSummary = {
    writer_model: ctx.model,
    writer_family: getOpenRouterModelFamily(ctx.model),
    critics: criticEntries,
    cross_family_verified: crossFamilyVerified,
    has_reference_images: finalHasImages,
    has_data_table: finalHasTable,
    revision_triggered: shouldAttemptRevision,
    revision_applied: revisionApplied,
    ...(revisionReasons.length > 0 ? { revision_reason: revisionReasons.slice(0, 3).join(' | ') } : {}),
  };

  if (!criticAOk && !criticBOk) {
    const degradedScore = activeLint.passed
      ? activeLint.quality_score
      : Math.min(activeLint.quality_score, 65);
    baseBreakdown.overall = degradedScore;
    baseBreakdown.judge_notes = 'Dual-family critics unavailable; scored deterministically.';
    baseBreakdown.dual_critic_review = dualReview;
    return {
      finalScore: degradedScore,
      finalBreakdown: baseBreakdown,
      resolvedJudgeModel: ctx.judgeModel,
    };
  }

  const blendedSeo = criticBOk
    ? clampScore(baseBreakdown.seo_structure * 0.7 + criticBSeo * 0.3)
    : baseBreakdown.seo_structure;
  const blendedGeo = criticBOk
    ? clampScore(baseBreakdown.geo_citation_readiness * 0.7 + criticBGeo * 0.3)
    : baseBreakdown.geo_citation_readiness;
  const blendedInfoGain = criticAOk
    ? clampScore(baseBreakdown.information_gain * 0.75 + criticAVisuals * 0.25)
    : baseBreakdown.information_gain;
  const blendedGrounding = criticAOk
    ? clampScore(baseBreakdown.source_grounding * 0.7 + criticAGrounding * 0.3)
    : baseBreakdown.source_grounding;
  const blendedAntiSlop = criticAOk
    ? clampScore(baseBreakdown.anti_slop_cleanliness * 0.7 + criticATone * 0.3)
    : baseBreakdown.anti_slop_cleanliness;
  const blendedAdsense = criticBOk
    ? clampScore(baseBreakdown.adsense_compliance * 0.7 + criticBAdsense * 0.3)
    : baseBreakdown.adsense_compliance;

  let overall = clampScore(
    blendedSeo * 0.16 +
      blendedGeo * 0.18 +
      blendedInfoGain * 0.22 +
      blendedGrounding * 0.18 +
      blendedAntiSlop * 0.14 +
      blendedAdsense * 0.12,
  );

  if (!activeLint.passed) {
    overall = Math.min(overall, 65);
  }

  const judgeNotesParts = criticEntries
    .filter((c) => c.verdict !== 'unavailable' && c.notes)
    .map((c) => `[${c.family} / ${c.role === 'editorial_visuals_tone' ? 'Editorial' : 'SEO+AdSense'}] ${c.notes}`);
  if (revisionApplied) {
    judgeNotesParts.push('Automated cross-family revision pass applied and re-linted.');
  }

  const resolvedJudgeModel = criticAOk && criticBOk ? `${criticAModel} + ${criticBModel}` : criticAOk ? criticAModel : criticBModel;
  ctx.judgeModel = resolvedJudgeModel;

  const finalBreakdown: QualityBreakdown = {
    overall,
    seo_structure: blendedSeo,
    geo_citation_readiness: blendedGeo,
    information_gain: blendedInfoGain,
    source_grounding: blendedGrounding,
    anti_slop_cleanliness: blendedAntiSlop,
    adsense_compliance: blendedAdsense,
    warnings: Array.from(new Set([...baseBreakdown.warnings, ...combinedWarnings, ...structuralTriggers])).slice(0, 12),
    judge_notes: judgeNotesParts.join(' ') || undefined,
    ...(baseBreakdown.humanity_signals ? { humanity_signals: baseBreakdown.humanity_signals } : {}),
    dual_critic_review: dualReview,
  };

  pushTrace(trace, {
    stage: 'quality_assessment',
    tool_name: 'openrouter_editorial_judge',
    input: resolvedJudgeModel,
    summary: `Dual-family score ${overall}/100 (crossFamily=${crossFamilyVerified}, revised=${revisionApplied}, table=${finalHasTable}, images=${finalHasImages})`,
    ok: true,
  });

  return {
    finalScore: overall,
    finalBreakdown,
    resolvedJudgeModel,
    ...(revisedDraft ? { revisedDraft } : {}),
    ...(revisedLintResult ? { revisedLintResult } : {}),
  };
}

const DRAFT_MODEL_TRACE_TOOLS = new Set([
  'openrouter_lint_correction',
  'openrouter_json_retry',
  'openrouter_draft',
  'openrouter_topic_selection',
]);

function resolveRecordedModelFromTrace(ctx: AgentContext, trace?: TraceEntry[]): string {
  if (Array.isArray(trace)) {
    for (let i = trace.length - 1; i >= 0; i--) {
      const entry = trace[i];
      if (
        entry &&
        entry.ok &&
        DRAFT_MODEL_TRACE_TOOLS.has(entry.tool_name) &&
        typeof entry.input === 'string' &&
        entry.input.includes('/')
      ) {
        return entry.input.trim();
      }
    }
  }
  return ctx.model;
}

/**
 * Stage 6: Compile markdown, ensure unique slug, enforce the HARD PUBLISHING GATE,
 * persist a brand-new post (never mutating existing posts), and mark agent_runs completed.
 */
export async function stagePersistWithGate(
  db: DatabaseAdapter,
  ctx: AgentContext,
  draft: DraftArticlePayload,
  lintResult: LintResult,
  finalScore: number,
  finalBreakdown: QualityBreakdown,
  runId?: number,
  trace?: TraceEntry[],
  usage?: TokenUsage,
): Promise<PersistGateOutput> {
  const compiled = compileMarkdown(draft.body_markdown);
  const desiredSlug = slugify(draft.slug || draft.title, 80) || 'technical-briefing';
  const uniqueSlug = await ensureUniqueSlug(db, desiredSlug);

  // Final safety duplicate check (never allow an overlapping post to auto-publish unless forceWrite=true)
  const dupCheck = findDuplicatePost(
    {
      title: draft.title,
      keywords: draft.keywords,
      urls: draft.sources,
    },
    ctx.recentPosts,
    0.58,
  );
  const heldForDuplicate = dupCheck.isDuplicate && !ctx.forceWrite;

  // HARD PUBLISHING GATE
  const shouldPublish =
    ctx.settings.publishing_mode === 'auto_publish' &&
    lintResult.passed &&
    finalScore >= ctx.settings.min_publish_score &&
    !heldForDuplicate;

  const resolvedStatus: PostStatus = shouldPublish ? 'published' : 'draft';
  const publishedAt = resolvedStatus === 'published' ? new Date().toISOString() : null;

  const reviewNotes = [...draft.review_notes];
  if (heldForDuplicate) {
    reviewNotes.push(
      `Warning — Held in draft by duplicate safety gate: ${dupCheck.reason || 'overlaps with an existing post'}.`,
    );
  }
  if (resolvedStatus === 'draft' && !heldForDuplicate) {
    if (ctx.settings.publishing_mode !== 'auto_publish') {
      reviewNotes.push('Held in draft: publishing_mode is draft_review.');
    } else if (!lintResult.passed) {
      reviewNotes.push(`Held in draft: failed deterministic lint (${lintResult.errors.length} error(s)).`);
    } else if (finalScore < ctx.settings.min_publish_score) {
      reviewNotes.push(
        `Held in draft: quality score ${finalScore} is below min_publish_score (${ctx.settings.min_publish_score}).`,
      );
    }
  }

  // Agent strictly creates brand-new posts and never mutates existing posts via db.updatePost
  const post = await db.createPost({
    slug: uniqueSlug,
    title: draft.title,
    description: draft.description,
    tldr_summary: draft.tldr_summary,
    key_facts_json: draft.key_facts,
    faq_json: draft.faq,
    body_markdown: draft.body_markdown,
    body_html: compiled.html,
    cover_image_url: draft.cover_image_url,
    cover_image_alt: draft.cover_image_alt,
    images_json: draft.images,
    author: ctx.settings.default_author,
    category_slug: ctx.skill.slug,
    archetype: ctx.archetype,
    tags_json: draft.tags,
    keywords_json: draft.keywords,
    sources_json: draft.sources,
    review_notes_json: reviewNotes,
    lint_passed: lintResult.passed,
    lint_errors_json: lintResult.errors,
    quality_score: finalScore,
    quality_breakdown_json: finalBreakdown,
    reading_time_minutes: compiled.readingTimeMinutes,
    word_count: compiled.wordCount,
    status: resolvedStatus,
    admin_locked: false,
    last_edited_by: null,
    published_at: publishedAt,
  });

  const resolvedModelUsed = resolveRecordedModelFromTrace(ctx, trace);

  if (trace) {
    pushTrace(trace, {
      stage: 'persist_with_gate',
      tool_name: 'stagePersistWithGate',
      input: uniqueSlug,
      summary: `Persisted post #${post.id} (${uniqueSlug}) as "${resolvedStatus}" via ${resolvedModelUsed} (score=${finalScore}, lint_passed=${lintResult.passed}${heldForDuplicate ? ', duplicate_guard=held' : ''})`,
      ok: true,
    });
  }

  const decisionReason =
    resolvedStatus === 'published'
      ? `Auto-published (quality_score=${finalScore}, lint_passed=true).`
      : heldForDuplicate
        ? `Held in draft by duplicate safety gate: ${dupCheck.reason || 'overlaps existing post'}`
        : `Saved as draft (publishing_mode=${ctx.settings.publishing_mode}, score=${finalScore}, lint_passed=${lintResult.passed}).`;

  let run: AgentRunRecord | null = null;
  if (typeof runId === 'number' && runId > 0) {
    const completedAt = new Date().toISOString();
    run = await db.updateAgentRun(runId, {
      status: 'completed',
      current_stage: 'completed',
      category_slug: ctx.skill.slug,
      archetype: ctx.archetype,
      topic: draft.title,
      model_used: resolvedModelUsed,
      post_id: post.id,
      quality_score: finalScore,
      decision_reason: decisionReason,
      ...(trace ? { trace_json: trace } : {}),
      ...(usage ? { token_usage_json: usage } : {}),
      error_message: null,
      completed_at: completedAt,
    });
  }

  return { post, run };
}

/**
 * Runs the full 6-stage editorial agent pipeline synchronously in-process
 * (used for local dev, tests, or fallback when Cloudflare Workflows binding is unavailable).
 */
export async function runEditorialAgentDirect(
  db: DatabaseAdapter,
  env: WorkerEnv,
  payload: AgentDispatchPayload,
): Promise<{ run: AgentRunRecord; post: PostRecord | null }> {
  const trace: TraceEntry[] = [];
  const usage = createEmptyTokenUsage();

  let runRecord: AgentRunRecord | null = null;
  if (payload.run_id) {
    runRecord = await db.getAgentRunById(payload.run_id);
  }
  if (!runRecord) {
    const initialModel =
      resolveFreeModelChain(payload.model_override || env.DEFAULT_OPENROUTER_MODEL, true)[0] ||
      CURATED_FREE_MODELS[0];
    runRecord = await db.createAgentRun({
      trigger_source: payload.trigger_source || 'manual',
      category_slug: payload.category_slug || 'auto',
      topic: payload.topic || 'auto',
      archetype: payload.archetype || 'auto',
      model_used: initialModel,
      status: 'running',
      current_stage: 'load_context',
    });
  } else {
    const updated = await db.updateAgentRun(runRecord.id, {
      status: 'running',
      current_stage: 'load_context',
      error_message: null,
    });
    if (updated) runRecord = updated;
  }

  const runId = runRecord.id;

  try {
    // Stage 1: Load context
    const ctx = await stageLoadContext(db, payload);
    await db.updateAgentRun(runId, {
      current_stage: 'hunt_topics',
      category_slug: ctx.skill.slug,
      archetype: ctx.archetype,
      model_used: ctx.model,
    });

    // Stage 2: Hunt topics + novelty/dedup/daily-cap gates
    const hunted = await stageHuntTopics(env, ctx, payload.topic, trace, usage);
    if (hunted.decision !== 'publish_worthy') {
      const completedAt = new Date().toISOString();
      const decisionReason = hunted.skipReason || 'Skipped by editorial gate';
      const updatedRun = await db.updateAgentRun(runId, {
        status: 'skipped',
        current_stage: hunted.decision,
        topic: hunted.topic,
        model_used: hunted.resolvedModel || ctx.model,
        decision_reason: decisionReason,
        trace_json: trace,
        token_usage_json: usage,
        completed_at: completedAt,
      });
      return {
        run:
          updatedRun ||
          (await db.getAgentRunById(runId)) || {
            ...runRecord,
            status: 'skipped',
            current_stage: hunted.decision,
            topic: hunted.topic,
            model_used: hunted.resolvedModel || ctx.model,
            decision_reason: decisionReason,
            trace_json: trace,
            token_usage_json: usage,
            completed_at: completedAt,
          },
        post: null,
      };
    }

    await db.updateAgentRun(runId, {
      current_stage: 'deep_research',
      topic: hunted.topic,
      model_used: hunted.resolvedModel || ctx.model,
      trace_json: trace,
      token_usage_json: usage,
    });

    // Stage 3: Deep research
    const sources = await stageDeepResearch(
      env,
      hunted.topic,
      hunted.searchQueries,
      hunted.feedItems,
      trace,
    );
    await db.updateAgentRun(runId, {
      current_stage: 'draft_and_refine',
      trace_json: trace,
    });

    // Stage 4: Draft & deterministic self-correction loop
    const { draft, lintResult, resolvedModel } = await stageDraftAndRefine(
      env,
      ctx,
      hunted.topic,
      sources,
      trace,
      usage,
    );
    if (resolvedModel) {
      ctx.model = resolvedModel;
    }
    await db.updateAgentRun(runId, {
      current_stage: 'quality_assessment',
      model_used: ctx.model,
      trace_json: trace,
      token_usage_json: usage,
    });

    // Stage 5: Cross-family dual-model critic review & revision loop
    const { finalScore, finalBreakdown, revisedDraft, revisedLintResult } =
      await stageQualityAssessment(
        env,
        ctx,
        draft,
        lintResult,
        trace,
        usage,
        sources,
      );
    const finalDraft = revisedDraft || draft;
    const finalLintResult = revisedLintResult || lintResult;
    await db.updateAgentRun(runId, {
      current_stage: 'persist_with_gate',
      model_used: ctx.model,
      quality_score: finalScore,
      trace_json: trace,
      token_usage_json: usage,
    });

    // Stage 6: Persist post with hard publishing gate
    const { post, run } = await stagePersistWithGate(
      db,
      ctx,
      finalDraft,
      finalLintResult,
      finalScore,
      finalBreakdown,
      runId,
      trace,
      usage,
    );

    return {
      run: run || (await db.getAgentRunById(runId)) || runRecord,
      post,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    pushTrace(trace, {
      stage: 'error',
      tool_name: 'runEditorialAgentDirect',
      input: String(runId),
      summary: errorMessage,
      ok: false,
    });
    const failedRun = await db.updateAgentRun(runId, {
      status: 'failed',
      current_stage: 'failed',
      trace_json: trace,
      token_usage_json: usage,
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    });
    return {
      run: failedRun || {
        ...runRecord,
        status: 'failed',
        current_stage: 'failed',
        trace_json: trace,
        token_usage_json: usage,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      },
      post: null,
    };
  }
}
