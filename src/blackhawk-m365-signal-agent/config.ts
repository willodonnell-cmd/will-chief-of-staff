import type { ReviewWindows } from "./types";

export type BlackhawkM365SignalAgentConfig = {
  blackhawkBaseUrl: string;
  blackhawkImportSecret: string;
  m365TenantId: string;
  m365ClientId: string;
  m365ClientSecret: string;
  m365UserIdentifier: string;
  timezone: string;
  tenantLabel: string;
  ownerName: string;
  runnerName: "chatgpt_agent";
  logLevel: "debug" | "info" | "warn" | "error";
  requestTimeoutMs: number;
  graphBaseUrl: string;
  reviewWindows: ReviewWindows;
};

function requireNonEmpty(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function parsePositiveNumber(value: string | undefined, fallback: number) {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive number but received ${value}.`);
  }

  return parsed;
}

export function loadBlackhawkM365SignalAgentConfig(
  env: NodeJS.ProcessEnv = process.env
): BlackhawkM365SignalAgentConfig {
  const m365UserIdentifier = env.M365_USER_EMAIL?.trim() || env.M365_USER_ID?.trim() || "";
  if (!m365UserIdentifier) {
    throw new Error("Either M365_USER_EMAIL or M365_USER_ID is required.");
  }

  return {
    blackhawkBaseUrl: requireNonEmpty(env, "BLACKHAWK_BASE_URL").replace(/\/+$/g, ""),
    blackhawkImportSecret: requireNonEmpty(env, "BLACKHAWK_IMPORT_SECRET"),
    m365TenantId: requireNonEmpty(env, "M365_TENANT_ID"),
    m365ClientId: requireNonEmpty(env, "M365_CLIENT_ID"),
    m365ClientSecret: requireNonEmpty(env, "M365_CLIENT_SECRET"),
    m365UserIdentifier,
    timezone: env.TZ?.trim() || "America/New_York",
    tenantLabel: env.BLACKHAWK_TENANT_LABEL?.trim() || "Will O'Donnell",
    ownerName: env.BLACKHAWK_OWNER_NAME?.trim() || "Will O'Donnell",
    runnerName: "chatgpt_agent",
    logLevel: (env.LOG_LEVEL?.trim().toLowerCase() as BlackhawkM365SignalAgentConfig["logLevel"]) || "info",
    requestTimeoutMs: parsePositiveNumber(env.BLACKHAWK_REQUEST_TIMEOUT_MS, 15_000),
    graphBaseUrl: env.M365_GRAPH_BASE_URL?.trim() || "https://graph.microsoft.com/v1.0",
    reviewWindows: {
      emailLookbackHours: parsePositiveNumber(env.DEFAULT_LOOKBACK_HOURS, 72),
      teamsLookbackHours: parsePositiveNumber(env.DEFAULT_LOOKBACK_HOURS, 72),
      calendarLookbackHours: parsePositiveNumber(env.DEFAULT_CALENDAR_LOOKBACK_HOURS, 24),
      calendarLookaheadDays: parsePositiveNumber(env.DEFAULT_CALENDAR_LOOKAHEAD_DAYS, 7)
    }
  };
}
