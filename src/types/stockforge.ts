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
  | 'openai'
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

// ============================================================================
// STOCKFORGE ANIMATION STUDIO TYPES
// ============================================================================

export type AnimationCategory =
  | 'Motion Graphics'
  | 'Green Screen Animation'
  | 'Transparent Background Animation'
  | 'Business & Technology'
  | 'Nature & Environment'
  | 'Medical & Healthcare'
  | 'Educational & General Stock';

export type AnimationType =
  | 'cursor_click'
  | 'ui_elements'
  | 'arrows'
  | 'notification'
  | 'social_interaction'
  | 'hud'
  | 'gradient_bg'
  | 'geometric_motion'
  | 'particles'
  | 'light_trails'
  | 'energy'
  | 'fluid_waves'
  | 'smoke'
  | 'fire'
  | 'sparkles'
  | 'data_chart'
  | 'network'
  | 'cloud_security'
  | 'ocean_water'
  | 'falling_leaves'
  | 'rain_snow'
  | 'clouds_wind'
  | 'plant_growth'
  | 'heartbeat_ecg'
  | 'medical_icons'
  | 'science_atom'
  | 'math_geometry'
  | 'industry_gears';

export type VisualStyle =
  | 'Clean Vector Motion'
  | 'Luminous Gradient'
  | 'Minimal HUD'
  | 'Isometric Tech'
  | 'Organic Fluid'
  | 'Broadcast Flat';

export type BackgroundMode = 'transparent' | 'green_screen' | 'solid';

export type ResolutionPreset = '1920x1080' | '3840x2160' | '1080x1920' | '1080x1080';

export type FpsOption = 24 | 25 | 30 | 60;

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'spring';

export type AnimationLayerType =
  | 'cursor'
  | 'click_ripple'
  | 'ui_button'
  | 'particles'
  | 'smoke'
  | 'fire'
  | 'sparkles'
  | 'wave'
  | 'gradient_blob'
  | 'trail'
  | 'chart_bars'
  | 'network_nodes'
  | 'ecg_wave'
  | 'gears'
  | 'orbit'
  | 'leaves'
  | 'rain_snow'
  | 'hud_ring'
  | 'vector_shape';

export interface LayerKeyframe {
  time: number; // seconds from 0 to durationSec
  x: number; // normalized or artboard coordinates (0..width)
  y: number; // artboard coordinates (0..height)
  scaleX: number;
  scaleY: number;
  rotation: number; // degrees
  opacity: number; // 0..1
  easing: EasingType;
  progress?: number; // 0..1 procedural driver
  clickState?: number; // 0..1 cursor click pulse
}

export interface ProceduralParams {
  count?: number;
  speed?: number;
  amplitude?: number;
  frequency?: number;
  seed?: number;
  radius?: number;
  strokeWidth?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'radial';
  customPath?: string;
  label?: string;
}

export interface AnimationLayer {
  id: string;
  name: string;
  type: AnimationLayerType;
  visible: boolean;
  locked?: boolean;
  opacity: number;
  color: string;
  secondaryColor: string;
  anchorX: number;
  anchorY: number;
  keyframes: LayerKeyframe[];
  params: ProceduralParams;
  svgTemplate?: string;
}

export type AnimationExportFormat =
  | 'mp4_h264'
  | 'mov_prores'
  | 'mov_alpha'
  | 'png_sequence'
  | 'gif_preview'
  | 'mp4_preview'
  | 'thumbnail_png'
  | 'svg_animated'
  | 'lottie_json'
  | 'source_zip';

export interface OutputFileArtifact {
  format: AnimationExportFormat;
  filename: string;
  relativePath: string; // relative inside /output
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
}

export interface VideoProbeReport {
  format: AnimationExportFormat;
  filename: string;
  codecName: string;
  pixFmt: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  hasAlphaChannel: boolean;
  sizeBytes: number;
  valid: boolean;
  issues: string[];
}

export interface QaReport {
  passed: boolean;
  checkedAt: string;
  svgValid: boolean;
  svgViewBoxValid: boolean;
  frameCountRendered: number;
  blackFrameCount: number;
  emptyFrameCount: number;
  duplicateFrameRatio: number;
  motionScore: number; // 0..100 pixel difference across frames
  alphaVerified: boolean | null; // null if not transparent mode
  greenScreenVerified: boolean | null; // null if not green_screen mode
  greenScreenPurityPct: number | null;
  metadataComplete: boolean;
  videoProbes: VideoProbeReport[];
  issues: string[];
}

export type AnimationProjectStatus =
  | 'draft'
  | 'generating'
  | 'rendering'
  | 'validating'
  | 'completed'
  | 'failed';

export type ReviewStatus = 'pending_review' | 'approved' | 'rejected';

export interface AnimationMetadata {
  title: string;
  description: string;
  keywords: string[];
  adobeCategory: string;
  shutterstockCategory: string;
  targetPlatform: TargetPlatform;
}

export interface AnimationProject {
  id: string;
  batchId: string | null;
  name: string;
  prompt: string;
  category: AnimationCategory;
  animationType: AnimationType;
  visualStyle: VisualStyle;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
  resolution: ResolutionPreset;
  width: number;
  height: number;
  durationSec: number;
  fps: FpsOption;
  palette: string[];
  layers: AnimationLayer[];
  metadata: AnimationMetadata;
  providerSlug: ProviderSlug | 'procedural';
  model: string;
  status: AnimationProjectStatus;
  pipelineStage: string;
  reviewStatus: ReviewStatus;
  errorMessage: string | null;
  projectHash: string;
  qaReport: QaReport | null;
  outputFiles: OutputFileArtifact[];
  createdAt: string;
  updatedAt: string;
}

export interface AnimationBatchJob {
  id: string;
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
  status: BatchStatus;
  completedCount: number;
  failedCount: number;
  duplicateSkippedCount: number;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  items?: AnimationBatchItem[];
}

export interface AnimationBatchItem {
  id: number;
  batchId: string;
  seqIndex: number;
  variationPrompt: string;
  animationType: AnimationType;
  status: BatchItemStatus;
  attempts: number;
  errorMessage: string | null;
  projectId: string | null;
  updatedAt: string;
}

export interface SystemDiagnostics {
  nodeVersion: string;
  platform: string;
  ffmpegAvailable: boolean;
  ffmpegVersion: string;
  ffprobeAvailable: boolean;
  proresAlphaSupported: boolean;
  h264Supported: boolean;
  outputRoot: string;
  outputFolders: { folder: string; fileCount: number; sizeBytes: number }[];
  totalProjects: number;
  completedProjects: number;
  failedProjects: number;
  approvedProjects: number;
  totalBatches: number;
  storageBytes: number;
}
