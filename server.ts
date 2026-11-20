import path from 'node:path';
import express from 'express';
import { createApp } from './server/app.js';

export { createApp };

async function startServer() {
  const app = createApp();
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StockForge Studio server running at http://0.0.0.0:${PORT}`);
  });
}

// Only bind port when executed directly as entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('server.ts')) {
  void startServer();
}
