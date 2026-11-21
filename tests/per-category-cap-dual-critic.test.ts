import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createApp, shouldExecuteScheduledDiscovery } from '../src/index';
import type { WorkerEnv } from '../src/env';
import {
  createEmptyTokenUsage,
  stageHuntTopics,
  stageLoadContext,
  stageQualityAssessment,
  type DraftArticlePayload,
  type PrimarySourceDoc,
} from '../src/lib/agent';
import {
  DEFAULT_SEEDED_SETTINGS,
  DEFAULT_SEEDED_SKILLS,
  InMemoryDatabase,
} from '../src/lib/db';
import { lintPostPayload } from '../src/lib/linter';
import {
  getOpenRouterModelFamily,
  pickDistinctFreeCriticPair,
} from '../src/lib/openrouter';
import { selectSkillForRun } from '../src/lib/skills';
import { fetchAuthoritativeFeed } from '../src/lib/tools';
import type { PostCreateRecord, TraceEntry } from '../src/types';

function makeSeedPost(slug: string, category_slug: string): PostCreateRecord {
  return {
    slug,
    title: `Verified benchmark note for ${slug}`,
    description: `Concrete measurements and deployment findings for ${slug}.`,
    tldr_summary: `Key measurements for ${slug}.`,
    key_facts_json: [],
    faq_json: [],
    body_markdown: 'Body content for test post.',
    body_html: '<p>Body content for test post.</p>',
    author: 'Hamdi Soudani',
    category_slug,
    archetype: 'benchmark-index',
    tags_json: ['benchmark'],
    keywords_json: ['benchmark'],
    sources_json: ['https://github.com/example/repo/releases/tag/v1.0'],
    review_notes_json: [],
    lint_passed: true,
    lint_errors_json: [],
    quality_score: 90,
    quality_breakdown_json: {
      overall: 90,
      seo_structure: 90,
      geo_citation_readiness: 90,
      information_gain: 90,
      source_grounding: 90,
      anti_slop_cleanliness: 90,
      adsense_compliance: 100,
      warnings: [],
    },
    reading_time_minutes: 4,
    word_count: 800,
    status: 'published',
    admin_locked: false,
    last_edited_by: 'agent',
    published_at: new Date().toISOString(),
  };
}

