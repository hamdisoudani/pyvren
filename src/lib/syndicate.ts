import { normalizeBaseUrl, type WorkerEnv } from '../env';
import type {
  DatabaseAdapter,
  PostRecord,
  PostSyndicationRecord,
  SiteSettings,
  SyndicationChannel,
  SyndicationMode,
} from '../types';
import { isSafePublicUrl, slugify } from './security';

export const ALL_SYNDICATION_CHANNELS: SyndicationChannel[] = [
  'indexnow',
  'devto',
  'bluesky',
  'mastodon',
  'hashnode',
];

const CHANNEL_TIMEOUT_MS = 12_000;
const SYNDICATION_USER_AGENT = 'Pyvren-Syndicator/1.0 (+https://pyvren.com)';
const VALID_INDEXNOW_KEY_RE = /^[A-Za-z0-9-]{8,128}$/;

export interface SyndicationChannelInfo {
  channel: SyndicationChannel;
  label: string;
  configured: boolean;
  enabled: boolean;
  delay_applies: boolean;
  secret_names: string[];
  note: string;
}

export interface ChannelPublishResult {
  channel: SyndicationChannel;
  ok: boolean;
  skipped?: boolean;
  remote_id?: string | null;
  remote_url?: string | null;
  error?: string;
  record?: PostSyndicationRecord;
}

export interface ManualExportPack {
  canonical_url: string;
  title: string;
  subtitle: string;
  tags: string[];
  teaser_markdown: string;
  full_canonical_markdown: string;
  social_blurb: string;
  medium_import_url: string;
  hackernoon_import_url: string;
}

export function isValidIndexNowKey(rawKey?: string | null): boolean {
  const key = (rawKey || '').trim();
  return VALID_INDEXNOW_KEY_RE.test(key);
}

export function isChannelConfigured(channel: SyndicationChannel, env: WorkerEnv): boolean {
  switch (channel) {
    case 'indexnow':
      return isValidIndexNowKey(env.INDEXNOW_KEY);
    case 'devto':
      return Boolean((env.DEVTO_API_KEY || '').trim());
    case 'bluesky':
      return Boolean((env.BLUESKY_HANDLE || '').trim() && (env.BLUESKY_APP_PASSWORD || '').trim());
    case 'mastodon': {
      const url = (env.MASTODON_INSTANCE_URL || '').trim();
      const token = (env.MASTODON_ACCESS_TOKEN || '').trim();
      return Boolean(token && url && isSafePublicUrl(url).ok);
    }
    case 'hashnode':
      return Boolean((env.HASHNODE_TOKEN || '').trim() && (env.HASHNODE_PUBLICATION_ID || '').trim());
    default:
      return false;
  }
}

export function getSyndicationChannelStatus(
  env: WorkerEnv,
  settings?: SiteSettings | null,
): SyndicationChannelInfo[] {
  const enabledSet = new Set<SyndicationChannel>(
    Array.isArray(settings?.syndication_channels_json)
      ? settings!.syndication_channels_json
      : ['indexnow'],
  );

  return [
    {
      channel: 'indexnow',
      label: 'IndexNow (Bing · Copilot · AI Search)',
      configured: isChannelConfigured('indexnow', env),
      enabled: enabledSet.has('indexnow'),
      delay_applies: false,
      secret_names: ['INDEXNOW_KEY'],
      note: 'Free instant push indexing for Bing, DuckDuckGo, Copilot, Yandex & AI search engines. Pings immediately on publish.',
    },
    {
      channel: 'devto',
      label: 'DEV.to (Official Forem API)',
      configured: isChannelConfigured('devto', env),
      enabled: enabledSet.has('devto'),
      delay_applies: true,
      secret_names: ['DEVTO_API_KEY'],
      note: 'Free official REST API with rel="canonical" pointing back to pyvren.com. Teaser mode + 24h delay prevents outranking your own site.',
    },
    {
      channel: 'bluesky',
      label: 'Bluesky (ATProto API)',
      configured: isChannelConfigured('bluesky', env),
      enabled: enabledSet.has('bluesky'),
      delay_applies: true,
      secret_names: ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD'],
      note: 'Free open API with rich external link cards pointing straight to pyvren.com (use a dedicated Bluesky App Password).',
    },
    {
      channel: 'mastodon',
      label: 'Mastodon (REST API)',
      configured: isChannelConfigured('mastodon', env),
      enabled: enabledSet.has('mastodon'),
      delay_applies: true,
      secret_names: ['MASTODON_INSTANCE_URL', 'MASTODON_ACCESS_TOKEN'],
      note: 'Free open API with strong security/OSS/cloud readership and direct links to pyvren.com.',
    },
    {
      channel: 'hashnode',
      label: 'Hashnode (GraphQL API — Pro)',
      configured: isChannelConfigured('hashnode', env),
      enabled: enabledSet.has('hashnode'),
      delay_applies: true,
      secret_names: ['HASHNODE_TOKEN', 'HASHNODE_PUBLICATION_ID'],
      note: 'Optional: Hashnode moved GraphQL API access to its paid Pro plan in May 2026.',
    },
  ];
}

