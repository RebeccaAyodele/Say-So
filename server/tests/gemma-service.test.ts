import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gemmaService } from '../src/services/gemma-service.js';
import { profileService } from '../src/services/profile-service.js';
import { config } from '../src/config.js';
import type { GenerateRepliesRequest } from '@sayso/shared';

describe('GemmaService Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const sampleRequest: GenerateRepliesRequest = {
    contactRef: 'contact_abc123',
    context: {
      activeContactName: 'Bisi',
      messages: [
        { role: 'them', text: 'Hey, are you free for a quick sync today?' },
      ],
    },
    instructions: 'Tell them 3pm works best',
  };

  it('assembles prompt with 3-layer personalization context and guardrails', () => {
    const layeredStyle = {
      generalStyleSummary: ['Formality: casual (moderate)', 'Greeting: Hey (frequent)'],
      contactFormality: 'casual',
      contactGreetings: ['Hey Bisi'],
      contactCommonPhrases: ['no wahala'],
      contactEmojiPreference: 'minimal',
      relationship: 'friend',
    };

    const { systemPrompt, userPrompt } = gemmaService.assemblePrompt(sampleRequest, layeredStyle);

    // Guardrails check
    expect(systemPrompt).toContain('NEVER use generic templates or placeholders');
    expect(systemPrompt).toContain('Option 1 MUST be "brief"');
    expect(systemPrompt).toContain('Option 2 MUST be "warm"');
    expect(systemPrompt).toContain('Option 3 MUST be "direct"');

    // Context check
    expect(userPrompt).toContain('Formality Level: casual');
    expect(userPrompt).toContain('Typical Greetings: Hey Bisi');
    expect(userPrompt).toContain('Natural Phrases: no wahala');
    expect(userPrompt).toContain('SPECIFIC USER INSTRUCTION (Overrides general habits): "Tell them 3pm works best"');
    expect(userPrompt).toContain('[Bisi]: Hey, are you free for a quick sync today?');
  });

  it('bounds messages to at most 20 in prompt assembly', () => {
    const longMessages = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? ('them' as const) : ('me' as const),
      text: `Message ${i + 1}`,
    }));

    const req: GenerateRepliesRequest = {
      contactRef: 'contact_long',
      context: { messages: longMessages },
    };

    const { userPrompt } = gemmaService.assemblePrompt(req, {
      generalStyleSummary: [],
      contactFormality: 'casual',
      contactGreetings: [],
      contactCommonPhrases: [],
      contactEmojiPreference: 'minimal',
    });

    // Should include message 30 and message 11, but exclude message 10
    expect(userPrompt).toContain('Message 30');
    expect(userPrompt).toContain('Message 11');
    expect(userPrompt).not.toContain('Message 10');
  });

  it('parses valid JSON response into 3-card response contract', () => {
    const rawJson = JSON.stringify({
      options: [
        { id: 'opt_1', style: 'brief', text: '3pm works.' },
        { id: 'opt_2', style: 'warm', text: 'Hey Bisi! 3pm works great for me 😊' },
        { id: 'opt_3', style: 'direct', text: "Let's do 3pm today." },
      ],
    });

    const result = gemmaService.parseAndValidateResponse('req_123', rawJson);

    expect(result.requestId).toBe('req_123');
    expect(result.options).toHaveLength(3);
    expect(result.options[0].style).toBe('brief');
    expect(result.options[0].text).toBe('3pm works.');
    expect(result.options[1].style).toBe('warm');
    expect(result.options[2].style).toBe('direct');
    expect(result.model.provider).toBe('openrouter');
  });

  it('strips markdown code blocks (```json) safely before parsing', () => {
    const markdownWrapped = '```json\n{"options": [{"id": "1", "style": "brief", "text": "Yes"}, {"id": "2", "style": "warm", "text": "Sure thing!"}, {"id": "3", "style": "direct", "text": "Confirmed."}]}\n```';

    const result = gemmaService.parseAndValidateResponse('req_markdown', markdownWrapped);

    expect(result.options).toHaveLength(3);
    expect(result.options[0].text).toBe('Yes');
  });

  it('throws INVALID_MODEL_OUTPUT if model produces fewer than 3 options', () => {
    const malformed = JSON.stringify({
      options: [{ id: '1', style: 'brief', text: 'Only one' }],
    });

    expect(() => gemmaService.parseAndValidateResponse('req_bad', malformed)).toThrow(
      'Model did not produce the required 3 options'
    );
  });

  it('generates 3 options end-to-end via fallback when API key is not set', async () => {
    vi.spyOn(profileService, 'getLayeredStyleContext').mockResolvedValue({
      generalStyleSummary: [],
      contactFormality: 'casual',
      contactGreetings: ['Hey'],
      contactCommonPhrases: [],
      contactEmojiPreference: 'minimal',
    });

    const origKey = config.OPENROUTER_API_KEY;
    (config as Record<string, unknown>).OPENROUTER_API_KEY = '';

    try {
      const result = await gemmaService.generateReplies('user_123', sampleRequest);

      expect(result.options).toHaveLength(3);
      expect(result.options.map((o) => o.style)).toEqual(['brief', 'warm', 'direct']);
      expect(result.model.modelId).toBeDefined();
    } finally {
      (config as Record<string, unknown>).OPENROUTER_API_KEY = origKey;
    }
  });
});
