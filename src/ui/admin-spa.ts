import { escapeHtml } from '../lib/security';
import type { SiteSettings } from '../types';

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';

export function renderAdminSpaHtml(settings: SiteSettings): string {
  const siteName = settings.site_name || 'Pyvren';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(siteName)} — Editorial Control Panel</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="${GOOGLE_FONTS_HREF}">
  <link rel="stylesheet" href="${GOOGLE_FONTS_HREF}" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="${GOOGLE_FONTS_HREF}"></noscript>
  <link rel="stylesheet" href="/assets/app.css">
  <script>(function(){try{var c=(document.cookie.match(/(?:^|;\\s*)pyvren_theme=(dark|light)(?:;|$)/)||[])[1];var s=localStorage.getItem('pyvren-theme');var t=(s==='dark'||s==='light')?s:((c==='dark'||c==='light')?c:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>
</head>
<body class="min-h-screen bg-paper text-ink antialiased">
  <div id="toast-root" class="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 max-w-sm pointer-events-none"></div>
  <div id="app" class="min-h-screen flex flex-col">
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="text-center space-y-2">
        <p class="font-tabular text-xs uppercase tracking-[0.14em] text-ink-faint">${escapeHtml(siteName)} Studio</p>
        <p class="font-editorial text-xl text-ink">Verifying session&hellip;</p>
      </div>
    </div>
  </div>
  <div id="modal-root"></div>

  <script>
  (function () {
    'use strict';

    var SITE_NAME = ${JSON.stringify(siteName)};
    var ARCHETYPES = [
      { value: 'advisory-teardown', label: 'Advisory Teardown' },
      { value: 'benchmark-index', label: 'Benchmark Index' },
      { value: 'migration-fix-log', label: 'Migration & Fix Log' },
      { value: 'architecture-analysis', label: 'Architecture Analysis' }
    ];

    var PRESETS = [
      { label: 'Autonomous Hunt', topic: '', category: '', archetype: 'auto' },
      { label: 'CLI Coding Agents & MCP', topic: 'Field benchmark of terminal coding agents, MCP vs CLI token overhead, and SWE-bench Pro / Terminal-Bench 2.0 reliability', category: 'ai-coding-agents-mcp', archetype: 'benchmark-index' },
      { label: 'AI Security & Prompt Injection Defense', topic: 'Defensive teardown of indirect prompt injection, tool-result smuggling, and unauthenticated MCP exposure using OWASP LLM Top 10 controls', category: 'ai-security-jailbreaks', archetype: 'advisory-teardown' },
      { label: 'Local SLMs & Context Rot', topic: 'Quantitative comparison of 1B-32B open-weight local SLMs vs frontier LLMs, context rot degradation past 32K tokens, and vLLM/SGLang VRAM math', category: 'ai-llms', archetype: 'benchmark-index' },
      { label: 'Cloudflare Edge & GPU Economics', topic: 'Production limits and break-even economics of Cloudflare Workers & Workflows, serverless Postgres pooling, and spot H100/B200 inference', category: 'cloud-gpu-infra', archetype: 'architecture-analysis' },
      { label: 'Live Web Data & GEO', topic: 'Benchmark of AI agent web-grounding pipelines, Firecrawl/Jina/Playwright Markdown extraction fidelity, and llms.txt + JSON-LD GEO citation readiness', category: 'agentic-browser-web-data', archetype: 'benchmark-index' },
      { label: 'CISA KEV Advisory', topic: 'Rapid technical teardown of newly exploited CISA KEV vulnerabilities and critical GitHub Security Advisories with zero-downtime patch verification', category: 'dev-tooling-benchmarks', archetype: 'advisory-teardown' }
    ];

    var SCHEDULE_PRESETS = [
      {
        label: 'Recommended: 3×/day Editorial Pulse (08, 14, 20 UTC)',
        runs_per_day: 3,
        preferred_hours_utc_json: [8, 14, 20],
        max_posts_per_day: 2,
        min_novelty_score: 68
      },
      {
        label: 'Conservative: 2×/day Deep Dossiers (09, 18 UTC)',
        runs_per_day: 2,
        preferred_hours_utc_json: [9, 18],
        max_posts_per_day: 1,
        min_novelty_score: 72
      },
      {
        label: 'Active Newsroom: 4×/day (06, 12, 18, 00 UTC)',
        runs_per_day: 4,
        preferred_hours_utc_json: [0, 6, 12, 18],
        max_posts_per_day: 3,
        min_novelty_score: 65
      },
      {
        label: 'Daily Flagship: 1×/day (13 UTC)',
        runs_per_day: 1,
        preferred_hours_utc_json: [13],
        max_posts_per_day: 1,
        min_novelty_score: 75
      }
    ];

    var state = {
      auth: { loading: true, authenticated: false, user: null },
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
      loadingData: false
    };

    /* ------------------------------------------------------------------
       Utilities & Safe Escaping
       ------------------------------------------------------------------ */

    function esc(v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
      var opts = '<option value="">' + esc(placeholderText || 'Select a live :free model...') + '</option>';
      var hasMatch = false;
      (state.freeModels || []).forEach(function (m) {
        var sel = selectedId && m.id === selectedId ? ' selected' : '';
        if (sel) hasMatch = true;
        opts += '<option value="' + esc(m.id) + '"' + sel + '>' + esc(formatFreeModelLabel(m)) + '</option>';
      });
      if (!hasMatch && state.freeModels.length === 0) {
        opts += '<option value="google/gemma-4-31b-it:free"' + (selectedId === 'google/gemma-4-31b-it:free' ? ' selected' : '') + '>google/gemma-4-31b-it:free (262k ctx)</option>';
        opts += '<option value="openrouter/free"' + (selectedId === 'openrouter/free' ? ' selected' : '') + '>openrouter/free</option>';
      }
      return opts;
    }

    function toast(msg, kind) {
      var root = document.getElementById('toast-root');
      if (!root) return;
      var el = document.createElement('div');
      var borderClass = kind === 'error'
        ? 'border-[var(--danger)] text-[var(--danger)]'
        : kind === 'success'
          ? 'border-[var(--success)] text-[var(--success)]'
          : 'border-strong text-ink';
      el.className = 'pointer-events-auto rounded-[6px] bg-surface border ' + borderClass + ' px-4 py-3 text-sm shadow-lg flex items-center justify-between gap-3';
      el.innerHTML = '<span class="text-ink">' + esc(msg) + '</span>';
      root.appendChild(el);
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 3800);
    }

    async function apiFetch(url, opts) {
      var init = Object.assign({ credentials: 'same-origin' }, opts || {});
      init.headers = Object.assign(
        { 'X-Requested-With': 'PyvrenAdmin' },
        (opts && opts.headers) || {}
      );
      if (init.body && typeof init.body === 'object' && !(init.body instanceof FormData)) {
        init.headers = Object.assign({ 'Content-Type': 'application/json' }, init.headers);
        init.body = JSON.stringify(init.body);
      }
      var res = await fetch(url, init);
      var text = await res.text();
      var data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
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

    function toggleTheme() {
      var root = document.documentElement;
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      if (next === 'dark') root.setAttribute('data-theme', 'dark');
      else root.removeAttribute('data-theme');
      try { localStorage.setItem('pyvren-theme', next); } catch (e) {}
      render();
    }

    /* ------------------------------------------------------------------
       Auth & Data Loading
       ------------------------------------------------------------------ */

    async function checkAuthStatus() {
      try {
        var res = await api('/api/admin/auth/status');
        state.auth = {
          loading: false,
          authenticated: Boolean(res && res.authenticated),
          user: (res && (res.user || res.admin || (res.email ? { email: res.email, display_name: res.display_name } : null))) || null
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
        toast(err.message || 'Unable to check auth status', 'error');
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
        syncPolling();
      } catch (err) {
        if (err && err.status === 401) {
          state.auth.authenticated = false;
          stopPolling();
        } else {
          toast(err.message || 'Failed loading workspace data', 'error');
        }
      } finally {
        state.loadingData = false;
        render();
      }
    }

    async function refreshFreeModelsOnly() {
      try {
        var res = await apiFetch('/api/admin/openrouter/free-models');
        state.freeModels = normalizeFreeModels(res);
        toast('Loaded ' + state.freeModels.length + ' live OpenRouter :free models', 'success');
        render();
      } catch (err) {
        toast((err && err.message) || 'Failed refreshing OpenRouter free models', 'error');
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
            toast('Agent triage skipped writing — ' + (latestRun.decision_reason || 'no qualifying breaking news'), 'info');
          } else {
            toast('Agent run finished — briefings updated', 'success');
          }
        }
        syncPolling();
        if (state.activeTab === 'agent' || state.activeTab === 'posts') {
          render();
        }
      } catch (err) {
        if (err && err.status === 401) {
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
       Auth View (Locked Single-Owner Sign In)
       ------------------------------------------------------------------ */

    function renderBrandSvg() {
      return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<rect x="1.5" y="1.5" width="21" height="21" rx="3" stroke="currentColor" stroke-width="1.5"/>' +
        '<path d="M7.5 16.5V7.5H13.25C15.1 7.5 16.25 8.55 16.25 10.2C16.25 11.85 15.1 12.9 13.25 12.9H7.5" stroke="currentColor" stroke-width="1.65" stroke-linecap="square"/>' +
        '<path d="M13.5 16.5L17 13" stroke="var(--accent)" stroke-width="1.9" stroke-linecap="square"/>' +
      '</svg>';
    }

    function renderAuthGate() {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';

      return '<div class="min-h-screen flex flex-col justify-between bg-paper border-t-[3px] border-[var(--accent)] p-4 sm:p-8">' +
        '<div class="max-w-md w-full mx-auto flex items-center justify-between pt-2">' +
          '<a href="/" class="inline-flex items-center gap-2.5 text-ink">' +
            renderBrandSvg() +
            '<span class="font-masthead font-editorial text-xl font-semibold tracking-tight">' + esc(SITE_NAME) + '</span>' +
          '</a>' +
          '<button type="button" data-action="toggle-theme" class="btn-ghost text-xs font-tabular">' + (isDark ? 'Light Mode' : 'Dark Mode') + '</button>' +
        '</div>' +

        '<div class="max-w-md w-full mx-auto my-10 editorial-card bg-surface border-t-[3px] border-t-[var(--accent)] p-7 sm:p-9 space-y-6">' +
          '<div class="space-y-2.5 border-b border-hairline pb-5">' +
            '<p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold inline-flex items-center gap-2">' +
              '<span class="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)]"></span>' +
              '<span>Pyvren Editorial Desk &middot; Restricted Owner Access</span>' +
            '</p>' +
            '<h1 class="font-masthead font-editorial text-3xl font-semibold text-ink leading-tight">Owner Sign In</h1>' +
            '<p class="text-sm text-ink-muted leading-relaxed">' +
              'Sign in with the configured owner credentials to manage briefings, autonomous research agents, category skills, and publishing gates.' +
            '</p>' +
          '</div>' +

          '<form id="login-form" class="space-y-4">' +
            '<div class="space-y-1.5">' +
              '<label class="block font-tabular text-xs text-ink-muted uppercase tracking-wider" for="lg-email">Email</label>' +
              '<input id="lg-email" name="email" type="email" required autocomplete="email" placeholder="owner@pyvren.com" class="admin-input">' +
            '</div>' +
            '<div class="space-y-1.5">' +
              '<label class="block font-tabular text-xs text-ink-muted uppercase tracking-wider" for="lg-pass">Password</label>' +
              '<input id="lg-pass" name="password" type="password" required autocomplete="current-password" placeholder="••••••••••••" class="admin-input">' +
            '</div>' +
            '<div id="auth-error" class="hidden rounded-[5px] bg-[var(--danger-soft)] text-[var(--danger)] px-3 py-2 text-xs font-medium"></div>' +
            '<button type="submit" class="btn-accent w-full py-2.5 font-semibold tracking-tight">Sign In</button>' +
          '</form>' +

          '<div class="pt-4 border-t border-hairline flex items-center justify-between gap-2 font-tabular text-[11px] text-ink-faint">' +
            '<span>Single-Owner Locked Access</span>' +
            '<span class="text-accent font-semibold">Private Desk</span>' +
          '</div>' +
        '</div>' +

        '<div class="max-w-md w-full mx-auto text-center font-tabular text-xs text-ink-faint pb-2">' +
          '<a href="/" class="hover:text-accent transition-colors">&larr; Return to public publication</a>' +
        '</div>' +
      '</div>';
    }

    /* ------------------------------------------------------------------
       Main Control Panel Shell
       ------------------------------------------------------------------ */

    function renderTopBar() {
      var mode = (state.settings && state.settings.publishing_mode) || 'draft_review';
      var isAuto = mode === 'auto_publish';
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      var activeRunsCount = (state.runs || []).filter(function (r) { return r.status === 'queued' || r.status === 'running'; }).length;
      var ownerEmail = state.auth && state.auth.user && state.auth.user.email ? String(state.auth.user.email) : '';

      return '<header class="editorial-topbar sticky top-0 z-40 border-t-[3px] border-t-[var(--accent)] bg-surface/95">' +
        '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">' +
          '<div class="flex items-center gap-3 min-w-0">' +
            '<a href="/admin" class="inline-flex items-center gap-2.5 text-ink">' +
              renderBrandSvg() +
              '<span class="font-masthead font-editorial text-xl font-semibold tracking-tight">' + esc(SITE_NAME) + '</span>' +
            '</a>' +
            '<span class="badge-editorial badge-accent hidden sm:inline-flex">Editorial Desk</span>' +
            (activeRunsCount > 0 ? '<span class="badge-editorial badge-accent">' + activeRunsCount + ' Agent Active</span>' : '') +
          '</div>' +

          '<div class="flex items-center gap-2 sm:gap-3">' +
            '<div class="hidden md:flex items-center rounded-[5px] border border-hairline bg-paper p-0.5 font-tabular text-[11px]" role="group" aria-label="Publishing Mode">' +
              '<button type="button" data-action="set-mode" data-mode="draft_review" class="px-2.5 py-1 rounded-[4px] cursor-pointer transition-colors ' + (!isAuto ? 'bg-[var(--ink-primary)] text-[var(--bg-paper)] font-semibold' : 'text-ink-muted hover:text-ink') + '">Draft Review (Safe)</button>' +
              '<button type="button" data-action="set-mode" data-mode="auto_publish" class="px-2.5 py-1 rounded-[4px] cursor-pointer transition-colors ' + (isAuto ? 'bg-[var(--accent)] text-white font-semibold' : 'text-ink-muted hover:text-ink') + '">Auto-Publish (Gated)</button>' +
            '</div>' +

            (ownerEmail ? '<span class="hidden xl:inline-flex font-tabular text-[11px] text-ink-faint px-1">' + esc(ownerEmail) + '</span>' : '') +
            '<button type="button" data-action="toggle-theme" class="btn-ghost text-xs font-tabular px-2.5 py-1.5" title="Toggle theme">' + (isDark ? 'Light' : 'Dark') + '</button>' +
            '<a href="/" target="_blank" rel="noopener noreferrer" class="btn-ghost text-xs font-tabular px-2.5 py-1.5">Live Site &nearr;</a>' +
            '<button type="button" data-action="logout" class="btn-ghost text-xs font-tabular px-2.5 py-1.5">Sign Out</button>' +
          '</div>' +
        '</div>' +

        '<div class="border-t border-hairline bg-paper">' +
          '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 overflow-x-auto">' +
            '<nav class="flex items-center gap-1" role="tablist">' +
              renderTabButton('posts', 'Briefings (' + state.posts.length + ')') +
              renderTabButton('agent', 'Agent Studio' + (activeRunsCount > 0 ? ' (' + activeRunsCount + ')' : '')) +
              renderTabButton('skills', 'Category Skills (' + state.skills.length + ')') +
              renderTabButton('settings', 'Settings & Schedule') +
            '</nav>' +
            '<div class="hidden sm:flex items-center gap-2 font-tabular text-[11px] text-ink-faint py-2">' +
              '<span>' + (isFreeModelsOnly() ? '$0 Free Guard: ON' : 'Paid Models Allowed') + '</span>' +
              '<span>&middot;</span>' +
              '<span>Min Score: ' + esc(state.settings ? state.settings.min_publish_score : 80) + '</span>' +
              '<span>&middot;</span>' +
              '<span>Schedule: ' + (state.settings && state.settings.schedule_enabled ? esc(state.settings.runs_per_day) + 'x/day' : 'Paused') + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</header>';
    }

    function renderTabButton(id, label) {
      var active = state.activeTab === id;
      return '<button type="button" role="tab" aria-selected="' + active + '" data-action="switch-tab" data-tab="' + id + '" class="admin-tab ' + (active ? 'is-active' : '') + '">' + esc(label) + '</button>';
    }

    /* ------------------------------------------------------------------
       Tab 1: Briefings Manager
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

      return '<section class="space-y-6">' +
        '<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-strong">' +
          '<div>' +
            '<h1 class="font-editorial text-2xl sm:text-3xl font-semibold text-ink">Briefings Ledger</h1>' +
            '<p class="text-sm text-ink-muted">Review quality scores, inspect anti-slop stylometry &amp; spot-check notes, preview safely, and publish.</p>' +
          '</div>' +
          '<div class="flex flex-wrap items-center gap-2">' +
            '<button type="button" data-action="refresh-all" class="btn-ghost text-xs font-tabular">Refresh</button>' +
            '<button type="button" data-action="new-post" class="btn-accent text-xs">+ New Post</button>' +
          '</div>' +
        '</div>' +

        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
          '<div class="flex items-center gap-1.5">' +
            renderFilterBtn('all', 'All (' + state.posts.length + ')') +
            renderFilterBtn('draft', 'Drafts (' + draftCount + ')') +
            renderFilterBtn('published', 'Published (' + pubCount + ')') +
          '</div>' +
          '<div class="w-full sm:w-72">' +
            '<input id="post-search-input" type="search" value="' + esc(state.postSearch) + '" placeholder="Filter by title, slug, keyword..." class="admin-input h-9 text-xs">' +
          '</div>' +
        '</div>' +

        (filtered.length === 0
          ? '<div class="border border-hairline rounded-[6px] bg-surface p-10 text-center space-y-2">' +
              '<p class="font-editorial text-xl text-ink">No briefings match this filter.</p>' +
              '<p class="text-sm text-ink-muted">Create a briefing manually or dispatch the Research Agent in Agent Studio.</p>' +
            '</div>'
          : '<div class="space-y-3">' + filtered.map(renderPostRow).join('') + '</div>') +
      '</section>';
    }

    function renderFilterBtn(val, label) {
      var active = state.postFilter === val;
      return '<button type="button" data-action="filter-posts" data-filter="' + val + '" class="px-3 py-1.5 rounded-[4px] font-tabular text-xs border cursor-pointer transition-colors ' +
        (active ? 'bg-[var(--ink-primary)] text-[var(--bg-paper)] border-[var(--ink-primary)] font-semibold' : 'bg-surface text-ink-muted border-hairline hover:border-strong hover:text-ink') +
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

      return '<article class="rounded-[6px] border border-hairline bg-surface overflow-hidden">' +
        '<div class="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">' +
          '<div class="space-y-2 min-w-0 flex-1">' +
            '<div class="flex flex-wrap items-center gap-1.5">' +
              '<span class="badge-editorial ' + (isPub ? 'badge-success' : 'badge-warning') + '">' + (isPub ? 'Published' : 'Draft') + '</span>' +
              '<span class="badge-editorial badge-accent">' + esc(post.category_slug) + '</span>' +
              '<span class="badge-editorial">' + esc(fmtArchetype(post.archetype)) + '</span>' +
              '<span class="badge-editorial ' + scoreClass + '">Score ' + score + '/100</span>' +
              '<span class="badge-editorial ' + (post.lint_passed ? 'badge-success' : 'badge-danger') + '">' + (post.lint_passed ? 'Lint Pass' : 'Lint Fail') + '</span>' +
              (isAdminLocked ? '<span class="badge-editorial badge-accent" title="Human-edited briefing protected from automated overwrites">Admin Locked</span>' : '') +
              (isAdminLocked && post.last_edited_by ? '<span class="badge-editorial" title="Last human editor">Edited by ' + esc(post.last_edited_by) + '</span>' : '') +
            '</div>' +
            '<h2 class="font-editorial text-xl font-semibold text-ink leading-snug">' + esc(post.title) + '</h2>' +
            '<p class="text-xs text-ink-muted line-clamp-2">' + esc(post.description) + '</p>' +
            '<div class="flex flex-wrap items-center gap-3 font-tabular text-[11px] text-ink-faint">' +
              '<span>/' + esc(post.slug) + '</span>' +
              '<span>&middot;</span>' +
              '<span>' + esc(post.word_count || 0) + ' words (' + esc(post.reading_time_minutes || 1) + ' min)</span>' +
              '<span>&middot;</span>' +
              '<span>' + (Array.isArray(post.sources_json) ? post.sources_json.length : 0) + ' sources</span>' +
              (Array.isArray(post.keywords_json) && post.keywords_json.length > 0 ? '<span>&middot;</span><span>' + post.keywords_json.length + ' keywords</span>' : '') +
              '<span>&middot;</span>' +
              '<span>Updated ' + esc(fmtDate(post.updated_at || post.created_at)) + '</span>' +
            '</div>' +
          '</div>' +

          '<div class="flex flex-wrap items-center gap-2 shrink-0">' +
            '<button type="button" data-action="toggle-post-notes" data-id="' + post.id + '" class="btn-ghost text-xs font-tabular px-2.5 py-1.5">' +
              (expanded ? 'Hide Audit' : 'Spot-Check (' + (reviewNotes.length + lintErrors.length) + ')') +
            '</button>' +
            '<button type="button" data-action="preview-post" data-id="' + post.id + '" class="btn-ghost text-xs font-tabular px-2.5 py-1.5">Preview</button>' +
            '<button type="button" data-action="edit-post" data-id="' + post.id + '" class="btn-ghost text-xs font-tabular px-2.5 py-1.5">Edit</button>' +
            (isPub
              ? '<button type="button" data-action="unpublish-post" data-id="' + post.id + '" class="btn-ghost text-xs font-tabular px-2.5 py-1.5">Unpublish</button>'
              : '<button type="button" data-action="publish-post" data-id="' + post.id + '" class="btn-accent text-xs font-tabular px-3 py-1.5">Publish</button>') +
            '<button type="button" data-action="delete-post" data-id="' + post.id + '" class="btn-danger text-xs font-tabular px-2.5 py-1.5">Delete</button>' +
          '</div>' +
        '</div>' +

        (expanded
          ? '<div class="border-t border-hairline bg-subtle/60 px-5 py-4 space-y-4 text-xs">' +
              '<div class="space-y-2">' +
                '<p class="font-tabular text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Quality Rubric Dimensions</p>' +
                '<div class="grid grid-cols-2 sm:grid-cols-6 gap-2 font-tabular">' +
                  renderMiniMetric('SEO', bd.seo_structure) +
                  renderMiniMetric('GEO', bd.geo_citation_readiness) +
                  renderMiniMetric('Info Gain', bd.information_gain) +
                  renderMiniMetric('Grounding', bd.source_grounding) +
                  renderMiniMetric('Anti-Slop', bd.anti_slop_cleanliness) +
                  renderMiniMetric('AdSense', bd.adsense_compliance) +
                '</div>' +
              '</div>' +
              (bd.humanity_signals ? renderHumanityScorecard(bd.humanity_signals) : '') +
              '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
                '<div class="space-y-1.5">' +
                  '<p class="font-tabular text-[11px] uppercase tracking-wider text-ink-muted font-semibold">60-Second Human Spot-Check Notes</p>' +
                  (reviewNotes.length > 0
                    ? '<ul class="list-disc pl-4 space-y-1 text-ink-secondary">' + reviewNotes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>'
                    : '<p class="text-ink-faint">No spot-check notes attached to this briefing.</p>') +
                '</div>' +
                '<div class="space-y-1.5">' +
                  '<p class="font-tabular text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Lint &amp; Rubric Findings</p>' +
                  (lintErrors.length > 0
                    ? '<ul class="list-disc pl-4 space-y-1 text-[var(--danger)]">' + lintErrors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>'
                    : '<p class="text-[var(--success)]">All deterministic lint checks passed.</p>') +
                  (bd.judge_notes ? '<p class="pt-1 text-ink-muted"><strong class="text-ink">Judge Notes:</strong> ' + esc(bd.judge_notes) + '</p>' : '') +
                '</div>' +
              '</div>' +
            '</div>'
          : '') +
      '</article>';
    }

    function renderMiniMetric(label, val) {
      var v = val == null ? '—' : Math.round(val);
      return '<div class="rounded-[4px] border border-hairline bg-surface px-2.5 py-2">' +
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
      return '<div class="rounded-[4px] border border-hairline bg-surface px-2.5 py-2">' +
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

      var metaParts = [];
      if (hs.sentence_count != null) metaParts.push(Math.round(Number(hs.sentence_count)) + ' sentences');
      if (hs.avg_sentence_words != null) metaParts.push('avg ' + Number(hs.avg_sentence_words).toFixed(1) + 'w');

      return '<div class="space-y-2">' +
        '<div class="flex flex-wrap items-center justify-between gap-2">' +
          '<p class="font-tabular text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Anti-AI-Slop Humanity &amp; Stylometry Scorecard</p>' +
          (metaParts.length > 0 ? '<span class="font-tabular text-[11px] text-ink-faint">' + esc(metaParts.join(' · ')) + '</span>' : '') +
        '</div>' +
        '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-tabular">' +
          renderStylometryMetric('Human-Likeness Score', likeness == null ? '—' : (likeness + '/100'), likeness == null ? '' : (likeness >= 80 ? 'good' : likeness >= 65 ? 'warn' : 'bad')) +
          renderStylometryMetric('Sentence Burstiness σ', burstiness == null ? '—' : burstiness.toFixed(1), burstiness == null ? '' : (burstiness >= 5.0 ? 'good' : burstiness >= 3.5 ? 'warn' : 'bad')) +
          renderStylometryMetric('Bold-Bullet Count', boldBullets == null ? '—' : String(boldBullets), boldBullets == null ? '' : (boldBullets <= 2 ? 'good' : boldBullets <= 5 ? 'warn' : 'bad')) +
          renderStylometryMetric('Em-Dashes / 100w', emDashes == null ? '—' : emDashes.toFixed(2), emDashes == null ? '' : (emDashes <= 0.8 ? 'good' : emDashes <= 1.5 ? 'warn' : 'bad')) +
          renderStylometryMetric('Robotic Openers', roboticOpeners == null ? '—' : String(roboticOpeners), roboticOpeners == null ? '' : (roboticOpeners === 0 ? 'good' : roboticOpeners <= 1 ? 'warn' : 'bad')) +
          renderStylometryMetric('Concrete Metrics', concreteMetrics == null ? '—' : String(concreteMetrics), concreteMetrics == null ? '' : (concreteMetrics >= 5 ? 'good' : concreteMetrics >= 2 ? 'warn' : 'bad')) +
        '</div>' +
      '</div>';
    }

    /* ------------------------------------------------------------------
       Tab 2: Agent Studio & Live Source Trace Inspector
       ------------------------------------------------------------------ */

    function renderAgentTab() {
      var polling = hasActiveRuns(state.runs);
      var freeOnly = isFreeModelsOnly();
      var defaultModel = (state.settings && state.settings.openrouter_model) || 'google/gemma-4-31b-it:free';
      var skillOptions = '<option value="">Auto-select highest priority enabled skill</option>' +
        state.skills.map(function (s) {
          return '<option value="' + esc(s.slug) + '">' + esc(s.name) + (s.enabled ? '' : ' (disabled)') + '</option>';
        }).join('');

      var archOptions = '<option value="auto">Auto-select best archetype</option>' +
        ARCHETYPES.map(function (a) {
          return '<option value="' + esc(a.value) + '">' + esc(a.label) + '</option>';
        }).join('');

      var runModelOptions = renderFreeModelOptions('', 'Default (' + defaultModel + ')');

      return '<section class="space-y-8">' +
        '<div class="editorial-card p-6 space-y-5">' +
          '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-hairline">' +
            '<div>' +
              '<p class="font-tabular text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">ReAct Research Workflow</p>' +
              '<h1 class="font-editorial text-2xl sm:text-3xl font-semibold text-ink">Agent Studio</h1>' +
            '</div>' +
            '<div class="flex flex-wrap items-center gap-2">' +
              '<span class="badge-editorial ' + (freeOnly ? 'badge-success' : 'badge-warning') + '">' +
                (freeOnly ? 'Free Models Only: ON' : 'Free Models Only: OFF') + ' &mdash; ' + esc(defaultModel) +
              '</span>' +
            '</div>' +
          '</div>' +

          '<div class="flex flex-wrap items-center gap-2">' +
            '<span class="font-tabular text-[11px] uppercase tracking-wider text-ink-faint mr-1">2026 Skill Presets:</span>' +
            PRESETS.map(function (p, idx) {
              return '<button type="button" data-action="apply-preset" data-preset="' + idx + '" class="px-2.5 py-1 rounded-[4px] border border-hairline bg-subtle/70 hover:border-strong text-xs text-ink-secondary cursor-pointer transition-colors">' + esc(p.label) + '</button>';
            }).join('') +
          '</div>' +

          '<form id="agent-run-form" class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">' +
            '<div class="md:col-span-6 space-y-1.5">' +
              '<label class="block font-tabular text-xs uppercase tracking-wider text-ink-muted" for="ag-topic">Topic <span class="normal-case text-ink-faint">(leave blank for autonomous topic hunt)</span></label>' +
              '<input id="ag-topic" name="topic" type="text" placeholder="e.g., CVE teardown or leave blank to hunt live feeds" class="admin-input">' +
            '</div>' +
            '<div class="md:col-span-6 space-y-1.5">' +
              '<label class="block font-tabular text-xs uppercase tracking-wider text-ink-muted" for="ag-cat">Category Skill</label>' +
              '<select id="ag-cat" name="category_slug" class="admin-select">' + skillOptions + '</select>' +
            '</div>' +
            '<div class="md:col-span-4 space-y-1.5">' +
              '<label class="block font-tabular text-xs uppercase tracking-wider text-ink-muted" for="ag-arch">Archetype</label>' +
              '<select id="ag-arch" name="archetype" class="admin-select">' + archOptions + '</select>' +
            '</div>' +
            '<div class="md:col-span-5 space-y-1.5">' +
              '<label class="block font-tabular text-xs uppercase tracking-wider text-ink-muted" for="ag-model">Run Model Override <span class="normal-case text-ink-faint">(live :free catalog)</span></label>' +
              '<select id="ag-model" name="model_override" class="admin-select font-tabular">' + runModelOptions + '</select>' +
            '</div>' +
            '<div class="md:col-span-3">' +
              '<button type="submit" ' + (state.dispatching ? 'disabled' : '') + ' class="btn-accent w-full py-2.5">' + (state.dispatching ? 'Dispatching...' : 'Run Agent') + '</button>' +
            '</div>' +
            '<div class="md:col-span-12 pt-1 flex items-center gap-2.5">' +
              '<input id="ag-force" name="force" type="checkbox" class="h-4 w-4 accent-[var(--accent)]">' +
              '<label for="ag-force" class="text-xs font-medium text-ink-secondary cursor-pointer">Force Write (Bypass No-News / Duplicate Skip Gate)</label>' +
            '</div>' +
          '</form>' +
        '</div>' +

        '<div class="space-y-4">' +
          '<div class="flex items-center justify-between gap-3 pb-3 border-b border-strong">' +
            '<div class="flex items-center gap-3">' +
              '<h2 class="font-editorial text-2xl font-semibold text-ink">Runs &amp; Source Trace Inspector</h2>' +
              (polling ? '<span class="badge-editorial badge-accent">Live Polling (3.5s)</span>' : '<span class="badge-editorial">Idle</span>') +
            '</div>' +
            '<button type="button" data-action="refresh-runs" class="btn-ghost text-xs font-tabular">Refresh Runs</button>' +
          '</div>' +

          (state.runs.length === 0
            ? '<div class="border border-hairline rounded-[6px] bg-surface p-8 text-center text-sm text-ink-muted">No agent runs recorded yet. Dispatch a research run above to see step-by-step source extraction traces.</div>'
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
      var statusLabel = isSkipped ? 'SKIPPED' : run.status;
      var trace = Array.isArray(run.trace_json) ? run.trace_json : [];
      var usage = run.token_usage_json || {};
      var totalTokens = usage.total_tokens || ((usage.prompt_tokens || 0) + (usage.completion_tokens || 0));

      return '<article class="rounded-[6px] border border-hairline bg-surface overflow-hidden">' +
        '<div class="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">' +
          '<div class="space-y-2 min-w-0 flex-1">' +
            '<div class="flex flex-wrap items-center gap-1.5">' +
              '<span class="badge-editorial ' + statusClass + '">' + esc(statusLabel) + '</span>' +
              '<span class="badge-editorial">Stage: ' + esc(run.current_stage || 'init') + '</span>' +
              '<span class="badge-editorial badge-accent">' + esc(run.category_slug || 'auto') + '</span>' +
              '<span class="badge-editorial">' + esc(run.trigger_source || 'manual') + '</span>' +
              (run.quality_score != null ? '<span class="badge-editorial badge-success">QS ' + Math.round(run.quality_score) + '/100</span>' : '') +
            '</div>' +
            '<h3 class="font-semibold text-base text-ink">' + esc(run.topic || '(Autonomous Topic Hunt)') + '</h3>' +
            '<div class="flex flex-wrap items-center gap-3 font-tabular text-[11px] text-ink-faint">' +
              '<span>Run #' + esc(run.id) + '</span>' +
              '<span>&middot;</span>' +
              '<span>Model: ' + esc(run.model_used || '—') + '</span>' +
              '<span>&middot;</span>' +
              '<span>Tokens: ' + esc(totalTokens ? totalTokens.toLocaleString('en-US') : '0') + '</span>' +
              '<span>&middot;</span>' +
              '<span>Started ' + esc(fmtDate(run.created_at)) + '</span>' +
              (run.completed_at ? '<span>&middot;</span><span>Finished ' + esc(fmtDate(run.completed_at)) + '</span>' : '') +
            '</div>' +
            (run.decision_reason
              ? '<div class="rounded-[4px] border ' + (isSkipped ? 'border-[var(--border-strong)] bg-subtle' : 'border-hairline bg-subtle/60') + ' px-3 py-2 text-xs text-ink-secondary">' +
                  '<strong class="font-tabular uppercase tracking-wider text-[10px] ' + (isSkipped ? 'text-[var(--warning)]' : 'text-ink-muted') + ' mr-1.5">' +
                    (isSkipped ? 'SKIPPED — Editorial Triage:' : 'Editorial Decision:') +
                  '</strong>' +
                  esc(run.decision_reason) +
                '</div>'
              : '') +
            (run.error_message ? '<p class="text-xs text-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 rounded-[4px]">' + esc(run.error_message) + '</p>' : '') +
          '</div>' +

          '<div class="flex flex-wrap items-center gap-2 shrink-0">' +
            (run.post_id ? '<button type="button" data-action="preview-post" data-id="' + run.post_id + '" class="btn-ghost text-xs font-tabular px-2.5 py-1.5">Preview Post #' + run.post_id + '</button>' : '') +
            (run.post_id ? '<button type="button" data-action="edit-post" data-id="' + run.post_id + '" class="btn-ghost text-xs font-tabular px-2.5 py-1.5">Edit Post</button>' : '') +
            '<button type="button" data-action="toggle-run-trace" data-id="' + run.id + '" class="btn-ghost text-xs font-tabular px-2.5 py-1.5">' +
              (expanded ? 'Hide Trace' : 'Source Trace (' + trace.length + ')') +
            '</button>' +
          '</div>' +
        '</div>' +

        (expanded
          ? '<div class="border-t border-hairline bg-subtle/60 p-4 sm:p-5 space-y-2.5">' +
              '<p class="font-tabular text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Step-by-Step Tool &amp; Source Trace</p>' +
              (trace.length === 0
                ? '<p class="text-xs text-ink-faint">No trace entries recorded yet.</p>'
                : '<ol class="space-y-2">' + trace.map(function (t, idx) {
                    return '<li class="rounded-[5px] border border-hairline bg-surface p-3 text-xs space-y-1">' +
                      '<div class="flex flex-wrap items-center justify-between gap-2 font-tabular">' +
                        '<div class="flex items-center gap-2">' +
                          '<span class="text-ink-faint">#' + (idx + 1) + '</span>' +
                          '<span class="badge-editorial ' + (t.ok ? 'badge-success' : 'badge-danger') + '">' + (t.ok ? 'OK' : 'ERR') + '</span>' +
                          '<span class="font-semibold text-ink">' + esc(t.tool_name) + '</span>' +
                          '<span class="text-ink-faint">[' + esc(t.stage) + ']</span>' +
                        '</div>' +
                        '<div class="flex items-center gap-3 text-[11px] text-ink-faint">' +
                          (t.chars_extracted != null ? '<span>' + esc(Number(t.chars_extracted).toLocaleString('en-US')) + ' chars</span>' : '') +
                          '<span>' + esc(fmtDate(t.timestamp)) + '</span>' +
                        '</div>' +
                      '</div>' +
                      (t.url ? '<p class="font-tabular text-[11px] text-accent break-all">' + esc(t.url) + '</p>' : '') +
                      (t.input && t.input !== t.url ? '<p class="font-tabular text-[11px] text-ink-muted break-words">Input: ' + esc(t.input) + '</p>' : '') +
                      '<p class="text-ink-secondary leading-relaxed">' + esc(t.summary) + '</p>' +
                    '</li>';
                  }).join('') + '</ol>') +
            '</div>'
          : '') +
      '</article>';
    }

    /* ------------------------------------------------------------------
       Tab 3: Category Skills
       ------------------------------------------------------------------ */

    function renderSkillsTab() {
      return '<section class="space-y-6">' +
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-strong">' +
          '<div>' +
            '<h1 class="font-editorial text-2xl sm:text-3xl font-semibold text-ink">Category Research Skills</h1>' +
            '<p class="text-sm text-ink-muted">Configure domain instructions, RSS/advisory feeds, search queries, preferred archetypes, and banned patterns.</p>' +
          '</div>' +
          '<button type="button" data-action="new-skill" class="btn-accent text-xs self-start sm:self-auto">+ New Skill</button>' +
        '</div>' +

        (state.skills.length === 0
          ? '<div class="border border-hairline rounded-[6px] bg-surface p-8 text-center text-sm text-ink-muted">No category skills configured yet.</div>'
          : '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' + state.skills.map(renderSkillCard).join('') + '</div>') +
      '</section>';
    }

    function renderSkillCard(skill) {
      var feeds = Array.isArray(skill.research_feeds_json) ? skill.research_feeds_json : [];
      var queries = Array.isArray(skill.search_queries_json) ? skill.search_queries_json : [];
      var archs = Array.isArray(skill.preferred_archetypes_json) ? skill.preferred_archetypes_json : [];

      return '<article class="editorial-card p-5 flex flex-col justify-between gap-4">' +
        '<div class="space-y-2.5">' +
          '<div class="flex items-center justify-between gap-2">' +
            '<div class="flex items-center gap-2">' +
              '<span class="badge-editorial ' + (skill.enabled ? 'badge-success' : 'badge-warning') + '">' + (skill.enabled ? 'Enabled' : 'Paused') + '</span>' +
              '<span class="badge-editorial">Priority ' + esc(skill.priority) + '</span>' +
            '</div>' +
            '<span class="font-tabular text-xs text-ink-faint">' + esc(skill.slug) + '</span>' +
          '</div>' +
          '<h2 class="font-editorial text-xl font-semibold text-ink">' + esc(skill.name) + '</h2>' +
          '<p class="text-sm text-ink-muted leading-relaxed">' + esc(skill.description) + '</p>' +
          '<p class="text-xs text-ink-faint"><strong class="text-ink-secondary">Audience:</strong> ' + esc(skill.target_audience) + '</p>' +
          '<div class="flex flex-wrap gap-1.5 pt-1">' +
            archs.map(function (a) { return '<span class="badge-editorial">' + esc(fmtArchetype(a)) + '</span>'; }).join('') +
          '</div>' +
        '</div>' +

        '<div class="pt-3 border-t border-hairline flex items-center justify-between gap-3">' +
          '<span class="font-tabular text-[11px] text-ink-faint">' + feeds.length + ' feeds &middot; ' + queries.length + ' queries</span>' +
          '<div class="flex items-center gap-2">' +
            '<button type="button" data-action="edit-skill" data-slug="' + esc(skill.slug) + '" class="btn-ghost text-xs font-tabular px-2.5 py-1">Edit</button>' +
            '<button type="button" data-action="delete-skill" data-slug="' + esc(skill.slug) + '" class="btn-danger text-xs font-tabular px-2.5 py-1">Delete</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }

    /* ------------------------------------------------------------------
       Tab 4: Settings & Schedule
       ------------------------------------------------------------------ */

    function renderSettingsTab() {
      var s = state.settings || {};
      var prefHoursVal = Array.isArray(s.preferred_hours_utc_json) && s.preferred_hours_utc_json.length > 0
        ? s.preferred_hours_utc_json.join(', ')
        : '8, 14, 20';

      return '<section class="space-y-6">' +
        '<div class="pb-4 border-b border-strong">' +
          '<h1 class="font-editorial text-2xl sm:text-3xl font-semibold text-ink">Settings &amp; Autonomous Schedule</h1>' +
          '<p class="text-sm text-ink-muted">Configure publishing gates, cron cadence, OpenRouter models, editorial identity, and AdSense monetization.</p>' +
        '</div>' +

        '<form id="settings-form" class="space-y-6">' +
          '<div class="editorial-card p-6 space-y-4">' +
            '<h2 class="font-tabular text-xs uppercase tracking-[0.14em] text-accent font-semibold">Publishing Gate &amp; Schedule</h2>' +

            '<div class="rounded-[5px] border border-hairline bg-subtle/60 p-4 space-y-2.5">' +
              '<p class="font-tabular text-[11px] uppercase tracking-wider text-ink-muted font-semibold">Recommended Editorial Schedule Presets</p>' +
              '<div class="flex flex-wrap items-center gap-2">' +
                SCHEDULE_PRESETS.map(function (sp, idx) {
                  return '<button type="button" data-action="apply-schedule-preset" data-schedule-preset="' + idx + '" class="' +
                    (idx === 0
                      ? 'px-3 py-1.5 rounded-[4px] border border-[var(--accent)] bg-surface text-xs font-semibold text-accent hover:bg-subtle cursor-pointer transition-colors'
                      : 'px-3 py-1.5 rounded-[4px] border border-hairline bg-surface hover:border-strong text-xs text-ink-secondary cursor-pointer transition-colors') +
                  '">' + esc(sp.label) + '</button>';
                }).join('') +
              '</div>' +
              '<p class="text-xs text-ink-muted leading-relaxed">Scheduled runs act as an Editorial Triage Desk—if there is no genuine breaking news or all items overlap with past posts, the agent logs a clean SKIPPED run without generating filler.</p>' +
            '</div>' +

            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
              '<div class="space-y-1.5">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-mode">Publishing Mode</label>' +
                '<select id="st-mode" name="publishing_mode" class="admin-select">' +
                  '<option value="draft_review"' + (s.publishing_mode !== 'auto_publish' ? ' selected' : '') + '>Draft Review (Safe — human approves before live)</option>' +
                  '<option value="auto_publish"' + (s.publishing_mode === 'auto_publish' ? ' selected' : '') + '>Auto-Publish (Gated by lint + min score)</option>' +
                '</select>' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-score">Minimum Auto-Publish Score (50–100)</label>' +
                '<input id="st-score" name="min_publish_score" type="number" min="50" max="100" value="' + esc(s.min_publish_score != null ? s.min_publish_score : 80) + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-rpd">Scheduled Runs Per Day (1–24)</label>' +
                '<input id="st-rpd" name="runs_per_day" type="number" min="1" max="24" value="' + esc(s.runs_per_day != null ? s.runs_per_day : 3) + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-hours">Preferred UTC Hours <span class="normal-case text-ink-faint">(comma-separated 0-23, e.g. 8, 14, 20)</span></label>' +
                '<input id="st-hours" name="preferred_hours_utc" type="text" value="' + esc(prefHoursVal) + '" placeholder="8, 14, 20" class="admin-input font-tabular">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-max-posts">Max Posts Per Day (1–24)</label>' +
                '<input id="st-max-posts" name="max_posts_per_day" type="number" min="1" max="24" value="' + esc(s.max_posts_per_day != null ? s.max_posts_per_day : 2) + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-novelty">Min News Novelty Score <span class="normal-case text-ink-faint">(0-100, skips writing below threshold)</span></label>' +
                '<input id="st-novelty" name="min_novelty_score" type="number" min="0" max="100" value="' + esc(s.min_novelty_score != null ? s.min_novelty_score : 68) + '" class="admin-input">' +
              '</div>' +
              '<div class="flex items-center gap-3 pt-2 md:col-span-2">' +
                '<input id="st-sched" name="schedule_enabled" type="checkbox"' + (s.schedule_enabled ? ' checked' : '') + ' class="h-4 w-4 accent-[var(--accent)]">' +
                '<label for="st-sched" class="text-sm font-medium text-ink cursor-pointer">Enable Autonomous Cron Schedule</label>' +
              '</div>' +
            '</div>' +
            '<div class="space-y-1.5">' +
              '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-feed">Default Topic Feed URL</label>' +
              '<input id="st-feed" name="default_topic_feed" type="text" value="' + esc(s.default_topic_feed || '') + '" class="admin-input">' +
            '</div>' +
            '<p class="font-tabular text-xs text-ink-faint">Last scheduled run: ' + esc(fmtDate(s.last_scheduled_run_at)) + '</p>' +
          '</div>' +

          '<div class="editorial-card p-6 space-y-4">' +
            '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">' +
              '<div class="flex flex-wrap items-center gap-2">' +
                '<h2 class="font-tabular text-xs uppercase tracking-[0.14em] text-accent font-semibold">OpenRouter Models &amp; Spend Guard</h2>' +
                '<span class="badge-editorial ' + (s.free_models_only !== false ? 'badge-success' : 'badge-warning') + '">' +
                  (s.free_models_only !== false ? '$0 Free Only' : 'Custom / Paid Allowed') +
                '</span>' +
                '<span class="badge-editorial">' + state.freeModels.length + ' live :free</span>' +
              '</div>' +
              '<button type="button" data-action="refresh-free-models" class="btn-ghost text-xs font-tabular px-2.5 py-1 self-start sm:self-auto">Refresh :free Models</button>' +
            '</div>' +
            '<div class="rounded-[5px] border border-hairline bg-subtle/60 px-4 py-3 flex items-start gap-3">' +
              '<input id="st-free-only" name="free_models_only" type="checkbox"' + (s.free_models_only !== false ? ' checked' : '') + ' class="h-4 w-4 mt-0.5 accent-[var(--accent)]">' +
              '<div class="space-y-0.5">' +
                '<label for="st-free-only" class="text-sm font-medium text-ink cursor-pointer">OpenRouter Free Models Only ($0 Spend Guard)</label>' +
                '<p class="text-xs text-ink-muted">Restricts all research, writing, and audit completions to zero-cost <code>:free</code> models or <code>openrouter/free</code>.</p>' +
              '</div>' +
            '</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
              '<div class="space-y-2">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-model">Primary Research &amp; Writing Model</label>' +
                '<select id="st-model-picker" data-sync-target="st-model" aria-label="Pick live free primary model" class="admin-select font-tabular text-xs">' +
                  renderFreeModelOptions(s.openrouter_model || '', 'Pick live :free model to populate...') +
                '</select>' +
                '<input id="st-model" name="openrouter_model" data-sync-picker="st-model-picker" type="text" value="' + esc(s.openrouter_model || '') + '" placeholder="google/gemma-4-31b-it:free" class="admin-input font-tabular">' +
              '</div>' +
              '<div class="space-y-2">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-judge">Judge / Audit Model</label>' +
                '<select id="st-judge-picker" data-sync-target="st-judge" aria-label="Pick live free judge model" class="admin-select font-tabular text-xs">' +
                  renderFreeModelOptions(s.judge_model || '', 'Pick live :free judge model...') +
                '</select>' +
                '<input id="st-judge" name="judge_model" data-sync-picker="st-judge-picker" type="text" value="' + esc(s.judge_model || '') + '" placeholder="openrouter/free" class="admin-input font-tabular">' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="editorial-card p-6 space-y-4">' +
            '<h2 class="font-tabular text-xs uppercase tracking-[0.14em] text-accent font-semibold">Publication &amp; Masthead</h2>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
              '<div class="space-y-1.5">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-sname">Site Name</label>' +
                '<input id="st-sname" name="site_name" type="text" value="' + esc(s.site_name || '') + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-base">Canonical Base URL</label>' +
                '<input id="st-base" name="base_url" type="url" value="' + esc(s.base_url || '') + '" placeholder="https://pyvren.com" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5 md:col-span-2">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-tag">Site Tagline</label>' +
                '<input id="st-tag" name="site_tagline" type="text" value="' + esc(s.site_tagline || '') + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-author">Default Author / Lead Editor</label>' +
                '<input id="st-author" name="default_author" type="text" value="' + esc(s.default_author || '') + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-email">Contact Email</label>' +
                '<input id="st-email" name="contact_email" type="email" value="' + esc(s.contact_email || '') + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5 md:col-span-2">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-bio">Author Bio</label>' +
                '<textarea id="st-bio" name="author_bio" rows="3" class="admin-textarea">' + esc(s.author_bio || '') + '</textarea>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="editorial-card p-6 space-y-4">' +
            '<h2 class="font-tabular text-xs uppercase tracking-[0.14em] text-accent font-semibold">Monetization &amp; Bottom Conversion Strip</h2>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
              '<div class="space-y-1.5">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-ads">Google AdSense Client ID <span class="normal-case text-ink-faint">(blank disables ads)</span></label>' +
                '<input id="st-ads" name="adsense_client_id" type="text" value="' + esc(s.adsense_client_id || '') + '" placeholder="ca-pub-xxxxxxxxxxxxxxxx" class="admin-input font-tabular">' +
              '</div>' +
              '<div class="space-y-1.5">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-ctaurl">CTA URL</label>' +
                '<input id="st-ctaurl" name="cta_url" type="text" value="' + esc(s.cta_url || '') + '" placeholder="/rss.xml" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5 md:col-span-2">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-ctah">CTA Headline</label>' +
                '<input id="st-ctah" name="cta_headline" type="text" value="' + esc(s.cta_headline || '') + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1.5 md:col-span-2">' +
                '<label class="block font-tabular text-xs text-ink-muted uppercase" for="st-ctab">CTA Body</label>' +
                '<textarea id="st-ctab" name="cta_body" rows="2" class="admin-textarea">' + esc(s.cta_body || '') + '</textarea>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="flex items-center justify-end gap-3">' +
            '<button type="submit" class="btn-accent px-6 py-2.5">Save Settings</button>' +
          '</div>' +
        '</form>' +
      '</section>';
    }

    /* ------------------------------------------------------------------
       Modals: Sandboxed Preview, Post Markdown/GEO Editor, Skill Editor
       ------------------------------------------------------------------ */

    function closeModal() {
      var root = document.getElementById('modal-root');
      if (root) root.innerHTML = '';
    }

    function openPreviewModal(postId) {
      var post = state.posts.find(function (p) { return p.id === postId; });
      var title = post ? post.title : ('Briefing #' + postId);
      var root = document.getElementById('modal-root');
      root.innerHTML = '<div class="admin-modal-backdrop" data-modal-backdrop>' +
        '<div class="admin-modal-panel max-w-5xl flex flex-col" style="height:88vh">' +
          '<div class="px-5 py-3.5 border-b border-hairline flex items-center justify-between gap-3 bg-surface">' +
            '<div class="min-w-0">' +
              '<p class="font-tabular text-[10px] uppercase tracking-widest text-accent font-semibold">Sandboxed SSR Preview (sandbox=&quot;&quot;)</p>' +
              '<h2 class="font-editorial text-lg font-semibold text-ink truncate">' + esc(title) + '</h2>' +
            '</div>' +
            '<button type="button" data-action="close-modal" class="btn-ghost text-xs font-tabular">Close</button>' +
          '</div>' +
          '<iframe sandbox="" src="/api/admin/preview/' + encodeURIComponent(postId) + '" title="Sandboxed post preview" class="w-full flex-1 bg-white border-0"></iframe>' +
        '</div>' +
      '</div>';
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
        author: (state.settings && state.settings.default_author) || '',
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
        '<div class="admin-modal-panel max-w-4xl p-6 space-y-5">' +
          '<div class="flex items-center justify-between gap-3 pb-4 border-b border-hairline">' +
            '<div class="space-y-1">' +
              '<div class="flex flex-wrap items-center gap-2">' +
                '<p class="font-tabular text-[10px] uppercase tracking-widest text-accent font-semibold">' + (isEdit ? 'Edit Briefing #' + p.id : 'New Editorial Briefing') + '</p>' +
                (isEdit && p.admin_locked === true ? '<span class="badge-editorial badge-accent">Admin Locked</span>' : '') +
                (isEdit && p.admin_locked === true && p.last_edited_by ? '<span class="badge-editorial">Edited by ' + esc(p.last_edited_by) + '</span>' : '') +
              '</div>' +
              '<h2 class="font-editorial text-2xl font-semibold text-ink">' + (isEdit ? esc(p.title) : 'Compose Markdown & GEO Dossier') + '</h2>' +
            '</div>' +
            '<button type="button" data-action="close-modal" class="btn-ghost text-xs font-tabular">Close</button>' +
          '</div>' +

          '<form id="post-editor-form" data-post-id="' + (isEdit ? p.id : '') + '" class="space-y-4">' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
              '<div class="space-y-1 md:col-span-2">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Title</label>' +
                '<input name="title" type="text" required value="' + esc(p.title) + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Slug <span class="normal-case text-ink-faint">(auto if empty)</span></label>' +
                '<input name="slug" type="text" value="' + esc(p.slug || '') + '" class="admin-input font-tabular">' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Author</label>' +
                '<input name="author" type="text" value="' + esc(p.author || '') + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Category Skill</label>' +
                '<select name="category_slug" class="admin-select">' + catOpts + '</select>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Archetype</label>' +
                '<select name="archetype" class="admin-select">' + archOpts + '</select>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Status</label>' +
                '<select name="status" class="admin-select">' +
                  '<option value="draft"' + (p.status !== 'published' ? ' selected' : '') + '>Draft</option>' +
                  '<option value="published"' + (p.status === 'published' ? ' selected' : '') + '>Published</option>' +
                '</select>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Tags (comma-separated)</label>' +
                '<input name="tags" type="text" value="' + esc(Array.isArray(p.tags_json) ? p.tags_json.join(', ') : '') + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1 md:col-span-2">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Keywords (SEO / GEO, comma-separated)</label>' +
                '<input name="keywords" type="text" value="' + esc(Array.isArray(p.keywords_json) ? p.keywords_json.join(', ') : '') + '" placeholder="cli coding agents, mcp token overhead, prompt injection defense, context rot" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Cover Image URL <span class="normal-case text-ink-faint">(https:// crawled reference or empty for Crew SVG)</span></label>' +
                '<input name="cover_image_url" type="url" value="' + esc(p.cover_image_url || '') + '" placeholder="https://..." class="admin-input font-tabular">' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Cover Image Alt / Caption</label>' +
                '<input name="cover_image_alt" type="text" value="' + esc(p.cover_image_alt || '') + '" placeholder="Benchmark diagram or reference figure caption" class="admin-input">' +
              '</div>' +
            '</div>' +

            '<div class="space-y-1">' +
              '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Meta Description</label>' +
              '<textarea name="description" rows="2" required class="admin-textarea">' + esc(p.description || '') + '</textarea>' +
            '</div>' +

            '<div class="space-y-1">' +
              '<label class="block font-tabular text-[11px] uppercase text-ink-muted">GEO Answer-First TL;DR Summary</label>' +
              '<textarea name="tldr_summary" rows="2" class="admin-textarea">' + esc(p.tldr_summary || '') + '</textarea>' +
            '</div>' +

            '<div class="space-y-1">' +
              '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Body Markdown</label>' +
              '<textarea name="body_markdown" rows="12" required class="admin-textarea">' + esc(p.body_markdown || '') + '</textarea>' +
            '</div>' +

            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Key Facts <span class="normal-case text-ink-faint">(one per line: Label | Value | Optional URL)</span></label>' +
                '<textarea name="key_facts_lines" rows="4" class="admin-textarea" placeholder="Latency P95 | 142ms | https://example.com">' + esc(factsLines) + '</textarea>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Primary Sources <span class="normal-case text-ink-faint">(one https:// URL per line)</span></label>' +
                '<textarea name="sources_lines" rows="4" class="admin-textarea" placeholder="https://official-advisory.example.com">' + esc(arrayToLines(p.sources_json)) + '</textarea>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">FAQ JSON <span class="normal-case text-ink-faint">([{&quot;question&quot;:&quot;...&quot;,&quot;answer&quot;:&quot;...&quot;}])</span></label>' +
                '<textarea name="faq_json_text" rows="4" class="admin-textarea">' + esc(faqJsonText) + '</textarea>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Human Spot-Check Notes <span class="normal-case text-ink-faint">(one per line)</span></label>' +
                '<textarea name="review_notes_lines" rows="4" class="admin-textarea">' + esc(arrayToLines(p.review_notes_json)) + '</textarea>' +
              '</div>' +
            '</div>' +

            '<div id="lint-preview-box" class="hidden rounded-[6px] border border-hairline bg-subtle p-4 text-xs space-y-2"></div>' +

            '<div class="pt-4 border-t border-hairline flex flex-wrap items-center justify-between gap-3">' +
              '<button type="button" data-action="dry-run-lint" class="btn-ghost font-tabular text-xs">Dry-Run Lint &amp; Score</button>' +
              '<div class="flex items-center gap-2">' +
                '<button type="button" data-action="close-modal" class="btn-ghost text-xs">Cancel</button>' +
                '<button type="submit" class="btn-accent text-xs px-5">' + (isEdit ? 'Save Changes' : 'Create Briefing') + '</button>' +
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
          throw new Error('FAQ JSON is invalid. Please provide a valid JSON array of {question, answer}.');
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
        '<div class="admin-modal-panel max-w-3xl p-6 space-y-5">' +
          '<div class="flex items-center justify-between gap-3 pb-4 border-b border-hairline">' +
            '<div>' +
              '<p class="font-tabular text-[10px] uppercase tracking-widest text-accent font-semibold">' + (isEdit ? 'Edit Category Skill' : 'New Category Skill') + '</p>' +
              '<h2 class="font-editorial text-2xl font-semibold text-ink">' + (isEdit ? esc(s.name) : 'Create Research Track') + '</h2>' +
            '</div>' +
            '<button type="button" data-action="close-modal" class="btn-ghost text-xs font-tabular">Close</button>' +
          '</div>' +

          '<form id="skill-editor-form" data-is-edit="' + (isEdit ? '1' : '0') + '" class="space-y-4">' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Name</label>' +
                '<input name="name" type="text" required value="' + esc(s.name) + '" class="admin-input">' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Slug</label>' +
                '<input name="slug" type="text" required ' + (isEdit ? 'readonly' : '') + ' value="' + esc(s.slug) + '" placeholder="ai-security-jailbreaks" class="admin-input font-tabular' + (isEdit ? ' opacity-70' : '') + '">' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Priority (higher runs more often)</label>' +
                '<input name="priority" type="number" min="1" max="100" value="' + esc(s.priority != null ? s.priority : 50) + '" class="admin-input">' +
              '</div>' +
              '<div class="flex items-center gap-3 pt-5">' +
                '<input id="sk-enabled" name="enabled" type="checkbox"' + (s.enabled ? ' checked' : '') + ' class="h-4 w-4 accent-[var(--accent)]">' +
                '<label for="sk-enabled" class="text-sm font-medium text-ink">Skill Enabled for Autonomous Runs</label>' +
              '</div>' +
            '</div>' +

            '<div class="space-y-1">' +
              '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Description</label>' +
              '<textarea name="description" rows="2" required class="admin-textarea">' + esc(s.description) + '</textarea>' +
            '</div>' +

            '<div class="space-y-1">' +
              '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Target Audience</label>' +
              '<input name="target_audience" type="text" value="' + esc(s.target_audience || '') + '" class="admin-input">' +
            '</div>' +

            '<div class="space-y-1">' +
              '<label class="block font-tabular text-[11px] uppercase text-ink-muted">System Instructions (Domain Prompt)</label>' +
              '<textarea name="system_instructions" rows="5" required class="admin-textarea">' + esc(s.system_instructions || '') + '</textarea>' +
            '</div>' +

            '<div class="space-y-1.5">' +
              '<span class="block font-tabular text-[11px] uppercase text-ink-muted">Preferred Archetypes</span>' +
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

            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Research Feeds (one URL per line)</label>' +
                '<textarea name="research_feeds" rows="4" class="admin-textarea">' + esc(arrayToLines(s.research_feeds_json)) + '</textarea>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Search Queries (one per line)</label>' +
                '<textarea name="search_queries" rows="4" class="admin-textarea">' + esc(arrayToLines(s.search_queries_json)) + '</textarea>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Required Sections (one per line)</label>' +
                '<textarea name="required_sections" rows="3" class="admin-textarea">' + esc(arrayToLines(s.required_sections_json)) + '</textarea>' +
              '</div>' +
              '<div class="space-y-1">' +
                '<label class="block font-tabular text-[11px] uppercase text-ink-muted">Banned Patterns / Clichés (one per line)</label>' +
                '<textarea name="banned_patterns" rows="3" class="admin-textarea">' + esc(arrayToLines(s.banned_patterns_json)) + '</textarea>' +
              '</div>' +
            '</div>' +

            '<div class="pt-4 border-t border-hairline flex items-center justify-end gap-2">' +
              '<button type="button" data-action="close-modal" class="btn-ghost text-xs">Cancel</button>' +
              '<button type="submit" class="btn-accent text-xs px-5">' + (isEdit ? 'Save Skill' : 'Create Skill') + '</button>' +
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
      if (state.activeTab === 'posts') tabHtml = renderPostsTab();
      else if (state.activeTab === 'agent') tabHtml = renderAgentTab();
      else if (state.activeTab === 'skills') tabHtml = renderSkillsTab();
      else tabHtml = renderSettingsTab();

      app.innerHTML = renderTopBar() +
        '<main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">' +
          tabHtml +
        '</main>';
    }

    /* ------------------------------------------------------------------
       Event Delegation & Actions
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
        } else if (action === 'close-modal') {
          closeModal();
        } else if (action === 'switch-tab') {
          state.activeTab = target.getAttribute('data-tab') || 'posts';
          render();
        } else if (action === 'logout') {
          await apiFetch('/api/admin/auth/logout', { method: 'POST' });
          state.auth.authenticated = false;
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
          toast('Publishing mode set to ' + (mode === 'auto_publish' ? 'Auto-Publish (Gated)' : 'Draft Review (Safe)'), 'success');
          render();
        } else if (action === 'refresh-all') {
          await loadAllWorkspaceData();
          toast('Workspace refreshed', 'success');
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
          toast(isPubAction ? 'Briefing published' : 'Briefing moved to drafts', 'success');
          await loadAllWorkspaceData();
        } else if (action === 'delete-post') {
          var delId = Number(target.getAttribute('data-id'));
          if (!window.confirm('Permanently delete this briefing?')) return;
          await apiFetch('/api/admin/posts/' + delId, { method: 'DELETE' });
          toast('Briefing deleted', 'success');
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
              '<span class="badge-editorial ' + (lr.passed ? 'badge-success' : 'badge-danger') + '">' + (lr.passed ? 'LINT PASS' : 'LINT FAIL') + '</span>' +
              '<span class="badge-editorial">Quality Score: ' + esc(Math.round(lr.quality_score || 0)) + '/100</span>' +
            '</div>' +
            '<span class="font-tabular text-ink-faint">' + esc(lr.word_count || 0) + ' words &middot; ' + esc(lr.reading_time_minutes || 1) + ' min</span>' +
          '</div>' +
          (lbd.humanity_signals ? '<div class="pt-2">' + renderHumanityScorecard(lbd.humanity_signals) + '</div>' : '') +
          (Array.isArray(lr.errors) && lr.errors.length > 0
            ? '<ul class="list-disc pl-4 space-y-1 text-[var(--danger)]">' + lr.errors.map(function (er) { return '<li>' + esc(er) + '</li>'; }).join('') + '</ul>'
            : '<p class="text-[var(--success)]">Zero lint violations detected. Ready for editorial publication.</p>');
        } else if (action === 'apply-preset') {
          var preset = PRESETS[Number(target.getAttribute('data-preset'))];
          if (preset) {
            var tEl = document.getElementById('ag-topic');
            var cEl = document.getElementById('ag-cat');
            var aEl = document.getElementById('ag-arch');
            if (tEl) tEl.value = preset.topic;
            if (cEl) cEl.value = preset.category;
            if (aEl) aEl.value = preset.archetype;
          }
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
            toast('Schedule preset applied — click Save Settings to persist', 'success');
          }
        } else if (action === 'new-skill') {
          openSkillEditorModal(null);
        } else if (action === 'edit-skill') {
          var slug = target.getAttribute('data-slug');
          var sk = state.skills.find(function (x) { return x.slug === slug; });
          if (sk) openSkillEditorModal(sk);
        } else if (action === 'delete-skill') {
          var delSlug = target.getAttribute('data-slug');
          if (!window.confirm('Delete category skill "' + delSlug + '"?')) return;
          await apiFetch('/api/admin/skills/' + encodeURIComponent(delSlug), { method: 'DELETE' });
          toast('Skill deleted', 'success');
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
          if (lErr) lErr.classList.add('hidden');
          try {
            await apiFetch('/api/admin/auth/login', {
              method: 'POST',
              body: {
                email: String(lfd.get('email') || '').trim(),
                password: String(lfd.get('password') || '')
              }
            });
            toast('Signed in', 'success');
            await checkAuthStatus();
          } catch (err) {
            if (lErr) {
              lErr.textContent = err.message || 'Invalid credentials';
              lErr.classList.remove('hidden');
            }
          }
        } else if (form.id === 'post-editor-form') {
          var postId = form.getAttribute('data-post-id');
          var payload = extractPostPayload(form);
          if (postId) {
            await apiFetch('/api/admin/posts/' + encodeURIComponent(postId), { method: 'PUT', body: payload });
            toast('Briefing updated', 'success');
          } else {
            await apiFetch('/api/admin/posts', { method: 'POST', body: payload });
            toast('Briefing created', 'success');
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
            toast(forceEnabled ? 'Research agent force-dispatched' : 'Research agent dispatched', 'success');
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
            toast('Category skill updated', 'success');
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
            toast('Category skill created', 'success');
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
                throw new Error('Preferred UTC Hours must be integers between 0 and 23 (e.g. 8, 14, 20).');
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
