import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Save, X } from 'lucide-react';
import { api, downloadMetadataCsv } from '../lib/api';
import type { StockAsset, TargetPlatform } from '../types/stockforge';
import { SvgViewport } from './SvgViewport';

interface MetadataEditorViewProps {
  onNotify: (msg: string) => void;
  refreshTick: number;
}

export const MetadataEditorView: React.FC<MetadataEditorViewProps> = ({
  onNotify,
  refreshTick,
}) => {
  const [assets, setAssets] = useState<StockAsset[]>([]);
  const [adobeCategories, setAdobeCategories] = useState<string[]>([]);
  const [shutterstockCategories, setShutterstockCategories] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [adobeCat, setAdobeCat] = useState('');
  const [shutterCat, setShutterCat] = useState('');
  const [platform, setPlatform] = useState<TargetPlatform>('both');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const loadData = async () => {
    try {
      const data = await api.getAssets();
      const assetList = Array.isArray(data?.assets) ? data.assets : [];
      setAssets(assetList);
      setAdobeCategories(Array.isArray(data?.adobeCategories) ? data.adobeCategories : []);
      setShutterstockCategories(
        Array.isArray(data?.shutterstockCategories) ? data.shutterstockCategories : []
      );
      if (assetList.length > 0 && !selectedId) {
        setSelectedId(assetList[0].id);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load assets');
    }
  };

  useEffect(() => {
    void loadData();
  }, [refreshTick]);

  const current = assets.find((a) => a.id === selectedId) ?? null;

  useEffect(() => {
    if (current) {
      setTitle(current.title);
      setDescription(current.description);
      setKeywords(current.keywords);
      setAdobeCat(current.adobeCategory);
      setShutterCat(current.shutterstockCategory);
      setPlatform(current.targetPlatform);
    }
  }, [current?.id]);

  const handleAddKeyword = () => {
    const incoming = newKeyword
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (incoming.length === 0) return;
    setKeywords((prev) => Array.from(new Set([...prev, ...incoming])).slice(0, 49));
    setNewKeyword('');
  };

  const handleRemoveKeyword = (term: string) => {
    setKeywords((prev) => prev.filter((k) => k !== term));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    setSaving(true);
    try {
      const { asset: updated } = await api.updateAsset(current.id, {
        title,
        description,
        keywords,
        adobeCategory: adobeCat,
        shutterstockCategory: shutterCat,
        targetPlatform: platform,
      });
      setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setKeywords(updated.keywords);
      onNotify(`Saved marketplace metadata for ${updated.id}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!current) return;
    setRegenerating(true);
    try {
      const { asset: updated } = await api.regenerateAssetMetadata(current.id);
      setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setTitle(updated.title);
      setDescription(updated.description);
      setKeywords(updated.keywords);
      setAdobeCat(updated.adobeCategory);
      setShutterCat(updated.shutterstockCategory);
      onNotify(`Refreshed metadata via AI for ${updated.id}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Regeneration failed');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Stock Metadata Editor
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Refine titles, descriptions, 10–49 non-stuffed keywords, and marketplace categories for Adobe Stock and Shutterstock.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={assets.length === 0}
            onClick={() => downloadMetadataCsv({ platform: 'adobe_stock' })}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-md cursor-pointer disabled:opacity-40"
          >
            Export Adobe Stock CSV
          </button>
          <button
            type="button"
            disabled={assets.length === 0}
            onClick={() => downloadMetadataCsv({ platform: 'shutterstock' })}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-md cursor-pointer disabled:opacity-40"
          >
            Export Shutterstock CSV
          </button>
        </div>
      </div>

      {assets.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-12 text-center text-xs text-slate-500">
          Generate at least one vector asset to edit and export marketplace metadata.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Asset selector list */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
            {assets.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedId(a.id)}
                className={`w-full text-left p-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer ${
                  selectedId === a.id ? 'bg-blue-50/40' : ''
                }`}
              >
                <SvgViewport
                  svgContent={a.svgContent}
                  backdrop="white"
                  className="w-12 h-12 rounded border border-slate-200 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-mono text-slate-500">{a.id}</div>
                  <div className="text-xs font-medium text-slate-900 truncate">{a.title}</div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    {a.keywords.length} keywords
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Right Editor */}
          {current && (
            <form
              onSubmit={handleSave}
              className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-6 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <SvgViewport
                    svgContent={current.svgContent}
                    backdrop="checkerboard"
                    className="w-14 h-14 rounded border border-slate-200"
                  />
                  <div>
                    <div className="text-xs font-mono text-slate-500">{current.id}</div>
                    <div className="text-sm font-semibold text-slate-900">{current.category} · {current.style}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-400 rounded-md cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                  <span>{regenerating ? 'Regenerating...' : 'AI Regenerate'}</span>
                </button>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label className="font-medium text-slate-700">Title (Adobe Stock)</label>
                  <span className="font-mono text-slate-500 tabular-nums">{title.length}/200</span>
                </div>
                <input
                  type="text"
                  value={title}
                  maxLength={200}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label className="font-medium text-slate-700">Description (Shutterstock)</label>
                  <span className="font-mono text-slate-500 tabular-nums">{description.length}/200</span>
                </div>
                <textarea
                  rows={2}
                  value={description}
                  maxLength={200}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Adobe Stock Category
                  </label>
                  <select
                    value={adobeCat}
                    onChange={(e) => setAdobeCat(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white"
                  >
                    {adobeCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Shutterstock Category
                  </label>
                  <select
                    value={shutterCat}
                    onChange={(e) => setShutterCat(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white"
                  >
                    {shutterstockCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Target Platform
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as TargetPlatform)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white"
                  >
                    <option value="both">Both Marketplaces</option>
                    <option value="adobe_stock">Adobe Stock</option>
                    <option value="shutterstock">Shutterstock</option>
                  </select>
                </div>
              </div>

              {/* Keywords Workbench */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-slate-700">
                    Unique Keywords (10–49 required, no duplicates)
                  </label>
                  <span
                    className={`font-mono tabular-nums ${
                      keywords.length < 10 ? 'text-amber-600' : 'text-emerald-700'
                    }`}
                  >
                    {keywords.length} / 49
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                    placeholder="Add keyword(s), comma-separated..."
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#2563EB]"
                  />
                  <button
                    type="button"
                    onClick={handleAddKeyword}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex flex-wrap gap-1.5">
                  {keywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-white border border-slate-200 rounded text-slate-700"
                    >
                      <span>{kw}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(kw)}
                        aria-label={`Remove ${kw}`}
                        className="text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded-md cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
