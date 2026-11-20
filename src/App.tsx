import React, { useEffect, useState } from 'react';
import {
  Archive,
  Clock,
  Cpu,
  Download,
  FolderOpen,
  Layers,
  LayoutDashboard,
  Menu,
  Plus,
  Settings,
  Sparkles,
  Tags,
  X,
} from 'lucide-react';
import { AssetInspectorModal } from './components/AssetInspectorModal';
import { BatchView } from './components/BatchView';
import { DashboardView, type StudioTab } from './components/DashboardView';
import { ExportManagerView } from './components/ExportManagerView';
import { GenerateView } from './components/GenerateView';
import { HistoryView, SettingsView } from './components/HistorySettingsViews';
import { LibraryView } from './components/LibraryView';
import { MetadataEditorView } from './components/MetadataEditorView';
import { ProvidersView } from './components/ProvidersView';
import { api } from './lib/api';
import type { ProviderState, StockAsset } from './types/stockforge';

const NAV_ITEMS: { id: StudioTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'generate', label: 'Generate Assets', icon: Sparkles },
  { id: 'batch', label: 'Batch Production', icon: Layers },
  { id: 'library', label: 'Asset Library', icon: FolderOpen },
  { id: 'metadata', label: 'Metadata Editor', icon: Tags },
  { id: 'export', label: 'Export Manager', icon: Download },
  { id: 'providers', label: 'AI Providers', icon: Cpu },
  { id: 'history', label: 'Production History', icon: Clock },
  { id: 'settings', label: 'System Settings', icon: Settings },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<StudioTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<ProviderState | null>(null);
  const [inspectedAsset, setInspectedAsset] = useState<StockAsset | null>(null);
  const [adobeCategories, setAdobeCategories] = useState<string[]>([]);
  const [shutterstockCategories, setShutterstockCategories] = useState<string[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const refreshProviderBadge = async () => {
    try {
      const data = await api.getProviders();
      const act = data.providers.find((p) => p.isActive) ?? data.providers[0] ?? null;
      setActiveProvider(act);
    } catch {
      // ignore initial error
    }
  };

  useEffect(() => {
    void refreshProviderBadge();
    void api
      .getAssets()
      .then((d) => {
        setAdobeCategories(Array.isArray(d?.adobeCategories) ? d.adobeCategories : []);
        setShutterstockCategories(
          Array.isArray(d?.shutterstockCategories) ? d.shutterstockCategories : []
        );
      })
      .catch(() => {
        // ignore initial fetch error
      });
  }, []);

  const handleInspectAssetId = async (assetId: string) => {
    try {
      const { asset } = await api.getAsset(assetId);
      setInspectedAsset(asset);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to load asset');
    }
  };

  const currentTabMeta = NAV_ITEMS.find((n) => n.id === activeTab)!;

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-[#0F172A]">
      {/* Fixed Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r border-slate-200 bg-white">
        <div className="h-14 px-5 border-b border-slate-200 flex items-center gap-2.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 28 28"
            className="w-6 h-6 shrink-0"
            aria-hidden="true"
          >
            <rect width="28" height="28" rx="6" fill="#0F172A" />
            <path
              d="M8.5 9.5H19.5L9.5 18.5H19.5"
              fill="none"
              stroke="#60A5FA"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="19.5" cy="9.5" r="2" fill="#FFFFFF" />
          </svg>
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            ZuumStock Studio
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs">
          <div className="text-slate-500">Active AI Engine</div>
          <button
            type="button"
            onClick={() => setActiveTab('providers')}
            className="mt-1 w-full text-left font-medium text-slate-900 hover:text-[#2563EB] truncate cursor-pointer"
          >
            {activeProvider ? activeProvider.name : 'Configure Provider'}
          </button>
          {activeProvider && (
            <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
              {activeProvider.selectedModel} · {activeProvider.status}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-64 bg-white h-full border-r border-slate-200 flex flex-col">
            <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
              <span className="font-display text-lg font-bold text-slate-900">
                ZuumStock Studio
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md cursor-pointer ${
                      active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean Top Bar Contract */}
        <header className="h-14 px-6 border-b border-slate-200 bg-white flex items-center justify-between gap-8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap truncate">
              <span className="font-medium text-slate-900">ZuumStock Studio</span>
              <span aria-hidden="true">/</span>
              <span>{currentTabMeta.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-md cursor-pointer whitespace-nowrap"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Backups</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('generate')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded-md cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Vector</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigate={setActiveTab}
              onInspectAsset={setInspectedAsset}
            />
          )}
          {activeTab === 'providers' && (
            <ProvidersView
              onNotify={notify}
              onProvidersChanged={() => void refreshProviderBadge()}
            />
          )}
          {activeTab === 'generate' && (
            <GenerateView
              onInspectAsset={setInspectedAsset}
              onNotify={notify}
              onGoToProviders={() => setActiveTab('providers')}
            />
          )}
          {activeTab === 'batch' && (
            <BatchView
              onNotify={notify}
              onInspectAssetId={(id) => void handleInspectAssetId(id)}
              onGoToProviders={() => setActiveTab('providers')}
            />
          )}
          {activeTab === 'library' && (
            <LibraryView
              onInspectAsset={setInspectedAsset}
              onNotify={notify}
              refreshTick={refreshTick}
            />
          )}
          {activeTab === 'metadata' && (
            <MetadataEditorView onNotify={notify} refreshTick={refreshTick} />
          )}
          {activeTab === 'export' && <ExportManagerView onNotify={notify} />}
          {activeTab === 'history' && <HistoryView />}
          {activeTab === 'settings' && <SettingsView onNotify={notify} />}
        </main>
      </div>

      {/* Asset Inspector Modal */}
      <AssetInspectorModal
        asset={inspectedAsset}
        adobeCategories={adobeCategories}
        shutterstockCategories={shutterstockCategories}
        onClose={() => setInspectedAsset(null)}
        onUpdated={(updated) => {
          setInspectedAsset(updated);
          setRefreshTick((t) => t + 1);
        }}
        onDeleted={() => {
          setInspectedAsset(null);
          setRefreshTick((t) => t + 1);
        }}
        onNotify={notify}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-medium shadow-lg border border-white/10"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
