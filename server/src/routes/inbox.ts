import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { candidateService } from '../services/candidate-service.js';
import {
  SyncInboxRequestSchema,
  DismissCandidateRequestSchema,
} from '@sayso/shared';

export const inboxRouter: Router = Router();

inboxRouter.use(requireAuth);

/**
 * POST /v1/inbox/sync
 * Synchronizes minimal candidate metadata and revisions without conversation bodies
 */
inboxRouter.post('/sync', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.userId!;
    const validatedData = SyncInboxRequestSchema.parse(req.body);

    const result = await candidateService.syncCandidates(userId, validatedData.candidates);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/inbox/candidates
 * Lists active candidates awaiting a reply
 */
inboxRouter.get('/candidates', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const candidates = await candidateService.listActiveCandidates(userId);
  res.status(200).json({ candidates });
});

/**
 * POST /v1/inbox/dismiss
 * Dismisses a candidate persistently for a specific revision
 */
inboxRouter.post('/dismiss', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.userId!;
    const { contactRef, revision } = DismissCandidateRequestSchema.parse(req.body);

    const success = await candidateService.dismissCandidate(userId, contactRef, revision);
    res.status(200).json({
      success,
      contactRef,
      status: 'dismissed',
    });
  } catch (err) {
    next(err);
  }
});
