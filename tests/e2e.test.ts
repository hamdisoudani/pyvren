import { describe, expect, it, beforeEach } from 'vitest';
import { createApp } from '../src/index';
import type { WorkerEnv } from '../src/env';
import { InMemoryDatabase } from '../src/lib/db';
import { isSafePublicUrl } from '../src/lib/security';
import { readPrimaryWebpage } from '../src/lib/tools';

const ADMIN_TOKEN = 'test-super-secret-admin-token-9876543210';

const COMPLIANT_MARKDOWN = `
Cloudflare Workers isolates execute V8 bytecode with sub-millisecond startup while offloading network I/O wait time from the CPU accounting window. According to the [Cloudflare Workers Limits Documentation](https://developers.cloudflare.com/workers/platform/limits/), paid invocations allow up to 30 seconds of default CPU time and configurable bursts up to 5 minutes, while time spent awaiting external HTTP calls to OpenRouter or Supabase does not burn the CPU budget.

## Measured CPU Budget vs Wall-Clock Latency in Multi-Step Agents

During a typical autonomous research run, the Worker orchestrates three authoritative feed queries, fetches four primary engineering documents, executes three OpenRouter model completions, and compiles sanitized HTML. Benchmark measurements from [Cloudflare Workflows Durable Execution Docs](https://developers.cloudflare.com/workflows/get-started/durable-agents/) demonstrate that decomposing each stage into an independent durable step eliminates single-request timeout failures and isolates retry policies per upstream provider.

| Stage | Wall-Clock Duration | Actual V8 CPU Time | Retry Boundary |
| :--- | :--- | :--- | :--- |
| Topic Hunt + Feed Parse | 3.2s | 8ms | step.do("hunt-topics") |
| Primary Source Extraction | 11.4s | 22ms | step.do("deep-research") |
| OpenRouter Draft + Lint Loop | 28.6s | 18ms | step.do("draft-and-refine") |
| Quality Audit + Supabase Persist | 6.1s | 9ms | step.do("persist-and-gate") |

## Durable Step Isolation and Supabase PostgREST Pooling

Traditional PostgreSQL TCP connection pools suffer cold-wake socket resets when serverless databases suspend idle compute. By routing edge queries through the [Supabase PostgREST API Reference](https://supabase.com/docs/guides/api) over HTTP/2 with strict Row Level Security policies on public tables, edge workers avoid TCP handshake overhead entirely and maintain predictable p95 latency across global points of presence.

\`\`\`json
{
  "name": "pyvren",
  "limits": { "cpu_ms": 30000 },
  "triggers": { "crons": ["0 */4 * * *"] },
  "workflows": [
    {
      "name": "editorial-agent-workflow",
      "binding": "EDITORIAL_AGENT_WORKFLOW",
      "class_name": "EditorialAgentWorkflow"
    }
  ]
}
\`\`\`

## Hard Security Boundaries for Autonomous Publishing

Every external fetch performed during source discovery must enforce protocol pinning and IP range filtering before opening an outbound socket. Referencing the [OWASP Server-Side Request Forgery Prevention Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), disabling automatic HTTP redirect following and re-validating each redirect hop stops cloud metadata exfiltration attacks against link-local addresses. Meanwhile, pre-compiling Markdown into allowlist-sanitized HTML prevents stored cross-site scripting payloads from reaching public readers or search crawlers.

Operational teams deploying this pattern should keep editorial publishing in draft review mode until at least twenty agent runs pass deterministic linting without manual intervention. Monitoring token budgets per run, validating deep primary citations, and enforcing minimum quality scores keeps automated research accurate, verifiable, and resilient against search spam filters over long operating horizons.
`.trim();

function makeCompliantPostPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Cloudflare Workers CPU Budgets for Durable LLM Research Agents',
    description:
      'Quantitative breakdown of Cloudflare Workers CPU time versus wall-clock I/O latency, Workflows durability, and Supabase PostgREST edge architecture.',
    tldr_summary:
      'Cloudflare Workers isolates bill only active CPU time, allowing 30-90 second OpenRouter and research I/O agents to run reliably inside durable Workflows using under 60ms of total CPU.',
    key_facts: [
      {
        label: 'Paid Worker CPU Limit',
        value: '30s default (up to 5 min configurable)',
        source_url: 'https://developers.cloudflare.com/workers/platform/limits/',
      },
      {
        label: 'Typical Agent V8 CPU Usage',
        value: '40ms - 120ms across full 6-stage run',
      },
      {
        label: 'Database Transport',
        value: 'Supabase PostgREST over HTTP/2 with RLS',
        source_url: 'https://supabase.com/docs/guides/api',
      },
    ],
    faq: [
      {
        question: 'Does waiting on OpenRouter API responses count toward Cloudflare Workers CPU limits?',
        answer:
          'No. Cloudflare Workers measures active CPU execution time rather than idle wall-clock time spent waiting on network I/O.',
      },
      {
        question: 'Why use Cloudflare Workflows for an autonomous research agent?',
        answer:
          'Workflows isolates each research, drafting, and persistence stage into independently retryable steps so transient upstream errors never discard prior work.',
      },
    ],
    body_markdown: COMPLIANT_MARKDOWN,
    author: 'Hamdi Soudani',
    category_slug: 'cloud-gpu-infra',
    archetype: 'benchmark-index',
    tags: ['cloudflare-workers', 'workflows', 'supabase', 'openrouter'],
    sources: [
      'https://developers.cloudflare.com/workers/platform/limits/',
      'https://developers.cloudflare.com/workflows/get-started/durable-agents/',
      'https://supabase.com/docs/guides/api',
      'https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html',
    ],
    review_notes: [
      'Verify Cloudflare Workers CPU limit numbers against latest platform limits doc.',
      'Spot-check Supabase PostgREST RLS policy isolates draft posts from anon role.',
      'Confirm wrangler.jsonc workflow binding matches exported class name.',
    ],
    ...overrides,
  };
}

