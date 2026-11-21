import type { WorkerEnv } from '../env';
import type { TraceEntry } from '../types';
import { isSafePublicUrl, safeFetch } from './security';

export interface FeedItem {
  title: string;
  url: string;
  summary: string;
  published?: string;
}

export interface SearchSourceItem {
  title: string;
  url: string;
  snippet: string;
}

export interface ExtractedWebImage {
  url: string;
  alt: string;
  caption?: string;
  source_page_url: string;
}

export interface WebpageReadResult {
  ok: boolean;
  url: string;
  title: string;
  markdown: string;
  chars: number;
  images?: ExtractedWebImage[];
  error?: string;
}

const MAX_EXTRACTED_CHARS = 14_000;
const BOT_USER_AGENT = 'Pyvren-Dispatch/1.0 (+https://pyvren.com)';

function pushTrace(trace: TraceEntry[] | undefined, entry: Omit<TraceEntry, 'timestamp'>): void {
  if (!trace) return;
  trace.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' '));
}

function truncateText(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input;
  const slice = input.slice(0, maxChars);
  const lastBreak = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('. '));
  if (lastBreak > maxChars * 0.7) {
    return `${slice.slice(0, lastBreak + 1).trim()}\n\n[Truncated for context budget]`;
  }
  return `${slice.trim()}\n\n[Truncated for context budget]`;
}

function stripCdata(input: string): string {
  return input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
}

function cleanXmlFragmentToText(raw: string): string {
  if (!raw) return '';
  const unwrapped = stripCdata(raw);
  const decodedOnce = decodeHtmlEntities(unwrapped);
  const withoutTags = decodedOnce.replace(/<[^>]+>/g, ' ');
  return normalizeWhitespace(decodeHtmlEntities(withoutTags));
}

function extractAtomEntryLink(block: string): string {
  const linkTags = block.match(/<link\b[^>]*\/?>/gi) || [];
  let fallbackHref = '';

  for (const tag of linkTags) {
    const hrefMatch = /\bhref=["']([^"']+)["']/i.exec(tag);
    if (!hrefMatch?.[1]) continue;
    const href = decodeHtmlEntities(stripCdata(hrefMatch[1])).trim();
    if (!href) continue;

    const relMatch = /\brel=["']([^"']+)["']/i.exec(tag);
    const rel = (relMatch?.[1] || '').trim().toLowerCase();
    if (rel === 'alternate' || rel === '') {
      return href;
    }
    if (rel !== 'self' && rel !== 'enclosure' && !fallbackHref) {
      fallbackHref = href;
    }
  }

  if (fallbackHref) return fallbackHref;

  const idMatch = /<id\b[^>]*>([\s\S]*?)<\/id>/i.exec(block);
  if (idMatch?.[1]) {
    const rawId = decodeHtmlEntities(stripCdata(idMatch[1])).trim();
    if (/^https?:\/\//i.test(rawId)) {
      return rawId;
    }
  }

  return '';
}

/**
 * Universal parser supporting both RSS 2.0 `<item>` feeds and Atom `<entry>` feeds.
 */
