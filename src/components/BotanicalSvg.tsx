import React from 'react';
import { BOTANICAL_VIEWBOX } from '../data/specimens';
import { BackdropMode, BotanicalSpecimen, EarthyPalette, PaletteRole, VectorShape } from '../types/botanical';

interface BotanicalSvgProps {
  specimen: BotanicalSpecimen;
  palette: EarthyPalette;
  wireframe?: boolean;
  showCropMarks?: boolean;
  backdropMode?: BackdropMode;
  className?: string;
}

function resolveColor(role: PaletteRole | 'none' | undefined, palette: EarthyPalette): string {
  if (!role || role === 'none') return 'none';
  return palette.colors[role];
}

export function renderVectorShape(
  shape: VectorShape,
  palette: EarthyPalette,
  index: number,
  wireframe = false,
  backdropMode: BackdropMode = 'ivory'
): React.ReactNode {
  const strokeWireColor = backdropMode === 'charcoal' ? '#E7E2D8' : '#292524';
  const fill = wireframe
    ? 'none'
    : resolveColor(shape.fillRole, palette);
  const stroke = wireframe
    ? strokeWireColor
    : resolveColor(shape.strokeRole, palette);
  const strokeWidth = wireframe
    ? shape.strokeWidth
      ? Math.max(1.2, shape.strokeWidth * 0.45)
      : 1.1
    : shape.strokeWidth;

  const commonProps = {
    fill,
    stroke: stroke === 'none' ? undefined : stroke,
    strokeWidth: stroke === 'none' ? undefined : strokeWidth,
    strokeLinecap: shape.strokeLinecap,
    strokeLinejoin: shape.strokeLinejoin,
    opacity: wireframe ? 0.9 : shape.opacity,
    transform: shape.transform,
  };

  switch (shape.type) {
    case 'path':
      return <path key={index} d={shape.d} {...commonProps} />;
    case 'circle':
      return <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} {...commonProps} />;
    case 'ellipse':
      return <ellipse key={index} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...commonProps} />;
    case 'line':
      return <line key={index} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} {...commonProps} />;
    default:
      return null;
  }
}

export const BotanicalSvg: React.FC<BotanicalSvgProps> = ({
  specimen,
  palette,
  wireframe = false,
  showCropMarks = false,
  backdropMode = 'ivory',
  className = 'w-full h-full',
}) => {
  const cropColor = backdropMode === 'charcoal' ? 'rgba(231, 226, 216, 0.28)' : 'rgba(28, 25, 23, 0.16)';

  return (
    <svg
      viewBox={BOTANICAL_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${specimen.commonName} (${specimen.latinName}) flat vector botanical illustration`}
      className={className}
    >
      {showCropMarks && (
        <g stroke={cropColor} strokeWidth="0.9" fill="none">
          {/* Top-left */}
          <path d="M18 28 L18 18 L28 18" />
          {/* Top-right */}
          <path d="M252 18 L262 18 L262 28" />
          {/* Bottom-left */}
          <path d="M18 332 L18 342 L28 342" />
          {/* Bottom-right */}
          <path d="M252 342 L262 342 L262 332" />
          {/* Center hairline cross */}
          <line x1="135" y1="342" x2="145" y2="342" />
          <line x1="140" y1="337" x2="140" y2="347" />
        </g>
      )}
      <g>{specimen.shapes.map((shape, idx) => renderVectorShape(shape, palette, idx, wireframe, backdropMode))}</g>
    </svg>
  );
};

function escapeAttr(val: string): string {
  return val.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function shapeToSvgString(shape: VectorShape, palette: EarthyPalette): string {
  const fill = resolveColor(shape.fillRole, palette);
  const stroke = resolveColor(shape.strokeRole, palette);
  const attrs: string[] = [];

  if (fill) attrs.push(`fill="${fill}"`);
  if (stroke && stroke !== 'none') {
    attrs.push(`stroke="${stroke}"`);
    if (shape.strokeWidth) attrs.push(`stroke-width="${shape.strokeWidth}"`);
    if (shape.strokeLinecap) attrs.push(`stroke-linecap="${shape.strokeLinecap}"`);
    if (shape.strokeLinejoin) attrs.push(`stroke-linejoin="${shape.strokeLinejoin}"`);
  }
  if (shape.opacity !== undefined) attrs.push(`opacity="${shape.opacity}"`);
  if (shape.transform) attrs.push(`transform="${escapeAttr(shape.transform)}"`);

  if (shape.type === 'path' && shape.d) {
    return `  <path d="${escapeAttr(shape.d)}" ${attrs.join(' ')} />`;
  }
  if (shape.type === 'circle') {
    return `  <circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" ${attrs.join(' ')} />`;
  }
  if (shape.type === 'ellipse') {
    return `  <ellipse cx="${shape.cx}" cy="${shape.cy}" rx="${shape.rx}" ry="${shape.ry}" ${attrs.join(' ')} />`;
  }
  if (shape.type === 'line') {
    return `  <line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" ${attrs.join(' ')} />`;
  }
  return '';
}

export function serializeSpecimenSvg(
  specimen: BotanicalSpecimen,
  palette: EarthyPalette,
  backgroundHex?: string
): string {
  const bg = backgroundHex
    ? `  <rect width="280" height="360" fill="${backgroundHex}" />\n`
    : '';
  const body = specimen.shapes.map((s) => shapeToSvgString(s, palette)).join('\n');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 360" width="560" height="720">`,
    `  <!-- ${specimen.commonName} (${specimen.latinName}) — ${palette.name} -->`,
    bg ? bg.trimEnd() : null,
    body,
    `</svg>`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function downloadSvgFile(filename: string, svgContent: string): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadPngFromSvg(
  filename: string,
  svgContent: string,
  width = 1120,
  height = 1440
): Promise<void> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          reject(new Error('Failed to render PNG'));
          return;
        }
        const pngUrl = URL.createObjectURL(pngBlob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pngUrl);
        resolve();
      }, 'image/png');
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

export function getSpecimenUsedRoles(specimen: BotanicalSpecimen): PaletteRole[] {
  const roles = new Set<PaletteRole>();
  for (const s of specimen.shapes) {
    if (s.fillRole && s.fillRole !== 'none') roles.add(s.fillRole);
    if (s.strokeRole && s.strokeRole !== 'none') roles.add(s.strokeRole);
  }
  return Array.from(roles);
}
