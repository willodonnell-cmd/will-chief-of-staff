import { redactObject } from "./redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type StructuredLogger = {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
  child(metadata: Record<string, unknown>): StructuredLogger;
};

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function shouldLog(current: LogLevel, target: LogLevel) {
  return LOG_LEVEL_ORDER[target] >= LOG_LEVEL_ORDER[current];
}

export function createStructuredLogger(options: {
  service: string;
  level?: LogLevel;
  defaultMetadata?: Record<string, unknown>;
  secrets?: string[];
}): StructuredLogger {
  const level = options.level ?? "info";
  const defaultMetadata = options.defaultMetadata ?? {};
  const secrets = options.secrets ?? [];

  const write = (target: LogLevel, message: string, metadata?: Record<string, unknown>) => {
    if (!shouldLog(level, target)) {
      return;
    }

    const payload = redactObject(
      {
        timestamp: new Date().toISOString(),
        level: target,
        service: options.service,
        message,
        ...defaultMetadata,
        ...(metadata ?? {})
      },
      secrets
    );

    const serialized = JSON.stringify(payload);
    if (target === "error" || target === "warn") {
      console.error(serialized);
      return;
    }

    console.log(serialized);
  };

  return {
    debug(message, metadata) {
      write("debug", message, metadata);
    },
    info(message, metadata) {
      write("info", message, metadata);
    },
    warn(message, metadata) {
      write("warn", message, metadata);
    },
    error(message, metadata) {
      write("error", message, metadata);
    },
    child(metadata) {
      return createStructuredLogger({
        service: options.service,
        level,
        defaultMetadata: {
          ...defaultMetadata,
          ...metadata
        },
        secrets
      });
    }
  };
}