export function parseRssOrAtomXml(xml: string, maxItems = 12): FeedItem[] {
  if (typeof xml !== 'string' || !xml.trim()) return [];
  const cap = Math.max(1, Math.floor(maxItems));
  const items: FeedItem[] = [];
  const seenUrls = new Set<string>();

  // 1. RSS 2.0 <item> blocks
  const rssItemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = rssItemRegex.exec(xml)) !== null && items.length < cap) {
    const block = match[1];
    const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(block);
    const linkMatch = /<link\b[^>]*>([\s\S]*?)<\/link>/i.exec(block);
    const guidMatch = /<guid\b[^>]*>([\s\S]*?)<\/guid>/i.exec(block);
    const descMatch =
      /<description\b[^>]*>([\s\S]*?)<\/description>/i.exec(block) ||
      /<content:encoded\b[^>]*>([\s\S]*?)<\/content:encoded>/i.exec(block);
    const pubDateMatch =
      /<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i.exec(block) ||
      /<dc:date\b[^>]*>([\s\S]*?)<\/dc:date>/i.exec(block);

    const rawLink = decodeHtmlEntities(stripCdata(linkMatch?.[1] || guidMatch?.[1] || ''))
      .trim()
      .replace(/^http:\/\//i, 'https://');
    const title = cleanXmlFragmentToText(titleMatch?.[1] || '');
    const summary = cleanXmlFragmentToText(descMatch?.[1] || '').slice(0, 420);
    const published = cleanXmlFragmentToText(pubDateMatch?.[1] || '') || undefined;

    if (title && rawLink && !seenUrls.has(rawLink) && isSafePublicUrl(rawLink).ok) {
      seenUrls.add(rawLink);
      items.push({ title, url: rawLink, summary, published });
    }
  }

  if (items.length > 0) {
    return items;
  }

  // 2. Atom <entry> blocks
  const atomEntryRegex = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  while ((match = atomEntryRegex.exec(xml)) !== null && items.length < cap) {
    const block = match[1];
    const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(block);
    const summaryMatch =
      /<summary\b[^>]*>([\s\S]*?)<\/summary>/i.exec(block) ||
      /<content\b[^>]*>([\s\S]*?)<\/content>/i.exec(block);
    const publishedMatch =
      /<published\b[^>]*>([\s\S]*?)<\/published>/i.exec(block) ||
      /<updated\b[^>]*>([\s\S]*?)<\/updated>/i.exec(block);

    const rawLink = extractAtomEntryLink(block).replace(/^http:\/\//i, 'https://');
    const title = cleanXmlFragmentToText(titleMatch?.[1] || '');
    const summary = cleanXmlFragmentToText(summaryMatch?.[1] || '').slice(0, 420);
    const published = cleanXmlFragmentToText(publishedMatch?.[1] || '') || undefined;

    if (title && rawLink && !seenUrls.has(rawLink) && isSafePublicUrl(rawLink).ok) {
      seenUrls.add(rawLink);
      items.push({ title, url: rawLink, summary, published });
    }
  }

  return items;
}

interface GithubAdvisoryRow {
  ghsa_id?: string;
  cve_id?: string | null;
  summary?: string;
  description?: string;
  html_url?: string;
  severity?: string;
  published_at?: string;
  vulnerabilities?: Array<{
    package?: {
      ecosystem?: string;
      name?: string;
    };
  }>;
}

const AI_ECOSYSTEM_PACKAGE_RE =
  /\b(llm|langchain|llamaindex|mcp|openai|anthropic|vllm|sglang|transformers|huggingface|pytorch|torch|onnx|ollama|gradio|streamlit|fastapi|starlette|aiohttp|httpx|pydantic|agent|rag|litellm|dspy|crewai|autogen|haystack|milvus|qdrant|chromadb|weaviate|ray|mlflow|bentoml|triton|safetensors|jinja2|flask|django|urllib3)\b/i;

async function fetchAlgoliaHnStories(
  feedName: string,
  url: string,
  label: string,
  trace?: TraceEntry[],
): Promise<FeedItem[]> {
  const res = await safeFetch(url, {
    headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'application/json' },
    timeoutMs: 12_000,
    maxBytes: 500_000,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = JSON.parse(res.text) as {
    hits?: Array<{
      objectID?: string;
      title?: string;
      url?: string | null;
      points?: number;
      num_comments?: number;
      created_at?: string;
    }>;
  };
  const hits = Array.isArray(data.hits) ? data.hits : [];
  const items: FeedItem[] = [];
  for (const hit of hits) {
    if (items.length >= 12) break;
    if (!hit.url || !hit.title) continue;
    if (!isSafePublicUrl(hit.url).ok) continue;
    items.push({
      title: normalizeWhitespace(hit.title),
      url: hit.url,
      summary: `HN discussion (${hit.points ?? 0} points, ${hit.num_comments ?? 0} comments${hit.created_at ? `, ${hit.created_at}` : ''}): https://news.ycombinator.com/item?id=${hit.objectID || ''}`,
      published: hit.created_at,
    });
  }

  pushTrace(trace, {
    stage: 'hunt_topics',
    tool_name: 'fetchAuthoritativeFeed',
    input: feedName,
    url,
    summary: `Fetched ${items.length} ${label}`,
    ok: true,
  });
  return items;
}

async function fetchGithubTrendingRepos(
  feedName: string,
  url: string,
  label: string,
  trace?: TraceEntry[],
): Promise<FeedItem[]> {
  const res = await safeFetch(url, {
    headers: {
      'User-Agent': BOT_USER_AGENT,
      Accept: 'application/vnd.github+json',
    },
    timeoutMs: 12_000,
    maxBytes: 600_000,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status}`);
  }
  const parsed = JSON.parse(res.text) as {
    items?: Array<{
      full_name?: string;
      html_url?: string;
      description?: string | null;
      stargazers_count?: number;
      pushed_at?: string;
      language?: string | null;
    }>;
  };
  const repos = Array.isArray(parsed.items) ? parsed.items : [];
  const items: FeedItem[] = repos
    .slice(0, 10)
    .filter((r) => Boolean(r.full_name && r.html_url && isSafePublicUrl(r.html_url).ok))
    .map((r) => ({
      title: normalizeWhitespace(
        `${r.full_name} (${r.stargazers_count ?? 0} stars) — ${r.description || 'Trending GitHub repository'}`,
      ).slice(0, 180),
      url: r.html_url!,
      summary: normalizeWhitespace(
        `GitHub ${r.full_name} (${r.stargazers_count ?? 0} stars${r.language ? `, ${r.language}` : ''}, pushed ${r.pushed_at || 'recently'}): ${r.description || ''}`,
      ).slice(0, 420),
      published: r.pushed_at,
    }));

  pushTrace(trace, {
    stage: 'hunt_topics',
    tool_name: 'fetchAuthoritativeFeed',
    input: feedName,
    url,
    summary: `Fetched ${items.length} ${label}`,
    ok: true,
  });
  return items;
}

function formatOpenRouterPerMillionPrice(rawPrice: string | number | undefined): string {
  if (rawPrice === undefined || rawPrice === null || rawPrice === '') return 'N/A';
  const num = Number(rawPrice);
  if (!Number.isFinite(num) || num < 0) return String(rawPrice);
  if (num === 0) return '$0/1M (free)';
  const perMillion = num * 1_000_000;
  return perMillion >= 0.01 ? `$${perMillion.toFixed(2)}/1M` : `$${perMillion.toExponential(2)}/1M`;
}

/**
 * Fetches curated authoritative research feeds or custom https:// RSS/Atom feeds safely via safeFetch.
 * Never throws uncaught errors; records failures in trace and returns [].
 */
export async function fetchAuthoritativeFeed(
  feedName: string,
  trace?: TraceEntry[],
): Promise<FeedItem[]> {
  const trimmedFeed = feedName.trim();
  const normalized = trimmedFeed.toLowerCase();
  const nowMs = Date.now();
  const sevenDaysAgoUnix = Math.floor((nowMs - 7 * 24 * 60 * 60 * 1000) / 1000);
  const fourteenDaysAgoIsoDate = new Date(nowMs - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  try {
    // Support arbitrary custom https:// RSS 2.0 or Atom feed URLs configured per category skill
    if (normalized.startsWith('https://')) {
      const res = await safeFetch(trimmedFeed, {
        headers: {
          'User-Agent': BOT_USER_AGENT,
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        },
        timeoutMs: 12_000,
        maxBytes: 800_000,
      });
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`HTTP ${res.status}`);
      }
      const items = parseRssOrAtomXml(res.text, 12);
      pushTrace(trace, {
        stage: 'hunt_topics',
        tool_name: 'fetchAuthoritativeFeed',
        input: feedName,
        url: trimmedFeed,
        summary: `Fetched ${items.length} items from custom RSS/Atom feed`,
        ok: true,
      });
      return items;
    }

    switch (normalized) {
      case 'cisa_kev': {
        const url =
          'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
        const res = await safeFetch(url, {
          headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'application/json' },
          timeoutMs: 12_000,
          maxBytes: 3_500_000,
        });
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status}`);
        }
        const parsed = JSON.parse(res.text) as {
          vulnerabilities?: Array<{
            cveID?: string;
            vendorProject?: string;
            product?: string;
            vulnerabilityName?: string;
            dateAdded?: string;
            shortDescription?: string;
            requiredAction?: string;
            notes?: string;
          }>;
        };
        const vulns = Array.isArray(parsed.vulnerabilities) ? parsed.vulnerabilities : [];
        const newest = [...vulns]
          .sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''))
          .slice(0, 10);

        const items: FeedItem[] = newest
          .filter((v) => Boolean(v.cveID))
          .map((v) => {
            const cve = v.cveID!.trim();
            const addedLabel = v.dateAdded ? `[dateAdded: ${v.dateAdded}] ` : '';
            const title = normalizeWhitespace(
              `${cve}: ${v.vendorProject || ''} ${v.product || ''} — ${v.vulnerabilityName || 'KEV Advisory'}`,
            );
            const summary = normalizeWhitespace(
              `${addedLabel}${v.shortDescription || ''} ${v.requiredAction ? `Required action: ${v.requiredAction}` : ''}`,
            ).slice(0, 420);
            return {
              title,
              url: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve)}`,
              summary,
              published: v.dateAdded,
            };
          });

        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          url,
          summary: `Fetched ${items.length} CISA KEV advisories`,
          ok: true,
        });
        return items;
      }

      case 'github_advisories': {
        const url = 'https://api.github.com/advisories?per_page=12&severity=critical,high';
        const res = await safeFetch(url, {
          headers: {
            'User-Agent': BOT_USER_AGENT,
            Accept: 'application/vnd.github+json',
          },
          timeoutMs: 12_000,
          maxBytes: 600_000,
        });
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status}`);
        }
        const rows = JSON.parse(res.text) as GithubAdvisoryRow[];
        const items: FeedItem[] = (Array.isArray(rows) ? rows : [])
          .slice(0, 12)
          .filter((r) => Boolean(r.html_url && isSafePublicUrl(r.html_url).ok))
          .map((r) => ({
            title: normalizeWhitespace(
              `${r.ghsa_id || 'GHSA'}${r.cve_id ? ` (${r.cve_id})` : ''}: ${r.summary || 'Security Advisory'}`,
            ),
            url: r.html_url!,
            summary: normalizeWhitespace(
              `${r.severity ? `[${r.severity.toUpperCase()}] ` : ''}${r.description || r.summary || ''}`,
            ).slice(0, 420),
            published: r.published_at,
          }));

        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          url,
          summary: `Fetched ${items.length} GitHub High/Critical Security Advisories`,
          ok: true,
        });
        return items;
      }

      case 'github_advisories_ai': {
        const url = 'https://api.github.com/advisories?per_page=25&ecosystem=pip';
        const res = await safeFetch(url, {
          headers: {
            'User-Agent': BOT_USER_AGENT,
            Accept: 'application/vnd.github+json',
          },
          timeoutMs: 12_000,
          maxBytes: 800_000,
        });
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status}`);
        }
        const parsedRows = JSON.parse(res.text) as unknown;
        const rows = (Array.isArray(parsedRows) ? parsedRows : []) as GithubAdvisoryRow[];
        const validRows = rows.filter((r) => Boolean(r.html_url && isSafePublicUrl(r.html_url).ok));

        const severityRank = (sev?: string): number => {
          const s = (sev || '').toLowerCase();
          if (s === 'critical') return 3;
          if (s === 'high') return 2;
          if (s === 'medium') return 1;
          return 0;
        };

        const isAiOrWebFramework = (r: GithubAdvisoryRow): boolean => {
          const pkgNames = (r.vulnerabilities || [])
            .map((v) => v.package?.name || '')
            .join(' ');
          const haystack = `${pkgNames} ${r.summary || ''} ${r.description || ''}`;
          return AI_ECOSYSTEM_PACKAGE_RE.test(haystack);
        };

        const aiMatched = validRows
          .filter(isAiOrWebFramework)
          .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
        const fallbackHigh = validRows
          .filter((r) => !isAiOrWebFramework(r))
          .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

        const combined = [...aiMatched, ...fallbackHigh].slice(0, 12);
        const items: FeedItem[] = combined.map((r) => {
          const pkg = r.vulnerabilities?.[0]?.package?.name;
          return {
            title: normalizeWhitespace(
              `${r.ghsa_id || 'GHSA'}${r.cve_id ? ` (${r.cve_id})` : ''}${pkg ? ` [${pkg}]` : ''}: ${r.summary || 'Python Advisory'}`,
            ),
            url: r.html_url!,
            summary: normalizeWhitespace(
              `${r.severity ? `[${r.severity.toUpperCase()}] ` : ''}${r.description || r.summary || ''}`,
            ).slice(0, 420),
            published: r.published_at,
          };
        });

        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          url,
          summary: `Fetched ${items.length} Python/AI GitHub Security Advisories (${aiMatched.length} AI/framework matches)`,
          ok: true,
        });
        return items;
      }

      case 'github_trending_ai_agents': {
        const url = `https://api.github.com/search/repositories?q=(mcp+OR+%22coding+agent%22+OR+%22ai+agent%22+OR+swe-bench)+pushed:%3E${fourteenDaysAgoIsoDate}&sort=stars&order=desc&per_page=10`;
        return await fetchGithubTrendingRepos(
          feedName,
          url,
          'trending AI agent GitHub repositories',
          trace,
        );
      }

      case 'github_trending_web_agents': {
        const url = `https://api.github.com/search/repositories?q=(%22browser+agent%22+OR+playwright+OR+%22llms.txt%22+OR+crawler+OR+rag)+pushed:%3E${fourteenDaysAgoIsoDate}&sort=stars&order=desc&per_page=10`;
        return await fetchGithubTrendingRepos(
          feedName,
          url,
          'trending web/browser agent GitHub repositories',
          trace,
        );
      }

      case 'github_llm_releases': {
        const repos = ['vllm-project/vllm', 'sgl-project/sglang', 'ggml-org/llama.cpp'];
        const settled = await Promise.allSettled(
          repos.map(async (repo) => {
            const url = `https://api.github.com/repos/${repo}/releases?per_page=2`;
            const res = await safeFetch(url, {
              headers: {
                'User-Agent': BOT_USER_AGENT,
                Accept: 'application/vnd.github+json',
              },
              timeoutMs: 12_000,
              maxBytes: 500_000,
            });
            if (res.status < 200 || res.status >= 300) {
              throw new Error(`${repo} HTTP ${res.status}`);
            }
            const releases = JSON.parse(res.text) as Array<{
              tag_name?: string;
              name?: string;
              html_url?: string;
              published_at?: string;
              created_at?: string;
              body?: string;
            }>;
            return (Array.isArray(releases) ? releases : [])
              .slice(0, 2)
              .filter((rel) => Boolean(rel.html_url && isSafePublicUrl(rel.html_url).ok))
              .map((rel): FeedItem => {
                const tag = rel.tag_name || rel.name || 'release';
                const pub = rel.published_at || rel.created_at;
                const notesExcerpt = normalizeWhitespace(
                  (rel.body || '').replace(/[#*`>]/g, ' '),
                ).slice(0, 360);
                return {
                  title: normalizeWhitespace(
                    `${repo} ${tag}${rel.name && rel.name !== rel.tag_name ? ` — ${rel.name}` : ''}`,
                  ),
                  url: rel.html_url!,
                  summary: normalizeWhitespace(
                    `${pub ? `[Released ${pub}] ` : ''}${notesExcerpt || `New ${repo} release ${tag}`}`,
                  ).slice(0, 420),
                  published: pub,
                };
              });
          }),
        );

        const fulfilled = settled.filter(
          (r): r is PromiseFulfilledResult<FeedItem[]> => r.status === 'fulfilled',
        );
        if (fulfilled.length === 0) {
          throw new Error('All LLM engine GitHub release fetches failed');
        }

        const items = fulfilled
          .flatMap((r) => r.value)
          .sort((a, b) => (b.published || '').localeCompare(a.published || ''));

        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          url: 'https://api.github.com/repos/{vllm,sglang,llama.cpp}/releases',
          summary: `Fetched ${items.length} latest releases across vLLM, SGLang, and llama.cpp`,
          ok: true,
        });
        return items;
      }

      case 'openrouter_newest_models': {
        const url = 'https://openrouter.ai/api/v1/models';
        const res = await safeFetch(url, {
          headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'application/json' },
          timeoutMs: 14_000,
          maxBytes: 4_000_000,
        });
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status}`);
        }
        const parsed = JSON.parse(res.text) as {
          data?: Array<{
            id?: string;
            name?: string;
            created?: number;
            context_length?: number;
            description?: string;
            pricing?: {
              prompt?: string | number;
              completion?: string | number;
            };
          }>;
        };
        const models = Array.isArray(parsed.data) ? parsed.data : [];
        const newest = [...models]
          .filter((m) => Boolean(m?.id && m.id.includes('/')))
          .sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0))
          .slice(0, 10);

        const items: FeedItem[] = [];
        for (const m of newest) {
          const id = m.id!.trim().replace(/^\/+/, '');
          const modelUrl = `https://openrouter.ai/${id}`;
          if (!isSafePublicUrl(modelUrl).ok) continue;

          const name = (m.name || id).trim();
          const ctxLabel = m.context_length
            ? m.context_length >= 1000
              ? `${Math.round(m.context_length / 1000)}k`
              : String(m.context_length)
            : 'N/A';
          const promptPrice = formatOpenRouterPerMillionPrice(m.pricing?.prompt);
          const completionPrice = formatOpenRouterPerMillionPrice(m.pricing?.completion);
          const createdIso =
            m.created && Number.isFinite(m.created) && m.created > 0
              ? new Date(m.created * 1000).toISOString()
              : undefined;

          items.push({
            title: normalizeWhitespace(`New Model on OpenRouter: ${name} (${id}) — ${ctxLabel} ctx`),
            url: modelUrl,
            summary: normalizeWhitespace(
              `Pricing: prompt ${promptPrice}, completion ${completionPrice} | Context: ${m.context_length ?? 'N/A'} tokens. ${m.description || ''}`,
            ).slice(0, 420),
            published: createdIso,
          });
        }

        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          url,
          summary: `Fetched ${items.length} newest models from OpenRouter API`,
          ok: true,
        });
        return items;
      }

      case 'openrouter_free_models': {
        const url = 'https://openrouter.ai/api/v1/models';
        const res = await safeFetch(url, {
          headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'application/json' },
          timeoutMs: 14_000,
          maxBytes: 4_000_000,
        });
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status}`);
        }
        const parsed = JSON.parse(res.text) as {
          data?: Array<{
            id?: string;
            name?: string;
            created?: number;
            context_length?: number;
            description?: string;
            pricing?: { prompt?: string | number; completion?: string | number };
          }>;
        };
        const isZeroCost = (val?: string | number): boolean => {
          if (val === undefined || val === null || val === '') return false;
          const n = typeof val === 'number' ? val : Number.parseFloat(String(val));
          return Number.isFinite(n) && n === 0;
        };
        const models = Array.isArray(parsed.data) ? parsed.data : [];
        const newestFree = [...models]
          .filter(
            (m) =>
              Boolean(m?.id && m.id.includes('/')) &&
              (m.id!.endsWith(':free') ||
                (isZeroCost(m.pricing?.prompt) && isZeroCost(m.pricing?.completion))) &&
              isZeroCost(m.pricing?.prompt) &&
              isZeroCost(m.pricing?.completion) &&
              (m.context_length ?? 0) >= 8192,
          )
          .sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0))
          .slice(0, 12);

        const items: FeedItem[] = [];
        for (const m of newestFree) {
          const id = m.id!.trim().replace(/^\/+/, '');
          const modelUrl = `https://openrouter.ai/${id}`;
          if (!isSafePublicUrl(modelUrl).ok) continue;
          const name = (m.name || id).trim();
          const ctxLabel = m.context_length
            ? m.context_length >= 1000
              ? `${Math.round(m.context_length / 1000)}k`
              : String(m.context_length)
            : 'N/A';
          const createdIso =
            m.created && Number.isFinite(m.created) && m.created > 0
              ? new Date(m.created * 1000).toISOString()
              : undefined;
          items.push({
            title: normalizeWhitespace(`New $0 Free LLM on OpenRouter: ${name} (${id}) — ${ctxLabel} ctx`),
            url: modelUrl,
            summary: normalizeWhitespace(
              `Verified $0/M input & $0/M output free LLM | Context: ${m.context_length ?? 'N/A'} tokens. ${m.description || ''}`,
            ).slice(0, 420),
            published: createdIso,
          });
        }
        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          url,
          summary: `Fetched ${items.length} newest $0 free LLMs from OpenRouter API`,
          ok: true,
        });
        return items;
      }

      case 'comfyui_releases': {
        const repos = [
          'comfyanonymous/ComfyUI',
          'Comfy-Org/ComfyUI_frontend',
          'Comfy-Org/ComfyUI-Manager',
        ];
        const settled = await Promise.allSettled(
          repos.map(async (repo) => {
            const url = `https://api.github.com/repos/${repo}/releases?per_page=3`;
            const res = await safeFetch(url, {
              headers: {
                'User-Agent': BOT_USER_AGENT,
                Accept: 'application/vnd.github+json',
              },
              timeoutMs: 12_000,
              maxBytes: 500_000,
            });
            if (res.status < 200 || res.status >= 300) {
              throw new Error(`${repo} HTTP ${res.status}`);
            }
            const releases = JSON.parse(res.text) as Array<{
              tag_name?: string;
              name?: string;
              html_url?: string;
              published_at?: string;
              created_at?: string;
              body?: string;
            }>;
            return (Array.isArray(releases) ? releases : [])
              .slice(0, 3)
              .filter((rel) => Boolean(rel.html_url && isSafePublicUrl(rel.html_url).ok))
              .map((rel): FeedItem => {
                const tag = rel.tag_name || rel.name || 'release';
                const pub = rel.published_at || rel.created_at;
                const notesExcerpt = normalizeWhitespace(
                  (rel.body || '').replace(/[#*`>]/g, ' '),
                ).slice(0, 360);
                return {
                  title: normalizeWhitespace(
                    `${repo} ${tag}${rel.name && rel.name !== rel.tag_name ? ` — ${rel.name}` : ''}`,
                  ),
                  url: rel.html_url!,
                  summary: normalizeWhitespace(
                    `${pub ? `[Released ${pub}] ` : ''}${notesExcerpt || `New ${repo} release ${tag}`}`,
                  ).slice(0, 420),
                  published: pub,
                };
              });
          }),
        );
        const fulfilled = settled.filter(
          (r): r is PromiseFulfilledResult<FeedItem[]> => r.status === 'fulfilled',
        );
        if (fulfilled.length === 0) {
          throw new Error('All ComfyUI GitHub release fetches failed');
        }
        const items = fulfilled
          .flatMap((r) => r.value)
          .sort((a, b) => (b.published || '').localeCompare(a.published || ''));
        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          url: 'https://api.github.com/repos/Comfy-Org/*/releases',
          summary: `Fetched ${items.length} latest ComfyUI core, frontend & manager releases`,
          ok: true,
        });
        return items;
      }

      case 'github_trending_comfyui_video': {
        const url = `https://api.github.com/search/repositories?q=(ComfyUI+OR+%22video+generation%22+OR+%22Wan2%22+OR+%22LTX-Video%22+OR+HunyuanVideo+OR+Flux)+pushed:%3E${fourteenDaysAgoIsoDate}&sort=stars&order=desc&per_page=10`;
        return await fetchGithubTrendingRepos(
          feedName,
          url,
          'trending ComfyUI & AI video/image GitHub repositories',
          trace,
        );
      }

      case 'huggingface_trending_media': {
        const pipelines = ['text-to-video', 'image-to-video', 'text-to-image'];
        const settled = await Promise.allSettled(
          pipelines.map(async (pipe) => {
            const url = `https://huggingface.co/api/models?pipeline_tag=${encodeURIComponent(pipe)}&sort=trendingScore&direction=-1&limit=5`;
            const res = await safeFetch(url, {
              headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'application/json' },
              timeoutMs: 12_000,
              maxBytes: 400_000,
            });
            if (res.status < 200 || res.status >= 300) {
              throw new Error(`${pipe} HTTP ${res.status}`);
            }
            const rows = JSON.parse(res.text) as Array<{
              id?: string;
              modelId?: string;
              likes?: number;
              downloads?: number;
              lastModified?: string;
              pipeline_tag?: string;
            }>;
            return (Array.isArray(rows) ? rows : [])
              .map((m): FeedItem | null => {
                const id = (m.id || m.modelId || '').trim();
                if (!id || !id.includes('/')) return null;
                const modelUrl = `https://huggingface.co/${id}`;
                if (!isSafePublicUrl(modelUrl).ok) return null;
                return {
                  title: normalizeWhitespace(
                    `Trending Open Media Model (${m.pipeline_tag || pipe}): ${id}`,
                  ),
                  url: modelUrl,
                  summary: normalizeWhitespace(
                    `Hugging Face trending ${m.pipeline_tag || pipe} release — ${m.likes ?? 0} likes, ${m.downloads ?? 0} downloads.`,
                  ),
                  published: m.lastModified,
                };
              })
              .filter((item): item is FeedItem => item !== null);
          }),
        );
        const fulfilled = settled.filter(
          (r): r is PromiseFulfilledResult<FeedItem[]> => r.status === 'fulfilled',
        );
        if (fulfilled.length === 0) {
          throw new Error('All Hugging Face media model fetches failed');
        }
        const seen = new Set<string>();
        const items = fulfilled
          .flatMap((r) => r.value)
          .filter((item) => {
            if (seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
          })
          .slice(0, 12);
        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          url: 'https://huggingface.co/api/models?pipeline_tag=text-to-video,image-to-video,text-to-image',
          summary: `Fetched ${items.length} trending Hugging Face video & image models`,
          ok: true,
        });
        return items;
      }

      case 'hn_ai_video_media': {
        const url = `https://hn.algolia.com/api/v1/search_by_date?query=ComfyUI%20OR%20%22video%20model%22%20OR%20Veo%20OR%20Sora%20OR%20Kling%20OR%20Wan%20OR%20Flux%20OR%20LTX&tags=story&numericFilters=points>15,created_at_i>${sevenDaysAgoUnix}`;
        return await fetchAlgoliaHnStories(feedName, url, 'HN ComfyUI & AI video/image stories (>15 pts, 7d)', trace);
      }

      case 'hn_ai_benchmarks': {
        const url = `https://hn.algolia.com/api/v1/search_by_date?query=benchmark%20OR%20leaderboard%20OR%20%22ARC-AGI%22%20OR%20%22SWE-bench%22%20OR%20OpenRouter%20OR%20%22open%20weights%22&tags=story&numericFilters=points>25,created_at_i>${sevenDaysAgoUnix}`;
        return await fetchAlgoliaHnStories(feedName, url, 'HN AI benchmark & model release stories (>25 pts, 7d)', trace);
      }

      case 'bleepingcomputer_rss': {
        const url = 'https://www.bleepingcomputer.com/feed/';
        const res = await safeFetch(url, {
          headers: {
            'User-Agent': BOT_USER_AGENT,
            Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
          },
          timeoutMs: 12_000,
          maxBytes: 800_000,
        });
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status}`);
        }
        const items = parseRssOrAtomXml(res.text, 12);
        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          url,
          summary: `Fetched ${items.length} BleepingComputer breach & cybersecurity RSS entries`,
          ok: true,
        });
        return items;
      }

      case 'thehackernews_rss': {
        const url = 'https://feeds.feedburner.com/TheHackersNews';
        const res = await safeFetch(url, {
          headers: {
            'User-Agent': BOT_USER_AGENT,
            Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
          },
          timeoutMs: 12_000,
          maxBytes: 800_000,
        });
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status}`);
        }
        const items = parseRssOrAtomXml(res.text, 12);
        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          url,
          summary: `Fetched ${items.length} The Hacker News cybersecurity breach & CVE RSS entries`,
          ok: true,
        });
        return items;
      }

      case 'cloudflare_changelog_rss': {
        const url = 'https://developers.cloudflare.com/changelog/rss/index.xml';
        const res = await safeFetch(url, {
          headers: {
            'User-Agent': BOT_USER_AGENT,
            Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
          },
          timeoutMs: 12_000,
          maxBytes: 800_000,
        });
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status}`);
        }
        const items = parseRssOrAtomXml(res.text, 12);
        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          url,
          summary: `Fetched ${items.length} Cloudflare Changelog RSS entries`,
          ok: true,
        });
        return items;
      }

      case 'hn_top_infra': {
        const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=points>50,created_at_i>${sevenDaysAgoUnix}`;
        return await fetchAlgoliaHnStories(feedName, url, 'HN stories (>50 pts, 7d)', trace);
      }

      case 'hn_ai_coding': {
        const url = `https://hn.algolia.com/api/v1/search_by_date?query=MCP%20OR%20%22Claude%20Code%22%20OR%20%22coding%20agent%22%20OR%20%22SWE-bench%22&tags=story&numericFilters=points>20,created_at_i>${sevenDaysAgoUnix}`;
        return await fetchAlgoliaHnStories(feedName, url, 'HN AI coding stories (>20 pts, 7d)', trace);
      }

      case 'hn_ai_security': {
        const url = `https://hn.algolia.com/api/v1/search_by_date?query=%22prompt%20injection%22%20OR%20jailbreak%20OR%20%22MCP%20security%22%20OR%20%22LLM%20security%22&tags=story&numericFilters=points>15,created_at_i>${sevenDaysAgoUnix}`;
        return await fetchAlgoliaHnStories(feedName, url, 'HN AI security stories (>15 pts, 7d)', trace);
      }

      case 'hn_cloud_gpu': {
        const url = `https://hn.algolia.com/api/v1/search_by_date?query=%22Cloudflare%20Workers%22%20OR%20H100%20OR%20B200%20OR%20Postgres%20OR%20serverless&tags=story&numericFilters=points>30,created_at_i>${sevenDaysAgoUnix}`;
        return await fetchAlgoliaHnStories(feedName, url, 'HN Cloud/GPU stories (>30 pts, 7d)', trace);
      }

      case 'arxiv_ai': {
        const url =
          'https://export.arxiv.org/api/query?search_query=cat:cs.CL+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=10';
        const res = await safeFetch(url, {
          headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'application/atom+xml,text/xml' },
          timeoutMs: 14_000,
          maxBytes: 600_000,
        });
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status}`);
        }
        const items = parseRssOrAtomXml(res.text, 10);
        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          url,
          summary: `Fetched ${items.length} arXiv cs.CL/cs.LG papers`,
          ok: true,
        });
        return items;
      }

      case 'arxiv_ai_sec': {
        const url =
          'https://export.arxiv.org/api/query?search_query=all:prompt+injection+OR+all:jailbreak+OR+all:llm+security&sortBy=submittedDate&sortOrder=descending&max_results=10';
        const res = await safeFetch(url, {
          headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'application/atom+xml,text/xml' },
          timeoutMs: 14_000,
          maxBytes: 600_000,
        });
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status}`);
        }
        const items = parseRssOrAtomXml(res.text, 10);
        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          url,
          summary: `Fetched ${items.length} arXiv AI security papers`,
          ok: true,
        });
        return items;
      }

      case 'arxiv_ir_rag': {
        const url =
          'https://export.arxiv.org/api/query?search_query=cat:cs.IR&sortBy=submittedDate&sortOrder=descending&max_results=10';
        const res = await safeFetch(url, {
          headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'application/atom+xml,text/xml' },
          timeoutMs: 14_000,
          maxBytes: 600_000,
        });
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status}`);
        }
        const items = parseRssOrAtomXml(res.text, 10);
        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          url,
          summary: `Fetched ${items.length} arXiv cs.IR retrieval papers`,
          ok: true,
        });
        return items;
      }

      case 'huggingface_trending': {
        const url = 'https://huggingface.co/api/daily_papers?limit=10';
        const res = await safeFetch(url, {
          headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'application/json' },
          timeoutMs: 12_000,
          maxBytes: 600_000,
        });
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status}`);
        }
        const rows = JSON.parse(res.text) as Array<{
          title?: string;
          summary?: string;
          publishedAt?: string;
          paper?: {
            id?: string;
            title?: string;
            summary?: string;
            publishedAt?: string;
          };
        }>;
        const items: FeedItem[] = (Array.isArray(rows) ? rows : [])
          .slice(0, 10)
          .filter((r) => Boolean(r.paper?.id))
          .map((r) => ({
            title: normalizeWhitespace(r.paper?.title || r.title || 'Hugging Face Daily Paper'),
            url: `https://huggingface.co/papers/${encodeURIComponent(r.paper!.id!)}`,
            summary: normalizeWhitespace(r.paper?.summary || r.summary || '').slice(0, 420),
            published: r.publishedAt || r.paper?.publishedAt,
          }));

        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          url,
          summary: `Fetched ${items.length} Hugging Face daily papers`,
          ok: true,
        });
        return items;
      }

      default: {
        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          summary: `Unknown feed name "${feedName}"`,
          ok: false,
        });
        return [];
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    pushTrace(trace, {
      stage: 'hunt_topics',
      tool_name: 'fetchAuthoritativeFeed',
      input: feedName,
      summary: `Feed fetch failed: ${message}`,
      ok: false,
    });
    return [];
  }
}

