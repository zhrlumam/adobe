import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  BatchItem,
  BatchJob,
  DesignStyle,
  ProviderSlug,
  StockAsset,
  StockCategory,
  TargetPlatform,
} from '../src/types/stockforge.ts';
import {
  ASSETS_DIR,
  addProductionLog,
  db,
  getSettings,
  mapAssetRow,
  mapBatchRow,
} from './db.ts';
import {
  mapDefaultAdobeCategory,
  mapDefaultShutterstockCategory,
  normalizeKeywords,
} from './metadataExport.ts';
import { generateVectorAssetWithProvider } from './providers.ts';
import { sanitizeAndValidateSvg } from './svgEngine.ts';

const VARIATION_ANGLES = [
  'centered heroic emblem composition with bold silhouette',
  'dynamic diagonal split composition with layered depth planes',
  'minimalist modular grid icon arrangement with clean negative space',
  'isometric three-quarter architectural perspective with crisp facets',
  'symmetrical botanical or geometric mandala framing',
  'asymmetric editorial framing with foreground accent elements',
  'circular badge composition with balanced outer ring details',
  'layered panoramic cutaway showing internal structural components',
  'modular interlocking tessellation pattern on clean canvas',
  'sleek line-and-fill hybrid technical diagram aesthetic',
  'floating exploded-view components with directional visual rhythm',
  'organic flowing ribbons wrapping a central focal symbol',
];

const VARIATION_PALETTES = [
  'deep navy, cobalt blue, and warm amber contrast',
  'forest emerald, sage green, and terracotta highlights',
  'charcoal slate, coral red, and crisp ivory balance',
  'royal indigo, teal cyan, and soft gold accents',
  'burgundy plum, rose quartz, and slate neutral tones',
  'warm ochre, espresso brown, and seafoam accents',
  'monochrome graphite with vivid cobalt focal accent',
  'sunset tangerine, deep violet, and pale sand backdrop',
];

export function generateDistinctVariationPrompts(
  basePrompt: string,
  count: number
): string[] {
  const prompts: string[] = [];
  for (let i = 0; i < count; i++) {
    const angle = VARIATION_ANGLES[i % VARIATION_ANGLES.length];
    const palette = VARIATION_PALETTES[Math.floor(i / VARIATION_ANGLES.length) % VARIATION_PALETTES.length];
    const variantNum = i + 1;
    prompts.push(
      `${basePrompt} — Concept #${variantNum}: ${angle}, using ${palette}. Make the structure, silhouette, and arrangement distinctly different from other concepts.`
    );
  }
  return prompts;
}

