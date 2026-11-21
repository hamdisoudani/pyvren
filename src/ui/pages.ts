import { normalizeBaseUrl } from '../env';
import {
  buildTopicClusters,
  computePostRelationships,
  getCategoryMeta,
  type PostRelationship,
  type TopicCluster,
} from '../lib/relations';
import { escapeHtml } from '../lib/security';
import type { Archetype, CategorySkill, PostRecord, SiteSettings } from '../types';
import { renderPublicLayout } from './layout';

const ARCHETYPE_LABELS: Record<Archetype, string> = {
  'advisory-teardown': 'Advisory Teardown',
  'benchmark-index': 'Benchmark Index',
  'migration-fix-log': 'Migration & Fix Log',
  'architecture-analysis': 'Architecture Analysis',
};

function formatArchetype(archetype: string): string {
  return ARCHETYPE_LABELS[archetype as Archetype] || archetype.replace(/-/g, ' ');
}

function formatDate(iso?: string | null): string {
  if (!iso) return 'Unpublished';
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
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
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

function truncateText(text: string, maxLen: number): string {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
}

function extractKeySignals(post: PostRecord, maxCount = 3): Array<{ label?: string; text: string }> {
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

function scoreToneColor(score: number): string {
  if (score >= 85) return 'var(--success)';
  if (score >= 70) return 'var(--warning)';
  return 'var(--danger)';
}

function renderScoreBadge(score: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(score || 0)));
  const toneClass =
    clamped >= 85 ? 'badge-success' : clamped >= 70 ? 'badge-warning' : 'badge-danger';
  return `<span class="badge-editorial ${toneClass}" title="Editorial verification &amp; citation score">QS ${clamped}/100</span>`;
}

function renderScoreRing(score: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(score || 0)));
  const color = scoreToneColor(clamped);
  return `<div class="score-ring" style="--score-pct:${clamped}%;--score-color:${color}" aria-label="Quality score ${clamped} out of 100" title="Editorial quality score: ${clamped}/100">
  <span class="score-ring-value">${clamped}</span>
</div>`;
}

function renderCategoryTag(slug: string, customLabel?: string, asLink = true): string {
  const meta = getCategoryMeta(slug);
  const label = customLabel || meta.shortLabel;
  const inner = `<span class="cat-dot" style="--cat-color:${meta.color}" aria-hidden="true"></span><span>${escapeHtml(label)}</span>`;
  const classes =
    'inline-flex items-center gap-1.5 font-tabular text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-secondary hover:text-accent transition-colors';
  if (asLink) {
    return `<a href="/category/${encodeURIComponent(slug)}" class="${classes}">${inner}</a>`;
  }
  return `<span class="${classes}">${inner}</span>`;
}

function renderAdSlot(settings: SiteSettings, slotLabel = 'Advertisement'): string {
  const clientId = (settings.adsense_client_id || '').trim();
  if (!clientId) return '';
  return `<aside class="ad-slot rounded-[10px]" aria-label="${escapeHtml(slotLabel)}">
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
  const headline = settings.cta_headline || 'Follow verified engineering briefings';
  const body =
    settings.cta_body ||
    'Subscribe via RSS or integrate our structured JSON and Markdown endpoints directly into your engineering workflow.';
  const ctaUrl = safeHref(settings.cta_url || '/rss.xml', '/rss.xml');
  const isExternal = ctaUrl.startsWith('http://') || ctaUrl.startsWith('https://');

  return `<section class="mt-16 border-t border-b border-hairline bg-subtle/60">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
    <div class="max-w-2xl space-y-2.5">
      <p class="inline-flex items-center gap-2 font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">
        <span class="cat-dot" style="--cat-color:var(--accent)" aria-hidden="true"></span>
        <span>Dispatch &amp; Syndication</span>
      </p>
      <h2 class="font-masthead text-2xl sm:text-3xl font-bold text-ink leading-tight">${escapeHtml(headline)}</h2>
      <p class="text-sm sm:text-base text-ink-muted leading-relaxed">${escapeHtml(body)}</p>
    </div>
    <div class="flex flex-wrap items-center gap-3 shrink-0">
      <a href="${escapeHtml(ctaUrl)}"${isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''} class="btn-accent rounded-full px-5">
        <span>Explore Dispatch</span>
        <span aria-hidden="true">&rarr;</span>
      </a>
      <a href="/rss.xml" class="btn-ghost rounded-full font-tabular text-xs">RSS Feed</a>
      <a href="/llms.txt" class="btn-ghost rounded-full font-tabular text-xs">llms.txt</a>
    </div>
  </div>
</section>`;
}

function renderTopicClusterChips(clusters: TopicCluster[], limit = 10): string {
  if (clusters.length === 0) return '';
  return clusters
    .slice(0, limit)
    .map(
      (cluster) => `<a href="/blog?q=${encodeURIComponent(cluster.query)}" class="rel-chip">
      <span class="cat-dot" style="--cat-color:${cluster.color}" aria-hidden="true"></span>
      <span>${escapeHtml(cluster.label)}</span>
      <span class="font-tabular text-[10px] text-ink-faint">${cluster.count}</span>
    </a>`,
    )
    .join('\n');
}

function renderVisualStoryCard(opts: {
  post: PostRecord;
  skills?: CategorySkill[];
  topRelation?: PostRelationship | null;
  reasonBadge?: string;
  loading?: 'lazy' | 'eager';
}): string {
  const { post, topRelation, reasonBadge, loading = 'lazy' } = opts;
  const meta = getCategoryMeta(post.category_slug);
  const postHref = `/blog/${encodeURIComponent(post.slug)}`;
  const ogSrc = `/og/${encodeURIComponent(post.slug)}.svg`;
  const sourceCount = Array.isArray(post.sources_json) ? post.sources_json.length : 0;

  const relationFooterHtml = reasonBadge
    ? `<div class="pt-2">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-subtle text-ink-secondary border border-hairline max-w-full truncate">
          <span class="cat-dot" style="--cat-color:${meta.color}" aria-hidden="true"></span>
          <span class="truncate">${escapeHtml(reasonBadge)}</span>
        </span>
      </div>`
    : topRelation && topRelation.score > 0
      ? `<div class="pt-2">
          <a href="/blog/${encodeURIComponent(topRelation.post.slug)}" class="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-muted hover:text-accent transition-colors max-w-full truncate" title="${escapeHtml(topRelation.reasonLabel)}">
            <span class="text-accent shrink-0" aria-hidden="true">&nearr;</span>
            <span class="truncate">Linked: ${escapeHtml(truncateText(topRelation.post.title, 38))}</span>
          </a>
        </div>`
      : `<div class="pt-2 font-tabular text-[11px] text-ink-faint">
          <span>${sourceCount} verified primary ${sourceCount === 1 ? 'source' : 'sources'}</span>
        </div>`;

  return `<article class="story-card group flex flex-col overflow-hidden">
  <a href="${postHref}" class="block relative overflow-hidden bg-subtle border-b border-hairline">
    <img src="${ogSrc}" alt="${escapeHtml(post.title)}" width="1200" height="630" loading="${loading}" class="w-full aspect-[1200/630] object-cover block transition-transform duration-300 group-hover:scale-[1.03]">
  </a>

  <div class="p-5 flex-1 flex flex-col justify-between gap-4">
    <div class="space-y-2.5">
      <div class="flex items-center justify-between gap-2">
        ${renderCategoryTag(post.category_slug)}
        ${renderScoreBadge(post.quality_score)}
      </div>

      <h3 class="font-editorial text-[1.22rem] font-semibold leading-[1.25] text-ink">
        <a href="${postHref}" class="hover:text-accent transition-colors">${escapeHtml(post.title)}</a>
      </h3>

      <p class="text-sm text-ink-muted leading-relaxed line-clamp-2">${escapeHtml(post.description)}</p>
      ${relationFooterHtml}
    </div>

    <div class="pt-3.5 border-t border-hairline flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 font-tabular text-[11px] text-ink-faint min-w-0 truncate">
        <time datetime="${escapeHtml(post.published_at || post.created_at)}">${escapeHtml(formatDate(post.published_at || post.created_at))}</time>
        <span aria-hidden="true">&middot;</span>
        <span>${post.reading_time_minutes || 1} min read</span>
      </div>
      <a href="${postHref}" class="inline-flex items-center justify-center w-8 h-8 rounded-full border border-hairline bg-paper text-ink-secondary group-hover:bg-[var(--accent)] group-hover:border-[var(--accent)] group-hover:text-white transition-colors shrink-0" aria-label="Read ${escapeHtml(post.title)}">
        <span aria-hidden="true">&rarr;</span>
      </a>
    </div>
  </div>
</article>`;
}

/* ==========================================================================
   1. Landing Page — Editorial Broadsheet + Smart AI Tech Publication
   ========================================================================== */

export function renderLandingPage(opts: {
  settings: SiteSettings;
  featuredPost: PostRecord | null;
  recentPosts: PostRecord[];
  skills: CategorySkill[];
}): string {
  const { settings, featuredPost, recentPosts, skills } = opts;
  const enabledSkills = skills.filter((s) => s.enabled);
  const siteName = settings.site_name || 'Pyvren';
  const tagline =
    settings.site_tagline ||
    'Primary-source technical briefings, security teardowns, and benchmark dossiers built for engineers and citation-grade retrieval.';

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

  // Pick spotlight post (highest quality_score, defaulting to leadPost)
  const spotlightPost =
    pool.length > 0
      ? pool.reduce((best, curr) => ((curr.quality_score || 0) > (best.quality_score || 0) ? curr : best), pool[0])
      : null;

  // Grid posts for 3-column visual story cards
  const gridCandidates =
    otherPosts.length >= 4
      ? otherPosts.slice(1, 10)
      : otherPosts.length > 0
        ? otherPosts.slice(0, 9)
        : pool.slice(0, 3);

  const topicClusters = buildTopicClusters(pool, skills);
  const leadRelations = leadPost ? computePostRelationships(leadPost, pool, 3) : [];

  // 1. Smart Command Search & Category Strip (PinVpn inspired)
  const categoryPillsHtml = enabledSkills
    .map((skill) => {
      const meta = getCategoryMeta(skill.slug);
      return `<a href="/category/${encodeURIComponent(skill.slug)}" class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface border border-hairline hover:border-strong hover:text-accent text-xs font-medium text-ink-secondary transition-all">
        <span class="cat-dot" style="--cat-color:${meta.color}" aria-hidden="true"></span>
        <span>${escapeHtml(meta.shortLabel)}</span>
      </a>`;
    })
    .join('\n');

  const commandHeroHtml = `<section class="border-b border-hairline bg-paper">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-10 sm:pt-10 sm:pb-12">
    <div class="max-w-3xl mx-auto text-center space-y-4">
      <p class="inline-flex items-center gap-2 font-tabular text-[11px] uppercase tracking-[0.14em] text-ink-muted font-semibold">
        <span class="cat-dot" style="--cat-color:var(--accent)" aria-hidden="true"></span>
        <span>Automated AI-Tech Intelligence Desk</span>
      </p>
      <h1 class="font-masthead text-3xl sm:text-5xl font-bold leading-[1.08] text-ink">
        Latest Briefings &amp; <span class="text-accent">Technical Guides</span>
      </h1>
      <p class="text-sm sm:text-base text-ink-secondary leading-relaxed max-w-2xl mx-auto">
        ${escapeHtml(tagline)}
      </p>

      <!-- Elevated Command Search Bar Card -->
      <div class="pt-2">
        <form method="GET" action="/blog" role="search" class="max-w-2xl mx-auto p-1.5 sm:p-2 rounded-full bg-surface border border-hairline shadow-[var(--shadow-subtle)] focus-within:border-[var(--accent)] focus-within:shadow-[var(--shadow-lift)] transition-all flex items-center gap-2">
          <span class="pl-3.5 text-ink-faint shrink-0" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
          </span>
          <label for="home-search-input" class="sr-only">Search briefings, CVEs, benchmarks, or protocols</label>
          <input id="home-search-input" type="search" name="q" placeholder="Search briefings, MCP benchmarks, CVEs, GPU math..." class="w-full bg-transparent border-0 text-sm text-ink placeholder:text-ink-faint focus:outline-none py-2">
          <button type="submit" class="btn-accent rounded-full px-5 py-2 text-xs sm:text-sm shrink-0">Search</button>
        </form>
      </div>

      <!-- Category Filter Pills with 6px Colored Micro-Squares -->
      <div class="pt-2 flex flex-wrap items-center justify-center gap-2" role="navigation" aria-label="Research tracks">
        <a href="/blog" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--ink-primary)] text-[var(--bg-paper)] text-xs font-semibold transition-colors hover:bg-[var(--accent)] hover:text-white">
          All Briefings
        </a>
        ${categoryPillsHtml}
      </div>

      <!-- Live Publication Telemetry Strip -->
      <div class="pt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-tabular text-[11px] uppercase tracking-[0.1em] text-ink-faint">
        <span>${pool.length} Published ${pool.length === 1 ? 'Briefing' : 'Briefings'}</span>
        <span aria-hidden="true">&middot;</span>
        <span>${enabledSkills.length} Automated Tracks</span>
        <span aria-hidden="true">&middot;</span>
        <span>Primary-Source Verified</span>
      </div>
    </div>
  </div>
