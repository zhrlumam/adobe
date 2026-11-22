import crypto from 'node:crypto';
import type {
  AnimationCategory,
  AnimationLayer,
  AnimationMetadata,
  AnimationProject,
  AnimationType,
  BackgroundMode,
  EasingType,
  FpsOption,
  LayerKeyframe,
  ResolutionPreset,
  TargetPlatform,
  VisualStyle,
} from '../src/types/stockforge.js';
import { normalizeKeywords } from './metadataExport.js';

export const RESOLUTION_MAP: Record<ResolutionPreset, { width: number; height: number }> = {
  '1920x1080': { width: 1920, height: 1080 },
  '3840x2160': { width: 3840, height: 2160 },
  '1080x1920': { width: 1080, height: 1920 },
  '1080x1080': { width: 1080, height: 1080 },
};

export const CATEGORY_ANIMATION_TYPES: Record<AnimationCategory, AnimationType[]> = {
  'Motion Graphics': [
    'gradient_bg',
    'geometric_motion',
    'particles',
    'light_trails',
    'energy',
    'fluid_waves',
  ],
  'Green Screen Animation': [
    'cursor_click',
    'ui_elements',
    'arrows',
    'notification',
    'social_interaction',
    'hud',
  ],
  'Transparent Background Animation': [
    'smoke',
    'fire',
    'sparkles',
    'particles',
    'energy',
    'ui_elements',
  ],
  'Business & Technology': ['data_chart', 'network', 'cloud_security', 'ui_elements'],
  'Nature & Environment': [
    'ocean_water',
    'falling_leaves',
    'rain_snow',
    'clouds_wind',
    'plant_growth',
    'particles',
  ],
  'Medical & Healthcare': ['heartbeat_ecg', 'medical_icons'],
  'Educational & General Stock': ['science_atom', 'math_geometry', 'industry_gears', 'arrows'],
};

const PALETTE_PRESETS: Record<VisualStyle, string[][]> = {
  'Clean Vector Motion': [
    ['#2563EB', '#38BDF8', '#F8FAFC', '#0F172A', '#F59E0B'],
    ['#0EA5E9', '#6366F1', '#FFFFFF', '#1E293B', '#10B981'],
    ['#EC4899', '#8B5CF6', '#F8FAFC', '#0F172A', '#FBBF24'],
  ],
  'Luminous Gradient': [
    ['#6366F1', '#EC4899', '#38BDF8', '#0F172A', '#FDE047'],
    ['#F97316', '#EF4444', '#FACC15', '#18181B', '#FB7185'],
    ['#14B8A6', '#3B82F6', '#A855F7', '#090D16', '#E0F2FE'],
  ],
  'Minimal HUD': [
    ['#38BDF8', '#0EA5E9', '#E2E8F0', '#0B1120', '#F59E0B'],
    ['#22D3EE', '#818CF8', '#F1F5F9', '#090D16', '#FB7185'],
  ],
  'Isometric Tech': [
    ['#3B82F6', '#1D4ED8', '#93C5FD', '#0F172A', '#10B981'],
    ['#8B5CF6', '#4C1D95', '#DDD6FE', '#0B0F19', '#F59E0B'],
  ],
  'Organic Fluid': [
    ['#10B981', '#34D399', '#FEF3C7', '#064E3B', '#F97316'],
    ['#0284C7', '#38BDF8', '#E0F2FE', '#0C4A6E', '#FBBF24'],
    ['#F59E0B', '#D97706', '#FEF3C7', '#451A03', '#EF4444'],
  ],
  'Broadcast Flat': [
    ['#EF4444', '#F8FAFC', '#1E293B', '#0F172A', '#3B82F6'],
    ['#F59E0B', '#FFFFFF', '#0F172A', '#1E293B', '#0EA5E9'],
  ],
};

function seededRandom(seed: number): () => number {
  let s = (seed % 2147483647) || 1;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function applyEasing(t: number, easing: EasingType): number {
  const x = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'easeIn':
      return x * x * x;
    case 'easeOut':
      return 1 - Math.pow(1 - x, 3);
    case 'easeInOut':
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    case 'spring': {
      const c4 = (2 * Math.PI) / 3;
      return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -8 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
    }
    case 'linear':
    default:
      return x;
  }
}

export function evaluateKeyframes(keyframes: LayerKeyframe[], timeSec: number): LayerKeyframe {
  if (!keyframes || keyframes.length === 0) {
    return {
      time: timeSec,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      easing: 'linear',
      progress: 0,
      clickState: 0,
    };
  }
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (timeSec <= sorted[0].time) return { ...sorted[0], time: timeSec };
  const last = sorted[sorted.length - 1];
  if (timeSec >= last.time) return { ...last, time: timeSec };

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (timeSec >= a.time && timeSec <= b.time) {
      const span = Math.max(0.0001, b.time - a.time);
      const rawT = (timeSec - a.time) / span;
      const e = applyEasing(rawT, b.easing || 'easeInOut');
      const lerp = (v0: number, v1: number) => v0 + (v1 - v0) * e;
      return {
        time: timeSec,
        x: lerp(a.x, b.x),
        y: lerp(a.y, b.y),
        scaleX: lerp(a.scaleX, b.scaleX),
        scaleY: lerp(a.scaleY, b.scaleY),
        rotation: lerp(a.rotation, b.rotation),
        opacity: lerp(a.opacity, b.opacity),
        easing: b.easing,
        progress: lerp(a.progress ?? 0, b.progress ?? 1),
        clickState: lerp(a.clickState ?? 0, b.clickState ?? 0),
      };
    }
  }
  return { ...last, time: timeSec };
}

export function inferAnimationTypeFromPrompt(
  prompt: string,
  category: AnimationCategory,
  requestedType?: AnimationType
): AnimationType {
  if (requestedType) return requestedType;
  const p = prompt.toLowerCase();
  if (p.includes('cursor') || p.includes('mouse') || p.includes('pointer') || p.includes('click')) {
    return 'cursor_click';
  }
  if (p.includes('smoke') || p.includes('fog') || p.includes('steam') || p.includes('vapor')) {
    return 'smoke';
  }
  if (p.includes('fire') || p.includes('flame') || p.includes('ember')) {
    return 'fire';
  }
  if (p.includes('sparkle') || p.includes('glitter') || p.includes('star')) {
    return 'sparkles';
  }
  if (p.includes('arrow')) return 'arrows';
  if (p.includes('notification') || p.includes('bell') || p.includes('alert')) return 'notification';
  if (p.includes('like') || p.includes('subscribe') || p.includes('social')) return 'social_interaction';
  if (p.includes('hud') || p.includes('radar') || p.includes('target')) return 'hud';
  if (p.includes('chart') || p.includes('graph') || p.includes('finance') || p.includes('bar')) return 'data_chart';
  if (p.includes('network') || p.includes('node') || p.includes('connect')) return 'network';
  if (p.includes('cloud') || p.includes('security') || p.includes('shield') || p.includes('lock')) return 'cloud_security';
  if (p.includes('ocean') || p.includes('water') || p.includes('sea')) return 'ocean_water';
  if (p.includes('leaf') || p.includes('leaves') || p.includes('autumn')) return 'falling_leaves';
  if (p.includes('rain') || p.includes('snow')) return 'rain_snow';
  if (p.includes('cloud') || p.includes('wind')) return 'clouds_wind';
  if (p.includes('plant') || p.includes('grow') || p.includes('sprout')) return 'plant_growth';
  if (p.includes('heart') || p.includes('ecg') || p.includes('pulse') || p.includes('ekg')) return 'heartbeat_ecg';
  if (p.includes('medical') || p.includes('dna') || p.includes('health')) return 'medical_icons';
  if (p.includes('atom') || p.includes('science') || p.includes('orbit')) return 'science_atom';
  if (p.includes('math') || p.includes('geometry') || p.includes('poly')) return 'math_geometry';
  if (p.includes('gear') || p.includes('cog') || p.includes('industry') || p.includes('manufactur')) return 'industry_gears';
  if (p.includes('wave') || p.includes('fluid')) return 'fluid_waves';
  if (p.includes('trail') || p.includes('streak') || p.includes('beam')) return 'light_trails';
  if (p.includes('energy') || p.includes('plasma') || p.includes('electric')) return 'energy';
  if (p.includes('particle') || p.includes('bokeh') || p.includes('dust')) return 'particles';
  if (p.includes('gradient')) return 'gradient_bg';

  const list = CATEGORY_ANIMATION_TYPES[category] ?? ['geometric_motion'];
  return list[0];
}

