import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server/app.js';

let cachedApp: ReturnType<typeof createApp> | null = null;
let initError: string | null = null;

function getApp() {
  if (!cachedApp && !initError) {
    try {
      cachedApp = createApp();
    } catch (err) {
      initError = err instanceof Error ? err.message : String(err);
    }
  }
  return cachedApp;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const app = getApp();
  if (!app) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: initError || 'Backend initialization failed' }));
    return;
  }

  const parsed = new URL(req.url || '/', 'http://localhost');
  const sfPath = parsed.searchParams.get('__sf_path');
  if (sfPath !== null) {
    parsed.searchParams.delete('__sf_path');
    const qs = parsed.searchParams.toString();
    const cleanPath = sfPath.replace(/^\/+/, '');
    req.url = `/api${cleanPath ? `/${cleanPath}` : ''}${qs ? `?${qs}` : ''}`;
  } else if (parsed.pathname === '/api/index' || parsed.pathname === '/api/index.ts') {
    parsed.pathname = '/api';
    req.url = `${parsed.pathname}${parsed.search}`;
  } else if (!parsed.pathname.startsWith('/api')) {
    const cleanPath = parsed.pathname.replace(/^\/+/, '');
    req.url = `/api${cleanPath ? `/${cleanPath}` : ''}${parsed.search}`;
  }

  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
