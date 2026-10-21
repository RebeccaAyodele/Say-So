import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { preferenceService } from '../services/preference-service.js';
import { UpdatePreferencesRequestSchema } from '@sayso/shared';

export const preferencesRouter: Router = Router();

preferencesRouter.use(requireAuth);

/**
 * GET /v1/preferences
 * Returns the authenticated user's global preferences
 */
preferencesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const prefs = await preferenceService.getUserPreferences(userId);
  res.status(200).json(prefs);
});

/**
 * PUT /v1/preferences
 * Updates user defaults (tone, reply length, context window size)
 */
preferencesRouter.put('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.userId!;
    const validatedData = UpdatePreferencesRequestSchema.parse(req.body);
    const updated = await preferenceService.updateUserPreferences(userId, validatedData);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});
