import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';
import {
  ASSETS_DIR,
  BACKUPS_DIR,
  addProductionLog,
  db,
  getRecentLogs,
  getSettings,
  getStorageBytes,
  mapAssetRow,
  resolveSafeAssetPath,
  saveSettings,
} from './server/db.ts';
import { createLocalBackupArchive, listLocalBackups } from './server/backup.ts';
import {
  cancelBatchJob,
  createBatchJob,
  generateAndPersistSingleAsset,
  generateDistinctVariationPrompts,
  getBatchJob,
  listBatches,
  pauseBatchJob,
  resumeBatchJob,
} from './server/batchRunner.ts';
import {
  ADOBE_STOCK_CATEGORIES,
  SHUTTERSTOCK_CATEGORIES,
  buildAdobeStockCsv,
  buildShutterstockCsv,
  normalizeKeywords,
} from './server/metadataExport.ts';
import {
  getActiveProvider,
  getProviderBySlug,
  listProviders,
  regenerateMetadataWithProvider,
  setActiveProvider,
  testProviderConnection,
  updateProviderConfig,
} from './server/providers.ts';
import {
  convertSvgToVectorEps,
  renderSvgToJpgBuffer,
  renderSvgToPngBuffer,
  sanitizeAndValidateSvg,
} from './server/svgEngine.ts';
import type {
  DashboardSummary,
  DesignStyle,
  ProviderSlug,
  StockAsset,
  StockCategory,
  TargetPlatform,
} from './src/types/stockforge.ts';

dotenv.config();

const VALID_CATEGORIES = new Set<StockCategory>([
  'Abstract',
  'Business',
  'Technology',
  'Education',
  'Animals',
  'Nature',
  'Food',
  'Medical',
  'Objects',
  'Backgrounds',
  'Icons',
  'Patterns',
  'Custom',
]);

const VALID_STYLES = new Set<DesignStyle>([
  'Flat Geometric',
  'Isometric Vector',
  'Minimal Line Art',
  'Duotone Editorial',
  'Organic Botanical',
  'Gradient Mesh Vector',
  'Bold Emblem',
  'Technical Blueprint',
]);

const VALID_PLATFORMS = new Set<TargetPlatform>(['both', 'adobe_stock', 'shutterstock']);
const VALID_PROVIDERS = new Set<ProviderSlug>([
  'gemini',
  'groq',
  'openrouter',
  'mistral',
  'huggingface',
  'ollama',
  'custom',
]);

function sanitizeDownloadName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'stockforge-asset';
}

