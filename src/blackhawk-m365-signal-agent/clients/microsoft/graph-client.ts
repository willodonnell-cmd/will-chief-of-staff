import type { BlackhawkM365SignalAgentConfig } from "../../config";
import type {
  CalendarEventRecord,
  Microsoft365Client,
  OutlookMessageRecord,
  TeamsChatRecord,
  TeamsMessageRecord
} from "../../types";
import { retry } from "../../utils/retry";

type GraphTokenResponse = {
  access_token: string;
  expires_in: number;
};

type GraphListResponse<T> = {
  value: T[];
};

type GraphMessage = {
  id: string;
  conversationId?: string | null;
  internetMessageId?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  webLink?: string | null;
  receivedDateTime?: string | null;
  sentDateTime?: string | null;
  importance?: "low" | "normal" | "high";
  inferenceClassification?: "focused" | "other";
  isRead?: boolean;
  hasAttachments?: boolean;
  from?: {
    emailAddress?: {
      name?: string | null;
      address?: string | null;
    } | null;
  } | null;
  toRecipients?: Array<{
    emailAddress?: {
      name?: string | null;
      address?: string | null;
    } | null;
  }> | null;
  ccRecipients?: Array<{
    emailAddress?: {
      name?: string | null;
      address?: string | null;
    } | null;
  }> | null;
};

type GraphCalendarEvent = {
  id: string;
  subject?: string | null;
  bodyPreview?: string | null;
  webLink?: string | null;
  isCancelled?: boolean;
  isAllDay?: boolean;
  start?: {
    dateTime?: string | null;
    timeZone?: string | null;
  } | null;
  end?: {
    dateTime?: string | null;
    timeZone?: string | null;
  } | null;
  organizer?: {
    emailAddress?: {
      name?: string | null;
      address?: string | null;
    } | null;
  } | null;
  attendees?: Array<{
    emailAddress?: {
      name?: string | null;
      address?: string | null;
    } | null;
  }> | null;
  importance?: "low" | "normal" | "high";
};

type GraphChat = {
  id: string;
  topic?: string | null;
  chatType?: "oneOnOne" | "group" | "meeting" | "unknown";
  members?: Array<{
    displayName?: string | null;
    email?: string | null;
  }> | null;
};

type GraphChatMessage = {
  id: string;
  createdDateTime?: string | null;
  importance?: "normal" | "urgent" | "highImportance";
  webUrl?: string | null;
  from?: {
    user?: {
      displayName?: string | null;
    } | null;
  } | null;
  body?: {
    content?: string | null;
  } | null;
};

type GraphErrorShape = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class GraphApiError extends Error {
  statusCode: number;
  code: string | null;
  retryable: boolean;

  constructor(message: string, options: { statusCode: number; code?: string | null; retryable?: boolean }) {
    super(message);
    this.name = "GraphApiError";
    this.statusCode = options.statusCode;
    this.code = options.code ?? null;
    this.retryable = options.retryable ?? (options.statusCode >= 500 || options.statusCode === 429);
  }
}

function mapMessage(graphMessage: GraphMessage): OutlookMessageRecord {
  const mapRecipients = (entries: GraphMessage["toRecipients"]) =>
    (entries ?? [])
      .map((entry) => entry.emailAddress?.name?.trim() || entry.emailAddress?.address?.trim() || null)
      .filter((entry): entry is string => Boolean(entry));

  return {
    id: graphMessage.id,
    conversationId: graphMessage.conversationId?.trim() || null,
    internetMessageId: graphMessage.internetMessageId?.trim() || null,
    subject: graphMessage.subject?.trim() || null,
    bodyPreview: graphMessage.bodyPreview?.replace(/\s+/g, " ").trim() || null,
    webLink: graphMessage.webLink?.trim() || null,
    fromName: graphMessage.from?.emailAddress?.name?.trim() || null,
    fromAddress: graphMessage.from?.emailAddress?.address?.trim() || null,
    toRecipients: mapRecipients(graphMessage.toRecipients),
    ccRecipients: mapRecipients(graphMessage.ccRecipients),
    receivedDateTime: graphMessage.receivedDateTime?.trim() || null,
    sentDateTime: graphMessage.sentDateTime?.trim() || null,
    importance: graphMessage.importance ?? null,
    inferenceClassification: graphMessage.inferenceClassification ?? null,
    isRead: graphMessage.isRead ?? null,
    hasAttachments: graphMessage.hasAttachments ?? null
  };
}

