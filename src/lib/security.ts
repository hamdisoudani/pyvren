// Security primitives for Cloudflare Workers: SSRF-safe URL validation & fetch,
// strict allowlist HTML sanitization, escaping, JSON-LD safety, constant-time compare,
// slugification, and WebCrypto SHA-256 ETag computation.

export interface SafeUrlResult {
  ok: boolean;
  reason?: string;
  url?: URL;
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export interface SafeFetchResult {
  url: string;
  status: number;
  contentType: string;
  text: string;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  'instance-data',
]);

const BLOCKED_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.localdomain',
  '.home.arpa',
];

function isPrivateOrReservedIpv4(octets: [number, number, number, number]): boolean {
  const [a, b, c] = octets;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local / cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 (TEST-NET-2)
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 (TEST-NET-3)
  if (a >= 224) return true; // 224.0.0.0/4 (multicast) & 240.0.0.0/4 (reserved/broadcast)
  return false;
}

function parseIpv4Dotted(host: string): [number, number, number, number] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const nums = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
  ];
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return [nums[0], nums[1], nums[2], nums[3]];
}

function isObfuscatedNumericHost(rawHost: string): boolean {
  const h = rawHost.toLowerCase().replace(/\.+$/, '');
  if (!h) return false;
  // Single-integer decimal, hex (0x...), or octal (0...) IP tricks
  if (/^(?:0x[0-9a-f]+|0[0-7]+|\d+)$/i.test(h)) {
    return true;
  }
  // Multi-part dotted numeric host using hex/octal or shorthand (< 4 parts like 127.1)
  const parts = h.split('.');
  if (parts.length >= 2 && parts.length <= 4) {
    const allNumericLike = parts.every((p) => /^(?:0x[0-9a-f]+|0[0-7]+|\d+)$/i.test(p));
    if (allNumericLike) {
      if (parts.length !== 4) return true;
      // Reject hex octets or leading-zero octal octets (e.g. 0177.0.0.1 or 0x7f.0.0.1)
      if (parts.some((p) => /^0x/i.test(p) || (p.length > 1 && p.startsWith('0')))) {
        return true;
      }
    }
  }
  return false;
}

function parseIpv6Groups(rawIpv6: string): number[] | null {
  let addr = rawIpv6.toLowerCase();
  if (addr.includes('%')) return null; // Reject zone IDs

  // Handle embedded IPv4 suffix (e.g. ::ffff:127.0.0.1)
  const lastColon = addr.lastIndexOf(':');
  if (lastColon !== -1 && addr.slice(lastColon + 1).includes('.')) {
    const ipv4 = parseIpv4Dotted(addr.slice(lastColon + 1));
    if (!ipv4) return null;
    const hi = ((ipv4[0] << 8) | ipv4[1]).toString(16);
    const lo = ((ipv4[2] << 8) | ipv4[3]).toString(16);
    addr = `${addr.slice(0, lastColon)}:${hi}:${lo}`;
  }

  const doubleColonParts = addr.split('::');
  if (doubleColonParts.length > 2) return null;

  const parseSegment = (segment: string): number[] | null => {
    if (!segment) return [];
    const tokens = segment.split(':');
    const out: number[] = [];
    for (const token of tokens) {
      if (!/^[0-9a-f]{1,4}$/.test(token)) return null;
      out.push(parseInt(token, 16));
    }
    return out;
  };

  if (doubleColonParts.length === 2) {
    const left = parseSegment(doubleColonParts[0]);
    const right = parseSegment(doubleColonParts[1]);
    if (!left || !right) return null;
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    return [...left, ...new Array<number>(missing).fill(0), ...right];
  }

  const full = parseSegment(addr);
  if (!full || full.length !== 8) return null;
  return full;
}

