import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { Resvg } from '@resvg/resvg-js';
import JSZip from 'jszip';
import sharp from 'sharp';
import type {
  AnimationExportFormat,
  AnimationProject,
  OutputFileArtifact,
} from '../src/types/stockforge.js';
import {
  compileAnimatedSvg,
  compileLottieJson,
  computeProjectHash,
  generateAnimationMetadata,
  renderFrameSvgAtTime,
} from './animationEngine.js';
import { addProductionLog, db, mapAnimationProjectRow } from './db.js';
import {
  type OutputSubdir,
  deleteOutputRelativePath,
  resolveSafeRelativeOutputPath,
  writeOutputFile,
} from './outputManager.js';
import { FFPROBE_BIN, runFullProjectQa } from './qaValidator.js';

const execFileAsync = promisify(execFile);

export const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';

export async function checkFfmpegCapabilities(): Promise<{
  ffmpegAvailable: boolean;
  ffmpegVersion: string;
  ffprobeAvailable: boolean;
  proresAlphaSupported: boolean;
  h264Supported: boolean;
}> {
  let ffmpegAvailable = false;
  let ffmpegVersion = 'Unavailable';
  let ffprobeAvailable = false;
  let proresAlphaSupported = false;
  let h264Supported = false;

  try {
    const { stdout } = await execFileAsync(FFMPEG_BIN, ['-version'], { timeout: 5000 });
    ffmpegAvailable = true;
    ffmpegVersion = stdout.split('\n')[0]?.trim() || 'ffmpeg detected';
    const enc = await execFileAsync(FFMPEG_BIN, ['-encoders'], { timeout: 5000 });
    proresAlphaSupported = enc.stdout.includes('prores_ks');
    h264Supported = enc.stdout.includes('libx264');
  } catch {
    ffmpegAvailable = false;
  }

  try {
    await execFileAsync(FFPROBE_BIN, ['-version'], { timeout: 5000 });
    ffprobeAvailable = true;
  } catch {
    ffprobeAvailable = false;
  }

  return {
    ffmpegAvailable,
    ffmpegVersion,
    ffprobeAvailable,
    proresAlphaSupported,
    h264Supported,
  };
}

export function saveAnimationProjectRecord(project: AnimationProject): AnimationProject {
  const now = new Date().toISOString();
  project.updatedAt = now;
  project.projectHash = computeProjectHash(project);

  db.prepare(
    `INSERT INTO animation_projects (
      id, batch_id, name, prompt, category, animation_type, visual_style,
      background_mode, background_color, resolution, width, height,
      duration_sec, fps, palette_json, layers_json, metadata_json,
      provider_slug, model, status, pipeline_stage, review_status,
      error_message, project_hash, qa_json, output_files_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      prompt = excluded.prompt,
      category = excluded.category,
      animation_type = excluded.animation_type,
      visual_style = excluded.visual_style,
      background_mode = excluded.background_mode,
      background_color = excluded.background_color,
      resolution = excluded.resolution,
      width = excluded.width,
      height = excluded.height,
      duration_sec = excluded.duration_sec,
      fps = excluded.fps,
      palette_json = excluded.palette_json,
      layers_json = excluded.layers_json,
      metadata_json = excluded.metadata_json,
      provider_slug = excluded.provider_slug,
      model = excluded.model,
      status = excluded.status,
      pipeline_stage = excluded.pipeline_stage,
      review_status = excluded.review_status,
      error_message = excluded.error_message,
      project_hash = excluded.project_hash,
      qa_json = excluded.qa_json,
      output_files_json = excluded.output_files_json,
      updated_at = excluded.updated_at`
  ).run(
    project.id,
    project.batchId,
    project.name,
    project.prompt,
    project.category,
    project.animationType,
    project.visualStyle,
    project.backgroundMode,
    project.backgroundColor,
    project.resolution,
    project.width,
    project.height,
    project.durationSec,
    project.fps,
    JSON.stringify(project.palette),
    JSON.stringify(project.layers),
    JSON.stringify(project.metadata),
    project.providerSlug,
    project.model,
    project.status,
    project.pipelineStage,
    project.reviewStatus,
    project.errorMessage,
    project.projectHash,
    project.qaReport ? JSON.stringify(project.qaReport) : null,
    JSON.stringify(project.outputFiles),
    project.createdAt,
    now
  );

  writeOutputFile('projects', `${project.id}.json`, JSON.stringify(project, null, 2));
  writeOutputFile(
    'metadata',
    `${project.id}-metadata.json`,
    JSON.stringify(
      {
        id: project.id,
        category: project.category,
        animationType: project.animationType,
        backgroundMode: project.backgroundMode,
        durationSec: project.durationSec,
        resolution: project.resolution,
        fps: project.fps,
        ...project.metadata,
      },
      null,
      2
    )
  );

  const row = db
    .prepare('SELECT * FROM animation_projects WHERE id = ?')
    .get(project.id) as Record<string, unknown>;
  return mapAnimationProjectRow(row);
}

