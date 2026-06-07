import type { CollectorContext, CollectorResult, Microsoft365Client, SignalCollector, SignalCandidate } from "../types";
import { GraphApiError } from "../clients/microsoft/graph-client";
import { normalizeKey } from "../utils/ids";
import { subtractHours } from "../utils/iso";

const SUPPRESS_KEYWORDS = [
  "newsletter",
  "unsubscribe",
  "webinar",
  "promotion",
  "sale",
  "recruiting",
  "press release",
  "fyi only"
] as const;

const DIRECT_ASK_KEYWORDS = [
  "can you",
  "could you",
  "please",
  "need you",
  "waiting on",
  "follow up",
  "review",
  "approve",
  "confirm",
  "respond"
] as const;

const OPEN_LOOP_KEYWORDS = ["following up", "circling back", "checking in", "reminder", "pending"] as const;
const DECISION_KEYWORDS = ["approve", "decision", "sign off", "term sheet", "budget", "choose"] as const;

function combinedText(subject: string | null, bodyPreview: string | null) {
  return `${subject ?? ""} ${bodyPreview ?? ""}`.toLowerCase();
}

function looksSuppressible(text: string) {
  return SUPPRESS_KEYWORDS.some((keyword) => text.includes(keyword));
}

function hasKeyword(text: string, keywords: readonly string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function participantsForMessage(message: {
  fromName: string | null;
  fromAddress: string | null;
  toRecipients: string[];
  ccRecipients: string[];
}) {
  return [
    message.fromName || message.fromAddress,
    ...message.toRecipients,
    ...message.ccRecipients
  ].filter((value): value is string => Boolean(value));
}

function candidateForMessage(params: {
  context: CollectorContext;
  message: Awaited<ReturnType<Microsoft365Client["listInboxMessages"]>>[number];
  hasSentReply: boolean;
}): SignalCandidate | null {
  if (params.hasSentReply) {
    return null;
  }

  const text = combinedText(params.message.subject, params.message.bodyPreview);
  if (looksSuppressible(text)) {
    return null;
  }

  const directAsk = hasKeyword(text, DIRECT_ASK_KEYWORDS);
  const openLoop = hasKeyword(text, OPEN_LOOP_KEYWORDS);
  const decisionRequired = hasKeyword(text, DECISION_KEYWORDS);
  const waitingOnWill = !params.hasSentReply && (directAsk || openLoop || decisionRequired);

  if (!waitingOnWill && !decisionRequired && !directAsk) {
    return null;
  }

  return {
    source: "outlook",
    sourceRecordId: params.message.id,
    sourceThreadId: params.message.conversationId ?? params.message.internetMessageId,
    sourceUrl: params.message.webLink,
    sourceLabel: params.message.fromName || params.message.fromAddress || "Outlook",
    titleSeed: params.message.subject || "Outlook thread needs review",
    summarySeed: params.message.bodyPreview || "Recent Outlook thread may require action.",
    participants: participantsForMessage(params.message),
    occurredAt: params.message.receivedDateTime ?? params.context.now,
    dueAt: null,
    directAsk,
    waitingOnWill,
    decisionRequired,
    openLoop,
    consequenceKeywords: [],
    relationKeywords: [],
    rawText: text,
    protectedContext: true,
    dedupeKeys: unionKeys([
      params.message.conversationId,
      params.message.internetMessageId,
      normalizeKey(params.message.subject ?? "")
    ]),
    preferredSurface: undefined,
    likelyResolved: false,
    senderName: params.message.fromName || params.message.fromAddress
  };
}

function unionKeys(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export class OutlookCollector implements SignalCollector {
  readonly source = "outlook" as const;
  private readonly client: Microsoft365Client;
  private readonly messageLimit: number;

  constructor(client: Microsoft365Client, options: { messageLimit?: number } = {}) {
    this.client = client;
    this.messageLimit = options.messageLimit ?? 50;
  }

  async collect(context: CollectorContext): Promise<CollectorResult> {
    const checkedAt = context.now;
    const since = subtractHours(context.now, context.windows.emailLookbackHours);

    try {
      const [inboxMessages, sentMessages] = await Promise.all([
        this.client.listInboxMessages({
          userIdOrEmail: context.userIdentifier,
          since,
          limit: this.messageLimit
        }),
        this.client.listSentMessages({
          userIdOrEmail: context.userIdentifier,
          since,
          limit: this.messageLimit
        })
      ]);

      const repliedConversationIds = new Set(
        sentMessages.map((message) => message.conversationId).filter((value): value is string => Boolean(value))
      );

      const candidates = inboxMessages
        .map((message) =>
          candidateForMessage({
            context,
            message,
            hasSentReply: Boolean(message.conversationId && repliedConversationIds.has(message.conversationId))
          })
        )
        .filter((candidate): candidate is SignalCandidate => Boolean(candidate));

      return {
        source: this.source,
        status: candidates.length > 0 ? "included" : "empty",
        checkedAt,
        candidates,
        reason: candidates.length > 0 ? "Reviewed recent inbox threads and open loops." : "No consequential inbox threads found."
      };
    } catch (error) {
      return {
        source: this.source,
        status:
          error instanceof GraphApiError && error.statusCode === 403
            ? "permission_denied"
            : error instanceof GraphApiError && error.statusCode >= 500
              ? "unavailable"
              : "error",
        checkedAt,
        candidates: [],
        reason: error instanceof Error ? error.message : "Outlook collection failed."
      };
    }
  }
}
