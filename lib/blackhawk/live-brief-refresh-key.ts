export function buildBlackhawkRefreshIdempotencyKey(params: {
  userId: string;
  trigger: "open" | "scheduled" | "manual";
  now?: string | Date;
  windowMinutes?: number;
}) {
  const now = params.now instanceof Date ? params.now : new Date(params.now ?? Date.now());
  if (Number.isNaN(now.getTime())) {
    throw new Error("A valid refresh timestamp is required.");
  }

  const windowMinutes = params.windowMinutes ?? (params.trigger === "open" ? 5 : 1);
  if (!Number.isInteger(windowMinutes) || windowMinutes < 1) {
    throw new Error("Refresh windowMinutes must be a positive integer.");
  }

  const windowMs = windowMinutes * 60_000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs).toISOString();
  return `${params.userId}:${params.trigger}:${windowStart}`;
}
