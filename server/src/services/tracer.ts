import * as Sentry from '@sentry/node';
import { config } from '../config.js';

let isSentryInitialized = false;

export function initSentry(): void {
  if (isSentryInitialized) return;

  if (config.SENTRY_DSN) {
    Sentry.init({
      dsn: config.SENTRY_DSN,
      environment: config.NODE_ENV,
      tracesSampleRate: 1.0,
      beforeSend(event) {
        event.request = undefined;
        event.user = undefined;
        event.extra = undefined;
        event.tags = undefined;
        event.contexts = {};
        event.breadcrumbs = [];
        event.message = undefined;
        event.transaction = undefined;
        if (event.exception?.values) {
          event.exception.values = event.exception.values.map((exception) => ({
            ...exception,
            value: exception.type || 'Error',
          }));
        }
        return event;
      },
      beforeSendSpan(span) {
        const safeSpanNames = new Set([
          'validate_request',
          'fetch_profile',
          'build_prompt',
          'gemma_inference',
          'validate_contract',
        ]);
        const safeAttributeNames = new Set([
          'sentry.origin',
          'sentry.op',
          'sentry.segment.name.source',
          'status',
          'duration_ms',
          'error_type',
          'messageCount',
          'hasInstructions',
          'hasCustomTone',
          'modelId',
          'provider',
          'hasContactRef',
          'contactFormality',
          'signalCount',
        ]);
        return {
          ...span,
          name: safeSpanNames.has(span.name) ? span.name : 'operation',
          attributes: Object.fromEntries(
            Object.entries(span.attributes).filter(([key]) => safeAttributeNames.has(key)),
          ),
        };
      },
    });
    isSentryInitialized = true;
    console.log('[Sentry] Agent Tracing initialized');
  } else {
    // Sentry unconfigured: running tracer in no-op mock mode
    isSentryInitialized = false;
  }
}

/**
 * Redacted Agent Tracer
 * Wraps generation pipeline steps into spans.
 * Raw request data, URLs, user identity, and exception messages are removed before telemetry is sent.
 */
export class AgentTracer {
  static async traceSpan<T>(
    spanName: string,
    op: string,
    attributes: Record<string, string | number | boolean | undefined>,
    fn: () => Promise<T>
  ): Promise<T> {
    const startedAt = Date.now();
    if (!config.SENTRY_DSN) {
      // In dev or tests without DSN, execute directly with minimal overhead
      try {
        return await fn();
      } finally {
        console.debug(`[SaySo timing] ${spanName}: ${Date.now() - startedAt}ms`);
      }
    }

    return await Sentry.startSpan(
      {
        name: spanName,
        op,
        attributes: Object.fromEntries(
          Object.entries(attributes).filter(([, v]) => v !== undefined)
        ) as Record<string, string | number | boolean>,
      },
      async (span) => {
        const startTime = Date.now();
        try {
          const result = await fn();
          span?.setAttribute('status', 'ok');
          span?.setAttribute('duration_ms', Date.now() - startTime);
          return result;
        } catch (error) {
          span?.setAttribute('status', 'error');
          span?.setAttribute('duration_ms', Date.now() - startTime);
          span?.setAttribute('error_type', error instanceof Error ? error.name : 'UnknownError');
          throw error;
        }
      }
    );
  }
}