describe('Per-Category Daily Cap (7x2=14/day), 7 Trending Categories & Cross-Family Dual-Critic Loop', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Enforces max_posts_per_day PER CATEGORY (7 categories x 2 = 14/day) and rotates away from capped categories', async () => {
    expect(DEFAULT_SEEDED_SKILLS).toHaveLength(7);
    expect(DEFAULT_SEEDED_SKILLS.some((s) => s.slug === 'generative-media-comfyui')).toBe(true);

    const settings = {
      ...DEFAULT_SEEDED_SETTINGS,
      schedule_enabled: true,
      runs_per_day: 16,
      preferred_hours_utc_json: [],
      max_posts_per_day: 2,
      last_scheduled_run_at: null,
    };

    // With 7 enabled categories and 2 posts/cat/day, total daily cap is 14!
    expect(
      shouldExecuteScheduledDiscovery(settings, new Date('2026-11-21T10:00:00Z'), 2, false, 7),
    ).toEqual({ shouldRun: true, reason: 'scheduled_slot_matched' });
    expect(
      shouldExecuteScheduledDiscovery(settings, new Date('2026-11-21T10:00:00Z'), 13, false, 7),
    ).toEqual({ shouldRun: true, reason: 'scheduled_slot_matched' });
    expect(
      shouldExecuteScheduledDiscovery(settings, new Date('2026-11-21T10:00:00Z'), 14, false, 7),
    ).toEqual({ shouldRun: false, reason: 'daily_post_cap_reached' });

    // Seed 2 posts today in `ai-llms` -> ai-llms is capped (2/2), while other 6 categories are at 0/2
    const db = new InMemoryDatabase();
    await db.createPost(makeSeedPost('llm-post-1', 'ai-llms'));
    await db.createPost(makeSeedPost('llm-post-2', 'ai-llms'));
    const allPosts = await db.listPosts({ limit: 50 });

    // Auto rotation MUST skip capped ai-llms and pick an uncapped category
    const autoSkill = selectSkillForRun(DEFAULT_SEEDED_SKILLS, 'auto', allPosts, 2);
    expect(autoSkill.slug).not.toBe('ai-llms');

    // Scheduled run explicitly targeting capped `ai-llms` skips with skip_daily_cap
    const cappedCtx = await stageLoadContext(db, {
      trigger_source: 'scheduled',
      category_slug: 'ai-llms',
    });
    expect(cappedCtx.categoryPostsCreatedLast24h).toBe(2);
    const traceCapped: TraceEntry[] = [];
    const huntedCapped = await stageHuntTopics(
      { __TEST_DB__: db } as WorkerEnv,
      cappedCtx,
      undefined,
      traceCapped,
      createEmptyTokenUsage(),
    );
    expect(huntedCapped.decision).toBe('skip_daily_cap');
    expect(huntedCapped.skipReason).toContain('ai-llms');

    // Scheduled run targeting `generative-media-comfyui` (0/2 today) is NOT blocked by ai-llms's 2 posts!
    const comfyCtx = await stageLoadContext(db, {
      trigger_source: 'scheduled',
      category_slug: 'generative-media-comfyui',
    });
    expect(comfyCtx.categoryPostsCreatedLast24h).toBe(0);
    expect(comfyCtx.postsCreatedLast24h).toBe(2);

    // Public category page for #7 ComfyUI & Video renders cleanly
    const app = createApp();
    const catRes = await app.request(
      'https://pyvren.com/category/generative-media-comfyui',
      {},
      { __TEST_DB__: db, BASE_URL: 'https://pyvren.com' },
    );
    expect(catRes.status).toBe(200);
    const catHtml = await catRes.text();
    expect(catHtml).toContain('ComfyUI');
  });

  it('2. Parses new openrouter_free_models and bleepingcomputer_rss feeds cleanly', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('openrouter.ai/api/v1/models')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'qwen/qwen3-next-80b:free',
                name: 'Qwen3 Next 80B',
                created: 1763700000,
                context_length: 131072,
                pricing: { prompt: '0', completion: '0' },
                description: 'Fast open-weights model',
              },
              {
                id: 'openai/gpt-5-paid',
                name: 'Paid Model',
                created: 1763800000,
                context_length: 128000,
                pricing: { prompt: '0.000005', completion: '0.000015' },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('bleepingcomputer.com/feed')) {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>
            <item>
              <title>Major Federal Portal Breach Discloses 48,000 Records via Zero-Day</title>
              <link>https://www.bleepingcomputer.com/news/security/federal-portal-breach-zero-day/</link>
              <description>Incident responders confirmed unauthorized access through an unpatched edge appliance.</description>
              <pubDate>Fri, 21 Nov 2026 10:00:00 GMT</pubDate>
            </item>
          </channel></rss>`,
          { status: 200, headers: { 'Content-Type': 'application/rss+xml' } },
        );
      }
      return new Response('Not mocked', { status: 404 });
    });

    const freeItems = await fetchAuthoritativeFeed('openrouter_free_models');
    expect(freeItems).toHaveLength(1);
    expect(freeItems[0].title).toContain('Qwen3 Next 80B');
    expect(freeItems[0].url).toBe('https://openrouter.ai/qwen/qwen3-next-80b:free');

    const breachItems = await fetchAuthoritativeFeed('bleepingcomputer_rss');
    expect(breachItems).toHaveLength(1);
    expect(breachItems[0].title).toContain('Federal Portal Breach');
  });

  it('3. Selects two distinct $0 OpenRouter model families and executes dual-critic review + automated revision loop', async () => {
    // Verify cross-family selection guarantees Critic A != Critic B and neither matches Writer
    const pair = pickDistinctFreeCriticPair({
      writerModel: 'deepseek/deepseek-r1:free',
      preferredJudgeModel: 'openrouter/free',
      fallbackModels: ['google/gemma-4-31b-it:free', 'nvidia/nemotron-3.5-super-vl:free'],
      freeModelsOnly: true,
    });
    expect(pair.writerFamily).toBe('deepseek');
    expect(pair.crossFamily).toBe(true);
    expect(pair.criticAFamily).not.toBe(pair.criticBFamily);
    expect(pair.criticAFamily).not.toBe('deepseek');
    expect(pair.criticBFamily).not.toBe('deepseek');
    expect(getOpenRouterModelFamily('meta-llama/llama-3.3-70b-instruct:free')).toBe('meta-llama');

    // End-to-end stageQualityAssessment test: draft initially missing table & reference image -> critics request revision -> writer revises and adds both!
    const db = new InMemoryDatabase();
    const ctx = await stageLoadContext(db, {
      category_slug: 'generative-media-comfyui',
      trigger_source: 'manual',
    });
    ctx.model = 'deepseek/deepseek-r1:free';

    const sources: PrimarySourceDoc[] = [
      {
        url: 'https://github.com/comfyanonymous/ComfyUI/releases/tag/v0.4.2',
        title: 'ComfyUI v0.4.2 Release Notes',
        markdown: 'ComfyUI v0.4.2 adds FP8 Wan 2.2 memory offloading cutting RTX 4090 VRAM from 23.4 GB down to 11.8 GB with 18.2s per 5s 720p clip.',
        chars: 140,
        images: [
          {
            url: 'https://raw.githubusercontent.com/comfyanonymous/ComfyUI/master/docs/wan22-graph.png',
            alt: 'ComfyUI Wan 2.2 FP8 workflow node graph',
            source_page_url: 'https://github.com/comfyanonymous/ComfyUI/releases/tag/v0.4.2',
          },
        ],
      },
      {
        url: 'https://huggingface.co/Wan-AI/Wan2.2-T2V-14B',
        title: 'Wan 2.2 14B Model Card',
        markdown: 'Wan 2.2 14B supports 720p 24fps generation using TeaCache and SageAttention with 4.1 GB GGUF Q4 weights.',
        chars: 112,
      },
    ];

    const initialDraft: DraftArticlePayload = {
      title: 'ComfyUI v0.4.2 Cuts Wan 2.2 Video VRAM by 49% on Consumer GPUs',
      slug: 'comfyui-v042-wan22-vram-benchmark',
      description: 'Measured VRAM footprint, clip latency, and exact ComfyUI v0.4.2 node settings for running Wan 2.2 14B on 12GB-24GB consumer GPUs.',
      tldr_summary: 'ComfyUI v0.4.2 FP8 offloading drops Wan 2.2 14B VRAM usage from 23.4 GB to 11.8 GB on RTX 4090 at 18.2s per 5-second 720p clip.',
      cover_image_url: null,
      cover_image_alt: null,
      images: [],
      key_facts: [
        { label: 'Peak VRAM (FP8)', value: '11.8 GB on RTX 4090', source_url: sources[0].url },
        { label: 'Clip Latency', value: '18.2s per 5s 720p clip', source_url: sources[0].url },
        { label: 'Model Size', value: '14B parameters (Wan 2.2)', source_url: sources[1].url },
      ],
      faq: [
        { question: 'Can Wan 2.2 run on a 12GB GPU in ComfyUI v0.4.2?', answer: 'Yes, FP8 weight streaming keeps peak VRAM at 11.8 GB when TeaCache is enabled.' },
        { question: 'Does FP8 hurt motion coherence?', answer: 'Tests show minimal drift at 24fps while nearly halving memory pressure.' },
        { question: 'Which attention backend is fastest?', answer: 'SageAttention with TeaCache delivered the lowest wall-clock time.' },
      ],
      body_markdown: `## Model & Workflow Verdict

Running 14B video diffusion locally used to require a 24 GB card or painful CPU swaps. ComfyUI v0.4.2 fixes the biggest memory cliff in [the v0.4.2 release notes](${sources[0].url}).

## ComfyUI Node Graph & Reproducible Settings

Enable \`--fp8_e4m3fn-unet\` alongside SageAttention as documented on [the Wan 2.2 model card](${sources[1].url}). Peak VRAM drops to 11.8 GB with 18.2 seconds per 5-second 720p clip.

\`\`\`bash
python main.py --fp8_e4m3fn-unet --use-sage-attention
\`\`\`

## Failure Modes, Artifacts & VRAM Optimization

Avoid stacking three ControlNet preprocessors simultaneously on 12 GB cards. Offload text encoders between passes and cap batch size at 1.`,
      tags: ['comfyui', 'ai-video', 'wan-2-2'],
      keywords: ['ComfyUI v0.4.2 Wan 2.2 VRAM', 'ComfyUI FP8 video workflow'],
      sources: [sources[0].url, sources[1].url],
      review_notes: [],
    };

    const initialLint = lintPostPayload({
      title: initialDraft.title,
      description: initialDraft.description,
      tldr_summary: initialDraft.tldr_summary,
      key_facts: initialDraft.key_facts,
      faq: initialDraft.faq,
      body_markdown: initialDraft.body_markdown,
      author: ctx.settings.default_author,
      archetype: ctx.archetype,
      sources: initialDraft.sources,
      banned_patterns: ctx.skill.banned_patterns_json,
    });

    const calledModels: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('openrouter.ai/api/v1/chat/completions')) {
        const body = JSON.parse(String(init?.body || '{}')) as {
          model: string;
          messages: Array<{ role: string; content: string }>;
        };
        calledModels.push(body.model);
        const sys = body.messages[0]?.content || '';

        // Critic 1 (Editorial, Visuals & Tables)
        if (sys.includes('Critic 1')) {
          return new Response(
            JSON.stringify({
              model: body.model,
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      editorial_tone: 88,
                      factual_grounding: 90,
                      visuals_and_tables: 64,
                      verdict: 'revise',
                      blocking_issues: [
                        'Missing Markdown comparison table for FP16 vs FP8 vs GGUF Q4 VRAM',
                        'No verified crawled reference image attached despite 1 available image',
                      ],
                      concrete_fixes: [
                        'Add a Markdown table comparing FP16, FP8, and GGUF Q4 VRAM and latency',
                        'Attach the crawled ComfyUI workflow graph image as cover_image_url and inline figure',
                      ],
                      notes: 'Voice and metrics are strong, but add a spec table and the crawled graph image.',
                    }),
                  },
                },
              ],
              usage: { prompt_tokens: 400, completion_tokens: 120, total_tokens: 520 },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        // Critic 2 (SEO, GEO & AdSense)
        if (sys.includes('Critic 2')) {
          return new Response(
            JSON.stringify({
              model: body.model,
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      seo_score: 89,
                      geo_clarity: 91,
                      adsense_safety: 96,
                      verdict: 'pass',
                      blocking_issues: [],
                      concrete_fixes: [],
                      notes: 'Strong search intent, clean GEO facts, and fully AdSense-compliant original analysis.',
                    }),
                  },
                },
              ],
              usage: { prompt_tokens: 400, completion_tokens: 100, total_tokens: 500 },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        // Writer Revision Pass
        const revisedBody = `${initialDraft.body_markdown}

## VRAM, Speed & Quality Comparison Table

| Precision | Peak VRAM (RTX 4090) | 5s 720p Latency | Notes |
| --- | --- | --- | --- |
| FP16 Baseline | 23.4 GB | 21.5s | Requires 24 GB GPU |
| FP8 Offload (v0.4.2) | 11.8 GB | 18.2s | Fits 12 GB consumer GPUs |
| GGUF Q4 + TeaCache | 8.9 GB | 15.9s | Slight fine-detail softening |

![ComfyUI Wan 2.2 FP8 workflow node graph](https://raw.githubusercontent.com/comfyanonymous/ComfyUI/master/docs/wan22-graph.png)`;

        return new Response(
          JSON.stringify({
            model: body.model,
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    ...initialDraft,
                    cover_image_url:
                      'https://raw.githubusercontent.com/comfyanonymous/ComfyUI/master/docs/wan22-graph.png',
                    cover_image_alt: 'ComfyUI Wan 2.2 FP8 workflow node graph',
                    images: [
                      {
                        url: 'https://raw.githubusercontent.com/comfyanonymous/ComfyUI/master/docs/wan22-graph.png',
                        alt: 'ComfyUI Wan 2.2 FP8 workflow node graph',
                        source_page_url: sources[0].url,
                      },
                    ],
                    body_markdown: revisedBody,
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 900, completion_tokens: 600, total_tokens: 1500 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('Not mocked', { status: 404 });
    });

    const trace: TraceEntry[] = [];
    const usage = createEmptyTokenUsage();
    const assessed = await stageQualityAssessment(
      { OPENROUTER_API_KEY: 'sk-or-test' } as WorkerEnv,
      ctx,
      initialDraft,
      initialLint,
      trace,
      usage,
      sources,
    );

    // Must have invoked 3 calls: Critic 1 (Family A), Critic 2 (Family B), and Writer revision pass
    expect(calledModels).toHaveLength(3);
    expect(getOpenRouterModelFamily(calledModels[0])).not.toBe(getOpenRouterModelFamily(calledModels[1]));
    expect(assessed.finalBreakdown.dual_critic_review?.cross_family_verified).toBe(true);
    expect(assessed.finalBreakdown.dual_critic_review?.revision_triggered).toBe(true);
    expect(assessed.finalBreakdown.dual_critic_review?.revision_applied).toBe(true);
    expect(assessed.finalBreakdown.dual_critic_review?.has_reference_images).toBe(true);
    expect(assessed.finalBreakdown.dual_critic_review?.has_data_table).toBe(true);
    expect(assessed.revisedDraft?.cover_image_url).toContain('wan22-graph.png');
    expect(assessed.revisedDraft?.body_markdown).toContain('| Precision | Peak VRAM (RTX 4090) |');
  });
});
