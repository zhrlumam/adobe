import type {
  BatchJob,
  DashboardSummary,
  DesignStyle,
  ProductionLogEntry,
  ProviderSlug,
  ProviderState,
  StockAsset,
  StockCategory,
  SystemSettings,
  TargetPlatform,
} from '../types/stockforge';
import {
  deleteServerlessAsset,
  getServerlessAsset,
  getServerlessAssets,
  getServerlessBatch,
  getServerlessBatches,
  getServerlessRuntimeFlag,
  mergeAssets,
  mergeBatches,
  saveServerlessAssets,
  saveServerlessBatches,
  setServerlessRuntimeFlag,
} from './serverlessStore';

export const STOCK_CATEGORIES: StockCategory[] = [
  'Abstract',
  'Business',
  'Technology',
  'Education',
  'Animals',
  'Nature',
  'Food',
  'Medical',
  'Objects',
  'Backgrounds',
  'Icons',
  'Patterns',
  'Custom',
];

export const DESIGN_STYLES: DesignStyle[] = [
  'Flat Geometric',
  'Isometric Vector',
  'Minimal Line Art',
  'Duotone Editorial',
  'Organic Botanical',
  'Gradient Mesh Vector',
  'Bold Emblem',
  'Technical Blueprint',
];

export const TARGET_PLATFORMS: { id: TargetPlatform; label: string }[] = [
  { id: 'both', label: 'Adobe Stock + Shutterstock' },
  { id: 'adobe_stock', label: 'Adobe Stock' },
  { id: 'shutterstock', label: 'Shutterstock' },
];

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      if (!res.ok) {
        throw new Error(
          `Request failed (HTTP ${res.status}${res.status === 504 ? ' Gateway Timeout — upstream AI model took too long; try gemini-3.1-flash-lite or Groq' : ''})`
        );
      }
      throw new Error(`Unexpected non-JSON response from ${url} (HTTP ${res.status})`);
    }
  }
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' && data.error
        ? data.error
        : `Request failed (${res.status})`
    );
  }
  return data as T;
}

