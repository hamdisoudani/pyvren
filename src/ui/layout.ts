import { normalizeBaseUrl } from '../env';
import { escapeHtml, safeJsonLd } from '../lib/security';
import type { SiteSettings } from '../types';

export interface PublicLayoutOptions {
  title: string;
  description: string;
  canonicalUrl: string;
  settings: SiteSettings;
  ogType?: 'website' | 'article';
  publishedAt?: string | null;
  updatedAt?: string | null;
  author?: string;
  jsonLd?: unknown[];
  bodyHtml: string;
  currentPath?: string;
  extraHead?: string;
  markdownAlternateUrl?: string;
}

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';

function renderBrandMark(): string {
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
  <rect x="1.5" y="1.5" width="21" height="21" rx="3" stroke="currentColor" stroke-width="1.5"/>
  <path d="M7.5 16.5V7.5H13.25C15.1 7.5 16.25 8.55 16.25 10.2C16.25 11.85 15.1 12.9 13.25 12.9H7.5" stroke="currentColor" stroke-width="1.65" stroke-linecap="square"/>
  <path d="M13.5 16.5L17 13" stroke="var(--accent)" stroke-width="1.75" stroke-linecap="square"/>
</svg>`;
}

function isNavActive(currentPath: string | undefined, target: string): boolean {
  if (!currentPath) return false;
  if (target === '/blog') {
    return currentPath === '/blog' || currentPath.startsWith('/blog/');
  }
  return currentPath === target;
}

export function renderPublicLayout(opts: PublicLayoutOptions): string {
  const {
    title,
    description,
    canonicalUrl,
    settings,
    ogType = 'website',
    publishedAt,
    updatedAt,
    author,
    jsonLd = [],
    bodyHtml,
    currentPath = '/',
    extraHead = '',
    markdownAlternateUrl,
  } = opts;

  const baseUrl = normalizeBaseUrl(settings.base_url);
  const siteName = settings.site_name || 'Pyvren';
  const tagline = settings.site_tagline || 'Independent technical briefings and primary-source engineering analysis.';
  const adsenseClientId = (settings.adsense_client_id || '').trim();
  const currentYear = new Date().getUTCFullYear();

  const organizationSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: baseUrl,
    description: tagline,
  };
  if (settings.contact_email) {
    organizationSchema.email = settings.contact_email;
  }

  const allJsonLd = [organizationSchema, ...jsonLd];
  const jsonLdScripts = allJsonLd
    .map((item) => `<script type="application/ld+json">${safeJsonLd(item)}</script>`)
    .join('\n  ');

  const articleMetaTags =
    ogType === 'article'
      ? [
          publishedAt
            ? `<meta property="article:published_time" content="${escapeHtml(publishedAt)}">`
            : '',
          updatedAt
            ? `<meta property="article:modified_time" content="${escapeHtml(updatedAt)}">`
            : '',
          author
            ? `<meta property="article:author" content="${escapeHtml(author)}">`
            : '',
        ]
          .filter(Boolean)
          .join('\n  ')
      : '';

  const markdownLinkTag = markdownAlternateUrl
    ? `<link rel="alternate" type="text/markdown" title="Markdown briefing" href="${escapeHtml(markdownAlternateUrl)}">`
    : '';

  const adsenseScriptTag = adsenseClientId
    ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClientId)}" crossorigin="anonymous"></script>`
    : '';

  const navItems = [
    { href: '/blog', label: 'Briefings' },
    { href: '/#categories', label: 'Categories' },
    { href: '/editorial-policy', label: 'Editorial Policy' },
    { href: '/about', label: 'About' },
  ];

  const desktopNavHtml = navItems
    .map((item) => {
      const active = isNavActive(currentPath, item.href);
      return `<a href="${item.href}" class="nav-link"${active ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`;
    })
    .join('\n          ');

  const mobileNavHtml = navItems
    .map(
      (item) =>
        `<a href="${item.href}" class="block px-4 py-2.5 text-sm font-medium text-ink hover:bg-subtle border-b border-hairline last:border-b-0">${escapeHtml(item.label)}</a>`,
    )
    .join('\n            ');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(siteName)} RSS Feed" href="${escapeHtml(baseUrl)}/rss.xml">
  ${markdownLinkTag}
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:site_name" content="${escapeHtml(siteName)}">
  <meta property="og:type" content="${escapeHtml(ogType)}">
  ${articleMetaTags}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${GOOGLE_FONTS_HREF}">
  <link rel="stylesheet" href="/assets/app.css">
  <script>(function(){try{var s=localStorage.getItem('pyvren-theme');var t=(s==='dark'||s==='light')?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();</script>
  ${jsonLdScripts}
  ${adsenseScriptTag}
  ${extraHead}
</head>
<body class="min-h-screen flex flex-col bg-paper text-ink antialiased">
  <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-2 focus:rounded focus:bg-surface focus:text-ink focus:border focus:border-strong">Skip to main content</a>

  <header class="editorial-topbar sticky top-0 z-40">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
      <div class="flex items-center gap-6 min-w-0">
        <a href="/" class="inline-flex items-center gap-2.5 text-ink hover:opacity-90 transition-opacity" aria-label="${escapeHtml(siteName)} home">
          ${renderBrandMark()}
          <span class="font-editorial text-xl font-semibold tracking-tight leading-none">${escapeHtml(siteName)}</span>
        </a>
        <span class="hidden xl:inline-block h-4 w-px bg-[var(--border-hairline)]" aria-hidden="true"></span>
        <span class="hidden xl:inline-block font-tabular text-[11px] uppercase tracking-[0.12em] text-ink-faint truncate max-w-[260px]">Technical Briefings</span>
      </div>

      <nav aria-label="Primary navigation" class="hidden md:flex items-center gap-7">
        ${desktopNavHtml}
      </nav>

      <div class="flex items-center gap-2">
        <a href="/blog#search" class="inline-flex items-center justify-center h-9 px-2.5 rounded-[5px] border border-hairline text-ink-muted hover:text-ink hover:bg-subtle transition-colors text-xs font-medium gap-1.5" aria-label="Search briefings">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
          <span class="hidden sm:inline">Search</span>
        </a>

        <button type="button" id="theme-toggle" class="inline-flex items-center justify-center w-9 h-9 rounded-[5px] border border-hairline text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer" aria-label="Toggle color theme" title="Toggle light or dark appearance">
          <svg data-theme-icon="sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="hidden" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/></svg>
          <svg data-theme-icon="moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>

        <details class="relative md:hidden">
          <summary class="list-none inline-flex items-center justify-center w-9 h-9 rounded-[5px] border border-hairline text-ink-muted hover:text-ink hover:bg-subtle cursor-pointer" aria-label="Open menu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </summary>
          <nav aria-label="Mobile navigation" class="absolute right-0 mt-2 w-56 rounded-[6px] bg-surface border border-strong shadow-lg overflow-hidden z-50">
            ${mobileNavHtml}
            <a href="/blog#search" class="block px-4 py-2.5 text-sm font-medium text-accent hover:bg-subtle border-t border-hairline">Search Briefings</a>
          </nav>
        </details>
      </div>
    </div>
  </header>

  <main id="main-content" class="flex-1">
    ${bodyHtml}
  </main>

  <footer class="mt-20 border-t border-hairline bg-subtle/50">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-hairline">
        <div class="md:col-span-6 space-y-3">
          <a href="/" class="inline-flex items-center gap-2.5 text-ink">
            ${renderBrandMark()}
            <span class="font-editorial text-lg font-semibold tracking-tight">${escapeHtml(siteName)}</span>
          </a>
          <p class="text-sm leading-relaxed text-ink-muted max-w-md">${escapeHtml(tagline)}</p>
          <p class="font-tabular text-xs text-ink-faint">Edited by ${escapeHtml(settings.default_author || 'Editorial Desk')} · Primary-source verified technical journalism.</p>
        </div>

        <div class="md:col-span-3 space-y-3">
          <h2 class="font-tabular text-[11px] uppercase tracking-[0.12em] text-ink-faint font-semibold">Publication</h2>
          <ul class="space-y-2 text-sm">
            <li><a href="/blog" class="text-ink-secondary hover:text-accent transition-colors">All Briefings</a></li>
            <li><a href="/about" class="text-ink-secondary hover:text-accent transition-colors">About &amp; Masthead</a></li>
            <li><a href="/editorial-policy" class="text-ink-secondary hover:text-accent transition-colors">Editorial &amp; Verification Policy</a></li>
            <li><a href="/privacy" class="text-ink-secondary hover:text-accent transition-colors">Privacy &amp; Ad Policy</a></li>
            <li><a href="/contact" class="text-ink-secondary hover:text-accent transition-colors">Contact Desk</a></li>
          </ul>
        </div>

        <div class="md:col-span-3 space-y-3">
          <h2 class="font-tabular text-[11px] uppercase tracking-[0.12em] text-ink-faint font-semibold">Machine-Readable</h2>
          <ul class="space-y-2 text-sm font-tabular text-[13px]">
            <li><a href="/rss.xml" class="text-ink-secondary hover:text-accent transition-colors">/rss.xml</a></li>
            <li><a href="/sitemap.xml" class="text-ink-secondary hover:text-accent transition-colors">/sitemap.xml</a></li>
            <li><a href="/llms.txt" class="text-ink-secondary hover:text-accent transition-colors">/llms.txt</a></li>
            <li><a href="/api/v1/posts" class="text-ink-secondary hover:text-accent transition-colors">/api/v1/posts</a></li>
          </ul>
        </div>
      </div>

      <div class="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-ink-faint">
        <p>&copy; ${currentYear} ${escapeHtml(siteName)}. All rights reserved.</p>
        <p class="font-tabular">Server-rendered HTML · Zero tracking bloat · Structured for humans &amp; retrieval engines</p>
      </div>
    </div>
  </footer>

  <script>(function(){
    var root=document.documentElement;
    var btn=document.getElementById('theme-toggle');
    function syncIcons(){
      var dark=root.getAttribute('data-theme')==='dark';
      var sun=btn&&btn.querySelector('[data-theme-icon="sun"]');
      var moon=btn&&btn.querySelector('[data-theme-icon="moon"]');
      if(sun&&moon){
        sun.classList.toggle('hidden',!dark);
        moon.classList.toggle('hidden',dark);
      }
    }
    syncIcons();
    if(btn){
      btn.addEventListener('click',function(){
        var next=root.getAttribute('data-theme')==='dark'?'light':'dark';
        if(next==='dark'){root.setAttribute('data-theme','dark');}else{root.removeAttribute('data-theme');}
        try{localStorage.setItem('pyvren-theme',next);}catch(e){}
        syncIcons();
      });
    }
    var tocLinks=document.querySelectorAll('[data-toc-link]');
    if(tocLinks.length>0&&'IntersectionObserver' in window){
      var map=new Map();
      var targets=[];
      tocLinks.forEach(function(a){
        var id=(a.getAttribute('href')||'').replace(/^#/,'');
        var el=id?document.getElementById(id):null;
        if(el){map.set(el,a);targets.push(el);}
      });
      if(targets.length>0){
        var activeLink=null;
        var io=new IntersectionObserver(function(entries){
          entries.forEach(function(entry){
            if(entry.isIntersecting){
              var link=map.get(entry.target);
              if(link&&link!==activeLink){
                if(activeLink){activeLink.classList.remove('is-active');}
                link.classList.add('is-active');
                activeLink=link;
              }
            }
          });
        },{rootMargin:'-84px 0px -68% 0px',threshold:0.01});
        targets.forEach(function(el){io.observe(el);});
      }
    }
  })();</script>
</body>
</html>`;
}
