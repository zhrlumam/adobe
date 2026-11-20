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

export const api = {
  getDashboard: () => apiJson<DashboardSummary>('/api/dashboard'),

  getProviders: () => apiJson<{ providers: ProviderState[] }>('/api/providers'),

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

  generateAssets: (payload: {
    prompt: string;
    category: StockCategory;
    style: DesignStyle;
    quantity: number;
    targetPlatform: TargetPlatform;
    providerSlug?: ProviderSlug;
    model?: string;
  }) =>
    apiJson<{ assets: StockAsset[]; errors: string[] }>('/api/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAssets: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiJson<{
      assets: StockAsset[];
      adobeCategories: string[];
      shutterstockCategories: string[];
    }>(`/api/assets${qs}`);
  },

  getAsset: (id: string) => apiJson<{ asset: StockAsset }>(`/api/assets/${id}`),

  updateAsset: (
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
  ) =>
    apiJson<{ asset: StockAsset }>(`/api/assets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  regenerateAssetMetadata: (id: string) =>
    apiJson<{ asset: StockAsset }>(`/api/assets/${id}/regenerate-metadata`, {
      method: 'POST',
    }),

  deleteAsset: (id: string) =>
    apiJson<{ ok: boolean }>(`/api/assets/${id}`, { method: 'DELETE' }),

  getBatches: () => apiJson<{ batches: BatchJob[] }>('/api/batches'),

  createBatch: (payload: {
    name: string;
    basePrompt: string;
    category: StockCategory;
    style: DesignStyle;
    targetPlatform: TargetPlatform;
    requestedCount: number;
    concurrency: number;
    providerSlug?: ProviderSlug;
    model?: string;
  }) =>
    apiJson<{ batch: BatchJob }>('/api/batches', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getBatch: (id: string) => apiJson<{ batch: BatchJob }>(`/api/batches/${id}`),

  pauseBatch: (id: string) =>
    apiJson<{ batch: BatchJob }>(`/api/batches/${id}/pause`, { method: 'POST' }),

  resumeBatch: (id: string, retryFailed = false) =>
    apiJson<{ batch: BatchJob }>(`/api/batches/${id}/resume`, {
      method: 'POST',
      body: JSON.stringify({ retryFailed }),
    }),

  cancelBatch: (id: string) =>
    apiJson<{ batch: BatchJob }>(`/api/batches/${id}/cancel`, { method: 'POST' }),

  getLogs: (limit = 150) => apiJson<{ logs: ProductionLogEntry[] }>(`/api/logs?limit=${limit}`),

  getSettings: () =>
    apiJson<{ settings: SystemSettings; storageBytes: number; assetsDir: string }>(
      '/api/settings'
    ),

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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to export ${format.toUpperCase()}`);
  }
  const blob = await res.blob();
  triggerBlobDownload(blob, `${assetId}.${format}`);
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
  const res = await fetch('/api/export/bundle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
  const res = await fetch('/api/export/csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
