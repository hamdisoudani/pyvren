import { Hono } from 'hono';
import { normalizeBaseUrl, type WorkerEnv } from '../env';
import { createDatabase } from '../lib/db';
import { checkRateLimit, extractClientIp } from '../lib/security';
import type { Archetype, CategorySkill, PostRecord } from '../types';

const VALID_ARCHETYPES: ReadonlySet<Archetype> = new Set([
  'advisory-teardown',
  'benchmark-index',
  'migration-fix-log',
  'architecture-analysis',
]);

function withPublicUrls(post: PostRecord, baseUrl: string) {
  return {
    ...post,
    keywords_json: Array.isArray(post.keywords_json) ? post.keywords_json : [],
    canonical_url: `${baseUrl}/blog/${post.slug}`,
    markdown_url: `${baseUrl}/blog/${post.slug}.md`,
  };
}

function toSearchHit(post: PostRecord, baseUrl: string) {
  return {
    slug: post.slug,
    title: post.title,
    description: post.description,
    tldr_summary: post.tldr_summary,
    category_slug: post.category_slug,
    archetype: post.archetype,
    author: post.author,
    reading_time_minutes: post.reading_time_minutes,
    published_at: post.published_at,
    cover_image_url: post.cover_image_url,
    cover_image_alt: post.cover_image_alt,
    tags: post.tags_json.slice(0, 5),
    url: `/blog/${post.slug}`,
    canonical_url: `${baseUrl}/blog/${post.slug}`,
    markdown_url: `${baseUrl}/blog/${post.slug}.md`,
  };
}

function toPublicSkill(skill: CategorySkill, baseUrl: string) {
  return {
    id: skill.id,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    priority: skill.priority,
    target_audience: skill.target_audience,
    preferred_archetypes_json: skill.preferred_archetypes_json,
    required_sections_json: skill.required_sections_json,
    url: `${baseUrl}/category/${skill.slug}`,
    updated_at: skill.updated_at,
  };
}