</section>`;

  // 2. Front-Page Broadsheet Lead Spread (Featured Times inspired)
  let leadSpreadHtml = '';
  if (leadPost) {
    const leadMeta = getCategoryMeta(leadPost.category_slug);
    const leadSignals = extractKeySignals(leadPost, 3);
    const leadHref = `/blog/${encodeURIComponent(leadPost.slug)}`;

    const secondaryCardHtml = secondaryPost
      ? `<article class="editorial-card overflow-hidden flex flex-col">
        <a href="/blog/${encodeURIComponent(secondaryPost.slug)}" class="block overflow-hidden border-b border-hairline bg-subtle group">
          <img src="/og/${encodeURIComponent(secondaryPost.slug)}.svg" alt="${escapeHtml(secondaryPost.title)}" width="1200" height="630" loading="eager" class="w-full aspect-[1200/630] object-cover block transition-transform duration-300 group-hover:scale-[1.03]">
        </a>
        <div class="p-4 space-y-2">
          <div class="flex items-center justify-between gap-2">
            ${renderCategoryTag(secondaryPost.category_slug)}
            ${renderScoreBadge(secondaryPost.quality_score)}
          </div>
          <h3 class="font-editorial text-lg font-semibold leading-snug text-ink">
            <a href="/blog/${encodeURIComponent(secondaryPost.slug)}" class="hover:text-accent transition-colors">${escapeHtml(secondaryPost.title)}</a>
          </h3>
          <p class="text-xs text-ink-muted leading-relaxed line-clamp-2">${escapeHtml(secondaryPost.description)}</p>
          <div class="pt-2 border-t border-hairline flex items-center justify-between font-tabular text-[11px] text-ink-faint">
            <span>${escapeHtml(formatDate(secondaryPost.published_at || secondaryPost.created_at))}</span>
            <span>${secondaryPost.reading_time_minutes || 1} min read</span>
          </div>
        </div>
      </article>`
      : '';

    const wireItemsHtml =
      leadRelations.length > 0
        ? `<ul class="divide-y divide-[var(--border-hairline)]">
          ${leadRelations
            .map((rel) => {
              const relMeta = getCategoryMeta(rel.post.category_slug);
              return `<li class="py-3 first:pt-0 last:pb-0 space-y-1">
              <div class="flex items-center justify-between gap-2 font-tabular text-[10px] uppercase tracking-[0.08em]">
                <span class="inline-flex items-center gap-1.5 text-ink-muted">
                  <span class="cat-dot" style="--cat-color:${relMeta.color}" aria-hidden="true"></span>
                  <span>${escapeHtml(relMeta.shortLabel)}</span>
                </span>
                <span class="text-accent font-semibold truncate max-w-[58%]">${escapeHtml(rel.reasonLabel)}</span>
              </div>
              <a href="/blog/${encodeURIComponent(rel.post.slug)}" class="block font-editorial text-[0.98rem] font-semibold leading-snug text-ink hover:text-accent transition-colors">
                ${escapeHtml(rel.post.title)}
              </a>
            </li>`;
            })
            .join('')}
        </ul>`
        : `<p class="text-xs text-ink-muted leading-relaxed">Cross-track signal links populate automatically as new verified dossiers enter the archive.</p>`;

    leadSpreadHtml = `<section aria-labelledby="frontpage-heading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-4">
  <div class="double-rule-top pt-3 pb-4 flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-2.5">
      <span class="cat-dot" style="--cat-color:var(--accent)" aria-hidden="true"></span>
      <h2 id="frontpage-heading" class="font-tabular text-[11px] uppercase tracking-[0.14em] text-ink font-bold">Front Page &middot; Lead Dispatch</h2>
    </div>
    <span class="font-tabular text-xs text-ink-faint">${escapeHtml(formatDate(leadPost.published_at || leadPost.created_at))} &middot; ${leadPost.sources_json.length} Primary Sources</span>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
    <!-- Left 8 Columns: Lead Dossier (2-col internal split) -->
    <article class="lg:col-span-8 editorial-card p-5 sm:p-7">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        <div class="md:col-span-6 space-y-4">
          <a href="${leadHref}" class="block rounded-[10px] overflow-hidden border border-hairline bg-subtle group">
            <img src="/og/${encodeURIComponent(leadPost.slug)}.svg" alt="${escapeHtml(leadPost.title)}" width="1200" height="630" loading="eager" class="w-full aspect-[1200/630] object-cover block transition-transform duration-300 group-hover:scale-[1.02]">
          </a>
          <div class="p-3.5 rounded-[8px] bg-subtle/80 border border-hairline flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="font-tabular text-[10px] uppercase tracking-[0.12em] text-ink-faint">Editorial Audit</p>
              <p class="text-xs font-medium text-ink truncate">By ${escapeHtml(leadPost.author || settings.default_author)}</p>
            </div>
            <div class="flex items-center gap-2.5 shrink-0">
              ${renderScoreRing(leadPost.quality_score)}
              <a href="/blog/${encodeURIComponent(leadPost.slug)}.md" class="font-tabular text-[11px] text-ink-secondary hover:text-accent underline underline-offset-2">.md</a>
            </div>
          </div>
        </div>

        <div class="md:col-span-6 space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            ${renderCategoryTag(leadPost.category_slug)}
            <span class="badge-editorial">${escapeHtml(formatArchetype(leadPost.archetype))}</span>
            ${renderScoreBadge(leadPost.quality_score)}
          </div>

          <h3 class="font-masthead text-2xl sm:text-[1.85rem] font-bold leading-[1.14] text-ink">
            <a href="${leadHref}" class="hover:text-accent transition-colors">${escapeHtml(leadPost.title)}</a>
          </h3>

          <p class="text-sm text-ink-secondary leading-relaxed">${escapeHtml(leadPost.description)}</p>

          ${
            leadSignals.length > 0
              ? `<div class="pt-1 space-y-2 border-t border-hairline">
            <p class="font-tabular text-[10px] uppercase tracking-[0.12em] text-ink-faint font-semibold pt-2">Key Signals</p>
            <ul class="space-y-1.5 text-[13px] text-ink-secondary leading-snug">
              ${leadSignals
                .map(
                  (sig) => `<li class="flex items-start gap-2">
                <span class="cat-dot mt-1.5" style="--cat-color:${leadMeta.color}" aria-hidden="true"></span>
                <span>${sig.label ? `<strong class="text-ink font-semibold">${escapeHtml(sig.label)}:</strong> ` : ''}${escapeHtml(sig.text)}</span>
              </li>`,
                )
                .join('')}
            </ul>
          </div>`
              : ''
          }

          <div class="pt-3 border-t border-hairline flex flex-wrap items-center justify-between gap-3">
            <span class="font-tabular text-xs text-ink-faint">${leadPost.reading_time_minutes || 1} min read &middot; ${leadPost.word_count.toLocaleString('en-US')} words</span>
            <a href="${leadHref}" class="btn-accent rounded-full px-4 py-2 text-xs sm:text-sm">
              <span>Read Full Briefing</span>
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </div>
      </div>
    </article>

    <!-- Right 4 Columns: Secondary Lead + Live Relationship Wire -->
    <div class="lg:col-span-4 space-y-5 broadsheet-divider">
      ${secondaryCardHtml}

      <aside class="editorial-card p-5 space-y-4" aria-label="Connected Intelligence Wire">
        <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-hairline">
          <div class="flex items-center gap-2">
            <span class="cat-dot" style="--cat-color:var(--accent)" aria-hidden="true"></span>
            <h3 class="font-tabular text-[11px] uppercase tracking-[0.13em] font-bold text-ink">Connected Intelligence</h3>
          </div>
          <span class="font-tabular text-[10px] text-ink-faint">LIVE GRAPH</span>
        </div>

        ${wireItemsHtml}

        ${
          topicClusters.length > 0
            ? `<div class="pt-3 border-t border-hairline space-y-2">
          <p class="font-tabular text-[10px] uppercase tracking-[0.12em] text-ink-faint font-semibold">Trending Concepts</p>
          <div class="flex flex-wrap gap-1.5">
            ${renderTopicClusterChips(topicClusters, 6)}
          </div>
        </div>`
            : ''
        }
      </aside>
    </div>
  </div>
