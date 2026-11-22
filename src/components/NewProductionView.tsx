import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Film,
  Loader2,
  Play,
  Sliders,
} from 'lucide-react';
import {
  ANIMATION_CATEGORIES,
  ANIMATION_TYPES_BY_CATEGORY,
  EXPORT_FORMAT_LABELS,
  FPS_OPTIONS,
  RESOLUTIONS,
  TARGET_PLATFORMS,
  VISUAL_STYLES,
  api,
  downloadAnimationFormat,
  formatBytes,
  outputFileUrl,
} from '../lib/api';
import type {
  AnimationCategory,
  AnimationExportFormat,
  AnimationProject,
  AnimationType,
  BackgroundMode,
  FpsOption,
  ProviderSlug,
  ProviderState,
  ResolutionPreset,
  TargetPlatform,
  VisualStyle,
} from '../types/stockforge';

interface NewProductionViewProps {
  onOpenEditor: (project: AnimationProject) => void;
  onNotify: (msg: string) => void;
  onGoToProviders: () => void;
}

const PRESET_PROMPTS: {
  label: string;
  category: AnimationCategory;
  animationType: AnimationType;
  bg: BackgroundMode;
  prompt: string;
}[] = [
  {
    label: 'Green Screen Cursor Click',
    category: 'Green Screen Animation',
    animationType: 'cursor_click',
    bg: 'green_screen',
    prompt: 'Animated pointer cursor moving to subscribe button with click ripple',
  },
  {
    label: 'Transparent Smoke Plume',
    category: 'Transparent Background Animation',
    animationType: 'smoke',
    bg: 'transparent',
    prompt: 'Smooth rising atmospheric smoke plume dispersing upward',
  },
  {
    label: 'Financial Growth Chart',
    category: 'Business & Technology',
    animationType: 'data_chart',
    bg: 'solid',
    prompt: 'Corporate financial bar chart rising with upward trend line',
  },
  {
    label: 'Medical ECG Heartbeat',
    category: 'Medical & Healthcare',
    animationType: 'heartbeat_ecg',
    bg: 'solid',
    prompt: 'Clinical ECG heartbeat monitor wave with pulsing heart emblem',
  },
];