function normalizeDateTime(value: GraphCalendarEvent["start"]) {
  const dateTime = value?.dateTime?.trim();
  if (!dateTime) {
    return null;
  }

  const withZone = /(?:z|[+-]\d{2}:\d{2})$/i.test(dateTime) ? dateTime : `${dateTime}Z`;
  return Number.isNaN(Date.parse(withZone)) ? null : new Date(withZone).toISOString();
}

function mapCalendarEvent(event: GraphCalendarEvent): CalendarEventRecord {
  return {
    id: event.id,
    subject: event.subject?.trim() || null,
    bodyPreview: event.bodyPreview?.replace(/\s+/g, " ").trim() || null,
    webLink: event.webLink?.trim() || null,
    startAt: normalizeDateTime(event.start),
    endAt: normalizeDateTime(event.end),
    isCancelled: event.isCancelled ?? false,
    isAllDay: event.isAllDay ?? false,
    organizerName: event.organizer?.emailAddress?.name?.trim() || null,
    organizerEmail: event.organizer?.emailAddress?.address?.trim() || null,
    attendees:
      event.attendees
        ?.map((attendee) => attendee.emailAddress?.name?.trim() || attendee.emailAddress?.address?.trim() || null)
        .filter((entry): entry is string => Boolean(entry)) ?? [],
    importance: event.importance ?? null
  };
}

function stripHtml(value: string | null | undefined) {
  return value?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
}

export class GraphMicrosoft365Client implements Microsoft365Client {
  private readonly config: Pick<
    BlackhawkM365SignalAgentConfig,
    "graphBaseUrl" | "m365ClientId" | "m365ClientSecret" | "m365TenantId" | "requestTimeoutMs"
  >;
  private cachedToken: {
    accessToken: string;
    expiresAt: number;
  } | null = null;

  constructor(
    config: Pick<
      BlackhawkM365SignalAgentConfig,
      "graphBaseUrl" | "m365ClientId" | "m365ClientSecret" | "m365TenantId" | "requestTimeoutMs"
    >
  ) {
    this.config = config;
  }

  async listInboxMessages(params: { userIdOrEmail: string; since: string; limit?: number }) {
    const query = new URLSearchParams({
      $top: String(params.limit ?? 50),
      $orderby: "receivedDateTime desc",
      $select:
        "id,conversationId,internetMessageId,subject,bodyPreview,webLink,receivedDateTime,sentDateTime,importance,inferenceClassification,isRead,hasAttachments,from,toRecipients,ccRecipients",
      $filter: `receivedDateTime ge ${params.since}`
    });

    const body = await this.graphJson<GraphListResponse<GraphMessage>>(
      `/users/${encodeURIComponent(params.userIdOrEmail)}/mailFolders/inbox/messages?${query.toString()}`
    );
    return body.value.map(mapMessage);
  }

  async listSentMessages(params: { userIdOrEmail: string; since: string; limit?: number }) {
    const query = new URLSearchParams({
      $top: String(params.limit ?? 50),
      $orderby: "sentDateTime desc",
      $select:
        "id,conversationId,internetMessageId,subject,bodyPreview,webLink,receivedDateTime,sentDateTime,importance,inferenceClassification,isRead,hasAttachments,from,toRecipients,ccRecipients",
      $filter: `sentDateTime ge ${params.since}`
    });

    const body = await this.graphJson<GraphListResponse<GraphMessage>>(
      `/users/${encodeURIComponent(params.userIdOrEmail)}/mailFolders/sentitems/messages?${query.toString()}`
    );
    return body.value.map(mapMessage);
  }

