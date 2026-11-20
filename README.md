# Pyvren — Autonomous Headless + SSR Technical Publishing Platform

**Pyvren** is a production-ready, edge-native autonomous technical publishing platform built for **Cloudflare Workers**, **Cloudflare Workflows**, **Supabase (PostgreSQL + RLS)**, and **OpenRouter**.

It is engineered from the ground up to serve three audiences cleanly without compromises:
1. **Humans & Google AdSense:** Sub-50ms edge-cached Server-Side Rendered (SSR) HTML with zero render-blocking JavaScript, Swiss editorial typography (Tailwind CSS v4), light/dark polish, CLS-safe ad slots, and mandatory trust pages (`/about`, `/editorial-policy`, `/privacy`, `/contact`, `/ads.txt`).
2. **Search Engines (Google, Bing, Brave, DuckDuckGo):** Complete first-byte `<head>` metadata, canonical URLs, `TechArticle` + `BreadcrumbList` + `FAQPage` + `Organization` JSON-LD, `ETag`/`304 Not Modified`, real HTTP `404`s for drafts, `/sitemap.xml`, `/rss.xml`, and `/robots.txt`.
3. **AI Search & Retrieval Engines (ChatGPT Search, Gemini, Perplexity, Claude):** Native `/llms.txt`, `/llms-full.txt`, per-article Markdown mirrors (`/blog/:slug.md`), Answer-First TL;DR blocks, Verified Key Facts tables, and a CORS-enabled public **Headless JSON API** (`/api/v1/*`).

---

## Core Architecture & Security Guarantees

- **Strict SSR / SPA Separation:** Public routes (`/`, `/blog`, `/blog/:slug`, `/category/:slug`, trust pages) are 100% SSR HTML. The reactive Admin Control Panel SPA is strictly isolated at `/admin` with `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`.
- **Single-Admin Lock (No Public Registration):** Enforced at **both** application level (`/api/admin/auth/bootstrap` permanently returns `403` once initialized) and PostgreSQL schema level (`admin_users.id INTEGER PRIMARY KEY CHECK (id = 1)`). Passwords are hashed with WebCrypto PBKDF2-SHA256 (100,000 iterations), sessions use HMAC-SHA256 `HttpOnly; SameSite=Strict` cookies, and login enforces a 5-attempt / 15-minute lockout.
- **Durable Autonomous Research Agent (`EditorialAgentWorkflow`):**
  - Powered by **OpenRouter** (configurable model in Admin UI, defaulting to `google/gemini-2.5-flash`).
  - Runs as a 6-stage **Cloudflare Workflow** (`load-context` → `hunt-topics` → `deep-research` → `draft-and-refine` → `quality-assessment` → `persist-and-gate`) so 30–90s wall-clock multi-source runs never hit Worker timeouts.
  - Controlled **Per-Category Skills** (`ai-llms`, `ai-security-jailbreaks`, `cloud-gpu-infra`, `dev-tooling-benchmarks`, plus custom skills editable in `/admin`).
  - Controlled research tools: CISA KEV, GitHub Security Advisories, Hacker News Algolia, arXiv AI / AI Security, HuggingFace Daily Papers, Serper.dev (optional) with DuckDuckGo HTML fallback, and `r.jina.ai` with direct HTML-to-Markdown fallback preserving `<table>` and `<pre><code>`.
- **Deterministic Anti-Slop Linter & Hard Publishing Gate:**
  - Every post (manual or agent-generated) is audited by `src/lib/linter.ts` across 12 hard rules and a 0–100 6-dimension quality scorecard.
  - Even in `auto_publish` mode, any post that fails deterministic linting (or falls below `min_publish_score` for agent runs) is **automatically forced to `status = 'draft'`**.
- **Defense-in-Depth Guards:**
  - **SSRF Guard (`src/lib/security.ts`):** `https://` only, blocks private/loopback/link-local/CGNAT/metadata IPs & decimal IP tricks, and manually validates every HTTP redirect hop.
  - **Stored XSS Guard:** Allowlist state-machine HTML sanitizer strips `<script>`, `<iframe>`, `on*` handlers, and `javascript:` URLs while preserving semantic tables and fenced code blocks.
  - **Supabase RLS:** Public `anon` role can read only `status = 'published'` posts and `enabled = true` skills; `admin_users`, `site_settings`, `agent_runs`, and drafts remain strictly private.

