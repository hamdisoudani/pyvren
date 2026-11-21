import type { Archetype, CategorySkill, PostRecord, SiteSettings } from '../types';

export const ARCHETYPES: Archetype[] = [
  'advisory-teardown',
  'benchmark-index',
  'migration-fix-log',
  'architecture-analysis',
];

const ARCHETYPE_GUIDANCE: Record<Archetype, string> = {
  'advisory-teardown':
    'Write a high-urgency technical advisory teardown: lead with affected systems/versions, blast radius, root-cause mechanism, concrete defensive mitigations, and exact verification steps.',
  'benchmark-index':
    'Write a quantitative benchmark and cost/performance index: compare at least two real systems/models in a Markdown table with exact metrics (latency, throughput, pricing, memory, or error rates), methodology notes, and production tradeoffs.',
  'migration-fix-log':
    'Write a field-ready engineering migration and fix log: document the breaking change or bottleneck, before/after configuration or code diff, rollback safeguards, and measurable impact.',
  'architecture-analysis':
    'Write a deep systems architecture analysis: break down control/data planes, documented platform limits, failure modes, scaling math, concrete configs, and clear guidance on when NOT to use the architecture.',
};

const PROMPT_BANNED_PHRASES = [
  'delve',
  'delving',
  "in today's fast-paced",
  'ever-evolving',
  'testament to',
  'game-changer',
  'unlock the power',
  'unlocking the power',
  'it is important to note',
  "it's worth noting",
  'in conclusion',
  'without further ado',
  'tapestry',
  'realm of',
  'paradigm shift',
  'seamless',
  'seamlessly',
  'leverage',
  'leveraging',
  "in today's digital landscape",
  'crucial role',
  'robust solution',
  'comprehensive guide',
  'cutting-edge',
  'revolutionize',
  'revolutionizing',
  'navigate the complexities',
  'spearhead',
  'pivotal',
  'paramount',
  'meticulous',
  'meticulously',
  'intricate',
  'beacon',
  'vibrant',
  'foster a',
  'it is worth mentioning',
  "let's dive in",
  'dive deep into',
  'at the end of the day',
  'unlocking the full potential',
  'a double-edged sword',
  'in the ever-changing',
  'stands as a',
  'in the realm of',
];

const PROMPT_BANNED_HEADINGS = [
  'Introduction',
  'Overview',
  'Conclusion',
  'Final Thoughts',
  'Summary',
  'Wrapping Up',
  'Key Takeaways',
  'Executive Summary',
];

