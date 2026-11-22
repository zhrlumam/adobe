import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import sharp from 'sharp';
import type {
  AnimationExportFormat,
  AnimationProject,
  QaReport,
  VideoProbeReport,
} from '../src/types/stockforge.js';
import { resolveSafeRelativeOutputPath } from './outputManager.js';
import { sanitizeAndValidateSvg } from './svgEngine.js';

const execFileAsync = promisify(execFile);

export const FFPROBE_BIN = process.env.FFPROBE_PATH || 'ffprobe';

function parseFpsRatio(ratio: string | undefined): number {
  if (!ratio) return 0;
  const parts = ratio.split('/');
  if (parts.length === 2) {
    const n = Number(parts[0]);
    const d = Number(parts[1]);
    if (d > 0) return Number((n / d).toFixed(2));
  }
  return Number(ratio) || 0;
}

export async function probeVideoFile(
  filePath: string,
  format: AnimationExportFormat,
  filename: string,
  expectedWidth: number,
  expectedHeight: number,
  expectedFps: number,
  expectedDurationSec: number,
  requireAlpha: boolean
): Promise<VideoProbeReport> {
  const issues: string[] = [];
  if (!fs.existsSync(filePath)) {
    return {
      format,
      filename,
      codecName: 'missing',
      pixFmt: 'missing',
      width: 0,
      height: 0,
      fps: 0,
      durationSec: 0,
      hasAlphaChannel: false,
      sizeBytes: 0,
      valid: false,
      issues: [`File missing at ${filePath}`],
    };
  }

  const sizeBytes = fs.statSync(filePath).size;
  if (sizeBytes < 256) {
    issues.push(`File size too small (${sizeBytes} bytes)`);
  }

  try {
    const { stdout } = await execFileAsync(
      FFPROBE_BIN,
      [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        filePath,
      ],
      { timeout: 15000 }
    );

    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        pix_fmt?: string;
        width?: number;
        height?: number;
        r_frame_rate?: string;
        avg_frame_rate?: string;
        duration?: string;
      }>;
    };

    const videoStream = (parsed.streams ?? []).find((s) => s.codec_type === 'video');
    if (!videoStream) {
      issues.push('No video stream detected by ffprobe');
      return {
        format,
        filename,
        codecName: 'none',
        pixFmt: 'none',
        width: 0,
        height: 0,
        fps: 0,
        durationSec: 0,
        hasAlphaChannel: false,
        sizeBytes,
        valid: false,
        issues,
      };
    }

    const codecName = String(videoStream.codec_name || '');
    const pixFmt = String(videoStream.pix_fmt || '');
    const width = Number(videoStream.width || 0);
    const height = Number(videoStream.height || 0);
    const fps = parseFpsRatio(videoStream.avg_frame_rate || videoStream.r_frame_rate);
    const durationSec = Number(videoStream.duration || parsed.format?.duration || 0);
    const hasAlphaChannel =
      pixFmt.includes('a') || pixFmt === 'argb' || pixFmt === 'rgba' || pixFmt === 'bgra';

    if (format !== 'mp4_preview' && format !== 'gif_preview') {
      if (width !== expectedWidth || height !== expectedHeight) {
        issues.push(`Resolution mismatch: expected ${expectedWidth}x${expectedHeight}, got ${width}x${height}`);
      }
      if (Math.abs(fps - expectedFps) > 1.5) {
        issues.push(`FPS mismatch: expected ${expectedFps}, got ${fps}`);
      }
    }

    if (Math.abs(durationSec - expectedDurationSec) > 0.5) {
      issues.push(
        `Duration mismatch: expected ~${expectedDurationSec}s, got ${durationSec.toFixed(2)}s`
      );
    }

    if (requireAlpha && !hasAlphaChannel) {
      issues.push(`Expected alpha channel pixel format, but got "${pixFmt}"`);
    }

    return {
      format,
      filename,
      codecName,
      pixFmt,
      width,
      height,
      fps,
      durationSec: Number(durationSec.toFixed(2)),
      hasAlphaChannel,
      sizeBytes,
      valid: issues.length === 0,
      issues,
    };
  } catch (err) {
    issues.push(`ffprobe failed: ${err instanceof Error ? err.message : String(err)}`);
    return {
      format,
      filename,
      codecName: 'error',
      pixFmt: 'error',
      width: 0,
      height: 0,
      fps: 0,
      durationSec: 0,
      hasAlphaChannel: false,
      sizeBytes,
      valid: false,
      issues,
    };
  }
}

