import { Hono } from 'hono';
import { normalizeBaseUrl, type WorkerEnv } from '../env';
import { createDatabase } from '../lib/db';
import { compileMarkdown } from '../lib/markdown';
import { computeEtag } from '../lib/security';
import type { PostRecord } from '../types';
import {
  renderBlogIndexPage,
  renderBlogPostPage,
  renderLandingPage,
  renderNotFoundPage,
  renderTrustPage,
} from '../ui/pages';
import { formatPostAsMarkdownDocument } from './seo';

const BLOG_PAGE_SIZE = 10;

function stripWeakEtagPrefix(tag: string): string {
  const trimmed = tag.trim();
  return trimmed.startsWith('W/') || trimmed.startsWith('w/') ? trimmed.slice(2).trim() : trimmed;
}

function isEtagMatching(ifNoneMatchHeader: string | undefined, currentEtag: string): boolean {
  if (!ifNoneMatchHeader) return false;
  const trimmed = ifNoneMatchHeader.trim();
  if (trimmed === '*') return true;
  const normalizedCurrent = stripWeakEtagPrefix(currentEtag);
  return trimmed
    .split(',')
    .map((candidate) => stripWeakEtagPrefix(candidate))
    .some((candidate) => candidate === normalizedCurrent);
}

function htmlResponse(html: string, status: number, headers: Record<string, string> = {}): Response {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...headers,
    },
  });
}

