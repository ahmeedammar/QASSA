import { randomUUID } from "node:crypto";

export interface LogContext {
  userId?: string;
  shopId?: string;
  action?: string;
  traceId?: string;
  [key: string]: unknown;
}

/**
 * Sanitizes potentially sensitive keys from structured logging output
 * to prevent accidental token/password disclosure.
 */
function sanitizeContext(ctx: LogContext): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = new Set([
    "password",
    "token",
    "secret",
    "authorization",
    "cookie",
    "key",
  ]);

  for (const [k, v] of Object.entries(ctx)) {
    if (sensitiveKeys.has(k.toLowerCase())) {
      sanitized[k] = "[REDACTED]";
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized;
}

export const logger = {
  info(message: string, context: LogContext = {}): void {
    const payload = {
      level: "info",
      timestamp: new Date().toISOString(),
      traceId: context.traceId ?? randomUUID(),
      message,
      context: sanitizeContext(context),
    };
    console.log(JSON.stringify(payload));
  },

  warn(message: string, context: LogContext = {}): void {
    const payload = {
      level: "warn",
      timestamp: new Date().toISOString(),
      traceId: context.traceId ?? randomUUID(),
      message,
      context: sanitizeContext(context),
    };
    console.warn(JSON.stringify(payload));
  },

  error(message: string, error?: unknown, context: LogContext = {}): void {
    const errDetails =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { message: String(error) };

    const payload = {
      level: "error",
      timestamp: new Date().toISOString(),
      traceId: context.traceId ?? randomUUID(),
      message,
      error: errDetails,
      context: sanitizeContext(context),
    };
    console.error(JSON.stringify(payload));
  },
};