function unwrapDuckDuckGoUrl(rawHref: string): string {
  const decodedHref = decodeHtmlEntities(rawHref.trim());
  if (!decodedHref) return '';

  // Handle //duckduckgo.com/l/?uddg=... or /l/?uddg=...
  const withScheme = decodedHref.startsWith('//')
    ? `https:${decodedHref}`
    : decodedHref.startsWith('/')
      ? `https://duckduckgo.com${decodedHref}`
      : decodedHref;

  try {
    const parsed = new URL(withScheme);
    if (parsed.hostname.endsWith('duckduckgo.com')) {
      const uddg = parsed.searchParams.get('uddg');
      if (uddg) {
        return decodeURIComponent(uddg);
      }
    }
    return parsed.toString();
  } catch {
    return decodedHref;
  }
}

function parseDuckDuckGoHtml(html: string): SearchSourceItem[] {
  const results: SearchSourceItem[] = [];
  const seen = new Set<string>();

  // Match result blocks or anchor tags with class result__a
  const anchorRegex =
    /<a\b[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex =
    /<(?:a|div|span)\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|span)>/gi;

  const anchors: Array<{ href: string; title: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = anchorRegex.exec(html)) !== null) {
    anchors.push({
      href: m[1],
      title: normalizeWhitespace(stripTags(m[2])),
      index: m.index,
    });
  }

  const snippets: Array<{ text: string; index: number }> = [];
  while ((m = snippetRegex.exec(html)) !== null) {
    snippets.push({
      text: normalizeWhitespace(stripTags(m[1])),
      index: m.index,
    });
  }

  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    const nextAnchorIndex = i + 1 < anchors.length ? anchors[i + 1].index : Number.MAX_SAFE_INTEGER;
    const matchedSnippet = snippets.find(
      (s) => s.index > anchor.index && s.index < nextAnchorIndex,
    );

    const unwrapped = unwrapDuckDuckGoUrl(anchor.href);
    const check = isSafePublicUrl(unwrapped);
    if (!check.ok || !check.url) continue;

    const cleanUrl = check.url.toString();
    if (seen.has(cleanUrl)) continue;
    seen.add(cleanUrl);

    results.push({
      title: anchor.title || cleanUrl,
      url: cleanUrl,
      snippet: (matchedSnippet?.text || '').slice(0, 320),
    });

    if (results.length >= 8) break;
  }

  return results;
}

