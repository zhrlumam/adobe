import type { StockAsset, StockCategory } from '../src/types/stockforge.ts';

export const ADOBE_STOCK_CATEGORIES = [
  'Abstract',
  'Animals',
  'Buildings and Architecture',
  'Business',
  'Drinks',
  'Education',
  'Food',
  'Graphic Resources',
  'Hobbies and Leisure',
  'Industry',
  'Landscapes',
  'Lifestyle',
  'Medical',
  'Nature',
  'Objects',
  'People',
  'Plants and Flowers',
  'Religion and Culture',
  'Science',
  'Social Issues',
  'Sports',
  'Technology',
  'Transport',
];

export const SHUTTERSTOCK_CATEGORIES = [
  'Abstract',
  'Animals/Wildlife',
  'Arts',
  'Backgrounds/Textures',
  'Beauty/Fashion',
  'Buildings/Landmarks',
  'Business/Finance',
  'Celebrities',
  'Education',
  'Food and Drink',
  'Healthcare/Medical',
  'Holidays',
  'Icons',
  'Industrial',
  'Interiors',
  'Miscellaneous',
  'Nature',
  'Objects',
  'Parks/Outdoor',
  'People',
  'Religion',
  'Science',
  'Signs/Symbols',
  'Sports/Recreation',
  'Technology',
  'Transportation',
  'Vectors',
  'Vintage',
];

const BANNED_STOCK_TERMS = new Set([
  'vector',
  'eps',
  'svg',
  'png',
  'jpg',
  'jpeg',
  'shutterstock',
  'adobe',
  'istock',
  'getty',
  'ai generated',
  'midjourney',
  'dalle',
  'clipart',
]);

export function mapDefaultAdobeCategory(category: StockCategory): string {
  const map: Record<StockCategory, string> = {
    Abstract: 'Abstract',
    Business: 'Business',
    Technology: 'Technology',
    Education: 'Education',
    Animals: 'Animals',
    Nature: 'Nature',
    Food: 'Food',
    Medical: 'Medical',
    Objects: 'Objects',
    Backgrounds: 'Graphic Resources',
    Icons: 'Graphic Resources',
    Patterns: 'Graphic Resources',
    Custom: 'Graphic Resources',
  };
  return map[category] ?? 'Graphic Resources';
}

export function mapDefaultShutterstockCategory(category: StockCategory): string {
  const map: Record<StockCategory, string> = {
    Abstract: 'Abstract',
    Business: 'Business/Finance',
    Technology: 'Technology',
    Education: 'Education',
    Animals: 'Animals/Wildlife',
    Nature: 'Nature',
    Food: 'Food and Drink',
    Medical: 'Healthcare/Medical',
    Objects: 'Objects',
    Backgrounds: 'Backgrounds/Textures',
    Icons: 'Icons',
    Patterns: 'Backgrounds/Textures',
    Custom: 'Vectors',
  };
  return map[category] ?? 'Vectors';
}

/**
 * Cleans and normalizes keywords to 10-49 unique, non-stuffed terms.
 */
export function normalizeKeywords(
  rawKeywords: string[],
  fallbackContext: { prompt: string; category: StockCategory; style: string }
): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const k of rawKeywords) {
    const term = k
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim();
    if (!term || term.length < 2 || term.length > 40) continue;
    if (BANNED_STOCK_TERMS.has(term)) continue;
    if (!seen.has(term)) {
      seen.add(term);
      cleaned.push(term);
    }
    if (cleaned.length >= 49) break;
  }

  // Ensure minimum 10 unique relevant keywords if AI returned fewer
  if (cleaned.length < 10) {
    const seedWords = [
      ...fallbackContext.prompt.toLowerCase().split(/[\s,;]+/),
      fallbackContext.category.toLowerCase(),
      ...fallbackContext.style.toLowerCase().split(/[\s,;]+/),
      'illustration',
      'design',
      'graphic',
      'modern',
      'minimal',
      'isolated',
      'commercial',
      'creative',
      'artwork',
      'concept',
      'element',
    ];
    for (const w of seedWords) {
      const term = w.replace(/[^\w-]/g, '').trim();
      if (term.length >= 3 && !BANNED_STOCK_TERMS.has(term) && !seen.has(term)) {
        seen.add(term);
        cleaned.push(term);
      }
      if (cleaned.length >= 14) break;
    }
  }

  return cleaned.slice(0, 49);
}

function escapeCsvCell(val: string): string {
  const safe = val.replace(/\r?\n/g, ' ').trim();
  if (safe.includes(',') || safe.includes('"')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Adobe Stock Official CSV Specification:
 * Columns: Filename, Title, Keywords, Category, Releases
 */
export function buildAdobeStockCsv(assets: StockAsset[], fileExtension = 'eps'): string {
  const header = 'Filename,Title,Keywords,Category,Releases';
  const rows = assets.map((asset) => {
    const filename = `${asset.id}.${fileExtension}`;
    const title = asset.title.slice(0, 200);
    const keywords = asset.keywords.slice(0, 49).join(', ');
    const category = asset.adobeCategory || mapDefaultAdobeCategory(asset.category);
    return [
      escapeCsvCell(filename),
      escapeCsvCell(title),
      escapeCsvCell(keywords),
      escapeCsvCell(category),
      '',
    ].join(',');
  });
  return [header, ...rows].join('\n') + '\n';
}

/**
 * Shutterstock Official CSV Specification:
 * Columns: Filename, Description, Keywords, Categories, Editorial, Mature content, Illustration
 */
export function buildShutterstockCsv(assets: StockAsset[], fileExtension = 'eps'): string {
  const header = 'Filename,Description,Keywords,Categories,Editorial,Mature content,Illustration';
  const rows = assets.map((asset) => {
    const filename = `${asset.id}.${fileExtension}`;
    const description = (asset.description || asset.title).slice(0, 200);
    const keywords = asset.keywords.slice(0, 49).join(',');
    const primaryCat = asset.shutterstockCategory || mapDefaultShutterstockCategory(asset.category);
    const categories = primaryCat === 'Vectors' ? 'Vectors' : `${primaryCat},Vectors`;
    return [
      escapeCsvCell(filename),
      escapeCsvCell(description),
      escapeCsvCell(keywords),
      escapeCsvCell(categories),
      'no',
      'no',
      'yes',
    ].join(',');
  });
  return [header, ...rows].join('\n') + '\n';
}
