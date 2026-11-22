import crypto from 'node:crypto';
import type {
  AnimationBatchItem,
  AnimationBatchJob,
  AnimationCategory,
  AnimationExportFormat,
  AnimationProject,
  AnimationType,
  BackgroundMode,
  FpsOption,
  ProviderSlug,
  ResolutionPreset,
  VisualStyle,
} from '../src/types/stockforge.js';
import {
  CATEGORY_ANIMATION_TYPES,
  buildProceduralAnimationProject,
  computeProjectHash,
  inferAnimationTypeFromPrompt,
} from './animationEngine.js';
import { addProductionLog, db, getSettings, mapAnimationBatchRow } from './db.js';
import { generateAnimationSpecWithProvider } from './providers.js';
import { renderAndValidateAnimationProject } from './renderPipeline.js';

const MOTION_DIRECTIONS: Array<'up' | 'down' | 'left' | 'right' | 'radial'> = [
  'radial',
  'up',
  'right',
  'left',
  'down',
];

const VARIATION_DIRECTIVES = [
  'sweeping orbital flow with dynamic velocity easing',
  'central focal surge with radiating secondary motion',
  'asymmetric diagonal drift with staggered layer timing',
  'layered rhythmic pulse with alternating foreground speed',
  'expanding wave cadence with crisp highlight accents',
  'precision kinetic sweep with multi-stage deceleration',
  'organic counter-rotating layers with depth parallax',
  'high-contrast broadcast reveal with elastic spring settling',
];

export function createAnimationProjectId(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SFA-${datePart}-${rand}`;
}

export function createAnimationBatchId(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `ABATCH-${datePart}-${rand}`;
}

export function recoverInterruptedAnimationBatchesOnBoot(): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE animation_batch_items SET status = 'pending', updated_at = ? WHERE status IN ('generating', 'retrying')`
  ).run(now);
  db.prepare(
    `UPDATE animation_batches SET status = 'paused', updated_at = ? WHERE status = 'running'`
  ).run(now);
}

recoverInterruptedAnimationBatchesOnBoot();

const activeAnimationBatchControllers = new Map<string, { cancelled: boolean; paused: boolean }>();

export function buildDistinctBatchItemSpecs(params: {
  basePrompt: string;
  category: AnimationCategory;
  animationType: AnimationType | 'mixed';
  requestedCount: number;
}): Array<{ seqIndex: number; variationPrompt: string; animationType: AnimationType }> {
  const categoryTypes = CATEGORY_ANIMATION_TYPES[params.category] ?? ['geometric_motion'];
  const items: Array<{ seqIndex: number; variationPrompt: string; animationType: AnimationType }> = [];

  for (let i = 0; i < params.requestedCount; i++) {
    const resolvedType: AnimationType =
      params.animationType === 'mixed'
        ? categoryTypes[i % categoryTypes.length]
        : inferAnimationTypeFromPrompt(params.basePrompt, params.category, params.animationType);
    const directive = VARIATION_DIRECTIVES[i % VARIATION_DIRECTIVES.length];
    const dirTag = MOTION_DIRECTIONS[i % MOTION_DIRECTIONS.length];
    const variationPrompt = `${params.basePrompt.trim()} — Variation #${i + 1} (${resolvedType.replace(/_/g, ' ')}, ${directive}, flow=${dirTag})`;
    items.push({
      seqIndex: i + 1,
      variationPrompt,
      animationType: resolvedType,
    });
  }
  return items;
}

function applyUniqueCompositionVariation(
  project: AnimationProject,
  seqIndex: number,
  seed: number
): AnimationProject {
  const dir = MOTION_DIRECTIONS[(seqIndex - 1) % MOTION_DIRECTIONS.length];
  const speedScale = 0.85 + ((seqIndex % 5) * 0.14);
  const countDelta = (seqIndex % 7) - 3;
  const xShift = ((seqIndex % 5) - 2) * (project.width * 0.035);
  const yShift = (((seqIndex + 2) % 5) - 2) * (project.height * 0.03);
  const rotOffset = ((seqIndex - 1) * 23) % 360;

  const layers = project.layers.map((layer, lIdx) => {
    const baseCount = layer.params.count ?? 12;
    const baseSpeed = layer.params.speed ?? 1.0;
    const nextKeyframes = layer.keyframes.map((kf, kIdx) => ({
      ...kf,
      x: Math.max(
        project.width * 0.08,
        Math.min(project.width * 0.92, kf.x + (kIdx > 0 ? xShift : -xShift * 0.5))
      ),
      y: Math.max(
        project.height * 0.08,
        Math.min(project.height * 0.92, kf.y + (kIdx > 0 ? yShift : -yShift * 0.5))
      ),
      rotation: kf.rotation + (lIdx % 2 === 0 ? rotOffset * 0.15 : -rotOffset * 0.12),
    }));

    return {
      ...layer,
      params: {
        ...layer.params,
        seed: seed + lIdx * 101 + seqIndex * 17,
        direction: dir,
        speed: Number(Math.max(0.5, Math.min(2.6, baseSpeed * speedScale)).toFixed(2)),
        count: Math.max(2, Math.min(48, baseCount + countDelta)),
      },
      keyframes: nextKeyframes,
    };
  });

  const updated: AnimationProject = {
    ...project,
    layers,
  };
  updated.projectHash = computeProjectHash(updated);
  return updated;
}