export interface SearchWebOptions {
  freshness?: 'day' | 'week' | 'month' | 'any';
  mode?: 'web' | 'news';
}

/**
 * Searches public web sources using Serper (if configured) or DuckDuckGo HTML fallback.
 * Supports optional freshness (`day` | `week` | `month` | `any`) and mode (`web` | `news`).
 * All returned URLs are validated through isSafePublicUrl.
 */
export async function searchWebSources(
  query: string,
  env: WorkerEnv,
  trace?: TraceEntry[],
  opts?: SearchWebOptions,
): Promise<SearchSourceItem[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const freshness = opts?.freshness;
  const mode = opts?.mode ?? 'web';

  // 1. Try Serper if API key is configured
  const serperKey = env.SERPER_API_KEY?.trim();
  if (serperKey) {
    const endpoint =
      mode === 'news' ? 'https://google.serper.dev/news' : 'https://google.serper.dev/search';
    const tbs =
      freshness === 'day'
        ? 'qdr:d'
        : freshness === 'week'
          ? 'qdr:w'
          : freshness === 'month'
            ? 'qdr:m'
            : undefined;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'X-API-KEY': serperKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: cleanQuery,
            num: 8,
            ...(tbs ? { tbs } : {}),
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Serper HTTP ${response.status}`);
        }
        const data = (await response.json()) as {
          organic?: Array<{ title?: string; link?: string; snippet?: string; date?: string }>;
          news?: Array<{ title?: string; link?: string; snippet?: string; date?: string }>;
        };
        const rawList = Array.isArray(data.news)
          ? data.news
          : Array.isArray(data.organic)
            ? data.organic
            : [];
        const seen = new Set<string>();
        const results: SearchSourceItem[] = [];
        for (const item of rawList) {
          if (!item.link) continue;
          const check = isSafePublicUrl(item.link);
          if (!check.ok || !check.url) continue;
          const normalizedUrl = check.url.toString();
          if (seen.has(normalizedUrl)) continue;
          seen.add(normalizedUrl);
          const datePrefix = item.date ? `[${item.date}] ` : '';
          results.push({
            title: normalizeWhitespace(item.title || normalizedUrl),
            url: normalizedUrl,
            snippet: normalizeWhitespace(`${datePrefix}${item.snippet || ''}`).slice(0, 320),
          });
        }
        if (results.length > 0) {
          pushTrace(trace, {
            stage: 'deep_research',
            tool_name: 'searchWebSources',
            input: cleanQuery,
            url: endpoint,
            summary: `Serper (${mode}${tbs ? `, ${tbs}` : ''}) returned ${results.length} safe results`,
            ok: true,
          });
          return results;
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      pushTrace(trace, {
        stage: 'deep_research',
        tool_name: 'searchWebSources',
        input: cleanQuery,
        url: endpoint,
        summary: `Serper failed (${message}); falling back to DuckDuckGo HTML`,
        ok: false,
      });
    }
  }

  // 2. DuckDuckGo HTML fallback
  const dfSuffix =
    freshness === 'day'
      ? '&df=d'
      : freshness === 'week'
        ? '&df=w'
        : freshness === 'month'
          ? '&df=m'
          : '';
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}${dfSuffix}`;
  try {
    const res = await safeFetch(ddgUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      timeoutMs: 12_000,
      maxBytes: 400_000,
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`DuckDuckGo HTTP ${res.status}`);
    }
    const results = parseDuckDuckGoHtml(res.text);
    pushTrace(trace, {
      stage: 'deep_research',
      tool_name: 'searchWebSources',
      input: cleanQuery,
      url: ddgUrl,
      summary: `DuckDuckGo HTML${dfSuffix ? ` (${freshness})` : ''} returned ${results.length} safe results`,
      ok: true,
    });
    return results;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    pushTrace(trace, {
      stage: 'deep_research',
      tool_name: 'searchWebSources',
      input: cleanQuery,
      url: ddgUrl,
      summary: `DuckDuckGo search failed: ${message}`,
      ok: false,
    });
    return [];
  }
}

