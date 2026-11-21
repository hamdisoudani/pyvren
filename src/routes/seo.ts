import { Hono } from 'hono';
import { normalizeBaseUrl, type WorkerEnv } from '../env';
import { createDatabase } from '../lib/db';
import { getCategoryMeta } from '../lib/relations';
import { escapeXml } from '../lib/security';
import type { CategorySkill, PostRecord, SiteSettings } from '../types';
import { renderStandalonePyvrenFallbackSvg } from '../ui/crew-art';

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
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32" fill="none">',
    '  <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="#FAF5EA" stroke="#171512" stroke-width="2"/>',
    '  <path d="M7.5 24.5C7.5 20.5 12 19.8 17.5 20.5C22.5 21.2 25 19.2 25 16C25 12.2 20.5 10 15.2 10C10 10 7.2 12.8 7.8 16.2C8.2 19 11.8 19.8 16.5 19.2" fill="#FFFDF8" stroke="#171512" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
    '  <circle cx="12.5" cy="14.2" r="2.2" fill="#FAF5EA" stroke="#171512" stroke-width="1.5"/>',
    '  <circle cx="18.2" cy="14.2" r="2.2" fill="#FAF5EA" stroke="#171512" stroke-width="1.5"/>',
    '  <circle cx="13" cy="14.2" r="1" fill="#171512"/>',
    '  <circle cx="18.7" cy="14.2" r="1" fill="#171512"/>',
    '  <path d="M21.5 17.2L25.5 17.6M25.5 17.6L27.5 16.2M25.5 17.6L27.4 19" stroke="#D63333" stroke-width="1.8" stroke-linecap="round"/>',
    '</svg>',
  ].join('\n');
}

interface OgCardOptions {
  siteName: string;
  baseUrl: string;
  category: string;
  categorySlug?: string;
  title: string;
  subtitle: string;
  author: string;
  readingTimeLabel: string;
  badgeText: string;
  badgeTone: 'success' | 'warning' | 'accent';
  dateLabel: string;
}

