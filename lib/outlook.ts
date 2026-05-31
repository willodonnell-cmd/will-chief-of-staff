import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Adding Calendars.Read expands delegated consent. Existing Outlook connections may need
// to reconnect so Microsoft grants the updated scope set.
const OUTLOOK_SCOPES = ["openid", "profile", "email", "offline_access", "User.Read", "Mail.Read", "Calendars.Read"] as const;
const OUTLOOK_GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const OUTLOOK_FETCH_TIMEOUT_MS = 15_000;

type OutlookOAuthTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

type OutlookProfileResponse = {
  id: string;
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
};

type OutlookMessagesResponse = {
  value: OutlookMessage[];
};

type OutlookGraphDateTimeTimeZone = {
  dateTime?: string | null;
  timeZone?: string | null;
};

type OutlookGraphEmailAddress = {
  name?: string | null;
  address?: string | null;
};

type OutlookCalendarViewResponse = {
  value: OutlookCalendarGraphEvent[];
};

type OutlookGraphError = {
  error?: {
    code?: string;
    message?: string;
  };
};

export type OutlookMessage = {
  id: string;
  conversationId?: string | null;
  subject?: string | null;
  receivedDateTime?: string | null;
  bodyPreview?: string | null;
  webLink?: string | null;
  internetMessageId?: string | null;
  importance?: "low" | "normal" | "high";
  inferenceClassification?: "focused" | "other";
  isRead?: boolean;
  hasAttachments?: boolean;
  lastModifiedDateTime?: string | null;
  flag?: {
    flagStatus?: "notFlagged" | "complete" | "flagged";
  } | null;
  from?: {
    emailAddress?: {
      name?: string | null;
      address?: string | null;
    } | null;
  } | null;
};

type OutlookCalendarGraphEvent = {
  id: string;
  subject?: string | null;
  bodyPreview?: string | null;
  start?: OutlookGraphDateTimeTimeZone | null;
  end?: OutlookGraphDateTimeTimeZone | null;
  isCancelled?: boolean;
  isAllDay?: boolean;
  isOnlineMeeting?: boolean;
  location?: {
    displayName?: string | null;
  } | null;
  organizer?: {
    emailAddress?: OutlookGraphEmailAddress | null;
  } | null;
  attendees?: Array<{
    type?: "required" | "optional" | "resource" | null;
    emailAddress?: OutlookGraphEmailAddress | null;
  }> | null;
  importance?: "low" | "normal" | "high";
  sensitivity?: "normal" | "personal" | "private" | "confidential" | null;
  showAs?: "free" | "tentative" | "busy" | "oof" | "workingElsewhere" | "unknown" | null;
  webLink?: string | null;
};

export type OutlookCalendarViewEvent = {
  id: string;
  subject: string | null;
  bodyPreview: string | null;
  startAt: string | null;
  endAt: string | null;
  isCancelled: boolean;
  isAllDay: boolean;
  isOnlineMeeting: boolean;
  locationDisplayName: string | null;
  organizerName: string | null;
  organizerEmail: string | null;
  attendees: Array<{
    name: string | null;
    email: string | null;
    type: "required" | "optional" | "resource" | null;
  }>;
  importance: "low" | "normal" | "high" | null;
  sensitivity: "normal" | "personal" | "private" | "confidential" | null;
  showAs: "free" | "tentative" | "busy" | "oof" | "workingElsewhere" | "unknown" | null;
  webLink: string | null;
};

export type OutlookTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scopes: string[];
};

export type OutlookProfile = {
  id: string;
  displayName: string | null;
  email: string | null;
};

function getOutlookClientId() {
  return process.env.MICROSOFT_CLIENT_ID?.trim() ?? "";
}

function getOutlookClientSecret() {
  return process.env.MICROSOFT_CLIENT_SECRET?.trim() ?? "";
}

function getOutlookTenantId() {
  return process.env.MICROSOFT_TENANT_ID?.trim() || "organizations";
}

function getOutlookTokenEncryptionSecret() {
  return process.env.OUTLOOK_TOKEN_ENCRYPTION_KEY?.trim() ?? "";
}

function getOutlookEncryptionKey() {
  const secret = getOutlookTokenEncryptionSecret();
  if (!secret) {
    return null;
  }

  return createHash("sha256").update(secret).digest();
}

