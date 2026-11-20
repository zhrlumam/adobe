import { GoogleGenAI, Type } from '@google/genai';
import type {
  DesignStyle,
  ProviderCatalogEntry,
  ProviderSlug,
  ProviderState,
  ProviderStatus,
  StockCategory,
  TargetPlatform,
} from '../src/types/stockforge.ts';
import {
  addProductionLog,
  db,
  getProviderApiKey,
  maskApiKey,
  setProviderApiKey,
  updateProviderRecordStatus,
} from './db.ts';

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
        id: 'gemini-4-hydrogen',
        label: 'Gemini 4 Hydrogen (Free Tier Default)',
        tier: 'free',
        notes: 'Recommended free-tier model for clean SVG geometry and stock metadata.',
      },
      {
        id: 'gemini-3.1-flash-lite',
        label: 'Gemini 3.1 Flash-Lite',
        tier: 'free',
        notes: 'High-throughput lightweight model for large batch runs.',
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
      const ai = new GoogleGenAI({
        apiKey: apiKey!,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const response = await ai.models.generateContent({
        model: model || 'gemini-4-hydrogen',
        contents: 'Reply with OK',
      });
      if (!response.text) {
        throw new Error('Empty response returned from Gemini API.');
      }
      const latencyMs = Date.now() - start;
      const models = provider.catalog.recommendedModels.map((m) => m.id);
      updateProviderRecordStatus(slug, 'connected', null, null);
      addProductionLog({
        eventType: 'connection_test',
        providerSlug: slug,
        model,
        status: 'success',
        latencyMs,
        message: `Verified Gemini connection with ${model}`,
      });
      return { ok: true, latencyMs, models, rateLimitInfo: null };
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

    // OpenAI-compatible providers: Groq, OpenRouter, Mistral, Hugging Face, Custom
    let discoveredModels: string[] = [];
    let rateLimits: Record<string, string> | null = null;

    if (slug !== 'huggingface') {
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
          ? { 'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000', 'X-Title': 'StockForge Studio' }
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
    const message = err instanceof Error ? err.message : String(err);
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
  svg: string;
  title: string;
  description: string;
  keywords: string[];
  adobeCategory: string;
  shutterstockCategory: string;
}

const VECTOR_SYSTEM_INSTRUCTION = `You are a Principal Commercial Stock Vector Illustrator and Metadata Specialist for Adobe Stock and Shutterstock.
Your task is to create an original, high-craft, commercially sellable vector illustration as clean SVG XML AND accurate stock metadata.

STRICT SVG ENGINEERING RULES:
1. Output a single standalone <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"> element.
2. EVERY visual element MUST be genuine editable vector geometry (<path>, <circle>, <rect>, <ellipse>, <polygon>, <polyline>, <line>, organized inside clean <g> layer groups, optional <defs> with <linearGradient>/<radialGradient>).
3. NEVER include <image>, data:image/*, <foreignObject>, <script>, onload/onclick handlers, external URLs, or <text> elements (unless outlined as paths — prefer pure vector shapes without <text>).
4. Craft rich, layered, balanced compositions on the 1000x1000 artboard (10 to 45 crisp vector primitives with cohesive color harmonies, highlights, shadows, and clean silhouettes).
5. Avoid sloppy overlapping shapes or empty canvases; fill 65%-85% of the artboard cleanly with strong figure-ground contrast.

STRICT STOCK METADATA RULES:
- title: 45-120 characters, clear commercial description, NO trademarked brands, NO words like "vector", "eps", "svg", "ai generated".
- description: 80-200 characters describing subject, style, mood, and commercial usage.
- keywords: 18-35 unique, single or two-word lowercase tags directly describing the subject, style, colors, and concepts (NO keyword stuffing, NO duplicates).
- adobeCategory: Pick the single best Adobe Stock category (Abstract, Animals, Business, Education, Food, Graphic Resources, Landscapes, Lifestyle, Medical, Nature, Objects, Science, Technology, Transport).
- shutterstockCategory: Pick the single best Shutterstock category (Abstract, Animals/Wildlife, Backgrounds/Textures, Business/Finance, Education, Food and Drink, Healthcare/Medical, Icons, Nature, Objects, Science, Technology).

Return ONLY valid JSON matching the requested schema.`;

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

  const userPrompt = [
    `Subject Prompt: ${params.prompt}`,
    `Stock Category: ${params.category}`,
    `Visual Style: ${params.style}`,
    `Target Marketplace: ${params.targetPlatform === 'both' ? 'Adobe Stock & Shutterstock' : params.targetPlatform}`,
    params.variationDirective ? `Unique Variation Directive: ${params.variationDirective}` : '',
    'Produce an original, publication-grade editable SVG (viewBox="0 0 1000 1000") and commercial stock metadata JSON.',
  ]
    .filter(Boolean)
    .join('\n');

  const start = Date.now();

  if (params.providerSlug === 'gemini') {
    const ai = new GoogleGenAI({
      apiKey: apiKey!,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const response = await ai.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: VECTOR_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            svg: {
              type: Type.STRING,
              description: 'Complete standalone <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">...</svg> code.',
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
          required: ['svg', 'title', 'description', 'keywords', 'adobeCategory', 'shutterstockCategory'],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      throw new Error('Gemini returned an empty response.');
    }
    const parsed = parseJsonPayload(rawText);
    const latencyMs = Date.now() - start;
    updateProviderRecordStatus(params.providerSlug, 'connected', null, null);
    return { payload: parsed, latencyMs, modelUsed: model };
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
          '\n\nRespond ONLY with a single JSON object with keys: "svg", "title", "description", "keywords" (string[]), "adobeCategory", "shutterstockCategory".',
      },
    ],
    max_tokens: 4096,
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
            'X-Title': 'StockForge Studio',
          }
        : {}),
    },
    body: JSON.stringify(bodyPayload),
    signal: AbortSignal.timeout(90000),
  });

  const rateLimits = extractRateLimitHeaders(resp.headers);
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    const msg = `${provider.name} HTTP ${resp.status}: ${errText.slice(0, 400)}`;
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
    const resp = await ai.models.generateContent({
      model,
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            adobeCategory: { type: Type.STRING },
            shutterstockCategory: { type: Type.STRING },
          },
          required: ['title', 'description', 'keywords', 'adobeCategory', 'shutterstockCategory'],
        },
      },
    });
    const json = JSON.parse((resp.text ?? '{}').trim());
    return {
      title: String(json.title || params.prompt).slice(0, 180),
      description: String(json.description || params.prompt).slice(0, 200),
      keywords: Array.isArray(json.keywords) ? json.keywords.map(String) : [],
      adobeCategory: String(json.adobeCategory || 'Graphic Resources'),
      shutterstockCategory: String(json.shutterstockCategory || 'Vectors'),
    };
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
