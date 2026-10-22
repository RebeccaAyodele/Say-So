import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { gemmaService } from '../services/gemma-service.js';
import { learningService } from '../services/learning-service.js';
import { LearningEventModel } from '../db/models/index.js';
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
repliesRouter.post('/generate', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.userId!;
    const validatedData = GenerateRepliesRequestSchema.parse(req.body);

    const result = await gemmaService.generateReplies(userId, validatedData);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/replies/feedback
 * Records user interaction with draft cards (selected, copied, inserted, dismissed)
 */
repliesRouter.post('/feedback', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.userId!;
    const validatedData = RecordFeedbackRequestSchema.parse(req.body);

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // If confirmed draft text is attached, process deterministic style learning
    let learningResult;
    if (validatedData.confirmedDraft) {
      learningResult = await learningService.processConfirmedDraftEdit(userId, {
        eventId,
        contactRef: validatedData.contactRef,
        originalOption: {
          id: validatedData.optionId,
          style: 'selected',
          text: validatedData.optionId, // fallback text or identifier
        },
        confirmedDraft: validatedData.confirmedDraft,
      });
    }

    res.status(200).json({
      success: true,
      eventId,
      recordedAt: new Date().toISOString(),
      learningResult,
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
