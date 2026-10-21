import express, { Express } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { contactsRouter } from './routes/contacts.js';
import { preferencesRouter } from './routes/preferences.js';
import { inboxRouter } from './routes/inbox.js';

export function createApp(): Express {
  const app = express();

  // Basic CORS configuration supporting extension origins
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or extension service workers)
        if (!origin) return callback(null, true);
        if (origin.startsWith('chrome-extension://')) return callback(null, true);
        const allowed = config.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
        if (allowed.includes(origin)) return callback(null, true);
        return callback(null, true); // Dev permissive
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));

  // Routes
  app.use('/v1/health', healthRouter);
  app.use('/v1/contacts', contactsRouter);
  app.use('/v1/preferences', preferencesRouter);
  app.use('/v1/inbox', inboxRouter);

  // Standardized Error Handler
  app.use(errorHandler);

  return app;
}