function sanitizeForegroundHexForGreenScreen(hex: string, fallback = '#2563EB'): string {
  const clean = hex.trim();
  const m = clean.match(/^#([0-9a-fA-F]{6})$/);
  if (!m) return clean;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  // Prevent green spill / chroma keying collision when green dominates strongly
  if (g > 170 && r < 110 && b < 110) {
    return fallback;
  }
  return clean;
}

export function buildProceduralAnimationProject(params: {
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
  seed?: number;
}): AnimationProject {
  const dims = RESOLUTION_MAP[params.resolution] ?? RESOLUTION_MAP['1920x1080'];
  const w = dims.width;
  const h = dims.height;
  const dur = Math.min(15, Math.max(1.5, Number(params.durationSec) || 3));
  const seed = params.seed ?? crypto.randomInt(1000, 999999);
  const animType = inferAnimationTypeFromPrompt(params.prompt, params.category, params.animationType);

  const stylePalettes = PALETTE_PRESETS[params.visualStyle] ?? PALETTE_PRESETS['Clean Vector Motion'];
  let palette = [...stylePalettes[seed % stylePalettes.length]];
  if (params.backgroundMode === 'green_screen') {
    palette = palette.map((c, idx) =>
      sanitizeForegroundHexForGreenScreen(c, idx === 0 ? '#2563EB' : '#F8FAFC')
    );
  }

  const bgColor =
    params.backgroundMode === 'green_screen'
      ? '#00FF00'
      : params.backgroundMode === 'transparent'
      ? 'transparent'
      : params.backgroundColor && params.backgroundColor !== 'transparent'
      ? params.backgroundColor
      : '#0B1020';

  const layers = buildLayersForAnimationType({
    animType,
    w,
    h,
    dur,
    palette,
    seed,
    prompt: params.prompt,
    backgroundMode: params.backgroundMode,
  });

  const now = new Date().toISOString();
  const baseProject: AnimationProject = {
    id: params.id,
    batchId: params.batchId ?? null,
    name:
      params.name?.trim() ||
      `${params.prompt.slice(0, 46).trim() || animType.replace(/_/g, ' ')}`,
    prompt: params.prompt.trim(),
    category: params.category,
    animationType: animType,
    visualStyle: params.visualStyle,
    backgroundMode: params.backgroundMode,
    backgroundColor: bgColor,
    resolution: params.resolution,
    width: w,
    height: h,
    durationSec: dur,
    fps: params.fps,
    palette,
    layers,
    metadata: {
      title: '',
      description: '',
      keywords: [],
      adobeCategory: '',
      shutterstockCategory: '',
      targetPlatform: params.targetPlatform ?? 'both',
    },
    providerSlug: 'procedural',
    model: 'stockforge-procedural-v1',
    status: 'draft',
    pipelineStage: 'specification_ready',
    reviewStatus: 'pending_review',
    errorMessage: null,
    projectHash: '',
    qaReport: null,
    outputFiles: [],
    createdAt: now,
    updatedAt: now,
  };

  baseProject.metadata = generateAnimationMetadata(baseProject);
  baseProject.projectHash = computeProjectHash(baseProject);
  return baseProject;
}

function buildLayersForAnimationType(opts: {
  animType: AnimationType;
  w: number;
  h: number;
  dur: number;
  palette: string[];
  seed: number;
  prompt: string;
  backgroundMode: BackgroundMode;
}): AnimationLayer[] {
  const { animType, w, h, dur, palette, seed, prompt } = opts;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const minDim = Math.min(w, h);
  const [c1, c2, c3, c4, c5] = palette;

  if (animType === 'cursor_click') {
    const startX = w * (0.16 + (seed % 7) * 0.015);
    const startY = h * (0.74 - (seed % 5) * 0.02);
    const targetX = w * 0.52;
    const targetY = h * 0.49;
    const endX = w * 0.78;
    const endY = h * 0.34;
    const clickTime = dur * 0.48;
    const releaseTime = dur * 0.58;

    return [
      {
        id: 'layer-ui-button',
        name: 'Interactive Action Button',
        type: 'ui_button',
        visible: true,
        opacity: 1,
        color: c1,
        secondaryColor: c3,
        anchorX: 0,
        anchorY: 0,
        params: {
          label: prompt.toLowerCase().includes('subscribe') ? 'SUBSCRIBE' : 'GET STARTED',
          radius: Math.round(minDim * 0.032),
          seed,
        },
        keyframes: [
          { time: 0, x: cx, y: cy, scaleX: 0.94, scaleY: 0.94, rotation: 0, opacity: 0.95, easing: 'easeOut', clickState: 0 },
          { time: clickTime * 0.8, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, easing: 'easeOut', clickState: 0 },
          { time: clickTime, x: cx, y: cy, scaleX: 0.92, scaleY: 0.92, rotation: 0, opacity: 1, easing: 'easeInOut', clickState: 1 },
          { time: releaseTime, x: cx, y: cy, scaleX: 1.02, scaleY: 1.02, rotation: 0, opacity: 1, easing: 'easeOut', clickState: 0.2 },
          { time: dur, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, easing: 'easeOut', clickState: 0 },
        ],
      },
      {
        id: 'layer-click-ripple',
        name: 'Click Impact Ripple',
        type: 'click_ripple',
        visible: true,
        opacity: 1,
        color: c2,
        secondaryColor: c5,
        anchorX: 0,
        anchorY: 0,
        params: { radius: Math.round(minDim * 0.14), strokeWidth: Math.max(4, Math.round(minDim * 0.006)), seed },
        keyframes: [
          { time: 0, x: targetX, y: targetY, scaleX: 0.1, scaleY: 0.1, rotation: 0, opacity: 0, easing: 'linear', progress: 0 },
          { time: clickTime - 0.02, x: targetX, y: targetY, scaleX: 0.1, scaleY: 0.1, rotation: 0, opacity: 0, easing: 'linear', progress: 0 },
          { time: clickTime, x: targetX, y: targetY, scaleX: 0.25, scaleY: 0.25, rotation: 0, opacity: 1, easing: 'easeOut', progress: 0.15 },
          { time: Math.min(dur, clickTime + dur * 0.34), x: targetX, y: targetY, scaleX: 1.35, scaleY: 1.35, rotation: 25, opacity: 0, easing: 'easeOut', progress: 1 },
          { time: dur, x: targetX, y: targetY, scaleX: 1.35, scaleY: 1.35, rotation: 25, opacity: 0, easing: 'linear', progress: 1 },
        ],
      },
      {
        id: 'layer-cursor',
        name: 'Animated Pointer Cursor',
        type: 'cursor',
        visible: true,
        opacity: 1,
        color: '#FFFFFF',
        secondaryColor: '#0F172A',
        anchorX: 0,
        anchorY: 0,
        params: { radius: Math.round(minDim * 0.095), strokeWidth: Math.max(4, Math.round(minDim * 0.0055)), seed },
        keyframes: [
          { time: 0, x: startX, y: startY, scaleX: 1, scaleY: 1, rotation: -6, opacity: 1, easing: 'easeInOut', clickState: 0 },
          { time: clickTime * 0.85, x: targetX, y: targetY, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, easing: 'easeInOut', clickState: 0 },
          { time: clickTime, x: targetX + 2, y: targetY + 6, scaleX: 0.84, scaleY: 0.84, rotation: -5, opacity: 1, easing: 'easeIn', clickState: 1 },
          { time: releaseTime, x: targetX, y: targetY, scaleX: 1.04, scaleY: 1.04, rotation: 0, opacity: 1, easing: 'easeOut', clickState: 0 },
          { time: dur, x: endX, y: endY, scaleX: 1, scaleY: 1, rotation: 6, opacity: 1, easing: 'easeInOut', clickState: 0 },
        ],
      },
    ];
  }

  if (animType === 'smoke') {
    return [
      {
        id: 'layer-smoke-base',
        name: 'Primary Rising Plume',
        type: 'smoke',
        visible: true,
        opacity: 0.82,
        color: '#E2E8F0',
        secondaryColor: '#94A3B8',
        anchorX: 0,
        anchorY: 0,
        params: { count: 16, speed: 1.0, amplitude: minDim * 0.09, radius: minDim * 0.14, seed },
        keyframes: [
          { time: 0, x: cx, y: h * 0.72, scaleX: 0.9, scaleY: 0.9, rotation: 0, opacity: 0.85, easing: 'linear', progress: 0 },
          { time: dur, x: cx, y: h * 0.68, scaleX: 1.08, scaleY: 1.08, rotation: 14, opacity: 0.85, easing: 'linear', progress: 1 },
        ],
      },
      {
        id: 'layer-smoke-wisps',
        name: 'Dispersion Wisps',
        type: 'smoke',
        visible: true,
        opacity: 0.55,
        color: '#F8FAFC',
        secondaryColor: '#CBD5E1',
        anchorX: 0,
        anchorY: 0,
        params: { count: 12, speed: 1.35, amplitude: minDim * 0.13, radius: minDim * 0.1, seed: seed + 41 },
        keyframes: [
          { time: 0, x: cx - w * 0.04, y: h * 0.78, scaleX: 0.85, scaleY: 0.85, rotation: -8, opacity: 0.6, easing: 'linear', progress: 0 },
          { time: dur, x: cx + w * 0.04, y: h * 0.7, scaleX: 1.15, scaleY: 1.15, rotation: 18, opacity: 0.6, easing: 'linear', progress: 1 },
        ],
      },
    ];
  }

  if (animType === 'fire') {
    return [
      {
        id: 'layer-fire-core',
        name: 'Flame Tongues',
        type: 'fire',
        visible: true,
        opacity: 0.96,
        color: '#F97316',
        secondaryColor: '#FACC15',
        anchorX: 0,
        anchorY: 0,
        params: { count: 14, speed: 1.4, amplitude: minDim * 0.06, radius: minDim * 0.18, seed },
        keyframes: [
          { time: 0, x: cx, y: h * 0.72, scaleX: 1, scaleY: 1, rotation: 0, opacity: 0.95, easing: 'linear', progress: 0 },
          { time: dur, x: cx, y: h * 0.72, scaleX: 1.04, scaleY: 1.08, rotation: 0, opacity: 0.95, easing: 'linear', progress: 1 },
        ],
      },
      {
        id: 'layer-fire-embers',
        name: 'Rising Sparks & Embers',
        type: 'sparkles',
        visible: true,
        opacity: 0.9,
        color: '#FDE047',
        secondaryColor: '#EF4444',
        anchorX: 0,
        anchorY: 0,
        params: { count: 22, speed: 1.5, radius: minDim * 0.025, direction: 'up', seed: seed + 19 },
        keyframes: [
          { time: 0, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 0, opacity: 0.95, easing: 'linear', progress: 0 },
          { time: dur, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 45, opacity: 0.95, easing: 'linear', progress: 1 },
        ],
      },
    ];
  }

  if (animType === 'sparkles') {
    return [
      {
        id: 'layer-sparkles-main',
        name: 'Starlight Sparkles',
        type: 'sparkles',
        visible: true,
        opacity: 1,
        color: c5,
        secondaryColor: '#FFFFFF',
        anchorX: 0,
        anchorY: 0,
        params: { count: 28, speed: 1.1, radius: minDim * 0.045, direction: 'radial', seed },
        keyframes: [
          { time: 0, x: cx, y: cy, scaleX: 0.95, scaleY: 0.95, rotation: 0, opacity: 1, easing: 'linear', progress: 0 },
          { time: dur, x: cx, y: cy, scaleX: 1.05, scaleY: 1.05, rotation: 25, opacity: 1, easing: 'linear', progress: 1 },
        ],
      },
      {
        id: 'layer-sparkles-dust',
        name: 'Ambient Shimmer Particles',
        type: 'particles',
        visible: true,
        opacity: 0.8,
        color: c2,
        secondaryColor: c1,
        anchorX: 0,
        anchorY: 0,
        params: { count: 24, speed: 0.9, radius: minDim * 0.015, seed: seed + 13 },
        keyframes: [
          { time: 0, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 0, opacity: 0.85, easing: 'linear', progress: 0 },
          { time: dur, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: -15, opacity: 0.85, easing: 'linear', progress: 1 },
        ],
      },
    ];
  }

  if (animType === 'data_chart') {
    return [
      {
        id: 'layer-chart-bg',
        name: 'Chart Grid Frame',
        type: 'hud_ring',
        visible: true,
        opacity: 0.35,
        color: c3,
        secondaryColor: c1,
        anchorX: 0,
        anchorY: 0,
        params: { count: 4, radius: minDim * 0.38, seed },
        keyframes: [
          { time: 0, x: cx, y: cy, scaleX: 0.96, scaleY: 0.96, rotation: 0, opacity: 0.35, easing: 'easeOut', progress: 0 },
          { time: dur, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 0, opacity: 0.35, easing: 'linear', progress: 1 },
        ],
      },
      {
        id: 'layer-chart-bars',
        name: 'Animated Financial Bars & Trend',
        type: 'chart_bars',
        visible: true,
        opacity: 1,
        color: c1,
        secondaryColor: c5,
        anchorX: 0,
        anchorY: 0,
        params: { count: 7, radius: minDim * 0.32, strokeWidth: Math.max(5, minDim * 0.006), seed },
        keyframes: [
          { time: 0, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, easing: 'easeOut', progress: 0.05 },
          { time: dur * 0.72, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, easing: 'easeOut', progress: 1 },
          { time: dur, x: cx, y: cy, scaleX: 1.02, scaleY: 1.02, rotation: 0, opacity: 1, easing: 'easeInOut', progress: 1 },
        ],
      },
    ];
  }

  if (animType === 'network' || animType === 'cloud_security') {
    return [
      {
        id: 'layer-network-mesh',
        name: 'Connected Data Nodes',
        type: 'network_nodes',
        visible: true,
        opacity: 1,
        color: c1,
        secondaryColor: c2,
        anchorX: 0,
        anchorY: 0,
        params: { count: 14, speed: 1.1, radius: minDim * 0.34, strokeWidth: Math.max(2, minDim * 0.003), seed },
        keyframes: [
          { time: 0, x: cx, y: cy, scaleX: 0.95, scaleY: 0.95, rotation: 0, opacity: 1, easing: 'easeInOut', progress: 0 },
          { time: dur, x: cx, y: cy, scaleX: 1.04, scaleY: 1.04, rotation: 16, opacity: 1, easing: 'easeInOut', progress: 1 },
        ],
      },
      {
        id: 'layer-security-ring',
        name: 'Telemetry Ring',
        type: 'hud_ring',
        visible: true,
        opacity: 0.85,
        color: c5,
        secondaryColor: c2,
        anchorX: 0,
        anchorY: 0,
        params: { count: 3, radius: minDim * 0.22, strokeWidth: Math.max(3, minDim * 0.005), seed: seed + 9 },
        keyframes: [
          { time: 0, x: cx, y: cy, scaleX: 0.9, scaleY: 0.9, rotation: 0, opacity: 0.85, easing: 'linear', progress: 0 },
          { time: dur, x: cx, y: cy, scaleX: 1.05, scaleY: 1.05, rotation: 180, opacity: 0.85, easing: 'linear', progress: 1 },
        ],
      },
    ];
  }

  if (animType === 'heartbeat_ecg' || animType === 'medical_icons') {
    return [
      {
        id: 'layer-ecg-pulse',
        name: 'ECG Heartbeat Trace',
        type: 'ecg_wave',
        visible: true,
        opacity: 1,
        color: '#EF4444',
        secondaryColor: '#38BDF8',
        anchorX: 0,
        anchorY: 0,
        params: { speed: 1.4, amplitude: minDim * 0.16, strokeWidth: Math.max(5, minDim * 0.007), seed },
        keyframes: [
          { time: 0, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, easing: 'linear', progress: 0 },
          { time: dur, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, easing: 'linear', progress: 1 },
        ],
      },
      {
        id: 'layer-heart-emblem',
        name: 'Pulsing Medical Heart',
        type: 'vector_shape',
        visible: true,
        opacity: 0.92,
        color: '#EF4444',
        secondaryColor: '#FCA5A5',
        anchorX: 0,
        anchorY: 0,
        params: { radius: minDim * 0.11, label: 'heart', seed },
        keyframes: [
          { time: 0, x: cx, y: h * 0.25, scaleX: 0.92, scaleY: 0.92, rotation: 0, opacity: 0.9, easing: 'easeOut', progress: 0 },
          { time: dur * 0.25, x: cx, y: h * 0.25, scaleX: 1.12, scaleY: 1.12, rotation: 0, opacity: 1, easing: 'easeOut', progress: 0.25 },
          { time: dur * 0.5, x: cx, y: h * 0.25, scaleX: 0.94, scaleY: 0.94, rotation: 0, opacity: 0.9, easing: 'easeInOut', progress: 0.5 },
          { time: dur * 0.75, x: cx, y: h * 0.25, scaleX: 1.14, scaleY: 1.14, rotation: 0, opacity: 1, easing: 'easeOut', progress: 0.75 },
          { time: dur, x: cx, y: h * 0.25, scaleX: 0.92, scaleY: 0.92, rotation: 0, opacity: 0.9, easing: 'easeInOut', progress: 1 },
        ],
      },
    ];
  }

  if (animType === 'ocean_water' || animType === 'fluid_waves' || animType === 'clouds_wind') {
    return [
      {
        id: 'layer-wave-back',
        name: 'Deep Wave Layer',
        type: 'wave',
        visible: true,
        opacity: 0.7,
        color: c2,
        secondaryColor: c1,
        anchorX: 0,
        anchorY: 0,
        params: { amplitude: minDim * 0.07, frequency: 2.2, speed: 1.0, seed },
        keyframes: [
          { time: 0, x: cx, y: h * 0.54, scaleX: 1, scaleY: 1, rotation: 0, opacity: 0.75, easing: 'linear', progress: 0 },
          { time: dur, x: cx, y: h * 0.54, scaleX: 1, scaleY: 1, rotation: 0, opacity: 0.75, easing: 'linear', progress: 1 },
        ],
      },
      {
        id: 'layer-wave-front',
        name: 'Foreground Crest Wave',
        type: 'wave',
        visible: true,
        opacity: 0.92,
        color: c1,
        secondaryColor: c3,
        anchorX: 0,
        anchorY: 0,
        params: { amplitude: minDim * 0.09, frequency: 3.1, speed: 1.5, seed: seed + 17 },
        keyframes: [
          { time: 0, x: cx, y: h * 0.62, scaleX: 1, scaleY: 1, rotation: 0, opacity: 0.92, easing: 'linear', progress: 0 },
          { time: dur, x: cx, y: h * 0.62, scaleX: 1, scaleY: 1, rotation: 0, opacity: 0.92, easing: 'linear', progress: 1 },
        ],
      },
    ];
  }

  if (animType === 'falling_leaves' || animType === 'rain_snow' || animType === 'plant_growth') {
    const isRainSnow = animType === 'rain_snow';
    return [
      {
        id: 'layer-nature-elements',
        name: isRainSnow ? 'Atmospheric Precipitation' : 'Falling Botanical Leaves',
        type: isRainSnow ? 'rain_snow' : 'leaves',
        visible: true,
        opacity: 0.95,
        color: isRainSnow ? '#BAE6FD' : c1,
        secondaryColor: isRainSnow ? '#FFFFFF' : c5,
        anchorX: 0,
        anchorY: 0,
        params: { count: isRainSnow ? 42 : 18, speed: 1.2, radius: minDim * 0.036, seed },
        keyframes: [
          { time: 0, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 0, opacity: 0.95, easing: 'linear', progress: 0 },
          { time: dur, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 15, opacity: 0.95, easing: 'linear', progress: 1 },
        ],
      },
    ];
  }

  if (animType === 'industry_gears') {
    return [
      {
        id: 'layer-gears-system',
        name: 'Interlocking Precision Gears',
        type: 'gears',
        visible: true,
        opacity: 1,
        color: c1,
        secondaryColor: c5,
        anchorX: 0,
        anchorY: 0,
        params: { count: 3, radius: minDim * 0.16, seed },
        keyframes: [
          { time: 0, x: cx, y: cy, scaleX: 0.96, scaleY: 0.96, rotation: 0, opacity: 1, easing: 'linear', progress: 0 },
          { time: dur, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 360, opacity: 1, easing: 'linear', progress: 1 },
        ],
      },
    ];
  }

  if (animType === 'science_atom' || animType === 'math_geometry') {
    return [
      {
        id: 'layer-atom-orbit',
        name: 'Orbital Electron Paths',
        type: 'orbit',
        visible: true,
        opacity: 1,
        color: c2,
        secondaryColor: c5,
        anchorX: 0,
        anchorY: 0,
        params: { count: 3, radius: minDim * 0.28, strokeWidth: Math.max(3, minDim * 0.004), seed },
        keyframes: [
          { time: 0, x: cx, y: cy, scaleX: 0.95, scaleY: 0.95, rotation: 0, opacity: 1, easing: 'linear', progress: 0 },
          { time: dur, x: cx, y: cy, scaleX: 1.04, scaleY: 1.04, rotation: 360, opacity: 1, easing: 'linear', progress: 1 },
        ],
      },
    ];
  }

  if (animType === 'hud' || animType === 'arrows' || animType === 'notification' || animType === 'social_interaction' || animType === 'ui_elements') {
    return [
      {
        id: 'layer-hud-reticle',
        name: 'Primary Motion Graphics Element',
        type: 'hud_ring',
        visible: true,
        opacity: 1,
        color: c1,
        secondaryColor: c2,
        anchorX: 0,
        anchorY: 0,
        params: { count: 4, radius: minDim * 0.26, strokeWidth: Math.max(4, minDim * 0.005), label: animType, seed },
        keyframes: [
          { time: 0, x: cx, y: cy, scaleX: 0.85, scaleY: 0.85, rotation: 0, opacity: 0.9, easing: 'easeOut', progress: 0 },
          { time: dur * 0.5, x: cx, y: cy, scaleX: 1.05, scaleY: 1.05, rotation: 180, opacity: 1, easing: 'easeInOut', progress: 0.5 },
          { time: dur, x: cx, y: cy, scaleX: 0.95, scaleY: 0.95, rotation: 360, opacity: 0.95, easing: 'easeInOut', progress: 1 },
        ],
      },
      {
        id: 'layer-ui-badge',
        name: 'Foreground Indicator',
        type: 'ui_button',
        visible: true,
        opacity: 1,
        color: c1,
        secondaryColor: c3,
        anchorX: 0,
        anchorY: 0,
        params: {
          label:
            animType === 'notification'
              ? 'NEW ALERT'
              : animType === 'social_interaction'
              ? 'LIKE +1'
              : animType === 'arrows'
              ? 'NEXT STEP'
              : 'ACTIVE',
          radius: Math.round(minDim * 0.03),
          seed: seed + 3,
        },
        keyframes: [
          { time: 0, x: cx, y: cy, scaleX: 0.82, scaleY: 0.82, rotation: -3, opacity: 0.9, easing: 'spring', clickState: 0 },
          { time: dur * 0.45, x: cx, y: cy - minDim * 0.02, scaleX: 1.05, scaleY: 1.05, rotation: 0, opacity: 1, easing: 'easeOut', clickState: 0.8 },
          { time: dur, x: cx, y: cy, scaleX: 0.96, scaleY: 0.96, rotation: 2, opacity: 0.98, easing: 'easeInOut', clickState: 0 },
        ],
      },
    ];
  }

  if (animType === 'light_trails' || animType === 'energy') {
    return [
      {
        id: 'layer-light-trails',
        name: 'Sweeping Energy & Light Trails',
        type: 'trail',
        visible: true,
        opacity: 1,
        color: c1,
        secondaryColor: c2,
        anchorX: 0,
        anchorY: 0,
        params: { count: 8, speed: 1.4, amplitude: minDim * 0.16, strokeWidth: Math.max(5, minDim * 0.008), seed },
        keyframes: [
          { time: 0, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, easing: 'linear', progress: 0 },
          { time: dur, x: cx, y: cy, scaleX: 1.04, scaleY: 1.04, rotation: 12, opacity: 1, easing: 'linear', progress: 1 },
        ],
      },
      {
        id: 'layer-energy-sparks',
        name: 'Luminous Field Particles',
        type: 'particles',
        visible: true,
        opacity: 0.85,
        color: c5,
        secondaryColor: c3,
        anchorX: 0,
        anchorY: 0,
        params: { count: 24, speed: 1.2, radius: minDim * 0.016, seed: seed + 29 },
        keyframes: [
          { time: 0, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 0, opacity: 0.85, easing: 'linear', progress: 0 },
          { time: dur, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 40, opacity: 0.85, easing: 'linear', progress: 1 },
        ],
      },
    ];
  }

  // Default rich Motion Graphics (gradient_bg, geometric_motion, particles)
  return [
    {
      id: 'layer-gradient-blobs',
      name: 'Flowing Gradient Field',
      type: 'gradient_blob',
      visible: true,
      opacity: 0.78,
      color: c1,
      secondaryColor: c2,
      anchorX: 0,
      anchorY: 0,
      params: { count: 5, radius: minDim * 0.3, speed: 1.0, seed },
      keyframes: [
        { time: 0, x: cx, y: cy, scaleX: 0.95, scaleY: 0.95, rotation: 0, opacity: 0.8, easing: 'easeInOut', progress: 0 },
        { time: dur * 0.5, x: cx, y: cy, scaleX: 1.08, scaleY: 1.06, rotation: 45, opacity: 0.9, easing: 'easeInOut', progress: 0.5 },
        { time: dur, x: cx, y: cy, scaleX: 0.95, scaleY: 0.95, rotation: 90, opacity: 0.8, easing: 'easeInOut', progress: 1 },
      ],
    },
    {
      id: 'layer-geo-rings',
      name: 'Kinetic Geometric Rings',
      type: 'hud_ring',
      visible: true,
      opacity: 0.9,
      color: c3,
      secondaryColor: c5,
      anchorX: 0,
      anchorY: 0,
      params: { count: 4, radius: minDim * 0.25, strokeWidth: Math.max(3, minDim * 0.005), seed: seed + 11 },
      keyframes: [
        { time: 0, x: cx, y: cy, scaleX: 0.9, scaleY: 0.9, rotation: 0, opacity: 0.9, easing: 'linear', progress: 0 },
        { time: dur, x: cx, y: cy, scaleX: 1.08, scaleY: 1.08, rotation: 240, opacity: 0.9, easing: 'linear', progress: 1 },
      ],
    },
    {
      id: 'layer-ambient-particles',
      name: 'Floating Particle Layer',
      type: 'particles',
      visible: true,
      opacity: 0.85,
      color: c5,
      secondaryColor: c2,
      anchorX: 0,
      anchorY: 0,
      params: { count: 26, speed: 1.1, radius: minDim * 0.015, seed: seed + 37 },
      keyframes: [
        { time: 0, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 0, opacity: 0.85, easing: 'linear', progress: 0 },
        { time: dur, x: cx, y: cy, scaleX: 1, scaleY: 1, rotation: 20, opacity: 0.85, easing: 'linear', progress: 1 },
      ],
    },
  ];
}

// ============================================================================
// FRAME-BY-FRAME VECTOR SCENE RENDERER (DETERMINISTIC AT EXACT TIME t)
// ============================================================================

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLayerContentAtTime(
  layer: AnimationLayer,
  kf: LayerKeyframe,
  project: AnimationProject,
  timeSec: number
): string {
  const { width: w, height: h, durationSec } = project;
  const minDim = Math.min(w, h);
  const progress = durationSec > 0 ? Math.max(0, Math.min(1, timeSec / durationSec)) : 0;
  const p = layer.params || {};
  const seed = p.seed ?? 42;
  const rand = seededRandom(seed);
  const c1 = layer.color || '#3B82F6';
  const c2 = layer.secondaryColor || '#38BDF8';
  const isGreenScreen = project.backgroundMode === 'green_screen';

  switch (layer.type) {
    case 'ui_button': {
      const bw = Math.round(minDim * 0.38);
      const bh = Math.round(minDim * 0.13);
      const rx = Math.round(bh * 0.45);
      const label = escapeXml((p.label || 'ACTION').slice(0, 18));
      const fontSize = Math.round(bh * 0.33);
      const click = kf.clickState ?? 0;
      const highlightOpacity = (0.18 + click * 0.25).toFixed(2);
      const shadowBlock = isGreenScreen
        ? ''
        : `<rect x="${-bw / 2}" y="${-bh / 2 + 12}" width="${bw}" height="${bh}" rx="${rx}" fill="#020617" opacity="0.35"/>`;
      return `
        ${shadowBlock}
        <rect x="${-bw / 2}" y="${-bh / 2}" width="${bw}" height="${bh}" rx="${rx}" fill="${c1}" stroke="${c2}" stroke-width="${Math.max(3, Math.round(minDim * 0.004))}"/>
        <rect x="${-bw / 2 + 6}" y="${-bh / 2 + 5}" width="${bw - 12}" height="${Math.round(bh * 0.42)}" rx="${Math.round(rx * 0.7)}" fill="#FFFFFF" opacity="${highlightOpacity}"/>
        <text x="0" y="${Math.round(fontSize * 0.34)}" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${fontSize}" fill="${c2}" letter-spacing="2">${label}</text>
      `;
    }

    case 'click_ripple': {
      const baseR = p.radius ?? minDim * 0.14;
      const sw = p.strokeWidth ?? Math.max(4, minDim * 0.006);
      const rays: string[] = [];
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI * 2) / 8;
        const r1 = baseR * 0.55;
        const r2 = baseR * 0.95;
        rays.push(
          `<line x1="${(Math.cos(ang) * r1).toFixed(1)}" y1="${(Math.sin(ang) * r1).toFixed(1)}" x2="${(Math.cos(ang) * r2).toFixed(1)}" y2="${(Math.sin(ang) * r2).toFixed(1)}" stroke="${c2}" stroke-width="${sw}" stroke-linecap="round"/>`
        );
      }
      return `
        <circle cx="0" cy="0" r="${(baseR * 0.65).toFixed(1)}" fill="none" stroke="${c1}" stroke-width="${sw}"/>
        <circle cx="0" cy="0" r="${(baseR * 0.92).toFixed(1)}" fill="none" stroke="${c2}" stroke-width="${(sw * 0.65).toFixed(1)}" opacity="0.75"/>
        ${rays.join('\n')}
      `;
    }

    case 'cursor': {
      const sz = p.radius ?? minDim * 0.095;
      const sw = p.strokeWidth ?? Math.max(4, minDim * 0.005);
      // Tip at (0,0) so cursor position tracks exact hotspot
      const d = `M 0 0 L 0 ${(sz * 1.18).toFixed(1)} L ${(sz * 0.34).toFixed(1)} ${(sz * 0.86).toFixed(1)} L ${(sz * 0.56).toFixed(1)} ${(sz * 1.32).toFixed(1)} L ${(sz * 0.78).toFixed(1)} ${(sz * 1.22).toFixed(1)} L ${(sz * 0.55).toFixed(1)} ${(sz * 0.76).toFixed(1)} L ${(sz * 0.98).toFixed(1)} ${(sz * 0.74).toFixed(1)} Z`;
      return `
        <path d="${d}" fill="${c1}" stroke="${c2}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>
      `;
    }

    case 'smoke': {
      const count = p.count ?? 14;
      const baseR = p.radius ?? minDim * 0.12;
      const amp = p.amplitude ?? minDim * 0.08;
      const speed = p.speed ?? 1.0;
      const puffs: string[] = [];
      for (let i = 0; i < count; i++) {
        const phase = (i / count + progress * speed) % 1;
        const xSpread = (rand() - 0.5) * minDim * 0.25 + Math.sin(phase * Math.PI * 2 + i) * amp;
        const yRise = -phase * h * 0.62;
        const r = baseR * (0.45 + phase * 1.15) * (0.75 + rand() * 0.5);
        const op = Math.sin(phase * Math.PI) * 0.42;
        const fill = i % 2 === 0 ? c1 : c2;
        puffs.push(
          `<circle cx="${xSpread.toFixed(1)}" cy="${yRise.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" opacity="${op.toFixed(3)}"/>`
        );
      }
      return puffs.join('\n');
    }

    case 'fire': {
      const count = p.count ?? 12;
      const baseR = p.radius ?? minDim * 0.16;
      const speed = p.speed ?? 1.4;
      const tongues: string[] = [];
      for (let i = 0; i < count; i++) {
        const offsetX = (i - count / 2) * (baseR * 0.22);
        const flicker = Math.sin(progress * Math.PI * 2 * speed * (1 + (i % 3) * 0.4) + i * 1.3);
        const fh = baseR * (1.2 + 0.55 * flicker + rand() * 0.35);
        const fw = baseR * (0.38 + (i % 3) * 0.08);
        const fill = i % 3 === 0 ? c2 : c1;
        const op = (0.55 + (i % 2) * 0.25).toFixed(2);
        const d = `M ${(offsetX - fw).toFixed(1)} 0 C ${(offsetX - fw * 1.1).toFixed(1)} ${(-fh * 0.45).toFixed(1)} ${(offsetX + flicker * 14).toFixed(1)} ${(-fh * 0.75).toFixed(1)} ${(offsetX + flicker * 18).toFixed(1)} ${(-fh).toFixed(1)} C ${(offsetX + fw * 0.8).toFixed(1)} ${(-fh * 0.6).toFixed(1)} ${(offsetX + fw).toFixed(1)} ${(-fh * 0.25).toFixed(1)} ${(offsetX + fw).toFixed(1)} 0 Z`;
        tongues.push(`<path d="${d}" fill="${fill}" opacity="${op}"/>`);
      }
      return tongues.join('\n');
    }

    case 'sparkles': {
      const count = p.count ?? 24;
      const baseR = p.radius ?? minDim * 0.04;
      const speed = p.speed ?? 1.1;
      const stars: string[] = [];
      for (let i = 0; i < count; i++) {
        const sx = (rand() - 0.5) * w * 0.82;
        const syBase = (rand() - 0.5) * h * 0.82;
        const sy =
          p.direction === 'up'
            ? ((syBase + h * 0.45 - progress * h * 0.7 * speed) % (h * 0.8)) - h * 0.4
            : syBase;
        const phase = (progress * speed * 1.5 + i * 0.17) % 1;
        const scale = Math.max(0.1, Math.sin(phase * Math.PI));
        const r = baseR * (0.5 + rand() * 0.8) * scale;
        const ir = r * 0.24;
        const fill = i % 2 === 0 ? c1 : c2;
        const d = `M ${sx.toFixed(1)} ${(sy - r).toFixed(1)} Q ${sx.toFixed(1)} ${sy.toFixed(1)} ${(sx + r).toFixed(1)} ${sy.toFixed(1)} Q ${sx.toFixed(1)} ${sy.toFixed(1)} ${sx.toFixed(1)} ${(sy + r).toFixed(1)} Q ${sx.toFixed(1)} ${sy.toFixed(1)} ${(sx - r).toFixed(1)} ${sy.toFixed(1)} Q ${sx.toFixed(1)} ${sy.toFixed(1)} ${sx.toFixed(1)} ${(sy - r).toFixed(1)} Z`;
        stars.push(`<path d="${d}" fill="${fill}" opacity="${(0.35 + 0.65 * scale).toFixed(2)}"/>`);
        stars.push(`<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${ir.toFixed(1)}" fill="#FFFFFF" opacity="${scale.toFixed(2)}"/>`);
      }
      return stars.join('\n');
    }

    case 'particles': {
      const count = p.count ?? 26;
      const baseR = p.radius ?? minDim * 0.015;
      const speed = p.speed ?? 1.0;
      const dots: string[] = [];
      for (let i = 0; i < count; i++) {
        const bx = (rand() - 0.5) * w * 0.9;
        const by = (rand() - 0.5) * h * 0.9;
        const dx = Math.sin(progress * Math.PI * 2 * speed + i) * minDim * 0.06;
        const dy = Math.cos(progress * Math.PI * 2 * speed + i * 1.7) * minDim * 0.06;
        const r = baseR * (0.5 + rand() * 1.4);
        const pulse = 0.45 + 0.55 * Math.abs(Math.sin(progress * Math.PI * 2 + i));
        const fill = i % 2 === 0 ? c1 : c2;
        dots.push(
          `<circle cx="${(bx + dx).toFixed(1)}" cy="${(by + dy).toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" opacity="${pulse.toFixed(2)}"/>`
        );
      }
      return dots.join('\n');
    }

    case 'gradient_blob': {
      const count = p.count ?? 5;
      const baseR = p.radius ?? minDim * 0.28;
      const blobs: string[] = [];
      for (let i = 0; i < count; i++) {
        const ang = (i * Math.PI * 2) / count + progress * Math.PI * 2;
        const ox = Math.cos(ang) * minDim * 0.22;
        const oy = Math.sin(ang * 1.3) * minDim * 0.18;
        const r = baseR * (0.75 + 0.25 * Math.sin(progress * Math.PI * 2 + i));
        const fill = i % 2 === 0 ? c1 : c2;
        blobs.push(
          `<circle cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" opacity="0.48"/>`
        );
      }
      return blobs.join('\n');
    }

    case 'wave': {
      const amp = p.amplitude ?? minDim * 0.08;
      const freq = p.frequency ?? 2.5;
      const speed = p.speed ?? 1.2;
      const pts: string[] = [];
      const steps = 28;
      const spanW = w * 1.2;
      const startX = -spanW / 2;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const px = startX + u * spanW;
        const py = Math.sin(u * Math.PI * 2 * freq + progress * Math.PI * 2 * speed) * amp;
        pts.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`);
      }
      pts.push(`L ${(spanW / 2).toFixed(1)} ${(h * 0.65).toFixed(1)}`);
      pts.push(`L ${(-spanW / 2).toFixed(1)} ${(h * 0.65).toFixed(1)} Z`);
      return `<path d="${pts.join(' ')}" fill="${c1}" stroke="${c2}" stroke-width="${Math.max(4, minDim * 0.005)}"/>`;
    }

    case 'trail': {
      const count = p.count ?? 7;
      const amp = p.amplitude ?? minDim * 0.14;
      const sw = p.strokeWidth ?? Math.max(5, minDim * 0.007);
      const trails: string[] = [];
      for (let i = 0; i < count; i++) {
        const yOff = (i - (count - 1) / 2) * (minDim * 0.085);
        const phase = progress * Math.PI * 2 + i * 0.65;
        const x1 = -w * 0.48 + ((progress * 1.2 + i * 0.13) % 1) * w * 0.65;
        const x2 = x1 + w * 0.28;
        const cx1 = x1 + (x2 - x1) * 0.33;
        const cx2 = x1 + (x2 - x1) * 0.66;
        const cy1 = yOff + Math.sin(phase) * amp;
        const cy2 = yOff - Math.cos(phase) * amp;
        const stroke = i % 2 === 0 ? c1 : c2;
        trails.push(
          `<path d="M ${x1.toFixed(1)} ${yOff.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)} ${cx2.toFixed(1)} ${cy2.toFixed(1)} ${x2.toFixed(1)} ${yOff.toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" opacity="0.88"/>`
        );
      }
      return trails.join('\n');
    }

    case 'chart_bars': {
      const count = p.count ?? 7;
      const maxH = minDim * 0.44;
      const totalW = minDim * 0.68;
      const barW = totalW / (count * 1.45);
      const gap = barW * 0.45;
      const grow = Math.min(1, kf.progress ?? progress);
      const bars: string[] = [];
      const linePts: string[] = [];
      const baseLineY = maxH * 0.48;
      for (let i = 0; i < count; i++) {
        const targetFactor = 0.25 + ((i * 0.13 + (seed % 5) * 0.08) % 0.72);
        const bh = maxH * targetFactor * grow;
        const bx = -totalW / 2 + i * (barW + gap);
        const by = baseLineY - bh;
        bars.push(
          `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(4, bh).toFixed(1)}" rx="6" fill="${c1}"/>`
        );
        linePts.push(`${(bx + barW / 2).toFixed(1)},${(by - 18).toFixed(1)}`);
      }
      const linePath = linePts.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt}`).join(' ');
      const dots = linePts
        .map((pt) => {
          const [px, py] = pt.split(',');
          return `<circle cx="${px}" cy="${py}" r="${Math.max(6, minDim * 0.01)}" fill="${c2}" stroke="#FFFFFF" stroke-width="3"/>`;
        })
        .join('\n');
      return `
        <line x1="${(-totalW / 2 - 20).toFixed(1)}" y1="${baseLineY.toFixed(1)}" x2="${(totalW / 2 + 20).toFixed(1)}" y2="${baseLineY.toFixed(1)}" stroke="#64748B" stroke-width="4" stroke-linecap="round"/>
        ${bars.join('\n')}
        <path d="${linePath}" fill="none" stroke="${c2}" stroke-width="${Math.max(4, minDim * 0.006)}" stroke-linecap="round" stroke-linejoin="round"/>
        ${dots}
      `;
    }

    case 'network_nodes': {
      const count = p.count ?? 12;
      const rad = p.radius ?? minDim * 0.34;
      const sw = p.strokeWidth ?? Math.max(2, minDim * 0.003);
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < count; i++) {
        const ang = (i * Math.PI * 2) / count + progress * 0.4;
        const dist = rad * (0.42 + 0.52 * rand());
        pts.push({
          x: Math.cos(ang) * dist + Math.sin(progress * Math.PI * 2 + i) * 14,
          y: Math.sin(ang) * dist + Math.cos(progress * Math.PI * 2 + i) * 14,
        });
      }
      const lines: string[] = [];
      const packets: string[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const c = pts[(i + 3) % pts.length];
        lines.push(`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${c2}" stroke-width="${sw}" opacity="0.55"/>`);
        lines.push(`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${c.x.toFixed(1)}" y2="${c.y.toFixed(1)}" stroke="${c1}" stroke-width="${sw}" opacity="0.35"/>`);
        const t = (progress * 1.5 + i * 0.2) % 1;
        const px = a.x + (c.x - a.x) * t;
        const py = a.y + (c.y - a.y) * t;
        packets.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${Math.max(4, minDim * 0.006)}" fill="#FFFFFF"/>`);
      }
      const nodes = pts
        .map(
          (pt, idx) =>
            `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="${Math.max(8, minDim * (idx % 3 === 0 ? 0.018 : 0.012)).toFixed(1)}" fill="${idx % 2 === 0 ? c1 : c2}" stroke="#FFFFFF" stroke-width="2.5"/>`
        )
        .join('\n');
      return `${lines.join('\n')}\n${packets.join('\n')}\n${nodes}`;
    }

    case 'ecg_wave': {
      const spanW = w * 0.82;
      const amp = p.amplitude ?? minDim * 0.16;
      const sw = p.strokeWidth ?? Math.max(5, minDim * 0.007);
      const pts: string[] = [];
      const samples = 80;
      const activeIdx = Math.floor(progress * samples);
      for (let i = 0; i <= samples; i++) {
        const u = i / samples;
        const x = -spanW / 2 + u * spanW;
        const beatPhase = (u * 3 - progress * 2) % 1;
        const bp = beatPhase < 0 ? beatPhase + 1 : beatPhase;
        let y = 0;
        if (bp > 0.35 && bp < 0.42) y = -amp * 0.22;
        else if (bp >= 0.42 && bp < 0.46) y = amp * 0.25;
        else if (bp >= 0.46 && bp < 0.51) y = -amp * 1.05;
        else if (bp >= 0.51 && bp < 0.56) y = amp * 0.42;
        else if (bp >= 0.62 && bp < 0.72) y = -amp * 0.3;
        pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
      }
      const headU = activeIdx / samples;
      const headX = -spanW / 2 + headU * spanW;
      return `
        <path d="${pts.join(' ')}" fill="none" stroke="${c1}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${headX.toFixed(1)}" cy="0" r="${(sw * 1.9).toFixed(1)}" fill="${c2}" stroke="#FFFFFF" stroke-width="3"/>
      `;
    }

    case 'gears': {
      const r1 = p.radius ?? minDim * 0.16;
      const r2 = r1 * 0.68;
      const buildGear = (cxOff: number, cyOff: number, r: number, teeth: number, rotDeg: number, fill: string) => {
        const segs: string[] = [];
        for (let i = 0; i < teeth * 2; i++) {
          const ang = (i * Math.PI) / teeth + (rotDeg * Math.PI) / 180;
          const rad = i % 2 === 0 ? r * 1.16 : r * 0.92;
          segs.push(`${i === 0 ? 'M' : 'L'} ${(cxOff + Math.cos(ang) * rad).toFixed(1)} ${(cyOff + Math.sin(ang) * rad).toFixed(1)}`);
        }
        segs.push('Z');
        return `
          <path d="${segs.join(' ')}" fill="${fill}" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round"/>
          <circle cx="${cxOff.toFixed(1)}" cy="${cyOff.toFixed(1)}" r="${(r * 0.36).toFixed(1)}" fill="#0F172A" stroke="#FFFFFF" stroke-width="3"/>
        `;
      };
      return `
        ${buildGear(-r1 * 0.68, 0, r1, 12, progress * 360, c1)}
        ${buildGear(r1 * 1.02, -r1 * 0.35, r2, 8, -progress * 540 + 18, c2)}
      `;
    }

    case 'orbit': {
      const count = p.count ?? 3;
      const rad = p.radius ?? minDim * 0.28;
      const sw = p.strokeWidth ?? Math.max(3, minDim * 0.004);
      const out: string[] = [
        `<circle cx="0" cy="0" r="${(rad * 0.18).toFixed(1)}" fill="${c2}" stroke="#FFFFFF" stroke-width="3"/>`,
      ];
      for (let i = 0; i < count; i++) {
        const tilt = (i * 180) / count;
        const ang = progress * Math.PI * 2 + (i * Math.PI * 2) / count;
        const ex = Math.cos(ang) * rad;
        const ey = Math.sin(ang) * rad * 0.38;
        out.push(`
          <g transform="rotate(${tilt})">
            <ellipse cx="0" cy="0" rx="${rad.toFixed(1)}" ry="${(rad * 0.38).toFixed(1)}" fill="none" stroke="${c1}" stroke-width="${sw}" opacity="0.8"/>
            <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="${Math.max(8, minDim * 0.016).toFixed(1)}" fill="${c2}" stroke="#FFFFFF" stroke-width="2.5"/>
          </g>
        `);
      }
      return out.join('\n');
    }

    case 'leaves': {
      const count = p.count ?? 18;
      const baseR = p.radius ?? minDim * 0.04;
      const leaves: string[] = [];
      for (let i = 0; i < count; i++) {
        const x0 = (rand() - 0.5) * w * 0.85;
        const y0 = ((rand() + progress * (0.6 + rand() * 0.5)) % 1) * h - h * 0.5;
        const sway = Math.sin(progress * Math.PI * 2 + i) * minDim * 0.05;
        const rot = progress * 180 * (i % 2 === 0 ? 1 : -1) + i * 35;
        const fill = i % 2 === 0 ? c1 : c2;
        leaves.push(
          `<g transform="translate(${(x0 + sway).toFixed(1)}, ${y0.toFixed(1)}) rotate(${rot.toFixed(1)})">
            <path d="M 0 ${-baseR} C ${baseR * 0.9} ${-baseR * 0.4} ${baseR * 0.9} ${baseR * 0.4} 0 ${baseR} C ${-baseR * 0.9} ${baseR * 0.4} ${-baseR * 0.9} ${-baseR * 0.4} 0 ${-baseR} Z" fill="${fill}"/>
          </g>`
        );
      }
      return leaves.join('\n');
    }

    case 'rain_snow': {
      const count = p.count ?? 40;
      const items: string[] = [];
      for (let i = 0; i < count; i++) {
        const x0 = (rand() - 0.5) * w * 0.95;
        const y0 = ((rand() + progress * (0.9 + rand() * 0.6)) % 1) * h - h * 0.5;
        const r = Math.max(3, (p.radius ?? minDim * 0.025) * (0.25 + rand() * 0.4));
        if (i % 3 === 0) {
          items.push(
            `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${(x0 - 12).toFixed(1)}" y2="${(y0 + r * 3.2).toFixed(1)}" stroke="${c1}" stroke-width="3" stroke-linecap="round" opacity="0.8"/>`
          );
        } else {
          items.push(`<circle cx="${x0.toFixed(1)}" cy="${y0.toFixed(1)}" r="${r.toFixed(1)}" fill="${c2}" opacity="0.85"/>`);
        }
      }
      return items.join('\n');
    }

    case 'hud_ring': {
      const count = p.count ?? 3;
      const rad = p.radius ?? minDim * 0.25;
      const sw = p.strokeWidth ?? Math.max(4, minDim * 0.005);
      const rings: string[] = [];
      for (let i = 0; i < count; i++) {
        const r = rad * (0.55 + i * 0.25);
        const dash = `${Math.round(r * 0.8)} ${Math.round(r * 0.35)}`;
        const dir = i % 2 === 0 ? 1 : -1;
        const rot = progress * 180 * dir;
        rings.push(
          `<circle cx="0" cy="0" r="${r.toFixed(1)}" fill="none" stroke="${i % 2 === 0 ? c1 : c2}" stroke-width="${sw}" stroke-dasharray="${dash}" stroke-linecap="round" transform="rotate(${rot.toFixed(1)})"/>`
        );
      }
      return rings.join('\n');
    }

    case 'vector_shape':
    default: {
      const r = p.radius ?? minDim * 0.12;
      if (p.customPath) {
        return `<path d="${p.customPath}" fill="${c1}" stroke="${c2}" stroke-width="4"/>`;
      }
      if (p.label === 'heart') {
        const d = `M 0 ${(r * 0.85).toFixed(1)} C ${(-r * 1.4).toFixed(1)} ${(r * 0.1).toFixed(1)} ${(-r * 1.2).toFixed(1)} ${(-r * 0.95).toFixed(1)} 0 ${(-r * 0.32).toFixed(1)} C ${(r * 1.2).toFixed(1)} ${(-r * 0.95).toFixed(1)} ${(r * 1.4).toFixed(1)} ${(r * 0.1).toFixed(1)} 0 ${(r * 0.85).toFixed(1)} Z`;
        return `<path d="${d}" fill="${c1}" stroke="${c2}" stroke-width="4"/>`;
      }
      return `<polygon points="0,${-r} ${r},0 0,${r} ${-r},0" fill="${c1}" stroke="${c2}" stroke-width="4"/>`;
    }
  }
}

