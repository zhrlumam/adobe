import React, { useEffect, useState } from 'react';
import { ArrowRight, Layers, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { api, formatBytes } from '../lib/api';
import type { DashboardSummary, StockAsset } from '../types/stockforge';
import { SvgViewport } from './SvgViewport';

export type StudioTab =
  | 'dashboard'
  | 'providers'
  | 'generate'
  | 'batch'
  | 'library'
  | 'metadata'
  | 'export'
  | 'history'
  | 'settings';

interface DashboardViewProps {
  onNavigate: (tab: StudioTab) => void;
  onInspectAsset: (asset: StockAsset) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onInspectAsset,
}) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboard();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-lg border border-slate-200 bg-white animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-lg border border-slate-200 bg-white animate-pulse" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-6 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800 flex items-center justify-between">
        <span>{error || 'Unable to load dashboard summary.'}</span>
        <button
          type="button"
          onClick={loadDashboard}
          className="px-3 py-1.5 text-xs font-medium bg-white border border-red-200 rounded-md cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Production Overview
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Live workspace metrics from local SQLite storage and configured AI providers.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadDashboard}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-md cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('generate')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded-md cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate Vector</span>
          </button>
        </div>
      </div>

      {/* Serverless runtime notice (only shown on Vercel / Lambda ephemeral storage) */}
      {summary.isServerless && (
        <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900 leading-relaxed">
          <span className="font-semibold">Serverless Runtime (/tmp):</span> Temporary storage resets between cold starts. Set{' '}
          <code className="font-mono bg-amber-100 px-1 rounded">GEMINI_API_KEY</code> (or Groq/OpenRouter keys) in Vercel Environment Variables and export generated ZIP/EPS/SVG bundles locally.
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs font-medium text-slate-500">Generated Vector Assets</div>
          <div className="text-3xl font-semibold text-slate-900 mt-2 font-mono tabular-nums">
            {summary.totalAssets}
          </div>
          <div className="text-xs text-slate-500 mt-2 font-mono tabular-nums">
            {summary.commercialReadyAssets} commercial-ready SVGs
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs font-medium text-slate-500">Batch Production Jobs</div>
          <div className="text-3xl font-semibold text-slate-900 mt-2 font-mono tabular-nums">
            {summary.totalBatches}
          </div>
          <div className="text-xs text-slate-500 mt-2 font-mono tabular-nums">
            {summary.runningBatches} active in queue
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs font-medium text-slate-500">Active AI Provider</div>
          <div className="text-lg font-semibold text-slate-900 mt-2 truncate">
            {summary.activeProvider ? summary.activeProvider.name : 'None'}
          </div>
          <div className="text-xs text-slate-500 mt-2 truncate font-mono">
            {summary.activeProvider
              ? `${summary.activeProvider.model} · ${summary.activeProvider.status}`
              : 'Configure provider'}
          </div>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs font-medium text-slate-500">Local Disk Storage</div>
          <div className="text-3xl font-semibold text-slate-900 mt-2 font-mono tabular-nums">
            {formatBytes(summary.storageBytes)}
          </div>
          <div className="text-xs text-slate-500 mt-2 font-mono tabular-nums">
            {summary.connectedProviders} provider(s) connected
          </div>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('providers')}
          className="text-left p-5 bg-white border border-slate-200 hover:border-[#2563EB] rounded-lg transition-colors cursor-pointer group"
        >
          <div className="text-sm font-semibold text-slate-900 flex items-center justify-between">
            <span>AI Provider Setup</span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB]" />
          </div>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            Configure Gemini, Groq, OpenRouter, Mistral, Hugging Face, or local Ollama models.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('batch')}
          className="text-left p-5 bg-white border border-slate-200 hover:border-[#2563EB] rounded-lg transition-colors cursor-pointer group"
        >
          <div className="text-sm font-semibold text-slate-900 flex items-center justify-between">
            <span>Batch Queue (10–100)</span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB]" />
          </div>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            Run controlled concurrency batches with duplicate filtering, retries, and ZIP bundles.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('export')}
          className="text-left p-5 bg-white border border-slate-200 hover:border-[#2563EB] rounded-lg transition-colors cursor-pointer group"
        >
          <div className="text-sm font-semibold text-slate-900 flex items-center justify-between">
            <span>Marketplace Export</span>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#2563EB]" />
          </div>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            Package SVG, EPS vectors, 4000px PNG/JPG, and Adobe Stock + Shutterstock CSVs.
          </p>
        </button>
      </div>

      {/* Recent Assets Gallery */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent Vector Assets</h2>
          <button
            type="button"
            onClick={() => onNavigate('library')}
            className="text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
          >
            Open Asset Library →
          </button>
        </div>

        {summary.recentAssets.length === 0 ? (
          <div className="p-10 bg-white border border-dashed border-slate-300 rounded-lg text-center">
            <Sparkles className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <div className="text-sm font-medium text-slate-900">No vector assets produced yet</div>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Verify an AI provider connection and generate your first genuine editable SVG asset.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('providers')}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-md cursor-pointer"
              >
                Check AI Providers
              </button>
              <button
                type="button"
                onClick={() => onNavigate('generate')}
                className="px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded-md cursor-pointer"
              >
                Create First Vector
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.recentAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => onInspectAsset(asset)}
                className="text-left bg-white border border-slate-200 hover:border-slate-400 rounded-lg overflow-hidden transition-colors cursor-pointer flex flex-col"
              >
                <SvgViewport
                  svgContent={asset.svgContent}
                  backdrop="checkerboard"
                  className="w-full h-48 border-b border-slate-100"
                />
                <div className="p-4">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono tabular-nums">
                    <span>{asset.id}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-sans">{asset.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{asset.validation.totalVectorPrimitives} paths</span>
                  </div>
                  <div className="text-sm font-medium text-slate-900 mt-1 truncate">
                    {asset.title}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category Breakdown & Recent Events */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Category Distribution</span>
          </h3>
          {summary.categoryBreakdown.length === 0 ? (
            <p className="text-xs text-slate-500">No assets categorized yet.</p>
          ) : (
            <div className="space-y-2.5">
              {summary.categoryBreakdown.map((item) => (
                <div key={item.category} className="flex items-center justify-between text-xs">
                  <span className="text-slate-700">{item.category}</span>
                  <span className="font-mono text-slate-900 font-medium tabular-nums">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Recent Production Events</h3>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs text-[#2563EB] hover:underline cursor-pointer"
            >
              Full History →
            </button>
          </div>
          {summary.recentLogs.length === 0 ? (
            <p className="text-xs text-slate-500">No production activity recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {summary.recentLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{log.message}</div>
                    <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                      {log.eventType}
                      {log.providerSlug ? ` · ${log.providerSlug}` : ''}
                      {log.latencyMs ? ` · ${log.latencyMs}ms` : ''}
                    </div>
                  </div>
                  <span
                    className={`font-mono text-[11px] shrink-0 ${
                      log.status === 'error'
                        ? 'text-red-600'
                        : log.status === 'success'
                        ? 'text-emerald-700'
                        : 'text-slate-500'
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
