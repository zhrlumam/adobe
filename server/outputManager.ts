import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const IS_SERVERLESS_RUNTIME = Boolean(
  process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NOW_REGION
);

export const OUTPUT_ROOT = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : IS_SERVERLESS_RUNTIME
  ? path.join(os.tmpdir(), 'stockforge-output')
  : path.resolve(process.cwd(), 'output');

export const OUTPUT_SUBDIRS = [
  'projects',
  'source',
  'svg',
  'lottie',
  'video',
  'transparent',
  'green-screen',
  'previews',
  'thumbnails',
  'metadata',
  'exports',
  'failed',
] as const;

export type OutputSubdir = (typeof OUTPUT_SUBDIRS)[number];

export function ensureOutputDirectories(): void {
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  for (const sub of OUTPUT_SUBDIRS) {
    fs.mkdirSync(path.join(OUTPUT_ROOT, sub), { recursive: true });
  }
}

ensureOutputDirectories();

export function getOutputSubdirPath(subdir: OutputSubdir): string {
  const dir = path.join(OUTPUT_ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function sanitizeOutputFilename(raw: string): string {
  const base = path.basename(raw).replace(/[^a-zA-Z0-9._-]/g, '-');
  return base.slice(0, 140) || 'asset';
}

export function resolveSafeOutputFile(subdir: OutputSubdir, filename: string): string | null {
  const clean = sanitizeOutputFilename(filename);
  if (!clean || clean === '.' || clean === '..') return null;
  const baseDir = getOutputSubdirPath(subdir);
  const resolved = path.resolve(baseDir, clean);
  if (!resolved.startsWith(baseDir + path.sep)) {
    return null;
  }
  return resolved;
}

export function resolveSafeRelativeOutputPath(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const resolved = path.resolve(OUTPUT_ROOT, normalized);
  if (!resolved.startsWith(OUTPUT_ROOT + path.sep)) {
    return null;
  }
  return resolved;
}

export function writeOutputFile(
  subdir: OutputSubdir,
  filename: string,
  content: Buffer | string
): { absolutePath: string; relativePath: string; sizeBytes: number } {
  const clean = sanitizeOutputFilename(filename);
  const target = resolveSafeOutputFile(subdir, clean);
  if (!target) {
    throw new Error(`Invalid output filename: ${filename}`);
  }
  if (typeof content === 'string') {
    fs.writeFileSync(target, content, 'utf8');
  } else {
    fs.writeFileSync(target, content);
  }
  const stat = fs.statSync(target);
  return {
    absolutePath: target,
    relativePath: `${subdir}/${clean}`,
    sizeBytes: stat.size,
  };
}

export function deleteOutputRelativePath(relativePath: string): void {
  const resolved = resolveSafeRelativeOutputPath(relativePath);
  if (resolved && fs.existsSync(resolved)) {
    const stat = fs.statSync(resolved);
    if (stat.isFile()) {
      fs.unlinkSync(resolved);
    }
  }
}

export function getOutputFolderStats(): {
  folder: string;
  fileCount: number;
  sizeBytes: number;
}[] {
  ensureOutputDirectories();
  return OUTPUT_SUBDIRS.map((folder) => {
    const dir = path.join(OUTPUT_ROOT, folder);
    let fileCount = 0;
    let sizeBytes = 0;
    if (fs.existsSync(dir)) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          fileCount++;
          sizeBytes += fs.statSync(path.join(dir, entry.name)).size;
        }
      }
    }
    return { folder, fileCount, sizeBytes };
  });
}

export function getTotalOutputBytes(): number {
  return getOutputFolderStats().reduce((acc, item) => acc + item.sizeBytes, 0);
}