function isPrivateOrReservedIpv6(groups: number[]): boolean {
  const isAllZero = groups.every((g) => g === 0);
  if (isAllZero) return true; // :: (unspecified)

  const isLoopback =
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0 &&
    groups[6] === 0 &&
    groups[7] === 1;
  if (isLoopback) return true; // ::1

  // IPv4-mapped ::ffff:0:0/96
  if (
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0xffff
  ) {
    return true;
  }

  // IPv4-compatible ::/96 (deprecated)
  if (
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0
  ) {
    return true;
  }

  // Unique local addresses fc00::/7
  if ((groups[0] & 0xfe00) === 0xfc00) return true;

  // Link-local fe80::/10
  if ((groups[0] & 0xffc0) === 0xfe80) return true;

  // Deprecated site-local fec0::/10
  if ((groups[0] & 0xffc0) === 0xfec0) return true;

  // Multicast ff00::/8
  if ((groups[0] & 0xff00) === 0xff00) return true;

  // NAT64 well-known prefix 64:ff9b::/96 (can reach IPv4 targets)
  if (
    groups[0] === 0x0064 &&
    groups[1] === 0xff9b &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0
  ) {
    return true;
  }

  // 6to4 2002::/16 (can embed private IPv4)
  if (groups[0] === 0x2002) return true;

  // Teredo 2001:0000::/32
  if (groups[0] === 0x2001 && groups[1] === 0x0000) return true;

  // Documentation 2001:db8::/32
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true;

  return false;
}

function extractRawAuthorityHost(rawUrl: string): string | null {
  const match = /^https:\/\/([^/?#]+)/i.exec(rawUrl.trim());
  if (!match) return null;
  let authority = match[1];
  // Strip userinfo if present (credentials will also be rejected below)
  const atIdx = authority.lastIndexOf('@');
  if (atIdx !== -1) {
    authority = authority.slice(atIdx + 1);
  }
  if (authority.startsWith('[')) {
    const closeIdx = authority.indexOf(']');
    return closeIdx === -1 ? authority : authority.slice(0, closeIdx + 1);
  }
  const colonIdx = authority.indexOf(':');
  return colonIdx === -1 ? authority : authority.slice(0, colonIdx);
}

export function isSafePublicUrl(rawUrl: string): SafeUrlResult {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { ok: false, reason: 'URL is empty' };
  }
  const trimmed = rawUrl.trim();
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    return { ok: false, reason: 'URL contains control characters' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'Invalid URL syntax' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only https:// URLs are allowed' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'Embedded URL credentials are not allowed' };
  }

  const rawHost = extractRawAuthorityHost(trimmed);
  if (rawHost && !rawHost.startsWith('[') && isObfuscatedNumericHost(rawHost)) {
    return { ok: false, reason: 'Obfuscated numeric/octal/hex IP hosts are not allowed' };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  if (!hostname) {
    return { ok: false, reason: 'URL hostname is empty' };
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { ok: false, reason: `Blocked hostname: ${hostname}` };
  }

  for (const suffix of BLOCKED_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      return { ok: false, reason: `Blocked internal domain suffix: ${suffix}` };
    }
  }

  // IPv6 literal check
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    const ipv6Literal = hostname.slice(1, -1);
    const groups = parseIpv6Groups(ipv6Literal);
    if (!groups) {
      return { ok: false, reason: 'Invalid IPv6 address' };
    }
    if (isPrivateOrReservedIpv6(groups)) {
      return { ok: false, reason: 'Private, loopback, link-local, or mapped IPv6 addresses are not allowed' };
    }
    return { ok: true, url: parsed };
  }

  if (isObfuscatedNumericHost(hostname)) {
    return { ok: false, reason: 'Numeric/octal/hex IP hosts are not allowed' };
  }

  // IPv4 literal check
  const ipv4 = parseIpv4Dotted(hostname);
  if (ipv4) {
    if (isPrivateOrReservedIpv4(ipv4)) {
      return { ok: false, reason: 'Private, loopback, link-local, CGNAT, or reserved IPv4 addresses are not allowed' };
    }
    return { ok: true, url: parsed };
  }

  // Require at least one dot for public DNS names
  if (!hostname.includes('.')) {
    return { ok: false, reason: 'Single-label internal hostnames are not allowed' };
  }

  return { ok: true, url: parsed };
}

