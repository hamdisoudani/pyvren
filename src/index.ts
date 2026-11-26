import { Hono } from 'hono';
import type { WorkerEnv } from './env';
import { runEditorialAgentDirect } from './lib/agent';
import {
  countPostsByCategoryInLastHours,
  countPostsCreatedInLastHours,
  createDatabase,
  DEFAULT_SEEDED_SETTINGS,
  recoverStaleAndFindActiveRun,
} from './lib/db';
import {
  buildEdgeCacheKey,
  extractEdgeFormatKey,
  extractEdgeThemeKey,
  getDefaultEdgeCache,
  isCacheablePublicResponse,
  isPublicEdgeCacheableRequest,
} from './lib/edge-cache';
import { buildSecurityHeaders } from './lib/security';
import { runScheduledSyndicationSweep } from './lib/syndicate';
import { getTurnstileSiteKey } from './lib/turnstile';
import { createAdminRoutes } from './routes/admin';
import { createHeadlessRoutes } from './routes/headless';
import { createPublicRoutes } from './routes/public';
import { createSeoRoutes } from './routes/seo';
import type { AgentDispatchPayload, SiteSettings } from './types';
import { renderAdminSpaHtml } from './ui/admin-spa';
import { renderNotFoundPage } from './ui/pages';

export { EditorialAgentWorkflow } from './workflows/agent-workflow';

export function shouldExecuteScheduledDiscovery(
  settings: SiteSettings,
  now: Date,
  postsLast24h: number,
  hasActiveRun: boolean,
  enabledCategoryCount = 1,
): { shouldRun: boolean; reason: string } {
  if (!settings.schedule_enabled) {
    return { shouldRun: false, reason: 'schedule_disabled' };
  }

  if (hasActiveRun) {
    return { shouldRun: false, reason: 'active_run_in_progress' };
  }

  const maxPostsPerCategory = Math.max(1, settings.max_posts_per_day || 2);
  const totalDailyCap = maxPostsPerCategory * Math.max(1, enabledCategoryCount);
  if (postsLast24h >= totalDailyCap) {
    return { shouldRun: false, reason: 'daily_post_cap_reached' };
  }

  const nowMs = now.getTime();
  let elapsedMs: number | null = null;
  if (settings.last_scheduled_run_at) {
    const lastRunMs = new Date(settings.last_scheduled_run_at).getTime();
    if (Number.isFinite(lastRunMs)) {
      elapsedMs = nowMs - lastRunMs;
      // Prevent double-firing within the same 45-minute window
      if (elapsedMs < 45 * 60 * 1000) {
        return { shouldRun: false, reason: 'recent_scheduled_run_cooldown' };
      }
    }
  }

  if (
    Array.isArray(settings.preferred_hours_utc_json) &&
    settings.preferred_hours_utc_json.length > 0
  ) {
    if (!settings.preferred_hours_utc_json.includes(now.getUTCHours())) {
      return { shouldRun: false, reason: 'outside_preferred_utc_hour' };
    }
  } else {
    const runsPerDay = Math.max(1, Math.min(24, settings.runs_per_day || 3));
    const intervalHours = 24 / runsPerDay;
    if (elapsedMs !== null) {
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      // 5-minute tolerance so slightly early cron ticks still execute on schedule
      if (elapsedHours < intervalHours - 0.08) {
        return { shouldRun: false, reason: 'interval_not_elapsed' };
      }
    }
  }

  return { shouldRun: true, reason: 'scheduled_slot_matched' };
}

