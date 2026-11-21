import { normalizeBaseUrl, type WorkerEnv } from '../env';

const EXACT_CACHEABLE_PATHS = new Set([
  '/',
  '/blog',
  '/about',
  '/editorial-policy',
  '/contact',
  '/privacy',
  '/terms',
  '/rss.xml',
  '/sitemap.xml',
  '/llms.txt',
  '/llms-full.txt',
  '/feed.json',
]);

const PREFIX_CACHEABLE_PATHS = ['/blog/', '/category/', '/tag/'];
const CACHE_THEMES = ['auto', 'light', 'dark'] as const;

export type EdgeCacheTheme = (typeof CACHE_THEMES)[number];

export function extractEdgeThemeKey(req: Request, pathname = ''): EdgeCacheTheme {
  if (
    pathname.endsWith('.xml') ||
    pathname.endsWith('.txt') ||
    pathname.endsWith('.json') ||
    pathname.endsWith('.md')
  ) {
    return 'auto';
  }
  const cookieHeader = req.headers.get('cookie') || '';
  if (!cookieHeader) return 'auto';
  const match = /(?:^|;\s*)pyvren_theme=(dark|light)(?:;|$)/i.exec(cookieHeader);
  if (!match) return 'auto';
  return match[1].toLowerCase() === 'dark' ? 'dark' : 'light';
}

export function extractEdgeFormatKey(req: Request, pathname: string): 'md' | 'html' {
  if (pathname.endsWith('.md')) return 'md';
  const accept = (req.headers.get('accept') || '').toLowerCase();
  if (accept.includes('text/markdown') && !accept.includes('text/html')) {
    return 'md';
  }
  return 'html';
}

export function isPublicEdgeCacheableRequest(req: Request, env: WorkerEnv): boolean {
  if (env.__TEST_DB__) return false;
  if (req.method !== 'GET') return false;
  if (req.headers.has('if-none-match')) return false;

  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    return false;
  }

  // Only cache clean canonical URLs without query strings (never cache ?q= searches)
  if (url.search) return false;

  const path = url.pathname;
  if (path.startsWith('/admin') || path.startsWith('/api/')) return false;
  if (EXACT_CACHEABLE_PATHS.has(path)) return true;
  return PREFIX_CACHEABLE_PATHS.some((prefix) => path.startsWith(prefix));
}

export function buildEdgeCacheKey(
  rawUrl: string,
  theme: EdgeCacheTheme,
  format: 'md' | 'html',
): Request {
  const url = new URL(rawUrl);
  url.search = '';
  url.searchParams.set('_pyv_t', theme);
  url.searchParams.set('_pyv_f', format);
  return new Request(url.toString(), { method: 'GET' });
}

export function getDefaultEdgeCache(): Cache | null {
  try {
    if (typeof caches !== 'undefined' && caches && 'default' in caches) {
      return (caches as unknown as { default: Cache }).default;
    }
  } catch {
    // Unavailable outside Cloudflare Workers runtime (e.g. unit tests)
  }
  return null;
}

export function isCacheablePublicResponse(res: Response): boolean {
  if (res.status !== 200) return false;
  if (res.headers.has('set-cookie')) return false;
  const cc = (res.headers.get('cache-control') || '').toLowerCase();
  if (!cc.includes('public') || cc.includes('no-store') || cc.includes('private')) {
    return false;
  }
  return true;
}

export async function purgePublicEdgeCache(
  baseUrlInput: string | undefined,
  opts?: { slug?: string; categorySlug?: string },
): Promise<void> {
  const cache = getDefaultEdgeCache();
  if (!cache) return;

  const baseUrl = normalizeBaseUrl(baseUrlInput);
  const paths = new Set<string>([
    '/',
    '/blog',
    '/rss.xml',
    '/sitemap.xml',
    '/llms.txt',
    '/llms-full.txt',
    '/feed.json',
    '/about',
    '/editorial-policy',
  ]);

  if (opts?.slug) {
    const encoded = encodeURIComponent(opts.slug);
    paths.add(`/blog/${encoded}`);
    paths.add(`/blog/${encoded}.md`);
  }
  if (opts?.categorySlug) {
    paths.add(`/category/${encodeURIComponent(opts.categorySlug)}`);
  }

  const deletions: Promise<boolean>[] = [];
  for (const path of paths) {
    const fullUrl = `${baseUrl}${path}`;
    const formats: Array<'html' | 'md'> =
      path.startsWith('/blog/') && !path.endsWith('.md') ? ['html', 'md'] : [path.endsWith('.md') ? 'md' : 'html'];
    const themes: readonly EdgeCacheTheme[] =
      path.endsWith('.xml') || path.endsWith('.txt') || path.endsWith('.json') || path.endsWith('.md')
        ? ['auto']
        : CACHE_THEMES;

    for (const format of formats) {
      for (const theme of themes) {
        deletions.push(cache.delete(buildEdgeCacheKey(fullUrl, theme, format)).catch(() => false));
      }
    }
  }

  await Promise.allSettled(deletions);
}