function htmlTableToMarkdown(tableHtml: string): string {
  const rows: string[][] = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      const text = normalizeWhitespace(stripTags(cellMatch[1])).replace(/\|/g, '\\|');
      cells.push(text);
    }
    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  if (rows.length === 0) return '';
  const colCount = Math.max(...rows.map((r) => r.length));
  const padded = rows.map((r) => {
    const copy = [...r];
    while (copy.length < colCount) copy.push('');
    return copy;
  });

  const header = `| ${padded[0].join(' | ')} |`;
  const separator = `| ${Array(colCount).fill('---').join(' | ')} |`;
  const body = padded.slice(1).map((r) => `| ${r.join(' | ')} |`);
  return `\n\n${[header, separator, ...body].join('\n')}\n\n`;
}

const BLOCKED_IMAGE_HOST_PATTERNS = [
  'shields.io',
  'badge.fury.io',
  'codecov.io',
  'coveralls.io',
  'travis-ci.',
  'doubleclick.net',
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.com',
  'bat.bing.com',
  'gravatar.com',
  'avatars.githubusercontent.com',
  'camo.githubusercontent.com',
  'github.githubassets.com',
];

const JUNK_IMAGE_PATH_RE =
  /(?:\/favicon|apple-touch-icon|\/avatars?\/|\/badges?\/|\/icons?\/|\/emojis?\/|\/sprites?\/|1x1|spacer\.|pixel\.|spinner\.|loader\.|\.ico(?:$|\?))/i;

