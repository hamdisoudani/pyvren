import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/index';
import type { WorkerEnv } from '../src/env';
import { InMemoryDatabase } from '../src/lib/db';
import {
  buildTeaserMarkdown,
  runScheduledSyndicationSweep,
  sanitizeDevtoTags,
  syndicatePostToChannels,
} from '../src/lib/syndicate';
import type { PostRecord } from '../src/types';

const ADMIN_TOKEN = 'test-admin-secret-token-xyz-999';
const INDEXNOW_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

function createTestEnv(db: InMemoryDatabase, overrides: Partial<WorkerEnv> = {}): WorkerEnv {
  return {
    ENVIRONMENT: 'test',
    BASE_URL: 'https://pyvren.com',
    SITE_NAME: 'The Pyvren Dispatch',
    ADMIN_TOKEN,
    SESSION_SECRET: 'super-secret-session-signing-key-for-tests-1234',
    __TEST_DB__: db,
    ...overrides,
  };
}

async function seedPublishedPost(
  db: InMemoryDatabase,
  overrides: Partial<Parameters<InMemoryDatabase['createPost']>[0]> = {},
): Promise<PostRecord> {
  return db.createPost({
    slug: 'mcp-vs-cli-token-overhead-benchmark-2026',
    title: 'MCP vs CLI Coding Agents: 2026 Token & Latency Benchmark',
    description:
      'Measured token overhead, startup latency, and SWE-bench pass rates comparing Model Context Protocol tool schemas against lean CLI harnesses.',
    tldr_summary:
      'CLI harnesses cut schema token overhead by 62% vs 18-tool MCP servers while matching pass rates on SWE-bench tasks.',
    key_facts_json: [
      { label: 'Token Overhead Saved', value: '62% fewer prompt tokens per turn' },
      { label: 'Median Cold Start', value: '140ms CLI vs 890ms MCP stdio' },
      { label: 'Primary Harness', value: 'Claude Code + Terminal-Bench 2.0' },
    ],
    faq_json: [
      {
        question: 'When should teams still choose MCP over CLI wrappers?',
        answer: 'Use MCP when you need centralized OAuth, multi-tenant audit logging, or remote SaaS connectors.',
      },
    ],
    body_markdown: [
      'Terminal coding agents burn thousands of tokens loading verbose JSON tool schemas before writing a single line of code. Our reproducible harness measured 140ms startup latency and 62% lower prompt overhead on lean CLI wrappers.',
      '',
      '## Measured Token & Latency Breakdown',
      '',
      '| Harness | Schema Tokens | Cold Start | Pass Rate |',
      '| --- | --- | --- | --- |',
      '| CLI Wrapper | 420 | 140ms | 74.2% |',
      '| 18-Tool MCP | 3,890 | 890ms | 73.8% |',
      '',
      '## When NOT to Replace MCP',
      '',
      'Keep MCP for remote OAuth SaaS integrations documented in [Anthropic MCP Spec](https://modelcontextprotocol.io/specification/2025-03-26), [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/runtime-apis/), and [GitHub CLI Manual](https://cli.github.com/manual/gh_api).',
    ].join('\n'),
    body_html: '<p>Compiled HTML</p>',
    cover_image_url: 'https://assets.example.org/mcp-benchmark-chart.png',
    cover_image_alt: 'MCP vs CLI token benchmark chart',
    images_json: [],
    author: 'Hamdi Soudani',
    category_slug: 'ai-coding-agents-mcp',
    archetype: 'benchmark-index',
    tags_json: ['mcp-protocol', 'cli-agents', 'ai-benchmarks', 'token-math', 'extra-tag'],
    keywords_json: ['mcp token overhead', 'cli coding agents benchmark'],
    sources_json: [
      'https://modelcontextprotocol.io/specification/2025-03-26',
      'https://developers.cloudflare.com/workers/runtime-apis/',
      'https://cli.github.com/manual/gh_api',
    ],
    review_notes_json: [],
    lint_passed: true,
    lint_errors_json: [],
    quality_score: 91,
    quality_breakdown_json: {
      overall: 91,
      seo_structure: 94,
      geo_citation_readiness: 92,
      information_gain: 90,
      source_grounding: 90,
      anti_slop_cleanliness: 88,
      adsense_compliance: 100,
      warnings: [],
    },
    reading_time_minutes: 5,
    word_count: 850,
    status: 'published',
    admin_locked: true,
    last_edited_by: 'hamdi@pyvren.com',
    published_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  });
}