export async function analyzeRenderedFrames(
  framePaths: string[],
  project: AnimationProject
): Promise<{
  blackFrameCount: number;
  emptyFrameCount: number;
  duplicateFrameRatio: number;
  motionScore: number;
  alphaVerified: boolean | null;
  greenScreenVerified: boolean | null;
  greenScreenPurityPct: number | null;
  issues: string[];
}> {
  const issues: string[] = [];
  if (framePaths.length < 2) {
    return {
      blackFrameCount: 0,
      emptyFrameCount: framePaths.length,
      duplicateFrameRatio: 1,
      motionScore: 0,
      alphaVerified: project.backgroundMode === 'transparent' ? false : null,
      greenScreenVerified: project.backgroundMode === 'green_screen' ? false : null,
      greenScreenPurityPct: null,
      issues: ['Insufficient frames rendered (< 2).'],
    };
  }

  // Sample up to 8 evenly spaced frames for pixel-level QA
  const sampleIndices = Array.from(
    new Set(
      [
        0,
        Math.floor(framePaths.length * 0.15),
        Math.floor(framePaths.length * 0.35),
        Math.floor(framePaths.length * 0.5),
        Math.floor(framePaths.length * 0.65),
        Math.floor(framePaths.length * 0.85),
        framePaths.length - 1,
      ].filter((idx) => idx >= 0 && idx < framePaths.length)
    )
  );

  const sampleBuffers: Buffer[] = [];
  let blackFrameCount = 0;
  let emptyFrameCount = 0;
  let alphaTransparentPixels = 0;
  let alphaOpaquePixels = 0;
  let greenCornerSamples = 0;
  let greenCornerMatches = 0;

  for (const idx of sampleIndices) {
    const p = framePaths[idx];
    const { data, info } = await sharp(p)
      .resize(160, 90, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    sampleBuffers.push(data);

    let maxRgb = 0;
    let nonZeroAlphaCount = 0;
    const totalPixels = info.width * info.height;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a === 0) alphaTransparentPixels++;
      if (a > 128) alphaOpaquePixels++;
      if (a > 0) {
        nonZeroAlphaCount++;
        maxRgb = Math.max(maxRgb, r, g, b);
      }
    }

    if (nonZeroAlphaCount === 0) {
      emptyFrameCount++;
    } else if (maxRgb === 0 && project.backgroundMode !== 'transparent') {
      blackFrameCount++;
    }

    if (project.backgroundMode === 'green_screen') {
      // Sample perimeter border pixels across the 160x90 scaled frame (2px rim)
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          if (x < 2 || x >= info.width - 2 || y < 2 || y >= info.height - 2) {
            const off = (y * info.width + x) * 4;
            greenCornerSamples++;
            if (data[off] <= 12 && data[off + 1] >= 245 && data[off + 2] <= 12) {
              greenCornerMatches++;
            }
          }
        }
      }
    }

    if (totalPixels === 0) emptyFrameCount++;
  }

  // Compare consecutive sample buffers to verify genuine motion
  let identicalPairs = 0;
  let totalDiffAccumulator = 0;
  for (let i = 1; i < sampleBuffers.length; i++) {
    const prev = sampleBuffers[i - 1];
    const curr = sampleBuffers[i];
    let diffBytes = 0;
    let changedPixels = 0;
    for (let j = 0; j < prev.length; j += 4) {
      const dr = Math.abs(prev[j] - curr[j]);
      const dg = Math.abs(prev[j + 1] - curr[j + 1]);
      const db = Math.abs(prev[j + 2] - curr[j + 2]);
      const da = Math.abs(prev[j + 3] - curr[j + 3]);
      if (dr + dg + db + da > 8) {
        changedPixels++;
        diffBytes += dr + dg + db + da;
      }
    }
    if (changedPixels === 0) {
      identicalPairs++;
    }
    totalDiffAccumulator += (changedPixels / (prev.length / 4)) * 100;
  }

  const pairCount = Math.max(1, sampleBuffers.length - 1);
  const duplicateFrameRatio = Number((identicalPairs / pairCount).toFixed(3));
  const motionScore = Number(Math.min(100, (totalDiffAccumulator / pairCount) * 4).toFixed(2));

  if (blackFrameCount > 0) issues.push(`Detected ${blackFrameCount} solid black frame(s).`);
  if (emptyFrameCount > 0) issues.push(`Detected ${emptyFrameCount} completely empty frame(s).`);
  if (duplicateFrameRatio >= 0.99 || motionScore <= 0.01) {
    issues.push('No visible motion detected across rendered animation frames.');
  }

  let alphaVerified: boolean | null = null;
  if (project.backgroundMode === 'transparent') {
    alphaVerified = alphaTransparentPixels > 0 && alphaOpaquePixels > 0;
    if (!alphaVerified) {
      issues.push('Alpha transparency verification failed: frames lack transparent background or foreground subject.');
    }
  }

  let greenScreenVerified: boolean | null = null;
  let greenScreenPurityPct: number | null = null;
  if (project.backgroundMode === 'green_screen') {
    greenScreenPurityPct =
      greenCornerSamples > 0
        ? Number(((greenCornerMatches / greenCornerSamples) * 100).toFixed(2))
        : 0;
    greenScreenVerified = greenScreenPurityPct >= 95;
    if (!greenScreenVerified) {
      issues.push(
        `Green screen background purity below threshold (${greenScreenPurityPct}% pure #00FF00).`
      );
    }
  }

  return {
    blackFrameCount,
    emptyFrameCount,
    duplicateFrameRatio,
    motionScore,
    alphaVerified,
    greenScreenVerified,
    greenScreenPurityPct,
    issues,
  };
}

