import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, Eye, Layers, X, ZoomIn, ZoomOut } from 'lucide-react';
import { BackdropMode, BotanicalSpecimen, EarthyPalette, PaletteRole } from '../types/botanical';
import {
  BotanicalSvg,
  downloadPngFromSvg,
  downloadSvgFile,
  getSpecimenUsedRoles,
  serializeSpecimenSvg,
} from './BotanicalSvg';

interface SpecimenModalProps {
  specimen: BotanicalSpecimen | null;
  palette: EarthyPalette;
  initialBackdrop: BackdropMode;
  onClose: () => void;
  onAddToComposer: (specimen: BotanicalSpecimen) => void;
  onNotify: (message: string) => void;
}

const ROLE_LABELS: Record<PaletteRole, string> = {
  stem: 'Stem & Twig',
  leafPrimary: 'Primary Foliage',
  leafSecondary: 'Sunlit Foliage',
  leafShadow: 'Shaded Foliage',
  petalPrimary: 'Primary Petal',
  petalSecondary: 'Highlight Petal',
  petalAccent: 'Deep Bract / Petal',
  center: 'Floret Center',
  vein: 'Vein & Highlight',
  berry: 'Berry / Rosehip',
};

export const SpecimenModal: React.FC<SpecimenModalProps> = ({
  specimen,
  palette,
  initialBackdrop,
  onClose,
  onAddToComposer,
  onNotify,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [backdrop, setBackdrop] = useState<BackdropMode>(initialBackdrop);
  const [copiedSvg, setCopiedSvg] = useState<boolean>(false);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  useEffect(() => {
    setBackdrop(initialBackdrop);
    setZoom(1);
    setWireframe(false);
  }, [specimen?.id, initialBackdrop]);

  useEffect(() => {
    if (!specimen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [specimen, onClose]);

  if (!specimen) return null;

  const backdropBg =
    backdrop === 'charcoal'
      ? palette.backdropDark
      : backdrop === 'limestone'
      ? palette.backdropWarm
      : palette.backdropLight;

  const usedRoles = getSpecimenUsedRoles(specimen);

  const handleCopySvg = async () => {
    const svg = serializeSpecimenSvg(specimen, palette);
    await navigator.clipboard.writeText(svg);
    setCopiedSvg(true);
    onNotify(`Copied ${specimen.commonName} SVG markup`);
    setTimeout(() => setCopiedSvg(false), 1800);
  };

  const handleDownloadSvg = () => {
    const svg = serializeSpecimenSvg(specimen, palette, backdropBg);
    downloadSvgFile(`${specimen.id}-${palette.id}.svg`, svg);
    onNotify(`Downloaded ${specimen.id}.svg`);
  };

  const handleDownloadPng = async () => {
    const svg = serializeSpecimenSvg(specimen, palette, backdropBg);
    await downloadPngFromSvg(`${specimen.id}-${palette.id}.png`, svg, 1400, 1800);
    onNotify(`Exported ${specimen.id}.png (1400 × 1800)`);
  };

  const handleCopyHex = async (hex: string) => {
    await navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    onNotify(`Copied ${hex}`);
    setTimeout(() => setCopiedHex(null), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-specimen-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-[#FAF8F4] border border-[#DFD8CA] rounded-xl overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-12 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Isolated Specimen Canvas Viewer */}
        <div className="lg:col-span-7 flex flex-col border-b lg:border-b-0 lg:border-r border-[#E6E0D4]">
          {/* Viewer toolbar */}
          <div className="px-5 py-3 border-b border-[#E6E0D4] bg-[#F5F1EA] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setBackdrop('ivory')}
                className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer whitespace-nowrap ${
                  backdrop === 'ivory'
                    ? 'bg-[#292524] text-[#FAF8F4]'
                    : 'text-[#57534E] hover:bg-[#E7E0D3]'
                }`}
              >
                Ivory
              </button>
              <button
                type="button"
                onClick={() => setBackdrop('limestone')}
                className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer whitespace-nowrap ${
                  backdrop === 'limestone'
                    ? 'bg-[#292524] text-[#FAF8F4]'
                    : 'text-[#57534E] hover:bg-[#E7E0D3]'
                }`}
              >
                Limestone
              </button>
              <button
                type="button"
                onClick={() => setBackdrop('charcoal')}
                className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer whitespace-nowrap ${
                  backdrop === 'charcoal'
                    ? 'bg-[#292524] text-[#FAF8F4]'
                    : 'text-[#57534E] hover:bg-[#E7E0D3]'
                }`}
              >
                Charcoal
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWireframe((w) => !w)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer whitespace-nowrap ${
                  wireframe
                    ? 'bg-[#9C523B] text-white border-[#9C523B]'
                    : 'bg-white text-[#44403C] border-[#D6CEBE] hover:border-[#292524]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Wireframe</span>
              </button>
              <div className="flex items-center border border-[#D6CEBE] rounded bg-white">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))}
                  className="p-1.5 text-[#57534E] hover:text-[#1C1917] cursor-pointer"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-[11px] font-mono text-[#44403C] tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2, +(z + 0.25).toFixed(2)))}
                  className="p-1.5 text-[#57534E] hover:text-[#1C1917] cursor-pointer"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Specimen canvas */}
          <div
            className="flex-1 min-h-[380px] lg:min-h-[520px] flex items-center justify-center p-8 overflow-hidden transition-colors duration-200"
            style={{ backgroundColor: backdropBg }}
          >
            <div
              className="w-full max-w-[300px] aspect-[7/9] transition-transform duration-200 ease-out"
              style={{ transform: `scale(${zoom})` }}
            >
              <BotanicalSvg
                specimen={specimen}
                palette={palette}
                wireframe={wireframe}
                showCropMarks
                backdropMode={backdrop}
              />
            </div>
          </div>
        </div>

        {/* Right: Accession Metadata & Export Panel */}
        <div className="lg:col-span-5 p-6 lg:p-8 flex flex-col justify-between bg-[#FAF8F4]">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-[#78716C] tabular-nums">
                  PLATE {specimen.plateNumber} · {specimen.category.toUpperCase()}
                </p>
                <h2
                  id="modal-specimen-title"
                  className="font-serif text-3xl font-medium text-[#1C1917] mt-1"
                >
                  {specimen.commonName}
                </h2>
                <p className="text-sm italic text-[#6B655E] mt-0.5">{specimen.latinName}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-md text-[#78716C] hover:text-[#1C1917] hover:bg-[#EFEAE0] transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-[#57534E]">{specimen.description}</p>

            {/* Accession Metadata Grid */}
            <dl className="mt-6 border-t border-[#E6E0D4] divide-y divide-[#E6E0D4] text-sm">
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-[#78716C]">Botanical Family</dt>
                <dd className="font-medium text-[#1C1917]">{specimen.family}</dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-[#78716C]">Origin</dt>
                <dd className="font-medium text-[#1C1917]">{specimen.origin}</dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-[#78716C]">Artboard Scale</dt>
                <dd className="font-mono text-xs text-[#1C1917] tabular-nums">280 × 360 px</dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-[#78716C]">Vector Elements</dt>
                <dd className="font-mono text-xs text-[#1C1917] tabular-nums">
                  {specimen.shapes.length} Clean Primitives
                </dd>
              </div>
            </dl>

            {/* Earthy Palette Breakdown */}
            <div className="mt-6">
              <p className="text-xs font-medium text-[#78716C] mb-2.5">
                Pigments Used ({palette.name})
              </p>
              <div className="grid grid-cols-2 gap-2">
                {usedRoles.map((role) => {
                  const hex = palette.colors[role];
                  const isCopied = copiedHex === hex;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleCopyHex(hex)}
                      className="flex items-center gap-2.5 p-2 rounded border border-[#E6E0D4] bg-white hover:border-[#B8AEA0] text-left transition-colors cursor-pointer"
                    >
                      <span
                        className="w-5 h-5 rounded-sm shrink-0 border border-black/10"
                        style={{ backgroundColor: hex }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-[#1C1917] truncate">
                          {ROLE_LABELS[role]}
                        </p>
                        <p className="text-[10px] font-mono text-[#78716C] uppercase">
                          {isCopied ? 'Copied' : hex}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 pt-5 border-t border-[#E6E0D4] space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-[#292524] hover:bg-[#9C523B] rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Download SVG</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPng}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#292524] rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Export PNG</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCopySvg}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-[#44403C] bg-[#F3EFE7] hover:bg-[#E7E0D3] rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedSvg ? (
                  <Check className="w-3.5 h-3.5 text-[#586752]" aria-hidden="true" />
                ) : (
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>{copiedSvg ? 'Copied SVG' : 'Copy SVG Code'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddToComposer(specimen);
                  onClose();
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-[#9C523B] bg-[#9C523B]/10 hover:bg-[#9C523B]/20 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add to Composer</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
