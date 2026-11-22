import React, { useEffect, useState } from 'react';
import {
  Activity,
  Archive,
  CheckCircle2,
  Download,
  FolderOpen,
  RefreshCw,
  Save,
  XCircle,
} from 'lucide-react';
import { api, formatBytes } from '../lib/api';
import type {
  ProductionLogEntry,
  SystemDiagnostics,
  SystemSettings,
} from '../types/stockforge';

interface DiagnosticsViewProps {
  onNotify: (msg: string) => void;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({ onNotify }) => {
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [logs, setLogs] = useState<ProductionLogEntry[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [backups, setBackups] = useState<
    { filename: string; sizeBytes: number; createdAt: string }[]
  >([]);
  const [logFilter, setLogFilter] = useState<'all' | 'success' | 'error' | 'info'>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dRes, lRes, sRes, bRes] = await Promise.all([
        api.getDiagnostics(),
        api.getLogs(150),
        api.getSettings(),
        api.getBackups(),
      ]);
      setDiagnostics(dRes);
      setLogs(lRes.logs ?? []);
      setSettings(sRes.settings);
      setBackups(bRes.backups ?? []);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load diagnostics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const res = await api.saveSettings(settings);
      setSettings(res.settings);
      onNotify('Saved studio pipeline settings');
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
      setBackups(res.backups ?? []);
      onNotify(`Created local backup ${res.backup.filename}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Backup failed');
    } finally {
      setBackingUp(false);
    }
  };

  const filteredLogs =
    logFilter === 'all' ? logs : logs.filter((l) => l.status === logFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">
            System Diagnostics &amp; Pipeline Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Inspect FFmpeg / FFprobe codec capabilities, /output 12-folder storage telemetry, runtime settings, and SQLite audit logs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-[#121722] border border-slate-800 hover:border-slate-700 rounded-md cursor-pointer self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Run Diagnostics</span>
        </button>
      </div>

      {/* Capabilities Grid */}
      {diagnostics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-[#121722] border border-slate-800 rounded-lg">
            <div className="text-xs text-slate-400">Runtime Environment</div>
            <div className="text-sm font-mono font-semibold text-slate-100 mt-1.5">
              Node {diagnostics.nodeVersion} · {diagnostics.platform}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1 truncate">
              {diagnostics.outputRoot}
            </div>
          </div>

          <div className="p-4 bg-[#121722] border border-slate-800 rounded-lg">
            <div className="text-xs text-slate-400">FFmpeg / FFprobe Binary</div>
            <div className="text-sm font-semibold text-slate-100 mt-1.5 flex items-center gap-1.5">
              {diagnostics.ffmpegAvailable && diagnostics.ffprobeAvailable ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>
                {diagnostics.ffmpegAvailable ? 'FFmpeg + FFprobe Ready' : 'Binary Missing'}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1 truncate">
              {diagnostics.ffmpegVersion}
            </div>
          </div>

          <div className="p-4 bg-[#121722] border border-slate-800 rounded-lg">
            <div className="text-xs text-slate-400">Video Encoder Matrix</div>
            <div className="text-xs font-mono text-slate-200 mt-1.5 space-y-0.5">
              <div>H.264 MP4: {diagnostics.h264Supported ? 'enabled' : 'unavailable'}</div>
              <div>
                ProRes 4444 Alpha:{' '}
                {diagnostics.proresAlphaSupported ? 'enabled (yuva444p10le)' : 'unavailable'}
              </div>
            </div>
          </div>

          <div className="p-4 bg-[#121722] border border-slate-800 rounded-lg">
            <div className="text-xs text-slate-400">Total Studio Storage</div>
            <div className="text-2xl font-mono font-semibold text-slate-100 mt-1 tabular-nums">
              {formatBytes(diagnostics.storageBytes)}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1 tabular-nums">
              {diagnostics.totalProjects} projects · {diagnostics.totalBatches} batches
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* /output 12-Folder Breakdown */}
        <div className="lg:col-span-6 bg-[#121722] border border-slate-800 rounded-lg p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#3B82F6]" />
            <span>/output Directory Tree</span>
          </h2>
          {!diagnostics ? (
            <div className="text-xs text-slate-500">Loading directory telemetry...</div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-md">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0B0E14] border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3">Folder</th>
                    <th className="py-2 px-3 text-right">Files</th>
                    <th className="py-2 px-3 text-right">Disk Usage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                  {diagnostics.outputFolders.map((f) => (
                    <tr key={f.folder} className="hover:bg-[#0B0E14]/50">
                      <td className="py-1.5 px-3 text-slate-200">/output/{f.folder}</td>
                      <td className="py-1.5 px-3 text-right text-slate-300 tabular-nums">
                        {f.fileCount}
                      </td>
                      <td className="py-1.5 px-3 text-right text-slate-400 tabular-nums">
                        {formatBytes(f.sizeBytes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Settings & Backups */}
        <div className="lg:col-span-6 space-y-6">
          {settings && (
            <form
              onSubmit={handleSaveSettings}
              className="bg-[#121722] border border-slate-800 rounded-lg p-5 space-y-4"
            >
              <h2 className="text-sm font-semibold text-slate-100">Pipeline &amp; Security Policy</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Batch Concurrency</label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={settings.defaultConcurrency}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultConcurrency: Number(e.target.value) })
                    }
                    className="w-full px-3 py-1.5 text-xs font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Max Retries</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={settings.maxRetries}
                    onChange={(e) =>
                      setSettings({ ...settings, maxRetries: Number(e.target.value) })
                    }
                    className="w-full px-3 py-1.5 text-xs font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Raster Size (px)</label>
                  <input
                    type="number"
                    min={512}
                    max={8000}
                    value={settings.exportRasterSize}
                    onChange={(e) =>
                      setSettings({ ...settings, exportRasterSize: Number(e.target.value) })
                    }
                    className="w-full px-3 py-1.5 text-xs font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
                  />
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.strictSanitizer}
                    onChange={(e) =>
                      setSettings({ ...settings, strictSanitizer: e.target.checked })
                    }
                  />
                  <span>Strict SVG Sanitizer (strip scripts, handlers, and foreignObject)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.preventDuplicates}
                    onChange={(e) =>
                      setSettings({ ...settings, preventDuplicates: e.target.checked })
                    }
                  />
                  <span>Prevent Duplicate Project Hashes in Batch Queue</span>
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#3B82F6] hover:bg-blue-500 rounded-md cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Policy'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Backups */}
          <div className="bg-[#121722] border border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">Database &amp; Source Snapshots</h2>
              <button
                type="button"
                disabled={backingUp}
                onClick={() => void handleCreateBackup()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0B0E14] border border-slate-700 hover:border-slate-500 rounded-md cursor-pointer disabled:opacity-50"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{backingUp ? 'Archiving...' : 'Create Backup ZIP'}</span>
              </button>
            </div>
            {backups.length === 0 ? (
              <div className="text-xs text-slate-500">No backup archives created yet.</div>
            ) : (
              <div className="divide-y divide-slate-800 max-h-40 overflow-y-auto">
                {backups.map((b) => (
                  <div
                    key={b.filename}
                    className="py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-slate-200 truncate">
                        {b.filename}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {formatBytes(b.sizeBytes)} · {new Date(b.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <a
                      href={`/api/backups/${encodeURIComponent(b.filename)}`}
                      className="inline-flex items-center gap-1 text-[#3B82F6] hover:underline shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="bg-[#121722] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Activity className="w-4 h-4 text-[#3B82F6]" />
            <span>Production Pipeline Logs</span>
          </div>
          <div className="flex items-center gap-1 bg-[#0B0E14] p-1 rounded border border-slate-800">
            {(['all', 'success', 'error', 'info'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setLogFilter(st)}
                className={`px-2.5 py-1 text-xs capitalize rounded cursor-pointer ${
                  logFilter === st ? 'bg-[#3B82F6] text-white font-medium' : 'text-slate-400'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-8 text-xs text-slate-500 text-center">No pipeline events recorded.</div>
        ) : (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0B0E14] border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-4">Timestamp</th>
                  <th className="py-2 px-4">Event</th>
                  <th className="py-2 px-4">Engine / Model</th>
                  <th className="py-2 px-4">Message</th>
                  <th className="py-2 px-4 text-right">Latency</th>
                  <th className="py-2 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#0B0E14]/50">
                    <td className="py-2 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                      {log.eventType}
                    </td>
                    <td className="py-2 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {log.providerSlug
                        ? `${log.providerSlug}${log.model ? ` / ${log.model}` : ''}`
                        : '—'}
                    </td>
                    <td className="py-2 px-4 text-slate-200 max-w-md truncate">{log.message}</td>
                    <td className="py-2 px-4 text-right font-mono text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                      {log.latencyMs !== null ? `${log.latencyMs}ms` : '—'}
                    </td>
                    <td
                      className={`py-2 px-4 text-right font-mono text-[11px] font-medium whitespace-nowrap ${
                        log.status === 'error'
                          ? 'text-red-400'
                          : log.status === 'success'
                          ? 'text-emerald-400'
                          : 'text-slate-400'
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
