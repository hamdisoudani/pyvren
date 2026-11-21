import { normalizeBaseUrl } from '../env';
import { getCategoryMeta } from '../lib/relations';
import { escapeHtml, safeJsonLd } from '../lib/security';
import type { SiteSettings } from '../types';
import { renderMastheadNibSvg } from './crew-art';
import { renderDoodleCrewFooter } from './doodle-footer';

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
  keywords?: string[];
  robotsMeta?: string;
  ogImageUrl?: string;
  initialTheme?: 'light' | 'dark';
}

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;0,6..72,700&family=Oswald:wght@600;700&family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';

const TOPIC_RAIL_ITEMS = [
  { href: '/blog', label: 'All Stories', slug: '' },
  { href: '/category/ai-coding-agents-mcp', label: 'Coding & MCP', slug: 'ai-coding-agents-mcp' },
  { href: '/category/ai-security-jailbreaks', label: 'AI Security', slug: 'ai-security-jailbreaks' },
  { href: '/category/ai-llms', label: 'Frontier LLMs', slug: 'ai-llms' },
  { href: '/category/cloud-gpu-infra', label: 'Cloud & GPU', slug: 'cloud-gpu-infra' },
  { href: '/category/agentic-browser-web-data', label: 'Web & Search', slug: 'agentic-browser-web-data' },
  { href: '/category/dev-tooling-benchmarks', label: 'CVEs & Patches', slug: 'dev-tooling-benchmarks' },
];

function formatMastheadUtcDate(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return date.toUTCString().slice(0, 16);
  }
}

