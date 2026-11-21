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
): string {
  const siteName = settings.site_name || 'Pyvren';
  const defaultAuthor = settings.default_author || '';
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

    var ARCHETYPES = [
      { value: 'advisory-teardown', label: 'Advisory Teardown' },
      { value: 'benchmark-index', label: 'Benchmark Index' },
      { value: 'migration-fix-log', label: 'Migration & Fix Log' },
      { value: 'architecture-analysis', label: 'Architecture Analysis' }
    ];

    var SCHEDULE_PRESETS = [
      {
        label: '3x / day (08, 14, 20 UTC)',
        runs_per_day: 3,
        preferred_hours_utc_json: [8, 14, 20],
        max_posts_per_day: 2,
        min_novelty_score: 68
      },
      {
        label: '2x / day (09, 18 UTC)',
        runs_per_day: 2,
        preferred_hours_utc_json: [9, 18],
        max_posts_per_day: 1,
        min_novelty_score: 72
      },
      {
        label: '4x / day (00, 06, 12, 18 UTC)',
        runs_per_day: 4,
        preferred_hours_utc_json: [0, 6, 12, 18],
        max_posts_per_day: 3,
        min_novelty_score: 65
      },
      {
        label: '1x / day (13 UTC)',
        runs_per_day: 1,
        preferred_hours_utc_json: [13],
        max_posts_per_day: 1,
        min_novelty_score: 75
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
        out.push({
          id: id,
          name: name,
          context_length: isFinite(ctx) && ctx > 0 ? ctx : 0
        });
      });
      return out;
    }

    function formatFreeModelLabel(m) {
      if (!m || !m.id) return '';
      if (m.context_length && m.context_length >= 1000) {
        return m.id + ' (' + Math.round(m.context_length / 1000) + 'k ctx)';
      }
      return m.id;
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
        opts += '<option value="openrouter/free"' + (selectedId === 'openrouter/free' ? ' selected' : '') + '>openrouter/free</option>';
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
      var headers = Object.assign(
        { 'X-Requested-With': 'PyvrenAdmin' },
        (opts && opts.headers) || {}
      );
      if (sessionToken && !headers.Authorization && !headers.authorization) {
        headers.Authorization = 'Bearer ' + sessionToken;
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
          apiFetch('/api/admin/openrouter/free-models').catch(function () { return { models: [] }; })
        ]);
        state.settings = (results[0] && (results[0].settings || results[0])) || null;
        state.posts = Array.isArray(results[1]) ? results[1] : ((results[1] && results[1].posts) || []);
        state.skills = Array.isArray(results[2]) ? results[2] : ((results[2] && results[2].skills) || []);
        state.runs = Array.isArray(results[3]) ? results[3] : ((results[3] && results[3].runs) || []);
        state.freeModels = normalizeFreeModels(results[4]);
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

    async function refreshFreeModelsOnly() {
      try {
        var res = await apiFetch('/api/admin/openrouter/free-models?refresh=1');
        state.freeModels = normalizeFreeModels(res);
        toast('Updated model list (' + state.freeModels.length + ' available)', 'success');
        render();
      } catch (err) {
        toast((err && err.message) || 'Failed refreshing models', 'error');
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
                '<div id="auth-error" role="alert" class="hidden rounded-xl border border-[var(--danger)]/40 bg-[var(--danger-soft)] text-[var(--danger)] px-3.5 py-2.5 text-xs font-medium"></div>' +
                '<button type="submit" ' + (state.loggingIn ? 'disabled' : '') + ' class="btn-accent w-full py-2.5 text-sm font-semibold rounded-xl">' +
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
      var defaultModel = (state.settings && state.settings.openrouter_model) || 'openrouter/free';

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
      var prefHoursVal = Array.isArray(s.preferred_hours_utc_json) && s.preferred_hours_utc_json.length > 0
        ? s.preferred_hours_utc_json.join(', ')
        : '8, 14, 20';

      return '<section class="space-y-6">' +
        '<h1 class="font-masthead text-2xl sm:text-3xl font-black text-ink">Settings</h1>' +

        '<form id="settings-form" class="space-y-5">' +
          '<div class="editorial-card p-5 sm:p-6 space-y-4">' +
            '<h2 class="text-sm font-semibold text-ink">Publishing &amp; Schedule</h2>' +

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
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-rpd">Runs per day (1–24)</label>' +
                '<input id="st-rpd" name="runs_per_day" type="number" min="1" max="24" value="' + esc(s.runs_per_day != null ? s.runs_per_day : 3) + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-hours">Preferred UTC hours</label>' +
                '<input id="st-hours" name="preferred_hours_utc" type="text" value="' + esc(prefHoursVal) + '" placeholder="8, 14, 20" class="admin-input font-tabular">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-max-posts">Max posts per day (1–24)</label>' +
                '<input id="st-max-posts" name="max_posts_per_day" type="number" min="1" max="24" value="' + esc(s.max_posts_per_day != null ? s.max_posts_per_day : 2) + '" class="admin-input">' +
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
            '<div class="flex items-center justify-between gap-2">' +
              '<h2 class="text-sm font-semibold text-ink">Models</h2>' +
              '<button type="button" data-action="refresh-free-models" class="btn-ghost text-xs px-2.5 py-1.5 rounded-lg">Refresh list</button>' +
            '</div>' +
            '<div class="flex items-center gap-2.5">' +
              '<input id="st-free-only" name="free_models_only" type="checkbox"' + (s.free_models_only !== false ? ' checked' : '') + ' class="h-4 w-4 accent-[var(--accent)]">' +
              '<label for="st-free-only" class="text-sm text-ink cursor-pointer">Restrict to free models only</label>' +
            '</div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div class="space-y-2">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-model">Primary model</label>' +
                '<select id="st-model-picker" data-sync-target="st-model" aria-label="Pick primary model" class="admin-select font-tabular">' +
                  renderFreeModelOptions(s.openrouter_model || '', 'Choose model...') +
                '</select>' +
                '<input id="st-model" name="openrouter_model" data-sync-picker="st-model-picker" type="text" value="' + esc(s.openrouter_model || '') + '" placeholder="openrouter/free" class="admin-input font-tabular">' +
              '</div>' +
              '<div class="space-y-2">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-judge">Audit model</label>' +
                '<select id="st-judge-picker" data-sync-target="st-judge" aria-label="Pick audit model" class="admin-select font-tabular">' +
                  renderFreeModelOptions(s.judge_model || '', 'Choose model...') +
                '</select>' +
                '<input id="st-judge" name="judge_model" data-sync-picker="st-judge-picker" type="text" value="' + esc(s.judge_model || '') + '" placeholder="openrouter/free" class="admin-input font-tabular">' +
              '</div>' +
            '</div>' +
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
            '<h2 class="text-sm font-semibold text-ink">Monetization &amp; CTA</h2>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
              '<div class="space-y-1.5">' +
                '<label class="block text-xs font-semibold text-ink-secondary" for="st-ads">Google AdSense Client ID</label>' +
                '<input id="st-ads" name="adsense_client_id" type="text" value="' + esc(s.adsense_client_id || '') + '" placeholder="ca-pub-xxxxxxxxxxxxxxxx" class="admin-input font-tabular">' +
              '</div>' +
              '<div class="space-y-1.5">' +
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
       Master Render
       ------------------------------------------------------------------ */

    function render() {
      var app = document.getElementById('app');
      if (!app) return;

      if (state.auth.loading) {
        return;
      }

      if (!state.auth.authenticated) {
        app.innerHTML = renderAuthGate();
        return;
      }

      var tabHtml = '';
      if (state.loadingData && !state.hasLoadedOnce) {
        tabHtml = renderWorkspaceSkeleton();
      } else if (state.activeTab === 'posts') {
        tabHtml = renderPostsTab();
      } else if (state.activeTab === 'agent') {
        tabHtml = renderAgentTab();
      } else if (state.activeTab === 'skills') {
        tabHtml = renderSkillsTab();
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
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';
          }
          state.loggingIn = true;
          try {
            var loginRes = await apiFetch('/api/admin/auth/login', {
              method: 'POST',
              body: {
                email: String(lfd.get('email') || '').trim(),
                password: String(lfd.get('password') || '')
              }
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
            if (lErr) {
              lErr.textContent = (err && err.message) || 'Invalid email or password.';
              lErr.classList.remove('hidden');
            }
          } finally {
            state.loggingIn = false;
            var btnAfter = document.querySelector('#login-form button[type="submit"]');
            if (btnAfter) {
              btnAfter.disabled = false;
              btnAfter.textContent = 'Sign in';
            }
          }
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

          var patch = {
            publishing_mode: String(stfd.get('publishing_mode') || 'draft_review'),
            min_publish_score: Math.max(50, Math.min(100, Math.round(Number(stfd.get('min_publish_score') || 80)))),
            free_models_only: form.querySelector('[name="free_models_only"]').checked,
            schedule_enabled: form.querySelector('[name="schedule_enabled"]').checked,
            runs_per_day: Math.max(1, Math.min(24, Math.round(Number(stfd.get('runs_per_day') || 3)))),
            preferred_hours_utc_json: parsedHours,
            max_posts_per_day: Math.max(1, Math.min(24, Math.round(Number(stfd.get('max_posts_per_day') || 2)))),
            min_novelty_score: parsedNovelty,
            adsense_client_id: String(stfd.get('adsense_client_id') || '').trim() || null
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
