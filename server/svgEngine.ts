import crypto from 'node:crypto';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { SVGPathData } from 'svg-pathdata';
import type { SvgValidationReport } from '../src/types/stockforge.js';

/**
 * Strips unsafe scripts, event handlers, foreignObject, external hrefs,
 * and rejects embedded raster <image> substitutes.
 */
export function sanitizeAndValidateSvg(
  rawSvg: string,
  strictSanitizer = true
): {
  sanitizedSvg: string;
  validation: SvgValidationReport;
  geometryHash: string;
  viewBoxRect: { minX: number; minY: number; width: number; height: number };
} {
  let svg = rawSvg.trim();

  // Extract <svg ...>...</svg> if wrapped in markdown fences or extra text
  const svgMatch = svg.match(/<svg[\s\S]*<\/svg>/i);
  if (svgMatch) {
    svg = svgMatch[0];
  }

  const hasScriptTag = /<\s*script\b/i.test(svg);
  const hasEventHandler = /\bon[a-z]+\s*=\s*(['"])[\s\S]*?\1/i.test(svg);
  const hasJavascriptUri = /javascript\s*:/i.test(svg);
  const hasForeignObject = /<\s*foreignObject\b/i.test(svg);
  const hasUnsafeScripts = hasScriptTag || hasEventHandler || hasJavascriptUri || hasForeignObject;

  const hasImageTag = /<\s*image\b/i.test(svg);
  const hasDataImage = /data:image\/(png|jpeg|jpg|webp|gif|bmp)/i.test(svg);
  const hasRasterImages = hasImageTag || hasDataImage;

  if (strictSanitizer) {
    svg = svg.replace(/<\s*script\b[\s\S]*?<\s*\/\s*script\s*>/gi, '');
    svg = svg.replace(/<\s*foreignObject\b[\s\S]*?<\s*\/\s*foreignObject\s*>/gi, '');
    svg = svg.replace(/<\s*(iframe|object|embed)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
    svg = svg.replace(/\s+on[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '');
    svg = svg.replace(/href\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, '');
    svg = svg.replace(/xlink:href\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, '');
    // Strip any raster image tags if present
    svg = svg.replace(/<\s*image\b[^>]*\/?>(\s*<\s*\/\s*image\s*>)?/gi, '');
  }

  const hasSvgRoot = /^<svg\b[^>]*>[\s\S]*<\/svg>$/i.test(svg.trim());

  // Ensure xmlns and viewBox
  if (hasSvgRoot) {
    svg = svg.replace(/<svg\b([^>]*)>/i, (_full, attrs: string) => {
      let nextAttrs = attrs;
      if (!/\bxmlns\s*=/i.test(nextAttrs)) {
        nextAttrs += ' xmlns="http://www.w3.org/2000/svg"';
      }
      if (!/\bviewBox\s*=/i.test(nextAttrs)) {
        nextAttrs += ' viewBox="0 0 1000 1000"';
      }
      return `<svg${nextAttrs}>`;
    });
  }

  const vbMatch = svg.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  const hasViewBox = Boolean(vbMatch);
  let viewBoxRect = { minX: 0, minY: 0, width: 1000, height: 1000 };
  if (vbMatch) {
    const nums = vbMatch[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    if (nums.length === 4 && nums[2] > 0 && nums[3] > 0) {
      viewBoxRect = { minX: nums[0], minY: nums[1], width: nums[2], height: nums[3] };
    }
  }

  // Basic XML tag balance check
  const validXml = checkBasicXmlWellFormed(svg) && hasSvgRoot;

  const countTag = (tag: string) =>
    (svg.match(new RegExp(`<\\s*${tag}\\b`, 'gi')) || []).length;

  const elementCounts = {
    path: countTag('path'),
    circle: countTag('circle'),
    rect: countTag('rect'),
    ellipse: countTag('ellipse'),
    polygon: countTag('polygon'),
    polyline: countTag('polyline'),
    line: countTag('line'),
    g: countTag('g'),
    gradients: countTag('linearGradient') + countTag('radialGradient'),
  };

  const totalVectorPrimitives =
    elementCounts.path +
    elementCounts.circle +
    elementCounts.rect +
    elementCounts.ellipse +
    elementCounts.polygon +
    elementCounts.polyline +
    elementCounts.line;

  const issues: string[] = [];
  if (!hasSvgRoot) issues.push('Missing valid <svg>...</svg> root element.');
  if (!validXml) issues.push('SVG XML structure contains unclosed or mismatched tags.');
  if (!hasViewBox) issues.push('Original SVG lacked explicit viewBox; normalized to 0 0 1000 1000.');
  if (hasUnsafeScripts) issues.push('Unsafe script/event handler content was detected and stripped.');
  if (hasRasterImages) issues.push('Embedded raster <image> elements are prohibited in commercial vectors.');
  if (totalVectorPrimitives < 3) {
    issues.push(`Insufficient vector primitives (${totalVectorPrimitives}). Commercial vectors require >= 3 editable primitives.`);
  }

  const commercialReady =
    hasSvgRoot && validXml && !hasRasterImages && totalVectorPrimitives >= 3;

  // Compute geometry-only SHA-256 hash (strips colors/ids so trivial color swaps are caught)
  const geometryFingerprint = svg
    .replace(/\s+(fill|stroke|stop-color|id|class)\s*=\s*(['"])[^'"]*\2/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const geometryHash = crypto.createHash('sha256').update(geometryFingerprint).digest('hex');

  return {
    sanitizedSvg: svg,
    validation: {
      validXml,
      hasSvgRoot,
      hasViewBox,
      viewBox: `${viewBoxRect.minX} ${viewBoxRect.minY} ${viewBoxRect.width} ${viewBoxRect.height}`,
      hasUnsafeScripts,
      hasRasterImages,
      elementCounts,
      totalVectorPrimitives,
      commercialReady,
      issues,
    },
    geometryHash,
    viewBoxRect,
  };
}

function checkBasicXmlWellFormed(xml: string): boolean {
  const cleaned = xml
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');

  const stack: string[] = [];
  const tagRegex = /<\/?([a-zA-Z_][\w:.-]*)(?:\s+(?:[^"'<>]|"[^"]*"|'[^']*')*)?\s*\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(cleaned)) !== null) {
    const full = match[0];
    const tagName = match[1].toLowerCase();
    const selfClosing = full.endsWith('/>');
    if (full.startsWith('</')) {
      const top = stack.pop();
      if (top !== tagName) return false;
    } else if (!selfClosing) {
      stack.push(tagName);
    }
  }
  if (stack.length !== 0) return false;

  try {
    new Resvg(xml);
    return true;
  } catch {
    return false;
  }
}

export async function renderSvgToPngBuffer(svg: string, size = 4000): Promise<Buffer> {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  });
  const rendered = resvg.render();
  return Buffer.from(rendered.asPng());
}

export async function renderSvgToJpgBuffer(
  svg: string,
  size = 4000,
  quality = 95
): Promise<Buffer> {
  const pngBuffer = await renderSvgToPngBuffer(svg, size);
  return sharp(pngBuffer)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality, chromaSubsampling: '4:4:4' })
    .withMetadata({ density: 300 })
    .toBuffer();
}

// ============================================================================
// Pure TypeScript True-Vector SVG -> EPS (Encapsulated PostScript 3.0) Compiler
// Outputs editable vector PostScript paths (moveto, lineto, curveto, fill, stroke)
// ============================================================================

type Matrix = [number, number, number, number, number, number];

function mulMatrix(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function applyMatrix(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function parseTransform(transformStr?: string): Matrix {
  let m: Matrix = [1, 0, 0, 1, 0, 0];
  if (!transformStr) return m;
  const regex = /(translate|scale|rotate|matrix|skewX|skewY)\s*\(([^)]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(transformStr)) !== null) {
    const fn = match[1].toLowerCase();
    const args = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !Number.isNaN(n));
    let next: Matrix = [1, 0, 0, 1, 0, 0];
    if (fn === 'translate') {
      next = [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
    } else if (fn === 'scale') {
      const sx = args[0] ?? 1;
      const sy = args[1] ?? sx;
      next = [sx, 0, 0, sy, 0, 0];
    } else if (fn === 'rotate') {
      const deg = args[0] ?? 0;
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      if (args.length >= 3) {
        const cx = args[1];
        const cy = args[2];
        next = mulMatrix(
          mulMatrix([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]),
          [1, 0, 0, 1, -cx, -cy]
        );
      } else {
        next = [cos, sin, -sin, cos, 0, 0];
      }
    } else if (fn === 'matrix' && args.length >= 6) {
      next = [args[0], args[1], args[2], args[3], args[4], args[5]];
    } else if (fn === 'skewx') {
      const tan = Math.tan(((args[0] ?? 0) * Math.PI) / 180);
      next = [1, 0, tan, 1, 0, 0];
    } else if (fn === 'skewy') {
      const tan = Math.tan(((args[0] ?? 0) * Math.PI) / 180);
      next = [1, tan, 0, 1, 0, 0];
    }
    m = mulMatrix(m, next);
  }
  return m;
}

const NAMED_COLORS: Record<string, [number, number, number]> = {
  black: [0, 0, 0],
  white: [1, 1, 1],
  red: [1, 0, 0],
  green: [0, 0.5, 0],
  blue: [0, 0, 1],
  yellow: [1, 1, 0],
  cyan: [0, 1, 1],
  magenta: [1, 0, 1],
  gray: [0.5, 0.5, 0.5],
  grey: [0.5, 0.5, 0.5],
  orange: [1, 0.647, 0],
  purple: [0.5, 0, 0.5],
  navy: [0, 0, 0.5],
  teal: [0, 0.5, 0.5],
  silver: [0.753, 0.753, 0.753],
};

function parseColor(
  colorStr: string | undefined,
  gradients: Map<string, string>
): [number, number, number] | null {
  if (!colorStr) return null;
  const c = colorStr.trim();
  if (!c || c === 'none' || c === 'transparent') return null;

  const urlMatch = c.match(/^url\(\s*#([^)]+)\s*\)$/i);
  if (urlMatch) {
    const resolved = gradients.get(urlMatch[1]);
    if (resolved) return parseColor(resolved, gradients);
    return [0.2, 0.35, 0.6];
  }

  if (NAMED_COLORS[c.toLowerCase()]) {
    return NAMED_COLORS[c.toLowerCase()];
  }

  const hex = c.replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const r = parseInt(hex[0] + hex[0], 16) / 255;
    const g = parseInt(hex[1] + hex[1], 16) / 255;
    const b = parseInt(hex[2] + hex[2], 16) / 255;
    return [r, g, b];
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex) || /^[0-9a-fA-F]{8}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return [r, g, b];
  }

  const rgbMatch = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return [
      Number(rgbMatch[1]) / 255,
      Number(rgbMatch[2]) / 255,
      Number(rgbMatch[3]) / 255,
    ];
  }
  return null;
}

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(attrString)) !== null) {
    attrs[m[1]] = m[2] ?? m[3] ?? '';
  }
  if (attrs.style) {
    for (const part of attrs.style.split(';')) {
      const idx = part.indexOf(':');
      if (idx > 0) {
        const k = part.slice(0, idx).trim();
        const v = part.slice(idx + 1).trim();
        if (!attrs[k]) attrs[k] = v;
      }
    }
  }
  return attrs;
}

function arcToCubicCurves(
  x1: number,
  y1: number,
  rxIn: number,
  ryIn: number,
  phiDeg: number,
  largeArcFlag: boolean,
  sweepFlag: boolean,
  x2: number,
  y2: number
): Array<[number, number, number, number, number, number]> {
  if (x1 === x2 && y1 === y2) return [];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) {
    return [[x1, y1, x2, y2, x2, y2]];
  }
  const phi = (phiDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  const rxSq = rx * rx;
  const rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;
  const lambda = x1pSq / rxSq + y1pSq / rySq;
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const num = Math.max(0, rx2 * ry2 - rx2 * y1pSq - ry2 * x1pSq);
  const den = rx2 * y1pSq + ry2 * x1pSq;
  const factor = (largeArcFlag === sweepFlag ? -1 : 1) * Math.sqrt(den === 0 ? 0 : num / den);
  const cxp = factor * ((rx * y1p) / ry);
  const cyp = factor * (-(ry * x1p) / rx);

  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    const val = Math.max(-1, Math.min(1, len === 0 ? 1 : dot / len));
    return (ux * vy - uy * vx < 0 ? -1 : 1) * Math.acos(val);
  };

  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = angle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry
  );
  if (!sweepFlag && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweepFlag && dTheta < 0) dTheta += 2 * Math.PI;

  const segments = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)));
  const delta = dTheta / segments;
  const curves: Array<[number, number, number, number, number, number]> = [];

  for (let i = 0; i < segments; i++) {
    const t1 = theta1 + i * delta;
    const t2 = t1 + delta;
    const alpha = (4 / 3) * Math.tan((t2 - t1) / 4);

    const p1x = Math.cos(t1);
    const p1y = Math.sin(t1);
    const p2x = Math.cos(t2);
    const p2y = Math.sin(t2);

    const cp1x = p1x - alpha * p1y;
    const cp1y = p1y + alpha * p1x;
    const cp2x = p2x + alpha * p2y;
    const cp2y = p2y - alpha * p2x;

    const mapPt = (px: number, py: number): [number, number] => [
      cosPhi * (rx * px) - sinPhi * (ry * py) + cx,
      sinPhi * (rx * px) + cosPhi * (ry * py) + cy,
    ];

    const [c1x, c1y] = mapPt(cp1x, cp1y);
    const [c2x, c2y] = mapPt(cp2x, cp2y);
    const [ex, ey] = mapPt(p2x, p2y);
    curves.push([c1x, c1y, c2x, c2y, ex, ey]);
  }
  return curves;
}

