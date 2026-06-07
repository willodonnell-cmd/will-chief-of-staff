import type { CollectorContext, CollectorResult, Microsoft365Client, SignalCandidate, SignalCollector } from "../types";
import { GraphApiError } from "../clients/microsoft/graph-client";
import { normalizeKey } from "../utils/ids";
import { subtractHours } from "../utils/iso";

const HIGH_PRIORITY_KEYWORDS = [
  "blocked",
  "urgent",
  "decision",
  "investor",
  "customer",
  "board",
  "partner",
  "budget",
  "legal",
  "term sheet",
  "approval"
] as const;

function hasKeyword(text: string, keywords: readonly string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

export class TeamsCollector implements SignalCollector {
  readonly source = "teams" as const;
  private readonly client: Microsoft365Client;
  private readonly chatLimit: number;
  private readonly messageLimit: number;

  constructor(client: Microsoft365Client, options: { chatLimit?: number; messageLimit?: number } = {}) {
    this.client = client;
    this.chatLimit = options.chatLimit ?? 25;
    this.messageLimit = options.messageLimit ?? 10;
  }

  async collect(context: CollectorContext): Promise<CollectorResult> {
    const checkedAt = context.now;
    const since = subtractHours(context.now, context.windows.teamsLookbackHours);

    try {
      const chats = await this.client.listTeamsChats({
        userIdOrEmail: context.userIdentifier,
        limit: this.chatLimit
      });

      const candidateLists = await Promise.all(
        chats.map(async (chat) => {
          const groupContextText = `${chat.topic ?? ""} ${chat.members.join(" ")}`.toLowerCase();
          if (chat.chatType === "group") {
            if (!hasKeyword(groupContextText, HIGH_PRIORITY_KEYWORDS) && !groupContextText.includes("will")) {
              return [];
            }
          }

          const messages = await this.client.listChatMessages({
            chatId: chat.id,
            since,
            limit: this.messageLimit
          });

          const latest = messages[0];
          if (!latest) {
            return [];
          }

          const text = `${chat.topic ?? ""} ${latest.bodyPreview ?? ""}`.toLowerCase();
          if (chat.chatType === "group" && !hasKeyword(`${groupContextText} ${text}`, HIGH_PRIORITY_KEYWORDS)) {
            return [];
          }

          const directAsk = /\?|can you|need you|please|review|respond/.test(text);
          const waitingOnWill = directAsk || hasKeyword(text, HIGH_PRIORITY_KEYWORDS);
          if (!waitingOnWill) {
            return [];
          }

          const candidate: SignalCandidate = {
            source: "teams",
            sourceRecordId: latest.id,
            sourceThreadId: latest.chatId,
            sourceUrl: latest.webUrl,
            sourceLabel: chat.chatType === "group" ? chat.topic || "Teams group chat" : "Teams DM",
            titleSeed: chat.topic || latest.bodyPreview || "Teams thread needs review",
            summarySeed: latest.bodyPreview || "Recent Teams message may require action.",
            participants: chat.members,
            occurredAt: latest.createdAt ?? checkedAt,
            dueAt: null,
            directAsk,
            waitingOnWill,
            decisionRequired: /decision|approve|approval/.test(text),
            openLoop: /blocked|waiting|follow up|pending/.test(text),
            consequenceKeywords: [],
            relationKeywords: [],
            rawText: text,
            protectedContext: true,
            dedupeKeys: [latest.chatId, normalizeKey(chat.topic ?? latest.bodyPreview ?? latest.id)],
            preferredSurface: undefined,
            likelyResolved: false,
            senderName: latest.fromName
          };

          return [candidate];
        })
      );

      const candidates = candidateLists.flat();
      return {
        source: this.source,
        status: candidates.length > 0 ? "included" : "empty",
        checkedAt,
        candidates,
        reason:
          candidates.length > 0
            ? "Reviewed Teams direct messages and only relevant group chats."
            : "No consequential Teams messages required escalation."
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
        reason: error instanceof Error ? error.message : "Teams collection failed."
      };
    }
  }
}
