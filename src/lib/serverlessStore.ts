import type { BatchJob, StockAsset } from '../types/stockforge';

const DB_NAME = 'stockforge_vercel_db';
const DB_VERSION = 1;
const ASSETS_STORE = 'assets';
const BATCHES_STORE = 'batches';
const SERVERLESS_SESSION_KEY = 'sf_is_serverless';

let serverlessRuntimeCache: boolean | null = null;

export function setServerlessRuntimeFlag(isServerless: boolean): void {
  serverlessRuntimeCache = isServerless;
  if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
    try {
      window.sessionStorage.setItem(SERVERLESS_SESSION_KEY, isServerless ? '1' : '0');
    } catch {
      // ignore storage access errors
    }
  }
}

export function getServerlessRuntimeFlag(): boolean {
  if (serverlessRuntimeCache !== null) {
    return serverlessRuntimeCache;
  }
  if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
    try {
      const val = window.sessionStorage.getItem(SERVERLESS_SESSION_KEY);
      if (val === '1') {
        serverlessRuntimeCache = true;
        return true;
      }
      if (val === '0') {
        serverlessRuntimeCache = false;
        return false;
      }
    } catch {
      // ignore storage access errors
    }
  }
  return false;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(ASSETS_STORE)) {
          db.createObjectStore(ASSETS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(BATCHES_STORE)) {
          db.createObjectStore(BATCHES_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveServerlessAssets(assets: StockAsset[]): Promise<void> {
  if (!assets || assets.length === 0) return;
  const db = await openDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(ASSETS_STORE, 'readwrite');
      const store = tx.objectStore(ASSETS_STORE);
      for (const asset of assets) {
        if (asset && typeof asset.id === 'string') {
          store.put(asset);
        }
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function getServerlessAssets(): Promise<StockAsset[]> {
  const db = await openDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(ASSETS_STORE, 'readonly');
      const store = tx.objectStore(ASSETS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? (req.result as StockAsset[]) : [];
        rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        db.close();
        resolve(rows);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    } catch {
      db.close();
      resolve([]);
    }
  });
}

export async function getServerlessAsset(id: string): Promise<StockAsset | null> {
  if (!id) return null;
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(ASSETS_STORE, 'readonly');
      const store = tx.objectStore(ASSETS_STORE);
      const req = store.get(id);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as StockAsset | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function deleteServerlessAsset(id: string): Promise<void> {
  if (!id) return;
  const db = await openDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(ASSETS_STORE, 'readwrite');
      const store = tx.objectStore(ASSETS_STORE);
      store.delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export function mergeAssets(serverAssets: StockAsset[], localAssets: StockAsset[]): StockAsset[] {
  const byId = new Map<string, StockAsset>();

  for (const local of localAssets) {
    if (local && local.id) {
      byId.set(local.id, local);
    }
  }

  for (const server of serverAssets) {
    if (!server || !server.id) continue;
    const existing = byId.get(server.id);
    if (!existing) {
      byId.set(server.id, server);
      continue;
    }
    const serverTime = Date.parse(server.updatedAt || server.createdAt || '') || 0;
    const localTime = Date.parse(existing.updatedAt || existing.createdAt || '') || 0;
    if (serverTime >= localTime) {
      byId.set(server.id, {
        ...server,
        svgContent: server.svgContent || existing.svgContent,
      });
    } else {
      byId.set(server.id, {
        ...existing,
        svgContent: existing.svgContent || server.svgContent,
      });
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
}

export async function saveServerlessBatches(batches: BatchJob[]): Promise<void> {
  if (!batches || batches.length === 0) return;
  const db = await openDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(BATCHES_STORE, 'readwrite');
      const store = tx.objectStore(BATCHES_STORE);
      for (const batch of batches) {
        if (!batch || typeof batch.id !== 'string') continue;
        // Preserve previously saved items if incoming summary batch omits items
        const getReq = store.get(batch.id);
        getReq.onsuccess = () => {
          const prev = getReq.result as BatchJob | undefined;
          const merged: BatchJob =
            prev && !batch.items && prev.items ? { ...batch, items: prev.items } : batch;
          store.put(merged);
        };
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function getServerlessBatches(): Promise<BatchJob[]> {
  const db = await openDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(BATCHES_STORE, 'readonly');
      const store = tx.objectStore(BATCHES_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? (req.result as BatchJob[]) : [];
        rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        db.close();
        resolve(rows);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    } catch {
      db.close();
      resolve([]);
    }
  });
}

export async function getServerlessBatch(id: string): Promise<BatchJob | null> {
  if (!id) return null;
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(BATCHES_STORE, 'readonly');
      const store = tx.objectStore(BATCHES_STORE);
      const req = store.get(id);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as BatchJob | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export function mergeBatches(serverBatches: BatchJob[], localBatches: BatchJob[]): BatchJob[] {
  const byId = new Map<string, BatchJob>();
  for (const local of localBatches) {
    if (local && local.id) byId.set(local.id, local);
  }
  for (const server of serverBatches) {
    if (!server || !server.id) continue;
    const existing = byId.get(server.id);
    if (!existing) {
      byId.set(server.id, server);
      continue;
    }
    const serverTime = Date.parse(server.updatedAt || server.createdAt || '') || 0;
    const localTime = Date.parse(existing.updatedAt || existing.createdAt || '') || 0;
    if (serverTime >= localTime) {
      byId.set(server.id, {
        ...server,
        items: server.items ?? existing.items,
      });
    } else {
      byId.set(server.id, {
        ...existing,
        items: existing.items ?? server.items,
      });
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
}
