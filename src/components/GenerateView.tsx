import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Eye,
  FileCheck2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  DESIGN_STYLES,
  STOCK_CATEGORIES,
  TARGET_PLATFORMS,
  api,
  downloadAssetFormat,
} from '../lib/api';
import type {
  DesignStyle,
  ProviderSlug,
  ProviderState,
  StockAsset,
  StockCategory,
  TargetPlatform,
} from '../types/stockforge';
import { SvgViewport } from './SvgViewport';

interface GenerateViewProps {
  onInspectAsset: (asset: StockAsset) => void;
  onNotify: (msg: string) => void;
  onGoToProviders: () => void;
}

export const GenerateView: React.FC<GenerateViewProps> = ({
  onInspectAsset,
  onNotify,
  onGoToProviders,
}) => {
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState<StockCategory>('Technology');
  const [style, setStyle] = useState<DesignStyle>('Flat Geometric');
  const [quantity, setQuantity] = useState(1);
  const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>('both');

  const [providers, setProviders] = useState<ProviderState[]>([]);
  const [providerSlug, setProviderSlug] = useState<ProviderSlug>('gemini');
  const [model, setModel] = useState('');

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<StockAsset[]>([]);
  const [wireframe, setWireframe] = useState(false);
  const [backdrop, setBackdrop] = useState<'checkerboard' | 'white' | 'dark'>('checkerboard');

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
        // ignore transient error
      });
  }, []);

  const selectedProvider = providers.find((p) => p.slug === providerSlug);

  const handleProviderChange = (slug: ProviderSlug) => {
    setProviderSlug(slug);
    const p = providers.find((item) => item.slug === slug);
    if (p) setModel(p.selectedModel);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim().length < 3) {
      setError('Enter a descriptive vector prompt (at least 3 characters).');
      return;
    }
    setGenerating(true);
    setError(null);

    try {
      const data = await api.generateAssets({
        prompt: prompt.trim(),
        category,
        style,
        quantity,
        targetPlatform,
        providerSlug,
        model,
      });
      setResults(data.assets);
      if (data.errors.length > 0) {
        setError(`Partial warnings: ${data.errors.join(' | ')}`);
      }
      onNotify(`Generated ${data.assets.length} validated SVG vector asset(s)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleQuickDownload = async (id: string, fmt: 'svg' | 'eps' | 'png' | 'jpg') => {
    try {
      await downloadAssetFormat(id, fmt);
      onNotify(`Downloaded ${id}.${fmt}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Export failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Vector Production Studio
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Synthesize genuine multi-layered editable SVG vectors with automated validation and marketplace metadata.
          </p>
        </div>
        {selectedProvider && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Engine:</span>
            <span className="font-mono font-medium text-slate-900">
              {selectedProvider.name} ({model})
            </span>
            {selectedProvider.catalog.requiresApiKey && !selectedProvider.hasKey && (
              <button
                type="button"
                onClick={onGoToProviders}
                className="text-[#2563EB] underline cursor-pointer"
              >
                Configure Key
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Prompt & Production Parameters */}
        <form
          onSubmit={handleGenerate}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4 h-fit"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Custom Vector Prompt
            </label>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Isometric renewable energy microgrid with solar panels, wind turbine, and battery storage hub in clean geometric shading"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Stock Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as StockCategory)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#2563EB]"
              >
                {STOCK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Design Style
              </label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as DesignStyle)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#2563EB]"
              >
                {DESIGN_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Asset Quantity
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
                {[1, 3, 5].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuantity(q)}
                    className={`py-1.5 text-xs font-mono rounded cursor-pointer ${
                      quantity === q
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {q}x
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Target Platform
              </label>
              <select
                value={targetPlatform}
                onChange={(e) => setTargetPlatform(e.target.value as TargetPlatform)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#2563EB]"
              >
                {TARGET_PLATFORMS.map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                AI Provider
              </label>
              <select
                value={providerSlug}
                onChange={(e) => handleProviderChange(e.target.value as ProviderSlug)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#2563EB]"
              >
                {providers.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#2563EB]"
              >
                {(selectedProvider?.availableModels ?? []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={generating}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Genuine SVG Vectors...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate {quantity > 1 ? `${quantity} Variations` : 'Vector Asset'}</span>
              </>
            )}
          </button>
        </form>

        {/* Right: Live Results & Validation Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
              {(['checkerboard', 'white', 'dark'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setBackdrop(mode)}
                  className={`px-2.5 py-1 text-xs capitalize rounded cursor-pointer ${
                    backdrop === mode ? 'bg-white text-slate-900 font-medium shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setWireframe((w) => !w)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border cursor-pointer ${
                wireframe
                  ? 'bg-[#2563EB] text-white border-[#2563EB]'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Vector Outlines</span>
            </button>
          </div>

          {results.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-lg p-12 text-center">
              <div className="text-sm font-medium text-slate-900">Ready for Production</div>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Enter your prompt and select a category and style to synthesize editable commercial SVG artwork and export EPS, PNG, and JPG deliverables.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12">
                    <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-slate-200">
                      <SvgViewport
                        svgContent={asset.svgContent}
                        wireframe={wireframe}
                        backdrop={backdrop}
                        className="w-full h-64"
                      />
                    </div>
                    <div className="md:col-span-7 p-4 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 font-mono tabular-nums">
                          <span>{asset.id}</span>
                          <span className="flex items-center gap-1 text-emerald-700 font-sans font-medium">
                            <FileCheck2 className="w-3.5 h-3.5" />
                            {asset.validation.totalVectorPrimitives} editable primitives
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-slate-900 mt-1">
                          {asset.title}
                        </h3>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                          {asset.description}
                        </p>
                        <div className="text-[11px] text-slate-500 mt-2 font-mono truncate">
                          Keywords ({asset.keywords.length}): {asset.keywords.slice(0, 8).join(', ')}...
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          {(['svg', 'eps', 'png', 'jpg'] as const).map((fmt) => (
                            <button
                              key={fmt}
                              type="button"
                              onClick={() => handleQuickDownload(asset.id, fmt)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold uppercase bg-slate-900 hover:bg-[#2563EB] text-white rounded cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>{fmt}</span>
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => onInspectAsset(asset)}
                          className="text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
                        >
                          Inspect & Edit Metadata →
                        </button>
                      </div>
                    </div>
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