</section>`;
  } else {
    leadSpreadHtml = `<section aria-labelledby="frontpage-empty-heading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-4">
  <div class="double-rule-top pt-6">
    <div class="editorial-card p-8 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
      <div class="lg:col-span-7 space-y-4">
        <span class="badge-editorial badge-accent">Autonomous Desk Ready</span>
        <h2 id="frontpage-empty-heading" class="font-masthead text-3xl sm:text-4xl font-bold text-ink leading-tight">
          Six primary-source intelligence tracks on standby.
        </h2>
        <p class="text-base text-ink-secondary leading-relaxed">
          ${escapeHtml(siteName)} monitors official advisories, arXiv papers, cloud changelogs, and reproducible benchmarks—publishing only high-signal briefings that pass our deterministic audit gate.
        </p>
        <div class="pt-2 flex flex-wrap items-center gap-3">
          <a href="#categories" class="btn-accent rounded-full px-5">Explore 6 Research Tracks &rarr;</a>
          <a href="/editorial-policy" class="btn-ghost rounded-full">Editorial Verification Standard</a>
        </div>
      </div>
      <div class="lg:col-span-5 grid grid-cols-2 gap-3">
        ${enabledSkills
          .slice(0, 6)
          .map((skill) => {
            const meta = getCategoryMeta(skill.slug);
            return `<a href="/category/${encodeURIComponent(skill.slug)}" class="p-3.5 rounded-[10px] bg-subtle/80 border border-hairline hover:border-strong transition-colors space-y-1">
              <div class="flex items-center gap-1.5 font-tabular text-[10px] font-bold tracking-[0.08em]" style="color:${meta.color}">
                <span class="cat-dot" style="--cat-color:${meta.color}" aria-hidden="true"></span>
                <span>${escapeHtml(meta.shortLabel)}</span>
              </div>
              <p class="font-editorial text-sm font-semibold text-ink line-clamp-1">${escapeHtml(skill.name)}</p>
            </a>`;
          })
          .join('')}
      </div>
    </div>
  </div>
</section>`;
  }

  // 3. 3-Column Visual Story Cards Grid (PinVpn + Featured Times)
  const recentGridHtml =
    gridCandidates.length > 0
      ? `<section aria-labelledby="recent-briefings-heading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
  <div class="double-rule-top pt-4 pb-5 flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">Briefing Archive</p>
      <h2 id="recent-briefings-heading" class="font-masthead text-2xl sm:text-3xl font-bold text-ink mt-1">Recent Briefings</h2>
    </div>
    <a href="/blog" class="font-tabular text-xs font-semibold text-ink-secondary hover:text-accent transition-colors">View full archive &rarr;</a>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    ${gridCandidates
      .map((post) => {
        const topRel = computePostRelationships(post, pool, 1)[0] || null;
        return renderVisualStoryCard({ post, skills, topRelation: topRel, loading: 'lazy' });
      })
      .join('\n')}
  </div>