function updateStage(project: AnimationProject, status: AnimationProject['status'], stage: string): void {
  project.status = status;
  project.pipelineStage = stage;
  project.updatedAt = new Date().toISOString();
  db.prepare(
    `UPDATE animation_projects SET status = ?, pipeline_stage = ?, updated_at = ? WHERE id = ?`
  ).run(status, stage, project.updatedAt, project.id);
}

export async function renderAndValidateAnimationProject(
  inputProject: AnimationProject,
  requestedFormats?: AnimationExportFormat[],
  onStage?: (stage: string) => void
): Promise<AnimationProject> {
  const startMs = Date.now();
  const project: AnimationProject = {
    ...inputProject,
    metadata: inputProject.metadata?.title
      ? inputProject.metadata
      : generateAnimationMetadata(inputProject),
    outputFiles: [],
    errorMessage: null,
  };

  // Remove stale output files on re-render
  for (const prev of inputProject.outputFiles ?? []) {
    deleteOutputRelativePath(prev.relativePath);
  }

  saveAnimationProjectRecord(project);

  const formats = new Set<AnimationExportFormat>(
    requestedFormats && requestedFormats.length > 0
      ? requestedFormats
      : [
          'mp4_h264',
          'mp4_preview',
          'gif_preview',
          'thumbnail_png',
          'svg_animated',
          'lottie_json',
          'source_zip',
          ...(project.backgroundMode === 'transparent'
            ? (['mov_alpha', 'png_sequence'] as AnimationExportFormat[])
            : []),
        ]
  );

  // Always generate source & preview essentials for the dashboard/inspector
  formats.add('svg_animated');
  formats.add('lottie_json');
  formats.add('source_zip');
  formats.add('thumbnail_png');
  formats.add('mp4_preview');
  formats.add('gif_preview');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `sf-render-${project.id}-`));
  const framesDir = path.join(tmpDir, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });

  const stageNotify = (stage: string) => {
    updateStage(project, 'rendering', stage);
    onStage?.(stage);
  };

  try {
    // 1. Compile editable sources (Animated SMIL SVG + Lottie JSON + Source ZIP)
    stageNotify('compiling_vector_sources');
    const animatedSvg = compileAnimatedSvg(project);
    const lottieObj = compileLottieJson(project);
    const lottieStr = JSON.stringify(lottieObj, null, 2);

    const svgRes = writeOutputFile('svg', `${project.id}.svg`, animatedSvg);
    project.outputFiles.push({
      format: 'svg_animated',
      filename: `${project.id}.svg`,
      relativePath: svgRes.relativePath,
      sizeBytes: svgRes.sizeBytes,
      mimeType: 'image/svg+xml',
      createdAt: new Date().toISOString(),
    });

    const lottieRes = writeOutputFile('lottie', `${project.id}.json`, lottieStr);
    project.outputFiles.push({
      format: 'lottie_json',
      filename: `${project.id}.json`,
      relativePath: lottieRes.relativePath,
      sizeBytes: lottieRes.sizeBytes,
      mimeType: 'application/json',
      createdAt: new Date().toISOString(),
    });

    // Source Project ZIP
    const srcZip = new JSZip();
    srcZip.file('project.json', JSON.stringify(project, null, 2));
    srcZip.file(`${project.id}.svg`, animatedSvg);
    srcZip.file(`${project.id}-lottie.json`, lottieStr);
    srcZip.file('metadata.json', JSON.stringify(project.metadata, null, 2));
    srcZip.file(
      'README.txt',
      `StockForge Animation Studio Source Package\nID: ${project.id}\nResolution: ${project.width}x${project.height}\nFPS: ${project.fps}\nDuration: ${project.durationSec}s\nBackground: ${project.backgroundMode}\n`
    );
    const srcZipBuf = await srcZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const srcZipRes = writeOutputFile('source', `${project.id}-source.zip`, srcZipBuf);
    project.outputFiles.push({
      format: 'source_zip',
      filename: `${project.id}-source.zip`,
      relativePath: srcZipRes.relativePath,
      sizeBytes: srcZipRes.sizeBytes,
      mimeType: 'application/zip',
      createdAt: new Date().toISOString(),
    });

    // 2. Render every frame deterministically
    stageNotify('rendering_frames');
    const totalFrames = Math.max(4, Math.round(project.durationSec * project.fps));
    const framePaths: string[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const t = (i / project.fps);
      const frameSvg = renderFrameSvgAtTime(project, t);
      const resvg = new Resvg(frameSvg, {
        fitTo: { mode: 'width', value: project.width },
        background:
          project.backgroundMode === 'transparent'
            ? 'rgba(0,0,0,0)'
            : project.backgroundMode === 'green_screen'
            ? '#00FF00'
            : project.backgroundColor || '#0B1020',
      });
      const pngBytes = Buffer.from(resvg.render().asPng());
      const frameFile = path.join(framesDir, `frame_${String(i + 1).padStart(5, '0')}.png`);
      fs.writeFileSync(frameFile, pngBytes);
      framePaths.push(frameFile);
    }

    // 3. Static Thumbnail (middle frame)
    const midFramePath = framePaths[Math.floor(framePaths.length / 2)];
    const thumbBuf = await sharp(midFramePath).resize(640, null).png().toBuffer();
    const thumbRes = writeOutputFile('thumbnails', `${project.id}-thumb.png`, thumbBuf);
    project.outputFiles.push({
      format: 'thumbnail_png',
      filename: `${project.id}-thumb.png`,
      relativePath: thumbRes.relativePath,
      sizeBytes: thumbRes.sizeBytes,
      mimeType: 'image/png',
      createdAt: new Date().toISOString(),
    });

    // 4. PNG Sequence ZIP (if requested or transparent)
    if (formats.has('png_sequence')) {
      stageNotify('packaging_png_sequence');
      const seqZip = new JSZip();
      for (let i = 0; i < framePaths.length; i++) {
        const fname = `frame_${String(i + 1).padStart(5, '0')}.png`;
        seqZip.file(fname, fs.readFileSync(framePaths[i]));
      }
      const seqBuf = await seqZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      const seqSubdir: OutputSubdir =
        project.backgroundMode === 'transparent' ? 'transparent' : 'exports';
      const seqRes = writeOutputFile(seqSubdir, `${project.id}-png-sequence.zip`, seqBuf);
      project.outputFiles.push({
        format: 'png_sequence',
        filename: `${project.id}-png-sequence.zip`,
        relativePath: seqRes.relativePath,
        sizeBytes: seqRes.sizeBytes,
        mimeType: 'application/zip',
        createdAt: new Date().toISOString(),
      });
    }

    // 5. FFmpeg Encodings
    stageNotify('encoding_video');
    const framePattern = path.join(framesDir, 'frame_%05d.png');

    const encodeH264 = async (
      outSubdir: OutputSubdir,
      outFilename: string,
      formatKey: AnimationExportFormat,
      scaleFilter?: string
    ) => {
      const outPath = path.join(tmpDir, outFilename);
      const args: string[] = ['-y', '-framerate', String(project.fps), '-i', framePattern];
      if (project.backgroundMode === 'transparent') {
        const matteFilter = scaleFilter
          ? `color=c=#0B0E14:s=${project.width}x${project.height}:r=${project.fps}[bg];[bg][0:v]overlay=shortest=1,${scaleFilter},format=yuv420p`
          : `color=c=#0B0E14:s=${project.width}x${project.height}:r=${project.fps}[bg];[bg][0:v]overlay=shortest=1,format=yuv420p`;
        args.push('-filter_complex', matteFilter);
      } else {
        if (scaleFilter) {
          args.push('-vf', `${scaleFilter},format=yuv420p`);
        } else {
          args.push('-pix_fmt', 'yuv420p');
        }
      }
      args.push(
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        formatKey === 'mp4_preview' ? '23' : '18',
        '-movflags',
        '+faststart',
        outPath
      );
      await execFileAsync(FFMPEG_BIN, args, { timeout: 120000 });
      const written = writeOutputFile(outSubdir, outFilename, fs.readFileSync(outPath));
      project.outputFiles.push({
        format: formatKey,
        filename: outFilename,
        relativePath: written.relativePath,
        sizeBytes: written.sizeBytes,
        mimeType: 'video/mp4',
        createdAt: new Date().toISOString(),
      });
    };

    if (formats.has('mp4_h264')) {
      const targetSubdir: OutputSubdir =
        project.backgroundMode === 'green_screen' ? 'green-screen' : 'video';
      await encodeH264(targetSubdir, `${project.id}.mp4`, 'mp4_h264');
    }

    if (formats.has('mp4_preview')) {
      const previewScale = project.width >= project.height ? 'scale=640:-2' : 'scale=-2:640';
      await encodeH264('previews', `${project.id}-preview.mp4`, 'mp4_preview', previewScale);
    }

    if (formats.has('mov_prores')) {
      const outFilename = `${project.id}-prores.mov`;
      const outPath = path.join(tmpDir, outFilename);
      await execFileAsync(
        FFMPEG_BIN,
        [
          '-y',
          '-framerate',
          String(project.fps),
          '-i',
          framePattern,
          '-c:v',
          'prores_ks',
          '-profile:v',
          '3',
          '-pix_fmt',
          'yuv422p10le',
          outPath,
        ],
        { timeout: 120000 }
      );
      const written = writeOutputFile(
        project.backgroundMode === 'green_screen' ? 'green-screen' : 'video',
        outFilename,
        fs.readFileSync(outPath)
      );
      project.outputFiles.push({
        format: 'mov_prores',
        filename: outFilename,
        relativePath: written.relativePath,
        sizeBytes: written.sizeBytes,
        mimeType: 'video/quicktime',
        createdAt: new Date().toISOString(),
      });
    }

    if (formats.has('mov_alpha')) {
      const outFilename = `${project.id}-alpha.mov`;
      const outPath = path.join(tmpDir, outFilename);
      await execFileAsync(
        FFMPEG_BIN,
        [
          '-y',
          '-framerate',
          String(project.fps),
          '-i',
          framePattern,
          '-c:v',
          'prores_ks',
          '-profile:v',
          '4444',
          '-pix_fmt',
          'yuva444p10le',
          outPath,
        ],
        { timeout: 120000 }
      );
      const written = writeOutputFile('transparent', outFilename, fs.readFileSync(outPath));
      project.outputFiles.push({
        format: 'mov_alpha',
        filename: outFilename,
        relativePath: written.relativePath,
        sizeBytes: written.sizeBytes,
        mimeType: 'video/quicktime',
        createdAt: new Date().toISOString(),
      });
    }

    if (formats.has('gif_preview')) {
      const outFilename = `${project.id}-preview.gif`;
      const outPath = path.join(tmpDir, outFilename);
      const gifFps = Math.min(20, project.fps);
      const filter =
        project.backgroundMode === 'transparent'
          ? `fps=${gifFps},scale=440:-1:flags=lanczos,split[s0][s1];[s0]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[s1][p]paletteuse=alpha_threshold=128`
          : `fps=${gifFps},scale=440:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
      await execFileAsync(
        FFMPEG_BIN,
        ['-y', '-framerate', String(project.fps), '-i', framePattern, '-vf', filter, outPath],
        { timeout: 120000 }
      );
      const written = writeOutputFile('previews', outFilename, fs.readFileSync(outPath));
      project.outputFiles.push({
        format: 'gif_preview',
        filename: outFilename,
        relativePath: written.relativePath,
        sizeBytes: written.sizeBytes,
        mimeType: 'image/gif',
        createdAt: new Date().toISOString(),
      });
    }

    // 6. Automated Quality Assurance Validation
    updateStage(project, 'validating', 'running_qa_checks');
    onStage?.('running_qa_checks');
    const qaReport = await runFullProjectQa(project, animatedSvg, framePaths);
    project.qaReport = qaReport;

    if (!qaReport.passed) {
      project.status = 'failed';
      project.pipelineStage = 'qa_failed';
      project.errorMessage = qaReport.issues.join(' | ');
      writeOutputFile(
        'failed',
        `${project.id}-qa-report.json`,
        JSON.stringify({ projectId: project.id, qaReport }, null, 2)
      );
      saveAnimationProjectRecord(project);
      addProductionLog({
        eventType: 'animation_qa_failed',
        providerSlug: project.providerSlug,
        model: project.model,
        batchId: project.batchId,
        assetId: project.id,
        status: 'error',
        latencyMs: Date.now() - startMs,
        message: `QA rejected ${project.id}: ${project.errorMessage}`,
      });
      return project;
    }

    project.status = 'completed';
    project.pipelineStage = 'ready_for_review';
    project.errorMessage = null;
    const saved = saveAnimationProjectRecord(project);

    addProductionLog({
      eventType: 'animation_rendered',
      providerSlug: project.providerSlug,
      model: project.model,
      batchId: project.batchId,
      assetId: project.id,
      status: 'success',
      latencyMs: Date.now() - startMs,
      message: `Rendered & validated ${project.id} (${totalFrames} frames, motion score ${qaReport.motionScore})`,
    });

    return saved;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    project.status = 'failed';
    project.pipelineStage = 'render_failed';
    project.errorMessage = msg;
    writeOutputFile(
      'failed',
      `${project.id}-error.json`,
      JSON.stringify({ projectId: project.id, error: msg, timestamp: new Date().toISOString() }, null, 2)
    );
    saveAnimationProjectRecord(project);
    addProductionLog({
      eventType: 'animation_render_failed',
      providerSlug: project.providerSlug,
      model: project.model,
      batchId: project.batchId,
      assetId: project.id,
      status: 'error',
      latencyMs: Date.now() - startMs,
      message: `Render failed for ${project.id}: ${msg}`,
    });
    return project;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function renderOnDemandExportFormat(
  project: AnimationProject,
  format: AnimationExportFormat
): Promise<{ filePath: string; filename: string; mimeType: string }> {
  const existing = project.outputFiles.find((f) => f.format === format);
  if (existing) {
    const resolved = resolveSafeRelativeOutputPath(existing.relativePath);
    if (resolved && fs.existsSync(resolved)) {
      return {
        filePath: resolved,
        filename: existing.filename,
        mimeType: existing.mimeType,
      };
    }
  }

  // Render on-demand with existing formats preserved + requested format added
  const desired = Array.from(
    new Set([...project.outputFiles.map((f) => f.format), format])
  );
  const updated = await renderAndValidateAnimationProject(project, desired);
  if (updated.status === 'failed') {
    throw new Error(updated.errorMessage || `Failed to render ${format}`);
  }
  const created = updated.outputFiles.find((f) => f.format === format);
  if (!created) {
    throw new Error(`Format ${format} was not produced.`);
  }
  const resolved = resolveSafeRelativeOutputPath(created.relativePath);
  if (!resolved || !fs.existsSync(resolved)) {
    throw new Error(`Exported file missing on disk: ${created.relativePath}`);
  }
  return {
    filePath: resolved,
    filename: created.filename,
    mimeType: created.mimeType,
  };
}