export function renderFrameSvgAtTime(project: AnimationProject, timeSec: number): string {
  const { width: w, height: h, backgroundMode, backgroundColor } = project;
  const clampedTime = Math.max(0, Math.min(project.durationSec, timeSec));

  let bgElement = '';
  if (backgroundMode === 'green_screen') {
    bgElement = `<rect x="0" y="0" width="${w}" height="${h}" fill="#00FF00"/>`;
  } else if (backgroundMode === 'solid') {
    const fill = backgroundColor && backgroundColor !== 'transparent' ? backgroundColor : '#0B1020';
    bgElement = `<rect x="0" y="0" width="${w}" height="${h}" fill="${fill}"/>`;
  }

  const layerElements: string[] = [];
  for (const layer of project.layers) {
    if (!layer.visible) continue;
    const kf = evaluateKeyframes(layer.keyframes, clampedTime);
    const totalOpacity = Math.max(0, Math.min(1, layer.opacity * kf.opacity));
    if (totalOpacity <= 0.005) continue;

    const inner = renderLayerContentAtTime(layer, kf, project, clampedTime);
    const transform = `translate(${kf.x.toFixed(2)}, ${kf.y.toFixed(2)}) rotate(${kf.rotation.toFixed(2)}) scale(${kf.scaleX.toFixed(4)}, ${kf.scaleY.toFixed(4)})`;
    layerElements.push(
      `<g id="${escapeXml(layer.id)}" opacity="${totalOpacity.toFixed(3)}" transform="${transform}">${inner}</g>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${bgElement}
  ${layerElements.join('\n  ')}
</svg>`;
}

export function compileAnimatedSvg(project: AnimationProject): string {
  const { width: w, height: h, durationSec, backgroundMode, backgroundColor } = project;
  let bgElement = '';
  if (backgroundMode === 'green_screen') {
    bgElement = `<rect x="0" y="0" width="${w}" height="${h}" fill="#00FF00"/>`;
  } else if (backgroundMode === 'solid') {
    const fill = backgroundColor && backgroundColor !== 'transparent' ? backgroundColor : '#0B1020';
    bgElement = `<rect x="0" y="0" width="${w}" height="${h}" fill="${fill}"/>`;
  }

  const animatedGroups = project.layers
    .filter((l) => l.visible)
    .map((layer) => {
      const sorted = [...layer.keyframes].sort((a, b) => a.time - b.time);
      const first = sorted[0] ?? {
        time: 0,
        x: w / 2,
        y: h / 2,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
      };
      const midT = durationSec * 0.5;
      const midKf = evaluateKeyframes(layer.keyframes, midT);
      const inner = renderLayerContentAtTime(layer, midKf, project, midT);

      const keyTimes = sorted.map((k) => (durationSec > 0 ? (k.time / durationSec).toFixed(3) : '0')).join(';');
      const translateVals = sorted.map((k) => `${k.x.toFixed(1)} ${k.y.toFixed(1)}`).join(';');
      const rotateVals = sorted.map((k) => `${k.rotation.toFixed(1)}`).join(';');
      const scaleVals = sorted.map((k) => `${k.scaleX.toFixed(3)} ${k.scaleY.toFixed(3)}`).join(';');
      const opacityVals = sorted
        .map((k) => Math.max(0, Math.min(1, layer.opacity * k.opacity)).toFixed(3))
        .join(';');

      const anims =
        sorted.length >= 2
          ? `
      <animateTransform attributeName="transform" type="translate" values="${translateVals}" keyTimes="${keyTimes}" dur="${durationSec}s" repeatCount="indefinite"/>
      <animateTransform attributeName="transform" additive="sum" type="rotate" values="${rotateVals}" keyTimes="${keyTimes}" dur="${durationSec}s" repeatCount="indefinite"/>
      <animateTransform attributeName="transform" additive="sum" type="scale" values="${scaleVals}" keyTimes="${keyTimes}" dur="${durationSec}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="${opacityVals}" keyTimes="${keyTimes}" dur="${durationSec}s" repeatCount="indefinite"/>`
          : '';

      return `<g id="${escapeXml(layer.id)}" transform="translate(${first.x.toFixed(1)} ${first.y.toFixed(1)})">${anims}${inner}</g>`;
    });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${bgElement}
  ${animatedGroups.join('\n  ')}
</svg>`;
}

function hexToLottieRgba(hex: string): [number, number, number, number] {
  const m = hex.replace('#', '');
  if (/^[0-9a-fA-F]{6}$/.test(m)) {
    return [
      Number((parseInt(m.slice(0, 2), 16) / 255).toFixed(3)),
      Number((parseInt(m.slice(2, 4), 16) / 255).toFixed(3)),
      Number((parseInt(m.slice(4, 6), 16) / 255).toFixed(3)),
      1,
    ];
  }
  return [0.23, 0.51, 0.96, 1];
}

export function compileLottieJson(project: AnimationProject): Record<string, unknown> {
  const totalFrames = Math.max(1, Math.round(project.durationSec * project.fps));
  const lottieLayers: Record<string, unknown>[] = project.layers
    .filter((l) => l.visible)
    .map((layer, index) => {
      const sorted = [...layer.keyframes].sort((a, b) => a.time - b.time);
      const posKfs = sorted.map((k) => ({
        t: Math.round(k.time * project.fps),
        s: [Number(k.x.toFixed(2)), Number(k.y.toFixed(2)), 0],
      }));
      const scaleKfs = sorted.map((k) => ({
        t: Math.round(k.time * project.fps),
        s: [Number((k.scaleX * 100).toFixed(2)), Number((k.scaleY * 100).toFixed(2)), 100],
      }));
      const rotKfs = sorted.map((k) => ({
        t: Math.round(k.time * project.fps),
        s: [Number(k.rotation.toFixed(2))],
      }));
      const opKfs = sorted.map((k) => ({
        t: Math.round(k.time * project.fps),
        s: [Number((k.opacity * layer.opacity * 100).toFixed(2))],
      }));

      const minDim = Math.min(project.width, project.height);
      const shapeRadius = layer.params?.radius ?? Math.round(minDim * 0.12);

      return {
        ddd: 0,
        ind: index + 1,
        ty: 4,
        nm: layer.name,
        sr: 1,
        ks: {
          o: opKfs.length > 1 ? { a: 1, k: opKfs } : { a: 0, k: Math.round(layer.opacity * 100) },
          r: rotKfs.length > 1 ? { a: 1, k: rotKfs } : { a: 0, k: sorted[0]?.rotation ?? 0 },
          p: posKfs.length > 1 ? { a: 1, k: posKfs } : { a: 0, k: [project.width / 2, project.height / 2, 0] },
          a: { a: 0, k: [layer.anchorX, layer.anchorY, 0] },
          s: scaleKfs.length > 1 ? { a: 1, k: scaleKfs } : { a: 0, k: [100, 100, 100] },
        },
        ao: 0,
        shapes: [
          {
            ty: 'gr',
            nm: layer.type,
            it: [
              {
                ty: 'el',
                d: 1,
                s: { a: 0, k: [shapeRadius * 2, shapeRadius * 2] },
                p: { a: 0, k: [0, 0] },
                nm: 'Geometry',
              },
              {
                ty: 'fl',
                c: { a: 0, k: hexToLottieRgba(layer.color) },
                o: { a: 0, k: 100 },
                nm: 'Fill',
              },
              {
                ty: 'tr',
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 },
              },
            ],
          },
        ],
        ip: 0,
        op: totalFrames,
        st: 0,
        bm: 0,
      };
    });

  if (project.backgroundMode === 'green_screen' || project.backgroundMode === 'solid') {
    lottieLayers.push({
      ddd: 0,
      ind: lottieLayers.length + 1,
      ty: 4,
      nm: 'Background',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [project.width / 2, project.height / 2, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          nm: 'Backdrop',
          it: [
            {
              ty: 'el',
              d: 1,
              s: { a: 0, k: [project.width * 2, project.height * 2] },
              p: { a: 0, k: [0, 0] },
              nm: 'Rect',
            },
            {
              ty: 'fl',
              c: { a: 0, k: hexToLottieRgba(project.backgroundColor) },
              o: { a: 0, k: 100 },
              nm: 'Fill',
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
      ip: 0,
      op: totalFrames,
      st: 0,
      bm: 0,
    });
  }

  return {
    v: '5.7.4',
    fr: project.fps,
    ip: 0,
    op: totalFrames,
    w: project.width,
    h: project.height,
    nm: project.name,
    ddd: 0,
    assets: [],
    layers: lottieLayers,
  };
}

export function generateAnimationMetadata(project: AnimationProject): AnimationMetadata {
  const categoryAdobeMap: Record<AnimationCategory, string> = {
    'Motion Graphics': 'Abstract',
    'Green Screen Animation': 'Graphic Resources',
    'Transparent Background Animation': 'Graphic Resources',
    'Business & Technology': 'Business',
    'Nature & Environment': 'Nature',
    'Medical & Healthcare': 'Medical',
    'Educational & General Stock': 'Education',
  };
  const categoryShutterMap: Record<AnimationCategory, string> = {
    'Motion Graphics': 'Abstract',
    'Green Screen Animation': 'Backgrounds/Textures',
    'Transparent Background Animation': 'Abstract',
    'Business & Technology': 'Business/Finance',
    'Nature & Environment': 'Nature',
    'Medical & Healthcare': 'Healthcare/Medical',
    'Educational & General Stock': 'Education',
  };

  const bgLabel =
    project.backgroundMode === 'green_screen'
      ? 'chroma green screen'
      : project.backgroundMode === 'transparent'
      ? 'alpha transparent background'
      : 'clean studio backdrop';

  const typeLabel = project.animationType.replace(/_/g, ' ');
  const rawTitle = `${project.prompt} ${typeLabel} motion graphics (${bgLabel})`
    .replace(/\s+/g, ' ')
    .trim();
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1, 140);

  const description = `Smooth ${project.durationSec}s ${project.fps}fps ${project.visualStyle.toLowerCase()} ${typeLabel} animation for ${project.category.toLowerCase()} projects with ${bgLabel}.`.slice(
    0,
    200
  );

  const seedKeywords = [
    ...project.prompt.toLowerCase().split(/[\s,;]+/),
    ...typeLabel.split(/\s+/),
    ...project.category.toLowerCase().split(/[\s&]+/),
    ...project.visualStyle.toLowerCase().split(/\s+/),
    'animation',
    'motion',
    'loop',
    'broadcast',
    'overlay',
    'commercial',
    'kinetic',
    'visual',
    'dynamic',
    project.backgroundMode === 'green_screen' ? 'chroma' : 'alpha',
    project.backgroundMode === 'green_screen' ? 'greenscreen' : 'transparent',
  ];

  const keywords = normalizeKeywords(seedKeywords, {
    prompt: project.prompt,
    category: 'Abstract',
    style: project.visualStyle,
  });

  return {
    title,
    description,
    keywords,
    adobeCategory: project.metadata?.adobeCategory || categoryAdobeMap[project.category] || 'Abstract',
    shutterstockCategory:
      project.metadata?.shutterstockCategory || categoryShutterMap[project.category] || 'Abstract',
    targetPlatform: project.metadata?.targetPlatform ?? 'both',
  };
}

export function computeProjectHash(project: AnimationProject): string {
  const fingerprint = JSON.stringify({
    animationType: project.animationType,
    backgroundMode: project.backgroundMode,
    resolution: project.resolution,
    durationSec: project.durationSec,
    layers: project.layers.map((l) => ({
      type: l.type,
      color: l.color,
      keyframes: l.keyframes,
      params: l.params,
    })),
  });
  return crypto.createHash('sha256').update(fingerprint).digest('hex');
}
