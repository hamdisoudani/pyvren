import { normalizeBaseUrl } from '../env';
import { getCategoryMeta } from '../lib/relations';
import { escapeHtml, safeJsonLd } from '../lib/security';
import type { SiteSettings } from '../types';
import {
  renderPyvrenWordmark,
  renderTopicSketchIcon,
  renderUiSketchIcon,
} from './crew-art';
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
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Newsreader:opsz,wght@6..72,400;6..72,600;6..72,700&family=Oswald:wght@600;700&family=Playfair+Display:wght@700;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';

export const TOPIC_ATLAS_ITEMS = [
  {
    href: '/category/ai-coding-agents-mcp',
    label: 'Coding & MCP',
    slug: 'ai-coding-agents-mcp',
    blurb: 'CLI harnesses, MCP token math & SWE-bench CI.',
  },
  {
    href: '/category/ai-security-jailbreaks',
    label: 'AI Security',
    slug: 'ai-security-jailbreaks',
    blurb: 'Prompt injection defense, sandboxes & guardrails.',
  },
  {
    href: '/category/ai-llms',
    label: 'LLMs & Free Models',
    slug: 'ai-llms',
    blurb: 'Frontier drops, $0 OpenRouter models, local SLMs & benchmarks.',
  },
  {
    href: '/category/generative-media-comfyui',
    label: 'ComfyUI & Video',
    slug: 'generative-media-comfyui',
    blurb: 'ComfyUI graphs, custom nodes, AI video models & VRAM math.',
  },
  {
    href: '/category/cloud-gpu-infra',
    label: 'Cloud & GPU',
    slug: 'cloud-gpu-infra',
    blurb: 'Edge Workers, serverless Postgres & GPU economics.',
  },
  {
    href: '/category/agentic-browser-web-data',
    label: 'Web & Search',
    slug: 'agentic-browser-web-data',
    blurb: 'Web extraction, browser tools & structured retrieval.',
  },
  {
    href: '/category/dev-tooling-benchmarks',
    label: 'Breaches & CVEs',
    slug: 'dev-tooling-benchmarks',
    blurb: 'Major cyber breaches, CISA KEV zero-days & clean patch logs.',
  },
] as const;

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
  const rawGaId = (settings.ga_measurement_id || '').trim().toUpperCase();
  const gaMeasurementId = /^G-[A-Z0-9]{6,16}$/.test(rawGaId) ? rawGaId : '';
  const resolvedOgImage = ogImageUrl || `${baseUrl}/og/default.svg`;
  const htmlThemeAttr =
    initialTheme === 'dark'
      ? ' data-theme="dark"'
      : initialTheme === 'light'
        ? ' data-theme="light"'
        : '';

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

  const gaScriptTag = gaMeasurementId
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}"></script>\n  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaMeasurementId}');</script>`
    : '';

  const readingProgressBarHtml =
    ogType === 'article'
      ? `<div id="reading-progress" aria-hidden="true" style="position:fixed;top:0;left:0;z-index:60;height:2.5px;width:100%;background:var(--accent);transform:scaleX(0);transform-origin:left center;pointer-events:none;transition:transform 80ms linear"></div>`
      : '';

  const isStoriesActive = currentPath === '/blog' || currentPath.startsWith('/blog/');
  const isCategoryActive = currentPath.startsWith('/category/');

  const desktopAtlasItemsHtml = TOPIC_ATLAS_ITEMS.map((item) => {
    const meta = getCategoryMeta(item.slug);
    const active = currentPath === item.href;
    return `<a href="${item.href}" class="topics-atlas-item topic-tone" style="--topic-light:${meta.color}; --topic-dark:${meta.darkColor};"${active ? ' aria-current="page"' : ''}>
      <span class="mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-lg border border-hairline bg-paper text-ink shrink-0">
        ${renderTopicSketchIcon(item.slug, 20)}
      </span>
      <span class="min-w-0">
        <span class="block text-sm font-semibold text-ink">${escapeHtml(item.label)}</span>
        <span class="block text-xs text-ink-muted leading-snug mt-0.5">${escapeHtml(item.blurb)}</span>
      </span>
    </a>`;
  }).join('\n                  ');

  const mobileAtlasItemsHtml = TOPIC_ATLAS_ITEMS.map((item) => {
    const meta = getCategoryMeta(item.slug);
    const active = currentPath === item.href;
    return `<a href="${item.href}" class="topic-tone flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${
      active ? 'bg-subtle text-accent font-semibold' : 'text-ink hover:bg-subtle'
    } border-b border-hairline" style="--topic-light:${meta.color}; --topic-dark:${meta.darkColor};">
      ${renderTopicSketchIcon(item.slug, 18)}
      <span class="flex-1 truncate">${escapeHtml(item.label)}</span>
      <span class="font-tabular text-xs text-ink-faint">&rarr;</span>
    </a>`;
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
  <link rel="preload" as="style" href="/assets/app.css">
  <link rel="stylesheet" href="/assets/app.css">
  <link rel="preload" as="style" href="${GOOGLE_FONTS_HREF}" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="${GOOGLE_FONTS_HREF}"></noscript>
  <script>(function(){try{var c=(document.cookie.match(/(?:^|;\\s*)pyvren_theme=(dark|light)(?:;|$)/)||[])[1];var s=localStorage.getItem('pyvren-theme');var pref=(s==='dark'||s==='light')?s:((c==='dark'||c==='light')?c:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));document.documentElement.setAttribute('data-theme',pref);if(c!==pref){document.cookie='pyvren_theme='+pref+'; path=/; max-age=31536000; SameSite=Lax';}}catch(e){}})();</script>
  <script>(function(){
    function frame(img){return img.closest?img.closest('.story-media'):null;}
    function ready(img){
      img.classList.add('is-loaded');
      var f=frame(img);if(f&&img.hasAttribute('data-story-cover'))f.classList.add('media-ready');
    }
    function fail(img){
      if(img.hasAttribute('data-story-cover')){
        var f=frame(img);if(f)f.classList.add('media-fallback');
        if(img.parentNode)img.parentNode.removeChild(img);
        return;
      }
      if(img.getAttribute('data-pyvren-fallback')==='1'){img.classList.add('is-loaded');return;}
      img.setAttribute('data-pyvren-fallback','1');
      var post=img.closest?img.closest('[data-post-category]'):null;
      var cat=img.getAttribute('data-fallback-category')||(post?post.getAttribute('data-post-category'):'')||'';
      var label=img.getAttribute('data-fallback-label')||img.getAttribute('alt')||'Pyvren';
      img.removeAttribute('srcset');
      img.src='/og/fallback.svg?category='+encodeURIComponent(cat)+'&label='+encodeURIComponent(label.slice(0,44));
    }
    document.addEventListener('load',function(e){var t=e.target;if(t&&t.tagName==='IMG')ready(t);},true);
    document.addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='IMG')fail(t);},true);
    function scan(){
      var list=document.images;
      for(var i=list.length-1;i>=0;i--){
        var img=list[i];
        if(!img.complete||!img.getAttribute('src'))continue;
        if(img.naturalWidth===0)fail(img);else ready(img);
      }
    }
    document.addEventListener('DOMContentLoaded',scan);
    window.addEventListener('load',scan);
  })();</script>
  <noscript><style>.story-real-img{opacity:1!important}.media-skeleton{display:none!important}</style></noscript>
  ${jsonLdScripts}
  ${adsenseScriptTag}
  ${gaScriptTag}
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
    <a href="/api/v1/search">Search JSON API</a>
  </nav>

  <header class="editorial-topbar sticky top-0 z-40 border-b border-hairline">
    <div class="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-[4.5rem] sm:h-20 flex items-center justify-between gap-3">
      <!-- Left: Pyvren wordmark — Py (the snake mark) + "vren" -->
      <div class="flex items-center min-w-0 pt-0.5">
        ${renderPyvrenWordmark({ siteName, variant: 'header' })}
      </div>

      <!-- Center (Desktop): Clean Single-Row Editorial Links + Illustrated Topics Atlas Popover -->
      <nav aria-label="Primary navigation" class="hidden lg:flex items-center gap-1">
        <a href="/blog" class="px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
          isStoriesActive ? 'bg-subtle text-ink' : 'text-ink-secondary hover:text-ink hover:bg-subtle/60'
        }"${currentPath === '/blog' ? ' aria-current="page"' : ''}>
          Dispatches
        </a>

        <details id="desktop-topics-menu" class="relative">
          <summary class="list-none inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold cursor-pointer select-none transition-colors ${
            isCategoryActive ? 'bg-subtle text-ink' : 'text-ink-secondary hover:text-ink hover:bg-subtle/60'
          }">
            <span>Topics</span>
            ${renderUiSketchIcon('chevron-down', 14)}
          </summary>
          <div class="topics-popover absolute left-1/2 -translate-x-1/2 mt-2.5 w-[38rem] p-4 z-50">
            <div class="px-2 pb-2.5 mb-2 border-b border-hairline flex items-center justify-between">
              <span class="font-tabular text-[11px] uppercase tracking-[0.1em] font-bold text-ink-muted">Seven Engineering Beats</span>
              <a href="/blog" class="font-tabular text-xs font-semibold text-accent hover:underline">Browse all stories &rarr;</a>
            </div>
            <div class="grid grid-cols-2 gap-1.5">
              ${desktopAtlasItemsHtml}
            </div>
          </div>
        </details>

        <a href="/about" class="px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
          currentPath === '/about' ? 'bg-subtle text-ink' : 'text-ink-secondary hover:text-ink hover:bg-subtle/60'
        }"${currentPath === '/about' ? ' aria-current="page"' : ''}>
          About
        </a>

        <a href="/editorial-policy" class="px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
          currentPath === '/editorial-policy' ? 'bg-subtle text-ink' : 'text-ink-secondary hover:text-ink hover:bg-subtle/60'
        }"${currentPath === '/editorial-policy' ? ' aria-current="page"' : ''}>
          Standards
        </a>
      </nav>

      <!-- Right: Instant Search, Persistent Theme Switcher, LinkedIn & Mobile Menu -->
      <div class="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
        <button type="button" data-search-toggle class="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg border border-hairline bg-surface text-ink-secondary hover:text-ink hover:border-strong transition-colors cursor-pointer" aria-label="Search stories" aria-expanded="false" aria-controls="header-search-panel">
          ${renderUiSketchIcon('search', 15)}
          <span class="hidden md:inline text-xs font-semibold">Search</span>
          <kbd class="hidden xl:inline-block px-1.5 py-0.5 text-[10px] font-tabular rounded bg-subtle text-ink-faint border border-hairline">/</kbd>
        </button>

        <button type="button" id="theme-toggle" class="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-hairline bg-surface text-ink-secondary hover:text-ink hover:border-strong transition-colors cursor-pointer" aria-label="Switch color theme" title="Switch between warm paper and dark mode">
          <svg data-theme-icon="sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" class="hidden" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/></svg>
          <svg data-theme-icon="moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>

        <details id="mobile-nav-drawer" class="relative lg:hidden">
          <summary class="list-none inline-flex items-center justify-center w-9 h-9 rounded-lg border border-hairline bg-surface text-ink-secondary hover:text-ink hover:border-strong cursor-pointer" aria-label="Open menu">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </summary>
          <div class="topics-popover fixed inset-x-3 top-[4.9rem] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 overflow-hidden z-50">
            <div class="px-4 py-3 bg-subtle border-b border-hairline flex items-center justify-between">
              <span class="font-tabular text-[11px] font-bold uppercase tracking-[0.08em] text-ink">Browse Beats</span>
              <a href="/blog" class="font-tabular text-xs font-semibold text-accent">All Dispatches &rarr;</a>
            </div>
            <nav aria-label="Mobile topics">
              ${mobileAtlasItemsHtml}
            </nav>
            <div class="p-3.5 bg-subtle/60 flex items-center justify-between gap-2 text-xs">
              <div class="flex items-center gap-3">
                <a href="/about" class="font-semibold text-ink hover:text-accent">About</a>
                <a href="/editorial-policy" class="font-medium text-ink-secondary hover:text-accent">Standards</a>
              </div>
              <a href="https://www.linkedin.com/in/hamdisoudani/" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                <span>Hamdi’s LinkedIn</span>
                ${renderUiSketchIcon('external', 12)}
              </a>
            </div>
          </div>
        </details>
      </div>
    </div>

    <!-- Collapsible Instant Search Bar (Accessible on Every Page) -->
    <div id="header-search-panel" class="hidden border-t border-hairline bg-subtle/90">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-3">
        <form action="/blog" method="get" role="search" data-live-search class="relative">
          <div class="flex items-center gap-2 rounded-xl bg-surface border border-strong px-3.5 py-1.5 shadow-sm">
            ${renderUiSketchIcon('search', 16)}
            <input
              type="search"
              name="q"
              autocomplete="off"
              placeholder="Search benchmarks, MCP, AI security, cloud GPUs, CVEs..."
              aria-label="Search stories"
              class="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none py-1"
            >
            <button type="submit" class="px-3.5 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shrink-0 cursor-pointer">
              Search
            </button>
          </div>
          <div data-search-results class="search-dropdown hidden" role="listbox" aria-label="Instant search suggestions"></div>
        </form>
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

    // Close <details> popovers cleanly when clicking outside or pressing Escape
    var desktopTopics=document.getElementById('desktop-topics-menu');
    var mobileDrawer=document.getElementById('mobile-nav-drawer');
    document.addEventListener('click',function(ev){
      if(desktopTopics&&desktopTopics.open&&!desktopTopics.contains(ev.target)){
        desktopTopics.open=false;
      }
      if(mobileDrawer&&mobileDrawer.open&&!mobileDrawer.contains(ev.target)){
        mobileDrawer.open=false;
      }
    });

    // Center active beat tab smoothly on mobile
    var activeBeat=document.querySelector('.beat-strip .beat-tab[aria-current="page"]');
    if(activeBeat&&activeBeat.scrollIntoView&&window.innerWidth<1024){
      try{activeBeat.scrollIntoView({inline:'center',block:'nearest'});}catch(e){}
    }

    // Py's eyes follow the pointer (wordmark, hero & illustrations). Desktop pointers only.
    var pupils=Array.prototype.slice.call(document.querySelectorAll('[data-snake-pupil]'));
    var reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(pupils.length>0&&!reduceMotion){
      var ptrX=0,ptrY=0,eyeRaf=0;
      var updateEyes=function(){
        eyeRaf=0;
        var vh=window.innerHeight||0;
        for(var i=0;i<pupils.length;i++){
          var p=pupils[i];
          var sclera=p.previousElementSibling;
          if(!sclera||!sclera.getBoundingClientRect)continue;
          var r=sclera.getBoundingClientRect();
          if(r.width===0||r.bottom<0||r.top>vh)continue;
          var dx=ptrX-(r.left+r.width/2),dy=ptrY-(r.top+r.height/2);
          var dist=Math.sqrt(dx*dx+dy*dy)||1;
          var reach=Math.min(1,dist/240)*2.1;
          p.setAttribute('transform','translate('+((dx/dist)*reach-1).toFixed(2)+' '+((dy/dist)*reach).toFixed(2)+')');
        }
      };
      window.addEventListener('pointermove',function(e){
        if(e.pointerType==='touch')return;
        ptrX=e.clientX;ptrY=e.clientY;
        if(!eyeRaf)eyeRaf=window.requestAnimationFrame(updateEyes);
      },{passive:true});
    }

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
      }else if(e.key==='Escape'){
        if(desktopTopics&&desktopTopics.open)desktopTopics.open=false;
        if(mobileDrawer&&mobileDrawer.open)mobileDrawer.open=false;
        if(searchPanel&&!searchPanel.classList.contains('hidden'))toggleHeaderSearch(false);
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
          var skRow='<div class="search-skeleton-row" aria-hidden="true"><span class="skeleton-line skeleton-shimmer" style="width:28%"></span><span class="skeleton-line skeleton-line--lg skeleton-shimmer" style="width:82%"></span><span class="skeleton-line skeleton-shimmer" style="width:64%"></span></div>';
          box.innerHTML=skRow+skRow+skRow;
          box.setAttribute('aria-busy','true');
          box.classList.remove('hidden');
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
              box.removeAttribute('aria-busy');
              if(!data){closeBox();return;}
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
              box.removeAttribute('aria-busy');
              box.innerHTML='<div class="px-4 py-3 text-xs text-ink-muted">Search is unavailable right now. Press Enter to search the full archive.</div>';
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

    // Copy buttons mounted cleanly into .code-frame-bar (or standalone <pre> fallback)
    function copyText(raw,btn){
      var finish=function(ok){
        btn.textContent=ok?'Copied!':'Error';
        setTimeout(function(){btn.textContent='Copy';},1600);
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
    }

    document.querySelectorAll('.code-frame').forEach(function(frame){
      if(frame.getAttribute('data-copy-bound'))return;
      frame.setAttribute('data-copy-bound','1');
      var bar=frame.querySelector('.code-frame-bar');
      var codeEl=frame.querySelector('code');
      if(!bar||!codeEl)return;
      var btn=document.createElement('button');
      btn.type='button';
      btn.className='code-copy-btn';
      btn.textContent='Copy';
      btn.setAttribute('aria-label','Copy code snippet');
      btn.addEventListener('click',function(){
        copyText(codeEl.textContent||'',btn);
      });
      bar.appendChild(btn);
    });

    document.querySelectorAll('.prose-editorial > pre').forEach(function(pre){
      if(pre.getAttribute('data-copy-bound'))return;
      pre.setAttribute('data-copy-bound','1');
      var wrapper=document.createElement('div');
      wrapper.style.position='relative';
      if(pre.parentNode){
        pre.parentNode.insertBefore(wrapper,pre);
        wrapper.appendChild(pre);
      }
      var btn=document.createElement('button');
      btn.type='button';
      btn.className='code-copy-btn';
      btn.style.cssText='position:absolute;top:10px;right:10px;z-index:2;';
      btn.textContent='Copy';
      btn.setAttribute('aria-label','Copy code snippet');
      btn.addEventListener('click',function(){
        var codeEl=pre.querySelector('code');
        copyText(codeEl?codeEl.textContent:(pre.textContent||''),btn);
      });
      wrapper.appendChild(btn);
    });
  })();</script>
</body>
</html>`;
}
