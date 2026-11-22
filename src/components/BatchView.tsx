import React, { useEffect, useState } from 'react';
import {
  Download,
  ExternalLink,
  Layers,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
} from 'lucide-react';
import {
  ANIMATION_CATEGORIES,
  ANIMATION_TYPES_BY_CATEGORY,
  FPS_OPTIONS,
  RESOLUTIONS,
  VISUAL_STYLES,
  api,
  downloadAnimationZip,
} from '../lib/api';
import type {
  AnimationBatchJob,
  AnimationCategory,
  AnimationProject,
  AnimationType,
  BackgroundMode,
  FpsOption,
  ProviderSlug,
  ProviderState,
  ResolutionPreset,
  VisualStyle,
} from '../types/stockforge';

interface BatchViewProps {
  onNotify: (msg: string) => void;
  onOpenProjectById: (projectId: string) => void;
  onOpenProject?: (project: AnimationProject) => void;
}

const QUANTITIES = [1, 5, 10, 25, 50, 100];

export const BatchView: React.FC<BatchViewProps> = ({ onNotify, onOpenProjectById }) => {
  const [batches, setBatches] = useState<AnimationBatchJob[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<AnimationBatchJob | null>(null);
  const [providers, setProviders] = useState<ProviderState[]>([]);

  const [name, setName] = useState('Commercial Motion Graphics Set');
  const [basePrompt, setBasePrompt] = useState(
    'Modern dynamic abstract shapes and glowing particles looping smoothly'
  );
  const [category, setCategory] = useState<AnimationCategory>('Motion Graphics');
  const [animationType, setAnimationType] = useState<AnimationType | 'mixed'>('mixed');
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('Clean Vector Motion');
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('solid');
  const [resolution, setResolution] = useState<ResolutionPreset>('1920x1080');
  const [durationSec, setDurationSec] = useState(2.5);
  const [fps, setFps] = useState<FpsOption>(24);
  const [requestedCount, setRequestedCount] = useState(5);
  const [concurrency, setConcurrency] = useState(2);
  const [engineSlug, setEngineSlug] = useState<'procedural' | ProviderSlug>('procedural');
  const [submitting, setSubmitting] = useState(false);

  const loadBatches = async () => {
    try {
      const [bRes, pRes] = await Promise.all([api.listAnimationBatches(), api.getProviders()]);
      const list = bRes.batches ?? [];
      setBatches(list);
      setProviders(pRes.providers ?? []);
      if (selectedBatch) {
        const detail = await api.getAnimationBatch(selectedBatch.id);
        setSelectedBatch(detail.batch);
      } else if (list.length > 0) {
        const detail = await api.getAnimationBatch(list[0].id);
        setSelectedBatch(detail.batch);
      }
    } catch {
      // ignore poll hiccup
    }
  };

  useEffect(() => {
    void loadBatches();
  }, []);

  useEffect(() => {
    const hasActive = batches.some((b) => b.status === 'running' || b.status === 'queued');
    if (!hasActive && selectedBatch?.status !== 'running' && selectedBatch?.status !== 'queued') {
      return;
    }
    const id = window.setInterval(() => {
      void loadBatches();
    }, 1500);
    return () => window.clearInterval(id);
  }, [batches, selectedBatch?.id, selectedBatch?.status]);

  const handleStartBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (basePrompt.trim().length < 3) {
      onNotify('Enter a base prompt of at least 3 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const prov = providers.find((p) => p.slug === engineSlug);
      const res = await api.createAnimationBatch({
        name: name.trim() || `${category} Batch (${requestedCount})`,
        basePrompt: basePrompt.trim(),
        category,
        animationType,
        visualStyle,
        backgroundMode,
        resolution,
        durationSec,
        fps,
        providerSlug: engineSlug,
        model: engineSlug === 'procedural' ? 'stockforge-procedural-v1' : prov?.selectedModel || '',
        requestedCount,
        concurrency,
        exportFormats: [
          'mp4_h264',
          'mp4_preview',
          'gif_preview',
          'thumbnail_png',
          'svg_animated',
          'lottie_json',
          'source_zip',
          ...(backgroundMode === 'transparent'
            ? (['mov_alpha', 'png_sequence'] as ('mov_alpha' | 'png_sequence')[])
            : []),
        ],
      });
      setSelectedBatch(res.batch);
      await loadBatches();
      onNotify(`Started batch ${res.batch.id} (${requestedCount} unique animations)`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Batch creation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectBatch = async (id: string) => {
    try {
      const res = await api.getAnimationBatch(id);
      setSelectedBatch(res.batch);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load batch');
    }
  };

  const handleAction = async (
    action: 'pause' | 'resume' | 'retry' | 'cancel',
    batchId: string
  ) => {
    try {
      const res =
        action === 'pause'
          ? await api.pauseAnimationBatch(batchId)
          : action === 'resume'
          ? await api.resumeAnimationBatch(batchId, false)
          : action === 'retry'
          ? await api.resumeAnimationBatch(batchId, true)
          : await api.cancelAnimationBatch(batchId);
      setSelectedBatch(res.batch);
      await loadBatches();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Batch control failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">
            Batch Production Queue
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Queue 1 to 100 distinct animations with automatic variation synthesis, FFmpeg encoding, and QA validation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadBatches()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-[#121722] border border-slate-800 hover:border-slate-700 rounded-md cursor-pointer self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Batch Configurator */}
        <form
          onSubmit={handleStartBatch}
          className="lg:col-span-5 bg-[#121722] border border-slate-800 rounded-lg p-5 space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-100">Queue New Animation Batch</h2>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Batch Title</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Base Prompt</label>
            <textarea
              rows={2}
              value={basePrompt}
              onChange={(e) => setBasePrompt(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as AnimationCategory);
                  setAnimationType('mixed');
                }}
                className="w-full px-2.5 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              >
                {ANIMATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Animation Type</label>
              <select
                value={animationType}
                onChange={(e) => setAnimationType(e.target.value as AnimationType | 'mixed')}
                className="w-full px-2.5 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              >
                <option value="mixed">Mixed (Unique Type per Item)</option>
                {(ANIMATION_TYPES_BY_CATEGORY[category] ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Visual Style</label>
              <select
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value as VisualStyle)}
                className="w-full px-2.5 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              >
                {VISUAL_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Background</label>
              <select
                value={backgroundMode}
                onChange={(e) => setBackgroundMode(e.target.value as BackgroundMode)}
                className="w-full px-2.5 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              >
                <option value="solid">Solid Backdrop</option>
                <option value="green_screen">Green Screen (#00FF00)</option>
                <option value="transparent">Transparent Alpha</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as ResolutionPreset)}
                className="w-full px-2 py-2 text-xs font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              >
                {RESOLUTIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Duration (s)</label>
              <input
                type="number"
                min={1.5}
                max={15}
                step={0.5}
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                className="w-full px-2 py-2 text-xs font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">FPS</label>
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value) as FpsOption)}
                className="w-full px-2 py-2 text-xs font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
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
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Batch Asset Count
            </label>
            <div className="grid grid-cols-6 gap-1.5">
              {QUANTITIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setRequestedCount(q)}
                  className={`py-1.5 text-xs font-mono rounded border cursor-pointer ${
                    requestedCount === q
                      ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
                      : 'bg-[#0B0E14] border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Synthesis Engine
              </label>
              <select
                value={engineSlug}
                onChange={(e) => setEngineSlug(e.target.value as 'procedural' | ProviderSlug)}
                className="w-full px-2.5 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              >
                <option value="procedural">Procedural Engine</option>
                {providers.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Concurrency (1–4)
              </label>
              <input
                type="number"
                min={1}
                max={4}
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-[#3B82F6] hover:bg-blue-500 rounded-md cursor-pointer disabled:opacity-50"
          >
            <Layers className="w-4 h-4" />
            <span>{submitting ? 'Queuing Batch...' : `Start ${requestedCount}-Asset Animation Batch`}</span>
          </button>
        </form>

        {/* Right: Active Queue & Job Details */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#121722] border border-slate-800 rounded-lg p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">Persistent Batch Jobs</h2>
            {batches.length === 0 ? (
              <div className="text-xs text-slate-500 py-4">No animation batches created yet.</div>
            ) : (
              <div className="divide-y divide-slate-800 max-h-56 overflow-y-auto">
                {batches.map((b) => {
                  const pct = Math.round(
                    ((b.completedCount + b.failedCount) / Math.max(1, b.requestedCount)) * 100
                  );
                  return (
                    <div
                      key={b.id}
                      onClick={() => void handleSelectBatch(b.id)}
                      className={`py-3 px-2 rounded cursor-pointer flex items-center justify-between gap-4 ${
                        selectedBatch?.id === b.id ? 'bg-[#0B0E14]' : 'hover:bg-[#0B0E14]/60'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          {b.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5 tabular-nums">
                          {b.id} · {b.completedCount}/{b.requestedCount} done
                          {b.failedCount > 0 ? ` · ${b.failedCount} failed` : ''} · {pct}%
                        </div>
                      </div>
                      <span
                        className={`text-xs font-mono shrink-0 ${
                          b.status === 'completed'
                            ? 'text-emerald-400'
                            : b.status === 'failed'
                            ? 'text-red-400'
                            : b.status === 'running'
                            ? 'text-[#3B82F6]'
                            : 'text-amber-400'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedBatch && (
            <div className="bg-[#121722] border border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-mono text-slate-400">
                    {selectedBatch.id} · {selectedBatch.resolution} · {selectedBatch.fps}fps ·{' '}
                    {selectedBatch.durationSec}s
                  </div>
                  <h3 className="text-base font-semibold text-slate-100 mt-0.5">
                    {selectedBatch.name}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(selectedBatch.status === 'running' || selectedBatch.status === 'queued') && (
                    <button
                      type="button"
                      onClick={() => void handleAction('pause', selectedBatch.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#0B0E14] border border-slate-700 text-slate-200 rounded cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </button>
                  )}
                  {selectedBatch.status === 'paused' && (
                    <button
                      type="button"
                      onClick={() => void handleAction('resume', selectedBatch.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#3B82F6] text-white rounded cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Resume</span>
                    </button>
                  )}
                  {selectedBatch.failedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleAction('retry', selectedBatch.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-amber-600 text-white rounded cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry Failed</span>
                    </button>
                  )}
                  {(selectedBatch.status === 'running' ||
                    selectedBatch.status === 'paused' ||
                    selectedBatch.status === 'queued') && (
                    <button
                      type="button"
                      onClick={() => void handleAction('cancel', selectedBatch.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-red-950/50 border border-red-800 text-red-300 rounded cursor-pointer"
                    >
                      <Square className="w-3 h-3" />
                      <span>Cancel</span>
                    </button>
                  )}
                  {selectedBatch.completedCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        void downloadAnimationZip({
                          batchId: selectedBatch.id,
                          formats: ['mp4_h264', 'svg_animated', 'lottie_json', 'source_zip'],
                          includeAdobeCsv: true,
                          includeShutterstockCsv: true,
                        }).catch((err) =>
                          onNotify(err instanceof Error ? err.message : 'Batch ZIP failed')
                        )
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Batch ZIP</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="w-full h-2 bg-[#0B0E14] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#3B82F6] transition-all"
                  style={{
                    width: `${Math.round(
                      ((selectedBatch.completedCount + selectedBatch.failedCount) /
                        Math.max(1, selectedBatch.requestedCount)) *
                        100
                    )}%`,
                  }}
                />
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-800 border-t border-slate-800">
                {(selectedBatch.items ?? []).map((item) => (
                  <div
                    key={item.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-slate-300 truncate">
                        #{item.seqIndex} · {item.animationType} · {item.variationPrompt}
                      </div>
                      {item.errorMessage && (
                        <div className="text-[11px] text-red-400 font-mono truncate mt-0.5">
                          {item.errorMessage}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-mono text-[11px] ${
                          item.status === 'completed'
                            ? 'text-emerald-400'
                            : item.status === 'failed'
                            ? 'text-red-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {item.status}
                      </span>
                      {item.projectId && (
                        <button
                          type="button"
                          onClick={() => onOpenProjectById(item.projectId!)}
                          className="inline-flex items-center gap-1 text-[#3B82F6] hover:underline cursor-pointer"
                        >
                          <span>Edit</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
