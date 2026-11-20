import type { PostRecord } from '../types';

const TRACKING_QUERY_PARAMS = new Set([
  'ref',
  'source',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'msclkid',
  'yclid',
]);

const TOPIC_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'nor',
  'for',
  'with',
  'without',
  'how',
  'why',
  'what',
  'when',
  'where',
  'who',
  'which',
  'whom',
  'whose',
  'guide',
  'complete',
  'comprehensive',
  'definitive',
  'ultimate',
  'overview',
  'analysis',
  'using',
  'used',
  'use',
  'into',
  'onto',
  'from',
  'in',
  'on',
  'at',
  'to',
  'of',
  'by',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'should',
  'could',
  'can',
  'may',
  'might',
  'must',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'their',
  'our',
  'your',
  'my',
  'we',
  'you',
  'they',
  'them',
  'vs',
  'versus',
  'via',
  'per',
  'over',
  'under',
  'between',
  'across',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'about',
  'against',
  'within',
  'beyond',
  'around',
  'more',
  'most',
  'less',
  'least',
  'very',
  'just',
  'only',
  'also',
  'than',
  'then',
  'so',
  'if',
  'not',
  'no',
  'yes',
  'all',
  'any',
  'some',
  'each',
  'every',
  'other',
  'such',
  'own',
  'same',
  'too',
  'now',
  'here',
  'there',
  'up',
  'down',
  'out',
  'off',
  '2024',
  '2025',
  '2026',
  '2027',
  'new',
  'latest',
  'modern',
  'recent',
  'updated',
  'today',
  'introduction',
  'summary',
  'briefing',
  'understanding',
  'exploring',
  'practical',
]);

const ALLOWED_TWO_CHAR_TOKENS = new Set([
  'ai',
  'ml',
  'dl',
  'rl',
  'ir',
  'go',
  'js',
  'ts',
  'py',
  'rs',
  'db',
  'io',
  'os',
  'ui',
  'ux',
  'ci',
  'cd',
  'vm',
  'ip',
  's3',
  'r2',
  'd1',
  'kv',
  'v8',
]);

const KEEP_TRAILING_S = new Set([
  'postgres',
  'kubernetes',
  'serverless',
  'redis',
  'prometheus',
  'axios',
  'nextjs',
  'nodejs',
  'vitest',
  'devops',
  'finops',
  'mlops',
  'secops',
  'devsecops',
  'windows',
  'macos',
  'nixos',
  'aws',
  'gcs',
  'rds',
  'eks',
  'aks',
  'dns',
  'tls',
  'https',
  'cors',
  'xss',
  'dos',
  'ddos',
  'saas',
  'paas',
  'iaas',
]);

const PLURAL_ACRONYM_MAP: Record<string, string> = {
  llms: 'llm',
  slms: 'slm',
  vlms: 'vlm',
  cves: 'cve',
  apis: 'api',
  gpus: 'gpu',
  cpus: 'cpu',
  tpus: 'tpu',
  clis: 'cli',
  mcps: 'mcp',
  sdks: 'sdk',
  urls: 'url',
  orgs: 'org',
};

/**
 * Normalizes a URL into a deterministic canonical form:
 * - Lowercases protocol & hostname (stripping leading `www.`)
 * - Strips tracking query params (`utm_*`, `ref`, `source`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`)
 * - Strips `#hash` fragment
 * - Strips trailing slashes on pathname
 */
export function normalizeCanonicalUrl(rawUrl: string): string {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    const host = parsed.hostname.toLowerCase().replace(/^www\.(?=.+\.)/, '');
    const isDefaultPort =
      !parsed.port ||
      (protocol === 'https:' && parsed.port === '443') ||
      (protocol === 'http:' && parsed.port === '80');
    const portPart = isDefaultPort ? '' : `:${parsed.port}`;

    for (const key of [...parsed.searchParams.keys()]) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.startsWith('utm_') || TRACKING_QUERY_PARAMS.has(lowerKey)) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.searchParams.sort();

    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    const queryStr = parsed.searchParams.toString();
    const searchPart = queryStr ? `?${queryStr}` : '';

    return `${protocol}//${host}${portPart}${cleanPath}${searchPart}`;
  } catch {
    return trimmed
      .replace(/#.*$/, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  }
}

/**
 * Extracts meaningful lowercase alphanumeric tokens from a title or topic,
 * removing punctuation and English/editorial filler stopwords while preserving
 * technical acronyms, versions, model sizes, and identifiers.
 */
export function extractSignificantTokens(text: string): string[] {
  if (typeof text !== 'string' || !text.trim()) return [];

  const rawWords = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/);

  const result: string[] = [];
  const seen = new Set<string>();

  for (const word of rawWords) {
    if (!word || TOPIC_STOPWORDS.has(word)) continue;
    if (word.length === 1) continue;
    if (word.length === 2 && !/\d/.test(word) && !ALLOWED_TWO_CHAR_TOKENS.has(word)) {
      continue;
    }
    if (!seen.has(word)) {
      seen.add(word);
      result.push(word);
    }
  }

  return result;
}

