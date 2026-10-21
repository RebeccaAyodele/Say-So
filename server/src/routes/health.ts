import { Router, Request, Response } from 'express';
import { isDatabaseConnected } from '../db/connection.js';
import { config } from '../config.js';

export const healthRouter: Router = Router();

healthRouter.get('/', (req: Request, res: Response) => {
  const dbConnected = isDatabaseConnected();
  const status = dbConnected ? 'ok' : 'degraded';

  res.status(200).json({
    status,
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    service: 'sayso-api',
    environment: config.NODE_ENV,
    checks: {
      database: dbConnected ? 'connected' : 'disconnected',
    },
  });
});