export function buildCanonicalPostUrl(
  post: Pick<PostRecord, 'slug'>,
  settings: Pick<SiteSettings, 'base_url'>,
  env: WorkerEnv,
): string {
  const baseUrl = normalizeBaseUrl(settings.base_url || env.BASE_URL);
  return `${baseUrl}/blog/${encodeURIComponent(post.slug)}`;
}

/**
 * Sanitizes tags for DEV.to API: max 4 tags, strictly lowercase ASCII alphanumeric `[a-z0-9]` (no hyphens/spaces).
 */
export function sanitizeDevtoTags(tags: string[] | undefined, categorySlug?: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const pushTag = (raw: string) => {
    const clean = String(raw || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 30);
    if (clean.length < 2 || seen.has(clean)) return;
    seen.add(clean);
    out.push(clean);
  };

  for (const t of tags || []) {
    pushTag(t);
    if (out.length >= 4) return out;
  }

  if (out.length < 4 && categorySlug) {
    const catFallbacks: Record<string, string[]> = {
      'ai-coding-agents-mcp': ['ai', 'mcp', 'coding', 'agents'],
      'ai-security-jailbreaks': ['security', 'ai', 'cybersecurity', 'llm'],
      'ai-llms': ['ai', 'llm', 'machinelearning', 'opensource'],
      'cloud-gpu-infra': ['cloud', 'cloudflare', 'devops', 'gpu'],
      'agentic-browser-web-data': ['ai', 'webdev', 'seo', 'automation'],
      'dev-tooling-benchmarks': ['security', 'cybersecurity', 'cve', 'devops'],
      'generative-media-comfyui': ['ai', 'comfyui', 'opensource', 'gpu'],
    };
    for (const fallback of catFallbacks[categorySlug] || ['ai', 'programming']) {
      pushTag(fallback);
      if (out.length >= 4) return out;
    }
  }

  return out.slice(0, 4);
}

