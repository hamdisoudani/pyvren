import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createApp, shouldExecuteScheduledDiscovery } from '../src/index';
import type { WorkerEnv } from '../src/env';
import { DEFAULT_SEEDED_SETTINGS, InMemoryDatabase } from '../src/lib/db';
import {
  computeTopicSimilarity,
  filterUncoveredCandidates,
  findDuplicatePost,
  normalizeCanonicalUrl,
} from '../src/lib/dedup';
import { resetRateLimitsForTests } from '../src/lib/security';
import { fetchAuthoritativeFeed, parseRssOrAtomXml } from '../src/lib/tools';
import { resetAdminLoginLockoutsForTests } from '../src/routes/admin';
import { EditorialAgentWorkflow } from '../src/workflows/agent-workflow';

const ADMIN_TOKEN = 'security-audit-admin-token-987654321';
const TEST_OWNER_EMAIL = 'owner@pyvren.com';
const TEST_OWNER_PASSWORD = 'TestOwnerSecret!2026';

describe('Principal Audit Suite: Security Hardening, Smart Schedule, Post Memory Dedup, No-News Skip Gate & Bot Crawling', () => {
  beforeEach(() => {
    resetRateLimitsForTests();
    resetAdminLoginLockoutsForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetRateLimitsForTests();
    resetAdminLoginLockoutsForTests();
  });

  it('1. Enforces env-locked auth (bootstrap 403), blocks cross-origin cookie CSRF (403), enforces IP rate limit & owner lockout (429), and sets strict CSP/HSTS/Frame headers', async () => {
    const db = new InMemoryDatabase();
    const app = createApp();
    const env: WorkerEnv = {
      __TEST_DB__: db,
      ADMIN_TOKEN,
      ADMIN_EMAIL: TEST_OWNER_EMAIL,
      ADMIN_PASSWORD: TEST_OWNER_PASSWORD,
      ADMIN_DISPLAY_NAME: 'Hamdi Soudani',
      SESSION_SECRET: 'csrf-and-csp-test-secret-0123456789abcdef',
      BASE_URL: 'https://pyvren.com',
    };

    // Auth status ALWAYS reports initialized: true with env_locked mode
    const statusRes = await app.request('https://pyvren.com/api/admin/auth/status', {}, env);
    expect(statusRes.status).toBe(200);
    expect(await statusRes.json()).toEqual({
      initialized: true,
      authenticated: false,
      locked_mode: 'env_locked',
    });

    // Bootstrap registration endpoint MUST ALWAYS return 403
    const boot = await app.request(
      'https://pyvren.com/api/admin/auth/bootstrap',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://pyvren.com',
        },
        body: JSON.stringify({
          email: TEST_OWNER_EMAIL,
          password: TEST_OWNER_PASSWORD,
          display_name: 'Hamdi Soudani',
        }),
      },
      env,
    );
    expect(boot.status).toBe(403);

    // Sign in with env-locked owner credentials to obtain HttpOnly session cookie & JWT
    const login = await app.request(
      'https://pyvren.com/api/admin/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://pyvren.com',
        },
        body: JSON.stringify({
          email: TEST_OWNER_EMAIL,
          password: TEST_OWNER_PASSWORD,
        }),
      },
      env,
    );
    expect(login.status).toBe(200);
    const setCookie = login.headers.get('set-cookie') || '';
    expect(setCookie).toContain('HttpOnly');
    const cookiePair = setCookie.split(';')[0];
    expect(cookiePair).toContain('pyvren_session=');
    const loginData = (await login.json()) as { ok: boolean; email: string; token: string };
    expect(loginData.ok).toBe(true);
    expect(loginData.email).toBe(TEST_OWNER_EMAIL);
    expect(loginData.token).toBeTruthy();

    // JWT authenticates /api/admin/settings
    const jwtSettings = await app.request(
      'https://pyvren.com/api/admin/settings',
      {
        headers: { Authorization: `Bearer ${loginData.token}` },
      },
      env,
    );
    expect(jwtSettings.status).toBe(200);

    // Cross-origin POST/PUT using valid session cookie MUST be rejected with 403 CSRF guard!
    const csrfAttack = await app.request(
      'https://pyvren.com/api/admin/settings',
      {
        method: 'PUT',
        headers: {
          Cookie: cookiePair,
          Origin: 'https://evil-attacker.example',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publishing_mode: 'auto_publish' }),
      },
      env,
    );
    expect(csrfAttack.status).toBe(403);

    // Sec-Fetch-Site: cross-site MUST also be rejected with 403!
    const secFetchAttack = await app.request(
      'https://pyvren.com/api/admin/settings',
      {
        method: 'PUT',
        headers: {
          Cookie: cookiePair,
          'Sec-Fetch-Site': 'cross-site',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publishing_mode: 'auto_publish' }),
      },
      env,
    );
    expect(secFetchAttack.status).toBe(403);

    // Legitimate same-origin cookie PUT succeeds (200)
    const legitPut = await app.request(
      'https://pyvren.com/api/admin/settings',
      {
        method: 'PUT',
        headers: {
          Cookie: cookiePair,
          Origin: 'https://pyvren.com',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ max_posts_per_day: 3 }),
      },
      env,
    );
    expect(legitPut.status).toBe(200);

    // Verify CSP + X-Frame-Options: DENY on public routes vs SAMEORIGIN on /api/admin/preview/:id
    const homeRes = await app.request('https://pyvren.com/', {}, env);
    expect(homeRes.headers.get('x-frame-options')).toBe('DENY');
    expect(homeRes.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(homeRes.headers.get('strict-transport-security')).toContain('max-age=31536000');

    // IP Rate limit on /api/admin/auth/login triggers 429 after 15 requests from same IP
    let saw429 = false;
    for (let i = 0; i < 18; i++) {
      const r = await app.request(
        'https://pyvren.com/api/admin/auth/login',
        {
          method: 'POST',
          headers: {
            'cf-connecting-ip': '203.0.113.77',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: `unknown-${i}@example.org`,
            password: 'WrongPassword!1234',
          }),
        },
        env,
      );
      if (r.status === 429) {
        saw429 = true;
        expect(r.headers.get('retry-after')).toBeTruthy();
        break;
      }
    }
    expect(saw429).toBe(true);

    // Per-owner brute-force lockout: 5 consecutive wrong passwords on owner email trigger 429 + Retry-After
    for (let i = 0; i < 5; i++) {
      const bad = await app.request(
        'https://pyvren.com/api/admin/auth/login',
        {
          method: 'POST',
          headers: {
            'cf-connecting-ip': '198.51.100.42',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: TEST_OWNER_EMAIL,
            password: 'WrongPassword!1234',
          }),
        },
        env,
      );
      expect(bad.status).toBe(401);
    }
    const lockedRes = await app.request(
      'https://pyvren.com/api/admin/auth/login',
      {
        method: 'POST',
        headers: {
          'cf-connecting-ip': '198.51.100.42',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: TEST_OWNER_EMAIL,
          password: TEST_OWNER_PASSWORD,
        }),
      },
      env,
    );
    expect(lockedRes.status).toBe(429);
    expect(lockedRes.headers.get('retry-after')).toBeTruthy();
  });

  it('2. Governs scheduled discovery slots ([8, 14, 20] UTC), daily post caps, cooldowns, and active-run concurrency locks (409)', async () => {
    const baseSettings = {
      ...DEFAULT_SEEDED_SETTINGS,
      schedule_enabled: true,
      runs_per_day: 3,
      preferred_hours_utc_json: [8, 14, 20],
      max_posts_per_day: 2,
      last_scheduled_run_at: null,
    };

    // Outside preferred UTC hours (e.g. 11:00 UTC) -> skipped
    expect(
      shouldExecuteScheduledDiscovery(baseSettings, new Date('2026-11-20T11:00:00Z'), 0, false),
    ).toEqual({ shouldRun: false, reason: 'outside_preferred_utc_hour' });

    // Matching preferred UTC hour (14:00 UTC) -> runs!
    expect(
      shouldExecuteScheduledDiscovery(baseSettings, new Date('2026-11-20T14:00:00Z'), 1, false),
    ).toEqual({ shouldRun: true, reason: 'scheduled_slot_matched' });

    // Daily post cap reached (2/2) -> skipped!
    expect(
      shouldExecuteScheduledDiscovery(baseSettings, new Date('2026-11-20T20:00:00Z'), 2, false),
    ).toEqual({ shouldRun: false, reason: 'daily_post_cap_reached' });

    // Active run already in progress -> skipped!
    expect(
      shouldExecuteScheduledDiscovery(baseSettings, new Date('2026-11-20T08:00:00Z'), 0, true),
    ).toEqual({ shouldRun: false, reason: 'active_run_in_progress' });

    // Double-fire within 45-minute cooldown -> skipped!
    expect(
      shouldExecuteScheduledDiscovery(
        { ...baseSettings, last_scheduled_run_at: '2026-11-20T14:00:05Z' },
        new Date('2026-11-20T14:20:00Z'),
        0,
        false,
      ).shouldRun,
    ).toBe(false);

    // Concurrency guard on POST /api/admin/agent/run returns 409 when an active run exists (unless force=true)
    const db = new InMemoryDatabase();
    await db.createAgentRun({
      trigger_source: 'manual',
      category_slug: 'ai-llms',
      topic: 'In-flight benchmark run',
      archetype: 'benchmark-index',
      model_used: 'openrouter/free',
      status: 'running',
      current_stage: 'deep_research',
    });

    const app = createApp();
    const env: WorkerEnv = {
      __TEST_DB__: db,
      ADMIN_TOKEN,
      SESSION_SECRET: 'concurrency-test-secret-0123456789abcdef',
    };

    const conflictRes = await app.request(
      '/api/admin/agent/run',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category_slug: 'ai-llms' }),
      },
      env,
    );
    expect(conflictRes.status).toBe(409);
  });

  it('3. Post Memory Deduplication & Autonomous "No Real News -> Skip Without Writing" Gate (0 drafting tokens burned)', async () => {
    // Unit-verify canonical URL normalization & similarity deduplication
    expect(
      normalizeCanonicalUrl('https://www.GitHub.com/modelcontextprotocol/servers/?utm_source=hn&ref=123#readme'),
    ).toBe('https://github.com/modelcontextprotocol/servers');

    expect(
      computeTopicSimilarity(
        'CVE-2026-44112 Critical RCE in vLLM Engine',
        'Patching vLLM Remote Code Execution Advisory CVE-2026-44112',
      ),
    ).toBeGreaterThanOrEqual(0.85);

    const db = new InMemoryDatabase();
    // Seed an existing post in DB so the agent's Editorial Memory knows what it already wrote!
    const existingPost = await db.createPost({
      slug: 'cli-vs-mcp-token-overhead-benchmark',
      title: 'CLI vs MCP Token Overhead & Failure Rates in Coding Agents',
      description: 'Detailed token benchmark comparing Unix CLI against Model Context Protocol servers.',
      tldr_summary: 'CLI uses ~200 tokens per command vs 32k+ for MCP.',
      key_facts_json: [],
      faq_json: [],
      body_markdown: 'Existing body',
      body_html: '<p>Existing body</p>',
      author: 'Hamdi Soudani',
      category_slug: 'ai-coding-agents-mcp',
      archetype: 'benchmark-index',
      tags_json: ['mcp', 'cli'],
      keywords_json: ['cli vs mcp token overhead', 'mcp benchmark'],
      sources_json: ['https://github.com/scalekit-inc/mcp-vs-cli-benchmark'],
      review_notes_json: [],
      lint_passed: true,
      lint_errors_json: [],
      quality_score: 94,
      quality_breakdown_json: {
        overall: 94,
        seo_structure: 95,
        geo_citation_readiness: 95,
        information_gain: 90,
        source_grounding: 95,
        anti_slop_cleanliness: 96,
        adsense_compliance: 100,
        warnings: [],
      },
      reading_time_minutes: 4,
      word_count: 800,
      status: 'published',
      admin_locked: false,
      last_edited_by: null,
      published_at: new Date().toISOString(),
    });

    const dupCheck = findDuplicatePost(
      {
        title: 'Benchmarking MCP vs CLI Token Overhead in AI Coding Agents (2026)',
        urls: ['https://github.com/scalekit-inc/mcp-vs-cli-benchmark?utm_medium=social'],
      },
      [existingPost],
    );
    expect(dupCheck.isDuplicate).toBe(true);

    const filtered = filterUncoveredCandidates(
      [
        {
          title: 'CLI vs MCP Token Overhead Benchmark Report',
          url: 'https://github.com/scalekit-inc/mcp-vs-cli-benchmark',
        },
      ],
      [existingPost],
      [],
    );
    expect(filtered.fresh.length).toBe(0);
    expect(filtered.filteredOutCount).toBe(1);

    // Case A: All feed & search items were already covered -> Workflow skips with 0 OpenRouter calls & 0 new posts!
    let llmCallCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('openrouter.ai/api/v1/chat/completions')) {
        llmCallCount++;
      }
      // Return only the already-covered item in feeds & empty search
      if (url.includes('api.github.com/search/repositories')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                full_name: 'scalekit-inc/mcp-vs-cli-benchmark',
                html_url: 'https://github.com/scalekit-inc/mcp-vs-cli-benchmark',
                description: 'CLI vs MCP token overhead benchmark',
                stargazers_count: 900,
                pushed_at: new Date().toISOString(),
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('hn.algolia.com')) {
        return new Response(JSON.stringify({ hits: [] }), { status: 200 });
      }
      if (url.includes('export.arxiv.org')) {
        return new Response('<feed></feed>', { status: 200 });
      }
      return new Response('<html><body></body></html>', { status: 200 });
    });

    const executedSteps: string[] = [];
    const mockStep = {
      async do<T>(name: string, configOrFn: unknown, maybeFn?: () => Promise<T>): Promise<T> {
        const fn = typeof configOrFn === 'function' ? (configOrFn as () => Promise<T>) : maybeFn!;
        executedSteps.push(name);
        return await fn();
      },
    };

    const wf = new EditorialAgentWorkflow(
      {} as ExecutionContext,
      { __TEST_DB__: db, OPENROUTER_API_KEY: 'sk-or-v1-test' },
    );
    const skipOutcome = await wf.run(
      {
        payload: { category_slug: 'ai-coding-agents-mcp', trigger_source: 'scheduled' },
        timestamp: new Date(),
        instanceId: 'wf-skip-test-001',
        workflowName: 'editorial-agent-workflow',
      } as never,
      mockStep as never,
    );

    expect(skipOutcome.status).toBe('skipped');
    expect(skipOutcome.postId).toBeNull();
    expect(llmCallCount).toBe(0); // Zero LLM calls wasted when all candidates were already covered!
    expect(executedSteps).toEqual(['load-context', 'hunt-topics', 'finalize-skipped-run']);
    expect(await db.countPosts()).toBe(1); // Still only the 1 original post!

    const runs = await db.listAgentRuns(5);
    expect(runs[0].status).toBe('skipped');
    expect(runs[0].decision_reason).toBeTruthy();

    // Case B: Uncovered item exists, but Editor-in-Chief judges novelty_score = 38 (< 68) -> Skips without writing!
    vi.restoreAllMocks();
    let lowNoveltyLlmCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('openrouter.ai/api/v1/chat/completions')) {
        lowNoveltyLlmCalls++;
        return new Response(
          JSON.stringify({
            model: 'openrouter/free',
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    decision: 'skip_no_news',
                    novelty_score: 38,
                    newsworthiness_score: 30,
                    skip_reason: 'Only minor typo fix release notes found today; no substantive benchmark or architecture shift.',
                    topic: '',
                    angle: '',
                    search_queries: [],
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 350, completion_tokens: 45, total_tokens: 395 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('hn.algolia.com')) {
        return new Response(
          JSON.stringify({
            hits: [
              {
                objectID: '9991',
                title: 'Minor README typo update in sample CLI wrapper',
                url: 'https://docs.example-infra.org/changelog/readme-fix',
                points: 35,
                num_comments: 4,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('<feed></feed>', { status: 200 });
    });

    const app = createApp();
    const syncSkipRes = await app.request(
      '/api/admin/agent/run?sync=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category_slug: 'ai-coding-agents-mcp' }),
      },
      { __TEST_DB__: db, ADMIN_TOKEN, OPENROUTER_API_KEY: 'sk-or-v1-test' },
    );
    expect(syncSkipRes.status).toBe(200);
    const syncSkipData = (await syncSkipRes.json()) as {
      skipped: boolean;
      post: unknown;
      run: { status: string; decision_reason: string };
    };
    expect(syncSkipData.skipped).toBe(true);
    expect(syncSkipData.post).toBeNull();
    expect(syncSkipData.run.status).toBe('skipped');
    expect(syncSkipData.run.decision_reason).toContain('typo');
    expect(lowNoveltyLlmCalls).toBe(1); // Only 1 tiny triage call — Stages 3/4/5/6 skipped!
  });

  it('4. Parses category-specialized feeds (RSS 2.0 CDATA, OpenRouter newest models, Cloudflare Changelog) cleanly', async () => {
    const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title><![CDATA[Cloudflare Workflows Adds 4-Minute Step Budgets]]></title>
            <link>https://developers.cloudflare.com/changelog/2026-11-workflows/</link>
            <description><![CDATA[<p>Durable execution steps now support longer LLM reasoning windows.</p>]]></description>
            <pubDate>Fri, 20 Nov 2026 12:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;
    const rssItems = parseRssOrAtomXml(sampleRss);
    expect(rssItems.length).toBe(1);
    expect(rssItems[0].title).toBe('Cloudflare Workflows Adds 4-Minute Step Budgets');
    expect(rssItems[0].url).toBe('https://developers.cloudflare.com/changelog/2026-11-workflows/');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('openrouter.ai/api/v1/models')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'deepseek/deepseek-r2:free',
                name: 'DeepSeek R2 (free)',
                created: 1795000000,
                context_length: 262144,
                pricing: { prompt: '0', completion: '0' },
                description: 'Open-weights reasoning model.',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(sampleRss, { status: 200, headers: { 'Content-Type': 'application/xml' } });
    });

    const orItems = await fetchAuthoritativeFeed('openrouter_newest_models');
    expect(orItems.length).toBe(1);
    expect(orItems[0].title).toContain('DeepSeek R2');
    expect(orItems[0].url).toBe('https://openrouter.ai/deepseek/deepseek-r2:free');

    const cfItems = await fetchAuthoritativeFeed('cloudflare_changelog_rss');
    expect(cfItems.length).toBe(1);
    expect(cfItems[0].title).toContain('Cloudflare Workflows');
  });

  it('5. Verifies SEO & Bot-Crawling perfection (/favicon.svg, /og/:slug.svg, /news-sitemap.xml, /feed.json, /.well-known/llms.txt, Mediapartners-Google, Accept: text/markdown, single robots meta)', async () => {
    const db = new InMemoryDatabase();
    const app = createApp();
    const env: WorkerEnv = {
      __TEST_DB__: db,
      ADMIN_TOKEN,
      SESSION_SECRET: 'seo-bot-test-secret-0123456789abcdef',
      BASE_URL: 'https://pyvren.com',
    };

    const created = await db.createPost({
      slug: 'edge-kv-cache-quantization-benchmarks',
      title: 'FP8 vs Q4 KV-Cache Memory Math on Single-Node GPUs',
      description: 'Measured throughput and perplexity retention for quantized KV-caches across 32k-128k contexts.',
      tldr_summary: 'FP8 KV-cache cuts memory by 48% with <0.2% accuracy delta on SWE-bench.',
      key_facts_json: [{ label: 'Memory Reduction', value: '48% at 64k context' }],
      faq_json: [{ question: 'Does FP8 hurt coding accuracy?', answer: 'Under 0.2% variance on SWE-bench Verified.' }],
      body_markdown: '## Memory Math\n\nFP8 halves KV footprint.',
      body_html: '<h2 id="memory-math">Memory Math</h2><p>FP8 halves KV footprint.</p>',
      author: 'Hamdi Soudani',
      category_slug: 'ai-llms',
      archetype: 'benchmark-index',
      tags_json: ['kv-cache', 'fp8'],
      keywords_json: ['fp8 kv cache', 'vllm memory math'],
      sources_json: ['https://arxiv.org/abs/2601.00001'],
      review_notes_json: [],
      lint_passed: true,
      lint_errors_json: [],
      quality_score: 95,
      quality_breakdown_json: {
        overall: 95,
        seo_structure: 98,
        geo_citation_readiness: 95,
        information_gain: 92,
        source_grounding: 94,
        anti_slop_cleanliness: 96,
        adsense_compliance: 100,
        warnings: [],
      },
      reading_time_minutes: 5,
      word_count: 920,
      status: 'published',
      admin_locked: true,
      last_edited_by: 'owner@pyvren.com',
      published_at: new Date().toISOString(),
    });

    // 1. Favicon & Dynamic OG SVG cards
    const [favRes, ogDefRes, ogPostRes, ogMissingRes] = await Promise.all([
      app.request('/favicon.svg', {}, env),
      app.request('/og/default.svg', {}, env),
      app.request(`/og/${created.slug}.svg`, {}, env),
      app.request('/og/non-existent-draft.svg', {}, env),
    ]);
    expect(favRes.status).toBe(200);
    expect(favRes.headers.get('content-type')).toContain('image/svg+xml');
    expect(ogDefRes.status).toBe(200);
    expect(ogPostRes.status).toBe(200);
    expect(await ogPostRes.text()).toContain('FP8 vs Q4 KV-Cache');
    expect(ogMissingRes.status).toBe(404);

    // 2. News Sitemap, JSON Feed 1.1, .well-known/llms.txt, and AdSense Mediapartners-Google in robots.txt
    const [newsRes, jsonFeedRes, wellKnownRes, robotsRes] = await Promise.all([
      app.request('/news-sitemap.xml', {}, env),
      app.request('/feed.json', {}, env),
      app.request('/.well-known/llms.txt', {}, env),
      app.request('/robots.txt', {}, env),
    ]);
    const [newsXml, wellKnownLlms, robotsTxt] = await Promise.all([
      newsRes.text(),
      wellKnownRes.text(),
      robotsRes.text(),
    ]);
    expect(newsXml).toContain('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"');
    expect(newsXml).toContain(created.slug);
    expect(jsonFeedRes.status).toBe(200);
    const jsonFeed = (await jsonFeedRes.json()) as { version: string; items: Array<{ url: string }> };
    expect(jsonFeed.version).toContain('jsonfeed.org/version/1.1');
    expect(jsonFeed.items[0].url).toContain(created.slug);
    expect(wellKnownLlms).toContain(created.slug);
    expect(robotsTxt).toContain('Mediapartners-Google');
    expect(robotsTxt).toContain('news-sitemap.xml');

    // 3. Content negotiation on /blog/:slug: AI Agent (Accept: text/markdown) vs Browser/Googlebot (Accept: text/html)
    const aiAgentRes = await app.request(
      `/blog/${created.slug}`,
      { headers: { Accept: 'text/markdown' } },
      env,
    );
    expect(aiAgentRes.status).toBe(200);
    expect(aiAgentRes.headers.get('content-type')).toContain('text/markdown');
    expect(await aiAgentRes.text()).toContain('title: "FP8 vs Q4 KV-Cache Memory Math on Single-Node GPUs"');

    const browserRes = await app.request(
      `/blog/${created.slug}`,
      { headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' } },
      env,
    );
    expect(browserRes.status).toBe(200);
    expect(browserRes.headers.get('content-type')).toContain('text/html');
    expect(browserRes.headers.get('link')).toContain(`rel="alternate"; type="text/markdown"`);
    const browserHtml = await browserRes.text();
    expect(browserHtml).toContain(`property="og:image" content="https://pyvren.com/og/${created.slug}.svg"`);
    expect(browserHtml).toContain('rel="preload" as="style"'); // Non-blocking Google Fonts!
    expect(browserHtml).toContain('id="reading-progress"');

    // 4. 404 page has ONLY ONE <meta name="robots"> tag (noindex, follow) — zero conflict!
    const notFoundRes = await app.request('/blog/does-not-exist-anywhere', {}, env);
    expect(notFoundRes.status).toBe(404);
    const notFoundHtml = await notFoundRes.text();
    const robotsMetaTags = notFoundHtml.match(/<meta\s+name="robots"[^>]*>/gi) || [];
    expect(robotsMetaTags.length).toBe(1);
    expect(robotsMetaTags[0]).toContain('noindex');
  });
});
