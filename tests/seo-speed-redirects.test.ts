import { beforeEach, describe, expect, it } from 'vitest';
import type { WorkerEnv } from '../src/env';
import { createApp } from '../src/index';
import { InMemoryDatabase } from '../src/lib/db';
import {
  buildEdgeCacheKey,
  extractEdgeThemeKey,
  isPublicEdgeCacheableRequest,
} from '../src/lib/edge-cache';
import { resetRateLimitsForTests } from '../src/lib/security';

function createTestEnv(db: InMemoryDatabase, overrides: Partial<WorkerEnv> = {}): WorkerEnv {
  return {
    SITE_NAME: 'Pyvren',
    BASE_URL: 'https://pyvren.com',
    DEFAULT_OPENROUTER_MODEL: 'openrouter/free',
    ENVIRONMENT: 'test',
    SESSION_SECRET: 'test-session-secret-64-chars-minimum-entropy-0123456789abcdef012345',
    ADMIN_EMAIL: 'hamdisoudani.freelancer@gmail.com',
    ADMIN_PASSWORD: 'test-owner-password-123',
    ADMIN_DISPLAY_NAME: 'Hamdi Soudani',
    ADMIN_TOKEN: 'test-admin-bearer-token',
    __TEST_DB__: db,
    ...overrides,
  };
}

