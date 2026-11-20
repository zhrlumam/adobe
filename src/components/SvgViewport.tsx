import React, { useMemo } from 'react';

interface SvgViewportProps {
  svgContent?: string;
  wireframe?: boolean;
  backdrop?: 'white' | 'checkerboard' | 'dark';
  className?: string;
}

export const SvgViewport: React.FC<SvgViewportProps> = ({
  svgContent,
  wireframe = false,
  backdrop = 'white',
  className = '',
}) => {
  const processedSvg = useMemo(() => {
    if (!svgContent) return '';
    let s = svgContent.trim();
    // Ensure responsive sizing inside container
    s = s.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
      const cleaned = attrs
        .replace(/\bwidth\s*=\s*["'][^"']*["']/gi, '')
        .replace(/\bheight\s*=\s*["'][^"']*["']/gi, '');
      return `<svg${cleaned} width="100%" height="100%" style="display:block;max-width:100%;max-height:100%;">`;
    });

    if (wireframe) {
      const outlineStyle = `<style>
        path, circle, rect, ellipse, polygon, polyline, line {
          fill: none !important;
          stroke: #2563EB !important;
          stroke-width: 2.2px !important;
          vector-effect: non-scaling-stroke;
        }
      </style>`;
      s = s.replace(/<svg\b([^>]*)>/i, `<svg$1>${outlineStyle}`);
    }
    return s;
  }, [svgContent, wireframe]);

  const bgClass =
    backdrop === 'checkerboard'
      ? 'checkerboard-bg'
      : backdrop === 'dark'
      ? 'bg-[#0F172A]'
      : 'bg-white';

  if (!processedSvg) {
    return (
      <div
        className={`flex items-center justify-center border border-slate-200 text-xs text-slate-400 ${bgClass} ${className}`}
      >
        No SVG preview available
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center overflow-hidden p-3 ${bgClass} ${className}`}
      dangerouslySetInnerHTML={{ __html: processedSvg }}
    />
  );
};
