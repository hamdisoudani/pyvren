import { Hono } from 'hono';
import type { WorkerEnv } from './env';
import { runEditorialAgentDirect } from './lib/agent';
import { createDatabase, DEFAULT_SEEDED_SETTINGS } from './lib/db';
import { createAdminRoutes } from './routes/admin';
import { createHeadlessRoutes } from './routes/headless';
import { createPublicRoutes } from './routes/public';
import { createSeoRoutes } from './routes/seo';
import type { AgentDispatchPayload } from './types';
import { renderAdminSpaHtml } from './ui/admin-spa';
import { renderNotFoundPage } from './ui/pages';

export { EditorialAgentWorkflow } from './workflows/agent-workflow';

export function createApp(): Hono<{ Bindings: WorkerEnv }> {
  const app = new Hono<{ Bindings: WorkerEnv }>();

  // Global security headers middleware
  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  });

  // Register ALL API, SEO, and Public SSR routes FIRST (strict precedence order)
  app.route('/', createSeoRoutes());
  app.route('/', createHeadlessRoutes());
  app.route('/', createAdminRoutes());
  app.route('/', createPublicRoutes());

  // Static assets fallback when reached by Worker runtime
  app.get('/assets/*', async (c) => {
    if (c.env.ASSETS) {
      return c.env.ASSETS.fetch(c.req.raw);
    }
    return c.text('Asset not found', 404);
  });

  // Admin SPA registered LAST with strict noindex & no-store headers
  const serveAdminSpa = async (c: { env: WorkerEnv }) => {
    const db = createDatabase(c.env);
    const settings = await db.getSettings();
    const html = renderAdminSpaHtml(settings);
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      },
    });
  };

  app.get('/admin', (c) => serveAdminSpa(c));
  app.get('/admin/*', (c) => serveAdminSpa(c));

  // Real HTTP 404 handler (JSON for /api/*, SSR 404 page for everything else)
  app.notFound(async (c) => {
    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: 'Not found' }, 404, {
        'Cache-Control': 'no-store',
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
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
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

  async scheduled(_controller, env, ctx) {
    const db = createDatabase(env);
    const settings = await db.getSettings();

    if (!settings.schedule_enabled) {
      return;
    }

    const runsPerDay = Math.max(1, Math.min(24, settings.runs_per_day || 3));
    const intervalHours = 24 / runsPerDay;

    if (settings.last_scheduled_run_at) {
      const lastRunMs = new Date(settings.last_scheduled_run_at).getTime();
      if (Number.isFinite(lastRunMs)) {
        const elapsedHours = (Date.now() - lastRunMs) / (1000 * 60 * 60);
        // 5-minute tolerance so slightly early cron ticks still execute on schedule
        if (elapsedHours < intervalHours - 0.08) {
          return;
        }
      }
    }

    const nowIso = new Date().toISOString();
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