function stemTokenForComparison(token: string): string {
  if (PLURAL_ACRONYM_MAP[token]) {
    return PLURAL_ACRONYM_MAP[token];
  }
  if (KEEP_TRAILING_S.has(token) || token.length < 5) {
    return token;
  }
  if (token.length >= 6 && token.endsWith('ies')) {
    return `${token.slice(0, -3)}y`;
  }
  if (/(?:ch|sh|x|z)es$/.test(token)) {
    return token.slice(0, -2);
  }
  if (
    token.endsWith('s') &&
    !token.endsWith('ss') &&
    !token.endsWith('us') &&
    !token.endsWith('is') &&
    !token.endsWith('os')
  ) {
    return token.slice(0, -1);
  }
  return token;
}

function computeTokenSetJaccard(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA.map(stemTokenForComparison));
  const setB = new Set(tokensB.map(stemTokenForComparison));
  let intersection = 0;
  for (const tok of setA) {
    if (setB.has(tok)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function extractCharTrigrams(input: string): string[] {
  if (!input) return [];
  if (input.length < 3) return [input];
  const grams: string[] = [];
  for (let i = 0; i <= input.length - 3; i++) {
    grams.push(input.slice(i, i + 3));
  }
  return grams;
}

function computeCharTrigramDice(a: string, b: string): number {
  const gramsA = extractCharTrigrams(a);
  const gramsB = extractCharTrigrams(b);
  if (gramsA.length === 0 || gramsB.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const g of gramsA) {
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }

  let matches = 0;
  for (const g of gramsB) {
    const c = counts.get(g) ?? 0;
    if (c > 0) {
      matches++;
      counts.set(g, c - 1);
    }
  }

  return (2 * matches) / (gramsA.length + gramsB.length);
}

function extractAdvisoryIds(text: string): Set<string> {
  const ids = new Set<string>();
  const cveRegex = /\bcve-\d{4}-\d+\b/gi;
  const ghsaRegex = /\bghsa-[a-z0-9]+(?:-[a-z0-9]+)+\b/gi;

  let m: RegExpExecArray | null;
  while ((m = cveRegex.exec(text)) !== null) {
    ids.add(m[0].toLowerCase());
  }
  while ((m = ghsaRegex.exec(text)) !== null) {
    ids.add(m[0].toLowerCase());
  }
  return ids;
}

/**
 * Computes weighted topic similarity in `[0, 1]`:
 * `0.65 * tokenJaccard + 0.35 * charTrigramDice` on normalized titles/topics,
 * with an immediate `>= 0.85` boost when both strings reference the exact same CVE or GHSA ID.
 */
export function computeTopicSimilarity(a: string, b: string): number {
  if (typeof a !== 'string' || typeof b !== 'string') return 0;
  const rawA = a.trim();
  const rawB = b.trim();
  if (!rawA || !rawB) return 0;

  const tokensA = extractSignificantTokens(rawA);
  const tokensB = extractSignificantTokens(rawB);

  const normA =
    tokensA.length > 0
      ? [...tokensA].map(stemTokenForComparison).sort().join(' ')
      : rawA.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const normB =
    tokensB.length > 0
      ? [...tokensB].map(stemTokenForComparison).sort().join(' ')
      : rawB.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  if (normA && normA === normB) {
    return 1;
  }

  const tokenJaccard = computeTokenSetJaccard(tokensA, tokensB);
  const charTrigramDice = computeCharTrigramDice(normA, normB);
  const blended = 0.65 * tokenJaccard + 0.35 * charTrigramDice;

  const idsA = extractAdvisoryIds(rawA);
  const idsB = extractAdvisoryIds(rawB);
  let sharesExactAdvisoryId = false;
  for (const id of idsA) {
    if (idsB.has(id)) {
      sharesExactAdvisoryId = true;
      break;
    }
  }

  const rawScore = sharesExactAdvisoryId ? Math.max(0.88, blended) : blended;
  return Math.max(0, Math.min(1, Math.round(rawScore * 10_000) / 10_000));
}

function isPrimaryAdvisoryOrPaperUrl(canonicalUrl: string): boolean {
  return (
    /\bcve-\d{4}-\d+\b/i.test(canonicalUrl) ||
    /\bghsa-[a-z0-9-]+/i.test(canonicalUrl) ||
    /arxiv\.org\/(?:abs|pdf|html)\/\d{4}\.\d{4,5}/i.test(canonicalUrl) ||
    /huggingface\.co\/papers\/\d{4}\.\d{4,5}/i.test(canonicalUrl)
  );
}

function normalizeKeywordSet(keywords: string[] | undefined): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(keywords)) return out;
  for (const kw of keywords) {
    if (typeof kw !== 'string') continue;
    const cleaned = kw
      .toLowerCase()
      .replace(/[^a-z0-9.\-+/# ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length >= 2) {
      out.add(cleaned);
    }
  }
  return out;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  similarity: number;
  matchedPost?: Pick<PostRecord, 'id' | 'slug' | 'title'>;
  reason?: string;
}

/**
 * Checks whether a candidate topic/draft duplicates any existing post across:
 * 1. Primary advisory/paper canonical URL overlap (>= 2 shared URLs or 1 CVE/GHSA/arXiv URL) + token overlap >= 0.28
 * 2. Title topic similarity >= threshold
 * 3. High keyword set overlap (>= 0.60 when >= 4 keywords) + title similarity >= 0.35
 */
export function findDuplicatePost(
  candidate: { title: string; keywords?: string[]; urls?: string[] },
  existingPosts: PostRecord[],
  threshold = 0.48,
): DuplicateCheckResult {
  if (!candidate?.title?.trim() || !Array.isArray(existingPosts) || existingPosts.length === 0) {
    return { isDuplicate: false, similarity: 0 };
  }

  const candTokens = extractSignificantTokens(candidate.title);
  const candUrls = new Set(
    (candidate.urls || [])
      .map((u) => normalizeCanonicalUrl(u))
      .filter(Boolean),
  );
  const candKeywords = normalizeKeywordSet(candidate.keywords);

  let maxSimilarity = 0;
  let bestMatch: DuplicateCheckResult | null = null;

  for (const post of existingPosts) {
    if (!post?.title) continue;

    const titleSim = computeTopicSimilarity(candidate.title, post.title);
    if (titleSim > maxSimilarity) {
      maxSimilarity = titleSim;
    }

    const postSummaryRef: Pick<PostRecord, 'id' | 'slug' | 'title'> = {
      id: post.id,
      slug: post.slug,
      title: post.title,
    };

    // 1. Canonical primary advisory/paper URL overlap + topic token overlap >= 0.28
    if (candUrls.size > 0 && Array.isArray(post.sources_json) && post.sources_json.length > 0) {
      const sharedUrls: string[] = [];
      for (const rawPostUrl of post.sources_json) {
        const canonPostUrl = normalizeCanonicalUrl(rawPostUrl);
        if (canonPostUrl && candUrls.has(canonPostUrl)) {
          sharedUrls.push(canonPostUrl);
        }
      }

      if (sharedUrls.length > 0) {
        const postTokens = extractSignificantTokens(post.title);
        const tokenOverlap = Math.max(titleSim, computeTokenSetJaccard(candTokens, postTokens));
        const hasAdvisoryOrPaperMatch = sharedUrls.some(isPrimaryAdvisoryOrPaperUrl);

        if ((sharedUrls.length >= 2 || hasAdvisoryOrPaperMatch) && tokenOverlap >= 0.28) {
          const effectiveSim = Math.max(titleSim, threshold, 0.78);
          if (!bestMatch || effectiveSim > bestMatch.similarity) {
            bestMatch = {
              isDuplicate: true,
              similarity: Math.round(effectiveSim * 100) / 100,
              matchedPost: postSummaryRef,
              reason: `Primary source URL overlap (${sharedUrls.length} shared source${sharedUrls.length === 1 ? '' : 's'}) with existing post #${post.id} "${post.title}" (similarity ${titleSim.toFixed(2)})`,
            };
          }
          continue;
        }
      }
    }

    // 2. Direct topic similarity >= threshold
    if (titleSim >= threshold) {
      if (!bestMatch || titleSim > bestMatch.similarity) {
        bestMatch = {
          isDuplicate: true,
          similarity: Math.round(titleSim * 100) / 100,
          matchedPost: postSummaryRef,
          reason: `Topic overlaps with existing post #${post.id} "${post.title}" (similarity ${titleSim.toFixed(2)})`,
        };
      }
      continue;
    }

    // 3. High keyword set overlap (>= 0.60 when >= 4 keywords) + title similarity >= 0.35
    const postKeywords = normalizeKeywordSet(post.keywords_json);
    if (candKeywords.size >= 4 && postKeywords.size >= 4 && titleSim >= 0.35) {
      let sharedKw = 0;
      for (const kw of candKeywords) {
        if (postKeywords.has(kw)) sharedKw++;
      }
      const minKwSize = Math.min(candKeywords.size, postKeywords.size);
      const kwOverlap = minKwSize > 0 ? sharedKw / minKwSize : 0;

      if (kwOverlap >= 0.6) {
        const effectiveSim = Math.max(titleSim, kwOverlap);
        if (!bestMatch || effectiveSim > bestMatch.similarity) {
          bestMatch = {
            isDuplicate: true,
            similarity: Math.round(effectiveSim * 100) / 100,
            matchedPost: postSummaryRef,
            reason: `Keyword overlap (${Math.round(kwOverlap * 100)}%) with existing post #${post.id} "${post.title}" (similarity ${titleSim.toFixed(2)})`,
          };
        }
      }
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  return {
    isDuplicate: false,
    similarity: Math.round(maxSimilarity * 100) / 100,
  };
}

/**
 * Filters out feed or search items that:
 * - Already appear as a canonical primary source URL in `existingPosts`
 * - Overlap in topic with any existing post (`computeTopicSimilarity >= 0.48`)
 * - Overlap with any recent completed run topic (`computeTopicSimilarity >= 0.55`)
 * - Duplicate an earlier candidate in the same batch (canonical URL or similarity >= 0.72)
 */
export function filterUncoveredCandidates<T extends { title: string; url: string }>(
  items: T[],
  existingPosts: PostRecord[],
  recentRunTopics?: string[],
): { fresh: T[]; filteredOutCount: number } {
  if (!Array.isArray(items) || items.length === 0) {
    return { fresh: [], filteredOutCount: 0 };
  }

  const coveredUrls = new Set<string>();
  for (const post of existingPosts || []) {
    for (const rawUrl of post.sources_json || []) {
      const canon = normalizeCanonicalUrl(rawUrl);
      if (canon) coveredUrls.add(canon);
    }
  }

  const cleanRunTopics = (recentRunTopics || [])
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(
      (t) =>
        t.length > 0 &&
        t.toLowerCase() !== 'auto' &&
        t.toLowerCase() !== 'scheduled autonomous briefing' &&
        !t.toLowerCase().startsWith('skipped'),
    );

  const fresh: T[] = [];
  const seenBatchUrls = new Set<string>();
  let filteredOutCount = 0;

  for (const item of items) {
    if (!item || !item.title?.trim()) {
      filteredOutCount++;
      continue;
    }

    const canonUrl = item.url ? normalizeCanonicalUrl(item.url) : '';
    if (canonUrl && (coveredUrls.has(canonUrl) || seenBatchUrls.has(canonUrl))) {
      filteredOutCount++;
      continue;
    }

    const matchesExistingPost = (existingPosts || []).some(
      (post) => post?.title && computeTopicSimilarity(item.title, post.title) >= 0.48,
    );
    if (matchesExistingPost) {
      filteredOutCount++;
      continue;
    }

    const matchesRecentRun = cleanRunTopics.some(
      (runTopic) => computeTopicSimilarity(item.title, runTopic) >= 0.55,
    );
    if (matchesRecentRun) {
      filteredOutCount++;
      continue;
    }

    const duplicatesBatchItem = fresh.some(
      (kept) => computeTopicSimilarity(item.title, kept.title) >= 0.72,
    );
    if (duplicatesBatchItem) {
      filteredOutCount++;
      continue;
    }

    if (canonUrl) {
      seenBatchUrls.add(canonUrl);
    }
    fresh.push(item);
  }

  return { fresh, filteredOutCount };
}
