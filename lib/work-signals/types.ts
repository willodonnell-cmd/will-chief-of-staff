export type WorkSignalSource = "outlook" | "calendar" | "teams" | "people" | "files";

export type WorkSignalImportance = "low" | "normal" | "high";
export type WorkSignalUrgency = "low" | "medium" | "high";

export type WorkSignalParticipant = {
  name: string;
  email: string | null;
};

export type WorkSignal = {
  id: string;
  source: WorkSignalSource;
  sourceId: string;
  sourceUrl: string | null;
  title: string;
  bodyOrSummary: string;
  senderOrOwner: string;
  recipientsOrParticipants: WorkSignalParticipant[];
  timestamp: string | null;
  importance: WorkSignalImportance;
  urgency: WorkSignalUrgency;
  topicTags: string[];
  people: WorkSignalParticipant[];
  companies: string[];
  projects: string[];
  extractedActions: string[];
  extractedDecisions: string[];
  followUpRequired: boolean;
  dueDate: string | null;
  confidence: number;
  rawMetadata: Record<string, unknown>;
};

export type WorkSignalRelevanceReasonCode =
  | "unread"
  | "high_importance"
  | "flagged"
  | "focused_inbox"
  | "recent"
  | "attachments"
  | "direct_ask";

export type WorkSignalRelevanceReason = {
  code: WorkSignalRelevanceReasonCode;
  label: string;
  weight: number;
};

export type WorkSignalRelevance = {
  score: number;
  level: "low" | "medium" | "high";
  reasons: WorkSignalRelevanceReason[];
};

