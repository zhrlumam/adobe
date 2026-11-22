import React, { useEffect, useState } from 'react';
import {
  Copy,
  Download,
  Edit3,
  FolderOpen,
  RefreshCw,
  Search,
  Sliders,
  Trash2,
} from 'lucide-react';
import {
  ANIMATION_CATEGORIES,
  api,
  downloadAnimationFormat,
  downloadAnimationZip,
  outputFileUrl,
} from '../lib/api';
import type { AnimationProject } from '../types/stockforge';

interface LibraryViewProps {
  onOpenEditor: (project: AnimationProject) => void;
  onNotify: (msg: string) => void;
  refreshTick?: number;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  onOpenEditor,
  onNotify,
  refreshTick = 0,
}) => {
  const [projects, setProjects] = useState<AnimationProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [bgFilter, setBgFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await api.listAnimations({
        ...(search.trim() ? { q: search.trim() } : {}),
        ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
        ...(bgFilter !== 'all' ? { backgroundMode: bgFilter } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      });
      setProjects(res.projects ?? []);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load asset library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, [categoryFilter, bgFilter, statusFilter, refreshTick]);

  const handleRenameSubmit = async (id: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await api.updateAnimation(id, { name: renameValue.trim() });
      setRenamingId(null);
      await loadProjects();
      onNotify('Renamed animation project');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Rename failed');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const res = await api.duplicateAnimation(id);
      await loadProjects();
      onNotify(`Duplicated into ${res.project.id}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Duplicate failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAnimation(id);
      await loadProjects();
      onNotify(`Deleted ${id} and cleaned /output artifacts`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">
            Animation Asset Library
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse, preview, rename, duplicate, edit, and download commercial assets stored in /output.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadProjects()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-[#121722] border border-slate-800 hover:border-slate-700 rounded-md cursor-pointer self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#121722] border border-slate-800 rounded-lg p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-[#0B0E14] border border-slate-700 rounded-md px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void loadProjects();
            }}
            placeholder="Search by ID, title, prompt, or keyword..."
            className="w-full text-xs bg-transparent text-slate-100 focus:outline-none"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-[#0B0E14] text-slate-200 border border-slate-700 rounded-md"
        >
          <option value="all">All Categories</option>
          {ANIMATION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={bgFilter}
          onChange={(e) => setBgFilter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-[#0B0E14] text-slate-200 border border-slate-700 rounded-md"
        >
          <option value="all">All Backgrounds</option>
          <option value="solid">Solid</option>
          <option value="green_screen">Green Screen (#00FF00)</option>
          <option value="transparent">Transparent Alpha</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-[#0B0E14] text-slate-200 border border-slate-700 rounded-md"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Passed QA</option>
          <option value="failed">Failed</option>
          <option value="draft">Draft</option>
        </select>

        <button
          type="button"
          onClick={() => void loadProjects()}
          className="px-3 py-1.5 text-xs font-medium text-white bg-[#3B82F6] hover:bg-blue-500 rounded-md cursor-pointer"
        >
          Apply
        </button>
      </div>

      {loading && projects.length === 0 ? (
        <div className="p-10 text-center text-xs text-slate-400">Loading animation projects...</div>
      ) : projects.length === 0 ? (
        <div className="p-12 bg-[#121722] border border-dashed border-slate-800 rounded-lg text-center">
          <FolderOpen className="w-6 h-6 text-slate-500 mx-auto mb-2" />
          <div className="text-sm font-medium text-slate-200">No matching animations found</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const previewFile =
              p.outputFiles.find((f) => f.format === 'mp4_preview') ??
              p.outputFiles.find((f) => f.format === 'mp4_h264');
            const videoUrl = outputFileUrl(previewFile?.relativePath);
            const thumbFile = p.outputFiles.find((f) => f.format === 'thumbnail_png');
            const thumbUrl = outputFileUrl(thumbFile?.relativePath);

            return (
              <div
                key={p.id}
                className="bg-[#121722] border border-slate-800 rounded-lg overflow-hidden flex flex-col"
              >
                <div className="h-44 bg-[#0B0E14] checkerboard-dark border-b border-slate-800 flex items-center justify-center overflow-hidden">
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
                    <img src={thumbUrl} alt={p.name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs font-mono text-slate-500">{p.status}</span>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 tabular-nums">
                      <span>
                        {p.id} · {p.resolution} · {p.fps}fps
                      </span>
                      <span
                        className={
                          p.status === 'completed'
                            ? 'text-emerald-400'
                            : p.status === 'failed'
                            ? 'text-red-400'
                            : 'text-amber-400'
                        }
                      >
                        {p.status}
                      </span>
                    </div>

                    {renamingId === p.id ? (
                      <div className="mt-1.5 flex gap-1.5">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs bg-[#0B0E14] text-slate-100 border border-[#3B82F6] rounded"
                        />
                        <button
                          type="button"
                          onClick={() => void handleRenameSubmit(p.id)}
                          className="px-2 py-1 text-xs bg-[#3B82F6] text-white rounded cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-slate-100 mt-1 truncate">
                        {p.name}
                      </div>
                    )}

                    <div className="text-xs text-slate-400 mt-1 truncate">
                      {p.category} · {p.backgroundMode.replace('_', ' ')} · {p.reviewStatus}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenEditor(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-[#3B82F6] hover:bg-blue-500 text-white rounded cursor-pointer"
                      >
                        <Sliders className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        title="Rename"
                        onClick={() => {
                          setRenamingId(p.id);
                          setRenameValue(p.name);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white bg-[#0B0E14] border border-slate-700 rounded cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        title="Duplicate project"
                        onClick={() => void handleDuplicate(p.id)}
                        className="p-1.5 text-slate-400 hover:text-white bg-[#0B0E14] border border-slate-700 rounded cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        title="Delete project"
                        onClick={() => void handleDelete(p.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 bg-[#0B0E14] border border-slate-700 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {p.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() =>
                            void downloadAnimationFormat(
                              p.id,
                              p.backgroundMode === 'transparent' ? 'mov_alpha' : 'mp4_h264'
                            ).catch((err) =>
                              onNotify(err instanceof Error ? err.message : 'Download failed')
                            )
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono text-slate-200 bg-[#0B0E14] border border-slate-700 hover:border-[#3B82F6] rounded cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>{p.backgroundMode === 'transparent' ? 'Alpha' : 'MP4'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          void downloadAnimationZip({
                            projectIds: [p.id],
                            formats: ['mp4_h264', 'svg_animated', 'lottie_json', 'source_zip'],
                            includeAdobeCsv: true,
                            includeShutterstockCsv: true,
                          }).catch((err) =>
                            onNotify(err instanceof Error ? err.message : 'ZIP download failed')
                          )
                        }
                        className="px-2 py-1 text-[11px] font-mono text-slate-300 bg-[#0B0E14] border border-slate-700 hover:border-[#3B82F6] rounded cursor-pointer"
                      >
                        ZIP
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