export function createAnimationBatchJob(params: {
  name: string;
  basePrompt: string;
  category: AnimationCategory;
  animationType: AnimationType | 'mixed';
  visualStyle: VisualStyle;
  backgroundMode: BackgroundMode;
  resolution: ResolutionPreset;
  durationSec: number;
  fps: FpsOption;
  providerSlug: ProviderSlug | 'procedural';
  model: string;
  requestedCount: number;
  concurrency: number;
  exportFormats: AnimationExportFormat[];
  autoStart?: boolean;
}): AnimationBatchJob {
  const id = createAnimationBatchId();
  const now = new Date().toISOString();
  const count = Math.min(100, Math.max(1, Math.round(Number(params.requestedCount) || 5)));
  const concurrency = Math.min(4, Math.max(1, Math.round(Number(params.concurrency) || 2)));
  const formats: AnimationExportFormat[] =
    params.exportFormats && params.exportFormats.length > 0
      ? params.exportFormats
      : [
          'mp4_h264',
          'mp4_preview',
          'gif_preview',
          'thumbnail_png',
          'svg_animated',
          'lottie_json',
          'source_zip',
          ...(params.backgroundMode === 'transparent'
            ? (['mov_alpha', 'png_sequence'] as AnimationExportFormat[])
            : []),
        ];

  db.prepare(
    `INSERT INTO animation_batches (
      id, name, base_prompt, category, animation_type, visual_style,
      background_mode, resolution, duration_sec, fps, provider_slug, model,
      requested_count, concurrency, export_formats_json, status,
      completed_count, failed_count, duplicate_skipped_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, 0, 0, ?, ?)`
  ).run(
    id,
    params.name.trim() || `${params.category} Animation Batch (${count})`,
    params.basePrompt.trim(),
    params.category,
    params.animationType,
    params.visualStyle,
    params.backgroundMode,
    params.resolution,
    params.durationSec,
    params.fps,
    params.providerSlug,
    params.model,
    count,
    concurrency,
    JSON.stringify(formats),
    now,
    now
  );

  const items = buildDistinctBatchItemSpecs({
    basePrompt: params.basePrompt,
    category: params.category,
    animationType: params.animationType,
    requestedCount: count,
  });

  const insertItem = db.prepare(
    `INSERT INTO animation_batch_items (batch_id, seq_index, variation_prompt, animation_type, status, attempts, updated_at)
     VALUES (?, ?, ?, ?, 'pending', 0, ?)`
  );
  for (const item of items) {
    insertItem.run(id, item.seqIndex, item.variationPrompt, item.animationType, now);
  }

  addProductionLog({
    eventType: 'animation_batch_created',
    providerSlug: params.providerSlug,
    model: params.model,
    batchId: id,
    status: 'info',
    message: `Created animation batch ${id} (${count} assets, ${params.resolution} @ ${params.fps}fps)`,
  });

  if (params.autoStart !== false) {
    startAnimationBatchWorker(id);
  }
  return getAnimationBatchJob(id, true)!;
}