export function createApp(): Hono<{ Bindings: WorkerEnv }> {
  const app = new Hono<{ Bindings: WorkerEnv }>();

  // 1. Canonical HTTPS + www -> apex 301 redirect in production
  app.use('*', async (c, next) => {
    if (c.env.ENVIRONMENT !== 'test') {
      try {
        const reqUrl = new URL(c.req.url);
        const host = reqUrl.hostname.toLowerCase();
        if (host === 'www.pyvren.com' || (host === 'pyvren.com' && reqUrl.protocol === 'http:')) {
          reqUrl.protocol = 'https:';
          reqUrl.hostname = 'pyvren.com';
          return new Response(null, {
            status: 301,
            headers: {
              Location: reqUrl.toString(),
              'Cache-Control': 'public, max-age=86400',
              ...buildSecurityHeaders(),
            },
          });
        }
      } catch {
        // Proceed normally if URL parsing fails
      }
    }
    await next();
  });

  // 2. Global security headers middleware
  app.use('*', async (c, next) => {
    await next();
    const secHeaders = buildSecurityHeaders({
      allowSameOriginFrame: c.req.path.startsWith('/api/admin/preview/'),
    });
    for (const [name, value] of Object.entries(secHeaders)) {
      c.header(name, value);
    }
  });

  // 3. Cloudflare Edge Cache for public anonymous GET routes (theme- & format-aware)
  app.use('*', async (c, next) => {
    const edgeCache = getDefaultEdgeCache();
    if (!edgeCache || !isPublicEdgeCacheableRequest(c.req.raw, c.env)) {
      await next();
      return;
    }

    const pathname = c.req.path;
    const themeKey = extractEdgeThemeKey(c.req.raw, pathname);
    const formatKey = extractEdgeFormatKey(c.req.raw, pathname);
    const cacheKey = buildEdgeCacheKey(c.req.url, themeKey, formatKey);

    try {
      const cached = await edgeCache.match(cacheKey);
      if (cached) {
        const hitHeaders = new Headers(cached.headers);
        hitHeaders.set('X-Pyvren-Cache', 'HIT');
        return new Response(cached.body, {
          status: cached.status,
          statusText: cached.statusText,
          headers: hitHeaders,
        });
      }
    } catch {
      // Fall through to origin render if cache match fails
    }

    await next();

    const originRes = c.res;
    if (originRes && isCacheablePublicResponse(originRes)) {
      // Clone before setting MISS header so cached copy carries clean headers
      const toCache = originRes.clone();
      const cacheHeaders = new Headers(toCache.headers);
      cacheHeaders.delete('X-Pyvren-Cache');
      const cacheableCopy = new Response(toCache.body, {
        status: toCache.status,
        statusText: toCache.statusText,
        headers: cacheHeaders,
      });

      try {
        c.executionCtx.waitUntil(edgeCache.put(cacheKey, cacheableCopy).catch(() => undefined));
      } catch {
        // Safe fallback when ExecutionContext is absent
        void edgeCache.put(cacheKey, cacheableCopy).catch(() => undefined);
      }
      c.header('X-Pyvren-Cache', 'MISS');
    }
  });

  // Register ALL API, SEO, and Public SSR routes FIRST (strict precedence order)
  app.route('/', createSeoRoutes());
  app.route('/', createHeadlessRoutes());
  app.route('/', createAdminRoutes());
  app.route('/', createPublicRoutes());

  // Static assets fallback when reached by Worker runtime
  app.get('/assets/*', async (c) => {
    if (c.env.ASSETS) {
      const assetRes = await c.env.ASSETS.fetch(c.req.raw);
      return new Response(assetRes.body, assetRes);
    }
    return c.text('Asset not found', 404);
  });

  // Admin SPA registered LAST with strict noindex & no-store headers
  const serveAdminSpa = async (c: { env: WorkerEnv; req: { path: string; raw: Request } }) => {
    const db = createDatabase(c.env);
    const settings = await db.getSettings();
    const cookieHeader = c.req.raw.headers.get('cookie') || '';
    const themeMatch = /(?:^|;\s*)pyvren_theme=(dark|light)(?:;|$)/i.exec(cookieHeader);
    const initialTheme = themeMatch
      ? (themeMatch[1].toLowerCase() as 'dark' | 'light')
      : undefined;
    const turnstileSiteKey = getTurnstileSiteKey(c.env);
    const html = renderAdminSpaHtml(settings, initialTheme, turnstileSiteKey);
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'no-store',
        ...buildSecurityHeaders({
          allowSameOriginFrame: c.req.path.startsWith('/api/admin/preview/'),
        }),
      },
    });
  };

  app.get('/admin', (c) => serveAdminSpa(c));
  app.get('/admin/*', (c) => serveAdminSpa(c));

  // Real HTTP 404 handler (JSON for /api/*, SSR 404 page for everything else)
  app.notFound(async (c) => {
    const secHeaders = buildSecurityHeaders({
      allowSameOriginFrame: c.req.path.startsWith('/api/admin/preview/'),
    });

    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: 'Not found' }, 404, {
        'Cache-Control': 'no-store',
        ...secHeaders,
      });
    }

    let settings = DEFAULT_SEEDED_SETTINGS;
    try {
      const db = createDatabase(c.env);
      settings = await db.getSettings();
    } catch {
      // Fall back to default site settings when rendering 404
    }

    const html = renderNotFoundPage({ settings });
    return new Response(html, {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        ...secHeaders,
      },
    });
  });

  return app;
}