export async function runFullProjectQa(
  project: AnimationProject,
  svgSource: string,
  framePaths: string[]
): Promise<QaReport> {
  const svgCheck = sanitizeAndValidateSvg(svgSource, false);
  const frameQa = await analyzeRenderedFrames(framePaths, project);

  const videoProbes: VideoProbeReport[] = [];
  for (const artifact of project.outputFiles) {
    if (
      artifact.format === 'mp4_h264' ||
      artifact.format === 'mov_prores' ||
      artifact.format === 'mov_alpha' ||
      artifact.format === 'mp4_preview'
    ) {
      const absPath = resolveSafeRelativeOutputPath(artifact.relativePath);
      if (absPath) {
        const probe = await probeVideoFile(
          absPath,
          artifact.format,
          artifact.filename,
          project.width,
          project.height,
          project.fps,
          project.durationSec,
          artifact.format === 'mov_alpha'
        );
        videoProbes.push(probe);
      }
    }
  }

  const metadataComplete =
    project.metadata.title.trim().length >= 8 &&
    project.metadata.description.trim().length >= 15 &&
    project.metadata.keywords.length >= 10;

  const issues: string[] = [...frameQa.issues];
  if (!svgCheck.validation.validXml || !svgCheck.validation.hasSvgRoot) {
    issues.push('SVG source failed XML structure validation.');
  }
  if (!svgCheck.validation.hasViewBox) {
    issues.push('SVG source is missing explicit viewBox.');
  }
  if (!metadataComplete) {
    issues.push('Stock metadata incomplete (requires title, description, and >=10 keywords).');
  }
  for (const vp of videoProbes) {
    if (!vp.valid) {
      issues.push(...vp.issues.map((i) => `${vp.filename}: ${i}`));
    }
  }

  if (project.backgroundMode === 'transparent') {
    const hasAlphaArtifact =
      videoProbes.some((v) => v.format === 'mov_alpha' && v.hasAlphaChannel && v.valid) ||
      project.outputFiles.some((f) => f.format === 'png_sequence');
    if (!hasAlphaArtifact) {
      issues.push('Transparent project lacks verified alpha video or PNG sequence deliverable.');
    }
  }

  return {
    passed: issues.length === 0,
    checkedAt: new Date().toISOString(),
    svgValid: svgCheck.validation.validXml && svgCheck.validation.hasSvgRoot,
    svgViewBoxValid: svgCheck.validation.hasViewBox,
    frameCountRendered: framePaths.length,
    blackFrameCount: frameQa.blackFrameCount,
    emptyFrameCount: frameQa.emptyFrameCount,
    duplicateFrameRatio: frameQa.duplicateFrameRatio,
    motionScore: frameQa.motionScore,
    alphaVerified: frameQa.alphaVerified,
    greenScreenVerified: frameQa.greenScreenVerified,
    greenScreenPurityPct: frameQa.greenScreenPurityPct,
    metadataComplete,
    videoProbes,
    issues,
  };
}
