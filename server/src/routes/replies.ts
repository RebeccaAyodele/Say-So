import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { gemmaService } from '../services/gemma-service.js';
import { LearningEventModel } from '../db/models/index.js';
import {
  GenerateRepliesRequestSchema,
  RecordFeedbackRequestSchema,
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
 * Records user interaction with draft cards (selected, copied, inserted, dismissed, or edited)
 */
repliesRouter.post('/feedback', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.userId!;
    const validatedData = RecordFeedbackRequestSchema.parse(req.body);

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Persist feedback to MongoDB for audit and learning engine
    await LearningEventModel.create({
      userId,
      eventId,
      eventType: validatedData.feedbackType,
      contactRef: validatedData.contactRef,
      originalDraft: validatedData.optionId,
      finalDraft: validatedData.confirmedDraft,
      diffSummary: validatedData.confirmedDraft ? 'draft_confirmed' : undefined,
      appliedSignals: [],
    });

    res.status(200).json({
      success: true,
      eventId,
      recordedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});
