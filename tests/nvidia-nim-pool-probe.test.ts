import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerEnv } from '../src/env';
import { createApp } from '../src/index';
import { createSessionToken } from '../src/lib/auth';
import { InMemoryDatabase } from '../src/lib/db';
import {
  callOpenRouter,
  getFastestHealthyModelsFromCache,
  getOpenRouterModelFamily,
  isFreeOpenRouterModel,
  probeWorkingModelPool,
  resetProviderCachesForTests,
  selectRecommendedTop3FromProbe,
} from '../src/lib/openrouter';

function makeTestEnv(overrides: Partial<WorkerEnv> = {}): WorkerEnv {
  return {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SECRET_KEY: 'test-service-key',
    SESSION_SECRET: 'test-session-secret-0123456789abcdef',
    BASE_URL: 'https://pyvren.com',
    OPENROUTER_API_KEY: 'test-or-key',
    NVIDIA_NIM_API_KEY: 'test-nim-key',
    __TEST_DB__: new InMemoryDatabase(),
    ...overrides,
  };
}

describe('NVIDIA NIM Multi-Provider Routing, Cross-Provider Failover & Live Pool Probing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetProviderCachesForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetProviderCachesForTests();
  });

  it('1. Recognizes nim/* models as zero-cost, strips nim/ prefix, and sends chat_template_kwargs.enable_thinking=false to NVIDIA NIM', async () => {
    expect(isFreeOpenRouterModel('nim/nvidia/nemotron-3.5-super-vl-120b-a12b')).toBe(true);
    expect(getOpenRouterModelFamily('nim/nvidia/nemotron-3.5-super-vl-120b-a12b')).toBe('nvidia');
    expect(getOpenRouterModelFamily('nim/google/gemma-4-31b-it')).toBe('google');
    expect(getOpenRouterModelFamily('baidu/ernie-5.5-flash-preview:free')).toBe('baidu');

    let capturedUrl = '';
    let capturedAuth = '';
    let capturedBody: Record<string, unknown> = {};

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      capturedUrl = String(input);
      const headers = (init?.headers || {}) as Record<string, string>;
      capturedAuth = headers.Authorization || '';
      capturedBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          model: 'nvidia/nemotron-3.5-super-vl-120b-a12b',
          choices: [{ message: { content: '{"ok":true,"note":"nim works"}' } }],
          usage: { prompt_tokens: 12, completion_tokens: 10, total_tokens: 22 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const env = makeTestEnv({ OPENROUTER_API_KEY: '' });
    const res = await callOpenRouter(env, {
      model: 'nim/nvidia/nemotron-3.5-super-vl-120b-a12b',
      messages: [{ role: 'user', content: 'Return JSON' }],
      jsonMode: true,
    });

    expect(capturedUrl).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(capturedAuth).toBe('Bearer test-nim-key');
    expect(capturedBody.model).toBe('nvidia/nemotron-3.5-super-vl-120b-a12b');
    expect(capturedBody.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(capturedBody.reasoning).toBeUndefined();
    expect(res.model).toBe('nim/nvidia/nemotron-3.5-super-vl-120b-a12b');
    expect(res.content).toContain('"ok":true');
  });

  it('2. Automatically fails over from OpenRouter 429 free-models-per-day to NVIDIA NIM and bypasses exhausted OpenRouter on next call', async () => {
    const calledUrls: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      calledUrls.push(url);

      if (url.includes('openrouter.ai')) {
        return new Response(
          JSON.stringify({
            error: {
              message: 'Rate limit exceeded: free-models-per-day.',
              code: 429,
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({
          model: 'nvidia/nemotron-3.5-super-vl-120b-a12b',
          choices: [{ message: { content: '{"failover":"nim-success"}' } }],
          usage: { prompt_tokens: 15, completion_tokens: 8, total_tokens: 23 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const env = makeTestEnv();
    const first = await callOpenRouter(env, {
      model: 'baidu/ernie-5.5-flash-preview:free',
      fallbackModels: ['nim/nvidia/nemotron-3.5-super-vl-120b-a12b'],
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(first.model).toBe('nim/nvidia/nemotron-3.5-super-vl-120b-a12b');
    expect(calledUrls).toEqual([
      'https://openrouter.ai/api/v1/chat/completions',
      'https://integrate.api.nvidia.com/v1/chat/completions',
    ]);

    // Second call should go straight to NVIDIA NIM without wasting another call on exhausted OpenRouter
    calledUrls.length = 0;
    const second = await callOpenRouter(env, {
      model: 'baidu/ernie-5.5-flash-preview:free',
      fallbackModels: ['nim/nvidia/nemotron-3.5-super-vl-120b-a12b'],
      messages: [{ role: 'user', content: 'hi again' }],
    });
    expect(second.model).toBe('nim/nvidia/nemotron-3.5-super-vl-120b-a12b');
    expect(calledUrls).toEqual(['https://integrate.api.nvidia.com/v1/chat/completions']);
  });

  it('3. Probes working model pool in parallel, ranks fastest JSON-compliant models first, and selects Top-3 preferring distinct families', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const body = JSON.parse(String(init?.body || '{}')) as { model?: string };
      const url = String(input);
      const model = body.model || '';

      if (url.includes('openrouter.ai') && model.includes('ernie')) {
        await new Promise((r) => setTimeout(r, 45));
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('nvidia.com') && model.includes('lightning')) {
        await new Promise((r) => setTimeout(r, 10));
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('nvidia.com') && model.includes('super-vl')) {
        await new Promise((r) => setTimeout(r, 25));
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('Rate limited', { status: 429 });
    });

    const env = makeTestEnv();
    const results = await probeWorkingModelPool(
      env,
      [
        'google/gemma-4-31b-it:free',
        'baidu/ernie-5.5-flash-preview:free',
        'nim/nvidia/nemotron-3.5-super-vl-120b-a12b',
        'nim/nvidia/nemotron-3.5-lightning-30b-a3b',
      ],
      { forceRefresh: true, timeoutMs: 3_000 },
    );

    const healthy = results.filter((r) => r.ok && r.json_ok);
    expect(healthy.length).toBe(3);
    expect(healthy[0].id).toBe('nim/nvidia/nemotron-3.5-lightning-30b-a3b');
    expect(getFastestHealthyModelsFromCache()[0]).toBe('nim/nvidia/nemotron-3.5-lightning-30b-a3b');

    const top3 = selectRecommendedTop3FromProbe(results);
    expect(top3.working_count).toBe(3);
    expect(top3.main).toBe('nim/nvidia/nemotron-3.5-lightning-30b-a3b');
    // Fallback 1 prefers a distinct family (baidu) when available!
    expect(top3.fallback_1).toBe('baidu/ernie-5.5-flash-preview:free');
    expect(top3.fallback_2).toBe('nim/nvidia/nemotron-3.5-super-vl-120b-a12b');
  });

  it('4. Admin POST /api/admin/models/probe with auto_apply persists fastest working Top-3 and GET /api/admin/openrouter/free-models exposes both providers', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/v1/models') && url.includes('nvidia.com')) {
        return new Response(
          JSON.stringify({
            data: [
              { id: 'nvidia/nemotron-3.5-super-vl-120b-a12b' },
              { id: 'nvidia/nemotron-3.5-lightning-30b-a3b' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/v1/models') && url.includes('openrouter.ai')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'baidu/ernie-5.5-flash-preview:free',
                name: 'Baidu ERNIE 5.5 Flash (free)',
                context_length: 1_000_000,
                pricing: { prompt: '0', completion: '0' },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      const body = JSON.parse(String(init?.body || '{}')) as { model?: string };
      if ((body.model || '').includes('lightning')) {
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if ((body.model || '').includes('ernie')) {
        await new Promise((r) => setTimeout(r, 20));
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if ((body.model || '').includes('super-vl')) {
        await new Promise((r) => setTimeout(r, 30));
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('unavailable', { status: 503 });
    });

    const db = new InMemoryDatabase();
    const env = makeTestEnv({ __TEST_DB__: db });
    const app = createApp();
    const jwt = await createSessionToken(
      { sub: '1', email: 'owner@pyvren.com', displayName: 'Owner', tv: true },
      env.SESSION_SECRET!,
    );

    const probeRes = await app.fetch(
      new Request('https://pyvren.com/api/admin/models/probe', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Origin: 'https://pyvren.com',
          'X-Requested-With': 'PyvrenAdmin',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          models: [
            'nim/nvidia/nemotron-3.5-lightning-30b-a3b',
            'baidu/ernie-5.5-flash-preview:free',
            'nim/nvidia/nemotron-3.5-super-vl-120b-a12b',
          ],
          auto_apply: true,
        }),
      }),
      env,
    );

    expect(probeRes.status).toBe(200);
    const probeJson = (await probeRes.json()) as {
      providers: { openrouter: boolean; nvidia_nim: boolean };
      recommended: { main: string; fallback_1: string; fallback_2: string };
      settings?: { openrouter_model: string; fallback_model_1: string; fallback_model_2: string };
    };
    expect(probeJson.providers).toEqual({ openrouter: true, nvidia_nim: true });
    expect(probeJson.recommended.main).toBe('nim/nvidia/nemotron-3.5-lightning-30b-a3b');
    expect(probeJson.settings?.openrouter_model).toBe('nim/nvidia/nemotron-3.5-lightning-30b-a3b');
    expect(probeJson.settings?.fallback_model_1).toBe('baidu/ernie-5.5-flash-preview:free');
    expect(probeJson.settings?.fallback_model_2).toBe('nim/nvidia/nemotron-3.5-super-vl-120b-a12b');

    const listRes = await app.fetch(
      new Request('https://pyvren.com/api/admin/openrouter/free-models', {
        headers: { Authorization: `Bearer ${jwt}` },
      }),
      env,
    );
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as {
      providers: { openrouter: boolean; nvidia_nim: boolean };
      models: Array<{ id: string; provider?: string; latency_ms?: number }>;
      probe_results: Array<{ id: string; ok: boolean }>;
    };
    expect(listJson.providers.nvidia_nim).toBe(true);
    expect(listJson.models.some((m) => m.id.startsWith('nim/'))).toBe(true);
    expect(listJson.models.some((m) => m.id.endsWith(':free'))).toBe(true);
    expect(listJson.probe_results.length).toBeGreaterThanOrEqual(3);
  });
});
