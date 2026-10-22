import { createApp } from './app.js';
import { config } from './config.js';
import { connectToDatabase } from './db/connection.js';
import { initSentry } from './services/tracer.js';

async function bootstrap() {
  initSentry();
  const app = createApp();

  try {
    await connectToDatabase();
  } catch (error) {
    console.warn('[Database] Initial connection attempt failed. Running in degraded state:', error);
  }

  const server = app.listen(config.PORT, () => {
    console.log(`[Server] SaySo API listening on port ${config.PORT} (${config.NODE_ENV})`);
    console.log(`[Server] Health check: http://localhost:${config.PORT}/v1/health`);
  });

  const shutdown = async () => {
    console.log('[Server] Gracefully shutting down...');
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
