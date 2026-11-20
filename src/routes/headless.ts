import { Hono } from 'hono';
import { normalizeBaseUrl, type WorkerEnv } from '../env';
import { createDatabase } from '../lib/db';
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

  app.get('/api/v1/posts', async (c) => {
    const db = createDatabase(c.env);
    const category = (c.req.query('category') || '').trim() || undefined;
    const archetypeRaw = (c.req.query('archetype') || '').trim();
    const archetype = VALID_ARCHETYPES.has(archetypeRaw as Archetype)
      ? (archetypeRaw as Archetype)
      : undefined;
    const q = (c.req.query('q') || '').trim() || undefined;

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
