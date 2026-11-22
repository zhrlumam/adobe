import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AnimationCategory,
  AnimationLayer,
  AnimationMetadata,
  AnimationProject,
  AnimationType,
  BackgroundMode,
  DesignStyle,
  FpsOption,
  ProviderCatalogEntry,
  ProviderSlug,
  ProviderState,
  ProviderStatus,
  ResolutionPreset,
  StockCategory,
  TargetPlatform,
  VisualStyle,
} from '../src/types/stockforge.js';
import {
  buildProceduralAnimationProject,
  computeProjectHash,
  RESOLUTION_MAP,
} from './animationEngine.js';
import {
  addProductionLog,
  db,
  getProviderApiKey,
  maskApiKey,
  setProviderApiKey,
  updateProviderRecordStatus,
} from './db.js';
import { normalizeKeywords } from './metadataExport.js';

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    slug: 'gemini',
    name: 'Google Gemini',
    description:
      'Google AI Studio Gemini API with native structured JSON schema output and fast SVG code synthesis.',
    officialUrl: 'https://ai.google.dev/gemini-api/docs',
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    setupSteps: [
      'Sign in to Google AI Studio (aistudio.google.com) with your Google account.',
      'Open "Get API key" and click "Create API key" in a free-tier project.',
      'In AI Studio Build, GEMINI_API_KEY is automatically attached from your project Secrets; for local deployments, set GEMINI_API_KEY or configure it below.',
    ],
    requiresApiKey: true,
    freeTierSummary: 'Free tier available on Gemini Flash / Flash-Lite models ($0, subject to project RPM/TPM/RPD quotas).',
    rateLimitsSummary: 'Project-level RPM, TPM, and RPD limits (view live quotas in Google AI Studio).',
    structuredOutputSupport: 'Native JSON Schema (responseSchema)',
    commercialTerms: 'Commercial use permitted; free tier inputs/outputs may be reviewed per Google AI terms unless billing is linked.',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    recommendedModels: [
      {
        id: 'gemini-3.1-flash-lite',
        label: 'Gemini 3.1 Flash-Lite (Free Tier Recommended)',
        tier: 'free',
        notes: 'High-throughput fast free-tier model (~4s) for single vectors and batch runs.',
      },
      {
        id: 'gemini-4-hydrogen',
        label: 'Gemini 4 Hydrogen (20 RPD Free Cap)',
        tier: 'free',
        notes: 'High-craft SVG geometry; free tier is capped at ~20 requests/day per project.',
      },
      {
        id: 'gemini-4-neon',
        label: 'Gemini 4 Neon (Paid Key Required)',
        tier: 'paid',
        notes: 'High-reasoning flagship model; requires billing-enabled API key.',
      },
    ],
  },
  {
    slug: 'openai',
    name: 'OpenAI API',
    description:
      'Official OpenAI API supporting structured JSON animation specifications, vector geometry, and stock metadata.',
    officialUrl: 'https://platform.openai.com/docs/models',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    setupSteps: [
      'Sign in at platform.openai.com and open API Keys.',
      'Click "Create new secret key" with model inference permissions.',
      'Paste the key below and test connection to fetch live models from OpenAI.',
    ],
    requiresApiKey: true,
    freeTierSummary: 'Pay-as-you-go API billing (verify model availability via live /v1/models).',
    rateLimitsSummary: 'Tier-based RPM and TPM limits returned in response headers.',
    structuredOutputSupport: 'JSON Object Mode (response_format: json_object)',
    commercialTerms: 'Full commercial ownership of API outputs under OpenAI Business/API terms.',
    defaultBaseUrl: 'https://api.openai.com/v1',
    recommendedModels: [
      {
        id: 'gpt-4o-mini',
        label: 'GPT-4o mini',
        tier: 'paid',
        notes: 'Fast, low-cost structured JSON animation & SVG specification synthesis.',
      },
      {
        id: 'gpt-4o',
        label: 'GPT-4o',
        tier: 'paid',
        notes: 'Flagship multi-layer composition and motion specification quality.',
      },
      {
        id: 'o4-mini',
        label: 'o4-mini',
        tier: 'paid',
        notes: 'Reasoning model for complex motion choreography.',
      },
    ],
  },
  {
    slug: 'groq',
    name: 'Groq Cloud (LPU)',
    description:
      'Ultra-fast open-weight inference via OpenAI-compatible API with permanent free developer sandbox.',
    officialUrl: 'https://console.groq.com/docs/rate-limits',
    apiKeyUrl: 'https://console.groq.com/keys',
    setupSteps: [
      'Create a free account at console.groq.com (no credit card required).',
      'Navigate to API Keys and click "Create API Key".',
      'Paste the key here to validate and save locally on the backend.',
    ],
    requiresApiKey: true,
    freeTierSummary: 'Permanent free developer tier with no credit card required.',
    rateLimitsSummary: '30 RPM · 1,000–14,400 RPD · 6,000–12,000 TPM depending on model.',
    structuredOutputSupport: 'JSON Object Mode (response_format: json_object)',
    commercialTerms: 'Permissive open-weight model outputs (Llama 3.3, Qwen, GPT-OSS) suitable for commercial vector assets.',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    recommendedModels: [
      {
        id: 'llama-3.3-70b-versatile',
        label: 'Llama 3.3 70B Versatile',
        tier: 'free',
        notes: '30 RPM, 1,000 RPD — strong structured SVG and metadata output.',
      },
      {
        id: 'llama-3.1-8b-instant',
        label: 'Llama 3.1 8B Instant',
        tier: 'free',
        notes: '30 RPM, 14,400 RPD — highest daily quota for batch metadata.',
      },
      {
        id: 'qwen/qwen3-32b',
        label: 'Qwen 3 32B',
        tier: 'free',
        notes: 'Strong code & geometric SVG synthesis.',
      },
    ],
  },
  {
    slug: 'openrouter',
    name: 'OpenRouter (:free Tier)',
    description:
      'Unified multi-model gateway offering zero-cost :free community endpoints across DeepSeek, Qwen, and Llama.',
    officialUrl: 'https://openrouter.ai/docs/api-reference/limits',
    apiKeyUrl: 'https://openrouter.ai/keys',
    setupSteps: [
      'Sign in at openrouter.ai and open the Keys page.',
      'Click "Create Key" (no credit purchase required for :free models).',
      'Paste your key below and test connection to fetch live :free models.',
    ],
    requiresApiKey: true,
    freeTierSummary: 'Zero-cost :free models (50 RPD free; 1,000 RPD if account has $10+ lifetime credits).',
    rateLimitsSummary: '20 RPM global cap on :free models · 50 RPD (or 1,000 RPD with credit history).',
    structuredOutputSupport: 'JSON Output (model-dependent)',
    commercialTerms: 'Depends on selected upstream open-weight model license (Apache 2.0 / MIT / Llama).',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    recommendedModels: [
      {
        id: 'openrouter/free',
        label: 'OpenRouter Free Auto-Router',
        tier: 'free',
        notes: 'Automatically routes to an available healthy :free model.',
      },
      {
        id: 'qwen/qwen3-coder:free',
        label: 'Qwen 3 Coder (:free)',
        tier: 'free',
        notes: 'Optimized for code & SVG XML accuracy.',
      },
      {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        label: 'Llama 3.3 70B Instruct (:free)',
        tier: 'free',
        notes: 'Reliable general vector & metadata generation.',
      },
      {
        id: 'deepseek/deepseek-r1:free',
        label: 'DeepSeek R1 (:free)',
        tier: 'free',
        notes: 'Strong spatial reasoning for geometric compositions.',
      },
    ],
  },
  {
    slug: 'mistral',
    name: 'Mistral AI (La Plateforme)',
    description:
      'European AI provider offering Free Mode experimentation tier with Codestral and Mistral Small.',
    officialUrl: 'https://docs.mistral.ai/getting-started/models/models_overview/',
    apiKeyUrl: 'https://console.mistral.ai/api-keys',
    setupSteps: [
      'Sign up at console.mistral.ai and select the Free experimentation tier.',
      'Open "API Keys" and generate a new API key.',
      'Enter the key below to connect and validate.',
    ],
    requiresApiKey: true,
    freeTierSummary: 'Free Mode experimentation tier without upfront credit card.',
    rateLimitsSummary: '~1 request/sec (~30 RPM) on Free Mode; inspect exact limits in Mistral Admin.',
    structuredOutputSupport: 'JSON Object Mode',
    commercialTerms: 'Open-weight Apache 2.0 models (Mistral Small / Nemo) allow commercial use; check Mistral terms for proprietary endpoints.',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    recommendedModels: [
      {
        id: 'mistral-small-latest',
        label: 'Mistral Small Latest',
        tier: 'free',
        notes: 'Balanced SVG generation and JSON formatting.',
      },
      {
        id: 'codestral-latest',
        label: 'Codestral Latest',
        tier: 'free',
        notes: 'Code-specialized model well suited to clean SVG paths.',
      },
      {
        id: 'open-mistral-nemo',
        label: 'Open Mistral Nemo',
        tier: 'free',
        notes: 'Apache 2.0 open-weight model.',
      },
    ],
  },
  {
    slug: 'huggingface',
    name: 'Hugging Face Inference Router',
    description:
      'Open-source model hub router providing OpenAI-compatible inference across Qwen, DeepSeek, and Llama.',
    officialUrl: 'https://huggingface.co/docs/inference-providers/index',
    apiKeyUrl: 'https://huggingface.co/settings/tokens',
    setupSteps: [
      'Create a Hugging Face account at huggingface.co.',
      'Go to Settings → Access Tokens and create a Fine-grained token with "Make calls to Inference Providers" permission.',
      'Paste the token below to validate.',
    ],
    requiresApiKey: true,
    freeTierSummary: 'Includes small monthly free serverless inference credit (~$0.10/mo).',
    rateLimitsSummary: 'Credit-pool metered; ~2MB payload ceiling.',
    structuredOutputSupport: 'JSON Object Mode (model-dependent)',
    commercialTerms: 'Follows individual open-source model licenses (Apache 2.0 / MIT).',
    defaultBaseUrl: 'https://router.huggingface.co/v1',
    recommendedModels: [
      {
        id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
        label: 'Qwen 2.5 Coder 32B Instruct',
        tier: 'free',
        notes: 'High accuracy on SVG geometry and XML.',
      },
      {
        id: 'meta-llama/Llama-3.3-70B-Instruct',
        label: 'Llama 3.3 70B Instruct',
        tier: 'free',
        notes: 'Strong descriptive stock metadata generation.',
      },
    ],
  },
  {
    slug: 'ollama',
    name: 'Ollama (Local Engine)',
    description:
      'Run open-source AI models 100% locally on your own hardware with zero API costs and unlimited batches.',
    officialUrl: 'https://ollama.com/library',
    apiKeyUrl: 'https://ollama.com/download',
    setupSteps: [
      'Install Ollama locally from ollama.com/download.',
      'Pull a model in your terminal, e.g.: ollama pull qwen2.5-coder:7b',
      'Ensure Ollama is running (default http://localhost:11434) and click Test Connection.',
    ],
    requiresApiKey: false,
    freeTierSummary: '100% Free & Unlimited (runs on local CPU/GPU).',
    rateLimitsSummary: 'No API rate limits; bounded only by local hardware speed.',
    structuredOutputSupport: 'JSON Format Mode',
    commercialTerms: 'Full local privacy & commercial ownership with permissive open-weight models.',
    defaultBaseUrl: 'http://localhost:11434',
    recommendedModels: [
      {
        id: 'qwen2.5-coder:7b',
        label: 'Qwen 2.5 Coder 7B (Local)',
        tier: 'local',
        notes: 'Fast local model for clean SVG path generation.',
      },
      {
        id: 'llama3.2:latest',
        label: 'Llama 3.2 (Local)',
        tier: 'local',
        notes: 'Lightweight local general model.',
      },
    ],
  },
  {
    slug: 'custom',
    name: 'Custom OpenAI-Compatible',
    description:
      'Connect any local or cloud OpenAI-compatible server (LM Studio, vLLM, Cerebras, Together, DeepSeek).',
    officialUrl: 'https://platform.openai.com/docs/api-reference/chat',
    apiKeyUrl: 'https://lmstudio.ai/',
    setupSteps: [
      'Start your OpenAI-compatible server or obtain your provider endpoint URL.',
      'Enter the Base URL (e.g. http://localhost:1234/v1) and optional API key.',
      'Specify or select a model ID and test the connection.',
    ],
    requiresApiKey: false,
    freeTierSummary: 'Depends on your chosen self-hosted or external endpoint.',
    rateLimitsSummary: 'Configured by your endpoint.',
    structuredOutputSupport: 'OpenAI Chat Completions JSON',
    commercialTerms: 'Governed by your selected provider or local model license.',
    defaultBaseUrl: 'http://localhost:1234/v1',
    recommendedModels: [
      {
        id: 'local-model',
        label: 'Custom Model ID',
        tier: 'local',
        notes: 'Enter the exact model identifier served by your endpoint.',
      },
    ],
  },
];

