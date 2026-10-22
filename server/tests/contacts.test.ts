import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { profileService } from '../src/services/profile-service.js';

describe('Contacts Profile Route (/v1/contacts/:contactRef/profile)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET returns 404 if profile does not exist', async () => {
    vi.spyOn(profileService, 'getContactProfile').mockResolvedValue(null);

    const res = await request(app)
      .get('/v1/contacts/contact_hash_123/profile')
      .set('Authorization', 'Bearer test_user_1');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET returns profile when contact exists', async () => {
    vi.spyOn(profileService, 'getContactProfile').mockResolvedValue({
      userId: 'test_user_1',
      contactRef: 'contact_hash_123',
      contactName: 'Alice',
      profileMode: 'custom',
      contactStyle: {
        formality: 'casual',
        relationship: 'colleague',
      },
      userToContactStyle: {
        greetings: ['Hey Alice'],
        commonPhrases: ['sounds good'],
        emojiPreference: 'moderate',
      },
      userOverrides: {},
      schemaVersion: 1,
      createdAt: '2026-10-21T00:00:00.000Z',
      updatedAt: '2026-10-21T00:00:00.000Z',
    });

    const res = await request(app)
      .get('/v1/contacts/contact_hash_123/profile')
      .set('Authorization', 'Bearer test_user_1');

    expect(res.status).toBe(200);
    expect(res.body.contactName).toBe('Alice');
    expect(res.body.contactStyle.formality).toBe('casual');
  });

  it('PUT updates or creates contact profile', async () => {
    vi.spyOn(profileService, 'upsertContactProfile').mockResolvedValue({
      userId: 'test_user_1',
      contactRef: 'contact_hash_123',
      contactName: 'Alice Smith',
      profileMode: 'custom',
      contactStyle: {
        formality: 'formal',
      },
      userToContactStyle: {
        greetings: ['Hello Alice'],
        commonPhrases: [],
        emojiPreference: 'none',
      },
      userOverrides: {
        tone: 'direct',
      },
      schemaVersion: 1,
      createdAt: '2026-10-21T00:00:00.000Z',
      updatedAt: '2026-10-21T00:00:00.000Z',
    });

    const res = await request(app)
      .put('/v1/contacts/contact_hash_123/profile')
      .set('Authorization', 'Bearer test_user_1')
      .send({
        contactName: 'Alice Smith',
        profileMode: 'custom',
        contactStyle: {
          formality: 'formal',
        },
        userOverrides: {
          tone: 'direct',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.contactName).toBe('Alice Smith');
    expect(res.body.contactStyle.formality).toBe('formal');
  });

  it('DELETE deletes contact profile', async () => {
    vi.spyOn(profileService, 'deleteContactProfile').mockResolvedValue(true);

    const res = await request(app)
      .delete('/v1/contacts/contact_hash_123/profile')
      .set('Authorization', 'Bearer test_user_1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deleted).toBe(true);
  });
});