export function getAnimationBatchJob(id: string, includeItems = true): AnimationBatchJob | null {
  const row = db.prepare('SELECT * FROM animation_batches WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;

  let items: AnimationBatchItem[] | undefined;
  if (includeItems) {
    const itemRows = db
      .prepare('SELECT * FROM animation_batch_items WHERE batch_id = ? ORDER BY seq_index ASC')
      .all(id) as Record<string, unknown>[];
    items = itemRows.map((r) => ({
      id: Number(r.id),
      batchId: String(r.batch_id),
      seqIndex: Number(r.seq_index),
      variationPrompt: String(r.variation_prompt),
      animationType: r.animation_type as AnimationType,
      status: r.status as AnimationBatchItem['status'],
      attempts: Number(r.attempts),
      errorMessage: r.error_message ? String(r.error_message) : null,
      projectId: r.project_id ? String(r.project_id) : null,
      updatedAt: String(r.updated_at),
    }));
  }

  return mapAnimationBatchRow(row, items);
}

export function listAnimationBatches(): AnimationBatchJob[] {
  const rows = db
    .prepare('SELECT * FROM animation_batches ORDER BY created_at DESC')
    .all() as Record<string, unknown>[];
  return rows.map((r) => mapAnimationBatchRow(r));
}

export function pauseAnimationBatchJob(id: string): AnimationBatchJob | null {
  const ctrl = activeAnimationBatchControllers.get(id);
  if (ctrl) ctrl.paused = true;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE animation_batches SET status = 'paused', updated_at = ? WHERE id = ? AND status IN ('running', 'queued')`
  ).run(now, id);
  addProductionLog({
    eventType: 'animation_batch_paused',
    batchId: id,
    status: 'info',
    message: `Paused animation batch ${id}`,
  });
  return getAnimationBatchJob(id, true);
}

export function cancelAnimationBatchJob(id: string): AnimationBatchJob | null {
  const ctrl = activeAnimationBatchControllers.get(id);
  if (ctrl) ctrl.cancelled = true;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE animation_batch_items SET status = 'cancelled', updated_at = ? WHERE batch_id = ? AND status IN ('pending', 'retrying')`
  ).run(now, id);
  db.prepare(
    `UPDATE animation_batches SET status = 'cancelled', finished_at = ?, updated_at = ? WHERE id = ?`
  ).run(now, now, id);
  addProductionLog({
    eventType: 'animation_batch_cancelled',
    batchId: id,
    status: 'info',
    message: `Cancelled animation batch ${id}`,
  });
  return getAnimationBatchJob(id, true);
}

export function resumeAnimationBatchJob(id: string, retryFailed = false): AnimationBatchJob | null {
  const now = new Date().toISOString();
  if (retryFailed) {
    db.prepare(
      `UPDATE animation_batch_items SET status = 'pending', error_message = NULL, updated_at = ? WHERE batch_id = ? AND status = 'failed'`
    ).run(now, id);
  }
  db.prepare(
    `UPDATE animation_batches SET status = 'queued', finished_at = NULL, updated_at = ? WHERE id = ?`
  ).run(now, id);
  startAnimationBatchWorker(id);
  return getAnimationBatchJob(id, true);
}

function syncAnimationBatchCounters(batchId: string): void {
  const stats = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM animation_batch_items WHERE batch_id = ?`
    )
    .get(batchId) as { completed: number; failed: number };

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE animation_batches SET completed_count = ?, failed_count = ?, updated_at = ? WHERE id = ?`
  ).run(stats.completed ?? 0, stats.failed ?? 0, now, batchId);
}

async function processSingleAnimationBatchItem(
  batch: AnimationBatchJob,
  itemRow: Record<string, unknown>
): Promise<AnimationProject> {
  const seqIndex = Number(itemRow.seq_index);
  const animType = itemRow.animation_type as AnimationType;
  const variationPrompt = String(itemRow.variation_prompt);
  const seed = 10000 + seqIndex * 7919 + crypto.randomInt(1, 5000);
  const projectId = createAnimationProjectId();

  let project: AnimationProject;
  if (batch.providerSlug === 'procedural') {
    project = buildProceduralAnimationProject({
      id: projectId,
      batchId: batch.id,
      name: `${batch.name} #${seqIndex}`,
      prompt: variationPrompt,
      category: batch.category,
      animationType: animType,
      visualStyle: batch.visualStyle,
      backgroundMode: batch.backgroundMode,
      resolution: batch.resolution,
      durationSec: batch.durationSec,
      fps: batch.fps,
      seed,
    });
  } else {
    const res = await generateAnimationSpecWithProvider({
      id: projectId,
      batchId: batch.id,
      name: `${batch.name} #${seqIndex}`,
      prompt: variationPrompt,
      category: batch.category,
      animationType: animType,
      visualStyle: batch.visualStyle,
      backgroundMode: batch.backgroundMode,
      resolution: batch.resolution,
      durationSec: batch.durationSec,
      fps: batch.fps,
      providerSlug: batch.providerSlug,
      model: batch.model,
      seed,
    });
    project = res.project;
  }

  project = applyUniqueCompositionVariation(project, seqIndex, seed);

  // Check duplicate projectHash if enabled
  const settings = getSettings();
  if (settings.preventDuplicates) {
    const dup = db
      .prepare('SELECT id FROM animation_projects WHERE project_hash = ? LIMIT 1')
      .get(project.projectHash) as { id: string } | undefined;
    if (dup) {
      db.prepare(
        `UPDATE animation_batches SET duplicate_skipped_count = duplicate_skipped_count + 1 WHERE id = ?`
      ).run(batch.id);
      project = applyUniqueCompositionVariation(project, seqIndex + 13, seed + 9999);
    }
  }

  const rendered = await renderAndValidateAnimationProject(project, batch.exportFormats);
  if (rendered.status === 'failed') {
    throw new Error(rendered.errorMessage || 'Animation failed QA validation.');
  }
  return rendered;
}

