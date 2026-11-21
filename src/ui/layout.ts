import { normalizeBaseUrl } from '../env';
import { escapeHtml, safeJsonLd } from '../lib/security';
import type { SiteSettings } from '../types';
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
}

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;0,6..72,700&family=Oswald:wght@600;700&family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';

const RIBBON_NAV_ITEMS = [
  { href: '/blog', label: 'All Briefings' },
  { href: '/category/ai-coding-agents-mcp', label: 'Coding & MCP' },
  { href: '/category/ai-security-jailbreaks', label: 'AI Security' },
  { href: '/category/ai-llms', label: 'Frontier LLMs' },
  { href: '/category/cloud-gpu-infra', label: 'Cloud & GPU' },
  { href: '/category/agentic-browser-web-data', label: 'Web Data & GEO' },
  { href: '/category/dev-tooling-benchmarks', label: 'CVEs & Patches' },
  { href: '/editorial-policy', label: 'Editorial Policy' },
  { href: '/about', label: 'About' },
];

function formatMastheadUtcDate(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return date.toUTCString().slice(0, 16);
  }
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
    keywords,
    robotsMeta = 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
    ogImageUrl,
  } = opts;

  const baseUrl = normalizeBaseUrl(settings.base_url);
  const siteName = settings.site_name || 'Pyvren';
  const tagline = settings.site_tagline || 'Independent technical briefings and primary-source engineering analysis.';
  const adsenseClientId = (settings.adsense_client_id || '').trim();
  const resolvedOgImage = ogImageUrl || `${baseUrl}/og/default.svg`;
  const mastheadDate = formatMastheadUtcDate();

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

  const ribbonNavHtml = RIBBON_NAV_ITEMS.map((item) => {
    const active = isNavActive(currentPath, item.href);
    return `<a href="${item.href}" class="ribbon-link"${active ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`;
  }).join('\n          ');

  const mobileNavHtml = RIBBON_NAV_ITEMS.map(
    (item) =>
      `<a href="${item.href}" class="block px-4 py-2.5 text-sm font-medium text-ink hover:bg-subtle border-b border-hairline last:border-b-0">${escapeHtml(item.label)}</a>`,
  ).join('\n            ');

  const footerHtml = renderDoodleCrewFooter(settings);

  return `<!doctype html>
<html lang="en">
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
  <script>(function(){try{var s=localStorage.getItem('pyvren-theme');var t=(s==='dark'||s==='light')?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();</script>
  ${jsonLdScripts}
  ${adsenseScriptTag}
  ${extraHead}
</head>
<body class="min-h-screen flex flex-col bg-paper text-ink antialiased">
  ${readingProgressBarHtml}
  <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-2 focus:rounded focus:bg-surface focus:text-ink focus:border focus:border-strong">Skip to main content</a>

  <header class="editorial-topbar sticky top-0 z-40">
    <!-- Row 1: Editorial Broadsheet Masthead Bar -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <!-- Left: Live UTC Date + Autonomous Tech Desk Tag -->
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="hidden md:flex flex-col leading-tight min-w-0">
            <time class="text-[11px] font-medium text-ink-secondary truncate">${escapeHtml(mastheadDate)}</time>
            <span class="inline-flex items-center gap-1.5 mt-0.5 font-tabular text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              <span class="cat-dot" style="--cat-color:var(--accent)" aria-hidden="true"></span>
              <span>Autonomous Tech Desk</span>
            </span>
          </div>
          <span class="inline-flex md:hidden items-center gap-1.5 font-tabular text-[10px] uppercase tracking-[0.1em] text-ink-faint truncate">
            <span class="cat-dot" style="--cat-color:var(--accent)" aria-hidden="true"></span>
            <span class="hidden sm:inline">Tech Desk</span>
          </span>
        </div>

        <!-- Center: Iconic Editorial Crimson Masthead -->
        <div class="text-center">
          <a href="/" class="inline-block font-masthead font-black text-3xl sm:text-4xl tracking-tight leading-none text-[var(--accent)] hover:opacity-90 transition-opacity" aria-label="${escapeHtml(siteName)} home">
            ${escapeHtml(siteName)}
          </a>
        </div>

        <!-- Right: Quick Search, Light/Dark Toggle, Crimson Pill CTA, Mobile Menu -->
        <div class="flex items-center justify-end gap-2">
          <a href="/blog#search" class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-hairline bg-surface/70 text-ink-muted hover:text-ink hover:border-strong hover:bg-subtle transition-colors" aria-label="Search briefings" title="Search briefings">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
          </a>

          <button type="button" id="theme-toggle" class="inline-flex items-center justify-center w-9 h-9 rounded-full border border-hairline bg-surface/70 text-ink-muted hover:text-ink hover:border-strong hover:bg-subtle transition-colors cursor-pointer" aria-label="Toggle color theme" title="Toggle light or dark appearance">
            <svg data-theme-icon="sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="hidden" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/></svg>
            <svg data-theme-icon="moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>

          <a href="/blog" class="hidden sm:inline-flex items-center justify-center h-9 px-4 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold tracking-wide transition-colors shadow-xs">
            Latest Briefings
          </a>

          <details class="relative lg:hidden">
            <summary class="list-none inline-flex items-center justify-center w-9 h-9 rounded-full border border-hairline bg-surface/70 text-ink-muted hover:text-ink hover:border-strong hover:bg-subtle cursor-pointer" aria-label="Open menu">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
            </summary>
            <nav aria-label="Mobile navigation" class="absolute right-0 mt-2 w-60 rounded-[12px] bg-surface border border-strong shadow-lg overflow-hidden z-50">
              <div class="px-4 py-2.5 bg-subtle border-b border-hairline">
                <p class="font-tabular text-[10px] uppercase tracking-[0.12em] text-ink-faint">${escapeHtml(mastheadDate)}</p>
              </div>
              ${mobileNavHtml}
              <a href="/blog#search" class="block px-4 py-2.5 text-sm font-semibold text-accent hover:bg-subtle border-t border-hairline">Search Briefings</a>
            </nav>
          </details>
        </div>
      </div>
    </div>

    <!-- Row 2: Double-Ruled Category Navigation Ribbon -->
    <div class="border-t border-hairline double-rule-bottom">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        <nav aria-label="Primary sections" class="ribbon-scroll flex items-center lg:justify-center flex-1 gap-5 sm:gap-6 overflow-x-auto">
          ${ribbonNavHtml}
        </nav>
        <a href="/blog#search" class="hidden sm:inline-flex items-center justify-center shrink-0 w-7 h-7 rounded-full text-ink-muted hover:text-accent transition-colors" aria-label="Search archive" title="Search archive">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
        </a>
      </div>
    </div>
  </header>

  <main id="main-content" class="flex-1">
    ${bodyHtml}
  </main>

  ${footerHtml}

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
        },{rootMargin:'-96px 0px -68% 0px',threshold:0.01});
        targets.forEach(function(el){io.observe(el);});
      }
    }
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
