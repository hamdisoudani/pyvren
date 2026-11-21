import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createApp } from '../src/index';
import type { WorkerEnv } from '../src/env';
import { InMemoryDatabase } from '../src/lib/db';
import { listOpenRouterFreeModels, resolveFreeModelChain } from '../src/lib/openrouter';
import { resetRateLimitsForTests } from '../src/lib/security';
import { resetAdminLoginLockoutsForTests } from '../src/routes/admin';

const ADMIN_TOKEN = 'agent-static-token-test-999999';
const OWNER_EMAIL = 'owner@pyvren.com';
const OWNER_PASSWORD = 'StrongOwnerPassword!2026';
const SESSION_SECRET = 'turnstile-ga-models-test-secret-0123456789abcdef';
const TURNSTILE_SITE_KEY = '0x4AAAAAA_TEST_SITE_KEY';
const TURNSTILE_SECRET_KEY = '0x4AAAAAA_TEST_SECRET_KEY';

function makeEnv(db: InMemoryDatabase, extra?: Partial<WorkerEnv>): WorkerEnv {
  return {
    __TEST_DB__: db,
    ADMIN_TOKEN,
    ADMIN_EMAIL: OWNER_EMAIL,
    ADMIN_PASSWORD: OWNER_PASSWORD,
    ADMIN_DISPLAY_NAME: 'Hamdi Soudani',
    SESSION_SECRET,
    BASE_URL: 'https://pyvren.com',
    ...extra,
  };
}

