import { normalizeBaseUrl } from '../env';
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

function renderAdSlot(settings: SiteSettings, slotLabel = 'Advertisement'): string {
  const clientId = (settings.adsense_client_id || '').trim();
  if (!clientId) return '';
  return `<aside class="ad-slot" aria-label="${escapeHtml(slotLabel)}">
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
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
    <div class="max-w-2xl space-y-2.5">
      <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">Dispatch &amp; Syndication</p>
      <h2 class="font-editorial text-2xl sm:text-3xl font-semibold text-ink leading-tight">${escapeHtml(headline)}</h2>
      <p class="text-sm sm:text-base text-ink-muted leading-relaxed">${escapeHtml(body)}</p>
    </div>
    <div class="flex flex-wrap items-center gap-3 shrink-0">
      <a href="${escapeHtml(ctaUrl)}"${isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''} class="btn-primary">
        <span>Explore Dispatch</span>
        <span aria-hidden="true">&rarr;</span>
      </a>
      <a href="/rss.xml" class="btn-ghost font-tabular text-xs">RSS Feed</a>
      <a href="/llms.txt" class="btn-ghost font-tabular text-xs">llms.txt</a>
    </div>
  </div>
</section>`;
}

function findSkillName(skills: CategorySkill[], slug: string): string {
  const match = skills.find((s) => s.slug === slug);
  return match ? match.name : slug.replace(/-/g, ' ');
}

