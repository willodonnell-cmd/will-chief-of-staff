import type {
  RoutingSurface,
  SignalAttention,
  SignalSource,
  SignalType,
  SourceCoverageStatus
} from "./payload/schemas";
import type { StructuredLogger } from "./utils/logging";

export type AgentRunMode = "scheduled" | "manual";

export type ReviewWindows = {
  emailLookbackHours: number;
  teamsLookbackHours: number;
  calendarLookbackHours: number;
  calendarLookaheadDays: number;
};

export type ManualRunContext = {
  requestId: string;
  requestedAt: string;
  expiresAt: string;
  requestContext: Record<string, unknown>;
};

export type CollectorContext = {
  now: string;
  windows: ReviewWindows;
  tenantLabel: string;
  ownerName: string;
  userIdentifier: string;
  logger: StructuredLogger;
};

export type OutlookMessageRecord = {
  id: string;
  conversationId: string | null;
  internetMessageId: string | null;
  subject: string | null;
  bodyPreview: string | null;
  webLink: string | null;
  fromName: string | null;
  fromAddress: string | null;
  toRecipients: string[];
  ccRecipients: string[];
  receivedDateTime: string | null;
  sentDateTime: string | null;
  importance: "low" | "normal" | "high" | null;
  inferenceClassification: "focused" | "other" | null;
  isRead: boolean | null;
  hasAttachments: boolean | null;
};

export type CalendarEventRecord = {
  id: string;
  subject: string | null;
  bodyPreview: string | null;
  webLink: string | null;
  startAt: string | null;
  endAt: string | null;
  isCancelled: boolean;
  isAllDay: boolean;
  organizerName: string | null;
  organizerEmail: string | null;
  attendees: string[];
  importance: "low" | "normal" | "high" | null;
};

export type TeamsChatRecord = {
  id: string;
  topic: string | null;
  chatType: "oneOnOne" | "group" | "meeting" | "unknown";
  members: string[];
};

export type TeamsMessageRecord = {
  id: string;
  chatId: string;
  createdAt: string | null;
  fromName: string | null;
  bodyPreview: string | null;
  webUrl: string | null;
  importance: "normal" | "urgent" | "highImportance" | null;
};

export type SourceCollectionReason =
  | "manual_override"
  | "no_relevant_items"
  | "source_access_denied"
  | "source_error"
  | "source_unavailable"
  | "skipped_by_policy";

export type CollectorResult = {
  source: SignalSource;
  status: SourceCoverageStatus;
  checkedAt: string;
  candidates: SignalCandidate[];
  reason: string | null;
};

export type SourceCollectionErrorCode = "permission_denied" | "unavailable" | "error";

export type SignalCandidate = {
  source: SignalSource;
  sourceRecordId: string;
  sourceThreadId: string | null;
  sourceUrl: string | null;
  sourceLabel: string;
  titleSeed: string;
  summarySeed: string;
  participants: string[];
  occurredAt: string;
  dueAt: string | null;
  directAsk: boolean;
  waitingOnWill: boolean;
  decisionRequired: boolean;
  openLoop: boolean;
  consequenceKeywords: string[];
  relationKeywords: string[];
  rawText: string;
  protectedContext: true;
  dedupeKeys: string[];
  preferredSurface?: RoutingSurface;
  likelyResolved: boolean;
  senderName: string | null;
};

export type ClassifiedSignalCandidate = SignalCandidate & {
  id: string;
  signalType: SignalType;
  attention: SignalAttention;
  routingSurface: RoutingSurface;
  routingReason: string;
  title: string;
  summary: string;
  actionRequest: string | null;
  score: number;
  mergedSourceRecordIds: string[];
};

export type WorkflowSourceResult = CollectorResult;

export interface SignalCollector {
  readonly source: SignalSource;
  collect(context: CollectorContext): Promise<CollectorResult>;
}

export interface Microsoft365Client {
  listInboxMessages(params: {
    userIdOrEmail: string;
    since: string;
    limit?: number;
  }): Promise<OutlookMessageRecord[]>;
  listSentMessages(params: {
    userIdOrEmail: string;
    since: string;
    limit?: number;
  }): Promise<OutlookMessageRecord[]>;
  listCalendarEvents(params: {
    userIdOrEmail: string;
    start: string;
    end: string;
    limit?: number;
  }): Promise<CalendarEventRecord[]>;
  listTeamsChats(params: {
    userIdOrEmail: string;
    limit?: number;
  }): Promise<TeamsChatRecord[]>;
  listChatMessages(params: {
    chatId: string;
    since: string;
    limit?: number;
  }): Promise<TeamsMessageRecord[]>;
}
