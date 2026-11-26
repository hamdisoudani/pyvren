import type { DatabaseAdapter } from './types';

export interface WorkerEnv {
  // Static Assets binding (wrangler.jsonc assets)
  ASSETS?: Fetcher;
  // Cloudflare Workflow binding
  EDITORIAL_AGENT_WORKFLOW?: Workflow;

  // Supabase
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;

  // LLM Providers (OpenRouter + NVIDIA NIM)
  OPENROUTER_API_KEY?: string;
  NVIDIA_NIM_API_KEY?: string;
  DEFAULT_OPENROUTER_MODEL?: string;

  // Optional search & reader APIs
  SERPER_API_KEY?: string;
  JINA_API_KEY?: string;

  // Security & Single-Owner Locked Admin Auth (configured via Wrangler secrets / env)
  SESSION_SECRET?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_DISPLAY_NAME?: string;
  ADMIN_TOKEN?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;

  // Site metadata & optional analytics fallback
  SITE_NAME?: string;
  BASE_URL?: string;
  ENVIRONMENT?: string;
  GA_MEASUREMENT_ID?: string;

  // Official Distribution & Syndication API credentials (configured via Wrangler secrets)
  INDEXNOW_KEY?: string;
  DEVTO_API_KEY?: string;
  BLUESKY_HANDLE?: string;
  BLUESKY_APP_PASSWORD?: string;
  MASTODON_INSTANCE_URL?: string;
  MASTODON_ACCESS_TOKEN?: string;
  HASHNODE_TOKEN?: string;
  HASHNODE_PUBLICATION_ID?: string;

  // Optional test-only injected database adapter
  __TEST_DB__?: DatabaseAdapter;
}

export function normalizeBaseUrl(url?: string | null): string {
  const raw = (url || 'https://pyvren.com').trim();
  return raw.replace(/\/+$/, '');
}

export function getSessionSecret(env: WorkerEnv): string {
  const secret = (env.SESSION_SECRET || env.SUPABASE_SECRET_KEY || env.ADMIN_TOKEN || '').trim();
  if (!secret || secret.length < 16) {
    return 'pyvren-dev-session-secret-change-in-production-32chars';
  }
  return secret;
}
