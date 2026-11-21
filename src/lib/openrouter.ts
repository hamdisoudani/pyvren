import { normalizeBaseUrl, type WorkerEnv } from '../env';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterCallOptions {
  model?: string;
  fallbackModels?: string[];
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  freeModelsOnly?: boolean;
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

export interface OpenRouterFreeModelInfo {
  id: string;
  name: string;
  context_length: number;
  supports_json: boolean;
  supports_tools: boolean;
}

export const CURATED_FREE_MODELS: string[] = [
  'openrouter/free',
  'baidu/ernie-5.5-flash-preview:free',
  'inclusionai/ling-3.2-flash:free',
  'nvidia/nemotron-3.5-super-vl:free',
  'dots-studio/dots-3-note-preview:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
];

const CURATED_FREE_MODEL_METADATA: Record<string, OpenRouterFreeModelInfo> = {
  'openrouter/free': {
    id: 'openrouter/free',
    name: 'OpenRouter: Free Router (Auto)',
    context_length: 200_000,
    supports_json: true,
    supports_tools: true,
  },
  'baidu/ernie-5.5-flash-preview:free': {
    id: 'baidu/ernie-5.5-flash-preview:free',
    name: 'Baidu: ERNIE 5.5 Flash Preview (free)',
    context_length: 1_024_000,
    supports_json: true,
    supports_tools: true,
  },
  'inclusionai/ling-3.2-flash:free': {
    id: 'inclusionai/ling-3.2-flash:free',
    name: 'InclusionAI: Ling 3.2 Flash (free)',
    context_length: 1_048_576,
    supports_json: true,
    supports_tools: true,
  },
  'nvidia/nemotron-3.5-super-vl:free': {
    id: 'nvidia/nemotron-3.5-super-vl:free',
    name: 'NVIDIA: Nemotron 3.5 Super VL (free)',
    context_length: 1_000_000,
    supports_json: true,
    supports_tools: true,
  },
  'dots-studio/dots-3-note-preview:free': {
    id: 'dots-studio/dots-3-note-preview:free',
    name: 'Dots Studio: Dots 3 Note Preview (free)',
    context_length: 512_000,
    supports_json: true,
    supports_tools: true,
  },
  'google/gemma-4-31b-it:free': {
    id: 'google/gemma-4-31b-it:free',
    name: 'Google: Gemma 4 31B IT (free)',
    context_length: 262_144,
    supports_json: true,
    supports_tools: true,
  },
  'google/gemma-4-26b-a4b-it:free': {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Google: Gemma 4 26B A4B IT (free)',
    context_length: 262_144,
    supports_json: true,
    supports_tools: true,
  },
};

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models';
const FREE_MODELS_CACHE_TTL_MS = 15 * 60 * 1_000;
const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);
const FAILOVER_STATUSES = new Set([402, 404, 429, 502, 503, 504]);
const MAX_FAILOVER_CANDIDATES = 7;
const RATE_LIMIT_COOLDOWN_MS = 2 * 60 * 1_000;

interface FreeModelsCache {
  models: OpenRouterFreeModelInfo[];
  expiresAt: number;
}

let cachedFreeModels: FreeModelsCache | null = null;
const rateLimitedUntil = new Map<string, number>();

/**
 * Returns true ONLY if the model identifier is OpenRouter's free router or explicitly suffixed with `:free`.
 */
export function isFreeOpenRouterModel(modelId: string): boolean {
  if (typeof modelId !== 'string') return false;
  const id = modelId.trim();
  if (!id) return false;
  return id === 'openrouter/free' || id.endsWith(':free');
}

function getCuratedFallbackModels(): OpenRouterFreeModelInfo[] {
  return CURATED_FREE_MODELS.map((id) => ({
    ...(CURATED_FREE_MODEL_METADATA[id] || {
      id,
      name: id,
      context_length: 65_536,
      supports_json: true,
      supports_tools: false,
    }),
  }));
}