function renderCategoryMotifSvg(motif: string, color: string, bgTint: string): string {
  // Drawn inside a 324x380 technical plate at translate(814, 122)
  switch (motif) {
    case 'shield':
      // Layered defensive shield & telemetry rings (AI Security)
      return [
        `    <circle cx="162" cy="176" r="126" fill="none" stroke="${color}" stroke-opacity="0.16" stroke-width="1.5" stroke-dasharray="5 5"/>`,
        `    <circle cx="162" cy="176" r="96" fill="none" stroke="${color}" stroke-opacity="0.28" stroke-width="1.5"/>`,
        `    <path d="M162 66 L246 100 V174 C246 232 210 274 162 296 C114 274 78 232 78 174 V100 Z" fill="${bgTint}" stroke="#171512" stroke-width="2.5"/>`,
        `    <path d="M162 88 L226 114 V172 C226 218 198 252 162 271 C126 252 98 218 98 172 V114 Z" fill="${color}" fill-opacity="0.14" stroke="${color}" stroke-width="2"/>`,
        `    <rect x="139" y="166" width="46" height="38" rx="4" fill="#171512"/>`,
        `    <path d="M148 166 V152 C148 143 154 137 162 137 C170 137 176 143 176 152 V166" fill="none" stroke="#171512" stroke-width="4" stroke-linecap="round"/>`,
        `    <circle cx="162" cy="184" r="5" fill="#FAF5EA"/>`,
        `    <circle cx="78" cy="100" r="4.5" fill="${color}"/>`,
        `    <circle cx="246" cy="100" r="4.5" fill="${color}"/>`,
        `    <circle cx="162" cy="296" r="4.5" fill="#171512"/>`,
        `    <line x1="36" y1="176" x2="66" y2="176" stroke="${color}" stroke-width="2"/>`,
        `    <line x1="258" y1="176" x2="288" y2="176" stroke="${color}" stroke-width="2"/>`,
      ].join('\n');

    case 'bars':
      // Precision benchmark bar plot & matrix grid (Frontier LLMs)
      return [
        `    <g stroke="#171512" stroke-opacity="0.12" stroke-width="1">`,
        `      <line x1="42" y1="90" x2="286" y2="90"/><line x1="42" y1="142" x2="286" y2="142"/>`,
        `      <line x1="42" y1="194" x2="286" y2="194"/><line x1="42" y1="246" x2="286" y2="246"/>`,
        `    </g>`,
        `    <line x1="42" y1="296" x2="288" y2="296" stroke="#171512" stroke-width="2.2"/>`,
        `    <line x1="42" y1="74" x2="42" y2="296" stroke="#171512" stroke-width="2.2"/>`,
        `    <rect x="64" y="210" width="32" height="86" rx="2" fill="#171512" fill-opacity="0.18" stroke="#171512" stroke-width="1.5"/>`,
        `    <rect x="112" y="166" width="32" height="130" rx="2" fill="${color}" fill-opacity="0.35" stroke="#171512" stroke-width="1.5"/>`,
        `    <rect x="160" y="128" width="32" height="168" rx="2" fill="${color}" fill-opacity="0.68" stroke="#171512" stroke-width="1.5"/>`,
        `    <rect x="208" y="88" width="32" height="208" rx="2" fill="${color}" stroke="#171512" stroke-width="2"/>`,
        `    <rect x="256" y="148" width="20" height="148" rx="2" fill="#171512" fill-opacity="0.85"/>`,
        `    <polyline points="80,196 128,152 176,114 224,74 266,134" fill="none" stroke="#171512" stroke-width="2.5" stroke-dasharray="4 3"/>`,
        `    <circle cx="80" cy="196" r="5" fill="#FAF5EA" stroke="#171512" stroke-width="2"/>`,
        `    <circle cx="128" cy="152" r="5" fill="#FAF5EA" stroke="#171512" stroke-width="2"/>`,
        `    <circle cx="176" cy="114" r="5" fill="#FAF5EA" stroke="#171512" stroke-width="2"/>`,
        `    <circle cx="224" cy="74" r="6" fill="${color}" stroke="#171512" stroke-width="2"/>`,
      ].join('\n');

    case 'arcs':
      // Global edge arcs & GPU cluster strata (Cloud & GPU Infra)
      return [
        `    <circle cx="162" cy="182" r="106" fill="${bgTint}" stroke="#171512" stroke-width="2"/>`,
        `    <ellipse cx="162" cy="182" rx="106" ry="42" fill="none" stroke="${color}" stroke-width="1.8" stroke-opacity="0.65"/>`,
        `    <ellipse cx="162" cy="182" rx="52" ry="106" fill="none" stroke="${color}" stroke-width="1.8" stroke-opacity="0.55"/>`,
        `    <path d="M74 128 Q162 46 250 128" fill="none" stroke="#171512" stroke-width="2.2" stroke-dasharray="5 4"/>`,
        `    <path d="M62 214 Q162 126 262 214" fill="none" stroke="${color}" stroke-width="2.6"/>`,
        `    <circle cx="74" cy="128" r="7" fill="${color}" stroke="#171512" stroke-width="2"/>`,
        `    <circle cx="250" cy="128" r="7" fill="${color}" stroke="#171512" stroke-width="2"/>`,
        `    <circle cx="162" cy="182" r="11" fill="#171512"/>`,
        `    <circle cx="162" cy="182" r="4.5" fill="#FAF5EA"/>`,
        `    <rect x="78" y="294" width="48" height="14" rx="2" fill="#171512"/>`,
        `    <rect x="138" y="294" width="48" height="14" rx="2" fill="${color}"/>`,
        `    <rect x="198" y="294" width="48" height="14" rx="2" fill="#171512" fill-opacity="0.35"/>`,
      ].join('\n');

    case 'web':
      // Spider/index graph & extraction lattice (Web Data & GEO)
      return [
        `    <polygon points="162,70 258,125 258,235 162,290 66,235 66,125" fill="${bgTint}" stroke="#171512" stroke-width="2"/>`,
        `    <polygon points="162,112 222,146 222,214 162,248 102,214 102,146" fill="none" stroke="${color}" stroke-width="1.8" stroke-dasharray="4 3"/>`,
        `    <line x1="162" y1="70" x2="162" y2="290" stroke="#171512" stroke-opacity="0.28" stroke-width="1.5"/>`,
        `    <line x1="66" y1="125" x2="258" y2="235" stroke="#171512" stroke-opacity="0.28" stroke-width="1.5"/>`,
        `    <line x1="258" y1="125" x2="66" y2="235" stroke="#171512" stroke-opacity="0.28" stroke-width="1.5"/>`,
        `    <circle cx="162" cy="180" r="22" fill="${color}" stroke="#171512" stroke-width="2.2"/>`,
        `    <circle cx="162" cy="180" r="8" fill="#FAF5EA"/>`,
        `    <circle cx="162" cy="70" r="8" fill="#171512"/>`,
        `    <circle cx="258" cy="125" r="8" fill="${color}" stroke="#171512" stroke-width="1.8"/>`,
        `    <circle cx="258" cy="235" r="8" fill="#FAF5EA" stroke="#171512" stroke-width="2"/>`,
        `    <circle cx="162" cy="290" r="8" fill="${color}" stroke="#171512" stroke-width="1.8"/>`,
        `    <circle cx="66" cy="235" r="8" fill="#171512"/>`,
        `    <circle cx="66" cy="125" r="8" fill="#FAF5EA" stroke="#171512" stroke-width="2"/>`,
      ].join('\n');

    case 'radar':
      // CVE radar sweep rings & patch diff bars (CVEs & Patches)
      return [
        `    <circle cx="162" cy="166" r="102" fill="${bgTint}" stroke="#171512" stroke-width="2"/>`,
        `    <circle cx="162" cy="166" r="68" fill="none" stroke="${color}" stroke-opacity="0.45" stroke-width="1.5"/>`,
        `    <circle cx="162" cy="166" r="34" fill="none" stroke="${color}" stroke-opacity="0.7" stroke-width="1.5"/>`,
        `    <line x1="60" y1="166" x2="264" y2="166" stroke="#171512" stroke-opacity="0.25" stroke-width="1.2"/>`,
        `    <line x1="162" y1="64" x2="162" y2="268" stroke="#171512" stroke-opacity="0.25" stroke-width="1.2"/>`,
        `    <path d="M162 166 L236 96 A102 102 0 0 1 264 166 Z" fill="${color}" fill-opacity="0.24"/>`,
        `    <line x1="162" y1="166" x2="236" y2="96" stroke="${color}" stroke-width="3"/>`,
        `    <circle cx="212" cy="134" r="7" fill="${color}" stroke="#171512" stroke-width="2"/>`,
        `    <circle cx="118" cy="198" r="5" fill="#171512"/>`,
        `    <rect x="52" y="286" width="96" height="10" rx="2" fill="${color}"/>`,
        `    <rect x="158" y="286" width="114" height="10" rx="2" fill="#171512" fill-opacity="0.22"/>`,
        `    <rect x="52" y="304" width="168" height="10" rx="2" fill="#171512"/>`,
      ].join('\n');

    case 'nodes':
    default:
      // Multi-node agent topology graph (Coding Agents & MCP)
      return [
        `    <g stroke="#171512" stroke-width="2">`,
        `      <line x1="162" y1="176" x2="78" y2="104"/>`,
        `      <line x1="162" y1="176" x2="250" y2="108"/>`,
        `      <line x1="162" y1="176" x2="256" y2="246"/>`,
        `      <line x1="162" y1="176" x2="74" y2="252"/>`,
        `      <line x1="78" y1="104" x2="250" y2="108" stroke-dasharray="4 4" stroke-opacity="0.5"/>`,
        `      <line x1="74" y1="252" x2="256" y2="246" stroke-dasharray="4 4" stroke-opacity="0.5"/>`,
        `    </g>`,
        `    <circle cx="162" cy="176" r="58" fill="none" stroke="${color}" stroke-opacity="0.24" stroke-width="1.5" stroke-dasharray="5 4"/>`,
        `    <rect x="128" y="142" width="68" height="68" rx="10" fill="${color}" stroke="#171512" stroke-width="2.5"/>`,
        `    <rect x="144" y="158" width="36" height="36" rx="4" fill="#FAF5EA"/>`,
        `    <rect x="155" y="169" width="14" height="14" rx="2" fill="#171512"/>`,
        `    <circle cx="78" cy="104" r="18" fill="${bgTint}" stroke="#171512" stroke-width="2.2"/>`,
        `    <circle cx="78" cy="104" r="6" fill="${color}"/>`,
        `    <circle cx="250" cy="108" r="18" fill="#171512"/>`,
        `    <circle cx="250" cy="108" r="6" fill="#FAF5EA"/>`,
        `    <circle cx="256" cy="246" r="18" fill="${bgTint}" stroke="#171512" stroke-width="2.2"/>`,
        `    <circle cx="256" cy="246" r="6" fill="${color}"/>`,
        `    <circle cx="74" cy="252" r="18" fill="${bgTint}" stroke="#171512" stroke-width="2.2"/>`,
        `    <circle cx="74" cy="252" r="6" fill="#171512"/>`,
      ].join('\n');
  }
}

