import React from 'react';
import { ArrowRight, Layers } from 'lucide-react';
import { BotanicalSpecimen, EarthyPalette } from '../types/botanical';
import { BotanicalSvg } from './BotanicalSvg';

interface HeroSectionProps {
  featuredSpecimens: BotanicalSpecimen[];
  palette: EarthyPalette;
  onSelectSpecimen: (specimen: BotanicalSpecimen) => void;
  onBrowseCollection: () => void;
  onOpenComposer: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  featuredSpecimens,
  palette,
  onSelectSpecimen,
  onBrowseCollection,
  onOpenComposer,
}) => {
  return (
    <section className="border-b border-[#E6E0D4] bg-[#FAF8F4]">
      <div className="max-w-[1360px] mx-auto px-6 lg:px-10 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          {/* Left editorial column */}
          <div className="lg:col-span-5 flex flex-col justify-between py-2">
            <div>
              <p className="text-xs font-medium tracking-[0.16em] uppercase text-[#78716C] mb-4">
                Plate Series I · Warm Earthy Botanicals
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-[3.4rem] leading-[1.05] font-medium text-[#1C1917] tracking-tight [text-wrap:balance]">
                Modern Botanical Leaves &amp; Flowers
              </h1>
              <p className="mt-5 text-[15px] leading-relaxed text-[#57534E] max-w-lg">
                A cohesive archival collection of 18 flat-vector botanical plates crafted on a unified
                isolated composition grid. Clean Bezier silhouettes, tonal leaf planes, and warm
                earthy pigments ready for print, editorial layouts, or custom botanical arrangements.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onBrowseCollection}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[#FAF8F4] bg-[#292524] hover:bg-[#9C523B] transition-colors duration-150 rounded-md whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#9C523B]"
                >
                  <span>Browse 18 Plates</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onOpenComposer}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[#292524] bg-transparent border border-[#D6CEBE] hover:border-[#292524] hover:bg-[#F3EFE7] transition-colors duration-150 rounded-md whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9C523B]"
                >
                  <Layers className="w-4 h-4" aria-hidden="true" />
                  <span>Arrange Composition</span>
                </button>
              </div>
            </div>

            {/* Active palette indicator (clean unboxed text + swatches) */}
            <div className="mt-10 pt-6 border-t border-[#E6E0D4] flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-[#78716C]">Active Earthy Palette</p>
                <p className="text-sm font-medium text-[#1C1917] mt-0.5">{palette.name}</p>
              </div>
              <div className="flex items-center gap-1.5" aria-label={`Colors in ${palette.name}`}>
                {[
                  palette.colors.petalPrimary,
                  palette.colors.petalSecondary,
                  palette.colors.leafPrimary,
                  palette.colors.leafShadow,
                  palette.colors.stem,
                ].map((hex, i) => (
                  <span
                    key={i}
                    className="w-5 h-5 rounded-sm border border-black/10"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right featured isolated triptych showcase */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="grid grid-cols-3 gap-4 lg:gap-5 h-full min-h-[340px]">
              {featuredSpecimens.slice(0, 3).map((specimen) => (
                <button
                  key={specimen.id}
                  type="button"
                  onClick={() => onSelectSpecimen(specimen)}
                  className="group relative flex flex-col justify-between rounded-lg border border-[#E6E0D4] bg-[#FCFBF8] hover:border-[#B8AEA0] transition-colors duration-150 p-4 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9C523B]"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#78716C] tabular-nums">
                    <span>PL. {specimen.plateNumber}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[#9C523B]">
                      Inspect
                    </span>
                  </div>
                  <div className="flex-1 flex items-center justify-center py-2 transition-transform duration-200 ease-out group-hover:scale-[1.03]">
                    <div className="w-full max-w-[170px] aspect-[7/9]">
                      <BotanicalSvg specimen={specimen} palette={palette} />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#EFEAE0]">
                    <p className="font-serif text-base font-medium text-[#1C1917] truncate">
                      {specimen.commonName}
                    </p>
                    <p className="text-[11px] italic text-[#78716C] truncate">
                      {specimen.latinName}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Full-width 4-column museum spec strip below hero split */}
        <div className="mt-10 pt-8 border-t border-[#E6E0D4] grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="font-mono text-2xl font-medium text-[#1C1917] tabular-nums">18</p>
            <p className="text-xs text-[#6B655E] mt-1">Isolated Botanical Vector Plates</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-medium text-[#1C1917] tabular-nums">04</p>
            <p className="text-xs text-[#6B655E] mt-1">Curated Warm Earthy Palettes</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-medium text-[#1C1917] tabular-nums">280 × 360</p>
            <p className="text-xs text-[#6B655E] mt-1">Unified Artboard Proportions</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-medium text-[#1C1917] tabular-nums">SVG · PNG</p>
            <p className="text-xs text-[#6B655E] mt-1">Clean Bezier Path &amp; Print Export</p>
          </div>
        </div>
      </div>
    </section>
  );
};