const JUNK_IMAGE_ALT_RE =
  /^(?:logo|site logo|company logo|icon|avatar|profile(?:\s+picture|\s+photo)?|badge|build status|coverage|sponsor|advertisement|ad)$/i;

export function isValidReferenceImageUrl(
  rawUrl: string,
  altText = '',
  baseUrl?: string,
): { ok: boolean; url: string } {
  const cleanedRaw = decodeHtmlEntities((rawUrl || '').trim());
  if (!cleanedRaw) return { ok: false, url: '' };

  const lowerRaw = cleanedRaw.toLowerCase();
  if (
    lowerRaw.startsWith('data:') ||
    lowerRaw.startsWith('blob:') ||
    lowerRaw.startsWith('javascript:')
  ) {
    return { ok: false, url: '' };
  }

  let candidate = cleanedRaw;
  if (baseUrl && !/^https?:\/\//i.test(candidate)) {
    try {
      candidate = new URL(candidate, baseUrl).toString();
    } catch {
      return { ok: false, url: '' };
    }
  }

  const safeCheck = isSafePublicUrl(candidate);
  if (!safeCheck.ok || !safeCheck.url) {
    return { ok: false, url: '' };
  }

  const parsed = safeCheck.url;
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_IMAGE_HOST_PATTERNS.some((pat) => host.includes(pat))) {
    return { ok: false, url: '' };
  }

  const fullPath = `${parsed.pathname}${parsed.search}`;
  if (JUNK_IMAGE_PATH_RE.test(fullPath)) {
    return { ok: false, url: '' };
  }

  // Block generic UI .svg icons unless explicitly labeled as a diagram/architecture/chart/figure
  if (/\.svg(?:$|\?)/i.test(parsed.pathname)) {
    const signal = `${parsed.pathname} ${altText}`.toLowerCase();
    if (!/(diagram|architecture|chart|figure|benchmark|flow|topology|graph)/.test(signal)) {
      return { ok: false, url: '' };
    }
  }

  // Block obvious nav/brand wordmark filenames
  const filename = parsed.pathname.split('/').pop()?.toLowerCase() || '';
  if (/(?:^|[-_])(logo|wordmark|favicon|avatar|badge)(?:[-_.]|$)/.test(filename)) {
    return { ok: false, url: '' };
  }

  const cleanAlt = altText.trim();
  if (cleanAlt && JUNK_IMAGE_ALT_RE.test(cleanAlt)) {
    return { ok: false, url: '' };
  }

  return { ok: true, url: parsed.toString() };
}