</section>`
      : '';

  // 4. Bold Broadsheet Editorial Spotlight Band ("THIS WEEK'S SIGNAL REPORT")
  const spotlightBandHtml = `<section aria-labelledby="spotlight-heading" class="mt-16 bg-subtle/75 border-y border-hairline">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
      <!-- Left: Giant Stacked Condensed Display Typography -->
      <div class="lg:col-span-3 flex flex-col justify-between gap-6">
        <div class="space-y-4">
          <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent)] text-white font-tabular text-[10px] font-bold uppercase tracking-[0.14em]">
            Verified Edition
          </span>
          <h2 id="spotlight-heading" class="font-condensed uppercase font-bold text-5xl sm:text-6xl leading-[0.9] tracking-tight text-ink">
            THIS WEEK&rsquo;S<br>
            <span class="text-accent">SIGNAL</span><br>
            REPORT
          </h2>
          <p class="text-sm text-ink-muted leading-relaxed">
            Our highest-scoring primary-source dossier, selected deterministically by citation density, concrete metrics, and zero-filler cleanliness.
          </p>
        </div>

        <div class="pt-4 border-t border-strong/20 font-tabular text-[11px] text-ink-faint space-y-1">
          <p class="uppercase tracking-[0.12em] text-ink-secondary font-semibold">Formats Available</p>
          <p>SSR HTML &middot; Raw .md &middot; JSON Feed 1.1 &middot; RSS 2.0</p>
        </div>
      </div>

      <!-- Middle: High-Contrast Highlight Card for Highest-Quality Briefing -->
      <div class="lg:col-span-5">
        ${
          spotlightPost
            ? `<article class="h-full rounded-[14px] bg-surface border-2 border-strong p-6 sm:p-7 flex flex-col justify-between gap-5 shadow-[var(--shadow-lift)]">
          <div class="space-y-4">
            <div class="flex items-center justify-between gap-3">
              ${renderCategoryTag(spotlightPost.category_slug)}
              ${renderScoreBadge(spotlightPost.quality_score)}
            </div>

            <h3 class="font-masthead text-2xl sm:text-[1.75rem] font-bold leading-[1.15] text-ink">
              <a href="/blog/${encodeURIComponent(spotlightPost.slug)}" class="hover:text-accent transition-colors">${escapeHtml(spotlightPost.title)}</a>
            </h3>

            ${
              spotlightPost.tldr_summary
                ? `<blockquote class="pl-4 border-l-2 border-[var(--accent)] text-sm text-ink-secondary leading-relaxed">
              ${escapeHtml(spotlightPost.tldr_summary)}
            </blockquote>`
                : `<p class="text-sm text-ink-secondary leading-relaxed">${escapeHtml(spotlightPost.description)}</p>`
            }

            ${
              spotlightPost.key_facts_json.length > 0
                ? `<dl class="divide-y divide-[var(--border-hairline)] border-t border-b border-hairline">
              ${spotlightPost.key_facts_json
                .slice(0, 3)
                .map(
                  (fact) => `<div class="py-2.5 grid grid-cols-12 gap-2 text-xs">
                <dt class="col-span-5 font-tabular text-ink-muted">${escapeHtml(fact.label)}</dt>
                <dd class="col-span-7 font-semibold text-ink">${escapeHtml(fact.value)}</dd>
              </div>`,
                )
                .join('')}
            </dl>`
                : ''
            }
          </div>

          <div class="pt-3 border-t border-hairline flex flex-wrap items-center justify-between gap-3">
            <span class="font-tabular text-xs text-ink-faint">${spotlightPost.sources_json.length} citations &middot; ${spotlightPost.reading_time_minutes || 1} min read</span>
            <a href="/blog/${encodeURIComponent(spotlightPost.slug)}" class="btn-primary rounded-full px-4 py-2 text-xs">
              <span>Read Full Dossier</span>
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </article>`
            : `<div class="h-full rounded-[14px] bg-surface border border-hairline p-6 flex flex-col justify-center gap-3">
          <p class="font-masthead text-2xl font-bold text-ink">Next Signal Report In Preparation</p>
          <p class="text-sm text-ink-muted leading-relaxed">Once the autonomous research desk completes primary-source verification, the highest-scoring briefing is spotlighted here.</p>
          <div class="pt-2">
            <a href="/editorial-policy" class="btn-ghost rounded-full text-xs">Inspect Quality Rubric &rarr;</a>
          </div>
        </div>`
        }
      </div>

      <!-- Right: Research Desk & Topic Clusters Sidebar + Conditional AdSense -->
      <div class="lg:col-span-4 flex flex-col gap-5">
        <div class="editorial-card p-5 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <p class="font-tabular text-[10px] uppercase tracking-[0.14em] text-accent font-bold">Research Desk</p>
            <a href="/about" class="font-tabular text-[11px] text-ink-muted hover:text-accent underline underline-offset-2">Masthead</a>
          </div>
          <h3 class="font-masthead text-xl font-bold text-ink">${escapeHtml(settings.default_author || 'Editorial Desk')}</h3>
          <p class="text-xs sm:text-sm text-ink-muted leading-relaxed">
            ${escapeHtml(settings.author_bio || 'Independent technical researcher and editor focusing on primary-source engineering analysis, software security, and AI infrastructure.')}
          </p>
        </div>

        <div class="editorial-card p-5 space-y-3 flex-1">
          <div class="flex items-center justify-between gap-2">
            <p class="font-tabular text-[10px] uppercase tracking-[0.14em] text-ink font-bold">Intelligence Graph &middot; Trending Concepts</p>
          </div>
          ${
            topicClusters.length > 0
              ? `<div class="flex flex-wrap gap-2">${renderTopicClusterChips(topicClusters, 10)}</div>`
              : `<div class="flex flex-wrap gap-2">
            ${enabledSkills
              .map((s) => {
                const meta = getCategoryMeta(s.slug);
                return `<a href="/category/${encodeURIComponent(s.slug)}" class="rel-chip"><span class="cat-dot" style="--cat-color:${meta.color}" aria-hidden="true"></span><span>${escapeHtml(meta.shortLabel)}</span></a>`;
              })
              .join('')}
          </div>`
          }
        </div>

        ${renderAdSlot(settings, 'Sponsored')}
      </div>
    </div>
  </div>
</section>`;

  // 5. 6 Autonomous Research Tracks + Editorial Rigor Strip
  const tracksHtml =
    enabledSkills.length > 0
      ? `<section id="categories" aria-labelledby="tracks-heading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 scroll-mt-24">
  <div class="double-rule-top pt-4 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
    <div>
      <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">Coverage Index</p>
      <h2 id="tracks-heading" class="font-masthead text-2xl sm:text-3xl font-bold text-ink mt-1">Autonomous Research Tracks</h2>
    </div>
    <a href="/blog" class="font-tabular text-xs font-semibold text-ink-muted hover:text-accent transition-colors">View complete archive &rarr;</a>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
    ${enabledSkills
      .map((skill, idx) => {
        const meta = getCategoryMeta(skill.slug);
        return `<a href="/category/${encodeURIComponent(skill.slug)}" class="editorial-card p-6 flex flex-col justify-between gap-4 group">
        <div class="space-y-2.5">
          <div class="flex items-center justify-between gap-2">
            <span class="inline-flex items-center gap-2 font-tabular text-[11px] font-bold uppercase tracking-[0.1em]" style="color:${meta.color}">
              <span class="cat-dot" style="--cat-color:${meta.color}" aria-hidden="true"></span>
              <span>${escapeHtml(meta.shortLabel)}</span>
            </span>
            <span class="font-tabular text-[11px] text-ink-faint">0${idx + 1}</span>
          </div>
          <h3 class="font-editorial text-xl font-semibold text-ink group-hover:text-accent transition-colors">${escapeHtml(skill.name)}</h3>
          <p class="text-sm text-ink-muted leading-relaxed line-clamp-3">${escapeHtml(skill.description)}</p>
        </div>
        <div class="pt-3 border-t border-hairline flex items-center justify-between gap-2">
          <span class="text-xs text-ink-faint truncate max-w-[75%]">For: ${escapeHtml(skill.target_audience)}</span>
          <span class="font-tabular text-xs font-semibold text-accent group-hover:translate-x-0.5 transition-transform shrink-0">Track &rarr;</span>
        </div>
      </a>`;
      })
      .join('\n')}
  </div>
