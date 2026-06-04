import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './server/routes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  const app = express();
  
  // Expose JSON body parsing
  app.use(express.json());

  // Mount API router
  app.use('/api', apiRouter);

  // Serve static files based on environment
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Development mode with inline Vite Dev Server middleware
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  // Hardcoded to port 3000 as mandated by infrastructure
  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://127.0.0.1:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

bootstrap().catch((err) => {
  console.error('[Server Fail] Bootstrap error:', err);
});
export default bootstrap;
