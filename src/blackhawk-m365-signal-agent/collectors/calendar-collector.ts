import type { CollectorContext, CollectorResult, Microsoft365Client, SignalCandidate, SignalCollector } from "../types";
import { GraphApiError } from "../clients/microsoft/graph-client";
import { addDays, subtractHours } from "../utils/iso";
import { normalizeKey } from "../utils/ids";

const GENERIC_HOLD_KEYWORDS = ["hold", "placeholder", "focus time", "ooo", "travel", "commute"] as const;
const CONSEQUENCE_KEYWORDS = ["decision", "review", "board", "customer", "investor", "partner", "approval"] as const;

function hasKeyword(text: string, keywords: readonly string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

export class CalendarCollector implements SignalCollector {
  readonly source = "calendar" as const;
  private readonly client: Microsoft365Client;
  private readonly eventLimit: number;

  constructor(client: Microsoft365Client, options: { eventLimit?: number } = {}) {
    this.client = client;
    this.eventLimit = options.eventLimit ?? 50;
  }

  async collect(context: CollectorContext): Promise<CollectorResult> {
    const checkedAt = context.now;
    const start = subtractHours(context.now, context.windows.calendarLookbackHours);
    const end = addDays(context.now, context.windows.calendarLookaheadDays);

    try {
      const events = await this.client.listCalendarEvents({
        userIdOrEmail: context.userIdentifier,
        start,
        end,
        limit: this.eventLimit
      });

      const candidates = events
        .filter((event) => !event.isCancelled && !event.isAllDay)
        .map<SignalCandidate | null>((event) => {
          const text = `${event.subject ?? ""} ${event.bodyPreview ?? ""}`.toLowerCase();
          if (hasKeyword(text, GENERIC_HOLD_KEYWORDS)) {
            return null;
          }

          const upcomingOrRecent = Boolean(event.startAt);
          const decisionRequired = hasKeyword(text, CONSEQUENCE_KEYWORDS);
          if (!upcomingOrRecent) {
            return null;
          }

          return {
            source: "calendar",
            sourceRecordId: event.id,
            sourceThreadId: event.id,
            sourceUrl: event.webLink,
            sourceLabel: "Outlook Calendar",
            titleSeed: event.subject || "Calendar event requires preparation",
            summarySeed: event.bodyPreview || "Calendar event may require prep, follow-up, or a decision.",
            participants: [event.organizerName, event.organizerEmail, ...event.attendees].filter(
              (value): value is string => Boolean(value)
            ),
            occurredAt: event.startAt ?? checkedAt,
            dueAt: event.startAt,
            directAsk: false,
            waitingOnWill: true,
            decisionRequired,
            openLoop: Date.parse(event.startAt ?? checkedAt) < Date.parse(checkedAt),
            consequenceKeywords: [],
            relationKeywords: [],
            rawText: text,
            protectedContext: true,
            dedupeKeys: [event.id, normalizeKey(event.subject ?? "")],
            preferredSurface: undefined,
            likelyResolved: false,
            senderName: event.organizerName || event.organizerEmail
          };
        })
        .filter((candidate): candidate is SignalCandidate => Boolean(candidate));

      return {
        source: this.source,
        status: candidates.length > 0 ? "included" : "empty",
        checkedAt,
        candidates,
        reason:
          candidates.length > 0
            ? "Reviewed upcoming and recent calendar events for prep and follow-up."
            : "No consequential meetings required prep or follow-up."
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
        reason: error instanceof Error ? error.message : "Calendar collection failed."
      };
    }
  }
}