async function readResponseTextCapped(response: Response, maxBytes: number): Promise<string> {
  const limit = Math.max(0, Math.floor(maxBytes));
  if (!response.body) {
    const raw = await response.text();
    const encoded = new TextEncoder().encode(raw);
    if (encoded.byteLength <= limit) return raw;
    return new TextDecoder('utf-8', { fatal: false }).decode(encoded.subarray(0, limit));
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (totalBytes < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      const remaining = limit - totalBytes;
      if (value.byteLength <= remaining) {
        chunks.push(value);
        totalBytes += value.byteLength;
      } else {
        chunks.push(value.subarray(0, remaining));
        totalBytes += remaining;
        await reader.cancel().catch(() => {});
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(combined);
}

export async function safeFetch(
  rawUrl: string,
  opts?: SafeFetchOptions,
): Promise<SafeFetchResult> {
  const initialCheck = isSafePublicUrl(rawUrl);
  if (!initialCheck.ok || !initialCheck.url) {
    throw new Error(`Unsafe URL blocked: ${initialCheck.reason ?? 'invalid URL'}`);
  }

  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const maxBytes = opts?.maxBytes ?? 2 * 1024 * 1024;
  const maxRedirects = opts?.maxRedirects ?? 5;

  const headers: Record<string, string> = {
    'User-Agent': 'PyvrenResearchBot/1.0 (+https://pyvren.com)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.8',
    ...(opts?.headers ?? {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = initialCheck.url.toString();

    for (let hop = 0; hop <= maxRedirects; hop++) {
      const response = await fetch(currentUrl, {
        method: 'GET',
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await response.body?.cancel().catch(() => {});

        if (!location) {
          throw new Error(`Redirect response (${response.status}) missing Location header`);
        }
        if (hop === maxRedirects) {
          throw new Error(`Exceeded maximum redirects (${maxRedirects})`);
        }

        let resolved: string;
        try {
          resolved = new URL(location, currentUrl).toString();
        } catch {
          throw new Error(`Invalid redirect Location URL: ${location}`);
        }

        const hopCheck = isSafePublicUrl(resolved);
        if (!hopCheck.ok || !hopCheck.url) {
          throw new Error(`Unsafe redirect target blocked: ${hopCheck.reason ?? 'invalid URL'}`);
        }

        currentUrl = hopCheck.url.toString();
        continue;
      }

      const text = await readResponseTextCapped(response, maxBytes);
      return {
        url: currentUrl,
        status: response.status,
        contentType: response.headers.get('content-type') ?? '',
        text,
      };
    }

    throw new Error(`Exceeded maximum redirects (${maxRedirects})`);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Strict Allowlist HTML Sanitizer (Cloudflare Workers compatible, zero DOM)
// ---------------------------------------------------------------------------

const STRIP_CONTENT_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'noscript',
  'svg',
  'math',
  'form',
  'textarea',
]);

const ALLOWED_TAGS = new Set([
  'p',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'a',
  'strong',
  'b',
  'em',
  'i',
  'del',
  's',
  'hr',
  'br',
  'span',
  'img',
  'details',
  'summary',
  'mark',
  'sup',
  'sub',
  'div',
  'figure',
  'figcaption',
]);

const VOID_TAGS = new Set(['hr', 'br', 'img']);
const CLASS_ALLOWED_TAGS = new Set(['code', 'pre', 'span', 'div', 'table', 'figure', 'figcaption', 'img']);
const HEADING_TAGS = new Set(['h2', 'h3', 'h4', 'h5', 'h6']);
const TABLE_CELL_TAGS = new Set(['th', 'td']);

const SAFE_CLASS_RE = /^[a-zA-Z0-9_\-\s]+$/;
const SAFE_ID_RE = /^[a-zA-Z0-9_\-]+$/;
const SAFE_UINT_RE = /^\d{1,5}$/;
const SAFE_SPAN_RE = /^\d{1,3}$/;
const SAFE_ALIGN_RE = /^(left|center|right|justify)$/i;

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    })
    .replace(/&#(\d+);?/g, (_, dec: string) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    })
    .replace(/&(colon|tab|newline|amp|lt|gt|quot|apos);/gi, (match, name: string) => {
      switch (name.toLowerCase()) {
        case 'colon':
          return ':';
        case 'tab':
          return '\t';
        case 'newline':
          return '\n';
        case 'amp':
          return '&';
        case 'lt':
          return '<';
        case 'gt':
          return '>';
        case 'quot':
          return '"';
        case 'apos':
          return "'";
        default:
          return match;
      }
    });
}

function isSafeAttributeUrl(rawValue: string, allowMailtoAndHash: boolean): { ok: boolean; normalized: string; isExternal: boolean } {
  const decoded = decodeHtmlEntities(rawValue).trim();
  if (!decoded) return { ok: false, normalized: '', isExternal: false };

  // Strip control characters and whitespace when checking protocol prefix
  const compact = decoded.replace(/[\u0000-\u0020\u007f]+/g, '');
  const lower = compact.toLowerCase();

  // Explicitly block dangerous schemes
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('file:')
  ) {
    return { ok: false, normalized: '', isExternal: false };
  }

  if (lower.startsWith('https://') || lower.startsWith('http://')) {
    return { ok: true, normalized: decoded, isExternal: true };
  }

  if (allowMailtoAndHash && lower.startsWith('mailto:')) {
    return { ok: true, normalized: decoded, isExternal: false };
  }

  if (allowMailtoAndHash && decoded.startsWith('#')) {
    return { ok: true, normalized: decoded, isExternal: false };
  }

  // Relative path starting with single '/' (disallow protocol-relative '//')
  if (decoded.startsWith('/') && !decoded.startsWith('//')) {
    return { ok: true, normalized: decoded, isExternal: false };
  }

  return { ok: false, normalized: '', isExternal: false };
}

interface ParsedAttr {
  name: string;
  value: string;
}

function parseTagAttributes(attrSource: string): ParsedAttr[] {
  const attrs: ParsedAttr[] = [];
  let i = 0;
  const len = attrSource.length;

  while (i < len) {
    while (i < len && /[\s/]/.test(attrSource[i])) i++;
    if (i >= len) break;

    const nameStart = i;
    while (i < len && !/[\s=/>"'<]/.test(attrSource[i])) i++;
    const name = attrSource.slice(nameStart, i).toLowerCase();
    if (!name) {
      i++;
      continue;
    }

    while (i < len && /\s/.test(attrSource[i])) i++;

    let value = '';
    if (i < len && attrSource[i] === '=') {
      i++;
      while (i < len && /\s/.test(attrSource[i])) i++;
      if (i < len && (attrSource[i] === '"' || attrSource[i] === "'")) {
        const quote = attrSource[i];
        i++;
        const valStart = i;
        while (i < len && attrSource[i] !== quote) i++;
        value = attrSource.slice(valStart, i);
        if (i < len && attrSource[i] === quote) i++;
      } else {
        const valStart = i;
        while (i < len && !/[\s>]/.test(attrSource[i])) i++;
        value = attrSource.slice(valStart, i);
      }
    }

    attrs.push({ name, value });
  }

  return attrs;
}

function findTagEnd(html: string, startIndex: number): number {
  let i = startIndex;
  const len = html.length;
  let quote: '"' | "'" | null = null;
  while (i < len) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i;
    }
    i++;
  }
  return -1;
}

function sanitizeAllowedTag(tagName: string, rawAttrs: ParsedAttr[]): string {
  const safeAttrs: Array<[string, string]> = [];
  const seen = new Set<string>();

  let isExternalLink = false;
  let linkTargetBlank = false;
  let hasValidImgSrc = false;

  for (const { name, value } of rawAttrs) {
    // Hard block all event handlers and inline styles
    if (name.startsWith('on') || name === 'style' || seen.has(name)) {
      continue;
    }

    if (tagName === 'a') {
      if (name === 'href') {
        const checked = isSafeAttributeUrl(value, true);
        if (checked.ok) {
          seen.add(name);
          safeAttrs.push(['href', checked.normalized]);
          isExternalLink = checked.isExternal;
        }
      } else if (name === 'title') {
        seen.add(name);
        safeAttrs.push(['title', decodeHtmlEntities(value)]);
      } else if (name === 'target') {
        const lower = value.trim().toLowerCase();
        if (lower === '_blank' || lower === '_self') {
          seen.add(name);
          safeAttrs.push(['target', lower]);
          if (lower === '_blank') linkTargetBlank = true;
        }
      } else if (name === 'rel') {
        const tokens = value
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => /^(noopener|noreferrer|nofollow|ugc|sponsored)$/.test(t));
        if (tokens.length > 0) {
          seen.add(name);
          safeAttrs.push(['rel', Array.from(new Set(tokens)).join(' ')]);
        }
      }
    } else if (tagName === 'img') {
      if (name === 'src') {
        const checked = isSafeAttributeUrl(value, false);
        if (checked.ok) {
          seen.add(name);
          safeAttrs.push(['src', checked.normalized]);
          hasValidImgSrc = true;
        }
      } else if (name === 'alt' || name === 'title') {
        seen.add(name);
        safeAttrs.push([name, decodeHtmlEntities(value)]);
      } else if (name === 'width' || name === 'height') {
        const trimmed = value.trim();
        if (SAFE_UINT_RE.test(trimmed)) {
          seen.add(name);
          safeAttrs.push([name, trimmed]);
        }
      } else if (name === 'loading') {
        const lower = value.trim().toLowerCase();
        if (lower === 'lazy' || lower === 'eager') {
          seen.add(name);
          safeAttrs.push(['loading', lower]);
        }
      } else if (name === 'decoding') {
        const lower = value.trim().toLowerCase();
        if (lower === 'async' || lower === 'sync' || lower === 'auto') {
          seen.add(name);
          safeAttrs.push(['decoding', lower]);
        }
      } else if (name === 'referrerpolicy') {
        const lower = value.trim().toLowerCase();
        if (lower === 'no-referrer' || lower === 'strict-origin-when-cross-origin') {
          seen.add(name);
          safeAttrs.push(['referrerpolicy', lower]);
        }
      } else if (name === 'class') {
        const trimmed = value.trim();
        if (trimmed && SAFE_CLASS_RE.test(trimmed)) {
          seen.add(name);
          safeAttrs.push(['class', trimmed]);
        }
      }
    } else if (CLASS_ALLOWED_TAGS.has(tagName) && name === 'class') {
      const trimmed = value.trim();
      if (trimmed && SAFE_CLASS_RE.test(trimmed)) {
        seen.add(name);
        safeAttrs.push(['class', trimmed]);
      }
    } else if (HEADING_TAGS.has(tagName) && name === 'id') {
      const trimmed = value.trim();
      if (trimmed && SAFE_ID_RE.test(trimmed)) {
        seen.add(name);
        safeAttrs.push(['id', trimmed]);
      }
    } else if (TABLE_CELL_TAGS.has(tagName)) {
      if ((name === 'colspan' || name === 'rowspan') && SAFE_SPAN_RE.test(value.trim())) {
        seen.add(name);
        safeAttrs.push([name, value.trim()]);
      } else if (name === 'align' && SAFE_ALIGN_RE.test(value.trim())) {
        seen.add(name);
        safeAttrs.push(['align', value.trim().toLowerCase()]);
      }
    }
  }

  // Drop <img> tags that have no valid safe src (e.g. <img src=x onerror=alert(1)>)
  if (tagName === 'img' && !hasValidImgSrc) {
    return '';
  }

  // Force rel="noopener noreferrer" on external links or target="_blank"
  if (tagName === 'a' && (isExternalLink || linkTargetBlank)) {
    const existingRelIdx = safeAttrs.findIndex(([k]) => k === 'rel');
    if (existingRelIdx !== -1) {
      const tokens = new Set(safeAttrs[existingRelIdx][1].split(/\s+/).filter(Boolean));
      tokens.add('noopener');
      tokens.add('noreferrer');
      safeAttrs[existingRelIdx][1] = Array.from(tokens).join(' ');
    } else {
      safeAttrs.push(['rel', 'noopener noreferrer']);
    }
  }

  if (safeAttrs.length === 0) {
    return `<${tagName}>`;
  }

  const serialized = safeAttrs
    .map(([k, v]) => `${k}="${escapeHtml(v)}"`)
    .join(' ');
  return `<${tagName} ${serialized}>`;
}

function sanitizeHtmlSinglePass(html: string): string {
  const out: string[] = [];
  let i = 0;
  const len = html.length;
  let skippingTag: string | null = null;
  let skippingDepth = 0;

  while (i < len) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      if (!skippingTag) {
        out.push(html.slice(i));
      }
      break;
    }

    if (lt > i && !skippingTag) {
      out.push(html.slice(i, lt));
    }

    // Comments: <!-- ... -->
    if (html.startsWith('<!--', lt)) {
      const endComment = html.indexOf('-->', lt + 4);
      i = endComment === -1 ? len : endComment + 3;
      continue;
    }

    // Declarations / CDATA / Processing instructions: <! ... > or <? ... >
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      const endDecl = html.indexOf('>', lt + 2);
      i = endDecl === -1 ? len : endDecl + 1;
      continue;
    }

    const gt = findTagEnd(html, lt + 1);
    if (gt === -1) {
      // Unclosed tag fragment — drop it completely when skipping or escape lone '<'
      if (!skippingTag) {
        out.push('&lt;');
        i = lt + 1;
      } else {
        i = len;
      }
      continue;
    }

    const rawInside = html.slice(lt + 1, gt);
    i = gt + 1;

    if (!rawInside) continue;

    const isClosing = rawInside.startsWith('/');
    const body = isClosing ? rawInside.slice(1) : rawInside;
    const tagNameMatch = /^([a-zA-Z][a-zA-Z0-9-]*)(?:[\s/]|$)/.exec(body);
    if (!tagNameMatch) {
      if (!skippingTag) {
        out.push('&lt;');
        i = lt + 1;
      }
      continue;
    }

    const tagName = tagNameMatch[1].toLowerCase();
    const isSelfClosing = body.trimEnd().endsWith('/');

    if (skippingTag) {
      if (tagName === skippingTag) {
        if (isClosing) {
          skippingDepth--;
          if (skippingDepth <= 0) {
            skippingTag = null;
            skippingDepth = 0;
          }
        } else if (!isSelfClosing) {
          skippingDepth++;
        }
      }
      continue;
    }

    if (STRIP_CONTENT_TAGS.has(tagName)) {
      if (!isClosing && !isSelfClosing) {
        skippingTag = tagName;
        skippingDepth = 1;
      }
      continue;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      // Strip disallowed tag wrapper, preserving inner text
      continue;
    }

    if (isClosing) {
      if (!VOID_TAGS.has(tagName)) {
        out.push(`</${tagName}>`);
      }
      continue;
    }

    const attrPart = body.slice(tagNameMatch[1].length);
    const parsedAttrs = parseTagAttributes(attrPart);
    const sanitizedTag = sanitizeAllowedTag(tagName, parsedAttrs);
    if (sanitizedTag) {
      out.push(sanitizedTag);
    }
  }

  return out.join('');
}

