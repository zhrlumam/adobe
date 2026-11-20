import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Download,
  FlipHorizontal2,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  BackdropMode,
  BotanicalSpecimen,
  ComposerLayer,
  EarthyPalette,
} from '../types/botanical';
import {
  downloadPngFromSvg,
  downloadSvgFile,
  renderVectorShape,
  shapeToSvgString,
} from './BotanicalSvg';

interface ComposerStudioProps {
  specimens: BotanicalSpecimen[];
  palette: EarthyPalette;
  backdropMode: BackdropMode;
  layers: ComposerLayer[];
  onLayersChange: React.Dispatch<React.SetStateAction<ComposerLayer[]>>;
  onNotify: (message: string) => void;
}

interface PresetArrangement {
  id: string;
  label: string;
  layers: Omit<ComposerLayer, 'uid'>[];
}

const PRESETS: PresetArrangement[] = [
  {
    id: 'meadow-bouquet',
    label: 'Meadow Still Life',
    layers: [
      { specimenId: 'cortaderia-pampas', x: 245, y: 245, scale: 0.92, rotation: -12, flipX: false, opacity: 1 },
      { specimenId: 'eucalyptus-cinerea', x: 355, y: 255, scale: 0.95, rotation: 16, flipX: false, opacity: 1 },
      { specimenId: 'protea-cynaroides', x: 300, y: 285, scale: 1.0, rotation: -3, flipX: false, opacity: 1 },
      { specimenId: 'papaver-rhoeas', x: 230, y: 310, scale: 0.85, rotation: -18, flipX: false, opacity: 1 },
      { specimenId: 'craspedia-globosa', x: 365, y: 305, scale: 0.84, rotation: 14, flipX: true, opacity: 1 },
    ],
  },
  {
    id: 'mediterranean-study',
    label: 'Mediterranean Arch',
    layers: [
      { specimenId: 'olea-europaea', x: 225, y: 270, scale: 0.98, rotation: -14, flipX: false, opacity: 1 },
      { specimenId: 'ginkgo-biloba', x: 375, y: 275, scale: 0.92, rotation: 15, flipX: true, opacity: 1 },
      { specimenId: 'anemone-coronaria', x: 305, y: 295, scale: 0.98, rotation: 4, flipX: false, opacity: 1 },
      { specimenId: 'rosa-canina-hips', x: 265, y: 315, scale: 0.8, rotation: -8, flipX: false, opacity: 1 },
    ],
  },
  {
    id: 'minimal-foliage',
    label: 'Sculptural Foliage',
    layers: [
      { specimenId: 'monstera-deliciosa', x: 265, y: 265, scale: 1.04, rotation: -8, flipX: false, opacity: 1 },
      { specimenId: 'lunaria-annua', x: 355, y: 250, scale: 0.92, rotation: 12, flipX: false, opacity: 1 },
      { specimenId: 'papaver-somniferum-pods', x: 305, y: 310, scale: 0.88, rotation: 4, flipX: false, opacity: 1 },
    ],
  },
];

const CANVAS_W = 600;
const CANVAS_H = 740;

