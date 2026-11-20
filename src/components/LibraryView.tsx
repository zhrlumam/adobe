import React, { useEffect, useState } from 'react';
import { CheckSquare, Download, Search, Square, Trash2, X } from 'lucide-react';
import {
  DESIGN_STYLES,
  STOCK_CATEGORIES,
  api,
  downloadAssetFormat,
  downloadExportBundle,
  downloadMetadataCsv,
} from '../lib/api';
import type { StockAsset } from '../types/stockforge';
import { SvgViewport } from './SvgViewport';

interface LibraryViewProps {
  onInspectAsset: (asset: StockAsset) => void;
  onNotify: (msg: string) => void;
  refreshTick: number;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  onInspectAsset,
  onNotify,
  refreshTick,
}) => {
  const [assets, setAssets] = useState<StockAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [styleFilter, setStyleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyExport, setBusyExport] = useState(false);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const data = await api.getAssets({
        q: search,
        category: categoryFilter,
        style: styleFilter,
        status: statusFilter,
      });
      setAssets(Array.isArray(data?.assets) ? data.assets : []);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load asset library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadAssets();
    }, 150);
    return () => window.clearTimeout(t);
  }, [search, categoryFilter, styleFilter, statusFilter, refreshTick]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === assets.length && assets.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assets.map((a) => a.id)));
    }
  };

  const handleBulkZip = async () => {
    if (selectedIds.size === 0) return;
    setBusyExport(true);
    try {
      await downloadExportBundle({
        assetIds: Array.from(selectedIds),
        formats: ['svg', 'eps', 'png', 'jpg'],
        includeAdobeCsv: true,
        includeShutterstockCsv: true,
      });
      onNotify(`Exported ZIP for ${selectedIds.size} selected asset(s)`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Bulk export failed');
    } finally {
      setBusyExport(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    for (const id of Array.from(selectedIds)) {
      await api.deleteAsset(id);
    }
    setSelectedIds(new Set());
    await loadAssets();
    onNotify(`Deleted ${selectedIds.size} asset(s)`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Asset Library</h1>
          <p className="text-sm text-slate-600 mt-1">
            Search, inspect, validate, and export your locally persisted stock vector archive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={assets.length === 0}
            onClick={() =>
              downloadMetadataCsv({
                assetIds: selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
                platform: 'adobe_stock',
              })
            }
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-md cursor-pointer disabled:opacity-40"
          >
            Adobe Stock CSV
          </button>
          <button
            type="button"
            disabled={assets.length === 0}
            onClick={() =>
              downloadMetadataCsv({
                assetIds: selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
                platform: 'shutterstock',
              })
            }
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-md cursor-pointer disabled:opacity-40"
          >
            Shutterstock CSV
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, ID, prompt, or keyword..."
            className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#2563EB]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-md bg-white"
          >
            <option value="all">All Categories</option>
            {STOCK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={styleFilter}
            onChange={(e) => setStyleFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-md bg-white"
          >
            <option value="all">All Styles</option>
            {DESIGN_STYLES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-md bg-white"
          >
            <option value="all">All Validation</option>
            <option value="ready">Commercial Ready</option>
            <option value="issues">Has Warnings</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {assets.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-100 rounded-lg text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 font-medium text-slate-700 cursor-pointer"
            >
              {selectedIds.size === assets.length && assets.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-[#2563EB]" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>
                {selectedIds.size > 0
                  ? `${selectedIds.size} selected`
                  : `Select all (${assets.length})`}
              </span>
            </button>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busyExport}
                onClick={handleBulkZip}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded-md cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{busyExport ? 'Building ZIP...' : 'Export Selected ZIP'}</span>
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-md cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Asset Grid */}
      {loading && assets.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-lg border border-slate-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-12 text-center">
          <div className="text-sm font-medium text-slate-900">No matching vector assets</div>
          <p className="text-xs text-slate-500 mt-1">
            Generate assets or clear active search filters to see your vector library.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => {
            const checked = selectedIds.has(asset.id);
            return (
              <article
                key={asset.id}
                className={`bg-white border rounded-lg overflow-hidden flex flex-col transition-colors ${
                  checked ? 'border-[#2563EB]' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toggleSelect(asset.id)}
                    aria-label={`Select ${asset.id}`}
                    className="absolute top-2.5 left-2.5 z-10 p-1 rounded bg-white/90 border border-slate-200 cursor-pointer"
                  >
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-[#2563EB]" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  <div
                    onClick={() => onInspectAsset(asset)}
                    className="cursor-pointer"
                  >
                    <SvgViewport
                      svgContent={asset.svgContent}
                      backdrop="checkerboard"
                      className="w-full h-52 border-b border-slate-100"
                    />
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div
                    onClick={() => onInspectAsset(asset)}
                    className="cursor-pointer min-w-0"
                  >
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono tabular-nums">
                      <span>{asset.id}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-sans">{asset.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{asset.validation.totalVectorPrimitives} paths</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 mt-1 truncate">
                      {asset.title}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      {(['svg', 'eps', 'png', 'jpg'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() =>
                            downloadAssetFormat(asset.id, fmt).then(() =>
                              onNotify(`Exported ${asset.id}.${fmt}`)
                            )
                          }
                          className="px-2 py-1 text-[10px] font-semibold uppercase bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 rounded cursor-pointer"
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => onInspectAsset(asset)}
                      className="text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
