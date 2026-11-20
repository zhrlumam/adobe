import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  Download,
  Eye,
  FileCheck2,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { api, downloadAssetFormat } from '../lib/api';
import type { StockAsset } from '../types/stockforge';
import { SvgViewport } from './SvgViewport';

interface AssetInspectorModalProps {
  asset: StockAsset | null;
  adobeCategories: string[];
  shutterstockCategories: string[];
  onClose: () => void;
  onUpdated: (asset: StockAsset) => void;
  onDeleted: (assetId: string) => void;
  onNotify: (msg: string) => void;
}

export const AssetInspectorModal: React.FC<AssetInspectorModalProps> = ({
  asset,
  adobeCategories,
  shutterstockCategories,
  onClose,
  onUpdated,
  onDeleted,
  onNotify,
}) => {
  const [wireframe, setWireframe] = useState(false);
  const [backdrop, setBackdrop] = useState<'white' | 'checkerboard' | 'dark'>('checkerboard');
  const [showXml, setShowXml] = useState(false);
  const [copiedXml, setCopiedXml] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const [title, setTitle] = useState(asset?.title ?? '');
  const [description, setDescription] = useState(asset?.description ?? '');
  const [keywordsText, setKeywordsText] = useState(asset?.keywords.join(', ') ?? '');
  const [adobeCat, setAdobeCat] = useState(asset?.adobeCategory ?? 'Graphic Resources');
  const [shutterCat, setShutterCat] = useState(asset?.shutterstockCategory ?? 'Vectors');

  React.useEffect(() => {
    if (asset) {
      setTitle(asset.title);
      setDescription(asset.description);
      setKeywordsText(asset.keywords.join(', '));
      setAdobeCat(asset.adobeCategory);
      setShutterCat(asset.shutterstockCategory);
      setShowXml(false);
    }
  }, [asset]);

  if (!asset) return null;

  const handleDownload = async (fmt: 'svg' | 'eps' | 'png' | 'jpg') => {
    setDownloadingFormat(fmt);
    try {
      await downloadAssetFormat(asset.id, fmt);
      onNotify(`Exported ${asset.id}.${fmt}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : `Export failed`);
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleCopyXml = async () => {
    if (!asset.svgContent) return;
    await navigator.clipboard.writeText(asset.svgContent);
    setCopiedXml(true);
    onNotify('Copied SVG markup to clipboard');
    setTimeout(() => setCopiedXml(false), 1600);
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const keywords = keywordsText
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      const { asset: updated } = await api.updateAsset(asset.id, {
        title,
        description,
        keywords,
        adobeCategory: adobeCat,
        shutterstockCategory: shutterCat,
      });
      onUpdated(updated);
      onNotify(`Saved metadata for ${asset.id}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save metadata');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateMeta = async () => {
    setRegenerating(true);
    try {
      const { asset: updated } = await api.regenerateAssetMetadata(asset.id);
      onUpdated(updated);
      onNotify('Regenerated commercial stock metadata via AI');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to regenerate metadata');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteAsset(asset.id);
      onDeleted(asset.id);
      onClose();
      onNotify(`Deleted ${asset.id}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to delete asset');
    }
  };

  const v = asset.validation;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Inspect ${asset.id}`}
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Top bar */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
              <span>{asset.id}</span>
              <span aria-hidden="true">·</span>
              <span className="font-sans">{asset.category}</span>
              <span aria-hidden="true">·</span>
              <span className="font-sans">{asset.style}</span>
              <span aria-hidden="true">·</span>
              <span>{v.totalVectorPrimitives} primitives</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 truncate mt-0.5">
              {asset.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 border border-red-200 rounded-md cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspector"
              className="p-2 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-200/60 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Split body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12">
          {/* Left: Vector Preview & Validation */}
          <div className="lg:col-span-6 border-b lg:border-b-0 lg:border-r border-slate-200 p-6 flex flex-col gap-4 bg-slate-50/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['checkerboard', 'white', 'dark'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setBackdrop(mode)}
                    className={`px-2.5 py-1 text-xs capitalize rounded-md cursor-pointer whitespace-nowrap ${
                      backdrop === mode
                        ? 'bg-white text-slate-900 shadow-xs font-medium'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWireframe((w) => !w)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border cursor-pointer whitespace-nowrap ${
                    wireframe
                      ? 'bg-[#2563EB] text-white border-[#2563EB]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Outlines</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowXml((x) => !x)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border cursor-pointer whitespace-nowrap ${
                    showXml
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>SVG XML</span>
                </button>
              </div>
            </div>

            {showXml ? (
              <div className="relative flex-1 min-h-[360px] bg-slate-950 text-slate-100 rounded-lg border border-slate-800 p-4 font-mono text-xs overflow-auto">
                <button
                  type="button"
                  onClick={handleCopyXml}
                  className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-100 rounded border border-slate-700 cursor-pointer"
                >
                  {copiedXml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedXml ? 'Copied' : 'Copy'}</span>
                </button>
                <pre className="whitespace-pre-wrap break-all leading-relaxed pr-16">
                  {asset.svgContent}
                </pre>
              </div>
            ) : (
              <SvgViewport
                svgContent={asset.svgContent}
                wireframe={wireframe}
                backdrop={backdrop}
                className="w-full aspect-square max-h-[420px] rounded-lg border border-slate-200"
              />
            )}

            {/* Export buttons */}
            <div>
              <div className="text-xs font-medium text-slate-700 mb-2">
                Export Commercial Production Files
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(['svg', 'eps', 'png', 'jpg'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    disabled={downloadingFormat !== null}
                    onClick={() => handleDownload(fmt)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wide bg-slate-900 hover:bg-[#2563EB] disabled:opacity-50 text-white rounded-md transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{downloadingFormat === fmt ? '...' : fmt}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Validation Telemetry */}
            <div className="border border-slate-200 rounded-lg bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  {v.commercialReady ? (
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  )}
                  <span>
                    {v.commercialReady ? 'SVG Passed Commercial Validation' : 'Validation Warnings'}
                  </span>
                </span>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  viewBox {v.viewBox}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs text-slate-600 font-mono tabular-nums pt-2 border-t border-slate-100">
                <div>paths: {v.elementCounts.path}</div>
                <div>circles: {v.elementCounts.circle}</div>
                <div>rects: {v.elementCounts.rect}</div>
                <div>polygons: {v.elementCounts.polygon}</div>
              </div>
              {v.issues.length > 0 && (
                <ul className="mt-2 pt-2 border-t border-slate-100 space-y-1 text-xs text-amber-700">
                  {v.issues.map((issue, idx) => (
                    <li key={idx}>• {issue}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right: Metadata Editor */}
          <form onSubmit={handleSaveMetadata} className="lg:col-span-6 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Stock Marketplace Metadata</h3>
              <button
                type="button"
                onClick={handleRegenerateMeta}
                disabled={regenerating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-400 rounded-md cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                <span>{regenerating ? 'Regenerating...' : 'AI Refresh Metadata'}</span>
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label className="font-medium text-slate-700">Title (Adobe Stock & General)</label>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Adobe Stock Category
                </label>
                <select
                  value={adobeCat}
                  onChange={(e) => setAdobeCat(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#2563EB]"
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
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:border-[#2563EB]"
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
              <div className="flex justify-between text-xs mb-1">
                <label className="font-medium text-slate-700">Keywords (comma-separated, 10–49)</label>
                <span className="font-mono text-slate-500 tabular-nums">
                  {keywordsText.split(',').filter((s) => s.trim()).length}/49
                </span>
              </div>
              <textarea
                rows={5}
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md focus:outline-none focus:border-[#2563EB] leading-relaxed"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-mono truncate">
                {asset.providerSlug} · {asset.model}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 rounded-md cursor-pointer whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Metadata'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
