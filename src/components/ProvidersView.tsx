import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Play,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { api } from '../lib/api';
import type { ProviderSlug, ProviderState } from '../types/stockforge';

interface ProvidersViewProps {
  onNotify: (msg: string) => void;
  onProvidersChanged: () => void;
}

export const ProvidersView: React.FC<ProvidersViewProps> = ({
  onNotify,
  onProvidersChanged,
}) => {
  const [providers, setProviders] = useState<ProviderState[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<ProviderSlug>('gemini');
  const [loading, setLoading] = useState(true);

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [customModelInput, setCustomModelInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testOutput, setTestOutput] = useState<{
    ok: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const data = await api.getProviders();
      const list = Array.isArray(data?.providers) ? data.providers : [];
      setProviders(list);
      const active = list.find((p) => p.isActive) ?? list[0];
      if (active && !providers.length) {
        setSelectedSlug(active.slug);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load AI providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProviders();
  }, []);

  const current = providers.find((p) => p.slug === selectedSlug) ?? providers[0];

  useEffect(() => {
    if (current) {
      setApiKeyInput('');
      setBaseUrlInput(current.baseUrl);
      setModelInput(current.selectedModel);
      setCustomModelInput('');
      setTestOutput(null);
    }
  }, [selectedSlug, current?.baseUrl, current?.selectedModel]);

  const handleTestConnection = async () => {
    if (!current) return;
    setTesting(true);
    setTestOutput(null);
    try {
      const effectiveModel = customModelInput.trim() || modelInput;
      const res = await api.testProvider(current.slug, {
        apiKey: apiKeyInput.trim() || undefined,
        baseUrl: baseUrlInput.trim() || undefined,
        selectedModel: effectiveModel,
      });
      setTestOutput({
        ok: res.ok,
        latencyMs: res.latencyMs,
        message: res.ok
          ? `Connected in ${res.latencyMs}ms · ${res.models.length} model(s) verified from live API`
          : res.error || 'Connection failed',
      });
      await loadProviders();
      onProvidersChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection test failed';
      setTestOutput({ ok: false, message: msg });
      await loadProviders();
    } finally {
      setTesting(false);
    }
  };

  const handleValidateAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    setSaving(true);
    setTestOutput(null);
    try {
      const effectiveModel = customModelInput.trim() || modelInput;
      await api.saveProviderConfig(current.slug, {
        apiKey: apiKeyInput.trim() || undefined,
        baseUrl: baseUrlInput.trim() || undefined,
        selectedModel: effectiveModel,
        validateBeforeSave: Boolean(apiKeyInput.trim()),
      });
      setApiKeyInput('');
      setCustomModelInput('');
      await loadProviders();
      onProvidersChanged();
      onNotify(`Saved ${current.name} configuration`);
      setTestOutput({ ok: true, message: 'Credentials validated and stored strictly server-side.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setTestOutput({ ok: false, message: msg });
      onNotify(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleClearKey = async () => {
    if (!current) return;
    try {
      await api.saveProviderConfig(current.slug, { clearApiKey: true });
      await loadProviders();
      onProvidersChanged();
      onNotify(`Removed stored API key for ${current.name}`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to clear key');
    }
  };

  const handleActivate = async (slug: ProviderSlug) => {
    try {
      await api.activateProvider(slug);
      await loadProviders();
      onProvidersChanged();
      onNotify(`Activated ${slug} as default AI specification engine`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to activate provider');
    }
  };

  if (loading && providers.length === 0) {
    return <div className="p-6 text-sm text-slate-400">Loading AI provider registry...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">
            AI Provider Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect Gemini, OpenAI, OpenRouter, Groq, Hugging Face, Ollama, or custom endpoints for AI-assisted animation specs &amp; metadata. Procedural production always works offline without any paid key.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadProviders()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-[#121722] border border-slate-800 hover:border-slate-700 rounded-md cursor-pointer self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Status</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Provider Directory */}
        <div className="lg:col-span-5 space-y-2.5">
          {providers.map((p) => {
            const isSelected = p.slug === current?.slug;
            return (
              <div
                key={p.slug}
                onClick={() => setSelectedSlug(p.slug)}
                className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-[#3B82F6] bg-[#3B82F6]/10'
                    : 'border-slate-800 bg-[#121722] hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                      <span>{p.name}</span>
                      {p.isActive && (
                        <span className="text-[11px] font-mono text-[#3B82F6]">· Active</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 font-mono truncate">
                      {p.selectedModel}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium shrink-0 ${
                      p.status === 'connected'
                        ? 'text-emerald-400'
                        : p.status === 'error'
                        ? 'text-red-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {p.status === 'connected'
                      ? 'Connected'
                      : p.status === 'error'
                      ? 'Error'
                      : 'Not Configured'}
                  </span>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="truncate">{p.catalog.freeTierSummary}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Configuration & Live Diagnostics */}
        {current && (
          <div className="lg:col-span-7 bg-[#121722] border border-slate-800 rounded-lg p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">{current.name}</h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {current.catalog.description}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!current.isActive ? (
                  <button
                    type="button"
                    onClick={() => void handleActivate(current.slug)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#0B0E14] border border-slate-700 hover:border-[#3B82F6] rounded-md cursor-pointer whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Set as Active Engine</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#3B82F6] bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-md whitespace-nowrap">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active Engine</span>
                  </span>
                )}
              </div>
            </div>

            {/* Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#0B0E14] p-4 rounded-lg border border-slate-800">
              <div>
                <div className="font-semibold text-slate-300">Access / Tier</div>
                <div className="text-slate-400 mt-0.5">{current.catalog.freeTierSummary}</div>
              </div>
              <div>
                <div className="font-semibold text-slate-300">Rate Limits</div>
                <div className="text-slate-400 mt-0.5">{current.catalog.rateLimitsSummary}</div>
              </div>
              <div>
                <div className="font-semibold text-slate-300">Structured Output</div>
                <div className="text-slate-400 mt-0.5">
                  {current.catalog.structuredOutputSupport}
                </div>
              </div>
              <div>
                <div className="font-semibold text-slate-300">Commercial Usage</div>
                <div className="text-slate-400 mt-0.5">{current.catalog.commercialTerms}</div>
              </div>
            </div>

            {/* Onboarding */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-200">
                  Credentials &amp; Model Discovery
                </h3>
                <div className="flex items-center gap-3">
                  <a
                    href={current.catalog.officialUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 underline"
                  >
                    <span>Docs</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={current.catalog.apiKeyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#3B82F6] hover:underline"
                  >
                    <span>Get API Key / Endpoint</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-xs text-slate-400">
                {current.catalog.setupSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>

            {/* Configuration Form */}
            <form
              onSubmit={handleValidateAndSave}
              className="space-y-4 pt-4 border-t border-slate-800"
            >
              {current.catalog.requiresApiKey && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label className="font-medium text-slate-300 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                      <span>API Key (stored strictly server-side)</span>
                    </label>
                    <span className="font-mono text-slate-400">
                      {current.envManaged
                        ? `Env secret (${current.keyHint})`
                        : current.hasKey
                        ? `Saved (${current.keyHint})`
                        : 'No key saved'}
                    </span>
                  </div>

                  {current.envManaged ? (
                    <div className="p-3 rounded-md bg-emerald-950/30 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>
                        API key is injected securely via server environment variables (
                        {current.keyHint}).
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder={
                          current.hasKey
                            ? `Current key ${current.keyHint} — enter new key to replace`
                            : `Paste your ${current.name} API key...`
                        }
                        autoComplete="off"
                        className="flex-1 px-3 py-2 text-xs font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md focus:outline-none focus:border-[#3B82F6]"
                      />
                      {current.hasKey && (
                        <button
                          type="button"
                          onClick={() => void handleClearKey()}
                          title="Remove saved key"
                          className="p-2 text-red-400 hover:bg-red-950/40 border border-red-900/60 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {(current.slug === 'ollama' ||
                current.slug === 'custom' ||
                current.slug === 'openai') && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Endpoint Base URL
                  </label>
                  <input
                    type="url"
                    value={baseUrlInput}
                    onChange={(e) => setBaseUrlInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Verified Model List
                  </label>
                  <select
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md focus:outline-none focus:border-[#3B82F6]"
                  >
                    {Array.from(
                      new Set([
                        ...current.catalog.recommendedModels.map((m) => m.id),
                        ...current.availableModels,
                      ])
                    ).map((mId) => {
                      const rec = current.catalog.recommendedModels.find((r) => r.id === mId);
                      return (
                        <option key={mId} value={mId}>
                          {rec ? `${rec.label} [${rec.tier}]` : mId}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Custom Model ID Override
                  </label>
                  <input
                    type="text"
                    value={customModelInput}
                    onChange={(e) => setCustomModelInput(e.target.value)}
                    placeholder="Leave blank to use selected model"
                    className="w-full px-3 py-2 text-xs font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </div>

              {current.rateLimitInfo && (
                <div className="p-3 rounded-md bg-[#0B0E14] border border-slate-800 text-xs">
                  <div className="font-medium text-slate-300 mb-1">
                    Captured Provider Rate Limits
                  </div>
                  <div className="grid grid-cols-2 gap-1 font-mono text-[11px] text-slate-400">
                    {Object.entries(current.rateLimitInfo).map(([k, v]) => (
                      <div key={k} className="truncate">
                        {k}: {v}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(testOutput || current.lastError) && (
                <div
                  className={`p-3 rounded-md border text-xs flex items-start gap-2 ${
                    testOutput?.ok
                      ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                      : 'bg-red-950/30 border-red-900/60 text-red-300'
                  }`}
                >
                  {testOutput?.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <div className="font-mono break-all">
                    {testOutput ? testOutput.message : current.lastError}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => void handleTestConnection()}
                  disabled={testing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-200 bg-[#0B0E14] border border-slate-700 hover:border-slate-500 rounded-md cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? 'Querying Live API...' : 'Test & Discover Models'}</span>
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#3B82F6] hover:bg-blue-500 rounded-md cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>
                    {saving
                      ? 'Validating & Saving...'
                      : apiKeyInput.trim()
                      ? 'Validate & Save Key'
                      : 'Save Configuration'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