  async listCalendarEvents(params: { userIdOrEmail: string; start: string; end: string; limit?: number }) {
    const query = new URLSearchParams({
      startDateTime: params.start,
      endDateTime: params.end,
      $top: String(params.limit ?? 50),
      $orderby: "start/dateTime",
      $select: "id,subject,bodyPreview,webLink,isCancelled,isAllDay,start,end,organizer,attendees,importance"
    });

    const body = await this.graphJson<GraphListResponse<GraphCalendarEvent>>(
      `/users/${encodeURIComponent(params.userIdOrEmail)}/calendarView?${query.toString()}`
    );
    return body.value.map(mapCalendarEvent);
  }

  async listTeamsChats(params: { userIdOrEmail: string; limit?: number }) {
    const query = new URLSearchParams({
      $top: String(params.limit ?? 25),
      $expand: "members"
    });

    const body = await this.graphJson<GraphListResponse<GraphChat>>(
      `/users/${encodeURIComponent(params.userIdOrEmail)}/chats?${query.toString()}`
    );

    return body.value.map<TeamsChatRecord>((chat) => ({
      id: chat.id,
      topic: chat.topic?.trim() || null,
      chatType: chat.chatType ?? "unknown",
      members:
        chat.members
          ?.map((member) => member.displayName?.trim() || member.email?.trim() || null)
          .filter((entry): entry is string => Boolean(entry)) ?? []
    }));
  }

  async listChatMessages(params: { chatId: string; since: string; limit?: number }) {
    const query = new URLSearchParams({
      $top: String(params.limit ?? 25),
      $orderby: "createdDateTime desc"
    });

    const body = await this.graphJson<GraphListResponse<GraphChatMessage>>(
      `/chats/${encodeURIComponent(params.chatId)}/messages?${query.toString()}`
    );

    return body.value
      .map<TeamsMessageRecord>((message) => ({
        id: message.id,
        chatId: params.chatId,
        createdAt: message.createdDateTime?.trim() || null,
        fromName: message.from?.user?.displayName?.trim() || null,
        bodyPreview: stripHtml(message.body?.content),
        webUrl: message.webUrl?.trim() || null,
        importance: message.importance ?? null
      }))
      .filter((message) => !message.createdAt || Date.parse(message.createdAt) >= Date.parse(params.since));
  }

  private async acquireToken() {
    const now = Date.now();
    if (this.cachedToken && now < this.cachedToken.expiresAt - 60_000) {
      return this.cachedToken.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.m365ClientId,
      client_secret: this.config.m365ClientSecret,
      scope: "https://graph.microsoft.com/.default"
    });

    const tokenEndpoint = `https://login.microsoftonline.com/${this.config.m365TenantId}/oauth2/v2.0/token`;
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body,
      cache: "no-store"
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new GraphApiError(`Microsoft token request failed: ${bodyText || response.statusText}`, {
        statusCode: response.status,
        retryable: response.status >= 500 || response.status === 429
      });
    }

    const token = (await response.json()) as GraphTokenResponse;
    this.cachedToken = {
      accessToken: token.access_token,
      expiresAt: now + token.expires_in * 1000
    };

    return token.access_token;
  }

  private async graphJson<T>(path: string): Promise<T> {
    return await retry(
      async () => {
        const token = await this.acquireToken();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
        timeout.unref?.();

        try {
          const response = await fetch(`${this.config.graphBaseUrl}${path}`, {
            method: "GET",
            headers: {
              authorization: `Bearer ${token}`,
              accept: "application/json"
            },
            cache: "no-store",
            signal: controller.signal
          });

          if (!response.ok) {
            const errorBody = ((await response.json().catch(() => null)) as GraphErrorShape | null)?.error;
            throw new GraphApiError(errorBody?.message || `Graph request failed for ${path}.`, {
              statusCode: response.status,
              code: errorBody?.code ?? null
            });
          }

          return (await response.json()) as T;
        } finally {
          clearTimeout(timeout);
        }
      },
      {
        attempts: 3,
        shouldRetry: (error) => error instanceof GraphApiError && error.retryable
      }
    );
  }
}