export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string' || !html) return '';
  // Strip null bytes and run to fixed point (max 3 passes) to prevent nested tag reconstruction
  let current = html.replace(/\u0000/g, '');
  for (let pass = 0; pass < 3; pass++) {
    const next = sanitizeHtmlSinglePass(current);
    if (next === current) return next;
    current = next;
  }
  return current;
}

// ---------------------------------------------------------------------------
// Escaping, JSON-LD, Constant-Time Compare, Slugify, ETag
// ---------------------------------------------------------------------------

export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeXml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function safeJsonLd(data: unknown): string {
  const json = JSON.stringify(data) ?? 'null';
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  const maxLen = Math.max(bufA.length, bufB.length);
  let diff = bufA.length ^ bufB.length;
  for (let i = 0; i < maxLen; i++) {
    const byteA = i < bufA.length ? bufA[i] : 0;
    const byteB = i < bufB.length ? bufB[i] : 0;
    diff |= byteA ^ byteB;
  }
  return diff === 0;
}

export function slugify(input: string, maxLen = 70): string {
  const normalized = String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (maxLen <= 0) return '';
  if (normalized.length <= maxLen) return normalized;
  return normalized.slice(0, maxLen).replace(/-+$/g, '');
}

export async function computeEtag(parts: string[]): Promise<string> {
  const serialized = parts.map((p) => `${p.length}:${p}`).join('|');
  const bytes = new TextEncoder().encode(serialized);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hashBytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < hashBytes.length; i++) {
    hex += hashBytes[i].toString(16).padStart(2, '0');
  }
  return `"${hex}"`;
}

