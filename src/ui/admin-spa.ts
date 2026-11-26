import type { SiteSettings } from '../types';
import {
  renderPySnakeMark,
  renderPyvrenWordmark,
  renderTopicSketchIcon,
  renderUiSketchIcon,
} from './crew-art';

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;0,6..72,700&family=Oswald:wght@600;700&family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';

function safeInlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function renderAdminSpaHtml(
  settings: SiteSettings,
  initialTheme?: 'light' | 'dark',
  turnstileSiteKey?: string | null,
): string {
  const siteName = settings.site_name || 'Pyvren';
  const defaultAuthor = settings.default_author || '';
  const activeTurnstileSiteKey = (turnstileSiteKey || '').trim();
  const turnstileScriptTag = activeTurnstileSiteKey
    ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>'
    : '';
  const htmlThemeAttr =
    initialTheme === 'dark'
      ? ' data-theme="dark"'
      : initialTheme === 'light'
        ? ' data-theme="light"'
        : '';

  const wordmarkAdmin = renderPyvrenWordmark({ siteName, variant: 'header', href: '/admin' }).replace(
    'pyvren-wordmark--header',
    'pyvren-wordmark--header pyvren-wordmark--static',
  );
  const wordmarkHome = renderPyvrenWordmark({ siteName, variant: 'header', href: '/' });
  const snakeMini = renderPySnakeMark({ height: 28 });

  const uiIcons = {
    pen: renderUiSketchIcon('pen', 14),
    spark: renderUiSketchIcon('spark', 14),
    layers: renderUiSketchIcon('layers', 14),
    ledger: renderUiSketchIcon('ledger', 14),
    note: renderUiSketchIcon('note', 14),
    clock: renderUiSketchIcon('clock', 13),
    external: renderUiSketchIcon('external', 13),
    search: renderUiSketchIcon('search', 14),
  };

  const topicIcons: Record<string, string> = {
    'ai-coding-agents-mcp': renderTopicSketchIcon('ai-coding-agents-mcp', 15),
    'ai-security-jailbreaks': renderTopicSketchIcon('ai-security-jailbreaks', 15),
    'ai-llms': renderTopicSketchIcon('ai-llms', 15),
    'cloud-gpu-infra': renderTopicSketchIcon('cloud-gpu-infra', 15),
    'agentic-browser-web-data': renderTopicSketchIcon('agentic-browser-web-data', 15),
    'dev-tooling-benchmarks': renderTopicSketchIcon('dev-tooling-benchmarks', 15),
    'generative-media-comfyui': renderTopicSketchIcon('generative-media-comfyui', 15),
    default: renderTopicSketchIcon('all', 15),
  };

  return `<!doctype html>
<html lang="en"${htmlThemeAttr}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Pyvren — Admin</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="${GOOGLE_FONTS_HREF}">
  <link rel="stylesheet" href="${GOOGLE_FONTS_HREF}" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="${GOOGLE_FONTS_HREF}"></noscript>
  <link rel="stylesheet" href="/assets/app.css">
  <script>(function(){try{var c=(document.cookie.match(/(?:^|;\\s*)pyvren_theme=(dark|light)(?:;|$)/)||[])[1];var s=localStorage.getItem('pyvren-theme');var pref=(s==='dark'||s==='light')?s:((c==='dark'||c==='light')?c:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));document.documentElement.setAttribute('data-theme',pref);if(c!==pref){document.cookie='pyvren_theme='+pref+'; path=/; max-age=31536000; SameSite=Lax';}}catch(e){}})();</script>
  ${turnstileScriptTag}
</head>
<body class="min-h-screen bg-paper text-ink antialiased">
  <div id="toast-root" class="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-5 sm:right-5 z-[60] flex flex-col gap-2 sm:max-w-sm pointer-events-none"></div>
  <div id="app" class="min-h-screen flex flex-col">
    <!-- Minimal Centered Skeleton while Session Resolves -->
    <header class="editorial-topbar sticky top-0 z-40 border-b border-hairline">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[4.5rem] flex items-center justify-between gap-3">
        <div class="pt-0.5">${wordmarkHome}</div>
        <span class="skeleton-line skeleton-shimmer w-9 h-9 rounded-lg"></span>
      </div>
    </header>
    <main class="flex-1 flex items-center justify-center px-4 py-10">
      <div class="w-full max-w-[390px] editorial-card p-6 sm:p-8 space-y-5">
        <div class="space-y-2">
          <span class="skeleton-line skeleton-line--lg skeleton-shimmer w-28 h-7"></span>
          <span class="skeleton-line skeleton-shimmer w-52"></span>
        </div>
        <div class="space-y-3 pt-1">
          <span class="skeleton-line skeleton-shimmer w-full h-11 rounded-[10px]"></span>
          <span class="skeleton-line skeleton-shimmer w-full h-11 rounded-[10px]"></span>
          <span class="skeleton-line skeleton-shimmer w-full h-11 rounded-[10px]"></span>
        </div>
      </div>
    </main>
  </div>
  <div id="modal-root"></div>
  <div id="turnstile-gate" class="hidden fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" aria-modal="true" role="dialog" aria-label="Security verification">
    <div class="w-full max-w-[360px] editorial-card p-6 space-y-4 text-center">
      <div class="space-y-1">
        <h2 class="font-masthead text-xl font-bold text-ink">Verify to continue</h2>
        <p class="text-xs text-ink-muted">Complete the security check to save this change.</p>
      </div>
      <div id="turnstile-action-slot" class="min-h-[65px] flex items-center justify-center"></div>
      <button type="button" id="turnstile-gate-cancel" class="btn-ghost text-xs w-full justify-center rounded-xl">Cancel</button>
    </div>
  </div>

  <script>
  (function () {
    'use strict';

    var DEFAULT_AUTHOR = ${safeInlineJson(defaultAuthor)};
    var WORDMARK_ADMIN = ${safeInlineJson(wordmarkAdmin)};
    var WORDMARK_HOME = ${safeInlineJson(wordmarkHome)};
    var SNAKE_MINI = ${safeInlineJson(snakeMini)};
    var UI_ICONS = ${safeInlineJson(uiIcons)};
    var TOPIC_ICONS = ${safeInlineJson(topicIcons)};
    var TOKEN_STORAGE_KEY = 'pyvren_admin_jwt';
    var TURNSTILE_SITE_KEY = ${safeInlineJson(activeTurnstileSiteKey)};
    var turnstileToken = '';
    var turnstileWidgetId = null;
    var turnstilePollTimer = null;

    function syncLoginSubmitState() {
      var btn = document.querySelector('#login-form button[type="submit"]');
      if (!btn) return;
      if (state.loggingIn) {
        btn.disabled = true;
        return;
      }
      btn.disabled = Boolean(TURNSTILE_SITE_KEY && !turnstileToken);
    }

    function unmountTurnstile() {
      if (turnstilePollTimer) {
        clearTimeout(turnstilePollTimer);
        turnstilePollTimer = null;
      }
      if (turnstileWidgetId !== null && window.turnstile && window.turnstile.remove) {
        try { window.turnstile.remove(turnstileWidgetId); } catch (e) {}
      }
      turnstileWidgetId = null;
      turnstileToken = '';
    }

    function resetTurnstile() {
      turnstileToken = '';
      if (turnstileWidgetId !== null && window.turnstile && window.turnstile.reset) {
        try { window.turnstile.reset(turnstileWidgetId); } catch (e) {}
      }
      syncLoginSubmitState();
    }

    function mountTurnstile(attempt) {
      if (!TURNSTILE_SITE_KEY) return;
      var slot = document.getElementById('turnstile-slot');
      if (!slot) return;
      if (!window.turnstile || typeof window.turnstile.render !== 'function') {
        if ((attempt || 0) < 40) {
          turnstilePollTimer = setTimeout(function () { mountTurnstile((attempt || 0) + 1); }, 150);
        }
        return;
      }
      slot.innerHTML = '';
      turnstileToken = '';
      try {
        turnstileWidgetId = window.turnstile.render(slot, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: getTheme(),
          action: 'admin_login',
          callback: function (tok) {
            turnstileToken = String(tok || '');
            var errEl = document.getElementById('auth-error');
            if (errEl && errEl.getAttribute('data-ts-err') === '1') {
              errEl.classList.add('hidden');
              errEl.removeAttribute('data-ts-err');
            }
            syncLoginSubmitState();
          },
          'expired-callback': function () {
            turnstileToken = '';
            syncLoginSubmitState();
          },
          'error-callback': function () {
            turnstileToken = '';
            syncLoginSubmitState();
          }
        });
      } catch (e) {}
      syncLoginSubmitState();
    }

    var actionTurnstileToken = '';
    var actionTurnstileWidgetId = null;
    var actionTurnstilePollTimer = null;
    var pendingActionResolvers = [];

    function closeTurnstileGate() {
      var gate = document.getElementById('turnstile-gate');
      if (gate) gate.classList.add('hidden');
    }

    function unmountActionTurnstile() {
      if (actionTurnstilePollTimer) {
        clearTimeout(actionTurnstilePollTimer);
        actionTurnstilePollTimer = null;
      }
      if (actionTurnstileWidgetId !== null && window.turnstile && window.turnstile.remove) {
        try { window.turnstile.remove(actionTurnstileWidgetId); } catch (e) {}
      }
      actionTurnstileWidgetId = null;
      actionTurnstileToken = '';
      closeTurnstileGate();
    }

    function resetActionTurnstile() {
      actionTurnstileToken = '';
      if (actionTurnstileWidgetId !== null && window.turnstile && window.turnstile.reset) {
        try { window.turnstile.reset(actionTurnstileWidgetId); } catch (e) {}
      }
    }

    function warmActionTurnstile(attempt) {
      if (!TURNSTILE_SITE_KEY || actionTurnstileWidgetId !== null) return;
      var slot = document.getElementById('turnstile-action-slot');
      if (!slot) return;
      if (!window.turnstile || typeof window.turnstile.render !== 'function') {
        if ((attempt || 0) < 40) {
          actionTurnstilePollTimer = setTimeout(function () { warmActionTurnstile((attempt || 0) + 1); }, 150);
        }
        return;
      }
      slot.innerHTML = '';
      try {
        actionTurnstileWidgetId = window.turnstile.render(slot, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: getTheme(),
          action: 'admin_action',
          callback: function (tok) {
            actionTurnstileToken = String(tok || '');
            if (pendingActionResolvers.length > 0 && actionTurnstileToken) {
              var next = pendingActionResolvers.shift();
              var consumed = actionTurnstileToken;
              actionTurnstileToken = '';
              closeTurnstileGate();
              resetActionTurnstile();
              if (next) next.resolve(consumed);
            }
          },
          'expired-callback': function () {
            actionTurnstileToken = '';
          },
          'error-callback': function () {
            actionTurnstileToken = '';
          }
        });
      } catch (e) {}
    }

    function acquireActionTurnstileToken() {
      if (!TURNSTILE_SITE_KEY) return Promise.resolve('');
      if (actionTurnstileToken) {
        var ready = actionTurnstileToken;
        actionTurnstileToken = '';
        resetActionTurnstile();
        return Promise.resolve(ready);
      }
      warmActionTurnstile(0);
      return new Promise(function (resolve, reject) {
        var gate = document.getElementById('turnstile-gate');
        if (gate) gate.classList.remove('hidden');
        var cancelBtn = document.getElementById('turnstile-gate-cancel');
        var entry = { resolve: resolve, reject: reject };
        pendingActionResolvers.push(entry);
        if (cancelBtn) {
          cancelBtn.onclick = function () {
            closeTurnstileGate();
            var idx = pendingActionResolvers.indexOf(entry);
            if (idx !== -1) pendingActionResolvers.splice(idx, 1);
            reject(new Error('Verification cancelled.'));
          };
        }
      });
    }

    var ARCHETYPES = [
      { value: 'advisory-teardown', label: 'Advisory Teardown' },
      { value: 'benchmark-index', label: 'Benchmark Index' },
      { value: 'migration-fix-log', label: 'Migration & Fix Log' },
      { value: 'architecture-analysis', label: 'Architecture Analysis' }
    ];

    var SCHEDULE_PRESETS = [
      {
        label: 'Full 7-beat (16x/day · 2/cat = 14/day)',
        runs_per_day: 16,
        preferred_hours_utc_json: [0, 2, 4, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 20, 21, 22],
        max_posts_per_day: 2,
        min_novelty_score: 65
      },
      {
        label: 'Hourly sweep (24x/day · 2/cat = 14/day)',
        runs_per_day: 24,
        preferred_hours_utc_json: [],
        max_posts_per_day: 2,
        min_novelty_score: 68
      },
      {
        label: 'Balanced (7x/day · 1/cat = 7/day)',
        runs_per_day: 7,
        preferred_hours_utc_json: [2, 6, 9, 12, 15, 18, 21],
        max_posts_per_day: 1,
        min_novelty_score: 70
      },
      {
        label: 'Light (3x/day · 08, 14, 20 UTC)',
        runs_per_day: 3,
        preferred_hours_utc_json: [8, 14, 20],
        max_posts_per_day: 2,
        min_novelty_score: 68
      }
    ];

    function readStoredToken() {
      try { return sessionStorage.getItem(TOKEN_STORAGE_KEY) || ''; } catch (e) { return ''; }
    }

    function writeStoredToken(tok) {
      sessionToken = tok || '';
      try {
        if (sessionToken) sessionStorage.setItem(TOKEN_STORAGE_KEY, sessionToken);
        else sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      } catch (e) {}
    }

    var sessionToken = readStoredToken();

    var state = {
      auth: { loading: true, authenticated: false, user: null },
      loggingIn: false,
      showPassword: false,
      activeTab: 'posts',
      settings: null,
      posts: [],
      skills: [],
      runs: [],
      freeModels: [],
      probeResults: [],
      probeRecommended: null,
      probingModels: false,
      providers: { openrouter: false, nvidia_nim: false },
      securityLogs: [],
      ipBlocks: [],
      syndicationStatus: null,
      securityFilter: 'all',
      postFilter: 'all',
      postSearch: '',
      expandedPostIds: {},
      expandedRunIds: {},
      pollTimer: null,
      dispatching: false,
      loadingData: false,
      hasLoadedOnce: false
    };

    /* ------------------------------------------------------------------
       Utilities, Theme Sync & Pointer-Tracked Eyes
       ------------------------------------------------------------------ */

    function esc(v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function topicIcon(slug) {
      return TOPIC_ICONS[slug] || TOPIC_ICONS.default || '';
    }

    function fmtDate(iso) {
      if (!iso) return '—';
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    function fmtArchetype(a) {
      for (var i = 0; i < ARCHETYPES.length; i++) {
        if (ARCHETYPES[i].value === a) return ARCHETYPES[i].label;
      }
      return String(a || '').replace(/-/g, ' ');
    }

    function linesToArray(text) {
      return String(text || '')
        .split(/\\r?\\n/)
        .map(function (s) { return s.trim(); })
        .filter(Boolean);
    }

    function arrayToLines(arr) {
      return Array.isArray(arr) ? arr.join('\\n') : '';
    }

    function isFreeModelsOnly() {
      return state.settings ? state.settings.free_models_only !== false : true;
    }

    function getTheme() {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    function renderThemeToggleButton() {
      var isDark = getTheme() === 'dark';
      return '<button type="button" data-action="toggle-theme" class="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-hairline bg-surface text-ink-secondary hover:text-ink hover:border-strong transition-colors cursor-pointer shrink-0" aria-label="Switch color theme" aria-pressed="' + (isDark ? 'true' : 'false') + '" title="Toggle theme">' +
        (isDark
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/></svg>'
          : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>') +
      '</button>';
    }

    function toggleTheme() {
      var next = getTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('pyvren-theme', next); } catch (e) {}
      try { document.cookie = 'pyvren_theme=' + next + '; path=/; max-age=31536000; SameSite=Lax'; } catch (e) {}
      unmountActionTurnstile();
      render();
    }

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
      var ptrX = 0, ptrY = 0, eyeRaf = 0;
      var updateEyes = function () {
        eyeRaf = 0;
        var pupils = document.querySelectorAll('[data-snake-pupil]');
        var vh = window.innerHeight || 0;
        for (var i = 0; i < pupils.length; i++) {
          var p = pupils[i];
          var sclera = p.previousElementSibling;
          if (!sclera || !sclera.getBoundingClientRect) continue;
          var r = sclera.getBoundingClientRect();
          if (r.width === 0 || r.bottom < 0 || r.top > vh) continue;
          var dx = ptrX - (r.left + r.width / 2);
          var dy = ptrY - (r.top + r.height / 2);
          var dist = Math.sqrt(dx * dx + dy * dy) || 1;
          var reach = Math.min(1, dist / 240) * 2.1;
          p.setAttribute('transform', 'translate(' + ((dx / dist) * reach - 1).toFixed(2) + ' ' + ((dy / dist) * reach).toFixed(2) + ')');
        }
      };
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        ptrX = e.clientX;
        ptrY = e.clientY;
        if (!eyeRaf) eyeRaf = window.requestAnimationFrame(updateEyes);
      }, { passive: true });
    }

    function normalizeFreeModels(res) {
      var list = Array.isArray(res)
        ? res
        : (res && (Array.isArray(res.models) ? res.models : (Array.isArray(res.data) ? res.data : []))) || [];
      var seen = {};
      var out = [];
      list.forEach(function (item) {
        if (!item) return;
        var id = typeof item === 'string' ? item.trim() : String(item.id || '').trim();
        if (!id || seen[id]) return;
        seen[id] = true;
        var ctx = typeof item === 'object' ? Number(item.context_length || item.contextLength || 0) : 0;
        var name = typeof item === 'object' && item.name ? String(item.name).trim() : '';
        var provider = typeof item === 'object' && item.provider ? String(item.provider) : (id.indexOf('nim/') === 0 ? 'nvidia_nim' : 'openrouter');
        var latency = typeof item === 'object' && typeof item.latency_ms === 'number' && isFinite(item.latency_ms) ? Math.round(item.latency_ms) : null;
        out.push({
          id: id,
          name: name,
          provider: provider,
          latency_ms: latency,
          context_length: isFinite(ctx) && ctx > 0 ? ctx : 0
        });
      });
      return out;
    }

    function formatFreeModelLabel(m) {
      if (!m || !m.id) return '';
      var prefix = m.provider === 'nvidia_nim' || m.id.indexOf('nim/') === 0 ? '[NIM] ' : '[$0] ';
      var parts = [];
      if (m.latency_ms != null) {
        parts.push(m.latency_ms >= 1000 ? (m.latency_ms / 1000).toFixed(1) + 's' : m.latency_ms + 'ms');
      }
      if (m.context_length && m.context_length >= 1000) {
        parts.push(Math.round(m.context_length / 1000) + 'k ctx');
      }
      return prefix + m.id + (parts.length > 0 ? ' (' + parts.join(' · ') + ')' : '');
    }

    function renderFreeModelOptions(selectedId, placeholderText) {
      var opts = '<option value="">' + esc(placeholderText || 'Select model...') + '</option>';
      var hasMatch = false;
      (state.freeModels || []).forEach(function (m) {
        var sel = selectedId && m.id === selectedId ? ' selected' : '';
        if (sel) hasMatch = true;
        opts += '<option value="' + esc(m.id) + '"' + sel + '>' + esc(formatFreeModelLabel(m)) + '</option>';
      });
      if (!hasMatch && state.freeModels.length === 0) {
        opts += '<option value="baidu/ernie-5.5-flash-preview:free"' + (selectedId === 'baidu/ernie-5.5-flash-preview:free' ? ' selected' : '') + '>baidu/ernie-5.5-flash-preview:free</option>';
      }
      return opts;
    }

    function toast(msg, kind) {
      var root = document.getElementById('toast-root');
      if (!root) return;
      var el = document.createElement('div');
      var borderClass = kind === 'error'
        ? 'border-[var(--danger)]'
        : kind === 'success'
          ? 'border-[var(--success)]'
          : 'border-strong';
      el.className = 'pointer-events-auto rounded-xl bg-surface border-[1.5px] ' + borderClass + ' px-4 py-3 text-sm shadow-lg text-ink font-medium';
      el.textContent = String(msg || '');
      root.appendChild(el);
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 3600);
    }

    async function apiFetch(url, opts) {
      var init = Object.assign({ credentials: 'same-origin' }, opts || {});
      var method = String(init.method || 'GET').toUpperCase();
      var headers = Object.assign(
        { 'X-Requested-With': 'PyvrenAdmin' },
        (opts && opts.headers) || {}
      );
      if (sessionToken && !headers.Authorization && !headers.authorization) {
        headers.Authorization = 'Bearer ' + sessionToken;
      }

      var needsActionCaptcha =
        Boolean(TURNSTILE_SITE_KEY) &&
        (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') &&
        url !== '/api/admin/auth/login' &&
        url !== '/api/admin/auth/logout' &&
        !headers['X-Turnstile-Token'];

      if (needsActionCaptcha) {
        var actionTok = await acquireActionTurnstileToken();
        if (actionTok) {
          headers['X-Turnstile-Token'] = actionTok;
        }
      }

      if (init.body && typeof init.body === 'object' && !(init.body instanceof FormData)) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        init.body = JSON.stringify(init.body);
      }
      init.headers = headers;

      var res = await fetch(url, init);
      var contentType = (res.headers.get('content-type') || '').toLowerCase();
      var text = await res.text();
      if (opts && opts.rawText) {
        if (!res.ok) {
          var rawErr = new Error('Request failed (' + res.status + ')');
          rawErr.status = res.status;
          throw rawErr;
        }
        return text;
      }
      var data = null;
      if (contentType.indexOf('application/json') !== -1 || text.trim().charAt(0) === '{' || text.trim().charAt(0) === '[') {
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
      } else {
        data = { raw: text };
      }
      if (!res.ok) {
        if (data && (data.code === 'turnstile_required' || data.code === 'turnstile_failed')) {
          resetActionTurnstile();
        }
        var errMsg = (data && (data.error || data.message)) || ('Request failed (' + res.status + ')');
        var err = new Error(errMsg);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    }
    var api = apiFetch;

    /* ------------------------------------------------------------------
       Auth & Data Loading
       ------------------------------------------------------------------ */

    async function checkAuthStatus() {
      try {
        var res = await api('/api/admin/auth/status');
        var isAuthed = Boolean(res && res.authenticated);
        if (!isAuthed && sessionToken) {
          writeStoredToken('');
        }
        state.auth = {
          loading: false,
          authenticated: isAuthed,
          user: (res && (res.user || res.admin || (res.email ? { email: res.email } : null))) || null
        };
        if (state.auth.authenticated) {
          await loadAllWorkspaceData();
        } else {
          stopPolling();
          render();
        }
      } catch (err) {
        state.auth = { loading: false, authenticated: false, user: null };
        render();
      }
    }

    async function loadAllWorkspaceData() {
      state.loadingData = true;
      render();
      try {
        var results = await Promise.all([
          apiFetch('/api/admin/settings'),
          apiFetch('/api/admin/posts'),
          apiFetch('/api/admin/skills'),
          apiFetch('/api/admin/agent/runs'),
          apiFetch('/api/admin/openrouter/free-models').catch(function () { return { models: [] }; }),
          apiFetch('/api/admin/security/logs?limit=100').catch(function () { return { logs: [] }; }),
          apiFetch('/api/admin/security/blocks').catch(function () { return { blocks: [] }; }),
          apiFetch('/api/admin/syndication/status').catch(function () { return null; })
        ]);
        state.settings = (results[0] && (results[0].settings || results[0])) || null;
        state.posts = Array.isArray(results[1]) ? results[1] : ((results[1] && results[1].posts) || []);
        state.skills = Array.isArray(results[2]) ? results[2] : ((results[2] && results[2].skills) || []);
        state.runs = Array.isArray(results[3]) ? results[3] : ((results[3] && results[3].runs) || []);
        state.freeModels = normalizeFreeModels(results[4]);
        state.probeResults = (results[4] && Array.isArray(results[4].probe_results)) ? results[4].probe_results : [];
        if (results[4] && results[4].providers) {
          state.providers = results[4].providers;
        }
        state.securityLogs = (results[5] && Array.isArray(results[5].logs)) ? results[5].logs : [];
        state.ipBlocks = (results[6] && Array.isArray(results[6].blocks)) ? results[6].blocks : [];
        state.syndicationStatus = results[7] || null;
        state.hasLoadedOnce = true;
        syncPolling();
      } catch (err) {
        if (err && err.status === 401) {
          writeStoredToken('');
          state.auth.authenticated = false;
          stopPolling();
        } else {
          toast(err.message || 'Failed loading workspace', 'error');
        }
      } finally {
        state.loadingData = false;
        render();
      }
    }

    async function refreshSecurityOnly() {
      try {
        var res = await Promise.all([
          apiFetch('/api/admin/security/logs?limit=100'),
          apiFetch('/api/admin/security/blocks')
        ]);
        state.securityLogs = (res[0] && Array.isArray(res[0].logs)) ? res[0].logs : [];
        state.ipBlocks = (res[1] && Array.isArray(res[1].blocks)) ? res[1].blocks : [];
        render();
      } catch (err) {
        toast((err && err.message) || 'Failed refreshing security logs', 'error');
      }
    }

    async function refreshFreeModelsOnly() {
      try {
        var res = await apiFetch('/api/admin/openrouter/free-models?refresh=1');
        state.freeModels = normalizeFreeModels(res);
        if (res && Array.isArray(res.probe_results)) state.probeResults = res.probe_results;
        if (res && res.providers) state.providers = res.providers;
        toast('Updated model list (' + state.freeModels.length + ' available)', 'success');
        render();
      } catch (err) {
        toast((err && err.message) || 'Failed refreshing models', 'error');
      }
    }

    async function probeModelsNow(autoApply) {
      if (state.probingModels) return;
      state.probingModels = true;
      render();
      try {
        var res = await apiFetch('/api/admin/models/probe', {
          method: 'POST',
          body: { auto_apply: Boolean(autoApply) }
        });
        state.probeResults = (res && Array.isArray(res.results)) ? res.results : [];
        state.probeRecommended = (res && res.recommended) || null;
        if (res && Array.isArray(res.models)) {
          state.freeModels = normalizeFreeModels(res.models);
        }
        if (res && res.providers) state.providers = res.providers;
        if (res && res.settings) state.settings = res.settings;
        var working = state.probeResults.filter(function (r) { return r && r.ok && r.json_ok; });
        if (working.length > 0) {
          var fastest = working[0];
          toast(
            (autoApply ? 'Applied top ' + Math.min(3, working.length) + ' fastest: ' : 'Tested pool: ') +
            working.length + '/' + state.probeResults.length + ' working — fastest ' + fastest.id + ' (' + fastest.latency_ms + 'ms)',
            'success'
          );
        } else {
          toast('Probe finished: 0 models responded within timeout', 'error');
        }
      } catch (err) {
        toast((err && err.message) || 'Model speed test failed', 'error');
      } finally {
        state.probingModels = false;
        render();
      }
    }

    async function refreshRunsOnly() {
      if (!state.auth.authenticated) return;
      try {
        var res = await apiFetch('/api/admin/agent/runs');
        var prevActive = hasActiveRuns(state.runs);
        state.runs = Array.isArray(res) ? res : ((res && res.runs) || []);
        var stillActive = hasActiveRuns(state.runs);
        if (prevActive && !stillActive) {
          var postsRes = await apiFetch('/api/admin/posts');
          state.posts = Array.isArray(postsRes) ? postsRes : ((postsRes && postsRes.posts) || []);
          var latestRun = state.runs && state.runs[0];
          if (latestRun && latestRun.status === 'skipped') {
            toast('Run skipped: ' + (latestRun.decision_reason || 'no new topic qualified'), 'info');
          } else {
            toast('Run finished — posts updated', 'success');
          }
        }
        syncPolling();
        if (state.activeTab === 'agent' || state.activeTab === 'posts') {
          render();
        }
      } catch (err) {
        if (err && err.status === 401) {
          writeStoredToken('');
          state.auth.authenticated = false;
          stopPolling();
          render();
        }
      }
    }

    function hasActiveRuns(runs) {
      return (runs || []).some(function (r) {
        return r.status === 'queued' || r.status === 'running';
      });
    }

    function syncPolling() {
      if (state.auth.authenticated && hasActiveRuns(state.runs)) {
        if (!state.pollTimer) {
          state.pollTimer = setInterval(refreshRunsOnly, 3500);
        }
      } else {
        stopPolling();
      }
    }

    function stopPolling() {
      if (state.pollTimer) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
      }
    }

    /* ------------------------------------------------------------------
       Skeleton Loader
       ------------------------------------------------------------------ */

    function renderWorkspaceSkeleton() {
      var row = '<div class="editorial-card p-5 space-y-3" aria-hidden="true">' +
        '<div class="flex items-center gap-2">' +
          '<span class="skeleton-line skeleton-shimmer w-16 h-5 rounded-md"></span>' +
          '<span class="skeleton-line skeleton-shimmer w-28 h-5 rounded-md"></span>' +
        '</div>' +
        '<span class="skeleton-line skeleton-line--lg skeleton-shimmer w-3/4 h-6"></span>' +
        '<span class="skeleton-line skeleton-shimmer w-full"></span>' +
      '</div>';

      return '<section class="space-y-5" aria-busy="true" aria-label="Loading">' +
        '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
          '<div class="admin-stat-tile space-y-2"><span class="skeleton-line skeleton-shimmer w-16"></span><span class="skeleton-line skeleton-line--lg skeleton-shimmer w-12 h-6"></span></div>' +
          '<div class="admin-stat-tile space-y-2"><span class="skeleton-line skeleton-shimmer w-16"></span><span class="skeleton-line skeleton-line--lg skeleton-shimmer w-12 h-6"></span></div>' +
          '<div class="admin-stat-tile space-y-2"><span class="skeleton-line skeleton-shimmer w-16"></span><span class="skeleton-line skeleton-line--lg skeleton-shimmer w-12 h-6"></span></div>' +
          '<div class="admin-stat-tile space-y-2"><span class="skeleton-line skeleton-shimmer w-16"></span><span class="skeleton-line skeleton-line--lg skeleton-shimmer w-12 h-6"></span></div>' +
        '</div>' +
        '<div class="space-y-3">' + row + row + row + '</div>' +
      '</section>';
    }

    /* ------------------------------------------------------------------
       Sign-In Gate (Minimal, Private, Zero Stack/Internal Disclosure)
       ------------------------------------------------------------------ */

    function renderAuthGate() {
      return '<div class="min-h-screen flex flex-col bg-paper">' +
        '<header class="editorial-topbar sticky top-0 z-40 border-b border-hairline">' +
          '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[4.5rem] flex items-center justify-between gap-3">' +
            '<div class="pt-0.5">' + WORDMARK_HOME + '</div>' +
            renderThemeToggleButton() +
          '</div>' +
        '</header>' +

        '<main class="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">' +
          '<div class="w-full max-w-[390px] space-y-5">' +
            '<div class="editorial-card p-6 sm:p-8 space-y-6">' +
              '<div class="space-y-1.5">' +
                '<h1 class="font-masthead text-2xl sm:text-3xl font-black text-ink tracking-tight">Sign in</h1>' +
                '<p class="text-sm text-ink-muted">Enter your credentials to access the dashboard.</p>' +
              '</div>' +

              '<form id="login-form" class="space-y-4">' +
                '<div class="space-y-1.5">' +
                  '<label class="block text-xs font-semibold text-ink-secondary" for="lg-email">Email</label>' +
                  '<input id="lg-email" name="email" type="email" required autocomplete="email" inputmode="email" placeholder="name@example.com" class="admin-input">' +
                '</div>' +
                '<div class="space-y-1.5">' +
                  '<div class="flex items-center justify-between gap-2">' +
                    '<label class="block text-xs font-semibold text-ink-secondary" for="lg-pass">Password</label>' +
                    '<button type="button" data-action="toggle-pass" class="text-xs font-medium text-ink-muted hover:text-ink cursor-pointer">' + (state.showPassword ? 'Hide' : 'Show') + '</button>' +
                  '</div>' +
                  '<input id="lg-pass" name="password" type="' + (state.showPassword ? 'text' : 'password') + '" required autocomplete="current-password" placeholder="Password" class="admin-input">' +
                '</div>' +
                (TURNSTILE_SITE_KEY
                  ? '<div id="turnstile-slot" class="min-h-[65px] flex items-center justify-center rounded-xl"></div>'
                  : '') +
                '<div id="auth-error" role="alert" class="hidden rounded-xl border border-[var(--danger)]/40 bg-[var(--danger-soft)] text-[var(--danger)] px-3.5 py-2.5 text-xs font-medium"></div>' +
                '<button type="submit" ' + ((state.loggingIn || (TURNSTILE_SITE_KEY && !turnstileToken)) ? 'disabled' : '') + ' class="btn-accent w-full py-2.5 text-sm font-semibold rounded-xl">' +
                  (state.loggingIn ? 'Signing in...' : 'Sign in') +
                '</button>' +
              '</form>' +
            '</div>' +

            '<p class="text-center text-xs text-ink-faint">' +
              '<a href="/" class="hover:text-ink transition-colors">&larr; Back to site</a>' +
            '</p>' +
          '</div>' +
        '</main>' +
      '</div>';
    }

    /* ------------------------------------------------------------------
       Authenticated Shell (Clean Production Header + Responsive Tabs)
       ------------------------------------------------------------------ */

    function renderTopBar() {
      var activeRunsCount = (state.runs || []).filter(function (r) { return r.status === 'queued' || r.status === 'running'; }).length;

      return '<header class="editorial-topbar sticky top-0 z-40 border-b border-hairline">' +
        '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[4.5rem] flex items-center justify-between gap-3">' +
          '<div class="flex items-center gap-2.5 min-w-0 pt-0.5">' +
            WORDMARK_ADMIN +
            (activeRunsCount > 0 ? '<span class="badge-editorial badge-accent">' + activeRunsCount + ' Running</span>' : '') +
          '</div>' +

          '<div class="flex items-center gap-1.5 sm:gap-2 shrink-0">' +
            renderThemeToggleButton() +
            '<a href="/" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg border border-hairline bg-surface text-xs font-semibold text-ink-secondary hover:text-ink hover:border-strong transition-colors" aria-label="View public site">' +
              '<span class="hidden sm:inline">View site</span>' +
              UI_ICONS.external +
            '</a>' +
            '<button type="button" data-action="logout" class="inline-flex items-center h-9 px-2.5 sm:px-3 rounded-lg border border-hairline bg-surface text-xs font-semibold text-ink-secondary hover:text-accent hover:border-strong transition-colors cursor-pointer">Sign out</button>' +
          '</div>' +
        '</div>' +

        '<div class="border-t border-hairline bg-subtle/50">' +
          '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 overflow-x-auto ribbon-scroll">' +
            '<nav class="flex items-center gap-1.5 min-w-max" role="tablist">' +
              renderTabButton('posts', UI_ICONS.note, 'Posts', state.posts.length) +
              renderTabButton('agent', UI_ICONS.spark, 'Automation', activeRunsCount > 0 ? activeRunsCount : null) +
              renderTabButton('skills', UI_ICONS.layers, 'Categories', state.skills.length) +
              renderTabButton('security', TOPIC_ICONS['ai-security-jailbreaks'] || UI_ICONS.ledger, 'Security', (state.ipBlocks || []).filter(function (b) { return b.active; }).length || null) +
              renderTabButton('settings', UI_ICONS.ledger, 'Settings', null) +
            '</nav>' +
          '</div>' +
        '</div>' +
      '</header>';
    }

    function renderTabButton(id, iconHtml, label, count) {
      var active = state.activeTab === id;
      var countHtml = count != null
        ? '<span class="font-tabular text-[10px] px-1.5 py-0.5 rounded-md ' + (active ? 'text-[var(--bg-paper)] border border-current/25' : 'bg-surface border border-hairline text-ink-muted') + '">' + esc(count) + '</span>'
        : '';
      return '<button type="button" role="tab" aria-selected="' + active + '" data-action="switch-tab" data-tab="' + id + '" class="admin-tab ' + (active ? 'is-active' : '') + '">' +
        iconHtml +
        '<span>' + esc(label) + '</span>' +
        countHtml +
      '</button>';
    }

    /* ------------------------------------------------------------------
       Tab 1: Posts
       ------------------------------------------------------------------ */

    function renderPostsTab() {
      var filtered = state.posts.filter(function (p) {
        if (state.postFilter === 'draft' && p.status !== 'draft') return false;
        if (state.postFilter === 'published' && p.status !== 'published') return false;
        if (state.postSearch.trim()) {
          var q = state.postSearch.trim().toLowerCase();
          var kwStr = Array.isArray(p.keywords_json) ? p.keywords_json.join(' ') : '';
          var tagStr = Array.isArray(p.tags_json) ? p.tags_json.join(' ') : '';
          var hay = ((p.title || '') + ' ' + (p.slug || '') + ' ' + (p.category_slug || '') + ' ' + (p.description || '') + ' ' + kwStr + ' ' + tagStr).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });

      var draftCount = state.posts.filter(function (p) { return p.status === 'draft'; }).length;
      var pubCount = state.posts.filter(function (p) { return p.status === 'published'; }).length;
      var avgScore = state.posts.length > 0
        ? Math.round(state.posts.reduce(function (sum, p) { return sum + Number(p.quality_score || 0); }, 0) / state.posts.length)
        : 0;

      return '<section class="space-y-6">' +
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">' +
          '<h1 class="font-masthead text-2xl sm:text-3xl font-black text-ink">Posts</h1>' +
          '<div class="flex items-center gap-2">' +
            '<button type="button" data-action="refresh-all" class="btn-ghost text-xs font-semibold rounded-xl flex-1 sm:flex-none justify-center">Refresh</button>' +
            '<button type="button" data-action="new-post" class="btn-accent text-xs font-semibold rounded-xl flex-1 sm:flex-none justify-center">+ New post</button>' +
          '</div>' +
        '</div>' +

        '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
          '<div class="admin-stat-tile"><p class="text-xs text-ink-muted">Total</p><p class="font-masthead text-2xl font-black text-ink mt-0.5">' + state.posts.length + '</p></div>' +
          '<div class="admin-stat-tile"><p class="text-xs text-ink-muted">Published</p><p class="font-masthead text-2xl font-black text-[var(--success)] mt-0.5">' + pubCount + '</p></div>' +
          '<div class="admin-stat-tile"><p class="text-xs text-ink-muted">Drafts</p><p class="font-masthead text-2xl font-black text-[var(--warning)] mt-0.5">' + draftCount + '</p></div>' +
          '<div class="admin-stat-tile"><p class="text-xs text-ink-muted">Avg score</p><p class="font-masthead text-2xl font-black text-ink mt-0.5">' + (avgScore ? avgScore + '/100' : '—') + '</p></div>' +
        '</div>' +

        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
          '<div class="flex items-center gap-1.5 overflow-x-auto ribbon-scroll">' +
            renderFilterBtn('all', 'All (' + state.posts.length + ')') +
            renderFilterBtn('draft', 'Drafts (' + draftCount + ')') +
            renderFilterBtn('published', 'Published (' + pubCount + ')') +
          '</div>' +
          '<div class="w-full sm:w-72">' +
            '<input id="post-search-input" type="search" value="' + esc(state.postSearch) + '" placeholder="Filter posts..." class="admin-input h-10 sm:h-9">' +
          '</div>' +
        '</div>' +

        (filtered.length === 0
          ? '<div class="editorial-card p-10 text-center space-y-2">' +
              '<div class="mx-auto w-fit opacity-60">' + SNAKE_MINI + '</div>' +
              '<p class="font-masthead text-lg font-bold text-ink">No posts found</p>' +
              '<p class="text-sm text-ink-muted">Create a new post or run an automated draft in Automation.</p>' +
            '</div>'
          : '<div class="space-y-3">' + filtered.map(renderPostRow).join('') + '</div>') +
      '</section>';
    }

    function renderFilterBtn(val, label) {
      var active = state.postFilter === val;
      return '<button type="button" data-action="filter-posts" data-filter="' + val + '" class="px-3 py-1.5 rounded-lg text-xs font-semibold border-[1.5px] cursor-pointer whitespace-nowrap transition-colors ' +
        (active ? 'bg-[var(--ink-primary)] text-[var(--bg-paper)] border-[var(--ink-primary)]' : 'bg-surface text-ink-secondary border-hairline hover:border-strong hover:text-ink') +
      '">' + esc(label) + '</button>';
    }

    function renderPostRow(post) {
      var expanded = Boolean(state.expandedPostIds[post.id]);
      var score = Math.round(post.quality_score || 0);
      var scoreClass = score >= 85 ? 'badge-success' : score >= 70 ? 'badge-warning' : 'badge-danger';
      var isPub = post.status === 'published';
      var reviewNotes = Array.isArray(post.review_notes_json) ? post.review_notes_json : [];
      var lintErrors = Array.isArray(post.lint_errors_json) ? post.lint_errors_json : [];
      var bd = post.quality_breakdown_json || {};
      var isAdminLocked = post.admin_locked === true;

      return '<article class="editorial-card overflow-hidden">' +
        '<div class="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">' +
          '<div class="space-y-2 min-w-0 flex-1">' +
            '<div class="flex flex-wrap items-center gap-1.5">' +
              '<span class="badge-editorial ' + (isPub ? 'badge-success' : 'badge-warning') + '">' + (isPub ? 'Published' : 'Draft') + '</span>' +
              '<span class="badge-editorial inline-flex items-center gap-1.5">' + topicIcon(post.category_slug) + '<span>' + esc(post.category_slug) + '</span></span>' +
              '<span class="badge-editorial ' + scoreClass + '">' + score + '/100</span>' +
              (!post.lint_passed ? '<span class="badge-editorial badge-danger">Needs fix</span>' : '') +
              (isAdminLocked ? '<span class="badge-editorial badge-accent">Locked</span>' : '') +
            '</div>' +
            '<h2 class="font-masthead text-lg sm:text-xl font-bold text-ink leading-snug">' + esc(post.title) + '</h2>' +
            '<p class="text-xs sm:text-sm text-ink-secondary line-clamp-2 leading-relaxed">' + esc(post.description) + '</p>' +
            '<div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-tabular text-[11px] text-ink-faint">' +
              '<span class="truncate max-w-[220px] sm:max-w-none">/blog/' + esc(post.slug) + '</span>' +
              '<span>&middot;</span>' +
              '<span>' + esc(post.reading_time_minutes || 1) + ' min</span>' +
              '<span>&middot;</span>' +
              '<span>' + esc(fmtDate(post.updated_at || post.created_at)) + '</span>' +
            '</div>' +
          '</div>' +

          '<div class="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0 pt-2 border-t border-hairline lg:pt-0 lg:border-t-0">' +
            '<button type="button" data-action="toggle-post-notes" data-id="' + post.id + '" class="btn-ghost text-xs px-2.5 py-2 sm:py-1.5 rounded-lg justify-center">' +
              (expanded ? 'Hide audit' : 'Audit (' + (reviewNotes.length + lintErrors.length) + ')') +
            '</button>' +
            (!isPub || score < 80
              ? '<button type="button" data-action="improve-post" data-id="' + post.id + '" class="btn-ghost text-xs px-2.5 py-2 sm:py-1.5 rounded-lg justify-center font-semibold">Auto-improve</button>'
              : '') +
            (isPub
              ? '<button type="button" data-action="distribute-post" data-id="' + post.id + '" class="btn-ghost text-xs px-2.5 py-2 sm:py-1.5 rounded-lg justify-center font-semibold">Distribute</button>'
              : '') +
            '<button type="button" data-action="preview-post" data-id="' + post.id + '" class="btn-ghost text-xs px-2.5 py-2 sm:py-1.5 rounded-lg justify-center">Preview</button>' +
            '<button type="button" data-action="edit-post" data-id="' + post.id + '" class="btn-ghost text-xs px-2.5 py-2 sm:py-1.5 rounded-lg justify-center">Edit</button>' +
            (isPub
              ? '<button type="button" data-action="unpublish-post" data-id="' + post.id + '" class="btn-ghost text-xs px-2.5 py-2 sm:py-1.5 rounded-lg justify-center">Unpublish</button>'
              : '<button type="button" data-action="publish-post" data-id="' + post.id + '" class="btn-accent text-xs px-3 py-2 sm:py-1.5 rounded-lg justify-center">Publish</button>') +
            '<button type="button" data-action="delete-post" data-id="' + post.id + '" class="btn-danger text-xs px-2.5 py-2 sm:py-1.5 rounded-lg justify-center col-span-2 sm:col-span-1">Delete</button>' +
          '</div>' +
        '</div>' +

        (expanded
          ? '<div class="border-t border-hairline bg-subtle/50 p-4 sm:p-5 space-y-4 text-xs">' +
              '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-tabular">' +
                renderMiniMetric('SEO', bd.seo_structure) +
                renderMiniMetric('GEO', bd.geo_citation_readiness) +
                renderMiniMetric('Depth', bd.information_gain) +
                renderMiniMetric('Sources', bd.source_grounding) +
                renderMiniMetric('Style', bd.anti_slop_cleanliness) +
                renderMiniMetric('Policy', bd.adsense_compliance) +
              '</div>' +
              (bd.humanity_signals ? renderHumanityScorecard(bd.humanity_signals) : '') +
              '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
                '<div class="space-y-1.5">' +
                  '<p class="font-semibold text-ink">Review notes</p>' +
                  (reviewNotes.length > 0
                    ? '<ul class="list-disc pl-4 space-y-1 text-ink-secondary">' + reviewNotes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>'
                    : '<p class="text-ink-faint">No notes.</p>') +
                '</div>' +
                '<div class="space-y-1.5">' +
                  '<p class="font-semibold text-ink">Checks</p>' +
                  (lintErrors.length > 0
                    ? '<ul class="list-disc pl-4 space-y-1 text-[var(--danger)]">' + lintErrors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>'
                    : '<p class="text-[var(--success)]">All checks passed.</p>') +
                  (bd.judge_notes ? '<p class="pt-1 text-ink-muted">' + esc(bd.judge_notes) + '</p>' : '') +
                '</div>' +
              '</div>' +
            '</div>'
          : '') +
      '</article>';
    }

    function renderMiniMetric(label, val) {
      var v = val == null ? '—' : Math.round(val);
      return '<div class="rounded-lg border border-hairline bg-surface px-2.5 py-2">' +
        '<span class="block text-[10px] uppercase text-ink-faint">' + esc(label) + '</span>' +
        '<span class="text-sm font-semibold text-ink">' + esc(v) + '</span>' +
      '</div>';
    }

    function renderStylometryMetric(label, displayVal, tone) {
      var valClass = tone === 'good'
        ? 'text-[var(--success)]'
        : tone === 'warn'
          ? 'text-[var(--warning)]'
          : tone === 'bad'
            ? 'text-[var(--danger)]'
            : 'text-ink';
      return '<div class="rounded-lg border border-hairline bg-surface px-2.5 py-2">' +
        '<span class="block text-[10px] uppercase text-ink-faint">' + esc(label) + '</span>' +
        '<span class="text-sm font-semibold ' + valClass + '">' + esc(displayVal) + '</span>' +
      '</div>';
    }

    function renderHumanityScorecard(hs) {
      if (!hs || typeof hs !== 'object') return '';
      var likeness = hs.human_likeness_score != null ? Math.round(Number(hs.human_likeness_score)) : null;
      var burstiness = hs.sentence_length_std_dev != null ? Number(hs.sentence_length_std_dev) : null;
      var boldBullets = hs.bold_leadin_bullets != null ? Math.round(Number(hs.bold_leadin_bullets)) : null;
      var emDashes = hs.em_dash_per_100_words != null ? Number(hs.em_dash_per_100_words) : null;
      var roboticOpeners = hs.robotic_openers_count != null ? Math.round(Number(hs.robotic_openers_count)) : null;
      var concreteMetrics = hs.concrete_metric_hits != null ? Math.round(Number(hs.concrete_metric_hits)) : null;

      return '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-tabular">' +
        renderStylometryMetric('Naturalness', likeness == null ? '—' : (likeness + '/100'), likeness == null ? '' : (likeness >= 80 ? 'good' : likeness >= 65 ? 'warn' : 'bad')) +
        renderStylometryMetric('Variety σ', burstiness == null ? '—' : burstiness.toFixed(1), burstiness == null ? '' : (burstiness >= 5.0 ? 'good' : burstiness >= 3.5 ? 'warn' : 'bad')) +
        renderStylometryMetric('Bold bullets', boldBullets == null ? '—' : String(boldBullets), boldBullets == null ? '' : (boldBullets <= 2 ? 'good' : boldBullets <= 5 ? 'warn' : 'bad')) +
        renderStylometryMetric('Em-dashes/100w', emDashes == null ? '—' : emDashes.toFixed(2), emDashes == null ? '' : (emDashes <= 0.8 ? 'good' : emDashes <= 1.5 ? 'warn' : 'bad')) +
        renderStylometryMetric('Clichés', roboticOpeners == null ? '—' : String(roboticOpeners), roboticOpeners == null ? '' : (roboticOpeners === 0 ? 'good' : roboticOpeners <= 1 ? 'warn' : 'bad')) +
        renderStylometryMetric('Data points', concreteMetrics == null ? '—' : String(concreteMetrics), concreteMetrics == null ? '' : (concreteMetrics >= 5 ? 'good' : concreteMetrics >= 2 ? 'warn' : 'bad')) +
      '</div>';
    }

    /* ------------------------------------------------------------------
       Tab 2: Automation
       ------------------------------------------------------------------ */

    function renderAgentTab() {
      var mode = (state.settings && state.settings.publishing_mode) || 'draft_review';
      var isAuto = mode === 'auto_publish';
      var polling = hasActiveRuns(state.runs);
      var defaultModel = (state.settings && state.settings.openrouter_model) || 'baidu/ernie-5.5-flash-preview:free';

      var skillOptions = '<option value="">Auto-select category</option>' +
        state.skills.map(function (s) {
          return '<option value="' + esc(s.slug) + '">' + esc(s.name) + (s.enabled ? '' : ' (paused)') + '</option>';
        }).join('');

      var archOptions = '<option value="auto">Auto-select format</option>' +
        ARCHETYPES.map(function (a) {
          return '<option value="' + esc(a.value) + '">' + esc(a.label) + '</option>';
        }).join('');

      var runModelOptions = renderFreeModelOptions('', 'Default (' + defaultModel + ')');

      return '<section class="space-y-6">' +
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">' +
          '<h1 class="font-masthead text-2xl sm:text-3xl font-black text-ink">Automation</h1>' +
          '<div class="inline-flex items-center rounded-xl border border-hairline bg-surface p-0.5 text-xs self-start sm:self-auto" role="group" aria-label="Publishing Mode">' +
            '<button type="button" data-action="set-mode" data-mode="draft_review" class="px-3 py-1.5 rounded-lg cursor-pointer transition-colors ' + (!isAuto ? 'bg-[var(--ink-primary)] text-[var(--bg-paper)] font-semibold' : 'text-ink-muted hover:text-ink') + '">Draft review</button>' +
            '<button type="button" data-action="set-mode" data-mode="auto_publish" class="px-3 py-1.5 rounded-lg cursor-pointer transition-colors ' + (isAuto ? 'bg-[var(--accent)] text-white font-semibold' : 'text-ink-muted hover:text-ink') + '">Auto-publish</button>' +
          '</div>' +
        '</div>' +

        '<div class="editorial-card p-5 sm:p-6 space-y-4">' +
          '<h2 class="text-sm font-semibold text-ink">Start a research run</h2>' +
          '<form id="agent-run-form" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">' +
            '<div class="sm:col-span-2 lg:col-span-6 space-y-1.5">' +
              '<label class="block text-xs font-semibold text-ink-secondary" for="ag-topic">Topic <span class="font-normal text-ink-faint">(optional — blank scans feeds)</span></label>' +
              '<input id="ag-topic" name="topic" type="text" placeholder="Leave blank to discover a topic automatically" class="admin-input">' +
            '</div>' +
            '<div class="lg:col-span-6 space-y-1.5">' +
              '<label class="block text-xs font-semibold text-ink-secondary" for="ag-cat">Category</label>' +
              '<select id="ag-cat" name="category_slug" class="admin-select">' + skillOptions + '</select>' +
            '</div>' +
            '<div class="lg:col-span-4 space-y-1.5">' +
              '<label class="block text-xs font-semibold text-ink-secondary" for="ag-arch">Format</label>' +
              '<select id="ag-arch" name="archetype" class="admin-select">' + archOptions + '</select>' +
            '</div>' +
            '<div class="lg:col-span-5 space-y-1.5">' +
              '<label class="block text-xs font-semibold text-ink-secondary" for="ag-model">Model override</label>' +
              '<select id="ag-model" name="model_override" class="admin-select font-tabular">' + runModelOptions + '</select>' +
            '</div>' +
            '<div class="sm:col-span-2 lg:col-span-3">' +
              '<button type="submit" ' + (state.dispatching ? 'disabled' : '') + ' class="btn-accent w-full py-2.5 rounded-xl text-sm font-semibold">' + (state.dispatching ? 'Starting...' : 'Run now') + '</button>' +
            '</div>' +
            '<div class="sm:col-span-2 lg:col-span-12 flex items-center gap-2.5">' +
              '<input id="ag-force" name="force" type="checkbox" class="h-4 w-4 accent-[var(--accent)]">' +
              '<label for="ag-force" class="text-xs text-ink-secondary cursor-pointer">Force write even if novelty score is below threshold</label>' +
            '</div>' +
          '</form>' +
        '</div>' +

        '<div class="space-y-3">' +
          '<div class="flex items-center justify-between gap-3">' +
            '<div class="flex items-center gap-2.5">' +
              '<h2 class="font-masthead text-xl font-bold text-ink">Run history</h2>' +
              (polling ? '<span class="badge-editorial badge-accent">Live</span>' : '') +
            '</div>' +
            '<button type="button" data-action="refresh-runs" class="btn-ghost text-xs rounded-xl">Refresh</button>' +
          '</div>' +

          (state.runs.length === 0
            ? '<div class="editorial-card p-8 text-center text-sm text-ink-muted">No runs recorded yet.</div>'
            : '<div class="space-y-3">' + state.runs.map(renderRunRow).join('') + '</div>') +
        '</div>' +
      '</section>';
    }

    function renderRunRow(run) {
      var expanded = Boolean(state.expandedRunIds[run.id]);
      var isSkipped = run.status === 'skipped';
      var statusClass = run.status === 'completed'
        ? 'badge-success'
        : run.status === 'failed'
          ? 'badge-danger'
          : isSkipped
            ? 'badge-warning'
            : 'badge-accent';
      var trace = Array.isArray(run.trace_json) ? run.trace_json : [];
      var usage = run.token_usage_json || {};
      var totalTokens = usage.total_tokens || ((usage.prompt_tokens || 0) + (usage.completion_tokens || 0));

      return '<article class="editorial-card overflow-hidden">' +
        '<div class="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">' +
          '<div class="space-y-2 min-w-0 flex-1">' +
            '<div class="flex flex-wrap items-center gap-1.5">' +
              '<span class="badge-editorial ' + statusClass + '">' + esc(run.status) + '</span>' +
              '<span class="badge-editorial inline-flex items-center gap-1">' + topicIcon(run.category_slug) + '<span>' + esc(run.category_slug || 'auto') + '</span></span>' +
              (run.quality_score != null ? '<span class="badge-editorial badge-success">' + Math.round(run.quality_score) + '/100</span>' : '') +
            '</div>' +
            '<h3 class="font-semibold text-sm sm:text-base text-ink">' + esc(run.topic || 'Automatic topic discovery') + '</h3>' +
            '<div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-tabular text-[11px] text-ink-faint">' +
              '<span>#' + esc(run.id) + '</span>' +
              '<span>&middot;</span>' +
              '<span>' + esc(run.model_used || '—') + '</span>' +
              '<span>&middot;</span>' +
              '<span>' + esc(totalTokens ? totalTokens.toLocaleString('en-US') + ' tokens' : '0 tokens') + '</span>' +
              '<span>&middot;</span>' +
              '<span>' + esc(fmtDate(run.created_at)) + '</span>' +
            '</div>' +
            (run.decision_reason ? '<p class="text-xs text-ink-secondary bg-subtle/70 border border-hairline rounded-lg px-3 py-2">' + esc(run.decision_reason) + '</p>' : '') +
            (run.error_message ? '<p class="text-xs text-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 rounded-lg">' + esc(run.error_message) + '</p>' : '') +
          '</div>' +

          '<div class="flex flex-wrap items-center gap-2 shrink-0">' +
            (run.status === 'failed' ? '<button type="button" data-action="retry-run" data-id="' + run.id + '" class="btn-accent text-xs px-2.5 py-1.5 rounded-lg font-semibold">Rerun</button>' : '') +
            (run.post_id ? '<button type="button" data-action="preview-post" data-id="' + run.post_id + '" class="btn-ghost text-xs px-2.5 py-1.5 rounded-lg">Preview</button>' : '') +
            (run.post_id ? '<button type="button" data-action="edit-post" data-id="' + run.post_id + '" class="btn-ghost text-xs px-2.5 py-1.5 rounded-lg">Edit post</button>' : '') +
            '<button type="button" data-action="toggle-run-trace" data-id="' + run.id + '" class="btn-ghost text-xs px-2.5 py-1.5 rounded-lg">' +
              (expanded ? 'Hide logs' : 'Logs (' + trace.length + ')') +
            '</button>' +
          '</div>' +
        '</div>' +

        (expanded
          ? '<div class="border-t border-hairline bg-subtle/50 p-4 sm:p-5 space-y-2">' +
              (trace.length === 0
                ? '<p class="text-xs text-ink-faint">No log entries.</p>'
                : '<ol class="space-y-2">' + trace.map(function (t, idx) {
                    return '<li class="rounded-lg border border-hairline bg-surface p-3 text-xs space-y-1">' +
                      '<div class="flex flex-wrap items-center justify-between gap-2 font-tabular">' +
                        '<div class="flex items-center gap-2">' +
                          '<span class="text-ink-faint">#' + (idx + 1) + '</span>' +
                          '<span class="badge-editorial ' + (t.ok ? 'badge-success' : 'badge-danger') + '">' + (t.ok ? 'OK' : 'ERR') + '</span>' +
                          '<span class="font-semibold text-ink">' + esc(t.tool_name) + '</span>' +
                        '</div>' +
                        '<span class="text-[11px] text-ink-faint">' + esc(fmtDate(t.timestamp)) + '</span>' +
                      '</div>' +
                      (t.url ? '<p class="font-tabular text-[11px] text-accent break-all">' + esc(t.url) + '</p>' : '') +
                      '<p class="text-ink-secondary leading-relaxed">' + esc(t.summary) + '</p>' +
                    '</li>';
                  }).join('') + '</ol>') +
            '</div>'
          : '') +
      '</article>';
    }

    /* ------------------------------------------------------------------
       Tab 3: Categories
       ------------------------------------------------------------------ */

    function renderSkillsTab() {
      return '<section class="space-y-6">' +
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">' +
          '<h1 class="font-masthead text-2xl sm:text-3xl font-black text-ink">Categories</h1>' +
          '<button type="button" data-action="new-skill" class="btn-accent text-xs font-semibold rounded-xl self-start sm:self-auto">+ New category</button>' +
        '</div>' +

        (state.skills.length === 0
          ? '<div class="editorial-card p-8 text-center text-sm text-ink-muted">No categories configured.</div>'
          : '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' + state.skills.map(renderSkillCard).join('') + '</div>') +
      '</section>';
    }

    function renderSkillCard(skill) {
      var feeds = Array.isArray(skill.research_feeds_json) ? skill.research_feeds_json : [];
      var queries = Array.isArray(skill.search_queries_json) ? skill.search_queries_json : [];

      return '<article class="editorial-card p-5 flex flex-col justify-between gap-4">' +
        '<div class="space-y-2.5">' +
          '<div class="flex items-center justify-between gap-2">' +
            '<div class="flex items-center gap-2">' +
              '<span class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-hairline bg-paper text-ink">' + topicIcon(skill.slug) + '</span>' +
              '<span class="badge-editorial ' + (skill.enabled ? 'badge-success' : 'badge-warning') + '">' + (skill.enabled ? 'Active' : 'Paused') + '</span>' +
              '<span class="badge-editorial">P' + esc(skill.priority) + '</span>' +
            '</div>' +
            '<span class="font-tabular text-[11px] text-ink-faint truncate">' + esc(skill.slug) + '</span>' +
          '</div>' +
          '<h2 class="font-masthead text-lg sm:text-xl font-bold text-ink">' + esc(skill.name) + '</h2>' +
          '<p class="text-xs sm:text-sm text-ink-secondary leading-relaxed">' + esc(skill.description) + '</p>' +
        '</div>' +

        '<div class="pt-3 border-t border-hairline flex items-center justify-between gap-3">' +
          '<span class="font-tabular text-[11px] text-ink-faint">' + feeds.length + ' feeds &middot; ' + queries.length + ' queries</span>' +
          '<div class="flex items-center gap-2">' +
            '<button type="button" data-action="edit-skill" data-slug="' + esc(skill.slug) + '" class="btn-ghost text-xs px-2.5 py-1.5 rounded-lg">Edit</button>' +
            '<button type="button" data-action="delete-skill" data-slug="' + esc(skill.slug) + '" class="btn-danger text-xs px-2.5 py-1.5 rounded-lg">Delete</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }

    /* ------------------------------------------------------------------
       Tab 4: Settings
       ------------------------------------------------------------------ */

    function renderSettingsTab() {
      var s = state.settings || {};
      var prefHoursVal = Array.isArray(s.preferred_hours_utc_json)
        ? s.preferred_hours_utc_json.join(', ')
        : '8, 14, 20';
      var enabledCats = (state.skills || []).filter(function (sk) { return sk && sk.enabled; }).length || 7;
      var perCatCap = s.max_posts_per_day != null ? Number(s.max_posts_per_day) : 2;
      var totalDailyCapacity = perCatCap * enabledCats;

      return '<section class="space-y-6">' +
        '<h1 class="font-masthead text-2xl sm:text-3xl font-black text-ink">Settings</h1>' +

        '<form id="settings-form" class="space-y-5">' +
          '<div class="editorial-card p-5 sm:p-6 space-y-4">' +
            '<div class="flex flex-wrap items-center justify-between gap-2">' +
              '<h2 class="text-sm font-semibold text-ink">Publishing &amp; Schedule</h2>' +
              '<span class="badge-editorial badge-accent font-tabular">Up to ' + totalDailyCapacity + ' posts/day (' + perCatCap + '/cat × ' + enabledCats + ' beats)</span>' +
            '</div>' +

            '<div class="flex flex-wrap items-center gap-2">' +
              SCHEDULE_PRESETS.map(function (sp, idx) {
                return '<button type="button" data-action="apply-schedule-preset" data-schedule-preset="' + idx + '" class="px-2.5 py-1.5 rounded-lg border border-hairline bg-subtle/60 hover:border-strong text-xs text-ink-secondary hover:text-ink cursor-pointer transition-colors">' + esc(sp.label) + '</button>';
              }).join('') +
            '</div>' +

            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-mode">Publishing mode</label>' +
                '<select id="st-mode" name="publishing_mode" class="admin-select">' +
                  '<option value="draft_review"' + (s.publishing_mode !== 'auto_publish' ? ' selected' : '') + '>Draft review</option>' +
                  '<option value="auto_publish"' + (s.publishing_mode === 'auto_publish' ? ' selected' : '') + '>Auto-publish</option>' +
                '</select>' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-score">Minimum publish score (50–100)</label>' +
                '<input id="st-score" name="min_publish_score" type="number" min="50" max="100" value="' + esc(s.min_publish_score != null ? s.min_publish_score : 80) + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-rpd">Discovery runs per day (1–24)</label>' +
                '<input id="st-rpd" name="runs_per_day" type="number" min="1" max="24" value="' + esc(s.runs_per_day != null ? s.runs_per_day : 3) + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-hours">Preferred UTC hours (blank = even interval)</label>' +
                '<input id="st-hours" name="preferred_hours_utc" type="text" value="' + esc(prefHoursVal) + '" placeholder="Leave blank for even hourly sweep" class="admin-input font-tabular">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-max-posts">Max posts per category / day (1–24)</label>' +
                '<input id="st-max-posts" name="max_posts_per_day" type="number" min="1" max="24" value="' + esc(perCatCap) + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-novelty">Minimum novelty score (0–100)</label>' +
                '<input id="st-novelty" name="min_novelty_score" type="number" min="0" max="100" value="' + esc(s.min_novelty_score != null ? s.min_novelty_score : 68) + '" class="admin-input">' +
              '</div>' +
              '<div class="flex items-center gap-2.5 sm:col-span-2">' +
                '<input id="st-sched" name="schedule_enabled" type="checkbox"' + (s.schedule_enabled ? ' checked' : '') + ' class="h-4 w-4 accent-[var(--accent)]">' +
                '<label for="st-sched" class="text-sm text-ink cursor-pointer">Enable scheduled runs</label>' +
              '</div>' +
            '</div>' +
            '<div class="space-y-1.5">' +
              '<label class="block text-xs font-semibold text-ink-secondary" for="st-feed">Default feed URL</label>' +
              '<input id="st-feed" name="default_topic_feed" type="text" value="' + esc(s.default_topic_feed || '') + '" class="admin-input">' +
            '</div>' +
            '<p class="font-tabular text-xs text-ink-faint">Last scheduled run: ' + esc(fmtDate(s.last_scheduled_run_at)) + '</p>' +
          '</div>' +

          '<div class="editorial-card p-5 sm:p-6 space-y-4">' +
            '<div class="flex flex-wrap items-center justify-between gap-2">' +
              '<div class="flex flex-wrap items-center gap-2">' +
                '<h2 class="text-sm font-semibold text-ink">Models &amp; Dual-Family Critic Loop</h2>' +
                '<span class="badge-editorial badge-success">' + state.freeModels.length + ' verified $0 LLMs</span>' +
                (state.providers && state.providers.nvidia_nim ? '<span class="badge-editorial badge-accent">NIM active</span>' : '') +
              '</div>' +
              '<div class="flex flex-wrap items-center gap-2">' +
                '<button type="button" data-action="probe-models" ' + (state.probingModels ? 'disabled ' : '') + 'class="btn-ghost text-xs px-2.5 py-1.5 rounded-lg">' + (state.probingModels ? 'Testing pool...' : 'Test &amp; rank fastest') + '</button>' +
                '<button type="button" data-action="probe-apply-top3" ' + (state.probingModels ? 'disabled ' : '') + 'class="btn-accent text-xs px-2.5 py-1.5 rounded-lg font-semibold">' + (state.probingModels ? 'Running...' : 'Auto-apply top 3') + '</button>' +
                '<button type="button" data-action="refresh-free-models" class="btn-ghost text-xs px-2.5 py-1.5 rounded-lg">Refresh list</button>' +
              '</div>' +
            '</div>' +
            (Array.isArray(state.probeResults) && state.probeResults.length > 0
              ? '<div class="rounded-xl border border-hairline bg-subtle/50 p-3 space-y-2">' +
                  '<div class="flex flex-wrap items-center justify-between gap-2 text-[11px] font-tabular text-ink-muted">' +
                    '<span>Live model pool benchmark (sorted fastest first)</span>' +
                    '<span>' + state.probeResults.filter(function (r) { return r && r.ok && r.json_ok; }).length + '/' + state.probeResults.length + ' healthy</span>' +
                  '</div>' +
                  '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
                    state.probeResults.map(function (r) {
                      var ok = Boolean(r && r.ok && r.json_ok);
                      var provTag = r.provider === 'nvidia_nim' ? 'NIM' : 'POOL';
                      var speed = r.latency_ms >= 1000 ? (r.latency_ms / 1000).toFixed(2) + 's' : r.latency_ms + 'ms';
                      return '<div class="rounded-lg border border-hairline bg-surface px-3 py-2 flex items-center justify-between gap-2 text-xs">' +
                        '<div class="min-w-0">' +
                          '<div class="flex items-center gap-1.5">' +
                            '<span class="badge-editorial ' + (ok ? 'badge-success' : 'badge-danger') + '">' + (ok ? 'OK' : 'FAIL') + '</span>' +
                            '<span class="badge-editorial font-tabular">' + provTag + '</span>' +
                            '<span class="font-tabular text-[11px] text-ink-faint">' + esc(r.family || '') + '</span>' +
                          '</div>' +
                          '<p class="font-tabular text-[11px] text-ink truncate mt-1" title="' + esc(r.id) + '">' + esc(r.id) + '</p>' +
                          (r.error ? '<p class="text-[10px] text-[var(--danger)] truncate mt-0.5">' + esc(r.error) + '</p>' : '') +
                        '</div>' +
                        '<span class="font-tabular text-xs font-semibold shrink-0 ' + (ok ? 'text-ink' : 'text-ink-faint') + '">' + esc(speed) + '</span>' +
                      '</div>';
                    }).join('') +
                  '</div>' +
                '</div>'
              : '') +
            '<div class="flex items-center gap-2.5">' +
              '<input id="st-free-only" name="free_models_only" type="checkbox"' + (s.free_models_only !== false ? ' checked' : '') + ' class="h-4 w-4 accent-[var(--accent)]">' +
              '<label for="st-free-only" class="text-sm text-ink cursor-pointer">Restrict to $0 input / $0 output free LLMs only</label>' +
            '</div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div class="space-y-2">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-model">Main model</label>' +
                '<select id="st-model-picker" data-sync-target="st-model" aria-label="Pick main model" class="admin-select font-tabular">' +
                  renderFreeModelOptions(s.openrouter_model || '', 'Choose $0 LLM...') +
                '</select>' +
                '<input id="st-model" name="openrouter_model" data-sync-picker="st-model-picker" type="text" value="' + esc(s.openrouter_model || '') + '" placeholder="nim/nvidia/nemotron-3.5-super-vl-120b-a12b" class="admin-input font-tabular">' +
              '</div>' +
              '<div class="space-y-2">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-fb1">Fallback model 1</label>' +
                '<select id="st-fb1-picker" data-sync-target="st-fb1" aria-label="Pick fallback model 1" class="admin-select font-tabular">' +
                  renderFreeModelOptions(s.fallback_model_1 || '', 'Choose fallback 1...') +
                '</select>' +
                '<input id="st-fb1" name="fallback_model_1" data-sync-picker="st-fb1-picker" type="text" value="' + esc(s.fallback_model_1 || '') + '" placeholder="baidu/ernie-5.5-flash-preview:free" class="admin-input font-tabular">' +
              '</div>' +
              '<div class="space-y-2">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-fb2">Fallback model 2</label>' +
                '<select id="st-fb2-picker" data-sync-target="st-fb2" aria-label="Pick fallback model 2" class="admin-select font-tabular">' +
                  renderFreeModelOptions(s.fallback_model_2 || '', 'Choose fallback 2...') +
                '</select>' +
                '<input id="st-fb2" name="fallback_model_2" data-sync-picker="st-fb2-picker" type="text" value="' + esc(s.fallback_model_2 || '') + '" placeholder="nim/nvidia/nemotron-3-ultra-550b-a55b" class="admin-input font-tabular">' +
              '</div>' +
              '<div class="space-y-2">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-judge">Primary critic model (auto-paired with 2nd family)</label>' +
                '<select id="st-judge-picker" data-sync-target="st-judge" aria-label="Pick primary critic model" class="admin-select font-tabular">' +
                  renderFreeModelOptions(s.judge_model || '', 'Choose $0 LLM...') +
                '</select>' +
                '<input id="st-judge" name="judge_model" data-sync-picker="st-judge-picker" type="text" value="' + esc(s.judge_model || '') + '" placeholder="google/gemma-4-31b-it:free" class="admin-input font-tabular">' +
              '</div>' +
            '</div>' +
            '<p class="text-xs text-ink-muted">The backend automatically probes active providers, prefers the fastest healthy JSON-compliant models, fails over seamlessly across providers on rate limits, and audits every draft with two distinct model families.</p>' +
          '</div>' +

          '<div class="editorial-card p-5 sm:p-6 space-y-4">' +
            '<h2 class="text-sm font-semibold text-ink">Publication</h2>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-sname">Site name</label>' +
                '<input id="st-sname" name="site_name" type="text" value="' + esc(s.site_name || '') + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-base">Base URL</label>' +
                '<input id="st-base" name="base_url" type="url" value="' + esc(s.base_url || '') + '" placeholder="https://pyvren.com" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5 sm:col-span-2">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-tag">Tagline</label>' +
                '<input id="st-tag" name="site_tagline" type="text" value="' + esc(s.site_tagline || '') + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-author">Default author</label>' +
                '<input id="st-author" name="default_author" type="text" value="' + esc(s.default_author || '') + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-email">Public contact email</label>' +
                '<input id="st-email" name="contact_email" type="email" value="' + esc(s.contact_email || '') + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5 sm:col-span-2">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-bio">Author bio</label>' +
                '<textarea id="st-bio" name="author_bio" rows="3" class="admin-textarea">' + esc(s.author_bio || '') + '</textarea>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="editorial-card p-5 sm:p-6 space-y-4">' +
            '<h2 class="text-sm font-semibold text-ink">Analytics &amp; Monetization</h2>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-ga">Google Analytics ID (GA4)</label>' +
                '<input id="st-ga" name="ga_measurement_id" type="text" value="' + esc(s.ga_measurement_id || '') + '" placeholder="G-XXXXXXXXXX" class="admin-input font-tabular">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-ads">Google AdSense Client ID</label>' +
                '<input id="st-ads" name="adsense_client_id" type="text" value="' + esc(s.adsense_client_id || '') + '" placeholder="ca-pub-xxxxxxxxxxxxxxxx" class="admin-input font-tabular">' +
              '</div>' +
              '<div class="space-y-1.5 sm:col-span-2">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-ctaurl">CTA URL</label>' +
                '<input id="st-ctaurl" name="cta_url" type="text" value="' + esc(s.cta_url || '') + '" placeholder="/rss.xml" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5 sm:col-span-2">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-ctah">CTA headline</label>' +
                '<input id="st-ctah" name="cta_headline" type="text" value="' + esc(s.cta_headline || '') + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5 sm:col-span-2">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-ctab">CTA body</label>' +
                '<textarea id="st-ctab" name="cta_body" rows="2" class="admin-textarea">' + esc(s.cta_body || '') + '</textarea>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="editorial-card p-5 sm:p-6 space-y-4">' +
            '<div class="flex flex-wrap items-center justify-between gap-2">' +
              '<h2 class="text-sm font-semibold text-ink">Distribution &amp; Syndication (SEO-Safe Official APIs)</h2>' +
              '<span class="badge-editorial ' + (s.syndication_enabled ? 'badge-success' : 'badge-warning') + '">' + (s.syndication_enabled ? 'Auto-sweep ON' : 'Manual only') + '</span>' +
            '</div>' +
            '<p class="text-xs text-ink-muted leading-relaxed">IndexNow pings Bing, Copilot &amp; AI search immediately on publish. Blog/social channels wait for the delay window below so Google indexes <code>pyvren.com</code> first. Credentials are stored securely as server environment secrets.</p>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div class="flex items-center gap-2.5 sm:col-span-2">' +
                '<input id="st-syn-en" name="syndication_enabled" type="checkbox"' + (s.syndication_enabled ? ' checked' : '') + ' class="h-4 w-4 accent-[var(--accent)]">' +
                '<label for="st-syn-en" class="text-sm text-ink cursor-pointer">Enable automatic hourly syndication sweep for published posts</label>' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-syn-mode">Article syndication format</label>' +
                '<select id="st-syn-mode" name="syndication_mode" class="admin-select">' +
                  '<option value="teaser"' + (s.syndication_mode !== 'full_canonical' ? ' selected' : '') + '>Adapted teaser + link back to Pyvren (Recommended)</option>' +
                  '<option value="full_canonical"' + (s.syndication_mode === 'full_canonical' ? ' selected' : '') + '>Full article + canonical_url</option>' +
                '</select>' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-syn-delay">Delay before external syndication (hours, 0–168)</label>' +
                '<input id="st-syn-delay" name="syndication_delay_hours" type="number" min="0" max="168" value="' + esc(s.syndication_delay_hours != null ? s.syndication_delay_hours : 24) + '" class="admin-input font-tabular">' +
              '</div>' +
              '<div class="flex items-center gap-2.5 sm:col-span-2">' +
                '<input id="st-devto-draft" name="devto_publish_as_draft" type="checkbox"' + (s.devto_publish_as_draft ? ' checked' : '') + ' class="h-4 w-4 accent-[var(--accent)]">' +
                '<label for="st-devto-draft" class="text-sm text-ink cursor-pointer">Save DEV.to posts as drafts for manual review before publishing</label>' +
              '</div>' +
            '</div>' +
            '<div class="space-y-2">' +
              '<p class="text-xs font-semibold text-ink-secondary">Channels (enable which channels participate in auto-syndication)</p>' +
              '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">' +
                ((state.syndicationStatus && Array.isArray(state.syndicationStatus.channels) && state.syndicationStatus.channels.length > 0)
                  ? state.syndicationStatus.channels
                  : [
                      { channel: 'indexnow', label: 'IndexNow (Bing · Copilot · AI Search)', configured: false, secret_names: ['INDEXNOW_KEY'], note: '' },
                      { channel: 'devto', label: 'DEV.to (Official Forem API)', configured: false, secret_names: ['DEVTO_API_KEY'], note: '' },
                      { channel: 'bluesky', label: 'Bluesky (ATProto API)', configured: false, secret_names: ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD'], note: '' },
                      { channel: 'mastodon', label: 'Mastodon (REST API)', configured: false, secret_names: ['MASTODON_INSTANCE_URL', 'MASTODON_ACCESS_TOKEN'], note: '' },
                      { channel: 'hashnode', label: 'Hashnode (GraphQL API — Pro)', configured: false, secret_names: ['HASHNODE_TOKEN', 'HASHNODE_PUBLICATION_ID'], note: '' }
                    ]
                ).map(function (ch) {
                  var enabledList = Array.isArray(s.syndication_channels_json) ? s.syndication_channels_json : ['indexnow'];
                  var checked = enabledList.indexOf(ch.channel) !== -1;
                  return '<label class="rounded-xl border border-hairline bg-subtle/50 p-3 flex items-start gap-2.5 cursor-pointer">' +
                    '<input type="checkbox" name="syndication_channel" value="' + esc(ch.channel) + '"' + (checked ? ' checked' : '') + ' class="mt-0.5 h-4 w-4 accent-[var(--accent)]">' +
                    '<span class="min-w-0 flex-1 space-y-1">' +
                      '<span class="flex flex-wrap items-center justify-between gap-1.5">' +
                        '<span class="text-xs font-semibold text-ink">' + esc(ch.label) + '</span>' +
                        '<span class="badge-editorial ' + (ch.configured ? 'badge-success' : 'badge-warning') + '">' + (ch.configured ? 'Secret ready' : 'Needs secret') + '</span>' +
                      '</span>' +
                      '<span class="block font-tabular text-[10px] text-ink-faint">' + esc((ch.secret_names || []).join(' + ')) + '</span>' +
                    '</span>' +
                  '</label>';
                }).join('') +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="flex items-center justify-end">' +
            '<button type="submit" class="btn-accent w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold justify-center">Save changes</button>' +
          '</div>' +
        '</form>' +
      '</section>';
    }

    /* ------------------------------------------------------------------
       Modals (Mobile Bottom-Sheet -> Desktop Centered)
       ------------------------------------------------------------------ */

    function closeModal() {
      var root = document.getElementById('modal-root');
      if (root) root.innerHTML = '';
    }

    var activeManualExport = null;

    async function openSyndicateModal(postId) {
      var post = state.posts.find(function (p) { return p.id === postId; });
      var title = post ? post.title : ('Post #' + postId);
      var root = document.getElementById('modal-root');
      root.innerHTML = '<div class="admin-modal-backdrop" data-modal-backdrop>' +
        '<div class="admin-modal-panel max-w-3xl flex flex-col max-h-[90dvh]">' +
          '<div class="px-4 sm:px-5 py-3.5 border-b border-hairline flex items-center justify-between gap-3 bg-surface shrink-0">' +
            '<div class="min-w-0">' +
              '<p class="font-tabular text-[10px] uppercase tracking-wider text-accent font-semibold">Distribution &amp; Syndication</p>' +
              '<h2 class="font-masthead text-base sm:text-lg font-bold text-ink truncate">' + esc(title) + '</h2>' +
            '</div>' +
            '<button type="button" data-action="close-modal" class="btn-ghost text-xs rounded-lg shrink-0">Close</button>' +
          '</div>' +
          '<div id="syndicate-modal-body" class="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">' +
            '<p class="text-ink-muted">Loading channel status and export pack...</p>' +
          '</div>' +
        '</div>' +
      '</div>';

      try {
        var data = await apiFetch('/api/admin/posts/' + postId + '/syndications');
        activeManualExport = data && data.manual_export ? data.manual_export : null;
        renderSyndicateModalBody(postId, data);
      } catch (err) {
        var host = document.getElementById('syndicate-modal-body');
        if (host) host.innerHTML = '<p class="text-[var(--danger)]">' + esc((err && err.message) || 'Failed to load distribution status') + '</p>';
      }
    }

    function renderSyndicateModalBody(postId, data) {
      var host = document.getElementById('syndicate-modal-body');
      if (!host) return;
      var channels = (data && Array.isArray(data.channels)) ? data.channels : [];
      var records = (data && Array.isArray(data.syndications)) ? data.syndications : [];
      var byCh = {};
      records.forEach(function (r) { byCh[r.channel] = r; });
      var exp = (data && data.manual_export) || {};
      var defaultMode = (state.settings && state.settings.syndication_mode) || 'teaser';

      host.innerHTML =
        '<form id="syndicate-post-form" data-post-id="' + postId + '" class="space-y-4">' +
          '<div class="flex flex-wrap items-center justify-between gap-2">' +
            '<p class="text-xs font-semibold text-ink">Official API Channels</p>' +
            '<div class="flex items-center gap-2">' +
              '<select name="mode" class="admin-select text-xs py-1.5 px-2.5">' +
                '<option value="teaser"' + (defaultMode !== 'full_canonical' ? ' selected' : '') + '>Teaser + link back (SEO safe)</option>' +
                '<option value="full_canonical"' + (defaultMode === 'full_canonical' ? ' selected' : '') + '>Full article + canonical_url</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="space-y-2">' +
            channels.map(function (ch) {
              var rec = byCh[ch.channel];
              var statusBadge = rec
                ? '<span class="badge-editorial ' + (rec.status === 'published' ? 'badge-success' : rec.status === 'failed' ? 'badge-danger' : 'badge-warning') + '">' + esc(rec.status) + '</span>'
                : '<span class="badge-editorial">' + (ch.configured ? 'Ready' : 'No secret') + '</span>';
              var checked = ch.configured && (!rec || rec.status !== 'published');
              return '<label class="rounded-xl border border-hairline bg-subtle/50 p-3 flex items-start gap-2.5">' +
                '<input type="checkbox" name="channel" value="' + esc(ch.channel) + '"' + (checked ? ' checked' : '') + (!ch.configured ? ' disabled' : '') + ' class="mt-0.5 h-4 w-4 accent-[var(--accent)]">' +
                '<div class="min-w-0 flex-1 space-y-1">' +
                  '<div class="flex flex-wrap items-center justify-between gap-2">' +
                    '<span class="font-semibold text-ink">' + esc(ch.label) + '</span>' +
                    '<div class="flex items-center gap-1.5">' + statusBadge + '</div>' +
                  '</div>' +
                  (rec && rec.remote_url ? '<a href="' + esc(rec.remote_url) + '" target="_blank" rel="noopener noreferrer" class="block font-tabular text-[11px] text-accent hover:underline truncate">' + esc(rec.remote_url) + ' &nearr;</a>' : '') +
                  (rec && rec.error_message ? '<p class="text-[11px] text-[var(--danger)]">' + esc(rec.error_message) + '</p>' : '') +
                  (!ch.configured ? '<p class="font-tabular text-[10px] text-ink-faint">Set secret: ' + esc((ch.secret_names || []).join(', ')) + '</p>' : '') +
                '</div>' +
              '</label>';
            }).join('') +
          '</div>' +
          '<div class="flex flex-wrap items-center justify-between gap-3 pt-1">' +
            '<label class="inline-flex items-center gap-2 text-xs text-ink-secondary cursor-pointer">' +
              '<input type="checkbox" name="force" class="h-3.5 w-3.5 accent-[var(--accent)]">' +
              '<span>Force re-send already published channels</span>' +
            '</label>' +
            '<button type="submit" class="btn-accent text-xs px-4 py-2 rounded-lg font-semibold">Syndicate selected now</button>' +
          '</div>' +
        '</form>' +

        '<div class="border-t border-hairline pt-4 space-y-3">' +
          '<div class="flex flex-wrap items-center justify-between gap-2">' +
            '<p class="text-xs font-semibold text-ink">Manual Cross-Post Pack (Medium · Substack · HackerNoon)</p>' +
            '<div class="flex flex-wrap items-center gap-2">' +
              '<a href="' + esc(exp.medium_import_url || 'https://medium.com/p/import') + '" target="_blank" rel="noopener noreferrer" class="btn-ghost text-[11px] px-2.5 py-1 rounded-lg">Open Medium Import &nearr;</a>' +
              '<a href="' + esc(exp.hackernoon_import_url || 'https://app.hackernoon.com/new') + '" target="_blank" rel="noopener noreferrer" class="btn-ghost text-[11px] px-2.5 py-1 rounded-lg">Open HackerNoon &nearr;</a>' +
            '</div>' +
          '</div>' +
          '<p class="text-[11px] text-ink-muted">Medium closed new API tokens (Jan 2025) and Substack has no official publish API. Use their built-in Import URL tool (sets <code>rel="canonical"</code> automatically) or copy a formatted pack below:</p>' +
          '<div class="flex flex-wrap items-center gap-2">' +
            '<button type="button" data-action="copy-export-text" data-export-field="canonical_url" class="btn-ghost text-xs px-3 py-1.5 rounded-lg">Copy Canonical URL</button>' +
            '<button type="button" data-action="copy-export-text" data-export-field="teaser_markdown" class="btn-ghost text-xs px-3 py-1.5 rounded-lg">Copy Teaser Markdown</button>' +
            '<button type="button" data-action="copy-export-text" data-export-field="full_canonical_markdown" class="btn-ghost text-xs px-3 py-1.5 rounded-lg">Copy Full Markdown</button>' +
            '<button type="button" data-action="copy-export-text" data-export-field="social_blurb" class="btn-ghost text-xs px-3 py-1.5 rounded-lg">Copy Social Blurb</button>' +
          '</div>' +
        '</div>';
    }

    async function openPreviewModal(postId) {
      var post = state.posts.find(function (p) { return p.id === postId; });
      var title = post ? post.title : ('Post #' + postId);
      var root = document.getElementById('modal-root');
      root.innerHTML = '<div class="admin-modal-backdrop" data-modal-backdrop>' +
        '<div class="admin-modal-panel max-w-5xl flex flex-col" style="height:90dvh">' +
          '<div class="px-4 sm:px-5 py-3.5 border-b border-hairline flex items-center justify-between gap-3 bg-surface shrink-0">' +
            '<h2 class="font-masthead text-base sm:text-lg font-bold text-ink truncate">' + esc(title) + '</h2>' +
            '<button type="button" data-action="close-modal" class="btn-ghost text-xs rounded-lg shrink-0">Close</button>' +
          '</div>' +
          '<div id="preview-frame-host" class="relative flex-1 bg-paper overflow-hidden">' +
            '<div class="p-6 sm:p-8 space-y-4" aria-busy="true">' +
              '<span class="skeleton-line skeleton-shimmer w-32"></span>' +
              '<span class="skeleton-line skeleton-line--lg skeleton-shimmer w-3/4 h-8"></span>' +
              '<div class="relative rounded-2xl overflow-hidden h-56 border border-hairline"><div class="media-skeleton skeleton-shimmer absolute inset-0"><span class="media-skeleton-mark">' + SNAKE_MINI + '</span></div></div>' +
              '<span class="skeleton-line skeleton-shimmer w-full"></span>' +
              '<span class="skeleton-line skeleton-shimmer w-5/6"></span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

      try {
        var html = await apiFetch('/api/admin/preview/' + encodeURIComponent(postId), { rawText: true });
        var host = document.getElementById('preview-frame-host');
        if (!host) return;
        var iframe = document.createElement('iframe');
        iframe.setAttribute('sandbox', '');
        iframe.title = 'Post preview';
        iframe.className = 'w-full h-full bg-paper border-0';
        iframe.srcdoc = html;
        host.innerHTML = '';
        host.appendChild(iframe);
      } catch (err) {
        var hostErr = document.getElementById('preview-frame-host');
        if (hostErr) {
          hostErr.innerHTML = '<div class="p-8 text-center text-sm text-[var(--danger)]">' + esc((err && err.message) || 'Unable to load preview.') + '</div>';
        }
      }
    }

    function openPostEditorModal(post) {
      var isEdit = Boolean(post && post.id);
      var p = post || {
        title: '',
        slug: '',
        description: '',
        tldr_summary: '',
        key_facts_json: [],
        faq_json: [],
        body_markdown: '',
        author: (state.settings && state.settings.default_author) || DEFAULT_AUTHOR,
        category_slug: (state.skills[0] && state.skills[0].slug) || 'ai-coding-agents-mcp',
        archetype: 'architecture-analysis',
        tags_json: [],
        keywords_json: [],
        sources_json: [],
        review_notes_json: [],
        status: 'draft',
        admin_locked: false,
        last_edited_by: null
      };

      var catOpts = state.skills.map(function (s) {
        return '<option value="' + esc(s.slug) + '"' + (s.slug === p.category_slug ? ' selected' : '') + '>' + esc(s.name) + '</option>';
      }).join('');
      if (!catOpts) {
        catOpts = '<option value="' + esc(p.category_slug || 'ai-coding-agents-mcp') + '">' + esc(p.category_slug || 'ai-coding-agents-mcp') + '</option>';
      }

      var archOpts = ARCHETYPES.map(function (a) {
        return '<option value="' + esc(a.value) + '"' + (a.value === p.archetype ? ' selected' : '') + '>' + esc(a.label) + '</option>';
      }).join('');

      var factsLines = (Array.isArray(p.key_facts_json) ? p.key_facts_json : [])
        .map(function (f) { return [f.label || '', f.value || '', f.source_url || ''].filter(Boolean).join(' | '); })
        .join('\\n');

      var faqJsonText = JSON.stringify(Array.isArray(p.faq_json) ? p.faq_json : [], null, 2);

      var root = document.getElementById('modal-root');
      root.innerHTML = '<div class="admin-modal-backdrop" data-modal-backdrop>' +
        '<div class="admin-modal-panel max-w-4xl flex flex-col">' +
          '<div class="sticky top-0 z-10 bg-paper px-4 sm:px-6 py-4 border-b border-hairline flex items-center justify-between gap-3">' +
            '<h2 class="font-masthead text-lg sm:text-xl font-bold text-ink truncate">' + (isEdit ? esc(p.title) : 'New post') + '</h2>' +
            '<button type="button" data-action="close-modal" class="btn-ghost text-xs rounded-lg shrink-0">Close</button>' +
          '</div>' +

          '<form id="post-editor-form" data-post-id="' + (isEdit ? p.id : '') + '" class="p-4 sm:p-6 space-y-4">' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div class="space-y-1 sm:col-span-2">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Title</label>' +
                '<input name="title" type="text" required value="' + esc(p.title) + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Slug</label>' +
                '<input name="slug" type="text" value="' + esc(p.slug || '') + '" placeholder="auto-generated" class="admin-input font-tabular">' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Author</label>' +
                '<input name="author" type="text" value="' + esc(p.author || '') + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Category</label>' +
                '<select name="category_slug" class="admin-select">' + catOpts + '</select>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Format</label>' +
                '<select name="archetype" class="admin-select">' + archOpts + '</select>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Status</label>' +
                '<select name="status" class="admin-select">' +
                  '<option value="draft"' + (p.status !== 'published' ? ' selected' : '') + '>Draft</option>' +
                  '<option value="published"' + (p.status === 'published' ? ' selected' : '') + '>Published</option>' +
                '</select>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Tags (comma-separated)</label>' +
                '<input name="tags" type="text" value="' + esc(Array.isArray(p.tags_json) ? p.tags_json.join(', ') : '') + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1 sm:col-span-2">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Keywords (comma-separated)</label>' +
                '<input name="keywords" type="text" value="' + esc(Array.isArray(p.keywords_json) ? p.keywords_json.join(', ') : '') + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Cover image URL</label>' +
                '<input name="cover_image_url" type="url" value="' + esc(p.cover_image_url || '') + '" placeholder="https://..." class="admin-input font-tabular">' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Cover image alt</label>' +
                '<input name="cover_image_alt" type="text" value="' + esc(p.cover_image_alt || '') + '" class="admin-input">' +
              '</div>' +
            '</div>' +

            '<div class="space-y-1">' +
              '<label class="block text-xs font-semibold text-ink-secondary">Description</label>' +
              '<textarea name="description" rows="2" required class="admin-textarea">' + esc(p.description || '') + '</textarea>' +
            '</div>' +

            '<div class="space-y-1">' +
              '<label class="block text-xs font-semibold text-ink-secondary">Summary (TL;DR)</label>' +
              '<textarea name="tldr_summary" rows="2" class="admin-textarea">' + esc(p.tldr_summary || '') + '</textarea>' +
            '</div>' +

            '<div class="space-y-1">' +
              '<label class="block text-xs font-semibold text-ink-secondary">Body (Markdown)</label>' +
              '<textarea name="body_markdown" rows="12" required class="admin-textarea">' + esc(p.body_markdown || '') + '</textarea>' +
            '</div>' +

            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Key facts (Label | Value | URL)</label>' +
                '<textarea name="key_facts_lines" rows="4" class="admin-textarea">' + esc(factsLines) + '</textarea>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Sources (one URL per line)</label>' +
                '<textarea name="sources_lines" rows="4" class="admin-textarea">' + esc(arrayToLines(p.sources_json)) + '</textarea>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">FAQ JSON</label>' +
                '<textarea name="faq_json_text" rows="4" class="admin-textarea">' + esc(faqJsonText) + '</textarea>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Review notes</label>' +
                '<textarea name="review_notes_lines" rows="4" class="admin-textarea">' + esc(arrayToLines(p.review_notes_json)) + '</textarea>' +
              '</div>' +
            '</div>' +

            '<div id="lint-preview-box" class="hidden rounded-xl border border-hairline bg-subtle p-4 text-xs space-y-2"></div>' +

            '<div class="sticky bottom-0 bg-paper pt-3 pb-1 border-t border-hairline flex flex-wrap items-center justify-between gap-2">' +
              '<button type="button" data-action="dry-run-lint" class="btn-ghost text-xs rounded-lg">Run check</button>' +
              '<div class="flex items-center gap-2">' +
                '<button type="button" data-action="close-modal" class="btn-ghost text-xs rounded-lg">Cancel</button>' +
                '<button type="submit" class="btn-accent text-xs px-5 rounded-lg font-semibold">' + (isEdit ? 'Save' : 'Create') + '</button>' +
              '</div>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';
    }

    function extractPostPayload(form) {
      var fd = new FormData(form);
      var keyFacts = linesToArray(fd.get('key_facts_lines')).map(function (line) {
        var parts = line.split('|').map(function (x) { return x.trim(); });
        var item = { label: parts[0] || '', value: parts[1] || '' };
        if (parts[2]) item.source_url = parts[2];
        return item;
      }).filter(function (f) { return f.label && f.value; });

      var faq = [];
      var rawFaq = String(fd.get('faq_json_text') || '').trim();
      if (rawFaq) {
        try {
          var parsedFaq = JSON.parse(rawFaq);
          if (Array.isArray(parsedFaq)) faq = parsedFaq;
        } catch (e) {
          throw new Error('FAQ JSON must be a valid array of {question, answer}.');
        }
      }

      var tags = String(fd.get('tags') || '')
        .split(',')
        .map(function (t) { return t.trim(); })
        .filter(Boolean);

      var kwSeen = {};
      var keywords = [];
      String(fd.get('keywords') || '')
        .split(',')
        .forEach(function (k) {
          var trimmed = k.trim();
          if (!trimmed) return;
          var key = trimmed.toLowerCase();
          if (kwSeen[key]) return;
          kwSeen[key] = true;
          keywords.push(trimmed);
        });

      return {
        title: String(fd.get('title') || '').trim(),
        slug: String(fd.get('slug') || '').trim() || undefined,
        author: String(fd.get('author') || '').trim() || undefined,
        category_slug: String(fd.get('category_slug') || '').trim(),
        archetype: String(fd.get('archetype') || 'architecture-analysis'),
        status: String(fd.get('status') || 'draft'),
        cover_image_url: String(fd.get('cover_image_url') || '').trim() || null,
        cover_image_alt: String(fd.get('cover_image_alt') || '').trim() || null,
        description: String(fd.get('description') || '').trim(),
        tldr_summary: String(fd.get('tldr_summary') || '').trim(),
        body_markdown: String(fd.get('body_markdown') || ''),
        tags: tags,
        keywords: keywords,
        sources: linesToArray(fd.get('sources_lines')),
        key_facts: keyFacts,
        faq: faq,
        review_notes: linesToArray(fd.get('review_notes_lines'))
      };
    }

    function openSkillEditorModal(skill) {
      var isEdit = Boolean(skill && skill.slug);
      var s = skill || {
        slug: '',
        name: '',
        description: '',
        enabled: true,
        priority: 50,
        target_audience: '',
        system_instructions: '',
        research_feeds_json: [],
        search_queries_json: [],
        preferred_archetypes_json: ['architecture-analysis'],
        required_sections_json: [],
        banned_patterns_json: []
      };
      var selectedArchs = Array.isArray(s.preferred_archetypes_json) ? s.preferred_archetypes_json : [];

      var root = document.getElementById('modal-root');
      root.innerHTML = '<div class="admin-modal-backdrop" data-modal-backdrop>' +
        '<div class="admin-modal-panel max-w-3xl flex flex-col">' +
          '<div class="sticky top-0 z-10 bg-paper px-4 sm:px-6 py-4 border-b border-hairline flex items-center justify-between gap-3">' +
            '<h2 class="font-masthead text-lg sm:text-xl font-bold text-ink truncate">' + (isEdit ? esc(s.name) : 'New category') + '</h2>' +
            '<button type="button" data-action="close-modal" class="btn-ghost text-xs rounded-lg shrink-0">Close</button>' +
          '</div>' +

          '<form id="skill-editor-form" data-is-edit="' + (isEdit ? '1' : '0') + '" class="p-4 sm:p-6 space-y-4">' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Name</label>' +
                '<input name="name" type="text" required value="' + esc(s.name) + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Slug</label>' +
                '<input name="slug" type="text" required ' + (isEdit ? 'readonly' : '') + ' value="' + esc(s.slug) + '" class="admin-input font-tabular' + (isEdit ? ' opacity-70' : '') + '">' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Priority (1–100)</label>' +
                '<input name="priority" type="number" min="1" max="100" value="' + esc(s.priority != null ? s.priority : 50) + '" class="admin-input">' +
              '</div>' +
              '<div class="flex items-center gap-2.5 sm:pt-5">' +
                '<input id="sk-enabled" name="enabled" type="checkbox"' + (s.enabled ? ' checked' : '') + ' class="h-4 w-4 accent-[var(--accent)]">' +
                '<label for="sk-enabled" class="text-sm text-ink cursor-pointer">Active</label>' +
              '</div>' +
            '</div>' +

            '<div class="space-y-1">' +
              '<label class="block text-xs font-semibold text-ink-secondary">Description</label>' +
              '<textarea name="description" rows="2" required class="admin-textarea">' + esc(s.description) + '</textarea>' +
            '</div>' +

            '<div class="space-y-1">' +
              '<label class="block text-xs font-semibold text-ink-secondary">Audience</label>' +
              '<input name="target_audience" type="text" value="' + esc(s.target_audience || '') + '" class="admin-input">' +
            '</div>' +

            '<div class="space-y-1">' +
              '<label class="block text-xs font-semibold text-ink-secondary">Instructions</label>' +
              '<textarea name="system_instructions" rows="5" required class="admin-textarea">' + esc(s.system_instructions || '') + '</textarea>' +
            '</div>' +

            '<div class="space-y-1.5">' +
              '<span class="block text-xs font-semibold text-ink-secondary">Formats</span>' +
              '<div class="flex flex-wrap gap-3">' +
                ARCHETYPES.map(function (a) {
                  var chk = selectedArchs.indexOf(a.value) !== -1 ? ' checked' : '';
                  return '<label class="inline-flex items-center gap-2 text-xs text-ink-secondary cursor-pointer">' +
                    '<input type="checkbox" name="preferred_archetypes" value="' + esc(a.value) + '"' + chk + ' class="accent-[var(--accent)]">' +
                    '<span>' + esc(a.label) + '</span>' +
                  '</label>';
                }).join('') +
              '</div>' +
            '</div>' +

            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Feeds (one URL per line)</label>' +
                '<textarea name="research_feeds" rows="4" class="admin-textarea">' + esc(arrayToLines(s.research_feeds_json)) + '</textarea>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Search queries (one per line)</label>' +
                '<textarea name="search_queries" rows="4" class="admin-textarea">' + esc(arrayToLines(s.search_queries_json)) + '</textarea>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Required sections</label>' +
                '<textarea name="required_sections" rows="3" class="admin-textarea">' + esc(arrayToLines(s.required_sections_json)) + '</textarea>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block text-xs font-semibold text-ink-secondary">Disallowed phrases</label>' +
                '<textarea name="banned_patterns" rows="3" class="admin-textarea">' + esc(arrayToLines(s.banned_patterns_json)) + '</textarea>' +
              '</div>' +
            '</div>' +

            '<div class="sticky bottom-0 bg-paper pt-3 pb-1 border-t border-hairline flex items-center justify-end gap-2">' +
              '<button type="button" data-action="close-modal" class="btn-ghost text-xs rounded-lg">Cancel</button>' +
              '<button type="submit" class="btn-accent text-xs px-5 rounded-lg font-semibold">' + (isEdit ? 'Save' : 'Create') + '</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';
    }

    /* ------------------------------------------------------------------
       Tab 4: Security (Login Audit Logs & Persistent IP Blocks)
       ------------------------------------------------------------------ */

    function renderSecurityTab() {
      var allLogs = state.securityLogs || [];
      var filteredLogs = allLogs.filter(function (l) {
        if (state.securityFilter === 'all') return true;
        if (state.securityFilter === 'logins') return l.event_type === 'login_success' || l.event_type === 'logout';
        if (state.securityFilter === 'failed') return l.event_type === 'login_failed' || l.event_type === 'captcha_failed';
        if (state.securityFilter === 'blocked') return l.event_type === 'login_blocked' || l.event_type === 'ip_banned' || l.event_type === 'rate_limited';
        return true;
      });
      var blocks = state.ipBlocks || [];
      var activeBlocks = blocks.filter(function (b) { return b.active; });
      var failedCount = allLogs.filter(function (l) { return l.event_type === 'login_failed' || l.event_type === 'captcha_failed'; }).length;
      var successCount = allLogs.filter(function (l) { return l.event_type === 'login_success'; }).length;

      function secFilterBtn(val, label) {
        var active = state.securityFilter === val;
        return '<button type="button" data-action="filter-security" data-filter="' + val + '" class="px-3 py-1.5 rounded-lg text-xs font-semibold border-[1.5px] cursor-pointer whitespace-nowrap transition-colors ' +
          (active ? 'bg-[var(--ink-primary)] text-[var(--bg-paper)] border-[var(--ink-primary)]' : 'bg-surface text-ink-secondary border-hairline hover:border-strong hover:text-ink') +
        '">' + esc(label) + '</button>';
      }

      function eventBadgeClass(ev) {
        if (ev === 'login_success') return 'badge-success';
        if (ev === 'login_failed' || ev === 'captcha_failed' || ev === 'ip_banned' || ev === 'login_blocked') return 'badge-danger';
        if (ev === 'rate_limited') return 'badge-warning';
        return '';
      }

      return '<section class="space-y-6">' +
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">' +
          '<h1 class="font-masthead text-2xl sm:text-3xl font-black text-ink">Security</h1>' +
          '<button type="button" data-action="refresh-security" class="btn-ghost text-xs font-semibold rounded-xl self-start sm:self-auto">Refresh logs</button>' +
        '</div>' +

        '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
          '<div class="admin-stat-tile"><p class="text-xs text-ink-muted">Recent events</p><p class="font-masthead text-2xl font-black text-ink mt-0.5">' + allLogs.length + '</p></div>' +
          '<div class="admin-stat-tile"><p class="text-xs text-ink-muted">Successful logins</p><p class="font-masthead text-2xl font-black text-[var(--success)] mt-0.5">' + successCount + '</p></div>' +
          '<div class="admin-stat-tile"><p class="text-xs text-ink-muted">Failed / challenge</p><p class="font-masthead text-2xl font-black text-[var(--danger)] mt-0.5">' + failedCount + '</p></div>' +
          '<div class="admin-stat-tile"><p class="text-xs text-ink-muted">Active IP bans</p><p class="font-masthead text-2xl font-black text-[var(--warning)] mt-0.5">' + activeBlocks.length + '</p></div>' +
        '</div>' +

        '<div class="editorial-card p-5 sm:p-6 space-y-4">' +
          '<div class="flex flex-wrap items-center justify-between gap-2">' +
            '<h2 class="text-sm font-semibold text-ink">Blocked IPs</h2>' +
            '<span class="font-tabular text-xs text-ink-faint">Auto-bans IPs after repeated rate-limit, captcha, or login abuse</span>' +
          '</div>' +

          '<form id="block-ip-form" class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">' +
            '<div class="sm:col-span-4 space-y-1">' +
              '<label class="block text-xs font-semibold text-ink-secondary" for="blk-ip">IP address</label>' +
              '<input id="blk-ip" name="ip_address" type="text" required placeholder="203.0.113.10" class="admin-input font-tabular">' +
            '</div>' +
            '<div class="sm:col-span-2 space-y-1">' +
              '<label class="block text-xs font-semibold text-ink-secondary" for="blk-min">Minutes</label>' +
              '<input id="blk-min" name="duration_minutes" type="number" min="1" max="525600" value="60" class="admin-input font-tabular">' +
            '</div>' +
            '<div class="sm:col-span-4 space-y-1">' +
              '<label class="block text-xs font-semibold text-ink-secondary" for="blk-reason">Reason</label>' +
              '<input id="blk-reason" name="reason" type="text" value="Suspicious login activity" class="admin-input">' +
            '</div>' +
            '<div class="sm:col-span-2">' +
              '<button type="submit" class="btn-danger w-full py-2.5 rounded-xl text-xs font-semibold justify-center">Block IP</button>' +
            '</div>' +
          '</form>' +

          (blocks.length === 0
            ? '<p class="text-xs text-ink-muted pt-1">No IP addresses are currently blocked.</p>'
            : '<div class="divide-y divide-[var(--border-hairline)] border-t border-hairline pt-2">' +
                blocks.map(function (b) {
                  return '<div class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">' +
                    '<div class="space-y-1 min-w-0">' +
                      '<div class="flex flex-wrap items-center gap-2">' +
                        '<span class="font-tabular text-xs font-semibold text-ink">' + esc(b.ip_address) + '</span>' +
                        '<span class="badge-editorial ' + (b.active ? 'badge-danger' : '') + '">' + (b.active ? 'Blocked' : 'Expired') + '</span>' +
                        '<span class="font-tabular text-[11px] text-ink-faint">' + esc(b.hit_count || 1) + ' hits</span>' +
                      '</div>' +
                      '<p class="text-xs text-ink-secondary">' + esc(b.reason) + ' &middot; until ' + esc(fmtDate(b.blocked_until)) + '</p>' +
                    '</div>' +
                    '<button type="button" data-action="unblock-ip" data-ip="' + esc(b.ip_address) + '" class="btn-ghost text-xs px-3 py-1.5 rounded-lg self-start sm:self-auto shrink-0">Unblock</button>' +
                  '</div>';
                }).join('') +
              '</div>') +
        '</div>' +

        '<div class="space-y-3">' +
          '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
            '<h2 class="font-masthead text-xl font-bold text-ink">Login &amp; Access Log</h2>' +
            '<div class="flex items-center gap-1.5 overflow-x-auto ribbon-scroll">' +
              secFilterBtn('all', 'All (' + allLogs.length + ')') +
              secFilterBtn('logins', 'Logins') +
              secFilterBtn('failed', 'Failed') +
              secFilterBtn('blocked', 'Blocked / Rate-limited') +
            '</div>' +
          '</div>' +

          (filteredLogs.length === 0
            ? '<div class="editorial-card p-8 text-center text-sm text-ink-muted">No security events match this filter.</div>'
            : '<div class="space-y-2">' +
                filteredLogs.map(function (l) {
                  return '<div class="editorial-card p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">' +
                    '<div class="space-y-1 min-w-0 flex-1">' +
                      '<div class="flex flex-wrap items-center gap-1.5">' +
                        '<span class="badge-editorial ' + eventBadgeClass(l.event_type) + '">' + esc(String(l.event_type || '').replace(/_/g, ' ')) + '</span>' +
                        '<span class="font-tabular text-xs font-semibold text-ink">' + esc(l.ip_address) + '</span>' +
                        (l.country ? '<span class="badge-editorial">' + esc(l.country) + '</span>' : '') +
                        (l.status_code ? '<span class="font-tabular text-[11px] text-ink-faint">HTTP ' + esc(l.status_code) + '</span>' : '') +
                        (l.email ? '<span class="font-tabular text-[11px] text-ink-secondary">' + esc(l.email) + '</span>' : '') +
                      '</div>' +
                      (l.reason ? '<p class="text-xs text-ink-secondary">' + esc(l.reason) + '</p>' : '') +
                      '<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-tabular text-[11px] text-ink-faint">' +
                        (l.method && l.path ? '<span>' + esc(l.method) + ' ' + esc(l.path) + '</span>' : '') +
                        (l.user_agent ? '<span class="truncate max-w-[280px] sm:max-w-md">' + esc(l.user_agent) + '</span>' : '') +
                      '</div>' +
                    '</div>' +
                    '<span class="font-tabular text-[11px] text-ink-faint shrink-0">' + esc(fmtDate(l.created_at)) + '</span>' +
                  '</div>';
                }).join('') +
              '</div>') +
        '</div>' +
      '</section>';
    }

    /* ------------------------------------------------------------------
       Master Render
       ------------------------------------------------------------------ */

    function render() {
      var app = document.getElementById('app');
      if (!app) return;

      if (state.auth.loading) {
        return;
      }

      if (!state.auth.authenticated) {
        unmountActionTurnstile();
        unmountTurnstile();
        app.innerHTML = renderAuthGate();
        mountTurnstile(0);
        return;
      }

      unmountTurnstile();
      warmActionTurnstile(0);

      var tabHtml = '';
      if (state.loadingData && !state.hasLoadedOnce) {
        tabHtml = renderWorkspaceSkeleton();
      } else if (state.activeTab === 'posts') {
        tabHtml = renderPostsTab();
      } else if (state.activeTab === 'agent') {
        tabHtml = renderAgentTab();
      } else if (state.activeTab === 'skills') {
        tabHtml = renderSkillsTab();
      } else if (state.activeTab === 'security') {
        tabHtml = renderSecurityTab();
      } else {
        tabHtml = renderSettingsTab();
      }

      app.innerHTML = renderTopBar() +
        '<main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">' +
          tabHtml +
        '</main>';
    }

    /* ------------------------------------------------------------------
       Event Delegation & Form Submissions
       ------------------------------------------------------------------ */

    document.addEventListener('click', async function (e) {
      var target = e.target.closest('[data-action]');
      if (!target) {
        if (e.target.hasAttribute && e.target.hasAttribute('data-modal-backdrop')) {
          closeModal();
        }
        return;
      }

      var action = target.getAttribute('data-action');

      try {
        if (action === 'toggle-theme') {
          toggleTheme();
        } else if (action === 'toggle-pass') {
          state.showPassword = !state.showPassword;
          var passEl = document.getElementById('lg-pass');
          if (passEl) {
            passEl.type = state.showPassword ? 'text' : 'password';
            target.textContent = state.showPassword ? 'Hide' : 'Show';
          }
        } else if (action === 'close-modal') {
          closeModal();
        } else if (action === 'switch-tab') {
          state.activeTab = target.getAttribute('data-tab') || 'posts';
          render();
        } else if (action === 'logout') {
          try { await apiFetch('/api/admin/auth/logout', { method: 'POST' }); } catch (e2) {}
          writeStoredToken('');
          state.auth = { loading: false, authenticated: false, user: null };
          state.hasLoadedOnce = false;
          stopPolling();
          toast('Signed out', 'success');
          render();
        } else if (action === 'set-mode') {
          var mode = target.getAttribute('data-mode');
          var updated = await apiFetch('/api/admin/settings', {
            method: 'PUT',
            body: { publishing_mode: mode }
          });
          state.settings = (updated && (updated.settings || updated)) || Object.assign({}, state.settings, { publishing_mode: mode });
          toast('Publishing mode updated', 'success');
          render();
        } else if (action === 'refresh-all') {
          await loadAllWorkspaceData();
          toast('Refreshed', 'success');
        } else if (action === 'refresh-free-models') {
          await refreshFreeModelsOnly();
        } else if (action === 'probe-models') {
          await probeModelsNow(false);
        } else if (action === 'probe-apply-top3') {
          await probeModelsNow(true);
        } else if (action === 'refresh-runs') {
          await refreshRunsOnly();
          render();
        } else if (action === 'filter-posts') {
          state.postFilter = target.getAttribute('data-filter') || 'all';
          render();
        } else if (action === 'toggle-post-notes') {
          var pid = Number(target.getAttribute('data-id'));
          state.expandedPostIds[pid] = !state.expandedPostIds[pid];
          render();
        } else if (action === 'toggle-run-trace') {
          var rid = Number(target.getAttribute('data-id'));
          state.expandedRunIds[rid] = !state.expandedRunIds[rid];
          render();
        } else if (action === 'preview-post') {
          openPreviewModal(Number(target.getAttribute('data-id')));
        } else if (action === 'distribute-post') {
          openSyndicateModal(Number(target.getAttribute('data-id')));
        } else if (action === 'copy-export-text') {
          var expField = target.getAttribute('data-export-field') || '';
          var expText = activeManualExport && activeManualExport[expField] ? String(activeManualExport[expField]) : '';
          if (!expText) {
            toast('Nothing to copy for this field', 'error');
            return;
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(expText);
          } else {
            var ta = document.createElement('textarea');
            ta.value = expText;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          toast('Copied to clipboard', 'success');
        } else if (action === 'new-post') {
          openPostEditorModal(null);
        } else if (action === 'edit-post') {
          var editId = Number(target.getAttribute('data-id'));
          var found = state.posts.find(function (p) { return p.id === editId; });
          if (!found) {
            var fetched = await apiFetch('/api/admin/posts/' + editId);
            found = (fetched && (fetched.post || fetched)) || null;
          }
          if (found) openPostEditorModal(found);
        } else if (action === 'improve-post') {
          var impId = Number(target.getAttribute('data-id'));
          target.disabled = true;
          target.textContent = 'Improving...';
          try {
            var impRes = await apiFetch('/api/admin/posts/' + impId + '/improve', { method: 'POST' });
            if (impRes && impRes.execution_mode === 'workflow') {
              toast('Auto-improvement workflow started — check Automation logs', 'success');
              await refreshRunsOnly();
            } else {
              toast('Post improved (' + (impRes && impRes.previous_score) + ' -> ' + (impRes && impRes.final_score) + '/100)', 'success');
              await loadAllWorkspaceData();
            }
          } finally {
            target.disabled = false;
            target.textContent = 'Auto-improve';
          }
        } else if (action === 'retry-run') {
          var retryId = Number(target.getAttribute('data-id'));
          target.disabled = true;
          target.textContent = 'Rerunning...';
          try {
            await apiFetch('/api/admin/agent/runs/' + retryId + '/retry', { method: 'POST' });
            toast('Rerun started for #' + retryId, 'success');
            await refreshRunsOnly();
          } finally {
            target.disabled = false;
            target.textContent = 'Rerun';
          }
        } else if (action === 'publish-post' || action === 'unpublish-post') {
          var pubId = Number(target.getAttribute('data-id'));
          var isPubAction = action === 'publish-post';
          await apiFetch('/api/admin/posts/' + pubId + '/status', {
            method: 'PATCH',
            body: { status: isPubAction ? 'published' : 'draft' }
          });
          toast(isPubAction ? 'Published' : 'Moved to drafts', 'success');
          await loadAllWorkspaceData();
        } else if (action === 'delete-post') {
          var delId = Number(target.getAttribute('data-id'));
          if (!window.confirm('Delete this post permanently?')) return;
          await apiFetch('/api/admin/posts/' + delId, { method: 'DELETE' });
          toast('Deleted', 'success');
          await loadAllWorkspaceData();
        } else if (action === 'dry-run-lint') {
          var form = document.getElementById('post-editor-form');
          var box = document.getElementById('lint-preview-box');
          if (!form || !box) return;
          var payload = extractPostPayload(form);
          var lintRes = await apiFetch('/api/admin/lint', { method: 'POST', body: payload });
          var lr = (lintRes && (lintRes.lint || lintRes)) || {};
          var lbd = lr.quality_breakdown || {};
          box.classList.remove('hidden');
          box.innerHTML = '<div class="flex flex-wrap items-center justify-between gap-2">' +
            '<div class="flex items-center gap-2">' +
              '<span class="badge-editorial ' + (lr.passed ? 'badge-success' : 'badge-danger') + '">' + (lr.passed ? 'PASS' : 'FAIL') + '</span>' +
              '<span class="badge-editorial">Score ' + esc(Math.round(lr.quality_score || 0)) + '/100</span>' +
            '</div>' +
            '<span class="font-tabular text-ink-faint">' + esc(lr.word_count || 0) + ' words</span>' +
          '</div>' +
          (lbd.humanity_signals ? '<div class="pt-2">' + renderHumanityScorecard(lbd.humanity_signals) + '</div>' : '') +
          (Array.isArray(lr.errors) && lr.errors.length > 0
            ? '<ul class="list-disc pl-4 space-y-1 text-[var(--danger)]">' + lr.errors.map(function (er) { return '<li>' + esc(er) + '</li>'; }).join('') + '</ul>'
            : '<p class="text-[var(--success)]">All checks passed.</p>');
        } else if (action === 'apply-schedule-preset') {
          var sp = SCHEDULE_PRESETS[Number(target.getAttribute('data-schedule-preset'))];
          if (sp) {
            var rpdEl = document.getElementById('st-rpd');
            var hrsEl = document.getElementById('st-hours');
            var maxEl = document.getElementById('st-max-posts');
            var novEl = document.getElementById('st-novelty');
            var schEl = document.getElementById('st-sched');
            if (rpdEl) rpdEl.value = String(sp.runs_per_day);
            if (hrsEl) hrsEl.value = sp.preferred_hours_utc_json.join(', ');
            if (maxEl) maxEl.value = String(sp.max_posts_per_day);
            if (novEl) novEl.value = String(sp.min_novelty_score);
            if (schEl) schEl.checked = true;
            toast('Schedule preset applied — click Save changes', 'success');
          }
        } else if (action === 'new-skill') {
          openSkillEditorModal(null);
        } else if (action === 'edit-skill') {
          var slug = target.getAttribute('data-slug');
          var sk = state.skills.find(function (x) { return x.slug === slug; });
          if (sk) openSkillEditorModal(sk);
        } else if (action === 'delete-skill') {
          var delSlug = target.getAttribute('data-slug');
          if (!window.confirm('Delete category "' + delSlug + '"?')) return;
          await apiFetch('/api/admin/skills/' + encodeURIComponent(delSlug), { method: 'DELETE' });
          toast('Category deleted', 'success');
          await loadAllWorkspaceData();
        } else if (action === 'filter-security') {
          state.securityFilter = target.getAttribute('data-filter') || 'all';
          render();
        } else if (action === 'refresh-security') {
          await refreshSecurityOnly();
          toast('Security logs refreshed', 'success');
        } else if (action === 'unblock-ip') {
          var unbIp = target.getAttribute('data-ip') || '';
          if (!unbIp) return;
          await apiFetch('/api/admin/security/blocks/' + encodeURIComponent(unbIp), { method: 'DELETE' });
          toast('Unblocked ' + unbIp, 'success');
          await refreshSecurityOnly();
        }
      } catch (err) {
        toast((err && err.message) || 'Action failed', 'error');
      }
    });

    document.addEventListener('change', function (e) {
      var target = e.target;
      if (!target || !target.getAttribute) return;
      var syncTargetId = target.getAttribute('data-sync-target');
      if (syncTargetId && target.value) {
        var inputEl = document.getElementById(syncTargetId);
        if (inputEl) inputEl.value = target.value;
      }
    });

    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'post-search-input') {
        state.postSearch = e.target.value;
        var pos = e.target.selectionStart;
        render();
        var nextInput = document.getElementById('post-search-input');
        if (nextInput) {
          nextInput.focus();
          if (pos != null) nextInput.setSelectionRange(pos, pos);
        }
        return;
      }
      if (e.target && e.target.getAttribute) {
        var pickerId = e.target.getAttribute('data-sync-picker');
        if (pickerId) {
          var pickerEl = document.getElementById(pickerId);
          if (pickerEl) {
            var typed = String(e.target.value || '').trim();
            var matched = false;
            for (var i = 0; i < pickerEl.options.length; i++) {
              if (pickerEl.options[i].value === typed) {
                pickerEl.value = typed;
                matched = true;
                break;
              }
            }
            if (!matched) pickerEl.value = '';
          }
        }
      }
    });

    document.addEventListener('submit', async function (e) {
      var form = e.target;
      if (!form || !form.id) return;
      e.preventDefault();

      try {
        if (form.id === 'login-form') {
          var lfd = new FormData(form);
          var lErr = document.getElementById('auth-error');
          var submitBtn = form.querySelector('button[type="submit"]');
          if (lErr) lErr.classList.add('hidden');
          if (TURNSTILE_SITE_KEY && !turnstileToken) {
            if (lErr) {
              lErr.textContent = 'Please complete the security verification challenge.';
              lErr.setAttribute('data-ts-err', '1');
              lErr.classList.remove('hidden');
            }
            return;
          }
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';
          }
          state.loggingIn = true;
          try {
            var loginPayload = {
              email: String(lfd.get('email') || '').trim(),
              password: String(lfd.get('password') || '')
            };
            if (TURNSTILE_SITE_KEY) {
              loginPayload.turnstile_token = turnstileToken;
            }
            var loginRes = await apiFetch('/api/admin/auth/login', {
              method: 'POST',
              body: loginPayload
            });
            if (loginRes && loginRes.token) {
              writeStoredToken(loginRes.token);
            }
            state.auth = {
              loading: false,
              authenticated: true,
              user: {
                email: (loginRes && loginRes.email) || String(lfd.get('email') || '').trim()
              }
            };
            await loadAllWorkspaceData();
          } catch (err) {
            resetTurnstile();
            if (lErr) {
              lErr.textContent = (err && err.message) || 'Invalid email or password.';
              lErr.classList.remove('hidden');
            }
          } finally {
            state.loggingIn = false;
            var btnAfter = document.querySelector('#login-form button[type="submit"]');
            if (btnAfter) {
              btnAfter.textContent = 'Sign in';
            }
            syncLoginSubmitState();
          }
        } else if (form.id === 'block-ip-form') {
          var bfd = new FormData(form);
          var ipAddr = String(bfd.get('ip_address') || '').trim();
          var durMin = Math.max(1, Math.round(Number(bfd.get('duration_minutes') || 60)));
          var blkReason = String(bfd.get('reason') || 'Manually blocked by admin').trim();
          await apiFetch('/api/admin/security/blocks', {
            method: 'POST',
            body: { ip_address: ipAddr, duration_minutes: durMin, reason: blkReason }
          });
          toast('Blocked ' + ipAddr + ' for ' + durMin + 'm', 'success');
          await refreshSecurityOnly();
        } else if (form.id === 'post-editor-form') {
          var postId = form.getAttribute('data-post-id');
          var payload = extractPostPayload(form);
          if (postId) {
            await apiFetch('/api/admin/posts/' + encodeURIComponent(postId), { method: 'PUT', body: payload });
            toast('Post saved', 'success');
          } else {
            await apiFetch('/api/admin/posts', { method: 'POST', body: payload });
            toast('Post created', 'success');
          }
          closeModal();
          await loadAllWorkspaceData();
        } else if (form.id === 'agent-run-form') {
          var afd = new FormData(form);
          var forceCheckbox = form.querySelector('[name="force"]');
          var forceEnabled = Boolean(forceCheckbox && forceCheckbox.checked);
          state.dispatching = true;
          render();
          try {
            var dispatchBody = {
              topic: String(afd.get('topic') || '').trim() || undefined,
              category_slug: String(afd.get('category_slug') || '').trim() || undefined,
              archetype: String(afd.get('archetype') || 'auto'),
              model_override: String(afd.get('model_override') || '').trim() || undefined,
              force: forceEnabled || undefined
            };
            await apiFetch('/api/admin/agent/run', { method: 'POST', body: dispatchBody });
            toast('Run started', 'success');
            await refreshRunsOnly();
          } finally {
            state.dispatching = false;
            render();
          }
        } else if (form.id === 'skill-editor-form') {
          var sfd = new FormData(form);
          var isEdit = form.getAttribute('data-is-edit') === '1';
          var slug = String(sfd.get('slug') || '').trim().toLowerCase();
          var skillBody = {
            slug: slug,
            name: String(sfd.get('name') || '').trim(),
            description: String(sfd.get('description') || '').trim(),
            enabled: form.querySelector('[name="enabled"]').checked,
            priority: Number(sfd.get('priority') || 50),
            target_audience: String(sfd.get('target_audience') || '').trim(),
            system_instructions: String(sfd.get('system_instructions') || '').trim(),
            preferred_archetypes_json: sfd.getAll('preferred_archetypes'),
            research_feeds_json: linesToArray(sfd.get('research_feeds')),
            search_queries_json: linesToArray(sfd.get('search_queries')),
            required_sections_json: linesToArray(sfd.get('required_sections')),
            banned_patterns_json: linesToArray(sfd.get('banned_patterns'))
          };
          if (isEdit) {
            try {
              await apiFetch('/api/admin/skills/' + encodeURIComponent(slug), { method: 'PUT', body: skillBody });
            } catch (err) {
              if (err && (err.status === 404 || err.status === 405)) {
                await apiFetch('/api/admin/skills', { method: 'POST', body: skillBody });
              } else {
                throw err;
              }
            }
            toast('Category updated', 'success');
          } else {
            try {
              await apiFetch('/api/admin/skills', { method: 'POST', body: skillBody });
            } catch (err) {
              if (err && (err.status === 404 || err.status === 405)) {
                await apiFetch('/api/admin/skills/' + encodeURIComponent(slug), { method: 'PUT', body: skillBody });
              } else {
                throw err;
              }
            }
            toast('Category created', 'success');
          }
          closeModal();
          await loadAllWorkspaceData();
        } else if (form.id === 'syndicate-post-form') {
          var synPostId = Number(form.getAttribute('data-post-id'));
          var selectedChs = [];
          form.querySelectorAll('input[name="channel"]:checked').forEach(function (el) {
            if (el.value) selectedChs.push(el.value);
          });
          if (selectedChs.length === 0) {
            throw new Error('Select at least one configured channel to syndicate.');
          }
          var synMode = String((form.querySelector('[name="mode"]') && form.querySelector('[name="mode"]').value) || 'teaser');
          var synForce = Boolean(form.querySelector('[name="force"]') && form.querySelector('[name="force"]').checked);
          var submitBtn = form.querySelector('button[type="submit"]');
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Syndicating...';
          }
          try {
            var synRes = await apiFetch('/api/admin/posts/' + synPostId + '/syndicate', {
              method: 'POST',
              body: { channels: selectedChs, mode: synMode, force: synForce }
            });
            var okCnt = (synRes && Array.isArray(synRes.results)) ? synRes.results.filter(function (r) { return r && r.ok; }).length : 0;
            toast('Syndication finished (' + okCnt + '/' + selectedChs.length + ' ok)', okCnt > 0 ? 'success' : 'error');
            var fresh = await apiFetch('/api/admin/posts/' + synPostId + '/syndications');
            activeManualExport = fresh && fresh.manual_export ? fresh.manual_export : activeManualExport;
            renderSyndicateModalBody(synPostId, fresh);
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Syndicate selected now';
            }
          }
        } else if (form.id === 'settings-form') {
          var stfd = new FormData(form);
          var rawHoursStr = String(stfd.get('preferred_hours_utc') || '').trim();
          var parsedHours = [];
          if (rawHoursStr) {
            var hourSeen = {};
            rawHoursStr.split(',').forEach(function (part) {
              var trimmed = part.trim();
              if (!trimmed) return;
              var hr = Number(trimmed);
              if (!Number.isInteger(hr) || hr < 0 || hr > 23) {
                throw new Error('Preferred UTC hours must be integers between 0 and 23.');
              }
              if (!hourSeen[hr]) {
                hourSeen[hr] = true;
                parsedHours.push(hr);
              }
            });
            parsedHours.sort(function (a, b) { return a - b; });
          }

          var rawNovelty = stfd.get('min_novelty_score');
          var parsedNovelty = (rawNovelty == null || String(rawNovelty).trim() === '')
            ? 68
            : Math.max(0, Math.min(100, Math.round(Number(rawNovelty))));

          var synChannels = [];
          form.querySelectorAll('input[name="syndication_channel"]:checked').forEach(function (el) {
            if (el.value) synChannels.push(el.value);
          });
          var rawDelay = stfd.get('syndication_delay_hours');
          var parsedDelay = (rawDelay == null || String(rawDelay).trim() === '')
            ? 24
            : Math.max(0, Math.min(168, Math.round(Number(rawDelay))));

          var patch = {
            publishing_mode: String(stfd.get('publishing_mode') || 'draft_review'),
            min_publish_score: Math.max(50, Math.min(100, Math.round(Number(stfd.get('min_publish_score') || 80)))),
            free_models_only: form.querySelector('[name="free_models_only"]').checked,
            schedule_enabled: form.querySelector('[name="schedule_enabled"]').checked,
            runs_per_day: Math.max(1, Math.min(24, Math.round(Number(stfd.get('runs_per_day') || 3)))),
            preferred_hours_utc_json: parsedHours,
            max_posts_per_day: Math.max(1, Math.min(24, Math.round(Number(stfd.get('max_posts_per_day') || 2)))),
            min_novelty_score: parsedNovelty,
            fallback_model_1: String(stfd.get('fallback_model_1') || '').trim() || null,
            fallback_model_2: String(stfd.get('fallback_model_2') || '').trim() || null,
            adsense_client_id: String(stfd.get('adsense_client_id') || '').trim() || null,
            ga_measurement_id: String(stfd.get('ga_measurement_id') || '').trim().toUpperCase() || null,
            syndication_enabled: Boolean(form.querySelector('[name="syndication_enabled"]') && form.querySelector('[name="syndication_enabled"]').checked),
            syndication_delay_hours: parsedDelay,
            syndication_mode: String(stfd.get('syndication_mode') || 'teaser'),
            syndication_channels_json: synChannels,
            devto_publish_as_draft: Boolean(form.querySelector('[name="devto_publish_as_draft"]') && form.querySelector('[name="devto_publish_as_draft"]').checked)
          };
          var optStrings = [
            'default_topic_feed', 'openrouter_model', 'judge_model',
            'site_name', 'site_tagline', 'base_url', 'default_author',
            'author_bio', 'contact_email', 'cta_headline', 'cta_body', 'cta_url'
          ];
          optStrings.forEach(function (k) {
            var val = String(stfd.get(k) || '').trim();
            if (val) patch[k] = val;
          });
          var saved = await apiFetch('/api/admin/settings', { method: 'PUT', body: patch });
          state.settings = (saved && (saved.settings || saved)) || Object.assign({}, state.settings, patch);
          toast('Settings saved', 'success');
          render();
        }
      } catch (err) {
        toast((err && err.message) || 'Operation failed', 'error');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    checkAuthStatus();
  })();
  </script>
</body>
</html>`;
}