function sortFreeModels(models: OpenRouterFreeModelInfo[]): OpenRouterFreeModelInfo[] {
  const curatedIndex = new Map<string, number>();
  CURATED_FREE_MODELS.forEach((id, idx) => curatedIndex.set(id, idx));

  return [...models].sort((a, b) => {
    const rankA = curatedIndex.has(a.id) ? curatedIndex.get(a.id)! : Number.MAX_SAFE_INTEGER;
    const rankB = curatedIndex.has(b.id) ? curatedIndex.get(b.id)! : Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    if (a.context_length !== b.context_length) return b.context_length - a.context_length;
    return a.id.localeCompare(b.id);
  });
}

const NON_LLM_MODEL_RE =
  /(lyria|whisper|tts|audio|speech|embed|embedding|rerank|moderation|shieldgemma|llama-guard|safeguard|flux|dall-e|imagen|stable-diffusion|midjourney|ocr-only|molmo-?act)/i;
const MIN_FREE_LLM_CONTEXT = 8_192;

function isZeroCostPricing(pricing?: { prompt?: string | number; completion?: string | number }): boolean {
  if (!pricing) return true;
  const promptCost = Number(pricing.prompt);
  const completionCost = Number(pricing.completion);
  if (!Number.isFinite(promptCost) || !Number.isFinite(completionCost)) return false;
  return promptCost === 0 && completionCost === 0;
}

/**
 * Fetches live strictly-$0 ($0 prompt, $0 completion) text/chat LLMs from OpenRouter's catalog
 * (cached 15 minutes in module memory). Excludes non-LLM, image/audio/embedding/guard, and tiny models.
 */