function renderOgCardSvg(opts: OgCardOptions): string {
  let hostLabel = opts.baseUrl.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  try {
    hostLabel = new URL(opts.baseUrl).host;
  } catch {
    // Keep stripped fallback
  }

  const catMeta = getCategoryMeta(opts.categorySlug || '');
  const titleLines = wrapSvgLines(opts.title, 28, 3);
  const subtitleLines = wrapSvgLines(opts.subtitle, 54, 2);

  const badgePalette =
    opts.badgeTone === 'success'
      ? { bg: '#171512', fg: '#FAF5EA', dot: '#22C55E' }
      : opts.badgeTone === 'warning'
        ? { bg: '#171512', fg: '#FAF5EA', dot: '#F59E0B' }
        : { bg: '#D63333', fg: '#FAF5EA', dot: '#FAF5EA' };

  const badgeWidth = Math.max(132, opts.badgeText.length * 9.5 + 42);
  const catLabel = (opts.category || catMeta.shortLabel).toUpperCase().slice(0, 32);
  const catPillWidth = Math.min(440, Math.max(150, catLabel.length * 9.2 + 44));

  const titleStartY = 232;
  const titleLineHeight = 54;
  const titleTextSvg = titleLines
    .map(
      (line, idx) =>
        `  <text x="68" y="${titleStartY + idx * titleLineHeight}" font-family="Georgia, 'Times New Roman', serif" font-size="44" font-weight="700" letter-spacing="-0.8" fill="#171512">${escapeXml(line)}</text>`,
    )
    .join('\n');

  const subtitleStartY = titleStartY + (titleLines.length - 1) * titleLineHeight + 46;
  const subtitleTextSvg = subtitleLines
    .filter(Boolean)
    .map(
      (line, idx) =>
        `  <text x="68" y="${subtitleStartY + idx * 28}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="19" font-weight="400" fill="#47423B">${escapeXml(line)}</text>`,
    )
    .join('\n');

  const metaItems = [opts.author ? `By ${opts.author}` : '', opts.readingTimeLabel, opts.dateLabel]
    .filter(Boolean)
    .join('  ·  ');

  const motifSvg = renderCategoryMotifSvg(catMeta.motif, catMeta.color, catMeta.bgTint);
  const plateCaption = `FIG. 01 // ${catMeta.shortLabel}`;

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="' +
      escapeXml(`${opts.title} — ${opts.siteName}`) +
      '">',
    '  <defs>',
    '    <linearGradient id="paperGrad" x1="0" y1="0" x2="1" y2="1">',
    '      <stop offset="0%" stop-color="#FAF5EA"/>',
    '      <stop offset="100%" stop-color="#F2EAD8"/>',
    '    </linearGradient>',
    '  </defs>',
    '  <rect width="1200" height="630" fill="url(#paperGrad)"/>',
    '  <rect x="0" y="0" width="1200" height="8" fill="#D63333"/>',
    '  <rect x="28" y="28" width="1144" height="574" rx="4" fill="none" stroke="#171512" stroke-width="2"/>',
    '  <rect x="35" y="35" width="1130" height="560" rx="2" fill="none" stroke="#171512" stroke-opacity="0.18" stroke-width="1"/>',
    '  <g transform="translate(68, 56)">',
    '    <rect x="0" y="0" width="34" height="34" rx="4" fill="#171512"/>',
    '    <path d="M10 24V10H18.5C21.2 10 22.8 11.5 22.8 13.9C22.8 16.3 21.2 17.8 18.5 17.8H10" stroke="#FAF5EA" stroke-width="2.4" stroke-linecap="square" fill="none"/>',
    '    <path d="M19 24L24 19" stroke="#D63333" stroke-width="2.6" stroke-linecap="square" fill="none"/>',
    '  </g>',
    `  <text x="114" y="81" font-family="Georgia, 'Times New Roman', serif" font-size="25" font-weight="700" letter-spacing="-0.4" fill="#171512">${escapeXml(opts.siteName)}</text>`,
    `  <text x="1132" y="80" text-anchor="end" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="14" font-weight="600" letter-spacing="1.4" fill="#575148">${escapeXml(hostLabel.toUpperCase())}</text>`,
    '  <line x1="68" y1="106" x2="1132" y2="106" stroke="#171512" stroke-width="1.5"/>',
    '  <line x1="68" y1="110" x2="1132" y2="110" stroke="#171512" stroke-opacity="0.2" stroke-width="1"/>',
    // Category geometric badge
    `  <rect x="68" y="138" width="${catPillWidth}" height="32" rx="4" fill="${catMeta.bgTint}" stroke="${catMeta.color}" stroke-opacity="0.45" stroke-width="1.2"/>`,
    `  <rect x="80" y="148" width="12" height="12" rx="1.5" fill="${catMeta.color}"/>`,
    `  <text x="102" y="159" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="13" font-weight="700" letter-spacing="1.3" fill="${catMeta.color}">${escapeXml(catLabel)}</text>`,
    titleTextSvg,
    subtitleTextSvg,
    // Right-third technical editorial plate
    `  <g transform="translate(814, 128)">`,
    `    <rect x="0" y="0" width="320" height="378" rx="6" fill="#FFFDF8" stroke="#171512" stroke-width="1.75"/>`,
    `    <rect x="0" y="0" width="320" height="32" rx="6" fill="${catMeta.bgTint}"/>`,
    `    <line x1="0" y1="32" x2="320" y2="32" stroke="#171512" stroke-opacity="0.2" stroke-width="1"/>`,
    `    <rect x="14" y="11" width="10" height="10" rx="1" fill="${catMeta.color}"/>`,
    `    <text x="32" y="20" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="11" font-weight="700" letter-spacing="1.1" fill="#171512">${escapeXml(plateCaption)}</text>`,
    motifSvg,
    `    <text x="160" y="360" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="10.5" font-weight="600" letter-spacing="1.4" fill="#6E675C">PRIMARY-SOURCE VERIFIED BRIEFING</text>`,
    '  </g>',
    // Bottom editorial rule + QS seal + metadata
    '  <line x1="68" y1="528" x2="1132" y2="528" stroke="#171512" stroke-opacity="0.22" stroke-width="1"/>',
    `  <rect x="68" y="544" width="${badgeWidth}" height="34" rx="4" fill="${badgePalette.bg}"/>`,
    `  <circle cx="86" cy="561" r="4.5" fill="${badgePalette.dot}"/>`,
    `  <text x="100" y="566" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="13.5" font-weight="700" letter-spacing="0.8" fill="${badgePalette.fg}">${escapeXml(opts.badgeText)}</text>`,
    `  <text x="${68 + badgeWidth + 22}" y="566" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="14.5" font-weight="500" fill="#47423B">${escapeXml(metaItems)}</text>`,
    '</svg>',
  ].join('\n');
}

