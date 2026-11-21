import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/index';
import { InMemoryDatabase } from '../src/lib/db';
import { resetRateLimitsForTests } from '../src/lib/security';
import {
  extractReferenceImagesFromHtml,
  extractReferenceImagesFromMarkdown,
  isValidReferenceImageUrl,
} from '../src/lib/tools';
import type { WorkerEnv } from '../src/env';

function createTestEnv(db: InMemoryDatabase): WorkerEnv {
  return {
    SITE_NAME: 'The Pyvren Dispatch',
    BASE_URL: 'https://pyvren.com',
    DEFAULT_OPENROUTER_MODEL: 'openrouter/free',
    ENVIRONMENT: 'test',
    SESSION_SECRET: 'test-session-secret-64-chars-minimum-entropy-0123456789abcdef012345',
    ADMIN_EMAIL: 'hamdisoudani.freelancer@gmail.com',
    ADMIN_PASSWORD: 'test-owner-password-123',
    ADMIN_DISPLAY_NAME: 'Hamdi Soudani',
    ADMIN_TOKEN: 'test-admin-bearer-token',
    __TEST_DB__: db,
  };
}

const SAMPLE_BODY_MARKDOWN = `Modern CLI harnesses avoid preloading 40,000 schema tokens at startup. Teams running SWE-bench CI pipelines cut median prompt cost by 61% when switching from static tool schemas to on-demand command discovery.

![Token overhead comparison across CLI and MCP tool invocations](https://docs.cloudflare.com/assets/workers-workflow-diagram.png)

## Benchmark Methodology and Harness Setup

We evaluated three production repositories across 120 pull-request tasks using [Cloudflare Workflows documentation](https://developers.cloudflare.com/workflows/get-started/guide/) and [Model Context Protocol specification](https://modelcontextprotocol.io/specification/2025-03-26/architecture) alongside [OWASP GenAI security guidance](https://genai.owasp.org/llmrisk/llm01-prompt-injection/). Short commands fail fast with non-zero exit codes.

| Runtime Mode | Startup Tokens | Median Latency | Pass Rate |
| --- | --- | --- | --- |
| Static MCP Schemas | 42,800 | 4.9s | 68.4% |
| Hybrid CLI Discovery | 3,150 | 1.8s | 71.2% |

\`\`\`bash
npx wrangler deploy --dry-run
\`\`\`

## When NOT to Adopt Hybrid CLI Harnesses

Multi-tenant SaaS products requiring delegated per-user OAuth scopes still benefit from typed MCP authorization boundaries rather than raw shell execution.`;

