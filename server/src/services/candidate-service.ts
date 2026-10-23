import { ReplyCandidateModel } from '../db/models/index.js';
import type {
  CandidateSyncItem,
  ReplyCandidate,
} from '@sayso/shared';

export class CandidateService {
  async syncCandidates(
    userId: string,
    items: CandidateSyncItem[]
  ): Promise<{ syncedCount: number; activeCount: number }> {
    let syncedCount = 0;

    for (const item of items) {
      const existing = await ReplyCandidateModel.findOne({
        userId,
        contactRef: item.contactRef,
      });

      if (!existing) {
        // New candidate
        const initialStatus = item.lastMessageDirection === 'incoming' ? 'active' : 'replied';
        await ReplyCandidateModel.create({
          userId,
          contactRef: item.contactRef,
          contactName: item.contactName,
          revision: item.revision,
          status: initialStatus,
          lastMessageDirection: item.lastMessageDirection,
          lastMessageTimestamp: item.lastMessageTimestamp,
          unreadCount: item.unreadCount || 0,
          isGroup: item.isGroup ?? false,
        });
        syncedCount++;
      } else {
        // Candidate already exists
        const revisionChanged = existing.revision !== item.revision;
        existing.contactName = item.contactName || existing.contactName;
        existing.lastMessageDirection = item.lastMessageDirection;
        existing.lastMessageTimestamp = item.lastMessageTimestamp;
        existing.unreadCount = item.unreadCount ?? existing.unreadCount;
        existing.isGroup = item.isGroup ?? existing.isGroup;

        if (revisionChanged) {
          existing.revision = item.revision;
          // If there is new activity (incoming message), reactivate even if previously dismissed
          if (item.lastMessageDirection === 'incoming') {
            existing.status = 'active';
            existing.dismissedAt = undefined;
          } else {
            existing.status = 'replied';
          }
        }
        // If revision hasn't changed and status is 'dismissed', PRESERVE dismissal status

        await existing.save();
        syncedCount++;
      }
    }

    const activeCount = await ReplyCandidateModel.countDocuments({
      userId,
      status: 'active',
    });

    return { syncedCount, activeCount };
  }

  async listActiveCandidates(userId: string): Promise<ReplyCandidate[]> {
    const candidates = await ReplyCandidateModel.find({
      userId,
      status: 'active',
    }).sort({ updatedAt: -1 });

    return candidates.map((c) => c.toObject() as unknown as ReplyCandidate);
  }

  async dismissCandidate(
    userId: string,
    contactRef: string,
    revision: string
  ): Promise<boolean> {
    const candidate = await ReplyCandidateModel.findOne({ userId, contactRef });

    if (!candidate) {
      // Create as dismissed directly
      await ReplyCandidateModel.create({
        userId,
        contactRef,
        revision,
        status: 'dismissed',
        lastMessageDirection: 'incoming',
        dismissedAt: new Date().toISOString(),
      });
      return true;
    }

    candidate.status = 'dismissed';
    candidate.revision = revision;
    candidate.dismissedAt = new Date().toISOString();
    await candidate.save();
    return true;
  }
}

export const candidateService = new CandidateService();
