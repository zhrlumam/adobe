export type StockCategory =
  | 'Abstract'
  | 'Business'
  | 'Technology'
  | 'Education'
  | 'Animals'
  | 'Nature'
  | 'Food'
  | 'Medical'
  | 'Objects'
  | 'Backgrounds'
  | 'Icons'
  | 'Patterns'
  | 'Custom';

export type DesignStyle =
  | 'Flat Geometric'
  | 'Isometric Vector'
  | 'Minimal Line Art'
  | 'Duotone Editorial'
  | 'Organic Botanical'
  | 'Gradient Mesh Vector'
  | 'Bold Emblem'
  | 'Technical Blueprint';

export type TargetPlatform = 'both' | 'adobe_stock' | 'shutterstock';

export type ProviderSlug =
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'mistral'
  | 'huggingface'
  | 'ollama'
  | 'custom';

export type ProviderStatus = 'connected' | 'unconfigured' | 'error';

export interface ProviderCatalogEntry {
  slug: ProviderSlug;
  name: string;
  description: string;
  officialUrl: string;
  apiKeyUrl: string;
  setupSteps: string[];
  requiresApiKey: boolean;
  freeTierSummary: string;
  rateLimitsSummary: string;
  structuredOutputSupport: string;
  commercialTerms: string;
  defaultBaseUrl: string;
  recommendedModels: {
    id: string;
    label: string;
    tier: 'free' | 'paid' | 'local';
    notes: string;
  }[];
}

export interface ProviderState {
  slug: ProviderSlug;
  name: string;
  baseUrl: string;
  selectedModel: string;
  isActive: boolean;
  status: ProviderStatus;
  hasKey: boolean;
  envManaged: boolean;
  keyHint: string | null;
  lastTestedAt: string | null;
  lastError: string | null;
  rateLimitInfo: Record<string, string> | null;
  availableModels: string[];
  catalog: ProviderCatalogEntry;
}

export interface SvgValidationReport {
  validXml: boolean;
  hasSvgRoot: boolean;
  hasViewBox: boolean;
  viewBox: string;
  hasUnsafeScripts: boolean;
  hasRasterImages: boolean;
  elementCounts: {
    path: number;
    circle: number;
    rect: number;
    ellipse: number;
    polygon: number;
    polyline: number;
    line: number;
    g: number;
    gradients: number;
  };
  totalVectorPrimitives: number;
  commercialReady: boolean;
  issues: string[];
}

export interface StockAsset {
  id: string;
  batchId: string | null;
  prompt: string;
  category: StockCategory;
  style: DesignStyle;
  targetPlatform: TargetPlatform;
  providerSlug: ProviderSlug;
  model: string;
  title: string;
  description: string;
  keywords: string[];
  adobeCategory: string;
  shutterstockCategory: string;
  svgFilename: string;
  svgHash: string;
  svgContent?: string;
  validation: SvgValidationReport;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

export type BatchStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type BatchItemStatus =
  | 'pending'
  | 'generating'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface BatchItem {
  id: number;
  batchId: string;
  seqIndex: number;
  variationPrompt: string;
  status: BatchItemStatus;
  attempts: number;
  errorMessage: string | null;
  assetId: string | null;
  updatedAt: string;
}

export interface BatchJob {
  id: string;
  name: string;
  basePrompt: string;
  category: StockCategory;
  style: DesignStyle;
  targetPlatform: TargetPlatform;
  providerSlug: ProviderSlug;
  model: string;
  requestedCount: number;
  concurrency: number;
  status: BatchStatus;
  completedCount: number;
  failedCount: number;
  duplicateSkippedCount: number;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  items?: BatchItem[];
}

export interface ProductionLogEntry {
  id: number;
  eventType: string;
  providerSlug: string | null;
  model: string | null;
  batchId: string | null;
  assetId: string | null;
  status: 'success' | 'error' | 'info';
  latencyMs: number | null;
  message: string;
  createdAt: string;
}

export interface SystemSettings {
  exportRasterSize: number;
  exportJpgQuality: number;
  epsArtboardSize: number;
  defaultConcurrency: number;
  maxRetries: number;
  strictSanitizer: boolean;
  preventDuplicates: boolean;
}

export interface DashboardSummary {
  totalAssets: number;
  commercialReadyAssets: number;
  totalBatches: number;
  runningBatches: number;
  connectedProviders: number;
  activeProvider: {
    slug: ProviderSlug;
    name: string;
    model: string;
    status: ProviderStatus;
  } | null;
  storageBytes: number;
  recentAssets: StockAsset[];
  recentLogs: ProductionLogEntry[];
  categoryBreakdown: { category: string; count: number }[];
  isServerless?: boolean;
}