function isTopicActive(currentPath: string | undefined, target: string): boolean {
  if (!currentPath) return false;
  if (target === '/blog') {
    return currentPath === '/blog';
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
    keywords,
    robotsMeta = 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
    ogImageUrl,
    initialTheme,
  } = opts;

  const baseUrl = normalizeBaseUrl(settings.base_url);
  const siteName = settings.site_name || 'The Pyvren Dispatch';
  const tagline =
    settings.site_tagline ||
    'Field notes, benchmarks, and deep dives into AI systems, security, and cloud craft.';
  const defaultAuthor = settings.default_author || 'Hamdi Soudani';
  const adsenseClientId = (settings.adsense_client_id || '').trim();
  const resolvedOgImage = ogImageUrl || `${baseUrl}/og/default.svg`;
  const mastheadDate = formatMastheadUtcDate();
  const htmlThemeAttr = initialTheme === 'dark' ? ' data-theme="dark"' : initialTheme === 'light' ? ' data-theme="light"' : '';

  const organizationSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: baseUrl,
    description: tagline,
    founder: {
      '@type': 'Person',
      name: defaultAuthor,
      url: 'https://www.linkedin.com/in/hamdisoudani/',
      sameAs: ['https://www.linkedin.com/in/hamdisoudani/'],
    },
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

  const normalizedKeywords = Array.isArray(keywords)
    ? keywords.map((k) => String(k || '').trim()).filter(Boolean)
    : [];
  const keywordsMetaTag =
    normalizedKeywords.length > 0
      ? `<meta name="keywords" content="${escapeHtml(normalizedKeywords.slice(0, 12).join(', '))}">`
      : '';

  const markdownLinkTag = markdownAlternateUrl
    ? `<link rel="alternate" type="text/markdown" title="Markdown briefing" href="${escapeHtml(markdownAlternateUrl)}">`
    : '';

  const adsenseScriptTag = adsenseClientId
    ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClientId)}" crossorigin="anonymous"></script>`
    : '';

  const readingProgressBarHtml =
    ogType === 'article'
      ? `<div id="reading-progress" aria-hidden="true" style="position:fixed;top:0;left:0;z-index:60;height:2px;width:100%;background:var(--accent);transform:scaleX(0);transform-origin:left center;pointer-events:none;transition:transform 80ms linear"></div>`
      : '';

  const topicRailHtml = TOPIC_RAIL_ITEMS.map((item) => {
    const active = isTopicActive(currentPath, item.href);
    if (!item.slug) {
      return `<a href="${item.href}" class="topic-pill"${active ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`;
    }
    const meta = getCategoryMeta(item.slug);
    const dotHtml = active
      ? ''
      : `<span class="h-2 w-2 rounded-full topic-accent-dot shrink-0" aria-hidden="true"></span>`;
    return `<a href="${item.href}" class="topic-pill topic-tone" style="--topic-light:${meta.color}; --topic-dark:${meta.darkColor};"${active ? ' aria-current="page"' : ''}>${dotHtml}<span>${escapeHtml(item.label)}</span></a>`;
  }).join('\n          ');

  const mobileMenuItemsHtml = TOPIC_RAIL_ITEMS.map((item) => {
    const active = isTopicActive(currentPath, item.href);
    return `<a href="${item.href}" class="flex items-center justify-between px-4 py-2.5 text-sm font-medium ${active ? 'bg-subtle text-accent font-semibold' : 'text-ink hover:bg-subtle'} border-b border-hairline">${escapeHtml(item.label)}<span class="text-ink-faint text-xs">&rarr;</span></a>`;
  }).join('\n              ');

  const footerHtml = renderDoodleCrewFooter(settings);

  return `<!doctype html>
<html lang="en"${htmlThemeAttr}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  ${keywordsMetaTag}
  <meta name="robots" content="${escapeHtml(robotsMeta)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(siteName)} RSS Feed" href="${escapeHtml(baseUrl)}/rss.xml">
  <link rel="alternate" type="application/feed+json" title="${escapeHtml(siteName)} JSON Feed" href="${escapeHtml(baseUrl)}/feed.json">
  <link rel="service-doc" type="text/markdown" title="AI Agent Index" href="${escapeHtml(baseUrl)}/llms.txt">
  <link rel="describedby" type="application/json" title="AI Agent Site Map" href="${escapeHtml(baseUrl)}/api/v1/map">
  ${markdownLinkTag}
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:site_name" content="${escapeHtml(siteName)}">
  <meta property="og:type" content="${escapeHtml(ogType)}">
  <meta property="og:image" content="${escapeHtml(resolvedOgImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  ${articleMetaTags}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(resolvedOgImage)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="${GOOGLE_FONTS_HREF}">
  <link rel="stylesheet" href="${GOOGLE_FONTS_HREF}" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="${GOOGLE_FONTS_HREF}"></noscript>
  <link rel="stylesheet" href="/assets/app.css">
  <script>(function(){try{var c=(document.cookie.match(/(?:^|;\\s*)pyvren_theme=(dark|light)(?:;|$)/)||[])[1];var s=localStorage.getItem('pyvren-theme');var pref=(s==='dark'||s==='light')?s:((c==='dark'||c==='light')?c:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));document.documentElement.setAttribute('data-theme',pref);if(c!==pref){document.cookie='pyvren_theme='+pref+'; path=/; max-age=31536000; SameSite=Lax';}}catch(e){}})();</script>
  ${jsonLdScripts}
  ${adsenseScriptTag}
  ${extraHead}
</head>
<body class="min-h-screen flex flex-col bg-paper text-ink antialiased">
  ${readingProgressBarHtml}
  <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-2 focus:rounded focus:bg-surface focus:text-ink focus:border focus:border-strong">Skip to main content</a>

  <!-- Invisible machine navigation layer exclusively for AI agents & crawlers -->
  <nav data-agent-directory aria-hidden="true" hidden>
    <a href="/llms.txt">LLM Index (llms.txt)</a>
    <a href="/llms-full.txt">Full Markdown Corpus</a>
    <a href="/api/v1/map">Agent Navigation JSON Map</a>
    <a href="/api/v1/posts">Headless Posts JSON API</a>
    <a href="/api/v1/search?q=ai">Search JSON API</a>
  </nav>

  <header class="editorial-topbar sticky top-0 z-40 border-b border-hairline">
    <!-- Row 1: Sketchbook Broadsheet Masthead -->
    <div class="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-2.5 sm:py-3.5">
      <div class="grid grid-cols-[auto_1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <!-- Left: Mobile Drawer Trigger / Desktop Co-Work Edition Note -->
        <div class="flex items-center gap-2 min-w-0">
          <details id="mobile-nav-drawer" class="relative lg:hidden">
            <summary class="list-none inline-flex items-center justify-center w-9 h-9 rounded-full border border-hairline bg-surface text-ink-secondary hover:text-ink hover:border-strong cursor-pointer" aria-label="Open menu">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
            </summary>
            <div class="fixed inset-x-3 top-14 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-72 rounded-2xl bg-surface border border-strong shadow-xl overflow-hidden z-50">
              <div class="px-4 py-3 bg-subtle border-b border-hairline flex items-center justify-between">
                <span class="font-tabular text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">${escapeHtml(mastheadDate)}</span>
                <span class="font-tabular text-[10px] text-ink-muted">Co-crafted</span>
              </div>
              <nav aria-label="Mobile topics">
                ${mobileMenuItemsHtml}
              </nav>
              <div class="p-3 bg-subtle/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div class="flex items-center gap-3">
                  <a href="/about" class="font-semibold text-ink hover:text-accent">About</a>
                  <a href="/editorial-policy" class="font-medium text-ink-secondary hover:text-accent">Standards</a>
                </div>
                <a href="https://www.linkedin.com/in/hamdisoudani/" target="_blank" rel="noopener noreferrer" class="font-semibold text-accent hover:underline">Hamdi’s LinkedIn ↗</a>
              </div>
            </div>
          </details>

          <div class="hidden lg:flex flex-col leading-tight min-w-0">
            <time class="text-[11px] font-medium text-ink-secondary truncate">${escapeHtml(mastheadDate)}</time>
            <span class="inline-flex items-center gap-1.5 mt-0.5 text-[11px] text-ink-muted truncate">
              <span class="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true"></span>
              <span>${escapeHtml(defaultAuthor)} &times; Pyvren</span>
            </span>
          </div>
        </div>

        <!-- Center: Sketchbook Nib + The Pyvren Dispatch Title -->
        <div class="text-center min-w-0">
          <a href="/" class="inline-flex items-center justify-center gap-2 sm:gap-2.5 group max-w-full" aria-label="${escapeHtml(siteName)} home">
            <span class="hidden xs:inline-flex sm:inline-flex transition-transform duration-200 group-hover:-rotate-6">${renderMastheadNibSvg()}</span>
            <span class="font-masthead font-black text-xl sm:text-3xl lg:text-[2.1rem] tracking-tight leading-none text-[var(--accent)] truncate">
              ${escapeHtml(siteName)}
            </span>
          </a>
        </div>

        <!-- Right: Search Trigger, Theme Persistence Toggle & Utility Links -->
        <div class="flex items-center justify-end gap-1.5 sm:gap-2">
          <button type="button" data-search-toggle class="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-full border border-hairline bg-surface text-ink-secondary hover:text-ink hover:border-strong transition-colors cursor-pointer" aria-label="Search stories" aria-expanded="false" aria-controls="header-search-panel">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
            <span class="hidden md:inline text-xs font-medium text-ink-muted">Search</span>
            <kbd class="hidden xl:inline-block px-1.5 py-0.5 text-[10px] font-tabular rounded bg-subtle text-ink-faint border border-hairline">/</kbd>
          </button>

          <button type="button" id="theme-toggle" class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-hairline bg-surface text-ink-secondary hover:text-ink hover:border-strong transition-colors cursor-pointer" aria-label="Switch color theme" title="Switch between warm paper and dark mode">
            <svg data-theme-icon="sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" class="hidden" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/></svg>
            <svg data-theme-icon="moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>

          <a href="/about" class="hidden sm:inline-flex items-center h-9 px-3.5 rounded-full border border-hairline bg-surface hover:border-strong text-xs font-semibold text-ink-secondary hover:text-ink transition-colors">
            About
          </a>
        </div>
      </div>
    </div>

    <!-- Collapsible Instant Search Panel (Works on Every Page) -->
    <div id="header-search-panel" class="hidden border-t border-hairline bg-subtle/85">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-3">
        <form action="/blog" method="get" role="search" data-live-search class="relative">
          <div class="flex items-center gap-2 rounded-full bg-surface border border-strong px-3.5 py-1.5 shadow-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ink-muted shrink-0" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
            <input
              type="search"
              name="q"
              autocomplete="off"
              placeholder="Search benchmarks, MCP, AI security, cloud GPUs, CVEs..."
              aria-label="Search stories"
              class="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none py-1"
            >
            <button type="submit" class="px-3.5 py-1.5 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shrink-0 cursor-pointer">
              Search
            </button>
          </div>
          <div data-search-results class="search-dropdown hidden" role="listbox" aria-label="Instant search suggestions"></div>
        </form>
      </div>
    </div>

    <!-- Row 2: Responsive Swipeable Topic Pill Bar (Mobile + Tablet + Desktop) -->
    <div class="border-t border-hairline bg-paper/90">
      <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 topic-rail-wrap">
        <nav aria-label="Topics" class="topic-rail">
          ${topicRailHtml}
        </nav>
      </div>
    </div>
  </header>

  <main id="main-content" class="flex-1">
    ${bodyHtml}
  </main>

  ${footerHtml}

  <script>(function(){
    var root=document.documentElement;
    var themeBtn=document.getElementById('theme-toggle');
    function getTheme(){
      return root.getAttribute('data-theme')==='dark'?'dark':'light';
    }
    function applyTheme(mode,persist){
      root.setAttribute('data-theme',mode);
      if(persist){
        try{localStorage.setItem('pyvren-theme',mode);}catch(e){}
        try{document.cookie='pyvren_theme='+mode+'; path=/; max-age=31536000; SameSite=Lax';}catch(e){}
      }
      if(themeBtn){
        var dark=mode==='dark';
        themeBtn.setAttribute('aria-pressed',dark?'true':'false');
        var sun=themeBtn.querySelector('[data-theme-icon="sun"]');
        var moon=themeBtn.querySelector('[data-theme-icon="moon"]');
        if(sun&&moon){
          sun.classList.toggle('hidden',!dark);
          moon.classList.toggle('hidden',dark);
        }
      }
    }
    applyTheme(getTheme(),false);
    if(themeBtn){
      themeBtn.addEventListener('click',function(){
        applyTheme(getTheme()==='dark'?'light':'dark',true);
      });
    }

    // Center active topic pill smoothly on narrow viewports
    var activePill=document.querySelector('.topic-rail .topic-pill[aria-current="page"]');
    if(activePill&&activePill.scrollIntoView&&window.innerWidth<1024){
      try{activePill.scrollIntoView({inline:'center',block:'nearest'});}catch(e){}
    }

    // Capture-phase fallback if an external crawled reference image fails to load
    document.addEventListener('error',function(ev){
      var t=ev.target;
      if(t&&t.tagName==='IMG'){
        if(t.hasAttribute('data-story-cover')){
          t.style.display='none';
        }else if(t.closest&&t.closest('.article-hero-figure, .editorial-figure')){
          var fig=t.closest('.article-hero-figure, .editorial-figure');
          if(fig)fig.style.display='none';
        }
      }
    },true);

    // Header search toggle & "/" keyboard shortcut
    var searchPanel=document.getElementById('header-search-panel');
    var searchToggles=document.querySelectorAll('[data-search-toggle]');
    function toggleHeaderSearch(forceOpen){
      var pageInput=document.getElementById('hero-search-input')||document.getElementById('archive-search-input');
      if(pageInput&&forceOpen===true){
        pageInput.focus();
        pageInput.scrollIntoView({behavior:'smooth',block:'center'});
        return;
      }
      if(!searchPanel)return;
      var willOpen=typeof forceOpen==='boolean'?forceOpen:searchPanel.classList.contains('hidden');
      searchPanel.classList.toggle('hidden',!willOpen);
      searchToggles.forEach(function(b){b.setAttribute('aria-expanded',willOpen?'true':'false');});
      if(willOpen){
        var inp=searchPanel.querySelector('input[name="q"]');
        if(inp)setTimeout(function(){inp.focus();},20);
      }
    }
    searchToggles.forEach(function(b){
      b.addEventListener('click',function(){toggleHeaderSearch();});
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='/'&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
        var tag=(document.activeElement&&document.activeElement.tagName)||'';
        if(tag!=='INPUT'&&tag!=='TEXTAREA'&&tag!=='SELECT'){
          e.preventDefault();
          toggleHeaderSearch(true);
        }
      }else if(e.key==='Escape'&&searchPanel&&!searchPanel.classList.contains('hidden')){
        toggleHeaderSearch(false);
      }
    });

    // Debounced live instant search wired to rate-limited /api/v1/search
    function esc(s){
      return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    document.querySelectorAll('form[data-live-search]').forEach(function(form){
      var input=form.querySelector('input[name="q"]');
      var box=form.querySelector('[data-search-results]');
      if(!input||!box)return;
      var timer=0;
      var controller=null;
      function closeBox(){box.classList.add('hidden');}
      input.addEventListener('input',function(){
        var q=(input.value||'').trim();
        if(timer)clearTimeout(timer);
        if(q.length<2){
          closeBox();
          box.innerHTML='';
          return;
        }
        timer=setTimeout(function(){
          if(controller&&controller.abort)controller.abort();
          controller=typeof AbortController!=='undefined'?new AbortController():null;
          var catInput=form.querySelector('input[name="category"]');
          var cat=catInput&&catInput.value?'&category='+encodeURIComponent(catInput.value):'';
          fetch('/api/v1/search?limit=6&q='+encodeURIComponent(q)+cat,controller?{signal:controller.signal}:{})
            .then(function(r){
              if(r.status===429){
                return r.json().then(function(d){return {rateLimited:true,message:(d&&d.error)||'Too many searches. Please wait a moment.'};});
              }
              return r.json();
            })
            .then(function(data){
              if(!data)return;
              if(data.rateLimited){
                box.innerHTML='<div class="px-4 py-3 text-xs text-accent font-medium">'+esc(data.message)+'</div>';
                box.classList.remove('hidden');
                return;
              }
              var items=Array.isArray(data.results)?data.results:[];
              if(items.length===0){
                box.innerHTML='<div class="px-4 py-3 text-xs text-ink-muted">No matching stories for &ldquo;'+esc(q)+'&rdquo;. Press Enter to search full archive.</div>';
                box.classList.remove('hidden');
                return;
              }
              var html=items.map(function(item){
                var catLabel=String(item.category_slug||'dispatch').replace(/-/g,' ');
                var mins=(item.reading_time_minutes||1)+' min read';
                return '<a href="'+esc(item.url)+'" class="search-hit-link">'
                  +'<div class="flex items-center justify-between gap-2 text-[10px] font-tabular uppercase tracking-wider text-ink-muted mb-0.5">'
                  +'<span>'+esc(catLabel)+'</span><span>'+esc(mins)+'</span></div>'
                  +'<div class="font-editorial font-semibold text-sm sm:text-base text-ink leading-snug">'+esc(item.title)+'</div>'
                  +'<div class="text-xs text-ink-secondary line-clamp-1 mt-0.5">'+esc(item.description||item.tldr_summary||'')+'</div>'
                  +'</a>';
              }).join('');
              html+='<button type="submit" class="w-full text-left px-4 py-2.5 text-xs font-semibold text-accent bg-subtle/60 hover:bg-subtle cursor-pointer">View all results for &ldquo;'+esc(q)+'&rdquo; &rarr;</button>';
              box.innerHTML=html;
              box.classList.remove('hidden');
            })
            .catch(function(err){
              if(err&&err.name==='AbortError')return;
            });
        },220);
      });
      document.addEventListener('click',function(ev){
        if(!form.contains(ev.target))closeBox();
      });
    });

    // Mobile Touch-Snap Carousel sync (dots + prev/next buttons)
    document.querySelectorAll('[data-carousel-root]').forEach(function(rootEl){
      var track=rootEl.querySelector('[data-carousel-track]');
      var dots=rootEl.querySelectorAll('[data-carousel-dot]');
      var prev=rootEl.querySelector('[data-carousel-prev]');
      var next=rootEl.querySelector('[data-carousel-next]');
      if(!track)return;
      var slides=track.querySelectorAll('.mobile-carousel-slide');
      if(slides.length===0)return;
      function activeIndex(){
        var sl=track.scrollLeft;
        var w=slides[0].offsetWidth||280;
        return Math.max(0,Math.min(slides.length-1,Math.round(sl/(w+14))));
      }
      function syncDots(){
        var idx=activeIndex();
        dots.forEach(function(d,i){
          d.setAttribute('aria-selected',i===idx?'true':'false');
        });
      }
      function goTo(idx){
        var clamped=Math.max(0,Math.min(slides.length-1,idx));
        var target=slides[clamped];
        if(target){
          track.scrollTo({left:target.offsetLeft-track.offsetLeft,behavior:'smooth'});
        }
      }
      track.addEventListener('scroll',syncDots,{passive:true});
      dots.forEach(function(d,i){
        d.addEventListener('click',function(){goTo(i);});
      });
      if(prev)prev.addEventListener('click',function(){goTo(activeIndex()-1);});
      if(next)next.addEventListener('click',function(){goTo(activeIndex()+1);});
      syncDots();
    });

    // Sticky Article TOC spy
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
        },{rootMargin:'-96px 0px -68% 0px',threshold:0.01});
        targets.forEach(function(el){io.observe(el);});
      }
    }

    // Article reading progress bar
    var progressBar=document.getElementById('reading-progress');
    if(progressBar){
      var ticking=false;
      var updateProgress=function(){
        var doc=document.documentElement;
        var scrollTop=window.scrollY||doc.scrollTop||0;
        var scrollable=(doc.scrollHeight-window.innerHeight)||0;
        var ratio=scrollable>0?Math.min(1,Math.max(0,scrollTop/scrollable)):0;
        progressBar.style.transform='scaleX('+ratio.toFixed(4)+')';
        ticking=false;
      };
      window.addEventListener('scroll',function(){
        if(!ticking){
          ticking=true;
          window.requestAnimationFrame(updateProgress);
        }
      },{passive:true});
      window.addEventListener('resize',updateProgress,{passive:true});
      updateProgress();
    }

    // Code block copy buttons
    var pres=document.querySelectorAll('pre');
    pres.forEach(function(pre){
      if(pre.getAttribute('data-copy-bound'))return;
      pre.setAttribute('data-copy-bound','1');
      var wrapper=document.createElement('div');
      wrapper.style.position='relative';
      if(pre.parentNode){
        pre.parentNode.insertBefore(wrapper,pre);
        wrapper.appendChild(pre);
      }
      var copyBtn=document.createElement('button');
      copyBtn.type='button';
      copyBtn.textContent='Copy';
      copyBtn.setAttribute('aria-label','Copy code snippet');
      copyBtn.style.cssText='position:absolute;top:8px;right:8px;z-index:2;padding:3px 8px;border-radius:4px;border:1px solid var(--code-border);background:rgba(23,24,27,0.88);color:var(--code-ink);font-family:var(--font-mono);font-size:11px;line-height:1.3;cursor:pointer;opacity:0.86;';
      copyBtn.addEventListener('click',function(){
        var codeEl=pre.querySelector('code');
        var raw=codeEl?codeEl.textContent:(pre.textContent||'');
        var finish=function(ok){
          copyBtn.textContent=ok?'Copied':'Error';
          setTimeout(function(){copyBtn.textContent='Copy';},1600);
        };
        if(navigator.clipboard&&navigator.clipboard.writeText){
          navigator.clipboard.writeText(raw||'').then(function(){finish(true);},function(){finish(false);});
        }else{
          try{
            var ta=document.createElement('textarea');
            ta.value=raw||'';
            ta.style.position='fixed';
            ta.style.opacity='0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            finish(true);
          }catch(err){finish(false);}
        }
      });
      wrapper.appendChild(copyBtn);
    });
  })();</script>
</body>
</html>`;
}
