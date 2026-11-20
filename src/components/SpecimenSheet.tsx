import React from 'react';
import { Download } from 'lucide-react';
import { BackdropMode, BotanicalSpecimen, EarthyPalette } from '../types/botanical';
import {
  BotanicalSvg,
  downloadPngFromSvg,
  downloadSvgFile,
  shapeToSvgString,
} from './BotanicalSvg';

interface SpecimenSheetProps {
  specimens: BotanicalSpecimen[];
  palette: EarthyPalette;
  backdropMode: BackdropMode;
  onSelectSpecimen: (specimen: BotanicalSpecimen) => void;
  onNotify: (message: string) => void;
}

export function buildPosterSvgString(
  specimens: BotanicalSpecimen[],
  palette: EarthyPalette,
  backdropMode: BackdropMode
): string {
  const cols = 6;
  const cellW = 280;
  const cellH = 390;
  const padX = 72;
  const padTop = 136;
  const padBottom = 72;
  const totalW = padX * 2 + cols * cellW;
  const rows = Math.ceil(specimens.length / cols);
  const totalH = padTop + rows * cellH + padBottom;

  const bg =
    backdropMode === 'charcoal'
      ? palette.backdropDark
      : backdropMode === 'limestone'
      ? palette.backdropWarm
      : palette.backdropLight;
  const textPrimary = backdropMode === 'charcoal' ? '#FAF8F4' : '#1C1917';
  const textMuted = backdropMode === 'charcoal' ? '#B8B0A4' : '#78716C';
  const ruleColor = backdropMode === 'charcoal' ? 'rgba(255,255,255,0.12)' : 'rgba(28,25,23,0.12)';

  const items = specimens
    .map((spec, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = padX + col * cellW;
      const y = padTop + row * cellH;
      const shapesMarkup = spec.shapes.map((s) => '    ' + shapeToSvgString(s, palette)).join('\n');
      return [
        `  <g transform="translate(${x}, ${y})">`,
        `    <rect x="8" y="8" width="${cellW - 16}" height="${cellH - 16}" fill="none" stroke="${ruleColor}" stroke-width="1" />`,
        shapesMarkup,
        `    <text x="24" y="${cellH - 36}" font-family="Georgia, serif" font-size="14" fill="${textPrimary}">${spec.commonName}</text>`,
        `    <text x="24" y="${cellH - 20}" font-family="sans-serif" font-size="10" font-style="italic" fill="${textMuted}">${spec.plateNumber} · ${spec.latinName}</text>`,
        `  </g>`,
      ].join('\n');
    })
    .join('\n');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">`,
    `  <rect width="${totalW}" height="${totalH}" fill="${bg}" />`,
    `  <text x="${padX}" y="66" font-family="Georgia, serif" font-size="34" fill="${textPrimary}">Herbarium Atelier — Modern Botanical Vector Collection</text>`,
    `  <text x="${padX}" y="94" font-family="sans-serif" font-size="13" fill="${textMuted}">18 Isolated Botanical Plates · Palette: ${palette.name}</text>`,
    `  <line x1="${padX}" y1="112" x2="${totalW - padX}" y2="112" stroke="${ruleColor}" stroke-width="1" />`,
    items,
    `</svg>`,
  ].join('\n');
}

export const SpecimenSheet: React.FC<SpecimenSheetProps> = ({
  specimens,
  palette,
  backdropMode,
  onSelectSpecimen,
  onNotify,
}) => {
  const sheetBg =
    backdropMode === 'charcoal'
      ? palette.backdropDark
      : backdropMode === 'limestone'
      ? palette.backdropWarm
      : palette.backdropLight;

  const isDark = backdropMode === 'charcoal';

  const handleDownloadPosterSvg = () => {
    const svg = buildPosterSvgString(specimens, palette, backdropMode);
    downloadSvgFile(`herbarium-atelier-sheet-${palette.id}.svg`, svg);
    onNotify('Downloaded full 18-plate SVG specimen sheet');
  };

  const handleDownloadPosterPng = async () => {
    const svg = buildPosterSvgString(specimens, palette, backdropMode);
    await downloadPngFromSvg(`herbarium-atelier-sheet-${palette.id}.png`, svg, 2400, 1850);
    onNotify('Exported full 18-plate PNG poster (2400 × 1850)');
  };

  return (
    <section className="max-w-[1360px] mx-auto px-6 lg:px-10 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[#E6E0D4]">
        <div>
          <p className="text-xs font-medium tracking-[0.14em] uppercase text-[#78716C]">
            Collector Contact Sheet
          </p>
          <h2 className="font-serif text-3xl lg:text-4xl font-medium text-[#1C1917] mt-1">
            Cohesive 18-Plate Botanical Index
          </h2>
          <p className="text-sm text-[#57534E] mt-2 max-w-2xl">
            Every specimen shares a consistent stroke scale, Bezier curvature discipline, and warm
            earthy pigment system so leaves, flowers, and dried pods pair effortlessly together.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDownloadPosterSvg}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#292524] hover:bg-[#9C523B] rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Download Poster SVG</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPosterPng}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#292524] rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export Poster PNG</span>
          </button>
        </div>
      </div>

      {/* Framed Contact Sheet Poster */}
      <div
        className="mt-8 rounded-xl border p-6 sm:p-10 transition-colors duration-200"
        style={{
          backgroundColor: sheetBg,
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E2DBD0',
        }}
      >
        <div
          className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-5 mb-6 border-b"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E6E0D4' }}
        >
          <h3
            className="font-serif text-2xl font-medium"
            style={{ color: isDark ? '#FAF8F4' : '#1C1917' }}
          >
            Flora &amp; Foliage Monograph — {palette.name}
          </h3>
          <span
            className="font-mono text-xs tabular-nums"
            style={{ color: isDark ? '#B8B0A4' : '#78716C' }}
          >
            PLATES 01–18 · ISOLATED VECTOR ARCHIVE
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {specimens.map((specimen) => (
            <button
              key={specimen.id}
              type="button"
              onClick={() => onSelectSpecimen(specimen)}
              className={`group flex flex-col justify-between p-3 rounded-lg border text-left transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9C523B] ${
                isDark
                  ? 'border-white/10 hover:border-white/30 bg-white/[0.02]'
                  : 'border-[#E6E0D4] hover:border-[#9C523B]/60 bg-black/[0.01]'
              }`}
            >
              <div className="w-full aspect-[7/9] flex items-center justify-center transition-transform duration-200 group-hover:scale-[1.04]">
                <BotanicalSvg
                  specimen={specimen}
                  palette={palette}
                  backdropMode={backdropMode}
                />
              </div>
              <div className="mt-2 pt-2 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#ECE6DB' }}>
                <p
                  className="font-serif text-sm font-medium truncate"
                  style={{ color: isDark ? '#FAF8F4' : '#1C1917' }}
                >
                  {specimen.commonName}
                </p>
                <p
                  className="font-mono text-[10px] truncate tabular-nums mt-0.5"
                  style={{ color: isDark ? '#A8A095' : '#78716C' }}
                >
                  {specimen.plateNumber} · {specimen.latinName}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