export function createHeadlessRoutes(): Hono<{ Bindings: WorkerEnv }> {
  const app = new Hono<{ Bindings: WorkerEnv }>();

  // CORS headers for all public Headless v1 API endpoints
  app.use('/api/v1/*', async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    await next();
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
  });

  app.get('/api/v1/health', (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json({
      ok: true,
      service: 'pyvren',
      runtime: 'cloudflare-workers',
      timestamp: new Date().toISOString(),
    });
  });

  // Rate-limited instant search endpoint for human live-search UI & AI agents
  app.get('/api/v1/search', async (c) => {
    const rl = checkRateLimit(`search:${extractClientIp(c.req.raw)}`, 30, 60_000);
    c.header('X-RateLimit-Remaining', String(rl.remaining));
    if (!rl.allowed) {
      c.header('Retry-After', String(rl.retryAfterSeconds));
      c.header('Cache-Control', 'no-store');
      return c.json(
        {
          error: 'Search rate limit exceeded. Please wait briefly before searching again.',
          retry_after_seconds: rl.retryAfterSeconds,
        },
        429,
      );
    }

    const rawQ = (c.req.query('q') || '').trim().slice(0, 160);
    const category = (c.req.query('category') || '').trim() || undefined;
    const rawLimit = Number.parseInt(c.req.query('limit') || '10', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(25, Math.max(1, rawLimit)) : 10;

    if (!rawQ) {
      c.header('Cache-Control', 'no-store');
      return c.json({
        query: '',
        results: [],
        total: 0,
        limit,
      });
    }

    const db = createDatabase(c.env);
    const [settings, matched] = await Promise.all([
      db.getSettings(),
      db.listPosts({
        status: 'published',
        category_slug: category,
        search: rawQ,
        limit: 100,
        offset: 0,
        excludeHeavyHtml: true,
      }),
    ]);

    const baseUrl = normalizeBaseUrl(settings.base_url || c.env.BASE_URL);
    const published = matched.filter((p) => p.status === 'published');
    const results = published.slice(0, limit).map((p) => toSearchHit(p, baseUrl));

    c.header('Cache-Control', 'public, max-age=30, s-maxage=120');
    return c.json({
      query: rawQ,
      results,
      total: published.length,
      limit,
    });
  });

  // Structured machine navigation map specifically designed for AI agents & crawlers
  app.get('/api/v1/map', async (c) => {
    const db = createDatabase(c.env);
    const [settings, skills, recentRaw] = await Promise.all([
      db.getSettings(),
      db.listSkills(true),
      db.listPosts({ status: 'published', limit: 25, excludeHeavyHtml: true }),
    ]);

    const baseUrl = normalizeBaseUrl(settings.base_url || c.env.BASE_URL);
    const published = recentRaw.filter((p) => p.status === 'published');

    c.header('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=3600');
    return c.json({
      publication: {
        name: settings.site_name,
        tagline: settings.site_tagline,
        author: settings.default_author,
        collaboration: `Co-crafted by ${settings.default_author} & Pyvren`,
        linkedin_url: 'https://www.linkedin.com/in/hamdisoudani/',
        url: baseUrl,
      },
      agent_navigation: {
        llms_txt: `${baseUrl}/llms.txt`,
        llms_full_txt: `${baseUrl}/llms-full.txt`,
        posts_api: `${baseUrl}/api/v1/posts`,
        search_api: `${baseUrl}/api/v1/search?q={query}`,
        markdown_mirror_pattern: `${baseUrl}/blog/{slug}.md`,
        content_negotiation: 'Send Accept: text/markdown to any /blog/{slug} URL',
        rss_xml: `${baseUrl}/rss.xml`,
        json_feed: `${baseUrl}/feed.json`,
        sitemap_xml: `${baseUrl}/sitemap.xml`,
      },
      categories: skills
        .filter((s) => s.enabled)
        .map((s) => ({
          slug: s.slug,
          name: s.name,
          description: s.description,
          url: `${baseUrl}/category/${s.slug}`,
          api_url: `${baseUrl}/api/v1/posts?category=${encodeURIComponent(s.slug)}`,
        })),
      recent_posts: published.map((p) => ({
        slug: p.slug,
        title: p.title,
        description: p.description,
        tldr_summary: p.tldr_summary,
        category_slug: p.category_slug,
        archetype: p.archetype,
        quality_score: p.quality_score,
        reading_time_minutes: p.reading_time_minutes,
        published_at: p.published_at,
        canonical_url: `${baseUrl}/blog/${p.slug}`,
        markdown_url: `${baseUrl}/blog/${p.slug}.md`,
      })),
    });
  });

  app.get('/api/v1/posts', async (c) => {
    const db = createDatabase(c.env);
    const category = (c.req.query('category') || '').trim() || undefined;
    const archetypeRaw = (c.req.query('archetype') || '').trim();
    const archetype = VALID_ARCHETYPES.has(archetypeRaw as Archetype)
      ? (archetypeRaw as Archetype)
      : undefined;
    const q = (c.req.query('q') || '').trim().slice(0, 160) || undefined;

    if (q) {
      const rl = checkRateLimit(`search:${extractClientIp(c.req.raw)}`, 30, 60_000);
      c.header('X-RateLimit-Remaining', String(rl.remaining));
      if (!rl.allowed) {
        c.header('Retry-After', String(rl.retryAfterSeconds));
        c.header('Cache-Control', 'no-store');
        return c.json(
          {
            error: 'Search rate limit exceeded. Please wait briefly before searching again.',
            retry_after_seconds: rl.retryAfterSeconds,
          },
          429,
        );
      }
    }

    const rawLimit = Number.parseInt(c.req.query('limit') || '20', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(50, Math.max(1, rawLimit)) : 20;

    const rawOffset = Number.parseInt(c.req.query('offset') || '0', 10);
    const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

    const settings = await db.getSettings();
    const baseUrl = normalizeBaseUrl(settings.base_url || c.env.BASE_URL);

    let posts: PostRecord[];
    let total: number;

    if (archetype || q) {
      // Fetch matching published posts to accurately filter & compute total
      const matched = await db.listPosts({
        status: 'published',
        category_slug: category,
        search: q,
        limit: 500,
        offset: 0,
      });

      const filtered = matched.filter((post) => {
        if (post.status !== 'published') return false;
        if (archetype && post.archetype !== archetype) return false;
        return true;
      });

      total = filtered.length;
      posts = filtered.slice(offset, offset + limit);
    } else {
      const [rows, count] = await Promise.all([
        db.listPosts({
          status: 'published',
          category_slug: category,
          limit,
          offset,
        }),
        db.countPosts({
          status: 'published',
          category_slug: category,
        }),
      ]);
      posts = rows.filter((post) => post.status === 'published');
      total = count;
    }

    c.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800');
    return c.json({
      posts: posts.map((post) => withPublicUrls(post, baseUrl)),
      total,
      limit,
      offset,
    });
  });

  app.get('/api/v1/posts/:slug', async (c) => {
    const slug = (c.req.param('slug') || '').trim();
    if (!slug) {
      return c.json({ error: 'Post not found' }, 404);
    }

    const db = createDatabase(c.env);
    const [settings, post] = await Promise.all([db.getSettings(), db.getPostBySlug(slug, true)]);

    if (!post || post.status !== 'published') {
      c.header('Cache-Control', 'no-store');
      return c.json({ error: 'Post not found' }, 404);
    }

    const baseUrl = normalizeBaseUrl(settings.base_url || c.env.BASE_URL);
    c.header('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=3600');
    return c.json(withPublicUrls(post, baseUrl));
  });

  // Explicitly block any write attempts on the public read-only posts API
  for (const path of ['/api/v1/posts', '/api/v1/posts/*'] as const) {
    app.on(['POST', 'PUT', 'PATCH', 'DELETE'], path, (c) => {
      c.header('Allow', 'GET, HEAD, OPTIONS');
      c.header('Cache-Control', 'no-store');
      return c.json(
        {
          error:
            'Method Not Allowed: /api/v1/posts is strictly read-only. Only an authenticated admin can modify posts via /api/admin/posts.',
        },
        405,
      );
    });
  }

  const handlePublicSkills = async (c: { env: WorkerEnv; header: (name: string, value: string) => void; json: <T>(data: T) => Response }) => {
    const db = createDatabase(c.env);
    const [settings, skills] = await Promise.all([db.getSettings(), db.listSkills(true)]);
    const baseUrl = normalizeBaseUrl(settings.base_url || c.env.BASE_URL);
    const publicSkills = skills.filter((s) => s.enabled).map((s) => toPublicSkill(s, baseUrl));

    c.header('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=3600');
    return c.json({
      skills: publicSkills,
      categories: publicSkills,
      total: publicSkills.length,
    });
  };

  app.get('/api/v1/skills', (c) => handlePublicSkills(c));
  app.get('/api/v1/categories', (c) => handlePublicSkills(c));

  return app;
}
