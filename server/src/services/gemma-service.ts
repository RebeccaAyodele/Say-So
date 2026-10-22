import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { profileService } from './profile-service.js';
import { AgentTracer } from './tracer.js';
import { AppError } from '../middleware/error-handler.js';
import {
  GenerateRepliesRequest,
  GenerateRepliesResponse,
  GenerateRepliesResponseSchema,
  ReplyOption,
} from '@sayso/shared';

interface OpenRouterChoice {
  message?: {
    content?: string;
  };
}

interface OpenRouterResponse {
  id?: string;
  choices?: OpenRouterChoice[];
  model?: string;
  error?: {
    message?: string;
    code?: number | string;
  };
}

export class GemmaService {
  /**
   * Generates 3 distinct, contextual reply alternatives for WhatsApp Web
   */
  async generateReplies(
    userId: string,
    req: GenerateRepliesRequest
  ): Promise<GenerateRepliesResponse> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Validate request bounds
    await AgentTracer.traceSpan(
      'validate_request',
      'agent.validation',
      {
        messageCount: req.context.messages.length,
        hasInstructions: Boolean(req.instructions),
        hasCustomTone: Boolean(req.tone),
      },
      async () => {
        if (!req.context.messages || req.context.messages.length === 0) {
          throw new AppError('INVALID_REQUEST', 'Conversation context must have at least one message', 400);
        }
      }
    );

    // 2. Fetch Layer 1 (User Style) & Layer 2 (Contact Profile) Context
    const layeredStyle = await AgentTracer.traceSpan(
      'fetch_profile',
      'agent.db.read',
      {
        hasContactRef: Boolean(req.contactRef),
      },
      async () => {
        return await profileService.getLayeredStyleContext(userId, req.contactRef);
      }
    );

    // 3. Assemble Structured Prompt Distinguishing Facts vs. Inferred Preferences
    const { systemPrompt, userPrompt } = await AgentTracer.traceSpan(
      'build_prompt',
      'agent.prompt.assembly',
      {
        contactFormality: layeredStyle.contactFormality,
        signalCount: layeredStyle.generalStyleSummary.length,
      },
      async () => {
        return this.assemblePrompt(req, layeredStyle);
      }
    );

    // 4. Gemma Model Inference via OpenRouter
    const rawContent = await AgentTracer.traceSpan(
      'gemma_inference',
      'ai.chat_completions.openrouter',
      {
        modelId: config.GEMMA_MODEL_ID,
        provider: 'openrouter',
      },
      async () => {
        return await this.callOpenRouterInference(systemPrompt, userPrompt, req);
      }
    );

    // 5. Validate & Parse Strict Three-Option Contract
    const validatedResponse = await AgentTracer.traceSpan(
      'validate_contract',
      'agent.validation.contract',
      {
        modelId: config.GEMMA_MODEL_ID,
      },
      async () => {
        return this.parseAndValidateResponse(requestId, rawContent);
      }
    );

