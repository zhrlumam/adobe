import type {
  AnimationBatchJob,
  AnimationCategory,
  AnimationExportFormat,
  AnimationProject,
  AnimationType,
  BackgroundMode,
  BatchJob,
  DashboardSummary,
  DesignStyle,
  FpsOption,
  ProductionLogEntry,
  ProviderSlug,
  ProviderState,
  ResolutionPreset,
  ReviewStatus,
  StockAsset,
  StockCategory,
  SystemDiagnostics,
  SystemSettings,
  TargetPlatform,
  VisualStyle,
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

export const ANIMATION_CATEGORIES: AnimationCategory[] = [
  'Motion Graphics',
  'Green Screen Animation',
  'Transparent Background Animation',
  'Business & Technology',
  'Nature & Environment',
  'Medical & Healthcare',
  'Educational & General Stock',
];

export const ANIMATION_TYPES_BY_CATEGORY: Record<
  AnimationCategory,
  { id: AnimationType; label: string }[]
> = {
  'Motion Graphics': [
    { id: 'gradient_bg', label: 'Flowing Gradient Background' },
    { id: 'geometric_motion', label: 'Geometric Kinetic Motion' },
    { id: 'particles', label: 'Particle Field Animation' },
    { id: 'light_trails', label: 'Light Trails & Streaks' },
    { id: 'energy', label: 'Energy Pulse Effect' },
    { id: 'fluid_waves', label: 'Fluid Abstract Waves' },
  ],
  'Green Screen Animation': [
    { id: 'cursor_click', label: 'Cursor Move & Click' },
    { id: 'ui_elements', label: 'Animated UI Controls' },
    { id: 'arrows', label: 'Motion Directional Arrows' },
    { id: 'notification', label: 'Notification Alert Pop' },
    { id: 'social_interaction', label: 'Social Like / Subscribe' },
    { id: 'hud', label: 'HUD Telemetry Overlay' },
  ],
  'Transparent Background Animation': [
    { id: 'smoke', label: 'Rising Smoke Dispersion' },
    { id: 'fire', label: 'Flame & Ember Overlay' },
    { id: 'sparkles', label: 'Starlight Sparkles' },
    { id: 'particles', label: 'Glowing Floating Particles' },
    { id: 'energy', label: 'Energy Burst Overlay' },
    { id: 'ui_elements', label: 'Explainer UI Badge' },
  ],
  'Business & Technology': [
    { id: 'data_chart', label: 'Animated Financial Chart' },
    { id: 'network', label: 'Network Node Connections' },
    { id: 'cloud_security', label: 'Cloud & Cyber Security' },
    { id: 'ui_elements', label: 'SaaS Interface Element' },
  ],
  'Nature & Environment': [
    { id: 'ocean_water', label: 'Ocean & Water Waves' },
    { id: 'falling_leaves', label: 'Falling Leaves' },
    { id: 'rain_snow', label: 'Rain & Snow Atmosphere' },
    { id: 'clouds_wind', label: 'Clouds & Wind Motion' },
    { id: 'plant_growth', label: 'Botanical Growth' },
    { id: 'particles', label: 'Natural Pollen / Dust' },
  ],
  'Medical & Healthcare': [
    { id: 'heartbeat_ecg', label: 'Heartbeat ECG Trace' },
    { id: 'medical_icons', label: 'Medical & Clinical Pulse' },
  ],
  'Educational & General Stock': [
    { id: 'science_atom', label: 'Atomic Orbit Simulation' },
    { id: 'math_geometry', label: 'Mathematical Geometry' },
    { id: 'industry_gears', label: 'Interlocking Industry Gears' },
    { id: 'arrows', label: 'Diagram Flow Arrows' },
  ],
};

export const VISUAL_STYLES: VisualStyle[] = [
  'Clean Vector Motion',
  'Luminous Gradient',
  'Minimal HUD',
  'Isometric Tech',
  'Organic Fluid',
  'Broadcast Flat',
];

export const RESOLUTIONS: { id: ResolutionPreset; label: string }[] = [
  { id: '1920x1080', label: 'HD 1920×1080 (16:9)' },
  { id: '3840x2160', label: '4K UHD 3840×2160 (16:9)' },
  { id: '1080x1920', label: 'Vertical 1080×1920 (9:16)' },
  { id: '1080x1080', label: 'Square 1080×1080 (1:1)' },
];

export const FPS_OPTIONS: FpsOption[] = [24, 25, 30, 60];

export const EXPORT_FORMAT_LABELS: Record<
  AnimationExportFormat,
  { label: string; ext: string; note: string }
> = {
  mp4_h264: { label: 'MP4 H.264 Master', ext: '.mp4', note: 'libx264 commercial delivery' },
  mov_prores: { label: 'MOV ProRes 422 HQ', ext: '.mov', note: 'Broadcast editing master' },
  mov_alpha: { label: 'MOV ProRes 4444 Alpha', ext: '.mov', note: 'yuva444p10le transparency' },
  png_sequence: { label: 'PNG RGBA Sequence ZIP', ext: '.zip', note: 'Lossless frame-by-frame alpha' },
  mp4_preview: { label: 'MP4 Web Preview', ext: '.mp4', note: '640p fast playback stream' },
  gif_preview: { label: 'Animated GIF Preview', ext: '.gif', note: 'Palette-optimized loop' },
  thumbnail_png: { label: 'Static Poster PNG', ext: '.png', note: 'Mid-frame 640px preview' },
  svg_animated: { label: 'Animated SMIL SVG', ext: '.svg', note: 'Editable vector source' },
  lottie_json: { label: 'Lottie JSON (v5.7.4)', ext: '.json', note: 'Web & mobile vector motion' },
  source_zip: { label: 'Full Project Source ZIP', ext: '.zip', note: 'Project JSON + SVG + Lottie' },
};

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
        throw new Error(`Request failed (HTTP ${res.status})`);
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
  getDiagnostics: () => apiJson<SystemDiagnostics>('/api/diagnostics'),

  // Providers
  getProviders: () => apiJson<{ providers: ProviderState[]; isServerless?: boolean }>('/api/providers'),
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

  // Animation Projects
  listAnimations: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiJson<{
      projects: AnimationProject[];
      adobeCategories: string[];
      shutterstockCategories: string[];
    }>(`/api/animations${qs}`);
  },
  getAnimation: (id: string) =>
    apiJson<{ project: AnimationProject }>(`/api/animations/${encodeURIComponent(id)}`),
  getAnimationSource: (id: string) =>
    apiJson<{ svgAnimated: string; lottieJson: Record<string, unknown>; project: AnimationProject }>(
      `/api/animations/${encodeURIComponent(id)}/source`
    ),
  createAnimation: (payload: {
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
    providerSlug?: ProviderSlug | 'procedural';
    model?: string;
    exportFormats?: AnimationExportFormat[];
    renderNow?: boolean;
  }) =>
    apiJson<{ project: AnimationProject; error?: string }>('/api/animations/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAnimation: (
    id: string,
    payload: Partial<AnimationProject> & {
      reRender?: boolean;
      exportFormats?: AnimationExportFormat[];
    }
  ) =>
    apiJson<{ project: AnimationProject }>(`/api/animations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  renderAnimation: (id: string, exportFormats?: AnimationExportFormat[]) =>
    apiJson<{ project: AnimationProject; error?: string }>(
      `/api/animations/${encodeURIComponent(id)}/render`,
      {
        method: 'POST',
        body: JSON.stringify({ exportFormats }),
      }
    ),
  duplicateAnimation: (id: string) =>
    apiJson<{ project: AnimationProject }>(
      `/api/animations/${encodeURIComponent(id)}/duplicate`,
      { method: 'POST' }
    ),
  reviewAnimation: (id: string, reviewStatus: ReviewStatus) =>
    apiJson<{ project: AnimationProject }>(
      `/api/animations/${encodeURIComponent(id)}/review`,
      {
        method: 'POST',
        body: JSON.stringify({ reviewStatus }),
      }
    ),
  regenerateAnimationMetadata: (id: string) =>
    apiJson<{ project: AnimationProject }>(
      `/api/animations/${encodeURIComponent(id)}/regenerate-metadata`,
      { method: 'POST' }
    ),
  deleteAnimation: (id: string) =>
    apiJson<{ ok: boolean }>(`/api/animations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  getFrameSvg: (id: string, timeSec: number, projectOverride?: Partial<AnimationProject>) =>
    apiJson<{ svg: string; timeSec: number }>(
      `/api/animations/${encodeURIComponent(id)}/frame-svg`,
      {
        method: 'POST',
        body: JSON.stringify({ timeSec, projectOverride }),
      }
    ),

  // Animation Batches
  listAnimationBatches: () =>
    apiJson<{ batches: AnimationBatchJob[] }>('/api/animation-batches'),
  createAnimationBatch: (payload: {
    name: string;
    basePrompt: string;
    category: AnimationCategory;
    animationType: AnimationType | 'mixed';
    visualStyle: VisualStyle;
    backgroundMode: BackgroundMode;
    resolution: ResolutionPreset;
    durationSec: number;
    fps: FpsOption;
    providerSlug: ProviderSlug | 'procedural';
    model: string;
    requestedCount: number;
    concurrency: number;
    exportFormats: AnimationExportFormat[];
  }) =>
    apiJson<{ batch: AnimationBatchJob }>('/api/animation-batches', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAnimationBatch: (id: string) =>
    apiJson<{ batch: AnimationBatchJob }>(`/api/animation-batches/${encodeURIComponent(id)}`),
  pauseAnimationBatch: (id: string) =>
    apiJson<{ batch: AnimationBatchJob }>(
      `/api/animation-batches/${encodeURIComponent(id)}/pause`,
      { method: 'POST' }
    ),
  resumeAnimationBatch: (id: string, retryFailed = false) =>
    apiJson<{ batch: AnimationBatchJob }>(
      `/api/animation-batches/${encodeURIComponent(id)}/resume`,
      { method: 'POST', body: JSON.stringify({ retryFailed }) }
    ),
  cancelAnimationBatch: (id: string) =>
    apiJson<{ batch: AnimationBatchJob }>(
      `/api/animation-batches/${encodeURIComponent(id)}/cancel`,
      { method: 'POST' }
    ),

  // Legacy vector & settings endpoints
  getAssets: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiJson<{
      assets: StockAsset[];
      adobeCategories: string[];
      shutterstockCategories: string[];
    }>(`/api/assets${qs}`);
  },
  getBatches: () => apiJson<{ batches: BatchJob[] }>('/api/batches'),
  getLogs: (limit = 150) => apiJson<{ logs: ProductionLogEntry[] }>(`/api/logs?limit=${limit}`),
  getSettings: () =>
    apiJson<{
      settings: SystemSettings;
      storageBytes: number;
      assetsDir: string;
      isServerless?: boolean;
    }>('/api/settings'),
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

export function outputFileUrl(relativePath?: string | null): string | null {
  if (!relativePath) return null;
  const clean = relativePath.replace(/^\/+/, '');
  return `/api/output-file/${clean.split('/').map(encodeURIComponent).join('/')}`;
}

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

export async function downloadAnimationFormat(
  projectId: string,
  format: AnimationExportFormat
): Promise<void> {
  const res = await fetch(
    `/api/animations/${encodeURIComponent(projectId)}/download/${encodeURIComponent(format)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to export ${format}`);
  }
  const blob = await res.blob();
  const extInfo = EXPORT_FORMAT_LABELS[format];
  const filename =
    format === 'mov_alpha'
      ? `${projectId}-alpha.mov`
      : format === 'mov_prores'
      ? `${projectId}-prores.mov`
      : format === 'png_sequence'
      ? `${projectId}-png-sequence.zip`
      : format === 'source_zip'
      ? `${projectId}-source.zip`
      : format === 'mp4_preview'
      ? `${projectId}-preview.mp4`
      : format === 'gif_preview'
      ? `${projectId}-preview.gif`
      : format === 'thumbnail_png'
      ? `${projectId}-thumb.png`
      : `${projectId}${extInfo?.ext || '.bin'}`;
  triggerBlobDownload(blob, filename);
}

export async function downloadAnimationCsv(payload: {
  projectIds?: string[];
  batchId?: string;
  platform: 'adobe_stock' | 'shutterstock';
  fileExtension?: 'mp4' | 'mov' | 'svg';
}): Promise<void> {
  const res = await fetch('/api/animations/export-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'CSV export failed');
  }
  const blob = await res.blob();
  const filename =
    payload.platform === 'shutterstock'
      ? 'shutterstock-animations.csv'
      : 'adobe-stock-animations.csv';
  triggerBlobDownload(blob, filename);
}

export async function downloadAnimationZip(payload: {
  projectIds?: string[];
  batchId?: string;
  formats: AnimationExportFormat[];
  includeAdobeCsv: boolean;
  includeShutterstockCsv: boolean;
}): Promise<void> {
  const res = await fetch('/api/animations/export-zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'ZIP export failed');
  }
  const blob = await res.blob();
  const filename = payload.batchId
    ? `${payload.batchId}-animations.zip`
    : 'stockforge-animations-bundle.zip';
  triggerBlobDownload(blob, filename);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