function getSafeSvgForAsset(asset: StockAsset): string {
  const filePath = resolveSafeAssetPath(asset.svgFilename);
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`SVG file missing from local storage: ${asset.svgFilename}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const row = db.prepare('SELECT COUNT(*) as c FROM assets').get() as { c: number };
    res.json({ ok: true, database: 'sqlite', assetCount: row.c });
  });

  app.get('/api/dashboard', (_req: Request, res: Response) => {
    const totalAssets = (db.prepare('SELECT COUNT(*) as c FROM assets').get() as { c: number }).c;
    const allAssetRows = db
      .prepare('SELECT * FROM assets ORDER BY created_at DESC')
      .all() as Record<string, unknown>[];
    const allAssets = allAssetRows.map((r) => mapAssetRow(r, false));
    const commercialReadyAssets = allAssets.filter((a) => a.validation.commercialReady).length;

    const totalBatches = (db.prepare('SELECT COUNT(*) as c FROM batches').get() as { c: number }).c;
    const runningBatches = (
      db
        .prepare(`SELECT COUNT(*) as c FROM batches WHERE status IN ('running', 'queued')`)
        .get() as { c: number }
    ).c;

    const providers = listProviders();
    const connectedProviders = providers.filter((p) => p.status === 'connected').length;
    const active = getActiveProvider();

    const recentAssets = allAssetRows.slice(0, 6).map((r) => mapAssetRow(r, true));
    const categoryRows = db
      .prepare('SELECT category, COUNT(*) as count FROM assets GROUP BY category ORDER BY count DESC')
      .all() as { category: string; count: number }[];

    const summary: DashboardSummary = {
      totalAssets,
      commercialReadyAssets,
      totalBatches,
      runningBatches,
      connectedProviders,
      activeProvider: active
        ? {
            slug: active.slug,
            name: active.name,
            model: active.selectedModel,
            status: active.status,
          }
        : null,
      storageBytes: getStorageBytes(),
      recentAssets,
      recentLogs: getRecentLogs(12),
      categoryBreakdown: categoryRows,
    };
    res.json(summary);
  });

  // --- Providers ---
  app.get('/api/providers', (_req: Request, res: Response) => {
    res.json({ providers: listProviders() });
  });

  app.post('/api/providers/:slug/config', async (req: Request, res: Response) => {
    try {
      const slug = req.params.slug as ProviderSlug;
      if (!VALID_PROVIDERS.has(slug)) {
        return res.status(400).json({ error: 'Invalid provider slug' });
      }
      const { apiKey, clearApiKey, baseUrl, selectedModel, validateBeforeSave } = req.body ?? {};

      if (validateBeforeSave && typeof apiKey === 'string' && apiKey.trim().length > 0) {
        const testRes = await testProviderConnection(slug, apiKey.trim(), baseUrl, selectedModel);
        if (!testRes.ok) {
          return res.status(400).json({
            error: `Validation failed: ${testRes.error}`,
            testResult: testRes,
          });
        }
      }

      const updated = updateProviderConfig({
        slug,
        apiKey: typeof apiKey === 'string' ? apiKey : undefined,
        clearApiKey: Boolean(clearApiKey),
        baseUrl: typeof baseUrl === 'string' ? baseUrl : undefined,
        selectedModel: typeof selectedModel === 'string' ? selectedModel : undefined,
      });

      addProductionLog({
        eventType: 'provider_configured',
        providerSlug: slug,
        model: updated.selectedModel,
        status: 'info',
        message: `Updated configuration for ${updated.name}`,
      });

      res.json({ provider: updated });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/providers/:slug/test', async (req: Request, res: Response) => {
    try {
      const slug = req.params.slug as ProviderSlug;
      if (!VALID_PROVIDERS.has(slug)) {
        return res.status(400).json({ error: 'Invalid provider slug' });
      }
      const { apiKey, baseUrl, selectedModel } = req.body ?? {};
      const result = await testProviderConnection(slug, apiKey, baseUrl, selectedModel);
      res.status(result.ok ? 200 : 400).json({
        ...result,
        provider: getProviderBySlug(slug),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/providers/:slug/activate', (req: Request, res: Response) => {
    try {
      const slug = req.params.slug as ProviderSlug;
      if (!VALID_PROVIDERS.has(slug)) {
        return res.status(400).json({ error: 'Invalid provider slug' });
      }
      const provider = setActiveProvider(slug);
      res.json({ provider, providers: listProviders() });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // --- Single / Multi-Variation Generation ---
  app.post('/api/generate', async (req: Request, res: Response) => {
    try {
      const {
        prompt,
        category = 'Abstract',
        style = 'Flat Geometric',
        quantity = 1,
        targetPlatform = 'both',
        providerSlug,
        model,
      } = req.body ?? {};

      if (typeof prompt !== 'string' || prompt.trim().length < 3) {
        return res.status(400).json({ error: 'Prompt must be at least 3 characters long.' });
      }
      if (!VALID_CATEGORIES.has(category)) {
        return res.status(400).json({ error: 'Invalid category selected.' });
      }
      if (!VALID_STYLES.has(style)) {
        return res.status(400).json({ error: 'Invalid design style selected.' });
      }
      if (!VALID_PLATFORMS.has(targetPlatform)) {
        return res.status(400).json({ error: 'Invalid target platform.' });
      }

      const qty = Math.min(5, Math.max(1, Number(quantity) || 1));
      const active = providerSlug && VALID_PROVIDERS.has(providerSlug)
        ? getProviderBySlug(providerSlug)
        : getActiveProvider();

      const variations =
        qty > 1 ? generateDistinctVariationPrompts(prompt.trim(), qty) : [undefined];

      const generatedAssets: StockAsset[] = [];
      const errors: string[] = [];

      for (let i = 0; i < qty; i++) {
        try {
          const { asset } = await generateAndPersistSingleAsset({
            prompt: prompt.trim(),
            variationDirective: variations[i],
            category,
            style,
            targetPlatform,
            providerSlug: active.slug,
            model: typeof model === 'string' && model.trim() ? model.trim() : active.selectedModel,
            checkDuplicate: true,
          });
          generatedAssets.push(asset);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(msg);
          addProductionLog({
            eventType: 'single_asset_failed',
            providerSlug: active.slug,
            model: model || active.selectedModel,
            status: 'error',
            message: msg,
          });
        }
      }

      if (generatedAssets.length === 0) {
        return res.status(422).json({
          error: errors[0] || 'AI generation failed.',
          errors,
        });
      }

      res.json({ assets: generatedAssets, errors });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // --- Assets CRUD & Validation ---
  app.get('/api/assets', (req: Request, res: Response) => {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const category = String(req.query.category ?? 'all');
    const style = String(req.query.style ?? 'all');
    const platform = String(req.query.platform ?? 'all');
    const batchId = String(req.query.batchId ?? '');
    const status = String(req.query.status ?? 'all');

    const rows = db
      .prepare('SELECT * FROM assets ORDER BY created_at DESC')
      .all() as Record<string, unknown>[];

    let assets = rows.map((r) => mapAssetRow(r, true));

    if (category !== 'all') {
      assets = assets.filter((a) => a.category === category);
    }
    if (style !== 'all') {
      assets = assets.filter((a) => a.style === style);
    }
    if (platform !== 'all') {
      assets = assets.filter((a) => a.targetPlatform === platform || a.targetPlatform === 'both');
    }
    if (batchId) {
      assets = assets.filter((a) => a.batchId === batchId);
    }
    if (status === 'ready') {
      assets = assets.filter((a) => a.validation.commercialReady);
    } else if (status === 'issues') {
      assets = assets.filter((a) => !a.validation.commercialReady);
    }
    if (q) {
      assets = assets.filter(
        (a) =>
          a.id.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q) ||
          a.prompt.toLowerCase().includes(q) ||
          a.keywords.some((k) => k.toLowerCase().includes(q))
      );
    }

    res.json({
      assets,
      adobeCategories: ADOBE_STOCK_CATEGORIES,
      shutterstockCategories: SHUTTERSTOCK_CATEGORIES,
    });
  });

  app.get('/api/assets/:id', (req: Request, res: Response) => {
    const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return res.status(404).json({ error: 'Asset not found' });
    res.json({ asset: mapAssetRow(row, true) });
  });

  app.patch('/api/assets/:id', (req: Request, res: Response) => {
    const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return res.status(404).json({ error: 'Asset not found' });

    const existing = mapAssetRow(row, true);
    const {
      title,
      description,
      keywords,
      adobeCategory,
      shutterstockCategory,
      targetPlatform,
      svgContent,
    } = req.body ?? {};

    let nextSvgHash = existing.svgHash;
    let nextValidation = existing.validation;

    if (typeof svgContent === 'string' && svgContent.trim()) {
      const settings = getSettings();
      const result = sanitizeAndValidateSvg(svgContent, settings.strictSanitizer);
      if (!result.validation.hasSvgRoot || !result.validation.validXml) {
        return res.status(400).json({
          error: 'Updated SVG failed XML validation',
          issues: result.validation.issues,
        });
      }
      const filePath = resolveSafeAssetPath(existing.svgFilename);
      if (filePath) {
        fs.writeFileSync(filePath, result.sanitizedSvg, 'utf8');
      }
      nextSvgHash = result.geometryHash;
      nextValidation = result.validation;
    }

    const nextKeywords = Array.isArray(keywords)
      ? normalizeKeywords(keywords.map(String), {
          prompt: existing.prompt,
          category: existing.category,
          style: existing.style,
        })
      : existing.keywords;

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE assets
       SET title = ?, description = ?, keywords_json = ?,
           adobe_category = ?, shutterstock_category = ?, target_platform = ?,
           svg_hash = ?, validation_json = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      typeof title === 'string' && title.trim() ? title.trim().slice(0, 200) : existing.title,
      typeof description === 'string' ? description.trim().slice(0, 200) : existing.description,
      JSON.stringify(nextKeywords),
      typeof adobeCategory === 'string' && adobeCategory.trim()
        ? adobeCategory.trim()
        : existing.adobeCategory,
      typeof shutterstockCategory === 'string' && shutterstockCategory.trim()
        ? shutterstockCategory.trim()
        : existing.shutterstockCategory,
      VALID_PLATFORMS.has(targetPlatform) ? targetPlatform : existing.targetPlatform,
      nextSvgHash,
      JSON.stringify(nextValidation),
      now,
      existing.id
    );

    const updatedRow = db.prepare('SELECT * FROM assets WHERE id = ?').get(existing.id) as Record<
      string,
      unknown
    >;
    res.json({ asset: mapAssetRow(updatedRow, true) });
  });

  app.post('/api/assets/:id/regenerate-metadata', async (req: Request, res: Response) => {
    try {
      const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id) as
        | Record<string, unknown>
        | undefined;
      if (!row) return res.status(404).json({ error: 'Asset not found' });

      const asset = mapAssetRow(row, true);
      const svg = getSafeSvgForAsset(asset);
      const active = getActiveProvider();

      const fresh = await regenerateMetadataWithProvider({
        providerSlug: active.slug,
        model: active.selectedModel,
        prompt: asset.prompt,
        category: asset.category,
        style: asset.style,
        svg,
      });

      const keywords = normalizeKeywords(fresh.keywords, {
        prompt: asset.prompt,
        category: asset.category,
        style: asset.style,
      });

      const now = new Date().toISOString();
      db.prepare(
        `UPDATE assets
         SET title = ?, description = ?, keywords_json = ?,
             adobe_category = ?, shutterstock_category = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        fresh.title.slice(0, 200),
        fresh.description.slice(0, 200),
        JSON.stringify(keywords),
        fresh.adobeCategory,
        fresh.shutterstockCategory,
        now,
        asset.id
      );

      const updatedRow = db.prepare('SELECT * FROM assets WHERE id = ?').get(asset.id) as Record<
        string,
        unknown
      >;
      res.json({ asset: mapAssetRow(updatedRow, true) });
    } catch (err) {
      res.status(422).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/assets/:id', (req: Request, res: Response) => {
    const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return res.status(404).json({ error: 'Asset not found' });

    const asset = mapAssetRow(row, false);
    const filePath = resolveSafeAssetPath(asset.svgFilename);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    db.prepare('DELETE FROM assets WHERE id = ?').run(asset.id);
    addProductionLog({
      eventType: 'asset_deleted',
      assetId: asset.id,
      status: 'info',
      message: `Deleted asset ${asset.id}`,
    });
    res.json({ ok: true });
  });

  // --- Single Asset Real File Export (SVG / EPS / PNG / JPG) ---
  app.get('/api/assets/:id/export/:format', async (req: Request, res: Response) => {
    try {
      const format = String(req.params.format).toLowerCase();
      if (!['svg', 'eps', 'png', 'jpg'].includes(format)) {
        return res.status(400).json({ error: 'Unsupported export format. Use svg, eps, png, or jpg.' });
      }
      const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id) as
        | Record<string, unknown>
        | undefined;
      if (!row) return res.status(404).json({ error: 'Asset not found' });

      const asset = mapAssetRow(row, false);
      const svg = getSafeSvgForAsset(asset);
      const settings = getSettings();
      const size = Math.min(
        8000,
        Math.max(512, Number(req.query.size) || settings.exportRasterSize)
      );
      const quality = Math.min(
        100,
        Math.max(60, Number(req.query.quality) || settings.exportJpgQuality)
      );

      const safeFilename = sanitizeDownloadName(asset.id);

      if (format === 'svg') {
        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.svg"`);
        return res.send(svg);
      }

      if (format === 'eps') {
        const eps = convertSvgToVectorEps(svg, settings.epsArtboardSize, asset.title);
        res.setHeader('Content-Type', 'application/postscript');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.eps"`);
        return res.send(eps);
      }

      if (format === 'png') {
        const pngBuffer = await renderSvgToPngBuffer(svg, size);
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.png"`);
        return res.send(pngBuffer);
      }

      const jpgBuffer = await renderSvgToJpgBuffer(svg, size, quality);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.jpg"`);
      return res.send(jpgBuffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // --- Multi-Asset Bundle ZIP & CSV Export ---
  app.post('/api/export/csv', (req: Request, res: Response) => {
    const { assetIds, batchId, platform = 'adobe_stock', fileExtension = 'eps' } = req.body ?? {};
    let rows: Record<string, unknown>[] = [];
    if (Array.isArray(assetIds) && assetIds.length > 0) {
      const placeholders = assetIds.map(() => '?').join(',');
      rows = db
        .prepare(`SELECT * FROM assets WHERE id IN (${placeholders}) ORDER BY created_at DESC`)
        .all(...assetIds.map(String)) as Record<string, unknown>[];
    } else if (typeof batchId === 'string' && batchId.trim()) {
      rows = db
        .prepare('SELECT * FROM assets WHERE batch_id = ? ORDER BY created_at DESC')
        .all(batchId.trim()) as Record<string, unknown>[];
    } else {
      rows = db
        .prepare('SELECT * FROM assets ORDER BY created_at DESC')
        .all() as Record<string, unknown>[];
    }

    const assets = rows.map((r) => mapAssetRow(r, false));
    const ext = ['svg', 'eps', 'png', 'jpg'].includes(String(fileExtension))
      ? String(fileExtension)
      : 'eps';

    if (platform === 'shutterstock') {
      const csv = buildShutterstockCsv(assets, ext);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="shutterstock-metadata.csv"');
      return res.send(csv);
    }

    const csv = buildAdobeStockCsv(assets, ext);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="adobe-stock-metadata.csv"');
    return res.send(csv);
  });

  app.post('/api/export/bundle', async (req: Request, res: Response) => {
    try {
      const {
        assetIds,
        batchId,
        formats = ['svg', 'eps'],
        includeAdobeCsv = true,
        includeShutterstockCsv = true,
        rasterSize,
        jpgQuality,
      } = req.body ?? {};

      let rows: Record<string, unknown>[] = [];
      if (Array.isArray(assetIds) && assetIds.length > 0) {
        const placeholders = assetIds.map(() => '?').join(',');
        rows = db
          .prepare(`SELECT * FROM assets WHERE id IN (${placeholders}) ORDER BY created_at DESC`)
          .all(...assetIds.map(String)) as Record<string, unknown>[];
      } else if (typeof batchId === 'string' && batchId.trim()) {
        rows = db
          .prepare('SELECT * FROM assets WHERE batch_id = ? ORDER BY created_at DESC')
          .all(batchId.trim()) as Record<string, unknown>[];
      } else {
        rows = db
          .prepare('SELECT * FROM assets ORDER BY created_at DESC')
          .all() as Record<string, unknown>[];
      }

      const assets = rows.map((r) => mapAssetRow(r, false));
      if (assets.length === 0) {
        return res.status(400).json({ error: 'No matching assets found to export.' });
      }

      const settings = getSettings();
      const size = Math.min(8000, Math.max(512, Number(rasterSize) || settings.exportRasterSize));
      const quality = Math.min(100, Math.max(60, Number(jpgQuality) || settings.exportJpgQuality));
      const requestedFormats = Array.isArray(formats)
        ? formats.filter((f: string) => ['svg', 'eps', 'png', 'jpg'].includes(f))
        : ['svg', 'eps'];

      const zip = new JSZip();
      for (const asset of assets) {
        const svg = getSafeSvgForAsset(asset);
        const safeName = sanitizeDownloadName(asset.id);
        if (requestedFormats.includes('svg')) {
          zip.file(`svg/${safeName}.svg`, svg);
        }
        if (requestedFormats.includes('eps')) {
          zip.file(
            `eps/${safeName}.eps`,
            convertSvgToVectorEps(svg, settings.epsArtboardSize, asset.title)
          );
        }
        if (requestedFormats.includes('png')) {
          const png = await renderSvgToPngBuffer(svg, size);
          zip.file(`png/${safeName}.png`, png);
        }
        if (requestedFormats.includes('jpg')) {
          const jpg = await renderSvgToJpgBuffer(svg, size, quality);
          zip.file(`jpg/${safeName}.jpg`, jpg);
        }
      }

      if (includeAdobeCsv) {
        zip.file('metadata/adobe-stock.csv', buildAdobeStockCsv(assets, 'eps'));
      }
      if (includeShutterstockCsv) {
        zip.file('metadata/shutterstock.csv', buildShutterstockCsv(assets, 'eps'));
      }

      const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      const bundleName = batchId
        ? `${sanitizeDownloadName(batchId)}-bundle.zip`
        : `stockforge-export-${assets.length}-assets.zip`;

      addProductionLog({
        eventType: 'export_bundle',
        batchId: batchId || null,
        status: 'success',
        message: `Exported ZIP bundle (${assets.length} assets, formats: ${requestedFormats.join(', ')})`,
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${bundleName}"`);
      res.send(zipBuf);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // --- Batch Production ---
  app.get('/api/batches', (_req: Request, res: Response) => {
    res.json({ batches: listBatches() });
  });

  app.post('/api/batches', (req: Request, res: Response) => {
    try {
      const {
        name,
        basePrompt,
        category = 'Abstract',
        style = 'Flat Geometric',
        targetPlatform = 'both',
        requestedCount = 10,
        concurrency = 2,
        providerSlug,
        model,
      } = req.body ?? {};

      if (typeof basePrompt !== 'string' || basePrompt.trim().length < 3) {
        return res.status(400).json({ error: 'Base prompt must be at least 3 characters.' });
      }
      if (!VALID_CATEGORIES.has(category)) {
        return res.status(400).json({ error: 'Invalid category.' });
      }
      if (!VALID_STYLES.has(style)) {
        return res.status(400).json({ error: 'Invalid design style.' });
      }
      if (!VALID_PLATFORMS.has(targetPlatform)) {
        return res.status(400).json({ error: 'Invalid target platform.' });
      }

      const active =
        providerSlug && VALID_PROVIDERS.has(providerSlug)
          ? getProviderBySlug(providerSlug)
          : getActiveProvider();

      if (active.catalog.requiresApiKey && !active.hasKey) {
        return res.status(400).json({
          error: `Provider "${active.name}" requires a configured API key before starting a batch.`,
        });
      }

      const batch = createBatchJob({
        name: typeof name === 'string' ? name : `${category} Batch`,
        basePrompt,
        category,
        style,
        targetPlatform,
        providerSlug: active.slug,
        model: typeof model === 'string' && model.trim() ? model.trim() : active.selectedModel,
        requestedCount: Number(requestedCount) || 10,
        concurrency: Number(concurrency) || 2,
      });

      res.status(201).json({ batch });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/batches/:id', (req: Request, res: Response) => {
    const batch = getBatchJob(req.params.id, true);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json({ batch });
  });

  app.post('/api/batches/:id/pause', (req: Request, res: Response) => {
    const batch = pauseBatchJob(req.params.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json({ batch });
  });

  app.post('/api/batches/:id/resume', (req: Request, res: Response) => {
    const retryFailed = Boolean(req.body?.retryFailed);
    const batch = resumeBatchJob(req.params.id, retryFailed);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json({ batch });
  });

  app.post('/api/batches/:id/cancel', (req: Request, res: Response) => {
    const batch = cancelBatchJob(req.params.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.json({ batch });
  });

  // --- Production Logs & Settings & Backups ---
  app.get('/api/logs', (req: Request, res: Response) => {
    const limit = Math.min(500, Math.max(10, Number(req.query.limit) || 150));
    res.json({ logs: getRecentLogs(limit) });
  });

  app.get('/api/settings', (_req: Request, res: Response) => {
    res.json({
      settings: getSettings(),
      storageBytes: getStorageBytes(),
      assetsDir: ASSETS_DIR,
    });
  });

  app.put('/api/settings', (req: Request, res: Response) => {
    const next = saveSettings(req.body ?? {});
    addProductionLog({
      eventType: 'settings_updated',
      status: 'info',
      message: `Updated system settings (raster ${next.exportRasterSize}px, concurrency ${next.defaultConcurrency})`,
    });
    res.json({ settings: next });
  });

  app.get('/api/backups', (_req: Request, res: Response) => {
    res.json({ backups: listLocalBackups() });
  });

  app.post('/api/backups', async (_req: Request, res: Response) => {
    try {
      const backup = await createLocalBackupArchive();
      res.status(201).json({
        backup: {
          filename: backup.filename,
          sizeBytes: backup.buffer.length,
          assetCount: backup.assetCount,
        },
        backups: listLocalBackups(),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/backups/:filename', (req: Request, res: Response) => {
    const clean = path.basename(req.params.filename).replace(/[^a-zA-Z0-9._-]/g, '');
    if (!clean || clean !== req.params.filename || !clean.endsWith('.zip')) {
      return res.status(400).json({ error: 'Invalid backup filename' });
    }
    const target = path.resolve(BACKUPS_DIR, clean);
    if (!target.startsWith(BACKUPS_DIR + path.sep) || !fs.existsSync(target)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${clean}"`);
    res.sendFile(target);
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  app.use((err: unknown, req: Request, res: Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api')) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: msg });
    }
    return next(err);
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StockForge Studio server running at http://0.0.0.0:${PORT}`);
  });
}

// Only bind port when executed directly as entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('server.ts')) {
  void startServer();
}
