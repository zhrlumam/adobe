import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Sliders,
  XCircle,
} from 'lucide-react';
import { api, formatBytes, outputFileUrl } from '../lib/api';
import type { AnimationProject, ReviewStatus } from '../types/stockforge';

interface QualityControlViewProps {
  onOpenEditor: (project: AnimationProject) => void;
  onNotify: (msg: string) => void;
  refreshTick?: number;
}

type QaFilter = 'all' | 'passed' | 'failed' | 'pending_review' | 'approved' | 'rejected';

export const QualityControlView: React.FC<QualityControlViewProps> = ({
  onOpenEditor,
  onNotify,
  refreshTick = 0,
}) => {
  const [projects, setProjects] = useState<AnimationProject[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [filter, setFilter] = useState<QaFilter>('all');
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await api.listAnimations();
      const list = res.projects ?? [];
      setProjects(list);
      if (list.length > 0 && (!selectedId || !list.some((p) => p.id === selectedId))) {
        setSelectedId(list[0].id);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load QA queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, [refreshTick]);

  const filtered = projects.filter((p) => {
    if (filter === 'passed') return Boolean(p.qaReport?.passed) && p.status === 'completed';
    if (filter === 'failed') return p.status === 'failed' || p.qaReport?.passed === false;
    if (filter === 'pending_review') return p.reviewStatus === 'pending_review';
    if (filter === 'approved') return p.reviewStatus === 'approved';
    if (filter === 'rejected') return p.reviewStatus === 'rejected';
    return true;
  });

  const selected =
    filtered.find((p) => p.id === selectedId) ??
    projects.find((p) => p.id === selectedId) ??
    filtered[0] ??
    null;

  const handleReview = async (project: AnimationProject, reviewStatus: ReviewStatus) => {
    setBusyAction(`review:${reviewStatus}`);
    try {
      const res = await api.reviewAnimation(project.id, reviewStatus);
      setProjects((prev) => prev.map((p) => (p.id === res.project.id ? res.project : p)));
      onNotify(`Marked ${project.id} as ${reviewStatus.replace('_', ' ')}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Review update failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleReRender = async (project: AnimationProject) => {
    setBusyAction('render');
    try {
      const res = await api.renderAnimation(project.id);
      setProjects((prev) => prev.map((p) => (p.id === res.project.id ? res.project : p)));
      onNotify(
        res.project.status === 'completed'
          ? `Re-rendered ${project.id} and passed automated QA`
          : `QA flagged issues on ${project.id}`
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Re-render failed');
    } finally {
      setBusyAction(null);
    }
  };

  const passedCount = projects.filter((p) => p.status === 'completed' && p.qaReport?.passed).length;
  const failedCount = projects.filter((p) => p.status === 'failed' || p.qaReport?.passed === false).length;
  const approvedCount = projects.filter((p) => p.reviewStatus === 'approved').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">
            Quality Control & Manual Review
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Inspect ffprobe stream metadata, pixel-level motion &amp; duplicate frame ratios, alpha transparency, green-screen purity, and /output/failed logs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadProjects()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-[#121722] border border-slate-800 hover:border-slate-700 rounded-md cursor-pointer self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh QA</span>
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-[#121722] border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Total Audited</div>
          <div className="text-2xl font-semibold text-slate-100 font-mono tabular-nums mt-1">
            {projects.length}
          </div>
        </div>
        <div className="p-4 bg-[#121722] border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Automated QA Passed</div>
          <div className="text-2xl font-semibold text-emerald-400 font-mono tabular-nums mt-1">
            {passedCount}
          </div>
        </div>
        <div className="p-4 bg-[#121722] border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">QA Failed (/output/failed)</div>
          <div className="text-2xl font-semibold text-red-400 font-mono tabular-nums mt-1">
            {failedCount}
          </div>
        </div>
        <div className="p-4 bg-[#121722] border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Manually Approved</div>
          <div className="text-2xl font-semibold text-[#3B82F6] font-mono tabular-nums mt-1">
            {approvedCount}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['all', 'All Assets'],
            ['passed', 'Passed QA'],
            ['failed', 'Failed QA'],
            ['pending_review', 'Pending Review'],
            ['approved', 'Approved'],
            ['rejected', 'Rejected'],
          ] as [QaFilter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border cursor-pointer ${
              filter === key
                ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
                : 'bg-[#121722] border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Project Queue */}
        <div className="lg:col-span-4 bg-[#121722] border border-slate-800 rounded-lg p-3 space-y-1 max-h-[680px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-6 text-xs text-slate-500 text-center">
              No animations match this QA filter.
            </div>
          ) : (
            filtered.map((p) => {
              const qaPassed = p.status === 'completed' && Boolean(p.qaReport?.passed);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left p-3 rounded-md cursor-pointer transition-colors ${
                    selected?.id === p.id
                      ? 'bg-[#3B82F6]/15 border border-[#3B82F6]/40'
                      : 'hover:bg-[#0B0E14] border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-100">
                    <span className="truncate">{p.name}</span>
                    {qaPassed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : p.status === 'failed' ? (
                      <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1 truncate tabular-nums">
                    {p.id} · {p.resolution} · {p.reviewStatus.replace('_', ' ')}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right: Detailed QA Report & Review Controls */}
        <div className="lg:col-span-8">
          {!selected ? (
            <div className="p-10 bg-[#121722] border border-slate-800 rounded-lg text-center text-xs text-slate-500">
              Select an animation asset to inspect its automated QA &amp; ffprobe diagnostics.
            </div>
          ) : (
            <div className="bg-[#121722] border border-slate-800 rounded-lg p-6 space-y-6">
              {/* Header + Review Actions */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                    {selected.id} · {selected.category} · {selected.animationType} ·{' '}
                    {selected.backgroundMode.replace('_', ' ')}
                  </div>
                  <h2 className="text-lg font-semibold text-slate-50 mt-0.5 truncate">
                    {selected.name}
                  </h2>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    Pipeline: {selected.status} · Review: {selected.reviewStatus.replace('_', ' ')}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenEditor(selected)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#0B0E14] border border-slate-700 text-slate-200 hover:border-slate-500 rounded-md cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Open Editor</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void handleReRender(selected)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#0B0E14] border border-slate-700 text-slate-200 hover:border-slate-500 rounded-md cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${busyAction === 'render' ? 'animate-spin' : ''}`}
                    />
                    <span>Re-Render &amp; Audit</span>
                  </button>
                  <button
                    type="button"
                    disabled={
                      busyAction !== null || selected.status !== 'completed' || !selected.qaReport?.passed
                    }
                    onClick={() => void handleReview(selected, 'approved')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer disabled:opacity-40"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void handleReview(selected, 'rejected')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-950/60 border border-red-800 text-red-300 hover:bg-red-900/50 rounded-md cursor-pointer disabled:opacity-40"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>

              {/* Preview Player */}
              {(() => {
                const previewVideo =
                  selected.outputFiles.find((f) => f.format === 'mp4_preview') ??
                  selected.outputFiles.find((f) => f.format === 'mp4_h264');
                const videoUrl = outputFileUrl(previewVideo?.relativePath);
                const thumbUrl = outputFileUrl(
                  selected.outputFiles.find((f) => f.format === 'thumbnail_png')?.relativePath
                );
                return (
                  <div
                    className={`h-56 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center ${
                      selected.backgroundMode === 'transparent' ? 'checkerboard-dark' : 'bg-[#0B0E14]'
                    }`}
                  >
                    {videoUrl ? (
                      <video
                        key={videoUrl}
                        src={videoUrl}
                        poster={thumbUrl ?? undefined}
                        controls
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-contain"
                      />
                    ) : thumbUrl ? (
                      <img src={thumbUrl} alt={selected.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-xs font-mono text-slate-500">
                        No rendered preview available ({selected.status})
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Failure Banner */}
              {(selected.errorMessage || (selected.qaReport && selected.qaReport.issues.length > 0)) && (
                <div className="p-4 rounded-lg bg-red-950/30 border border-red-900/60 space-y-1.5 text-xs">
                  <div className="font-semibold text-red-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>QA Issues / Rejection Diagnostics</span>
                  </div>
                  {selected.errorMessage && (
                    <div className="font-mono text-red-200">{selected.errorMessage}</div>
                  )}
                  {selected.qaReport?.issues.map((issue, i) => (
                    <div key={i} className="font-mono text-red-300">
                      • {issue}
                    </div>
                  ))}
                </div>
              )}

              {/* Pixel & Structural Metrics */}
              {selected.qaReport ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-[#0B0E14] border border-slate-800 rounded">
                      <div className="text-slate-400">SVG &amp; ViewBox</div>
                      <div
                        className={`font-mono font-semibold mt-1 ${
                          selected.qaReport.svgValid && selected.qaReport.svgViewBoxValid
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}
                      >
                        {selected.qaReport.svgValid && selected.qaReport.svgViewBoxValid
                          ? 'VALID'
                          : 'INVALID'}
                      </div>
                    </div>
                    <div className="p-3 bg-[#0B0E14] border border-slate-800 rounded">
                      <div className="text-slate-400">Motion Score</div>
                      <div className="font-mono font-semibold text-slate-100 mt-1 tabular-nums">
                        {selected.qaReport.motionScore.toFixed(1)} / 100
                      </div>
                    </div>
                    <div className="p-3 bg-[#0B0E14] border border-slate-800 rounded">
                      <div className="text-slate-400">Black / Empty Frames</div>
                      <div className="font-mono font-semibold text-slate-100 mt-1 tabular-nums">
                        {selected.qaReport.blackFrameCount} / {selected.qaReport.emptyFrameCount}
                      </div>
                    </div>
                    <div className="p-3 bg-[#0B0E14] border border-slate-800 rounded">
                      <div className="text-slate-400">Duplicate Ratio</div>
                      <div className="font-mono font-semibold text-slate-100 mt-1 tabular-nums">
                        {(selected.qaReport.duplicateFrameRatio * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="p-3 bg-[#0B0E14] border border-slate-800 rounded">
                      <div className="text-slate-400">Rendered Frames</div>
                      <div className="font-mono font-semibold text-slate-100 mt-1 tabular-nums">
                        {selected.qaReport.frameCountRendered} frames
                      </div>
                    </div>
                    <div className="p-3 bg-[#0B0E14] border border-slate-800 rounded">
                      <div className="text-slate-400">Alpha Integrity</div>
                      <div className="font-mono font-semibold text-slate-100 mt-1">
                        {selected.qaReport.alphaVerified === null
                          ? 'N/A'
                          : selected.qaReport.alphaVerified
                          ? 'VERIFIED RGBA'
                          : 'MISSING ALPHA'}
                      </div>
                    </div>
                    <div className="p-3 bg-[#0B0E14] border border-slate-800 rounded">
                      <div className="text-slate-400">#00FF00 Key Purity</div>
                      <div className="font-mono font-semibold text-slate-100 mt-1 tabular-nums">
                        {selected.qaReport.greenScreenPurityPct === null
                          ? 'N/A'
                          : `${selected.qaReport.greenScreenPurityPct.toFixed(1)}%`}
                      </div>
                    </div>
                    <div className="p-3 bg-[#0B0E14] border border-slate-800 rounded">
                      <div className="text-slate-400">Stock Metadata</div>
                      <div
                        className={`font-mono font-semibold mt-1 ${
                          selected.qaReport.metadataComplete ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {selected.qaReport.metadataComplete ? 'COMPLETE' : 'INCOMPLETE'}
                      </div>
                    </div>
                  </div>

                  {/* ffprobe Streams Table */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-slate-200">
                      ffprobe Stream &amp; Codec Verification
                    </h3>
                    {selected.qaReport.videoProbes.length === 0 ? (
                      <div className="text-xs text-slate-500">No encoded video files probed.</div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-800 rounded-md">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#0B0E14] border-b border-slate-800 text-slate-400">
                              <th className="py-2 px-3">Format</th>
                              <th className="py-2 px-3">Codec</th>
                              <th className="py-2 px-3">Pixel Fmt</th>
                              <th className="py-2 px-3">Resolution</th>
                              <th className="py-2 px-3 text-right">FPS</th>
                              <th className="py-2 px-3 text-right">Duration</th>
                              <th className="py-2 px-3 text-right">Alpha</th>
                              <th className="py-2 px-3 text-right">Size</th>
                              <th className="py-2 px-3 text-right">Result</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                            {selected.qaReport.videoProbes.map((vp) => (
                              <tr key={vp.filename} className="hover:bg-[#0B0E14]/60">
                                <td className="py-2 px-3 text-slate-200">{vp.format}</td>
                                <td className="py-2 px-3 text-slate-300">{vp.codecName}</td>
                                <td className="py-2 px-3 text-slate-400">{vp.pixFmt}</td>
                                <td className="py-2 px-3 text-slate-300 tabular-nums">
                                  {vp.width}×{vp.height}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-300 tabular-nums">
                                  {vp.fps.toFixed(2)}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-300 tabular-nums">
                                  {vp.durationSec.toFixed(2)}s
                                </td>
                                <td className="py-2 px-3 text-right text-slate-300">
                                  {vp.hasAlphaChannel ? 'yes' : 'no'}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-400 tabular-nums">
                                  {formatBytes(vp.sizeBytes)}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right font-semibold ${
                                    vp.valid ? 'text-emerald-400' : 'text-red-400'
                                  }`}
                                >
                                  {vp.valid ? 'PASS' : 'FAIL'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 bg-[#0B0E14] border border-slate-800 rounded text-xs text-slate-400">
                  This project has not completed automated QA yet. Click &ldquo;Re-Render &amp; Audit&rdquo; to execute frame validation and ffprobe verification.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
