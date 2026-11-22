import React, { useEffect, useState } from 'react';
import { Archive, CheckSquare, Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import {
  EXPORT_FORMAT_LABELS,
  api,
  downloadAnimationCsv,
  downloadAnimationFormat,
  downloadAnimationZip,
  formatBytes,
} from '../lib/api';
import type { AnimationExportFormat, AnimationProject } from '../types/stockforge';

interface ExportManagerViewProps {
  onNotify: (msg: string) => void;
}

const PACKAGE_FORMATS: AnimationExportFormat[] = [
  'mp4_h264',
  'mov_prores',
  'mov_alpha',
  'png_sequence',
  'gif_preview',
  'thumbnail_png',
  'svg_animated',
  'lottie_json',
  'source_zip',
];

export const ExportManagerView: React.FC<ExportManagerViewProps> = ({ onNotify }) => {
  const [projects, setProjects] = useState<AnimationProject[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formats, setFormats] = useState<AnimationExportFormat[]>([
    'mp4_h264',
    'svg_animated',
    'lottie_json',
    'source_zip',
  ]);
  const [includeAdobeCsv, setIncludeAdobeCsv] = useState(true);
  const [includeShutterstockCsv, setIncludeShutterstockCsv] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadCompleted = async () => {
    try {
      const res = await api.listAnimations({ status: 'completed' });
      const list = res.projects ?? [];
      setProjects(list);
      setSelectedIds(list.map((p) => p.id));
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load exportable projects');
    }
  };

  useEffect(() => {
    void loadCompleted();
  }, []);

  const toggleProject = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleFormat = (fmt: AnimationExportFormat) => {
    setFormats((prev) =>
      prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt]
    );
  };

  const handleDownloadZip = async () => {
    if (selectedIds.length === 0) {
      onNotify('Select at least one QA-passed project to export.');
      return;
    }
    if (formats.length === 0) {
      onNotify('Select at least one output format.');
      return;
    }
    setExporting(true);
    try {
      await downloadAnimationZip({
        projectIds: selectedIds,
        formats,
        includeAdobeCsv,
        includeShutterstockCsv,
      });
      onNotify(`Downloaded commercial ZIP bundle for ${selectedIds.length} animation(s)`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'ZIP export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">Export Center</h1>
          <p className="text-sm text-slate-400 mt-1">
            Download verified MP4 H.264, ProRes 422/4444 Alpha MOVs, PNG RGBA sequences, GIF/MP4 previews, Lottie JSON, SVG sources, and marketplace CSVs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadCompleted()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-[#121722] border border-slate-800 hover:border-slate-700 rounded-md cursor-pointer self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Format & Package Configurator */}
        <div className="lg:col-span-5 bg-[#121722] border border-slate-800 rounded-lg p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-100 mb-3">
              1. Select Deliverable Formats
            </h2>
            <div className="space-y-2">
              {PACKAGE_FORMATS.map((fmt) => {
                const meta = EXPORT_FORMAT_LABELS[fmt];
                return (
                  <label
                    key={fmt}
                    className="flex items-start justify-between gap-3 p-2.5 rounded bg-[#0B0E14] border border-slate-800 cursor-pointer"
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={formats.includes(fmt)}
                        onChange={() => toggleFormat(fmt)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-xs font-medium text-slate-100">{meta.label}</div>
                        <div className="text-[11px] text-slate-400">{meta.note}</div>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">{meta.ext}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-2 text-xs text-slate-300">
            <div className="font-semibold text-slate-100">2. Stock Metadata CSVs</div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAdobeCsv}
                onChange={(e) => setIncludeAdobeCsv(e.target.checked)}
              />
              <span>Include Adobe Stock contributor CSV</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeShutterstockCsv}
                onChange={(e) => setIncludeShutterstockCsv(e.target.checked)}
              />
              <span>Include Shutterstock footage CSV</span>
            </label>
          </div>

          <button
            type="button"
            disabled={exporting || selectedIds.length === 0}
            onClick={() => void handleDownloadZip()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-[#3B82F6] hover:bg-blue-500 rounded-md cursor-pointer disabled:opacity-50"
          >
            <Archive className="w-4 h-4" />
            <span>
              {exporting
                ? 'Rendering & Compressing Package...'
                : `Download Complete ZIP (${selectedIds.length} asset${selectedIds.length === 1 ? '' : 's'})`}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                void downloadAnimationCsv({
                  projectIds: selectedIds,
                  platform: 'adobe_stock',
                  fileExtension: 'mp4',
                })
              }
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-[#0B0E14] border border-slate-700 hover:border-[#3B82F6] text-slate-200 rounded cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Adobe CSV</span>
            </button>
            <button
              type="button"
              onClick={() =>
                void downloadAnimationCsv({
                  projectIds: selectedIds,
                  platform: 'shutterstock',
                  fileExtension: 'mp4',
                })
              }
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-[#0B0E14] border border-slate-700 hover:border-[#3B82F6] text-slate-200 rounded cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Shutterstock CSV</span>
            </button>
          </div>
        </div>

        {/* Right: QA-Passed Projects List & Individual Format Downloads */}
        <div className="lg:col-span-7 bg-[#121722] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">
              QA-Verified Productions ({projects.length})
            </h2>
            <button
              type="button"
              onClick={() =>
                setSelectedIds(
                  selectedIds.length === projects.length ? [] : projects.map((p) => p.id)
                )
              }
              className="inline-flex items-center gap-1 text-xs text-[#3B82F6] hover:underline cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{selectedIds.length === projects.length ? 'Deselect All' : 'Select All'}</span>
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No QA-passed animation productions available yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {projects.map((p) => (
                <div key={p.id} className="py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={() => toggleProject(p.id)}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-100 truncate">
                          {p.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {p.id} · {p.resolution} · {p.fps}fps · {p.backgroundMode} ·{' '}
                          {p.reviewStatus}
                        </div>
                      </div>
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pl-6">
                    {p.outputFiles.map((file) => (
                      <button
                        key={file.format}
                        type="button"
                        onClick={() =>
                          void downloadAnimationFormat(p.id, file.format).catch((err) =>
                            onNotify(err instanceof Error ? err.message : 'Download failed')
                          )
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono bg-[#0B0E14] border border-slate-700 hover:border-[#3B82F6] text-slate-300 rounded cursor-pointer"
                      >
                        <Download className="w-3 h-3 text-[#3B82F6]" />
                        <span>{EXPORT_FORMAT_LABELS[file.format]?.label || file.format}</span>
                        <span className="text-slate-500">({formatBytes(file.sizeBytes)})</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
