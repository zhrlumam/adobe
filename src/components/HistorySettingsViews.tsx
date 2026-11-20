import React, { useEffect, useState } from 'react';
import { Archive, Download, RefreshCw, Save } from 'lucide-react';
import { api, formatBytes } from '../lib/api';
import type { ProductionLogEntry, SystemSettings } from '../types/stockforge';

export const HistoryView: React.FC = () => {
  const [logs, setLogs] = useState<ProductionLogEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error' | 'info'>('all');
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getLogs(250);
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, []);

  const filtered =
    statusFilter === 'all' ? logs : logs.filter((l) => l.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Production History
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Auditable SQLite log of every AI request, connection test, batch run, export, and error.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            {(['all', 'success', 'error', 'info'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs capitalize rounded cursor-pointer ${
                  statusFilter === st ? 'bg-white text-slate-900 font-medium shadow-xs' : 'text-slate-600'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={loadLogs}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-8 text-xs text-slate-500">Loading production history...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-xs text-slate-500 text-center">No events match this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-medium">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Event</th>
                  <th className="py-2.5 px-4">Provider / Model</th>
                  <th className="py-2.5 px-4">Message</th>
                  <th className="py-2.5 px-4 text-right">Latency</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                      {log.eventType}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {log.providerSlug ? `${log.providerSlug}${log.model ? ` / ${log.model}` : ''}` : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800 max-w-md truncate">{log.message}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                      {log.latencyMs !== null ? `${log.latencyMs}ms` : '—'}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono text-[11px] font-medium whitespace-nowrap ${
                        log.status === 'error'
                          ? 'text-red-600'
                          : log.status === 'success'
                          ? 'text-emerald-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {log.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

interface SettingsViewProps {
  onNotify: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNotify }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [storageBytes, setStorageBytes] = useState(0);
  const [assetsDir, setAssetsDir] = useState('');
  const [backups, setBackups] = useState<
    { filename: string; sizeBytes: number; createdAt: string }[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  const loadAll = async () => {
    const [sData, bData] = await Promise.all([api.getSettings(), api.getBackups()]);
    setSettings(sData.settings);
    setStorageBytes(sData.storageBytes);
    setAssetsDir(sData.assetsDir);
    setBackups(Array.isArray(bData?.backups) ? bData.backups : []);
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const res = await api.saveSettings(settings);
      setSettings(res.settings);
      onNotify('Saved system settings');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBackup = async () => {
    setBackingUp(true);
    try {
      const res = await api.createBackup();
      setBackups(res.backups);
      onNotify(`Created backup ${res.backup.filename} (${res.backup.assetCount} assets)`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Backup creation failed');
    } finally {
      setBackingUp(false);
    }
  };

  if (!settings) {
    return <div className="p-6 text-xs text-slate-500">Loading system settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">System Settings</h1>
        <p className="text-sm text-slate-600 mt-1">
          Configure vector export defaults, batch worker policies, SVG security sanitization, and local backups.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-900">Production & Security Policies</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Default Raster Size (px)
              </label>
              <input
                type="number"
                min={512}
                max={8000}
                value={settings.exportRasterSize}
                onChange={(e) =>
                  setSettings({ ...settings, exportRasterSize: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                JPG Quality (60–100)
              </label>
              <input
                type="number"
                min={60}
                max={100}
                value={settings.exportJpgQuality}
                onChange={(e) =>
                  setSettings({ ...settings, exportJpgQuality: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                EPS Artboard (pt)
              </label>
              <input
                type="number"
                min={256}
                max={4000}
                value={settings.epsArtboardSize}
                onChange={(e) =>
                  setSettings({ ...settings, epsArtboardSize: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Default Batch Concurrency (1–4)
              </label>
              <input
                type="number"
                min={1}
                max={4}
                value={settings.defaultConcurrency}
                onChange={(e) =>
                  setSettings({ ...settings, defaultConcurrency: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Max Auto-Retries Per Item (0–5)
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={settings.maxRetries}
                onChange={(e) =>
                  setSettings({ ...settings, maxRetries: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-md"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.strictSanitizer}
                onChange={(e) =>
                  setSettings({ ...settings, strictSanitizer: e.target.checked })
                }
              />
              <span>
                Strict SVG Sanitizer (strip scripts, event handlers, foreignObject, and raster &lt;image&gt; tags)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.preventDuplicates}
                onChange={(e) =>
                  setSettings({ ...settings, preventDuplicates: e.target.checked })
                }
              />
              <span>
                Geometry Duplicate Detection (reject repeated SVG paths even with different colors)
              </span>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded-md cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save System Settings'}</span>
            </button>
          </div>
        </form>

        {/* Right: Local Storage & Backups */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Local Storage & Backups</h2>
            <span className="font-mono text-xs text-slate-600 tabular-nums">
              {formatBytes(storageBytes)}
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-600 break-all">
            Assets directory: {assetsDir}
          </div>

          <button
            type="button"
            disabled={backingUp}
            onClick={handleCreateBackup}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-[#2563EB] rounded-md cursor-pointer disabled:opacity-50"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{backingUp ? 'Creating Snapshot ZIP...' : 'Create Local Backup ZIP'}</span>
          </button>

          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {backups.length === 0 ? (
              <div className="py-4 text-xs text-slate-500">No backup archives created yet.</div>
            ) : (
              backups.map((b) => (
                <div key={b.filename} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-slate-800 truncate">{b.filename}</div>
                    <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {formatBytes(b.sizeBytes)} · {new Date(b.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <a
                    href={`/api/backups/${encodeURIComponent(b.filename)}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#2563EB] hover:underline shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