See [`docs/cloudflare-workers-study.md`](./docs/cloudflare-workers-study.md) for the complete quantitative study on Cloudflare Workers CPU vs. wall-clock execution limits, Workflows durability, and OpenRouter token budgets.

---

## Project Layout

```text
pyvren/
├── wrangler.jsonc                   # Cloudflare Workers + Assets + Workflows + Cron Triggers
├── package.json                     # Hono, Marked, Zod, Tailwind CSS v4, Vitest, Wrangler
├── supabase/migrations/
│   └── 001_initial_schema.sql       # Tables, indexes, single-admin lock, RLS, 4 seeded skills
├── docs/
│   └── cloudflare-workers-study.md  # Execution time, CPU vs I/O wait, & Workflows study
├── public/assets/app.css            # Compiled minified Tailwind CSS v4 bundle (~42KB / ~9KB gzip)
├── src/
│   ├── index.ts                     # Worker fetch + scheduled Cron + Workflow export
│   ├── types.ts & env.ts            # Shared strict domain types & Worker bindings
│   ├── lib/
│   │   ├── db.ts                    # Supabase PostgREST adapter + InMemory test adapter
│   │   ├── auth.ts                  # Single-admin WebCrypto PBKDF2 + HMAC JWT auth
│   │   ├── security.ts              # SSRF guard, HTML XSS sanitizer, ETag, constant-time eq
│   │   ├── markdown.ts              # GFM Markdown -> sanitized HTML + TOC heading extractor
│   │   ├── linter.ts                # Deterministic anti-slop, SEO, GEO, & AdSense scorecard
│   │   ├── skills.ts                # Category skills selector & system prompt compiler
│   │   ├── tools.ts                 # Controlled feeds, Serper/DDG search, Jina/HTML reader
│   │   ├── openrouter.ts            # OpenRouter Chat Completions client with retry/backoff
│   │   └── agent.ts                 # 6-stage autonomous research, drafting & gating pipeline
│   ├── workflows/agent-workflow.ts  # Cloudflare WorkflowEntrypoint durable execution wrapper
│   ├── routes/
│   │   ├── public.ts                # SSR HTML routes + ETag/304 + edge caching
│   │   ├── seo.ts                   # /sitemap.xml, /rss.xml, /robots.txt, /ads.txt, /llms.txt, /blog/:slug.md
│   │   ├── headless.ts              # Public CORS Headless JSON API (/api/v1/*)
│   │   └── admin.ts                 # Single-admin auth + Settings/Skills/Posts/Preview/Agent API
│   ├── ui/                          # Swiss editorial SSR templates & /admin Control SPA
│   └── styles/input.css             # Tailwind CSS v4 editorial design tokens
└── tests/e2e.test.ts                # Automated Vitest E2E verification suite
```

---

## Quickstart (Local Dev & Cloudflare Workers Production)

### 1. Install & Verify Locally
```bash
npm install
cp .dev.vars.example .dev.vars   # Add your SUPABASE_*, OPENROUTER_API_KEY, and SESSION_SECRET
npm run build:css && npm test
npm run dev                      # Starts local Wrangler dev server at http://localhost:8787
```

Visit `http://localhost:8787/admin` to complete the **one-time single-admin owner setup** (registration locks permanently immediately afterward).

### 2. Apply Supabase Schema
Run [`supabase/migrations/001_initial_schema.sql`](./supabase/migrations/001_initial_schema.sql) in the Supabase SQL Editor (or via Supabase CLI / Management API).

### 3. Configure Cloudflare Secrets & Deploy
```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put SESSION_SECRET
# Optional: SERPER_API_KEY, JINA_API_KEY, ADMIN_BOOTSTRAP_SECRET
npm run deploy
```

> **Security Reminder:** Never commit `.env`, `.dev.vars`, `SUPABASE_SECRET_KEY`, `OPENROUTER_API_KEY`, or Supabase Personal Access Tokens to Git. All production credentials should be stored via `wrangler secret put`.