export const ComposerStudio: React.FC<ComposerStudioProps> = ({
  specimens,
  palette,
  backdropMode,
  layers,
  onLayersChange,
  onNotify,
}) => {
  const [selectedUid, setSelectedUid] = useState<string | null>(
    layers[0]?.uid ?? null
  );
  const [canvasBackdrop, setCanvasBackdrop] = useState<BackdropMode | 'transparent'>(
    backdropMode
  );
  const [dragState, setDragState] = useState<{
    uid: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const activeLayer = layers.find((l) => l.uid === selectedUid) || null;

  const getSpecimen = (id: string) =>
    specimens.find((s) => s.id === id) || specimens[0];

  const handleAddSpecimen = (specimen: BotanicalSpecimen) => {
    const uid = `${specimen.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const offset = (layers.length % 5) * 18 - 36;
    const newLayer: ComposerLayer = {
      uid,
      specimenId: specimen.id,
      x: CANVAS_W / 2 + offset,
      y: CANVAS_H / 2 + offset,
      scale: 0.9,
      rotation: 0,
      flipX: false,
      opacity: 1,
    };
    onLayersChange((prev) => [...prev, newLayer]);
    setSelectedUid(uid);
  };

  const handleLoadPreset = (preset: PresetArrangement) => {
    const newLayers: ComposerLayer[] = preset.layers.map((l, idx) => ({
      ...l,
      uid: `preset-${preset.id}-${idx}-${Date.now()}`,
    }));
    onLayersChange(newLayers);
    setSelectedUid(newLayers[newLayers.length - 1]?.uid ?? null);
    onNotify(`Loaded "${preset.label}" arrangement`);
  };

  const updateActiveLayer = (patch: Partial<ComposerLayer>) => {
    if (!selectedUid) return;
    onLayersChange((prev) =>
      prev.map((l) => (l.uid === selectedUid ? { ...l, ...patch } : l))
    );
  };

  const moveLayerOrder = (direction: 'up' | 'down') => {
    if (!selectedUid) return;
    onLayersChange((prev) => {
      const idx = prev.findIndex((l) => l.uid === selectedUid);
      if (idx === -1) return prev;
      const target = direction === 'up' ? idx + 1 : idx - 1;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const duplicateActiveLayer = () => {
    if (!activeLayer) return;
    const uid = `${activeLayer.specimenId}-${Date.now()}`;
    const dup: ComposerLayer = {
      ...activeLayer,
      uid,
      x: activeLayer.x + 24,
      y: activeLayer.y + 18,
    };
    onLayersChange((prev) => [...prev, dup]);
    setSelectedUid(uid);
  };

  const deleteActiveLayer = () => {
    if (!selectedUid) return;
    onLayersChange((prev) => {
      const filtered = prev.filter((l) => l.uid !== selectedUid);
      setSelectedUid(filtered[filtered.length - 1]?.uid ?? null);
      return filtered;
    });
  };

  const handlePointerDown = (
    e: React.PointerEvent<SVGGElement>,
    layer: ComposerLayer
  ) => {
    e.stopPropagation();
    setSelectedUid(layer.uid);
    setDragState({
      uid: layer.uid,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: layer.x,
      origY: layer.y,
    });
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const dx = (e.clientX - dragState.startClientX) * scaleX;
    const dy = (e.clientY - dragState.startClientY) * scaleY;
    onLayersChange((prev) =>
      prev.map((l) =>
        l.uid === dragState.uid
          ? {
              ...l,
              x: Math.round(Math.max(40, Math.min(CANVAS_W - 40, dragState.origX + dx))),
              y: Math.round(Math.max(40, Math.min(CANVAS_H - 40, dragState.origY + dy))),
            }
          : l
      )
    );
  };

  const handlePointerUp = () => {
    setDragState(null);
  };

  const buildComposedSvg = (): string => {
    const bgHex =
      canvasBackdrop === 'transparent'
        ? null
        : canvasBackdrop === 'charcoal'
        ? palette.backdropDark
        : canvasBackdrop === 'limestone'
        ? palette.backdropWarm
        : palette.backdropLight;

    const layersMarkup = layers
      .map((layer) => {
        const spec = getSpecimen(layer.specimenId);
        const flip = layer.flipX ? -1 : 1;
        const transform = `translate(${layer.x}, ${layer.y}) rotate(${layer.rotation}) scale(${
          layer.scale * flip
        }, ${layer.scale}) translate(-140, -180)`;
        const shapesStr = spec.shapes
          .map((s) => '    ' + shapeToSvgString(s, palette))
          .join('\n');
        return `  <g transform="${transform}" opacity="${layer.opacity}">\n${shapesStr}\n  </g>`;
      })
      .join('\n');

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" width="1200" height="1480">`,
      bgHex ? `  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="${bgHex}" />` : null,
      layersMarkup,
      `</svg>`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleExportSvg = () => {
    const svg = buildComposedSvg();
    downloadSvgFile(`botanical-composition-${palette.id}.svg`, svg);
    onNotify('Downloaded custom SVG botanical composition');
  };

  const handleExportPng = async () => {
    const svg = buildComposedSvg();
    await downloadPngFromSvg(`botanical-composition-${palette.id}.png`, svg, 1500, 1850);
    onNotify('Exported custom PNG print (1500 × 1850)');
  };

  const effectiveBg =
    canvasBackdrop === 'transparent'
      ? undefined
      : canvasBackdrop === 'charcoal'
      ? palette.backdropDark
      : canvasBackdrop === 'limestone'
      ? palette.backdropWarm
      : palette.backdropLight;

  const effectiveBackdropMode: BackdropMode =
    canvasBackdrop === 'charcoal' ? 'charcoal' : 'ivory';

  return (
    <section className="max-w-[1360px] mx-auto px-6 lg:px-10 py-12">
      {/* Header row */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-[#E6E0D4]">
        <div>
          <p className="text-xs font-medium tracking-[0.14em] uppercase text-[#78716C]">
            Arrangement Studio
          </p>
          <h2 className="font-serif text-3xl lg:text-4xl font-medium text-[#1C1917] mt-1">
            Isolated Composition Builder
          </h2>
          <p className="text-sm text-[#57534E] mt-2 max-w-2xl">
            Combine leaves, flowers, and dried botanicals onto an isolated print canvas. Drag any
            element directly on the artboard, adjust rotation or scale, and export clean vector art.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleLoadPreset(preset)}
              className="px-3 py-1.5 text-xs font-medium text-[#44403C] bg-[#F3EFE7] hover:bg-[#E7E0D3] rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3-Column Studio Workspace */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Botanical Specimen Tray */}
        <div className="lg:col-span-3 border border-[#E6E0D4] rounded-xl bg-[#FCFBF8] p-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE0]">
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-[#57534E]">
              Add Specimens
            </h3>
            <span className="font-mono text-[11px] text-[#78716C] tabular-nums">
              {specimens.length} Plates
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 max-h-[540px] overflow-y-auto pr-1">
            {specimens.map((spec) => (
              <button
                key={spec.id}
                type="button"
                onClick={() => handleAddSpecimen(spec)}
                title={`Add ${spec.commonName}`}
                className="group flex flex-col items-center p-2 rounded-lg border border-[#ECE6DB] bg-white hover:border-[#9C523B] transition-colors cursor-pointer"
              >
                <div className="w-full aspect-[7/9]">
                  <svg viewBox="0 0 280 360" className="w-full h-full">
                    {spec.shapes.map((s, idx) => renderVectorShape(s, palette, idx))}
                  </svg>
                </div>
                <span className="mt-1 text-[10px] text-[#57534E] group-hover:text-[#1C1917] truncate w-full text-center">
                  {spec.commonName.split(' ').slice(-1)[0]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Center: Interactive Composition Artboard */}
        <div className="lg:col-span-6 flex flex-col items-center">
          {/* Paper & Export Bar */}
          <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-1 p-1 bg-[#EFEAE0] rounded-lg">
              {(['ivory', 'limestone', 'charcoal', 'transparent'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCanvasBackdrop(mode)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer whitespace-nowrap ${
                    canvasBackdrop === mode
                      ? 'bg-white text-[#1C1917] shadow-xs'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportSvg}
                disabled={layers.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#292524] hover:bg-[#9C523B] disabled:opacity-40 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>SVG</span>
              </button>
              <button
                type="button"
                onClick={handleExportPng}
                disabled={layers.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#292524] disabled:opacity-40 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>PNG</span>
              </button>
            </div>
          </div>

          {/* Artboard Frame */}
          <div
            className={`w-full max-w-[540px] aspect-[600/740] rounded-xl border border-[#DFD8CA] overflow-hidden shadow-xs relative select-none ${
              canvasBackdrop === 'transparent'
                ? 'bg-[radial-gradient(#d6cebe_1px,transparent_1px)] [background-size:16px_16px] bg-white'
                : ''
            }`}
            style={effectiveBg ? { backgroundColor: effectiveBg } : undefined}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
              className="w-full h-full touch-none"
              onClick={() => setSelectedUid(null)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              {layers.map((layer) => {
                const spec = getSpecimen(layer.specimenId);
                const flip = layer.flipX ? -1 : 1;
                const isSelected = layer.uid === selectedUid;
                const transform = `translate(${layer.x}, ${layer.y}) rotate(${layer.rotation}) scale(${
                  layer.scale * flip
                }, ${layer.scale}) translate(-140, -180)`;

                return (
                  <g
                    key={layer.uid}
                    transform={transform}
                    opacity={layer.opacity}
                    onPointerDown={(e) => handlePointerDown(e, layer)}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    {/* Invisible wider hit box for smooth dragging */}
                    <rect x="20" y="20" width="240" height="320" fill="transparent" />
                    {spec.shapes.map((s, idx) =>
                      renderVectorShape(s, palette, idx, false, effectiveBackdropMode)
                    )}
                    {isSelected && (
                      <rect
                        x="18"
                        y="18"
                        width="244"
                        height="324"
                        fill="none"
                        stroke="#9C523B"
                        strokeWidth="1.8"
                        strokeDasharray="6 4"
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {layers.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
                <p className="font-serif text-2xl text-[#57534E]">Empty Artboard</p>
                <p className="text-xs text-[#78716C] mt-1 max-w-xs">
                  Click any botanical specimen on the left or choose a preset arrangement above.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Active Layer Inspector */}
        <div className="lg:col-span-3 border border-[#E6E0D4] rounded-xl bg-[#FCFBF8] p-4 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#EFEAE0]">
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-[#57534E]">
              Layer Inspector
            </h3>
            {layers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onLayersChange([]);
                  setSelectedUid(null);
                }}
                className="text-xs text-[#78716C] hover:text-[#9C523B] cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          {activeLayer ? (
            <div className="space-y-4">
              <div>
                <p className="font-serif text-xl font-medium text-[#1C1917]">
                  {getSpecimen(activeLayer.specimenId).commonName}
                </p>
                <p className="text-xs italic text-[#78716C]">
                  {getSpecimen(activeLayer.specimenId).latinName}
                </p>
              </div>

              {/* Scale */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#57534E]">Scale</span>
                  <span className="font-mono text-[#1C1917] tabular-nums">
                    {activeLayer.scale.toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="1.7"
                  step="0.02"
                  value={activeLayer.scale}
                  onChange={(e) => updateActiveLayer({ scale: parseFloat(e.target.value) })}
                  className="w-full accent-[#9C523B] cursor-pointer"
                />
              </div>

              {/* Rotation */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#57534E]">Rotation</span>
                  <span className="font-mono text-[#1C1917] tabular-nums">
                    {activeLayer.rotation}°
                  </span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={activeLayer.rotation}
                  onChange={(e) => updateActiveLayer({ rotation: parseInt(e.target.value, 10) })}
                  className="w-full accent-[#9C523B] cursor-pointer"
                />
              </div>

              {/* Opacity */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#57534E]">Opacity</span>
                  <span className="font-mono text-[#1C1917] tabular-nums">
                    {Math.round(activeLayer.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="1"
                  step="0.05"
                  value={activeLayer.opacity}
                  onChange={(e) => updateActiveLayer({ opacity: parseFloat(e.target.value) })}
                  className="w-full accent-[#9C523B] cursor-pointer"
                />
              </div>

              {/* Quick Layer Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => updateActiveLayer({ flipX: !activeLayer.flipX })}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded border transition-colors cursor-pointer ${
                    activeLayer.flipX
                      ? 'bg-[#292524] text-white border-[#292524]'
                      : 'bg-white text-[#44403C] border-[#D6CEBE] hover:border-[#292524]'
                  }`}
                >
                  <FlipHorizontal2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Flip X</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateActiveLayer({ rotation: 0, scale: 0.9 })}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded border border-[#D6CEBE] bg-white text-[#44403C] hover:border-[#292524] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={() => moveLayerOrder('up')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded border border-[#D6CEBE] bg-white text-[#44403C] hover:border-[#292524] transition-colors cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Forward</span>
                </button>
                <button
                  type="button"
                  onClick={() => moveLayerOrder('down')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded border border-[#D6CEBE] bg-white text-[#44403C] hover:border-[#292524] transition-colors cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Backward</span>
                </button>
                <button
                  type="button"
                  onClick={duplicateActiveLayer}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded border border-[#D6CEBE] bg-white text-[#44403C] hover:border-[#292524] transition-colors cursor-pointer"
                >
                  <CopyPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Duplicate</span>
                </button>
                <button
                  type="button"
                  onClick={deleteActiveLayer}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded border border-[#E6D4CE] bg-white text-[#9C523B] hover:bg-[#9C523B] hover:text-white transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#78716C] leading-relaxed">
              Click any botanical element on the canvas to adjust its scale, angle, horizontal
              orientation, or layer depth.
            </p>
          )}

          {/* Layer Stack List */}
          {layers.length > 0 && (
            <div className="pt-4 border-t border-[#EFEAE0]">
              <p className="text-[11px] font-medium text-[#78716C] mb-2">
                Active Layers ({layers.length})
              </p>
              <div className="space-y-1 max-h-[180px] overflow-y-auto">
                {[...layers].reverse().map((layer) => {
                  const spec = getSpecimen(layer.specimenId);
                  const isSelected = layer.uid === selectedUid;
                  return (
                    <button
                      key={layer.uid}
                      type="button"
                      onClick={() => setSelectedUid(layer.uid)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#292524] text-[#FAF8F4]'
                          : 'bg-white border border-[#ECE6DB] text-[#44403C] hover:border-[#B8AEA0]'
                      }`}
                    >
                      <span className="truncate">{spec.commonName}</span>
                      <span className="font-mono text-[10px] opacity-70 tabular-nums ml-2">
                        PL.{spec.plateNumber}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