function getOutlookTokenEndpoint() {
  return `https://login.microsoftonline.com/${getOutlookTenantId()}/oauth2/v2.0/token`;
}

function getOutlookAuthorizeEndpoint() {
  return `https://login.microsoftonline.com/${getOutlookTenantId()}/oauth2/v2.0/authorize`;
}

async function fetchJson<T>(input: string, init: RequestInit, errorLabel: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OUTLOOK_FETCH_TIMEOUT_MS);
  timeout.unref?.();

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      let detail = `${response.status} ${response.statusText}`;

      try {
        const json = (await response.json()) as OutlookGraphError;
        detail = json.error?.message ?? detail;
      } catch {
        try {
          detail = await response.text();
        } catch {
          // Fall through to the default status text.
        }
      }

      throw new Error(`${errorLabel}: ${detail}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function mapTokenResponse(response: OutlookOAuthTokenResponse): OutlookTokenSet {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? null,
    expiresAt: new Date(Date.now() + response.expires_in * 1000).toISOString(),
    scopes: (response.scope ?? OUTLOOK_SCOPES.join(" ")).split(" ").filter(Boolean)
  };
}

function normalizeOutlookDateTime(value: OutlookGraphDateTimeTimeZone | null | undefined) {
  const dateTime = value?.dateTime?.trim();
  if (!dateTime) {
    return null;
  }

  const timeZone = value?.timeZone?.trim() ?? "";
  const withZone =
    /(?:z|[+-]\d{2}:\d{2})$/i.test(dateTime) || !timeZone || timeZone.toUpperCase() === "UTC"
      ? (/(?:z|[+-]\d{2}:\d{2})$/i.test(dateTime) ? dateTime : `${dateTime}Z`)
      : dateTime;
  const parsed = Date.parse(withZone);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function mapCalendarViewEvent(event: OutlookCalendarGraphEvent): OutlookCalendarViewEvent {
  return {
    id: event.id,
    subject: event.subject?.trim() || null,
    bodyPreview: event.bodyPreview?.replace(/\s+/g, " ").trim() || null,
    startAt: normalizeOutlookDateTime(event.start),
    endAt: normalizeOutlookDateTime(event.end),
    isCancelled: event.isCancelled ?? false,
    isAllDay: event.isAllDay ?? false,
    isOnlineMeeting: event.isOnlineMeeting ?? false,
    locationDisplayName: event.location?.displayName?.trim() || null,
    organizerName: event.organizer?.emailAddress?.name?.trim() || null,
    organizerEmail: event.organizer?.emailAddress?.address?.trim() || null,
    attendees:
      event.attendees?.map((attendee) => ({
        name: attendee.emailAddress?.name?.trim() || null,
        email: attendee.emailAddress?.address?.trim() || null,
        type: attendee.type ?? null
      })) ?? [],
    importance: event.importance ?? null,
    sensitivity: event.sensitivity ?? null,
    showAs: event.showAs ?? null,
    webLink: event.webLink?.trim() || null
  };
}

export function isOutlookConfigured() {
  return Boolean(getOutlookClientId() && getOutlookClientSecret() && getOutlookEncryptionKey());
}

export function getOutlookScopes() {
  return [...OUTLOOK_SCOPES];
}

export function hasOutlookCalendarScope(scopes: string[] | string | null | undefined) {
  if (!scopes) {
    return false;
  }

  const normalizedScopes = Array.isArray(scopes)
    ? scopes
    : scopes
        .split(/[\s,]+/)
        .map((scope) => scope.trim())
        .filter(Boolean);

  return normalizedScopes.some((scope) => scope.toLowerCase() === "calendars.read");
}

export function getOutlookConnectHref(nextPath = "/inbox") {
  return `/api/integrations/outlook/connect?next=${encodeURIComponent(nextPath)}`;
}

export function resolveOutlookRedirectUri(origin: string) {
  return process.env.MICROSOFT_OUTLOOK_REDIRECT_URI?.trim() || `${origin}/api/integrations/outlook/callback`;
}

export function createOutlookAuthorizationUrl(params: { redirectUri: string; state: string }) {
  const query = new URLSearchParams({
    client_id: getOutlookClientId(),
    response_type: "code",
    redirect_uri: params.redirectUri,
    response_mode: "query",
    scope: OUTLOOK_SCOPES.join(" "),
    state: params.state
  });

  return `${getOutlookAuthorizeEndpoint()}?${query.toString()}`;
}

export async function exchangeOutlookCodeForTokens(params: { code: string; redirectUri: string }) {
  const body = new URLSearchParams({
    client_id: getOutlookClientId(),
    client_secret: getOutlookClientSecret(),
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    scope: OUTLOOK_SCOPES.join(" ")
  });

  const response = await fetchJson<OutlookOAuthTokenResponse>(
    getOutlookTokenEndpoint(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    },
    "Microsoft token exchange failed"
  );

  return mapTokenResponse(response);
}

export async function refreshOutlookAccessToken(params: { refreshToken: string }) {
  const body = new URLSearchParams({
    client_id: getOutlookClientId(),
    client_secret: getOutlookClientSecret(),
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    scope: OUTLOOK_SCOPES.join(" ")
  });

  const response = await fetchJson<OutlookOAuthTokenResponse>(
    getOutlookTokenEndpoint(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    },
    "Microsoft token refresh failed"
  );

  return mapTokenResponse(response);
}

export async function fetchOutlookProfile(accessToken: string): Promise<OutlookProfile> {
  const response = await fetchJson<OutlookProfileResponse>(
    `${OUTLOOK_GRAPH_BASE_URL}/me?$select=id,displayName,mail,userPrincipalName`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    "Microsoft profile fetch failed"
  );

  return {
    id: response.id,
    displayName: response.displayName ?? null,
    email: response.mail ?? response.userPrincipalName ?? null
  };
}

export async function listOutlookInboxMessages(accessToken: string, top = 25): Promise<OutlookMessage[]> {
  const query = new URLSearchParams({
    $select:
      "id,conversationId,subject,receivedDateTime,bodyPreview,webLink,from,internetMessageId,inferenceClassification,importance,isRead,hasAttachments,lastModifiedDateTime,flag",
    $orderby: "receivedDateTime DESC",
    $top: `${Math.max(1, Math.min(top, 50))}`
  });

  const response = await fetchJson<OutlookMessagesResponse>(
    `${OUTLOOK_GRAPH_BASE_URL}/me/mailFolders/inbox/messages?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    "Microsoft inbox fetch failed"
  );

  return response.value ?? [];
}