/* ==========================================================================
   1. Landing Page
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

  const primaryCtaHref = featuredPost
    ? `/blog/${encodeURIComponent(featuredPost.slug)}`
    : '/blog';
  const primaryCtaLabel = featuredPost ? 'Read Featured Dossier' : 'Browse All Briefings';

  const featuredHtml = featuredPost
    ? `<section aria-labelledby="featured-heading" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6">
    <div class="flex items-center justify-between gap-4 pb-3 border-b border-strong">
      <h2 id="featured-heading" class="font-tabular text-[11px] uppercase tracking-[0.14em] text-ink-muted font-semibold">Featured Research Dossier</h2>
      <span class="font-tabular text-xs text-ink-faint">${escapeHtml(formatDate(featuredPost.published_at || featuredPost.created_at))}</span>
    </div>

    <article class="mt-6 editorial-card p-6 sm:p-8 lg:p-10">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div class="lg:col-span-7 space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <a href="/blog?category=${encodeURIComponent(featuredPost.category_slug)}" class="badge-editorial badge-accent">${escapeHtml(findSkillName(skills, featuredPost.category_slug))}</a>
            <span class="badge-editorial">${escapeHtml(formatArchetype(featuredPost.archetype))}</span>
            ${renderScoreBadge(featuredPost.quality_score)}
          </div>

          <h3 class="font-editorial text-2xl sm:text-3xl lg:text-[2.15rem] font-semibold leading-[1.15] text-ink">
            <a href="/blog/${encodeURIComponent(featuredPost.slug)}" class="hover:text-accent transition-colors">${escapeHtml(featuredPost.title)}</a>
          </h3>

          <p class="text-base text-ink-secondary leading-relaxed">${escapeHtml(featuredPost.description)}</p>

          ${
            featuredPost.tldr_summary
              ? `<div class="pl-4 border-l-2 border-[var(--accent)] py-1">
            <p class="font-tabular text-[10px] uppercase tracking-[0.12em] text-ink-faint mb-1">Key Takeaway</p>
            <p class="text-sm text-ink-muted leading-relaxed">${escapeHtml(featuredPost.tldr_summary)}</p>
          </div>`
              : ''
          }

          <div class="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-hairline">
            <div class="flex flex-wrap items-center gap-3 font-tabular text-xs text-ink-faint">
              <span>By ${escapeHtml(featuredPost.author || settings.default_author)}</span>
              <span aria-hidden="true">&middot;</span>
              <span>${featuredPost.reading_time_minutes} min read</span>
              <span aria-hidden="true">&middot;</span>
              <span>${featuredPost.sources_json.length} primary sources</span>
            </div>
            <a href="/blog/${encodeURIComponent(featuredPost.slug)}" class="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-[var(--accent-hover)] transition-colors">
              <span>Read full dossier</span>
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </div>

        <div class="lg:col-span-5 lg:border-l lg:border-hairline lg:pl-8 space-y-4">
          <div class="flex items-center justify-between">
            <span class="font-tabular text-[11px] uppercase tracking-[0.12em] text-ink-faint font-semibold">Verified Key Facts</span>
            ${renderScoreRing(featuredPost.quality_score)}
          </div>
          ${
            featuredPost.key_facts_json.length > 0
              ? `<dl class="divide-y divide-[var(--border-hairline)] border-t border-b border-hairline">
            ${featuredPost.key_facts_json
              .slice(0, 4)
              .map(
                (fact) => `<div class="py-3 grid grid-cols-12 gap-2 text-sm">
              <dt class="col-span-5 font-tabular text-xs text-ink-muted">${escapeHtml(fact.label)}</dt>
              <dd class="col-span-7 font-medium text-ink">${escapeHtml(fact.value)}</dd>
            </div>`,
              )
              .join('')}
          </dl>`
              : `<p class="text-sm text-ink-muted leading-relaxed border-t border-hairline pt-3">Full primary-source analysis, structured citations, and technical implementation findings inside the complete briefing.</p>`
          }
          <div class="flex items-center justify-between text-xs font-tabular text-ink-faint">
            <span>Machine-readable edition</span>
            <a href="/blog/${encodeURIComponent(featuredPost.slug)}.md" class="text-ink-secondary hover:text-accent underline underline-offset-2">.md export</a>
          </div>
        </div>
      </div>
    </article>
  </section>`
    : '';

  const listPosts = featuredPost
    ? recentPosts.filter((p) => p.id !== featuredPost.id)
    : recentPosts;

  const recentListHtml =
    listPosts.length > 0
      ? `<div class="divide-y divide-[var(--border-hairline)] border-t border-b border-hairline">
        ${listPosts
          .map((post, idx) => {
            const indexLabel = String(idx + 1).padStart(2, '0');
            return `<article class="editorial-row py-6 px-2 -mx-2 rounded-[4px] grid grid-cols-1 md:grid-cols-12 gap-4 items-baseline">
          <div class="md:col-span-3 flex flex-wrap md:flex-col gap-x-3 gap-y-1.5">
            <span class="font-tabular text-xs text-ink-faint">${indexLabel} &middot; ${escapeHtml(formatDate(post.published_at || post.created_at))}</span>
            <div class="flex flex-wrap items-center gap-1.5">
              <a href="/blog?category=${encodeURIComponent(post.category_slug)}" class="badge-editorial badge-accent">${escapeHtml(findSkillName(skills, post.category_slug))}</a>
              <span class="badge-editorial">${escapeHtml(formatArchetype(post.archetype))}</span>
            </div>
          </div>

          <div class="md:col-span-7 space-y-1.5">
            <h3 class="font-editorial text-xl sm:text-2xl font-semibold leading-snug text-ink">
              <a href="/blog/${encodeURIComponent(post.slug)}" class="hover:text-accent transition-colors">${escapeHtml(post.title)}</a>
            </h3>
            <p class="text-sm text-ink-muted leading-relaxed line-clamp-2">${escapeHtml(post.description)}</p>
          </div>

          <div class="md:col-span-2 flex md:flex-col items-center md:items-end justify-between gap-2">
            ${renderScoreBadge(post.quality_score)}
            <span class="font-tabular text-xs text-ink-faint">${post.reading_time_minutes} min &middot; ${post.sources_json.length} src</span>
          </div>
        </article>`;
          })
          .join('')}
      </div>`
      : `<div class="border border-hairline rounded-[6px] bg-surface p-8 text-center space-y-2">
        <p class="font-editorial text-xl text-ink">New research dossiers are currently in editorial review.</p>
        <p class="text-sm text-ink-muted">Explore our <a href="/editorial-policy" class="text-accent underline underline-offset-2">verification methodology</a> or subscribe via <a href="/rss.xml" class="text-accent underline underline-offset-2">RSS</a>.</p>
      </div>`;

  const tracksHtml =
    enabledSkills.length > 0
      ? `<section id="categories" aria-labelledby="tracks-heading" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 scroll-mt-20">
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-strong">
      <div>
        <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">Coverage Index</p>
        <h2 id="tracks-heading" class="font-editorial text-2xl sm:text-3xl font-semibold text-ink mt-1">Category Research Tracks</h2>
      </div>
      <a href="/blog" class="font-tabular text-xs text-ink-muted hover:text-accent transition-colors">View complete archive &rarr;</a>
    </div>

    <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
      ${enabledSkills
        .map(
          (skill, idx) => `<a href="/blog?category=${encodeURIComponent(skill.slug)}" class="editorial-card p-6 flex flex-col justify-between gap-4 group">
        <div class="space-y-2.5">
          <div class="flex items-center justify-between gap-2">
            <span class="font-tabular text-[11px] text-ink-faint uppercase tracking-[0.12em]">Track ${String(idx + 1).padStart(2, '0')}</span>
            <span class="font-tabular text-xs text-accent group-hover:translate-x-0.5 transition-transform">Inspect &rarr;</span>
          </div>
          <h3 class="font-editorial text-xl font-semibold text-ink group-hover:text-accent transition-colors">${escapeHtml(skill.name)}</h3>
          <p class="text-sm text-ink-muted leading-relaxed">${escapeHtml(skill.description)}</p>
        </div>
        <div class="pt-3 border-t border-hairline flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs text-ink-faint truncate max-w-[65%]">For: ${escapeHtml(skill.target_audience)}</span>
          <div class="flex flex-wrap gap-1.5">
            ${skill.preferred_archetypes_json
              .slice(0, 2)
              .map((a) => `<span class="badge-editorial">${escapeHtml(formatArchetype(a))}</span>`)
              .join('')}
          </div>
        </div>
      </a>`,
        )
        .join('')}
    </div>
  </section>`
      : '';

  const landingBody = `<section class="border-b border-hairline">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
    <div class="flex flex-wrap items-center justify-between gap-3 pb-6 mb-8 border-b border-hairline font-tabular text-[11px] uppercase tracking-[0.14em] text-ink-faint">
      <span>Independent Technical Intelligence</span>
      <span>Primary-Source Verified &middot; Human-Edited</span>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
      <div class="lg:col-span-8 space-y-5">
        <h1 class="font-editorial text-4xl sm:text-5xl lg:text-[3.4rem] font-semibold leading-[1.06] text-ink">
          Signal-dense engineering briefings, verified at the source.
        </h1>
        <p class="text-base sm:text-lg text-ink-secondary leading-relaxed max-w-2xl">
          ${escapeHtml(tagline)}
        </p>
        <div class="pt-2 flex flex-wrap items-center gap-3">
          <a href="${primaryCtaHref}" class="btn-primary">
            <span>${escapeHtml(primaryCtaLabel)}</span>
            <span aria-hidden="true">&rarr;</span>
          </a>
          <a href="#categories" class="btn-ghost">Research Tracks</a>
          <a href="/editorial-policy" class="btn-ghost">Verification Standard</a>
        </div>
      </div>

      <div class="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-hairline pt-6 lg:pt-0 lg:pl-8 space-y-4">
        <div class="flex items-baseline justify-between border-b border-hairline pb-3">
          <span class="font-tabular text-xs uppercase tracking-[0.08em] text-ink-faint">Tracks Active</span>
          <span class="font-tabular text-xl font-semibold text-ink">${String(enabledSkills.length).padStart(2, '0')}</span>
        </div>
        <div class="flex items-baseline justify-between border-b border-hairline pb-3">
          <span class="font-tabular text-xs uppercase tracking-[0.08em] text-ink-faint">Citation Standard</span>
          <span class="font-tabular text-sm font-medium text-ink">Primary URLs Only</span>
        </div>
        <div class="flex items-baseline justify-between">
          <span class="font-tabular text-xs uppercase tracking-[0.08em] text-ink-faint">Formats</span>
          <span class="font-tabular text-sm font-medium text-ink">HTML &middot; MD &middot; JSON &middot; RSS</span>
        </div>
      </div>
    </div>
  </div>
</section>

${featuredHtml}

<section aria-labelledby="latest-heading" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
  <div class="flex items-end justify-between gap-4 pb-3 border-b border-strong mb-2">
    <div>
      <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">Briefing Ledger</p>
      <h2 id="latest-heading" class="font-editorial text-2xl sm:text-3xl font-semibold text-ink mt-1">Latest Verified Briefings</h2>
    </div>
    <a href="/blog" class="font-tabular text-xs text-ink-muted hover:text-accent transition-colors">All briefings &rarr;</a>
  </div>
  ${recentListHtml}
</section>

${tracksHtml}

<section aria-labelledby="rigor-heading" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
  <div class="border border-hairline rounded-[6px] bg-surface p-7 sm:p-10">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div class="lg:col-span-4 space-y-3">
        <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">Editorial Rigor</p>
        <h2 id="rigor-heading" class="font-editorial text-2xl sm:text-3xl font-semibold text-ink leading-tight">
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

      <div class="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-6 lg:border-l lg:border-hairline lg:pl-8">
        <div class="space-y-2">
          <span class="font-tabular text-xs font-semibold text-accent">01 / GROUNDING</span>
          <h3 class="font-semibold text-base text-ink">Primary-Source Citations</h3>
          <p class="text-sm text-ink-muted leading-relaxed">
            Findings are anchored directly to official advisories, release notes, papers, and reproducible benchmark tables—never circular summaries.
          </p>
        </div>
        <div class="space-y-2">
          <span class="font-tabular text-xs font-semibold text-accent">02 / AUDIT</span>
          <h3 class="font-semibold text-base text-ink">Deterministic Quality Gate</h3>
          <p class="text-sm text-ink-muted leading-relaxed">
            Every draft is scored against a strict structural rubric enforcing answer-first summaries, verified fact tables, and zero cliché padding.
          </p>
        </div>
        <div class="space-y-2">
          <span class="font-tabular text-xs font-semibold text-accent">03 / ACCOUNTABILITY</span>
          <h3 class="font-semibold text-base text-ink">Human Editorial Review</h3>
          <p class="text-sm text-ink-muted leading-relaxed">
            Named editorial oversight by ${escapeHtml(settings.default_author || 'our desk')} with transparent corrections and direct Markdown/JSON provenance.
          </p>
        </div>
      </div>
    </div>
  </div>
</section>

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
   2. Blog Index Page
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

  const buildIndexUrl = (targetPage: number, cat?: string, q?: string): string => {
    const params = new URLSearchParams();
    if (cat) params.set('category', cat);
    if (q) params.set('q', q);
    if (targetPage > 1) params.set('page', String(targetPage));
    const qs = params.toString();
    return qs ? `/blog?${qs}` : '/blog';
  };

  const filterChips = [
    `<a href="${escapeHtml(buildIndexUrl(1, undefined, trimmedQuery))}" class="px-3 py-1.5 rounded-[4px] font-tabular text-xs border transition-colors ${
      !activeCategory
        ? 'bg-[var(--ink-primary)] text-[var(--bg-paper)] border-[var(--ink-primary)] font-semibold'
        : 'bg-surface text-ink-muted border-hairline hover:border-strong hover:text-ink'
    }">All Tracks</a>`,
    ...skills
      .filter((s) => s.enabled || s.slug === activeCategory)
      .map((skill) => {
        const isActive = skill.slug === activeCategory;
        return `<a href="${escapeHtml(buildIndexUrl(1, skill.slug, trimmedQuery))}" class="px-3 py-1.5 rounded-[4px] font-tabular text-xs border transition-colors ${
          isActive
            ? 'bg-[var(--accent)] text-white border-[var(--accent)] font-semibold'
            : 'bg-surface text-ink-muted border-hairline hover:border-strong hover:text-ink'
        }">${escapeHtml(skill.name)}</a>`;
      }),
  ].join('\n');

  const rowsHtml =
    posts.length > 0
      ? `<div class="divide-y divide-[var(--border-hairline)] border-t border-b border-hairline">
        ${posts
          .map(
            (post) => `<article class="editorial-row py-7 px-3 -mx-3 rounded-[5px]">
          <div class="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            <div class="md:col-span-3 space-y-2">
              <time datetime="${escapeHtml(post.published_at || post.created_at)}" class="block font-tabular text-xs text-ink-faint">
                ${escapeHtml(formatDate(post.published_at || post.created_at))}
              </time>
              <div class="flex flex-wrap gap-1.5">
                <a href="/blog?category=${encodeURIComponent(post.category_slug)}" class="badge-editorial badge-accent">${escapeHtml(findSkillName(skills, post.category_slug))}</a>
                <span class="badge-editorial">${escapeHtml(formatArchetype(post.archetype))}</span>
              </div>
              <div class="flex items-center gap-2 pt-1 font-tabular text-xs text-ink-faint">
                <span>${post.reading_time_minutes} min read</span>
                <span aria-hidden="true">&middot;</span>
                <span>${post.sources_json.length} sources</span>
              </div>
            </div>

            <div class="md:col-span-7 space-y-2.5">
              <h2 class="font-editorial text-2xl font-semibold leading-snug text-ink">
                <a href="/blog/${encodeURIComponent(post.slug)}" class="hover:text-accent transition-colors">${escapeHtml(post.title)}</a>
              </h2>
              <p class="text-[0.95rem] text-ink-secondary leading-relaxed">${escapeHtml(post.description)}</p>
              ${
                post.tldr_summary
                  ? `<p class="text-xs sm:text-[13px] text-ink-muted bg-subtle/80 border-l-2 border-[var(--border-strong)] pl-3 py-1.5 leading-relaxed">
                <strong class="font-tabular uppercase tracking-wider text-[10px] text-ink-faint mr-1.5">TL;DR</strong>${escapeHtml(post.tldr_summary)}
              </p>`
                  : ''
              }
            </div>

            <div class="md:col-span-2 flex md:flex-col items-center md:items-end justify-between gap-3">
              ${renderScoreBadge(post.quality_score)}
              <a href="/blog/${encodeURIComponent(post.slug)}" class="font-tabular text-xs font-medium text-accent hover:underline underline-offset-2">Read briefing &rarr;</a>
            </div>
          </div>
        </article>`,
          )
          .join('')}
      </div>`
      : `<div class="border border-hairline rounded-[6px] bg-surface p-10 text-center space-y-3">
        <p class="font-editorial text-2xl text-ink">No matching briefings found.</p>
        <p class="text-sm text-ink-muted">Try clearing your search query or switching to another research track.</p>
        <div class="pt-2">
          <a href="/blog" class="btn-ghost">Reset filters</a>
        </div>
      </div>`;

  const paginationHtml =
    totalPages > 1
      ? `<nav aria-label="Pagination" class="mt-10 flex items-center justify-between gap-4 border-t border-hairline pt-6">
        <div>
          ${
            page > 1
              ? `<a href="${escapeHtml(buildIndexUrl(page - 1, activeCategory, trimmedQuery))}" class="btn-ghost font-tabular text-xs">&larr; Previous</a>`
              : `<span class="btn-ghost opacity-40 pointer-events-none font-tabular text-xs">&larr; Previous</span>`
          }
        </div>
        <span class="font-tabular text-xs text-ink-muted">Page ${page} of ${totalPages}</span>
        <div>
          ${
            page < totalPages
              ? `<a href="${escapeHtml(buildIndexUrl(page + 1, activeCategory, trimmedQuery))}" class="btn-ghost font-tabular text-xs">Next &rarr;</a>`
              : `<span class="btn-ghost opacity-40 pointer-events-none font-tabular text-xs">Next &rarr;</span>`
          }
        </div>
      </nav>`
      : '';

  const indexBody = `<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
  <header class="pb-8 border-b border-strong space-y-6">
    <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
      <div class="space-y-2 max-w-2xl">
        <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">
          ${activeSkill ? `Research Track &middot; ${escapeHtml(activeSkill.slug)}` : 'Complete Archive'}
        </p>
        <h1 class="font-editorial text-3xl sm:text-5xl font-semibold text-ink leading-[1.08]">
          ${activeSkill ? escapeHtml(activeSkill.name) : 'Research Briefings'}
        </h1>
        <p class="text-base text-ink-muted leading-relaxed">
          ${
            activeSkill
              ? escapeHtml(activeSkill.description)
              : 'Primary-source technical dossiers, advisory teardowns, and benchmark indexes structured for rapid engineering review.'
          }
        </p>
      </div>

      <form id="search" method="GET" action="/blog" role="search" class="w-full lg:w-80 flex items-center gap-2">
        ${activeCategory ? `<input type="hidden" name="category" value="${escapeHtml(activeCategory)}">` : ''}
        <label for="blog-search-input" class="sr-only">Search briefings</label>
        <input id="blog-search-input" type="search" name="q" value="${escapeHtml(trimmedQuery)}" placeholder="Search titles, topics, CVEs..." class="admin-input h-10">
        <button type="submit" class="btn-primary h-10 px-4 shrink-0">Search</button>
      </form>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
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

  <div class="mt-6">
    ${rowsHtml}
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
   3. Single Blog Post Page (GEO + SEO + AdSense + High-Readability SSR)
   ========================================================================== */

