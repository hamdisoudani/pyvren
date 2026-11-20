import { normalizeBaseUrl, type WorkerEnv } from '../env';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterCallOptions {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenRouterResponse {
  content: string;
  usage: OpenRouterUsage;
  model: string;
}

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(5_000, Math.round(seconds * 1_000));
    }
  }
  return Math.min(5_000, 1_000 * Math.pow(2, attempt));
}

function normalizeMessageContent(rawContent: unknown): string {
  if (typeof rawContent === 'string') {
    return rawContent;
  }
  if (Array.isArray(rawContent)) {
    return rawContent
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .join('');
  }
  return '';
}

/**
 * Calls the OpenRouter Chat Completions API with transient retry handling (429/502/503/504).
 */
export async function callOpenRouter(
  env: WorkerEnv,
  opts: OpenRouterCallOptions,
): Promise<OpenRouterResponse> {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured in worker environment.');
  }

  const referer = normalizeBaseUrl(env.BASE_URL);
  const bodyPayload: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 4096,
  };
  if (opts.jsonMode) {
    bodyPayload.response_format = { type: 'json_object' };
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': referer,
          'X-Title': 'Pyvren Research',
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      if (TRANSIENT_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
        const delayMs = parseRetryDelayMs(response, attempt);
        clearTimeout(timeout);
        await sleep(delayMs);
        continue;
      }

      const rawText = await response.text();
      if (!response.ok) {
        throw new Error(
          `OpenRouter API error (${response.status}): ${rawText.slice(0, 320)}`,
        );
      }

      const data = JSON.parse(rawText) as {
        model?: string;
        choices?: Array<{
          message?: {
            content?: unknown;
          };
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
        error?: { message?: string };
      };

      if (data.error?.message) {
        throw new Error(`OpenRouter returned error: ${data.error.message}`);
      }

      const content = normalizeMessageContent(data.choices?.[0]?.message?.content).trim();
      if (!content) {
        throw new Error('OpenRouter returned an empty completion.');
      }

      const promptTokens = Number(data.usage?.prompt_tokens ?? 0) || 0;
      const completionTokens = Number(data.usage?.completion_tokens ?? 0) || 0;
      const totalTokens =
        Number(data.usage?.total_tokens ?? promptTokens + completionTokens) ||
        promptTokens + completionTokens;

      return {
        content,
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
        },
        model: data.model || opts.model,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isAbortOrNetwork =
        lastError.name === 'AbortError' ||
        lastError.message.toLowerCase().includes('network') ||
        lastError.message.toLowerCase().includes('fetch failed');
      if (isAbortOrNetwork && attempt < MAX_RETRIES) {
        await sleep(1_000 * Math.pow(2, attempt));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error('OpenRouter request failed after retries.');
}

/**
 * Repairs common LLM JSON formatting glitches inside string literals
 * (raw newlines/tabs, invalid backslash escapes like \s or \d from code blocks, trailing commas).
 */
function repairLlmJson(input: string): string {
  let out = '';
  let inString = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (inString) {
      if (ch === '\\') {
        const next = input[i + 1];
        if (next === undefined) {
          out += '\\\\';
          i++;
          continue;
        }
        // Valid JSON escapes: " \ / b f n r t uXXXX
        if (
          next === '"' ||
          next === '\\' ||
          next === '/' ||
          next === 'b' ||
          next === 'f' ||
          next === 'n' ||
          next === 'r' ||
          next === 't'
        ) {
          out += ch + next;
          i += 2;
          continue;
        }
        if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(input.slice(i + 2, i + 6))) {
          out += input.slice(i, i + 6);
          i += 6;
          continue;
        }
        // Invalid escape (e.g., \s, \d, \w, \' in Markdown code blocks) -> escape the backslash
        out += '\\\\' + next;
        i += 2;
        continue;
      }

      if (ch === '"') {
        inString = false;
        out += ch;
        i++;
        continue;
      }
      if (ch === '\n') {
        out += '\\n';
        i++;
        continue;
      }
      if (ch === '\r') {
        out += '\\r';
        i++;
        continue;
      }
      if (ch === '\t') {
        out += '\\t';
        i++;
        continue;
      }
      if (ch.charCodeAt(0) < 0x20) {
        i++;
        continue;
      }
      out += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
    }
    out += ch;
    i++;
  }

  // Strip trailing commas before } or ]
  return out.replace(/,\s*([}\]])/g, '$1');
}

/**
 * Extracts and parses a JSON object from LLM output, cleanly handling optional markdown fences
 * and common JSON string-escaping glitches in code-heavy Markdown payloads.
 */
export function extractJsonObject<T>(raw: string): T {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    throw new Error('Cannot extract JSON from empty response.');
  }

  // Strip surrounding ```json ... ``` or ``` ... ``` fences if present
  const fenceMatch = /^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```\s*$/i.exec(trimmed);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  const tryParse = (text: string): T | null => {
    try {
      return JSON.parse(text) as T;
    } catch {
      try {
        return JSON.parse(repairLlmJson(text)) as T;
      } catch {
        return null;
      }
    }
  };

  const direct = tryParse(candidate);
  if (direct !== null) {
    return direct;
  }

  // Fallback: locate the outermost balanced JSON object { ... }
  const start = candidate.indexOf('{');
  if (start === -1) {
    throw new Error(`No JSON object found in LLM output: ${candidate.slice(0, 160)}`);
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;

  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  const slice = end !== -1 ? candidate.slice(start, end + 1) : candidate.slice(start);
  const repaired = tryParse(slice);
  if (repaired !== null) {
    return repaired;
  }

  try {
    return JSON.parse(repairLlmJson(slice)) as T;
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    throw new Error(`Failed to parse extracted JSON object: ${msg}`);
  }
}
