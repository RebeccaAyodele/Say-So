import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { profileService } from '../services/profile-service.js';
import { UpdateContactProfileRequestSchema } from '@sayso/shared';

export const contactsRouter: Router = Router();

contactsRouter.use(requireAuth);

/**
 * GET /v1/contacts/:contactRef/profile
 * Returns the authenticated user's profile for that contact
 */
contactsRouter.get('/:contactRef/profile', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const { contactRef } = req.params;

  const profile = await profileService.getContactProfile(userId, contactRef);

  if (!profile) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `No communication profile found for contact reference '${contactRef}'`,
      },
    });
    return;
  }

  res.status(200).json(profile);
});

/**
 * PUT /v1/contacts/:contactRef/profile
 * Updates editable contact preferences, overrides, and profile mode
 */
contactsRouter.put('/:contactRef/profile', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.userId!;
    const { contactRef } = req.params;

    const validatedData = UpdateContactProfileRequestSchema.parse(req.body);
    const updated = await profileService.upsertContactProfile(userId, contactRef, validatedData);

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /v1/contacts/:contactRef/profile
 * Deletes the authenticated user's contact profile
 */
contactsRouter.delete('/:contactRef/profile', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const { contactRef } = req.params;

  const deleted = await profileService.deleteContactProfile(userId, contactRef);

  res.status(200).json({
    success: true,
    deleted,
    message: deleted
      ? `Profile for contact '${contactRef}' deleted successfully`
      : `No profile existed for contact '${contactRef}'`,
  });
});
