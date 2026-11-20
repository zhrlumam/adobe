import React from 'react';
import { Check, Copy } from 'lucide-react';
import { EarthyPalette, PaletteRole } from '../types/botanical';

interface PaletteGuideProps {
  palettes: EarthyPalette[];
  activePalette: EarthyPalette;
  onSelectPalette: (palette: EarthyPalette) => void;
  onNotify: (message: string) => void;
}

const TOKEN_ORDER: { role: PaletteRole; label: string }[] = [
  { role: 'petalPrimary', label: 'Primary Petal' },
  { role: 'petalSecondary', label: 'Highlight Petal' },
  { role: 'petalAccent', label: 'Deep Bract' },
  { role: 'leafPrimary', label: 'Primary Foliage' },
  { role: 'leafSecondary', label: 'Sunlit Foliage' },
  { role: 'leafShadow', label: 'Shaded Foliage' },
  { role: 'stem', label: 'Stem & Twig' },
  { role: 'center', label: 'Floret Center' },
  { role: 'berry', label: 'Berry Accent' },
  { role: 'vein', label: 'Vein Highlight' },
];

export const PaletteGuide: React.FC<PaletteGuideProps> = ({
  palettes,
  activePalette,
  onSelectPalette,
  onNotify,
}) => {
  const handleCopyCssTokens = async (palette: EarthyPalette) => {
    const css = [
      `/* ${palette.name} — Herbarium Atelier */`,
      `:root {`,
      ...TOKEN_ORDER.map(
        (t) => `  --botanical-${t.role.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}: ${palette.colors[t.role]};`
      ),
      `  --paper-ivory: ${palette.backdropLight};`,
      `  --paper-limestone: ${palette.backdropWarm};`,
      `  --paper-charcoal: ${palette.backdropDark};`,
      `}`,
    ].join('\n');
    await navigator.clipboard.writeText(css);
    onNotify(`Copied CSS variables for ${palette.name}`);
  };

  const handleCopyHex = async (hex: string) => {
    await navigator.clipboard.writeText(hex);
    onNotify(`Copied ${hex}`);
  };

  return (
    <section className="max-w-[1360px] mx-auto px-6 lg:px-10 py-12">
      <div className="pb-8 border-b border-[#E6E0D4]">
        <p className="text-xs font-medium tracking-[0.14em] uppercase text-[#78716C]">
          Color System
        </p>
        <h2 className="font-serif text-3xl lg:text-4xl font-medium text-[#1C1917] mt-1">
          Warm Earthy Palette Architecture
        </h2>
        <p className="text-sm text-[#57534E] mt-2 max-w-2xl">
          Each palette maps ten semantic botanical roles—from sunlit clay petals to shaded olive
          foliage—so all 18 isolated illustrations remain harmonious across light, limestone, and
          charcoal surfaces.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {palettes.map((palette) => {
          const isActive = palette.id === activePalette.id;
          return (
            <div
              key={palette.id}
              className={`rounded-xl border p-6 transition-colors ${
                isActive
                  ? 'border-[#9C523B] bg-[#FCFBF8]'
                  : 'border-[#E6E0D4] bg-[#FAF8F4]'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-serif text-2xl font-medium text-[#1C1917]">
                    {palette.name}
                  </h3>
                  <p className="text-xs text-[#6B655E] mt-1">{palette.subtitle}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyCssTokens(palette)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#44403C] bg-white border border-[#D6CEBE] hover:border-[#292524] rounded-md transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>CSS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectPalette(palette)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#9C523B] text-white'
                        : 'bg-[#292524] text-[#FAF8F4] hover:bg-[#9C523B]'
                    }`}
                  >
                    {isActive && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                    <span>{isActive ? 'Active' : 'Apply'}</span>
                  </button>
                </div>
              </div>

              {/* 10 Semantic Pigment Swatches */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {TOKEN_ORDER.map((token) => {
                  const hex = palette.colors[token.role];
                  return (
                    <button
                      key={token.role}
                      type="button"
                      onClick={() => handleCopyHex(hex)}
                      title={`Copy ${hex}`}
                      className="group text-left rounded-lg border border-[#E6E0D4] bg-white p-2 hover:border-[#292524] transition-colors cursor-pointer"
                    >
                      <div
                        className="w-full h-10 rounded-sm border border-black/5"
                        style={{ backgroundColor: hex }}
                      />
                      <p className="mt-2 text-[11px] font-medium text-[#1C1917] truncate">
                        {token.label}
                      </p>
                      <p className="text-[10px] font-mono text-[#78716C] uppercase group-hover:text-[#9C523B]">
                        {hex}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