    return validatedResponse;
  }

  /**
   * Constructs the structured prompt adhering to Section 6.4 of the TRD
   */
  assemblePrompt(
    req: GenerateRepliesRequest,
    layeredStyle: {
      generalStyleSummary: string[];
      contactFormality: string;
      contactGreetings: string[];
      contactCommonPhrases: string[];
      contactEmojiPreference: string;
      relationship?: string;
    }
  ): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = [
      'You are SaySo, a privacy-first AI personal reply assistant operating on WhatsApp Web.',
      'Your task is to craft EXACTLY THREE distinct, authentic reply options to the latest incoming message.',
      'CRITICAL GUARDRAILS:',
      '1. NEVER use generic templates or placeholders like [Name], [Date], or [Time].',
      '2. Do NOT repeat or echo the other person’s question verbatim.',
      '3. Option 1 MUST be "brief": concise, low friction, and directly to the point (1-8 words).',
      '4. Option 2 MUST be "warm": friendly, conversational, and natural with appropriate warmth or greeting.',
      '5. Option 3 MUST be "direct": clear, definitive, and proactive.',
      '6. You must output ONLY a valid JSON object matching the requested schema. No markdown formatting, backticks, or extra commentary.',
    ].join('\n');

    // Bound context messages to 20 most recent
    const boundedMessages = req.context.messages.slice(-20);

    const formattedMessages = boundedMessages
      .map((m) => {
        const sender = m.role === 'me' ? 'User (Me)' : (m.senderName || req.context.activeContactName || 'Them');
        return `[${sender}]: ${m.text}`;
      })
      .join('\n');

    const styleInstructions = [
      'PERSONALIZATION CONTEXT (Match this voice):',
      `- Formality Level: ${layeredStyle.contactFormality}`,
      layeredStyle.relationship ? `- Relationship: ${layeredStyle.relationship}` : '',
      layeredStyle.contactGreetings.length > 0
        ? `- Typical Greetings: ${layeredStyle.contactGreetings.join(', ')}`
        : '',
      layeredStyle.contactCommonPhrases.length > 0
        ? `- Natural Phrases: ${layeredStyle.contactCommonPhrases.join(', ')}`
        : '',
      `- Emoji Tendency: ${layeredStyle.contactEmojiPreference}`,
      layeredStyle.generalStyleSummary.length > 0
        ? `- General Habits: ${layeredStyle.generalStyleSummary.join('; ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const userPrompt = [
      styleInstructions,
      '',
      req.instructions ? `SPECIFIC USER INSTRUCTION (Overrides general habits): "${req.instructions}"` : '',
      req.tone ? `REQUESTED TONE: ${req.tone}` : '',
      req.length ? `REQUESTED LENGTH: ${req.length}` : '',
      '',
      'RECENT CONVERSATION HISTORY (Most recent message is at the end):',
      formattedMessages,
      '',
      'OUTPUT SCHEMA REQUIREMENTS:',
      'Respond with a JSON object containing an "options" array with exactly 3 items:',
      '{"options": [{"id": "option_1", "style": "brief", "text": "string"}, {"id": "option_2", "style": "warm", "text": "string"}, {"id": "option_3", "style": "direct", "text": "string"}]}',
    ]
      .filter(Boolean)
      .join('\n');

    return { systemPrompt, userPrompt };
  }

  /**
   * Calls OpenRouter Gemma inference endpoint with timeout handling
   */
  async callOpenRouterInference(
    systemPrompt: string,
    userPrompt: string,
    req: GenerateRepliesRequest
  ): Promise<string> {
    if (!config.OPENROUTER_API_KEY) {
      // Deterministic dev/testing mock fallback when API key is unconfigured
      return this.generateMockFallbackReplies(req);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://github.com/RebeccaAyodele/Say-So',
          'X-Title': 'SaySo Personal Reply Assistant',
        },
        body: JSON.stringify({
          model: config.GEMMA_MODEL_ID,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AppError(
          'MODEL_UNAVAILABLE',
          `OpenRouter API error (${response.status}): ${errorText.substring(0, 200)}`,
          502
        );
      }

      const json = (await response.json()) as OpenRouterResponse;
      const content = json.choices?.[0]?.message?.content;

      if (!content) {
        throw new AppError('INVALID_MODEL_OUTPUT', 'OpenRouter returned an empty model output', 502);
      }

      return content;
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AppError('MODEL_TIMEOUT', 'Gemma inference timed out after 15 seconds', 504);
      }
      throw new AppError('MODEL_UNAVAILABLE', `Gemma inference failed: ${err instanceof Error ? err.message : String(err)}`, 502);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parses JSON output, removes Markdown backticks, and validates the 3-option contract
   */
  parseAndValidateResponse(requestId: string, rawContent: string): GenerateRepliesResponse {
    let cleanJson = rawContent.trim();

    // Strip markdown code fences if present (e.g. ```json ... ```)
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      throw new AppError('INVALID_MODEL_OUTPUT', 'Model response was not valid JSON', 502);
    }

    const obj = parsed as { options?: ReplyOption[] };
    if (!obj || !Array.isArray(obj.options) || obj.options.length < 3) {
      throw new AppError('INVALID_MODEL_OUTPUT', 'Model did not produce the required 3 options', 502);
    }

    // Ensure options array has exact 3 items
    const [opt1, opt2, opt3] = obj.options.slice(0, 3);
    const options: [ReplyOption, ReplyOption, ReplyOption] = [
      { id: opt1.id || 'option_1', style: opt1.style || 'brief', text: String(opt1.text || '').trim() },
      { id: opt2.id || 'option_2', style: opt2.style || 'warm', text: String(opt2.text || '').trim() },
      { id: opt3.id || 'option_3', style: opt3.style || 'direct', text: String(opt3.text || '').trim() },
    ];

    const result = {
      requestId,
      options,
      model: {
        provider: 'openrouter',
        modelId: config.GEMMA_MODEL_ID,
      },
    };

    const validated = GenerateRepliesResponseSchema.safeParse(result);
    if (!validated.success) {
      throw new AppError(
        'INVALID_MODEL_OUTPUT',
        `Contract validation failed: ${validated.error.issues.map((i) => i.message).join(', ')}`,
        502
      );
    }

    return validated.data;
  }

  /**
   * Deterministic mock generator used when running locally without OpenRouter API credentials
   */
  private generateMockFallbackReplies(req: GenerateRepliesRequest): string {
    const lastThemMsg = [...req.context.messages].reverse().find((m) => m.role === 'them');
    const text = lastThemMsg?.text?.toLowerCase() || '';

    let brief = "I'll let you know shortly.";
    let warm = "Sounds good! I'll check and message you back in a bit 😊";
    let direct = "Got it. I'll review and get back to you today.";

    if (text.includes('free') || text.includes('available') || text.includes('meet') || text.includes('time')) {
      brief = "Let's do later this afternoon.";
      warm = "Hey! Yes, I should be free around 4 PM, does that work? 😊";
      direct = "I can meet at 4 PM today. Let me know if that works.";
    } else if (text.includes('thanks') || text.includes('thank you')) {
      brief = 'You got it!';
      warm = 'No problem at all! Anytime 😊';
      direct = 'Glad to help. Talk soon.';
    } else if (text.includes('?') || text.includes('how') || text.includes('what')) {
      brief = 'Looking into this now.';
      warm = "On it! Will update you shortly 👍";
      direct = "I will confirm the details and follow up with you.";
    }

    if (req.instructions) {
      direct = `${req.instructions}.`;
    }

    return JSON.stringify({
      options: [
        { id: 'option_1', style: 'brief', text: brief },
        { id: 'option_2', style: 'warm', text: warm },
        { id: 'option_3', style: 'direct', text: direct },
      ],
    });
  }
}

export const gemmaService = new GemmaService();
