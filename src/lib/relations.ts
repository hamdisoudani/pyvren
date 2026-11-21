import type { CategorySkill, PostRecord } from '../types';

export interface CategoryMeta {
  shortLabel: string;
  navLabel: string;
  crewName: string;
  color: string;
  darkColor: string;
  bgTint: string;
  motif: string;
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  'ai-coding-agents-mcp': {
    shortLabel: 'CODING & MCP',
    navLabel: 'Coding & MCP',
    crewName: 'Bruno',
    color: '#1D4ED8',
    darkColor: '#60A5FA',
    bgTint: '#EFF6FF',
    motif: 'nodes',
  },
  'ai-security-jailbreaks': {
    shortLabel: 'AI SECURITY',
    navLabel: 'AI Security',
    crewName: 'Patch',
    color: '#DC2626',
    darkColor: '#F87171',
    bgTint: '#FEF2F2',
    motif: 'shield',
  },
  'ai-llms': {
    shortLabel: 'FRONTIER LLMS',
    navLabel: 'Frontier LLMs',
    crewName: 'Pip',
    color: '#B45309',
    darkColor: '#FBBF24',
    bgTint: '#FFFBEB',
    motif: 'bars',
  },
  'cloud-gpu-infra': {
    shortLabel: 'CLOUD & GPU',
    navLabel: 'Cloud & GPU',
    crewName: 'Juno',
    color: '#0F766E',
    darkColor: '#2DD4BF',
    bgTint: '#F0FDFA',
    motif: 'arcs',
  },
  'agentic-browser-web-data': {
    shortLabel: 'WEB & SEARCH',
    navLabel: 'Web & Search',
    crewName: 'Boo',
    color: '#6D28D9',
    darkColor: '#C084FC',
    bgTint: '#F5F3FF',
    motif: 'web',
  },
  'dev-tooling-benchmarks': {
    shortLabel: 'CVES & PATCHES',
    navLabel: 'CVEs & Patches',
    crewName: 'Morel',
    color: '#C2410C',
    darkColor: '#FB923C',
    bgTint: '#FFF7ED',
    motif: 'radar',
  },
};

const FALLBACK_PALETTE: Array<Omit<CategoryMeta, 'shortLabel' | 'navLabel'>> = [
  { crewName: 'Bruno', color: '#D63333', darkColor: '#F87171', bgTint: '#FEF2F2', motif: 'nodes' },
  { crewName: 'Pip', color: '#1D4ED8', darkColor: '#60A5FA', bgTint: '#EFF6FF', motif: 'bars' },
  { crewName: 'Juno', color: '#0F766E', darkColor: '#2DD4BF', bgTint: '#F0FDFA', motif: 'arcs' },
  { crewName: 'Boo', color: '#7C3AED', darkColor: '#C084FC', bgTint: '#F5F3FF', motif: 'web' },
  { crewName: 'Morel', color: '#C2410C', darkColor: '#FB923C', bgTint: '#FFF7ED', motif: 'radar' },
];

export function getCategoryMeta(slug: string): CategoryMeta {
  const normalized = String(slug || '').trim().toLowerCase();
  if (normalized && CATEGORY_META[normalized]) {
    return CATEGORY_META[normalized];
  }
  const cleanWords = (normalized || 'dispatch')
    .replace(/[-_]+/g, ' ')
    .trim()
    .slice(0, 18);
  const cleanLabel = cleanWords.toUpperCase();
  const titleLabel = cleanWords.replace(/\b\w/g, (ch) => ch.toUpperCase());

  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  const palette = FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
  return {
    shortLabel: cleanLabel || 'DISPATCH',
    navLabel: titleLabel || 'Dispatch',
    ...palette,
  };
}

export interface PostRelationship {
  post: PostRecord;
  score: number;
  sameCategory: boolean;
  sharedTags: string[];
  sharedKeywords: string[];
  sharedDomains: string[];
  reasonLabel: string;
}

export interface TopicCluster {
  label: string;
  query: string;
  count: number;
  color: string;
  darkColor: string;
  categorySlug: string;
}

