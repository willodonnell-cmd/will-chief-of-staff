function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactSensitiveText(value: string, secrets: string[] = []) {
  let redacted = value;

  for (const secret of secrets.filter(Boolean)) {
    redacted = redacted.replace(new RegExp(escapeRegExp(secret), "g"), "[REDACTED]");
  }

  return redacted
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
    .replace(/client_secret=[^&\s]+/gi, "client_secret=[REDACTED]")
    .replace(/"authorization"\s*:\s*"[^"]+"/gi, "\"authorization\":\"[REDACTED]\"")
    .replace(/"x-agent-signals-import-secret"\s*:\s*"[^"]+"/gi, "\"x-agent-signals-import-secret\":\"[REDACTED]\"");
}

export function sanitizeErrorMessage(
  error: unknown,
  options: {
    secrets?: string[];
    fallback?: string;
    maxLength?: number;
  } = {}
) {
  const fallback = options.fallback ?? "The worker run failed.";
  const maxLength = options.maxLength ?? 240;
  const raw =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : fallback;

  const safe = redactSensitiveText(raw, options.secrets).replace(/\s+/g, " ").trim();
  return safe.length > maxLength ? `${safe.slice(0, maxLength - 1)}…` : safe;
}

export function redactObject(value: unknown, secrets: string[] = []): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value, secrets);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactObject(entry, secrets));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [
      key,
      /secret|token|authorization|password/i.test(key)
        ? "[REDACTED]"
        : redactObject(entry, secrets)
    ])
  );
}
