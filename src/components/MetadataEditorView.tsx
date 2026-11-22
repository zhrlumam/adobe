import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, Save, Sparkles } from 'lucide-react';
import { api, downloadAnimationCsv } from '../lib/api';
import type { AnimationProject } from '../types/stockforge';

interface MetadataEditorViewProps {
  onNotify: (msg: string) => void;
  refreshTick?: number;
}

export const MetadataEditorView: React.FC<MetadataEditorViewProps> = ({
  onNotify,
  refreshTick = 0,
}) => {
  const [projects, setProjects] = useState<AnimationProject[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [adobeCategories, setAdobeCategories] = useState<string[]>([]);
  const [shutterstockCategories, setShutterstockCategories] = useState<string[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [keywordsText, setKeywordsText] = useState('');
  const [adobeCategory, setAdobeCategory] = useState('');
  const [shutterstockCategory, setShutterstockCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProjects = async () => {
    try {
      const res = await api.listAnimations();
      const list = res.projects ?? [];
      setProjects(list);
      setAdobeCategories(res.adobeCategories ?? []);
      setShutterstockCategories(res.shutterstockCategories ?? []);
      if (list.length > 0 && !selectedId) {
        selectProject(list[0]);
      } else if (selectedId) {
        const match = list.find((p) => p.id === selectedId);
        if (match) selectProject(match);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load metadata');
    }
  };

  const selectProject = (p: AnimationProject) => {
    setSelectedId(p.id);
    setTitle(p.metadata.title);
    setDescription(p.metadata.description);
    setKeywordsText(p.metadata.keywords.join(', '));
    setAdobeCategory(p.metadata.adobeCategory);
    setShutterstockCategory(p.metadata.shutterstockCategory);
  };

  useEffect(() => {
    void loadProjects();
  }, [refreshTick]);

  const current = projects.find((p) => p.id === selectedId);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    setSaving(true);
    try {
      const keywords = keywordsText
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      await api.updateAnimation(current.id, {
        metadata: {
          ...current.metadata,
          title: title.trim(),
          description: description.trim(),
          keywords,
          adobeCategory,
          shutterstockCategory,
        },
      });
      await loadProjects();
      onNotify(`Saved commercial stock metadata for ${current.id}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!current) return;
    try {
      const res = await api.regenerateAnimationMetadata(current.id);
      selectProject(res.project);
      await loadProjects();
      onNotify(`Regenerated clean metadata for ${current.id}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Metadata regeneration failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">
            Stock Metadata Manager
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review commercial titles, clean non-spam keywords, and export Adobe Stock & Shutterstock CSV spreadsheets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void downloadAnimationCsv({ platform: 'adobe_stock', fileExtension: 'mp4' }).catch(
                (err) => onNotify(err instanceof Error ? err.message : 'CSV export failed')
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-[#121722] border border-slate-800 hover:border-[#3B82F6] rounded-md cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Adobe Stock CSV</span>
          </button>
          <button
            type="button"
            onClick={() =>
              void downloadAnimationCsv({ platform: 'shutterstock', fileExtension: 'mp4' }).catch(
                (err) => onNotify(err instanceof Error ? err.message : 'CSV export failed')
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-[#121722] border border-slate-800 hover:border-[#3B82F6] rounded-md cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Shutterstock CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Project Selector List */}
        <div className="lg:col-span-4 bg-[#121722] border border-slate-800 rounded-lg p-4 space-y-2 max-h-[600px] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-200">
              Projects ({projects.length})
            </span>
            <button
              type="button"
              onClick={() => void loadProjects()}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectProject(p)}
              className={`w-full text-left p-3 rounded border text-xs cursor-pointer ${
                p.id === selectedId
                  ? 'border-[#3B82F6] bg-blue-950/30 text-slate-100'
                  : 'border-slate-800 bg-[#0B0E14] text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="font-mono text-[11px] text-slate-400">
                {p.id} · {p.metadata.keywords.length} keywords
              </div>
              <div className="font-medium truncate mt-0.5">{p.metadata.title || p.name}</div>
            </button>
          ))}
        </div>

        {/* Right: Metadata Editor Form */}
        {current ? (
          <form
            onSubmit={handleSave}
            className="lg:col-span-8 bg-[#121722] border border-slate-800 rounded-lg p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="font-mono text-xs text-slate-400">
                {current.id} · {current.category} · {current.animationType} · {current.durationSec}s @{' '}
                {current.fps}fps
              </div>
              <button
                type="button"
                onClick={() => void handleRegenerate()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-200 bg-[#0B0E14] border border-slate-700 hover:border-[#3B82F6] rounded cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span>Refresh Clean Metadata</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Commercial Stock Title ({title.length}/200)
              </label>
              <input
                type="text"
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Marketplace Description ({description.length}/200)
              </label>
              <textarea
                rows={2}
                maxLength={200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Adobe Stock Category
                </label>
                <select
                  value={adobeCategory}
                  onChange={(e) => setAdobeCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
                >
                  {adobeCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Shutterstock Category
                </label>
                <select
                  value={shutterstockCategory}
                  onChange={(e) => setShutterstockCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
                >
                  {shutterstockCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Comma-Separated Relevant Keywords (Max 49, No Spam/Trademarks)
              </label>
              <textarea
                rows={4}
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#3B82F6] hover:bg-blue-500 rounded-md cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Metadata'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="lg:col-span-8 bg-[#121722] border border-slate-800 rounded-lg p-12 text-center text-xs text-slate-500">
            Create an animation project first to edit stock metadata.
          </div>
        )}
      </div>
    </div>
  );
};