</section>`
      : '';

  const rigorHtml = `<section aria-labelledby="rigor-heading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
  <div class="editorial-card p-7 sm:p-10">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div class="lg:col-span-4 space-y-3">
        <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">Editorial Rigor</p>
        <h2 id="rigor-heading" class="font-masthead text-2xl sm:text-3xl font-bold text-ink leading-tight">
          Built to reject generic filler and unverified claims.
        </h2>
        <p class="text-sm text-ink-muted leading-relaxed">
          Every ${escapeHtml(siteName)} dossier passes automated primary-source auditing and human editorial oversight before publication.
        </p>
        <div class="pt-1">
          <a href="/editorial-policy" class="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-[var(--accent-hover)]">
            <span>Read Editorial Policy</span>
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </div>

      <div class="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6 broadsheet-divider">
        <div class="space-y-2">
          <span class="font-tabular text-xs font-bold text-accent">01 / GROUNDING</span>
          <h3 class="font-editorial text-lg font-semibold text-ink">Primary-Source Citations</h3>
          <p class="text-sm text-ink-muted leading-relaxed">
            Findings are anchored directly to official advisories, release notes, papers, and reproducible benchmark tables—never circular summaries.
          </p>
        </div>
        <div class="space-y-2">
          <span class="font-tabular text-xs font-bold text-accent">02 / AUDIT</span>
          <h3 class="font-editorial text-lg font-semibold text-ink">Deterministic Quality Gate</h3>
          <p class="text-sm text-ink-muted leading-relaxed">
            Every draft is scored against a strict structural rubric enforcing answer-first summaries, verified fact tables, and zero cliché padding.
          </p>
        </div>
        <div class="space-y-2">
          <span class="font-tabular text-xs font-bold text-accent">03 / ACCOUNTABILITY</span>
          <h3 class="font-editorial text-lg font-semibold text-ink">Human Editorial Review</h3>
          <p class="text-sm text-ink-muted leading-relaxed">
            Named editorial oversight by ${escapeHtml(settings.default_author || 'our desk')} with transparent corrections and direct Markdown/JSON provenance.
          </p>
        </div>
      </div>
    </div>
  </div>
</section>`;

  const landingBody = `${commandHeroHtml}
