import 'dotenv/config';

import {createServer} from './server/app/createServer';

async function bootstrap() {
  const app = await createServer();

  // Hardcoded to port 3000 as mandated by infrastructure
  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://127.0.0.1:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

bootstrap().catch((err) => {
  console.error('[Server Fail] Bootstrap error:', err);
  process.exitCode = 1;
});
export default bootstrap;
