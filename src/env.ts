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

  // OpenRouter
  OPENROUTER_API_KEY?: string;
  DEFAULT_OPENROUTER_MODEL?: string;

  // Optional search & reader APIs
  SERPER_API_KEY?: string;
  JINA_API_KEY?: string;

  // Security & Auth
  SESSION_SECRET?: string;
  ADMIN_BOOTSTRAP_SECRET?: string;
  ADMIN_TOKEN?: string;

  // Site metadata
  SITE_NAME?: string;
  BASE_URL?: string;
  ENVIRONMENT?: string;

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
    // Fallback deterministic dev-only key when running unconfigured tests
    return 'pyvren-dev-session-secret-change-in-production-32chars';
  }
  return secret;
}
