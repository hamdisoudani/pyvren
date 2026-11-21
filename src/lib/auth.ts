import { getSessionSecret, type WorkerEnv } from '../env';
import { constantTimeEqual } from './security';

// Cloudflare Workers WebCrypto caps PBKDF2 iterations at 100,000.
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_BITS = 256;
const SALT_BYTES = 16;
const SESSION_COOKIE_NAME = 'pyvren_session';

export interface SessionUserPayload {
  sub: string;
  email: string;
  displayName: string;
  tv?: boolean;
}

export interface VerifiedSession extends SessionUserPayload {
  exp: number;
}

export interface AdminAuthResult {
  ok: boolean;
  email?: string;
  method?: 'cookie' | 'bearer_jwt' | 'bearer_token';
  turnstileVerified?: boolean;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.trim().toLowerCase();
  if (!clean || clean.length % 2 !== 0 || !/^[0-9a-f]+$/.test(clean)) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(new ArrayBuffer(clean.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(input)) {
    throw new Error('Invalid base64url string');
  }
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function jsonToBase64Url(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return bytesToBase64Url(bytes);
}

function base64UrlToJson<T>(segment: string): T {
  const bytes = base64UrlToBytes(segment);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return JSON.parse(text) as T;
}

async function signHmacSha256(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return bytesToBase64Url(new Uint8Array(sig));
}

export function validatePasswordStrength(password: string): string | null {
  if (typeof password !== 'string' || password.length < 12) {
    return 'Password must be at least 12 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[\d\p{P}\p{S}]/u.test(password)) {
    return 'Password must contain at least one digit or symbol.';
  }
  return null;
}

export async function hashPassword(
  password: string,
  saltHex?: string,
): Promise<{ hash: string; salt: string }> {
  const saltBytes = saltHex
    ? hexToBytes(saltHex)
    : crypto.getRandomValues(new Uint8Array(SALT_BYTES));

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    PBKDF2_KEY_BITS,
  );

  return {
    hash: bytesToHex(new Uint8Array(derivedBits)),
    salt: bytesToHex(saltBytes),
  };
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  expectedHash: string,
): Promise<boolean> {
  if (!password || !saltHex || !expectedHash) {
    return false;
  }
  try {
    const { hash } = await hashPassword(password, saltHex);
    return constantTimeEqual(hash, expectedHash.trim().toLowerCase());
  } catch {
    return false;
  }
}

export async function createSessionToken(
  payload: SessionUserPayload,
  secret: string,
  ttlSeconds = 86400 * 7,
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const headerSegment = jsonToBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payloadSegment = jsonToBase64Url({
    sub: payload.sub,
    email: payload.email,
    displayName: payload.displayName,
    ...(payload.tv ? { tv: true } : {}),
    iat: nowSec,
    exp: nowSec + Math.max(1, Math.floor(ttlSeconds)),
  });

  const signingInput = `${headerSegment}.${payloadSegment}`;
  const signatureSegment = await signHmacSha256(signingInput, secret);
  return `${signingInput}.${signatureSegment}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<VerifiedSession | null> {
  if (typeof token !== 'string' || !token || !secret) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !p)) {
    return null;
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts;

  try {
    const header = base64UrlToJson<{ alg?: unknown; typ?: unknown }>(headerSegment);
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      return null;
    }

    const expectedSig = await signHmacSha256(`${headerSegment}.${payloadSegment}`, secret);
    if (!constantTimeEqual(signatureSegment, expectedSig)) {
      return null;
    }

    const claims = base64UrlToJson<{
      sub?: unknown;
      email?: unknown;
      displayName?: unknown;
      tv?: unknown;
      exp?: unknown;
    }>(payloadSegment);

    if (
      typeof claims.sub !== 'string' ||
      !claims.sub ||
      typeof claims.email !== 'string' ||
      !claims.email ||
      typeof claims.displayName !== 'string' ||
      typeof claims.exp !== 'number' ||
      !Number.isFinite(claims.exp)
    ) {
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (claims.exp <= nowSec) {
      return null;
    }

    return {
      sub: claims.sub,
      email: claims.email,
      displayName: claims.displayName,
      tv: claims.tv === true,
      exp: claims.exp,
    };
  } catch {
    return null;
  }
}

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    if (key === name) {
      const rawVal = pair.slice(eqIdx + 1).trim();
      try {
        return decodeURIComponent(rawVal);
      } catch {
        return rawVal;
      }
    }
  }
  return null;
}

export async function isAdminAuthenticated(
  request: Request,
  env: WorkerEnv,
): Promise<AdminAuthResult> {
  const sessionSecret = getSessionSecret(env);

  // 1. Check Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
    if (match) {
      const token = match[1].trim();
      const configuredAdminToken = (env.ADMIN_TOKEN ?? '').trim();
      if (configuredAdminToken.length > 0 && constantTimeEqual(token, configuredAdminToken)) {
        return { ok: true, method: 'bearer_token', turnstileVerified: true };
      }

      const verified = await verifySessionToken(token, sessionSecret);
      if (verified) {
        return {
          ok: true,
          email: verified.email,
          method: 'bearer_jwt',
          turnstileVerified: verified.tv === true,
        };
      }
    }
  }

  // 2. Check Cookie: pyvren_session=<jwt>
  const sessionCookie = getCookieValue(request.headers.get('cookie'), SESSION_COOKIE_NAME);
  if (sessionCookie) {
    const verified = await verifySessionToken(sessionCookie, sessionSecret);
    if (verified) {
      return {
        ok: true,
        email: verified.email,
        method: 'cookie',
        turnstileVerified: verified.tv === true,
      };
    }
  }

  return { ok: false };
}

export function buildSessionCookie(
  token: string,
  isHttps: boolean,
  maxAgeSeconds = 86400 * 7,
): string {
  const maxAge = Math.max(0, Math.floor(maxAgeSeconds));
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function buildClearSessionCookie(isHttps: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  return parts.join('; ');
}