${leadSpreadHtml}
${recentGridHtml}
${spotlightBandHtml}
${tracksHtml}
${rigorHtml}
${renderCtaStrip(settings)}`;

  const baseUrl = normalizeBaseUrl(settings.base_url);
  return renderPublicLayout({
    title: `${siteName} — Primary-Source Technical Briefings`,
    description: tagline,
    canonicalUrl: `${baseUrl}/`,
    settings,
    ogType: 'website',
    currentPath: '/',
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
}): string {
  const { settings, posts, skills, activeCategory, page, totalPages, query } = opts;
  const activeSkill = activeCategory ? skills.find((s) => s.slug === activeCategory) : undefined;
  const trimmedQuery = (query || '').trim();
  const activeMeta = activeCategory ? getCategoryMeta(activeCategory) : null;

  const buildIndexUrl = (targetPage: number, cat?: string, q?: string): string => {
    const params = new URLSearchParams();
    if (cat) params.set('category', cat);
    if (q) params.set('q', q);
    if (targetPage > 1) params.set('page', String(targetPage));
    const qs = params.toString();
    return qs ? `/blog?${qs}` : '/blog';
  };

  const filterChips = [
    `<a href="${escapeHtml(buildIndexUrl(1, undefined, trimmedQuery))}" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-tabular text-xs border transition-colors ${
      !activeCategory
        ? 'bg-[var(--ink-primary)] text-[var(--bg-paper)] border-[var(--ink-primary)] font-semibold'
        : 'bg-surface text-ink-secondary border-hairline hover:border-strong hover:text-ink'
    }">All Tracks</a>`,
    ...skills
      .filter((s) => s.enabled || s.slug === activeCategory)
      .map((skill) => {
        const isActive = skill.slug === activeCategory;
        const meta = getCategoryMeta(skill.slug);
        return `<a href="${escapeHtml(buildIndexUrl(1, skill.slug, trimmedQuery))}" class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full font-tabular text-xs border transition-colors ${
          isActive
            ? 'bg-[var(--accent)] text-white border-[var(--accent)] font-semibold'
            : 'bg-surface text-ink-secondary border-hairline hover:border-strong hover:text-ink'
        }">
          <span class="cat-dot" style="--cat-color:${isActive ? '#FFFFFF' : meta.color}" aria-hidden="true"></span>
          <span>${escapeHtml(meta.shortLabel)}</span>
        </a>`;
      }),
  ].join('\n');

  const cardsHtml =
    posts.length > 0
      ? `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${posts
          .map((post, idx) => {
            const topRel = computePostRelationships(post, posts, 1)[0] || null;
            return renderVisualStoryCard({
              post,
              skills,
              topRelation: topRel,
              loading: idx < 3 ? 'eager' : 'lazy',
            });
          })
          .join('\n')}
      </div>`
      : `<div class="editorial-card p-10 text-center space-y-3">
        <p class="font-masthead text-2xl font-bold text-ink">No matching briefings found.</p>
        <p class="text-sm text-ink-muted">Try clearing your search query or switching to another research track.</p>
        <div class="pt-2">
          <a href="/blog" class="btn-ghost rounded-full">Reset filters</a>
        </div>
      </div>`;

  const paginationHtml =
    totalPages > 1
      ? `<nav aria-label="Pagination" class="mt-10 flex items-center justify-between gap-4 border-t border-hairline pt-6">
        <div>
          ${
            page > 1
              ? `<a href="${escapeHtml(buildIndexUrl(page - 1, activeCategory, trimmedQuery))}" class="btn-ghost rounded-full font-tabular text-xs">&larr; Previous</a>`
              : `<span class="btn-ghost rounded-full opacity-40 pointer-events-none font-tabular text-xs">&larr; Previous</span>`
          }
        </div>
        <span class="font-tabular text-xs text-ink-muted">Page ${page} of ${totalPages}</span>
        <div>
          ${
            page < totalPages
              ? `<a href="${escapeHtml(buildIndexUrl(page + 1, activeCategory, trimmedQuery))}" class="btn-ghost rounded-full font-tabular text-xs">Next &rarr;</a>`
              : `<span class="btn-ghost rounded-full opacity-40 pointer-events-none font-tabular text-xs">Next &rarr;</span>`
          }
        </div>
      </nav>`
      : '';

  const indexBody = `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
  <!-- Elevated Search + Category Filter Hub -->
  <header class="editorial-card p-6 sm:p-8 space-y-6">
    <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
      <div class="space-y-2.5 max-w-2xl">
        <p class="inline-flex items-center gap-2 font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">
          <span class="cat-dot" style="--cat-color:${activeMeta ? activeMeta.color : 'var(--accent)'}" aria-hidden="true"></span>
          <span>${activeSkill ? `Research Track · ${escapeHtml(activeSkill.slug)}` : 'Complete Editorial Archive'}</span>
        </p>
        <h1 class="font-masthead text-3xl sm:text-5xl font-bold text-ink leading-[1.08]">
          ${activeSkill ? escapeHtml(activeSkill.name) : 'Research Briefings'}
        </h1>
        <p class="text-sm sm:text-base text-ink-muted leading-relaxed">
          ${
            activeSkill
              ? escapeHtml(activeSkill.description)
              : 'Primary-source technical dossiers, advisory teardowns, and benchmark indexes structured for rapid engineering review.'
          }
        </p>
      </div>

      <form id="search" method="GET" action="/blog" role="search" class="w-full lg:w-[24rem] p-1.5 rounded-full bg-paper border border-hairline focus-within:border-[var(--accent)] transition-colors flex items-center gap-2">
        ${activeCategory ? `<input type="hidden" name="category" value="${escapeHtml(activeCategory)}">` : ''}
        <span class="pl-3 text-ink-faint shrink-0" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
        </span>
        <label for="blog-search-input" class="sr-only">Search briefings</label>
        <input id="blog-search-input" type="search" name="q" value="${escapeHtml(trimmedQuery)}" placeholder="Search titles, topics, CVEs..." class="w-full bg-transparent border-0 text-sm text-ink placeholder:text-ink-faint focus:outline-none py-1.5">
        <button type="submit" class="btn-accent rounded-full px-4 py-1.5 text-xs shrink-0">Search</button>
      </form>
    </div>

    <div class="pt-4 border-t border-hairline flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2" role="navigation" aria-label="Filter by category">
        ${filterChips}
      </div>
      ${
        trimmedQuery || activeCategory
          ? `<a href="/blog" class="font-tabular text-xs text-ink-muted hover:text-accent underline underline-offset-2">Clear filters</a>`
          : ''
      }
    </div>
  </header>

  ${
    trimmedQuery
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
  const siteName = settings.site_name || 'Pyvren Research';
  const canonicalPath = activeSkill ? `/category/${encodeURIComponent(activeSkill.slug)}` : '/blog';
  const pageTitle = activeSkill
    ? `${activeSkill.name} — ${siteName}`
    : `Research Briefings — ${siteName}`;
  const pageDesc = activeSkill
    ? activeSkill.description
    : settings.site_tagline || 'Primary-source technical research briefings and benchmark indexes.';

  return renderPublicLayout({
    title: pageTitle,
    description: pageDesc,
    canonicalUrl: `${baseUrl}${canonicalPath}`,
    settings,
    ogType: 'website',
    currentPath: canonicalPath,
    bodyHtml: indexBody,
  });
}

/* ==========================================================================
   3. Single Blog Post Page (Magazine Header + Cover Art + Connected Graph)
   ========================================================================== */

export function renderBlogPostPage(opts: {
  settings: SiteSettings;
  post: PostRecord;
  skill?: CategorySkill | null;
  relatedPosts: PostRecord[];
  headings?: Array<{ id: string; level: number; text: string }>;
}): string {
  const { settings, post, skill, relatedPosts, headings = [] } = opts;
  const catMeta = getCategoryMeta(post.category_slug);
  const categoryName = skill?.name || post.category_slug.replace(/-/g, ' ');
  const authorName = post.author || settings.default_author || 'Editorial Desk';
  const publishedIso = post.published_at || post.created_at;
  const updatedIso = post.updated_at;
  const showUpdated =
    Boolean(updatedIso && publishedIso) &&
    formatDate(updatedIso) !== formatDate(publishedIso);
  const hasToc = headings.length >= 2;
  const markdownUrl = `/blog/${encodeURIComponent(post.slug)}.md`;
  const coverArtSrc = `/og/${encodeURIComponent(post.slug)}.svg`;

  const relationships = computePostRelationships(post, relatedPosts, 3);

  const tldrHtml = post.tldr_summary
    ? `<section aria-label="Executive Summary" class="mt-8 rounded-[10px] border border-hairline border-l-[4px] border-l-[var(--accent)] bg-surface p-5 sm:p-6 shadow-[var(--shadow-subtle)]">
      <div class="flex items-center justify-between gap-2 mb-2">
        <span class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-bold">TL;DR &middot; Direct Answer</span>
        <span class="font-tabular text-[11px] text-ink-faint">Key Takeaway</span>
      </div>
      <p class="text-[0.98rem] sm:text-base leading-[1.7] text-ink font-medium">${escapeHtml(post.tldr_summary)}</p>
    </section>`
    : '';

  const keyFactsHtml =
    post.key_facts_json.length > 0
      ? `<section aria-labelledby="key-facts-heading" class="mt-6 rounded-[10px] border border-hairline bg-surface overflow-hidden shadow-[var(--shadow-subtle)]">
      <div class="px-5 py-3 bg-subtle border-b border-hairline flex items-center justify-between gap-3">
        <h2 id="key-facts-heading" class="font-tabular text-[11px] uppercase tracking-[0.14em] text-ink-secondary font-bold">Verified Key Facts</h2>
        <span class="font-tabular text-[11px] text-ink-faint">${post.key_facts_json.length} structured data points</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-sm">
          <tbody class="divide-y divide-[var(--border-hairline)]">
            ${post.key_facts_json
              .map((fact) => {
                const srcHref = fact.source_url ? safeHref(fact.source_url, '') : '';
                return `<tr class="hover:bg-subtle/60 transition-colors">
              <th scope="row" class="py-3 px-5 font-tabular text-xs font-medium text-ink-muted w-1/3 align-top">${escapeHtml(fact.label)}</th>
              <td class="py-3 px-5 text-ink align-top">${escapeHtml(fact.value)}</td>
              ${
                srcHref
                  ? `<td class="py-3 px-5 font-tabular text-xs text-right whitespace-nowrap align-top"><a href="${escapeHtml(srcHref)}" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline underline-offset-2">${escapeHtml(extractDomain(srcHref))} &nearr;</a></td>`
                  : `<td class="py-3 px-5"></td>`
              }
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
      <div class="sticky top-28 space-y-4">
        <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-ink-faint font-semibold">On This Briefing</p>
        <nav class="space-y-0.5">
          ${headings
            .map((h) => {
              const indent = h.level >= 3 ? 'pl-5 text-[12.5px]' : '';
              return `<a href="#${escapeHtml(h.id)}" data-toc-link class="toc-link ${indent}">${escapeHtml(h.text)}</a>`;
            })
            .join('\n          ')}
        </nav>
        <div class="pt-4 border-t border-hairline space-y-2 font-tabular text-xs">
          <a href="${markdownUrl}" class="flex items-center justify-between text-ink-muted hover:text-accent transition-colors">
            <span>View Markdown (.md)</span>
            <span aria-hidden="true">&rarr;</span>
          </a>
          <a href="#sources" class="flex items-center justify-between text-ink-muted hover:text-accent transition-colors">
            <span>Primary Sources (${post.sources_json.length})</span>
            <span aria-hidden="true">&darr;</span>
          </a>
        </div>
      </div>
    </aside>`
    : '';

  const tagsHtml =
    post.tags_json.length > 0
      ? `<div class="mt-10 pt-6 border-t border-hairline flex flex-wrap items-center gap-2">
      <span class="font-tabular text-[11px] uppercase tracking-[0.12em] text-ink-faint mr-1">Topics:</span>
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
      <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">Reference Q&amp;A</p>
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

  const sourcesHtml =
    post.sources_json.length > 0
      ? `<section id="sources" aria-labelledby="sources-heading" class="mt-14 pt-8 double-rule-top scroll-mt-24">
      <div class="flex items-baseline justify-between gap-3 mb-4">
        <div>
          <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">Provenance</p>
          <h2 id="sources-heading" class="font-masthead text-2xl font-bold text-ink mt-1">Primary Sources &amp; Citations</h2>
        </div>
        <span class="font-tabular text-xs text-ink-faint">${post.sources_json.length} verified references</span>
      </div>
      <ol class="space-y-2.5 text-sm">
        ${post.sources_json
          .map((src, idx) => {
            const href = safeHref(src, '#');
            return `<li class="flex items-start gap-3 py-2 border-b border-hairline last:border-b-0">
          <span class="font-tabular text-xs text-ink-faint w-6 shrink-0 pt-0.5">[${idx + 1}]</span>
          <div class="min-w-0 flex-1">
            <span class="font-tabular text-[11px] uppercase tracking-wider text-ink-muted block">${escapeHtml(extractDomain(src))}</span>
            <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline underline-offset-2 break-all">${escapeHtml(src)}</a>
          </div>
        </li>`;
          })
          .join('')}
      </ol>
    </section>`
      : '';

  const authorCardHtml = `<section aria-label="Author and verification" class="mt-12 editorial-card p-6">
    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div class="space-y-2">
        <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-ink-faint font-semibold">Editorial Verification</p>
        <h2 class="font-masthead text-xl font-bold text-ink">
          <a href="/about" class="hover:text-accent transition-colors">${escapeHtml(authorName)}</a>
        </h2>
        <p class="text-sm text-ink-muted leading-relaxed max-w-2xl">
          ${escapeHtml(settings.author_bio || 'Independent technical researcher and editor focusing on primary-source engineering analysis, software security, and AI infrastructure.')}
        </p>
      </div>
      <div class="shrink-0 flex sm:flex-col items-center sm:items-end gap-2">
        ${renderScoreRing(post.quality_score)}
        <span class="font-tabular text-[11px] text-ink-faint">Audit Score</span>
      </div>
    </div>
    <div class="mt-4 pt-4 border-t border-hairline flex flex-wrap items-center gap-4 text-xs font-tabular">
      <a href="/about" class="text-ink-secondary hover:text-accent underline underline-offset-2">About the Editor</a>
      <a href="/editorial-policy" class="text-ink-secondary hover:text-accent underline underline-offset-2">Verification &amp; Correction Policy</a>
      <a href="/contact" class="text-ink-secondary hover:text-accent underline underline-offset-2">Report an Issue</a>
    </div>
  </section>`;

  const relatedHtml =
    relationships.length > 0
      ? `<section aria-labelledby="related-heading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-8 double-rule-top">
      <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p class="inline-flex items-center gap-2 font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">
            <span class="cat-dot" style="--cat-color:var(--accent)" aria-hidden="true"></span>
            <span>Connected Intelligence</span>
          </p>
          <h2 id="related-heading" class="font-masthead text-2xl sm:text-3xl font-bold text-ink mt-1">Related Briefings</h2>
        </div>
        <a href="/category/${encodeURIComponent(post.category_slug)}" class="font-tabular text-xs font-semibold text-ink-muted hover:text-accent transition-colors">More in ${escapeHtml(categoryName)} &rarr;</a>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        ${relationships
          .map((rel) =>
            renderVisualStoryCard({
              post: rel.post,
              reasonBadge: rel.reasonLabel,
              loading: 'lazy',
            }),
          )
          .join('\n')}
      </div>
    </section>`
      : '';

  const articleBody = `<article class="pt-8 sm:pt-12">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <nav aria-label="Breadcrumb" class="mb-6 flex flex-wrap items-center gap-2 font-tabular text-xs text-ink-faint">
      <a href="/" class="hover:text-ink transition-colors">Home</a>
      <span aria-hidden="true">/</span>
      <a href="/blog" class="hover:text-ink transition-colors">Briefings</a>
      <span aria-hidden="true">/</span>
      <a href="/category/${encodeURIComponent(post.category_slug)}" class="hover:text-ink transition-colors">${escapeHtml(categoryName)}</a>
      <span aria-hidden="true">/</span>
      <span class="text-ink-muted truncate max-w-[240px] sm:max-w-md" aria-current="page">${escapeHtml(post.title)}</span>
    </nav>

    <header class="max-w-4xl pb-8 border-b border-strong space-y-5">
      <div class="flex flex-wrap items-center gap-2.5">
        <a href="/category/${encodeURIComponent(post.category_slug)}" class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-hairline bg-surface font-tabular text-[11px] font-bold uppercase tracking-[0.09em]" style="color:${catMeta.color}">
          <span class="cat-dot" style="--cat-color:${catMeta.color}" aria-hidden="true"></span>
          <span>${escapeHtml(categoryName)}</span>
        </a>
        <span class="badge-editorial">${escapeHtml(formatArchetype(post.archetype))}</span>
        ${renderScoreBadge(post.quality_score)}
      </div>

      <h1 class="font-masthead text-3xl sm:text-4xl lg:text-[2.95rem] font-bold leading-[1.08] text-ink">
        ${escapeHtml(post.title)}
      </h1>

      <p class="text-lg sm:text-[1.1875rem] text-ink-secondary leading-relaxed">
        ${escapeHtml(post.description)}
      </p>

      <div class="pt-2 flex flex-wrap items-center justify-between gap-4 font-tabular text-xs text-ink-muted">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span>By <a href="/about" class="text-ink font-semibold hover:text-accent underline underline-offset-2">${escapeHtml(authorName)}</a></span>
          <span aria-hidden="true">&middot;</span>
          <time datetime="${escapeHtml(publishedIso)}">${escapeHtml(formatDate(publishedIso))}</time>
          ${
            showUpdated
              ? `<span aria-hidden="true">&middot;</span><span>Updated <time datetime="${escapeHtml(updatedIso)}">${escapeHtml(formatDate(updatedIso))}</time></span>`
              : ''
          }
          <span aria-hidden="true">&middot;</span>
          <span>${post.reading_time_minutes} min read (${post.word_count.toLocaleString('en-US')} words)</span>
        </div>

        <a href="${markdownUrl}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-hairline bg-surface hover:border-strong hover:text-accent transition-colors text-ink-secondary" title="Raw Markdown edition for developers and AI agents">
          <span>View Markdown (.md)</span>
        </a>
      </div>
    </header>

    <!-- Full-Bleed Framed Editorial Cover Illustration -->
    <figure class="mt-8 max-w-4xl rounded-[14px] overflow-hidden border border-hairline bg-surface shadow-[var(--shadow-subtle)]">
      <img src="${coverArtSrc}" alt="${escapeHtml(post.title)}" width="1200" height="630" loading="eager" class="w-full aspect-[1200/630] object-cover block">
    </figure>

    <div class="max-w-4xl">
      ${tldrHtml}
      ${keyFactsHtml}
      ${renderAdSlot(settings, 'Advertisement')}
    </div>

    <div class="mt-10 grid grid-cols-1 ${hasToc ? 'lg:grid-cols-12 gap-10 xl:gap-12' : ''} items-start">
      <div class="${hasToc ? 'lg:col-span-8 xl:col-span-9' : 'max-w-3xl'} min-w-0">
        <div class="prose-editorial max-w-[70ch]">
          ${post.body_html}
        </div>
        <div class="max-w-[70ch]">
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
  const siteName = settings.site_name || 'Pyvren Research';
  const postUrl = `${baseUrl}/blog/${encodeURIComponent(post.slug)}`;
  const postOgImageUrl = `${baseUrl}/og/${encodeURIComponent(post.slug)}.svg`;
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
        url: `${baseUrl}/about`,
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
        { '@type': 'ListItem', position: 2, name: 'Briefings', item: `${baseUrl}/blog` },
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
    bodyHtml: articleBody,
  });
}

/* ==========================================================================
   4. Trust & Compliance Pages (About, Editorial Policy, Privacy, Contact)
   ========================================================================== */

export function renderTrustPage(opts: {
  settings: SiteSettings;
  kind: 'about' | 'privacy' | 'contact' | 'editorial-policy';
}): string {
  const { settings, kind } = opts;
  const siteName = settings.site_name || 'Pyvren';
  const author = settings.default_author || 'Editorial Desk';
  const authorBio =
    settings.author_bio ||
    'Independent technical writer and systems engineer curating primary-source briefings across AI engineering, security advisories, and cloud infrastructure.';
  const contactEmail = settings.contact_email || 'editorial@pyvren.com';
  const mailtoHref = safeHref(`mailto:${contactEmail}`, `mailto:${contactEmail}`);

  const configs: Record<
    'about' | 'privacy' | 'contact' | 'editorial-policy',
    { eyebrow: string; title: string; lead: string; bodyHtml: string }
  > = {
    about: {
      eyebrow: 'About & Masthead',
      title: `About ${siteName}`,
      lead:
        settings.site_tagline ||
        'Independent technical intelligence grounded in primary sources, reproducible benchmarks, and structured editorial verification.',
      bodyHtml: `
        <h2>Editorial Mission</h2>
        <p>${escapeHtml(siteName)} publishes concise, deeply cited technical briefings for engineers, security practitioners, and technical leaders. Rather than rewriting press releases or repeating generic commentary, every briefing synthesizes primary documentation—security advisories, release changelogs, benchmark methodologies, and architectural papers—into clear, verifiable reference documents.</p>

        <h2>Human Editorship &amp; Responsibility</h2>
        <p><strong>Lead Editor:</strong> ${escapeHtml(author)}</p>
        <p>${escapeHtml(authorBio)}</p>
        <p>Every published briefing on ${escapeHtml(siteName)} is governed by explicit quality standards and human editorial accountability. We maintain full transparency around how automated research tools assist our desk; read our complete <a href="/editorial-policy">Editorial &amp; Verification Policy</a> for details.</p>

        <h2>Built for Humans and Open Knowledge Systems</h2>
        <p>We believe high-signal technical journalism should load instantaneously, remain readable without client-side scripts, and expose clean structured metadata. Every briefing is available as server-rendered HTML, raw Markdown (<code>.md</code>), RSS (<code>/rss.xml</code>), and structured JSON (<code>/api/v1/posts</code>), alongside our publisher index at <a href="/llms.txt">/llms.txt</a>.</p>

        <h2>Contact the Masthead</h2>
        <p>For editorial inquiries, factual corrections, or technical feedback, reach our desk at <a href="${escapeHtml(mailtoHref)}">${escapeHtml(contactEmail)}</a> or visit our <a href="/contact">Contact page</a>.</p>
      `,
    },

    'editorial-policy': {
      eyebrow: 'Standards & Provenance',
      title: 'Editorial & Verification Policy',
      lead:
        'How we research, audit, score, and human-verify every technical dossier before it reaches readers.',
      bodyHtml: `
        <h2>1. Primary-Source Grounding First</h2>
        <p>Every briefing published on ${escapeHtml(siteName)} must trace its claims to primary sources: official vendor security advisories, CVE entries, upstream release notes, academic papers, or publicly reproducible benchmark repositories. Claims without verifiable provenance are rejected during review.</p>

        <h2>2. Multi-Stage Verification &amp; Anti-Slop Standard</h2>
        <p>To keep our archive dense with real engineering value, our editorial workflow uses a multi-stage verification pipeline:</p>
        <ol>
          <li><strong>Structured Source Collection:</strong> Research tools retrieve primary feeds, advisories, and documentation with full URL provenance logging.</li>
          <li><strong>Deterministic Quality &amp; Citation Linting:</strong> Each draft is audited for answer-first clarity, structured key facts, valid primary-source citations, and strict exclusion of hollow AI clichés, filler introductions, or unsupported superlatives.</li>
          <li><strong>Rubric Scoring &amp; Human Editorial Review:</strong> Briefings are scored across source grounding, information gain, structural clarity, and reader safety. Lead editor ${escapeHtml(author)} oversees editorial standards, spot-checks flagged claims, and retains final authority to edit, hold, or unpublish any piece.</li>
        </ol>

        <h2>3. Disclosure on Automation Assistance</h2>
        <p>${escapeHtml(siteName)} transparently uses structured AI research workflows to assist with primary-source discovery, draft structuring, and rubric auditing. Automation never replaces factual accountability: all published pages expose their primary source URLs so readers can independently verify every technical claim.</p>

        <h2>4. Corrections &amp; Updates Policy</h2>
        <p>Technical ecosystems evolve rapidly. When an upstream patch changes, a benchmark is revised, or a reader identifies an inaccuracy, we update the briefing promptly and reflect the modification timestamp in the article header and structured metadata. To request a correction, email <a href="${escapeHtml(mailtoHref)}">${escapeHtml(contactEmail)}</a> with the article URL and supporting primary source.</p>

        <h2>5. Editorial Independence &amp; Advertising</h2>
        <p>Editorial coverage is strictly separated from advertising. Sponsored slots or programmatic ads (such as Google AdSense, when enabled) never influence topic selection, benchmark conclusions, or security recommendations.</p>
      `,
    },

    privacy: {
      eyebrow: 'Privacy & Advertising Disclosure',
      title: 'Privacy & Cookie Policy',
      lead:
        `How ${siteName} handles server logs, cookies, reader privacy, and advertising partners.`,
      bodyHtml: `
        <h2>1. Minimal Data Collection</h2>
        <p>${escapeHtml(siteName)} is engineered to operate with minimal data collection. Public readers can browse all briefings without creating an account, logging in, or executing third-party analytics trackers. Standard edge server logs (such as anonymized request metadata and HTTP status codes) may be processed briefly by our infrastructure provider to prevent abuse and ensure reliability.</p>

        <h2>2. Cookies &amp; Local Preferences</h2>
        <ul>
          <li><strong>Appearance Preference:</strong> If you toggle light or dark mode, your browser saves a local preference key (<code>pyvren-theme</code>) strictly on your device.</li>
          <li><strong>Administrative Cookies:</strong> Strictly necessary, HttpOnly authentication cookies are used solely for authorized editorial staff accessing the private admin interface.</li>
        </ul>

        <h2>3. Google AdSense &amp; Third-Party Advertising</h2>
        <p>When advertising is active on ${escapeHtml(siteName)}, we may partner with Google AdSense and certified third-party vendors to display contextual or personalized advertisements:</p>
        <ul>
          <li>Third-party vendors, including Google, use cookies to serve ads based on a visitor&rsquo;s prior visits to this website or other websites on the internet.</li>
          <li>Google&rsquo;s use of advertising cookies enables it and its partners to serve ads to users based on their visits to ${escapeHtml(siteName)} and/or other sites across the web.</li>
          <li>You may opt out of personalized advertising at any time by visiting <a href="https://myadcenter.google.com/" target="_blank" rel="noopener noreferrer">Google My Ad Center (https://myadcenter.google.com/)</a>.</li>
          <li>You can also manage third-party vendor cookies for personalized advertising via <a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer">aboutads.info</a>.</li>
        </ul>

        <h2>4. Your Privacy Rights</h2>
        <p>Depending on your jurisdiction (including EEA/UK GDPR and California CCPA/CPRA), you may request information about any personal data associated with direct email correspondence you have sent to our desk, or request its deletion.</p>

        <h2>5. Contact Regarding Privacy</h2>
        <p>For privacy inquiries or data deletion requests, contact us directly at <a href="${escapeHtml(mailtoHref)}">${escapeHtml(contactEmail)}</a>.</p>
      `,
    },

    contact: {
      eyebrow: 'Editorial Desk',
      title: `Contact ${siteName}`,
      lead:
        'Reach our editorial desk for factual corrections, technical tips, security disclosures, or syndication inquiries.',
      bodyHtml: `
        <h2>Direct Editorial Desk</h2>
        <p>Email: <a href="${escapeHtml(mailtoHref)}">${escapeHtml(contactEmail)}</a></p>
        <p>Lead Editor: ${escapeHtml(author)}</p>

        <h2>Corrections &amp; Technical Tips</h2>
        <p>If you spot an outdated version number, a broken primary citation, or an emerging security advisory worth an in-depth teardown, please include the relevant article URL and primary-source documentation in your message. Verified corrections are prioritized and logged promptly.</p>

        <h2>Syndication &amp; Machine-Readable Access</h2>
        <p>Developers, researchers, and feed readers can consume our published briefings directly via standard open endpoints:</p>
        <ul>
          <li>RSS Feed: <a href="/rss.xml">/rss.xml</a></li>
          <li>Sitemap: <a href="/sitemap.xml">/sitemap.xml</a></li>
          <li>LLM &amp; Agent Index: <a href="/llms.txt">/llms.txt</a></li>
          <li>Public JSON API: <a href="/api/v1/posts">/api/v1/posts</a></li>
        </ul>
      `,
    },
  };

  const page = configs[kind];
  const baseUrl = normalizeBaseUrl(settings.base_url);
  const path = `/${kind}`;

  const trustBody = `<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
  <header class="pb-8 border-b border-strong space-y-4">
    <p class="inline-flex items-center gap-2 font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">
      <span class="cat-dot" style="--cat-color:var(--accent)" aria-hidden="true"></span>
      <span>${escapeHtml(page.eyebrow)}</span>
    </p>
    <h1 class="font-masthead text-3xl sm:text-5xl font-bold text-ink leading-[1.08]">${escapeHtml(page.title)}</h1>
    <p class="text-lg text-ink-secondary leading-relaxed">${escapeHtml(page.lead)}</p>
  </header>

  <div class="mt-10 prose-editorial max-w-[70ch]">
    ${page.bodyHtml}
  </div>

  <div class="mt-12 pt-6 border-t border-hairline flex flex-wrap items-center gap-4 font-tabular text-xs text-ink-muted">
    <a href="/about" class="hover:text-accent ${kind === 'about' ? 'text-accent font-semibold' : ''}">About</a>
    <span aria-hidden="true">&middot;</span>
    <a href="/editorial-policy" class="hover:text-accent ${kind === 'editorial-policy' ? 'text-accent font-semibold' : ''}">Editorial Policy</a>
    <span aria-hidden="true">&middot;</span>
    <a href="/privacy" class="hover:text-accent ${kind === 'privacy' ? 'text-accent font-semibold' : ''}">Privacy &amp; Ad Policy</a>
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
    bodyHtml: trustBody,
  });
}

