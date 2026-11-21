import { Hono } from 'hono';
import { z } from 'zod';
import { getSessionSecret, type WorkerEnv } from '../env';
import { improveExistingPost, runEditorialAgentDirect } from '../lib/agent';
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
import {
  getCachedProbeResults,
  isFreeOpenRouterModel,
  listAllProviderFreeModels,
  probeWorkingModelPool,
  selectRecommendedTop3FromProbe,
} from '../lib/openrouter';
import {
  buildSecurityHeaders,
  checkRateLimit,
  constantTimeEqual,
  extractClientIp,
  recordAbuseStrike,
  slugify,
  verifyCsrfOrigin,
} from '../lib/security';
import { isTurnstileEnabled, verifyTurnstileToken } from '../lib/turnstile';
import type {
  AgentDispatchPayload,
  Archetype,
  DatabaseAdapter,
  FaqItem,
  KeyFact,
  PostStatus,
  SecurityEventType,
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

const GA_MEASUREMENT_ID_RE = /^G-[A-Z0-9]{6,16}$/i;

const LOGIN_SCHEMA = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  turnstile_token: z.string().trim().max(2048).optional(),
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
  fallback_model_1: z.string().trim().max(200).nullable().optional(),
  fallback_model_2: z.string().trim().max(200).nullable().optional(),
  judge_model: z.string().trim().min(1).max(200).optional(),
  default_topic_feed: z.string().trim().min(1).max(2000).optional(),
  default_author: z.string().trim().min(1).max(120).optional(),
  author_bio: z.string().trim().min(1).max(1000).optional(),
  site_name: z.string().trim().min(1).max(120).optional(),
  site_tagline: z.string().trim().min(1).max(500).optional(),
  base_url: z.string().trim().min(1).max(300).optional(),
  adsense_client_id: z.string().trim().max(100).nullable().optional(),
  ga_measurement_id: z
    .string()
    .trim()
    .max(32)
    .refine((v) => v === '' || GA_MEASUREMENT_ID_RE.test(v), {
      message: 'Google Analytics ID must match G-XXXXXXXXXX',
    })
    .nullable()
    .optional(),
  cta_headline: z.string().trim().min(1).max(240).optional(),
  cta_body: z.string().trim().max(800).optional(),
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

const IP_BLOCK_SCHEMA = z.object({
  ip_address: z.string().trim().min(3).max(128),
  reason: z.string().trim().min(1).max(400).default('Manually blocked by admin'),
  duration_minutes: z.number().int().min(1).max(60 * 24 * 365).default(60),
});

function extractExpectedHosts(req: Request): string[] {
  const hosts: string[] = [];
  try {
    hosts.push(new URL(req.url).host);
  } catch {
    // ignore
  }
  const h = req.headers.get('host');
  if (h) hosts.push(h);
  const fwd = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (fwd) hosts.push(fwd);
  return hosts;
}

function extractAuditMeta(req: Request) {
  return {
    ip: extractClientIp(req),
    country: req.headers.get('cf-ipcountry')?.trim().toUpperCase() || null,
    userAgent: req.headers.get('user-agent')?.trim() || null,
    path: (() => {
      try {
        return new URL(req.url).pathname;
      } catch {
        return '';
      }
    })(),
    method: (req.method || 'GET').toUpperCase(),
  };
}

async function safeAuditLog(
  db: DatabaseAdapter,
  req: Request,
  opts: {
    event_type: SecurityEventType;
    email?: string | null;
    status_code?: number | null;
    reason?: string | null;
  },
): Promise<void> {
  try {
    const meta = extractAuditMeta(req);
    await db.recordSecurityLog({
      event_type: opts.event_type,
      ip_address: meta.ip,
      country: meta.country,
      user_agent: meta.userAgent,
      email: opts.email ?? null,
      path: meta.path,
      method: meta.method,
      status_code: opts.status_code ?? null,
      reason: opts.reason ?? null,
    });
  } catch {
    // Never fail an auth/admin response solely because audit persistence errored
  }
}

async function maybeAutoBanIp(
  db: DatabaseAdapter,
  req: Request,
  opts: {
    strikeBucket: string;
    threshold: number;
    banMinutes: number;
    reason: string;
    email?: string | null;
  },
): Promise<{ banned: boolean; blockedUntil?: string; strikes: number }> {
  const ip = extractClientIp(req);
  const strikes = recordAbuseStrike(`${opts.strikeBucket}:${ip}`, 15 * 60_000);
  if (strikes < opts.threshold) {
    return { banned: false, strikes };
  }
  const blockedUntil = new Date(Date.now() + opts.banMinutes * 60_000).toISOString();
  try {
    await db.upsertIpBlock({
      ip_address: ip,
      reason: opts.reason,
      blocked_until: blockedUntil,
      hit_count: strikes,
    });
  } catch {
    // ignore storage errors
  }
  await safeAuditLog(db, req, {
    event_type: 'ip_banned',
    email: opts.email ?? null,
    status_code: 403,
    reason: `${opts.reason} (${opts.banMinutes}m ban after ${strikes} strikes)`,
  });
  return { banned: true, blockedUntil, strikes };
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

  // Auth, IP-ban, rate-limit, CSRF & Turnstile guard middleware for all /api/admin/* endpoints
  app.use('/api/admin/*', async (c, next) => {
    const db = createDatabase(c.env);
    const clientIp = extractClientIp(c.req.raw);

    // 1. Check persistent IP blocklist on every admin endpoint (except /auth/status so SPA still renders login)
    if (c.req.path !== '/api/admin/auth/status') {
      const activeBlock = await db.getActiveIpBlock(clientIp);
      if (activeBlock) {
        await safeAuditLog(db, c.req.raw, {
          event_type: 'login_blocked',
          status_code: 403,
          reason: `Blocked IP (${activeBlock.reason}) until ${activeBlock.blocked_until}`,
        });
        return c.json(
          {
            error: 'Access temporarily blocked due to repeated security violations.',
            blocked_until: activeBlock.blocked_until,
          },
          403,
        );
      }
    }

    if (UNAUTHENTICATED_ADMIN_PATHS.has(c.req.path)) {
      await next();
      return;
    }

    // 2. General rate limit on protected admin endpoints (escalates to 60m IP ban after 3 rate-limit hits)
    const adminRl = checkRateLimit(`admin-api:${clientIp}`, 90, 60_000);
    if (!adminRl.allowed) {
      await safeAuditLog(db, c.req.raw, {
        event_type: 'rate_limited',
        status_code: 429,
        reason: 'Admin API rate limit exceeded',
      });
      const ban = await maybeAutoBanIp(db, c.req.raw, {
        strikeBucket: 'rl-ban',
        threshold: 3,
        banMinutes: 60,
        reason: 'Repeated admin API rate-limit violations',
      });
      if (ban.banned) {
        return c.json(
          {
            error: 'IP temporarily blocked due to repeated rate-limit violations.',
            blocked_until: ban.blockedUntil,
          },
          403,
        );
      }
      c.header('Retry-After', String(adminRl.retryAfterSeconds));
      return c.json({ error: 'Rate limit exceeded. Please slow down.' }, 429);
    }

    const auth = await isAdminAuthenticated(c.req.raw, c.env);
    if (!auth.ok) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const methodUpper = c.req.method.toUpperCase();
    if (auth.method === 'cookie' && MUTATING_METHODS.has(methodUpper)) {
      const csrf = verifyCsrfOrigin(c.req.raw);
      if (!csrf.ok) {
        return c.json({ error: csrf.reason || 'CSRF validation failed' }, 403);
      }
    }

    // 3. Enforce Cloudflare Turnstile on human admin sessions (NOT static bearer_token / agent workflows)
    if (isTurnstileEnabled(c.env) && auth.method !== 'bearer_token') {
      if (!auth.turnstileVerified) {
        return c.json(
          { error: 'Session verification required. Please sign in again.' },
          401,
        );
      }

      if (MUTATING_METHODS.has(methodUpper)) {
        const headerToken = (c.req.raw.headers.get('x-turnstile-token') || '').trim();
        if (!headerToken) {
          return c.json(
            {
              error: 'Please complete the security verification challenge.',
              code: 'turnstile_required',
            },
            400,
          );
        }

        const check = await verifyTurnstileToken({
          token: headerToken,
          secretKey: (c.env.TURNSTILE_SECRET_KEY || '').trim(),
          remoteIp: clientIp,
          expectedHosts: extractExpectedHosts(c.req.raw),
        });

        if (!check.ok) {
          await safeAuditLog(db, c.req.raw, {
            event_type: 'captcha_failed',
            email: auth.email ?? null,
            status_code: 403,
            reason: check.reason || 'Turnstile verification failed on admin action',
          });
          await maybeAutoBanIp(db, c.req.raw, {
            strikeBucket: 'captcha-ban',
            threshold: 5,
            banMinutes: 60,
            reason: 'Repeated failed security challenges',
            email: auth.email ?? null,
          });
          return c.json(
            {
              error:
                check.reason ||
                'Security verification failed. Please complete the challenge again.',
              code: 'turnstile_failed',
            },
            403,
          );
        }
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
    const turnstileRequired = isTurnstileEnabled(c.env);
    const effectiveAuthed =
      auth.ok && (!turnstileRequired || auth.method === 'bearer_token' || auth.turnstileVerified === true);

    return c.json({
      initialized: true,
      authenticated: effectiveAuthed,
      ...(effectiveAuthed && auth.email ? { email: auth.email } : {}),
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
    const db = createDatabase(c.env);
    const csrf = verifyCsrfOrigin(c.req.raw);
    if (!csrf.ok) {
      return c.json({ error: csrf.reason || 'CSRF validation failed' }, 403);
    }

    const clientIp = extractClientIp(c.req.raw);
    const rl = checkRateLimit(`auth:${clientIp}`, 15, 60_000);
    if (!rl.allowed) {
      await safeAuditLog(db, c.req.raw, {
        event_type: 'rate_limited',
        status_code: 429,
        reason: 'Login rate limit exceeded',
      });
      const ban = await maybeAutoBanIp(db, c.req.raw, {
        strikeBucket: 'rl-ban',
        threshold: 3,
        banMinutes: 60,
        reason: 'Repeated login rate-limit violations',
      });
      if (ban.banned) {
        return c.json(
          {
            error: 'IP temporarily blocked due to repeated login rate-limit violations.',
            blocked_until: ban.blockedUntil,
          },
          403,
        );
      }
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

    const turnstileEnabled = isTurnstileEnabled(c.env);
    if (turnstileEnabled) {
      const token = (
        parsed.data.turnstile_token ||
        c.req.raw.headers.get('x-turnstile-token') ||
        ''
      ).trim();
      if (!token) {
        await safeAuditLog(db, c.req.raw, {
          event_type: 'captcha_failed',
          email: parsed.data.email.trim().toLowerCase(),
          status_code: 400,
          reason: 'Missing Turnstile verification token',
        });
        return c.json({ error: 'Please complete the security verification challenge.' }, 400);
      }

      const verification = await verifyTurnstileToken({
        token,
        secretKey: (c.env.TURNSTILE_SECRET_KEY || '').trim(),
        remoteIp: clientIp,
        expectedHosts: extractExpectedHosts(c.req.raw),
      });

      if (!verification.ok) {
        await safeAuditLog(db, c.req.raw, {
          event_type: 'captcha_failed',
          email: parsed.data.email.trim().toLowerCase(),
          status_code: 403,
          reason: verification.reason || 'Turnstile verification failed',
        });
        await maybeAutoBanIp(db, c.req.raw, {
          strikeBucket: 'captcha-ban',
          threshold: 5,
          banMinutes: 60,
          reason: 'Repeated failed login captcha challenges',
          email: parsed.data.email.trim().toLowerCase(),
        });
        return c.json(
          {
            error:
              verification.reason ||
              'Security verification failed. Please complete the challenge again.',
          },
          403,
        );
      }
    }

    const submittedEmail = parsed.data.email.trim().toLowerCase();
    const submittedPassword = parsed.data.password;
    const envEmail = (c.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const envPassword = c.env.ADMIN_PASSWORD || '';
    const hasEnvCredentials = envEmail.length > 0 && envPassword.length > 0;

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
        await safeAuditLog(db, c.req.raw, {
          event_type: 'login_blocked',
          email: submittedEmail,
          status_code: 429,
          reason: 'Account temporarily locked due to repeated failed attempts',
        });
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
        await safeAuditLog(db, c.req.raw, {
          event_type: 'login_failed',
          email: submittedEmail,
          status_code: 401,
          reason: emailMatchesOwner ? 'Wrong password' : 'Unknown email',
        });
        await maybeAutoBanIp(db, c.req.raw, {
          strikeBucket: 'bad-login-ban',
          threshold: 16,
          banMinutes: 60,
          reason: 'Repeated failed login attempts',
          email: submittedEmail,
        });
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
          tv: true,
        },
        getSessionSecret(c.env),
      );

      await safeAuditLog(db, c.req.raw, {
        event_type: 'login_success',
        email: envEmail,
        status_code: 200,
        reason: turnstileEnabled ? 'Turnstile + password verified' : 'Password verified',
      });

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
      await safeAuditLog(db, c.req.raw, {
        event_type: 'login_failed',
        email: submittedEmail,
        status_code: 401,
        reason: 'No admin account configured',
      });
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
      await safeAuditLog(db, c.req.raw, {
        event_type: 'login_failed',
        email: submittedEmail,
        status_code: 401,
        reason: emailMatchesOwner ? 'Wrong password' : 'Unknown email',
      });
      await maybeAutoBanIp(db, c.req.raw, {
        strikeBucket: 'bad-login-ban',
        threshold: 16,
        banMinutes: 60,
        reason: 'Repeated failed login attempts',
        email: submittedEmail,
      });
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
        tv: true,
      },
      getSessionSecret(c.env),
    );

    await safeAuditLog(db, c.req.raw, {
      event_type: 'login_success',
      email: admin.email,
      status_code: 200,
      reason: turnstileEnabled ? 'Turnstile + password verified' : 'Password verified',
    });

    c.header('Set-Cookie', buildSessionCookie(token, isSecureRequest(c.req.raw)));
    return c.json({
      ok: true,
      email: admin.email,
      display_name: displayName,
      token,
    });
  });

  app.post('/api/admin/auth/logout', async (c) => {
    const csrf = verifyCsrfOrigin(c.req.raw);
    if (!csrf.ok) {
      return c.json({ error: csrf.reason || 'CSRF validation failed' }, 403);
    }
    const db = createDatabase(c.env);
    const auth = await isAdminAuthenticated(c.req.raw, c.env);
    await safeAuditLog(db, c.req.raw, {
      event_type: 'logout',
      email: auth.email ?? null,
      status_code: 200,
      reason: 'Admin signed out',
    });
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
    const models = await listAllProviderFreeModels(c.env, c.req.query('refresh') === '1');
    const probeResults = getCachedProbeResults();
    return c.json({
      free_models_only: settings.free_models_only,
      current_model: settings.openrouter_model,
      fallback_model_1: settings.fallback_model_1,
      fallback_model_2: settings.fallback_model_2,
      judge_model: settings.judge_model,
      providers: {
        openrouter: Boolean(c.env.OPENROUTER_API_KEY?.trim()),
        nvidia_nim: Boolean(c.env.NVIDIA_NIM_API_KEY?.trim()),
      },
      probe_results: probeResults,
      models,
    });
  });

  app.get('/api/admin/models/probe', async (c) => {
    const results = getCachedProbeResults();
    return c.json({
      results,
      recommended: selectRecommendedTop3FromProbe(results),
      providers: {
        openrouter: Boolean(c.env.OPENROUTER_API_KEY?.trim()),
        nvidia_nim: Boolean(c.env.NVIDIA_NIM_API_KEY?.trim()),
      },
    });
  });

  app.post('/api/admin/models/probe', async (c) => {
    const rawBody = await parseJsonBody(c.req.raw);
    if (!rawBody.ok) {
      return c.json({ error: 'Invalid JSON payload.' }, 400);
    }
    const bodyObj = (rawBody.data && typeof rawBody.data === 'object' ? rawBody.data : {}) as {
      models?: unknown;
      auto_apply?: unknown;
      timeout_ms?: unknown;
    };
    const db = createDatabase(c.env);
    const settings = await db.getSettings();

    const customModels = Array.isArray(bodyObj.models)
      ? bodyObj.models.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
      : [];
    const candidates = Array.from(
      new Set(
        [
          ...customModels,
          settings.openrouter_model,
          settings.fallback_model_1 || '',
          settings.fallback_model_2 || '',
          settings.judge_model,
        ].filter(Boolean),
      ),
    );
    const timeoutMs =
      typeof bodyObj.timeout_ms === 'number' && Number.isFinite(bodyObj.timeout_ms)
        ? bodyObj.timeout_ms
        : 8_500;

    const results = await probeWorkingModelPool(c.env, candidates, {
      forceRefresh: true,
      timeoutMs,
    });
    const recommended = selectRecommendedTop3FromProbe(results);
    const models = await listAllProviderFreeModels(c.env, false);

    let updatedSettings: SiteSettings | null = null;
    if (bodyObj.auto_apply === true && recommended.main) {
      const patch: Partial<SiteSettings> = {
        openrouter_model: recommended.main,
      };
      if (recommended.fallback_1) {
        patch.fallback_model_1 = recommended.fallback_1;
      }
      if (recommended.fallback_2) {
        patch.fallback_model_2 = recommended.fallback_2;
      }
      updatedSettings = await db.updateSettings(patch);
    }

    return c.json({
      results,
      recommended,
      models,
      ...(updatedSettings ? { settings: updatedSettings } : {}),
      providers: {
        openrouter: Boolean(c.env.OPENROUTER_API_KEY?.trim()),
        nvidia_nim: Boolean(c.env.NVIDIA_NIM_API_KEY?.trim()),
      },
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
    if (patch.ga_measurement_id === '') {
      patch.ga_measurement_id = null;
    } else if (typeof patch.ga_measurement_id === 'string') {
      patch.ga_measurement_id = patch.ga_measurement_id.trim().toUpperCase();
    }
    if (patch.fallback_model_1 === '') {
      patch.fallback_model_1 = null;
    }
    if (patch.fallback_model_2 === '') {
      patch.fallback_model_2 = null;
    }

    const db = createDatabase(c.env);
    const existingSettings = await db.getSettings();
    const effectiveFreeModelsOnly =
      patch.free_models_only !== undefined
        ? patch.free_models_only
        : existingSettings.free_models_only;

    if (effectiveFreeModelsOnly) {
      const modelsToCheck = [
        patch.openrouter_model,
        patch.fallback_model_1,
        patch.fallback_model_2,
        patch.judge_model,
      ].filter((m): m is string => typeof m === 'string' && m.trim().length > 0);
      if (modelsToCheck.some((m) => !isFreeOpenRouterModel(m))) {
        return c.json(
          {
            error:
              'Free-models-only mode is enabled. Choose $0 (:free or nim/*) models (or disable free_models_only first).',
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
    const { html: compiledHtml, headings } = compileMarkdown(post.body_markdown);
    const html = renderBlogPostPage({
      settings,
      post,
      skill,
      relatedPosts,
      headings,
      compiledHtml,
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

  app.post('/api/admin/posts/:id/improve', async (c) => {
    const id = parsePositiveInt(c.req.param('id'));
    if (!id) {
      return c.json({ error: 'Invalid post ID.' }, 400);
    }

    const db = createDatabase(c.env);
    const existing = await db.getPostById(id);
    if (!existing) {
      return c.json({ error: 'Post not found.' }, 404);
    }

    const syncMode = c.req.query('sync') === 'true';
    const settings = await db.getSettings();
    const adminEmail = c.get('adminEmail') || 'agent-auto-improve';

    if (syncMode || !c.env.EDITORIAL_AGENT_WORKFLOW) {
      const result = await improveExistingPost(db, c.env, id, adminEmail);
      return c.json({
        ok: true,
        execution_mode: 'sync',
        previous_score: result.previousScore,
        final_score: result.finalScore,
        promoted_to_published: result.promotedToPublished,
        post: result.post,
      });
    }

    const run = await db.createAgentRun({
      trigger_source: 'manual',
      category_slug: existing.category_slug,
      topic: `Auto-improve: ${existing.title}`,
      archetype: existing.archetype,
      model_used: settings.openrouter_model,
      status: 'queued',
      current_stage: 'queued',
    });

    const instance = await c.env.EDITORIAL_AGENT_WORKFLOW.create({
      params: {
        improve_post_id: existing.id,
        category_slug: existing.category_slug,
        archetype: existing.archetype,
        trigger_source: 'manual',
        force: true,
        run_id: run.id,
      },
    });

    const updatedRun =
      (await db.updateAgentRun(run.id, {
        workflow_instance_id: instance.id,
        post_id: existing.id,
        status: 'running',
        current_stage: 'workflow_dispatched',
      })) ?? run;

    return c.json(
      {
        ok: true,
        execution_mode: 'workflow',
        run: updatedRun,
        workflow_instance_id: instance.id,
        post_id: existing.id,
      },
      202,
    );
  });

  app.post('/api/admin/agent/runs/:id/retry', async (c) => {
    const id = parsePositiveInt(c.req.param('id'));
    if (!id) {
      return c.json({ error: 'Invalid agent run ID.' }, 400);
    }

    const db = createDatabase(c.env);
    const failedRun = await db.getAgentRunById(id);
    if (!failedRun) {
      return c.json({ error: 'Agent run not found.' }, 404);
    }

    const settings = await db.getSettings();
    const categorySlug =
      failedRun.category_slug && failedRun.category_slug !== 'auto'
        ? failedRun.category_slug
        : undefined;

    const newRun = await db.createAgentRun({
      trigger_source: 'manual',
      category_slug: categorySlug || 'auto',
      topic: `Rerun #${failedRun.id}: ${failedRun.topic || 'Autonomous discovery'}`,
      archetype: 'auto',
      model_used: settings.openrouter_model,
      status: 'queued',
      current_stage: 'queued',
    });

    const dispatchPayload: AgentDispatchPayload = {
      category_slug: categorySlug,
      trigger_source: 'manual',
      force: true,
      run_id: newRun.id,
    };

    if (c.env.EDITORIAL_AGENT_WORKFLOW) {
      const instance = await c.env.EDITORIAL_AGENT_WORKFLOW.create({
        params: dispatchPayload,
      });
      const updatedRun =
        (await db.updateAgentRun(newRun.id, {
          workflow_instance_id: instance.id,
          status: 'running',
          current_stage: 'workflow_dispatched',
        })) ?? newRun;
      return c.json(
        {
          ok: true,
          execution_mode: 'workflow',
          retried_from_run_id: failedRun.id,
          run: updatedRun,
          workflow_instance_id: instance.id,
        },
        202,
      );
    }

    const bg = runEditorialAgentDirect(db, c.env, dispatchPayload).catch(() => {});
    try {
      c.executionCtx.waitUntil(bg);
    } catch {
      void bg;
    }

    return c.json(
      {
        ok: true,
        execution_mode: 'background',
        retried_from_run_id: failedRun.id,
        run: newRun,
      },
      202,
    );
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

  // =========================================================================
  // Security Audit Logs & Persistent IP Blocklist Endpoints
  // =========================================================================

  app.get('/api/admin/security/logs', async (c) => {
    const db = createDatabase(c.env);
    const rawLimit = Number.parseInt(c.req.query('limit') || '100', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(250, Math.max(1, rawLimit)) : 100;
    const eventType = (c.req.query('event_type') || 'all').trim();
    const logs = await db.listSecurityLogs({ limit, event_type: eventType });
    return c.json({ logs, total: logs.length });
  });

  app.get('/api/admin/security/blocks', async (c) => {
    const db = createDatabase(c.env);
    const blocks = await db.listIpBlocks();
    const now = Date.now();
    return c.json({
      blocks: blocks.map((b) => ({
        ...b,
        active: new Date(b.blocked_until).getTime() > now,
      })),
    });
  });

  app.post('/api/admin/security/blocks', async (c) => {
    const rawBody = await parseJsonBody(c.req.raw);
    if (!rawBody.ok) {
      return c.json({ error: 'Invalid JSON payload.' }, 400);
    }
    const parsed = IP_BLOCK_SCHEMA.safeParse(rawBody.data);
    if (!parsed.success) {
      return c.json({ error: 'Invalid IP block payload.', details: parsed.error.flatten() }, 400);
    }
    const db = createDatabase(c.env);
    const blockedUntil = new Date(Date.now() + parsed.data.duration_minutes * 60_000).toISOString();
    const record = await db.upsertIpBlock({
      ip_address: parsed.data.ip_address,
      reason: parsed.data.reason,
      blocked_until: blockedUntil,
    });
    await safeAuditLog(db, c.req.raw, {
      event_type: 'ip_banned',
      email: c.get('adminEmail') || null,
      status_code: 201,
      reason: `Manual block of ${record.ip_address} for ${parsed.data.duration_minutes}m: ${record.reason}`,
    });
    return c.json(record, 201);
  });

  app.delete('/api/admin/security/blocks/:ip', async (c) => {
    const ip = decodeURIComponent(c.req.param('ip') || '').trim();
    if (!ip) {
      return c.json({ error: 'Invalid IP address.' }, 400);
    }
    const db = createDatabase(c.env);
    const removed = await db.deleteIpBlock(ip);
    if (!removed) {
      return c.json({ error: 'IP block entry not found.' }, 404);
    }
    await safeAuditLog(db, c.req.raw, {
      event_type: 'admin_action',
      email: c.get('adminEmail') || null,
      status_code: 200,
      reason: `Unblocked IP ${ip}`,
    });
    return c.json({ ok: true, ip_address: ip });
  });

  return app;
}