export async function listOutlookCalendarViewEvents(
  accessToken: string,
  options?: {
    startDateTime?: string | Date;
    endDateTime?: string | Date;
    top?: number;
  }
): Promise<OutlookCalendarViewEvent[]> {
  const startDateTime =
    options?.startDateTime instanceof Date
      ? options.startDateTime
      : options?.startDateTime
        ? new Date(options.startDateTime)
        : new Date();
  const endDateTime =
    options?.endDateTime instanceof Date
      ? options.endDateTime
      : options?.endDateTime
        ? new Date(options.endDateTime)
        : new Date(startDateTime.getTime() + 48 * 60 * 60 * 1000);
  const top = Math.max(1, Math.min(options?.top ?? 50, 50));

  const query = new URLSearchParams({
    startDateTime: startDateTime.toISOString(),
    endDateTime: endDateTime.toISOString(),
    $select:
      "id,subject,bodyPreview,start,end,isCancelled,isAllDay,isOnlineMeeting,location,organizer,attendees,importance,sensitivity,showAs,webLink",
    $orderby: "start/dateTime",
    $top: `${top}`
  });

  const response = await fetchJson<OutlookCalendarViewResponse>(
    `${OUTLOOK_GRAPH_BASE_URL}/me/calendarView?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"'
      }
    },
    "Microsoft calendar fetch failed"
  );

  return (response.value ?? []).map(mapCalendarViewEvent);
}

export function encryptOutlookSecret(value: string) {
  const key = getOutlookEncryptionKey();
  if (!key) {
    throw new Error("OUTLOOK_TOKEN_ENCRYPTION_KEY is required for Outlook token storage.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptOutlookSecret(value: string) {
  const key = getOutlookEncryptionKey();
  if (!key) {
    throw new Error("OUTLOOK_TOKEN_ENCRYPTION_KEY is required for Outlook token storage.");
  }

  const [ivPart, tagPart, encryptedPart] = value.split(".");
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new Error("Stored Outlook token is malformed.");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));

  return Buffer.concat([decipher.update(Buffer.from(encryptedPart, "base64")), decipher.final()]).toString("utf8");
}