function blendRgbWithAlphaOnWhite(
  rgb: [number, number, number],
  alpha: number
): [number, number, number] {
  const a = Math.max(0, Math.min(1, alpha));
  return [1 - a + a * rgb[0], 1 - a + a * rgb[1], 1 - a + a * rgb[2]];
}

function parseOpacity(val: string | undefined, fallback = 1): number {
  if (val === undefined || val === '') return fallback;
  const n = parseFloat(val);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

function numAttr(val: string | undefined, fallback = 0): number {
  if (val === undefined || val === '') return fallback;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : fallback;
}

export function convertSvgToVectorEps(svg: string, artboardSize = 1000, title = 'ZuumStock Vector'): string {
  const { viewBoxRect } = sanitizeAndValidateSvg(svg, false);
  const scaleX = artboardSize / viewBoxRect.width;
  const scaleY = artboardSize / viewBoxRect.height;
  const scale = Math.min(scaleX, scaleY);

  // Extract gradient stops and blend first/last stops so EPS vectors keep vibrant midtone colors
  const gradients = new Map<string, string>();
  const gradRegex = /<(linearGradient|radialGradient)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let gm: RegExpExecArray | null;
  while ((gm = gradRegex.exec(svg)) !== null) {
    const gAttrs = parseAttributes(gm[2]);
    if (gAttrs.id) {
      const stopColors: [number, number, number][] = [];
      const stopTagRegex = /<stop\b([^>]*)\/?\s*>/gi;
      let sm: RegExpExecArray | null;
      while ((sm = stopTagRegex.exec(gm[3])) !== null) {
        const sAttrs = parseAttributes(sm[1]);
        const rawColor = sAttrs['stop-color'];
        if (rawColor) {
          const parsed = parseColor(rawColor, gradients);
          if (parsed) stopColors.push(parsed);
        }
      }
      if (stopColors.length === 1) {
        const [r, g, b] = stopColors[0].map((c) => Math.round(c * 255));
        gradients.set(gAttrs.id, `rgb(${r},${g},${b})`);
      } else if (stopColors.length >= 2) {
        const first = stopColors[0];
        const last = stopColors[stopColors.length - 1];
        const r = Math.round(((first[0] + last[0]) / 2) * 255);
        const g = Math.round(((first[1] + last[1]) / 2) * 255);
        const b = Math.round(((first[2] + last[2]) / 2) * 255);
        gradients.set(gAttrs.id, `rgb(${r},${g},${b})`);
      }
    }
  }

  const fmt = (n: number) => Number(n.toFixed(3)).toString();
  const toPs = (m: Matrix, x: number, y: number): [number, number] => {
    const [tx, ty] = applyMatrix(m, x, y);
    const psX = (tx - viewBoxRect.minX) * scale;
    const psY = artboardSize - (ty - viewBoxRect.minY) * scale;
    return [psX, psY];
  };

  interface StyleContext {
    fill?: string;
    stroke?: string;
    strokeWidth?: string;
    fillRule?: string;
    strokeLinecap?: string;
    strokeLinejoin?: string;
    opacity: number;
    fillOpacity: number;
    strokeOpacity: number;
    hidden: boolean;
    matrix: Matrix;
  }

  const stack: StyleContext[] = [
    {
      fill: '#000000',
      stroke: 'none',
      strokeWidth: '1',
      fillRule: 'nonzero',
      strokeLinecap: 'butt',
      strokeLinejoin: 'miter',
      opacity: 1,
      fillOpacity: 1,
      strokeOpacity: 1,
      hidden: false,
      matrix: [1, 0, 0, 1, 0, 0],
    },
  ];

  const psCommands: string[] = [];
  const tokenRegex = /<(\/?)([a-zA-Z_][\w:.-]*)((?:\s+(?:[^"'<>]|"[^"]*"|'[^']*')*)?)\s*(\/?)>/g;
  let tok: RegExpExecArray | null;

  let insideDefs = 0;

  while ((tok = tokenRegex.exec(svg)) !== null) {
    const isClose = tok[1] === '/';
    const tag = tok[2].toLowerCase();
    const attrs = parseAttributes(tok[3] || '');
    const isSelfClose = tok[4] === '/';

    if (
      tag === 'defs' ||
      tag === 'lineargradient' ||
      tag === 'radialgradient' ||
      tag === 'clippath' ||
      tag === 'mask' ||
      tag === 'style' ||
      tag === 'title' ||
      tag === 'desc' ||
      tag === 'metadata'
    ) {
      if (isClose) insideDefs = Math.max(0, insideDefs - 1);
      else if (!isSelfClose) insideDefs++;
      continue;
    }
    if (insideDefs > 0) continue;

    if (isClose) {
      if ((tag === 'g' || tag === 'svg') && stack.length > 1) {
        stack.pop();
      }
      continue;
    }

    const parent = stack[stack.length - 1];
    const elementOpacity = parseOpacity(attrs.opacity, 1);
    const isHidden =
      parent.hidden ||
      attrs.display === 'none' ||
      attrs.visibility === 'hidden' ||
      elementOpacity <= 0;

    const ctx: StyleContext = {
      fill: attrs.fill ?? parent.fill,
      stroke: attrs.stroke ?? parent.stroke,
      strokeWidth: attrs['stroke-width'] ?? parent.strokeWidth,
      fillRule: attrs['fill-rule'] ?? parent.fillRule,
      strokeLinecap: attrs['stroke-linecap'] ?? parent.strokeLinecap,
      strokeLinejoin: attrs['stroke-linejoin'] ?? parent.strokeLinejoin,
      opacity: parent.opacity * elementOpacity,
      fillOpacity:
        attrs['fill-opacity'] !== undefined
          ? parseOpacity(attrs['fill-opacity'], 1)
          : parent.fillOpacity,
      strokeOpacity:
        attrs['stroke-opacity'] !== undefined
          ? parseOpacity(attrs['stroke-opacity'], 1)
          : parent.strokeOpacity,
      hidden: isHidden,
      matrix: attrs.transform
        ? mulMatrix(parent.matrix, parseTransform(attrs.transform))
        : parent.matrix,
    };

    if (tag === 'g' || tag === 'svg') {
      if (!isSelfClose) stack.push(ctx);
      continue;
    }
    if (ctx.hidden) continue;

    const pathSegments: string[] = [];

    if (tag === 'path' && attrs.d) {
      try {
        const parsed = new SVGPathData(attrs.d).toAbs().normalizeHVZ().normalizeST();
        let cx = 0;
        let cy = 0;
        let sx = 0;
        let sy = 0;

        for (const cmd of parsed.commands) {
          if (cmd.type === SVGPathData.MOVE_TO) {
            cx = cmd.x;
            cy = cmd.y;
            sx = cx;
            sy = cy;
            const [px, py] = toPs(ctx.matrix, cx, cy);
            pathSegments.push(`${fmt(px)} ${fmt(py)} moveto`);
          } else if (cmd.type === SVGPathData.LINE_TO) {
            cx = cmd.x;
            cy = cmd.y;
            const [px, py] = toPs(ctx.matrix, cx, cy);
            pathSegments.push(`${fmt(px)} ${fmt(py)} lineto`);
          } else if (cmd.type === SVGPathData.CURVE_TO) {
            const [x1, y1] = toPs(ctx.matrix, cmd.x1, cmd.y1);
            const [x2, y2] = toPs(ctx.matrix, cmd.x2, cmd.y2);
            const [x, y] = toPs(ctx.matrix, cmd.x, cmd.y);
            cx = cmd.x;
            cy = cmd.y;
            pathSegments.push(
              `${fmt(x1)} ${fmt(y1)} ${fmt(x2)} ${fmt(y2)} ${fmt(x)} ${fmt(y)} curveto`
            );
          } else if (cmd.type === SVGPathData.QUAD_TO) {
            const c1x = cx + (2 / 3) * (cmd.x1 - cx);
            const c1y = cy + (2 / 3) * (cmd.y1 - cy);
            const c2x = cmd.x + (2 / 3) * (cmd.x1 - cmd.x);
            const c2y = cmd.y + (2 / 3) * (cmd.y1 - cmd.y);
            const [x1, y1] = toPs(ctx.matrix, c1x, c1y);
            const [x2, y2] = toPs(ctx.matrix, c2x, c2y);
            const [x, y] = toPs(ctx.matrix, cmd.x, cmd.y);
            cx = cmd.x;
            cy = cmd.y;
            pathSegments.push(
              `${fmt(x1)} ${fmt(y1)} ${fmt(x2)} ${fmt(y2)} ${fmt(x)} ${fmt(y)} curveto`
            );
          } else if (cmd.type === SVGPathData.ARC) {
            const cubics = arcToCubicCurves(
              cx,
              cy,
              cmd.rX,
              cmd.rY,
              cmd.xRot,
              Boolean(cmd.lArcFlag),
              Boolean(cmd.sweepFlag),
              cmd.x,
              cmd.y
            );
            for (const [ax1, ay1, ax2, ay2, ax, ay] of cubics) {
              const [x1, y1] = toPs(ctx.matrix, ax1, ay1);
              const [x2, y2] = toPs(ctx.matrix, ax2, ay2);
              const [x, y] = toPs(ctx.matrix, ax, ay);
              pathSegments.push(
                `${fmt(x1)} ${fmt(y1)} ${fmt(x2)} ${fmt(y2)} ${fmt(x)} ${fmt(y)} curveto`
              );
            }
            cx = cmd.x;
            cy = cmd.y;
          } else if (cmd.type === SVGPathData.CLOSE_PATH) {
            cx = sx;
            cy = sy;
            pathSegments.push('closepath');
          }
        }
      } catch {
        // Skip malformed path
      }
    } else if (tag === 'rect') {
      const x = numAttr(attrs.x, 0);
      const y = numAttr(attrs.y, 0);
      const w = numAttr(attrs.width, 0);
      const h = numAttr(attrs.height, 0);
      const rx = Math.min(numAttr(attrs.rx ?? attrs.ry, 0), w / 2);
      const ry = Math.min(numAttr(attrs.ry ?? attrs.rx, 0), h / 2);
      if (w > 0 && h > 0) {
        if (rx > 0 || ry > 0) {
          const k = 0.5522847498;
          const pts = [
            [x + rx, y],
            [x + w - rx, y],
            [x + w - rx + rx * k, y, x + w, y + ry - ry * k, x + w, y + ry],
            [x + w, y + h - ry],
            [x + w, y + h - ry + ry * k, x + w - rx + rx * k, y + h, x + w - rx, y + h],
            [x + rx, y + h],
            [x + rx - rx * k, y + h, x, y + h - ry + ry * k, x, y + h - ry],
            [x, y + ry],
            [x, y + ry - ry * k, x + rx - rx * k, y, x + rx, y],
          ];
          const [mx, my] = toPs(ctx.matrix, pts[0][0], pts[0][1]);
          pathSegments.push(`${fmt(mx)} ${fmt(my)} moveto`);
          for (let i = 1; i < pts.length; i++) {
            const p = pts[i];
            if (p.length === 2) {
              const [lx, ly] = toPs(ctx.matrix, p[0], p[1]);
              pathSegments.push(`${fmt(lx)} ${fmt(ly)} lineto`);
            } else {
              const [c1x, c1y] = toPs(ctx.matrix, p[0], p[1]);
              const [c2x, c2y] = toPs(ctx.matrix, p[2], p[3]);
              const [ex, ey] = toPs(ctx.matrix, p[4], p[5]);
              pathSegments.push(
                `${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(ex)} ${fmt(ey)} curveto`
              );
            }
          }
          pathSegments.push('closepath');
        } else {
          const corners: [number, number][] = [
            [x, y],
            [x + w, y],
            [x + w, y + h],
            [x, y + h],
          ];
          corners.forEach(([px, py], idx) => {
            const [sx, sy] = toPs(ctx.matrix, px, py);
            pathSegments.push(`${fmt(sx)} ${fmt(sy)} ${idx === 0 ? 'moveto' : 'lineto'}`);
          });
          pathSegments.push('closepath');
        }
      }
    } else if (tag === 'circle' || tag === 'ellipse') {
      const cx = numAttr(attrs.cx, 0);
      const cy = numAttr(attrs.cy, 0);
      const rx = tag === 'circle' ? numAttr(attrs.r, 0) : numAttr(attrs.rx, 0);
      const ry = tag === 'circle' ? numAttr(attrs.r, 0) : numAttr(attrs.ry, 0);
      if (rx > 0 && ry > 0) {
        const k = 0.5522847498;
        const ox = rx * k;
        const oy = ry * k;
        const [sx, sy] = toPs(ctx.matrix, cx, cy - ry);
        pathSegments.push(`${fmt(sx)} ${fmt(sy)} moveto`);
        const segs: [number, number, number, number, number, number][] = [
          [cx + ox, cy - ry, cx + rx, cy - oy, cx + rx, cy],
          [cx + rx, cy + oy, cx + ox, cy + ry, cx, cy + ry],
          [cx - ox, cy + ry, cx - rx, cy + oy, cx - rx, cy],
          [cx - rx, cy - oy, cx - ox, cy - ry, cx, cy - ry],
        ];
        for (const s of segs) {
          const [x1, y1] = toPs(ctx.matrix, s[0], s[1]);
          const [x2, y2] = toPs(ctx.matrix, s[2], s[3]);
          const [x, y] = toPs(ctx.matrix, s[4], s[5]);
          pathSegments.push(
            `${fmt(x1)} ${fmt(y1)} ${fmt(x2)} ${fmt(y2)} ${fmt(x)} ${fmt(y)} curveto`
          );
        }
        pathSegments.push('closepath');
      }
    } else if ((tag === 'polygon' || tag === 'polyline') && attrs.points) {
      const nums = attrs.points
        .trim()
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => Number.isFinite(n));
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const [px, py] = toPs(ctx.matrix, nums[i], nums[i + 1]);
        pathSegments.push(`${fmt(px)} ${fmt(py)} ${i === 0 ? 'moveto' : 'lineto'}`);
      }
      if (tag === 'polygon' && nums.length >= 4) {
        pathSegments.push('closepath');
      }
    } else if (tag === 'line') {
      const [x1, y1] = toPs(ctx.matrix, numAttr(attrs.x1, 0), numAttr(attrs.y1, 0));
      const [x2, y2] = toPs(ctx.matrix, numAttr(attrs.x2, 0), numAttr(attrs.y2, 0));
      pathSegments.push(`${fmt(x1)} ${fmt(y1)} moveto`);
      pathSegments.push(`${fmt(x2)} ${fmt(y2)} lineto`);
    }

    if (pathSegments.length > 0) {
      const rawFillRgb = parseColor(ctx.fill, gradients);
      const rawStrokeRgb = parseColor(ctx.stroke, gradients);
      const fillAlpha = ctx.opacity * ctx.fillOpacity;
      const strokeAlpha = ctx.opacity * ctx.strokeOpacity;
      const fillRgb =
        rawFillRgb && fillAlpha > 0 ? blendRgbWithAlphaOnWhite(rawFillRgb, fillAlpha) : null;
      const strokeRgb =
        rawStrokeRgb && strokeAlpha > 0
          ? blendRgbWithAlphaOnWhite(rawStrokeRgb, strokeAlpha)
          : null;
      const strokeW = Math.max(0.1, numAttr(ctx.strokeWidth, 1) * scale);

      if (fillRgb && tag !== 'line' && tag !== 'polyline') {
        psCommands.push('gsave');
        psCommands.push('newpath');
        psCommands.push(...pathSegments);
        psCommands.push(
          `${fmt(fillRgb[0])} ${fmt(fillRgb[1])} ${fmt(fillRgb[2])} setrgbcolor`
        );
        psCommands.push(ctx.fillRule === 'evenodd' ? 'eofill' : 'fill');
        psCommands.push('grestore');
      }
      if (strokeRgb) {
        psCommands.push('gsave');
        psCommands.push('newpath');
        psCommands.push(...pathSegments);
        psCommands.push(
          `${fmt(strokeRgb[0])} ${fmt(strokeRgb[1])} ${fmt(strokeRgb[2])} setrgbcolor`
        );
        psCommands.push(`${fmt(strokeW)} setlinewidth`);
        const cap =
          ctx.strokeLinecap === 'round' ? 1 : ctx.strokeLinecap === 'square' ? 2 : 0;
        const join =
          ctx.strokeLinejoin === 'round' ? 1 : ctx.strokeLinejoin === 'bevel' ? 2 : 0;
        psCommands.push(`${cap} setlinecap`);
        psCommands.push(`${join} setlinejoin`);
        psCommands.push('stroke');
        psCommands.push('grestore');
      }
    }
  }

  const safeTitle = title.replace(/[^\x20-\x7E]/g, '');
  const header = [
    '%!PS-Adobe-3.0 EPSF-3.0',
    `%%Creator: ZuumStock Studio Vector Compiler`,
    `%%Title: ${safeTitle}`,
    `%%CreationDate: ${new Date().toISOString()}`,
    `%%BoundingBox: 0 0 ${artboardSize} ${artboardSize}`,
    `%%HiResBoundingBox: 0.000 0.000 ${artboardSize}.000 ${artboardSize}.000`,
    '%%LanguageLevel: 2',
    '%%Pages: 1',
    '%%EndComments',
    '%%BeginProlog',
    '%%EndProlog',
    '%%Page: 1 1',
  ];

  const footer = ['showpage', '%%EOF'];

  return [...header, ...psCommands, ...footer].join('\n') + '\n';
}
