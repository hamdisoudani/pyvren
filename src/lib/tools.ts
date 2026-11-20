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

function parseArxivAtom(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const entryRegex = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(block);
    const summaryMatch = /<summary[^>]*>([\s\S]*?)<\/summary>/i.exec(block);
    const publishedMatch = /<published[^>]*>([\s\S]*?)<\/published>/i.exec(block);
    const idMatch = /<id[^>]*>([\s\S]*?)<\/id>/i.exec(block);
    const altLinkMatch =
      /<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i.exec(block) ||
      /<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["'][^>]*\/?>/i.exec(block);

    const rawUrl = (altLinkMatch?.[1] || idMatch?.[1] || '').trim().replace(/^http:\/\//i, 'https://');
    const title = normalizeWhitespace(decodeHtmlEntities(titleMatch?.[1] || ''));
    const summary = normalizeWhitespace(decodeHtmlEntities(summaryMatch?.[1] || '')).slice(0, 420);
    const published = normalizeWhitespace(publishedMatch?.[1] || '') || undefined;

    if (title && rawUrl && isSafePublicUrl(rawUrl).ok) {
      items.push({ title, url: rawUrl, summary, published });
    }
  }

  return items;
}

/**
 * Fetches curated authoritative research feeds safely via safeFetch.
 * Never throws uncaught errors; records failures in trace and returns [].
 */
export async function fetchAuthoritativeFeed(
  feedName: string,
  trace?: TraceEntry[],
): Promise<FeedItem[]> {
  const normalized = feedName.trim().toLowerCase();

  try {
    switch (normalized) {
      case 'cisa_kev': {
        const url =
          'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
        const res = await safeFetch(url, {
          headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'application/json' },
          timeoutMs: 12_000,
          maxBytes: 2_500_000,
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
            const title = normalizeWhitespace(
              `${cve}: ${v.vendorProject || ''} ${v.product || ''} — ${v.vulnerabilityName || 'KEV Advisory'}`,
            );
            const summary = normalizeWhitespace(
              `${v.shortDescription || ''} ${v.requiredAction ? `Required action: ${v.requiredAction}` : ''}`,
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
        const url = 'https://api.github.com/advisories?per_page=10';
        const res = await safeFetch(url, {
          headers: {
            'User-Agent': BOT_USER_AGENT,
            Accept: 'application/vnd.github+json',
          },
          timeoutMs: 12_000,
          maxBytes: 500_000,
        });
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status}`);
        }
        const rows = JSON.parse(res.text) as Array<{
          ghsa_id?: string;
          cve_id?: string | null;
          summary?: string;
          description?: string;
          html_url?: string;
          severity?: string;
          published_at?: string;
        }>;
        const items: FeedItem[] = (Array.isArray(rows) ? rows : [])
          .slice(0, 10)
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
          summary: `Fetched ${items.length} GitHub Security Advisories`,
          ok: true,
        });
        return items;
      }

      case 'hn_top_infra': {
        const url =
          'https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=points>50';
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
          const safe = isSafePublicUrl(hit.url);
          if (!safe.ok) continue;
          items.push({
            title: normalizeWhitespace(hit.title),
            url: hit.url,
            summary: `HN discussion (${hit.points ?? 0} points, ${hit.num_comments ?? 0} comments): https://news.ycombinator.com/item?id=${hit.objectID || ''}`,
            published: hit.created_at,
          });
        }

        pushTrace(trace, {
          stage: 'hunt_topics',
          tool_name: 'fetchAuthoritativeFeed',
          input: feedName,
          url,
          summary: `Fetched ${items.length} HN stories (>50 pts)`,
          ok: true,
        });
        return items;
      }

      case 'arxiv_ai': {
        const url =
          'https://export.arxiv.org/api/query?search_query=cat:cs.CL+OR+cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=8';
        const res = await safeFetch(url, {
          headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'application/atom+xml,text/xml' },
          timeoutMs: 14_000,
          maxBytes: 500_000,
        });
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status}`);
        }
        const items = parseArxivAtom(res.text);
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
          'https://export.arxiv.org/api/query?search_query=all:prompt+injection+OR+all:jailbreak+OR+all:llm+security&sortBy=submittedDate&sortOrder=descending&max_results=8';
        const res = await safeFetch(url, {
          headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'application/atom+xml,text/xml' },
          timeoutMs: 14_000,
          maxBytes: 500_000,
        });
        if (res.status < 200 || res.status >= 300) {
          throw new Error(`HTTP ${res.status}`);
        }
        const items = parseArxivAtom(res.text);
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

      case 'huggingface_trending': {
        const url = 'https://huggingface.co/api/daily_papers?limit=8';
        const res = await safeFetch(url, {
          headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'application/json' },
          timeoutMs: 12_000,
          maxBytes: 500_000,
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
          .slice(0, 8)
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

/**
 * Searches public web sources using Serper (if configured) or DuckDuckGo HTML fallback.
 * All returned URLs are validated through isSafePublicUrl.
 */
export async function searchWebSources(
  query: string,
  env: WorkerEnv,
  trace?: TraceEntry[],
): Promise<SearchSourceItem[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  // 1. Try Serper if API key is configured
  const serperKey = env.SERPER_API_KEY?.trim();
  if (serperKey) {
    const endpoint = 'https://google.serper.dev/search';
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
          body: JSON.stringify({ q: cleanQuery, num: 8 }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Serper HTTP ${response.status}`);
        }
        const data = (await response.json()) as {
          organic?: Array<{ title?: string; link?: string; snippet?: string }>;
        };
        const organic = Array.isArray(data.organic) ? data.organic : [];
        const seen = new Set<string>();
        const results: SearchSourceItem[] = [];
        for (const item of organic) {
          if (!item.link) continue;
          const check = isSafePublicUrl(item.link);
          if (!check.ok || !check.url) continue;
          const normalizedUrl = check.url.toString();
          if (seen.has(normalizedUrl)) continue;
          seen.add(normalizedUrl);
          results.push({
            title: normalizeWhitespace(item.title || normalizedUrl),
            url: normalizedUrl,
            snippet: normalizeWhitespace(item.snippet || '').slice(0, 320),
          });
        }
        if (results.length > 0) {
          pushTrace(trace, {
            stage: 'deep_research',
            tool_name: 'searchWebSources',
            input: cleanQuery,
            url: endpoint,
            summary: `Serper returned ${results.length} safe results`,
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
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
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
      summary: `DuckDuckGo HTML returned ${results.length} safe results`,
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
