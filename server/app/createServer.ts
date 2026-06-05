import express from 'express';
import path from 'path';

import {registerRoutes} from './registerRoutes';

export async function createServer() {
  const app = express();

  app.use(express.json());
  app.use('/api', registerRoutes());

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  return app;
}