function buildLlmsTxt(settings: SiteSettings, skills: CategorySkill[], posts: PostRecord[], baseUrl: string): string {
  const lines: string[] = [
    `# ${settings.site_name}`,
    '',
    `> ${settings.site_tagline}`,
    '',
    '## Publication & Agent Navigation',
    '',
    `- [Agent Navigation Map (JSON)](${baseUrl}/api/v1/map): Structured directory of topics, recent stories, Markdown mirrors, and API endpoints.`,
    `- [Headless Posts API](${baseUrl}/api/v1/posts): Paginated JSON feed of published stories (supports ?category= and ?q=).`,
    `- [Instant Search API](${baseUrl}/api/v1/search?q=mcp): Rate-limited full-text search across published articles.`,
    `- [Full Machine-Readable Corpus](${baseUrl}/llms-full.txt): Complete Markdown stories with key facts, FAQs, and citations.`,
    `- [About ${settings.site_name}](${baseUrl}/about): Co-crafted by ${settings.default_author} (https://www.linkedin.com/in/hamdisoudani/) & Pyvren.`,
    `- [Editorial Policy](${baseUrl}/editorial-policy): Primary-source verification, anti-slop standards, and review workflow.`,
    `- [Contact](${baseUrl}/contact): Corrections, disclosures, and editorial inquiries (${settings.contact_email}).`,
    `- [RSS 2.0 Feed](${baseUrl}/rss.xml): Latest published stories in XML.`,
    `- [JSON Feed 1.1](${baseUrl}/feed.json): Latest published stories in JSON Feed format.`,
    `- [XML Sitemap](${baseUrl}/sitemap.xml): Canonical URL index.`,
    `- [Google News Sitemap](${baseUrl}/news-sitemap.xml): Stories from the past 48 hours.`,
    '',
    '## Topics',
    '',
  ];

  for (const skill of skills) {
    lines.push(`- [${skill.name}](${baseUrl}/category/${skill.slug}): ${skill.description}`);
  }

  lines.push('', '## Published Stories', '');

  if (posts.length === 0) {
    lines.push('- No published stories yet.');
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
    `Agent Map: ${baseUrl}/api/v1/map`,
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
      `- **Author:** ${post.author || settings.default_author} (Co-crafted with Pyvren)`,
      `- **Published:** ${dateStr}`,
      `- **Category:** ${post.category_slug}`,
      `- **Archetype:** ${post.archetype}`,
      `- **Quality Score:** ${post.quality_score}/100`,
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

  app.get('/og/fallback.svg', (c) => {
    const category = (c.req.query('category') || '').trim();
    const label = (c.req.query('label') || 'The Pyvren Dispatch').trim();
    const svg = renderStandalonePyvrenFallbackSvg(category, label);
    return new Response(svg, {
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
    const siteName = settings.site_name || 'The Pyvren Dispatch';

    const svg = renderOgCardSvg({
      siteName,
      baseUrl,
      category: 'Field Notes & Engineering Craft',
      categorySlug: 'ai-coding-agents-mcp',
      title: `${siteName} — Deep Dives into AI, Security & Cloud Craft`,
      subtitle:
        settings.site_tagline ||
        'Field notes, benchmarks, and deep dives into AI systems, security, and cloud craft.',
      author: `${settings.default_author || 'Hamdi Soudani'} · with Pyvren`,
      readingTimeLabel: 'Field Notes & Benchmarks',
      badgeText: 'CO-CRAFTED',
      badgeTone: 'accent',
      dateLabel: 'Primary Sources',
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
    const siteName = settings.site_name || 'The Pyvren Dispatch';
    const archetypeBadge = (post.archetype || 'dispatch').replace(/-/g, ' ').toUpperCase();

    const svg = renderOgCardSvg({
      siteName,
      baseUrl,
      category: skill?.name || post.category_slug.replace(/-/g, ' '),
      categorySlug: post.category_slug,
      title: post.title,
      subtitle: post.tldr_summary || post.description,
      author: `${post.author || settings.default_author || 'Hamdi Soudani'} · with Pyvren`,
      readingTimeLabel: `${post.reading_time_minutes || 1} min read`,
      badgeText: archetypeBadge,
      badgeTone: 'accent',
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