function filterAssetsByParams(assets: StockAsset[], params?: Record<string, string>): StockAsset[] {
  if (!params) return assets;
  const q = String(params.q ?? '').trim().toLowerCase();
  const category = String(params.category ?? 'all');
  const style = String(params.style ?? 'all');
  const platform = String(params.platform ?? 'all');
  const batchId = String(params.batchId ?? '');
  const status = String(params.status ?? 'all');

  return assets.filter((a) => {
    if (category !== 'all' && a.category !== category) return false;
    if (style !== 'all' && a.style !== style) return false;
    if (platform !== 'all' && a.targetPlatform !== platform && a.targetPlatform !== 'both') {
      return false;
    }
    if (batchId && a.batchId !== batchId) return false;
    if (status === 'ready' && !a.validation.commercialReady) return false;
    if (status === 'issues' && a.validation.commercialReady) return false;
    if (q) {
      const hit =
        a.id.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.prompt.toLowerCase().includes(q) ||
        a.keywords.some((k) => k.toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });
}

async function syncCompletedBatchAssets(batch: BatchJob): Promise<void> {
  if (!getServerlessRuntimeFlag() || !batch.items || batch.items.length === 0) return;
  const completedIds = batch.items
    .filter((i) => i.status === 'completed' && typeof i.assetId === 'string' && i.assetId)
    .map((i) => i.assetId as string);
  if (completedIds.length === 0) return;

  for (const assetId of completedIds) {
    const cached = await getServerlessAsset(assetId);
    if (!cached) {
      try {
        const res = await apiJson<{ asset: StockAsset }>(
          `/api/assets/${encodeURIComponent(assetId)}`
        );
        if (res?.asset) {
          await saveServerlessAssets([res.asset]);
        }
      } catch {
        // ignore if asset already evicted from warm Lambda
      }
    }
  }
}

export const api = {
  getDashboard: async (): Promise<DashboardSummary> => {
    const data = await apiJson<DashboardSummary>('/api/dashboard');
    if (typeof data.isServerless === 'boolean') {
      setServerlessRuntimeFlag(data.isServerless);
    }
    if (!data.isServerless) {
      return data;
    }

    await saveServerlessAssets(data.recentAssets ?? []);
    const [localAssets, localBatches] = await Promise.all([
      getServerlessAssets(),
      getServerlessBatches(),
    ]);
    const mergedAssets = mergeAssets(data.recentAssets ?? [], localAssets);

    const categoryMap = new Map<string, number>();
    let cachedSvgBytes = 0;
    for (const a of mergedAssets) {
      categoryMap.set(a.category, (categoryMap.get(a.category) ?? 0) + 1);
      if (a.svgContent) cachedSvgBytes += a.svgContent.length;
    }
    const categoryBreakdown =
      mergedAssets.length >= data.totalAssets
        ? Array.from(categoryMap.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count)
        : data.categoryBreakdown;

    return {
      ...data,
      totalAssets: Math.max(data.totalAssets, mergedAssets.length),
      commercialReadyAssets: Math.max(
        data.commercialReadyAssets,
        mergedAssets.filter((a) => a.validation.commercialReady).length
      ),
      totalBatches: Math.max(data.totalBatches, localBatches.length),
      storageBytes: Math.max(data.storageBytes, cachedSvgBytes),
      recentAssets: mergedAssets.slice(0, 6),
      categoryBreakdown,
    };
  },

  getProviders: async () => {
    const data = await apiJson<{ providers: ProviderState[]; isServerless?: boolean }>(
      '/api/providers'
    );
    if (typeof data.isServerless === 'boolean') {
      setServerlessRuntimeFlag(data.isServerless);
    }
    return data;
  },

  saveProviderConfig: (
    slug: ProviderSlug,
    payload: {
      apiKey?: string;
      clearApiKey?: boolean;
      baseUrl?: string;
      selectedModel?: string;
      validateBeforeSave?: boolean;
    }
  ) =>
    apiJson<{ provider: ProviderState }>(`/api/providers/${slug}/config`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  testProvider: (
    slug: ProviderSlug,
    payload?: { apiKey?: string; baseUrl?: string; selectedModel?: string }
  ) =>
    apiJson<{
      ok: boolean;
      latencyMs: number;
      models: string[];
      rateLimitInfo: Record<string, string> | null;
      error?: string;
      provider: ProviderState;
    }>(`/api/providers/${slug}/test`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),

  activateProvider: (slug: ProviderSlug) =>
    apiJson<{ provider: ProviderState; providers: ProviderState[] }>(
      `/api/providers/${slug}/activate`,
      { method: 'POST' }
    ),

  generateAssets: async (payload: {
    prompt: string;
    category: StockCategory;
    style: DesignStyle;
    quantity: number;
    targetPlatform: TargetPlatform;
    providerSlug?: ProviderSlug;
    model?: string;
  }) => {
    const res = await apiJson<{ assets: StockAsset[]; errors: string[] }>('/api/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (getServerlessRuntimeFlag() && Array.isArray(res.assets) && res.assets.length > 0) {
      await saveServerlessAssets(res.assets);
    }
    return res;
  },

  getAssets: async (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const data = await apiJson<{
      assets: StockAsset[];
      adobeCategories: string[];
      shutterstockCategories: string[];
    }>(`/api/assets${qs}`);

    if (!getServerlessRuntimeFlag()) {
      return data;
    }

    await saveServerlessAssets(data.assets ?? []);
    const localAssets = await getServerlessAssets();
    const merged = mergeAssets(data.assets ?? [], localAssets);
    return {
      ...data,
      assets: filterAssetsByParams(merged, params),
    };
  },

  getAsset: async (id: string) => {
    try {
      const res = await apiJson<{ asset: StockAsset }>(`/api/assets/${encodeURIComponent(id)}`);
      if (getServerlessRuntimeFlag() && res.asset) {
        await saveServerlessAssets([res.asset]);
      }
      return res;
    } catch (err) {
      if (getServerlessRuntimeFlag()) {
        const cached = await getServerlessAsset(id);
        if (cached) {
          return { asset: cached };
        }
      }
      throw err;
    }
  },

  updateAsset: async (
    id: string,
    payload: Partial<{
      title: string;
      description: string;
      keywords: string[];
      adobeCategory: string;
      shutterstockCategory: string;
      targetPlatform: TargetPlatform;
      svgContent: string;
    }>
  ) => {
    const fallbackAsset = getServerlessRuntimeFlag() ? await getServerlessAsset(id) : null;
    const res = await apiJson<{ asset: StockAsset }>(`/api/assets/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(fallbackAsset ? { ...payload, fallbackAsset } : payload),
    });
    if (getServerlessRuntimeFlag() && res.asset) {
      await saveServerlessAssets([res.asset]);
    }
    return res;
  },

  regenerateAssetMetadata: async (id: string) => {
    const fallbackAsset = getServerlessRuntimeFlag() ? await getServerlessAsset(id) : null;
    const res = await apiJson<{ asset: StockAsset }>(
      `/api/assets/${encodeURIComponent(id)}/regenerate-metadata`,
      {
        method: 'POST',
        body: JSON.stringify(fallbackAsset ? { fallbackAsset } : {}),
      }
    );
    if (getServerlessRuntimeFlag() && res.asset) {
      await saveServerlessAssets([res.asset]);
    }
    return res;
  },

  deleteAsset: async (id: string) => {
    const res = await apiJson<{ ok: boolean }>(`/api/assets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (getServerlessRuntimeFlag()) {
      await deleteServerlessAsset(id);
    }
    return res;
  },

  getBatches: async () => {
    const data = await apiJson<{ batches: BatchJob[]; isServerless?: boolean }>('/api/batches');
    if (typeof data.isServerless === 'boolean') {
      setServerlessRuntimeFlag(data.isServerless);
    }
    if (!getServerlessRuntimeFlag()) {
      return data;
    }
    await saveServerlessBatches(data.batches ?? []);
    const localBatches = await getServerlessBatches();
    return {
      ...data,
      batches: mergeBatches(data.batches ?? [], localBatches),
    };
  },

  createBatch: async (payload: {
    name: string;
    basePrompt: string;
    category: StockCategory;
    style: DesignStyle;
    targetPlatform: TargetPlatform;
    requestedCount: number;
    concurrency: number;
    providerSlug?: ProviderSlug;
    model?: string;
  }) => {
    const res = await apiJson<{ batch: BatchJob; isServerless?: boolean }>('/api/batches', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (typeof res.isServerless === 'boolean') {
      setServerlessRuntimeFlag(res.isServerless);
    }
    if (getServerlessRuntimeFlag() && res.batch) {
      await saveServerlessBatches([res.batch]);
    }
    return res;
  },

  getBatch: async (id: string) => {
    try {
      const res = await apiJson<{ batch: BatchJob; isServerless?: boolean }>(
        `/api/batches/${encodeURIComponent(id)}`
      );
      if (typeof res.isServerless === 'boolean') {
        setServerlessRuntimeFlag(res.isServerless);
      }
      if (getServerlessRuntimeFlag() && res.batch) {
        await saveServerlessBatches([res.batch]);
        await syncCompletedBatchAssets(res.batch);
      }
      return res;
    } catch (err) {
      if (getServerlessRuntimeFlag()) {
        const cached = await getServerlessBatch(id);
        if (cached) {
          return { batch: cached, isServerless: true };
        }
      }
      throw err;
    }
  },

  stepBatch: async (id: string) => {
    const res = await apiJson<{ batch: BatchJob; isServerless?: boolean }>(
      `/api/batches/${encodeURIComponent(id)}/step`,
      { method: 'POST' }
    );
    if (typeof res.isServerless === 'boolean') {
      setServerlessRuntimeFlag(res.isServerless);
    }
    if (getServerlessRuntimeFlag() && res.batch) {
      await saveServerlessBatches([res.batch]);
      await syncCompletedBatchAssets(res.batch);
    }
    return res;
  },

  pauseBatch: async (id: string) => {
    const res = await apiJson<{ batch: BatchJob }>(
      `/api/batches/${encodeURIComponent(id)}/pause`,
      { method: 'POST' }
    );
    if (getServerlessRuntimeFlag() && res.batch) {
      await saveServerlessBatches([res.batch]);
    }
    return res;
  },

  resumeBatch: async (id: string, retryFailed = false) => {
    const res = await apiJson<{ batch: BatchJob }>(
      `/api/batches/${encodeURIComponent(id)}/resume`,
      {
        method: 'POST',
        body: JSON.stringify({ retryFailed }),
      }
    );
    if (getServerlessRuntimeFlag() && res.batch) {
      await saveServerlessBatches([res.batch]);
    }
    return res;
  },

  cancelBatch: async (id: string) => {
    const res = await apiJson<{ batch: BatchJob }>(
      `/api/batches/${encodeURIComponent(id)}/cancel`,
      { method: 'POST' }
    );
    if (getServerlessRuntimeFlag() && res.batch) {
      await saveServerlessBatches([res.batch]);
    }
    return res;
  },

  getLogs: (limit = 150) => apiJson<{ logs: ProductionLogEntry[] }>(`/api/logs?limit=${limit}`),

  getSettings: async () => {
    const data = await apiJson<{
      settings: SystemSettings;
      storageBytes: number;
      assetsDir: string;
      isServerless?: boolean;
    }>('/api/settings');
    if (typeof data.isServerless === 'boolean') {
      setServerlessRuntimeFlag(data.isServerless);
    }
    return data;
  },

  saveSettings: (settings: Partial<SystemSettings>) =>
    apiJson<{ settings: SystemSettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  getBackups: () =>
    apiJson<{ backups: { filename: string; sizeBytes: number; createdAt: string }[] }>(
      '/api/backups'
    ),

  createBackup: () =>
    apiJson<{
      backup: { filename: string; sizeBytes: number; assetCount: number };
      backups: { filename: string; sizeBytes: number; createdAt: string }[];
    }>('/api/backups', { method: 'POST' }),
};

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadAssetFormat(
  assetId: string,
  format: 'svg' | 'eps' | 'png' | 'jpg'
): Promise<void> {
  const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}/export/${format}`);
  if (res.ok) {
    const blob = await res.blob();
    triggerBlobDownload(blob, `${assetId}.${format}`);
    return;
  }

  if (getServerlessRuntimeFlag()) {
    const cached = await getServerlessAsset(assetId);
    if (cached?.svgContent) {
      const statelessRes = await fetch('/api/export/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cached.id,
          title: cached.title,
          svgContent: cached.svgContent,
          format,
        }),
      });
      if (statelessRes.ok) {
        const blob = await statelessRes.blob();
        triggerBlobDownload(blob, `${assetId}.${format}`);
        return;
      }
      const statelessErr = await statelessRes.json().catch(() => ({}));
      throw new Error(statelessErr.error || `Failed to export ${format.toUpperCase()}`);
    }
  }

  const err = await res.json().catch(() => ({}));
  throw new Error(err.error || `Failed to export ${format.toUpperCase()}`);
}

async function getMatchingCachedAssets(payload: {
  assetIds?: string[];
  batchId?: string;
}): Promise<StockAsset[] | undefined> {
  if (!getServerlessRuntimeFlag()) return undefined;
  const cached = await getServerlessAssets();
  if (cached.length === 0) return undefined;
  if (Array.isArray(payload.assetIds) && payload.assetIds.length > 0) {
    const idSet = new Set(payload.assetIds);
    return cached.filter((a) => idSet.has(a.id));
  }
  if (payload.batchId) {
    return cached.filter((a) => a.batchId === payload.batchId);
  }
  return cached;
}

export async function downloadExportBundle(payload: {
  assetIds?: string[];
  batchId?: string;
  formats: ('svg' | 'eps' | 'png' | 'jpg')[];
  includeAdobeCsv: boolean;
  includeShutterstockCsv: boolean;
  rasterSize?: number;
  jpgQuality?: number;
}): Promise<void> {
  const cachedAssets = await getMatchingCachedAssets(payload);
  const res = await fetch('/api/export/bundle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cachedAssets ? { ...payload, assets: cachedAssets } : payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create export bundle');
  }
  const blob = await res.blob();
  const filename = payload.batchId
    ? `${payload.batchId}-bundle.zip`
    : 'stockforge-export-bundle.zip';
  triggerBlobDownload(blob, filename);
}

export async function downloadMetadataCsv(payload: {
  assetIds?: string[];
  batchId?: string;
  platform: 'adobe_stock' | 'shutterstock';
  fileExtension?: 'eps' | 'svg' | 'png' | 'jpg';
}): Promise<void> {
  const cachedAssets = await getMatchingCachedAssets(payload);
  const res = await fetch('/api/export/csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cachedAssets ? { ...payload, assets: cachedAssets } : payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate CSV');
  }
  const blob = await res.blob();
  const filename =
    payload.platform === 'shutterstock'
      ? 'shutterstock-metadata.csv'
      : 'adobe-stock-metadata.csv';
  triggerBlobDownload(blob, filename);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