const app = createApp();

const worker: ExportedHandler<WorkerEnv> = {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    const db = createDatabase(env);
    const settings = await db.getSettings();

    const scheduledMs =
      typeof controller?.scheduledTime === 'number' && Number.isFinite(controller.scheduledTime)
        ? controller.scheduledTime
        : Date.now();
    const now = new Date(scheduledMs);

    // Run delayed distribution / syndication sweep independently of autonomous drafting schedule
    if (settings.syndication_enabled) {
      try {
        await runScheduledSyndicationSweep(db, env, now);
      } catch {
        // Best-effort syndication sweep; never block scheduled editorial discovery
      }
    }

    if (!settings.schedule_enabled) {
      return;
    }

    const [activeRun, postsLast24h, categoryCountsLast24h, allSkills] = await Promise.all([
      recoverStaleAndFindActiveRun(db),
      countPostsCreatedInLastHours(db, 24),
      countPostsByCategoryInLastHours(db, 24),
      db.listSkills(true),
    ]);

    const enabledCategoryCount = Math.max(1, allSkills.length);
    const maxPostsPerCategory = Math.max(1, settings.max_posts_per_day || 2);
    const hasUncappedCategory =
      allSkills.length === 0 ||
      allSkills.some((s) => (categoryCountsLast24h[s.slug.toLowerCase()] || 0) < maxPostsPerCategory);

    if (!hasUncappedCategory) {
      return;
    }

    const decision = shouldExecuteScheduledDiscovery(
      settings,
      now,
      postsLast24h,
      activeRun !== null,
      enabledCategoryCount,
    );

    if (!decision.shouldRun) {
      return;
    }

    const nowIso = now.toISOString();
    await db.updateSettings({ last_scheduled_run_at: nowIso });

    const run = await db.createAgentRun({
      trigger_source: 'scheduled',
      category_slug: 'auto',
      topic: 'Scheduled autonomous briefing',
      archetype: 'auto',
      model_used: settings.openrouter_model,
      status: 'queued',
      current_stage: 'scheduled',
    });

    const payload: AgentDispatchPayload = {
      trigger_source: 'scheduled',
      run_id: run.id,
    };

    if (env.EDITORIAL_AGENT_WORKFLOW) {
      const instance = await env.EDITORIAL_AGENT_WORKFLOW.create({
        params: payload,
      });
      await db.updateAgentRun(run.id, {
        workflow_instance_id: instance.id,
        status: 'running',
        current_stage: 'workflow_dispatched',
      });
      return;
    }

    ctx.waitUntil(runEditorialAgentDirect(db, env, payload));
  },
};

export default worker;