const STOPWORDS = new Set<string>([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'into',
  'over',
  'under',
  'about',
  'after',
  'before',
  'between',
  'through',
  'against',
  'during',
  'without',
  'within',
  'how',
  'why',
  'what',
  'when',
  'where',
  'which',
  'who',
  'your',
  'our',
  'their',
  'using',
  'used',
  'use',
  'guide',
  'report',
  'briefing',
  'analysis',
  'deep',
  'dive',
  'new',
  'latest',
  'production',
  'systems',
  'modern',
  '2024',
  '2025',
  '2026',
  '2027',
]);

function tokenize(text: string): Set<string> {
  const out = new Set<string>();
  const matches = String(text || '')
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9.-]{1,}/g);
  if (!matches) return out;
  for (const raw of matches) {
    const token = raw.replace(/^\.+|\.+$/g, '');
    if (token.length < 3 || STOPWORDS.has(token)) continue;
    out.add(token);
  }
  return out;
}

function normalizeTerm(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function extractDomains(sources: string[] | undefined): Set<string> {
  const domains = new Set<string>();
  if (!Array.isArray(sources)) return domains;
  for (const src of sources) {
    try {
      const host = new URL(src).hostname.replace(/^www\./i, '').toLowerCase();
      if (host) domains.add(host);
    } catch {
      // Ignore malformed URLs
    }
  }
  return domains;
}

function postTimestamp(post: PostRecord): number {
  const ts = Date.parse(post.published_at || post.created_at || '');
  return Number.isFinite(ts) ? ts : 0;
}

export function computePostRelationships(
  target: PostRecord,
  pool: PostRecord[],
  maxResults = 4,
): PostRelationship[] {
  if (!Array.isArray(pool) || pool.length === 0 || maxResults <= 0) {
    return [];
  }

  const targetTags = new Map<string, string>();
  for (const raw of target.tags_json || []) {
    const norm = normalizeTerm(raw);
    if (norm && !targetTags.has(norm)) targetTags.set(norm, raw.trim());
  }

  const targetKeywords = new Map<string, string>();
  const targetKeywordTokens = new Set<string>();
  for (const raw of target.keywords_json || []) {
    const norm = normalizeTerm(raw);
    if (norm && !targetKeywords.has(norm)) targetKeywords.set(norm, raw.trim());
    for (const tok of tokenize(raw)) targetKeywordTokens.add(tok);
  }

  const targetDomains = extractDomains(target.sources_json);
  const targetTitleTokens = tokenize(target.title);

  const scored: PostRelationship[] = [];
  const seenSlugs = new Set<string>([target.slug]);

  for (const candidate of pool) {
    if (!candidate || candidate.status !== 'published') continue;
    if (candidate.id === target.id || seenSlugs.has(candidate.slug)) continue;
    seenSlugs.add(candidate.slug);

    const sameCategory = candidate.category_slug === target.category_slug;

    // Shared tags (+18 each)
    const sharedTags: string[] = [];
    const seenCandidateTags = new Set<string>();
    for (const raw of candidate.tags_json || []) {
      const norm = normalizeTerm(raw);
      if (!norm || seenCandidateTags.has(norm)) continue;
      seenCandidateTags.add(norm);
      if (targetTags.has(norm)) {
        sharedTags.push(targetTags.get(norm)!);
      }
    }

    // Shared keywords & overlapping keyword tokens (+16 each)
    const sharedKeywords: string[] = [];
    const seenExactKw = new Set<string>();
    const candidateKeywordTokens = new Set<string>();
    for (const raw of candidate.keywords_json || []) {
      const norm = normalizeTerm(raw);
      if (norm && targetKeywords.has(norm) && !seenExactKw.has(norm)) {
        seenExactKw.add(norm);
        sharedKeywords.push(targetKeywords.get(norm)!);
      }
      for (const tok of tokenize(raw)) candidateKeywordTokens.add(tok);
    }

    const coveredKeywordTokens = new Set<string>();
    for (const kw of sharedKeywords) {
      for (const tok of tokenize(kw)) coveredKeywordTokens.add(tok);
    }
    for (const tag of sharedTags) {
      for (const tok of tokenize(tag)) coveredKeywordTokens.add(tok);
    }

    let overlappingKeywordTokenCount = 0;
    for (const tok of candidateKeywordTokens) {
      if (targetKeywordTokens.has(tok) && !coveredKeywordTokens.has(tok)) {
        overlappingKeywordTokenCount++;
        if (sharedKeywords.length < 3) {
          sharedKeywords.push(tok);
        }
      }
    }

    // Shared primary source domains (+14 each)
    const candidateDomains = extractDomains(candidate.sources_json);
    const sharedDomains: string[] = [];
    for (const dom of candidateDomains) {
      if (targetDomains.has(dom)) sharedDomains.push(dom);
    }

    // Overlapping significant title tokens (+10 each)
    const candidateTitleTokens = tokenize(candidate.title);
    let overlappingTitleTokens = 0;
    for (const tok of candidateTitleTokens) {
      if (targetTitleTokens.has(tok)) overlappingTitleTokens++;
    }

    const score =
      (sameCategory ? 30 : 0) +
      sharedTags.length * 18 +
      (seenExactKw.size + overlappingKeywordTokenCount) * 16 +
      sharedDomains.length * 14 +
      overlappingTitleTokens * 10;

    let reasonLabel = 'Recent dispatch';
    const topicLabels: string[] = [];
    for (const term of [...sharedTags, ...sharedKeywords]) {
      const clean = term.trim();
      if (!clean) continue;
      if (!topicLabels.some((existing) => existing.toLowerCase() === clean.toLowerCase())) {
        topicLabels.push(clean);
      }
      if (topicLabels.length >= 2) break;
    }

    if (topicLabels.length > 0) {
      reasonLabel = `Related on ${topicLabels.join(', ')}`;
    } else if (sharedDomains.length > 0) {
      reasonLabel = `Also cites ${sharedDomains[0]}`;
    } else if (sameCategory) {
      reasonLabel = 'Same topic';
    } else if (score > 0) {
      reasonLabel = 'Related reading';
    }

    scored.push({
      post: candidate,
      score,
      sameCategory,
      sharedTags,
      sharedKeywords,
      sharedDomains,
      reasonLabel,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return postTimestamp(b.post) - postTimestamp(a.post);
  });

  return scored.slice(0, maxResults);
}

export function buildTopicClusters(
  posts: PostRecord[],
  skills: CategorySkill[],
): TopicCluster[] {
  const published = (posts || []).filter((p) => p.status === 'published');
  const enabledSkillSlugs = new Set(skills.filter((s) => s.enabled).map((s) => s.slug));

  interface ClusterBucket {
    label: string;
    query: string;
    count: number;
    tagWeight: number;
    categoryCounts: Map<string, number>;
  }

  const buckets = new Map<string, ClusterBucket>();

  for (const post of published) {
    const seenInPost = new Set<string>();
    const addCandidate = (raw: string, isTag: boolean) => {
      const trimmed = String(raw || '').trim();
      if (!trimmed || trimmed.length < 2 || trimmed.length > 28) return;
      const wordCount = trimmed.split(/\s+/).length;
      if (!isTag && wordCount > 3) return;
      const key = normalizeTerm(trimmed);
      if (!key || STOPWORDS.has(key) || seenInPost.has(key)) return;
      seenInPost.add(key);

      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          label: trimmed,
          query: trimmed,
          count: 0,
          tagWeight: 0,
          categoryCounts: new Map<string, number>(),
        };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      if (isTag) {
        bucket.tagWeight += 1;
        // Prefer concise tag casing when available
        if (trimmed.length <= bucket.label.length) {
          bucket.label = trimmed;
        }
      }
      const cat = post.category_slug || 'general';
      bucket.categoryCounts.set(cat, (bucket.categoryCounts.get(cat) || 0) + 1);
    };

    for (const tag of post.tags_json || []) addCandidate(tag, true);
    for (const kw of post.keywords_json || []) addCandidate(kw, false);
  }

  const clusters: TopicCluster[] = [];
  for (const bucket of buckets.values()) {
    let bestCat = '';
    let bestCatCount = -1;
    for (const [cat, cnt] of bucket.categoryCounts.entries()) {
      const boosted = cnt + (enabledSkillSlugs.has(cat) ? 0.1 : 0);
      if (boosted > bestCatCount) {
        bestCatCount = boosted;
        bestCat = cat;
      }
    }
    const meta = getCategoryMeta(bestCat);
    clusters.push({
      label: bucket.label,
      query: bucket.query,
      count: bucket.count,
      color: meta.color,
      darkColor: meta.darkColor,
      categorySlug: bestCat,
    });
  }

  clusters.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });

  return clusters.slice(0, 10);
}