function getHtmlAttr(tagHtml: string, attrName: string): string {
  const rx = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>"']+))`, 'i');
  const m = rx.exec(tagHtml);
  return decodeHtmlEntities((m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim());
}

function hasTinyImageDimensions(imgTag: string): boolean {
  const w = Number.parseInt(getHtmlAttr(imgTag, 'width'), 10);
  const h = Number.parseInt(getHtmlAttr(imgTag, 'height'), 10);
  if (Number.isFinite(w) && w > 0 && w < 120) return true;
  if (Number.isFinite(h) && h > 0 && h < 90) return true;
  return false;
}

export function extractReferenceImagesFromHtml(
  html: string,
  pageUrl: string,
): ExtractedWebImage[] {
  const results: ExtractedWebImage[] = [];
  const seen = new Set<string>();

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const pageTitle = normalizeWhitespace(decodeHtmlEntities(titleMatch?.[1] || ''));

  const pushCandidate = (rawUrl: string, rawAlt: string, rawCaption?: string) => {
    if (results.length >= 8) return;
    const altCleaned = normalizeWhitespace(rawAlt || rawCaption || pageTitle || 'Reference figure')
      .replace(/^Image\s+\d+:\s*/i, '')
      .slice(0, 220);
    const check = isValidReferenceImageUrl(rawUrl, altCleaned, pageUrl);
    if (!check.ok || seen.has(check.url)) return;
    seen.add(check.url);
    const captionCleaned = rawCaption ? normalizeWhitespace(rawCaption).slice(0, 240) : undefined;
    results.push({
      url: check.url,
      alt: altCleaned || 'Technical reference figure',
      ...(captionCleaned ? { caption: captionCleaned } : {}),
      source_page_url: pageUrl,
    });
  };

  // 1. OpenGraph & Twitter card images from <head>
  const metaRegex = /<meta\b[^>]+>/gi;
  let metaMatch: RegExpExecArray | null;
  let ogImage = '';
  let ogAlt = '';
  let twitterImage = '';
  while ((metaMatch = metaRegex.exec(html)) !== null) {
    const tag = metaMatch[0];
    const prop = (getHtmlAttr(tag, 'property') || getHtmlAttr(tag, 'name')).toLowerCase();
    const content = getHtmlAttr(tag, 'content');
    if (!content) continue;
    if ((prop === 'og:image' || prop === 'og:image:url' || prop === 'og:image:secure_url') && !ogImage) {
      ogImage = content;
    } else if (prop === 'og:image:alt' && !ogAlt) {
      ogAlt = content;
    } else if ((prop === 'twitter:image' || prop === 'twitter:image:src') && !twitterImage) {
      twitterImage = content;
    }
  }
  if (ogImage) {
    pushCandidate(ogImage, ogAlt || pageTitle);
  }
  if (twitterImage && twitterImage !== ogImage) {
    pushCandidate(twitterImage, ogAlt || pageTitle);
  }

  // Strip nav/header/footer/script before scanning editorial figures & images
  const bodyScope = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|nav|header|footer|aside|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');

  // 2. <figure> blocks with <figcaption>
  const figureRegex = /<figure\b[^>]*>([\s\S]*?)<\/figure>/gi;
  let figMatch: RegExpExecArray | null;
  while ((figMatch = figureRegex.exec(bodyScope)) !== null && results.length < 8) {
    const inner = figMatch[1];
    const imgMatch = /<img\b[^>]*>/i.exec(inner);
    if (!imgMatch || hasTinyImageDimensions(imgMatch[0])) continue;
    const src =
      getHtmlAttr(imgMatch[0], 'src') ||
      getHtmlAttr(imgMatch[0], 'data-src') ||
      getHtmlAttr(imgMatch[0], 'data-lazy-src');
    if (!src) continue;
    const alt = getHtmlAttr(imgMatch[0], 'alt');
    const capMatch = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i.exec(inner);
    const caption = capMatch ? normalizeWhitespace(stripTags(capMatch[1])) : undefined;
    pushCandidate(src, alt || caption || pageTitle, caption);
  }

  // 3. Standalone editorial <img> tags
  const imgRegex = /<img\b[^>]*>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRegex.exec(bodyScope)) !== null && results.length < 8) {
    const tag = imgMatch[0];
    if (hasTinyImageDimensions(tag)) continue;
    const src =
      getHtmlAttr(tag, 'src') ||
      getHtmlAttr(tag, 'data-src') ||
      getHtmlAttr(tag, 'data-lazy-src');
    if (!src) continue;
    const alt = getHtmlAttr(tag, 'alt') || getHtmlAttr(tag, 'title');
    pushCandidate(src, alt || pageTitle);
  }

  return results;
}

export function extractReferenceImagesFromMarkdown(
  markdown: string,
  pageUrl: string,
  fallbackTitle = '',
): ExtractedWebImage[] {
  const results: ExtractedWebImage[] = [];
  const seen = new Set<string>();

  const mdImgRegex = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdImgRegex.exec(markdown)) !== null && results.length < 8) {
    const rawAlt = normalizeWhitespace(match[1] || match[3] || '')
      .replace(/^Image\s+\d+:\s*/i, '')
      .trim();
    const rawUrl = (match[2] || '').trim();
    const check = isValidReferenceImageUrl(rawUrl, rawAlt, pageUrl);
    if (!check.ok || seen.has(check.url)) continue;
    seen.add(check.url);
    const cleanAlt = (rawAlt || fallbackTitle || 'Technical reference diagram').slice(0, 220);
    results.push({
      url: check.url,
      alt: cleanAlt,
      ...(rawAlt ? { caption: rawAlt.slice(0, 240) } : {}),
      source_page_url: pageUrl,
    });
  }

  // Deterministic GitHub repository OpenGraph preview fallback (zero extra network requests)
  if (results.length === 0) {
    try {
      const parsed = new URL(pageUrl);
      if (parsed.hostname.toLowerCase() === 'github.com') {
        const segs = parsed.pathname.split('/').filter(Boolean);
        if (
          segs.length >= 2 &&
          !['orgs', 'topics', 'trending', 'advisories', 'settings', 'marketplace'].includes(
            segs[0].toLowerCase(),
          )
        ) {
          const owner = segs[0];
          const repo = segs[1].replace(/\.git$/i, '');
          const ogUrl = `https://opengraph.githubassets.com/1/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
          const check = isValidReferenceImageUrl(ogUrl, `${owner}/${repo} repository preview`);
          if (check.ok) {
            results.push({
              url: check.url,
              alt: fallbackTitle || `${owner}/${repo} — GitHub repository overview`,
              caption: `${owner}/${repo} primary repository reference`,
              source_page_url: pageUrl,
            });
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return results;
}

function convertHtmlToMarkdown(
  html: string,
  pageUrl?: string,
): { title: string; markdown: string } {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = normalizeWhitespace(decodeHtmlEntities(titleMatch?.[1] || ''));

  // Strip non-editorial chrome and executable/style blocks
  let cleaned = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|nav|footer|svg|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');

  // Stash fenced code blocks (<pre><code>...</code></pre> and <pre>...</pre>)
  const stashedBlocks: string[] = [];
  const stash = (content: string): string => {
    const idx = stashedBlocks.length;
    stashedBlocks.push(content);
    return `\n\n@@PYVREN_STASH_${idx}@@\n\n`;
  };

  cleaned = cleaned.replace(
    /<pre\b[^>]*>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_m, attrs: string, codeBody: string) => {
      const langMatch = /class=["'][^"']*(?:language|lang)-([a-z0-9_+-]+)[^"']*["']/i.exec(attrs);
      const lang = langMatch?.[1] || '';
      const rawCode = decodeHtmlEntities(codeBody.replace(/<[^>]+>/g, '')).trim();
      if (!rawCode) return '';
      return stash(`\`\`\`${lang}\n${rawCode}\n\`\`\``);
    },
  );

  cleaned = cleaned.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_m, preBody: string) => {
    const rawCode = decodeHtmlEntities(preBody.replace(/<[^>]+>/g, '')).trim();
    if (!rawCode) return '';
    return stash(`\`\`\`\n${rawCode}\n\`\`\``);
  });

  // Stash Markdown pipe tables converted from <table>
  cleaned = cleaned.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (tableHtml: string) => {
    const mdTable = htmlTableToMarkdown(tableHtml).trim();
    return mdTable ? stash(mdTable) : '';
  });

  // Preserve valid editorial images as Markdown ![alt](https://...)
  cleaned = cleaned.replace(/<img\b[^>]*>/gi, (imgTag: string) => {
    if (hasTinyImageDimensions(imgTag)) return ' ';
    const src =
      getHtmlAttr(imgTag, 'src') ||
      getHtmlAttr(imgTag, 'data-src') ||
      getHtmlAttr(imgTag, 'data-lazy-src');
    const alt = normalizeWhitespace(getHtmlAttr(imgTag, 'alt') || getHtmlAttr(imgTag, 'title'));
    const check = isValidReferenceImageUrl(src, alt, pageUrl);
    if (!check.ok) return ' ';
    return stash(`![${(alt || title || 'Reference diagram').replace(/[\[\]]/g, '')}](${check.url})`);
  });

  // Inline code
  cleaned = cleaned.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_m, codeText: string) => {
    const inner = normalizeWhitespace(decodeHtmlEntities(codeText.replace(/<[^>]+>/g, '')));
    return inner ? `\`${inner.replace(/`/g, "'")}\`` : '';
  });

  // Headings
  for (let level = 1; level <= 6; level++) {
    const hashes = '#'.repeat(level);
    const rx = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi');
    cleaned = cleaned.replace(rx, (_m, text: string) => {
      const heading = normalizeWhitespace(stripTags(text));
      return heading ? `\n\n${hashes} ${heading}\n\n` : '';
    });
  }

  // Links (preserve https:// links)
  cleaned = cleaned.replace(
    /<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, anchor: string) => {
      const label = normalizeWhitespace(stripTags(anchor));
      return label ? `[${label}](${href})` : href;
    },
  );

  // Structural elements
  cleaned = cleaned
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, item: string) => {
      const txt = normalizeWhitespace(stripTags(item));
      return txt ? `\n- ${txt}` : '';
    })
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, quote: string) => {
      const txt = normalizeWhitespace(stripTags(quote));
      return txt ? `\n\n> ${txt}\n\n` : '';
    })
    .replace(/<(?:p|div|section|article|main|tr|hr)\b[^>]*>/gi, '\n\n')
    .replace(/<\/(?:p|div|section|article|main|ul|ol)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  let md = decodeHtmlEntities(cleaned)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Restore stashed code blocks, tables, and figures
  md = md.replace(/@@PYVREN_STASH_(\d+)@@/g, (_m, idxStr: string) => {
    const idx = Number.parseInt(idxStr, 10);
    return stashedBlocks[idx] ?? '';
  });

  md = md.replace(/\n{3,}/g, '\n\n').trim();
  return { title, markdown: md };
}