/* ==========================================================================
   5. 404 Not Found Page
   ========================================================================== */

export function renderNotFoundPage(opts: { settings: SiteSettings }): string {
  const siteName = opts.settings.site_name || 'Pyvren';
  const baseUrl = normalizeBaseUrl(opts.settings.base_url);
  const notFoundBody = `<div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center space-y-6">
  <p class="inline-flex items-center gap-2 font-tabular text-xs uppercase tracking-[0.16em] text-accent font-semibold">
    <span class="cat-dot" style="--cat-color:var(--accent)" aria-hidden="true"></span>
    <span>Error 404</span>
  </p>
  <h1 class="font-masthead text-4xl sm:text-5xl font-bold text-ink">Briefing Not Found</h1>
  <p class="text-base text-ink-muted max-w-lg mx-auto leading-relaxed">
    The requested dossier on ${escapeHtml(siteName)} may have been moved, unpublished, or the URL may contain a typo.
  </p>
  <div class="pt-2 flex flex-wrap items-center justify-center gap-3">
    <a href="/" class="btn-accent rounded-full px-5">Return Home</a>
    <a href="/blog" class="btn-ghost rounded-full px-5">Browse All Briefings</a>
  </div>
</div>`;

  return renderPublicLayout({
    title: `404 Briefing Not Found — ${siteName}`,
    description: `The requested page could not be found on ${siteName}.`,
    canonicalUrl: `${baseUrl}/404`,
    settings: opts.settings,
    ogType: 'website',
    robotsMeta: 'noindex, follow',
    bodyHtml: notFoundBody,
  });
}
