import { Hono } from 'hono';
import { z } from 'zod';
import { getSessionSecret, type WorkerEnv } from '../env';
import { runEditorialAgentDirect } from '../lib/agent';
import {
  buildClearSessionCookie,
  buildSessionCookie,
  createSessionToken,
  hashPassword,
  isAdminAuthenticated,
  verifyPassword,
} from '../lib/auth';
import {
  createDatabase,
  ensureUniqueSlug,
  recoverStaleAndFindActiveRun,
} from '../lib/db';
import { lintPostPayload } from '../lib/linter';
import { compileMarkdown } from '../lib/markdown';
import { isFreeOpenRouterModel, listOpenRouterFreeModels } from '../lib/openrouter';
import {
  buildSecurityHeaders,
  checkRateLimit,
  constantTimeEqual,
  extractClientIp,
  slugify,
  verifyCsrfOrigin,
} from '../lib/security';
import type {
  AgentDispatchPayload,
  Archetype,
  FaqItem,
  KeyFact,
  PostStatus,
  SiteSettings,
} from '../types';
import { renderBlogPostPage } from '../ui/pages';

type AdminRouteEnv = {
  Bindings: WorkerEnv;
  Variables: {
    adminEmail: string;
  };
};

const ARCHETYPE_ENUM = z.enum([
  'advisory-teardown',
  'benchmark-index',
  'migration-fix-log',
  'architecture-analysis',
]);

const POST_STATUS_ENUM = z.enum(['draft', 'published']);

const KEY_FACT_SCHEMA = z.object({
  label: z.string().trim().min(1).max(160),
  value: z.string().trim().min(1).max(400),
  source_url: z.string().trim().url().optional().or(z.literal('')),
});

const FAQ_ITEM_SCHEMA = z.object({
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(1200),
});

const LOGIN_SCHEMA = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const SETTINGS_PATCH_SCHEMA = z.object({
  publishing_mode: z.enum(['draft_review', 'auto_publish']).optional(),
  min_publish_score: z.number().int().min(50).max(100).optional(),
  free_models_only: z.boolean().optional(),
  schedule_enabled: z.boolean().optional(),
  runs_per_day: z.number().int().min(1).max(24).optional(),
  preferred_hours_utc_json: z.array(z.number().int().min(0).max(23)).max(24).optional(),
  max_posts_per_day: z.number().int().min(1).max(24).optional(),
  min_novelty_score: z.number().int().min(0).max(100).optional(),
  openrouter_model: z.string().trim().min(1).max(200).optional(),
  judge_model: z.string().trim().min(1).max(200).optional(),
  default_topic_feed: z.string().trim().min(1).max(2000).optional(),
  default_author: z.string().trim().min(1).max(120).optional(),
  author_bio: z.string().trim().min(1).max(1000).optional(),
  site_name: z.string().trim().min(1).max(120).optional(),
  site_tagline: z.string().trim().min(1).max(500).optional(),
  base_url: z.string().trim().min(1).max(300).optional(),
  adsense_client_id: z.string().trim().max(100).nullable().optional(),
  cta_headline: z.string().trim().min(1).max(240).optional(),
  cta_body: z.string().trim().min(1).max(800).optional(),
  cta_url: z.string().trim().min(1).max(300).optional(),
  contact_email: z.string().trim().email().optional(),
});

const SKILL_UPSERT_SCHEMA = z.object({
  slug: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(600),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  target_audience: z.string().trim().min(1).max(400).optional(),
  system_instructions: z.string().trim().min(1).max(8000),
  research_feeds_json: z.array(z.string().trim().min(1)).optional(),
  search_queries_json: z.array(z.string().trim().min(1)).optional(),
  preferred_archetypes_json: z.array(ARCHETYPE_ENUM).optional(),
  required_sections_json: z.array(z.string().trim().min(1)).optional(),
  quality_rubric_json: z.record(z.unknown()).optional(),
  banned_patterns_json: z.array(z.string().trim().min(1)).optional(),
});

const SKILL_UPDATE_SCHEMA = SKILL_UPSERT_SCHEMA.partial();

const POST_IMAGE_SCHEMA = z.object({
  url: z.string().trim().url().max(1200),
  alt: z.string().trim().max(300).default(''),
  caption: z.string().trim().max(400).optional(),
  source_page_url: z.string().trim().url().optional().or(z.literal('')),
});

