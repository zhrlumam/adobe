import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Layers,
  Pause,
  Play,
  Plus,
  Redo2,
  RefreshCw,
  Save,
  SkipBack,
  SkipForward,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  FPS_OPTIONS,
  RESOLUTIONS,
  api,
  downloadAnimationFormat,
} from '../lib/api';
import type {
  AnimationLayer,
  AnimationLayerType,
  AnimationProject,
  BackgroundMode,
  EasingType,
  FpsOption,
  LayerKeyframe,
  ResolutionPreset,
} from '../types/stockforge';

interface AnimationEditorViewProps {
  initialProject: AnimationProject | null;
  onProjectSaved: (project: AnimationProject) => void;
  onNotify: (msg: string) => void;
}

export const AnimationEditorView: React.FC<AnimationEditorViewProps> = ({
  initialProject,
  onProjectSaved,
  onNotify,
}) => {
  const [projectsList, setProjectsList] = useState<AnimationProject[]>([]);
  const [project, setProject] = useState<AnimationProject | null>(initialProject);
  const [undoStack, setUndoStack] = useState<AnimationProject[]>([]);
  const [redoStack, setRedoStack] = useState<AnimationProject[]>([]);

  const [selectedLayerId, setSelectedLayerId] = useState<string>('');
  const [selectedKfIdx, setSelectedKfIdx] = useState<number>(0);

  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [frameSvg, setFrameSvg] = useState<string>('');
  const [chromaKeyPreview, setChromaKeyPreview] = useState(false);

  const [inspectorTab, setInspectorTab] = useState<'canvas' | 'svg' | 'lottie'>('canvas');
  const [sourceSvg, setSourceSvg] = useState('');
  const [sourceLottie, setSourceLottie] = useState('');

  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);

  const playRafRef = useRef<number | null>(null);
  const lastFrameTsRef = useRef<number | null>(null);

  useEffect(() => {
    void api.listAnimations().then((res) => {
      const list = res.projects ?? [];
      setProjectsList(list);
      if (!project && !initialProject && list.length > 0) {
        loadFullProject(list[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (initialProject) {
      loadFullProject(initialProject);
    }
  }, [initialProject?.id]);

  const loadFullProject = (proj: AnimationProject) => {
    setProject(proj);
    setUndoStack([]);
    setRedoStack([]);
    setSelectedLayerId(proj.layers[0]?.id ?? '');
    setSelectedKfIdx(0);
    setCurrentTime(0);
    setPlaying(false);
    setChromaKeyPreview(false);
    void api
      .getAnimationSource(proj.id)
      .then((src) => {
        setSourceSvg(src.svgAnimated);
        setSourceLottie(JSON.stringify(src.lottieJson, null, 2));
      })
      .catch(() => {});
  };

  const commitChange = (updater: (prev: AnimationProject) => AnimationProject) => {
    if (!project) return;
    setUndoStack((s) => [...s.slice(-24), project]);
    setRedoStack([]);
    setProject(updater(project));
  };

  const handleUndo = () => {
    if (undoStack.length === 0 || !project) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, project]);
    setProject(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !project) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, project]);
    setProject(next);
  };

  // Fetch exact frame SVG from backend engine whenever time or project edits change
  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    void api
      .getFrameSvg(project.id, currentTime, {
        layers: project.layers,
        palette: project.palette,
        backgroundMode: chromaKeyPreview ? 'transparent' : project.backgroundMode,
        backgroundColor: project.backgroundColor,
        durationSec: project.durationSec,
      })
      .then((res) => {
        if (!cancelled) setFrameSvg(res.svg);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    project?.id,
    project?.layers,
    project?.palette,
    project?.backgroundMode,
    project?.backgroundColor,
    project?.durationSec,
    currentTime,
    chromaKeyPreview,
  ]);

  // Real-time timeline playback loop
  useEffect(() => {
    if (!playing || !project) {
      if (playRafRef.current) cancelAnimationFrame(playRafRef.current);
      lastFrameTsRef.current = null;
      return;
    }
    const tick = (ts: number) => {
      if (lastFrameTsRef.current === null) {
        lastFrameTsRef.current = ts;
      }
      const dt = (ts - lastFrameTsRef.current) / 1000;
      if (dt >= 1 / Math.min(24, project.fps)) {
        lastFrameTsRef.current = ts;
        setCurrentTime((prev) => {
          const next = prev + dt;
          return next >= project.durationSec ? 0 : next;
        });
      }
      playRafRef.current = requestAnimationFrame(tick);
    };
    playRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (playRafRef.current) cancelAnimationFrame(playRafRef.current);
    };
  }, [playing, project?.durationSec, project?.fps]);

  if (!project) {
    return (
      <div className="bg-[#121722] border border-slate-800 rounded-lg p-12 text-center text-sm text-slate-400">
        No animation project loaded. Create an animation in New Production first.
      </div>
    );
  }

  const selectedLayer =
    project.layers.find((l) => l.id === selectedLayerId) ?? project.layers[0];
  const selectedKeyframe =
    selectedLayer?.keyframes[selectedKfIdx] ?? selectedLayer?.keyframes[0];

  const updateSelectedLayer = (patch: Partial<AnimationLayer>) => {
    if (!selectedLayer) return;
    commitChange((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === selectedLayer.id ? { ...l, ...patch } : l)),
    }));
  };

  const updateSelectedKeyframe = (patch: Partial<LayerKeyframe>) => {
    if (!selectedLayer || !selectedKeyframe) return;
    commitChange((prev) => ({
      ...prev,
      layers: prev.layers.map((l) =>
        l.id !== selectedLayer.id
          ? l
          : {
              ...l,
              keyframes: l.keyframes.map((kf, idx) =>
                idx === selectedKfIdx ? { ...kf, ...patch } : kf
              ),
            }
      ),
    }));
  };

  const handleAddKeyframeAtPlayhead = () => {
    if (!selectedLayer) return;
    const base = selectedKeyframe ?? {
      time: currentTime,
      x: project.width / 2,
      y: project.height / 2,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      easing: 'easeInOut' as EasingType,
    };
    const nextKf: LayerKeyframe = {
      ...base,
      time: Number(currentTime.toFixed(2)),
    };
    commitChange((prev) => ({
      ...prev,
      layers: prev.layers.map((l) =>
        l.id !== selectedLayer.id
          ? l
          : {
              ...l,
              keyframes: [...l.keyframes, nextKf].sort((a, b) => a.time - b.time),
            }
      ),
    }));
  };

  const handleAddLayer = (type: AnimationLayerType) => {
    const newLayer: AnimationLayer = {
      id: `layer-${Date.now().toString(36)}`,
      name: `New ${type.replace(/_/g, ' ')}`,
      type,
      visible: true,
      opacity: 0.9,
      color: project.palette[0] || '#3B82F6',
      secondaryColor: project.palette[1] || '#38BDF8',
      anchorX: 0,
      anchorY: 0,
      params: {
        count: 14,
        speed: 1.1,
        radius: Math.round(Math.min(project.width, project.height) * 0.08),
        seed: Math.floor(Math.random() * 9000) + 100,
      },
      keyframes: [
        {
          time: 0,
          x: project.width * 0.5,
          y: project.height * 0.5,
          scaleX: 0.9,
          scaleY: 0.9,
          rotation: 0,
          opacity: 0.95,
          easing: 'easeInOut',
          progress: 0,
        },
        {
          time: project.durationSec,
          x: project.width * 0.5,
          y: project.height * 0.5,
          scaleX: 1.05,
          scaleY: 1.05,
          rotation: 45,
          opacity: 0.95,
          easing: 'easeInOut',
          progress: 1,
        },
      ],
    };
    commitChange((prev) => ({
      ...prev,
      layers: [...prev.layers, newLayer],
    }));
    setSelectedLayerId(newLayer.id);
    setSelectedKfIdx(0);
  };

  const handleMoveLayer = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= project.layers.length) return;
    commitChange((prev) => {
      const copy = [...prev.layers];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return { ...prev, layers: copy };
    });
  };

  const handleSave = async (reRender: boolean) => {
    if (reRender) setRendering(true);
    else setSaving(true);
    try {
      const res = await api.updateAnimation(project.id, {
        name: project.name,
        backgroundMode: project.backgroundMode,
        backgroundColor: project.backgroundColor,
        resolution: project.resolution,
        durationSec: project.durationSec,
        fps: project.fps,
        palette: project.palette,
        layers: project.layers,
        reRender,
      });
      setProject(res.project);
      onProjectSaved(res.project);
      const src = await api.getAnimationSource(res.project.id);
      setSourceSvg(src.svgAnimated);
      setSourceLottie(JSON.stringify(src.lottieJson, null, 2));
      onNotify(
        reRender
          ? `Saved & re-rendered ${res.project.id} (QA ${res.project.qaReport?.passed ? 'PASSED' : 'FAILED'})`
          : `Saved editable project ${res.project.id}`
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
      setRendering(false);
    }
  };

  const totalFrames = Math.max(1, Math.round(project.durationSec * project.fps));
  const currentFrame = Math.min(totalFrames, Math.round(currentTime * project.fps) + 1);
  const frameStepSec = 1 / project.fps;

  return (
    <div className="space-y-4">
      {/* Editor Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121722] border border-slate-800 rounded-lg p-3">
        <div className="flex items-center gap-2 min-w-0">
          <select
            value={project.id}
            onChange={(e) => {
              const found = projectsList.find((p) => p.id === e.target.value);
              if (found) loadFullProject(found);
            }}
            className="px-3 py-1.5 text-xs font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded-md max-w-[260px]"
          >
            {[project, ...projectsList.filter((p) => p.id !== project.id)].map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="Undo"
            className="p-1.5 text-slate-300 bg-[#0B0E14] border border-slate-700 rounded hover:border-slate-500 disabled:opacity-40 cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo"
            className="p-1.5 text-slate-300 bg-[#0B0E14] border border-slate-700 rounded hover:border-slate-500 disabled:opacity-40 cursor-pointer"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {project.backgroundMode === 'green_screen' && (
            <button
              type="button"
              onClick={() => setChromaKeyPreview((v) => !v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border cursor-pointer ${
                chromaKeyPreview
                  ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300'
                  : 'bg-[#0B0E14] border-slate-700 text-slate-300'
              }`}
            >
              {chromaKeyPreview ? 'Keying Test: Green Removed' : 'Test Green-Screen Removal'}
            </button>
          )}
          <button
            type="button"
            disabled={saving || rendering}
            onClick={() => void handleSave(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#0B0E14] border border-slate-700 hover:border-slate-500 rounded-md cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Project'}</span>
          </button>
          <button
            type="button"
            disabled={saving || rendering}
            onClick={() => void handleSave(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#3B82F6] hover:bg-blue-500 rounded-md cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rendering ? 'animate-spin' : ''}`} />
            <span>{rendering ? 'Rendering & QA...' : 'Save & Re-Render Video'}</span>
          </button>
          <button
            type="button"
            onClick={() => void downloadAnimationFormat(project.id, 'source_zip')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#0B0E14] border border-slate-700 hover:border-slate-500 rounded-md cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Source ZIP</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Studio Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Layer Stack & Palette */}
        <div className="lg:col-span-3 bg-[#121722] border border-slate-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Layers ({project.layers.length})</span>
            </h2>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) handleAddLayer(e.target.value as AnimationLayerType);
              }}
              className="px-2 py-1 text-[11px] bg-[#0B0E14] text-slate-300 border border-slate-700 rounded cursor-pointer"
            >
              <option value="">+ Add Layer</option>
              <option value="particles">Particles</option>
              <option value="sparkles">Sparkles</option>
              <option value="hud_ring">HUD Ring</option>
              <option value="vector_shape">Vector Shape</option>
              <option value="cursor">Pointer Cursor</option>
              <option value="click_ripple">Click Ripple</option>
            </select>
          </div>

          <div className="space-y-1.5">
            {project.layers.map((layer, idx) => {
              const active = layer.id === selectedLayer?.id;
              return (
                <div
                  key={layer.id}
                  onClick={() => {
                    setSelectedLayerId(layer.id);
                    setSelectedKfIdx(0);
                  }}
                  className={`p-2.5 rounded border text-xs cursor-pointer flex items-center justify-between gap-2 ${
                    active
                      ? 'border-[#3B82F6] bg-blue-950/30 text-slate-100'
                      : 'border-slate-800 bg-[#0B0E14] text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        commitChange((prev) => ({
                          ...prev,
                          layers: prev.layers.map((l) =>
                            l.id === layer.id ? { ...l, visible: !l.visible } : l
                          ),
                        }));
                      }}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      {layer.visible ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </button>
                    <span
                      className="w-3 h-3 rounded-xs shrink-0 border border-white/20"
                      style={{ backgroundColor: layer.color }}
                    />
                    <span className="truncate">{layer.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveLayer(idx, -1);
                      }}
                      className="px-1 text-[10px] text-slate-500 hover:text-slate-200 cursor-pointer"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveLayer(idx, 1);
                      }}
                      className="px-1 text-[10px] text-slate-500 hover:text-slate-200 cursor-pointer"
                    >
                      ↓
                    </button>
                    {project.layers.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          commitChange((prev) => ({
                            ...prev,
                            layers: prev.layers.filter((l) => l.id !== layer.id),
                          }));
                        }}
                        className="text-slate-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Color Palette Editor */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-200">Project Color Palette</div>
            <div className="flex flex-wrap gap-2">
              {project.palette.map((hex, i) => (
                <label key={i} className="flex flex-col items-center gap-1 cursor-pointer">
                  <input
                    type="color"
                    value={hex.startsWith('#') ? hex : '#3B82F6'}
                    onChange={(e) => {
                      const nextHex = e.target.value;
                      commitChange((prev) => ({
                        ...prev,
                        palette: prev.palette.map((c, idx) => (idx === i ? nextHex : c)),
                        layers: prev.layers.map((l, lIdx) =>
                          lIdx === i ? { ...l, color: nextHex } : l
                        ),
                      }));
                    }}
                    className="w-8 h-8 rounded bg-transparent border border-slate-700 cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-slate-500">{hex}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Composition Duration / FPS / Background */}
          <div className="pt-3 border-t border-slate-800 space-y-2.5 text-xs">
            <div className="font-semibold text-slate-200">Composition Settings</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400">Duration (s)</label>
                <input
                  type="number"
                  min={1.5}
                  max={15}
                  step={0.5}
                  value={project.durationSec}
                  onChange={(e) =>
                    commitChange((prev) => ({
                      ...prev,
                      durationSec: Math.min(15, Math.max(1.5, Number(e.target.value) || 3)),
                    }))
                  }
                  className="w-full mt-1 px-2 py-1.5 font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Frame Rate</label>
                <select
                  value={project.fps}
                  onChange={(e) =>
                    commitChange((prev) => ({
                      ...prev,
                      fps: Number(e.target.value) as FpsOption,
                    }))
                  }
                  className="w-full mt-1 px-2 py-1.5 font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
                >
                  {FPS_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f} fps
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Resolution</label>
              <select
                value={project.resolution}
                onChange={(e) => {
                  const res = e.target.value as ResolutionPreset;
                  const [w, h] = res.split('x').map(Number);
                  commitChange((prev) => ({
                    ...prev,
                    resolution: res,
                    width: w,
                    height: h,
                  }));
                }}
                className="w-full mt-1 px-2 py-1.5 font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
              >
                {RESOLUTIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Background</label>
              <select
                value={project.backgroundMode}
                onChange={(e) => {
                  const mode = e.target.value as BackgroundMode;
                  commitChange((prev) => ({
                    ...prev,
                    backgroundMode: mode,
                    backgroundColor:
                      mode === 'green_screen'
                        ? '#00FF00'
                        : mode === 'transparent'
                        ? 'transparent'
                        : '#0B1020',
                  }));
                }}
                className="w-full mt-1 px-2 py-1.5 bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
              >
                <option value="solid">Solid Color</option>
                <option value="green_screen">Green Screen (#00FF00)</option>
                <option value="transparent">Transparent Alpha</option>
              </select>
            </div>
          </div>
        </div>

        {/* Center: Live Canvas & Timeline Scrubber */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#121722] border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {(['canvas', 'svg', 'lottie'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setInspectorTab(t)}
                    className={`px-2.5 py-1 rounded cursor-pointer uppercase font-mono text-[11px] ${
                      inspectorTab === t
                        ? 'bg-[#3B82F6] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                {project.width}×{project.height} · Frame {currentFrame}/{totalFrames} (
                {currentTime.toFixed(2)}s)
              </span>
            </div>

            {inspectorTab === 'canvas' && (
              <div className="aspect-video checkerboard-dark flex items-center justify-center p-2 overflow-hidden">
                {frameSvg ? (
                  <div
                    className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-auto"
                    dangerouslySetInnerHTML={{ __html: frameSvg }}
                  />
                ) : (
                  <span className="text-xs text-slate-500">Rendering frame...</span>
                )}
              </div>
            )}

            {inspectorTab === 'svg' && (
              <pre className="h-[340px] p-4 overflow-auto text-[11px] font-mono text-slate-300 bg-[#0B0E14]">
                {sourceSvg || 'Loading animated SMIL SVG source...'}
              </pre>
            )}

            {inspectorTab === 'lottie' && (
              <pre className="h-[340px] p-4 overflow-auto text-[11px] font-mono text-slate-300 bg-[#0B0E14]">
                {sourceLottie || 'Loading Lottie JSON...'}
              </pre>
            )}

            {/* Playback & Scrubber Controls */}
            <div className="p-4 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setCurrentTime(0);
                    }}
                    className="p-1.5 bg-[#0B0E14] border border-slate-700 rounded text-slate-300 hover:text-white cursor-pointer"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setCurrentTime((t) => Math.max(0, t - frameStepSec));
                    }}
                    className="p-1.5 bg-[#0B0E14] border border-slate-700 rounded text-slate-300 hover:text-white cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlaying((p) => !p)}
                    className="px-3 py-1.5 bg-[#3B82F6] hover:bg-blue-500 rounded text-xs font-medium text-white inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{playing ? 'Pause' : 'Play'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setCurrentTime((t) => Math.min(project.durationSec, t + frameStepSec));
                    }}
                    className="p-1.5 bg-[#0B0E14] border border-slate-700 rounded text-slate-300 hover:text-white cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setCurrentTime(project.durationSec);
                    }}
                    className="p-1.5 bg-[#0B0E14] border border-slate-700 rounded text-slate-300 hover:text-white cursor-pointer"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddKeyframeAtPlayhead}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-200 bg-[#0B0E14] border border-slate-700 hover:border-[#3B82F6] rounded cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Keyframe @ {currentTime.toFixed(2)}s</span>
                </button>
              </div>

              <input
                type="range"
                min={0}
                max={project.durationSec}
                step={0.01}
                value={currentTime}
                onChange={(e) => {
                  setPlaying(false);
                  setCurrentTime(Number(e.target.value));
                }}
                className="w-full accent-[#3B82F6] cursor-pointer"
              />

              {/* Layer Keyframe Track */}
              {selectedLayer && (
                <div className="pt-1">
                  <div className="text-[11px] text-slate-400 mb-1.5">
                    Keyframes for <span className="text-slate-200">{selectedLayer.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedLayer.keyframes.map((kf, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setPlaying(false);
                          setSelectedKfIdx(idx);
                          setCurrentTime(kf.time);
                        }}
                        className={`px-2 py-1 text-[11px] font-mono rounded border cursor-pointer ${
                          idx === selectedKfIdx
                            ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
                            : 'bg-[#0B0E14] border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        ◆ {kf.time.toFixed(2)}s
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Object & Keyframe Inspector */}
        <div className="lg:col-span-3 bg-[#121722] border border-slate-800 rounded-lg p-4 space-y-4">
          {selectedLayer ? (
            <>
              <div className="text-xs font-semibold text-slate-200 border-b border-slate-800 pb-2">
                Layer Inspector
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-400">Layer Name</label>
                  <input
                    type="text"
                    value={selectedLayer.name}
                    onChange={(e) => updateSelectedLayer({ name: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400">Primary Color</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={selectedLayer.color}
                        onChange={(e) => updateSelectedLayer({ color: e.target.value })}
                        className="w-8 h-7 bg-transparent border border-slate-700 rounded cursor-pointer"
                      />
                      <span className="font-mono text-[11px] text-slate-400">
                        {selectedLayer.color}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">Secondary</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={selectedLayer.secondaryColor}
                        onChange={(e) => updateSelectedLayer({ secondaryColor: e.target.value })}
                        className="w-8 h-7 bg-transparent border border-slate-700 rounded cursor-pointer"
                      />
                      <span className="font-mono text-[11px] text-slate-400">
                        {selectedLayer.secondaryColor}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400">Speed</label>
                    <input
                      type="number"
                      min={0.2}
                      max={4}
                      step={0.1}
                      value={selectedLayer.params.speed ?? 1}
                      onChange={(e) =>
                        updateSelectedLayer({
                          params: { ...selectedLayer.params, speed: Number(e.target.value) },
                        })
                      }
                      className="w-full mt-1 px-2 py-1 font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">Count / Density</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={selectedLayer.params.count ?? 12}
                      onChange={(e) =>
                        updateSelectedLayer({
                          params: { ...selectedLayer.params, count: Number(e.target.value) },
                        })
                      }
                      className="w-full mt-1 px-2 py-1 font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
                    />
                  </div>
                </div>

                {selectedLayer.type === 'ui_button' && (
                  <div>
                    <label className="text-[11px] text-slate-400">Button Label</label>
                    <input
                      type="text"
                      value={selectedLayer.params.label ?? ''}
                      onChange={(e) =>
                        updateSelectedLayer({
                          params: { ...selectedLayer.params, label: e.target.value },
                        })
                      }
                      className="w-full mt-1 px-2 py-1 bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
                    />
                  </div>
                )}
              </div>

              {selectedKeyframe && (
                <div className="pt-3 border-t border-slate-800 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">
                      Keyframe #{selectedKfIdx + 1} ({selectedKeyframe.time.toFixed(2)}s)
                    </span>
                    {selectedLayer.keyframes.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          commitChange((prev) => ({
                            ...prev,
                            layers: prev.layers.map((l) =>
                              l.id !== selectedLayer.id
                                ? l
                                : {
                                    ...l,
                                    keyframes: l.keyframes.filter((_, idx) => idx !== selectedKfIdx),
                                  }
                            ),
                          }));
                          setSelectedKfIdx(0);
                        }}
                        className="text-[11px] text-red-400 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400">X Position</label>
                      <input
                        type="number"
                        value={Math.round(selectedKeyframe.x)}
                        onChange={(e) => updateSelectedKeyframe({ x: Number(e.target.value) })}
                        className="w-full mt-1 px-2 py-1 font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">Y Position</label>
                      <input
                        type="number"
                        value={Math.round(selectedKeyframe.y)}
                        onChange={(e) => updateSelectedKeyframe({ y: Number(e.target.value) })}
                        className="w-full mt-1 px-2 py-1 font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">Scale</label>
                      <input
                        type="number"
                        step={0.05}
                        min={0.1}
                        max={4}
                        value={selectedKeyframe.scaleX}
                        onChange={(e) => {
                          const s = Number(e.target.value);
                          updateSelectedKeyframe({ scaleX: s, scaleY: s });
                        }}
                        className="w-full mt-1 px-2 py-1 font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">Rotation (°)</label>
                      <input
                        type="number"
                        value={Math.round(selectedKeyframe.rotation)}
                        onChange={(e) =>
                          updateSelectedKeyframe({ rotation: Number(e.target.value) })
                        }
                        className="w-full mt-1 px-2 py-1 font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">Opacity (0-1)</label>
                      <input
                        type="number"
                        step={0.05}
                        min={0}
                        max={1}
                        value={selectedKeyframe.opacity}
                        onChange={(e) =>
                          updateSelectedKeyframe({ opacity: Number(e.target.value) })
                        }
                        className="w-full mt-1 px-2 py-1 font-mono bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">Easing</label>
                      <select
                        value={selectedKeyframe.easing}
                        onChange={(e) =>
                          updateSelectedKeyframe({ easing: e.target.value as EasingType })
                        }
                        className="w-full mt-1 px-2 py-1 bg-[#0B0E14] text-slate-100 border border-slate-700 rounded"
                      >
                        <option value="linear">Linear</option>
                        <option value="easeIn">Ease In</option>
                        <option value="easeOut">Ease Out</option>
                        <option value="easeInOut">Ease InOut</option>
                        <option value="spring">Spring</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
