import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { ASSETS_DIR, BACKUPS_DIR, DB_PATH, addProductionLog, db } from './db.js';

export async function createLocalBackupArchive(): Promise<{
  filename: string;
  filePath: string;
  buffer: Buffer;
  assetCount: number;
}> {
  const zip = new JSZip();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `zuumstock-backup-${stamp}.zip`;
  const snapshotPath = path.join(BACKUPS_DIR, `snapshot-${stamp}.db`);

  // Clean consistent SQLite snapshot using VACUUM INTO
  db.exec(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`);
  const dbBuffer = fs.readFileSync(snapshotPath);
  zip.file('stockforge.db', dbBuffer);
  fs.unlinkSync(snapshotPath);

  const assetsFolder = zip.folder('assets')!;
  let assetCount = 0;
  if (fs.existsSync(ASSETS_DIR)) {
    for (const file of fs.readdirSync(ASSETS_DIR)) {
      if (file.endsWith('.svg')) {
        const content = fs.readFileSync(path.join(ASSETS_DIR, file), 'utf8');
        assetsFolder.file(file, content);
        assetCount++;
      }
    }
  }

  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        application: 'ZuumStock Studio',
        createdAt: new Date().toISOString(),
        assetCount,
        databaseBytes: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0,
        note: 'API secrets are intentionally excluded from portable backups.',
      },
      null,
      2
    )
  );

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const filePath = path.join(BACKUPS_DIR, filename);
  fs.writeFileSync(filePath, buffer);

  addProductionLog({
    eventType: 'backup_created',
    status: 'success',
    message: `Created backup ${filename} (${assetCount} SVG assets)`,
  });

  return { filename, filePath, buffer, assetCount };
}

export function listLocalBackups(): { filename: string; sizeBytes: number; createdAt: string }[] {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  return fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith('.zip'))
    .map((filename) => {
      const stat = fs.statSync(path.join(BACKUPS_DIR, filename));
      return {
        filename,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
