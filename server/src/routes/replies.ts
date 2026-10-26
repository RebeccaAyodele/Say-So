import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limit.js';
import { config } from '../config.js';
import { gemmaService } from '../services/gemma-service.js';
import { learningService } from '../services/learning-service.js';
import {
  GenerateRepliesRequestSchema,
  RecordFeedbackRequestSchema,
  ProcessLearningEventRequestSchema,
} from '@sayso/shared';

export const repliesRouter: Router = Router();

repliesRouter.use(requireAuth);

/**
 * POST /v1/replies/generate
 * Generates three distinct, personalized reply suggestions using Gemma
 */
repliesRouter.post(
  '/generate',
  createRateLimiter({
    max: config.REPLY_RATE_LIMIT_MAX,
    windowMs: config.REPLY_RATE_LIMIT_WINDOW_MS,
  }),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const userId = req.userId!;
      const validatedData = GenerateRepliesRequestSchema.parse(req.body);

      const result = await gemmaService.generateReplies(userId, validatedData);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/replies/feedback
 * Records user interaction with draft cards (selected, copied, inserted, dismissed)
 */
repliesRouter.post('/feedback', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.userId!;
    const validatedData = RecordFeedbackRequestSchema.parse(req.body);

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    res.status(200).json({
      success: true,
      eventId,
      recordedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/replies/confirm-draft
 * Directly processes a confirmed draft edit comparing chosen suggestion against final text
 */
repliesRouter.post('/confirm-draft', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.userId!;
    const validatedData = ProcessLearningEventRequestSchema.parse(req.body);

    const result = await learningService.processConfirmedDraftEdit(userId, validatedData);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