function extractJinaTitle(markdown: string): string {
  const titleHeader = /^Title:\s*(.+)$/im.exec(markdown);
  if (titleHeader?.[1]) return titleHeader[1].trim();
  const h1 = /^#\s+(.+)$/m.exec(markdown);
  if (h1?.[1]) return h1[1].trim();
  return '';
}

/**
 * Reads a primary webpage with strict SSRF pre-validation via isSafePublicUrl.
 * Uses Jina Reader first for high-fidelity Markdown, falling back to direct safeFetch
 * with HTML->Markdown conversion preserving <table>, <pre>, <code>, and verified reference images.
 */
export async function readPrimaryWebpage(
  url: string,
  env: WorkerEnv,
  trace?: TraceEntry[],
): Promise<WebpageReadResult> {
  // Mandatory SSRF check BEFORE any network request
  const check = isSafePublicUrl(url);
  if (!check.ok) {
    const errorMsg = `SSRF blocked: ${check.reason || 'URL is not a safe public HTTP(S) target'}`;
    pushTrace(trace, {
      stage: 'deep_research',
      tool_name: 'readPrimaryWebpage',
      input: url,
      url,
      summary: errorMsg,
      chars_extracted: 0,
      ok: false,
    });
    return {
      ok: false,
      url,
      title: '',
      markdown: '',
      chars: 0,
      images: [],
      error: errorMsg,
    };
  }

  const safeUrl = check.url ? check.url.toString() : url;

  // 1. Try Jina Reader API for clean markdown extraction
  const jinaUrl = `https://r.jina.ai/${safeUrl}`;
  const jinaHeaders: Record<string, string> = {
    Accept: 'text/markdown',
    'User-Agent': BOT_USER_AGENT,
  };
  if (env.JINA_API_KEY?.trim()) {
    jinaHeaders.Authorization = `Bearer ${env.JINA_API_KEY.trim()}`;
  }

  try {
    const jinaRes = await safeFetch(jinaUrl, {
      headers: jinaHeaders,
      timeoutMs: 14_000,
      maxBytes: 300_000,
    });
    if (jinaRes.status >= 200 && jinaRes.status < 300) {
      const rawText = jinaRes.text.trim();
      if (rawText.length >= 200) {
        const title = extractJinaTitle(rawText);
        const images = extractReferenceImagesFromMarkdown(rawText, safeUrl, title);
        const markdown = truncateText(rawText, MAX_EXTRACTED_CHARS);
        pushTrace(trace, {
          stage: 'deep_research',
          tool_name: 'readPrimaryWebpage',
          input: safeUrl,
          url: safeUrl,
          summary: `Extracted via Jina Reader (${markdown.length} chars, ${images.length} ref image(s))`,
          chars_extracted: markdown.length,
          ok: true,
        });
        return {
          ok: true,
          url: safeUrl,
          title,
          markdown,
          chars: markdown.length,
          images,
        };
      }
    }
  } catch {
    // Fall through cleanly to direct safeFetch
  }

  // 2. Direct safeFetch fallback with HTML->Markdown preserving <table>, <pre>, <code>, and reference images
  try {
    const directRes = await safeFetch(safeUrl, {
      headers: {
        'User-Agent': BOT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,text/markdown,text/plain;q=0.9,*/*;q=0.8',
      },
      timeoutMs: 14_000,
      maxBytes: 600_000,
    });

    if (directRes.status < 200 || directRes.status >= 300) {
      throw new Error(`HTTP ${directRes.status}`);
    }

    const finalUrl = directRes.url || safeUrl;
    const ct = (directRes.contentType || '').toLowerCase();
    let title = '';
    let markdown = '';
    let images: ExtractedWebImage[] = [];

    if (ct.includes('text/plain') || ct.includes('text/markdown') || ct.includes('application/json')) {
      markdown = truncateText(directRes.text.trim(), MAX_EXTRACTED_CHARS);
      title = extractJinaTitle(markdown);
      images = extractReferenceImagesFromMarkdown(directRes.text, finalUrl, title);
    } else {
      const converted = convertHtmlToMarkdown(directRes.text, finalUrl);
      title = converted.title;
      markdown = truncateText(converted.markdown, MAX_EXTRACTED_CHARS);
      images = extractReferenceImagesFromHtml(directRes.text, finalUrl);
    }

    if (!markdown) {
      throw new Error('Extracted empty content from page');
    }

    pushTrace(trace, {
      stage: 'deep_research',
      tool_name: 'readPrimaryWebpage',
      input: safeUrl,
      url: finalUrl,
      summary: `Extracted via direct safeFetch (${markdown.length} chars, ${images.length} ref image(s))`,
      chars_extracted: markdown.length,
      ok: true,
    });

    return {
      ok: true,
      url: finalUrl,
      title,
      markdown,
      chars: markdown.length,
      images,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    pushTrace(trace, {
      stage: 'deep_research',
      tool_name: 'readPrimaryWebpage',
      input: safeUrl,
      url: safeUrl,
      summary: `Direct webpage read failed: ${message}`,
      chars_extracted: 0,
      ok: false,
    });
    return {
      ok: false,
      url: safeUrl,
      title: '',
      markdown: '',
      chars: 0,
      images: [],
      error: message,
    };
  }
}