describe('SEO Technical Audit: 301 Redirects, Clean /tag/ URLs, Keywords & Edge Cache', () => {
  let db: InMemoryDatabase;
  let env: WorkerEnv;

  beforeEach(async () => {
    resetRateLimitsForTests();
    db = new InMemoryDatabase();
    await db.updateSettings({ site_name: 'Pyvren', base_url: 'https://pyvren.com' });
    env = createTestEnv(db);

    await db.createPost({
      title: 'CISA KEV Zero-Day Patch Verification on Edge Workers',
      slug: 'cisa-kev-zero-day-patch-verification',
      description:
        'Primary-source incident timeline and patch benchmarks for CISA KEV advisories on cloud edge infrastructure.',
      tldr_summary: 'Verified remediation metrics for CISA KEV advisories on edge infrastructure.',
      key_facts_json: [],
      faq_json: [],
      author: 'Hamdi Soudani',
      category_slug: 'dev-tooling-benchmarks',
      archetype: 'advisory-teardown',
      status: 'published',
      keywords_json: ['cisa kev', 'zero-day'],
      tags_json: ['cisa-kev', 'ai security', 'cloudflare workers pricing'],
      body_markdown: '## Patch Timeline\n\nVerified primary-source CISA KEV remediation metrics.',
      body_html: '<h2>Patch Timeline</h2><p>Verified primary-source CISA KEV remediation metrics.</p>',
      sources_json: ['https://www.cisa.gov/known-exploited-vulnerabilities-catalog'],
      review_notes_json: [],
      lint_passed: true,
      lint_errors_json: [],
      quality_score: 94,
      quality_breakdown_json: {
        overall: 94,
        seo_structure: 95,
        geo_citation_readiness: 93,
        information_gain: 94,
        source_grounding: 95,
        anti_slop_cleanliness: 94,
        adsense_compliance: 95,
        warnings: [],
      },
      word_count: 1100,
      reading_time_minutes: 5,
      admin_locked: false,
      last_edited_by: 'admin',
      published_at: new Date().toISOString(),
    });
  });

  it('redirects HTTP and www.pyvren.com to canonical https://pyvren.com with HTTP 301 in production', async () => {
    const app = createApp();
    const prodEnv = createTestEnv(db, { ENVIRONMENT: 'production' });

    const httpRes = await app.fetch(new Request('http://pyvren.com/'), prodEnv);
    expect(httpRes.status).toBe(301);
    expect(httpRes.headers.get('location')).toBe('https://pyvren.com/');

    const wwwRes = await app.fetch(new Request('https://www.pyvren.com/blog'), prodEnv);
    expect(wwwRes.status).toBe(301);
    expect(wwwRes.headers.get('location')).toBe('https://pyvren.com/blog');

    const httpWwwRes = await app.fetch(
      new Request('http://www.pyvren.com/category/ai-llms?page=2'),
      prodEnv,
    );
    expect(httpWwwRes.status).toBe(301);
    expect(httpWwwRes.headers.get('location')).toBe('https://pyvren.com/category/ai-llms?page=2');

    // Localhost and test environment are never redirected
    const localRes = await app.fetch(new Request('http://localhost:8787/'), prodEnv);
    expect(localRes.status).toBe(200);
  });

  it('renders homepage with 50-60 char title, keyword-aligned H1, Seven Engineering Beats, Early Hints preload, and zero ?q= links', async () => {
    const app = createApp();
    const res = await app.fetch(new Request('https://pyvren.com/'), env);
    expect(res.status).toBe(200);

    const linkHeader = res.headers.get('link') || '';
    expect(linkHeader).toContain('</assets/app.css>; rel="preload"; as="style"');

    const html = await res.text();
    const titleMatch = /<title>([^<]+)<\/title>/i.exec(html);
    expect(titleMatch).toBeTruthy();
    const renderedTitle = (titleMatch?.[1] || '').replace(/&amp;/g, '&');
    expect(renderedTitle).toBe('Pyvren — AI Engineering, Security, LLMs & Cloud Benchmarks');
    expect(renderedTitle.length).toBeGreaterThanOrEqual(50);
    expect(renderedTitle.length).toBeLessThanOrEqual(60);

    const h1Match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
    const h1Text = (h1Match?.[1] || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
    expect(h1Text).toContain('AI Engineering');
    expect(h1Text).toContain('Security');
    expect(h1Text).toContain('Cloud Benchmarks');

    expect(html).toContain('Seven Engineering Beats');
    expect(html).not.toContain('Six Engineering Beats');
    expect(html).toContain('<link rel="preload" as="style" href="/assets/app.css">');
    expect(html).toContain('content-visibility:auto');

    // Zero query-string <a href="...?"> links on homepage
    const anchorHrefs = Array.from(html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)).map((m) => m[1]);
    const queryLinks = anchorHrefs.filter((href) => href.includes('?'));
    expect(queryLinks).toEqual([]);

    // Topic cluster chips point to clean /tag/:slug routes
    expect(html).toContain('href="/tag/cisa-kev"');
  });

  it('serves clean /tag/:tag SSR archives with matching posts and links article tags to /tag/:slug', async () => {
    const app = createApp();

    const tagRes = await app.fetch(new Request('https://pyvren.com/tag/cisa-kev'), env);
    expect(tagRes.status).toBe(200);
    expect(tagRes.headers.get('cache-control')).toContain('public');
    const tagHtml = await tagRes.text();
    expect(tagHtml).toContain('<link rel="canonical" href="https://pyvren.com/tag/cisa-kev">');
    expect(tagHtml).toContain('CISA KEV Zero-Day Patch Verification on Edge Workers');

    // Article page tag chips also use clean /tag/:slug URLs (no /blog?q=)
    const postRes = await app.fetch(
      new Request('https://pyvren.com/blog/cisa-kev-zero-day-patch-verification'),
      env,
    );
    expect(postRes.status).toBe(200);
    expect(postRes.headers.get('link') || '').toContain('</assets/app.css>; rel="preload"; as="style"');
    const postHtml = await postRes.text();
    expect(postHtml).toContain('href="/tag/cloudflare-workers-pricing"');
    expect(postHtml).not.toContain('href="/blog?q=');
  });

  it('scopes edge cache keys cleanly by route, theme cookie, and format while excluding search and admin', () => {
    const prodEnvNoTestDb = createTestEnv(db, { ENVIRONMENT: 'production', __TEST_DB__: undefined });

    expect(isPublicEdgeCacheableRequest(new Request('https://pyvren.com/'), prodEnvNoTestDb)).toBe(true);
    expect(
      isPublicEdgeCacheableRequest(new Request('https://pyvren.com/tag/cisa-kev'), prodEnvNoTestDb),
    ).toBe(true);
    expect(
      isPublicEdgeCacheableRequest(new Request('https://pyvren.com/rss.xml'), prodEnvNoTestDb),
    ).toBe(true);

    // Exclusions: search queries, admin routes, API routes, conditional requests
    expect(
      isPublicEdgeCacheableRequest(new Request('https://pyvren.com/blog?q=ai'), prodEnvNoTestDb),
    ).toBe(false);
    expect(
      isPublicEdgeCacheableRequest(new Request('https://pyvren.com/admin'), prodEnvNoTestDb),
    ).toBe(false);
    expect(
      isPublicEdgeCacheableRequest(
        new Request('https://pyvren.com/api/admin/posts'),
        prodEnvNoTestDb,
      ),
    ).toBe(false);
    expect(
      isPublicEdgeCacheableRequest(
        new Request('https://pyvren.com/', { headers: { 'If-None-Match': '"abc"' } }),
        prodEnvNoTestDb,
      ),
    ).toBe(false);

    // Theme key isolation for HTML vs unified key for feeds
    const darkReq = new Request('https://pyvren.com/', {
      headers: { Cookie: 'pyvren_theme=dark' },
    });
    expect(extractEdgeThemeKey(darkReq, '/')).toBe('dark');
    expect(extractEdgeThemeKey(darkReq, '/rss.xml')).toBe('auto');

    const key = buildEdgeCacheKey('https://pyvren.com/', 'dark', 'html');
    expect(key.url).toBe('https://pyvren.com/?_pyv_t=dark&_pyv_f=html');
  });
});