export function startAnimationBatchWorker(batchId: string): void {
  if (activeAnimationBatchControllers.has(batchId)) return;
  const batch = getAnimationBatchJob(batchId, false);
  if (!batch) return;

  const ctrl = { cancelled: false, paused: false };
  activeAnimationBatchControllers.set(batchId, ctrl);

  const settings = getSettings();
  const maxRetries = Math.min(2, settings.maxRetries);

  void (async () => {
    try {
      db.prepare(`UPDATE animation_batches SET status = 'running', updated_at = ? WHERE id = ?`).run(
        new Date().toISOString(),
        batchId
      );

      const runWorker = async () => {
        while (!ctrl.cancelled && !ctrl.paused) {
          const nextItem = db
            .prepare(
              `SELECT * FROM animation_batch_items WHERE batch_id = ? AND status = 'pending' ORDER BY seq_index ASC LIMIT 1`
            )
            .get(batchId) as Record<string, unknown> | undefined;

          if (!nextItem) break;

          const itemId = Number(nextItem.id);
          const seqIndex = Number(nextItem.seq_index);
          let attempts = Number(nextItem.attempts);

          db.prepare(
            `UPDATE animation_batch_items SET status = 'generating', updated_at = ? WHERE id = ?`
          ).run(new Date().toISOString(), itemId);

          let succeeded = false;
          let lastErr = '';

          while (attempts <= maxRetries && !ctrl.cancelled && !ctrl.paused) {
            attempts += 1;
            try {
              const rendered = await processSingleAnimationBatchItem(batch, nextItem);
              db.prepare(
                `UPDATE animation_batch_items SET status = 'completed', attempts = ?, project_id = ?, error_message = NULL, updated_at = ? WHERE id = ?`
              ).run(attempts, rendered.id, new Date().toISOString(), itemId);
              succeeded = true;
              break;
            } catch (err) {
              lastErr = err instanceof Error ? err.message : String(err);
              if (attempts <= maxRetries && !ctrl.cancelled && !ctrl.paused) {
                db.prepare(
                  `UPDATE animation_batch_items SET status = 'retrying', attempts = ?, error_message = ?, updated_at = ? WHERE id = ?`
                ).run(attempts, lastErr, new Date().toISOString(), itemId);
                await new Promise((r) => setTimeout(r, 800 * attempts));
              }
            }
          }

          if (!succeeded && !ctrl.cancelled && !ctrl.paused) {
            db.prepare(
              `UPDATE animation_batch_items SET status = 'failed', attempts = ?, error_message = ?, updated_at = ? WHERE id = ?`
            ).run(attempts, lastErr, new Date().toISOString(), itemId);

            addProductionLog({
              eventType: 'animation_batch_item_failed',
              providerSlug: batch.providerSlug,
              model: batch.model,
              batchId,
              status: 'error',
              message: `Animation item #${seqIndex} failed: ${lastErr}`,
            });
          }

          syncAnimationBatchCounters(batchId);
        }
      };

      const workers = Array.from({ length: batch.concurrency }, () => runWorker());
      await Promise.all(workers);

      syncAnimationBatchCounters(batchId);
      const updated = getAnimationBatchJob(batchId, false);
      if (updated) {
        const now = new Date().toISOString();
        if (ctrl.cancelled) {
          db.prepare(
            `UPDATE animation_batches SET status = 'cancelled', finished_at = ?, updated_at = ? WHERE id = ?`
          ).run(now, now, batchId);
        } else if (ctrl.paused) {
          db.prepare(
            `UPDATE animation_batches SET status = 'paused', updated_at = ? WHERE id = ?`
          ).run(now, batchId);
        } else {
          const finalStatus =
            updated.failedCount > 0 && updated.completedCount === 0 ? 'failed' : 'completed';
          db.prepare(
            `UPDATE animation_batches SET status = ?, finished_at = ?, updated_at = ? WHERE id = ?`
          ).run(finalStatus, now, now, batchId);
          addProductionLog({
            eventType: 'animation_batch_finished',
            providerSlug: batch.providerSlug,
            model: batch.model,
            batchId,
            status: finalStatus === 'failed' ? 'error' : 'success',
            message: `Animation batch ${batchId} ${finalStatus}: ${updated.completedCount} completed, ${updated.failedCount} failed`,
          });
        }
      }
    } finally {
      activeAnimationBatchControllers.delete(batchId);
    }
  })();
}

export async function waitForAnimationBatchCompletion(
  batchId: string,
  timeoutMs = 120000
): Promise<AnimationBatchJob> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = getAnimationBatchJob(batchId, true);
    if (!job) throw new Error(`Animation batch not found: ${batchId}`);
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return job;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Animation batch ${batchId} timed out after ${timeoutMs}ms`);
}