export function renderBlogPostPage(opts: {
  settings: SiteSettings;
  post: PostRecord;
  skill?: CategorySkill | null;
  relatedPosts: PostRecord[];
  headings?: Array<{ id: string; level: number; text: string }>;
}): string {
  const { settings, post, skill, relatedPosts, headings = [] } = opts;
  const categoryName = skill?.name || post.category_slug.replace(/-/g, ' ');
  const authorName = post.author || settings.default_author || 'Editorial Desk';
  const publishedIso = post.published_at || post.created_at;
  const updatedIso = post.updated_at;
  const showUpdated =
    Boolean(updatedIso && publishedIso) &&
    formatDate(updatedIso) !== formatDate(publishedIso);
  const hasToc = headings.length >= 2;
  const markdownUrl = `/blog/${encodeURIComponent(post.slug)}.md`;

  const tldrHtml = post.tldr_summary
    ? `<section aria-label="Executive Summary" class="mt-8 rounded-[6px] border border-hairline border-l-[3px] border-l-[var(--accent)] bg-surface p-5 sm:p-6">
      <div class="flex items-center justify-between gap-2 mb-2">
        <span class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">TL;DR &middot; Direct Answer</span>
        <span class="font-tabular text-[11px] text-ink-faint">Key Takeaway</span>
      </div>
      <p class="text-[0.98rem] sm:text-base leading-[1.7] text-ink font-medium">${escapeHtml(post.tldr_summary)}</p>
    </section>`
    : '';

  const keyFactsHtml =
    post.key_facts_json.length > 0
      ? `<section aria-labelledby="key-facts-heading" class="mt-6 rounded-[6px] border border-hairline bg-surface overflow-hidden">
      <div class="px-5 py-3 bg-subtle border-b border-hairline flex items-center justify-between gap-3">
        <h2 id="key-facts-heading" class="font-tabular text-[11px] uppercase tracking-[0.14em] text-ink-muted font-semibold">Verified Key Facts</h2>
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
      <div class="sticky top-24 space-y-4">
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
            `<a href="/blog?q=${encodeURIComponent(tag)}" class="badge-editorial hover:border-strong hover:text-ink transition-colors">${escapeHtml(tag)}</a>`,
        )
        .join('')}
    </div>`
      : '';

  const faqHtml =
    post.faq_json.length > 0
      ? `<section id="faq" aria-labelledby="faq-heading" class="mt-14 pt-8 border-t border-strong">
      <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">Reference Q&amp;A</p>
      <h2 id="faq-heading" class="font-editorial text-2xl sm:text-3xl font-semibold text-ink mt-1 mb-5">Frequently Asked Questions</h2>
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
      ? `<section id="sources" aria-labelledby="sources-heading" class="mt-14 pt-8 border-t border-strong scroll-mt-24">
      <div class="flex items-baseline justify-between gap-3 mb-4">
        <div>
          <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">Provenance</p>
          <h2 id="sources-heading" class="font-editorial text-2xl font-semibold text-ink mt-1">Primary Sources &amp; Citations</h2>
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

  const authorCardHtml = `<section aria-label="Author and verification" class="mt-12 rounded-[6px] border border-hairline bg-surface p-6">
    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div class="space-y-2">
        <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-ink-faint font-semibold">Editorial Verification</p>
        <h2 class="font-editorial text-xl font-semibold text-ink">
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
    relatedPosts.length > 0
      ? `<section aria-labelledby="related-heading" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-10 border-t border-strong">
      <div class="flex items-end justify-between gap-4 mb-6">
        <div>
          <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">Continue Reading</p>
          <h2 id="related-heading" class="font-editorial text-2xl sm:text-3xl font-semibold text-ink mt-1">Related Briefings</h2>
        </div>
        <a href="/blog?category=${encodeURIComponent(post.category_slug)}" class="font-tabular text-xs text-ink-muted hover:text-accent">More in ${escapeHtml(categoryName)} &rarr;</a>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        ${relatedPosts
          .slice(0, 3)
          .map(
            (rel) => `<article class="editorial-card p-5 flex flex-col justify-between gap-4">
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2 font-tabular text-[11px] text-ink-faint">
              <span>${escapeHtml(formatArchetype(rel.archetype))}</span>
              <span>${rel.reading_time_minutes} min</span>
            </div>
            <h3 class="font-editorial text-lg font-semibold leading-snug text-ink">
              <a href="/blog/${encodeURIComponent(rel.slug)}" class="hover:text-accent transition-colors">${escapeHtml(rel.title)}</a>
            </h3>
            <p class="text-sm text-ink-muted leading-relaxed line-clamp-3">${escapeHtml(rel.description)}</p>
          </div>
          <div class="pt-3 border-t border-hairline flex items-center justify-between text-xs font-tabular text-ink-faint">
            <span>${escapeHtml(formatDate(rel.published_at || rel.created_at))}</span>
            ${renderScoreBadge(rel.quality_score)}
          </div>
        </article>`,
          )
          .join('')}
      </div>
    </section>`
      : '';

  const articleBody = `<article class="pt-8 sm:pt-12">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
    <nav aria-label="Breadcrumb" class="mb-6 flex flex-wrap items-center gap-2 font-tabular text-xs text-ink-faint">
      <a href="/" class="hover:text-ink transition-colors">Home</a>
      <span aria-hidden="true">/</span>
      <a href="/blog" class="hover:text-ink transition-colors">Briefings</a>
      <span aria-hidden="true">/</span>
      <a href="/blog?category=${encodeURIComponent(post.category_slug)}" class="hover:text-ink transition-colors">${escapeHtml(categoryName)}</a>
      <span aria-hidden="true">/</span>
      <span class="text-ink-muted truncate max-w-[240px] sm:max-w-md" aria-current="page">${escapeHtml(post.title)}</span>
    </nav>

    <header class="max-w-4xl pb-8 border-b border-strong space-y-5">
      <div class="flex flex-wrap items-center gap-2">
        <a href="/blog?category=${encodeURIComponent(post.category_slug)}" class="badge-editorial badge-accent">${escapeHtml(categoryName)}</a>
        <span class="badge-editorial">${escapeHtml(formatArchetype(post.archetype))}</span>
        ${renderScoreBadge(post.quality_score)}
      </div>

      <h1 class="font-editorial text-3xl sm:text-4xl lg:text-[2.85rem] font-semibold leading-[1.1] text-ink">
        ${escapeHtml(post.title)}
      </h1>

      <p class="text-lg sm:text-[1.1875rem] text-ink-secondary leading-relaxed">
        ${escapeHtml(post.description)}
      </p>

      <div class="pt-2 flex flex-wrap items-center justify-between gap-4 font-tabular text-xs text-ink-muted">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span>By <a href="/about" class="text-ink font-medium hover:text-accent underline underline-offset-2">${escapeHtml(authorName)}</a></span>
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

        <a href="${markdownUrl}" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border border-hairline bg-surface hover:border-strong hover:text-accent transition-colors text-ink-secondary" title="Raw Markdown edition for developers and AI agents">
          <span>View Markdown (.md)</span>
        </a>
      </div>
    </header>

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
    <p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">${escapeHtml(page.eyebrow)}</p>
    <h1 class="font-editorial text-3xl sm:text-5xl font-semibold text-ink leading-[1.08]">${escapeHtml(page.title)}</h1>
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
  <p class="font-tabular text-xs uppercase tracking-[0.16em] text-accent font-semibold">Error 404</p>
  <h1 class="font-editorial text-4xl sm:text-5xl font-semibold text-ink">Briefing Not Found</h1>
  <p class="text-base text-ink-muted max-w-lg mx-auto leading-relaxed">
    The requested dossier on ${escapeHtml(siteName)} may have been moved, unpublished, or the URL may contain a typo.
  </p>
  <div class="pt-2 flex flex-wrap items-center justify-center gap-3">
    <a href="/" class="btn-primary">Return Home</a>
    <a href="/blog" class="btn-ghost">Browse All Briefings</a>
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
