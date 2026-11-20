import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import type {
  BatchItem,
  BatchJob,
  ProductionLogEntry,
  ProviderSlug,
  ProviderStatus,
  StockAsset,
  SystemSettings,
} from '../src/types/stockforge.js';

export const IS_SERVERLESS = Boolean(
  process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NOW_REGION
);

export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : IS_SERVERLESS
  ? path.join(os.tmpdir(), 'stockforge-data')
  : path.resolve(process.cwd(), 'data');

export const ASSETS_DIR = path.join(DATA_DIR, 'assets');
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
export const DB_PATH = path.join(DATA_DIR, 'stockforge.db');
export const SECRETS_PATH = path.join(DATA_DIR, '.provider_keys.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.mkdirSync(BACKUPS_DIR, { recursive: true });

const require = createRequire(import.meta.url);
let DatabaseSyncCtor: typeof DatabaseSyncType;
try {
  ({ DatabaseSync: DatabaseSyncCtor } = require('node:sqlite') as {
    DatabaseSync: typeof DatabaseSyncType;
  });
} catch (err) {
  throw new Error(
    `SQLite initialization failed on Node ${process.version}. Set Node.js Version to 22.x in Vercel Project Settings -> General. (${err instanceof Error ? err.message : String(err)})`
  );
}

export const db = new DatabaseSyncCtor(DB_PATH);
try {
  db.exec('PRAGMA journal_mode = WAL;');
} catch {
  // Serverless /tmp filesystems may prefer default journal mode
}
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS providers (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  selected_model TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unconfigured',
  last_tested_at TEXT,
  last_error TEXT,
  rate_limit_info TEXT,
  available_models_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  batch_id TEXT,
  prompt TEXT NOT NULL,
  category TEXT NOT NULL,
  style TEXT NOT NULL,
  target_platform TEXT NOT NULL,
  provider_slug TEXT NOT NULL,
  model TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  keywords_json TEXT NOT NULL,
  adobe_category TEXT NOT NULL,
  shutterstock_category TEXT NOT NULL,
  svg_filename TEXT NOT NULL,
  svg_hash TEXT NOT NULL,
  validation_json TEXT NOT NULL,
  width INTEGER NOT NULL DEFAULT 1000,
  height INTEGER NOT NULL DEFAULT 1000,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_prompt TEXT NOT NULL,
  category TEXT NOT NULL,
  style TEXT NOT NULL,
  target_platform TEXT NOT NULL,
  provider_slug TEXT NOT NULL,
  model TEXT NOT NULL,
  requested_count INTEGER NOT NULL,
  concurrency INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'queued',
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  duplicate_skipped_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS batch_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  seq_index INTEGER NOT NULL,
  variation_prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  asset_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS production_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  provider_slug TEXT,
  model TEXT,
  batch_id TEXT,
  asset_id TEXT,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

export const DEFAULT_SETTINGS: SystemSettings = {
  exportRasterSize: 4000,
  exportJpgQuality: 95,
  epsArtboardSize: 1000,
  defaultConcurrency: 2,
  maxRetries: 3,
  strictSanitizer: true,
  preventDuplicates: true,
};

export function getSettings(): SystemSettings {
  const rows = db.prepare('SELECT key, value FROM system_settings').all() as {
    key: string;
    value: string;
  }[];
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    exportRasterSize: Number(map.get('exportRasterSize') ?? DEFAULT_SETTINGS.exportRasterSize),
    exportJpgQuality: Number(map.get('exportJpgQuality') ?? DEFAULT_SETTINGS.exportJpgQuality),
    epsArtboardSize: Number(map.get('epsArtboardSize') ?? DEFAULT_SETTINGS.epsArtboardSize),
    defaultConcurrency: Number(map.get('defaultConcurrency') ?? DEFAULT_SETTINGS.defaultConcurrency),
    maxRetries: Number(map.get('maxRetries') ?? DEFAULT_SETTINGS.maxRetries),
    strictSanitizer:
      map.has('strictSanitizer')
        ? map.get('strictSanitizer') === 'true'
        : DEFAULT_SETTINGS.strictSanitizer,
    preventDuplicates:
      map.has('preventDuplicates')
        ? map.get('preventDuplicates') === 'true'
        : DEFAULT_SETTINGS.preventDuplicates,
  };
}

export function saveSettings(partial: Partial<SystemSettings>): SystemSettings {
  const current = getSettings();
  const next: SystemSettings = {
    exportRasterSize: Math.min(8000, Math.max(512, Number(partial.exportRasterSize ?? current.exportRasterSize))),
    exportJpgQuality: Math.min(100, Math.max(60, Number(partial.exportJpgQuality ?? current.exportJpgQuality))),
    epsArtboardSize: Math.min(4000, Math.max(256, Number(partial.epsArtboardSize ?? current.epsArtboardSize))),
    defaultConcurrency: Math.min(4, Math.max(1, Number(partial.defaultConcurrency ?? current.defaultConcurrency))),
    maxRetries: Math.min(5, Math.max(0, Number(partial.maxRetries ?? current.maxRetries))),
    strictSanitizer:
      typeof partial.strictSanitizer === 'boolean'
        ? partial.strictSanitizer
        : current.strictSanitizer,
    preventDuplicates:
      typeof partial.preventDuplicates === 'boolean'
        ? partial.preventDuplicates
        : current.preventDuplicates,
  };

  const stmt = db.prepare(
    'INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  for (const [k, v] of Object.entries(next)) {
    stmt.run(k, String(v));
  }
  return next;
}

function readSecretsFile(): Record<string, string> {
  try {
    if (!fs.existsSync(SECRETS_PATH)) return {};
    const raw = fs.readFileSync(SECRETS_PATH, 'utf8');
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeSecretsFile(secrets: Record<string, string>): void {
  fs.writeFileSync(SECRETS_PATH, JSON.stringify(secrets, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

const ENV_KEY_MAP: Record<ProviderSlug, string | undefined> = {
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  huggingface: 'HUGGINGFACE_API_KEY',
  ollama: undefined,
  custom: undefined,
};

export function getProviderApiKey(slug: ProviderSlug): {
  key: string | null;
  envManaged: boolean;
} {
  const envName = ENV_KEY_MAP[slug];
  if (envName) {
    const envVal = process.env[envName]?.trim();
    if (envVal && envVal !== 'MY_GEMINI_API_KEY') {
      return { key: envVal, envManaged: true };
    }
  }
  const secrets = readSecretsFile();
  const saved = secrets[slug]?.trim();
  return { key: saved || null, envManaged: false };
}

export function setProviderApiKey(slug: ProviderSlug, apiKey: string | null): void {
  const secrets = readSecretsFile();
  if (!apiKey || !apiKey.trim()) {
    delete secrets[slug];
  } else {
    secrets[slug] = apiKey.trim();
  }
  writeSecretsFile(secrets);
}

export function maskApiKey(key: string | null): string | null {
  if (!key) return null;
  const trimmed = key.trim();
  if (trimmed.length <= 6) return '••••••';
  return `••••${trimmed.slice(-4)}`;
}

export function addProductionLog(entry: {
  eventType: string;
  providerSlug?: string | null;
  model?: string | null;
  batchId?: string | null;
  assetId?: string | null;
  status: 'success' | 'error' | 'info';
  latencyMs?: number | null;
  message: string;
}): void {
  db.prepare(
    `INSERT INTO production_logs (event_type, provider_slug, model, batch_id, asset_id, status, latency_ms, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entry.eventType,
    entry.providerSlug ?? null,
    entry.model ?? null,
    entry.batchId ?? null,
    entry.assetId ?? null,
    entry.status,
    entry.latencyMs ?? null,
    entry.message,
    new Date().toISOString()
  );
}

export function getRecentLogs(limit = 100): ProductionLogEntry[] {
  const rows = db
    .prepare(
      `SELECT id, event_type, provider_slug, model, batch_id, asset_id, status, latency_ms, message, created_at
       FROM production_logs ORDER BY id DESC LIMIT ?`
    )
    .all(limit) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: Number(r.id),
    eventType: String(r.event_type),
    providerSlug: r.provider_slug ? String(r.provider_slug) : null,
    model: r.model ? String(r.model) : null,
    batchId: r.batch_id ? String(r.batch_id) : null,
    assetId: r.asset_id ? String(r.asset_id) : null,
    status: (r.status as 'success' | 'error' | 'info') ?? 'info',
    latencyMs: r.latency_ms !== null && r.latency_ms !== undefined ? Number(r.latency_ms) : null,
    message: String(r.message),
    createdAt: String(r.created_at),
  }));
}

export function mapAssetRow(row: Record<string, unknown>, includeSvg = false): StockAsset {
  const svgFilename = String(row.svg_filename);
  let svgContent: string | undefined;
  if (includeSvg) {
    const safePath = resolveSafeAssetPath(svgFilename);
    if (safePath && fs.existsSync(safePath)) {
      svgContent = fs.readFileSync(safePath, 'utf8');
    }
  }
  return {
    id: String(row.id),
    batchId: row.batch_id ? String(row.batch_id) : null,
    prompt: String(row.prompt),
    category: row.category as StockAsset['category'],
    style: row.style as StockAsset['style'],
    targetPlatform: row.target_platform as StockAsset['targetPlatform'],
    providerSlug: row.provider_slug as ProviderSlug,
    model: String(row.model),
    title: String(row.title),
    description: String(row.description),
    keywords: JSON.parse(String(row.keywords_json)),
    adobeCategory: String(row.adobe_category),
    shutterstockCategory: String(row.shutterstock_category),
    svgFilename,
    svgHash: String(row.svg_hash),
    svgContent,
    validation: JSON.parse(String(row.validation_json)),
    width: Number(row.width),
    height: Number(row.height),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function resolveSafeAssetPath(filename: string): string | null {
  const sanitized = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '');
  if (!sanitized || sanitized !== filename) {
    return null;
  }
  const resolved = path.resolve(ASSETS_DIR, sanitized);
  if (!resolved.startsWith(ASSETS_DIR + path.sep)) {
    return null;
  }
  return resolved;
}

export function mapBatchRow(row: Record<string, unknown>, items?: BatchItem[]): BatchJob {
  return {
    id: String(row.id),
    name: String(row.name),
    basePrompt: String(row.base_prompt),
    category: row.category as BatchJob['category'],
    style: row.style as BatchJob['style'],
    targetPlatform: row.target_platform as BatchJob['targetPlatform'],
    providerSlug: row.provider_slug as ProviderSlug,
    model: String(row.model),
    requestedCount: Number(row.requested_count),
    concurrency: Number(row.concurrency),
    status: row.status as BatchJob['status'],
    completedCount: Number(row.completed_count),
    failedCount: Number(row.failed_count),
    duplicateSkippedCount: Number(row.duplicate_skipped_count),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    items,
  };
}

export function getStorageBytes(): number {
  let total = 0;
  if (fs.existsSync(DB_PATH)) {
    total += fs.statSync(DB_PATH).size;
  }
  if (fs.existsSync(ASSETS_DIR)) {
    for (const file of fs.readdirSync(ASSETS_DIR)) {
      const p = path.join(ASSETS_DIR, file);
      if (fs.statSync(p).isFile()) {
        total += fs.statSync(p).size;
      }
    }
  }
  return total;
}

export function updateProviderRecordStatus(
  slug: ProviderSlug,
  status: ProviderStatus,
  lastError: string | null,
  rateLimitInfo?: Record<string, string> | null
): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE providers
     SET status = ?, last_tested_at = ?, last_error = ?,
         rate_limit_info = COALESCE(?, rate_limit_info), updated_at = ?
     WHERE slug = ?`
  ).run(
    status,
    now,
    lastError,
    rateLimitInfo ? JSON.stringify(rateLimitInfo) : null,
    now,
    slug
  );
}
