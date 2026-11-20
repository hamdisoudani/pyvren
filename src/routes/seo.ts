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

function formatPostAsMarkdownDocument(post: PostRecord, settings: SiteSettings, baseUrl: string): string {
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
    `- [XML Sitemap](${baseUrl}/sitemap.xml): Canonical URL index.`,
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

  app.get('/sitemap.xml', async (c) => {
    const db = createDatabase(c.env);
    const [settings, skills, rawPosts] = await Promise.all([
      db.getSettings(),
      db.listSkills(true),
      db.listPosts({ status: 'published', limit: 1000 }),
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

  app.get('/rss.xml', async (c) => {
    const db = createDatabase(c.env);
    const [settings, rawPosts] = await Promise.all([
      db.getSettings(),
      db.listPosts({ status: 'published', limit: 25 }),
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

  app.get('/robots.txt', async (c) => {
    const db = createDatabase(c.env);
    const settings = await db.getSettings();
    const baseUrl = resolveBaseUrl(settings, c.env);

    const welcomedCrawlers = [
      'Googlebot',
      'Bingbot',
      'OAI-SearchBot',
      'ChatGPT-User',
      'PerplexityBot',
      'Google-Extended',
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

  app.get('/llms.txt', async (c) => {
    const db = createDatabase(c.env);
    const [settings, skills, rawPosts] = await Promise.all([
      db.getSettings(),
      db.listSkills(true),
      db.listPosts({ status: 'published', limit: 500 }),
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
  });

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
