import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { profileService } from './profile-service.js';
import { AgentTracer } from './tracer.js';
import { AppError } from '../middleware/error-handler.js';
import {
  ChatMessage,
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

    // 2. Fetch Layer 1 (User Style) & Layer 2 (Contact Profile) Context with Graceful Fallback
    let layeredStyle: Awaited<ReturnType<typeof profileService.getLayeredStyleContext>> = {
      generalStyleSummary: [],
      contactFormality: 'casual',
      contactGreetings: [],
      contactCommonPhrases: [],
      contactEmojiPreference: 'minimal',
      relationship: undefined,
    };

    try {
      layeredStyle = await AgentTracer.traceSpan(
        'fetch_profile',
        'agent.db.read',
        {
          hasContactRef: Boolean(req.contactRef),
        },
        async () => {
          return await profileService.getLayeredStyleContext(userId, req.contactRef);
        }
      );
    } catch (err) {
      console.warn('[GemmaService] Profile DB read timed out or failed; falling back to dynamic context learning:', err);
    }

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
    const isGroup = Boolean(req.isGroup || req.context.isGroup);
    if (isGroup) {
      return this.assembleGroupSummaryPrompt(req);
    }

    const contactName = req.context.activeContactName || 'The Contact';

    const systemPrompt = [
      'You are SaySo, an elite personal AI texting twin on WhatsApp Web.',
      `You are ghost-writing on behalf of "User (Me)" replying to "${contactName}".`,
      'Your task is to craft EXACTLY THREE authentic reply options matching the user\'s real voice, tone, and emoji habits with this person.',
      '',
      'CRITICAL GUARDRAILS:',
      '1. NEVER sound like a corporate AI chatbot or robotic assistant (no "I hope this finds you well", "Certainly!", etc.).',
      '2. NEVER use generic templates or placeholders like [Name], [Date], [Time].',
      '3. ALWAYS reply to what the contact said. NEVER reply to what User (Me) said.',
      '4. Option 1 MUST be "brief": fast, punchy, concise (1-8 words, with 0-1 natural emoji like 👍 or 🙌).',
      '5. Option 2 MUST be "warm": friendly, conversational, and MUST include 1-2 expressive emojis (e.g. 😊, 😂, 🙏, 💛, ✨, 🔥).',
      '6. Option 3 MUST be "direct": clear, definitive, proactive, with 0-1 confirming emoji (e.g. 👍, 🎯).',
      '7. Output ONLY a valid JSON object matching the requested schema. No markdown backticks or commentary.',
    ].join('\n');

    // 1. Full context analysis to understand User's voice with this person
    const allContextMessages = req.context.messages || [];
    const myPastMessages = allContextMessages.filter((m) => m.role === 'me');
    const myCombinedText = myPastMessages.map((m) => m.text).join(' ');

    // Extract User's emoji habits with this person
    const myEmojis = myCombinedText.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu) || [];
    const uniqueMyEmojis = [...new Set(myEmojis)];

    // Check if user usually writes in lowercase (casual texting)
    const lowerCount = myPastMessages.filter((m) => /^[a-z]/.test(m.text.trim())).length;
    const isUserPrimarilyLowercase = myPastMessages.length > 0 && (lowerCount / myPastMessages.length) >= 0.5;

    // Check if user omits trailing periods (typical in mobile chat)
    const trailingPeriodCount = myPastMessages.filter((m) => /\.\s*$/.test(m.text.trim())).length;
    const isUserOmittingPeriods = myPastMessages.length > 0 && (trailingPeriodCount / myPastMessages.length) < 0.3;

    // 2. Identify the unreplied messages from the contact:
    // Only messages from 'them' that arrived AFTER the user's last outgoing message ('me')
    let lastMeIndex = -1;
    for (let i = allContextMessages.length - 1; i >= 0; i--) {
      if (allContextMessages[i].role === 'me') {
        lastMeIndex = i;
        break;
      }
    }

    let pendingIncoming: ChatMessage[] = [];
    if (lastMeIndex >= 0) {
      pendingIncoming = allContextMessages.slice(lastMeIndex + 1).filter((m) => m.role === 'them');
    }

    // Fallback: if user hasn't sent any messages in recent context, take trailing incoming messages
    if (pendingIncoming.length === 0) {
      pendingIncoming = allContextMessages.slice(-5).filter((m) => m.role === 'them');
    }

    const recentIncoming = pendingIncoming;
    const incomingText = recentIncoming.map((m) => m.text).join(' \n ');
    const incomingQuestions = recentIncoming.filter((m) => m.text.includes('?'));

    const contactEmojis = incomingText.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu) || [];
    const contactIsEnthusiastic = /!{2,}|\b(omg|yay|haha|lmao|lol|wow)\b/i.test(incomingText);

    // Dynamic Tone & Emoji guidance
    let voiceGuidance = '';
    if (uniqueMyEmojis.length > 0) {
      voiceGuidance += `User's signature emojis with ${contactName}: ${uniqueMyEmojis.slice(0, 5).join(' ')}. Prioritize naturally weaving these exact emojis into the replies!\n`;
    } else if (contactEmojis.length > 0) {
      voiceGuidance += `Contact uses emojis (${[...new Set(contactEmojis)].slice(0, 4).join(' ')}). Mirror their friendly vibe with fitting emojis.\n`;
    } else {
      voiceGuidance += `Use warm, natural emojis (e.g. 😊, 👍, 😂, 🙏, ✨, 🔥) in Option 2 (Warm) and Option 3 (Direct) so the replies feel human and engaging.\n`;
    }

    if (isUserPrimarilyLowercase) {
      voiceGuidance += `User tends to text casually in lowercase. Match this relaxed style.\n`;
    }
    if (isUserOmittingPeriods) {
      voiceGuidance += `User rarely uses ending periods in casual chat. Avoid rigid trailing periods.\n`;
    }

    // Multi-message detection
    const isPointByPoint = req.replyMode === 'point_by_point';
    const hasMultipleIncoming = recentIncoming.length >= 2 || incomingQuestions.length >= 2;

    let multiMessageGuidance = '';
    if (isPointByPoint || (hasMultipleIncoming && req.replyMode !== 'all_at_once')) {
      multiMessageGuidance = [
        'POINT-BY-POINT MODE (INDIVIDUAL REPLIES REQUIRED):',
        `The contact sent ${recentIncoming.length} separate messages/questions:`,
        ...recentIncoming.map((m, idx) => `  Message ${idx + 1}: "${m.text}"`),
        '',
        'CRITICAL POINT-BY-POINT INSTRUCTION:',
        'The user wants to reply to EACH individual message separately!',
        'In EVERY option, you MUST structure the reply as distinct numbered points corresponding directly to each message:',
        ...recentIncoming.map((m, idx) => `${idx + 1}. [Specific answer/reaction to Message ${idx + 1}]`),
        'Do NOT combine them into one general paragraph. Each incoming message must have its own separate, numbered line so the user can address each point directly!',
      ].join('\n');
    } else {
      multiMessageGuidance = [
        'ALL-AT-ONCE MODE:',
        'Synthesize all pending questions and comments into one smooth, natural conversational reply answering everything in a single message flow.',
      ].join('\n');
    }

    // 3. Format the recent messages for prompt (bounded to keep latency and prompt size predictable)
    const boundedMessages = allContextMessages.slice(-40);
    const formattedMessages = boundedMessages
      .map((m) => {
        const isFromMe = m.role === 'me';
        const sender = isFromMe ? 'User (Me)' : (m.senderName || contactName);
        return `[${sender}]: ${m.text}`;
      })
      .join('\n');

    const styleInstructions = [
      'AUTHENTIC VOICE ALIGNMENT (CRITICAL PRIORITY):',
      `- Formality Level: ${layeredStyle.contactFormality}`,
      layeredStyle.relationship ? `- Relationship: ${layeredStyle.relationship}` : '',
      contactIsEnthusiastic ? `- Contact Energy: High / Enthusiastic. Mirror appropriate energy!` : '',
      `- Voice & Habit Guidelines:\n${voiceGuidance}`,
      layeredStyle.contactGreetings.length > 0 ? `- Typical Greetings: ${layeredStyle.contactGreetings.join(', ')}` : '',
      layeredStyle.contactCommonPhrases.length > 0 ? `- Natural Phrases: ${layeredStyle.contactCommonPhrases.join(', ')}` : '',
      '',
      multiMessageGuidance,
    ]
      .filter(Boolean)
      .join('\n');

    const userPrompt = [
      styleInstructions,
      '',
      'REPLY TARGET:',
      `- You are "User (Me)" writing replies to "${contactName}".`,
      `- ONLY reply to the latest message(s) sent by ${contactName}.`,
      `- Do NOT reply to statements made by "User (Me)".`,
      recentIncoming.length > 0
        ? `LATEST UNREPLIED MESSAGES FROM ${contactName.toUpperCase()}:\n` +
          recentIncoming.map((m, idx) => `  ${idx + 1}. "${m.text}"`).join('\n')
        : '',
      '',
      req.instructions ? `SPECIFIC USER INSTRUCTION (Overrides general habits): "${req.instructions}"` : '',
      req.tone ? `REQUESTED TONE: ${req.tone}` : '',
      req.length ? `REQUESTED LENGTH: ${req.length}` : '',
      '',
      'CONVERSATION HISTORY (Most recent is at the end):',
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

  assembleGroupSummaryPrompt(req: GenerateRepliesRequest): { systemPrompt: string; userPrompt: string } {
    const contactName = req.context.activeContactName || 'Group Chat';
    const allContextMessages = req.context.messages || [];
    const unreadCount = req.unreadCount || req.context.unreadCount || 0;

    // Isolate unread messages: take trailing unreadCount messages or default to recent 15
    const targetMessages =
      unreadCount > 0
        ? allContextMessages.slice(-Math.min(unreadCount, 40))
        : allContextMessages.slice(-15);

    const formattedMessages = targetMessages
      .map((m, idx) => {
        const sender = m.senderName || (m.role === 'me' ? 'User (Me)' : 'Member');
        const time = m.timestamp ? ` [${m.timestamp}]` : '';
        return `${idx + 1}. [${sender}${time}]: ${m.text}`;
      })
      .join('\n');

    const systemPrompt = [
      'You are SaySo, an elite executive AI briefing assistant on WhatsApp Web.',
      `Your task is to summarize the UNREAD messages from the group "${contactName}".`,
      'The user has not read these messages and needs a fast, scannable briefing to get up to speed quickly.',
      '',
      'CRITICAL GUARDRAILS:',
      '1. NEVER generate replies to send to the group. This is an EXECUTIVE SUMMARY of missed/unread messages.',
      '2. Attribute points to specific members when mentioned in the messages.',
      '3. Clearly capture decisions, links, dates, deadlines, or open questions.',
      '4. Option 1 MUST be "quick_summary": A crisp 2-4 sentence high-level overview of what transpired.',
      '5. Option 2 MUST be "key_takeaways": Bullet points organizing the core topics, updates, and announcements.',
      '6. Option 3 MUST be "action_items": Bullet points of any tasks, requests, questions asked, or upcoming events.',
      '7. Output ONLY a valid JSON object matching the requested schema. No markdown backticks or commentary.',
    ].join('\n');

    const userPrompt = [
      `GROUP NAME: "${contactName}"`,
      `NUMBER OF UNREAD MESSAGES: ${targetMessages.length}`,
      '',
      'UNREAD MESSAGES TO SUMMARIZE:',
      formattedMessages || '(No recent messages found)',
      '',
      'OUTPUT SCHEMA REQUIREMENTS:',
      'Respond with a JSON object containing an "options" array with exactly 3 items:',
      '{"options": [{"id": "summary_quick", "style": "quick_summary", "text": "string"}, {"id": "summary_key_points", "style": "key_takeaways", "text": "string"}, {"id": "summary_actions", "style": "action_items", "text": "string"}]}',
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
          max_tokens: 900,
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

    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      throw new AppError('INVALID_MODEL_OUTPUT', 'Model response was not valid JSON', 502);
    }

    // Extract options from various potential LLM keys (options, replies, responses, or array)
    let rawOptions: any[] = [];
    if (Array.isArray(parsed)) {
      rawOptions = parsed;
    } else if (parsed && Array.isArray(parsed.options)) {
      rawOptions = parsed.options;
    } else if (parsed && Array.isArray(parsed.replies)) {
      rawOptions = parsed.replies;
    } else if (parsed && Array.isArray(parsed.responses)) {
      rawOptions = parsed.responses;
    } else if (parsed && typeof parsed === 'object') {
      rawOptions = Object.values(parsed).filter((v) => typeof v === 'object' && v !== null);
    }

    if (!rawOptions || rawOptions.length < 3) {
      throw new AppError('INVALID_MODEL_OUTPUT', 'Model did not produce the required 3 options', 502);
    }

    // Helper to safely extract non-empty string from option payload
    function extractOptionText(opt: any, fallbackText: string): string {
      let raw = '';
      if (!opt) return fallbackText;
      if (typeof opt.text === 'string' && opt.text.trim().length > 0) raw = opt.text.trim();
      else if (Array.isArray(opt.text)) raw = opt.text.filter(Boolean).join('\n').trim();
      else if (Array.isArray(opt.points)) raw = opt.points.filter(Boolean).join('\n').trim();
      else if (Array.isArray(opt.replies)) raw = opt.replies.filter(Boolean).join('\n').trim();
      else if (Array.isArray(opt.messages)) raw = opt.messages.filter(Boolean).join('\n').trim();
      else if (typeof opt.reply === 'string' && opt.reply.trim().length > 0) raw = opt.reply.trim();
      else if (typeof opt.message === 'string' && opt.message.trim().length > 0) raw = opt.message.trim();
      else if (typeof opt.content === 'string' && opt.content.trim().length > 0) raw = opt.content.trim();
      else if (typeof opt.response === 'string' && opt.response.trim().length > 0) raw = opt.response.trim();
      else if (typeof opt === 'object' && opt !== null) {
        const strValues = Object.values(opt).filter((v) => typeof v === 'string' && (v as string).trim().length > 0);
        if (strValues.length > 0) raw = strValues.join('\n').trim();
      }

      if (!raw) return fallbackText;

      // Clean any accidental model prefix e.g. "option_1.brief:" or "option_1: "
      let clean = raw.replace(/^option_\d+[\s._:]*(?:brief|warm|direct)?[\s._:]*/i, '').trim();
      if (!clean) return fallbackText;

      // Ensure points have line breaks between them if Gemma put them on one line (e.g. "1. Yep! 2. Yep! 3. Call me")
      clean = clean.replace(/(\S)\s+(\d+[\.\)]\s+)/g, '$1\n$2');

      return clean;
    }

    const fallbacks = [
      'Got it, on it now 👍',
      'Hey! Thanks for reaching out 😊 Will check and update you soon!',
      'Understood. I will handle this shortly.',
    ];

    const opt1 = rawOptions[0] || {};
    const opt2 = rawOptions[1] || {};
    const opt3 = rawOptions[2] || {};

    const options: [ReplyOption, ReplyOption, ReplyOption] = [
      {
        id: opt1.id || 'option_1',
        style: opt1.style || 'brief',
        text: extractOptionText(opt1, fallbacks[0]),
      },
      {
        id: opt2.id || 'option_2',
        style: opt2.style || 'warm',
        text: extractOptionText(opt2, fallbacks[1]),
      },
      {
        id: opt3.id || 'option_3',
        style: opt3.style || 'direct',
        text: extractOptionText(opt3, fallbacks[2]),
      },
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
    const isGroup = Boolean(req.isGroup || req.context.isGroup);

    if (isGroup) {
      const msgs = req.context.messages || [];
      const count = req.unreadCount || req.context.unreadCount || msgs.length;
      const groupName = req.context.activeContactName || 'the group';

      return JSON.stringify({
        options: [
          {
            id: 'summary_quick',
            style: 'quick_summary',
            text: `Catch-up summary of ${count} unread message(s) in ${groupName}. Members discussed current updates and ongoing topics.`,
          },
          {
            id: 'summary_key_points',
            style: 'key_takeaways',
            text: `• Key updates shared by members\n• Active conversation regarding timeline and tasks\n• Discussion points aligned across the team`,
          },
          {
            id: 'summary_actions',
            style: 'action_items',
            text: `• Check latest links and shared details\n• Follow up on relevant open questions`,
          },
        ],
      });
    }

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
