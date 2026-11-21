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

export type LlmProviderName = 'openrouter' | 'nvidia_nim';

export interface OpenRouterFreeModelInfo {
  id: string;
  name: string;
  context_length: number;
  supports_json: boolean;
  supports_tools: boolean;
  provider?: LlmProviderName;
  latency_ms?: number;
}

export interface ModelProbeResult {
  id: string;
  provider: LlmProviderName;
  family: string;
  ok: boolean;
  latency_ms: number;
  json_ok: boolean;
  status_code?: number;
  error?: string;
  checked_at: string;
}

export const CURATED_FREE_MODELS: string[] = [
  'baidu/ernie-5.5-flash-preview:free',
  'nvidia/nemotron-3.5-super-vl:free',
  'google/gemma-4-31b-it:free',
  'particle-ai/particle-1:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'inclusionai/ling-3.2-flash:free',
  'nvidia/nemotron-3.5-lightning:free',
  'recursive/flint-v1.0:free',
  'google/gemma-4-26b-a4b-it:free',
];

export const CURATED_NIM_MODELS: string[] = [
  'nim/nvidia/nemotron-3.5-super-vl-120b-a12b',
  'nim/nvidia/nemotron-3.5-lightning-30b-a3b',
  'nim/nvidia/nemotron-3-ultra-550b-a55b',
  'nim/google/gemma-4-31b-it',
  'nim/z-ai/glm-5.3-flash',
  'nim/mistralai/mistral-large-4-1t-a52b',
  'nim/moonshotai/kimi-k3.1-pro',
  'nim/minimaxai/minimax-m3.1-flash',
];

const CURATED_FREE_MODEL_METADATA: Record<string, OpenRouterFreeModelInfo> = {
  'baidu/ernie-5.5-flash-preview:free': {
    id: 'baidu/ernie-5.5-flash-preview:free',
    name: 'Baidu: ERNIE 5.5 Flash Preview (free)',
    context_length: 1_024_000,
    supports_json: true,
    supports_tools: true,
    provider: 'openrouter',
  },
  'nvidia/nemotron-3.5-super-vl:free': {
    id: 'nvidia/nemotron-3.5-super-vl:free',
    name: 'NVIDIA: Nemotron 3.5 Super VL (free)',
    context_length: 1_000_000,
    supports_json: true,
    supports_tools: true,
    provider: 'openrouter',
  },
  'google/gemma-4-31b-it:free': {
    id: 'google/gemma-4-31b-it:free',
    name: 'Google: Gemma 4 31B IT (free)',
    context_length: 262_144,
    supports_json: true,
    supports_tools: true,
    provider: 'openrouter',
  },
  'particle-ai/particle-1:free': {
    id: 'particle-ai/particle-1:free',
    name: 'Particle AI: Particle-1 (free)',
    context_length: 1_048_576,
    supports_json: true,
    supports_tools: true,
    provider: 'openrouter',
  },
  'nvidia/nemotron-3-ultra-550b-a55b:free': {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    name: 'NVIDIA: Nemotron 3 Ultra (free)',
    context_length: 1_000_000,
    supports_json: true,
    supports_tools: true,
    provider: 'openrouter',
  },
  'inclusionai/ling-3.2-flash:free': {
    id: 'inclusionai/ling-3.2-flash:free',
    name: 'InclusionAI: Ling 3.2 Flash (free)',
    context_length: 1_048_576,
    supports_json: true,
    supports_tools: true,
    provider: 'openrouter',
  },
  'nvidia/nemotron-3.5-lightning:free': {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'NVIDIA: Nemotron 3.5 Lightning (free)',
    context_length: 1_000_000,
    supports_json: true,
    supports_tools: true,
    provider: 'openrouter',
  },
  'recursive/flint-v1.0:free': {
    id: 'recursive/flint-v1.0:free',
    name: 'Recursive: Flint v1.0 (free)',
    context_length: 262_144,
    supports_json: true,
    supports_tools: true,
    provider: 'openrouter',
  },
  'google/gemma-4-26b-a4b-it:free': {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Google: Gemma 4 26B A4B IT (free)',
    context_length: 262_144,
    supports_json: true,
    supports_tools: true,
    provider: 'openrouter',
  },
  'nim/nvidia/nemotron-3.5-super-vl-120b-a12b': {
    id: 'nim/nvidia/nemotron-3.5-super-vl-120b-a12b',
    name: 'NIM · NVIDIA Nemotron 3.5 Super VL 120B',
    context_length: 1_000_000,
    supports_json: true,
    supports_tools: true,
    provider: 'nvidia_nim',
  },
  'nim/nvidia/nemotron-3.5-lightning-30b-a3b': {
    id: 'nim/nvidia/nemotron-3.5-lightning-30b-a3b',
    name: 'NIM · NVIDIA Nemotron 3.5 Lightning 30B',
    context_length: 1_000_000,
    supports_json: true,
    supports_tools: true,
    provider: 'nvidia_nim',
  },
  'nim/nvidia/nemotron-3-ultra-550b-a55b': {
    id: 'nim/nvidia/nemotron-3-ultra-550b-a55b',
    name: 'NIM · NVIDIA Nemotron 3 Ultra 550B',
    context_length: 1_000_000,
    supports_json: true,
    supports_tools: true,
    provider: 'nvidia_nim',
  },
  'nim/google/gemma-4-31b-it': {
    id: 'nim/google/gemma-4-31b-it',
    name: 'NIM · Google Gemma 4 31B IT',
    context_length: 262_144,
    supports_json: true,
    supports_tools: true,
    provider: 'nvidia_nim',
  },
  'nim/z-ai/glm-5.3-flash': {
    id: 'nim/z-ai/glm-5.3-flash',
    name: 'NIM · Z-AI GLM 5.3 Flash',
    context_length: 200_000,
    supports_json: true,
    supports_tools: true,
    provider: 'nvidia_nim',
  },
  'nim/mistralai/mistral-large-4-1t-a52b': {
    id: 'nim/mistralai/mistral-large-4-1t-a52b',
    name: 'NIM · Mistral Large 4 (1T-A52B)',
    context_length: 262_144,
    supports_json: true,
    supports_tools: true,
    provider: 'nvidia_nim',
  },
  'nim/moonshotai/kimi-k3.1-pro': {
    id: 'nim/moonshotai/kimi-k3.1-pro',
    name: 'NIM · Moonshot Kimi K3.1 Pro',
    context_length: 262_144,
    supports_json: true,
    supports_tools: true,
    provider: 'nvidia_nim',
  },
  'nim/minimaxai/minimax-m3.1-flash': {
    id: 'nim/minimaxai/minimax-m3.1-flash',
    name: 'NIM · MiniMax M3.1 Flash',
    context_length: 200_000,
    supports_json: true,
    supports_tools: true,
    provider: 'nvidia_nim',
  },
};

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models';
const NVIDIA_NIM_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_NIM_MODELS_ENDPOINT = 'https://integrate.api.nvidia.com/v1/models';
const FREE_MODELS_CACHE_TTL_MS = 15 * 60 * 1_000;
const PROBE_CACHE_TTL_MS = 15 * 60 * 1_000;
const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);
const FAILOVER_STATUSES = new Set([402, 404, 429, 502, 503, 504]);
const MAX_FAILOVER_CANDIDATES = 8;
const RATE_LIMIT_COOLDOWN_MS = 2 * 60 * 1_000;