export async function listOpenRouterFreeModels(
  env: WorkerEnv,
  forceRefresh = false,
): Promise<OpenRouterFreeModelInfo[]> {
  const now = Date.now();
  if (!forceRefresh && cachedFreeModels && now < cachedFreeModels.expiresAt) {
    return cachedFreeModels.models.map((m) => ({ ...m }));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    const apiKey = env.OPENROUTER_API_KEY?.trim();
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(OPENROUTER_MODELS_ENDPOINT, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      return getCuratedFallbackModels();
    }

    const payload = (await response.json()) as {
      data?: Array<{
        id?: string;
        name?: string;
        context_length?: number;
        pricing?: {
          prompt?: string | number;
          completion?: string | number;
        };
        supported_parameters?: string[];
        architecture?: {
          modality?: string;
          input_modalities?: string[];
          output_modalities?: string[];
        };
      }>;
    };

    const rawList = Array.isArray(payload.data) ? payload.data : [];
    const seen = new Set<string>();
    const filtered: OpenRouterFreeModelInfo[] = [];

    for (const item of rawList) {
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : id;
      if (!id || seen.has(id)) continue;

      const isRouter = id === 'openrouter/free';
      const hasZeroPricing = isZeroCostPricing(item.pricing);
      if (!isRouter) {
        if (!isFreeOpenRouterModel(id) && !hasZeroPricing) continue;
        if (!hasZeroPricing) continue;
        if (NON_LLM_MODEL_RE.test(id) || NON_LLM_MODEL_RE.test(name)) continue;
      }

      // Filter strictly to text-in / text-out LLMs
      const inputModalities = item.architecture?.input_modalities;
      if (
        !isRouter &&
        Array.isArray(inputModalities) &&
        inputModalities.length > 0 &&
        !inputModalities.some((m) => typeof m === 'string' && m.toLowerCase() === 'text')
      ) {
        continue;
      }
      const outputModalities = item.architecture?.output_modalities;
      if (
        !isRouter &&
        Array.isArray(outputModalities) &&
        outputModalities.length > 0 &&
        !outputModalities.some((m) => typeof m === 'string' && m.toLowerCase() === 'text')
      ) {
        continue;
      }
      const modality = item.architecture?.modality;
      if (
        !isRouter &&
        typeof modality === 'string' &&
        modality.includes('->') &&
        !modality.toLowerCase().includes('->text')
      ) {
        continue;
      }

      const parsedCtx = Number(item.context_length);
      const contextLength = Number.isFinite(parsedCtx) && parsedCtx > 0 ? parsedCtx : 32_768;
      if (!isRouter && contextLength < MIN_FREE_LLM_CONTEXT) {
        continue;
      }

      const supportedParams = Array.isArray(item.supported_parameters)
        ? item.supported_parameters
        : [];
      const supportsJson =
        isRouter ||
        supportedParams.includes('response_format') ||
        supportedParams.includes('structured_outputs');
      const supportsTools = isRouter || supportedParams.includes('tools');

      seen.add(id);
      filtered.push({
        id,
        name,
        context_length: contextLength,
        supports_json: supportsJson,
        supports_tools: supportsTools,
      });
    }

    if (filtered.length === 0) {
      return getCuratedFallbackModels();
    }

    const sorted = sortFreeModels(filtered);
    cachedFreeModels = {
      models: sorted,
      expiresAt: now + FREE_MODELS_CACHE_TTL_MS,
    };
    return sorted.map((m) => ({ ...m }));
  } catch {
    return getCuratedFallbackModels();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolves the ordered candidate model chain:
 *   Main Model -> Fallback Model 1 -> Fallback Model 2 -> Live/Curated Free Pool
 */
export function resolveFreeModelChain(
  requestedModel: string | undefined,
  freeModelsOnly: boolean,
  liveFreeIds?: string[],
  explicitFallbacks?: string[],
): string[] {
  const requested = typeof requestedModel === 'string' ? requestedModel.trim() : '';
  const cleanedFallbacks = Array.isArray(explicitFallbacks)
    ? explicitFallbacks
        .map((m) => (typeof m === 'string' ? m.trim() : ''))
        .filter((m) => m.length > 0 && !NON_LLM_MODEL_RE.test(m))
    : [];

  const validLiveFree = Array.isArray(liveFreeIds)
    ? liveFreeIds
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter((id) => isFreeOpenRouterModel(id) && !NON_LLM_MODEL_RE.test(id))
    : [];

  const liveSet = new Set(validLiveFree);
  const curatedLive = CURATED_FREE_MODELS.filter((id) => liveSet.has(id));
  const curatedOffline = CURATED_FREE_MODELS.filter((id) => !liveSet.has(id));
  const freePool =
    curatedLive.length > 0
      ? [...curatedLive, ...validLiveFree, ...curatedOffline]
      : [...CURATED_FREE_MODELS, ...validLiveFree];

  const ordered: string[] = [];
  const pushUnique = (id: string) => {
    if (!id || ordered.includes(id)) return;
    ordered.push(id);
  };

  if (freeModelsOnly) {
    if (requested && isFreeOpenRouterModel(requested) && !NON_LLM_MODEL_RE.test(requested)) {
      pushUnique(requested);
    }
    for (const fb of cleanedFallbacks) {
      if (isFreeOpenRouterModel(fb)) {
        pushUnique(fb);
      }
    }
    for (const id of freePool) {
      pushUnique(id);
    }
    return ordered;
  }

  if (requested) {
    pushUnique(requested);
  }
  for (const fb of cleanedFallbacks) {
    pushUnique(fb);
  }
  for (const id of CURATED_FREE_MODELS) {
    pushUnique(id);
  }
  for (const id of validLiveFree) {
    pushUnique(id);
  }
  return ordered;
}

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

function isResponseFormatRejection(rawText: string): boolean {
  const lower = rawText.toLowerCase();
  return lower.includes('response_format') || lower.includes('json_object');
}

function isNonFailoverAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('invalid api key') ||
    lower.includes('unauthorized') ||
    lower.includes('no auth credentials')
  );
}