// ---------------------------------------------------------------------------
// Bounded Edge Rate Limiting, Client IP, CSRF Origin Guard & Security Headers
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const MAX_RATE_LIMIT_KEYS = 4_000;
const rateLimitBuckets = new Map<string, RateLimitBucket>();

function evictRateLimitBucketsIfNeeded(now: number): void {
  if (rateLimitBuckets.size < MAX_RATE_LIMIT_KEYS) {
    return;
  }

  for (const [k, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(k);
    }
  }

  while (rateLimitBuckets.size >= MAX_RATE_LIMIT_KEYS) {
    const oldestKey = rateLimitBuckets.keys().next().value;
    if (oldestKey === undefined) break;
    rateLimitBuckets.delete(oldestKey);
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const safeLimit = Math.max(1, Math.floor(limit));
  const safeWindowMs = Math.max(100, Math.floor(windowMs));
  const now = Date.now();

  const existing = rateLimitBuckets.get(key);
  if (existing && existing.resetAt > now) {
    if (existing.count >= safeLimit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, safeLimit - existing.count),
      retryAfterSeconds: 0,
    };
  }

  if (existing) {
    rateLimitBuckets.delete(key);
  }

  evictRateLimitBucketsIfNeeded(now);
  rateLimitBuckets.set(key, {
    count: 1,
    resetAt: now + safeWindowMs,
  });

  return {
    allowed: true,
    remaining: Math.max(0, safeLimit - 1),
    retryAfterSeconds: 0,
  };
}