export function createPublicRoutes(): Hono<{ Bindings: WorkerEnv }> {
  const app = new Hono<{ Bindings: WorkerEnv }>();

  // 1. Landing Page
  app.get('/', async (c) => {
    const db = createDatabase(c.env);
    const [settings, skills, rawPosts] = await Promise.all([
      db.getSettings(),
      db.listSkills(true),
      db.listPosts({ status: 'published', limit: 7, excludeHeavyHtml: true }),
    ]);

    const publishedPosts = rawPosts.filter((p) => p.status === 'published');
    const featuredPost = publishedPosts[0] ?? null;
    const recentPosts = publishedPosts.slice(0, 7);

    const html = renderLandingPage({
      settings,
      featuredPost,
      recentPosts,
      skills,
    });

    return htmlResponse(html, 200, {
      'Cache-Control': 'public, max-age=120, s-maxage=600, stale-while-revalidate=3600',
    });
  });

  // 2. Blog Index Page (?category=, ?q=, ?page=)
  app.get('/blog', async (c) => {
    const db = createDatabase(c.env);
    const category = (c.req.query('category') || '').trim() || undefined;
    const query = (c.req.query('q') || '').trim() || undefined;
    const rawPage = Number.parseInt(c.req.query('page') || '1', 10);
    const requestedPage = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

    const [settings, skills] = await Promise.all([db.getSettings(), db.listSkills(true)]);

    let posts: PostRecord[];
    let totalCount: number;

    if (query) {
      const matched = await db.listPosts({
        status: 'published',
        category_slug: category,
        search: query,
        limit: 500,
        offset: 0,
        excludeHeavyHtml: true,
      });
      const publishedMatched = matched.filter((p) => p.status === 'published');
      totalCount = publishedMatched.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / BLOG_PAGE_SIZE));
      const safePage = Math.min(requestedPage, totalPages);
      const offset = (safePage - 1) * BLOG_PAGE_SIZE;
      posts = publishedMatched.slice(offset, offset + BLOG_PAGE_SIZE);

      const html = renderBlogIndexPage({
        settings,
        posts,
        skills,
        activeCategory: category,
        page: safePage,
        totalPages,
        query,
      });

      return htmlResponse(html, 200, {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800',
      });
    }

    totalCount = await db.countPosts({
      status: 'published',
      category_slug: category,
    });
    const totalPages = Math.max(1, Math.ceil(totalCount / BLOG_PAGE_SIZE));
    const safePage = Math.min(requestedPage, totalPages);
    const offset = (safePage - 1) * BLOG_PAGE_SIZE;

    const rows = await db.listPosts({
      status: 'published',
      category_slug: category,
      limit: BLOG_PAGE_SIZE,
      offset,
      excludeHeavyHtml: true,
    });
    posts = rows.filter((p) => p.status === 'published');

    const html = renderBlogIndexPage({
      settings,
      posts,
      skills,
      activeCategory: category,
      page: safePage,
      totalPages,
      query,
    });

    return htmlResponse(html, 200, {
      'Cache-Control': 'public, max-age=120, s-maxage=600, stale-while-revalidate=3600',
    });
  });

  // 3. Category Page (real HTTP 404 if category skill does not exist)
  app.get('/category/:slug', async (c) => {
    const slug = (c.req.param('slug') || '').trim();
    const db = createDatabase(c.env);
    const [settings, skill, skills] = await Promise.all([
      db.getSettings(),
      db.getSkillBySlug(slug),
      db.listSkills(true),
    ]);

    if (!skill || !skill.enabled) {
      const html = renderNotFoundPage({ settings });
      return htmlResponse(html, 404, {
        'Cache-Control': 'no-store',
      });
    }

    const query = (c.req.query('q') || '').trim() || undefined;
    const rawPage = Number.parseInt(c.req.query('page') || '1', 10);
    const requestedPage = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;

    let posts: PostRecord[];
    let totalPages: number;
    let safePage: number;

    if (query) {
      const matched = await db.listPosts({
        status: 'published',
        category_slug: skill.slug,
        search: query,
        limit: 500,
        offset: 0,
        excludeHeavyHtml: true,
      });
      const publishedMatched = matched.filter((p) => p.status === 'published');
      totalPages = Math.max(1, Math.ceil(publishedMatched.length / BLOG_PAGE_SIZE));
      safePage = Math.min(requestedPage, totalPages);
      const offset = (safePage - 1) * BLOG_PAGE_SIZE;
      posts = publishedMatched.slice(offset, offset + BLOG_PAGE_SIZE);
    } else {
      const totalCount = await db.countPosts({
        status: 'published',
        category_slug: skill.slug,
      });
      totalPages = Math.max(1, Math.ceil(totalCount / BLOG_PAGE_SIZE));
      safePage = Math.min(requestedPage, totalPages);
      const offset = (safePage - 1) * BLOG_PAGE_SIZE;
      const rows = await db.listPosts({
        status: 'published',
        category_slug: skill.slug,
        limit: BLOG_PAGE_SIZE,
        offset,
        excludeHeavyHtml: true,
      });
      posts = rows.filter((p) => p.status === 'published');
    }

    const html = renderBlogIndexPage({
      settings,
      posts,
      skills,
      activeCategory: skill.slug,
      page: safePage,
      totalPages,
      query,
    });

    return htmlResponse(html, 200, {
      'Cache-Control': 'public, max-age=120, s-maxage=600, stale-while-revalidate=3600',
    });
  });

  // 4. Single Published Blog Post Page (strictly published only; 404 for drafts/missing; ETag/304 + Markdown negotiation)
  app.get('/blog/:slug', async (c) => {
    const slug = (c.req.param('slug') || '').trim();
    const db = createDatabase(c.env);
    const [settings, post] = await Promise.all([db.getSettings(), db.getPostBySlug(slug, true)]);

    if (!post || post.status !== 'published') {
      const html = renderNotFoundPage({ settings });
      return htmlResponse(html, 404, {
        'Cache-Control': 'no-store',
      });
    }

    const baseUrl = normalizeBaseUrl(settings.base_url || c.env.BASE_URL);
    const encodedSlug = encodeURIComponent(post.slug);
    const linkHeader = `<${baseUrl}/blog/${encodedSlug}.md>; rel="alternate"; type="text/markdown", <${baseUrl}/blog/${encodedSlug}>; rel="canonical"`;
    const varyHeader = 'Accept, Accept-Encoding';
    const accept = (c.req.header('accept') || '').toLowerCase();
    const wantsMarkdown = accept.includes('text/markdown') && !accept.includes('text/html');

    const etag = await computeEtag([
      post.slug,
      post.updated_at,
      settings.updated_at,
      wantsMarkdown ? 'md' : 'html',
    ]);
    const cacheControl = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

    if (isEtagMatching(c.req.header('if-none-match'), etag)) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          Vary: varyHeader,
          Link: linkHeader,
          'Cache-Control': cacheControl,
        },
      });
    }

    if (wantsMarkdown) {
      const markdown = formatPostAsMarkdownDocument(post, settings, baseUrl);
      return new Response(markdown, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          ETag: etag,
          Vary: varyHeader,
          Link: linkHeader,
          'Cache-Control': cacheControl,
        },
      });
    }

    const [skill, sameCategoryPosts] = await Promise.all([
      db.getSkillBySlug(post.category_slug),
      db.listPosts({
        status: 'published',
        category_slug: post.category_slug,
        limit: 4,
        excludeHeavyHtml: true,
      }),
    ]);

    let relatedPosts = sameCategoryPosts
      .filter((candidate) => candidate.status === 'published' && candidate.id !== post.id)
      .slice(0, 3);

    if (relatedPosts.length < 3) {
      const fallbackPosts = await db.listPosts({
        status: 'published',
        limit: 6,
        excludeHeavyHtml: true,
      });
      const seenIds = new Set<number>([post.id, ...relatedPosts.map((p) => p.id)]);
      for (const candidate of fallbackPosts) {
        if (candidate.status === 'published' && !seenIds.has(candidate.id)) {
          relatedPosts.push(candidate);
          seenIds.add(candidate.id);
          if (relatedPosts.length >= 3) break;
        }
      }
    }

    const { headings } = compileMarkdown(post.body_markdown);
    const html = renderBlogPostPage({
      settings,
      post,
      skill,
      relatedPosts,
      headings,
    });

    return htmlResponse(html, 200, {
      ETag: etag,
      Vary: varyHeader,
      Link: linkHeader,
      'Cache-Control': cacheControl,
    });
  });

  // 5. Trust & Compliance Pages
  const trustKinds: Array<'about' | 'privacy' | 'contact' | 'editorial-policy'> = [
    'about',
    'privacy',
    'contact',
    'editorial-policy',
  ];

  for (const kind of trustKinds) {
    app.get(`/${kind}`, async (c) => {
      const db = createDatabase(c.env);
      const settings = await db.getSettings();
      const html = renderTrustPage({ settings, kind });
      return htmlResponse(html, 200, {
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      });
    });
  }

  return app;
}