function isUsableRasterCoverUrl(url?: string | null): string | null {
  const raw = (url || '').trim();
  if (!raw || !raw.startsWith('https://')) return null;
  if (!isSafePublicUrl(raw).ok) return null;
  // External syndication APIs like DEV.to reject .svg cover images
  if (/\.svg(?:[?#]|$)/i.test(raw)) return null;
  return raw;
}

function extractH2HeadingsFromMarkdown(markdown: string, maxCount = 5): string[] {
  const headings: string[] = [];
  const lines = (markdown || '').split(/\r?\n/);
  for (const line of lines) {
    const match = /^##\s+(.+?)\s*#*$/.exec(line.trim());
    if (!match?.[1]) continue;
    const cleaned = match[1]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_`~]/g, '')
      .trim();
    if (cleaned.length >= 3) {
      headings.push(cleaned);
    }
    if (headings.length >= maxCount) break;
  }
  return headings;
}

function extractLeadParagraph(markdown: string): string {
  const withoutFences = (markdown || '').replace(/```[\s\S]*?```/g, '');
  const paragraphs = withoutFences
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 60 && !p.startsWith('#') && !p.startsWith('|') && !p.startsWith('!['));
  return paragraphs[0] || '';
}

/**
 * Builds an SEO-safe, high-value engineering teaser that gives readers real substance
 * (TL;DR + Verified Key Facts table + section highlights) while driving clicks back
 * to the canonical full benchmark/configs on pyvren.com — preventing duplicate-content cannibalization.
 */
export function buildTeaserMarkdown(
  post: PostRecord,
  settings: SiteSettings,
  canonicalUrl: string,
): string {
  const siteName = settings.site_name || 'The Pyvren Dispatch';
  const author = post.author || settings.default_author || 'Hamdi Soudani';
  const sections: string[] = [];

  const summary = (post.tldr_summary || post.description || '').trim();
  if (summary) {
    sections.push(`> **TL;DR:** ${summary}`);
  }

  const leadPara = extractLeadParagraph(post.body_markdown);
  if (leadPara && leadPara !== summary) {
    sections.push(leadPara);
  }

  const keyFacts = Array.isArray(post.key_facts_json) ? post.key_facts_json.slice(0, 6) : [];
  if (keyFacts.length > 0) {
    const rows = [
      '## Verified Key Facts',
      '',
      '| Metric / Signal | Finding |',
      '| :--- | :--- |',
      ...keyFacts.map((kf) => {
        const label = String(kf.label || '').replace(/\|/g, '\\|').trim();
        const val = String(kf.value || '').replace(/\|/g, '\\|').trim();
        return `| **${label}** | ${val} |`;
      }),
    ];
    sections.push(rows.join('\n'));
  }

  const headings = extractH2HeadingsFromMarkdown(post.body_markdown, 5);
  if (headings.length > 0) {
    sections.push(
      [
        '## Inside the Full Technical Dispatch',
        '',
        ...headings.map((h) => `- ${h}`),
      ].join('\n'),
    );
  }

  sections.push(
    [
      '---',
      '',
      `**Read the full analysis, runnable configurations, benchmark tables, and primary source citations on [${siteName}](${canonicalUrl}).**`,
      '',
      `*Originally published on [${siteName}](${canonicalUrl}) by ${author}.*`,
    ].join('\n'),
  );

  return sections.join('\n\n');
}

export function buildFullCanonicalMarkdown(
  post: PostRecord,
  settings: SiteSettings,
  canonicalUrl: string,
): string {
  const siteName = settings.site_name || 'The Pyvren Dispatch';
  const author = post.author || settings.default_author || 'Hamdi Soudani';
  const parts: string[] = [];

  if (post.tldr_summary && post.tldr_summary.trim()) {
    parts.push(`> **TL;DR:** ${post.tldr_summary.trim()}`);
  }

  parts.push((post.body_markdown || '').trim());

  if (Array.isArray(post.sources_json) && post.sources_json.length > 0) {
    parts.push(
      ['## Primary Sources', '', ...post.sources_json.slice(0, 8).map((s) => `- ${s}`)].join('\n'),
    );
  }

  parts.push(
    [
      '---',
      '',
      `*Originally published on [${siteName}](${canonicalUrl}) by ${author}.*`,
    ].join('\n'),
  );

  return parts.join('\n\n');
}

export function buildSocialSummaryText(
  post: PostRecord,
  canonicalUrl: string,
  opts: { maxChars: number; includeUrl: boolean },
): { text: string; hashtags: string[] } {
  const rawTags = sanitizeDevtoTags(post.tags_json, post.category_slug).slice(0, 3);
  const hashtags = rawTags.map((t) => `#${t}`);
  const tagsLine = hashtags.join(' ');

  const title = (post.title || '').replace(/\s+/g, ' ').trim();
  const blurb = (post.tldr_summary || post.description || '').replace(/\s+/g, ' ').trim();
  const suffixParts = [opts.includeUrl ? canonicalUrl : '', tagsLine].filter(Boolean);
  const suffix = suffixParts.length > 0 ? `\n\n${suffixParts.join('\n')}` : '';

  const maxChars = Math.max(80, opts.maxChars);
  const budget = maxChars - suffix.length;

  let body = title;
  if (blurb && title.length + 2 + blurb.length <= budget) {
    body = `${title}\n\n${blurb}`;
  } else if (blurb && budget - title.length - 4 >= 45) {
    const remain = budget - title.length - 3;
    body = `${title}\n\n${blurb.slice(0, remain - 1).trimEnd()}…`;
  } else if (body.length > budget) {
    body = `${body.slice(0, Math.max(10, budget - 1)).trimEnd()}…`;
  }

  return {
    text: `${body}${suffix}`.slice(0, maxChars),
    hashtags,
  };
}

function buildBlueskyTagFacets(text: string): Array<{
  index: { byteStart: number; byteEnd: number };
  features: Array<{ $type: 'app.bsky.richtext.facet#tag'; tag: string }>;
}> {
  const encoder = new TextEncoder();
  const facets: Array<{
    index: { byteStart: number; byteEnd: number };
    features: Array<{ $type: 'app.bsky.richtext.facet#tag'; tag: string }>;
  }> = [];

  const regex = /(?:^|\s)(#[a-zA-Z0-9_]{2,32})\b/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const full = match[0];
    const hashToken = match[1];
    const charStart = match.index + (full.length - hashToken.length);
    const charEnd = charStart + hashToken.length;
    const byteStart = encoder.encode(text.slice(0, charStart)).byteLength;
    const byteEnd = encoder.encode(text.slice(0, charEnd)).byteLength;
    facets.push({
      index: { byteStart, byteEnd },
      features: [
        {
          $type: 'app.bsky.richtext.facet#tag',
          tag: hashToken.slice(1),
        },
      ],
    });
  }

  return facets;
}

export function buildManualExportPack(
  post: PostRecord,
  settings: SiteSettings,
  env: WorkerEnv,
): ManualExportPack {
  const canonicalUrl = buildCanonicalPostUrl(post, settings, env);
  const teaser = buildTeaserMarkdown(post, settings, canonicalUrl);
  const full = buildFullCanonicalMarkdown(post, settings, canonicalUrl);
  const social = buildSocialSummaryText(post, canonicalUrl, { maxChars: 420, includeUrl: true });
  return {
    canonical_url: canonicalUrl,
    title: post.title,
    subtitle: post.tldr_summary || post.description,
    tags: sanitizeDevtoTags(post.tags_json, post.category_slug),
    teaser_markdown: teaser,
    full_canonical_markdown: full,
    social_blurb: social.text,
    medium_import_url: 'https://medium.com/p/import',
    hackernoon_import_url: 'https://app.hackernoon.com/new',
  };
}

// ---------------------------------------------------------------------------
// Individual Official-API Publishers
// ---------------------------------------------------------------------------

export async function pingIndexNow(
  urls: string[],
  baseUrlInput: string,
  indexNowKey: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const key = (indexNowKey || '').trim();
  if (!isValidIndexNowKey(key)) {
    return { ok: false, error: 'INDEXNOW_KEY is missing or invalid (must be 8-128 alphanumeric/hyphen chars).' };
  }
  const baseUrl = normalizeBaseUrl(baseUrlInput);
  let host: string;
  try {
    host = new URL(baseUrl).host;
  } catch {
    return { ok: false, error: `Invalid base URL: ${baseUrl}` };
  }

  const cleanUrls = Array.from(
    new Set(urls.map((u) => u.trim()).filter((u) => u.startsWith('https://'))),
  ).slice(0, 20);
  if (cleanUrls.length === 0) {
    return { ok: false, error: 'No valid https:// URLs supplied for IndexNow.' };
  }

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': SYNDICATION_USER_AGENT,
      },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${baseUrl}/${key}.txt`,
        urlList: cleanUrls,
      }),
      signal: AbortSignal.timeout(CHANNEL_TIMEOUT_MS),
    });

    if (res.status === 200 || res.status === 202) {
      return { ok: true, status: res.status };
    }
    const text = await res.text().catch(() => '');
    return {
      ok: false,
      status: res.status,
      error: `IndexNow HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function publishToDevto(
  post: PostRecord,
  settings: SiteSettings,
  canonicalUrl: string,
  env: WorkerEnv,
  mode: SyndicationMode,
): Promise<{ ok: boolean; remote_id?: string; remote_url?: string; error?: string }> {
  const apiKey = (env.DEVTO_API_KEY || '').trim();
  if (!apiKey) {
    return { ok: false, error: 'DEVTO_API_KEY secret is not configured.' };
  }

  const bodyMarkdown =
    mode === 'full_canonical'
      ? buildFullCanonicalMarkdown(post, settings, canonicalUrl)
      : buildTeaserMarkdown(post, settings, canonicalUrl);
  const tags = sanitizeDevtoTags(post.tags_json, post.category_slug);
  const coverImage = isUsableRasterCoverUrl(post.cover_image_url);

  const articlePayload: Record<string, unknown> = {
    title: post.title,
    published: !settings.devto_publish_as_draft,
    body_markdown: bodyMarkdown,
    tags,
    canonical_url: canonicalUrl,
    description: (post.description || post.tldr_summary || '').slice(0, 240),
  };
  if (coverImage) {
    articlePayload.main_image = coverImage;
  }

  try {
    const res = await fetch('https://dev.to/api/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/vnd.forem.api-v1+json',
        'api-key': apiKey,
        'User-Agent': SYNDICATION_USER_AGENT,
      },
      body: JSON.stringify({ article: articlePayload }),
      signal: AbortSignal.timeout(CHANNEL_TIMEOUT_MS),
    });

    const rawText = await res.text().catch(() => '');
    if (!res.ok) {
      return {
        ok: false,
        error: `DEV.to HTTP ${res.status}: ${rawText.slice(0, 240) || res.statusText}`,
      };
    }

    const parsed = rawText ? (JSON.parse(rawText) as { id?: number | string; url?: string }) : {};
    return {
      ok: true,
      remote_id: parsed.id !== undefined ? String(parsed.id) : undefined,
      remote_url: typeof parsed.url === 'string' ? parsed.url : undefined,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function publishToBluesky(
  post: PostRecord,
  canonicalUrl: string,
  env: WorkerEnv,
): Promise<{ ok: boolean; remote_id?: string; remote_url?: string; error?: string }> {
  const handle = (env.BLUESKY_HANDLE || '').trim().replace(/^@/, '');
  const appPassword = (env.BLUESKY_APP_PASSWORD || '').trim();
  if (!handle || !appPassword) {
    return { ok: false, error: 'BLUESKY_HANDLE or BLUESKY_APP_PASSWORD secret is not configured.' };
  }

  try {
    const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': SYNDICATION_USER_AGENT,
      },
      body: JSON.stringify({ identifier: handle, password: appPassword }),
      signal: AbortSignal.timeout(CHANNEL_TIMEOUT_MS),
    });

    const sessionText = await sessionRes.text().catch(() => '');
    if (!sessionRes.ok) {
      return {
        ok: false,
        error: `Bluesky auth HTTP ${sessionRes.status}: ${sessionText.slice(0, 200)}`,
      };
    }
    const session = JSON.parse(sessionText) as {
      accessJwt?: string;
      did?: string;
      handle?: string;
    };
    if (!session.accessJwt || !session.did) {
      return { ok: false, error: 'Bluesky createSession returned missing accessJwt or did.' };
    }

    const { text } = buildSocialSummaryText(post, canonicalUrl, {
      maxChars: 295,
      includeUrl: false,
    });
    const facets = buildBlueskyTagFacets(text);

    const record: Record<string, unknown> = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: new Date().toISOString(),
      langs: ['en'],
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: canonicalUrl,
          title: post.title.slice(0, 200),
          description: (post.tldr_summary || post.description || '').slice(0, 300),
        },
      },
    };
    if (facets.length > 0) {
      record.facets = facets;
    }

    const createRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessJwt}`,
        'User-Agent': SYNDICATION_USER_AGENT,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: 'app.bsky.feed.post',
        record,
      }),
      signal: AbortSignal.timeout(CHANNEL_TIMEOUT_MS),
    });

    const createText = await createRes.text().catch(() => '');
    if (!createRes.ok) {
      return {
        ok: false,
        error: `Bluesky post HTTP ${createRes.status}: ${createText.slice(0, 200)}`,
      };
    }

    const created = JSON.parse(createText) as { uri?: string; cid?: string };
    const rkey = typeof created.uri === 'string' ? created.uri.split('/').pop() || '' : '';
    const resolvedHandle = session.handle || handle;
    const remoteUrl = rkey ? `https://bsky.app/profile/${resolvedHandle}/post/${rkey}` : undefined;

    return {
      ok: true,
      remote_id: created.uri || created.cid,
      remote_url: remoteUrl,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function publishToMastodon(
  post: PostRecord,
  canonicalUrl: string,
  env: WorkerEnv,
): Promise<{ ok: boolean; remote_id?: string; remote_url?: string; error?: string }> {
  const rawInstance = (env.MASTODON_INSTANCE_URL || '').trim();
  const accessToken = (env.MASTODON_ACCESS_TOKEN || '').trim();
  if (!rawInstance || !accessToken) {
    return {
      ok: false,
      error: 'MASTODON_INSTANCE_URL or MASTODON_ACCESS_TOKEN secret is not configured.',
    };
  }

  const check = isSafePublicUrl(rawInstance);
  if (!check.ok || !check.url) {
    return { ok: false, error: `Unsafe Mastodon instance URL blocked: ${check.reason || 'invalid'}` };
  }

  const endpoint = `${check.url.origin}/api/v1/statuses`;
  const { text } = buildSocialSummaryText(post, canonicalUrl, {
    maxChars: 490,
    includeUrl: true,
  });

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Idempotency-Key': `pyvren-post-${post.id}`,
        'User-Agent': SYNDICATION_USER_AGENT,
      },
      body: JSON.stringify({
        status: text,
        visibility: 'public',
        language: 'en',
      }),
      signal: AbortSignal.timeout(CHANNEL_TIMEOUT_MS),
    });

    const rawText = await res.text().catch(() => '');
    if (!res.ok) {
      return {
        ok: false,
        error: `Mastodon HTTP ${res.status}: ${rawText.slice(0, 220) || res.statusText}`,
      };
    }

    const parsed = rawText ? (JSON.parse(rawText) as { id?: string; url?: string }) : {};
    return {
      ok: true,
      remote_id: parsed.id ? String(parsed.id) : undefined,
      remote_url: typeof parsed.url === 'string' ? parsed.url : undefined,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function publishToHashnode(
  post: PostRecord,
  settings: SiteSettings,
  canonicalUrl: string,
  env: WorkerEnv,
  mode: SyndicationMode,
): Promise<{ ok: boolean; remote_id?: string; remote_url?: string; error?: string }> {
  const token = (env.HASHNODE_TOKEN || '').trim();
  const publicationId = (env.HASHNODE_PUBLICATION_ID || '').trim();
  if (!token || !publicationId) {
    return { ok: false, error: 'HASHNODE_TOKEN or HASHNODE_PUBLICATION_ID secret is not configured.' };
  }

  const contentMarkdown =
    mode === 'full_canonical'
      ? buildFullCanonicalMarkdown(post, settings, canonicalUrl)
      : buildTeaserMarkdown(post, settings, canonicalUrl);
  const coverImage = isUsableRasterCoverUrl(post.cover_image_url);
  const tags = (post.tags_json || [])
    .slice(0, 5)
    .map((t) => ({
      slug: slugify(t, 40),
      name: t.trim().slice(0, 50),
    }))
    .filter((t) => t.slug && t.name);

  const input: Record<string, unknown> = {
    publicationId,
    title: post.title,
    subtitle: (post.tldr_summary || post.description || '').slice(0, 220),
    contentMarkdown,
    originalArticleURL: canonicalUrl,
    tags,
  };
  if (coverImage) {
    input.coverImageOptions = { coverImageURL: coverImage };
  }

  const query = `mutation PublishPost($input: PublishPostInput!) {
    publishPost(input: $input) {
      post {
        id
        url
      }
    }
  }`;

  try {
    const res = await fetch('https://gql.hashnode.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
        'User-Agent': SYNDICATION_USER_AGENT,
      },
      body: JSON.stringify({ query, variables: { input } }),
      signal: AbortSignal.timeout(CHANNEL_TIMEOUT_MS),
    });

    const rawText = await res.text().catch(() => '');
    if (!res.ok) {
      return {
        ok: false,
        error: `Hashnode HTTP ${res.status}: ${rawText.slice(0, 220) || res.statusText}`,
      };
    }

    const parsed = rawText
      ? (JSON.parse(rawText) as {
          data?: { publishPost?: { post?: { id?: string; url?: string } } };
          errors?: Array<{ message?: string }>;
        })
      : {};

    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return {
        ok: false,
        error: `Hashnode GraphQL error: ${parsed.errors[0]?.message || 'Unknown error'}`,
      };
    }

    const created = parsed.data?.publishPost?.post;
    return {
      ok: true,
      remote_id: created?.id || undefined,
      remote_url: created?.url || undefined,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Orchestration: Immediate IndexNow Ping, Manual Syndication & Delayed Cron Sweep
// ---------------------------------------------------------------------------

/**
 * Best-effort instant IndexNow ping when a post is published or updated.
 * Never throws and silently no-ops if INDEXNOW_KEY is not configured.
 */
export async function pingIndexNowForPost(
  db: DatabaseAdapter,
  env: WorkerEnv,
  post: PostRecord,
  existingSettings?: SiteSettings,
): Promise<ChannelPublishResult | null> {
  if (post.status !== 'published') return null;
  if (!isChannelConfigured('indexnow', env)) return null;

  const settings = existingSettings || (await db.getSettings());
  const channels = Array.isArray(settings.syndication_channels_json)
    ? settings.syndication_channels_json
    : ['indexnow'];
  if (!channels.includes('indexnow')) return null;

  const canonicalUrl = buildCanonicalPostUrl(post, settings, env);
  const baseUrl = normalizeBaseUrl(settings.base_url || env.BASE_URL);
  const prevRows = await db.listPostSyndications({ post_id: post.id, channel: 'indexnow', limit: 1 });
  const prevAttempts = prevRows[0]?.attempts ?? 0;

  const result = await pingIndexNow([canonicalUrl], baseUrl, (env.INDEXNOW_KEY || '').trim());
  const nowIso = new Date().toISOString();
  const record = await db.upsertPostSyndication({
    post_id: post.id,
    channel: 'indexnow',
    status: result.ok ? 'published' : 'failed',
    mode: settings.syndication_mode || 'teaser',
    remote_id: result.status ? String(result.status) : null,
    remote_url: canonicalUrl,
    error_message: result.ok ? null : result.error || 'IndexNow ping failed',
    attempts: prevAttempts + 1,
    syndicated_at: result.ok ? nowIso : prevRows[0]?.syndicated_at ?? null,
  });

  return {
    channel: 'indexnow',
    ok: result.ok,
    remote_id: record.remote_id,
    remote_url: record.remote_url,
    ...(result.error ? { error: result.error } : {}),
    record,
  };
}

/**
 * Syndicates a single published post across requested (or configured+enabled) channels.
 * Skips channels already marked `published` unless `force: true`.
 */
export async function syndicatePostToChannels(
  db: DatabaseAdapter,
  env: WorkerEnv,
  post: PostRecord,
  opts?: {
    channels?: SyndicationChannel[];
    mode?: SyndicationMode;
    force?: boolean;
    settings?: SiteSettings;
  },
): Promise<ChannelPublishResult[]> {
  if (post.status !== 'published') {
    throw new Error('Only published posts can be syndicated.');
  }

  const settings = opts?.settings || (await db.getSettings());
  const mode: SyndicationMode = opts?.mode || settings.syndication_mode || 'teaser';
  const targetChannels: SyndicationChannel[] =
    opts?.channels && opts.channels.length > 0
      ? opts.channels
      : (settings.syndication_channels_json || ['indexnow']).filter((ch) =>
          isChannelConfigured(ch, env),
        );

  const existingRecords = await db.listPostSyndications({ post_id: post.id, limit: 20 });
  const existingByChannel = new Map<SyndicationChannel, PostSyndicationRecord>(
    existingRecords.map((r) => [r.channel, r]),
  );

  const canonicalUrl = buildCanonicalPostUrl(post, settings, env);
  const baseUrl = normalizeBaseUrl(settings.base_url || env.BASE_URL);
  const results: ChannelPublishResult[] = [];

  for (const channel of targetChannels) {
    const existing = existingByChannel.get(channel);
    if (existing && existing.status === 'published' && !opts?.force) {
      results.push({
        channel,
        ok: true,
        skipped: true,
        remote_id: existing.remote_id,
        remote_url: existing.remote_url,
        record: existing,
      });
      continue;
    }

    if (!isChannelConfigured(channel, env)) {
      const skippedRec = await db.upsertPostSyndication({
        post_id: post.id,
        channel,
        status: 'skipped',
        mode,
        error_message: `Credentials not configured for ${channel}.`,
        attempts: (existing?.attempts ?? 0) + 1,
        syndicated_at: existing?.syndicated_at ?? null,
      });
      results.push({
        channel,
        ok: false,
        skipped: true,
        error: skippedRec.error_message || undefined,
        record: skippedRec,
      });
      continue;
    }

    let outcome: { ok: boolean; remote_id?: string; remote_url?: string; error?: string };
    switch (channel) {
      case 'indexnow': {
        const res = await pingIndexNow([canonicalUrl], baseUrl, (env.INDEXNOW_KEY || '').trim());
        outcome = {
          ok: res.ok,
          remote_id: res.status ? String(res.status) : undefined,
          remote_url: canonicalUrl,
          error: res.error,
        };
        break;
      }
      case 'devto':
        outcome = await publishToDevto(post, settings, canonicalUrl, env, mode);
        break;
      case 'bluesky':
        outcome = await publishToBluesky(post, canonicalUrl, env);
        break;
      case 'mastodon':
        outcome = await publishToMastodon(post, canonicalUrl, env);
        break;
      case 'hashnode':
        outcome = await publishToHashnode(post, settings, canonicalUrl, env, mode);
        break;
      default:
        outcome = { ok: false, error: `Unsupported channel: ${String(channel)}` };
    }

    const nowIso = new Date().toISOString();
    const record = await db.upsertPostSyndication({
      post_id: post.id,
      channel,
      status: outcome.ok ? 'published' : 'failed',
      mode,
      remote_id: outcome.remote_id ?? existing?.remote_id ?? null,
      remote_url: outcome.remote_url ?? existing?.remote_url ?? null,
      error_message: outcome.ok ? null : outcome.error || `${channel} publish failed`,
      attempts: (existing?.attempts ?? 0) + 1,
      syndicated_at: outcome.ok ? nowIso : existing?.syndicated_at ?? null,
    });

    results.push({
      channel,
      ok: outcome.ok,
      remote_id: record.remote_id,
      remote_url: record.remote_url,
      ...(outcome.error ? { error: outcome.error } : {}),
      record,
    });
  }

  return results;
}

/**
 * Hourly Cron sweep that respects `syndication_delay_hours` (default 24h so Google indexes
 * pyvren.com before third-party syndication) and caps work to 2 posts per tick to stay safely
 * within Cloudflare Workers Free-plan subrequest budgets.
 */
export async function runScheduledSyndicationSweep(
  db: DatabaseAdapter,
  env: WorkerEnv,
  now = new Date(),
): Promise<{ processedPosts: number; results: Array<{ post_id: number; results: ChannelPublishResult[] }> }> {
  const settings = await db.getSettings();
  if (!settings.syndication_enabled) {
    return { processedPosts: 0, results: [] };
  }

  const enabledConfigured = (settings.syndication_channels_json || []).filter((ch) =>
    isChannelConfigured(ch, env),
  );
  if (enabledConfigured.length === 0) {
    return { processedPosts: 0, results: [] };
  }

  const [publishedPosts, recentSyndications] = await Promise.all([
    db.listPosts({ status: 'published', limit: 50, excludeHeavyHtml: true }),
    db.listPostSyndications({ limit: 250 }),
  ]);

  const byPostChannel = new Map<string, PostSyndicationRecord>();
  for (const row of recentSyndications) {
    byPostChannel.set(`${row.post_id}::${row.channel}`, row);
  }

  const nowMs = now.getTime();
  const delayMs = Math.max(0, settings.syndication_delay_hours ?? 24) * 60 * 60 * 1000;
  const maxPostsPerTick = 2;
  const processed: Array<{ post_id: number; results: ChannelPublishResult[] }> = [];

  for (const post of publishedPosts) {
    if (processed.length >= maxPostsPerTick) break;
    if (post.status !== 'published') continue;

    const pubMs = Date.parse(post.published_at || post.created_at);
    if (!Number.isFinite(pubMs)) continue;
    const ageMs = nowMs - pubMs;

    const dueChannels: SyndicationChannel[] = [];
    for (const ch of enabledConfigured) {
      const existing = byPostChannel.get(`${post.id}::${ch}`);
      if (existing && existing.status === 'published') continue;
      // Avoid retrying permanently failing channels more than 3 times automatically
      if (existing && existing.status === 'failed' && existing.attempts >= 3) continue;

      if (ch === 'indexnow') {
        dueChannels.push(ch);
      } else if (ageMs >= delayMs) {
        dueChannels.push(ch);
      }
    }

    if (dueChannels.length === 0) continue;

    const results = await syndicatePostToChannels(db, env, post, {
      channels: dueChannels,
      mode: settings.syndication_mode,
      settings,
    });
    processed.push({ post_id: post.id, results });
  }

  return { processedPosts: processed.length, results: processed };
}
