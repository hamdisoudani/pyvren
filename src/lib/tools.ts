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

export interface WebpageReadResult {
  ok: boolean;
  url: string;
  title: string;
  markdown: string;
  chars: number;
  error?: string;
}

const MAX_EXTRACTED_CHARS = 14_000;
const BOT_USER_AGENT = 'Pyvren-Research-Bot/1.0 (+https://pyvren.com)';

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

function convertHtmlToMarkdown(html: string): { title: string; markdown: string } {
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

  // Restore stashed code blocks and tables
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
 * with HTML->Markdown conversion preserving <table>, <pre>, and <code>.
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
        const markdown = truncateText(rawText, MAX_EXTRACTED_CHARS);
        pushTrace(trace, {
          stage: 'deep_research',
          tool_name: 'readPrimaryWebpage',
          input: safeUrl,
          url: safeUrl,
          summary: `Extracted via Jina Reader (${markdown.length} chars)`,
          chars_extracted: markdown.length,
          ok: true,
        });
        return {
          ok: true,
          url: safeUrl,
          title,
          markdown,
          chars: markdown.length,
        };
      }
    }
  } catch {
    // Fall through cleanly to direct safeFetch
  }

  // 2. Direct safeFetch fallback with HTML->Markdown preserving <table>, <pre>, <code>
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

    const ct = (directRes.contentType || '').toLowerCase();
    let title = '';
    let markdown = '';

    if (ct.includes('text/plain') || ct.includes('text/markdown') || ct.includes('application/json')) {
      markdown = truncateText(directRes.text.trim(), MAX_EXTRACTED_CHARS);
      title = extractJinaTitle(markdown);
    } else {
      const converted = convertHtmlToMarkdown(directRes.text);
      title = converted.title;
      markdown = truncateText(converted.markdown, MAX_EXTRACTED_CHARS);
    }

    if (!markdown) {
      throw new Error('Extracted empty content from page');
    }

    const finalUrl = directRes.url || safeUrl;
    pushTrace(trace, {
      stage: 'deep_research',
      tool_name: 'readPrimaryWebpage',
      input: safeUrl,
      url: finalUrl,
      summary: `Extracted via direct safeFetch (${markdown.length} chars)`,
      chars_extracted: markdown.length,
      ok: true,
    });

    return {
      ok: true,
      url: finalUrl,
      title,
      markdown,
      chars: markdown.length,
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
      error: message,
    };
  }
}
