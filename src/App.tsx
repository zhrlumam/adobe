import React, { useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  Download,
  Film,
  FolderOpen,
  Layers,
  LayoutDashboard,
  Menu,
  Plus,
  ShieldCheck,
  Sliders,
  Tags,
  X,
} from 'lucide-react';
import { AnimationEditorView } from './components/AnimationEditorView';
import { BatchView } from './components/BatchView';
import { DashboardView, type StudioTab } from './components/DashboardView';
import { DiagnosticsView } from './components/DiagnosticsView';
import { ExportManagerView } from './components/ExportManagerView';
import { LibraryView } from './components/LibraryView';
import { MetadataEditorView } from './components/MetadataEditorView';
import { NewProductionView } from './components/NewProductionView';
import { ProvidersView } from './components/ProvidersView';
import { QualityControlView } from './components/QualityControlView';
import { api } from './lib/api';
import type { AnimationProject, ProviderState } from './types/stockforge';

const NAV_ITEMS: { id: StudioTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'new_production', label: 'New Production', icon: Film },
  { id: 'editor', label: 'Animation Editor', icon: Sliders },
  { id: 'batch', label: 'Batch Queue', icon: Layers },
  { id: 'library', label: 'Asset Library', icon: FolderOpen },
  { id: 'metadata', label: 'Metadata Manager', icon: Tags },
  { id: 'export', label: 'Export Center', icon: Download },
  { id: 'providers', label: 'Provider Settings', icon: Cpu },
  { id: 'qa', label: 'Quality Control', icon: ShieldCheck },
  { id: 'diagnostics', label: 'System Diagnostics', icon: Activity },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<StudioTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<ProviderState | null>(null);
  const [activeProject, setActiveProject] = useState<AnimationProject | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  const refreshProviderBadge = async () => {
    try {
      const data = await api.getProviders();
      const act = data.providers.find((p) => p.isActive) ?? data.providers[0] ?? null;
      setActiveProvider(act);
    } catch {
      // ignore startup error
    }
  };

  useEffect(() => {
    void refreshProviderBadge();
  }, []);

  const handleOpenEditor = (project: AnimationProject) => {
    setActiveProject(project);
    setActiveTab('editor');
  };

  const handleOpenProjectById = async (projectId: string) => {
    try {
      const res = await api.getAnimation(projectId);
      setActiveProject(res.project);
      setActiveTab('editor');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to open project');
    }
  };

  const currentTabMeta = NAV_ITEMS.find((n) => n.id === activeTab)!;

  return (
    <div className="min-h-screen flex bg-[#0B0E14] text-[#F8FAFC]">
      {/* Fixed Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r border-slate-800 bg-[#121722]">
        <div className="h-14 px-5 border-b border-slate-800 flex items-center gap-2.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 28 28"
            className="w-6 h-6 shrink-0"
            aria-hidden="true"
          >
            <rect width="28" height="28" rx="6" fill="#3B82F6" />
            <polygon points="10,8 21,14 10,20" fill="#FFFFFF" />
            <circle cx="8" cy="20" r="2" fill="#10B981" />
          </svg>
          <span className="font-display text-base font-bold tracking-tight text-slate-50 whitespace-nowrap">
            StockForge Studio
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
                    ? 'bg-[#3B82F6] text-white'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-[#0B0E14]/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs">
          <div className="text-slate-500">AI Specification Engine</div>
          <button
            type="button"
            onClick={() => setActiveTab('providers')}
            className="mt-1 w-full text-left font-medium text-slate-200 hover:text-[#3B82F6] truncate cursor-pointer"
          >
            {activeProvider ? activeProvider.name : 'Procedural Ready'}
          </button>
          {activeProvider && (
            <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
              {activeProvider.selectedModel} · {activeProvider.status}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-64 bg-[#121722] h-full border-r border-slate-800 flex flex-col">
            <div className="h-14 px-4 border-b border-slate-800 flex items-center justify-between">
              <span className="font-display text-base font-bold text-slate-50">
                StockForge Studio
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400"
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
                      active
                        ? 'bg-[#3B82F6] text-white'
                        : 'text-slate-400 hover:bg-[#0B0E14]'
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

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 px-6 border-b border-slate-800 bg-[#121722] flex items-center justify-between gap-6 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap truncate">
              <span className="font-medium text-slate-100">StockForge Animation Studio</span>
              <span aria-hidden="true">/</span>
              <span>{currentTabMeta.label}</span>
              {activeProject && activeTab === 'editor' && (
                <>
                  <span aria-hidden="true">/</span>
                  <span className="font-mono text-[#3B82F6] truncate">{activeProject.id}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('qa')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-[#0B0E14] border border-slate-800 hover:border-slate-700 rounded-md cursor-pointer whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>QA Gate</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('new_production')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#3B82F6] hover:bg-blue-500 rounded-md cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Animation</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView onNavigate={setActiveTab} onOpenEditor={handleOpenEditor} />
          )}
          {activeTab === 'new_production' && (
            <NewProductionView
              onOpenEditor={handleOpenEditor}
              onNotify={notify}
              onGoToProviders={() => setActiveTab('providers')}
            />
          )}
          {activeTab === 'editor' && (
            <AnimationEditorView
              initialProject={activeProject}
              onProjectSaved={(saved) => {
                setActiveProject(saved);
                setRefreshTick((t) => t + 1);
              }}
              onNotify={notify}
            />
          )}
          {activeTab === 'batch' && (
            <BatchView
              onNotify={notify}
              onOpenProjectById={(id) => void handleOpenProjectById(id)}
              onOpenProject={handleOpenEditor}
            />
          )}
          {activeTab === 'library' && (
            <LibraryView
              onOpenEditor={handleOpenEditor}
              onNotify={notify}
              refreshTick={refreshTick}
            />
          )}
          {activeTab === 'metadata' && (
            <MetadataEditorView onNotify={notify} refreshTick={refreshTick} />
          )}
          {activeTab === 'export' && <ExportManagerView onNotify={notify} />}
          {activeTab === 'providers' && (
            <ProvidersView
              onNotify={notify}
              onProvidersChanged={() => void refreshProviderBadge()}
            />
          )}
          {activeTab === 'qa' && (
            <QualityControlView
              onOpenEditor={handleOpenEditor}
              onNotify={notify}
              refreshTick={refreshTick}
            />
          )}
          {activeTab === 'diagnostics' && <DiagnosticsView onNotify={notify} />}
        </main>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-[#121722] text-slate-100 text-xs font-medium shadow-xl border border-slate-700"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
