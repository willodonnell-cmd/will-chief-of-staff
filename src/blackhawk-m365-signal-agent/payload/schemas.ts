export const SIGNAL_SOURCES = ["outlook", "calendar", "teams"] as const;
export const SIGNAL_TYPES = ["follow_up", "meeting", "decision", "status"] as const;
export const SIGNAL_ATTENTION = ["high", "medium", "low"] as const;
export const ROUTING_SURFACES = [
  "priority_inbox",
  "investment_committee",
  "suppress"
] as const;
export const SOURCE_COVERAGE_STATUSES = [
  "included",
  "empty",
  "skipped",
  "unavailable",
  "permission_denied",
  "error",
  "unknown"
] as const;
export const ENVELOPE_STATUSES = ["succeeded", "failed"] as const;

export type SignalSource = (typeof SIGNAL_SOURCES)[number];
export type SignalType = (typeof SIGNAL_TYPES)[number];
export type SignalAttention = (typeof SIGNAL_ATTENTION)[number];
export type RoutingSurface = (typeof ROUTING_SURFACES)[number];
export type SourceCoverageStatus = (typeof SOURCE_COVERAGE_STATUSES)[number];
export type EnvelopeStatus = (typeof ENVELOPE_STATUSES)[number];

export type RoutingHints = {
  recommendedSurface: RoutingSurface;
  reason: string;
};

export type BlackhawkSignal = {
  id: string;
  source: SignalSource;
  signalType: SignalType;
  attention: SignalAttention;
  title: string;
  summary: string;
  owner: string;
  sourceLabel: string;
  occurredAt: string;
  dueAt: string | null;
  sourceUrl: string | null;
  actionRequest: string | null;
  participants: string[];
  protectedContext: true;
  routingHints: RoutingHints;
};

export type SourceCoverageEntry = {
  status: SourceCoverageStatus;
  checkedAt: string;
  signalCount: number;
  reason: string | null;
};

export type SourceCoverage = Record<SignalSource, SourceCoverageEntry>;

export type BlackhawkSignalPayload = {
  producer: "chatgpt_agent";
  connectorFamily: "microsoft_365";
  producedAt: string;
  tenantLabel: string;
  status: EnvelopeStatus;
  sourcesChecked: SignalSource[];
  windowStart: string;
  windowEnd: string;
  manualRunRequestId?: string;
  sourceCoverage: SourceCoverage;
  signals: BlackhawkSignal[];
};

export type BlackhawkImportSuccess = {
  runId: string;
  submittedCount: number;
  acceptedCount: number;
  investmentCommitteeRoutedCount: number;
  suppressedCount: number;
  rejectedCount: number;
};