const POST_CREATE_SCHEMA = z.object({
  slug: z.string().trim().max(120).optional(),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(600),
  tldr_summary: z.string().trim().max(1000).optional(),
  cover_image_url: z.string().trim().max(1200).nullable().optional(),
  cover_image_alt: z.string().trim().max(300).nullable().optional(),
  images: z.array(POST_IMAGE_SCHEMA).optional(),
  images_json: z.array(POST_IMAGE_SCHEMA).optional(),
  key_facts: z.array(KEY_FACT_SCHEMA).optional(),
  key_facts_json: z.array(KEY_FACT_SCHEMA).optional(),
  faq: z.array(FAQ_ITEM_SCHEMA).optional(),
  faq_json: z.array(FAQ_ITEM_SCHEMA).optional(),
  body_markdown: z.string().min(1),
  author: z.string().trim().max(120).optional(),
  category_slug: z.string().trim().min(1).max(80).optional(),
  archetype: ARCHETYPE_ENUM,
  tags: z.array(z.string().trim().min(1)).optional(),
  tags_json: z.array(z.string().trim().min(1)).optional(),
  keywords: z.array(z.string().trim().min(1)).optional(),
  keywords_json: z.array(z.string().trim().min(1)).optional(),
  sources: z.array(z.string().trim().min(1)).optional(),
  sources_json: z.array(z.string().trim().min(1)).optional(),
  review_notes: z.array(z.string().trim().min(1)).optional(),
  review_notes_json: z.array(z.string().trim().min(1)).optional(),
  status: POST_STATUS_ENUM.nullable().optional(),
});

const POST_UPDATE_SCHEMA = POST_CREATE_SCHEMA.partial();

const POST_STATUS_PATCH_SCHEMA = z.object({
  status: POST_STATUS_ENUM.optional(),
});

const LINT_DRY_RUN_SCHEMA = z.object({
  title: z.string().default(''),
  description: z.string().default(''),
  tldr_summary: z.string().optional(),
  key_facts: z.array(KEY_FACT_SCHEMA).optional(),
  key_facts_json: z.array(KEY_FACT_SCHEMA).optional(),
  faq: z.array(FAQ_ITEM_SCHEMA).optional(),
  faq_json: z.array(FAQ_ITEM_SCHEMA).optional(),
  body_markdown: z.string().default(''),
  author: z.string().optional(),
  category_slug: z.string().optional(),
  archetype: z.string().default('architecture-analysis'),
  sources: z.array(z.string()).optional(),
  sources_json: z.array(z.string()).optional(),
});

const AGENT_RUN_SCHEMA = z.object({
  topic: z.string().trim().max(400).optional(),
  category_slug: z.string().trim().max(80).optional(),
  archetype: z.union([ARCHETYPE_ENUM, z.literal('auto')]).optional(),
  model_override: z.string().trim().max(200).optional(),
  trigger_source: z.enum(['manual', 'scheduled', 'api']).optional(),
  force: z.boolean().optional(),
});

const UNAUTHENTICATED_ADMIN_PATHS = new Set([
  '/api/admin/auth/status',
  '/api/admin/auth/bootstrap',
  '/api/admin/auth/login',
  '/api/admin/auth/logout',
]);

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

interface LoginLockoutState {
  failedAttempts: number;
  lockedUntilMs: number | null;
}

const envLoginLockouts = new Map<string, LoginLockoutState>();

export function resetAdminLoginLockoutsForTests(): void {
  envLoginLockouts.clear();
}

function isSecureRequest(req: Request): boolean {
  const forwardedProto = req.headers.get('x-forwarded-proto');
  if (forwardedProto) {
    return forwardedProto.split(',')[0].trim().toLowerCase() === 'https';
  }
  try {
    return new URL(req.url).protocol === 'https:';
  } catch {
    return false;
  }
}

function parsePositiveInt(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw.trim())) return null;
  const num = Number.parseInt(raw.trim(), 10);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

function normalizeKeyFacts(items?: Array<{ label: string; value: string; source_url?: string }>): KeyFact[] {
  if (!items) return [];
  return items.map((item) => ({
    label: item.label,
    value: item.value,
    ...(item.source_url ? { source_url: item.source_url } : {}),
  }));
}

function normalizeFaq(items?: Array<{ question: string; answer: string }>): FaqItem[] {
  if (!items) return [];
  return items.map((item) => ({
    question: item.question,
    answer: item.answer,
  }));
}

async function parseJsonBody(req: Request): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    const text = await req.text();
    if (!text.trim()) {
      return { ok: true, data: {} };
    }
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