export const NewProductionView: React.FC<NewProductionViewProps> = ({
  onOpenEditor,
  onNotify,
  onGoToProviders,
}) => {
  const [prompt, setPrompt] = useState(
    'Animated pointer cursor moving across screen and clicking an action button'
  );
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AnimationCategory>('Green Screen Animation');
  const [animationType, setAnimationType] = useState<AnimationType>('cursor_click');
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('Clean Vector Motion');
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('green_screen');
  const [backgroundColor, setBackgroundColor] = useState('#0B1020');
  const [resolution, setResolution] = useState<ResolutionPreset>('1920x1080');
  const [durationSec, setDurationSec] = useState(3);
  const [fps, setFps] = useState<FpsOption>(30);
  const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>('both');

  const [engineMode, setEngineMode] = useState<'procedural' | ProviderSlug>('procedural');
  const [providers, setProviders] = useState<ProviderState[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<AnimationExportFormat[]>([
    'mp4_h264',
    'gif_preview',
    'svg_animated',
    'lottie_json',
    'source_zip',
  ]);

  const [producing, setProducing] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnimationProject | null>(null);

  useEffect(() => {
    void api.getProviders().then((d) => setProviders(d.providers ?? [])).catch(() => {});
  }, []);

  const handleCategoryChange = (nextCat: AnimationCategory) => {
    setCategory(nextCat);
    const list = ANIMATION_TYPES_BY_CATEGORY[nextCat];
    if (list && list.length > 0) {
      setAnimationType(list[0].id);
    }
    if (nextCat === 'Green Screen Animation') {
      setBackgroundMode('green_screen');
    } else if (nextCat === 'Transparent Background Animation') {
      setBackgroundMode('transparent');
      setSelectedFormats((prev) =>
        Array.from(new Set([...prev, 'mov_alpha', 'png_sequence']))
      );
    }
  };

  const toggleFormat = (fmt: AnimationExportFormat) => {
    setSelectedFormats((prev) =>
      prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt]
    );
  };

  const handleProduce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim().length < 3) {
      setError('Enter an animation prompt of at least 3 characters.');
      return;
    }

    setProducing(true);
    setError(null);
    setResult(null);
    setStageIndex(1);

    const stageTimer = window.setInterval(() => {
      setStageIndex((prev) => (prev < 4 ? prev + 1 : prev));
    }, 900);

    try {
      const selectedProv = providers.find((p) => p.slug === engineMode);
      const formatsToRender = Array.from(
        new Set([
          ...selectedFormats,
          ...(backgroundMode === 'transparent'
            ? (['mov_alpha', 'png_sequence'] as AnimationExportFormat[])
            : []),
        ])
      );

      const res = await api.createAnimation({
        name: name.trim() || undefined,
        prompt: prompt.trim(),
        category,
        animationType,
        visualStyle,
        backgroundMode,
        backgroundColor: backgroundMode === 'solid' ? backgroundColor : undefined,
        resolution,
        durationSec,
        fps,
        targetPlatform,
        providerSlug: engineMode,
        model: selectedProv?.selectedModel,
        exportFormats: formatsToRender,
        renderNow: true,
      });

      setStageIndex(5);
      setResult(res.project);
      if (res.project.status === 'failed') {
        setError(res.project.errorMessage || 'QA validation rejected output.');
        onNotify('Production failed QA checks');
      } else {
        onNotify(`Rendered & QA-verified ${res.project.id}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Animation production failed';
      setError(msg);
      onNotify(msg);
    } finally {
      window.clearInterval(stageTimer);
      setProducing(false);
    }
  };

  const handleApprove = async () => {
    if (!result) return;
    try {
      const res = await api.reviewAnimation(result.id, 'approved');
      setResult(res.project);
      onNotify(`Approved ${result.id} for stock submission`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Approval failed');
    }
  };

  const pipelineSteps = [
    '1. Animation Specification',
    '2. Editable SVG & Lottie Source',
    '3. Frame Rasterization',
    '4. FFmpeg Encoding',
    '5. Automated QA & Metadata',
  ];

  const previewMp4 = result?.outputFiles.find(
    (f) => f.format === 'mp4_preview' || f.format === 'mp4_h264'
  );
  const previewVideoUrl = outputFileUrl(previewMp4?.relativePath);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">
            New Animation Production
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure animation choreography, render frames via FFmpeg, run automated QA, and inspect deliverables.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESET_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setCategory(p.category);
                setAnimationType(p.animationType);
                setBackgroundMode(p.bg);
                setPrompt(p.prompt);
              }}
              className="px-2.5 py-1.5 text-xs text-slate-300 bg-[#121722] border border-slate-800 hover:border-[#3B82F6] rounded-md cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Configuration Form */}
        <form
          onSubmit={handleProduce}
          className="lg:col-span-5 bg-[#121722] border border-slate-800 rounded-lg p-5 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Animation Prompt
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the motion, subject, timing, and commercial purpose..."
              className="w-full px-3 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md focus:outline-none focus:border-[#3B82F6]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Project Title (Optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Auto-generated from prompt"
                className="w-full px-3 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Synthesis Engine
              </label>
              <select
                value={engineMode}
                onChange={(e) => setEngineMode(e.target.value as 'procedural' | ProviderSlug)}
                className="w-full px-3 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              >
                <option value="procedural">Built-in Procedural Engine (Zero API Key)</option>
                {providers.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    AI: {p.name} ({p.hasKey || !p.catalog.requiresApiKey ? p.selectedModel : 'Needs Key'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Production Category
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as AnimationCategory)}
                className="w-full px-3 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              >
                {ANIMATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Animation Type
              </label>
              <select
                value={animationType}
                onChange={(e) => setAnimationType(e.target.value as AnimationType)}
                className="w-full px-3 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              >
                {(ANIMATION_TYPES_BY_CATEGORY[category] ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Visual Style
              </label>
              <select
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value as VisualStyle)}
                className="w-full px-3 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              >
                {VISUAL_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Background Mode
              </label>
              <select
                value={backgroundMode}
                onChange={(e) => setBackgroundMode(e.target.value as BackgroundMode)}
                className="w-full px-3 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              >
                <option value="solid">Solid Studio Backdrop</option>
                <option value="green_screen">Pure Chroma Green Screen (#00FF00)</option>
                <option value="transparent">Transparent Alpha Channel (RGBA)</option>
              </select>
            </div>
          </div>

          {backgroundMode === 'solid' && (
            <div className="flex items-center justify-between text-xs bg-[#0B0E14] border border-slate-800 rounded-md px-3 py-2">
              <span className="text-slate-300">Solid Background Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-7 h-7 bg-transparent border-0 cursor-pointer"
                />
                <span className="font-mono text-slate-400">{backgroundColor}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as ResolutionPreset)}
                className="w-full px-2.5 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              >
                {RESOLUTIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Duration (s)
              </label>
              <input
                type="number"
                min={1.5}
                max={15}
                step={0.5}
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                className="w-full px-2.5 py-2 text-xs font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">FPS</label>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value) as FpsOption)}
                className="w-full px-2.5 py-2 text-xs font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              >
                {FPS_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f} fps
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Target Marketplace
            </label>
            <select
              value={targetPlatform}
              onChange={(e) => setTargetPlatform(e.target.value as TargetPlatform)}
              className="w-full px-3 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
            >
              {TARGET_PLATFORMS.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {tp.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-300 mb-1.5">
              Render Deliverables
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {(
                [
                  'mp4_h264',
                  'mov_prores',
                  'mov_alpha',
                  'png_sequence',
                  'gif_preview',
                  'svg_animated',
                  'lottie_json',
                  'source_zip',
                ] as AnimationExportFormat[]
              ).map((fmt) => (
                <label
                  key={fmt}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#0B0E14] border border-slate-800 text-slate-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedFormats.includes(fmt)}
                    onChange={() => toggleFormat(fmt)}
                  />
                  <span className="truncate">{EXPORT_FORMAT_LABELS[fmt].label}</span>
                </label>
              ))}
            </div>
          </div>

          {engineMode !== 'procedural' && (
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Using AI spec synthesis via {engineMode}</span>
              <button
                type="button"
                onClick={onGoToProviders}
                className="text-[#3B82F6] hover:underline cursor-pointer"
              >
                Configure Providers
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={producing}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-[#3B82F6] hover:bg-blue-500 rounded-md cursor-pointer disabled:opacity-50"
          >
            {producing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>
              {producing
                ? 'Rendering Frames & Running FFmpeg...'
                : 'Produce, Render & Validate Animation'}
            </span>
          </button>
        </form>

        {/* Right: Live Pipeline Stages & Real Video Result */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#121722] border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-100">Production Pipeline Status</h2>
              <span className="font-mono text-xs text-slate-400">
                {producing ? 'Active' : result ? result.pipelineStage : 'Idle'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {pipelineSteps.map((step, idx) => {
                const done = stageIndex > idx || (result && result.status === 'completed');
                const active = producing && stageIndex === idx + 1;
                return (
                  <div
                    key={step}
                    className={`p-2.5 rounded border text-[11px] font-medium ${
                      done
                        ? 'border-emerald-800/80 bg-emerald-950/30 text-emerald-300'
                        : active
                        ? 'border-[#3B82F6] bg-blue-950/30 text-blue-300'
                        : 'border-slate-800 bg-[#0B0E14] text-slate-500'
                    }`}
                  >
                    {step}
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-lg border border-red-900/70 bg-red-950/30 text-xs text-red-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div className="font-mono">{error}</div>
            </div>
          )}

          {result ? (
            <div className="bg-[#121722] border border-slate-800 rounded-lg overflow-hidden">
              <div className="aspect-video bg-[#0B0E14] checkerboard-dark flex items-center justify-center relative border-b border-slate-800">
                {previewVideoUrl ? (
                  <video
                    key={previewVideoUrl}
                    src={previewVideoUrl}
                    controls
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <Film className="w-4 h-4" />
                    <span>No preview video available</span>
                  </div>
                )}
              </div>

              <div className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                      <span>{result.id}</span>
                      <span>·</span>
                      <span>{result.resolution}</span>
                      <span>·</span>
                      <span>{result.fps}fps</span>
                      <span>·</span>
                      <span>{result.durationSec}s</span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-100 mt-1">
                      {result.metadata.title || result.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">{result.metadata.description}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenEditor(result)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#0B0E14] border border-slate-700 hover:border-[#3B82F6] rounded-md cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Open in Editor</span>
                    </button>
                    {result.status === 'completed' && result.reviewStatus !== 'approved' && (
                      <button
                        type="button"
                        onClick={handleApprove}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-md cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                    )}
                  </div>
                </div>

                {result.qaReport && (
                  <div className="p-3 rounded-md bg-[#0B0E14] border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
                    <div>
                      <div className="text-slate-500 text-[11px]">QA Status</div>
                      <div className={result.qaReport.passed ? 'text-emerald-400' : 'text-red-400'}>
                        {result.qaReport.passed ? 'PASSED' : 'FAILED'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[11px]">Frames / Motion</div>
                      <div className="text-slate-200">
                        {result.qaReport.frameCountRendered}f · {result.qaReport.motionScore}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[11px]">Black / Empty</div>
                      <div className="text-slate-200">
                        {result.qaReport.blackFrameCount} / {result.qaReport.emptyFrameCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-[11px]">
                        {result.backgroundMode === 'green_screen'
                          ? 'Green Purity'
                          : result.backgroundMode === 'transparent'
                          ? 'Alpha Check'
                          : 'Codec Probe'}
                      </div>
                      <div className="text-slate-200">
                        {result.backgroundMode === 'green_screen'
                          ? `${result.qaReport.greenScreenPurityPct ?? 0}%`
                          : result.backgroundMode === 'transparent'
                          ? result.qaReport.alphaVerified
                            ? 'RGBA Verified'
                            : 'Missing Alpha'
                          : result.qaReport.videoProbes[0]?.codecName || 'ok'}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs font-medium text-slate-300 mb-2">
                    Generated Files on Disk (/output)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.outputFiles.map((f) => (
                      <button
                        key={f.format}
                        type="button"
                        onClick={() =>
                          void downloadAnimationFormat(result.id, f.format).catch((err) =>
                            onNotify(err instanceof Error ? err.message : 'Download failed')
                          )
                        }
                        className="flex items-center justify-between px-3 py-2 rounded bg-[#0B0E14] border border-slate-800 hover:border-[#3B82F6] text-xs cursor-pointer"
                      >
                        <span className="truncate text-slate-200">
                          {EXPORT_FORMAT_LABELS[f.format]?.label || f.format}
                        </span>
                        <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400 shrink-0">
                          <span>{formatBytes(f.sizeBytes)}</span>
                          <Download className="w-3.5 h-3.5 text-[#3B82F6]" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#121722] border border-dashed border-slate-800 rounded-lg p-12 text-center text-xs text-slate-400">
              Configure your parameters on the left and click &ldquo;Produce, Render & Validate Animation&rdquo; to generate real frames, FFmpeg video deliverables, editable SVG/Lottie sources, and QA verification.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
