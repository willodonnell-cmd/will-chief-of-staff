const PRIORITY_INBOX_BLOCKED_MESSAGE = "Priority Inbox storage is blocked from this network right now.";
const PRIORITY_INBOX_SOURCE_BLOCKED_MESSAGE = "Priority Inbox source status could not be loaded from this network right now.";
const PRIORITY_INBOX_LOCAL_FALLBACK_WINDOW_MS = 5 * 60 * 1000;

let priorityInboxPreferLocalUntil = 0;

export function normalizePriorityInboxStorageError(error: unknown, fallback = "Unknown storage error.") {
  const rawMessage = error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
  const condensed = rawMessage.replace(/\s+/g, " ").trim();

  if (condensed.includes("<html") || condensed.includes("Unsanctioned Application Activity")) {
    return PRIORITY_INBOX_BLOCKED_MESSAGE;
  }

  return condensed || fallback;
}

export function normalizePriorityInboxSourceError(
  error: unknown,
  fallback = "Priority Inbox source status could not be loaded."
) {
  const rawMessage = error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
  const condensed = rawMessage.replace(/\s+/g, " ").trim();

  if (condensed.includes("<html") || condensed.includes("Unsanctioned Application Activity")) {
    return PRIORITY_INBOX_SOURCE_BLOCKED_MESSAGE;
  }

  return condensed || fallback;
}

export function shouldUsePriorityInboxLocalFallback(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const normalized = normalizePriorityInboxStorageError(error);
  const lowered = normalized.toLowerCase();

  return (
    normalized === PRIORITY_INBOX_BLOCKED_MESSAGE ||
    lowered.includes("timed out") ||
    lowered.includes("fetch failed") ||
    lowered.includes("connect timeout") ||
    lowered.includes("und_err_connect_timeout") ||
    lowered.includes("self_signed_cert") ||
    lowered.includes("self-signed certificate") ||
    lowered.includes("enotfound") ||
    lowered.includes("getaddrinfo")
  );
}

export function markPriorityInboxLocalFallbackActive() {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  priorityInboxPreferLocalUntil = Date.now() + PRIORITY_INBOX_LOCAL_FALLBACK_WINDOW_MS;
}

export function shouldBypassPriorityInboxRemoteStorage() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return priorityInboxPreferLocalUntil > Date.now();
}
