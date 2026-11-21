import { normalizeBaseUrl } from '../env';
import {
  buildTopicClusters,
  computePostRelationships,
  getCategoryMeta,
  type PostRelationship,
  type TopicCluster,
} from '../lib/relations';
import { escapeHtml } from '../lib/security';
import type { Archetype, CategorySkill, PostImage, PostRecord, SiteSettings } from '../types';
import {
  renderHeroCrewSceneSvg,
  renderMastheadNibSvg,
  renderStoryCoverMedia,
  renderTopicCrewSvg,
  renderTopicSketchIcon,
  renderUiSketchIcon,
} from './crew-art';
import { renderPublicLayout } from './layout';

const HAMDI_LINKEDIN_URL = 'https://www.linkedin.com/in/hamdisoudani/';

const ARCHETYPE_LABELS: Record<Archetype, string> = {
  'advisory-teardown': 'Security Advisory',
  'benchmark-index': 'Benchmark Study',
  'migration-fix-log': 'Field Fix Log',
  'architecture-analysis': 'Deep Dive',
};

function formatArchetype(archetype: string): string {
  return ARCHETYPE_LABELS[archetype as Archetype] || archetype.replace(/-/g, ' ');
}

function formatDate(iso?: string | null): string {
  if (!iso) return 'Draft';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function safeHref(url?: string | null, fallback = '#'): string {
  const raw = (url || '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('/') || raw.startsWith('#')) return raw;
  try {
    const parsed = new URL(raw);
    if (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:' ||
      parsed.protocol === 'mailto:'
    ) {
      return raw;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function formatSourcePathLabel(url: string): { host: string; pathPreview: string } {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const rawPath = decodeURIComponent(parsed.pathname || '/').replace(/\/+$/, '');
    if (!rawPath || rawPath === '') {
      return { host, pathPreview: `${host} — Primary documentation` };
    }
    const cleanSegments = rawPath
      .split('/')
      .filter(Boolean)
      .slice(-3)
      .join(' / ');
    return {
      host,
      pathPreview: cleanSegments.length > 74 ? `${cleanSegments.slice(0, 71)}…` : cleanSegments,
    };
  } catch {
    return { host: 'Primary Source', pathPreview: truncateText(url, 72) };
  }
}

function truncateText(text: string, maxLen: number): string {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
}

function formatCoWorkByline(
  rawAuthor?: string | null,
  fallbackAuthor = 'Hamdi Soudani',
  compact = false,
): string {
  const clean = (rawAuthor || fallbackAuthor || 'Hamdi Soudani').trim();
  return compact ? `${clean} · with Pyvren` : `${clean} · Co-crafted with Pyvren`;
}

function extractKeySignals(
  post: PostRecord,
  maxCount = 3,
): Array<{ label?: string; text: string }> {
  const signals: Array<{ label?: string; text: string }> = [];
  if (Array.isArray(post.key_facts_json) && post.key_facts_json.length > 0) {
    for (const fact of post.key_facts_json.slice(0, maxCount)) {
      if (fact.label && fact.value) {
        signals.push({ label: fact.label, text: fact.value });
      }
    }
  }
  if (signals.length < maxCount) {
    const raw = (post.tldr_summary || post.description || '').trim();
    const sentences = raw
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 18);
    for (const s of sentences) {
      if (signals.length >= maxCount) break;
      signals.push({ text: s });
    }
  }
  return signals.slice(0, maxCount);
}

/**
 * Sketched Category Badge — uses bespoke dry-brush SVG icon per beat (zero generic circle dots).
 */
function renderCategoryTag(slug: string, customLabel?: string, asLink = true): string {
  const meta = getCategoryMeta(slug);
  const label = customLabel || meta.shortLabel;
  const styleAttr = `style="--topic-light:${meta.color}; --topic-dark:${meta.darkColor};"`;
  const inner = `${renderTopicSketchIcon(slug, 15)}<span>${escapeHtml(label)}</span>`;
  const classes =
    'topic-tone inline-flex items-center gap-1.5 font-tabular text-[11px] font-semibold uppercase tracking-[0.07em] topic-accent-text hover:opacity-80 transition-opacity';
  if (asLink) {
    return `<a href="/category/${encodeURIComponent(slug)}" class="${classes}" ${styleAttr}>${inner}</a>`;
  }
  return `<span class="${classes}" ${styleAttr}>${inner}</span>`;
}

/**
 * Illustrated In-Page Beat Strip — replaces cramped sub-navbar bars with tactile sketched tabs.
 */
function renderBeatStrip(opts: {
  skills: CategorySkill[];
  activeSlug?: string;
  query?: string;
  mode: 'home' | 'archive';
}): string {
  const { skills, activeSlug, query, mode } = opts;
  const trimmedQuery = (query || '').trim();

  const buildTabHref = (slug?: string): string => {
    if (mode === 'home') {
      return slug ? `/category/${encodeURIComponent(slug)}` : '/blog';
    }
    if (!trimmedQuery) {
      return slug ? `/category/${encodeURIComponent(slug)}` : '/blog';
    }
    const params = new URLSearchParams();
    if (slug) params.set('category', slug);
    params.set('q', trimmedQuery);
    return `/blog?${params.toString()}`;
  };

  const allActive = mode === 'archive' && !activeSlug;
  const tabs: string[] = [
    `<a href="${escapeHtml(buildTabHref(undefined))}" class="beat-tab"${allActive ? ' aria-current="page"' : ''}>
      ${renderTopicSketchIcon('all', 17)}
      <span>All Dispatches</span>
    </a>`,
  ];

  for (const skill of skills.filter((s) => s.enabled || s.slug === activeSlug)) {
    const meta = getCategoryMeta(skill.slug);
    const isActive = skill.slug === activeSlug;
    tabs.push(
      `<a href="${escapeHtml(buildTabHref(skill.slug))}" class="beat-tab topic-tone" style="--topic-light:${meta.color}; --topic-dark:${meta.darkColor};"${isActive ? ' aria-current="page"' : ''}>
        ${renderTopicSketchIcon(skill.slug, 17)}
        <span>${escapeHtml(meta.navLabel)}</span>
      </a>`,
    );
  }

  return `<div class="beat-strip" role="navigation" aria-label="Engineering beats">
    ${tabs.join('\n    ')}
  </div>`;
}

function renderAdSlot(settings: SiteSettings, slotLabel = 'Advertisement'): string {
  const clientId = (settings.adsense_client_id || '').trim();
  if (!clientId) return '';
  return `<aside class="ad-slot rounded-[12px]" aria-label="${escapeHtml(slotLabel)}">
  <span class="ad-slot-label">${escapeHtml(slotLabel)}</span>
  <ins class="adsbygoogle block w-full text-center"
       style="display:block;min-height:90px"
       data-ad-client="${escapeHtml(clientId)}"
       data-ad-format="auto"
       data-full-width-responsive="true"></ins>
  <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
</aside>`;
}

function renderCtaStrip(settings: SiteSettings): string {
  const author = settings.default_author || 'Hamdi Soudani';
  const headline =
    settings.cta_headline ||
    'Honest engineering stories — co-crafted with primary benchmarks & real code';
  const body =
    settings.cta_body ||
    'Every dispatch blends hands-on engineering judgment with verified primary sources, reproducible configs, and clear tradeoffs.';

  return `<section class="mt-16 border-t border-b border-hairline bg-subtle/60">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-11 sm:py-14 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-7">
    <div class="max-w-2xl space-y-2.5">
      <p class="inline-flex items-center gap-2 font-tabular text-[11px] uppercase tracking-[0.12em] text-accent font-semibold">
        ${renderUiSketchIcon('pen', 15)}
        <span>${escapeHtml(author)} &times; Pyvren</span>
      </p>
      <h2 class="font-masthead text-2xl sm:text-3xl font-bold text-ink leading-tight">${escapeHtml(headline)}</h2>
      <p class="text-sm sm:text-base text-ink-secondary leading-relaxed">${escapeHtml(body)}</p>
    </div>
    <div class="flex flex-wrap items-center gap-3 shrink-0">
      <a href="${HAMDI_LINKEDIN_URL}" target="_blank" rel="noopener noreferrer" class="btn-accent rounded-lg px-5">
        ${renderUiSketchIcon('linkedin', 15)}
        <span>Connect with ${escapeHtml(author)}</span>
      </a>
      <a href="/blog" class="btn-ghost rounded-lg px-4 text-xs sm:text-sm">Browse All Dispatches</a>
      <a href="/rss.xml" class="btn-ghost rounded-lg font-tabular text-xs">RSS</a>
    </div>
  </div>
</section>`;
}

function renderTopicClusterChips(clusters: TopicCluster[], limit = 10): string {
  if (clusters.length === 0) return '';
  return clusters
    .slice(0, limit)
    .map(
      (cluster) => `<a href="/blog?q=${encodeURIComponent(cluster.query)}" class="rel-chip topic-tone" style="--topic-light:${cluster.color}; --topic-dark:${cluster.darkColor};">
      <span>${escapeHtml(cluster.label)}</span>
      <span class="font-tabular text-[10px] text-ink-faint">${cluster.count}</span>
    </a>`,
    )
    .join('\n');
}

function renderMobileCarouselControls(count: number, label: string): string {
  if (count <= 1) return '';
  const dots = Array.from({ length: count })
    .map(
      (_, idx) =>
        `<button type="button" class="carousel-dot" data-carousel-dot aria-label="Go to ${escapeHtml(label)} ${idx + 1}" aria-selected="${idx === 0 ? 'true' : 'false'}"></button>`,
    )
    .join('');

  return `<div class="mt-4 flex md:hidden items-center justify-between gap-3">
    <div class="flex items-center gap-1.5" role="tablist" aria-label="${escapeHtml(label)} slides">
      ${dots}
    </div>
    <div class="flex items-center gap-1.5">
      <button type="button" data-carousel-prev class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-hairline bg-surface text-ink-secondary active:scale-95" aria-label="Previous ${escapeHtml(label)}">&larr;</button>
      <button type="button" data-carousel-next class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-hairline bg-surface text-ink-secondary active:scale-95" aria-label="Next ${escapeHtml(label)}">&rarr;</button>
    </div>
  </div>`;
}

function renderVisualStoryCard(opts: {
  post: PostRecord;
  defaultAuthor?: string;
  topRelation?: PostRelationship | null;
  reasonBadge?: string;
  loading?: 'lazy' | 'eager';
  slideWrapper?: boolean;
}): string {
  const {
    post,
    defaultAuthor = 'Hamdi Soudani',
    topRelation,
    reasonBadge,
    loading = 'lazy',
    slideWrapper = false,
  } = opts;
  const meta = getCategoryMeta(post.category_slug);
  const postHref = `/blog/${encodeURIComponent(post.slug)}`;
  const byline = formatCoWorkByline(post.author, defaultAuthor, true);

  const coverHtml = renderStoryCoverMedia({
    coverImageUrl: post.cover_image_url,
    coverImageAlt: post.cover_image_alt || post.title,
    categorySlug: post.category_slug,
    archetype: formatArchetype(post.archetype),
    title: post.title,
    instanceKey: `card-${post.id}`,
    aspectClass: 'aspect-[16/10]',
    eager: loading === 'eager',
  });

  const relationFooterHtml = reasonBadge
    ? `<div class="pt-1.5">
        <span class="topic-tone inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-subtle text-ink-secondary border border-hairline max-w-full truncate" style="--topic-light:${meta.color}; --topic-dark:${meta.darkColor};">
          ${renderUiSketchIcon('spark', 12)}
          <span class="truncate">${escapeHtml(reasonBadge)}</span>
        </span>
      </div>`
    : topRelation && topRelation.score > 0
      ? `<div class="pt-1.5">
          <a href="/blog/${encodeURIComponent(topRelation.post.slug)}" class="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-muted hover:text-accent transition-colors max-w-full truncate" title="${escapeHtml(topRelation.reasonLabel)}">
            ${renderUiSketchIcon('external', 12)}
            <span class="truncate">Related: ${escapeHtml(truncateText(topRelation.post.title, 40))}</span>
          </a>
        </div>`
      : '';

  const cardHtml = `<article class="story-card group h-full flex flex-col overflow-hidden">
  <a href="${postHref}" class="block focus:outline-none" aria-label="${escapeHtml(post.title)}">
    ${coverHtml}
  </a>

  <div class="p-5 flex-1 flex flex-col justify-between gap-4">
    <div class="space-y-2.5">
      <div class="flex items-center justify-between gap-2">
        ${renderCategoryTag(post.category_slug)}
        <span class="inline-flex items-center gap-1 font-tabular text-[11px] text-ink-faint">
          ${renderUiSketchIcon('clock', 12)}
          <span>${post.reading_time_minutes || 1}m</span>
        </span>
      </div>

      <h3 class="font-editorial text-[1.22rem] sm:text-[1.28rem] font-semibold leading-[1.25] text-ink">
        <a href="${postHref}" class="hover:text-accent transition-colors">${escapeHtml(post.title)}</a>
      </h3>

      <p class="text-sm text-ink-secondary leading-relaxed line-clamp-2">${escapeHtml(post.description)}</p>
      ${relationFooterHtml}
    </div>

    <div class="pt-3.5 border-t border-hairline flex items-center justify-between gap-3">
      <div class="min-w-0 space-y-0.5">
        <p class="inline-flex items-center gap-1.5 text-xs font-medium text-ink max-w-full">
          ${renderUiSketchIcon('pen', 12)}
          <span class="truncate">${escapeHtml(byline)}</span>
        </p>
        <time datetime="${escapeHtml(post.published_at || post.created_at)}" class="block font-tabular text-[11px] text-ink-faint">${escapeHtml(formatDate(post.published_at || post.created_at))}</time>
      </div>
      <a href="${postHref}" class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-hairline bg-paper text-ink-secondary group-hover:bg-[var(--ink-primary)] group-hover:border-[var(--ink-primary)] group-hover:text-[var(--bg-paper)] transition-colors shrink-0" aria-label="Read ${escapeHtml(post.title)}">
        <span aria-hidden="true">&rarr;</span>
      </a>
    </div>
  </div>
</article>`;

  return slideWrapper ? `<div class="mobile-carousel-slide">${cardHtml}</div>` : cardHtml;
}

/* ==========================================================================
   1. Landing Page — Sketchbook Editorial Broadsheet (Human + Pyvren Co-Work)
   ========================================================================== */

export function renderLandingPage(opts: {
  settings: SiteSettings;
  featuredPost: PostRecord | null;
  recentPosts: PostRecord[];
  skills: CategorySkill[];
  initialTheme?: 'light' | 'dark';
}): string {
  const { settings, featuredPost, recentPosts, skills, initialTheme } = opts;
  const enabledSkills = skills.filter((s) => s.enabled);
  const siteName = settings.site_name || 'The Pyvren Dispatch';
  const defaultAuthor = settings.default_author || 'Hamdi Soudani';
  const tagline =
    settings.site_tagline ||
    'Field notes, benchmarks, and deep dives into AI systems, security, and cloud craft — co-crafted by Hamdi Soudani & Pyvren.';

  // Build deduplicated published pool
  const pool: PostRecord[] = [];
  const seenIds = new Set<number>();
  const addToPool = (p: PostRecord | null | undefined) => {
    if (!p || p.status !== 'published' || seenIds.has(p.id)) return;
    seenIds.add(p.id);
    pool.push(p);
  };
  addToPool(featuredPost);
  for (const p of recentPosts) addToPool(p);

  const leadPost = featuredPost || pool[0] || null;
  const otherPosts = leadPost ? pool.filter((p) => p.id !== leadPost.id) : [];
  const secondaryPost = otherPosts[0] || null;

  const gridCandidates =
    otherPosts.length >= 3
      ? otherPosts.slice(1, 10)
      : otherPosts.length > 0
        ? otherPosts.slice(0, 9)
        : pool.slice(0, 3);

  const topicClusters = buildTopicClusters(pool, skills);
  const leadRelations = leadPost ? computePostRelationships(leadPost, pool, 3) : [];

  // 1. Sketchbook Studio Hero (Py, the house python, at the research desk)
  const heroHtml = `<section class="border-b border-hairline bg-paper">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-8 sm:pt-10 sm:pb-11">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
      <!-- Left 7 cols: Editorial Headline, Instant Search & Popular Tags -->
      <div class="lg:col-span-7 space-y-5">
        <div class="inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-hairline text-xs text-ink-secondary shadow-[2px_2px_0_0_var(--border-hairline)]">
          ${renderUiSketchIcon('pen', 14)}
          <span class="font-semibold text-ink">${escapeHtml(defaultAuthor)}</span>
          <span class="text-ink-faint" aria-hidden="true">&middot;</span>
          <span>Co-crafted with Pyvren</span>
        </div>

        <h1 class="font-masthead text-3xl sm:text-5xl lg:text-[3.35rem] font-bold leading-[1.06] tracking-tight text-ink">
          Field notes &amp; benchmarks for <span class="text-accent">builders who read the source.</span>
        </h1>

        <p class="text-base sm:text-lg text-ink-secondary leading-relaxed max-w-2xl">
          ${escapeHtml(tagline)}
        </p>

        <!-- Rate-Limited Live Instant Search Bar -->
        <div class="pt-1 max-w-xl">
          <form method="GET" action="/blog" role="search" data-live-search class="relative">
            <div class="p-1.5 rounded-xl bg-surface border border-strong/80 shadow-[var(--shadow-subtle)] focus-within:border-[var(--accent)] focus-within:shadow-[var(--shadow-lift)] transition-all flex items-center gap-2">
              <span class="pl-2.5 text-ink-muted shrink-0">
                ${renderUiSketchIcon('search', 17)}
              </span>
              <label for="hero-search-input" class="sr-only">Search stories, benchmarks, CVEs, or topics</label>
              <input
                id="hero-search-input"
                type="search"
                name="q"
                autocomplete="off"
                placeholder="Search MCP benchmarks, prompt injection, LLMs, GPUs..."
                class="w-full min-w-0 bg-transparent border-0 text-sm text-ink placeholder:text-ink-faint focus:outline-none py-2"
              >
              <button type="submit" class="btn-accent rounded-lg px-4 sm:px-5 py-2 text-xs sm:text-sm shrink-0">
                Search
              </button>
            </div>
            <div data-search-results class="search-dropdown hidden" role="listbox" aria-label="Search suggestions"></div>
          </form>
        </div>

        ${
          topicClusters.length > 0
            ? `<div class="pt-1 flex items-center gap-2 overflow-x-auto ribbon-scroll">
                <span class="font-tabular text-[11px] uppercase tracking-[0.08em] text-ink-faint shrink-0">Indexed:</span>
                ${renderTopicClusterChips(topicClusters, 5)}
              </div>`
            : ''
        }
      </div>

      <!-- Right 5 cols: Py studio scene -->
      <div class="lg:col-span-5">
        <div class="rounded-2xl border-[1.5px] border-strong/80 bg-surface p-3 sm:p-4 shadow-[4px_4px_0_0_var(--border-hairline)]">
          ${renderHeroCrewSceneSvg()}
        </div>
      </div>
    </div>

    <!-- In-Page Illustrated Beat Strip (Cleanly replaces cramped sub-navbar bars) -->
    ${
      enabledSkills.length > 0
        ? `<div class="mt-8 pt-5 border-t border-hairline">
            <div class="flex items-center justify-between gap-3 mb-2">
              <span class="font-tabular text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">Explore Beats</span>
              <a href="/blog" class="font-tabular text-[11px] font-semibold text-accent hover:underline">Archive &rarr;</a>
            </div>
            ${renderBeatStrip({ skills: enabledSkills, mode: 'home' })}
          </div>`
        : ''
    }
  </div>
</section>`;

  // 2. Lead Story Spread
  let leadSpreadHtml = '';
  if (leadPost) {
    const leadSignals = extractKeySignals(leadPost, 3);
    const leadHref = `/blog/${encodeURIComponent(leadPost.slug)}`;
    const leadByline = formatCoWorkByline(leadPost.author, defaultAuthor, false);

    const leadCoverHtml = renderStoryCoverMedia({
      coverImageUrl: leadPost.cover_image_url,
      coverImageAlt: leadPost.cover_image_alt || leadPost.title,
      categorySlug: leadPost.category_slug,
      archetype: formatArchetype(leadPost.archetype),
      title: leadPost.title,
      instanceKey: `lead-${leadPost.id}`,
      aspectClass: 'aspect-[16/10]',
      eager: true,
    });

    const secondaryCardHtml = secondaryPost
      ? renderVisualStoryCard({
          post: secondaryPost,
          defaultAuthor,
          loading: 'eager',
        })
      : `<div class="editorial-card p-6 space-y-3">
          <p class="inline-flex items-center gap-1.5 font-tabular text-[11px] uppercase tracking-[0.12em] text-accent font-semibold">
            ${renderUiSketchIcon('pen', 14)}
            <span>About the Desk</span>
          </p>
          <h3 class="font-masthead text-xl font-bold text-ink">${escapeHtml(defaultAuthor)} &times; Pyvren</h3>
          <p class="text-sm text-ink-secondary leading-relaxed">${escapeHtml(settings.author_bio)}</p>
          <a href="${HAMDI_LINKEDIN_URL}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline">
            ${renderUiSketchIcon('linkedin', 14)}
            <span>Connect on LinkedIn &nearr;</span>
          </a>
        </div>`;

    const relatedWireHtml =
      leadRelations.length > 0
        ? `<aside class="editorial-card p-5 space-y-3.5" aria-label="Further reading">
            <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-hairline">
              <h3 class="inline-flex items-center gap-1.5 font-tabular text-[11px] uppercase tracking-[0.12em] font-bold text-ink">
                ${renderUiSketchIcon('layers', 14)}
                <span>Connected Reading</span>
              </h3>
              <a href="/blog" class="font-tabular text-[11px] text-accent hover:underline">All &rarr;</a>
            </div>
            <ul class="divide-y divide-[var(--border-hairline)]">
              ${leadRelations
                .map((rel) => {
                  const relMeta = getCategoryMeta(rel.post.category_slug);
                  return `<li class="py-3 first:pt-0 last:pb-0 space-y-1.5">
                    <div class="flex items-center justify-between gap-2 text-[11px]">
                      ${renderCategoryTag(rel.post.category_slug, relMeta.navLabel, false)}
                      <span class="inline-flex items-center gap-1 text-ink-faint font-tabular">
                        ${renderUiSketchIcon('clock', 11)}
                        <span>${rel.post.reading_time_minutes || 1}m</span>
                      </span>
                    </div>
                    <a href="/blog/${encodeURIComponent(rel.post.slug)}" class="block font-editorial text-[1rem] font-semibold leading-snug text-ink hover:text-accent transition-colors">
                      ${escapeHtml(rel.post.title)}
                    </a>
                  </li>`;
                })
                .join('')}
            </ul>
          </aside>`
        : '';

    leadSpreadHtml = `<section aria-labelledby="featured-story-heading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-4">
  <div class="double-rule-top pt-3 pb-4 flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-2 text-ink">
      ${renderUiSketchIcon('spark', 14)}
      <h2 id="featured-story-heading" class="font-tabular text-[11px] uppercase tracking-[0.14em] text-ink font-bold">Featured Dispatch</h2>
    </div>
    <span class="inline-flex items-center gap-1.5 font-tabular text-xs text-ink-faint">
      ${renderUiSketchIcon('calendar', 13)}
      <span>${escapeHtml(formatDate(leadPost.published_at || leadPost.created_at))}</span>
    </span>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
    <!-- Lead Story Card -->
    <article class="lg:col-span-8 story-card overflow-hidden">
      <a href="${leadHref}" class="block focus:outline-none">
        ${leadCoverHtml}
      </a>
      <div class="p-5 sm:p-7 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2.5">
            ${renderCategoryTag(leadPost.category_slug)}
            <span class="badge-editorial">${escapeHtml(formatArchetype(leadPost.archetype))}</span>
          </div>
          <span class="inline-flex items-center gap-1.5 font-tabular text-xs text-ink-muted">
            ${renderUiSketchIcon('clock', 13)}
            <span>${leadPost.reading_time_minutes || 1} min read</span>
          </span>
        </div>

        <h3 class="font-masthead text-2xl sm:text-3xl lg:text-[2.1rem] font-bold leading-[1.13] text-ink">
          <a href="${leadHref}" class="hover:text-accent transition-colors">${escapeHtml(leadPost.title)}</a>
        </h3>

        <p class="text-sm sm:text-base text-ink-secondary leading-relaxed">${escapeHtml(leadPost.description)}</p>

        ${
          leadSignals.length > 0
            ? `<div class="rounded-xl bg-subtle/80 border border-hairline p-4 space-y-2.5">
                <p class="inline-flex items-center gap-1.5 font-tabular text-[10px] uppercase tracking-[0.12em] text-ink font-bold">
                  ${renderUiSketchIcon('ledger', 13)}
                  <span>Verified Highlights</span>
                </p>
                <ul class="space-y-1.5 text-xs sm:text-[13.5px] text-ink-secondary leading-snug">
                  ${leadSignals
                    .map(
                      (sig) => `<li class="flex items-start gap-2">
                        <span class="font-tabular font-bold text-accent select-none shrink-0" aria-hidden="true">&mdash;</span>
                        <span>${sig.label ? `<strong class="text-ink font-semibold">${escapeHtml(sig.label)}:</strong> ` : ''}${escapeHtml(sig.text)}</span>
                      </li>`,
                    )
                    .join('')}
                </ul>
              </div>`
            : ''
        }

        <div class="pt-3.5 border-t border-hairline flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
            <span class="inline-flex items-center gap-1.5 font-semibold text-ink">
              ${renderUiSketchIcon('pen', 13)}
              <span>${escapeHtml(leadByline)}</span>
            </span>
            <span class="text-ink-faint" aria-hidden="true">&middot;</span>
            <span class="inline-flex items-center gap-1 font-tabular text-ink-muted">
              ${renderUiSketchIcon('source', 13)}
              <span>${leadPost.sources_json.length} primary sources</span>
            </span>
          </div>
          <a href="${leadHref}" class="btn-accent rounded-lg px-5 py-2 text-xs sm:text-sm">
            <span>Read Dispatch</span>
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </div>
    </article>

    <!-- Right Column: Second Story + Connected Reading -->
    <div class="lg:col-span-4 space-y-5 broadsheet-divider">
      ${secondaryCardHtml}
      ${relatedWireHtml}
    </div>
  </div>
</section>`;
  } else {
    leadSpreadHtml = `<section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-4">
      <div class="editorial-card p-8 sm:p-10 text-center space-y-4">
        <div class="mx-auto w-40 h-28">${renderTopicCrewSvg('ai-coding-agents-mcp', 'empty-home')}</div>
        <h2 class="font-masthead text-2xl sm:text-3xl font-bold text-ink">Fresh dispatches are on Py’s drafting desk.</h2>
        <p class="text-sm sm:text-base text-ink-secondary max-w-xl mx-auto">Explore our six engineering beats below while the next primary-source story is prepared.</p>
      </div>
    </section>`;
  }

  // 3. Recent Stories (Touch-Snap Carousel on Mobile, 3-Column Grid on Desktop)
  const recentStoriesHtml =
    gridCandidates.length > 0
      ? `<section aria-labelledby="recent-stories-heading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12" data-carousel-root>
  <div class="double-rule-top pt-4 pb-5 flex items-end justify-between gap-4">
    <div>
      <p class="inline-flex items-center gap-1.5 font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">
        ${renderUiSketchIcon('note', 14)}
        <span>Latest Dispatches</span>
      </p>
      <h2 id="recent-stories-heading" class="font-masthead text-2xl sm:text-3xl font-bold text-ink mt-1">Recent Stories</h2>
    </div>
    <a href="/blog" class="font-tabular text-xs font-semibold text-ink-secondary hover:text-accent transition-colors shrink-0">View archive &rarr;</a>
  </div>

  <div class="mobile-carousel md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6" data-carousel-track>
    ${gridCandidates
      .map((post) => {
        const topRel = computePostRelationships(post, pool, 1)[0] || null;
        return renderVisualStoryCard({
          post,
          defaultAuthor,
          topRelation: topRel,
          loading: 'lazy',
          slideWrapper: true,
        });
      })
      .join('\n')}
  </div>
  ${renderMobileCarouselControls(gridCandidates.length, 'story')}
</section>`
      : '';

  // 4. 6 Illustrated Py Topic Cards (Swipeable Mobile Carousel -> 3-Col Desktop Grid)
  const topicsSectionHtml =
    enabledSkills.length > 0
      ? `<section id="categories" aria-labelledby="topics-heading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 scroll-mt-24" data-carousel-root>
  <div class="double-rule-top pt-4 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
    <div>
      <p class="inline-flex items-center gap-1.5 font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">
        ${renderUiSketchIcon('layers', 14)}
        <span>Subject Atlas</span>
      </p>
      <h2 id="topics-heading" class="font-masthead text-2xl sm:text-3xl font-bold text-ink mt-1">Six Engineering Beats</h2>
    </div>
    <p class="text-xs sm:text-sm text-ink-muted max-w-md">Swipe on mobile or choose a beat — each section pairs primary benchmarks with Py’s sketchbook illustrations.</p>
  </div>

  <div class="mobile-carousel mobile-carousel--compact md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-5" data-carousel-track>
    ${enabledSkills
      .map((skill) => {
        const meta = getCategoryMeta(skill.slug);
        const crewSvg = renderTopicCrewSvg(skill.slug, 'home');
        return `<div class="mobile-carousel-slide">
          <a href="/category/${encodeURIComponent(skill.slug)}" class="story-card topic-tone h-full p-5 flex flex-col justify-between gap-4 group block" style="--topic-light:${meta.color}; --topic-dark:${meta.darkColor};">
            <div class="space-y-3">
              <div class="rounded-xl bg-subtle/85 border border-hairline px-3 pt-3 pb-1 overflow-hidden">
                <div class="flex items-center justify-between gap-2 mb-1">
                  <span class="inline-flex items-center gap-1.5 font-tabular text-[10px] font-bold uppercase tracking-[0.09em] topic-accent-text">
                    ${renderTopicSketchIcon(skill.slug, 15)}
                    <span>${escapeHtml(meta.shortLabel)}</span>
                  </span>
                  <span class="font-tabular text-[10px] text-ink-faint">Illustrated</span>
                </div>
                <div class="h-28 w-full max-w-[190px] mx-auto">
                  ${crewSvg}
                </div>
              </div>
              <h3 class="font-editorial text-xl font-semibold text-ink group-hover:text-accent transition-colors leading-snug">${escapeHtml(skill.name)}</h3>
              <p class="text-sm text-ink-secondary leading-relaxed line-clamp-2">${escapeHtml(skill.description)}</p>
            </div>
            <div class="pt-3 border-t border-hairline flex items-center justify-between text-xs">
              <span class="text-ink-muted truncate max-w-[72%]">${escapeHtml(skill.target_audience)}</span>
              <span class="font-semibold text-accent group-hover:translate-x-0.5 transition-transform shrink-0">Explore &rarr;</span>
            </div>
          </a>
        </div>`;
      })
      .join('\n')}
  </div>
  ${renderMobileCarouselControls(enabledSkills.length, 'topic')}
</section>`
      : '';

  // 5. Human + Agent Co-Work Note & Hamdi Soudani Profile Card
  const coWorkNoteHtml = `<section aria-labelledby="cowork-heading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
  <div class="field-note p-6 sm:p-9">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
      <div class="lg:col-span-7 space-y-3.5">
        <div class="flex items-center gap-3">
          ${renderMastheadNibSvg(42)}
          <div>
            <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-bold">How We Write</p>
            <p class="text-xs text-ink-muted">${escapeHtml(defaultAuthor)} &times; Pyvren Studio</p>
          </div>
        </div>
        <h2 id="cowork-heading" class="font-masthead text-2xl sm:text-3xl font-bold text-ink leading-tight">
          Human taste &amp; engineering judgment, paired with tireless primary-source research.
        </h2>
        <p class="text-sm sm:text-base text-ink-secondary leading-relaxed">
          ${escapeHtml(siteName)} is a collaborative publication by <strong>${escapeHtml(defaultAuthor)}</strong> and <strong>Pyvren</strong>. Together we track real advisories, benchmark repos, and systems papers — turning raw primary documentation into clear, practical dispatches with zero filler.
        </p>
        <div class="pt-1 flex flex-wrap items-center gap-3">
          <a href="${HAMDI_LINKEDIN_URL}" target="_blank" rel="noopener noreferrer" class="btn-primary rounded-lg px-5 text-xs sm:text-sm">
            ${renderUiSketchIcon('linkedin', 15)}
            <span>${escapeHtml(defaultAuthor)} on LinkedIn</span>
          </a>
          <a href="/about" class="btn-ghost rounded-lg px-4 text-xs sm:text-sm">About the Co-Work</a>
        </div>
      </div>

      <div class="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4 broadsheet-divider">
        <div class="p-4 rounded-xl bg-subtle/75 border border-hairline space-y-2">
          <p class="inline-flex items-center gap-1.5 font-tabular text-[11px] font-bold text-ink">
            ${renderUiSketchIcon('source', 14)}
            <span>PRIMARY SOURCES</span>
          </p>
          <p class="text-xs sm:text-sm text-ink-secondary leading-relaxed">Every benchmark number, config snippet, and diagram links directly to the original repo, paper, or advisory.</p>
        </div>
        <div class="p-4 rounded-xl bg-subtle/75 border border-hairline space-y-2">
          <p class="inline-flex items-center gap-1.5 font-tabular text-[11px] font-bold text-ink">
            ${renderUiSketchIcon('ledger', 14)}
            <span>PRIMARY SOURCES ONLY</span>
          </p>
          <p class="text-xs sm:text-sm text-ink-secondary leading-relaxed">Warm newsprint or obsidian dark mode, colorized code blocks, full-width benchmark tables, and honest tradeoffs.</p>
        </div>
      </div>
    </div>
  </div>
  ${renderAdSlot(settings, 'Sponsored')}
</section>`;

  const landingBody = `${heroHtml}
${leadSpreadHtml}
${recentStoriesHtml}
${topicsSectionHtml}
${coWorkNoteHtml}
${renderCtaStrip(settings)}`;

  const baseUrl = normalizeBaseUrl(settings.base_url);
  return renderPublicLayout({
    title: `${siteName} — AI, Security & Cloud Engineering Stories`,
    description: tagline,
    canonicalUrl: `${baseUrl}/`,
    settings,
    ogType: 'website',
    currentPath: '/',
    initialTheme,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: siteName,
        url: `${baseUrl}/`,
        description: tagline,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${baseUrl}/blog?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
    bodyHtml: landingBody,
  });
}

/* ==========================================================================
   2. Blog Index & Category Archive Page
   ========================================================================== */

export function renderBlogIndexPage(opts: {
  settings: SiteSettings;
  posts: PostRecord[];
  skills: CategorySkill[];
  activeCategory?: string;
  page: number;
  totalPages: number;
  query?: string;
  initialTheme?: 'light' | 'dark';
  rateLimitRetrySeconds?: number;
}): string {
  const {
    settings,
    posts,
    skills,
    activeCategory,
    page,
    totalPages,
    query,
    initialTheme,
    rateLimitRetrySeconds,
  } = opts;
  const activeSkill = activeCategory ? skills.find((s) => s.slug === activeCategory) : undefined;
  const trimmedQuery = (query || '').trim();
  const activeMeta = activeCategory ? getCategoryMeta(activeCategory) : null;
  const defaultAuthor = settings.default_author || 'Hamdi Soudani';

  const buildIndexUrl = (targetPage: number, cat?: string, q?: string): string => {
    const params = new URLSearchParams();
    if (cat) params.set('category', cat);
    if (q) params.set('q', q);
    if (targetPage > 1) params.set('page', String(targetPage));
    const qs = params.toString();
    return qs ? `/blog?${qs}` : '/blog';
  };

  const rateLimitBannerHtml = rateLimitRetrySeconds
    ? `<div role="alert" class="mt-6 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-5 text-sm text-ink space-y-1">
        <p class="font-semibold text-accent">Whoa — slow down just a bit!</p>
        <p class="text-ink-secondary">You’ve sent a burst of search queries. Please wait <strong>${rateLimitRetrySeconds}s</strong> and try your search again.</p>
      </div>`
    : '';

  const cardsHtml = rateLimitRetrySeconds
    ? ''
    : posts.length > 0
      ? `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${posts
          .map((post, idx) => {
            const topRel = computePostRelationships(post, posts, 1)[0] || null;
            return renderVisualStoryCard({
              post,
              defaultAuthor,
              topRelation: topRel,
              loading: idx < 3 ? 'eager' : 'lazy',
            });
          })
          .join('\n')}
      </div>`
      : `<div class="editorial-card p-10 text-center space-y-4">
        <div class="mx-auto w-36 h-24">${renderTopicCrewSvg(activeCategory || 'agentic-browser-web-data', 'empty-search')}</div>
        <p class="font-masthead text-2xl font-bold text-ink">No matching dispatches found.</p>
        <p class="text-sm text-ink-muted">Try another keyword or switch beats above.</p>
        <div class="pt-1">
          <a href="/blog" class="btn-ghost rounded-lg">Show all dispatches</a>
        </div>
      </div>`;

  const paginationHtml =
    totalPages > 1 && !rateLimitRetrySeconds
      ? `<nav aria-label="Pagination" class="mt-10 flex items-center justify-between gap-4 border-t border-hairline pt-6">
        <div>
          ${
            page > 1
              ? `<a href="${escapeHtml(buildIndexUrl(page - 1, activeCategory, trimmedQuery))}" class="btn-ghost rounded-lg font-tabular text-xs">&larr; Previous</a>`
              : `<span class="btn-ghost rounded-lg opacity-40 pointer-events-none font-tabular text-xs">&larr; Previous</span>`
          }
        </div>
        <span class="font-tabular text-xs text-ink-muted">Page ${page} of ${totalPages}</span>
        <div>
          ${
            page < totalPages
              ? `<a href="${escapeHtml(buildIndexUrl(page + 1, activeCategory, trimmedQuery))}" class="btn-ghost rounded-lg font-tabular text-xs">Next &rarr;</a>`
              : `<span class="btn-ghost rounded-lg opacity-40 pointer-events-none font-tabular text-xs">Next &rarr;</span>`
          }
        </div>
      </nav>`
      : '';

  const categoryMascotHtml =
    activeSkill && activeMeta
      ? `<div class="topic-tone hidden md:flex items-center justify-center w-44 h-28 rounded-xl bg-subtle border border-hairline p-2 shrink-0" style="--topic-light:${activeMeta.color}; --topic-dark:${activeMeta.darkColor};">
        ${renderTopicCrewSvg(activeSkill.slug, 'archive-header')}
      </div>`
      : '';

  const indexBody = `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
  <header class="field-note p-5 sm:p-8 space-y-6">
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
      <div class="flex items-center gap-5 min-w-0">
        ${categoryMascotHtml}
        <div class="space-y-2 max-w-2xl min-w-0">
          <p class="topic-tone inline-flex items-center gap-1.5 font-tabular text-[11px] uppercase tracking-[0.13em] topic-accent-text font-semibold" style="--topic-light:${activeMeta ? activeMeta.color : 'var(--accent)'}; --topic-dark:${activeMeta ? activeMeta.darkColor : 'var(--accent)'};">
            ${renderTopicSketchIcon(activeSkill ? activeSkill.slug : 'all', 16)}
            <span>${activeSkill ? `${escapeHtml(activeMeta?.shortLabel || 'Beat')} Beat` : 'Complete Dispatch Archive'}</span>
          </p>
          <h1 class="font-masthead text-2xl sm:text-4xl lg:text-[2.65rem] font-bold text-ink leading-[1.1]">
            ${activeSkill ? escapeHtml(activeSkill.name) : 'Dispatches & Benchmarks'}
          </h1>
          <p class="text-sm sm:text-base text-ink-secondary leading-relaxed">
            ${
              activeSkill
                ? escapeHtml(activeSkill.description)
                : 'Deep dives, security advisories, and reproducible engineering benchmarks — co-crafted by Hamdi Soudani & Pyvren.'
            }
          </p>
        </div>
      </div>

      <form id="search" method="GET" action="/blog" role="search" data-live-search class="relative w-full lg:w-[23rem] shrink-0">
        ${activeCategory ? `<input type="hidden" name="category" value="${escapeHtml(activeCategory)}">` : ''}
        <div class="p-1.5 rounded-xl bg-paper border border-strong/75 focus-within:border-[var(--accent)] transition-colors flex items-center gap-2">
          <span class="pl-2.5 text-ink-muted shrink-0">
            ${renderUiSketchIcon('search', 16)}
          </span>
          <label for="archive-search-input" class="sr-only">Search stories</label>
          <input id="archive-search-input" type="search" name="q" autocomplete="off" value="${escapeHtml(trimmedQuery)}" placeholder="Search titles, topics, CVEs..." class="w-full min-w-0 bg-transparent border-0 text-sm text-ink placeholder:text-ink-faint focus:outline-none py-1.5">
          <button type="submit" class="btn-accent rounded-lg px-4 py-1.5 text-xs shrink-0">Search</button>
        </div>
        <div data-search-results class="search-dropdown hidden" role="listbox" aria-label="Search suggestions"></div>
      </form>
    </div>

    <div class="pt-4 border-t border-hairline flex items-center justify-between gap-3">
      <div class="min-w-0 flex-1">
        ${renderBeatStrip({ skills, activeSlug: activeCategory, query: trimmedQuery, mode: 'archive' })}
      </div>
      ${
        trimmedQuery || activeCategory
          ? `<a href="/blog" class="font-tabular text-xs font-semibold text-ink-muted hover:text-accent underline underline-offset-2 shrink-0">Reset</a>`
          : ''
      }
    </div>
  </header>

  ${rateLimitBannerHtml}

  ${
    trimmedQuery && !rateLimitRetrySeconds
      ? `<p class="mt-6 font-tabular text-xs text-ink-muted">Showing results for <strong class="text-ink">&ldquo;${escapeHtml(trimmedQuery)}&rdquo;</strong>${activeSkill ? ` in ${escapeHtml(activeSkill.name)}` : ''}.</p>`
      : ''
  }

  <div class="mt-8">
    ${cardsHtml}
  </div>

  ${paginationHtml}
  ${renderAdSlot(settings, 'Sponsored')}
</div>`;

  const baseUrl = normalizeBaseUrl(settings.base_url);
  const siteName = settings.site_name || 'The Pyvren Dispatch';
  const canonicalPath = activeSkill ? `/category/${encodeURIComponent(activeSkill.slug)}` : '/blog';
  const pageTitle = activeSkill
    ? `${activeSkill.name} — ${siteName}`
    : trimmedQuery
      ? `Search: ${trimmedQuery} — ${siteName}`
      : `Dispatches & Benchmarks — ${siteName}`;
  const pageDesc = activeSkill
    ? activeSkill.description
    : settings.site_tagline ||
      'Field notes, benchmarks, and deep dives into AI, security, and cloud craft.';

  return renderPublicLayout({
    title: pageTitle,
    description: pageDesc,
    canonicalUrl: `${baseUrl}${canonicalPath}`,
    settings,
    ogType: 'website',
    currentPath: canonicalPath,
    robotsMeta: trimmedQuery || rateLimitRetrySeconds ? 'noindex, follow' : undefined,
    initialTheme,
    bodyHtml: indexBody,
  });
}

/* ==========================================================================
   3. Single Blog Post Page (Syntax Code, Ledger Tables, Ref Cards, Pyvren Backup)
   ========================================================================== */

export function renderBlogPostPage(opts: {
  settings: SiteSettings;
  post: PostRecord;
  skill?: CategorySkill | null;
  relatedPosts: PostRecord[];
  headings?: Array<{ id: string; level: number; text: string }>;
  compiledHtml?: string;
  initialTheme?: 'light' | 'dark';
}): string {
  const {
    settings,
    post,
    skill,
    relatedPosts,
    headings = [],
    compiledHtml,
    initialTheme,
  } = opts;
  const catMeta = getCategoryMeta(post.category_slug);
  const categoryName = skill?.name || catMeta.navLabel || post.category_slug.replace(/-/g, ' ');
  const authorName = post.author || settings.default_author || 'Hamdi Soudani';
  const coWorkByline = formatCoWorkByline(authorName, settings.default_author || 'Hamdi Soudani', false);
  const publishedIso = post.published_at || post.created_at;
  const updatedIso = post.updated_at;
  const showUpdated =
    Boolean(updatedIso && publishedIso) && formatDate(updatedIso) !== formatDate(publishedIso);
  const hasToc = headings.length >= 2;
  const markdownUrl = `/blog/${encodeURIComponent(post.slug)}.md`;
  const renderedProseHtml = compiledHtml || post.body_html;

  const relationships = computePostRelationships(post, relatedPosts, 3);

  // Hero visual: real crawled primary reference image (skeleton while loading, automatic Py backup on error),
  // OR the Py category illustration when no cover image exists.
  const hasRealCover = Boolean(
    post.cover_image_url && post.cover_image_url.trim().startsWith('https://'),
  );
  const coverSourceMatch = Array.isArray(post.images_json)
    ? post.images_json.find((img) => img.url === post.cover_image_url)
    : undefined;

  const heroVisualHtml = hasRealCover
    ? `<figure class="article-hero-figure max-w-4xl">
        ${renderStoryCoverMedia({
          coverImageUrl: post.cover_image_url,
          coverImageAlt: post.cover_image_alt || post.title,
          categorySlug: post.category_slug,
          archetype: formatArchetype(post.archetype),
          title: post.title,
          instanceKey: `post-cover-${post.id}`,
          aspectClass: 'aspect-[16/9]',
          eager: true,
        })}
        <figcaption class="article-hero-caption flex flex-wrap items-center justify-between gap-2">
          <span class="inline-flex items-center gap-1.5">
            ${renderUiSketchIcon('note', 13)}
            <span>${escapeHtml(post.cover_image_alt || post.title)}</span>
          </span>
          ${
            coverSourceMatch?.source_page_url
              ? `<a href="${escapeHtml(safeHref(coverSourceMatch.source_page_url))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-tabular text-xs font-medium text-accent hover:underline">
                  <span>Source: ${escapeHtml(extractDomain(coverSourceMatch.source_page_url))}</span>
                  ${renderUiSketchIcon('external', 12)}
                </a>`
              : ''
          }
        </figcaption>
      </figure>`
    : `<div class="mt-7 max-w-4xl rounded-2xl overflow-hidden border-[1.5px] border-hairline bg-surface shadow-[var(--shadow-subtle)]">
        ${renderStoryCoverMedia({
          coverImageUrl: null,
          categorySlug: post.category_slug,
          archetype: formatArchetype(post.archetype),
          title: post.title,
          instanceKey: `post-hero-${post.id}`,
          aspectClass: 'aspect-[21/9]',
          eager: true,
        })}
      </div>`;

  // Extra crawled reference images (not already used as cover or embedded inline in body_markdown)
  const extraReferenceImages: PostImage[] = Array.isArray(post.images_json)
    ? post.images_json.filter(
        (img) =>
          img?.url &&
          img.url.startsWith('https://') &&
          img.url !== post.cover_image_url &&
          !post.body_markdown.includes(img.url),
      )
    : [];

  const referenceGalleryHtml =
    extraReferenceImages.length > 0
      ? `<section aria-labelledby="ref-figures-heading" class="mt-12 pt-8 border-t border-hairline">
          <p class="inline-flex items-center gap-1.5 font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">
            ${renderUiSketchIcon('layers', 14)}
            <span>Visual Evidence</span>
          </p>
          <h2 id="ref-figures-heading" class="font-masthead text-2xl font-bold text-ink mt-1 mb-4">Figures from Cited Sources</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${extraReferenceImages
              .slice(0, 4)
              .map(
                (img) => `<figure class="editorial-figure m-0 rounded-xl overflow-hidden border border-hairline bg-surface">
                  <img
                    src="${escapeHtml(img.url)}"
                    alt="${escapeHtml(img.alt || post.title)}"
                    data-fallback-category="${escapeHtml(post.category_slug)}"
                    data-fallback-label="${escapeHtml(img.caption || img.alt || post.title)}"
                    loading="lazy"
                    decoding="async"
                    referrerpolicy="no-referrer"
                    class="skeleton-img w-full aspect-[16/10] object-cover"
                  >
                  <figcaption class="editorial-caption flex items-center justify-between gap-2">
                    <span class="truncate">${escapeHtml(img.caption || img.alt || 'Reference diagram')}</span>
                    ${
                      img.source_page_url
                        ? `<a href="${escapeHtml(safeHref(img.source_page_url))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-tabular text-[11px] font-medium text-accent hover:underline shrink-0">
                            <span>${escapeHtml(extractDomain(img.source_page_url))}</span>
                            ${renderUiSketchIcon('external', 11)}
                          </a>`
                        : ''
                    }
                  </figcaption>
                </figure>`,
              )
              .join('\n')}
          </div>
        </section>`
      : '';

  // Crafted Field-Note Summary Card (Replaces cliché AI left-border callout)
  const tldrHtml = post.tldr_summary
    ? `<section aria-label="Quick Summary" class="field-note mt-8 p-5 sm:p-6">
      <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-hairline">
        <span class="inline-flex items-center gap-2 font-tabular text-[11px] uppercase tracking-[0.13em] text-ink font-bold">
          ${renderUiSketchIcon('note', 16)}
          <span>Field Note &middot; The Short Version</span>
        </span>
        <span class="inline-flex items-center gap-1 font-tabular text-[11px] text-ink-muted">
          ${renderUiSketchIcon('clock', 12)}
          <span>${post.reading_time_minutes} min read</span>
        </span>
      </div>
      <p class="font-editorial text-[1.08rem] sm:text-[1.16rem] leading-[1.62] text-ink">${escapeHtml(post.tldr_summary)}</p>
    </section>`
    : '';

  // Full-Width Editorial Benchmark Ledger for Key Numbers & Specs
  const keyFactsHtml =
    post.key_facts_json.length > 0
      ? `<section aria-labelledby="key-facts-heading" class="mt-6">
      <div class="editorial-table-wrap !my-0">
        <div class="px-4 sm:px-5 py-3 bg-subtle border-b border-strong flex items-center justify-between gap-3">
          <h2 id="key-facts-heading" class="inline-flex items-center gap-2 font-tabular text-[11px] uppercase tracking-[0.13em] text-ink font-bold">
            ${renderUiSketchIcon('ledger', 15)}
            <span>Key Numbers &amp; Verified Specs</span>
          </h2>
          <span class="font-tabular text-[11px] text-ink-muted">${post.key_facts_json.length} metrics</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Metric / Spec</th>
              <th>Verified Finding</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            ${post.key_facts_json
              .map((fact) => {
                const srcHref = fact.source_url ? safeHref(fact.source_url, '') : '';
                return `<tr>
              <td class="font-tabular text-xs font-semibold text-ink w-1/3">${escapeHtml(fact.label)}</td>
              <td class="text-ink-secondary font-medium">${escapeHtml(fact.value)}</td>
              <td class="font-tabular text-xs whitespace-nowrap">${
                srcHref
                  ? `<a href="${escapeHtml(srcHref)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-semibold text-accent hover:underline underline-offset-2"><span>${escapeHtml(extractDomain(srcHref))}</span>${renderUiSketchIcon('external', 11)}</a>`
                  : `<span class="text-ink-faint">Measured</span>`
              }</td>
            </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </section>`
      : '';

  const tocHtml = hasToc
    ? `<aside aria-label="Table of contents" class="hidden lg:block lg:col-span-4 xl:col-span-3">
      <div class="sticky top-24 rounded-xl border border-hairline bg-surface p-4 space-y-4 shadow-[var(--shadow-subtle)]">
        <p class="inline-flex items-center gap-1.5 font-tabular text-[11px] uppercase tracking-[0.13em] text-ink font-bold">
          ${renderUiSketchIcon('layers', 14)}
          <span>In This Dispatch</span>
        </p>
        <nav class="space-y-0.5">
          ${headings
            .map((h) => {
              const indent = h.level >= 3 ? 'pl-5 text-[12.5px]' : '';
              return `<a href="#${escapeHtml(h.id)}" data-toc-link class="toc-link ${indent}">${escapeHtml(h.text)}</a>`;
            })
            .join('\n          ')}
        </nav>
        <div class="pt-3.5 border-t border-hairline space-y-2.5 text-xs">
          <a href="#sources" class="flex items-center justify-between font-tabular text-ink-muted hover:text-accent transition-colors">
            <span class="inline-flex items-center gap-1.5">${renderUiSketchIcon('source', 13)}<span>Primary Sources (${post.sources_json.length})</span></span>
            <span aria-hidden="true">&darr;</span>
          </a>
          <a href="${HAMDI_LINKEDIN_URL}" target="_blank" rel="noopener noreferrer" class="flex items-center justify-between font-medium text-ink-secondary hover:text-accent transition-colors">
            <span class="inline-flex items-center gap-1.5">${renderUiSketchIcon('linkedin', 13)}<span>${escapeHtml(authorName)}</span></span>
            ${renderUiSketchIcon('external', 12)}
          </a>
        </div>
      </div>
    </aside>`
    : '';

  const tagsHtml =
    post.tags_json.length > 0
      ? `<div class="mt-10 pt-6 border-t border-hairline flex flex-wrap items-center gap-2">
      <span class="font-tabular text-[11px] uppercase tracking-[0.12em] text-ink-faint mr-1">Filed under:</span>
      ${post.tags_json
        .map(
          (tag) =>
            `<a href="/blog?q=${encodeURIComponent(tag)}" class="rel-chip">${escapeHtml(tag)}</a>`,
        )
        .join('')}
    </div>`
      : '';

  const faqHtml =
    post.faq_json.length > 0
      ? `<section id="faq" aria-labelledby="faq-heading" class="mt-14 pt-8 double-rule-top">
      <p class="inline-flex items-center gap-1.5 font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">
        ${renderUiSketchIcon('qa', 14)}
        <span>Reader Q&amp;A</span>
      </p>
      <h2 id="faq-heading" class="font-masthead text-2xl sm:text-3xl font-bold text-ink mt-1 mb-5">Frequently Asked Questions</h2>
      <div>
        ${post.faq_json
          .map(
            (item, idx) => `<details class="faq-item"${idx === 0 ? ' open' : ''}>
          <summary>${escapeHtml(item.question)}</summary>
          <div class="faq-answer">${escapeHtml(item.answer)}</div>
        </details>`,
          )
          .join('')}
      </div>
    </section>`
      : '';

  // Crafted Numbered Bibliography Cards (Replaces raw wrapping URL dump)
  const sourcesHtml =
    post.sources_json.length > 0
      ? `<section id="sources" aria-labelledby="sources-heading" class="mt-14 pt-8 double-rule-top scroll-mt-24">
      <div class="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <p class="inline-flex items-center gap-1.5 font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">
            ${renderUiSketchIcon('source', 14)}
            <span>Bibliography &amp; Verification</span>
          </p>
          <h2 id="sources-heading" class="font-masthead text-2xl sm:text-3xl font-bold text-ink mt-1">Primary Sources &amp; References</h2>
        </div>
        <span class="font-tabular text-xs font-semibold px-2.5 py-1 rounded-md bg-subtle border border-hairline text-ink-secondary">${post.sources_json.length} cited sources</span>
      </div>
      <ol class="grid grid-cols-1 gap-2.5 list-none p-0 m-0">
        ${post.sources_json
          .map((src, idx) => {
            const href = safeHref(src, '#');
            const stamp = String(idx + 1).padStart(2, '0');
            const { host, pathPreview } = formatSourcePathLabel(src);
            return `<li>
          <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(src)}" class="ref-card group">
            <span class="ref-stamp">[${stamp}]</span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2 font-tabular text-[11px] font-bold uppercase tracking-[0.06em] text-ink">
                <span>${escapeHtml(host)}</span>
              </span>
              <span class="block text-xs sm:text-[13px] text-ink-muted group-hover:text-accent transition-colors truncate mt-0.5 font-tabular">${escapeHtml(pathPreview)}</span>
            </span>
            <span class="inline-flex items-center gap-1 font-tabular text-[11px] font-semibold text-ink-muted group-hover:text-accent shrink-0 self-center">
              <span class="hidden sm:inline">Source</span>
              ${renderUiSketchIcon('external', 13)}
            </span>
          </a>
        </li>`;
          })
          .join('\n        ')}
      </ol>
    </section>`
      : '';

  // Bottom Creator & Co-Work Card featuring the Py emblem & Hamdi Soudani's LinkedIn
  const authorCardHtml = `<section aria-label="About the authors" class="field-note mt-12 p-6 sm:p-7">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
      <div class="flex items-start gap-4">
        <div class="hidden sm:block shrink-0 mt-0.5">
          ${renderMastheadNibSvg(48)}
        </div>
        <div class="space-y-2">
          <p class="inline-flex items-center gap-1.5 font-tabular text-[11px] uppercase tracking-[0.12em] text-accent font-bold">
            ${renderUiSketchIcon('pen', 14)}
            <span>Human &times; Agent Co-Work</span>
          </p>
          <h2 class="font-masthead text-xl sm:text-2xl font-bold text-ink">
            ${escapeHtml(authorName)} <span class="text-ink-muted font-normal text-base sm:text-lg">&middot; in collaboration with Pyvren</span>
          </h2>
          <p class="text-sm text-ink-secondary leading-relaxed max-w-2xl">
            ${escapeHtml(
              settings.author_bio ||
                'Systems engineer & technical writer exploring AI infrastructure, security, and edge craft in daily collaboration with Pyvren.',
            )}
          </p>
        </div>
      </div>
      <div class="shrink-0">
        <a href="${HAMDI_LINKEDIN_URL}" target="_blank" rel="noopener noreferrer" class="btn-accent rounded-lg px-5 py-2.5 text-xs sm:text-sm">
          ${renderUiSketchIcon('linkedin', 15)}
          <span>Connect on LinkedIn</span>
        </a>
      </div>
    </div>
    <div class="mt-4 pt-4 border-t border-hairline flex flex-wrap items-center gap-4 text-xs text-ink-muted">
      <a href="${HAMDI_LINKEDIN_URL}" target="_blank" rel="noopener noreferrer" class="font-semibold text-ink hover:text-accent underline underline-offset-2">linkedin.com/in/hamdisoudani</a>
      <span aria-hidden="true">&middot;</span>
      <a href="/about" class="hover:text-accent">About the Co-Work</a>
      <span aria-hidden="true">&middot;</span>
      <a href="/contact" class="hover:text-accent">Send a note or correction</a>
    </div>
  </section>`;

  // Related Stories (Swipeable Mobile Carousel -> 3-Col Desktop Grid)
  const relatedHtml =
    relationships.length > 0
      ? `<section aria-labelledby="related-heading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-8 double-rule-top" data-carousel-root>
      <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p class="inline-flex items-center gap-1.5 font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">
            ${renderUiSketchIcon('spark', 14)}
            <span>Keep Reading</span>
          </p>
          <h2 id="related-heading" class="font-masthead text-2xl sm:text-3xl font-bold text-ink mt-1">Related Dispatches</h2>
        </div>
        <a href="/category/${encodeURIComponent(post.category_slug)}" class="font-tabular text-xs font-semibold text-ink-muted hover:text-accent transition-colors">More in ${escapeHtml(categoryName)} &rarr;</a>
      </div>
      <div class="mobile-carousel md:grid md:grid-cols-3 md:gap-6" data-carousel-track>
        ${relationships
          .map((rel) =>
            renderVisualStoryCard({
              post: rel.post,
              defaultAuthor: settings.default_author || 'Hamdi Soudani',
              reasonBadge: rel.reasonLabel,
              loading: 'lazy',
              slideWrapper: true,
            }),
          )
          .join('\n')}
      </div>
      ${renderMobileCarouselControls(relationships.length, 'related story')}
    </section>`
      : '';

  const mobileQuickTocHtml = hasToc
    ? `<details class="mt-6 lg:hidden rounded-xl border border-hairline bg-surface p-4">
        <summary class="font-tabular text-xs uppercase tracking-[0.1em] font-semibold text-ink cursor-pointer flex items-center justify-between">
          <span class="inline-flex items-center gap-1.5">${renderUiSketchIcon('layers', 14)}<span>Jump to section (${headings.length})</span></span>
          <span class="text-accent">+</span>
        </summary>
        <nav class="mt-3 pt-3 border-t border-hairline space-y-2 text-sm">
          ${headings
            .map(
              (h) =>
                `<a href="#${escapeHtml(h.id)}" class="block text-ink-secondary hover:text-accent ${h.level >= 3 ? 'pl-4 text-xs' : 'font-medium'}">${escapeHtml(h.text)}</a>`,
            )
            .join('\n')}
        </nav>
      </details>`
    : '';

  const articleBody = `<article class="pt-6 sm:pt-10" data-post-category="${escapeHtml(post.category_slug)}">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <nav aria-label="Breadcrumb" class="mb-5 flex flex-wrap items-center gap-2 font-tabular text-xs text-ink-faint">
      <a href="/" class="hover:text-ink transition-colors">Home</a>
      <span aria-hidden="true">/</span>
      <a href="/blog" class="hover:text-ink transition-colors">Dispatches</a>
      <span aria-hidden="true">/</span>
      <a href="/category/${encodeURIComponent(post.category_slug)}" class="hover:text-ink transition-colors">${escapeHtml(categoryName)}</a>
    </nav>

    <header class="max-w-4xl pb-7 border-b border-strong space-y-4 sm:space-y-5">
      <div class="flex flex-wrap items-center gap-2.5">
        <a href="/category/${encodeURIComponent(post.category_slug)}" class="topic-tone inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-hairline bg-surface font-tabular text-[11px] font-bold uppercase tracking-[0.08em] topic-accent-text shadow-[2px_2px_0_0_var(--border-hairline)]" style="--topic-light:${catMeta.color}; --topic-dark:${catMeta.darkColor};">
          ${renderTopicSketchIcon(post.category_slug, 16)}
          <span>${escapeHtml(categoryName)}</span>
        </a>
        <span class="badge-editorial">${escapeHtml(formatArchetype(post.archetype))}</span>
      </div>

      <h1 class="font-masthead text-2xl sm:text-4xl lg:text-[2.85rem] font-bold leading-[1.1] text-ink">
        ${escapeHtml(post.title)}
      </h1>

      <p class="text-base sm:text-[1.15rem] text-ink-secondary leading-relaxed">
        ${escapeHtml(post.description)}
      </p>

      <div class="pt-1 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <a href="${HAMDI_LINKEDIN_URL}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 font-semibold text-ink hover:text-accent transition-colors">
            ${renderUiSketchIcon('pen', 13)}
            <span>${escapeHtml(coWorkByline)}</span>
          </a>
          <span class="text-ink-faint" aria-hidden="true">&middot;</span>
          <span class="inline-flex items-center gap-1.5 font-tabular">
            ${renderUiSketchIcon('calendar', 13)}
            <time datetime="${escapeHtml(publishedIso)}">${escapeHtml(formatDate(publishedIso))}</time>
          </span>
          ${
            showUpdated
              ? `<span class="text-ink-faint" aria-hidden="true">&middot;</span><span class="font-tabular">Updated <time datetime="${escapeHtml(updatedIso)}">${escapeHtml(formatDate(updatedIso))}</time></span>`
              : ''
          }
          <span class="text-ink-faint" aria-hidden="true">&middot;</span>
          <span class="inline-flex items-center gap-1.5 font-tabular">
            ${renderUiSketchIcon('clock', 13)}
            <span>${post.reading_time_minutes} min read</span>
          </span>
          <span class="text-ink-faint" aria-hidden="true">&middot;</span>
          <a href="#sources" class="inline-flex items-center gap-1.5 font-tabular hover:text-accent transition-colors">
            ${renderUiSketchIcon('source', 13)}
            <span>${post.sources_json.length} sources</span>
          </a>
        </div>
      </div>
    </header>

    ${heroVisualHtml}

    <div class="max-w-4xl">
      ${tldrHtml}
      ${keyFactsHtml}
      ${mobileQuickTocHtml}
      ${renderAdSlot(settings, 'Advertisement')}
    </div>

    <div class="mt-9 grid grid-cols-1 ${hasToc ? 'lg:grid-cols-12 gap-10 xl:gap-12' : ''} items-start">
      <div class="${hasToc ? 'lg:col-span-8 xl:col-span-9' : 'max-w-4xl'} min-w-0">
        <div class="prose-editorial max-w-[74ch]">
          ${renderedProseHtml}
        </div>
        <div class="max-w-[74ch]">
          ${referenceGalleryHtml}
          ${tagsHtml}
          ${faqHtml}
          ${sourcesHtml}
          ${authorCardHtml}
        </div>
      </div>

      ${tocHtml}
    </div>
  </div>

  ${relatedHtml}
  ${renderCtaStrip(settings)}
</article>`;

  const baseUrl = normalizeBaseUrl(settings.base_url);
  const siteName = settings.site_name || 'The Pyvren Dispatch';
  const postUrl = `${baseUrl}/blog/${encodeURIComponent(post.slug)}`;
  const postOgImageUrl = hasRealCover
    ? post.cover_image_url!.trim()
    : `${baseUrl}/og/${encodeURIComponent(post.slug)}.svg`;

  const combinedKeywords: string[] = [];
  const seenKeywords = new Set<string>();
  for (const raw of [...(post.keywords_json || []), ...(post.tags_json || [])]) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seenKeywords.has(key)) continue;
    seenKeywords.add(key);
    combinedKeywords.push(trimmed);
  }

  const jsonLd: unknown[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: post.title,
      description: post.description,
      image: postOgImageUrl,
      datePublished: publishedIso,
      dateModified: updatedIso || publishedIso,
      wordCount: post.word_count,
      articleSection: categoryName,
      keywords: combinedKeywords.join(', '),
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': postUrl,
      },
      author: {
        '@type': 'Person',
        name: authorName,
        url: HAMDI_LINKEDIN_URL,
        sameAs: [HAMDI_LINKEDIN_URL],
      },
      publisher: {
        '@type': 'Organization',
        name: siteName,
        url: `${baseUrl}/`,
      },
      citation: post.sources_json,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}/` },
        { '@type': 'ListItem', position: 2, name: 'Dispatches', item: `${baseUrl}/blog` },
        {
          '@type': 'ListItem',
          position: 3,
          name: categoryName,
          item: `${baseUrl}/category/${encodeURIComponent(post.category_slug)}`,
        },
        { '@type': 'ListItem', position: 4, name: post.title, item: postUrl },
      ],
    },
  ];

  if (post.faq_json.length > 0) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: post.faq_json.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    });
  }

  return renderPublicLayout({
    title: `${post.title} — ${siteName}`,
    description: post.description,
    canonicalUrl: postUrl,
    settings,
    ogType: 'article',
    ogImageUrl: postOgImageUrl,
    publishedAt: publishedIso,
    updatedAt: updatedIso,
    author: authorName,
    keywords: combinedKeywords,
    jsonLd,
    currentPath: `/blog/${post.slug}`,
    markdownAlternateUrl: `${baseUrl}${markdownUrl}`,
    initialTheme,
    bodyHtml: articleBody,
  });
}

