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

  it('5. Blocks placeholder CVEs in linter and auto-improves + re-audits a 65/100 draft across two distinct families with category skill rules', async () => {
    const { lintPostPayload } = await import('../src/lib/linter');
    const { createEmptyTokenUsage, stageLoadContext, stageQualityAssessment } = await import('../src/lib/agent');

    const badBody = `# Summary\n\nPlaceholder CVE-2025-XXXX affects routers. See [CISA](https://www.cisa.gov/known-exploited-vulnerabilities-catalog), [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-42884), and [Cisco](https://sec.cloudapps.cisco.com/security/center/publicationListing.x).\n\n| Product | CVE |\n| --- | --- |\n| Cisco | CVE-2025-XXXX |\n\n` + 'Technical operational hardening details for incident responders. '.repeat(65);
    const badLint = lintPostPayload({
      title: 'CISA KEV Adds Four Actively Exploited Enterprise Flaws',
      description: 'Short description that is deliberately over one hundred seventy characters long so it also triggers the deterministic meta description lint check right alongside the placeholder CVE.',
      tldr_summary: 'Placeholder CVE-2025-XXXX summary.',
      key_facts: [
        { label: 'Flaws', value: '4' },
        { label: 'Catalog', value: 'CISA KEV' },
        { label: 'Priority', value: 'Patch now' },
      ],
      faq: [
        { question: 'What is affected?', answer: 'Four enterprise systems.' },
        { question: 'How do I patch?', answer: 'Apply vendor updates immediately.' },
      ],
      body_markdown: badBody,
      author: 'Hamdi Soudani',
      archetype: 'advisory-teardown',
      sources: [
        'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
        'https://nvd.nist.gov/vuln/detail/CVE-2025-42884',
      ],
    });
    expect(badLint.passed).toBe(false);
    expect(badLint.errors.some((e) => e.includes('CVE-YYYY-XXXX'))).toBe(true);

    const db = new InMemoryDatabase();
    const env = makeTestEnv({ __TEST_DB__: db, OPENROUTER_API_KEY: '' });
    const ctx = await stageLoadContext(db, {
      category_slug: 'dev-tooling-benchmarks',
      archetype: 'advisory-teardown',
      force: true,
    });
    ctx.model = 'nim/nvidia/nemotron-3.5-super-vl-120b-a12b';
    ctx.judgeModel = 'nim/minimaxai/minimax-m3.1-flash';
    ctx.fastestModels = [
      'nim/nvidia/nemotron-3.5-super-vl-120b-a12b',
      'nim/minimaxai/minimax-m3.1-flash',
      'nim/nvidia/nemotron-3-ultra-550b-a55b',
    ];

    const goodBody = `## Incident Timeline & Blast-Radius Table

Teams running Apache Roller, Cisco Expressway, SAP NetWeaver, and VMware vCenter face active exploitation tracked in the [CISA KEV catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog). Prioritize patching within 24 hours.

| Vendor | Product | Verified CVE | Action |
| --- | --- | --- | --- |
| SAP | NetWeaver | CVE-2025-42884 | Apply SAP Security Note |
| Broadcom | VMware vCenter | CVE-2024-38812 | Upgrade vCenter Server |
| Cisco | Expressway | CVE-2022-20812 | Upgrade to fixed release |

## Technical Root Cause & Attack Vector (Defensive Analysis)

According to [NVD CVE-2025-42884](https://nvd.nist.gov/vuln/detail/CVE-2025-42884) and the [Cisco Security Advisory](https://sec.cloudapps.cisco.com/security/center/publicationListing.x), attackers chain unauthenticated edge exposure with weak input validation to reach management planes. Keep administrative interfaces off public networks. Verify every ingress rule across staging and production clusters immediately.

\`\`\`bash
# Verify exposed management ports internally before patching
ss -tulpn | grep -E ':(443|8443|50000)'
\`\`\`

## Exact Patch, Upgrade & Verification Commands

Follow each vendor's verified release notes directly instead of ad-hoc scripts. Confirm package checksums after rollout. Track remediation completion across every cluster node with automated asset inventory checks.

## Detection Rules & Hardening Checklist

Audit outbound connections from vCenter and Expressway appliances for unexpected callbacks. Rotate service credentials after patching completes. Alert on anomalous administrative API calls across all four platforms. ` +
      'Short crisp verdict. Concrete infrastructure teams isolate management planes, verify signed vendor patches, audit outbound telemetry, and confirm zero unauthorized administrative sessions remain active after maintenance windows complete. '.repeat(14);

    let llmCalls = 0;
    const seenSystems: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      llmCalls++;
      const parsed = JSON.parse(String(init?.body || '{}')) as {
        model?: string;
        messages?: Array<{ role: string; content: string }>;
      };
      const sys = parsed.messages?.find((m) => m.role === 'system')?.content || '';
      const usr = parsed.messages?.find((m) => m.role === 'user')?.content || '';
      seenSystems.push(sys);

      // Revision pass (call #3)
      if (usr.includes('AUTO-IMPROVEMENT ROUND')) {
        return new Response(
          JSON.stringify({
            model: parsed.model,
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: 'CISA KEV Adds Four Actively Exploited Flaws: Patch Guide',
                    slug: 'cisa-kev-four-actively-exploited-flaws-patch-guide',
                    description:
                      'Defensive breakdown of four newly added CISA KEV flaws across SAP NetWeaver, VMware vCenter, Cisco Expressway, and Apache Roller with verified patching steps.',
                    tldr_summary:
                      'CISA added four actively exploited enterprise flaws including CVE-2025-42884 to KEV. Isolate management planes and apply vendor patches immediately.',
                    cover_image_url: null,
                    cover_image_alt: null,
                    images: [],
                    key_facts: [
                      { label: 'Verified CVE', value: 'CVE-2025-42884 (SAP NetWeaver)' },
                      { label: 'Catalog', value: 'CISA KEV (4 flaws added)' },
                      { label: 'Priority', value: 'Immediate patch & management-plane isolation' },
                    ],
                    faq: [
                      {
                        question: 'Which products are affected by the new CISA KEV additions?',
                        answer: 'SAP NetWeaver, VMware vCenter, Cisco Expressway, and Apache Roller.',
                      },
                      {
                        question: 'What is the immediate defensive step before maintenance?',
                        answer: 'Restrict management interfaces to internal VPN/bastion networks and audit logs.',
                      },
                    ],
                    body_markdown: goodBody,
                    tags: ['cisa-kev', 'cve', 'incident-response'],
                    keywords: ['cisa kev', 'cve-2025-42884', 'vmware vcenter', 'cisco expressway', 'sap netweaver'],
                    sources: [
                      'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
                      'https://nvd.nist.gov/vuln/detail/CVE-2025-42884',
                      'https://sec.cloudapps.cisco.com/security/center/publicationListing.x',
                    ],
                    review_notes: ['Replaced placeholder CVEs with verified IDs and fixed meta description length.'],
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Round 0 critics fail the placeholder draft; Round 1 critics pass the improved draft!
      const isImproved = !usr.includes('CVE-2025-XXXX');
      if (sys.includes('Critic 1')) {
        return new Response(
          JSON.stringify({
            model: parsed.model,
            choices: [
              {
                message: {
                  content: JSON.stringify(
                    isImproved
                      ? {
                          editorial_tone: 92,
                          factual_grounding: 94,
                          visuals_and_tables: 90,
                          verdict: 'pass',
                          blocking_issues: [],
                          concrete_fixes: [],
                          notes: 'All placeholder CVEs removed and category required sections verified.',
                        }
                      : {
                          editorial_tone: 55,
                          factual_grounding: 30,
                          visuals_and_tables: 60,
                          verdict: 'revise',
                          blocking_issues: ['Contains placeholder CVE-2025-XXXX'],
                          concrete_fixes: ['Replace CVE-2025-XXXX with verified CVE IDs'],
                          notes: 'Contains placeholder CVEs.',
                        },
                  ),
                },
              },
            ],
            usage: { prompt_tokens: 40, completion_tokens: 40, total_tokens: 80 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({
          model: parsed.model,
          choices: [
            {
              message: {
                content: JSON.stringify(
                  isImproved
                    ? {
                        seo_score: 91,
                        geo_clarity: 93,
                        adsense_safety: 96,
                        verdict: 'pass',
                        blocking_issues: [],
                        concrete_fixes: [],
                        notes: 'Clean meta description, verified citations, strictly defensive.',
                      }
                    : {
                        seo_score: 58,
                        geo_clarity: 60,
                        adsense_safety: 75,
                        verdict: 'revise',
                        blocking_issues: ['Meta description too long'],
                        concrete_fixes: ['Shorten description to 125-160 chars'],
                        notes: 'Meta description exceeds limit.',
                      },
                ),
              },
            },
          ],
          usage: { prompt_tokens: 40, completion_tokens: 40, total_tokens: 80 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const trace: import('../src/types').TraceEntry[] = [];
    const usage = createEmptyTokenUsage();
    const res = await stageQualityAssessment(
      env,
      ctx,
      {
        title: 'CISA KEV Adds Four Actively Exploited Enterprise Flaws',
        slug: 'cisa-kev-flaws',
        description:
          'Short description that is deliberately over one hundred seventy characters long so it also triggers the deterministic meta description lint check right alongside the placeholder CVE.',
        tldr_summary: 'Placeholder CVE-2025-XXXX summary.',
        cover_image_url: null,
        cover_image_alt: null,
        images: [],
        key_facts: [
          { label: 'Flaws', value: '4' },
          { label: 'Catalog', value: 'CISA KEV' },
          { label: 'Priority', value: 'Patch now' },
        ],
        faq: [
          { question: 'What is affected?', answer: 'Four enterprise systems.' },
          { question: 'How do I patch?', answer: 'Apply vendor updates immediately.' },
        ],
        body_markdown: badBody,
        tags: ['cisa-kev'],
        keywords: ['cisa kev'],
        sources: [
          'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
          'https://nvd.nist.gov/vuln/detail/CVE-2025-42884',
        ],
        review_notes: [],
      },
      badLint,
      trace,
      usage,
      [
        {
          url: 'https://nvd.nist.gov/vuln/detail/CVE-2025-42884',
          title: 'NVD CVE-2025-42884',
          markdown: 'SAP NetWeaver CVE-2025-42884 active exploitation.',
          chars: 120,
        },
      ],
      { reAuditAfterRevision: true, maxImprovementRounds: 2 },
    );

    // Critics saw the category's exact required sections
    expect(seenSystems.some((s) => s.includes('CATEGORY REQUIRED SECTIONS'))).toBe(true);
    // 2 initial critics + 1 revision + 2 re-audit critics = 5 calls, then early-exited cleanly!
    expect(llmCalls).toBe(5);
    expect(res.revisedLintResult?.passed).toBe(true);
    expect(res.finalScore).toBeGreaterThanOrEqual(85);
    expect(res.finalBreakdown.dual_critic_review?.cross_family_verified).toBe(true);
    expect(res.finalBreakdown.dual_critic_review?.revision_applied).toBe(true);
  });
});
