import React from 'react';
import { Download } from 'lucide-react';

export type ActiveSection = 'collection' | 'sheet' | 'composer' | 'palette';

interface HeaderProps {
  activeSection: ActiveSection;
  onNavigate: (section: ActiveSection) => void;
  onExportPoster: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeSection,
  onNavigate,
  onExportPoster,
}) => {
  const navItems: { id: ActiveSection; label: string }[] = [
    { id: 'collection', label: 'Collection' },
    { id: 'sheet', label: 'Specimen Sheet' },
    { id: 'composer', label: 'Composer' },
    { id: 'palette', label: 'Palette Guide' },
  ];

  return (
    <header className="sticky top-0 z-30 bg-[#FAF8F4]/95 backdrop-blur-sm border-b border-[#E6E0D4]">
      <div className="max-w-[1360px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('collection')}
          className="font-serif text-2xl font-semibold tracking-tight text-[#1C1917] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9C523B] rounded-sm"
        >
          Herbarium Atelier
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav aria-label="Primary" className="hidden md:flex items-center gap-7">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9C523B] rounded-t-sm ${
                  isActive
                    ? 'text-[#1C1917] border-[#9C523B]'
                    : 'text-[#6B655E] border-transparent hover:text-[#1C1917] hover:border-[#D6CEBE]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onExportPoster}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#FAF8F4] bg-[#292524] hover:bg-[#9C523B] transition-colors duration-150 rounded-md whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#9C523B]"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Download Full Set</span>
          </button>
        </div>
      </div>

      {/* Mobile secondary nav strip (only shown below md) */}
      <nav
        aria-label="Mobile sections"
        className="flex md:hidden items-center gap-4 px-6 py-2 border-t border-[#ECE6DB] overflow-x-auto"
      >
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`text-xs font-medium whitespace-nowrap shrink-0 py-1 border-b transition-colors ${
                isActive
                  ? 'text-[#1C1917] border-[#9C523B]'
                  : 'text-[#6B655E] border-transparent'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