export function createAdminRoutes(): Hono<AdminRouteEnv> {
  const app = new Hono<AdminRouteEnv>();

  // Always mark admin API & admin SPA routes non-indexable and non-cacheable
  app.use('/api/admin/*', async (c, next) => {
    await next();
    c.header('X-Robots-Tag', 'noindex, nofollow');
    c.header('Cache-Control', 'no-store');
  });

  app.use('/admin', async (c, next) => {
    await next();
    c.header('X-Robots-Tag', 'noindex, nofollow');
    c.header('Cache-Control', 'no-store');
  });

  app.use('/admin/*', async (c, next) => {
    await next();
    c.header('X-Robots-Tag', 'noindex, nofollow');
    c.header('Cache-Control', 'no-store');
  });

  // Auth guard middleware for all protected /api/admin/* endpoints
  app.use('/api/admin/*', async (c, next) => {
    if (UNAUTHENTICATED_ADMIN_PATHS.has(c.req.path)) {
      await next();
      return;
    }

    const auth = await isAdminAuthenticated(c.req.raw, c.env);
    if (!auth.ok) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (auth.method === 'cookie' && MUTATING_METHODS.has(c.req.method.toUpperCase())) {
      const csrf = verifyCsrfOrigin(c.req.raw);
      if (!csrf.ok) {
        return c.json({ error: csrf.reason || 'CSRF validation failed' }, 403);
      }
    }

    c.set('adminEmail', auth.email || 'admin');
    await next();
  });

  // =========================================================================
  // Unauthenticated Auth Endpoints
  // =========================================================================

  app.get('/api/admin/auth/status', async (c) => {
    const auth = await isAdminAuthenticated(c.req.raw, c.env);

    return c.json({
      initialized: true,
      authenticated: auth.ok,
      ...(auth.email ? { email: auth.email } : {}),
      locked_mode: 'env_locked',
    });
  });

  app.post('/api/admin/auth/bootstrap', (c) => {
    return c.json(
      {
        error:
          'Registration and setup are permanently disabled. Admin access is locked to the configured owner account.',
      },
      403,
    );
  });

  app.post('/api/admin/auth/login', async (c) => {
    const csrf = verifyCsrfOrigin(c.req.raw);
    if (!csrf.ok) {
      return c.json({ error: csrf.reason || 'CSRF validation failed' }, 403);
    }

    const rl = checkRateLimit(`auth:${extractClientIp(c.req.raw)}`, 15, 60_000);
    if (!rl.allowed) {
      c.header('Retry-After', String(rl.retryAfterSeconds));
      return c.json(
        { error: 'Too many authentication attempts. Please try again later.' },
        429,
      );
    }

    const rawBody = await parseJsonBody(c.req.raw);
    if (!rawBody.ok) {
      return c.json({ error: 'Invalid JSON payload.' }, 400);
    }

    const parsed = LOGIN_SCHEMA.safeParse(rawBody.data);
    if (!parsed.success) {
      return c.json({ error: 'Invalid email or password.' }, 400);
    }

    const submittedEmail = parsed.data.email.trim().toLowerCase();
    const submittedPassword = parsed.data.password;
    const envEmail = (c.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const envPassword = c.env.ADMIN_PASSWORD || '';
    const hasEnvCredentials = envEmail.length > 0 && envPassword.length > 0;

    const db = createDatabase(c.env);
    const admin = await db.getAdminUser();

    const ownerEmail = hasEnvCredentials ? envEmail : (admin?.email || '').trim().toLowerCase();
    const emailMatchesOwner =
      ownerEmail.length > 0 && constantTimeEqual(submittedEmail, ownerEmail);

    const now = Date.now();
    const memLock = ownerEmail ? envLoginLockouts.get(ownerEmail) : undefined;
    const memLockedUntilMs =
      memLock?.lockedUntilMs && memLock.lockedUntilMs > now ? memLock.lockedUntilMs : null;
    if (memLock?.lockedUntilMs && memLock.lockedUntilMs <= now && ownerEmail) {
      envLoginLockouts.delete(ownerEmail);
    }

    const dbLockedRawMs = admin?.locked_until ? new Date(admin.locked_until).getTime() : NaN;
    const dbLockedUntilMs =
      Number.isFinite(dbLockedRawMs) && dbLockedRawMs > now ? dbLockedRawMs : null;
    const dbLockExpired = Number.isFinite(dbLockedRawMs) && dbLockedRawMs <= now;

    if (emailMatchesOwner) {
      const activeLockedUntilMs = Math.max(memLockedUntilMs || 0, dbLockedUntilMs || 0);
      if (activeLockedUntilMs > now) {
        const retrySecs = Math.max(1, Math.ceil((activeLockedUntilMs - now) / 1000));
        c.header('Retry-After', String(retrySecs));
        return c.json(
          {
            error: 'Account temporarily locked due to repeated failed attempts. Try again later.',
            locked_until: new Date(activeLockedUntilMs).toISOString(),
          },
          429,
        );
      }
    }

    const recordOwnerFailure = async (): Promise<void> => {
      if (!ownerEmail) return;
      const currentMem = envLoginLockouts.get(ownerEmail);
      const prevMemAttempts = currentMem?.failedAttempts || 0;
      const prevDbAttempts = admin && !dbLockExpired ? admin.failed_attempts || 0 : 0;
      const nextAttempts = Math.max(prevMemAttempts, prevDbAttempts) + 1;
      const nextLockedUntilMs =
        nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : null;

      envLoginLockouts.set(ownerEmail, {
        failedAttempts: nextAttempts,
        lockedUntilMs: nextLockedUntilMs,
      });

      if (admin) {
        await db.updateAdminLoginState({
          failed_attempts: nextAttempts,
          locked_until: nextLockedUntilMs ? new Date(nextLockedUntilMs).toISOString() : null,
        });
      }
    };

    if (hasEnvCredentials) {
      const passwordMatches = constantTimeEqual(submittedPassword, envPassword);

      if (!emailMatchesOwner || !passwordMatches) {
        await hashPassword(submittedPassword);
        if (emailMatchesOwner) {
          await recordOwnerFailure();
        }
        return c.json({ error: 'Invalid email or password.' }, 401);
      }

      envLoginLockouts.delete(envEmail);
      if (admin) {
        await db.updateAdminLoginState({
          failed_attempts: 0,
          locked_until: null,
          last_login_at: new Date().toISOString(),
        });
      }

      const settings = await db.getSettings();
      const displayName =
        (c.env.ADMIN_DISPLAY_NAME || '').trim() || settings.default_author || 'Hamdi Soudani';

      const token = await createSessionToken(
        {
          sub: '1',
          email: envEmail,
          displayName,
        },
        getSessionSecret(c.env),
      );

      c.header('Set-Cookie', buildSessionCookie(token, isSecureRequest(c.req.raw)));
      return c.json({
        ok: true,
        email: envEmail,
        display_name: displayName,
        token,
      });
    }

    // Fallback: verify against pre-seeded DB admin_users row via PBKDF2-SHA256
    if (!admin) {
      await hashPassword(submittedPassword);
      return c.json({ error: 'Invalid email or password.' }, 401);
    }

    let passwordMatches = false;
    if (!emailMatchesOwner) {
      await hashPassword(submittedPassword);
    } else {
      passwordMatches = await verifyPassword(
        submittedPassword,
        admin.password_salt,
        admin.password_hash,
      );
    }

    if (!emailMatchesOwner || !passwordMatches) {
      if (emailMatchesOwner) {
        await recordOwnerFailure();
      }
      return c.json({ error: 'Invalid email or password.' }, 401);
    }

    if (ownerEmail) {
      envLoginLockouts.delete(ownerEmail);
    }
    await db.updateAdminLoginState({
      failed_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    });

    const displayName = (c.env.ADMIN_DISPLAY_NAME || '').trim() || admin.display_name;
    const token = await createSessionToken(
      {
        sub: String(admin.id),
        email: admin.email,
        displayName,
      },
      getSessionSecret(c.env),
    );

    c.header('Set-Cookie', buildSessionCookie(token, isSecureRequest(c.req.raw)));
    return c.json({
      ok: true,
      email: admin.email,
      display_name: displayName,
      token,
    });
  });

  app.post('/api/admin/auth/logout', (c) => {
    const csrf = verifyCsrfOrigin(c.req.raw);
    if (!csrf.ok) {
      return c.json({ error: csrf.reason || 'CSRF validation failed' }, 403);
    }
    c.header('Set-Cookie', buildClearSessionCookie(isSecureRequest(c.req.raw)));
    return c.json({ ok: true });
  });

  // =========================================================================
  // Settings Endpoints
  // =========================================================================

  app.get('/api/admin/settings', async (c) => {
    const db = createDatabase(c.env);
    const settings = await db.getSettings();
    return c.json(settings);
  });

  app.get('/api/admin/openrouter/free-models', async (c) => {
    const db = createDatabase(c.env);
    const settings = await db.getSettings();
    const models = await listOpenRouterFreeModels(c.env, c.req.query('refresh') === '1');
    return c.json({
      free_models_only: settings.free_models_only,
      current_model: settings.openrouter_model,
      judge_model: settings.judge_model,
      models,
    });
  });

  app.put('/api/admin/settings', async (c) => {
    const rawBody = await parseJsonBody(c.req.raw);
    if (!rawBody.ok) {
      return c.json({ error: 'Invalid JSON payload.' }, 400);
    }

    const parsed = SETTINGS_PATCH_SCHEMA.safeParse(rawBody.data);
    if (!parsed.success) {
      return c.json({ error: 'Invalid settings update.', details: parsed.error.flatten() }, 400);
    }

    const patch: Partial<SiteSettings> = { ...parsed.data };
    if (patch.adsense_client_id === '') {
      patch.adsense_client_id = null;
    }

    const db = createDatabase(c.env);
    const existingSettings = await db.getSettings();
    const effectiveFreeModelsOnly =
      patch.free_models_only !== undefined
        ? patch.free_models_only
        : existingSettings.free_models_only;

    if (effectiveFreeModelsOnly) {
      if (
        (patch.openrouter_model !== undefined && !isFreeOpenRouterModel(patch.openrouter_model)) ||
        (patch.judge_model !== undefined && !isFreeOpenRouterModel(patch.judge_model))
      ) {
        return c.json(
          {
            error:
              'Free-models-only mode is enabled. Choose an OpenRouter :free model (or disable free_models_only first).',
          },
          400,
        );
      }
    }

    const updated = await db.updateSettings(patch);
    return c.json(updated);
  });

  // =========================================================================
  // Category Skills Endpoints
  // =========================================================================

  app.get('/api/admin/skills', async (c) => {
    const db = createDatabase(c.env);
    const skills = await db.listSkills(false);
    return c.json({ skills, total: skills.length });
  });

  app.post('/api/admin/skills', async (c) => {
    const rawBody = await parseJsonBody(c.req.raw);
    if (!rawBody.ok) {
      return c.json({ error: 'Invalid JSON payload.' }, 400);
    }

    const parsed = SKILL_UPSERT_SCHEMA.safeParse(rawBody.data);
    if (!parsed.success) {
      return c.json({ error: 'Invalid skill payload.', details: parsed.error.flatten() }, 400);
    }

    const normalizedSlug = slugify(parsed.data.slug || parsed.data.name, 70);
    if (!normalizedSlug) {
      return c.json({ error: 'Unable to derive a valid category slug.' }, 400);
    }

    const db = createDatabase(c.env);
    const saved = await db.upsertSkill({
      ...parsed.data,
      slug: normalizedSlug,
    });
    return c.json(saved, 201);
  });

  app.put('/api/admin/skills/:slug', async (c) => {
    const targetSlug = slugify(c.req.param('slug') || '', 70);
    if (!targetSlug) {
      return c.json({ error: 'Invalid skill slug.' }, 400);
    }

    const rawBody = await parseJsonBody(c.req.raw);
    if (!rawBody.ok) {
      return c.json({ error: 'Invalid JSON payload.' }, 400);
    }

    const parsed = SKILL_UPDATE_SCHEMA.safeParse(rawBody.data);
    if (!parsed.success) {
      return c.json({ error: 'Invalid skill update.', details: parsed.error.flatten() }, 400);
    }

    const db = createDatabase(c.env);
    const existing = await db.getSkillBySlug(targetSlug);

    const name = parsed.data.name ?? existing?.name;
    const description = parsed.data.description ?? existing?.description;
    const systemInstructions = parsed.data.system_instructions ?? existing?.system_instructions;

    if (!name || !description || !systemInstructions) {
      return c.json(
        { error: 'Creating a new skill requires name, description, and system_instructions.' },
        400,
      );
    }

    const saved = await db.upsertSkill({
      ...(existing ?? {}),
      ...parsed.data,
      slug: targetSlug,
      name,
      description,
      system_instructions: systemInstructions,
    });
    return c.json(saved);
  });

  app.delete('/api/admin/skills/:slug', async (c) => {
    const slug = (c.req.param('slug') || '').trim();
    if (!slug) {
      return c.json({ error: 'Invalid skill slug.' }, 400);
    }

    const db = createDatabase(c.env);
    const deleted = await db.deleteSkill(slug);
    if (!deleted) {
      return c.json({ error: 'Skill not found.' }, 404);
    }

    return c.json({ ok: true, slug });
  });

  // =========================================================================
  // Posts CRUD, Status Toggle, Preview, and Linter
  // =========================================================================

  app.get('/api/admin/posts', async (c) => {
    const db = createDatabase(c.env);
    const statusParam = (c.req.query('status') || '').trim();
    const status: PostStatus | undefined =
      statusParam === 'draft' || statusParam === 'published' ? statusParam : undefined;
    const category = (c.req.query('category') || '').trim() || undefined;
    const search = (c.req.query('q') || '').trim() || undefined;
    const rawLimit = Number.parseInt(c.req.query('limit') || '50', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, rawLimit)) : 50;
    const rawOffset = Number.parseInt(c.req.query('offset') || '0', 10);
    const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

    const [posts, total] = await Promise.all([
      db.listPosts({ status, category_slug: category, search, limit, offset }),
      db.countPosts({ status, category_slug: category }),
    ]);

    return c.json({ posts, total, limit, offset });
  });

  app.get('/api/admin/posts/:id', async (c) => {
    const id = parsePositiveInt(c.req.param('id'));
    if (!id) {
      return c.json({ error: 'Invalid post ID.' }, 400);
    }

    const db = createDatabase(c.env);
    const post = await db.getPostById(id);
    if (!post) {
      return c.json({ error: 'Post not found.' }, 404);
    }

    return c.json(post);
  });

  app.post('/api/admin/posts', async (c) => {
    const rawBody = await parseJsonBody(c.req.raw);
    if (!rawBody.ok) {
      return c.json({ error: 'Invalid JSON payload.' }, 400);
    }

    const parsed = POST_CREATE_SCHEMA.safeParse(rawBody.data);
    if (!parsed.success) {
      return c.json({ error: 'Invalid post payload.', details: parsed.error.flatten() }, 400);
    }

    const body = parsed.data;
    const adminEmail = c.get('adminEmail') || 'admin';
    const db = createDatabase(c.env);
    const settings = await db.getSettings();
    const categorySlug = (body.category_slug || 'ai-llms').trim();
    const skill = await db.getSkillBySlug(categorySlug);
    const author = (body.author || settings.default_author).trim();

    const keyFacts = normalizeKeyFacts(body.key_facts ?? body.key_facts_json);
    const faq = normalizeFaq(body.faq ?? body.faq_json);
    const tags = body.tags ?? body.tags_json ?? [];
    const keywords = body.keywords ?? body.keywords_json ?? [];
    const sources = body.sources ?? body.sources_json ?? [];
    const reviewNotes = body.review_notes ?? body.review_notes_json ?? [];
    const tldrSummary = (body.tldr_summary || '').trim();
    const coverImageUrl =
      typeof body.cover_image_url === 'string' && body.cover_image_url.trim().startsWith('https://')
        ? body.cover_image_url.trim()
        : null;
    const coverImageAlt =
      typeof body.cover_image_alt === 'string' && body.cover_image_alt.trim()
        ? body.cover_image_alt.trim()
        : null;
    const imagesJson = (body.images ?? body.images_json ?? []).map((img) => ({
      url: img.url,
      alt: img.alt || '',
      ...(img.caption ? { caption: img.caption } : {}),
      ...(img.source_page_url ? { source_page_url: img.source_page_url } : {}),
    }));

    const compiled = compileMarkdown(body.body_markdown);
    const lint = lintPostPayload({
      title: body.title,
      description: body.description,
      tldr_summary: tldrSummary,
      key_facts: keyFacts,
      faq,
      body_markdown: body.body_markdown,
      author,
      archetype: body.archetype,
      sources,
      banned_patterns: skill?.banned_patterns_json,
    });

    const slug = await ensureUniqueSlug(db, body.slug || body.title);

    // Safety gate: draft_review always saves as draft; auto_publish publishes ONLY if lint passes and caller did not explicitly request draft.
    let resolvedStatus: PostStatus = 'draft';
    if (settings.publishing_mode === 'auto_publish') {
      resolvedStatus = lint.passed && body.status !== 'draft' ? 'published' : 'draft';
    } else {
      resolvedStatus = 'draft';
    }

    const publishedAt = resolvedStatus === 'published' ? new Date().toISOString() : null;

    const created = await db.createPost({
      slug,
      title: body.title,
      description: body.description,
      tldr_summary: tldrSummary,
      key_facts_json: keyFacts,
      faq_json: faq,
      body_markdown: body.body_markdown,
      body_html: compiled.html,
      cover_image_url: coverImageUrl,
      cover_image_alt: coverImageAlt,
      images_json: imagesJson,
      author,
      category_slug: categorySlug,
      archetype: body.archetype,
      tags_json: tags,
      keywords_json: keywords,
      sources_json: sources,
      review_notes_json: reviewNotes,
      lint_passed: lint.passed,
      lint_errors_json: lint.errors,
      quality_score: lint.quality_score,
      quality_breakdown_json: lint.quality_breakdown,
      reading_time_minutes: lint.reading_time_minutes || compiled.readingTimeMinutes,
      word_count: lint.word_count || compiled.wordCount,
      status: resolvedStatus,
      admin_locked: true,
      last_edited_by: adminEmail,
      published_at: publishedAt,
    });

    return c.json(created, 201);
  });

  app.put('/api/admin/posts/:id', async (c) => {
    const id = parsePositiveInt(c.req.param('id'));
    if (!id) {
      return c.json({ error: 'Invalid post ID.' }, 400);
    }

    const rawBody = await parseJsonBody(c.req.raw);
    if (!rawBody.ok) {
      return c.json({ error: 'Invalid JSON payload.' }, 400);
    }

    const parsed = POST_UPDATE_SCHEMA.safeParse(rawBody.data);
    if (!parsed.success) {
      return c.json({ error: 'Invalid post update.', details: parsed.error.flatten() }, 400);
    }

    const adminEmail = c.get('adminEmail') || 'admin';
    const db = createDatabase(c.env);
    const existing = await db.getPostById(id);
    if (!existing) {
      return c.json({ error: 'Post not found.' }, 404);
    }

    const body = parsed.data;
    const title = body.title ?? existing.title;
    const description = body.description ?? existing.description;
    const tldrSummary = body.tldr_summary ?? existing.tldr_summary;
    const bodyMarkdown = body.body_markdown ?? existing.body_markdown;
    const author = (body.author ?? existing.author).trim();
    const categorySlug = (body.category_slug ?? existing.category_slug).trim();
    const archetype: Archetype = body.archetype ?? existing.archetype;

    const coverImageUrl =
      body.cover_image_url !== undefined
        ? typeof body.cover_image_url === 'string' && body.cover_image_url.trim().startsWith('https://')
          ? body.cover_image_url.trim()
          : null
        : existing.cover_image_url;
    const coverImageAlt =
      body.cover_image_alt !== undefined
        ? typeof body.cover_image_alt === 'string' && body.cover_image_alt.trim()
          ? body.cover_image_alt.trim()
          : null
        : existing.cover_image_alt;
    const imagesJson =
      body.images !== undefined || body.images_json !== undefined
        ? (body.images ?? body.images_json ?? []).map((img) => ({
            url: img.url,
            alt: img.alt || '',
            ...(img.caption ? { caption: img.caption } : {}),
            ...(img.source_page_url ? { source_page_url: img.source_page_url } : {}),
          }))
        : existing.images_json;

    const keyFacts =
      body.key_facts !== undefined || body.key_facts_json !== undefined
        ? normalizeKeyFacts(body.key_facts ?? body.key_facts_json)
        : existing.key_facts_json;
    const faq =
      body.faq !== undefined || body.faq_json !== undefined
        ? normalizeFaq(body.faq ?? body.faq_json)
        : existing.faq_json;
    const tags = body.tags ?? body.tags_json ?? existing.tags_json;
    const keywords = body.keywords ?? body.keywords_json ?? existing.keywords_json;
    const sources = body.sources ?? body.sources_json ?? existing.sources_json;
    const reviewNotes = body.review_notes ?? body.review_notes_json ?? existing.review_notes_json;

    const skill = await db.getSkillBySlug(categorySlug);
    const compiled = compileMarkdown(bodyMarkdown);
    const lint = lintPostPayload({
      title,
      description,
      tldr_summary: tldrSummary,
      key_facts: keyFacts,
      faq,
      body_markdown: bodyMarkdown,
      author,
      archetype,
      sources,
      banned_patterns: skill?.banned_patterns_json,
    });

    const nextSlug =
      body.slug && body.slug !== existing.slug
        ? await ensureUniqueSlug(db, body.slug, existing.id)
        : existing.slug;

    const nextStatus: PostStatus = body.status ?? existing.status;
    const nextPublishedAt =
      nextStatus === 'published'
        ? existing.published_at || new Date().toISOString()
        : existing.published_at;

    const updated = await db.updatePost(
      id,
      {
        slug: nextSlug,
        title,
        description,
        tldr_summary: tldrSummary,
        key_facts_json: keyFacts,
        faq_json: faq,
        body_markdown: bodyMarkdown,
        body_html: compiled.html,
        cover_image_url: coverImageUrl,
        cover_image_alt: coverImageAlt,
        images_json: imagesJson,
        author,
        category_slug: categorySlug,
        archetype,
        tags_json: tags,
        keywords_json: keywords,
        sources_json: sources,
        review_notes_json: reviewNotes,
        lint_passed: lint.passed,
        lint_errors_json: lint.errors,
        quality_score: lint.quality_score,
        quality_breakdown_json: lint.quality_breakdown,
        reading_time_minutes: lint.reading_time_minutes || compiled.readingTimeMinutes,
        word_count: lint.word_count || compiled.wordCount,
        status: nextStatus,
        admin_locked: true,
        last_edited_by: adminEmail,
        published_at: nextPublishedAt,
      },
      { actor: 'admin', adminEmail },
    );

    if (!updated) {
      return c.json({ error: 'Post not found.' }, 404);
    }

    return c.json(updated);
  });

  app.patch('/api/admin/posts/:id/status', async (c) => {
    const id = parsePositiveInt(c.req.param('id'));
    if (!id) {
      return c.json({ error: 'Invalid post ID.' }, 400);
    }

    const rawBody = await parseJsonBody(c.req.raw);
    if (!rawBody.ok) {
      return c.json({ error: 'Invalid JSON payload.' }, 400);
    }

    const parsed = POST_STATUS_PATCH_SCHEMA.safeParse(rawBody.data);
    if (!parsed.success) {
      return c.json({ error: 'Invalid status payload.', details: parsed.error.flatten() }, 400);
    }

    const adminEmail = c.get('adminEmail') || 'admin';
    const db = createDatabase(c.env);
    const existing = await db.getPostById(id);
    if (!existing) {
      return c.json({ error: 'Post not found.' }, 404);
    }

    const nextStatus: PostStatus =
      parsed.data.status ?? (existing.status === 'published' ? 'draft' : 'published');
    const publishedAt =
      nextStatus === 'published'
        ? existing.published_at || new Date().toISOString()
        : existing.published_at;

    const updated = await db.updatePost(
      id,
      {
        status: nextStatus,
        published_at: publishedAt,
      },
      { actor: 'admin', adminEmail },
    );

    if (!updated) {
      return c.json({ error: 'Post not found.' }, 404);
    }

    return c.json(updated);
  });

  app.delete('/api/admin/posts/:id', async (c) => {
    const id = parsePositiveInt(c.req.param('id'));
    if (!id) {
      return c.json({ error: 'Invalid post ID.' }, 400);
    }

    const db = createDatabase(c.env);
    const deleted = await db.deletePost(id);
    if (!deleted) {
      return c.json({ error: 'Post not found.' }, 404);
    }

    return c.json({ ok: true, id });
  });

  app.get('/api/admin/preview/:id', async (c) => {
    const id = parsePositiveInt(c.req.param('id'));
    if (!id) {
      return c.json({ error: 'Invalid post ID.' }, 400);
    }

    const db = createDatabase(c.env);
    const [settings, post] = await Promise.all([db.getSettings(), db.getPostById(id)]);
    if (!post) {
      return c.json({ error: 'Post not found.' }, 404);
    }

    const [skill, relatedCandidates] = await Promise.all([
      db.getSkillBySlug(post.category_slug),
      db.listPosts({
        status: 'published',
        category_slug: post.category_slug,
        limit: 4,
        excludeHeavyHtml: true,
      }),
    ]);

    const relatedPosts = relatedCandidates
      .filter((p) => p.id !== post.id && p.status === 'published')
      .slice(0, 3);
    const { headings } = compileMarkdown(post.body_markdown);
    const html = renderBlogPostPage({
      settings,
      post,
      skill,
      relatedPosts,
      headings,
    });

    return new Response(html, {
      status: 200,
      headers: {
        ...buildSecurityHeaders({ allowSameOriginFrame: true }),
        'Content-Type': 'text/html; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'no-store',
      },
    });
  });

  app.post('/api/admin/lint', async (c) => {
    const rawBody = await parseJsonBody(c.req.raw);
    if (!rawBody.ok) {
      return c.json({ error: 'Invalid JSON payload.' }, 400);
    }

    const parsed = LINT_DRY_RUN_SCHEMA.safeParse(rawBody.data);
    if (!parsed.success) {
      return c.json({ error: 'Invalid lint payload.', details: parsed.error.flatten() }, 400);
    }

    const data = parsed.data;
    const db = createDatabase(c.env);
    const settings = await db.getSettings();
    const skill = data.category_slug ? await db.getSkillBySlug(data.category_slug) : null;

    const compiled = compileMarkdown(data.body_markdown);
    const result = lintPostPayload({
      title: data.title,
      description: data.description,
      tldr_summary: data.tldr_summary,
      key_facts: normalizeKeyFacts(data.key_facts ?? data.key_facts_json),
      faq: normalizeFaq(data.faq ?? data.faq_json),
      body_markdown: data.body_markdown,
      author: (data.author || settings.default_author).trim(),
      archetype: data.archetype,
      sources: data.sources ?? data.sources_json ?? [],
      banned_patterns: skill?.banned_patterns_json,
    });

    return c.json({
      ...result,
      headings: compiled.headings,
    });
  });

  // =========================================================================
  // Autonomous Editorial Agent Dispatch & Run Inspection
  // =========================================================================

  app.post('/api/admin/agent/run', async (c) => {
    const rawBody = await parseJsonBody(c.req.raw);
    if (!rawBody.ok) {
      return c.json({ error: 'Invalid JSON payload.' }, 400);
    }

    const parsed = AGENT_RUN_SCHEMA.safeParse(rawBody.data);
    if (!parsed.success) {
      return c.json({ error: 'Invalid agent run payload.', details: parsed.error.flatten() }, 400);
    }

    const body = parsed.data;
    const db = createDatabase(c.env);

    const active = await recoverStaleAndFindActiveRun(db);
    if (active && !body.force) {
      return c.json(
        {
          error:
            'Another agent run is currently in progress. Wait for it to finish or enable Force Run.',
          active_run_id: active.id,
        },
        409,
      );
    }

    const settings = await db.getSettings();
    const syncMode = c.req.query('sync') === 'true';

    const triggerSource = body.trigger_source ?? 'manual';
    const run = await db.createAgentRun({
      trigger_source: triggerSource,
      category_slug: body.category_slug || 'auto',
      topic: body.topic || 'Autonomous discovery',
      archetype: body.archetype || 'auto',
      model_used: body.model_override || settings.openrouter_model,
      status: syncMode ? 'running' : 'queued',
      current_stage: syncMode ? 'initializing' : 'queued',
    });

    const dispatchPayload: AgentDispatchPayload = {
      topic: body.topic,
      category_slug: body.category_slug,
      archetype: body.archetype,
      model_override: body.model_override,
      trigger_source: triggerSource,
      force: body.force,
      run_id: run.id,
    };

    if (syncMode) {
      const result = await runEditorialAgentDirect(db, c.env, dispatchPayload);
      if (result.run.status === 'skipped') {
        return c.json({
          run: result.run,
          post: null,
          skipped: true,
          execution_mode: 'sync',
        });
      }
      return c.json({
        run: result.run,
        post: result.post,
        execution_mode: 'sync',
      });
    }

    if (c.env.EDITORIAL_AGENT_WORKFLOW) {
      const instance = await c.env.EDITORIAL_AGENT_WORKFLOW.create({
        params: dispatchPayload,
      });
      const updatedRun =
        (await db.updateAgentRun(run.id, {
          workflow_instance_id: instance.id,
          status: 'running',
          current_stage: 'workflow_dispatched',
        })) ?? run;

      return c.json(
        {
          run: updatedRun,
          workflow_instance_id: instance.id,
          execution_mode: 'workflow',
        },
        202,
      );
    }

    const backgroundTask = runEditorialAgentDirect(db, c.env, dispatchPayload).catch(() => {});
    try {
      c.executionCtx.waitUntil(backgroundTask);
    } catch {
      // In Vitest or environments without Cloudflare ExecutionContext, fire-and-forget safely
      void backgroundTask;
    }

    return c.json(
      {
        run,
        execution_mode: 'background',
      },
      202,
    );
  });

  app.get('/api/admin/agent/runs', async (c) => {
    const db = createDatabase(c.env);
    const rawLimit = Number.parseInt(c.req.query('limit') || '30', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 30;
    const runs = await db.listAgentRuns(limit);
    return c.json({ runs, total: runs.length });
  });

  app.get('/api/admin/agent/runs/:id', async (c) => {
    const id = parsePositiveInt(c.req.param('id'));
    if (!id) {
      return c.json({ error: 'Invalid agent run ID.' }, 400);
    }

    const db = createDatabase(c.env);
    const run = await db.getAgentRunById(id);
    if (!run) {
      return c.json({ error: 'Agent run not found.' }, 404);
    }

    return c.json(run);
  });

  return app;
}
