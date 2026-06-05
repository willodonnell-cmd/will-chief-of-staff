import { MicrosoftGraphRequestError, type MicrosoftGraphClient } from "@/lib/microsoft-graph/client";
import type { MicrosoftGraphSourceResult } from "@/lib/microsoft-graph/types";

export type GraphEmailRecipient = {
  emailAddress?: {
    name?: string | null;
    address?: string | null;
  } | null;
};

export type GraphOutlookMessage = {
  id: string;
  conversationId?: string | null;
  subject?: string | null;
  sender?: GraphEmailRecipient | null;
  from?: GraphEmailRecipient | null;
  toRecipients?: GraphEmailRecipient[] | null;
  ccRecipients?: GraphEmailRecipient[] | null;
  receivedDateTime?: string | null;
  webLink?: string | null;
  bodyPreview?: string | null;
  importance?: "low" | "normal" | "high" | null;
  hasAttachments?: boolean | null;
  categories?: string[] | null;
};

export type OutlookSourceRecord = {
  id: string;
  conversationId: string | null;
  subject: string;
  senderName: string | null;
  senderEmail: string | null;
  fromName: string | null;
  fromEmail: string | null;
  toRecipients: string[];
  ccRecipients: string[];
  receivedDateTime: string;
  webLink: string | null;
  bodyPreview: string;
  importance: "low" | "normal" | "high";
  hasAttachments: boolean;
  categories: string[];
};

function compact(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function recipientLabel(recipient: GraphEmailRecipient | null | undefined) {
  const name = compact(recipient?.emailAddress?.name);
  const address = compact(recipient?.emailAddress?.address);
  return name || address || null;
}

function normalizeRecipientList(recipients: GraphEmailRecipient[] | null | undefined) {
  return (recipients ?? []).map(recipientLabel).filter((value): value is string => Boolean(value));
}

function coverageResult<TRecord>(
  records: TRecord[],
  checkedAt: string,
  reason: string | null = null
): MicrosoftGraphSourceResult<TRecord> {
  return {
    records,
    coverage: {
      status: records.length > 0 ? "included" : "empty",
      checkedAt,
      signalCount: records.length,
      reason
    },
    errors: []
  };
}

export function sourceResultFromError<TRecord>(
  source: "outlook" | "calendar" | "teams",
  error: unknown,
  checkedAt: string
): MicrosoftGraphSourceResult<TRecord> {
  const status =
    error instanceof MicrosoftGraphRequestError
      ? error.issueKind === "permission"
        ? "permission_denied"
        : error.issueKind === "auth"
          ? "unavailable"
          : error.issueKind === "rate_limit"
            ? "error"
            : "error"
      : "error";
  const reason =
    error instanceof MicrosoftGraphRequestError
      ? error.issueKind === "rate_limit"
        ? `Microsoft Graph rate limited ${source}${error.retryAfter ? `; retry after ${error.retryAfter}` : ""}.`
        : error.message
      : error instanceof Error
        ? error.message
        : `${source} source failed.`;

  return {
    records: [],
    coverage: {
      status,
      checkedAt,
      signalCount: 0,
      reason
    },
    errors: [
      {
        source,
        status,
        reason,
        issueKind: error instanceof MicrosoftGraphRequestError ? error.issueKind : "unknown"
      }
    ]
  };
}

export function normalizeGraphOutlookMessage(message: GraphOutlookMessage): OutlookSourceRecord | null {
  const id = compact(message.id);
  const receivedDateTime = compact(message.receivedDateTime);
  if (!id || !receivedDateTime || Number.isNaN(Date.parse(receivedDateTime))) {
    return null;
  }

  return {
    id,
    conversationId: compact(message.conversationId) || null,
    subject: compact(message.subject) || "Untitled Outlook message",
    senderName: compact(message.sender?.emailAddress?.name) || null,
    senderEmail: compact(message.sender?.emailAddress?.address) || null,
    fromName: compact(message.from?.emailAddress?.name) || null,
    fromEmail: compact(message.from?.emailAddress?.address) || null,
    toRecipients: normalizeRecipientList(message.toRecipients),
    ccRecipients: normalizeRecipientList(message.ccRecipients),
    receivedDateTime: new Date(receivedDateTime).toISOString(),
    webLink: compact(message.webLink) || null,
    bodyPreview: compact(message.bodyPreview).slice(0, 800),
    importance: message.importance ?? "normal",
    hasAttachments: message.hasAttachments ?? false,
    categories: (message.categories ?? []).map(compact).filter(Boolean)
  };
}

export async function collectOutlookSource(
  client: MicrosoftGraphClient,
  options: {
    now?: string;
    lookbackHours?: number;
    top?: number;
  } = {}
): Promise<MicrosoftGraphSourceResult<OutlookSourceRecord>> {
  const checkedAt = options.now ?? new Date().toISOString();
  const lookbackHours = options.lookbackHours ?? 72;
  const windowStart = new Date(Date.parse(checkedAt) - lookbackHours * 60 * 60 * 1000).toISOString();
  const query = new URLSearchParams({
    $select:
      "id,conversationId,subject,sender,from,toRecipients,ccRecipients,receivedDateTime,webLink,bodyPreview,importance,hasAttachments,categories",
    $filter: `receivedDateTime ge ${windowStart}`,
    $orderby: "receivedDateTime desc",
    $top: `${Math.max(1, Math.min(options.top ?? 50, 50))}`
  });

  try {
    const messages = await client.getJsonPages<GraphOutlookMessage>(
      `/me/mailFolders/inbox/messages?${query.toString()}`
    );
    return coverageResult(
      messages
        .map(normalizeGraphOutlookMessage)
        .filter((record): record is OutlookSourceRecord => Boolean(record)),
      checkedAt
    );
  } catch (error) {
    return sourceResultFromError("outlook", error, checkedAt);
  }
}