/**
 * Calls the OpenRouter Chat Completions API with free-model-only enforcement (by default),
 * automatic failover across up to 4 candidate models on 402/404/429/502/503/504 or empty output,
 * and automatic retry without response_format if a free provider rejects json_object.
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
  const freeModelsOnly = opts.freeModelsOnly !== false;
  const cachedLiveIds =
    cachedFreeModels && Date.now() < cachedFreeModels.expiresAt
      ? cachedFreeModels.models.map((m) => m.id)
      : undefined;

  const rawCandidates = resolveFreeModelChain(
    opts.model,
    freeModelsOnly,
    cachedLiveIds,
    opts.fallbackModels,
  );
  const nowMs = Date.now();
  const healthyCandidates = rawCandidates.filter((id) => (rateLimitedUntil.get(id) ?? 0) <= nowMs);
  const cooledCandidates = rawCandidates.filter((id) => (rateLimitedUntil.get(id) ?? 0) > nowMs);
  const candidates = [...healthyCandidates, ...cooledCandidates].slice(0, MAX_FAILOVER_CANDIDATES);

  let lastError: Error | null = null;

  for (let candidateIdx = 0; candidateIdx < candidates.length; candidateIdx++) {
    const candidateModel = candidates[candidateIdx];
    const isLastCandidate = candidateIdx === candidates.length - 1;
    let useJsonMode = Boolean(opts.jsonMode);
    let retriedWithoutJsonFormat = false;
    let transientRetries = 0;
    const maxTransientRetries = isLastCandidate ? 1 : 0;

    while (true) {
      const bodyPayload: Record<string, unknown> = {
        model: candidateModel,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 4096,
      };
      if (useJsonMode) {
        bodyPayload.response_format = { type: 'json_object' };
      }

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

        const rawText = await response.text();

        if (
          response.status === 400 &&
          useJsonMode &&
          !retriedWithoutJsonFormat &&
          isResponseFormatRejection(rawText)
        ) {
          useJsonMode = false;
          retriedWithoutJsonFormat = true;
          continue;
        }

        if (response.status === 429) {
          rateLimitedUntil.set(candidateModel, Date.now() + RATE_LIMIT_COOLDOWN_MS);
        }

        if (FAILOVER_STATUSES.has(response.status)) {
          lastError = new Error(
            `OpenRouter API error (${response.status}) on ${candidateModel}: ${rawText.slice(0, 320)}`,
          );
          if (TRANSIENT_STATUSES.has(response.status) && transientRetries < maxTransientRetries) {
            const delayMs = parseRetryDelayMs(response, transientRetries);
            transientRetries++;
            clearTimeout(timeout);
            await sleep(delayMs);
            continue;
          }
          break;
        }

        if (!response.ok) {
          throw new Error(
            `OpenRouter API error (${response.status}) on ${candidateModel}: ${rawText.slice(0, 320)}`,
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
          error?: { message?: string; code?: number };
        };

        if (data.error?.message) {
          const errMessage = `OpenRouter returned error on ${candidateModel}: ${data.error.message}`;
          if (isNonFailoverAuthError(data.error.message)) {
            throw new Error(errMessage);
          }
          lastError = new Error(errMessage);
          break;
        }

        const content = normalizeMessageContent(data.choices?.[0]?.message?.content).trim();
        if (!content) {
          lastError = new Error(`OpenRouter returned an empty completion from ${candidateModel}.`);
          break;
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
          model: data.model || candidateModel,
        };
      } catch (err) {
        const caught = err instanceof Error ? err : new Error(String(err));
        const isAbortOrNetwork =
          caught.name === 'AbortError' ||
          caught.message.toLowerCase().includes('network') ||
          caught.message.toLowerCase().includes('fetch failed');
        if (isAbortOrNetwork) {
          lastError = caught;
          if (!isLastCandidate) {
            break;
          }
          if (transientRetries < maxTransientRetries) {
            transientRetries++;
            await sleep(1_000 * Math.pow(2, transientRetries - 1));
            continue;
          }
          throw lastError;
        }
        throw caught;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  throw lastError || new Error('OpenRouter request failed across all candidate models.');
}

/**
 * Repairs common LLM JSON formatting glitches inside string literals
 * (raw newlines/tabs, invalid backslash escapes like \s or \d from code blocks, trailing commas).
 */
export function repairLlmJson(input: string): string {
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