export function createAssetId(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SF-${datePart}-${rand}`;
}

export async function generateAndPersistSingleAsset(params: {
  prompt: string;
  variationDirective?: string;
  category: StockCategory;
  style: DesignStyle;
  targetPlatform: TargetPlatform;
  providerSlug: ProviderSlug;
  model?: string;
  batchId?: string | null;
  checkDuplicate?: boolean;
}): Promise<{ asset: StockAsset; isDuplicate: boolean }> {
  const settings = getSettings();
  const { payload, latencyMs, modelUsed } = await generateVectorAssetWithProvider({
    providerSlug: params.providerSlug,
    model: params.model,
    prompt: params.prompt,
    category: params.category,
    style: params.style,
    targetPlatform: params.targetPlatform,
    variationDirective: params.variationDirective,
  });

  const { sanitizedSvg, validation, geometryHash } = sanitizeAndValidateSvg(
    payload.svg,
    settings.strictSanitizer
  );

  if (!validation.hasSvgRoot || !validation.validXml) {
    throw new Error(`AI output failed SVG XML validation: ${validation.issues.join(' ')}`);
  }
  if (validation.totalVectorPrimitives < 3) {
    throw new Error('Generated SVG contains too few vector primitives to qualify as commercial stock.');
  }

  let isDuplicate = false;
  if (params.checkDuplicate ?? settings.preventDuplicates) {
    const dupRow = db
      .prepare('SELECT id FROM assets WHERE svg_hash = ? LIMIT 1')
      .get(geometryHash) as { id: string } | undefined;
    if (dupRow) {
      isDuplicate = true;
    }
  }

  const id = createAssetId();
  const svgFilename = `${id}.svg`;
  const targetPath = path.join(ASSETS_DIR, svgFilename);
  fs.writeFileSync(targetPath, sanitizedSvg, 'utf8');

  const keywords = normalizeKeywords(payload.keywords, {
    prompt: params.prompt,
    category: params.category,
    style: params.style,
  });

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO assets (
      id, batch_id, prompt, category, style, target_platform,
      provider_slug, model, title, description, keywords_json,
      adobe_category, shutterstock_category, svg_filename, svg_hash,
      validation_json, width, height, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.batchId ?? null,
    params.prompt,
    params.category,
    params.style,
    params.targetPlatform,
    params.providerSlug,
    modelUsed,
    payload.title.slice(0, 200),
    payload.description.slice(0, 200),
    JSON.stringify(keywords),
    payload.adobeCategory || mapDefaultAdobeCategory(params.category),
    payload.shutterstockCategory || mapDefaultShutterstockCategory(params.category),
    svgFilename,
    geometryHash,
    JSON.stringify(validation),
    1000,
    1000,
    now,
    now
  );

  addProductionLog({
    eventType: params.batchId ? 'batch_asset_generated' : 'single_asset_generated',
    providerSlug: params.providerSlug,
    model: modelUsed,
    batchId: params.batchId ?? null,
    assetId: id,
    status: 'success',
    latencyMs,
    message: `Generated ${id} (${validation.totalVectorPrimitives} vector primitives)`,
  });

  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as Record<string, unknown>;
  return { asset: mapAssetRow(row, true), isDuplicate };
}

// Active in-memory batch cancellation & worker state
const activeBatchControllers = new Map<string, { cancelled: boolean; paused: boolean }>();

export function recoverInterruptedBatchesOnBoot(): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE batch_items SET status = 'pending', updated_at = ? WHERE status IN ('generating', 'retrying')`
  ).run(now);
  db.prepare(
    `UPDATE batches SET status = 'paused', updated_at = ? WHERE status = 'running'`
  ).run(now);
}

recoverInterruptedBatchesOnBoot();

