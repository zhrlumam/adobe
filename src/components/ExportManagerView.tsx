import React, { useEffect, useState } from 'react';
import { Download, FileArchive } from 'lucide-react';
import {
  api,
  downloadExportBundle,
  downloadMetadataCsv,
} from '../lib/api';
import type { BatchJob, StockAsset } from '../types/stockforge';

interface ExportManagerViewProps {
  onNotify: (msg: string) => void;
}

export const ExportManagerView: React.FC<ExportManagerViewProps> = ({ onNotify }) => {
  const [assets, setAssets] = useState<StockAsset[]>([]);
  const [batches, setBatches] = useState<BatchJob[]>([]);
  const [scope, setScope] = useState<'all' | 'ready' | 'batch'>('all');
  const [selectedBatchId, setSelectedBatchId] = useState('');

  const [formats, setFormats] = useState<{
    svg: boolean;
    eps: boolean;
    png: boolean;
    jpg: boolean;
  }>({
    svg: true,
    eps: true,
    png: true,
    jpg: true,
  });

  const [includeAdobeCsv, setIncludeAdobeCsv] = useState(true);
  const [includeShutterstockCsv, setIncludeShutterstockCsv] = useState(true);
  const [rasterSize, setRasterSize] = useState(4000);
  const [jpgQuality, setJpgQuality] = useState(95);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void api
      .getAssets()
      .then((d) => setAssets(Array.isArray(d?.assets) ? d.assets : []))
      .catch(() => {});
    void api
      .getBatches()
      .then((d) => {
        const list = Array.isArray(d?.batches) ? d.batches : [];
        setBatches(list);
        if (list[0]) setSelectedBatchId(list[0].id);
      })
      .catch(() => {});
    void api
      .getSettings()
      .then((d) => {
        if (d?.settings) {
          setRasterSize(d.settings.exportRasterSize);
          setJpgQuality(d.settings.exportJpgQuality);
        }
      })
      .catch(() => {});
  }, []);

  const targetAssets = assets.filter((a) => {
    if (scope === 'ready') return a.validation.commercialReady;
    if (scope === 'batch') return a.batchId === selectedBatchId;
    return true;
  });

  const activeFormats = (['svg', 'eps', 'png', 'jpg'] as const).filter((f) => formats[f]);

  const handleExportZip = async () => {
    if (targetAssets.length === 0) {
      onNotify('No assets match the selected export scope.');
      return;
    }
    if (activeFormats.length === 0) {
      onNotify('Select at least one output file format.');
      return;
    }
    setExporting(true);
    try {
      await downloadExportBundle({
        assetIds: scope === 'batch' ? undefined : targetAssets.map((a) => a.id),
        batchId: scope === 'batch' ? selectedBatchId : undefined,
        formats: activeFormats,
        includeAdobeCsv,
        includeShutterstockCsv,
        rasterSize,
        jpgQuality,
      });
      onNotify(`Exported ${targetAssets.length} asset(s) in ${activeFormats.join(', ').toUpperCase()}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Export bundle failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Export Manager</h1>
        <p className="text-sm text-slate-600 mt-1">
          Compile true PostScript EPS vectors, clean SVG files, high-resolution PNG/JPG renders, and agency submission CSVs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-900 mb-2">
              1. Select Asset Scope
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'all', label: `All Assets (${assets.length})` },
                {
                  id: 'ready',
                  label: `Validated Only (${assets.filter((a) => a.validation.commercialReady).length})`,
                },
                { id: 'batch', label: 'By Batch Job' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScope(opt.id as 'all' | 'ready' | 'batch')}
                  className={`px-3 py-2 text-xs font-medium rounded-md border cursor-pointer ${
                    scope === opt.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {scope === 'batch' && (
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="mt-3 w-full px-3 py-2 text-xs border border-slate-200 rounded-md bg-white"
              >
                {batches.length === 0 ? (
                  <option value="">No batches available</option>
                ) : (
                  batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.completedCount} completed)
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-900 mb-2">
              2. Deliverable Formats
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'svg', label: 'SVG (Editable XML)' },
                  { id: 'eps', label: 'EPS (Vector PS3)' },
                  { id: 'png', label: 'PNG (Transparent)' },
                  { id: 'jpg', label: 'JPG (300 DPI White)' },
                ] as const
              ).map((fmt) => (
                <label
                  key={fmt.id}
                  className={`flex items-center gap-2 p-2.5 rounded-md border text-xs cursor-pointer ${
                    formats[fmt.id]
                      ? 'border-[#2563EB] bg-blue-50/40 text-slate-900 font-medium'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formats[fmt.id]}
                    onChange={(e) =>
                      setFormats((prev) => ({ ...prev, [fmt.id]: e.target.checked }))
                    }
                  />
                  <span>{fmt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                PNG / JPG Render Resolution (px)
              </label>
              <select
                value={rasterSize}
                onChange={(e) => setRasterSize(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md bg-white"
              >
                <option value={2000}>2000 × 2000 px (4 MP)</option>
                <option value={4000}>4000 × 4000 px (16 MP — Stock Optimal)</option>
                <option value={5000}>5000 × 5000 px (25 MP)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                JPG Compression Quality
              </label>
              <input
                type="number"
                min={60}
                max={100}
                value={jpgQuality}
                onChange={(e) => setJpgQuality(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-2">
            <label className="block text-xs font-semibold text-slate-900">
              3. Agency Metadata CSV Files
            </label>
            <div className="flex flex-wrap gap-4 text-xs text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAdobeCsv}
                  onChange={(e) => setIncludeAdobeCsv(e.target.checked)}
                />
                <span>Include Adobe Stock CSV (Filename, Title, Keywords, Category)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeShutterstockCsv}
                  onChange={(e) => setIncludeShutterstockCsv(e.target.checked)}
                />
                <span>Include Shutterstock CSV (Description, Categories, Illustration=yes)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right: Summary & Actions */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileArchive className="w-4 h-4 text-[#2563EB]" />
              <span>Export Package Summary</span>
            </div>

            <div className="space-y-2 text-xs border-t border-b border-slate-100 py-3 font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-500">Assets in package:</span>
                <span className="font-semibold text-slate-900">{targetAssets.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Vector formats:</span>
                <span className="text-slate-900">
                  {activeFormats.filter((f) => f === 'svg' || f === 'eps').join(', ').toUpperCase() ||
                    'None'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Raster size:</span>
                <span className="text-slate-900">
                  {rasterSize}×{rasterSize}px
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={exporting || targetAssets.length === 0}
              onClick={handleExportZip}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 rounded-md cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Compiling Vectors & ZIP...' : 'Download Production ZIP'}</span>
            </button>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                disabled={targetAssets.length === 0}
                onClick={() =>
                  downloadMetadataCsv({
                    assetIds: scope === 'batch' ? undefined : targetAssets.map((a) => a.id),
                    batchId: scope === 'batch' ? selectedBatchId : undefined,
                    platform: 'adobe_stock',
                  })
                }
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md cursor-pointer disabled:opacity-40"
              >
                Adobe CSV Only
              </button>
              <button
                type="button"
                disabled={targetAssets.length === 0}
                onClick={() =>
                  downloadMetadataCsv({
                    assetIds: scope === 'batch' ? undefined : targetAssets.map((a) => a.id),
                    batchId: scope === 'batch' ? selectedBatchId : undefined,
                    platform: 'shutterstock',
                  })
                }
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md cursor-pointer disabled:opacity-40"
              >
                Shutterstock CSV Only
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