function parsePostTimestamp(post: PostRecord): number {
  const raw = post.published_at || post.created_at;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Selects the category skill for an editorial run.
 * - Honors an explicit requestedSlug (unless omitted or 'auto').
 * - Otherwise rotates across enabled skills by least-recently-published category
 *   and descending priority so coverage stays diverse.
 */
export function selectSkillForRun(
  skills: CategorySkill[],
  requestedSlug?: string,
  recentPosts: PostRecord[] = [],
  maxPostsPerCategoryPerDay?: number,
  recentRuns: Array<{ category_slug?: string; status?: string; created_at?: string }> = [],
): CategorySkill {
  if (!skills || skills.length === 0) {
    throw new Error('No category skills available for editorial run.');
  }

  const normalizedRequest = (requestedSlug || '').trim().toLowerCase();
  if (normalizedRequest && normalizedRequest !== 'auto') {
    const exactMatch = skills.find((s) => s.slug.toLowerCase() === normalizedRequest);
    if (exactMatch) {
      return exactMatch;
    }
  }

  const enabled = skills.filter((s) => s.enabled);
  const baseCandidates = enabled.length > 0 ? enabled : skills;

  const nowMs = Date.now();
  const cutoff24h = nowMs - 24 * 60 * 60 * 1000;
  const recentAttemptCooldownMs = nowMs - 3 * 60 * 60 * 1000;
  const latestByCategory = new Map<string, number>();
  const countByCategory = new Map<string, number>();
  const count24hByCategory = new Map<string, number>();
  const latestAttemptByCategory = new Map<string, number>();

  for (const post of recentPosts) {
    const slug = (post.category_slug || '').toLowerCase();
    if (!slug) continue;
    const ts = parsePostTimestamp(post);
    const prev = latestByCategory.get(slug) ?? 0;
    if (ts > prev) {
      latestByCategory.set(slug, ts);
    }
    countByCategory.set(slug, (countByCategory.get(slug) ?? 0) + 1);
    const createdMs = Date.parse(post.created_at);
    if (Number.isFinite(createdMs) && createdMs >= cutoff24h) {
      count24hByCategory.set(slug, (count24hByCategory.get(slug) ?? 0) + 1);
    }
  }

  for (const run of recentRuns) {
    const slug = (run.category_slug || '').trim().toLowerCase();
    if (!slug || slug === 'auto') continue;
    if (run.status !== 'completed' && run.status !== 'skipped' && run.status !== 'failed') continue;
    const ts = run.created_at ? Date.parse(run.created_at) : NaN;
    if (!Number.isFinite(ts)) continue;
    const prev = latestAttemptByCategory.get(slug) ?? 0;
    if (ts > prev) {
      latestAttemptByCategory.set(slug, ts);
    }
  }

  // When a per-category daily cap is supplied, skip categories already at/above cap if any uncapped category exists
  let candidates = baseCandidates;
  if (typeof maxPostsPerCategoryPerDay === 'number' && maxPostsPerCategoryPerDay > 0) {
    const uncapped = baseCandidates.filter(
      (s) => (count24hByCategory.get(s.slug.toLowerCase()) ?? 0) < maxPostsPerCategoryPerDay,
    );
    if (uncapped.length > 0) {
      candidates = uncapped;
    }
  }

  // Avoid repeatedly re-probing a category that was just attempted/skipped within the last 3 hours
  const notRecentlyAttempted = candidates.filter(
    (s) => (latestAttemptByCategory.get(s.slug.toLowerCase()) ?? 0) < recentAttemptCooldownMs,
  );
  if (notRecentlyAttempted.length > 0) {
    candidates = notRecentlyAttempted;
  }

  const sorted = [...candidates].sort((a, b) => {
    const slugA = a.slug.toLowerCase();
    const slugB = b.slug.toLowerCase();

    // First prefer categories with fewer posts in the last 24h so every beat gets fair daily coverage
    const dayA = count24hByCategory.get(slugA) ?? 0;
    const dayB = count24hByCategory.get(slugB) ?? 0;
    if (dayA !== dayB) {
      return dayA - dayB;
    }

    // Next prefer the category least recently attempted (prevents getting stuck on quiet beats)
    const attA = latestAttemptByCategory.get(slugA) ?? 0;
    const attB = latestAttemptByCategory.get(slugB) ?? 0;
    if (attA !== attB) {
      return attA - attB;
    }

    const tsA = latestByCategory.get(slugA) ?? 0;
    const tsB = latestByCategory.get(slugB) ?? 0;

    // Categories with no recent posts (ts === 0) come first, then oldest published
    if (tsA !== tsB) {
      return tsA - tsB;
    }

    // Tiebreak by fewer recent posts in the window
    const countA = countByCategory.get(slugA) ?? 0;
    const countB = countByCategory.get(slugB) ?? 0;
    if (countA !== countB) {
      return countA - countB;
    }

    // Higher numeric priority wins
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }

    return slugA.localeCompare(slugB);
  });

  return sorted[0];
}

/**
 * Selects an article archetype, respecting explicit overrides while avoiding
 * repeating lastArchetype when rotating automatically.
 */
export function selectArchetype(
  skill: CategorySkill,
  requested?: Archetype | 'auto',
  lastArchetype?: Archetype,
): Archetype {
  if (requested && requested !== 'auto' && ARCHETYPES.includes(requested)) {
    return requested;
  }

  const preferred = (skill.preferred_archetypes_json || []).filter((a): a is Archetype =>
    ARCHETYPES.includes(a),
  );
  const pool = preferred.length > 0 ? preferred : ARCHETYPES;

  if (lastArchetype) {
    const nonRepeating = pool.filter((a) => a !== lastArchetype);
    if (nonRepeating.length > 0) {
      return nonRepeating[0];
    }
    const fallbackDifferent = ARCHETYPES.find((a) => a !== lastArchetype);
    if (fallbackDifferent) {
      return fallbackDifferent;
    }
  }

  return pool[0];
}

/**
 * Builds the strict editorial system prompt for OpenRouter article drafting.
 */