export function createBatchJob(params: {
  name: string;
  basePrompt: string;
  category: StockCategory;
  style: DesignStyle;
  targetPlatform: TargetPlatform;
  providerSlug: ProviderSlug;
  model: string;
  requestedCount: number;
  concurrency: number;
}): BatchJob {
  const id = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto
    .randomBytes(2)
    .toString('hex')
    .toUpperCase()}`;
  const now = new Date().toISOString();
  const count = Math.min(100, Math.max(1, params.requestedCount));
  const concurrency = Math.min(4, Math.max(1, params.concurrency));

  db.prepare(
    `INSERT INTO batches (
      id, name, base_prompt, category, style, target_platform,
      provider_slug, model, requested_count, concurrency,
      status, completed_count, failed_count, duplicate_skipped_count,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, 0, 0, ?, ?)`
  ).run(
    id,
    params.name.trim() || `${params.category} Batch (${count})`,
    params.basePrompt.trim(),
    params.category,
    params.style,
    params.targetPlatform,
    params.providerSlug,
    params.model,
    count,
    concurrency,
    now,
    now
  );

  const variationPrompts = generateDistinctVariationPrompts(params.basePrompt.trim(), count);
  const insertItem = db.prepare(
    `INSERT INTO batch_items (batch_id, seq_index, variation_prompt, status, attempts, updated_at)
     VALUES (?, ?, ?, 'pending', 0, ?)`
  );
  variationPrompts.forEach((vp, idx) => {
    insertItem.run(id, idx + 1, vp, now);
  });

  addProductionLog({
    eventType: 'batch_created',
    providerSlug: params.providerSlug,
    model: params.model,
    batchId: id,
    status: 'info',
    message: `Created batch ${id} with ${count} items (concurrency ${concurrency})`,
  });

  startBatchWorker(id);
  return getBatchJob(id)!;
}

export function getBatchJob(id: string, includeItems = true): BatchJob | null {
  const row = db.prepare('SELECT * FROM batches WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;

  let items: BatchItem[] | undefined;
  if (includeItems) {
    const itemRows = db
      .prepare('SELECT * FROM batch_items WHERE batch_id = ? ORDER BY seq_index ASC')
      .all(id) as Record<string, unknown>[];
    items = itemRows.map((r) => ({
      id: Number(r.id),
      batchId: String(r.batch_id),
      seqIndex: Number(r.seq_index),
      variationPrompt: String(r.variation_prompt),
      status: r.status as BatchItem['status'],
      attempts: Number(r.attempts),
      errorMessage: r.error_message ? String(r.error_message) : null,
      assetId: r.asset_id ? String(r.asset_id) : null,
      updatedAt: String(r.updated_at),
    }));
  }
  return mapBatchRow(row, items);
}

export function listBatches(): BatchJob[] {
  const rows = db
    .prepare('SELECT * FROM batches ORDER BY created_at DESC')
    .all() as Record<string, unknown>[];
  return rows.map((r) => mapBatchRow(r));
}

export function pauseBatchJob(id: string): BatchJob | null {
  const ctrl = activeBatchControllers.get(id);
  if (ctrl) ctrl.paused = true;
  const now = new Date().toISOString();
  db.prepare(`UPDATE batches SET status = 'paused', updated_at = ? WHERE id = ? AND status IN ('running', 'queued')`).run(
    now,
    id
  );
  addProductionLog({ eventType: 'batch_paused', batchId: id, status: 'info', message: `Paused batch ${id}` });
  return getBatchJob(id);
}

export function cancelBatchJob(id: string): BatchJob | null {
  const ctrl = activeBatchControllers.get(id);
  if (ctrl) ctrl.cancelled = true;
  const now = new Date().toISOString();
  db.prepare(`UPDATE batch_items SET status = 'cancelled', updated_at = ? WHERE batch_id = ? AND status IN ('pending', 'retrying')`).run(
    now,
    id
  );
  db.prepare(`UPDATE batches SET status = 'cancelled', finished_at = ?, updated_at = ? WHERE id = ?`).run(
    now,
    now,
    id
  );
  addProductionLog({ eventType: 'batch_cancelled', batchId: id, status: 'info', message: `Cancelled batch ${id}` });
  return getBatchJob(id);
}

export function resumeBatchJob(id: string, retryFailed = false): BatchJob | null {
  const now = new Date().toISOString();
  if (retryFailed) {
    db.prepare(
      `UPDATE batch_items SET status = 'pending', error_message = NULL, updated_at = ? WHERE batch_id = ? AND status = 'failed'`
    ).run(now, id);
  }
  db.prepare(`UPDATE batches SET status = 'queued', finished_at = NULL, updated_at = ? WHERE id = ?`).run(
    now,
    id
  );
  startBatchWorker(id);
  return getBatchJob(id);
}

function syncBatchCounters(batchId: string): void {
  const stats = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
         SUM(CASE WHEN status IN ('pending', 'generating', 'retrying') THEN 1 ELSE 0 END) as remaining
       FROM batch_items WHERE batch_id = ?`
    )
    .get(batchId) as { completed: number; failed: number; remaining: number };

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE batches SET completed_count = ?, failed_count = ?, updated_at = ? WHERE id = ?`
  ).run(stats.completed ?? 0, stats.failed ?? 0, now, batchId);
}

export function startBatchWorker(batchId: string): void {
  if (activeBatchControllers.has(batchId)) return;
  const batch = getBatchJob(batchId, false);
  if (!batch) return;

  const ctrl = { cancelled: false, paused: false };
  activeBatchControllers.set(batchId, ctrl);

  const settings = getSettings();
  const maxRetries = settings.maxRetries;

  void (async () => {
    try {
      db.prepare(`UPDATE batches SET status = 'running', updated_at = ? WHERE id = ?`).run(
        new Date().toISOString(),
        batchId
      );

      const runWorker = async () => {
        while (!ctrl.cancelled && !ctrl.paused) {
          const nextItem = db
            .prepare(
              `SELECT * FROM batch_items WHERE batch_id = ? AND status = 'pending' ORDER BY seq_index ASC LIMIT 1`
            )
            .get(batchId) as Record<string, unknown> | undefined;

          if (!nextItem) break;

          const itemId = Number(nextItem.id);
          const seqIndex = Number(nextItem.seq_index);
          let attempts = Number(nextItem.attempts);

          db.prepare(`UPDATE batch_items SET status = 'generating', updated_at = ? WHERE id = ?`).run(
            new Date().toISOString(),
            itemId
          );

          let succeeded = false;
          let lastErr = '';

          while (attempts <= maxRetries && !ctrl.cancelled && !ctrl.paused) {
            attempts += 1;
            try {
              const extraSeed =
                attempts > 1 ? ` (Unique geometric rework attempt #${attempts})` : '';
              const result = await generateAndPersistSingleAsset({
                prompt: batch.basePrompt,
                variationDirective: String(nextItem.variation_prompt) + extraSeed,
                category: batch.category,
                style: batch.style,
                targetPlatform: batch.targetPlatform,
                providerSlug: batch.providerSlug,
                model: batch.model,
                batchId,
                checkDuplicate: settings.preventDuplicates,
              });

              if (result.isDuplicate && settings.preventDuplicates && attempts <= maxRetries) {
                db.prepare(
                  `UPDATE batches SET duplicate_skipped_count = duplicate_skipped_count + 1 WHERE id = ?`
                ).run(batchId);
                // Delete duplicate SVG file and DB entry before retrying
                db.prepare('DELETE FROM assets WHERE id = ?').run(result.asset.id);
                const dupPath = path.join(ASSETS_DIR, result.asset.svgFilename);
                if (fs.existsSync(dupPath)) fs.unlinkSync(dupPath);
                throw new Error('Duplicate geometry detected; regenerating distinct variation.');
              }

              db.prepare(
                `UPDATE batch_items SET status = 'completed', attempts = ?, asset_id = ?, error_message = NULL, updated_at = ? WHERE id = ?`
              ).run(attempts, result.asset.id, new Date().toISOString(), itemId);
              succeeded = true;
              break;
            } catch (err) {
              lastErr = err instanceof Error ? err.message : String(err);
              const statusCode = (err as { statusCode?: number }).statusCode;
              const retryAfterMs = (err as { retryAfterMs?: number }).retryAfterMs;

              if (attempts <= maxRetries && !ctrl.cancelled && !ctrl.paused) {
                db.prepare(
                  `UPDATE batch_items SET status = 'retrying', attempts = ?, error_message = ?, updated_at = ? WHERE id = ?`
                ).run(attempts, lastErr, new Date().toISOString(), itemId);

                const waitMs =
                  retryAfterMs ??
                  (statusCode === 429 ? 4000 * attempts : 1500 * Math.pow(2, attempts - 1));
                await new Promise((r) => setTimeout(r, Math.min(waitMs, 20000)));
              }
            }
          }

          if (!succeeded && !ctrl.cancelled && !ctrl.paused) {
            db.prepare(
              `UPDATE batch_items SET status = 'failed', attempts = ?, error_message = ?, updated_at = ? WHERE id = ?`
            ).run(attempts, lastErr, new Date().toISOString(), itemId);

            addProductionLog({
              eventType: 'batch_item_failed',
              providerSlug: batch.providerSlug,
              model: batch.model,
              batchId,
              status: 'error',
              message: `Item #${seqIndex} failed after ${attempts} attempts: ${lastErr}`,
            });
          }

          syncBatchCounters(batchId);
        }
      };

      const workers = Array.from({ length: batch.concurrency }, () => runWorker());
      await Promise.all(workers);

      syncBatchCounters(batchId);
      const updated = getBatchJob(batchId, false);
      if (updated) {
        const now = new Date().toISOString();
        if (ctrl.cancelled) {
          db.prepare(`UPDATE batches SET status = 'cancelled', finished_at = ?, updated_at = ? WHERE id = ?`).run(
            now,
            now,
            batchId
          );
        } else if (ctrl.paused) {
          db.prepare(`UPDATE batches SET status = 'paused', updated_at = ? WHERE id = ?`).run(now, batchId);
        } else {
          const finalStatus =
            updated.completedCount === 0 && updated.failedCount > 0 ? 'failed' : 'completed';
          db.prepare(`UPDATE batches SET status = ?, finished_at = ?, updated_at = ? WHERE id = ?`).run(
            finalStatus,
            now,
            now,
            batchId
          );
          addProductionLog({
            eventType: 'batch_finished',
            providerSlug: batch.providerSlug,
            model: batch.model,
            batchId,
            status: finalStatus === 'failed' ? 'error' : 'success',
            message: `Batch ${batchId} ${finalStatus}: ${updated.completedCount} completed, ${updated.failedCount} failed`,
          });
        }
      }
    } finally {
      activeBatchControllers.delete(batchId);
    }
  })();
}
