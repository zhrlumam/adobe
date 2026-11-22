import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Film,
  Layers,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { api, formatBytes, outputFileUrl } from '../lib/api';
import type {
  AnimationProject,
  ProductionLogEntry,
  ProviderState,
  SystemDiagnostics,
} from '../types/stockforge';

export type StudioTab =
  | 'dashboard'
  | 'new_production'
  | 'editor'
  | 'batch'
  | 'library'
  | 'metadata'
  | 'export'
  | 'providers'
  | 'qa'
  | 'diagnostics';

interface DashboardViewProps {
  onNavigate: (tab: StudioTab) => void;
  onOpenEditor: (project: AnimationProject) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenEditor,
}) => {
  const [projects, setProjects] = useState<AnimationProject[]>([]);
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [activeProvider, setActiveProvider] = useState<ProviderState | null>(null);
  const [logs, setLogs] = useState<ProductionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [animRes, diagRes, provRes, logRes] = await Promise.all([
        api.listAnimations(),
        api.getDiagnostics(),
        api.getProviders(),
        api.getLogs(12),
      ]);
      setProjects(animRes.projects ?? []);
      setDiagnostics(diagRes);
      const active =
        provRes.providers.find((p) => p.isActive) ?? provRes.providers[0] ?? null;
      setActiveProvider(active);
      setLogs(logRes.logs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  if (loading && !diagnostics) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-lg border border-slate-800 bg-[#121722] animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-lg border border-slate-800 bg-[#121722] animate-pulse" />
      </div>
    );
  }

  if (error || !diagnostics) {
    return (
      <div className="p-6 rounded-lg border border-red-900/60 bg-red-950/30 text-sm text-red-200 flex items-center justify-between">
        <span>{error || 'Unable to load studio telemetry.'}</span>
        <button
          type="button"
          onClick={loadData}
          className="px-3 py-1.5 text-xs font-medium bg-[#121722] border border-slate-700 rounded-md cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const recentProjects = projects.slice(0, 6);
  const categoryMap = new Map<string, number>();
  for (const p of projects) {
    categoryMap.set(p.category, (categoryMap.get(p.category) ?? 0) + 1);
  }
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">
            Animation Studio Overview
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time FFmpeg rendering telemetry, QA validation pass rates, and /output disk assets.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-[#121722] border border-slate-800 hover:border-slate-700 rounded-md cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('new_production')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#3B82F6] hover:bg-blue-500 rounded-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Animation</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-[#121722] border border-slate-800 rounded-lg">
          <div className="text-xs font-medium text-slate-400">Animation Productions</div>
          <div className="text-3xl font-semibold text-slate-50 mt-2 font-mono tabular-nums">
            {diagnostics.totalProjects}
          </div>
          <div className="text-xs text-slate-400 mt-2 font-mono tabular-nums">
            {diagnostics.completedProjects} passed QA · {diagnostics.failedProjects} failed
          </div>
        </div>

        <div className="p-5 bg-[#121722] border border-slate-800 rounded-lg">
          <div className="text-xs font-medium text-slate-400">Stock Approval Status</div>
          <div className="text-3xl font-semibold text-emerald-400 mt-2 font-mono tabular-nums">
            {diagnostics.approvedProjects}
          </div>
          <div className="text-xs text-slate-400 mt-2 font-mono tabular-nums">
            {diagnostics.totalBatches} batch job(s) recorded
          </div>
        </div>

        <div className="p-5 bg-[#121722] border border-slate-800 rounded-lg">
          <div className="text-xs font-medium text-slate-400">Render Engine (FFmpeg)</div>
          <div className="text-lg font-semibold text-slate-50 mt-2 flex items-center gap-2">
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                diagnostics.ffmpegAvailable ? 'text-emerald-400' : 'text-red-400'
              }`}
            />
            <span>{diagnostics.ffmpegAvailable ? 'Ready (H.264 + ProRes)' : 'Missing FFmpeg'}</span>
          </div>
          <div className="text-xs text-slate-400 mt-2 font-mono truncate">
            {diagnostics.proresAlphaSupported ? 'ProRes 4444 Alpha active' : 'Standard codecs'} ·{' '}
            {activeProvider ? activeProvider.name : 'Procedural'}
          </div>
        </div>

        <div className="p-5 bg-[#121722] border border-slate-800 rounded-lg">
          <div className="text-xs font-medium text-slate-400">/output Disk Footprint</div>
          <div className="text-3xl font-semibold text-slate-50 mt-2 font-mono tabular-nums">
            {formatBytes(diagnostics.storageBytes)}
          </div>
          <div className="text-xs text-slate-400 mt-2 font-mono truncate">
            {diagnostics.outputFolders.reduce((a, b) => a + b.fileCount, 0)} rendered files stored
          </div>
        </div>
      </div>

      {/* Quick Workflows */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('new_production')}
          className="text-left p-5 bg-[#121722] border border-slate-800 hover:border-[#3B82F6] rounded-lg transition-colors cursor-pointer group"
        >
          <div className="text-sm font-semibold text-slate-100 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Film className="w-4 h-4 text-[#3B82F6]" />
              <span>Single & Chroma Production</span>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-[#3B82F6]" />
          </div>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Produce MP4 H.264, ProRes 4444 Alpha, pure #00FF00 Green Screen, and editable SVG/Lottie source.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('editor')}
          className="text-left p-5 bg-[#121722] border border-slate-800 hover:border-[#3B82F6] rounded-lg transition-colors cursor-pointer group"
        >
          <div className="text-sm font-semibold text-slate-100 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#3B82F6]" />
              <span>Timeline & Layer Editor</span>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-[#3B82F6]" />
          </div>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Scrub frames, edit keyframes & easing, tweak palettes, test green-screen keying, and re-render.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('qa')}
          className="text-left p-5 bg-[#121722] border border-slate-800 hover:border-[#3B82F6] rounded-lg transition-colors cursor-pointer group"
        >
          <div className="text-sm font-semibold text-slate-100 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Quality Control & Review</span>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-[#3B82F6]" />
          </div>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Inspect ffprobe codec metrics, motion scores, alpha integrity, and approve assets for export.
          </p>
        </button>
      </div>

      {/* Recent Rendered Animations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Recent Productions</h2>
          <button
            type="button"
            onClick={() => onNavigate('library')}
            className="text-xs font-medium text-[#3B82F6] hover:underline cursor-pointer"
          >
            Open Asset Library →
          </button>
        </div>

        {recentProjects.length === 0 ? (
          <div className="p-10 bg-[#121722] border border-dashed border-slate-700 rounded-lg text-center">
            <Film className="w-6 h-6 text-slate-500 mx-auto mb-2" />
            <div className="text-sm font-medium text-slate-100">No animations rendered yet</div>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Start a new production using the procedural motion engine or your connected AI provider.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('new_production')}
              className="mt-4 px-4 py-2 text-xs font-medium text-white bg-[#3B82F6] hover:bg-blue-500 rounded-md cursor-pointer"
            >
              Create First Animation
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentProjects.map((project) => {
              const previewVideo =
                project.outputFiles.find((f) => f.format === 'mp4_preview') ??
                project.outputFiles.find((f) => f.format === 'mp4_h264');
              const videoUrl = outputFileUrl(previewVideo?.relativePath);
              const thumb = project.outputFiles.find((f) => f.format === 'thumbnail_png');
              const thumbUrl = outputFileUrl(thumb?.relativePath);

              return (
                <div
                  key={project.id}
                  onClick={() => onOpenEditor(project)}
                  className="bg-[#121722] border border-slate-800 hover:border-slate-600 rounded-lg overflow-hidden transition-colors cursor-pointer flex flex-col"
                >
                  <div className="h-44 bg-[#0B0E14] border-b border-slate-800 relative flex items-center justify-center overflow-hidden">
                    {videoUrl ? (
                      <video
                        src={videoUrl}
                        poster={thumbUrl ?? undefined}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-contain"
                      />
                    ) : thumbUrl ? (
                      <img src={thumbUrl} alt={project.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-xs font-mono text-slate-500">
                        {project.status === 'failed' ? 'Render Failed' : 'Draft Project'}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400 tabular-nums">
                      <span className="truncate">
                        {project.id} · {project.resolution} · {project.fps}fps · {project.durationSec}s
                      </span>
                      <span
                        className={
                          project.status === 'completed'
                            ? 'text-emerald-400'
                            : project.status === 'failed'
                            ? 'text-red-400'
                            : 'text-amber-400'
                        }
                      >
                        {project.status}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-slate-100 mt-1 truncate">
                      {project.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 truncate">
                      {project.category} · {project.backgroundMode.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Category Breakdown & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-[#121722] border border-slate-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-slate-400" />
            <span>Category Distribution</span>
          </h3>
          {categoryBreakdown.length === 0 ? (
            <p className="text-xs text-slate-500">No productions categorized yet.</p>
          ) : (
            <div className="space-y-2.5">
              {categoryBreakdown.map((item) => (
                <div key={item.category} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{item.category}</span>
                  <span className="font-mono text-slate-100 font-medium tabular-nums">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-[#121722] border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-100">Recent Pipeline Events</h3>
            <button
              type="button"
              onClick={() => onNavigate('diagnostics')}
              className="text-xs text-[#3B82F6] hover:underline cursor-pointer"
            >
              System Diagnostics →
            </button>
          </div>
          {logs.length === 0 ? (
            <p className="text-xs text-slate-500">No pipeline events recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {logs.slice(0, 6).map((log) => (
                <div key={log.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-200 truncate">{log.message}</div>
                    <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                      {log.eventType}
                      {log.providerSlug ? ` · ${log.providerSlug}` : ''}
                      {log.latencyMs ? ` · ${log.latencyMs}ms` : ''}
                    </div>
                  </div>
                  <span
                    className={`font-mono text-[11px] shrink-0 ${
                      log.status === 'error'
                        ? 'text-red-400'
                        : log.status === 'success'
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