export function buildSkillSystemPrompt(
  skill: CategorySkill,
  archetype: Archetype,
  settings: SiteSettings,
): string {
  const requiredSections =
    skill.required_sections_json && skill.required_sections_json.length > 0
      ? skill.required_sections_json.map((s, idx) => `  ${idx + 1}. ${s}`).join('\n')
      : '  1. Technical Context & Core Finding\n  2. Quantitative Breakdown or Architecture\n  3. Implementation / Mitigation Details\n  4. Production Tradeoffs & Verification';

  const customBanned =
    skill.banned_patterns_json && skill.banned_patterns_json.length > 0
      ? `\n- Category-specific banned phrases: ${skill.banned_patterns_json.map((p) => `"${p}"`).join(', ')}`
      : '';

  const rubricNotes =
    skill.quality_rubric_json && Object.keys(skill.quality_rubric_json).length > 0
      ? `\nQUALITY RUBRIC TARGETS:\n${JSON.stringify(skill.quality_rubric_json, null, 2)}`
      : '';

  const isSecurityCategory =
    skill.slug.toLowerCase().includes('security') ||
    skill.slug.toLowerCase().includes('jailbreak') ||
    archetype === 'advisory-teardown';

  const safetySection = isSecurityCategory
    ? `DEFENSIVE SECURITY & ADSENSE SAFETY (MANDATORY):
- Frame all security, CVE, prompt injection, and jailbreak analysis strictly from a defensive engineering, detection, and hardening perspective.
- Cite primary advisories, peer-reviewed papers, OWASP LLM Top 10, NIST AI RMF, or vendor disclosures.
- NEVER include copy-paste exploit payloads, weaponized bypass strings, or actionable instructions to defeat safety filters or gain unauthorized access.
- Instead provide defensive detection patterns, isolation architectures, guardrail configs, and patch verification commands.`
    : `EDITORIAL INTEGRITY & ADSENSE SAFETY (MANDATORY):
- Write authoritative, original, publisher-grade technical journalism suitable for Google AdSense and senior engineering readers.
- Never fabricate benchmarks, CVEs, version numbers, or quotes. Only state figures supported by the provided primary sources; if a metric is unavailable, state that explicitly.
- Zero affiliate spam, zero clickbait hype, zero profanity, and zero harmful or illegal instructions.`;

  return `You are a senior systems engineer and technical editor writing for ${settings.site_name} (byline: ${settings.default_author}).

CATEGORY SKILL: ${skill.name} (${skill.slug})
TARGET AUDIENCE: ${skill.target_audience}
CATEGORY EDITORIAL DIRECTIVES:
${skill.system_instructions}

ARCHETYPE: ${archetype}
ARCHETYPE BRIEF:
${ARCHETYPE_GUIDANCE[archetype]}

REQUIRED SECTION FLOW (use concrete, domain-specific H2 headings — never generic labels):
${requiredSections}${rubricNotes}

${safetySection}

GEO / AEO ANSWER-FIRST & CITATION REQUIREMENTS:
- Provide a crisp, factual "tldr_summary" (80 to 240 characters) that directly answers the core engineering question upfront so AI answer engines can quote it verbatim.
- Provide 3 to 6 structured "key_facts" objects ({ "label": "...", "value": "...", "source_url": "https://..." }) containing concrete versions, latencies, costs, limits, or CVE identifiers.
- Provide 2 to 4 high-intent "faq" objects ({ "question": "...", "answer": "..." }) answering real practitioner follow-up questions concisely.
- Provide 5 to 8 high-intent lowercase search "keywords" targeting real developer and systems-engineering queries (distinct from slugified tags).
- Include at least ONE Markdown comparison/specification pipe table (| Col A | Col B | with | --- | --- | separator) AND/OR at least ONE non-empty fenced code block with a language tag (e.g. \`\`\`bash, \`\`\`typescript, \`\`\`json, \`\`\`yaml, \`\`\`sql). Including both is strongly preferred.
- Cite at least 3 DISTINCT deep primary https:// URLs inline inside body_markdown using descriptive Markdown links: [Anchor Text](https://domain.com/deep/path).
- NEVER link bare root domains (such as https://github.com/ or https://cloudflare.com) — every citation URL MUST have a specific deep path (pathname length > 1) and come from the provided primary sources.
- Also populate the top-level "sources" array with at least 2 (ideally 3-5) verified deep https:// URLs used in the article.
- REFERENCE IMAGES & DIAGRAMS: When VERIFIED CRAWLED REFERENCE IMAGES are provided in the prompt, select the single most informative diagram/screenshot/card as "cover_image_url" + "cover_image_alt", include 1-4 relevant entries in "images", and embed 1-2 relevant figures on their own paragraph line inside "body_markdown" as ![Descriptive engineering caption](https://exact-verified-image-url). NEVER invent, guess, or alter image URLs; if no crawled images are provided, set "cover_image_url" to "" and "images" to [].

HUMAN STAFF-ENGINEER VOICE & ANTI-AI-DETECTION RULES (MANDATORY):
- Write like a battle-tested staff engineer publishing peer-reviewed production field notes in collaboration with ${settings.default_author}, never like an AI assistant or marketing brochure.
- Vary sentence cadence intentionally for high burstiness: alternate punchy 6-10 word direct verdicts ("This default breaks under burst traffic.", "Skip the proxy layer.") with substantive 20-30 word technical explanations detailing mechanisms, limits, and failure modes.
- FORBIDDEN robotic transition openers: NEVER start sentences or paragraphs with "Furthermore,", "Moreover,", "Additionally,", "Consequently,", "Importantly,", "Notably,", "Ultimately,", or "Overall,". Connect ideas through technical causality instead.
- Em-dash discipline: keep em-dashes ("—" or "--") strictly to at most 1 per 100 words. Prefer commas, periods, or parentheses.
- NO walls of bold-colon bullets: NEVER write repetitive "- **Feature:** explanation" bullet stacks (keep bold-lead-in bullets well below 6 across the entire post). Present comparisons in prose paragraphs or a structured Markdown pipe table instead.
- Ground prose with real numbers, versions, latencies, memory caps, costs, or CVE/GHSA IDs from the provided primary sources.
- Include a concrete "When NOT to use this / Engineering Tradeoffs" section or explicit tradeoff nuance where appropriate, documenting operational limits, cost cliffs, or failure modes so the piece reads like honest engineering judgment rather than hype.

HARD LINT & ANTI-SLOP CONSTRAINTS (ZERO TOLERANCE):
- "title": strictly 30 to 70 characters, concrete and technical.
- "description": strictly 100 to 170 characters, summarizing concrete findings for search snippets.
- NEVER use a level-1 Markdown heading ("# ...") anywhere inside "body_markdown" (the page template renders the H1). Use "## " and "### " headings only.
- Write at least 650 words of dense technical prose (excluding fenced code blocks).
- NEVER use these banned AI clichés anywhere in prose: ${PROMPT_BANNED_PHRASES.map((p) => `"${p}"`).join(', ')}.${customBanned}
- NEVER use these generic headings: ${PROMPT_BANNED_HEADINGS.map((h) => `"${h}"`).join(', ')}.
- NEVER leave placeholders such as [TBD], [TODO], [Insert ...], [XX], TODO:, example.com, or lorem ipsum.

OUTPUT FORMAT:
Return ONLY a single valid JSON object (no surrounding markdown prose) matching this exact schema:
{
  "title": "string (30-70 chars)",
  "slug": "kebab-case-url-slug",
  "description": "string (100-170 chars)",
  "tldr_summary": "string (80-240 chars direct answer)",
  "cover_image_url": "https://exact-verified-crawled-image-url-or-empty",
  "cover_image_alt": "Concise descriptive alt text for cover image",
  "images": [
    { "url": "https://exact-verified-crawled-image-url", "alt": "string", "caption": "string", "source_page_url": "https://..." }
  ],
  "key_facts": [
    { "label": "string", "value": "string", "source_url": "https://..." }
  ],
  "faq": [
    { "question": "string", "answer": "string" }
  ],
  "body_markdown": "string (Markdown starting with an answer-first lead paragraph, then ## sections including concrete tradeoffs, table/code block, optional verified ![Caption](https://...) figure, and >= 3 deep https:// inline citations; NO # H1)",
  "tags": ["tag-1", "tag-2", "tag-3"],
  "keywords": ["lowercase search phrase 1", "lowercase search phrase 2", "lowercase search phrase 3", "lowercase search phrase 4", "lowercase search phrase 5"],
  "sources": ["https://...", "https://...", "https://..."],
  "review_notes": ["Concise verification note for human editor"]
}`;
}
