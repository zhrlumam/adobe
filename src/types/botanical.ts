export type SpecimenCategory = 'leaves' | 'flowers' | 'stems';

export type PaletteRole =
  | 'stem'
  | 'leafPrimary'
  | 'leafSecondary'
  | 'leafShadow'
  | 'petalPrimary'
  | 'petalSecondary'
  | 'petalAccent'
  | 'center'
  | 'vein'
  | 'berry';

export interface EarthyPalette {
  id: string;
  name: string;
  subtitle: string;
  colors: Record<PaletteRole, string>;
  backdropLight: string;
  backdropWarm: string;
  backdropDark: string;
}

export type BackdropMode = 'ivory' | 'limestone' | 'charcoal';

export interface VectorShape {
  type: 'path' | 'circle' | 'ellipse' | 'line';
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
  rx?: number;
  ry?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  transform?: string;
  fillRole?: PaletteRole | 'none';
  strokeRole?: PaletteRole | 'none';
  strokeWidth?: number;
  strokeLinecap?: 'round' | 'butt' | 'square';
  strokeLinejoin?: 'round' | 'miter' | 'bevel';
  opacity?: number;
}

export interface BotanicalSpecimen {
  id: string;
  plateNumber: string;
  commonName: string;
  latinName: string;
  family: string;
  category: SpecimenCategory;
  origin: string;
  description: string;
  shapeCount: number;
  featured?: boolean;
  shapes: VectorShape[];
}

export interface ComposerLayer {
  uid: string;
  specimenId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  opacity: number;
}
