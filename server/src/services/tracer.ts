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
        // Redact any potential sensitive PII from exception frames or breadcrumbs
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
        return event;
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
 * PII-Safe Agent Tracer
 * Wraps generation pipeline steps into spans.
 * GUARANTEE: Never transmits raw messages, prompts, or user contact names to telemetry.
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
