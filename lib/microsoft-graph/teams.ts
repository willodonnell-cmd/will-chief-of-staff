import type { MicrosoftGraphClient } from "@/lib/microsoft-graph/client";
import { sourceResultFromError } from "@/lib/microsoft-graph/outlook";
import type { MicrosoftGraphSourceResult } from "@/lib/microsoft-graph/types";

type GraphChat = {
  id: string;
  topic?: string | null;
  chatType?: string | null;
  webUrl?: string | null;
  lastUpdatedDateTime?: string | null;
};

type GraphChatMessage = {
  id: string;
  createdDateTime?: string | null;
  webUrl?: string | null;
  from?: {
    user?: {
      displayName?: string | null;
      userIdentityType?: string | null;
    } | null;
  } | null;
  body?: {
    content?: string | null;
    contentType?: string | null;
  } | null;
};

export type TeamsSourceRecord = {
  chatId: string;
  chatTopic: string | null;
  chatType: string | null;
  messageId: string;
  from: string | null;
  createdDateTime: string;
  webUrl: string | null;
  preview: string;
};

function compact(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function stripHtml(value: string | null | undefined) {
  return compact(
    (value ?? "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  );
}

export function normalizeGraphTeamsMessage(chat: GraphChat, message: GraphChatMessage): TeamsSourceRecord | null {
  const chatId = compact(chat.id);
  const messageId = compact(message.id);
  const createdDateTime = compact(message.createdDateTime);
  if (!chatId || !messageId || !createdDateTime || Number.isNaN(Date.parse(createdDateTime))) {
    return null;
  }

  const preview = stripHtml(message.body?.content).slice(0, 800);
  if (!preview) {
    return null;
  }

  return {
    chatId,
    chatTopic: compact(chat.topic) || null,
    chatType: compact(chat.chatType) || null,
    messageId,
    from: compact(message.from?.user?.displayName) || null,
    createdDateTime: new Date(createdDateTime).toISOString(),
    webUrl: compact(message.webUrl) || compact(chat.webUrl) || null,
    preview
  };
}

export async function collectTeamsSource(
  client: MicrosoftGraphClient,
  options: {
    now?: string;
    lookbackHours?: number;
    chatLimit?: number;
    messageLimit?: number;
  } = {}
): Promise<MicrosoftGraphSourceResult<TeamsSourceRecord>> {
  const checkedAt = options.now ?? new Date().toISOString();
  const cutoff = Date.parse(checkedAt) - (options.lookbackHours ?? 72) * 60 * 60 * 1000;
  const chatLimit = Math.max(1, Math.min(options.chatLimit ?? 20, 50));
  const messageLimit = Math.max(1, Math.min(options.messageLimit ?? 20, 50));
  const chatQuery = new URLSearchParams({
    $select: "id,topic,chatType,webUrl,lastUpdatedDateTime",
    $top: `${chatLimit}`
  });

  try {
    const chats = await client.getJsonPages<GraphChat>(`/me/chats?${chatQuery.toString()}`);
    const records: TeamsSourceRecord[] = [];

    for (const chat of chats.slice(0, chatLimit)) {
      const messageQuery = new URLSearchParams({
        $top: `${messageLimit}`,
        $orderby: "createdDateTime desc"
      });
      const messages = await client.getJsonPages<GraphChatMessage>(
        `/me/chats/${encodeURIComponent(chat.id)}/messages?${messageQuery.toString()}`
      );

      for (const message of messages) {
        const record = normalizeGraphTeamsMessage(chat, message);
        if (!record || Date.parse(record.createdDateTime) < cutoff) {
          continue;
        }

        records.push(record);
      }
    }

    return {
      records,
      coverage: {
        status: records.length > 0 ? "included" : "empty",
        checkedAt,
        signalCount: records.length,
        reason:
          "Teams delegated Graph access uses Chat.Read. Some tenants may require admin policy or consent before chat messages are readable."
      },
      errors: []
    };
  } catch (error) {
    const result = sourceResultFromError<TeamsSourceRecord>("teams", error, checkedAt);
    if (result.coverage.status === "permission_denied" || result.coverage.status === "unavailable") {
      result.coverage.reason =
        "Teams Graph chat access is unavailable for this connection. Chat.Read may require tenant approval or policy changes.";
      result.errors = result.errors.map((entry) => ({
        ...entry,
        reason: result.coverage.reason ?? entry.reason
      }));
    }

    return result;
  }
}