export function resetRateLimitsForTests(): void {
  rateLimitBuckets.clear();
}

export function extractClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) {
    return cfIp;
  }

  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  return '127.0.0.1';
}

export interface CsrfOriginResult {
  ok: boolean;
  reason?: string;
}

const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function verifyCsrfOrigin(req: Request): CsrfOriginResult {
  const method = (req.method || 'GET').toUpperCase();
  if (CSRF_SAFE_METHODS.has(method)) {
    return { ok: true };
  }

  const secFetchSite = req.headers.get('sec-fetch-site')?.trim().toLowerCase();
  if (secFetchSite === 'cross-site') {
    return { ok: false, reason: 'Cross-site request blocked by Sec-Fetch-Site.' };
  }

  const originHeader = req.headers.get('origin')?.trim();
  const refererHeader = req.headers.get('referer')?.trim();
  const candidate = originHeader || refererHeader;

  if (!candidate) {
    return { ok: true };
  }

  let sourceHost: string;
  const allowedTargetHosts = new Set<string>();
  try {
    sourceHost = new URL(candidate).host.toLowerCase();
  } catch {
    return { ok: false, reason: 'Origin mismatch (CSRF guard).' };
  }

  try {
    const reqHost = new URL(req.url).host.toLowerCase();
    if (reqHost) allowedTargetHosts.add(reqHost);
  } catch {
    // ignore malformed url
  }

  const hostHeader = req.headers.get('host')?.trim().toLowerCase();
  if (hostHeader) allowedTargetHosts.add(hostHeader);

  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim().toLowerCase();
  if (forwardedHost) allowedTargetHosts.add(forwardedHost);

  if (!sourceHost || allowedTargetHosts.size === 0 || !allowedTargetHosts.has(sourceHost)) {
    return { ok: false, reason: 'Origin mismatch (CSRF guard).' };
  }

  return { ok: true };
}

export interface SecurityHeadersOptions {
  allowSameOriginFrame?: boolean;
}

export function buildSecurityHeaders(opts?: SecurityHeadersOptions): Record<string, string> {
  const allowSameOrigin = Boolean(opts?.allowSameOriginFrame);
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-Frame-Options': allowSameOrigin ? 'SAMEORIGIN' : 'DENY',
    'Content-Security-Policy': allowSameOrigin
      ? "frame-ancestors 'self'; base-uri 'self'; object-src 'none'"
      : "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
}