interface FreeModelsCache {
  models: OpenRouterFreeModelInfo[];
  expiresAt: number;
}

interface ProbeCache {
  results: ModelProbeResult[];
  expiresAt: number;
}

let cachedFreeModels: FreeModelsCache | null = null;
let cachedNimModels: FreeModelsCache | null = null;
let cachedProbeResults: ProbeCache | null = null;
let openRouterDailyExhaustedUntil = 0;
const rateLimitedUntil = new Map<string, number>();

export function isNimModel(modelId: string): boolean {
  return typeof modelId === 'string' && modelId.trim().toLowerCase().startsWith('nim/');
}

export function stripNimPrefix(modelId: string): string {
  const trimmed = (modelId || '').trim();
  return isNimModel(trimmed) ? trimmed.slice(4) : trimmed;
}

/**
 * Returns true ONLY if the model identifier is a verified zero-cost model:
 * - OpenRouter `:free` model (or legacy `openrouter/free`)
 * - NVIDIA NIM hosted model prefixed with `nim/`
 */
export function isFreeOpenRouterModel(modelId: string): boolean {
  if (typeof modelId !== 'string') return false;
  const id = modelId.trim();
  if (!id) return false;
  return id === 'openrouter/free' || id.endsWith(':free') || (isNimModel(id) && id.length > 5);
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

      // Exclude opaque auto-routers (openrouter/free, openrouter/auto) — always route to concrete $0 LLMs
      if (id === 'openrouter/free' || id === 'openrouter/auto') continue;

      const hasZeroPricing = isZeroCostPricing(item.pricing);
      if (!isFreeOpenRouterModel(id) && !hasZeroPricing) continue;
      if (!hasZeroPricing) continue;
      if (NON_LLM_MODEL_RE.test(id) || NON_LLM_MODEL_RE.test(name)) continue;

      // Filter strictly to text-in / text-out LLMs
      const inputModalities = item.architecture?.input_modalities;
      if (
        Array.isArray(inputModalities) &&
        inputModalities.length > 0 &&
        !inputModalities.some((m) => typeof m === 'string' && m.toLowerCase() === 'text')
      ) {
        continue;
      }
      const outputModalities = item.architecture?.output_modalities;
      if (
        Array.isArray(outputModalities) &&
        outputModalities.length > 0 &&
        !outputModalities.some((m) => typeof m === 'string' && m.toLowerCase() === 'text')
      ) {
        continue;
      }
      const modality = item.architecture?.modality;
      if (
        typeof modality === 'string' &&
        modality.includes('->') &&
        !modality.toLowerCase().includes('->text')
      ) {
        continue;
      }

      const parsedCtx = Number(item.context_length);
      const contextLength = Number.isFinite(parsedCtx) && parsedCtx > 0 ? parsedCtx : 32_768;
      if (contextLength < MIN_FREE_LLM_CONTEXT) {
        continue;
      }

      const supportedParams = Array.isArray(item.supported_parameters)
        ? item.supported_parameters
        : [];
      const supportsJson =
        supportedParams.includes('response_format') ||
        supportedParams.includes('structured_outputs');
      const supportsTools = supportedParams.includes('tools');

      seen.add(id);
      filtered.push({
        id,
        name,
        context_length: contextLength,
        supports_json: supportsJson,
        supports_tools: supportsTools,
        provider: 'openrouter',
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

const NIM_NON_LLM_RE =
  /(embed|rerank|guard|safety|topic-control|cosmos|riva|translate|pii|detector|nvclip|calibration|starcoder2|parse|ocr|vision-embed|vlm-embed|trellis|whisper|parakeet|audio|speech|4b-it$)/i;

/**
 * Fetches live text/chat LLMs hosted on NVIDIA NIM (`https://integrate.api.nvidia.com/v1/models`)
 * prefixed with `nim/` (cached 15 minutes). Returns curated NIM models if the catalog call fails.
 */
export async function listNvidiaNimModels(
  env: WorkerEnv,
  forceRefresh = false,
): Promise<OpenRouterFreeModelInfo[]> {
  const apiKey = env.NVIDIA_NIM_API_KEY?.trim();
  if (!apiKey) return [];

  const now = Date.now();
  if (!forceRefresh && cachedNimModels && now < cachedNimModels.expiresAt) {
    return cachedNimModels.models.map((m) => ({ ...m }));
  }

  const curatedNimFallback = (): OpenRouterFreeModelInfo[] =>
    CURATED_NIM_MODELS.map(
      (id) =>
        CURATED_FREE_MODEL_METADATA[id] || {
          id,
          name: `NIM · ${stripNimPrefix(id)}`,
          context_length: 262_144,
          supports_json: true,
          supports_tools: true,
          provider: 'nvidia_nim' as const,
        },
    );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(NVIDIA_NIM_MODELS_ENDPOINT, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return curatedNimFallback();
    }
    const payload = (await response.json()) as {
      data?: Array<{ id?: string; owned_by?: string }>;
    };
    const rawList = Array.isArray(payload.data) ? payload.data : [];
    const seen = new Set<string>();
    const models: OpenRouterFreeModelInfo[] = [];

    for (const item of rawList) {
      const rawId = typeof item.id === 'string' ? item.id.trim() : '';
      if (!rawId || !rawId.includes('/')) continue;
      if (NIM_NON_LLM_RE.test(rawId) || NON_LLM_MODEL_RE.test(rawId)) continue;
      const prefixed = `nim/${rawId}`;
      if (seen.has(prefixed)) continue;
      seen.add(prefixed);

      const meta = CURATED_FREE_MODEL_METADATA[prefixed];
      models.push(
        meta
          ? { ...meta }
          : {
              id: prefixed,
              name: `NIM · ${rawId}`,
              context_length: 262_144,
              supports_json: true,
              supports_tools: true,
              provider: 'nvidia_nim',
            },
      );
    }

    if (models.length === 0) {
      return curatedNimFallback();
    }

    const curatedIndex = new Map<string, number>();
    CURATED_NIM_MODELS.forEach((id, idx) => curatedIndex.set(id, idx));
    models.sort((a, b) => {
      const ra = curatedIndex.has(a.id) ? curatedIndex.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const rb = curatedIndex.has(b.id) ? curatedIndex.get(b.id)! : Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return a.id.localeCompare(b.id);
    });

    cachedNimModels = {
      models,
      expiresAt: now + FREE_MODELS_CACHE_TTL_MS,
    };
    return models.map((m) => ({ ...m }));
  } catch {
    return curatedNimFallback();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Returns combined verified zero-cost text LLMs across BOTH configured providers
 * (NVIDIA NIM `nim/*` + OpenRouter `:free`), annotated with cached live probe latency when available.
 */
export async function listAllProviderFreeModels(
  env: WorkerEnv,
  forceRefresh = false,
): Promise<OpenRouterFreeModelInfo[]> {
  const [nimModels, openRouterModels] = await Promise.all([
    listNvidiaNimModels(env, forceRefresh),
    listOpenRouterFreeModels(env, forceRefresh),
  ]);

  const probeLatencyMap = new Map<string, number>();
  if (cachedProbeResults && Date.now() < cachedProbeResults.expiresAt) {
    for (const r of cachedProbeResults.results) {
      if (r.ok && r.json_ok) {
        probeLatencyMap.set(r.id, r.latency_ms);
      }
    }
  }

  const combined = [...nimModels, ...openRouterModels].map((m) => ({
    ...m,
    ...(probeLatencyMap.has(m.id) ? { latency_ms: probeLatencyMap.get(m.id) } : {}),
  }));

  // If we have live probe latencies, bubble verified fast healthy models to the top
  if (probeLatencyMap.size > 0) {
    combined.sort((a, b) => {
      const la = probeLatencyMap.get(a.id);
      const lb = probeLatencyMap.get(b.id);
      if (la !== undefined && lb !== undefined) return la - lb;
      if (la !== undefined) return -1;
      if (lb !== undefined) return 1;
      return 0;
    });
  }
  return combined;
}

export function getCachedProbeResults(): ModelProbeResult[] {
  if (cachedProbeResults && Date.now() < cachedProbeResults.expiresAt) {
    return cachedProbeResults.results.map((r) => ({ ...r }));
  }
  return [];
}

export function getFastestHealthyModelsFromCache(): string[] {
  const results = getCachedProbeResults();
  return results
    .filter((r) => r.ok && r.json_ok)
    .sort((a, b) => a.latency_ms - b.latency_ms)
    .map((r) => r.id);
}

export function resetProviderCachesForTests(): void {
  cachedFreeModels = null;
  cachedNimModels = null;
  cachedProbeResults = null;
  openRouterDailyExhaustedUntil = 0;
  rateLimitedUntil.clear();
}

/**
 * Probes a pool of candidate models across NVIDIA NIM and OpenRouter in parallel with a tight timeout,
 * verifies real HTTP 200 + valid JSON compliance, records response latency, cools down broken/slow models,
 * and caches the ranked fastest working models for 15 minutes so the agent automatically prefers them.
 */
export async function probeWorkingModelPool(
  env: WorkerEnv,
  candidateIds?: string[],
  opts?: { forceRefresh?: boolean; timeoutMs?: number },
): Promise<ModelProbeResult[]> {
  const now = Date.now();
  if (!opts?.forceRefresh && cachedProbeResults && now < cachedProbeResults.expiresAt) {
    return cachedProbeResults.results.map((r) => ({ ...r }));
  }

  const nimKey = env.NVIDIA_NIM_API_KEY?.trim() || '';
  const orKey = env.OPENROUTER_API_KEY?.trim() || '';

  const defaultPool: string[] = [];
  if (nimKey) {
    defaultPool.push(
      'nim/nvidia/nemotron-3.5-super-vl-120b-a12b',
      'nim/nvidia/nemotron-3.5-lightning-30b-a3b',
      'nim/nvidia/nemotron-3-ultra-550b-a55b',
    );
  }
  if (orKey && (opts?.forceRefresh || openRouterDailyExhaustedUntil <= now)) {
    defaultPool.push(
      'baidu/ernie-5.5-flash-preview:free',
      'nvidia/nemotron-3.5-super-vl:free',
      'google/gemma-4-31b-it:free',
    );
  }

  const pool = Array.from(
    new Set(
      (candidateIds && candidateIds.length > 0 ? [...candidateIds, ...defaultPool] : defaultPool)
        .map((id) => id.trim())
        .filter((id) => {
          if (!id || id === 'openrouter/free' || id === 'openrouter/auto') return false;
          if (isNimModel(id)) return Boolean(nimKey);
          return Boolean(orKey);
        }),
    ),
  ).slice(0, 6);

  const timeoutMs = Math.max(2_000, Math.min(15_000, opts?.timeoutMs ?? 8_000));
  const referer = normalizeBaseUrl(env.BASE_URL);
  const checkedAt = new Date().toISOString();

  const results = await Promise.all(
    pool.map(async (id): Promise<ModelProbeResult> => {
      const nim = isNimModel(id);
      const provider: LlmProviderName = nim ? 'nvidia_nim' : 'openrouter';
      const family = getOpenRouterModelFamily(id);
      const t0 = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);

      try {
        const endpoint = nim ? NVIDIA_NIM_ENDPOINT : OPENROUTER_ENDPOINT;
        const headers: Record<string, string> = {
          Authorization: `Bearer ${nim ? nimKey : orKey}`,
          'Content-Type': 'application/json',
        };
        if (!nim) {
          headers['HTTP-Referer'] = referer;
          headers['X-Title'] = 'Pyvren';
        }
        const payload: Record<string, unknown> = {
          model: nim ? stripNimPrefix(id) : id,
          messages: [{ role: 'user', content: 'Return ONLY valid JSON: {"ok":true}' }],
          max_tokens: 128,
          temperature: 0,
        };
        if (nim) {
          payload.chat_template_kwargs = { enable_thinking: false };
        } else {
          payload.reasoning = { enabled: false };
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        const latencyMs = Math.max(1, Date.now() - t0);
        const rawText = await response.text();

        if (!response.ok) {
          if (response.status === 429) {
            const lower = rawText.toLowerCase();
            if (!nim && (lower.includes('free-models-per-day') || lower.includes('free_daily_limit'))) {
              openRouterDailyExhaustedUntil = Date.now() + 15 * 60_000;
            }
            rateLimitedUntil.set(id, Date.now() + RATE_LIMIT_COOLDOWN_MS);
          } else {
            rateLimitedUntil.set(id, Date.now() + RATE_LIMIT_COOLDOWN_MS);
          }
          return {
            id,
            provider,
            family,
            ok: false,
            latency_ms: latencyMs,
            json_ok: false,
            status_code: response.status,
            error: `HTTP ${response.status}: ${rawText.slice(0, 140)}`,
            checked_at: checkedAt,
          };
        }

        const parsed = JSON.parse(rawText) as {
          choices?: Array<{ message?: { content?: unknown } }>;
        };
        const content = normalizeMessageContent(parsed.choices?.[0]?.message?.content).trim();
        let jsonOk = false;
        try {
          const obj = extractJsonObject<{ ok?: boolean }>(content);
          jsonOk = obj?.ok === true;
        } catch {
          jsonOk = false;
        }

        if (!jsonOk) {
          rateLimitedUntil.set(id, Date.now() + RATE_LIMIT_COOLDOWN_MS);
        } else {
          rateLimitedUntil.delete(id);
          if (!nim) {
            openRouterDailyExhaustedUntil = 0;
          }
        }

        return {
          id,
          provider,
          family,
          ok: jsonOk,
          latency_ms: latencyMs,
          json_ok: jsonOk,
          status_code: response.status,
          ...(jsonOk ? {} : { error: 'Non-JSON or empty response' }),
          checked_at: checkedAt,
        };
      } catch (err) {
        const latencyMs = Math.max(1, Date.now() - t0);
        rateLimitedUntil.set(id, Date.now() + RATE_LIMIT_COOLDOWN_MS);
        return {
          id,
          provider,
          family,
          ok: false,
          latency_ms: latencyMs,
          json_ok: false,
          error: err instanceof Error ? err.message : String(err),
          checked_at: checkedAt,
        };
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  results.sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    if (a.json_ok !== b.json_ok) return a.json_ok ? -1 : 1;
    return a.latency_ms - b.latency_ms;
  });

  cachedProbeResults = {
    results,
    expiresAt: Date.now() + PROBE_CACHE_TTL_MS,
  };
  return results.map((r) => ({ ...r }));
}

/**
 * Picks up to 3 fastest working models from a live probe run.
 * Orders strictly by verified working status + lowest latency, preferring distinct providers/families
 * when multiple working families are available.
 */
export function selectRecommendedTop3FromProbe(results: ModelProbeResult[]): {
  main: string | null;
  fallback_1: string | null;
  fallback_2: string | null;
  working_count: number;
} {
  const working = results
    .filter((r) => r.ok && r.json_ok)
    .sort((a, b) => a.latency_ms - b.latency_ms);

  if (working.length === 0) {
    return { main: null, fallback_1: null, fallback_2: null, working_count: 0 };
  }

  const picked: ModelProbeResult[] = [working[0]];
  // Prefer a distinct family for fallback_1 if a working one exists within reasonable latency
  const secondDistinct = working.find(
    (r) => r.id !== picked[0].id && r.family !== picked[0].family,
  );
  if (secondDistinct) {
    picked.push(secondDistinct);
  }
  for (const r of working) {
    if (picked.length >= 3) break;
    if (!picked.some((p) => p.id === r.id)) {
      picked.push(r);
    }
  }

  return {
    main: picked[0]?.id ?? null,
    fallback_1: picked[1]?.id ?? null,
    fallback_2: picked[2]?.id ?? null,
    working_count: working.length,
  };
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

/**
 * Normalizes a model ID (OpenRouter or `nim/` NVIDIA NIM) into its underlying model family
 * (e.g. `google/gemma-4-31b-it:free` -> `google`, `nim/nvidia/nemotron-3.5-super-vl-120b-a12b` -> `nvidia`).
 */
export function getOpenRouterModelFamily(modelId: string | undefined): string {
  const raw = stripNimPrefix(modelId || '').toLowerCase();
  if (!raw || raw === 'openrouter/free' || raw === 'openrouter/auto') {
    return 'router';
  }
  const slashIdx = raw.indexOf('/');
  const prefix = slashIdx > 0 ? raw.slice(0, slashIdx) : raw;
  const slug = slashIdx > 0 ? raw.slice(slashIdx + 1) : raw;

  if (prefix.includes('google') || slug.includes('gemma') || slug.includes('gemini')) return 'google';
  if (prefix.includes('meta') || slug.includes('llama')) return 'meta-llama';
  if (prefix.includes('deepseek') || slug.includes('deepseek')) return 'deepseek';
  if (prefix.includes('qwen') || slug.includes('qwen')) return 'qwen';
  if (prefix.includes('nvidia') || slug.includes('nemotron')) return 'nvidia';
  if (prefix.includes('baidu') || slug.includes('ernie')) return 'baidu';
  if (prefix.includes('mistral') || slug.includes('mistral') || slug.includes('ministral')) return 'mistral';
  if (prefix.includes('openai') || slug.includes('gpt-oss') || slug.includes('gpt-')) return 'openai';
  if (prefix.includes('anthropic') || slug.includes('claude')) return 'anthropic';
  if (prefix.includes('z-ai') || slug.includes('glm-')) return 'z-ai';
  if (prefix.includes('moonshot') || slug.includes('kimi')) return 'moonshot';
  if (prefix.includes('nous') || slug.includes('hermes')) return 'nous';
  if (prefix.includes('minimax') || slug.includes('minimax')) return 'minimax';
  return prefix || 'unknown';
}

export interface DistinctCriticPair {
  writerFamily: string;
  criticA: string;
  criticAFamily: string;
  criticAFallbacks: string[];
  criticB: string;
  criticBFamily: string;
  criticBFallbacks: string[];
  crossFamily: boolean;
}

/**
 * Selects TWO distinct $0 LLM families (across OpenRouter + NVIDIA NIM when configured)
 * for cross-family editorial review:
 * - Critic A (Editorial craft, Pyvren tone, reference images & tables) — different family from writer when possible
 * - Critic B (SEO, GEO/AEO & AdSense compliance) — strictly different family from Critic A (and writer when possible)
 */
export function pickDistinctFreeCriticPair(opts: {
  writerModel?: string;
  preferredJudgeModel?: string;
  fallbackModels?: string[];
  liveFreeIds?: string[];
  fastestHealthyIds?: string[];
  nimAvailable?: boolean;
  freeModelsOnly?: boolean;
}): DistinctCriticPair {
  const freeModelsOnly = opts.freeModelsOnly !== false;
  const writerFamily = getOpenRouterModelFamily(opts.writerModel);
  const fastestHealthy = Array.isArray(opts.fastestHealthyIds)
    ? opts.fastestHealthyIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
    : [];
  const mergedLive = Array.from(
    new Set([
      ...fastestHealthy,
      ...(Array.isArray(opts.liveFreeIds) ? opts.liveFreeIds : []),
      ...(opts.nimAvailable ? CURATED_NIM_MODELS : []),
    ]),
  );

  // Build deduplicated pool of concrete models (skip generic router 'openrouter/free' when choosing explicit families)
  const rawPool = resolveFreeModelChain(
    opts.preferredJudgeModel,
    freeModelsOnly,
    mergedLive,
    opts.fallbackModels,
  );
  const concretePool = rawPool.filter((id) => {
    if (id === 'openrouter/free' || id === 'openrouter/auto' || NON_LLM_MODEL_RE.test(id)) {
      return false;
    }
    if (opts.nimAvailable === false && isNimModel(id)) {
      return false;
    }
    return true;
  });

  // Ensure fastest probed healthy models are front-loaded ahead of generic defaults
  for (let i = fastestHealthy.length - 1; i >= 0; i--) {
    const fastId = fastestHealthy[i];
    if (opts.nimAvailable === false && isNimModel(fastId)) continue;
    const existingIdx = concretePool.indexOf(fastId);
    if (existingIdx > 1) {
      concretePool.splice(existingIdx, 1);
      concretePool.splice(1, 0, fastId);
    } else if (existingIdx === -1 && (!freeModelsOnly || isFreeOpenRouterModel(fastId))) {
      concretePool.unshift(fastId);
    }
  }

  // Also ensure curated multi-family free models are always represented as backup
  const curatedBackup = opts.nimAvailable
    ? [...CURATED_NIM_MODELS, ...CURATED_FREE_MODELS]
    : CURATED_FREE_MODELS;
  for (const id of curatedBackup) {
    if (id !== 'openrouter/free' && !concretePool.includes(id)) {
      concretePool.push(id);
    }
  }

  // Pick Critic A: prefer concrete model from a DIFFERENT family than writer (or preferredJudgeModel if concrete & different)
  const preferredClean = (opts.preferredJudgeModel || '').trim();
  const preferredIsConcrete =
    preferredClean.length > 0 &&
    preferredClean !== 'openrouter/free' &&
    preferredClean !== 'openrouter/auto' &&
    !(opts.nimAvailable === false && isNimModel(preferredClean)) &&
    (!freeModelsOnly || isFreeOpenRouterModel(preferredClean));

  let criticA = '';
  if (preferredIsConcrete && getOpenRouterModelFamily(preferredClean) !== writerFamily) {
    criticA = preferredClean;
  } else {
    criticA =
      concretePool.find((id) => getOpenRouterModelFamily(id) !== writerFamily) ||
      (preferredIsConcrete ? preferredClean : concretePool[0]) ||
      'google/gemma-4-31b-it:free';
  }
  const criticAFamily = getOpenRouterModelFamily(criticA);

  // Pick Critic B: MUST be a DIFFERENT family than Critic A (and ideally also different from writer)
  const criticB =
    concretePool.find((id) => {
      const fam = getOpenRouterModelFamily(id);
      return fam !== criticAFamily && fam !== writerFamily;
    }) ||
    concretePool.find((id) => getOpenRouterModelFamily(id) !== criticAFamily) ||
    concretePool.find((id) => id !== criticA) ||
    'nvidia/nemotron-3.5-super-vl:free';
  const criticBFamily = getOpenRouterModelFamily(criticB);

  // Family-diverse fallback lists for each critic (keeping Critic A and Critic B on distinct concrete tracks)
  const criticAFallbacks = concretePool
    .filter((id) => id !== criticA && id !== criticB && getOpenRouterModelFamily(id) !== criticBFamily)
    .slice(0, 4);
  const criticBFallbacks = concretePool
    .filter((id) => id !== criticB && id !== criticA && getOpenRouterModelFamily(id) !== criticAFamily)
    .slice(0, 4);

  return {
    writerFamily,
    criticA,
    criticAFamily,
    criticAFallbacks,
    criticB,
    criticBFamily,
    criticBFallbacks,
    crossFamily: criticAFamily !== criticBFamily && criticAFamily !== 'router' && criticBFamily !== 'router',
  };
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
 * Multi-provider zero-cost LLM router supporting BOTH NVIDIA NIM (`nim/*`) and OpenRouter (`:free`),
 * with live fastest-working-pool preference, automatic failover across providers (including instant
 * OpenRouter `free-models-per-day` -> NVIDIA NIM failover), reasoning-token suppression, and JSON fallback.
 */
export async function callOpenRouter(
  env: WorkerEnv,
  opts: OpenRouterCallOptions,
): Promise<OpenRouterResponse> {
  const orKey = env.OPENROUTER_API_KEY?.trim() || '';
  const nimKey = env.NVIDIA_NIM_API_KEY?.trim() || '';
  if (!orKey && !nimKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured (and no NVIDIA_NIM_API_KEY is set) in worker environment.',
    );
  }

  const referer = normalizeBaseUrl(env.BASE_URL);
  const freeModelsOnly = opts.freeModelsOnly !== false;
  const nowMs = Date.now();
  const fastestHealthy = getFastestHealthyModelsFromCache();
  const cachedOrIds =
    cachedFreeModels && nowMs < cachedFreeModels.expiresAt
      ? cachedFreeModels.models.map((m) => m.id)
      : [];
  const cachedNimIds =
    nimKey && cachedNimModels && nowMs < cachedNimModels.expiresAt
      ? cachedNimModels.models.map((m) => m.id)
      : [];
  const mergedLiveIds = Array.from(
    new Set([
      ...fastestHealthy,
      ...cachedNimIds,
      ...cachedOrIds,
      ...(nimKey ? CURATED_NIM_MODELS : []),
    ]),
  );

  const rawCandidates = resolveFreeModelChain(
    opts.model,
    freeModelsOnly,
    mergedLiveIds,
    opts.fallbackModels,
  ).filter((id) => (isNimModel(id) ? Boolean(nimKey) : Boolean(orKey)));

  // Guarantee configured NIM models are always present in candidate chain if NIM key is configured
  if (nimKey) {
    for (const nimId of CURATED_NIM_MODELS) {
      if (!rawCandidates.includes(nimId)) {
        rawCandidates.push(nimId);
      }
    }
  }

  if (rawCandidates.length === 0) {
    throw new Error('No runnable candidate models available for configured LLM providers.');
  }

  const orDailyExhausted = openRouterDailyExhaustedUntil > nowMs;
  const hasAnyNimCandidate = rawCandidates.some((id) => isNimModel(id));

  const explicitSet = new Set(
    [opts.model, ...(opts.fallbackModels || [])]
      .map((m) => (typeof m === 'string' ? m.trim() : ''))
      .filter(Boolean),
  );
  const fastestSet = new Set(fastestHealthy);

  const isHealthyNow = (id: string): boolean => {
    if ((rateLimitedUntil.get(id) ?? 0) > nowMs) return false;
    if (!isNimModel(id) && orDailyExhausted && hasAnyNimCandidate) return false;
    return true;
  };

  // Priority order:
  // 1. Explicit healthy user-configured models (Main -> Fallback 1 -> Fallback 2)
  // 2. Live-probed fastest healthy models (sorted by measured response latency)
  // 3. Remaining healthy models across configured providers
  // 4. Cooled-down models (only if everything else fails)
  const tier1ExplicitHealthy = rawCandidates.filter((id) => explicitSet.has(id) && isHealthyNow(id));
  const tier2FastestHealthy = fastestHealthy.filter(
    (id) => rawCandidates.includes(id) && !explicitSet.has(id) && isHealthyNow(id),
  );
  const tier3OtherHealthy = rawCandidates.filter(
    (id) => !explicitSet.has(id) && !fastestSet.has(id) && isHealthyNow(id),
  );
  const tier4Cooled = rawCandidates.filter((id) => !isHealthyNow(id));

  const candidates = Array.from(
    new Set([
      ...tier1ExplicitHealthy,
      ...tier2FastestHealthy,
      ...tier3OtherHealthy,
      ...tier4Cooled,
    ]),
  ).slice(0, MAX_FAILOVER_CANDIDATES);

  let lastError: Error | null = null;

  for (let candidateIdx = 0; candidateIdx < candidates.length; candidateIdx++) {
    const candidateModel = candidates[candidateIdx];
    const nim = isNimModel(candidateModel);
    const remainingHasNim = candidates.slice(candidateIdx + 1).some((c) => isNimModel(c));

    // Skip OpenRouter immediately if we already know today's 50/day free quota is exhausted AND NIM fallback exists
    if (!nim && openRouterDailyExhaustedUntil > Date.now() && remainingHasNim) {
      continue;
    }

    const isLastCandidate = candidateIdx === candidates.length - 1;
    let useJsonMode = Boolean(opts.jsonMode);
    let reasoningMode: 'disabled' | 'low' | 'none' = 'disabled';
    let nimDisableThinking = true;
    let retriedWithoutJsonFormat = false;
    let transientRetries = 0;
    const maxTransientRetries = isLastCandidate ? 1 : 0;
    const providerLabel = nim ? 'NVIDIA NIM' : 'OpenRouter';

    while (true) {
      const bodyPayload: Record<string, unknown> = {
        model: nim ? stripNimPrefix(candidateModel) : candidateModel,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 4096,
      };
      if (useJsonMode) {
        bodyPayload.response_format = { type: 'json_object' };
      }
      if (nim) {
        if (nimDisableThinking) {
          bodyPayload.chat_template_kwargs = { enable_thinking: false };
        }
      } else {
        if (reasoningMode === 'disabled') {
          bodyPayload.reasoning = { enabled: false };
        } else if (reasoningMode === 'low') {
          bodyPayload.reasoning = { effort: 'low' };
        }
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 65_000);

      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${nim ? nimKey : orKey}`,
          'Content-Type': 'application/json',
        };
        if (!nim) {
          headers['HTTP-Referer'] = referer;
          headers['X-Title'] = 'Pyvren';
        }

        const response = await fetch(nim ? NVIDIA_NIM_ENDPOINT : OPENROUTER_ENDPOINT, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyPayload),
          signal: controller.signal,
        });

        const rawText = await response.text();

        if (
          nim &&
          response.status === 400 &&
          nimDisableThinking &&
          (rawText.toLowerCase().includes('chat_template_kwargs') ||
            rawText.toLowerCase().includes('enable_thinking'))
        ) {
          nimDisableThinking = false;
          clearTimeout(timeout);
          continue;
        }

        if (
          !nim &&
          response.status === 400 &&
          reasoningMode !== 'none' &&
          rawText.toLowerCase().includes('reasoning')
        ) {
          reasoningMode = reasoningMode === 'disabled' ? 'low' : 'none';
          clearTimeout(timeout);
          continue;
        }

        if (
          response.status === 400 &&
          useJsonMode &&
          !retriedWithoutJsonFormat &&
          isResponseFormatRejection(rawText)
        ) {
          useJsonMode = false;
          retriedWithoutJsonFormat = true;
          clearTimeout(timeout);
          continue;
        }

        if (response.status === 429) {
          const lowerRaw = rawText.toLowerCase();
          if (
            !nim &&
            (lowerRaw.includes('free-models-per-day') || lowerRaw.includes('free_daily_limit'))
          ) {
            openRouterDailyExhaustedUntil = Date.now() + 15 * 60_000;
            if (remainingHasNim) {
              lastError = new Error(
                'OpenRouter daily free-model quota reached; failing over to NVIDIA NIM.',
              );
              break;
            }
            throw new Error(
              'OpenRouter daily free-model quota reached (50/day on free tier; resets at 00:00 UTC or unlocks 1,000/day with $10 credits).',
            );
          }
          rateLimitedUntil.set(candidateModel, Date.now() + RATE_LIMIT_COOLDOWN_MS);
        }

        if (FAILOVER_STATUSES.has(response.status)) {
          rateLimitedUntil.set(candidateModel, Date.now() + RATE_LIMIT_COOLDOWN_MS);
          lastError = new Error(
            `${providerLabel} API error (${response.status}) on ${candidateModel}: ${rawText.slice(0, 320)}`,
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
            `${providerLabel} API error (${response.status}) on ${candidateModel}: ${rawText.slice(0, 320)}`,
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
          const errMessage = `${providerLabel} returned error on ${candidateModel}: ${data.error.message}`;
          if (isNonFailoverAuthError(data.error.message) && isLastCandidate) {
            throw new Error(errMessage);
          }
          rateLimitedUntil.set(candidateModel, Date.now() + RATE_LIMIT_COOLDOWN_MS);
          lastError = new Error(errMessage);
          break;
        }

        const content = normalizeMessageContent(data.choices?.[0]?.message?.content).trim();
        if (!content) {
          rateLimitedUntil.set(candidateModel, Date.now() + RATE_LIMIT_COOLDOWN_MS);
          lastError = new Error(`${providerLabel} returned an empty completion from ${candidateModel}.`);
          break;
        }

        rateLimitedUntil.delete(candidateModel);

        const promptTokens = Number(data.usage?.prompt_tokens ?? 0) || 0;
        const completionTokens = Number(data.usage?.completion_tokens ?? 0) || 0;
        const totalTokens =
          Number(data.usage?.total_tokens ?? promptTokens + completionTokens) ||
          promptTokens + completionTokens;

        // NVIDIA NIM often echoes an internal uncallable alias (e.g. "private/nvidia/...") in data.model;
        // always preserve our canonical public callable `nim/<org>/<model>` identifier.
        const returnedModel = nim
          ? candidateModel
          : data.model?.trim() || candidateModel;

        return {
          content,
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
          },
          model: returnedModel,
        };
      } catch (err) {
        const caught = err instanceof Error ? err : new Error(String(err));
        const isAbortOrNetwork =
          caught.name === 'AbortError' ||
          caught.message.toLowerCase().includes('network') ||
          caught.message.toLowerCase().includes('fetch failed');
        if (isAbortOrNetwork) {
          rateLimitedUntil.set(candidateModel, Date.now() + RATE_LIMIT_COOLDOWN_MS);
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

  throw lastError || new Error('LLM request failed across all configured providers and candidate models.');
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