describe('Security, Turnstile, GA4 Analytics, IP Blocking & Free LLM Picker Suite', () => {
  beforeEach(() => {
    resetRateLimitsForTests();
    resetAdminLoginLockoutsForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetRateLimitsForTests();
    resetAdminLoginLockoutsForTests();
  });

  it('1. Enforces Cloudflare Turnstile on login and EVERY mutating human admin endpoint, while allowing agent static bearer token without captcha', async () => {
    const db = new InMemoryDatabase();
    const app = createApp();
    const env = makeEnv(db, {
      TURNSTILE_SITE_KEY,
      TURNSTILE_SECRET_KEY,
    });

    // Admin SPA HTML embeds explicit Turnstile script and configured site key
    const adminPageRes = await app.request('https://pyvren.com/admin', {}, env);
    expect(adminPageRes.status).toBe(200);
    const adminHtml = await adminPageRes.text();
    expect(adminHtml).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    expect(adminHtml).toContain(TURNSTILE_SITE_KEY);

    // Mock Turnstile siteverify endpoint
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('challenges.cloudflare.com/turnstile/v0/siteverify')) {
        const bodyStr = typeof init?.body === 'string' ? init.body : '';
        const params = new URLSearchParams(bodyStr);
        const tok = params.get('response') || '';
        if (tok === 'valid-turnstile-token') {
          return new Response(
            JSON.stringify({
              success: true,
              hostname: 'pyvren.com',
              challenge_ts: new Date().toISOString(),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({
            success: false,
            'error-codes': ['invalid-input-response'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('Not mocked', { status: 404 });
    });

    // 1a. Login WITHOUT turnstile_token -> 400 + captcha_failed audit log
    const noTokRes = await app.request(
      'https://pyvren.com/api/admin/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '198.51.100.10',
          'cf-ipcountry': 'TN',
        },
        body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
      },
      env,
    );
    expect(noTokRes.status).toBe(400);

    // 1b. Login WITH fake turnstile_token -> 403 + captcha_failed audit log
    const badTokRes = await app.request(
      'https://pyvren.com/api/admin/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '198.51.100.10',
          'cf-ipcountry': 'TN',
        },
        body: JSON.stringify({
          email: OWNER_EMAIL,
          password: OWNER_PASSWORD,
          turnstile_token: 'fake-bot-token',
        }),
      },
      env,
    );
    expect(badTokRes.status).toBe(403);

    // 1c. Login WITH valid turnstile_token -> 200 + login_success audit log + JWT token
    const goodLoginRes = await app.request(
      'https://pyvren.com/api/admin/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': '198.51.100.10',
          'cf-ipcountry': 'TN',
        },
        body: JSON.stringify({
          email: OWNER_EMAIL,
          password: OWNER_PASSWORD,
          turnstile_token: 'valid-turnstile-token',
        }),
      },
      env,
    );
    expect(goodLoginRes.status).toBe(200);
    const loginJson = (await goodLoginRes.json()) as { ok: boolean; token: string };
    expect(loginJson.ok).toBe(true);
    expect(loginJson.token).toBeTruthy();

    // 1d. Human session calling GET /api/admin/settings works (session has tv: true)
    const getSettingsRes = await app.request(
      'https://pyvren.com/api/admin/settings',
      {
        headers: {
          Authorization: `Bearer ${loginJson.token}`,
          'cf-connecting-ip': '198.51.100.10',
        },
      },
      env,
    );
    expect(getSettingsRes.status).toBe(200);

    // 1e. Human session calling PUT /api/admin/settings WITHOUT X-Turnstile-Token -> 400
    const mutNoTokRes = await app.request(
      'https://pyvren.com/api/admin/settings',
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${loginJson.token}`,
          'Content-Type': 'application/json',
          'cf-connecting-ip': '198.51.100.10',
        },
        body: JSON.stringify({ site_tagline: 'Updated tagline' }),
      },
      env,
    );
    expect(mutNoTokRes.status).toBe(400);
    expect(((await mutNoTokRes.json()) as { code?: string }).code).toBe('turnstile_required');

    // 1f. Human session calling PUT /api/admin/settings WITH invalid X-Turnstile-Token -> 403
    const mutBadTokRes = await app.request(
      'https://pyvren.com/api/admin/settings',
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${loginJson.token}`,
          'Content-Type': 'application/json',
          'X-Turnstile-Token': 'bad-action-token',
          'cf-connecting-ip': '198.51.100.10',
        },
        body: JSON.stringify({ site_tagline: 'Updated tagline' }),
      },
      env,
    );
    expect(mutBadTokRes.status).toBe(403);
    expect(((await mutBadTokRes.json()) as { code?: string }).code).toBe('turnstile_failed');

    // 1g. Human session calling PUT /api/admin/settings WITH valid X-Turnstile-Token -> 200
    const mutGoodTokRes = await app.request(
      'https://pyvren.com/api/admin/settings',
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${loginJson.token}`,
          'Content-Type': 'application/json',
          'X-Turnstile-Token': 'valid-turnstile-token',
          'cf-connecting-ip': '198.51.100.10',
        },
        body: JSON.stringify({ site_tagline: 'Human verified update' }),
      },
      env,
    );
    expect(mutGoodTokRes.status).toBe(200);

    // 1h. Agent/automation using static ADMIN_TOKEN succeeds WITHOUT X-Turnstile-Token
    const agentMutRes = await app.request(
      'https://pyvren.com/api/admin/settings',
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json',
          'cf-connecting-ip': '198.51.100.99',
        },
        body: JSON.stringify({ site_tagline: 'Agent automation update' }),
      },
      env,
    );
    expect(agentMutRes.status).toBe(200);

    // Verify audit logs captured all security events with IP and country
    const logsRes = await app.request(
      'https://pyvren.com/api/admin/security/logs',
      { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } },
      env,
    );
    expect(logsRes.status).toBe(200);
    const logsData = (await logsRes.json()) as {
      logs: Array<{ event_type: string; ip_address: string; country: string | null }>;
    };
    const eventTypes = logsData.logs.map((l) => l.event_type);
    expect(eventTypes).toContain('captcha_failed');
    expect(eventTypes).toContain('login_success');
    expect(logsData.logs.some((l) => l.ip_address === '198.51.100.10' && l.country === 'TN')).toBe(true);
  });

  it('2. Auto-bans abusive IPs after repeated rate-limit hits and supports listing, manual blocking & unblocking', async () => {
    const db = new InMemoryDatabase();
    const app = createApp();
    const env = makeEnv(db);
    const attackerIp = '203.0.113.200';

    // 15 attempts allowed by rate-limiter (each 401), then 16th & 17th return 429, 18th triggers 3rd rl-ban strike -> 403 auto-ban!
    let saw429Count = 0;
    let saw403AutoBan = false;
    for (let i = 0; i < 20; i++) {
      const r = await app.request(
        'https://pyvren.com/api/admin/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': attackerIp,
          },
          body: JSON.stringify({
            email: `attacker-${i}@evil.example`,
            password: 'WrongPassword!123',
          }),
        },
        env,
      );
      if (r.status === 429) saw429Count++;
      if (r.status === 403) {
        saw403AutoBan = true;
        break;
      }
    }
    expect(saw429Count).toBeGreaterThanOrEqual(2);
    expect(saw403AutoBan).toBe(true);

    // Subsequent login from banned IP is immediately rejected with 403 by IP blocklist middleware
    const blockedRetry = await app.request(
      'https://pyvren.com/api/admin/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': attackerIp,
        },
        body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
      },
      env,
    );
    expect(blockedRetry.status).toBe(403);

    // Admin lists active blocks and sees attackerIp
    const blocksRes = await app.request(
      'https://pyvren.com/api/admin/security/blocks',
      { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } },
      env,
    );
    expect(blocksRes.status).toBe(200);
    const blocksJson = (await blocksRes.json()) as { blocks: Array<{ ip_address: string }> };
    expect(blocksJson.blocks.some((b) => b.ip_address === attackerIp)).toBe(true);

    // Admin manually blocks another IP
    const manualIp = '192.0.2.55';
    const addBlockRes = await app.request(
      'https://pyvren.com/api/admin/security/blocks',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ip_address: manualIp,
          minutes: 30,
          reason: 'Suspicious scanner',
        }),
      },
      env,
    );
    expect(addBlockRes.status).toBe(201);

    // Blocked manual IP gets 403 on login
    const manualBlockedRes = await app.request(
      'https://pyvren.com/api/admin/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': manualIp,
        },
        body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
      },
      env,
    );
    expect(manualBlockedRes.status).toBe(403);

    // Admin unblocks manualIp -> login works again
    const delBlockRes = await app.request(
      `https://pyvren.com/api/admin/security/blocks/${encodeURIComponent(manualIp)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      },
      env,
    );
    expect(delBlockRes.status).toBe(200);

    const afterUnblockRes = await app.request(
      'https://pyvren.com/api/admin/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': manualIp,
        },
        body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
      },
      env,
    );
    expect(afterUnblockRes.status).toBe(200);
  });

  it('3. Validates GA4 measurement ID, injects gtag.js on public pages only, and never on /admin', async () => {
    const db = new InMemoryDatabase();
    const app = createApp();
    const env = makeEnv(db);

    // Invalid GA ID rejected with 400
    const badGa = await app.request(
      'https://pyvren.com/api/admin/settings',
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ga_measurement_id: 'UA-123456-1' }),
      },
      env,
    );
    expect(badGa.status).toBe(400);

    // Valid GA4 ID saved (normalized uppercase)
    const goodGa = await app.request(
      'https://pyvren.com/api/admin/settings',
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ga_measurement_id: 'g-ab12cd34ef' }),
      },
      env,
    );
    expect(goodGa.status).toBe(200);
    const updated = (await goodGa.json()) as { ga_measurement_id: string | null };
    expect(updated.ga_measurement_id).toBe('G-AB12CD34EF');

    // Public homepage includes GA4 gtag snippet
    const homeRes = await app.request('https://pyvren.com/', {}, env);
    expect(homeRes.status).toBe(200);
    const homeHtml = await homeRes.text();
    expect(homeHtml).toContain('https://www.googletagmanager.com/gtag/js?id=G-AB12CD34EF');
    expect(homeHtml).toContain("gtag('config','G-AB12CD34EF')");

    // Admin SPA NEVER includes GA4 tracking script
    const adminRes = await app.request('https://pyvren.com/admin', {}, env);
    const adminHtml = await adminRes.text();
    expect(adminHtml).not.toContain('googletagmanager.com/gtag/js');
    expect(adminHtml).not.toContain('G-AB12CD34EF');
  });

  it('4. Filters OpenRouter catalog strictly to $0 text LLMs and executes Main -> Fallback 1 -> Fallback 2 chain', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('openrouter.ai/api/v1/models')) {
        return new Response(
          JSON.stringify({
            data: [
              // Valid $0 text LLMs
              {
                id: 'deepseek/deepseek-r1:free',
                name: 'DeepSeek R1 (free)',
                context_length: 64000,
                pricing: { prompt: '0', completion: '0' },
                architecture: { input_modalities: ['text'], output_modalities: ['text'] },
              },
              {
                id: 'meta-llama/llama-3.3-70b-instruct:free',
                name: 'Llama 3.3 70B Instruct',
                context_length: 131072,
                pricing: { prompt: '0.0', completion: '0.0' },
                architecture: { modality: 'text->text' },
              },
              // Paid model -> MUST be rejected
              {
                id: 'anthropic/claude-3.7-sonnet',
                name: 'Claude 3.7 Sonnet',
                context_length: 200000,
                pricing: { prompt: '0.000003', completion: '0.000015' },
                architecture: { input_modalities: ['text'], output_modalities: ['text'] },
              },
              // Non-zero completion even with :free suffix -> MUST be rejected
              {
                id: 'sneaky/model:free',
                name: 'Sneaky Paid Output',
                context_length: 32000,
                pricing: { prompt: '0', completion: '0.000001' },
                architecture: { input_modalities: ['text'], output_modalities: ['text'] },
              },
              // Safety guard / classifier -> MUST be rejected
              {
                id: 'meta-llama/llama-guard-3-8b:free',
                name: 'Llama Guard 3',
                context_length: 16384,
                pricing: { prompt: '0', completion: '0' },
                architecture: { input_modalities: ['text'], output_modalities: ['text'] },
              },
              // Image-generation / audio / embedding models -> MUST be rejected
              {
                id: 'black-forest-labs/flux-schnell:free',
                name: 'Flux Image Gen',
                context_length: 16384,
                pricing: { prompt: '0', completion: '0' },
                architecture: { input_modalities: ['text'], output_modalities: ['image'] },
              },
              {
                id: 'openai/whisper-large:free',
                name: 'Whisper Audio',
                context_length: 16384,
                pricing: { prompt: '0', completion: '0' },
                architecture: { input_modalities: ['audio'], output_modalities: ['text'] },
              },
              // Tiny context model (< 8192) -> MUST be rejected
              {
                id: 'tiny/toy-llm:free',
                name: 'Tiny Toy',
                context_length: 2048,
                pricing: { prompt: '0', completion: '0' },
                architecture: { input_modalities: ['text'], output_modalities: ['text'] },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('Not mocked', { status: 404 });
    });

    const models = await listOpenRouterFreeModels({ OPENROUTER_API_KEY: 'sk-or-test-key' }, true);
    const ids = models.map((m) => m.id);
    expect(ids).toHaveLength(2);
    expect(ids).toContain('deepseek/deepseek-r1:free');
    expect(ids).toContain('meta-llama/llama-3.3-70b-instruct:free');
    expect(ids).not.toContain('anthropic/claude-3.7-sonnet');
    expect(ids).not.toContain('sneaky/model:free');
    expect(ids).not.toContain('meta-llama/llama-guard-3-8b:free');
    expect(ids).not.toContain('black-forest-labs/flux-schnell:free');
    expect(ids).not.toContain('openai/whisper-large:free');
    expect(ids).not.toContain('tiny/toy-llm:free');

    // Verify Main -> Fallback 1 -> Fallback 2 chain ordering
    const chain = resolveFreeModelChain(
      'deepseek/deepseek-r1:free',
      true,
      ['deepseek/deepseek-r1:free', 'google/gemma-3-27b-it:free'],
      [
        'meta-llama/llama-3.3-70b-instruct:free',
        'qwen/qwen3-coder:free',
      ],
    );
    expect(chain[0]).toBe('deepseek/deepseek-r1:free');
    expect(chain[1]).toBe('meta-llama/llama-3.3-70b-instruct:free');
    expect(chain[2]).toBe('qwen/qwen3-coder:free');
    // No duplicates
    expect(new Set(chain).size).toBe(chain.length);

    // Verify settings persistence of Main + Fallback 1 + Fallback 2
    const db = new InMemoryDatabase();
    const app = createApp();
    const env = makeEnv(db);
    const putRes = await app.request(
      'https://pyvren.com/api/admin/settings',
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          openrouter_model: 'deepseek/deepseek-r1:free',
          fallback_model_1: 'meta-llama/llama-3.3-70b-instruct:free',
          fallback_model_2: 'qwen/qwen3-coder:free',
        }),
      },
      env,
    );
    expect(putRes.status).toBe(200);
    const saved = (await putRes.json()) as {
      openrouter_model: string;
      fallback_model_1: string | null;
      fallback_model_2: string | null;
    };
    expect(saved.openrouter_model).toBe('deepseek/deepseek-r1:free');
    expect(saved.fallback_model_1).toBe('meta-llama/llama-3.3-70b-instruct:free');
    expect(saved.fallback_model_2).toBe('qwen/qwen3-coder:free');
  });
});