describe('Distribution & Syndication Engine (IndexNow, DEV.to, Bluesky, Mastodon, Hashnode, RSS)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('serves IndexNow verification key file at /{INDEXNOW_KEY}.txt and preserves 404s + /robots.txt', async () => {
    const db = new InMemoryDatabase();
    const env = createTestEnv(db, { INDEXNOW_KEY });
    const app = createApp();

    const validRes = await app.fetch(new Request(`https://pyvren.com/${INDEXNOW_KEY}.txt`), env);
    expect(validRes.status).toBe(200);
    expect(await validRes.text()).toBe(INDEXNOW_KEY);
    expect(validRes.headers.get('content-type')).toContain('text/plain');

    const wrongKeyRes = await app.fetch(
      new Request('https://pyvren.com/wrongkey1234567890.txt'),
      env,
    );
    expect(wrongKeyRes.status).toBe(404);

    const robotsRes = await app.fetch(new Request('https://pyvren.com/robots.txt'), env);
    expect(robotsRes.status).toBe(200);
    expect(await robotsRes.text()).toContain('Sitemap: https://pyvren.com/sitemap.xml');
  });

  it('enriches /rss.xml with media:content cover thumbnail, tags, and content:encoded teaser linking to pyvren.com', async () => {
    const db = new InMemoryDatabase();
    await seedPublishedPost(db);
    const env = createTestEnv(db);
    const app = createApp();

    const res = await app.fetch(new Request('https://pyvren.com/rss.xml'), env);
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('xmlns:content="http://purl.org/rss/1.0/modules/content/"');
    expect(xml).toContain('xmlns:media="http://search.yahoo.com/mrss/"');
    expect(xml).toContain(
      '<media:content url="https://assets.example.org/mcp-benchmark-chart.png" medium="image" />',
    );
    expect(xml).toContain('<content:encoded><![CDATA[');
    expect(xml).toContain('https://pyvren.com/blog/mcp-vs-cli-token-overhead-benchmark-2026');
    expect(xml).toContain('<category>mcp-protocol</category>');
  });

  it('sanitizes DEV.to tags to max 4 lowercase alphanumeric strings and builds SEO-safe teaser markdown', async () => {
    const db = new InMemoryDatabase();
    const post = await seedPublishedPost(db);
    const settings = await db.getSettings();

    const tags = sanitizeDevtoTags(post.tags_json, post.category_slug);
    expect(tags).toEqual(['mcpprotocol', 'cliagents', 'aibenchmarks', 'tokenmath']);
    expect(tags.length).toBeLessThanOrEqual(4);
    expect(tags.every((t) => /^[a-z0-9]+$/.test(t))).toBe(true);

    const teaser = buildTeaserMarkdown(
      post,
      settings,
      `https://pyvren.com/blog/${post.slug}`,
    );
    expect(teaser).toContain('**TL;DR:**');
    expect(teaser).toContain('| **Token Overhead Saved** | 62% fewer prompt tokens per turn |');
    expect(teaser).toContain('Measured Token & Latency Breakdown');
    expect(teaser).toContain(`https://pyvren.com/blog/${post.slug}`);
  });

  it('syndicates to IndexNow, DEV.to, Bluesky, Mastodon, and Hashnode with canonical URLs and prevents duplicate cross-posts', async () => {
    const db = new InMemoryDatabase();
    const post = await seedPublishedPost(db);
    await db.updateSettings({
      syndication_enabled: true,
      syndication_mode: 'teaser',
      syndication_channels_json: ['indexnow', 'devto', 'bluesky', 'mastodon', 'hashnode'],
      devto_publish_as_draft: true,
    });

    const env = createTestEnv(db, {
      INDEXNOW_KEY,
      DEVTO_API_KEY: 'devto-secret-key',
      BLUESKY_HANDLE: 'pyvren.bsky.social',
      BLUESKY_APP_PASSWORD: 'xxxx-xxxx-xxxx-xxxx',
      MASTODON_INSTANCE_URL: 'https://infosec.exchange',
      MASTODON_ACCESS_TOKEN: 'masto-secret-token',
      HASHNODE_TOKEN: 'hashnode-secret-token',
      HASHNODE_PUBLICATION_ID: 'pub-123456',
    });

    const capturedCalls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      capturedCalls.push({ url, init });

      if (url === 'https://api.indexnow.org/indexnow') {
        return new Response('', { status: 202 });
      }
      if (url === 'https://dev.to/api/articles') {
        return new Response(
          JSON.stringify({ id: 90123, url: 'https://dev.to/hamdi/mcp-vs-cli-1234' }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url === 'https://bsky.social/xrpc/com.atproto.server.createSession') {
        return new Response(
          JSON.stringify({
            accessJwt: 'bsky-jwt-token',
            did: 'did:plc:pyvren123',
            handle: 'pyvren.bsky.social',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url === 'https://bsky.social/xrpc/com.atproto.repo.createRecord') {
        return new Response(
          JSON.stringify({
            uri: 'at://did:plc:pyvren123/app.bsky.feed.post/3kabc999',
            cid: 'bafy123',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url === 'https://infosec.exchange/api/v1/statuses') {
        return new Response(
          JSON.stringify({
            id: '11223344',
            url: 'https://infosec.exchange/@pyvren/11223344',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url === 'https://gql.hashnode.com/') {
        return new Response(
          JSON.stringify({
            data: {
              publishPost: {
                post: {
                  id: 'hn-777',
                  url: 'https://pyvren.hashnode.dev/mcp-vs-cli',
                },
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('Not Found', { status: 404 });
    }) as typeof fetch;

    const results = await syndicatePostToChannels(db, env, post);
    expect(results).toHaveLength(5);
    expect(results.every((r) => r.ok && !r.skipped)).toBe(true);

    // Verify DEV.to payload respected canonical_url, draft mode, and sanitized tags
    const devtoCall = capturedCalls.find((c) => c.url === 'https://dev.to/api/articles');
    expect(devtoCall).toBeTruthy();
    const devtoBody = JSON.parse(String(devtoCall!.init?.body)) as {
      article: { canonical_url: string; published: boolean; tags: string[]; main_image: string };
    };
    expect(devtoBody.article.canonical_url).toBe(
      `https://pyvren.com/blog/${post.slug}`,
    );
    expect(devtoBody.article.published).toBe(false);
    expect(devtoBody.article.tags).toEqual(['mcpprotocol', 'cliagents', 'aibenchmarks', 'tokenmath']);
    expect(devtoBody.article.main_image).toBe('https://assets.example.org/mcp-benchmark-chart.png');

    // Verify Bluesky external link card embed + byte facets
    const bskyCall = capturedCalls.find((c) =>
      c.url.endsWith('com.atproto.repo.createRecord'),
    );
    expect(bskyCall).toBeTruthy();
    const bskyBody = JSON.parse(String(bskyCall!.init?.body)) as {
      record: {
        text: string;
        embed: { external: { uri: string } };
        facets?: Array<{ index: { byteStart: number; byteEnd: number } }>;
      };
    };
    expect(bskyBody.record.text.length).toBeLessThanOrEqual(300);
    expect(bskyBody.record.embed.external.uri).toBe(`https://pyvren.com/blog/${post.slug}`);
    expect((bskyBody.record.facets || []).length).toBeGreaterThan(0);

    // Verify Hashnode originalArticleURL
    const hnCall = capturedCalls.find((c) => c.url === 'https://gql.hashnode.com/');
    expect(hnCall).toBeTruthy();
    const hnBody = JSON.parse(String(hnCall!.init?.body)) as {
      variables: { input: { originalArticleURL: string; publicationId: string } };
    };
    expect(hnBody.variables.input.originalArticleURL).toBe(`https://pyvren.com/blog/${post.slug}`);
    expect(hnBody.variables.input.publicationId).toBe('pub-123456');

    // Second run without force must skip all 5 already-published channels (zero extra HTTP calls)
    const callsBefore = capturedCalls.length;
    const secondRun = await syndicatePostToChannels(db, env, post);
    expect(secondRun.every((r) => r.ok && r.skipped)).toBe(true);
    expect(capturedCalls.length).toBe(callsBefore);
  });

  it('respects syndication_delay_hours in hourly Cron sweep (IndexNow immediate, DEV.to delayed 24h) and never syndicates drafts', async () => {
    const db = new InMemoryDatabase();
    const now = new Date('2026-11-26T12:00:00.000Z');

    // Fresh post (published 2h ago): eligible for IndexNow ONLY, NOT yet for DEV.to (delay=24h)
    const freshPost = await seedPublishedPost(db, {
      slug: 'fresh-post-two-hours-old',
      published_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    });
    // Draft post (48h old): must NEVER be syndicated
    await seedPublishedPost(db, {
      slug: 'unpublished-draft-post',
      status: 'draft',
      published_at: null,
    });

    await db.updateSettings({
      syndication_enabled: true,
      syndication_delay_hours: 24,
      syndication_channels_json: ['indexnow', 'devto'],
    });

    const env = createTestEnv(db, {
      INDEXNOW_KEY,
      DEVTO_API_KEY: 'devto-secret-key',
    });

    const hitUrls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      hitUrls.push(url);
      if (url === 'https://api.indexnow.org/indexnow') {
        return new Response('', { status: 200 });
      }
      if (url === 'https://dev.to/api/articles') {
        return new Response(JSON.stringify({ id: 555, url: 'https://dev.to/hamdi/fresh' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    }) as typeof fetch;

    const sweep1 = await runScheduledSyndicationSweep(db, env, now);
    expect(sweep1.processedPosts).toBe(1);
    expect(hitUrls).toEqual(['https://api.indexnow.org/indexnow']);

    // Advance clock by 25 hours -> now DEV.to is due, IndexNow is already published so skipped
    const later = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const sweep2 = await runScheduledSyndicationSweep(db, env, later);
    expect(sweep2.processedPosts).toBe(1);
    expect(hitUrls).toEqual([
      'https://api.indexnow.org/indexnow',
      'https://dev.to/api/articles',
    ]);

    const rows = await db.listPostSyndications({ post_id: freshPost.id });
    expect(rows.map((r) => `${r.channel}:${r.status}`).sort()).toEqual([
      'devto:published',
      'indexnow:published',
    ]);
  });

  it('exposes Admin Distribution API without leaking secrets and blocks private/loopback Mastodon SSRF URLs', async () => {
    const db = new InMemoryDatabase();
    const post = await seedPublishedPost(db);
    const draft = await seedPublishedPost(db, { slug: 'draft-not-ready', status: 'draft', published_at: null });

    const env = createTestEnv(db, {
      INDEXNOW_KEY,
      DEVTO_API_KEY: 'super-secret-devto-key-never-expose',
      MASTODON_INSTANCE_URL: 'https://127.0.0.1:8443',
      MASTODON_ACCESS_TOKEN: 'masto-secret-never-expose',
    });
    const app = createApp();
    const authHeaders = {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    };

    // 1. Status endpoint returns boolean configured flags and NEVER leaks raw secrets
    const statusRes = await app.fetch(
      new Request('https://pyvren.com/api/admin/syndication/status', { headers: authHeaders }),
      env,
    );
    expect(statusRes.status).toBe(200);
    const statusText = await statusRes.text();
    expect(statusText).not.toContain('super-secret-devto-key-never-expose');
    expect(statusText).not.toContain('masto-secret-never-expose');
    expect(statusText).not.toContain(INDEXNOW_KEY);

    const statusJson = JSON.parse(statusText) as {
      channels: Array<{ channel: string; configured: boolean }>;
    };
    expect(statusJson.channels.find((c) => c.channel === 'devto')?.configured).toBe(true);
    // Unsafe loopback Mastodon URL must be reported as NOT configured (SSRF guard)
    expect(statusJson.channels.find((c) => c.channel === 'mastodon')?.configured).toBe(false);

    // 2. Per-post syndication details include manual Medium/Substack/HackerNoon export pack
    const postSynRes = await app.fetch(
      new Request(`https://pyvren.com/api/admin/posts/${post.id}/syndications`, {
        headers: authHeaders,
      }),
      env,
    );
    expect(postSynRes.status).toBe(200);
    const postSynJson = (await postSynRes.json()) as {
      manual_export: { canonical_url: string; medium_import_url: string; teaser_markdown: string };
    };
    expect(postSynJson.manual_export.canonical_url).toBe(`https://pyvren.com/blog/${post.slug}`);
    expect(postSynJson.manual_export.medium_import_url).toBe('https://medium.com/p/import');
    expect(postSynJson.manual_export.teaser_markdown).toContain('Verified Key Facts');

    // 3. Syndicating a draft must fail with HTTP 400
    const draftSynRes = await app.fetch(
      new Request(`https://pyvren.com/api/admin/posts/${draft.id}/syndicate`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ channels: ['indexnow'] }),
      }),
      env,
    );
    expect(draftSynRes.status).toBe(400);

    // 4. Settings update persists syndication configuration
    const putSettingsRes = await app.fetch(
      new Request('https://pyvren.com/api/admin/settings', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          syndication_enabled: true,
          syndication_delay_hours: 36,
          syndication_mode: 'teaser',
          syndication_channels_json: ['indexnow', 'devto', 'bluesky'],
          devto_publish_as_draft: true,
        }),
      }),
      env,
    );
    expect(putSettingsRes.status).toBe(200);
    const savedSettings = (await putSettingsRes.json()) as {
      syndication_enabled: boolean;
      syndication_delay_hours: number;
      syndication_channels_json: string[];
      devto_publish_as_draft: boolean;
    };
    expect(savedSettings.syndication_enabled).toBe(true);
    expect(savedSettings.syndication_delay_hours).toBe(36);
    expect(savedSettings.syndication_channels_json).toEqual(['indexnow', 'devto', 'bluesky']);
    expect(savedSettings.devto_publish_as_draft).toBe(true);
  });
});
