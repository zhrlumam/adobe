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

  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
