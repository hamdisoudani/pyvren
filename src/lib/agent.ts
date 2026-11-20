import type { WorkerEnv } from '../env';
import type {
  AgentDispatchPayload,
  AgentRunRecord,
  Archetype,
  CategorySkill,
  DatabaseAdapter,
  FaqItem,
  KeyFact,
  LintResult,
  PostRecord,
  PostStatus,
  QualityBreakdown,
  SiteSettings,
  TokenUsage,
  TraceEntry,
} from '../types';
import { ensureUniqueSlug } from './db';
import { lintPostPayload } from './linter';
import { compileMarkdown } from './markdown';
import { callOpenRouter, extractJsonObject } from './openrouter';
import { isSafePublicUrl, slugify } from './security';
import { buildSkillSystemPrompt, selectArchetype, selectSkillForRun } from './skills';
import {
  fetchAuthoritativeFeed,
  readPrimaryWebpage,
  searchWebSources,
  type FeedItem,
} from './tools';

export interface AgentContext {
  settings: SiteSettings;
  skill: CategorySkill;
  archetype: Archetype;
  model: string;
  judgeModel: string;
  recentTitles: string[];
  recentSlugs: string[];
}

export interface TopicHuntOutput {
  topic: string;
  angle: string;
  searchQueries: string[];
  feedItems: FeedItem[];
}

export interface PrimarySourceDoc {
  url: string;
  title: string;
  markdown: string;
  chars: number;
  snippet?: string;
}

export interface DraftArticlePayload {
  title: string;
  slug: string;
  description: string;
  tldr_summary: string;
  key_facts: KeyFact[];
  faq: FaqItem[];
  body_markdown: string;
  tags: string[];
  sources: string[];
  review_notes: string[];
}

export interface DraftAndRefineOutput {
  draft: DraftArticlePayload;
  lintResult: LintResult;
  attempts: number;
}

export interface QualityAssessmentOutput {
  finalScore: number;
  finalBreakdown: QualityBreakdown;
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
  const body_markdown = typeof raw.body_markdown === 'string' ? raw.body_markdown.trim() : '';

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
    key_facts,
    faq,
    body_markdown,
    tags,
    sources: Array.from(sourceSet).slice(0, 10),
    review_notes,
  };
}

/**
 * Stage 1: Load site settings, select category skill & archetype, and fetch recent titles for dedupe.
 */
export async function stageLoadContext(
  db: DatabaseAdapter,
  payload: AgentDispatchPayload,
): Promise<AgentContext> {
  const [settings, skills, recentPosts] = await Promise.all([
    db.getSettings(),
    db.listSkills(false),
    db.listPosts({ limit: 30 }),
  ]);

  const skill = selectSkillForRun(skills, payload.category_slug, recentPosts);
  const lastArchetype = recentPosts[0]?.archetype;
  const archetype = selectArchetype(skill, payload.archetype, lastArchetype);
  const model =
    payload.model_override?.trim() ||
    settings.openrouter_model?.trim() ||
    'google/gemini-2.5-flash';
  const judgeModel = settings.judge_model?.trim() || model;

  return {
    settings,
    skill,
    archetype,
    model,
    judgeModel,
    recentTitles: recentPosts.map((p) => p.title).slice(0, 20),
    recentSlugs: recentPosts.map((p) => p.slug).slice(0, 20),
  };
}

/**
 * Stage 2: Query skill feeds + seed web search, then ask OpenRouter to pick the highest-value,
 * freshest, non-duplicate topic plus 3-5 primary-source search queries.
 */
