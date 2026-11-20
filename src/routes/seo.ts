import { Hono } from 'hono';
import { normalizeBaseUrl, type WorkerEnv } from '../env';
import { createDatabase } from '../lib/db';
import { escapeXml } from '../lib/security';
import type { CategorySkill, PostRecord, SiteSettings } from '../types';

function formatIsoDate(value?: string | null): string {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function formatRfc2822(value?: string | null): string {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toUTCString();
  }
  return parsed.toUTCString();
}

function resolveBaseUrl(settings: SiteSettings, env: WorkerEnv): string {
  return normalizeBaseUrl(settings.base_url || env.BASE_URL);
}

export function formatPostAsMarkdownDocument(
  post: PostRecord,
  settings: SiteSettings,
  baseUrl: string,
): string {
  const canonicalUrl = `${baseUrl}/blog/${post.slug}`;
  const publishedDate = post.published_at || post.created_at;
  const frontmatterLines = [
    '---',
    `title: ${JSON.stringify(post.title)}`,
    `slug: ${JSON.stringify(post.slug)}`,
    `description: ${JSON.stringify(post.description)}`,
    `author: ${JSON.stringify(post.author || settings.default_author)}`,
    `category: ${JSON.stringify(post.category_slug)}`,
    `archetype: ${JSON.stringify(post.archetype)}`,
    `published_at: ${JSON.stringify(publishedDate)}`,
    `updated_at: ${JSON.stringify(post.updated_at)}`,
    `canonical_url: ${JSON.stringify(canonicalUrl)}`,
    `reading_time_minutes: ${post.reading_time_minutes}`,
    `word_count: ${post.word_count}`,
    `quality_score: ${post.quality_score}`,
    `tags: ${JSON.stringify(post.tags_json || [])}`,
    ...(Array.isArray(post.keywords_json) && post.keywords_json.length > 0
      ? [`keywords: ${JSON.stringify(post.keywords_json)}`]
      : []),
    `sources: ${JSON.stringify(post.sources_json || [])}`,
    '---',
  ];

  const sections: string[] = [frontmatterLines.join('\n'), '', `# ${post.title}`, ''];

  if (post.tldr_summary && post.tldr_summary.trim()) {
    sections.push(`> **TL;DR:** ${post.tldr_summary.trim()}`, '');
  }

  if (Array.isArray(post.key_facts_json) && post.key_facts_json.length > 0) {
    sections.push('## Key Facts', '');
    for (const fact of post.key_facts_json) {
      const sourceSuffix = fact.source_url ? ` ([source](${fact.source_url}))` : '';
      sections.push(`- **${fact.label}:** ${fact.value}${sourceSuffix}`);
    }
    sections.push('');
  }

  sections.push(post.body_markdown.trim(), '');

  if (Array.isArray(post.faq_json) && post.faq_json.length > 0) {
    sections.push('## Frequently Asked Questions', '');
    for (const item of post.faq_json) {
      sections.push(`### ${item.question}`, '', item.answer, '');
    }
  }

  if (Array.isArray(post.sources_json) && post.sources_json.length > 0) {
    sections.push('## Primary Sources', '');
    for (const src of post.sources_json) {
      sections.push(`- ${src}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

function wrapSvgLines(rawText: string, maxCharsPerLine: number, maxLines: number): string[] {
  const cleaned = String(rawText || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [''];
  const words = cleaned.split(' ');
  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else if (current) {
      lines.push(current);
      if (lines.length === maxLines - 1) {
        const remaining = words.slice(i).join(' ');
        lines.push(
          remaining.length > maxCharsPerLine
            ? `${remaining.slice(0, Math.max(1, maxCharsPerLine - 1)).trimEnd()}…`
            : remaining,
        );
        return lines;
      }
      current =
        word.length > maxCharsPerLine ? `${word.slice(0, maxCharsPerLine - 1)}…` : word;
    } else {
      lines.push(`${word.slice(0, Math.max(1, maxCharsPerLine - 1))}…`);
      if (lines.length >= maxLines) return lines;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

function renderFaviconSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none">',
    '  <rect x="1" y="1" width="22" height="22" rx="4" fill="#FAF9F5" stroke="#141413" stroke-width="1.5"/>',
    '  <path d="M7.5 16.5V7.5H13.25C15.1 7.5 16.25 8.55 16.25 10.2C16.25 11.85 15.1 12.9 13.25 12.9H7.5" stroke="#141413" stroke-width="1.8" stroke-linecap="square"/>',
    '  <path d="M13.5 16.5L17 13" stroke="#B4431C" stroke-width="1.9" stroke-linecap="square"/>',
    '</svg>',
  ].join('\n');
}

interface OgCardOptions {
  siteName: string;
  baseUrl: string;
  category: string;
  title: string;
  subtitle: string;
  author: string;
  readingTimeLabel: string;
  badgeText: string;
  badgeTone: 'success' | 'warning' | 'accent';
  dateLabel: string;
}

function renderOgCardSvg(opts: OgCardOptions): string {
  let hostLabel = opts.baseUrl.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  try {
    hostLabel = new URL(opts.baseUrl).host;
  } catch {
    // Keep stripped fallback
  }

  const titleLines = wrapSvgLines(opts.title, 36, 3);
  const subtitleLines = wrapSvgLines(opts.subtitle, 74, 2);

  const badgePalette =
    opts.badgeTone === 'success'
      ? { bg: '#E5F4EC', fg: '#1B6B46', border: '#B9E2CD' }
      : opts.badgeTone === 'warning'
        ? { bg: '#FBF1DF', fg: '#925309', border: '#EED4A1' }
        : { bg: '#F9EAE3', fg: '#B4431C', border: '#E8C5B6' };

  const badgeWidth = Math.max(128, opts.badgeText.length * 10 + 36);
  const badgeX = 1124 - badgeWidth;

  const titleStartY = 238;
  const titleLineHeight = 62;
  const titleTextSvg = titleLines
    .map(
      (line, idx) =>
        `  <text x="76" y="${titleStartY + idx * titleLineHeight}" font-family="Georgia, 'Times New Roman', serif" font-size="50" font-weight="700" letter-spacing="-0.8" fill="#141413">${escapeXml(line)}</text>`,
    )
    .join('\n');

  const subtitleStartY = titleStartY + (titleLines.length - 1) * titleLineHeight + 52;
  const subtitleTextSvg = subtitleLines
    .filter(Boolean)
    .map(
      (line, idx) =>
        `  <text x="76" y="${subtitleStartY + idx * 30}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="21" font-weight="400" fill="#57534E">${escapeXml(line)}</text>`,
    )
    .join('\n');

  const metaLeft = [opts.author ? `By ${opts.author}` : '', opts.readingTimeLabel, opts.dateLabel]
    .filter(Boolean)
    .join('  ·  ');

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="' +
      escapeXml(`${opts.title} — ${opts.siteName}`) +
      '">',
    '  <rect width="1200" height="630" fill="#FAF9F5"/>',
    '  <rect x="0" y="0" width="1200" height="6" fill="#B4431C"/>',
    '  <rect x="36" y="36" width="1128" height="558" rx="6" fill="none" stroke="#E6E2D8" stroke-width="1.5"/>',
    '  <g transform="translate(76, 66)">',
    '    <rect x="0" y="0" width="36" height="36" rx="5" fill="#FAF9F5" stroke="#141413" stroke-width="2"/>',
    '    <path d="M11 25V11H20C22.8 11 24.5 12.6 24.5 15.1C24.5 17.6 22.8 19.2 20 19.2H11" stroke="#141413" stroke-width="2.4" stroke-linecap="square" fill="none"/>',
    '    <path d="M20.2 25L25.5 19.7" stroke="#B4431C" stroke-width="2.6" stroke-linecap="square" fill="none"/>',
    '  </g>',
    `  <text x="126" y="92" font-family="Georgia, 'Times New Roman', serif" font-size="25" font-weight="700" fill="#141413">${escapeXml(opts.siteName)}</text>`,
    `  <rect x="${badgeX}" y="68" width="${badgeWidth}" height="34" rx="4" fill="${badgePalette.bg}" stroke="${badgePalette.border}" stroke-width="1"/>`,
    `  <text x="${badgeX + Math.round(badgeWidth / 2)}" y="90" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="14" font-weight="600" letter-spacing="0.8" fill="${badgePalette.fg}">${escapeXml(opts.badgeText)}</text>`,
    '  <line x1="76" y1="126" x2="1124" y2="126" stroke="#E6E2D8" stroke-width="1"/>',
    '  <rect x="76" y="162" width="32" height="3" fill="#B4431C"/>',
    `  <text x="120" y="168" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="14" font-weight="600" letter-spacing="1.8" fill="#B4431C">${escapeXml(opts.category.toUpperCase())}</text>`,
    titleTextSvg,
    subtitleTextSvg,
    '  <line x1="76" y1="514" x2="1124" y2="514" stroke="#E6E2D8" stroke-width="1"/>',
    `  <text x="76" y="554" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="16" font-weight="500" fill="#57534E">${escapeXml(metaLeft)}</text>`,
    `  <text x="1124" y="554" text-anchor="end" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="16" font-weight="600" fill="#141413">${escapeXml(hostLabel)}</text>`,
    '</svg>',
  ].join('\n');
}

function buildLlmsTxt(settings: SiteSettings, skills: CategorySkill[], posts: PostRecord[], baseUrl: string): string {
  const lines: string[] = [
    `# ${settings.site_name}`,
    '',
    `> ${settings.site_tagline}`,
    '',
    '## Publication & Editorial Standards',
    '',
    `- [About ${settings.site_name}](${baseUrl}/about): Publication mission, author credentials, and technical focus.`,
    `- [Editorial Policy](${baseUrl}/editorial-policy): Primary-source verification, anti-slop standards, and review workflow.`,
    `- [Contact](${baseUrl}/contact): Corrections, disclosures, and editorial inquiries (${settings.contact_email}).`,
    `- [Full Machine-Readable Corpus](${baseUrl}/llms-full.txt): Complete Markdown briefings with key facts, FAQs, and citations.`,
    `- [RSS 2.0 Feed](${baseUrl}/rss.xml): Latest published briefings in XML.`,
    `- [JSON Feed 1.1](${baseUrl}/feed.json): Latest published briefings in JSON Feed format.`,
    `- [XML Sitemap](${baseUrl}/sitemap.xml): Canonical URL index.`,
    `- [Google News Sitemap](${baseUrl}/news-sitemap.xml): Breaking briefings from the past 48 hours.`,
    '',
    '## Research Tracks',
    '',
  ];

  for (const skill of skills) {
    lines.push(`- [${skill.name}](${baseUrl}/category/${skill.slug}): ${skill.description}`);
  }

  lines.push('', '## Published Briefings', '');

  if (posts.length === 0) {
    lines.push('- No published briefings yet.');
  } else {
    for (const post of posts) {
      const summary = (post.tldr_summary || post.description || '').replace(/\s+/g, ' ').trim();
      const dateStr = formatIsoDate(post.published_at || post.updated_at);
      lines.push(
        `- [${post.title}](${baseUrl}/blog/${post.slug}) ([Markdown](${baseUrl}/blog/${post.slug}.md)) — ${dateStr}: ${summary}`,
      );
    }
  }

  lines.push('');
  return lines.join('\n');
}

function buildLlmsFullTxt(settings: SiteSettings, posts: PostRecord[], baseUrl: string): string {
  const header: string[] = [
    `# ${settings.site_name} — Full Published Corpus`,
    '',
    `> ${settings.site_tagline}`,
    '',
    `Source Index: ${baseUrl}/llms.txt`,
    `Canonical Site: ${baseUrl}`,
    `Generated At: ${new Date().toISOString()}`,
    `Included Articles: ${posts.length}`,
    '',
    '---',
    '',
  ];

  const blocks: string[] = [header.join('\n')];

  for (const post of posts) {
    const canonicalUrl = `${baseUrl}/blog/${post.slug}`;
    const markdownUrl = `${baseUrl}/blog/${post.slug}.md`;
    const dateStr = formatIsoDate(post.published_at || post.updated_at);
    const lines: string[] = [
      `## ${post.title}`,
      '',
      `- **URL:** ${canonicalUrl}`,
      `- **Markdown:** ${markdownUrl}`,
      `- **Author:** ${post.author || settings.default_author}`,
      `- **Published:** ${dateStr}`,
      `- **Category:** ${post.category_slug}`,
      `- **Archetype:** ${post.archetype}`,
    ];

    if (post.tags_json && post.tags_json.length > 0) {
      lines.push(`- **Tags:** ${post.tags_json.join(', ')}`);
    }
    if (Array.isArray(post.keywords_json) && post.keywords_json.length > 0) {
      lines.push(`- **Keywords:** ${post.keywords_json.join(', ')}`);
    }

    lines.push('');

    if (post.tldr_summary && post.tldr_summary.trim()) {
      lines.push(`### TL;DR`, '', post.tldr_summary.trim(), '');
    } else if (post.description) {
      lines.push(`### Summary`, '', post.description.trim(), '');
    }

    if (Array.isArray(post.key_facts_json) && post.key_facts_json.length > 0) {
      lines.push('### Key Facts', '');
      for (const fact of post.key_facts_json) {
        const src = fact.source_url ? ` (${fact.source_url})` : '';
        lines.push(`- **${fact.label}:** ${fact.value}${src}`);
      }
      lines.push('');
    }

    lines.push('### Full Article', '', post.body_markdown.trim(), '');

    if (Array.isArray(post.faq_json) && post.faq_json.length > 0) {
      lines.push('### FAQ', '');
      for (const item of post.faq_json) {
        lines.push(`**Q: ${item.question}**`, '', `A: ${item.answer}`, '');
      }
    }

    if (Array.isArray(post.sources_json) && post.sources_json.length > 0) {
      lines.push('### Primary Sources', '');
      for (const src of post.sources_json) {
        lines.push(`- ${src}`);
      }
      lines.push('');
    }

    lines.push('---', '');
    blocks.push(lines.join('\n'));
  }

  return blocks.join('\n');
}

export function createSeoRoutes(): Hono<{ Bindings: WorkerEnv }> {
  const app = new Hono<{ Bindings: WorkerEnv }>();

  app.get('/favicon.svg', () => {
    return new Response(renderFaviconSvg(), {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    });
  });

  app.get('/og/default.svg', async (c) => {
    const db = createDatabase(c.env);
    const settings = await db.getSettings();
    const baseUrl = resolveBaseUrl(settings, c.env);
    const siteName = settings.site_name || 'Pyvren Research';

    const svg = renderOgCardSvg({
      siteName,
      baseUrl,
      category: 'Primary-Source Technical Briefings',
      title: `${siteName} — Verified Engineering & Security Intelligence`,
      subtitle:
        settings.site_tagline ||
        'Primary-source technical research, security teardowns, and reproducible engineering benchmarks.',
      author: settings.default_author || 'Editorial Desk',
      readingTimeLabel: 'SSR · Markdown · JSON · RSS',
      badgeText: 'PRIMARY SOURCES',
      badgeTone: 'accent',
      dateLabel: 'Human-Edited',
    });

    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  });

  app.get('/og/:slug{.+\\.svg}', async (c) => {
    const rawParam = c.req.param('slug') || '';
    const slug = rawParam.replace(/\.svg$/i, '').trim();
    if (!slug) {
      return new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    const db = createDatabase(c.env);
    const [settings, post] = await Promise.all([db.getSettings(), db.getPostBySlug(slug, true)]);

    if (!post || post.status !== 'published') {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    const skill = await db.getSkillBySlug(post.category_slug);
    const baseUrl = resolveBaseUrl(settings, c.env);
    const siteName = settings.site_name || 'Pyvren Research';
    const score = Math.max(0, Math.min(100, Math.round(post.quality_score || 0)));

    const svg = renderOgCardSvg({
      siteName,
      baseUrl,
      category: skill?.name || post.category_slug.replace(/-/g, ' '),
      title: post.title,
      subtitle: post.tldr_summary || post.description,
      author: post.author || settings.default_author || 'Editorial Desk',
      readingTimeLabel: `${post.reading_time_minutes || 1} min read`,
      badgeText: `QS ${score}/100`,
      badgeTone: score >= 85 ? 'success' : score >= 70 ? 'warning' : 'accent',
      dateLabel: formatIsoDate(post.published_at || post.created_at),
    });

    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  });

  app.get('/sitemap.xml', async (c) => {
    const db = createDatabase(c.env);
    const [settings, skills, rawPosts] = await Promise.all([
      db.getSettings(),
      db.listSkills(true),
      db.listPosts({ status: 'published', limit: 1000, excludeHeavyHtml: true }),
    ]);

    const baseUrl = resolveBaseUrl(settings, c.env);
    const publishedPosts = rawPosts.filter((p) => p.status === 'published');
    const siteLastMod = formatIsoDate(settings.updated_at);

    const staticPages: Array<{ path: string; changefreq: string; priority: string }> = [
      { path: '/', changefreq: 'daily', priority: '1.0' },
      { path: '/blog', changefreq: 'daily', priority: '0.9' },
      { path: '/about', changefreq: 'monthly', priority: '0.5' },
      { path: '/editorial-policy', changefreq: 'monthly', priority: '0.6' },
      { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
      { path: '/contact', changefreq: 'monthly', priority: '0.4' },
    ];

    const urlEntries: string[] = [];

    for (const page of staticPages) {
      urlEntries.push(
        [
          '  <url>',
          `    <loc>${escapeXml(`${baseUrl}${page.path}`)}</loc>`,
          `    <lastmod>${escapeXml(siteLastMod)}</lastmod>`,
          `    <changefreq>${page.changefreq}</changefreq>`,
          `    <priority>${page.priority}</priority>`,
          '  </url>',
        ].join('\n'),
      );
    }

    for (const skill of skills) {
      if (!skill.enabled) continue;
      urlEntries.push(
        [
          '  <url>',
          `    <loc>${escapeXml(`${baseUrl}/category/${skill.slug}`)}</loc>`,
          `    <lastmod>${escapeXml(formatIsoDate(skill.updated_at))}</lastmod>`,
          '    <changefreq>daily</changefreq>',
          '    <priority>0.8</priority>',
          '  </url>',
        ].join('\n'),
      );
    }

    for (const post of publishedPosts) {
      urlEntries.push(
        [
          '  <url>',
          `    <loc>${escapeXml(`${baseUrl}/blog/${post.slug}`)}</loc>`,
          `    <lastmod>${escapeXml(formatIsoDate(post.updated_at || post.published_at))}</lastmod>`,
          '    <changefreq>weekly</changefreq>',
          '    <priority>0.8</priority>',
          '  </url>',
        ].join('\n'),
      );
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urlEntries,
      '</urlset>',
    ].join('\n');

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
      },
    });
  });

  app.get('/news-sitemap.xml', async (c) => {
    const db = createDatabase(c.env);
    const [settings, rawPosts] = await Promise.all([
      db.getSettings(),
      db.listPosts({ status: 'published', limit: 100, excludeHeavyHtml: true }),
    ]);

    const baseUrl = resolveBaseUrl(settings, c.env);
    const siteName = settings.site_name || 'Pyvren Research';
    const cutoffMs = Date.now() - 48 * 60 * 60 * 1000;

    const recentPosts = rawPosts.filter((post) => {
      if (post.status !== 'published') return false;
      const rawDate = post.published_at || post.created_at;
      const ts = new Date(rawDate).getTime();
      return Number.isFinite(ts) && ts >= cutoffMs;
    });

    const urlEntries = recentPosts.map((post) => {
      const parsedDate = new Date(post.published_at || post.created_at);
      const pubIso = Number.isNaN(parsedDate.getTime())
        ? new Date().toISOString()
        : parsedDate.toISOString();
      return [
        '  <url>',
        `    <loc>${escapeXml(`${baseUrl}/blog/${post.slug}`)}</loc>`,
        '    <news:news>',
        '      <news:publication>',
        `        <news:name>${escapeXml(siteName)}</news:name>`,
        '        <news:language>en</news:language>',
        '      </news:publication>',
        `      <news:publication_date>${escapeXml(pubIso)}</news:publication_date>`,
        `      <news:title>${escapeXml(post.title)}</news:title>`,
        '    </news:news>',
        '  </url>',
      ].join('\n');
    });

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
      ...urlEntries,
      '</urlset>',
    ].join('\n');

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=180, s-maxage=600, stale-while-revalidate=1800',
      },
    });
  });

  app.get('/rss.xml', async (c) => {
    const db = createDatabase(c.env);
    const [settings, rawPosts] = await Promise.all([
      db.getSettings(),
      db.listPosts({ status: 'published', limit: 25, excludeHeavyHtml: true }),
    ]);

    const baseUrl = resolveBaseUrl(settings, c.env);
    const publishedPosts = rawPosts.filter((p) => p.status === 'published').slice(0, 25);
    const lastBuildDate = publishedPosts[0]
      ? formatRfc2822(publishedPosts[0].published_at || publishedPosts[0].updated_at)
      : formatRfc2822(settings.updated_at);

    const itemsXml = publishedPosts
      .map((post) => {
        const link = `${baseUrl}/blog/${post.slug}`;
        const pubDate = formatRfc2822(post.published_at || post.created_at);
        const description = post.tldr_summary || post.description;
        return [
          '    <item>',
          `      <title>${escapeXml(post.title)}</title>`,
          `      <link>${escapeXml(link)}</link>`,
          `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
          `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
          `      <description>${escapeXml(description)}</description>`,
          `      <category>${escapeXml(post.category_slug)}</category>`,
          '    </item>',
        ].join('\n');
      })
      .join('\n');

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      '  <channel>',
      `    <title>${escapeXml(settings.site_name)}</title>`,
      `    <link>${escapeXml(baseUrl)}</link>`,
      `    <description>${escapeXml(settings.site_tagline)}</description>`,
      '    <language>en-us</language>',
      `    <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>`,
      `    <atom:link href="${escapeXml(`${baseUrl}/rss.xml`)}" rel="self" type="application/rss+xml" />`,
      itemsXml,
      '  </channel>',
      '</rss>',
    ]
      .filter((line) => line !== '')
      .join('\n');

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
      },
    });
  });

  app.get('/feed.json', async (c) => {
    const db = createDatabase(c.env);
    const [settings, rawPosts] = await Promise.all([
      db.getSettings(),
      db.listPosts({ status: 'published', limit: 25, excludeHeavyHtml: true }),
    ]);

    const baseUrl = resolveBaseUrl(settings, c.env);
    const publishedPosts = rawPosts.filter((p) => p.status === 'published').slice(0, 25);

    const feed = {
      version: 'https://jsonfeed.org/version/1.1',
      title: settings.site_name,
      home_page_url: `${baseUrl}/`,
      feed_url: `${baseUrl}/feed.json`,
      description: settings.site_tagline,
      icon: `${baseUrl}/favicon.svg`,
      favicon: `${baseUrl}/favicon.svg`,
      language: 'en-US',
      authors: [
        {
          name: settings.default_author || 'Editorial Desk',
          url: `${baseUrl}/about`,
        },
      ],
      items: publishedPosts.map((post) => {
        const postUrl = `${baseUrl}/blog/${encodeURIComponent(post.slug)}`;
        const pubDate = new Date(post.published_at || post.created_at);
        const modDate = new Date(post.updated_at || post.published_at || post.created_at);
        return {
          id: postUrl,
          url: postUrl,
          title: post.title,
          summary: post.tldr_summary || post.description,
          content_text: post.body_markdown || post.tldr_summary || post.description,
          ...(post.body_html ? { content_html: post.body_html } : {}),
          image: `${baseUrl}/og/${encodeURIComponent(post.slug)}.svg`,
          date_published: Number.isNaN(pubDate.getTime())
            ? new Date().toISOString()
            : pubDate.toISOString(),
          date_modified: Number.isNaN(modDate.getTime())
            ? new Date().toISOString()
            : modDate.toISOString(),
          authors: [
            {
              name: post.author || settings.default_author || 'Editorial Desk',
              url: `${baseUrl}/about`,
            },
          ],
          tags: Array.isArray(post.tags_json) ? post.tags_json : [],
        };
      }),
    };

    return new Response(JSON.stringify(feed, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/feed+json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
      },
    });
  });

  app.get('/robots.txt', async (c) => {
    const db = createDatabase(c.env);
    const settings = await db.getSettings();
    const baseUrl = resolveBaseUrl(settings, c.env);

    const welcomedCrawlers = [
      'Googlebot',
      'Googlebot-News',
      'Mediapartners-Google',
      'AdsBot-Google',
      'Bingbot',
      'Applebot',
      'DuckDuckBot',
      'OAI-SearchBot',
      'ChatGPT-User',
      'GPTBot',
      'PerplexityBot',
      'Google-Extended',
      'ClaudeBot',
      'Claude-SearchBot',
    ];

    const blocks: string[] = [
      `# ${settings.site_name} Robots Policy`,
      `# LLM Index: ${baseUrl}/llms.txt`,
      `# Full LLM Corpus: ${baseUrl}/llms-full.txt`,
      '',
    ];

    for (const bot of welcomedCrawlers) {
      blocks.push(`User-agent: ${bot}`, 'Allow: /', 'Disallow: /admin', 'Disallow: /api/admin', '');
    }

    blocks.push(
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /admin/',
      'Disallow: /api/admin',
      'Disallow: /api/admin/',
      '',
      `Sitemap: ${baseUrl}/sitemap.xml`,
      `Sitemap: ${baseUrl}/news-sitemap.xml`,
      `# LLM Index: ${baseUrl}/llms.txt`,
      '',
    );

    return new Response(blocks.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  });

  app.get('/ads.txt', async (c) => {
    const db = createDatabase(c.env);
    const settings = await db.getSettings();
    const rawId = (settings.adsense_client_id || '').trim();

    if (!rawId) {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=60',
        },
      });
    }

    const normalizedPubId = rawId.replace(/^ca-/i, '');
    const body = `google.com, ${normalizedPubId}, DIRECT, f08c47fec0942fa0\n`;

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    });
  });

  const serveLlmsTxt = async (c: { env: WorkerEnv }) => {
    const db = createDatabase(c.env);
    const [settings, skills, rawPosts] = await Promise.all([
      db.getSettings(),
      db.listSkills(true),
      db.listPosts({ status: 'published', limit: 500, excludeHeavyHtml: true }),
    ]);

    const baseUrl = resolveBaseUrl(settings, c.env);
    const publishedPosts = rawPosts.filter((p) => p.status === 'published');
    const content = buildLlmsTxt(settings, skills, publishedPosts, baseUrl);

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
      },
    });
  };

  app.get('/llms.txt', serveLlmsTxt);
  app.get('/.well-known/llms.txt', serveLlmsTxt);

  app.get('/llms-full.txt', async (c) => {
    const db = createDatabase(c.env);
    const [settings, rawPosts] = await Promise.all([
      db.getSettings(),
      db.listPosts({ status: 'published', limit: 25 }),
    ]);

    const baseUrl = resolveBaseUrl(settings, c.env);
    const publishedPosts = rawPosts.filter((p) => p.status === 'published').slice(0, 25);
    const content = buildLlmsFullTxt(settings, publishedPosts, baseUrl);

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600',
      },
    });
  });

  app.get('/blog/:slug{.+\\.md}', async (c) => {
    const rawParam = c.req.param('slug') || '';
    const slug = rawParam.replace(/\.md$/, '').trim();
    if (!slug) {
      return new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const db = createDatabase(c.env);
    const [settings, post] = await Promise.all([db.getSettings(), db.getPostBySlug(slug, true)]);

    if (!post || post.status !== 'published') {
      return new Response('Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    const baseUrl = resolveBaseUrl(settings, c.env);
    const markdown = formatPostAsMarkdownDocument(post, settings, baseUrl);

    return new Response(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  });

  return app;
}