describe('Pyvren Autonomous Editorial Platform — Full E2E Verification Suite', () => {
  let app: ReturnType<typeof createApp>;
  let db: InMemoryDatabase;
  let env: WorkerEnv;

  beforeEach(() => {
    db = new InMemoryDatabase();
    app = createApp();
    env = {
      __TEST_DB__: db,
      ADMIN_TOKEN,
      SESSION_SECRET: 'e2e-test-session-secret-with-plenty-of-entropy-123456',
      BASE_URL: 'https://pyvren.com',
      SITE_NAME: 'Pyvren Research',
    };
  });

  const req = async (path: string, init?: RequestInit): Promise<Response> =>
    app.request(path, init, env);

  const authHeaders = (extra: Record<string, string> = {}) => ({
    Authorization: `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json',
    ...extra,
  });

  it('1. Rejects unauthenticated /api/admin/settings with 401 + noindex, accepts valid Bearer token', async () => {
    const unauth = await req('/api/admin/settings');
    expect(unauth.status).toBe(401);
    expect(unauth.headers.get('x-robots-tag')).toBe('noindex, nofollow');

    const authed = await req('/api/admin/settings', {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(authed.status).toBe(200);
    expect(authed.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    const data = (await authed.json()) as { publishing_mode: string };
    expect(data.publishing_mode).toBe('draft_review');
  });

  it('2. Enforces single-admin bootstrap lock & permanently disables registration afterward', async () => {
    const statusBefore = await req('/api/admin/auth/status');
    expect(statusBefore.status).toBe(200);
    expect(await statusBefore.json()).toMatchObject({
      initialized: false,
      authenticated: false,
    });

    // Reject weak password
    const weakRes = await req('/api/admin/auth/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@pyvren.com',
        password: 'short',
        display_name: 'Hamdi Soudani',
      }),
    });
    expect(weakRes.status).toBe(400);

    // Bootstrap single owner
    const bootRes = await req('/api/admin/auth/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@pyvren.com',
        password: 'StrongOwnerPassword!2026',
        display_name: 'Hamdi Soudani',
      }),
    });
    expect(bootRes.status).toBe(201);
    const setCookie = bootRes.headers.get('set-cookie') || '';
    expect(setCookie).toContain('pyvren_session=');
    expect(setCookie).toContain('HttpOnly');
    const bootJson = (await bootRes.json()) as { token: string; email: string };
    expect(bootJson.email).toBe('owner@pyvren.com');
    expect(bootJson.token).toBeTruthy();

    // Second registration attempt MUST be permanently forbidden (403)
    const secondReg = await req('/api/admin/auth/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'attacker@evil.com',
        password: 'AnotherStrongPassword!2026',
      }),
    });
    expect(secondReg.status).toBe(403);

    // JWT token from bootstrap authenticates admin endpoints
    const jwtCheck = await req('/api/admin/settings', {
      headers: { Authorization: `Bearer ${bootJson.token}` },
    });
    expect(jwtCheck.status).toBe(200);

    // Login brute-force protection: 5 bad passwords lock the account (429)
    for (let i = 0; i < 5; i++) {
      const bad = await req('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'owner@pyvren.com',
          password: 'WrongPassword!9999',
        }),
      });
      expect(bad.status).toBe(401);
    }
    const locked = await req('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@pyvren.com',
        password: 'StrongOwnerPassword!2026',
      }),
    });
    expect(locked.status).toBe(429);
  });

  it('3-8. Full Draft -> Preview -> Publish -> ETag 304 -> SEO/GEO/Headless lifecycle', async () => {
    // 3. Create compliant post in draft_review mode -> saved as draft, lint_passed=true
    const createRes = await req('/api/admin/posts', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(makeCompliantPostPayload()),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      id: number;
      slug: string;
      status: string;
      lint_passed: boolean;
      quality_score: number;
      lint_errors_json: string[];
    };
    expect(created.status).toBe('draft');
    expect(created.lint_passed).toBe(true);
    expect(created.lint_errors_json).toEqual([]);
    expect(created.quality_score).toBeGreaterThanOrEqual(80);

    // 4. Draft MUST 404 on /blog/:slug and /blog/:slug.md and NEVER leak in feeds/APIs
    const draftPublic = await req(`/blog/${created.slug}`);
    expect(draftPublic.status).toBe(404);

    const draftMd = await req(`/blog/${created.slug}.md`);
    expect(draftMd.status).toBe(404);

    const draftApi = await req(`/api/v1/posts/${created.slug}`);
    expect(draftApi.status).toBe(404);

    const [sitemapDraft, rssDraft, llmsDraft] = await Promise.all([
      req('/sitemap.xml').then((r) => r.text()),
      req('/rss.xml').then((r) => r.text()),
      req('/llms.txt').then((r) => r.text()),
    ]);
    expect(sitemapDraft).not.toContain(created.slug);
    expect(rssDraft).not.toContain(created.slug);
    expect(llmsDraft).not.toContain(created.slug);

    // 5. Admin preview returns 200 with compiled HTML table/code + noindex
    const previewRes = await req(`/api/admin/preview/${created.id}`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(previewRes.status).toBe(200);
    expect(previewRes.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    const previewHtml = await previewRes.text();
    expect(previewHtml).toContain('<table>');
    expect(previewHtml).toContain('<pre>');
    expect(previewHtml).toContain('<code');

    // 6. Promote post to published -> public SSR has complete SEO + GEO metadata & ETag
    const pubRes = await req(`/api/admin/posts/${created.id}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status: 'published' }),
    });
    expect(pubRes.status).toBe(200);

    const liveRes = await req(`/blog/${created.slug}`);
    expect(liveRes.status).toBe(200);
    const etag = liveRes.headers.get('etag');
    expect(etag).toBeTruthy();
    expect(liveRes.headers.get('cache-control')).toContain('s-maxage=3600');
    const liveHtml = await liveRes.text();
    expect(liveHtml).toContain('<title>');
    expect(liveHtml).toContain('<meta name="description"');
    expect(liveHtml).toContain('<link rel="canonical"');
    expect(liveHtml).toContain('application/ld+json');
    expect(liveHtml).toContain('"TechArticle"');
    expect(liveHtml).toContain('"BreadcrumbList"');
    expect(liveHtml).toContain('"FAQPage"');
    expect(liveHtml).toContain('Paid Worker CPU Limit');

    // 7. Conditional GET with If-None-Match returns 304 Not Modified
    const cachedRes = await req(`/blog/${created.slug}`, {
      headers: { 'If-None-Match': etag! },
    });
    expect(cachedRes.status).toBe(304);

    // 8. Sitemap, RSS, llms.txt, llms-full.txt, .md mirror, and Headless API now include post
    const [sitemapPub, rssPub, llmsPub, llmsFullPub, mdPub, apiList, apiOne] = await Promise.all([
      req('/sitemap.xml').then((r) => r.text()),
      req('/rss.xml').then((r) => r.text()),
      req('/llms.txt').then((r) => r.text()),
      req('/llms-full.txt').then((r) => r.text()),
      req(`/blog/${created.slug}.md`),
      req('/api/v1/posts'),
      req(`/api/v1/posts/${created.slug}`),
    ]);
    expect(sitemapPub).toContain(`/blog/${created.slug}`);
    expect(rssPub).toContain(`/blog/${created.slug}`);
    expect(llmsPub).toContain(`/blog/${created.slug}`);
    expect(llmsFullPub).toContain(created.slug);
    expect(mdPub.status).toBe(200);
    expect(mdPub.headers.get('content-type')).toContain('text/markdown');
    expect(await mdPub.text()).toContain('Cloudflare Workers CPU Budgets');

    expect(apiList.status).toBe(200);
    expect(apiList.headers.get('access-control-allow-origin')).toBe('*');
    const apiListJson = (await apiList.json()) as { posts: Array<{ slug: string }>; total: number };
    expect(apiListJson.total).toBe(1);
    expect(apiListJson.posts[0].slug).toBe(created.slug);

    expect(apiOne.status).toBe(200);
    const apiOneJson = (await apiOne.json()) as { slug: string; markdown_url: string };
    expect(apiOneJson.slug).toBe(created.slug);
    expect(apiOneJson.markdown_url).toContain(`${created.slug}.md`);
  });

  it('9-10. Auto-publish mode publishes compliant posts AND overrides sloppy posts back to draft', async () => {
    const modeRes = await req('/api/admin/settings', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ publishing_mode: 'auto_publish' }),
    });
    expect(modeRes.status).toBe(200);

    // Compliant post with omitted status -> publishes automatically!
    const goodRes = await req('/api/admin/posts', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(makeCompliantPostPayload({ status: null })),
    });
    expect(goodRes.status).toBe(201);
    const goodPost = (await goodRes.json()) as { status: string; lint_passed: boolean; slug: string };
    expect(goodPost.lint_passed).toBe(true);
    expect(goodPost.status).toBe('published');

    // Duplicate title/slug resolves cleanly with -2 suffix instead of throwing 500
    const dupRes = await req('/api/admin/posts', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(makeCompliantPostPayload({ status: null })),
    });
    expect(dupRes.status).toBe(201);
    const dupPost = (await dupRes.json()) as { slug: string };
    expect(dupPost.slug).toBe(`${goodPost.slug}-2`);

    // Sloppy post in auto_publish mode -> lint_passed=false AND forced to draft!
    const sloppyRes = await req('/api/admin/posts', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: 'Short slop',
        description: 'Too short.',
        body_markdown:
          '## Introduction\n\nIn today\'s fast-paced world, let us delve into this game-changer without further ado. Check [GitHub](https://github.com/) and [TODO].',
        author: 'AI Agent Bot',
        archetype: 'benchmark-index',
        sources: ['https://github.com/'],
        status: null,
      }),
    });
    expect(sloppyRes.status).toBe(201);
    const sloppyPost = (await sloppyRes.json()) as {
      status: string;
      lint_passed: boolean;
      lint_errors_json: string[];
    };
    expect(sloppyPost.lint_passed).toBe(false);
    expect(sloppyPost.status).toBe('draft');
    expect(sloppyPost.lint_errors_json.length).toBeGreaterThanOrEqual(5);
  });

  it('11. Strips malicious <script>, onerror, and javascript: XSS payloads in body_html', async () => {
    const xssMarkdown =
      COMPLIANT_MARKDOWN +
      '\n\n<script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">click</a>';
    const res = await req('/api/admin/posts', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(makeCompliantPostPayload({ body_markdown: xssMarkdown })),
    });
    expect(res.status).toBe(201);
    const post = (await res.json()) as { body_html: string };
    expect(post.body_html).not.toContain('<script');
    expect(post.body_html).not.toContain('alert(1)');
    expect(post.body_html).not.toContain('onerror');
    expect(post.body_html).not.toContain('javascript:');
    expect(post.body_html).toContain('<table>');
    expect(post.body_html).toContain('<pre>');
  });

  it('12. Blocks SSRF targets (loopback, localhost, metadata, private IPs, decimal IP tricks) before network I/O', async () => {
    const maliciousUrls = [
      'https://127.0.0.1/secret',
      'http://localhost:8080/admin',
      'https://169.254.169.254/latest/meta-data/',
      'https://10.0.0.5/internal',
      'https://192.168.1.1/router',
      'https://[::1]/loopback',
      'https://2130706433/decimal-loopback',
      'https://metadata.google.internal/computeMetadata/v1/',
    ];

    for (const url of maliciousUrls) {
      expect(isSafePublicUrl(url).ok).toBe(false);
      const readRes = await readPrimaryWebpage(url, env);
      expect(readRes.ok).toBe(false);
      expect(readRes.error?.toLowerCase()).toContain('ssrf');
    }

    expect(isSafePublicUrl('https://developers.cloudflare.com/workers/platform/limits/').ok).toBe(true);
  });

  it('13. Category Skills CRUD + AdSense /ads.txt + Trust pages + Admin SPA & robots.txt hygiene', async () => {
    // Skills API returns 4 seeded skills & allows creating a custom skill
    const skillsRes = await req('/api/admin/skills', {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(skillsRes.status).toBe(200);
    const skillsList = (await skillsRes.json()) as { skills: Array<{ slug: string }> };
    expect(skillsList.skills.map((s) => s.slug)).toContain('ai-security-jailbreaks');

    const newSkillRes = await req('/api/admin/skills', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        slug: 'agent-frameworks',
        name: 'Agent Frameworks & Eval Harnesses',
        description: 'Comparative evaluations of agentic runtimes and tool-use reliability.',
        system_instructions: 'Measure exact pass@k and tool-call schema failure rates.',
        priority: 70,
        banned_patterns_json: ['revolutionary synergy'],
      }),
    });
    expect(newSkillRes.status).toBe(201);

    // /ads.txt is 404 before configuring adsense_client_id, then 200 after
    expect((await req('/ads.txt')).status).toBe(404);
    await req('/api/admin/settings', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ adsense_client_id: 'ca-pub-1234567890123456' }),
    });
    const adsRes = await req('/ads.txt');
    expect(adsRes.status).toBe(200);
    expect(await adsRes.text()).toContain('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0');

    // Public Landing & AdSense Trust Pages
    for (const path of ['/', '/blog', '/about', '/editorial-policy', '/privacy', '/contact']) {
      const pageRes = await req(path);
      expect(pageRes.status).toBe(200);
      const html = await pageRes.text();
      expect(html.toLowerCase()).toContain('<!doctype html>');
      if (path === '/privacy') {
        expect(html).toContain('https://myadcenter.google.com/');
      }
    }

    // Admin SPA serves 200 with X-Robots-Tag: noindex, nofollow
    const adminRes = await req('/admin/');
    expect(adminRes.status).toBe(200);
    expect(adminRes.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(await adminRes.text()).toContain('noindex, nofollow');

    // robots.txt allows AI search bots & blocks /admin and /api/admin
    const robotsRes = await req('/robots.txt');
    expect(robotsRes.status).toBe(200);
    const robotsTxt = await robotsRes.text();
    expect(robotsTxt).toContain('Disallow: /admin');
    expect(robotsTxt).toContain('Disallow: /api/admin');
    expect(robotsTxt).toContain('OAI-SearchBot');
    expect(robotsTxt).toContain('PerplexityBot');
    expect(robotsTxt).toContain('Sitemap:');
  });
});