/* ==========================================================================
   4. Trust & Compliance Pages (About, Editorial Policy, Privacy, Contact)
   ========================================================================== */

export function renderTrustPage(opts: {
  settings: SiteSettings;
  kind: 'about' | 'privacy' | 'contact' | 'editorial-policy';
  initialTheme?: 'light' | 'dark';
}): string {
  const { settings, kind, initialTheme } = opts;
  const siteName = settings.site_name || 'The Pyvren Dispatch';
  const author = settings.default_author || 'Hamdi Soudani';
  const authorBio =
    settings.author_bio ||
    'Systems engineer & technical writer exploring AI infrastructure, security, and edge craft in daily collaboration with Pyvren.';
  const contactEmail = settings.contact_email || 'editorial@pyvren.com';
  const mailtoHref = safeHref(`mailto:${contactEmail}`, `mailto:${contactEmail}`);

  const configs: Record<
    'about' | 'privacy' | 'contact' | 'editorial-policy',
    { eyebrow: string; title: string; lead: string; bodyHtml: string }
  > = {
    about: {
      eyebrow: 'About the Co-Work',
      title: `About ${siteName}`,
      lead:
        settings.site_tagline ||
        'Field notes, benchmarks, and deep dives into AI systems, security, and cloud craft — co-crafted by Hamdi Soudani & Pyvren.',
      bodyHtml: `
        <h2>Why We Built ${escapeHtml(siteName)}</h2>
        <p>${escapeHtml(siteName)} is an engineering publication for builders who care about real numbers, reproducible configurations, and primary sources. Instead of rehashing press releases, every piece digs into official advisories, benchmark repositories, changelogs, and technical papers.</p>

        <h2>Human &times; Agent Collaboration</h2>
        <p><strong>Creator &amp; Editor:</strong> <a href="${HAMDI_LINKEDIN_URL}" target="_blank" rel="noopener noreferrer">${escapeHtml(author)}</a> — in daily collaboration with <strong>Pyvren</strong> (symbolized in our sketchbook margin art by <em>Py</em> the Python snake and <em>Vren</em> the spectacled Wren).</p>
        <p>${escapeHtml(authorBio)}</p>
        <p>We believe the best technical writing happens when human engineering taste and skepticism guide deep research tools. Pyvren helps gather primary documentation, benchmark data, and visual figures; ${escapeHtml(author)} shapes the editorial bar, standards, and accountability.</p>

        <h2>Connect with ${escapeHtml(author)}</h2>
        <p>Want to collaborate, discuss AI systems &amp; edge architecture, or share feedback on a dispatch? Connect directly on LinkedIn at <a href="${HAMDI_LINKEDIN_URL}" target="_blank" rel="noopener noreferrer">linkedin.com/in/hamdisoudani</a> or write to <a href="${escapeHtml(mailtoHref)}">${escapeHtml(contactEmail)}</a>.</p>
      `,
    },

    'editorial-policy': {
      eyebrow: 'Editorial Craft',
      title: 'Editorial & Verification Standards',
      lead:
        'How we research, fact-check, and co-craft every technical dispatch before publication.',
      bodyHtml: `
        <h2>1. Primary Sources First</h2>
        <p>Every story published on ${escapeHtml(siteName)} links directly to its primary sources: vendor security advisories, CVE records, upstream commits, academic papers, and reproducible benchmark repositories.</p>

        <h2>2. Practical Engineering Honesty</h2>
        <p>We test ideas against real operational constraints — latency budgets, memory ceilings, token costs, and security boundaries — and always document when <em>not</em> to adopt a tool or pattern.</p>

        <h2>3. Transparent Human + AI Co-Creation</h2>
        <p>${escapeHtml(siteName)} pairs ${escapeHtml(author)}’s editorial direction with Pyvren’s research and verification workflow. Every draft is checked for source grounding, concrete metrics, defensive safety, and clear prose before going live.</p>

        <h2>4. Corrections &amp; Updates</h2>
        <p>When upstream versions or benchmarks change, we update stories promptly and display the revision date. Spot something that needs an update? Reach out via <a href="${escapeHtml(mailtoHref)}">${escapeHtml(contactEmail)}</a> or <a href="${HAMDI_LINKEDIN_URL}" target="_blank" rel="noopener noreferrer">LinkedIn</a>.</p>

        <h2>5. Editorial Independence</h2>
        <p>Editorial opinions and benchmark conclusions are completely independent of any sponsorship or programmatic advertising.</p>
      `,
    },

    privacy: {
      eyebrow: 'Reader Privacy',
      title: 'Privacy & Cookie Policy',
      lead: `How ${siteName} respects your privacy, remembers your reading theme, and handles advertising disclosures.`,
      bodyHtml: `
        <h2>1. Minimal Data Collection</h2>
        <p>You can read all stories on ${escapeHtml(siteName)} without creating an account. Standard server logs (such as anonymized IP rate-limiting for search protection and HTTP status codes) are processed transiently on the edge to keep the site fast and reliable.</p>

        <h2>2. Theme Preference Cookie &amp; Storage</h2>
        <ul>
          <li><strong>Light / Dark Mode:</strong> When you switch between warm paper and dark mode, we save your preference in <code>localStorage</code> (<code>pyvren-theme</code>) and a first-party cookie (<code>pyvren_theme</code>) so pages render immediately in your chosen theme without flashing.</li>
          <li><strong>Editorial Session Cookie:</strong> Strictly necessary <code>HttpOnly</code> session cookies are used only for the site owner.</li>
        </ul>

        <h2>3. Google AdSense &amp; Advertising Partners</h2>
        <p>When advertising is enabled on ${escapeHtml(siteName)}, Google AdSense and certified vendors may use cookies to display contextual or personalized ads:</p>
        <ul>
          <li>You can manage or opt out of personalized Google ads anytime at <a href="https://myadcenter.google.com/" target="_blank" rel="noopener noreferrer">Google My Ad Center</a> or <a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer">aboutads.info</a>.</li>
        </ul>

        <h2>4. Contact</h2>
        <p>For any privacy questions, email <a href="${escapeHtml(mailtoHref)}">${escapeHtml(contactEmail)}</a>.</p>
      `,
    },

    contact: {
      eyebrow: 'Say Hello',
      title: `Contact ${siteName}`,
      lead:
        'Reach out for collaborations, story tips, factual corrections, or engineering conversations.',
      bodyHtml: `
        <h2>Connect Directly</h2>
        <ul>
          <li><strong>LinkedIn:</strong> <a href="${HAMDI_LINKEDIN_URL}" target="_blank" rel="noopener noreferrer">Hamdi Soudani (linkedin.com/in/hamdisoudani)</a></li>
          <li><strong>Email:</strong> <a href="${escapeHtml(mailtoHref)}">${escapeHtml(contactEmail)}</a></li>
        </ul>

        <h2>Story Tips &amp; Corrections</h2>
        <p>Spotted an updated benchmark, a newly patched CVE, or an inaccuracy in a published piece? Send over the article link and primary source — we appreciate sharp-eyed readers and update dispatches quickly.</p>
      `,
    },
  };

  const page = configs[kind];
  const baseUrl = normalizeBaseUrl(settings.base_url);
  const path = `/${kind}`;

  const trustBody = `<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
  <header class="pb-8 border-b border-strong space-y-4">
    <p class="inline-flex items-center gap-2 font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">
      ${renderUiSketchIcon('pen', 15)}
      <span>${escapeHtml(page.eyebrow)}</span>
    </p>
    <h1 class="font-masthead text-3xl sm:text-5xl font-bold text-ink leading-[1.08]">${escapeHtml(page.title)}</h1>
    <p class="text-base sm:text-lg text-ink-secondary leading-relaxed">${escapeHtml(page.lead)}</p>
  </header>

  <div class="mt-10 prose-editorial max-w-[72ch]">
    ${page.bodyHtml}
  </div>

  <div class="field-note mt-12 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div class="flex items-center gap-3.5">
      ${renderMastheadNibSvg(42)}
      <div>
        <p class="font-masthead text-lg font-bold text-ink">${escapeHtml(author)} &middot; Co-crafted with Pyvren</p>
        <p class="text-xs sm:text-sm text-ink-muted">Follow new dispatches or connect directly on LinkedIn.</p>
      </div>
    </div>
    <a href="${HAMDI_LINKEDIN_URL}" target="_blank" rel="noopener noreferrer" class="btn-accent rounded-lg px-5 text-xs sm:text-sm shrink-0">
      ${renderUiSketchIcon('linkedin', 15)}
      <span>Connect on LinkedIn</span>
    </a>
  </div>

  <div class="mt-8 pt-6 border-t border-hairline flex flex-wrap items-center gap-4 font-tabular text-xs text-ink-muted">
    <a href="/about" class="hover:text-accent ${kind === 'about' ? 'text-accent font-semibold' : ''}">About</a>
    <span aria-hidden="true">&middot;</span>
    <a href="/editorial-policy" class="hover:text-accent ${kind === 'editorial-policy' ? 'text-accent font-semibold' : ''}">Editorial Standards</a>
    <span aria-hidden="true">&middot;</span>
    <a href="/privacy" class="hover:text-accent ${kind === 'privacy' ? 'text-accent font-semibold' : ''}">Privacy</a>
    <span aria-hidden="true">&middot;</span>
    <a href="/contact" class="hover:text-accent ${kind === 'contact' ? 'text-accent font-semibold' : ''}">Contact</a>
  </div>
</div>`;

  return renderPublicLayout({
    title: `${page.title} — ${siteName}`,
    description: page.lead,
    canonicalUrl: `${baseUrl}${path}`,
    settings,
    ogType: 'website',
    currentPath: path,
    initialTheme,
    bodyHtml: trustBody,
  });
}