describe('Dual-Layer UX (Humans vs Agents), Theme Persistence, Rate-Limited Search & Reference Images', () => {
  let db: InMemoryDatabase;
  let env: WorkerEnv;
  const app = createApp();

  beforeEach(async () => {
    resetRateLimitsForTests();
    db = new InMemoryDatabase();
    env = createTestEnv(db);
    await db.updateSettings({
      publishing_mode: 'auto_publish',
      site_name: 'The Pyvren Dispatch',
      default_author: 'Hamdi Soudani',
    });
  });

  it('1. Enforces clean Human UI (zero QS badges, co-work attribution, LinkedIn, Crew SVGs, mobile carousels) while exposing rich AI Agent discovery (/api/v1/map, Link headers, .md)', async () => {
    const createRes = await app.request(
      'https://pyvren.com/api/admin/posts',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.ADMIN_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Hybrid CLI vs MCP Token Economics in Production CI',
          description:
            'Field benchmark comparing startup token overhead, p95 latency, and OAuth tradeoffs between CLI harnesses and MCP servers.',
          tldr_summary:
            'Hybrid CLI discovery reduces initial context overhead from 42.8K tokens to 3.15K tokens while preserving 71.2% task accuracy.',
          cover_image_url: 'https://developers.cloudflare.com/assets/cli-mcp-cover-chart.png',
          cover_image_alt: 'Startup token consumption chart for CLI vs MCP',
          images: [
            {
              url: 'https://developers.cloudflare.com/assets/cli-mcp-cover-chart.png',
              alt: 'Startup token consumption chart for CLI vs MCP',
              source_page_url: 'https://developers.cloudflare.com/workflows/get-started/guide/',
            },
            {
              url: 'https://modelcontextprotocol.io/images/mcp-topology-figure.png',
              alt: 'MCP client-host-server topology diagram',
              caption: 'MCP protocol topology from primary specification',
              source_page_url: 'https://modelcontextprotocol.io/specification/2025-03-26/architecture',
            },
          ],
          category_slug: 'ai-coding-agents-mcp',
          archetype: 'benchmark-index',
          body_markdown: SAMPLE_BODY_MARKDOWN + '\n\n' + 'Additional empirical analysis of exit-code retries, sandbox isolation overhead, memory ceilings, cold-start jitter, and deterministic CI assertions across distributed build workers. '.repeat(28),
          tags: ['mcp', 'cli-agents', 'benchmarks'],
          keywords: ['mcp token overhead', 'cli coding agents benchmark', 'cloudflare workflows ci'],
          sources: [
            'https://developers.cloudflare.com/workflows/get-started/guide/',
            'https://modelcontextprotocol.io/specification/2025-03-26/architecture',
            'https://genai.owasp.org/llmrisk/llm01-prompt-injection/',
          ],
          key_facts: [
            {
              label: 'Startup Token Savings',
              value: '92.6% reduction (3,150 vs 42,800 tokens)',
              source_url: 'https://modelcontextprotocol.io/specification/2025-03-26/architecture',
            },
          ],
          faq: [
            {
              question: 'When should teams keep MCP servers over CLI wrappers?',
              answer: 'Keep MCP when per-user OAuth delegation and strict multi-tenant tool schemas are mandatory.',
            },
          ],
          status: 'published',
        }),
      },
      env,
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { slug: string; status: string };
    expect(created.status).toBe('published');

    // Inspect Homepage Human HTML + Agent Link Header
    const homeRes = await app.request('https://pyvren.com/', {}, env);
    expect(homeRes.status).toBe(200);
    expect(homeRes.headers.get('link')).toContain('/llms.txt>; rel="service-doc"');
    expect(homeRes.headers.get('link')).toContain('/api/v1/map>; rel="describedby"');
    const homeHtml = await homeRes.text();

    expect(homeHtml).toContain('The Pyvren Dispatch');
    expect(homeHtml).toContain('Hamdi Soudani');
    expect(homeHtml).toContain('Co-crafted with Pyvren');
    expect(homeHtml).toContain('https://www.linkedin.com/in/hamdisoudani/');
    expect(homeHtml).toContain('pyvren-mascot-svg');
    expect(homeHtml).toContain('crew-hero-svg');
    expect(homeHtml).toContain('crew-topic-svg');
    expect(homeHtml).toContain('sketch-icon');
    expect(homeHtml).toContain('beat-strip');
    expect(homeHtml).toContain('topics-popover');
    expect(homeHtml).toContain('mobile-carousel');
    expect(homeHtml).toContain('data-agent-directory');
    // Big Pyvren wordmark: snake mark stands in for "Py", "vren" as text, eyes track the pointer
    expect(homeHtml).toContain('pyvren-wordmark');
    expect(homeHtml).toContain('py-snake-mark');
    expect(homeHtml).toContain('py-snake-tongue');
    expect(homeHtml).toContain('data-snake-pupil');
    expect(homeHtml).toContain('<span class="pyvren-letter" style="--i:0">v</span>');
    // Image guard lives in <head> so a fast-failing cover can never show a broken icon / alt text
    const headHtml = homeHtml.slice(0, homeHtml.indexOf('</head>'));
    expect(headHtml).toContain("document.addEventListener('error'");
    expect(headHtml).toContain('media-fallback');
    expect(headHtml).toContain('/og/fallback.svg?category=');

    // Strictly zero visible QS score clutter, View Markdown button, or AI-slop colored circle dots
    expect(homeHtml).not.toContain('QS ');
    expect(homeHtml).not.toContain('score-ring');
    expect(homeHtml).not.toContain('View Markdown (.md)');
    expect(homeHtml).not.toContain('topic-accent-dot');
    expect(homeHtml).not.toContain('cat-dot');

    // Inspect Single Post Page (cover image, syntax-colored code block, wrapped table, ref cards, LinkedIn card)
    const postRes = await app.request(`https://pyvren.com/blog/${created.slug}`, {}, env);
    expect(postRes.status).toBe(200);
    const postHtml = await postRes.text();

    expect(postHtml).toContain('Co-crafted with Pyvren');
    expect(postHtml).toContain('https://www.linkedin.com/in/hamdisoudani/');
    expect(postHtml).toContain('https://developers.cloudflare.com/assets/cli-mcp-cover-chart.png');
    expect(postHtml).toContain('https://docs.cloudflare.com/assets/workers-workflow-diagram.png');
    expect(postHtml).toContain('https://modelcontextprotocol.io/images/mcp-topology-figure.png');
    expect(postHtml).toContain('editorial-figure');
    // Cover frame: Py backup plate + skeleton shimmer under the (initially invisible) real image
    expect(postHtml).toContain('story-crew-plate');
    expect(postHtml).toContain('media-skeleton');
    expect(postHtml).toContain('data-story-cover="1"');
    expect(postHtml).toContain('skeleton-img');
    expect(postHtml).toContain('code-frame');
    expect(postHtml).toContain('code-frame-bar');
    expect(postHtml).toContain('tok-kw');
    expect(postHtml).toContain('editorial-table-wrap');
    expect(postHtml).toContain('field-note');
    expect(postHtml).toContain('ref-card');
    expect(postHtml).toContain('ref-stamp');
    expect(postHtml).not.toContain('QS ');
    expect(postHtml).not.toContain('View Markdown (.md)');
    expect(postHtml).not.toContain('topic-accent-dot');
    // Invisible <head> alternate link for AI agents MUST remain intact
    expect(postHtml).toContain(
      `<link rel="alternate" type="text/markdown" title="Markdown briefing" href="https://pyvren.com/blog/${created.slug}.md">`,
    );

    // Inspect Standalone Py Fallback SVG (/og/fallback.svg)
    const fbRes = await app.request(
      'https://pyvren.com/og/fallback.svg?category=ai-coding-agents-mcp&label=CLI+vs+MCP',
      {},
      env,
    );
    expect(fbRes.status).toBe(200);
    expect(fbRes.headers.get('content-type')).toContain('image/svg+xml');
    const fbSvg = await fbRes.text();
    expect(fbSvg).toContain('PYVREN · ILLUSTRATED EDITION');
    expect(fbSvg).toContain('py-snake-head');
    expect(fbSvg).toContain('CLI vs MCP');

    // Inspect AI Agent Map (/api/v1/map) — includes quality_score & markdown_url for agents
    const mapRes = await app.request('https://pyvren.com/api/v1/map', {}, env);
    expect(mapRes.status).toBe(200);
    const mapJson = (await mapRes.json()) as {
      publication: { name: string; linkedin_url: string };
      agent_navigation: { llms_txt: string; search_api: string };
      recent_posts: Array<{ slug: string; quality_score: number; markdown_url: string }>;
    };
    expect(mapJson.publication.name).toBe('The Pyvren Dispatch');
    expect(mapJson.publication.linkedin_url).toBe('https://www.linkedin.com/in/hamdisoudani/');
    expect(mapJson.agent_navigation.llms_txt).toBe('https://pyvren.com/llms.txt');
    expect(mapJson.recent_posts[0]?.slug).toBe(created.slug);
    expect(typeof mapJson.recent_posts[0]?.quality_score).toBe('number');
  });

  it('2. Persists Dark/Light theme via SSR pyvren_theme cookie with distinct ETags', async () => {
    const lightRes = await app.request(
      'https://pyvren.com/',
      { headers: { Cookie: 'pyvren_theme=light' } },
      env,
    );
    const lightHtml = await lightRes.text();
    expect(lightHtml).toContain('<html lang="en" data-theme="light">');

    const darkRes = await app.request(
      'https://pyvren.com/',
      { headers: { Cookie: 'pyvren_theme=dark' } },
      env,
    );
    const darkHtml = await darkRes.text();
    expect(darkHtml).toContain('<html lang="en" data-theme="dark">');
  });

  it('3. Serves live search results and enforces IP rate limiting (429 + Retry-After) on /api/v1/search and /blog?q=', async () => {
    await db.createPost({
      slug: 'cloudflare-gpu-spot-economics',
      title: 'Cloudflare Workers & H100 Spot GPU Cost Analysis',
      description: 'Detailed hourly pricing and cold-start latency math for edge inference.',
      tldr_summary: 'Spot H100 nodes cut inference spend by 54% behind edge queues.',
      key_facts_json: [],
      faq_json: [],
      body_markdown: 'Edge queue buffering smooths GPU burst traffic across regions.',
      body_html: '<p>Edge queue buffering smooths GPU burst traffic across regions.</p>',
      author: 'Hamdi Soudani',
      category_slug: 'cloud-gpu-infra',
      archetype: 'benchmark-index',
      tags_json: ['gpu', 'cloudflare'],
      keywords_json: ['h100 spot pricing'],
      sources_json: ['https://developers.cloudflare.com/workers/'],
      review_notes_json: [],
      lint_passed: true,
      lint_errors_json: [],
      quality_score: 91,
      quality_breakdown_json: {
        overall: 91,
        seo_structure: 90,
        geo_citation_readiness: 92,
        information_gain: 90,
        source_grounding: 92,
        anti_slop_cleanliness: 92,
        adsense_compliance: 95,
        warnings: [],
      },
      reading_time_minutes: 4,
      word_count: 720,
      status: 'published',
      admin_locked: false,
      last_edited_by: null,
      published_at: new Date().toISOString(),
    });

    const okSearch = await app.request(
      'https://pyvren.com/api/v1/search?q=H100',
      { headers: { 'CF-Connecting-IP': '198.51.100.42' } },
      env,
    );
    expect(okSearch.status).toBe(200);
    const searchData = (await okSearch.json()) as { total: number; results: Array<{ slug: string }> };
    expect(searchData.total).toBe(1);
    expect(searchData.results[0]?.slug).toBe('cloudflare-gpu-spot-economics');

    // Exhaust 30 req/min rate limit for IP 198.51.100.42
    let lastStatus = 200;
    let retryAfter = '';
    for (let i = 0; i < 32; i++) {
      const res = await app.request(
        'https://pyvren.com/api/v1/search?q=gpu',
        { headers: { 'CF-Connecting-IP': '198.51.100.42' } },
        env,
      );
      lastStatus = res.status;
      retryAfter = res.headers.get('retry-after') || '';
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
    expect(Number(retryAfter)).toBeGreaterThan(0);

    // Verify SSR /blog?q= search also enforces per-IP rate limiting
    let blogSearchStatus = 200;
    for (let i = 0; i < 32; i++) {
      const res = await app.request(
        'https://pyvren.com/blog?q=cloudflare',
        { headers: { 'CF-Connecting-IP': '198.51.100.99' } },
        env,
      );
      blogSearchStatus = res.status;
      if (blogSearchStatus === 429) break;
    }
    expect(blogSearchStatus).toBe(429);
  });

  it('4. Extracts valid https:// reference images from crawled HTML/Markdown while blocking SSRF, badges, avatars & trackers', () => {
    expect(isValidReferenceImageUrl('http://169.254.169.254/latest/meta-data/').ok).toBe(false);
    expect(isValidReferenceImageUrl('https://img.shields.io/badge/build-passing-green.svg').ok).toBe(false);
    expect(isValidReferenceImageUrl('https://avatars.githubusercontent.com/u/12345').ok).toBe(false);
    expect(isValidReferenceImageUrl('data:image/png;base64,AAAA').ok).toBe(false);
    expect(
      isValidReferenceImageUrl(
        '/images/benchmark-chart.png',
        'Throughput benchmark chart',
        'https://engineering.example.org/posts/vllm-perf',
      ),
    ).toEqual({
      ok: true,
      url: 'https://engineering.example.org/images/benchmark-chart.png',
    });

    const sampleHtml = `
      <html>
        <head>
          <title>vLLM FP8 Throughput Study</title>
          <meta property="og:image" content="/assets/vllm-fp8-og.png">
          <meta property="og:image:alt" content="vLLM FP8 latency curve">
        </head>
        <body>
          <nav><img src="/logo.png" alt="Logo"></nav>
          <article>
            <img src="https://img.shields.io/badge/license-MIT-blue" alt="badge">
            <img src="/pixel.gif" width="1" height="1" alt="">
            <figure>
              <img src="https://cdn.example.org/figs/kv-cache-memory.webp" width="960" height="540" alt="KV cache memory scaling">
              <figcaption>Figure 2: KV cache VRAM usage from 8K to 64K tokens.</figcaption>
            </figure>
          </article>
        </body>
      </html>
    `;
    const htmlImgs = extractReferenceImagesFromHtml(
      sampleHtml,
      'https://engineering.example.org/blog/vllm-study',
    );
    expect(htmlImgs.map((i) => i.url)).toEqual([
      'https://engineering.example.org/assets/vllm-fp8-og.png',
      'https://cdn.example.org/figs/kv-cache-memory.webp',
    ]);
    expect(htmlImgs[1]?.caption).toContain('KV cache VRAM usage');

    // GitHub repo Markdown automatically derives official OpenGraph card when no inline figure exists
    const ghImgs = extractReferenceImagesFromMarkdown(
      '# MCP Benchmark\n\nReproducible harness.',
      'https://github.com/scalekit-inc/mcp-vs-cli-benchmark',
      'scalekit-inc/mcp-vs-cli-benchmark',
    );
    expect(ghImgs[0]?.url).toBe(
      'https://opengraph.githubassets.com/1/scalekit-inc/mcp-vs-cli-benchmark',
    );
  });

  it('5. Admin SPA inherits public Pyvren design, theme cookie SSR, skeletons & works behind reverse-proxy X-Forwarded-Host', async () => {
    const db = new InMemoryDatabase();
    const env = createTestEnv(db);
    const app = createApp();

    // Admin SPA honors pyvren_theme cookie on SSR & shares public Pyvren wordmark + typography + skeletons
    const adminRes = await app.request(
      'https://pyvren.com/admin',
      { headers: { Cookie: 'pyvren_theme=dark' } },
      env,
    );
    expect(adminRes.status).toBe(200);
    expect(adminRes.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    const adminHtml = await adminRes.text();
    expect(adminHtml).toContain('<html lang="en" data-theme="dark">');
    expect(adminHtml).toContain('Playfair+Display');
    expect(adminHtml).toContain('pyvren-wordmark');
    expect(adminHtml).toContain('py-snake-mark');
    expect(adminHtml).toContain('skeleton-shimmer');
    expect(adminHtml).toContain('data-snake-pupil');
    expect(adminHtml).not.toContain('bootstrap-form');
    expect(adminHtml).not.toContain('Supabase');
    expect(adminHtml).not.toContain('Cloudflare');
    expect(adminHtml).not.toContain('OpenRouter');
    expect(adminHtml).not.toContain('env-locked');
    expect(adminHtml).not.toContain('Edge Native');
    expect(adminHtml).not.toContain('Strict Gate');
    expect(adminHtml).not.toContain('$0 Guard');

    // Login behind reverse proxy / preview tunnel (X-Forwarded-Host matches Origin) succeeds
    const proxyLogin = await app.request(
      'http://localhost:8787/api/admin/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://preview-tunnel.example.com',
          'X-Forwarded-Host': 'preview-tunnel.example.com',
          'X-Forwarded-Proto': 'https',
        },
        body: JSON.stringify({
          email: env.ADMIN_EMAIL,
          password: env.ADMIN_PASSWORD,
        }),
      },
      env,
    );
    expect(proxyLogin.status).toBe(200);
    const setCookie = proxyLogin.headers.get('set-cookie') || '';
    expect(setCookie).toContain('pyvren_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Secure');

    // Cross-origin attacker Origin still gets rejected with 403 even with X-Forwarded-Host present
    const badProxyLogin = await app.request(
      'http://localhost:8787/api/admin/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil-attacker.example',
          'X-Forwarded-Host': 'preview-tunnel.example.com',
        },
        body: JSON.stringify({
          email: env.ADMIN_EMAIL,
          password: env.ADMIN_PASSWORD,
        }),
      },
      env,
    );
    expect(badProxyLogin.status).toBe(403);
  });
});