export async function stageHuntTopics(
  env: WorkerEnv,
  ctx: AgentContext,
  requestedTopic: string | undefined,
  trace: TraceEntry[],
  usage: TokenUsage,
): Promise<TopicHuntOutput> {
  const feedNames = (ctx.skill.research_feeds_json || []).slice(0, 3);
  const feedResults = await Promise.all(
    feedNames.map((feed) => fetchAuthoritativeFeed(feed, trace)),
  );
  const feedItems: FeedItem[] = feedResults.flat().slice(0, 24);

  const cleanRequested = (requestedTopic || '').trim();
  const hasExplicitTopic =
    cleanRequested.length > 0 && cleanRequested.toLowerCase() !== 'auto';

  const seedQueries = hasExplicitTopic
    ? [cleanRequested]
    : (ctx.skill.search_queries_json || []).slice(0, 2);

  const seedSearchHits = (
    await Promise.all(seedQueries.map((q) => searchWebSources(q, env, trace)))
  ).flat();

  const feedDigest = feedItems
    .slice(0, 16)
    .map(
      (item, i) =>
        `[${i + 1}] ${item.title} (${item.published || 'recent'})\nURL: ${item.url}\nSummary: ${item.summary.slice(0, 220)}`,
    )
    .join('\n\n');

  const searchDigest = seedSearchHits
    .slice(0, 10)
    .map((hit, i) => `[S${i + 1}] ${hit.title}\nURL: ${hit.url}\nSnippet: ${hit.snippet}`)
    .join('\n\n');

  const existingDigest =
    ctx.recentTitles.length > 0
      ? ctx.recentTitles.map((t) => `- ${t}`).join('\n')
      : '(none yet)';

  const systemPrompt = `You are the Chief Research Strategist for ${ctx.settings.site_name}.
Your job is to pick ONE concrete, timely, primary-source-verifiable engineering topic for category "${ctx.skill.name}" (${ctx.skill.slug}) using archetype "${ctx.archetype}".
Never pick a topic that duplicates recent published articles.
Return ONLY valid JSON:
{
  "topic": "Specific technical topic headline or working thesis (no fluff)",
  "angle": "1-2 sentences describing the concrete engineering angle, metrics, or remediation focus",
  "search_queries": ["3 to 5 targeted web search queries to find primary documentation, benchmarks, papers, or vendor advisories"]
}`;

  const userPrompt = hasExplicitTopic
    ? `EXPLICIT REQUESTED TOPIC: ${cleanRequested}
CATEGORY INSTRUCTIONS: ${ctx.skill.system_instructions}
ARCHETYPE: ${ctx.archetype}
RECENT ARTICLES (avoid duplicating angle):
${existingDigest}

RECENT FEED CONTEXT:
${feedDigest || '(no feed items)'}

SEED SEARCH HITS:
${searchDigest || '(no seed search hits)'}

Keep the requested topic focused, factual, and verifiable, and produce 3 to 5 targeted search queries for primary documentation, benchmarks, papers, or advisories.`
    : `CATEGORY: ${ctx.skill.name} — ${ctx.skill.description}
CATEGORY INSTRUCTIONS: ${ctx.skill.system_instructions}
TARGET AUDIENCE: ${ctx.skill.target_audience}
ARCHETYPE: ${ctx.archetype}
DEFAULT EDITORIAL FOCUS: ${ctx.settings.default_topic_feed}

RECENT ARTICLES (DO NOT DUPLICATE):
${existingDigest}

AUTHORITATIVE FEED CANDIDATES:
${feedDigest || '(no feed items returned)'}

SEED WEB SEARCH HITS:
${searchDigest || '(no seed search hits)'}

Select the single highest-value, freshest, non-duplicate technical topic supported by primary sources and return 3 to 5 targeted primary-source search queries.`;

  try {
    const completion = await callOpenRouter(env, {
      model: ctx.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 900,
      jsonMode: true,
    });
    addTokenUsage(usage, completion.usage);

    const parsed = extractJsonObject<{
      topic?: string;
      angle?: string;
      search_queries?: string[];
    }>(completion.content);

    const selectedTopic =
      (parsed.topic || '').trim() ||
      (hasExplicitTopic ? cleanRequested : feedItems[0]?.title || ctx.skill.name);
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

    pushTrace(trace, {
      stage: 'hunt_topics',
      tool_name: 'openrouter_topic_selection',
      input: hasExplicitTopic ? cleanRequested : ctx.skill.slug,
      summary: `Selected topic "${selectedTopic}" with ${searchQueries.length} search queries`,
      ok: true,
    });

    return {
      topic: selectedTopic,
      angle,
      searchQueries,
      feedItems,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const fallbackTopic = hasExplicitTopic
      ? cleanRequested
      : feedItems[0]?.title || `${ctx.skill.name} Engineering Analysis`;
    const fallbackQueries = Array.from(
      new Set([
        fallbackTopic,
        ...(ctx.skill.search_queries_json || []),
      ]),
    ).slice(0, 4);

    pushTrace(trace, {
      stage: 'hunt_topics',
      tool_name: 'openrouter_topic_selection',
      input: ctx.skill.slug,
      summary: `Topic selection LLM fallback (${message}); using "${fallbackTopic}"`,
      ok: false,
    });

    return {
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
  const queries = Array.from(
    new Set([topic, ...searchQueries].map((q) => q.trim()).filter(Boolean)),
  ).slice(0, 4);

  const searchBatches = await Promise.all(
    queries.map((q) => searchWebSources(q, env, trace)),
  );
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
    if (!isDeepUrl(hit.url) || seenUrls.has(hit.url)) continue;
    seenUrls.add(hit.url);
    candidates.push({
      url: hit.url,
      title: hit.title,
      snippet: hit.snippet,
      score: scoreCandidate(hit.url, hit.title, hit.snippet, 10),
    });
  }

  for (const item of feedItems) {
    if (!isDeepUrl(item.url) || seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    candidates.push({
      url: item.url,
      title: item.title,
      snippet: item.summary,
      score: scoreCandidate(item.url, item.title, item.summary, 6),
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const primarySources: PrimarySourceDoc[] = [];
  const maxReadsToAttempt = Math.min(candidates.length, 10);
  const targetSourceCount = 5;

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
      });
      alreadyAdded.add(candidate.url);
    }
  }

  pushTrace(trace, {
    stage: 'deep_research',
    tool_name: 'stageDeepResearch',
    input: topic,
    summary: `Collected ${primarySources.length} primary sources from ${maxReadsToAttempt} attempted reads`,
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

  const userPrompt = `TOPIC TO COVER:
${topic}

TARGET ARCHETYPE: ${ctx.archetype}
HUMAN AUTHOR BYLINE: ${ctx.settings.default_author}
RECENT ARTICLES ON THIS SITE (do not repeat):
${ctx.recentTitles.slice(0, 10).map((t) => `- ${t}`).join('\n') || '(none)'}

PRIMARY SOURCE DOSSIER (ground every factual claim, benchmark, version, and inline citation in these URLs):
${sourceDossier}

Write the complete publication-ready article now as a single valid JSON object adhering strictly to all schema, GEO/AEO, citation, and anti-slop rules.`;

  const draftRes = await callOpenRouter(env, {
    model: ctx.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 8_192,
    jsonMode: true,
  });
  addTokenUsage(usage, draftRes.usage);

  let parsedDraftRaw: Partial<DraftArticlePayload>;
  try {
    parsedDraftRaw = extractJsonObject<Partial<DraftArticlePayload>>(draftRes.content);
  } catch (firstParseErr) {
    const parseMsg = firstParseErr instanceof Error ? firstParseErr.message : String(firstParseErr);
    pushTrace(trace, {
      stage: 'draft_and_refine',
      tool_name: 'json_parse_retry',
      input: 'attempt 1',
      summary: `Initial draft JSON malformed (${parseMsg}); retrying with strict JSON formatting`,
      ok: false,
    });
    const retryJsonRes = await callOpenRouter(env, {
      model: ctx.model,
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
    });
    addTokenUsage(usage, retryJsonRes.usage);
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
      model: ctx.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: correctionPrompt },
      ],
      temperature: 0.2,
      maxTokens: 6_000,
      jsonMode: true,
    });
    addTokenUsage(usage, retryRes.usage);

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

  return { draft, lintResult, attempts };
}

/**
 * Stage 5: Combine deterministic quality breakdown with a compact OpenRouter editorial critic check.
 * Gracefully degrades to the deterministic score if the LLM judge fails.
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
  const baseBreakdown: QualityBreakdown = {
    ...lintResult.quality_breakdown,
    warnings: [...lintResult.quality_breakdown.warnings],
  };

  const sourceExcerpts =
    sources && sources.length > 0
      ? sources
          .slice(0, 5)
          .map((s, idx) => `[${idx + 1}] ${s.url} — ${s.title}\n${s.markdown.slice(0, 1_200)}`)
          .join('\n\n')
      : draft.sources.map((u, idx) => `[${idx + 1}] ${u}`).join('\n');

  const judgeSystem = `You are a strict principal engineering editor auditing a draft before publication on ${ctx.settings.site_name}.
Evaluate the draft against three criteria:
1. factual_grounding (0-100): Are technical claims, metrics, and versions genuinely supported by the cited primary sources without hallucination?
2. geo_clarity (0-100): Are tldr_summary, key_facts, faq, and headings concise, answer-first, and extractable by search/AI engines?
3. anti_slop_tone (0-100): Is the prose crisp, authoritative, non-generic, and strictly defensive/AdSense-safe?

Return ONLY valid JSON:
{
  "factual_grounding": 0-100,
  "geo_clarity": 0-100,
  "anti_slop_tone": 0-100,
  "judge_notes": "1-3 concrete sentences of editorial critique",
  "warnings": ["optional short actionable warning strings"]
}`;

  const judgeUser = `CATEGORY: ${ctx.skill.name} (${ctx.archetype})
TITLE: ${draft.title}
DESCRIPTION: ${draft.description}
TLDR: ${draft.tldr_summary}
KEY FACTS: ${JSON.stringify(draft.key_facts)}
FAQ: ${JSON.stringify(draft.faq)}
DETERMINISTIC LINT PASSED: ${lintResult.passed}
DETERMINISTIC SCORE: ${lintResult.quality_score}

ARTICLE BODY (EXCERPT):
${draft.body_markdown.slice(0, 9_000)}

PRIMARY SOURCES:
${sourceExcerpts}`;

  try {
    const judgeRes = await callOpenRouter(env, {
      model: ctx.judgeModel,
      messages: [
        { role: 'system', content: judgeSystem },
        { role: 'user', content: judgeUser },
      ],
      temperature: 0.1,
      maxTokens: 700,
      jsonMode: true,
    });
    addTokenUsage(usage, judgeRes.usage);

    const parsed = extractJsonObject<{
      factual_grounding?: number;
      geo_clarity?: number;
      anti_slop_tone?: number;
      judge_notes?: string;
      warnings?: string[];
    }>(judgeRes.content);

    const judgeGrounding =
      typeof parsed.factual_grounding === 'number' && Number.isFinite(parsed.factual_grounding)
        ? clampScore(parsed.factual_grounding)
        : baseBreakdown.source_grounding;
    const judgeGeo =
      typeof parsed.geo_clarity === 'number' && Number.isFinite(parsed.geo_clarity)
        ? clampScore(parsed.geo_clarity)
        : baseBreakdown.geo_citation_readiness;
    const judgeAntiSlop =
      typeof parsed.anti_slop_tone === 'number' && Number.isFinite(parsed.anti_slop_tone)
        ? clampScore(parsed.anti_slop_tone)
        : baseBreakdown.anti_slop_cleanliness;

    // Blend 70% deterministic + 30% editorial critic on semantic dimensions
    const blendedGrounding = clampScore(baseBreakdown.source_grounding * 0.7 + judgeGrounding * 0.3);
    const blendedGeo = clampScore(baseBreakdown.geo_citation_readiness * 0.7 + judgeGeo * 0.3);
    const blendedAntiSlop = clampScore(baseBreakdown.anti_slop_cleanliness * 0.7 + judgeAntiSlop * 0.3);

    let overall = clampScore(
      baseBreakdown.seo_structure * 0.16 +
        blendedGeo * 0.18 +
        baseBreakdown.information_gain * 0.22 +
        blendedGrounding * 0.18 +
        blendedAntiSlop * 0.14 +
        baseBreakdown.adsense_compliance * 0.12,
    );

    // If deterministic lint failed, cap final score so an unlinted draft can never look publish-ready
    if (!lintResult.passed) {
      overall = Math.min(overall, 65);
    }

    const extraWarnings = Array.isArray(parsed.warnings)
      ? parsed.warnings
          .filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
          .map((w) => w.trim())
          .slice(0, 4)
      : [];

    const finalBreakdown: QualityBreakdown = {
      overall,
      seo_structure: baseBreakdown.seo_structure,
      geo_citation_readiness: blendedGeo,
      information_gain: baseBreakdown.information_gain,
      source_grounding: blendedGrounding,
      anti_slop_cleanliness: blendedAntiSlop,
      adsense_compliance: baseBreakdown.adsense_compliance,
      warnings: Array.from(new Set([...baseBreakdown.warnings, ...extraWarnings])),
      judge_notes: typeof parsed.judge_notes === 'string' ? parsed.judge_notes.trim() : undefined,
    };

    pushTrace(trace, {
      stage: 'quality_assessment',
      tool_name: 'openrouter_editorial_judge',
      input: ctx.judgeModel,
      summary: `Blended quality score ${overall}/100 (deterministic=${lintResult.quality_score}, grounding=${judgeGrounding}, geo=${judgeGeo}, tone=${judgeAntiSlop})`,
      ok: true,
    });

    return {
      finalScore: overall,
      finalBreakdown,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const degradedScore = lintResult.passed
      ? lintResult.quality_score
      : Math.min(lintResult.quality_score, 65);

    baseBreakdown.overall = degradedScore;
    baseBreakdown.judge_notes = `Editorial LLM judge unavailable (${message}); scored deterministically.`;

    pushTrace(trace, {
      stage: 'quality_assessment',
      tool_name: 'openrouter_editorial_judge',
      input: ctx.judgeModel,
      summary: `LLM judge failed (${message}); degraded cleanly to deterministic score ${degradedScore}`,
      ok: false,
    });

    return {
      finalScore: degradedScore,
      finalBreakdown: baseBreakdown,
    };
  }
}

/**
 * Stage 6: Compile markdown, ensure unique slug, enforce the HARD PUBLISHING GATE,
 * persist post, and mark agent_runs completed.
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

  // HARD PUBLISHING GATE
  const shouldPublish =
    ctx.settings.publishing_mode === 'auto_publish' &&
    lintResult.passed &&
    finalScore >= ctx.settings.min_publish_score;

  const status: PostStatus = shouldPublish ? 'published' : 'draft';
  const publishedAt = status === 'published' ? new Date().toISOString() : null;

  const reviewNotes = [...draft.review_notes];
  if (status === 'draft') {
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

  const post = await db.createPost({
    slug: uniqueSlug,
    title: draft.title,
    description: draft.description,
    tldr_summary: draft.tldr_summary,
    key_facts_json: draft.key_facts,
    faq_json: draft.faq,
    body_markdown: draft.body_markdown,
    body_html: compiled.html,
    author: ctx.settings.default_author,
    category_slug: ctx.skill.slug,
    archetype: ctx.archetype,
    tags_json: draft.tags,
    sources_json: draft.sources,
    review_notes_json: reviewNotes,
    lint_passed: lintResult.passed,
    lint_errors_json: lintResult.errors,
    quality_score: finalScore,
    quality_breakdown_json: finalBreakdown,
    reading_time_minutes: compiled.readingTimeMinutes,
    word_count: compiled.wordCount,
    status,
    published_at: publishedAt,
  });

  if (trace) {
    pushTrace(trace, {
      stage: 'persist_with_gate',
      tool_name: 'stagePersistWithGate',
      input: uniqueSlug,
      summary: `Persisted post #${post.id} (${uniqueSlug}) as "${status}" (score=${finalScore}, lint_passed=${lintResult.passed})`,
      ok: true,
    });
  }

  let run: AgentRunRecord | null = null;
  if (typeof runId === 'number' && runId > 0) {
    const completedAt = new Date().toISOString();
    run = await db.updateAgentRun(runId, {
      status: 'completed',
      current_stage: 'completed',
      category_slug: ctx.skill.slug,
      archetype: ctx.archetype,
      topic: draft.title,
      model_used: ctx.model,
      post_id: post.id,
      quality_score: finalScore,
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
    runRecord = await db.createAgentRun({
      trigger_source: payload.trigger_source || 'manual',
      category_slug: payload.category_slug || 'auto',
      topic: payload.topic || 'auto',
      archetype: payload.archetype || 'auto',
      model_used: payload.model_override || env.DEFAULT_OPENROUTER_MODEL || '',
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

    // Stage 2: Hunt topics
    const hunted = await stageHuntTopics(env, ctx, payload.topic, trace, usage);
    await db.updateAgentRun(runId, {
      current_stage: 'deep_research',
      topic: hunted.topic,
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
    const { draft, lintResult } = await stageDraftAndRefine(
      env,
      ctx,
      hunted.topic,
      sources,
      trace,
      usage,
    );
    await db.updateAgentRun(runId, {
      current_stage: 'quality_assessment',
      trace_json: trace,
      token_usage_json: usage,
    });

    // Stage 5: Blended deterministic + LLM quality assessment
    const { finalScore, finalBreakdown } = await stageQualityAssessment(
      env,
      ctx,
      draft,
      lintResult,
      trace,
      usage,
      sources,
    );
    await db.updateAgentRun(runId, {
      current_stage: 'persist_with_gate',
      quality_score: finalScore,
      trace_json: trace,
      token_usage_json: usage,
    });

    // Stage 6: Persist post with hard publishing gate
    const { post, run } = await stagePersistWithGate(
      db,
      ctx,
      draft,
      lintResult,
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
