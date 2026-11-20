import React, { useEffect, useState } from 'react';
import {
  Download,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Square,
} from 'lucide-react';
import {
  DESIGN_STYLES,
  STOCK_CATEGORIES,
  TARGET_PLATFORMS,
  api,
  downloadExportBundle,
} from '../lib/api';
import type {
  BatchJob,
  DesignStyle,
  ProviderSlug,
  ProviderState,
  StockAsset,
  StockCategory,
  TargetPlatform,
} from '../types/stockforge';

interface BatchViewProps {
  onNotify: (msg: string) => void;
  onInspectAssetId: (assetId: string) => void;
}

export const BatchView: React.FC<BatchViewProps> = ({
  onNotify,
  onInspectAssetId,
}) => {
  const [batches, setBatches] = useState<BatchJob[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchJob | null>(null);
  const [providers, setProviders] = useState<ProviderState[]>([]);

  const [name, setName] = useState('');
  const [basePrompt, setBasePrompt] = useState('');
  const [category, setCategory] = useState<StockCategory>('Business');
  const [style, setStyle] = useState<DesignStyle>('Flat Geometric');
  const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>('both');
  const [requestedCount, setRequestedCount] = useState<number>(10);
  const [concurrency, setConcurrency] = useState<number>(2);
  const [providerSlug, setProviderSlug] = useState<ProviderSlug>('gemini');
  const [model, setModel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);

  const loadBatches = async () => {
    try {
      const data = await api.getBatches();
      const nextBatches = Array.isArray(data?.batches) ? data.batches : [];
      setBatches(nextBatches);
      if (selectedBatch) {
        const detail = await api.getBatch(selectedBatch.id);
        if (detail?.batch) setSelectedBatch(detail.batch);
      } else if (nextBatches.length > 0) {
        const detail = await api.getBatch(nextBatches[0].id);
        if (detail?.batch) setSelectedBatch(detail.batch);
      }
    } catch {
      // ignore transient poll error
    }
  };

  useEffect(() => {
    void api
      .getProviders()
      .then((d) => {
        const list = Array.isArray(d?.providers) ? d.providers : [];
        setProviders(list);
        const active = list.find((p) => p.isActive) ?? list[0];
        if (active) {
          setProviderSlug(active.slug);
          setModel(active.selectedModel);
        }
      })
      .catch(() => {
        // ignore transient fetch error
      });
    void loadBatches();
  }, []);

  // Poll every 2.5s while any batch is running/queued
  useEffect(() => {
    const hasActive = batches.some((b) => b.status === 'running' || b.status === 'queued');
    if (!hasActive) return;
    const timer = window.setInterval(() => {
      void loadBatches();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [batches, selectedBatch?.id]);

  const handleSelectBatch = async (id: string) => {
    try {
      const { batch } = await api.getBatch(id);
      setSelectedBatch(batch);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load batch details');
    }
  };

  const handleStartBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (basePrompt.trim().length < 3) {
      onNotify('Enter a base prompt for the batch.');
      return;
    }
    setSubmitting(true);
    try {
      const { batch } = await api.createBatch({
        name: name.trim() || `${category} Batch (${requestedCount})`,
        basePrompt: basePrompt.trim(),
        category,
        style,
        targetPlatform,
        requestedCount,
        concurrency,
        providerSlug,
        model,
      });
      setSelectedBatch(batch);
      await loadBatches();
      onNotify(`Started batch ${batch.id} (${requestedCount} items)`);
      setName('');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to start batch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchControl = async (
    action: 'pause' | 'resume' | 'retry' | 'cancel',
    batchId: string
  ) => {
    try {
      const res =
        action === 'pause'
          ? await api.pauseBatch(batchId)
          : action === 'cancel'
          ? await api.cancelBatch(batchId)
          : await api.resumeBatch(batchId, action === 'retry');
      setSelectedBatch(res.batch);
      await loadBatches();
      onNotify(`Batch ${batchId}: ${action}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleExportBatchZip = async (batchId: string) => {
    setExportingZip(true);
    try {
      await downloadExportBundle({
        batchId,
        formats: ['svg', 'eps', 'png', 'jpg'],
        includeAdobeCsv: true,
        includeShutterstockCsv: true,
      });
      onNotify(`Exported complete ZIP bundle for ${batchId}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Bundle export failed');
    } finally {
      setExportingZip(false);
    }
  };

  const selectedProvider = providers.find((p) => p.slug === providerSlug);
  const pct =
    selectedBatch && selectedBatch.requestedCount > 0
      ? Math.round(
          ((selectedBatch.completedCount + selectedBatch.failedCount) /
            selectedBatch.requestedCount) *
            100
        )
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Batch Production Queue
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Produce 10 to 100 distinct vector concepts with controlled concurrency, retry backoff, and duplicate geometry filtering.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: New Batch Config + Batch History List */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleStartBatch}
            className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
          >
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-500" />
              <span>Launch New Production Batch</span>
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Batch Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Q4 Fintech Isometric Pack"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Base Concept Prompt
              </label>
              <textarea
                rows={3}
                value={basePrompt}
                onChange={(e) => setBasePrompt(e.target.value)}
                placeholder="Describe the core theme; the batch engine automatically crafts unique compositions for every item."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as StockCategory)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white"
                >
                  {STOCK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Style</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value as DesignStyle)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white"
                >
                  {DESIGN_STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Batch Quantity
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-md">
                {[10, 25, 50, 100].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setRequestedCount(qty)}
                    className={`py-1.5 text-xs font-mono rounded cursor-pointer ${
                      requestedCount === qty
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    {qty}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Concurrency Limit
                </label>
                <select
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md bg-white"
                >
                  <option value={1}>1 worker (Strict Rate Limit)</option>
                  <option value={2}>2 workers (Balanced)</option>
                  <option value={3}>3 workers (Fast)</option>
                  <option value={4}>4 workers (High Quota)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Target Platform
                </label>
                <select
                  value={targetPlatform}
                  onChange={(e) => setTargetPlatform(e.target.value as TargetPlatform)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white"
                >
                  {TARGET_PLATFORMS.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {tp.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Provider</label>
                <select
                  value={providerSlug}
                  onChange={(e) => {
                    const slug = e.target.value as ProviderSlug;
                    setProviderSlug(slug);
                    const p = providers.find((x) => x.slug === slug);
                    if (p) setModel(p.selectedModel);
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white"
                >
                  {providers.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md bg-white"
                >
                  {(selectedProvider?.availableModels ?? []).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 rounded-md cursor-pointer"
            >
              {submitting ? 'Starting Queue...' : `Start ${requestedCount}-Asset Batch`}
            </button>
          </form>

          {/* Batch list */}
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            <div className="px-4 py-3 text-xs font-semibold text-slate-900">
              All Production Batches ({(batches ?? []).length})
            </div>
            {(batches ?? []).length === 0 ? (
              <div className="p-4 text-xs text-slate-500">No batches created yet.</div>
            ) : (
              (batches ?? []).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleSelectBatch(b.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-2 ${
                    selectedBatch?.id === b.id ? 'bg-blue-50/40' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">{b.name}</div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5 tabular-nums">
                      {b.completedCount}/{b.requestedCount} completed · {b.status}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {b.id.slice(-4)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Active Batch Queue Monitor */}
        <div className="lg:col-span-7">
          {!selectedBatch ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-lg p-12 text-center text-xs text-slate-500">
              Select or launch a batch job to inspect live queue items, retries, and export bundles.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-5 border-b border-slate-200 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-mono text-slate-500">
                      {selectedBatch.id} · {selectedBatch.providerSlug} ({selectedBatch.model})
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
                      {selectedBatch.name}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {(selectedBatch.status === 'running' || selectedBatch.status === 'queued') && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleBatchControl('pause', selectedBatch.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md cursor-pointer"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBatchControl('cancel', selectedBatch.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md cursor-pointer"
                        >
                          <Square className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                      </>
                    )}
                    {selectedBatch.status === 'paused' && (
                      <button
                        type="button"
                        onClick={() => handleBatchControl('resume', selectedBatch.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#2563EB] rounded-md cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume</span>
                      </button>
                    )}
                    {selectedBatch.failedCount > 0 && selectedBatch.status !== 'running' && (
                      <button
                        type="button"
                        onClick={() => handleBatchControl('retry', selectedBatch.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retry Failed ({selectedBatch.failedCount})</span>
                      </button>
                    )}
                    {selectedBatch.completedCount > 0 && (
                      <button
                        type="button"
                        disabled={exportingZip}
                        onClick={() => handleExportBatchZip(selectedBatch.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-[#2563EB] rounded-md cursor-pointer disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{exportingZip ? 'Packaging...' : 'Export Batch ZIP'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5 font-mono tabular-nums">
                    <span className="capitalize text-slate-700">Status: {selectedBatch.status}</span>
                    <span className="text-slate-600">
                      {selectedBatch.completedCount} completed · {selectedBatch.failedCount} failed ·{' '}
                      {selectedBatch.duplicateSkippedCount} duplicates avoided ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2563EB] transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Item-by-Item Status Table */}
              <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-100">
                {(selectedBatch.items ?? []).map((item) => (
                  <div
                    key={item.id}
                    className="px-5 py-3 flex items-center justify-between gap-4 text-xs hover:bg-slate-50/70"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-400 tabular-nums">
                          #{String(item.seqIndex).padStart(3, '0')}
                        </span>
                        <span className="text-slate-800 truncate">{item.variationPrompt}</span>
                      </div>
                      {item.errorMessage && (
                        <div className="text-[11px] text-red-600 font-mono mt-0.5 truncate">
                          {item.errorMessage}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                      <span className="text-[11px] text-slate-400">try {item.attempts}</span>
                      <span
                        className={`text-[11px] font-medium ${
                          item.status === 'completed'
                            ? 'text-emerald-700'
                            : item.status === 'failed'
                            ? 'text-red-600'
                            : item.status === 'generating' || item.status === 'retrying'
                            ? 'text-[#2563EB]'
                            : 'text-slate-500'
                        }`}
                      >
                        {item.status}
                      </span>
                      {item.assetId && (
                        <button
                          type="button"
                          onClick={() => onInspectAssetId(item.assetId!)}
                          className="text-xs font-sans font-medium text-[#2563EB] hover:underline cursor-pointer"
                        >
                          Inspect
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
