import type { WorkerEnv } from '../env';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TIMEOUT_MS = 5_000;

export interface TurnstileVerifyResult {
  ok: boolean;
  errorCodes?: string[];
  reason?: string;
}

export function isTurnstileEnabled(env: WorkerEnv): boolean {
  const siteKey = (env.TURNSTILE_SITE_KEY || '').trim();
  const secretKey = (env.TURNSTILE_SECRET_KEY || '').trim();
  return siteKey.length > 0 && secretKey.length > 0;
}

export function getTurnstileSiteKey(env: WorkerEnv): string | null {
  if (!isTurnstileEnabled(env)) {
    return null;
  }
  return (env.TURNSTILE_SITE_KEY || '').trim() || null;
}

function stripPort(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, '');
}

export async function verifyTurnstileToken(opts: {
  token: string;
  secretKey: string;
  remoteIp?: string;
  expectedHosts?: string[];
}): Promise<TurnstileVerifyResult> {
  const token = (opts.token || '').trim();
  const secretKey = (opts.secretKey || '').trim();

  if (!token || token.length > 2048 || !secretKey) {
    return { ok: false, reason: 'Missing verification token.' };
  }

  try {
    const form = new URLSearchParams();
    form.set('secret', secretKey);
    form.set('response', token);
    if (opts.remoteIp && opts.remoteIp !== '127.0.0.1') {
      form.set('remoteip', opts.remoteIp);
    }

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
      signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
    });

    if (!res.ok) {
      return { ok: false, reason: `Verification service returned HTTP ${res.status}.` };
    }

    const data = (await res.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
      'error-codes'?: string[];
    };

    if (!data || data.success !== true) {
      return {
        ok: false,
        errorCodes: Array.isArray(data?.['error-codes']) ? data['error-codes'] : undefined,
        reason: 'Security verification failed. Please complete the challenge again.',
      };
    }

    // Verify hostname when provided (ignore Cloudflare dummy test key hostname "example.com")
    const verifiedHost = typeof data.hostname === 'string' ? stripPort(data.hostname) : '';
    const allowedHosts = (opts.expectedHosts || [])
      .map(stripPort)
      .filter((h) => h.length > 0 && h !== 'localhost' && h !== '127.0.0.1');

    if (verifiedHost && verifiedHost !== 'example.com' && allowedHosts.length > 0) {
      if (!allowedHosts.includes(verifiedHost)) {
        return {
          ok: false,
          reason: 'Verification token hostname mismatch.',
        };
      }
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: 'Unable to verify challenge right now. Please try again.',
    };
  }
}
