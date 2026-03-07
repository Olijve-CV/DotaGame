import { inspect } from "node:util";
import { getRequestContext } from "./requestContext.js";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

function normalizeLogLevel(value: string | undefined): LogLevel | null {
  switch (value?.toLowerCase()) {
    case "debug":
    case "info":
    case "warn":
    case "error":
      return value.toLowerCase() as LogLevel;
    default:
      return null;
  }
}

function getMinimumLogLevel(): LogLevel | null {
  const configuredLevel = normalizeLogLevel(process.env.LOG_LEVEL);
  if (configuredLevel) {
    return configuredLevel;
  }

  return isTestRuntime() ? null : "info";
}

function shouldRedact(key: string): boolean {
  return /(password|token|authorization|api[-_]?key|secret)/i.test(key);
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const serialized: Record<string, unknown> = {
      name: error.name,
      message: error.message
    };

    if (error.stack) {
      serialized.stack = error.stack.split("\n").slice(0, 8).join("\n");
    }

    if ("cause" in error && error.cause) {
      serialized.cause = serializeError(error.cause);
    }

    return serialized;
  }

  return {
    message:
      typeof error === "string" ? error : inspect(error, { depth: 3, breakLength: 120 })
  };
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (shouldRedact(key)) {
    return "[REDACTED]";
  }

  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item));
  }

  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      sanitized[childKey] = sanitizeValue(childKey, childValue);
    }
    return sanitized;
  }

  return inspect(value, { depth: 2, breakLength: 120 });
}

function emit(level: LogLevel, message: string, fields: LogFields = {}): void {
  const minimumLevel = getMinimumLogLevel();
  if (!minimumLevel || LEVEL_ORDER[level] < LEVEL_ORDER[minimumLevel]) {
    return;
  }

  const requestContext = getRequestContext();
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    service: "api",
    message
  };

  if (requestContext) {
    entry.requestId = requestContext.requestId;
    entry.traceId = requestContext.traceId;
    entry.requestMethod = requestContext.method;
    entry.requestPath = requestContext.path;
  }

  for (const [key, value] of Object.entries(fields)) {
    entry[key] = sanitizeValue(key, value);
  }

  const serialized = JSON.stringify(entry);
  if (level === "error") {
    console.error(serialized);
    return;
  }
  if (level === "warn") {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
}

export const logger = {
  debug(message: string, fields?: LogFields): void {
    emit("debug", message, fields);
  },
  info(message: string, fields?: LogFields): void {
    emit("info", message, fields);
  },
  warn(message: string, fields?: LogFields): void {
    emit("warn", message, fields);
  },
  error(message: string, fields?: LogFields): void {
    emit("error", message, fields);
  }
};