export function initProvidersInDb(): void {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT slug FROM providers').all() as { slug: string }[];
  const existingSlugs = new Set(existing.map((r) => r.slug));
  const hasAnyActive =
    (db.prepare('SELECT COUNT(*) as c FROM providers WHERE is_active = 1').get() as { c: number })
      .c > 0;

  for (const entry of PROVIDER_CATALOG) {
    if (!existingSlugs.has(entry.slug)) {
      const keyInfo = getProviderApiKey(entry.slug);
      const isGeminiEnvReady = entry.slug === 'gemini' && Boolean(keyInfo.key);
      const initialStatus: ProviderStatus = isGeminiEnvReady ? 'connected' : 'unconfigured';
      const defaultBase =
        entry.slug === 'ollama' && process.env.OLLAMA_BASE_URL
          ? process.env.OLLAMA_BASE_URL
          : entry.defaultBaseUrl;

      db.prepare(
        `INSERT INTO providers (slug, name, base_url, selected_model, is_active, status, available_models_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        entry.slug,
        entry.name,
        defaultBase,
        entry.recommendedModels[0]?.id ?? '',
        !hasAnyActive && entry.slug === 'gemini' ? 1 : 0,
        initialStatus,
        JSON.stringify(entry.recommendedModels.map((m) => m.id)),
        now
      );
    } else if (entry.slug === 'gemini') {
      const row = db
        .prepare('SELECT selected_model, status FROM providers WHERE slug = ?')
        .get('gemini') as { selected_model?: string; status?: string } | undefined;
      const syncedModels = JSON.stringify(entry.recommendedModels.map((m) => m.id));
      if (row?.selected_model === 'gemini-4-hydrogen') {
        db.prepare(
          `UPDATE providers
           SET selected_model = ?, available_models_json = ?, status = 'connected', last_error = NULL, updated_at = ?
           WHERE slug = 'gemini'`
        ).run('gemini-3.1-flash-lite', syncedModels, now);
      } else {
        db.prepare(`UPDATE providers SET available_models_json = ? WHERE slug = 'gemini'`).run(
          syncedModels
        );
      }
    }
  }
}

initProvidersInDb();

export function listProviders(): ProviderState[] {
  const rows = db.prepare('SELECT * FROM providers').all() as Record<string, unknown>[];
  const rowMap = new Map(rows.map((r) => [String(r.slug), r]));

  return PROVIDER_CATALOG.map((catalog) => {
    const r = rowMap.get(catalog.slug);
    const { key, envManaged } = getProviderApiKey(catalog.slug);
    const hasKey = Boolean(key);
    let status = (r?.status as ProviderStatus) || 'unconfigured';
    if (catalog.requiresApiKey && !hasKey) {
      status = 'unconfigured';
    } else if (catalog.requiresApiKey && hasKey && status === 'unconfigured') {
      status = 'connected';
    }

    const availableModels: string[] = r?.available_models_json
      ? JSON.parse(String(r.available_models_json))
      : catalog.recommendedModels.map((m) => m.id);

    return {
      slug: catalog.slug,
      name: String(r?.name ?? catalog.name),
      baseUrl: String(r?.base_url ?? catalog.defaultBaseUrl),
      selectedModel: String(r?.selected_model ?? catalog.recommendedModels[0]?.id ?? ''),
      isActive: Number(r?.is_active ?? 0) === 1,
      status,
      hasKey,
      envManaged,
      keyHint: maskApiKey(key),
      lastTestedAt: r?.last_tested_at ? String(r.last_tested_at) : null,
      lastError: r?.last_error ? String(r.last_error) : null,
      rateLimitInfo: r?.rate_limit_info ? JSON.parse(String(r.rate_limit_info)) : null,
      availableModels,
      catalog,
    };
  });
}

export function getActiveProvider(): ProviderState {
  const all = listProviders();
  return all.find((p) => p.isActive) ?? all[0];
}

export function getProviderBySlug(slug: ProviderSlug): ProviderState {
  const found = listProviders().find((p) => p.slug === slug);
  if (!found) {
    throw new Error(`Unknown AI provider: ${slug}`);
  }
  return found;
}

export function setActiveProvider(slug: ProviderSlug): ProviderState {
  getProviderBySlug(slug);
  const now = new Date().toISOString();
  db.prepare('UPDATE providers SET is_active = 0, updated_at = ?').run(now);
  db.prepare('UPDATE providers SET is_active = 1, updated_at = ? WHERE slug = ?').run(now, slug);
  addProductionLog({
    eventType: 'provider_switch',
    providerSlug: slug,
    status: 'info',
    message: `Switched active AI provider to ${slug}`,
  });
  return getProviderBySlug(slug);
}

export function updateProviderConfig(params: {
  slug: ProviderSlug;
  apiKey?: string | null;
  clearApiKey?: boolean;
  baseUrl?: string;
  selectedModel?: string;
}): ProviderState {
  const current = getProviderBySlug(params.slug);
  const now = new Date().toISOString();

  if (params.clearApiKey) {
    setProviderApiKey(params.slug, null);
  } else if (typeof params.apiKey === 'string' && params.apiKey.trim().length > 0) {
    setProviderApiKey(params.slug, params.apiKey.trim());
  }

  const nextBaseUrl = params.baseUrl?.trim() || current.baseUrl;
  const nextModel = params.selectedModel?.trim() || current.selectedModel;

  db.prepare(
    `UPDATE providers SET base_url = ?, selected_model = ?, updated_at = ? WHERE slug = ?`
  ).run(nextBaseUrl, nextModel, now, params.slug);

  return getProviderBySlug(params.slug);
}

function extractRateLimitHeaders(headers: Headers): Record<string, string> | null {
  const captured: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (lk.includes('ratelimit') || lk === 'retry-after') {
      captured[key] = value;
    }
  });
  return Object.keys(captured).length > 0 ? captured : null;
}

export async function testProviderConnection(
  slug: ProviderSlug,
  overrideApiKey?: string,
  overrideBaseUrl?: string,
  overrideModel?: string
): Promise<{
  ok: boolean;
  latencyMs: number;
  models: string[];
  rateLimitInfo: Record<string, string> | null;
  error?: string;
}> {
  const start = Date.now();
  const provider = getProviderBySlug(slug);
  const { key: storedKey } = getProviderApiKey(slug);
  const apiKey = overrideApiKey?.trim() || storedKey;
  const baseUrl = (overrideBaseUrl?.trim() || provider.baseUrl).replace(/\/+$/, '');
  const model = overrideModel?.trim() || provider.selectedModel;

  try {
    if (provider.catalog.requiresApiKey && !apiKey) {
      throw new Error(`No API key configured for ${provider.name}.`);
    }

    if (slug === 'gemini') {
      const targetModel = model || 'gemini-3.1-flash-lite';
      const ai = new GoogleGenAI({
        apiKey: apiKey!,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const response = await withTransient503Retry(() =>
        withTimeout(
          ai.models.generateContent({
            model: targetModel,
            contents: 'Reply with OK',
            config: {
              ...getGeminiThinkingConfig(targetModel, 'test'),
            },
          }),
          25000,
          `Gemini connection test timed out after 25s for model "${targetModel}".`
        )
      );
      if (!response.text) {
        throw new Error('Empty response returned from Gemini API.');
      }

      // Query real available models from Gemini API
      let liveModels = provider.catalog.recommendedModels.map((m) => m.id);
      try {
        const discovered: string[] = [];
        const pager = await withTimeout(
          ai.models.list({ config: { pageSize: 50 } }),
          10000,
          'Gemini model list timeout'
        );
        for await (const m of pager) {
          const rawName = String(m.name || '').replace(/^models\//, '');
          const actions = Array.isArray(m.supportedActions) ? m.supportedActions : [];
          if (
            rawName &&
            rawName.includes('gemini') &&
            (actions.length === 0 || actions.includes('generateContent'))
          ) {
            discovered.push(rawName);
          }
          if (discovered.length >= 30) break;
        }
        if (discovered.length > 0) {
          liveModels = Array.from(new Set([...liveModels, ...discovered]));
          db.prepare('UPDATE providers SET available_models_json = ? WHERE slug = ?').run(
            JSON.stringify(liveModels),
            slug
          );
        }
      } catch {
        // Keep recommended models if models.list scope is restricted
      }

      const latencyMs = Date.now() - start;
      updateProviderRecordStatus(slug, 'connected', null, null);
      addProductionLog({
        eventType: 'connection_test',
        providerSlug: slug,
        model: targetModel,
        status: 'success',
        latencyMs,
        message: `Verified Gemini connection with ${targetModel} (${liveModels.length} models)`,
      });
      return { ok: true, latencyMs, models: liveModels, rateLimitInfo: null };
    }

    if (slug === 'ollama') {
      const tagsResp = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!tagsResp.ok) {
        throw new Error(`Ollama returned HTTP ${tagsResp.status} at ${baseUrl}`);
      }
      const data = (await tagsResp.json()) as { models?: { name: string }[] };
      const models = (data.models ?? []).map((m) => m.name);
      if (models.length > 0) {
        db.prepare('UPDATE providers SET available_models_json = ? WHERE slug = ?').run(
          JSON.stringify(models),
          slug
        );
      }
      const latencyMs = Date.now() - start;
      updateProviderRecordStatus(slug, 'connected', null, { engine: 'Local Unlimited' });
      addProductionLog({
        eventType: 'connection_test',
        providerSlug: slug,
        model,
        status: 'success',
        latencyMs,
        message: `Connected to Ollama (${models.length} local models discovered)`,
      });
      return {
        ok: true,
        latencyMs,
        models: models.length > 0 ? models : provider.availableModels,
        rateLimitInfo: { engine: 'Local Unlimited' },
      };
    }

    // OpenAI, Groq, OpenRouter, Mistral, Hugging Face, Custom
    let discoveredModels: string[] = [];
    let rateLimits: Record<string, string> | null = null;

    if (slug === 'huggingface') {
      const whoResp = await fetch('https://huggingface.co/api/whoami-v2', {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal: AbortSignal.timeout(10000),
      });
      if (!whoResp.ok) {
        throw new Error(`Hugging Face token verification failed (HTTP ${whoResp.status}).`);
      }
    } else {
      const modelsResp = await fetch(`${baseUrl}/models`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal: AbortSignal.timeout(12000),
      });
      rateLimits = extractRateLimitHeaders(modelsResp.headers) ?? rateLimits;
      if (!modelsResp.ok) {
        const errBody = await modelsResp.text().catch(() => '');
        throw new Error(`HTTP ${modelsResp.status}: ${errBody.slice(0, 300) || modelsResp.statusText}`);
      }
      const modelsJson = (await modelsResp.json()) as { data?: { id: string }[] };
      let ids = (modelsJson.data ?? []).map((m) => m.id).filter(Boolean);
      if (slug === 'openrouter') {
        const freeIds = ids.filter((id) => id.endsWith(':free') || id === 'openrouter/free');
        if (freeIds.length > 0) ids = freeIds;
      } else if (slug === 'openai') {
        const chatIds = ids.filter((id) => id.startsWith('gpt-') || id.startsWith('o'));
        if (chatIds.length > 0) ids = chatIds;
      }
      if (ids.length > 0) {
        discoveredModels = ids.slice(0, 40);
        db.prepare('UPDATE providers SET available_models_json = ? WHERE slug = ?').run(
          JSON.stringify(discoveredModels),
          slug
        );
      }
    }

    // Also verify chat completion works with selected model
    const testChatResp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...(slug === 'openrouter'
          ? { 'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000', 'X-Title': 'ZuumStock Studio' }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with {"ok":true}' }],
        max_tokens: 24,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const chatHeaders = extractRateLimitHeaders(testChatResp.headers);
    if (chatHeaders) rateLimits = { ...(rateLimits ?? {}), ...chatHeaders };

    if (!testChatResp.ok) {
      const errText = await testChatResp.text().catch(() => '');
      throw new Error(`Chat test HTTP ${testChatResp.status}: ${errText.slice(0, 300)}`);
    }

    const latencyMs = Date.now() - start;
    const finalModels = discoveredModels.length > 0 ? discoveredModels : provider.availableModels;
    updateProviderRecordStatus(slug, 'connected', null, rateLimits);
    addProductionLog({
      eventType: 'connection_test',
      providerSlug: slug,
      model,
      status: 'success',
      latencyMs,
      message: `Verified ${provider.name} (${model})`,
    });
    return { ok: true, latencyMs, models: finalModels, rateLimitInfo: rateLimits };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = formatUpstreamError(err, slug, model);
    updateProviderRecordStatus(slug, 'error', message, null);
    addProductionLog({
      eventType: 'connection_test',
      providerSlug: slug,
      model,
      status: 'error',
      latencyMs,
      message,
    });
    return {
      ok: false,
      latencyMs,
      models: provider.availableModels,
      rateLimitInfo: null,
      error: message,
    };
  }
}

export interface GeneratedVectorPayload {
  artDirection?: string;
  svg: string;
  title: string;
  description: string;
  keywords: string[];
  adobeCategory: string;
  shutterstockCategory: string;
}

const STYLE_CRAFT_GUIDES: Record<DesignStyle, string> = {
  'Flat Geometric':
    'Modern editorial vector illustration (Adobe Stock / Dribbble bestseller standard). Combine smooth organic cubic Bezier silhouettes (C/S curves) with clean rounded geometric accents (rx/ry). Include 3-step cel-shading (base tone, soft shadow band, crisp specular highlight) and subtle grounding shadows so shapes feel sculptural and alive—never stiff stacked rectangles.',
  'Isometric Vector':
    'True 30-degree axonometric isometric perspective (angles aligned to ~30°/150° diagonals). Clearly separate top (brightest), left (midtone), and right (shaded) planes with crisp edge highlights, soft ambient floor shadows, beveled corners, and layered micro-details (screens, foliage, cables, tiles, or floating badges) for architectural depth.',
  'Minimal Line Art':
    'Expressive continuous monoline & weighted editorial vector illustration. Use fluid S/C Bezier curves with stroke-linecap="round" and stroke-linejoin="round", varied primary (4–6px) and secondary (2–3px) stroke weights, and subtle offset pastel/duotone accent fills tucked slightly behind key contours for refined commercial polish.',
  'Duotone Editorial':
    'Bold magazine-grade editorial vector art using a tight 2-accent + deep ink + warm paper palette. Build expressive, fluid, asymmetrical silhouettes with dynamic negative-space cutouts, sweeping Bezier curves, layered overlapping planes, and crisp graphic contrast.',
  'Organic Botanical':
    'Flowing natural curves, graceful tapering stems, overlapping translucent petals/leaves (using harmonious opacity layers and soft gradients), delicate curved midribs/veins, and asymmetrical organic balance. Zero stiff straight-edged polygons.',
  'Gradient Mesh Vector':
    'Luminous modern commercial 3D-feel vector using rich multi-stop <linearGradient> and <radialGradient> definitions in <defs>. Layer soft directional light gradients, subtle glossy rim highlights, overlapping depth planes, and soft ambient halo shapes—using pure vector paths and opacity (NO <filter> blur).',
  'Bold Emblem':
    'High-impact commercial badge, crest, or brand-ready vector mark. Use confident silhouette hierarchy, balanced symmetry or dynamic heraldic framing, clean inner negative-space cuts, crisp highlight bevels, and unmistakable readability at both 64px thumbnail and billboard scale.',
  'Technical Blueprint':
    'Precision engineering & architectural schematic aesthetic. Use crisp drafting lines, subtle fine coordinate grid backdrop, detailed orthographic/isometric cutaway components, clean concentric rings, and geometric callout ticks/markers (pure vector lines/dots—NO <text>).',
};

const CATEGORY_COMPOSITION_GUIDES: Record<StockCategory, string> = {
  Abstract: 'Build rhythmic sweeping Bezier ribbons, layered translucent waves, or balanced sculptural forms with dynamic motion and depth.',
  Business: 'Craft approachable modern editorial characters/objects with natural curved posture, clean SaaS devices, charts, or collaborative symbols—never rigid stick figures.',
  Technology: 'Combine sleek curved hardware/cloud/AI motifs with crisp glowing nodes, data streams, and clean layered gradients.',
  Education: 'Create warm, inviting academic or learning compositions with dimensional books, globes, botanicals, or creative tools arranged with strong focal hierarchy.',
  Animals: 'Sculpt expressive, anatomical, fluid animal silhouettes using smooth Bezier curves, layered fur/feather/wing tufts, expressive eyes with catchlight highlights, and graceful posture.',
  Nature: 'Layer atmospheric foreground, midground, and horizon depth with curved hills, organic clouds, flowing water ribbons, and lush foliage.',
  Food: 'Use appetizing organic silhouettes, soft glossy specular highlights, layered toppings/ingredients, subtle steam ribbons, and warm natural tones.',
  Medical: 'Balance precision clarity with reassuring organic forms, clean layered anatomy/lab/wellness motifs, and trustworthy teal/cobalt/coral harmonies.',
  Objects: 'Render hero products/items in appealing 3/4 or dynamic angle with crisp volume shading, cast ground shadow, material highlights, and supporting props.',
  Backgrounds: 'Fill the canvas seamlessly (100% edge-to-edge coverage) with flowing layered waves, organic gradients, or rhythmic geometric depth planes suitable as commercial wallpaper/backdrop.',
  Icons: 'Keep optical weight balanced across a clean centered grid with generous padding (100px margin), crisp silhouettes, subtle layered shading, and unmistakable legibility.',
  Patterns: 'Compose a harmonious repeating-ready motif grid across the canvas with balanced spacing, primary/secondary motifs, and tiny rhythmic filler accents.',
  Custom: 'Tailor the composition dynamically to the exact subject with strong focal hierarchy, layered depth, and editorial polish.',
};

const VECTOR_SYSTEM_INSTRUCTION = `You are a Principal Commercial Stock Vector Illustrator and Creative Director whose portfolio ranks in the top 1% on Adobe Stock and Shutterstock.
Your task is to create an original, ultra-polished, fluid, commercially sellable vector illustration as clean SVG XML AND accurate marketplace metadata.

DESIGN & ANTI-STIFFNESS CRAFT STANDARDS (CRITICAL):
1. FLUID BEZIER MASTERY: Never produce stiff, robotic, boxy, or amateur clipart. Use smooth cubic Bezier curves (<path d="... C ... S ... Z">) for organic silhouettes, rounded postures, flowing folds, leaves, waves, and anatomical contours.
2. LAYERED DEPTH ARCHITECTURE: Organize the <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"> into clean semantic <g> layers in back-to-front order:
   - <g id="backdrop"> (subtle organic blob, radial halo, or atmospheric shape—keep canvas clean & isolated unless Category is Backgrounds/Patterns)
   - <g id="cast-shadow"> (soft tinted ground/ambient shadow, e.g. fill="#0F172A" opacity="0.10", never harsh solid #000000)
   - <g id="subject-base"> (primary hero silhouettes with rich <linearGradient>/<radialGradient> or harmonious base tones)
   - <g id="shading-highlights"> (cel-shaded shadow crescents, midtone planes, glossy specular highlights, rim-light curves)
   - <g id="detail-accents"> (crisp secondary props, floating geometric/botanical accents, fine surface lines with stroke-linecap="round")
3. RICHNESS & PROPORTION: Aim for 24 to 55 carefully crafted vector primitives (predominantly expressive <path> elements with smooth C/S curves). Frame the hero composition cleanly inside 68%–86% of the 1000x1000 artboard with balanced margins (never clipped at edges unless Category is Backgrounds/Patterns).
4. CURATED COLOR HARMONY: Select a cohesive, modern editorial palette (1 dominant tone, 1-2 supporting analogous/complementary tones, soft neutral highlights, and deep tinted shadows like #0F172A or #1E1B4B instead of pure black #000000). Define reusable <linearGradient> and <radialGradient> in <defs>.
5. STRICT EPS & MARKETPLACE PURITY:
   - Output ONLY pure editable vector geometry: <path>, <circle>, <rect>, <ellipse>, <polygon>, <polyline>, <line>, <g>, <defs>, <linearGradient>, <radialGradient>, <stop>.
   - NEVER use <image>, data:image/*, <foreignObject>, <script>, event handlers, external URLs, <filter> (no blur/drop-shadow SVG filters—simulate soft depth purely with gradients and translucent vector shapes), or <text>.
   - Never leave orphan strokes, unclosed accidental fills, or overlapping z-fighting shapes.

STOCK METADATA RULES:
- title: 45-120 characters, clear commercial English description, NO trademarked brands, NO words like "vector", "eps", "svg", "ai generated".
- description: 80-200 characters describing subject, style, mood, and commercial use cases.
- keywords: 22-40 unique lowercase single or two-word tags directly relevant to the artwork (NO duplicates, NO keyword stuffing).
- adobeCategory: Pick best single match from (Abstract, Animals, Business, Education, Food, Graphic Resources, Landscapes, Lifestyle, Medical, Nature, Objects, Science, Technology, Transport).
- shutterstockCategory: Pick best single match from (Abstract, Animals/Wildlife, Backgrounds/Textures, Business/Finance, Education, Food and Drink, Healthcare/Medical, Icons, Nature, Objects, Science, Technology).

Return ONLY valid JSON matching the requested schema.`;

function analyzeQuickVectorQuality(svg: string): {
  primitives: number;
  paths: number;
  curves: number;
} {
  const count = (tag: string) => (svg.match(new RegExp(`<\\s*${tag}\\b`, 'gi')) || []).length;
  const paths = count('path');
  const primitives =
    paths +
    count('circle') +
    count('rect') +
    count('ellipse') +
    count('polygon') +
    count('polyline') +
    count('line');
  const curves = (svg.match(/[CSQAcsqa]/g) || []).length;
  return { primitives, paths, curves };
}

export async function generateVectorAssetWithProvider(params: {
  providerSlug: ProviderSlug;
  model?: string;
  prompt: string;
  category: StockCategory;
  style: DesignStyle;
  targetPlatform: TargetPlatform;
  variationDirective?: string;
}): Promise<{ payload: GeneratedVectorPayload; latencyMs: number; modelUsed: string }> {
  const provider = getProviderBySlug(params.providerSlug);
  const { key: apiKey } = getProviderApiKey(params.providerSlug);
  const model = params.model?.trim() || provider.selectedModel;

  if (provider.catalog.requiresApiKey && !apiKey) {
    throw new Error(
      `Provider "${provider.name}" has no API key configured. Open AI Provider Settings to add and validate your key.`
    );
  }

  const styleGuide = STYLE_CRAFT_GUIDES[params.style] || '';
  const categoryGuide = CATEGORY_COMPOSITION_GUIDES[params.category] || '';

  const userPrompt = [
    `Subject Prompt: ${params.prompt}`,
    `Stock Category: ${params.category} — ${categoryGuide}`,
    `Visual Style: ${params.style} — ${styleGuide}`,
    `Target Marketplace: ${params.targetPlatform === 'both' ? 'Adobe Stock & Shutterstock' : params.targetPlatform}`,
    params.variationDirective ? `Unique Variation Directive: ${params.variationDirective}` : '',
    'First populate "artDirection" with your palette hex codes, focal layout plan, Bezier curve flow, light direction, and layer breakdown, then synthesize the publication-grade editable <svg viewBox="0 0 1000 1000"> and marketplace metadata.',
  ]
    .filter(Boolean)
    .join('\n');

  const start = Date.now();

  if (params.providerSlug === 'gemini') {
    const ai = new GoogleGenAI({
      apiKey: apiKey!,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const invokeGemini = async (promptContent: string, thinkingMode: 'generate' | 'refine' = 'generate') => {
      const response = await withTransient503Retry(() =>
        withTimeout(
          ai.models.generateContent({
            model,
            contents: promptContent,
            config: {
              systemInstruction: VECTOR_SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              ...getGeminiThinkingConfig(model, thinkingMode),
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  artDirection: {
                    type: Type.STRING,
                    description:
                      'Brief visual blueprint: 5 curated palette hex colors, light angle, focal proportions, Bezier silhouette flow, and 5 semantic SVG layers.',
                  },
                  svg: {
                    type: Type.STRING,
                    description:
                      'Complete high-detail standalone <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">...</svg> artwork with 24-55 layered primitives, smooth C/S Bezier curves, gradients, shading, and highlights.',
                  },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  keywords: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  adobeCategory: { type: Type.STRING },
                  shutterstockCategory: { type: Type.STRING },
                },
                required: [
                  'artDirection',
                  'svg',
                  'title',
                  'description',
                  'keywords',
                  'adobeCategory',
                  'shutterstockCategory',
                ],
              },
            },
          }),
          50000,
          model === 'gemini-3.1-flash-lite'
            ? `Gemini generation timed out after 50s on model "${model}". Try retrying or switching to Groq / OpenRouter in AI Providers.`
            : `Gemini generation timed out after 50s on model "${model}". Try switching to "gemini-3.1-flash-lite".`
        )
      );

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('Gemini returned an empty response.');
      }
      return parseJsonPayload(rawText);
    };

    try {
      let parsed = await invokeGemini(userPrompt, 'generate');

      // Automatic quality elevation pass only when output is genuinely sparse or stiff (skip on 20-RPD capped model)
      const q = analyzeQuickVectorQuality(parsed.svg);
      const needsPolish =
        model !== 'gemini-4-hydrogen' &&
        ((q.primitives < 12 && q.curves < 25) ||
          (params.category !== 'Icons' && q.paths < 3 && q.curves < 15));

      if (needsPolish) {
        try {
          const refinePrompt = [
            userPrompt,
            `\nYour previous SVG draft was too sparse/stiff (${q.primitives} primitives, ${q.paths} paths).`,
            'Elevate it into a flagship Adobe Stock / Shutterstock bestseller:',
            '- Replace rigid straight rectangles/triangles with fluid organic cubic Bezier <path> curves (C/S commands).',
            '- Add layered depth: backdrop atmosphere, soft translucent cast shadow, gradient fills (<linearGradient>/<radialGradient>), cel-shaded shadow crescents, glossy rim highlights, and crisp foreground micro-details.',
            '- Target 26 to 55 clean, expressive primitives on the 1000x1000 artboard.',
            `Draft to upgrade:\n${parsed.svg.slice(0, 6000)}`,
          ].join('\n');
          const refined = await invokeGemini(refinePrompt, 'refine');
          const qRefined = analyzeQuickVectorQuality(refined.svg);
          if (qRefined.primitives >= q.primitives) {
            parsed = refined;
          }
        } catch {
          // Keep initial valid draft if refinement fails/times out
        }
      }

      const latencyMs = Date.now() - start;
      updateProviderRecordStatus(params.providerSlug, 'connected', null, null);
      return { payload: parsed, latencyMs, modelUsed: model };
    } catch (err) {
      const cleanMessage = formatUpstreamError(err, params.providerSlug, model);
      updateProviderRecordStatus(params.providerSlug, 'error', cleanMessage, null);
      const wrapped = new Error(cleanMessage) as Error & {
        statusCode?: number;
        retryAfterMs?: number;
      };
      const status = extractHttpStatus(err);
      if (status) wrapped.statusCode = status;
      throw wrapped;
    }
  }

  // OpenAI-compatible providers (Groq, OpenRouter, Mistral, Hugging Face, Ollama, Custom)
  const baseUrl = provider.baseUrl.replace(/\/+$/, '');
  const endpoint =
    params.providerSlug === 'ollama'
      ? `${baseUrl}/v1/chat/completions`
      : `${baseUrl}/chat/completions`;

  const bodyPayload: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: VECTOR_SYSTEM_INSTRUCTION },
      {
        role: 'user',
        content:
          userPrompt +
          '\n\nRespond ONLY with a single JSON object with keys in this exact order: "artDirection", "svg", "title", "description", "keywords" (string[]), "adobeCategory", "shutterstockCategory".',
      },
    ],
    max_tokens: 8192,
  };

  if (
    params.providerSlug === 'groq' ||
    params.providerSlug === 'mistral' ||
    params.providerSlug === 'ollama'
  ) {
    bodyPayload.response_format = { type: 'json_object' };
  }

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(params.providerSlug === 'openrouter'
        ? {
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
            'X-Title': 'ZuumStock Studio',
          }
        : {}),
    },
    body: JSON.stringify(bodyPayload),
    signal: AbortSignal.timeout(90000),
  });

  const rateLimits = extractRateLimitHeaders(resp.headers);
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    const msg = formatUpstreamError(
      new Error(`${provider.name} HTTP ${resp.status}: ${errText.slice(0, 600)}`),
      params.providerSlug,
      model
    );
    updateProviderRecordStatus(params.providerSlug, 'error', msg, rateLimits);
    const err = new Error(msg) as Error & { statusCode?: number; retryAfterMs?: number };
    err.statusCode = resp.status;
    const retryAfter = resp.headers.get('retry-after');
    if (retryAfter && /^\d+$/.test(retryAfter)) {
      err.retryAfterMs = Number(retryAfter) * 1000;
    }
    throw err;
  }

  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error(`${provider.name} returned empty message content.`);
  }

  const parsed = parseJsonPayload(content);
  const latencyMs = Date.now() - start;
  updateProviderRecordStatus(params.providerSlug, 'connected', null, rateLimits);
  return { payload: parsed, latencyMs, modelUsed: model };
}

export async function regenerateMetadataWithProvider(params: {
  providerSlug: ProviderSlug;
  model?: string;
  prompt: string;
  category: StockCategory;
  style: DesignStyle;
  svg: string;
}): Promise<{
  title: string;
  description: string;
  keywords: string[];
  adobeCategory: string;
  shutterstockCategory: string;
}> {
  const provider = getProviderBySlug(params.providerSlug);
  const { key: apiKey } = getProviderApiKey(params.providerSlug);
  const model = params.model?.trim() || provider.selectedModel;

  if (provider.catalog.requiresApiKey && !apiKey) {
    throw new Error(`Provider "${provider.name}" has no API key configured.`);
  }

  const promptText = `Analyze this vector artwork context and generate fresh, unique commercial stock metadata without keyword stuffing.
Original Prompt: ${params.prompt}
Category: ${params.category}
Style: ${params.style}
SVG Preview Snippet: ${params.svg.slice(0, 2500)}

Return JSON with: title (45-120 chars), description (80-200 chars), keywords (array of 20-35 unique lowercase terms), adobeCategory, shutterstockCategory.`;

  if (params.providerSlug === 'gemini') {
    const ai = new GoogleGenAI({
      apiKey: apiKey!,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
    try {
      const resp = await withTimeout(
        ai.models.generateContent({
          model,
          contents: promptText,
          config: {
            responseMimeType: 'application/json',
            ...getGeminiThinkingConfig(model, 'test'),
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                adobeCategory: { type: Type.STRING },
                shutterstockCategory: { type: Type.STRING },
              },
              required: [
                'title',
                'description',
                'keywords',
                'adobeCategory',
                'shutterstockCategory',
              ],
            },
          },
        }),
        30000,
        `Gemini metadata refresh timed out after 30s on model "${model}".`
      );
      const json = JSON.parse((resp.text ?? '{}').trim());
      return {
        title: String(json.title || params.prompt).slice(0, 180),
        description: String(json.description || params.prompt).slice(0, 200),
        keywords: Array.isArray(json.keywords) ? json.keywords.map(String) : [],
        adobeCategory: String(json.adobeCategory || 'Graphic Resources'),
        shutterstockCategory: String(json.shutterstockCategory || 'Vectors'),
      };
    } catch (err) {
      throw new Error(formatUpstreamError(err, params.providerSlug, model));
    }
  }

  const baseUrl = provider.baseUrl.replace(/\/+$/, '');
  const endpoint =
    params.providerSlug === 'ollama'
      ? `${baseUrl}/v1/chat/completions`
      : `${baseUrl}/chat/completions`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: promptText + '\nReturn ONLY raw JSON.' }],
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!resp.ok) {
    throw new Error(`${provider.name} HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? '{}';
  const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const json = JSON.parse(cleaned);
  return {
    title: String(json.title || params.prompt).slice(0, 180),
    description: String(json.description || params.prompt).slice(0, 200),
    keywords: Array.isArray(json.keywords) ? json.keywords.map(String) : [],
    adobeCategory: String(json.adobeCategory || 'Graphic Resources'),
    shutterstockCategory: String(json.shutterstockCategory || 'Vectors'),
  };
}

function parseJsonPayload(raw: string): GeneratedVectorPayload {
  let cleaned = raw.trim();
  // Strip <think>...</think> blocks from reasoning models (e.g. DeepSeek R1 / Qwen3)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Strip markdown fences if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  const parsed = JSON.parse(cleaned) as Partial<GeneratedVectorPayload>;
  if (!parsed.svg || typeof parsed.svg !== 'string') {
    throw new Error('Model response JSON did not contain a valid "svg" string.');
  }
  return {
    svg: parsed.svg,
    title: String(parsed.title || 'Commercial Vector Illustration').trim(),
    description: String(parsed.description || parsed.title || 'Editable vector graphic').trim(),
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map((k) => String(k).trim()).filter(Boolean) : [],
    adobeCategory: String(parsed.adobeCategory || 'Graphic Resources').trim(),
    shutterstockCategory: String(parsed.shutterstockCategory || 'Vectors').trim(),
  };
}

function getGeminiThinkingConfig(
  model: string,
  mode: 'test' | 'generate' | 'refine' = 'generate'
): { thinkingConfig?: { thinkingLevel: ThinkingLevel } } {
  if (mode === 'test') {
    if (model === 'gemini-3.1-flash-lite') {
      return { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } };
    }
    if (model.startsWith('gemini-4-') || model.startsWith('gemini-3')) {
      return { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } };
    }
    return {};
  }
  if (model === 'gemini-3.1-flash-lite') {
    return { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } };
  }
  if (model.startsWith('gemini-4-') || model.startsWith('gemini-3')) {
    return { thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM } };
  }
  return {};
}

async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function withTransient503Retry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const status = extractHttpStatus(err);
    const raw = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (status === 503 || raw.includes('high demand') || raw.includes('unavailable')) {
      await new Promise((r) => setTimeout(r, 1500));
      return await fn();
    }
    throw err;
  }
}

function extractHttpStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
    return (err as { status: number }).status;
  }
  const raw = err instanceof Error ? err.message : String(err);
  const m = raw.match(/"code"\s*:\s*(\d{3})/) ?? raw.match(/\bHTTP\s+(\d{3})\b/);
  return m ? Number(m[1]) : undefined;
}

function formatUpstreamError(err: unknown, providerSlug: string, model: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  let code: number | string = extractHttpStatus(err) ?? '';
  let status = '';
  let msg = '';

  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    const jsonSlice = raw.slice(jsonStart, jsonEnd + 1);
    try {
      const parsed = JSON.parse(jsonSlice) as {
        error?: { code?: number; message?: string; status?: string };
        message?: string;
      };
      if (parsed?.error) {
        code = parsed.error.code ?? code;
        status = parsed.error.status ?? '';
        msg = parsed.error.message ?? '';
      } else if (parsed?.message) {
        msg = parsed.message;
      }
    } catch {
      const codeMatch = jsonSlice.match(/"code"\s*:\s*(\d+)/);
      const statusMatch = jsonSlice.match(/"status"\s*:\s*"([^"]+)"/);
      const msgMatch = jsonSlice.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (codeMatch) code = Number(codeMatch[1]);
      if (statusMatch) status = statusMatch[1];
      if (msgMatch) msg = msgMatch[1].replace(/\\n/g, ' ');
    }
  }

  if (Number(code) === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    if (providerSlug === 'gemini') {
      if (model === 'gemini-4-neon' && (lower.includes('limit: 0') || lower.includes('freetier') || lower.includes('free_tier'))) {
        return `Gemini 429 RESOURCE_EXHAUSTED: "${model}" has 0 free-tier quota and requires a paid billing-enabled API key. Switch to "gemini-3.1-flash-lite" or configure Groq / OpenRouter in AI Providers.`;
      }
      const limitMatch = raw.match(/limit:\s*(\d+)/i);
      const retryMatch = raw.match(/retry in ([0-9hms.]+)/i);
      const limitHint = limitMatch ? ` (${limitMatch[1]} requests/day limit)` : '';
      const cleanRetry = retryMatch ? retryMatch[1].replace(/\.\d+s\.?$/i, 's') : '';
      const retryHint = cleanRetry ? ` Retry resets in ~${cleanRetry}.` : '';
      return `Gemini 429 RESOURCE_EXHAUSTED: Free-tier quota reached for "${model}"${limitHint}.${retryHint} Switch model to "gemini-3.1-flash-lite" or activate Groq / OpenRouter in AI Providers.`;
    }
    return `${providerSlug} 429 Rate Limit Exceeded for "${model}". Wait briefly, lower batch concurrency, or switch AI provider.`;
  }

  if (Number(code) === 503 || lower.includes('unavailable') || lower.includes('high demand')) {
    if (providerSlug === 'gemini' && model === 'gemini-3.1-flash-lite') {
      return `Gemini 503 Unavailable: "${model}" is temporarily experiencing high upstream demand. Retry in a few seconds or switch to Groq / OpenRouter in AI Providers.`;
    }
    return `${providerSlug} 503 Unavailable: "${model}" is experiencing high upstream demand. Switch to "gemini-3.1-flash-lite" or another provider.`;
  }

  if (Number(code) === 401 || Number(code) === 403 || lower.includes('api_key_invalid') || lower.includes('invalid api key')) {
    return `${providerSlug} Authentication Error (${code || 401}): API key is invalid or lacks permission. Verify your key in AI Providers.`;
  }

  if (msg) {
    const firstLine = msg.split('\n')[0].trim();
    return `${providerSlug}${code ? ` ${code}` : ''}${status ? ` ${status}` : ''}: ${firstLine}`;
  }

  return raw.length > 350 ? `${raw.slice(0, 350)}...` : raw;
}

// ============================================================================
// STOCK ANIMATION SPECIFICATION & METADATA SYNTHESIS
// ============================================================================

interface AiAnimationBlueprint {
  name?: string;
  palette?: string[];
  backgroundColor?: string;
  title?: string;
  description?: string;
  keywords?: string[];
  adobeCategory?: string;
  shutterstockCategory?: string;
  layerOverrides?: Array<{
    name?: string;
    color?: string;
    secondaryColor?: string;
    label?: string;
    count?: number;
    speed?: number;
    customPath?: string;
  }>;
}

function sanitizeColorForGreenScreen(hex: string, bgMode: BackgroundMode): string {
  const clean = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(clean)) return '#3B82F6';
  if (bgMode !== 'green_screen') return clean;
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  if (g > 165 && r < 115 && b < 115) return '#3B82F6';
  return clean;
}

export async function generateAnimationSpecWithProvider(params: {
  id: string;
  batchId?: string | null;
  name?: string;
  prompt: string;
  category: AnimationCategory;
  animationType?: AnimationType;
  visualStyle: VisualStyle;
  backgroundMode: BackgroundMode;
  backgroundColor?: string;
  resolution: ResolutionPreset;
  durationSec: number;
  fps: FpsOption;
  targetPlatform?: TargetPlatform;
  providerSlug: ProviderSlug;
  model?: string;
  seed?: number;
}): Promise<{ project: AnimationProject; latencyMs: number; modelUsed: string }> {
  const provider = getProviderBySlug(params.providerSlug);
  const { key: apiKey } = getProviderApiKey(params.providerSlug);
  const model = params.model?.trim() || provider.selectedModel;

  if (provider.catalog.requiresApiKey && !apiKey) {
    throw new Error(
      `Provider "${provider.name}" has no API key configured. Open AI Providers to add your key or use the Built-in Procedural Engine.`
    );
  }

  const start = Date.now();
  const dims = RESOLUTION_MAP[params.resolution] ?? RESOLUTION_MAP['1920x1080'];
  const baseProject = buildProceduralAnimationProject({
    id: params.id,
    batchId: params.batchId,
    name: params.name,
    prompt: params.prompt,
    category: params.category,
    animationType: params.animationType,
    visualStyle: params.visualStyle,
    backgroundMode: params.backgroundMode,
    backgroundColor: params.backgroundColor,
    resolution: params.resolution,
    durationSec: params.durationSec,
    fps: params.fps,
    targetPlatform: params.targetPlatform,
    seed: params.seed,
  });

  const sysPrompt = `You are a Principal Motion Graphics Director and Stock Footage Metadata Specialist for Adobe Stock and Shutterstock.
Design a commercial animation specification and marketplace metadata JSON for an animated ${dims.width}x${dims.height} (${params.durationSec}s @ ${params.fps}fps) production.
Rules:
- Background Mode is "${params.backgroundMode}". ${params.backgroundMode === 'green_screen' ? 'NEVER use green colors (#00FF00 or strong green hues) in foreground palette or layerOverrides to avoid chroma-key spill.' : ''}
- Palette: 5 harmonious hex colors.
- title: 40-130 chars, accurate commercial English title without trademarked names or spam terms.
- description: 60-200 chars describing motion, visual style, background, and stock use cases.
- keywords: 18-35 unique lowercase relevant stock keywords (no padding or trademarks).
- Return ONLY valid JSON matching the requested shape.`;

  const userMsg = `Prompt: ${params.prompt}
Category: ${params.category}
Animation Type: ${baseProject.animationType}
Visual Style: ${params.visualStyle}
Background Mode: ${params.backgroundMode}
Resolution: ${params.resolution}, Duration: ${params.durationSec}s, FPS: ${params.fps}
Existing Layers (${baseProject.layers.length}): ${baseProject.layers.map((l) => `${l.name} (${l.type})`).join(', ')}

Return JSON with keys: name, palette (5 hex strings), backgroundColor (hex), title, description, keywords (string[]), adobeCategory, shutterstockCategory, layerOverrides (array of {name, color, secondaryColor, label, count, speed}).`;

  let rawJsonText = '';

  if (params.providerSlug === 'gemini') {
    const ai = new GoogleGenAI({
      apiKey: apiKey!,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
    try {
      const resp = await withTransient503Retry(() =>
        withTimeout(
          ai.models.generateContent({
            model,
            contents: userMsg,
            config: {
              systemInstruction: sysPrompt,
              responseMimeType: 'application/json',
              ...getGeminiThinkingConfig(model, 'generate'),
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  palette: { type: Type.ARRAY, items: { type: Type.STRING } },
                  backgroundColor: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                  adobeCategory: { type: Type.STRING },
                  shutterstockCategory: { type: Type.STRING },
                  layerOverrides: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        color: { type: Type.STRING },
                        secondaryColor: { type: Type.STRING },
                        label: { type: Type.STRING },
                        count: { type: Type.NUMBER },
                        speed: { type: Type.NUMBER },
                      },
                    },
                  },
                },
                required: ['palette', 'title', 'description', 'keywords', 'adobeCategory', 'shutterstockCategory'],
              },
            },
          }),
          45000,
          `Gemini animation spec timed out after 45s on "${model}".`
        )
      );
      rawJsonText = (resp.text ?? '').trim();
    } catch (err) {
      const msg = formatUpstreamError(err, params.providerSlug, model);
      updateProviderRecordStatus(params.providerSlug, 'error', msg, null);
      throw new Error(msg);
    }
  } else {
    const baseUrl = provider.baseUrl.replace(/\/+$/, '');
    const endpoint =
      params.providerSlug === 'ollama'
        ? `${baseUrl}/v1/chat/completions`
        : `${baseUrl}/chat/completions`;
    const payloadBody: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userMsg },
      ],
      max_tokens: 2048,
    };
    if (['openai', 'groq', 'mistral', 'ollama'].includes(params.providerSlug)) {
      payloadBody.response_format = { type: 'json_object' };
    }
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...(params.providerSlug === 'openrouter'
          ? { 'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000', 'X-Title': 'StockForge Animation Studio' }
          : {}),
      },
      body: JSON.stringify(payloadBody),
      signal: AbortSignal.timeout(45000),
    });
    const rateLimits = extractRateLimitHeaders(resp.headers);
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      const msg = formatUpstreamError(
        new Error(`${provider.name} HTTP ${resp.status}: ${errText.slice(0, 500)}`),
        params.providerSlug,
        model
      );
      updateProviderRecordStatus(params.providerSlug, 'error', msg, rateLimits);
      throw new Error(msg);
    }
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    rawJsonText = data.choices?.[0]?.message?.content?.trim() || '';
    updateProviderRecordStatus(params.providerSlug, 'connected', null, rateLimits);
  }

  let cleaned = rawJsonText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();
  const fb = cleaned.indexOf('{');
  const lb = cleaned.lastIndexOf('}');
  if (fb !== -1 && lb > fb) cleaned = cleaned.slice(fb, lb + 1);

  const blueprint = JSON.parse(cleaned) as AiAnimationBlueprint;

  const nextPalette =
    Array.isArray(blueprint.palette) && blueprint.palette.length >= 3
      ? blueprint.palette.slice(0, 6).map((c) => sanitizeColorForGreenScreen(String(c), params.backgroundMode))
      : baseProject.palette;

  const mergedLayers: AnimationLayer[] = baseProject.layers.map((layer, idx) => {
    const ov = blueprint.layerOverrides?.[idx];
    if (!ov) {
      return {
        ...layer,
        color: sanitizeColorForGreenScreen(nextPalette[idx % nextPalette.length] || layer.color, params.backgroundMode),
        secondaryColor: sanitizeColorForGreenScreen(
          nextPalette[(idx + 1) % nextPalette.length] || layer.secondaryColor,
          params.backgroundMode
        ),
      };
    }
    return {
      ...layer,
      name: ov.name?.trim() ? ov.name.trim().slice(0, 60) : layer.name,
      color: ov.color ? sanitizeColorForGreenScreen(ov.color, params.backgroundMode) : layer.color,
      secondaryColor: ov.secondaryColor
        ? sanitizeColorForGreenScreen(ov.secondaryColor, params.backgroundMode)
        : layer.secondaryColor,
      params: {
        ...layer.params,
        ...(ov.label ? { label: String(ov.label).slice(0, 18) } : {}),
        ...(typeof ov.count === 'number' && ov.count >= 2 && ov.count <= 60 ? { count: Math.round(ov.count) } : {}),
        ...(typeof ov.speed === 'number' && ov.speed >= 0.3 && ov.speed <= 3.0 ? { speed: ov.speed } : {}),
      },
    };
  });

  const nextMetadata: AnimationMetadata = {
    title: String(blueprint.title || baseProject.metadata.title).trim().slice(0, 180),
    description: String(blueprint.description || baseProject.metadata.description).trim().slice(0, 200),
    keywords: normalizeKeywords(
      Array.isArray(blueprint.keywords) ? blueprint.keywords.map(String) : baseProject.metadata.keywords,
      { prompt: params.prompt, category: 'Abstract', style: params.visualStyle }
    ),
    adobeCategory: String(blueprint.adobeCategory || baseProject.metadata.adobeCategory),
    shutterstockCategory: String(blueprint.shutterstockCategory || baseProject.metadata.shutterstockCategory),
    targetPlatform: params.targetPlatform ?? 'both',
  };

  const finalProject: AnimationProject = {
    ...baseProject,
    name: params.name?.trim() || blueprint.name?.trim() || baseProject.name,
    backgroundColor:
      params.backgroundMode === 'green_screen'
        ? '#00FF00'
        : params.backgroundMode === 'transparent'
        ? 'transparent'
        : params.backgroundColor || blueprint.backgroundColor || baseProject.backgroundColor,
    palette: nextPalette,
    layers: mergedLayers,
    metadata: nextMetadata,
    providerSlug: params.providerSlug,
    model,
  };
  finalProject.projectHash = computeProjectHash(finalProject);

  if (params.providerSlug === 'gemini') {
    updateProviderRecordStatus('gemini', 'connected', null, null);
  }

  return {
    project: finalProject,
    latencyMs: Date.now() - start,
    modelUsed: model,
  };
}



