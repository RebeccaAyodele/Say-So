import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactProfileModel, UserProfileModel } from '../src/db/models/index.js';
import { profileService } from '../src/services/profile-service.js';

describe('ProfileService layered contact style', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    profileService.invalidateLayeredContextCache('style_test_user');
  });

  it('keeps contact-scoped signals out of the general voice and other contacts', async () => {
    const userProfile = {
      styleSignals: [
        { category: 'slang', pattern: 'global phrase', tendency: 'preferred', confidence: 'medium', scope: 'general', overrideStatus: false },
        { category: 'emoji', pattern: '😊', tendency: 'preferred', confidence: 'medium', scope: 'contact', context: 'contact_a', overrideStatus: false },
        { category: 'slang', pattern: 'ma', tendency: 'preferred', confidence: 'high', scope: 'contact', context: 'contact_b', overrideStatus: false },
        { category: 'slang', pattern: 'weak signal', tendency: 'preferred', confidence: 'low', scope: 'general', overrideStatus: false },
      ],
      toObject() {
        return { userId: 'style_test_user', styleSignals: this.styleSignals };
      },
    };
    vi.spyOn(UserProfileModel, 'findOne').mockResolvedValue(userProfile as any);
    vi.spyOn(ContactProfileModel, 'findOne').mockResolvedValue(null);

    const contactA = await profileService.getLayeredStyleContext('style_test_user', 'contact_a');
    const contactB = await profileService.getLayeredStyleContext('style_test_user', 'contact_b');

    expect(contactA.generalStyleSummary).toEqual(['slang: global phrase (preferred)']);
    expect(contactA.contactStyleSummary).toEqual(['emoji: 😊 (preferred, medium confidence)']);
    expect(contactA.contactEmojiPreference).toBe('minimal');
    expect(contactB.contactStyleSummary).toEqual(['slang: ma (preferred, high confidence)']);
    expect(contactB.generalStyleSummary).toEqual(contactA.generalStyleSummary);
  });

  it('uses repeated no-emoji evidence for that contact only', async () => {
    const userProfile = {
      styleSignals: [
        { category: 'emoji', pattern: 'no_emojis', tendency: 'avoided', confidence: 'medium', scope: 'contact', context: 'contact_a', overrideStatus: false },
      ],
      toObject() {
        return { userId: 'style_test_user', styleSignals: this.styleSignals };
      },
    };
    vi.spyOn(UserProfileModel, 'findOne').mockResolvedValue(userProfile as any);
    vi.spyOn(ContactProfileModel, 'findOne').mockResolvedValue(null);

    const style = await profileService.getLayeredStyleContext('style_test_user', 'contact_a');
    const otherContact = await profileService.getLayeredStyleContext('style_test_user', 'contact_b');

    expect(style.contactEmojiPreference).toBe('none');
    expect(otherContact.contactEmojiPreference).toBe('minimal');
  });

  it('refreshes cached style context after learning invalidates the user cache', async () => {
    const signals: any[] = [
      { category: 'slang', pattern: 'first phrase', tendency: 'preferred', confidence: 'medium', scope: 'general', overrideStatus: false },
    ];
    const userProfile = {
      get styleSignals() { return signals; },
      toObject() {
        return { userId: 'style_test_user', styleSignals: signals };
      },
    };
    const profileRead = vi.spyOn(UserProfileModel, 'findOne').mockResolvedValue(userProfile as any);
    vi.spyOn(ContactProfileModel, 'findOne').mockResolvedValue(null);

    const initial = await profileService.getLayeredStyleContext('style_test_user', 'contact_a');
    signals.push({ category: 'slang', pattern: 'new phrase', tendency: 'preferred', confidence: 'high', scope: 'general', overrideStatus: false });
    profileService.invalidateLayeredContextCache('style_test_user');
    const refreshed = await profileService.getLayeredStyleContext('style_test_user', 'contact_a');

    expect(initial.generalStyleSummary).toEqual(['slang: first phrase (preferred)']);
    expect(refreshed.generalStyleSummary).toContain('slang: new phrase (preferred)');
    expect(profileRead).toHaveBeenCalledTimes(2);
  });

  it('preserves an explicit custom contact emoji preference', async () => {
    const userProfile = {
      styleSignals: [],
      toObject() {
        return { userId: 'style_test_user', styleSignals: [] };
      },
    };
    vi.spyOn(UserProfileModel, 'findOne').mockResolvedValue(userProfile as any);
    vi.spyOn(ContactProfileModel, 'findOne').mockResolvedValue({
      profileMode: 'custom',
      userToContactStyle: { emojiPreference: 'none' },
      contactStyle: { formality: 'formal' },
    } as any);

    const style = await profileService.getLayeredStyleContext('style_test_user', 'contact_a');

    expect(style.contactEmojiPreference).toBe('none');
  });
});