/* ==========================================================================
   5. 404 Not Found Page
   ========================================================================== */

export function renderNotFoundPage(opts: {
  settings: SiteSettings;
  initialTheme?: 'light' | 'dark';
}): string {
  const siteName = opts.settings.site_name || 'The Pyvren Dispatch';
  const baseUrl = normalizeBaseUrl(opts.settings.base_url);
  const notFoundBody = `<div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 text-center space-y-6">
  <div class="mx-auto w-48 h-32">
    ${renderTopicCrewSvg('agentic-browser-web-data', '404')}
  </div>
  <p class="inline-flex items-center gap-2 font-tabular text-xs uppercase tracking-[0.16em] text-accent font-semibold">
    ${renderUiSketchIcon('spark', 14)}
    <span>404 &middot; Off the Map</span>
  </p>
  <h1 class="font-masthead text-3xl sm:text-5xl font-bold text-ink">We couldn’t find that dispatch</h1>
  <p class="text-base text-ink-muted max-w-lg mx-auto leading-relaxed">
    Py searched every shelf of ${escapeHtml(siteName)}, but this story may have moved or the link has a typo.
  </p>
  <div class="pt-2 flex flex-wrap items-center justify-center gap-3">
    <a href="/" class="btn-accent rounded-lg px-5">Back to Home</a>
    <a href="/blog" class="btn-ghost rounded-lg px-5">Browse All Dispatches</a>
  </div>
</div>`;

  return renderPublicLayout({
    title: `Page Not Found — ${siteName}`,
    description: `The requested page could not be found on ${siteName}.`,
    canonicalUrl: `${baseUrl}/404`,
    settings: opts.settings,
    ogType: 'website',
    robotsMeta: 'noindex, follow',
    initialTheme: opts.initialTheme,
    bodyHtml: notFoundBody,
  });
}
