import express, { Express, Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';
import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';
import { contactsRouter } from './routes/contacts.js';
import { preferencesRouter } from './routes/preferences.js';
import { inboxRouter } from './routes/inbox.js';
import { repliesRouter } from './routes/replies.js';

/** Determines whether an incoming origin should be allowed */
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // no-origin requests (curl, service workers, Render health probe)
  if (origin.startsWith('chrome-extension://')) return true;
  const allowed = config.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  return allowed.includes('*') || allowed.includes(origin);
}

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    callback(null, isAllowedOrigin(origin));
  },
  credentials: true,
  // Enumerate every method + header the extension actually uses so the
  // browser's OPTIONS preflight gets a complete response BEFORE auth middleware.
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-Time'],
  maxAge: 86400, // cache preflight for 24 h — eliminates repeated OPTIONS round-trips
};

export function createApp(): Express {
  const app = express();

  // ① CORS — must come FIRST so preflight OPTIONS is answered before auth runs
  app.use(cors(corsOptions));

  // ② Explicitly handle preflight for all routes (belt-and-suspenders)
  app.options('*', cors(corsOptions));

  // ③ Request timing — adds X-Request-Time header for latency measurement
  app.use((_req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const originalEnd = res.end.bind(res);
    res.end = ((...args: Parameters<Response['end']>) => {
      if (!res.headersSent) res.setHeader('X-Request-Time', `${Date.now() - start}ms`);
      return originalEnd(...args);
    }) as Response['end'];
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  // Root route – friendly landing for the base URL
  app.get('/', (_req, res) => {
    res.json({
      name: 'Say-So API',
      status: 'online',
      docs: '/v1/health',
    });
  });

  // Routes
  app.use('/v1/health', healthRouter);
  app.use('/v1/contacts', contactsRouter);
  app.use('/v1/preferences', preferencesRouter);
  app.use('/v1/inbox', inboxRouter);
  app.use('/v1/replies', repliesRouter);

  // Standardized Error Handler
  app.use(errorHandler);

  return app;
}
