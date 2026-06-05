import { isConnectorHealthSignal } from "@/lib/agent-signal-brief";
import type {
  AgentProducedMicrosoft365SignalEnvelope,
  AgentProducedMicrosoft365SignalEnvelopeSource,
  Microsoft365SourceCoverage,
  Microsoft365SourceCoverageStatus
} from "@/lib/microsoft-signal-intake";

const AGENT_HANDOFF_STALE_MS = 24 * 60 * 60 * 1000;
const MICROSOFT_SOURCE_FAMILIES = ["outlook", "calendar", "teams"] as const;

type MicrosoftSourceFamily = (typeof MICROSOFT_SOURCE_FAMILIES)[number];
type AgentSourceCoverageSummaryStatus = Microsoft365SourceCoverageStatus;

export type AgentHandoffSourceCoverageDetail = {
  status: AgentSourceCoverageSummaryStatus;
  checkedAt: string | null;
  signalCount: number;
  reason: string | null;
  inferred: boolean;
};

export type AgentHandoffSourceStatus = {
  available: boolean;
  mode: "database" | "local" | "fixture" | "missing";
  producer: string | null;
  connectorFamily: string | null;
  producedAt: string | null;
  isFixture: boolean;
  isStale: boolean;
  ageLabel: string | null;
  sourcesPresent: {
    outlook: boolean;
    calendar: boolean;
    teams: boolean;
  };
  signalCountsBySource: {
    outlook: number;
    calendar: number;
    teams: number;
  };
  hasExplicitSourceCoverage: boolean;
  sourceCoverageBySource: {
    outlook: AgentHandoffSourceCoverageDetail;
    calendar: AgentHandoffSourceCoverageDetail;
    teams: AgentHandoffSourceCoverageDetail;
  };
  diagnosticCount: number;
  missingSources: string[];
  summary: string;
};

type AgentEnvelopeStatusInput = {
  envelope?:
    | (Pick<AgentProducedMicrosoft365SignalEnvelope, "producer" | "connectorFamily" | "signals"> & {
        producedAt?: string | null;
        sourceCoverage?: Microsoft365SourceCoverage;
      })
    | null;
  source?: AgentProducedMicrosoft365SignalEnvelopeSource | "database" | "missing" | null;
  now?: Date | string | number;
};

function formatAgeLabel(ageMs: number) {
  if (ageMs < 60 * 1000) {
    return "just now";
  }

  if (ageMs < 60 * 60 * 1000) {
    return `${Math.max(1, Math.floor(ageMs / (60 * 1000)))} min ago`;
  }

  if (ageMs < 24 * 60 * 60 * 1000) {
    return `${Math.max(1, Math.floor(ageMs / (60 * 60 * 1000)))} hr ago`;
  }

  return `${Math.max(1, Math.floor(ageMs / (24 * 60 * 60 * 1000)))} day${ageMs >= 2 * 24 * 60 * 60 * 1000 ? "s" : ""} ago`;
}

function normalizeNow(value: AgentEnvelopeStatusInput["now"]) {
  if (!value) {
    return Date.now();
  }

  const next =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : Date.parse(value);

  return Number.isFinite(next) ? next : Date.now();
}

function formatSourceFamilyLabel(source: MicrosoftSourceFamily) {
  switch (source) {
    case "calendar":
      return "Calendar";
    case "teams":
      return "Teams";
    case "outlook":
    default:
      return "Outlook";
  }
}

function inferCoverageStatusFromSignals(signalCount: number): AgentSourceCoverageSummaryStatus {
  return signalCount > 0 ? "included" : "unknown";
}

function deriveCoverageDetail(
  source: MicrosoftSourceFamily,
  coverage: Microsoft365SourceCoverage | undefined,
  relevantSignalCount: number
): AgentHandoffSourceCoverageDetail {
  const explicit = coverage?.[source];

  if (!explicit) {
    return {
      status: inferCoverageStatusFromSignals(relevantSignalCount),
      checkedAt: null,
      signalCount: relevantSignalCount,
      reason: null,
      inferred: true
    };
  }

  const explicitCount = explicit.signalCount;
  const derivedSignalCount =
    typeof explicitCount === "number"
      ? Math.max(relevantSignalCount, explicitCount)
      : relevantSignalCount;

  if (explicit.status === "empty" && relevantSignalCount > 0) {
    return {
      status: "included",
      checkedAt: explicit.checkedAt ?? null,
      signalCount: relevantSignalCount,
      reason: explicit.reason ?? null,
      inferred: false
    };
  }

  if (explicit.status === "included" && derivedSignalCount <= 0) {
    return {
      status: "unknown",
      checkedAt: explicit.checkedAt ?? null,
      signalCount: 0,
      reason: explicit.reason ?? null,
      inferred: false
    };
  }

  return {
    status: explicit.status,
    checkedAt: explicit.checkedAt ?? null,
    signalCount: derivedSignalCount,
    reason: explicit.reason ?? null,
    inferred: false
  };
}

function formatCoverageSummary(
  source: MicrosoftSourceFamily,
  detail: AgentHandoffSourceCoverageDetail
) {
  const label = formatSourceFamilyLabel(source);

  switch (detail.status) {
    case "included":
      return `${label} included`;
    case "empty":
      return `${label} checked, no relevant signals`;
    case "skipped":
      return `${label} skipped`;
    case "unavailable":
      return `${label} unavailable`;
    case "permission_denied":
      return `${label} permission denied`;
    case "error":
      return `${label} error`;
    case "unknown":
    default:
      return `${label} coverage unknown`;
  }
}

export function deriveAgentHandoffSourceStatus(input: AgentEnvelopeStatusInput): AgentHandoffSourceStatus {
  const envelope = input.envelope ?? null;
  const mode: AgentHandoffSourceStatus["mode"] = envelope
    ? input.source === "fixture"
      ? "fixture"
      : input.source === "database"
        ? "database"
        : "local"
    : "missing";
  const signalCountsBySource = {
    outlook: 0,
    calendar: 0,
    teams: 0
  };
  const relevantSignalCountsBySource = {
    outlook: 0,
    calendar: 0,
    teams: 0
  };

  for (const signal of envelope?.signals ?? []) {
    if (signal.source === "outlook") {
      signalCountsBySource.outlook += 1;
      if (!isConnectorHealthSignal(signal)) {
        relevantSignalCountsBySource.outlook += 1;
      }
    } else if (signal.source === "calendar") {
      signalCountsBySource.calendar += 1;
      if (!isConnectorHealthSignal(signal)) {
        relevantSignalCountsBySource.calendar += 1;
      }
    } else if (signal.source === "teams") {
      signalCountsBySource.teams += 1;
      if (!isConnectorHealthSignal(signal)) {
        relevantSignalCountsBySource.teams += 1;
      }
    }
  }

  const hasExplicitSourceCoverage = Boolean(
    envelope?.sourceCoverage && Object.keys(envelope.sourceCoverage).length > 0
  );
  const sourcesPresent = {
    outlook: signalCountsBySource.outlook > 0,
    calendar: signalCountsBySource.calendar > 0,
    teams: signalCountsBySource.teams > 0
  };
  const sourceCoverageBySource = {
    outlook: deriveCoverageDetail(
      "outlook",
      envelope?.sourceCoverage,
      relevantSignalCountsBySource.outlook
    ),
    calendar: deriveCoverageDetail(
      "calendar",
      envelope?.sourceCoverage,
      relevantSignalCountsBySource.calendar
    ),
    teams: deriveCoverageDetail("teams", envelope?.sourceCoverage, relevantSignalCountsBySource.teams)
  };
  const missingSources = MICROSOFT_SOURCE_FAMILIES.flatMap((source) =>
    sourceCoverageBySource[source].status === "unknown" ? [formatSourceFamilyLabel(source)] : []
  );

  const diagnosticCount = (envelope?.signals ?? []).filter(isConnectorHealthSignal).length;
  const producedAt = envelope?.producedAt ?? null;
  const producedAtMs = producedAt ? Date.parse(producedAt) : Number.NaN;
  const ageLabel =
    producedAt && !Number.isNaN(producedAtMs)
      ? formatAgeLabel(Math.max(0, normalizeNow(input.now) - producedAtMs))
      : null;
  const isFixture = mode === "fixture";
  const isStale = !isFixture && Boolean(producedAt && !Number.isNaN(producedAtMs) && normalizeNow(input.now) - producedAtMs > AGENT_HANDOFF_STALE_MS);

  const summaryParts = ["Agent Microsoft 365 brief"];

  if (mode === "missing") {
    summaryParts.push("missing");
  } else if (mode === "fixture") {
    summaryParts.push("fixture fallback");
    summaryParts.push("not live data");
  } else if (mode === "database") {
    summaryParts.push("database import");

    if (ageLabel) {
      summaryParts.push(`produced ${ageLabel}`);
    } else {
      summaryParts.push("freshness unknown");
    }
  } else {
    summaryParts.push("local handoff");

    if (isStale) {
      summaryParts.push("stale");
    }

    if (ageLabel) {
      summaryParts.push(`produced ${ageLabel}`);
    } else {
      summaryParts.push("freshness unknown");
    }
  }

  if (mode !== "missing") {
    const coverageSummaries = MICROSOFT_SOURCE_FAMILIES.map((source) =>
      formatCoverageSummary(source, sourceCoverageBySource[source])
    );
    summaryParts.push(...coverageSummaries);

    if (diagnosticCount > 0) {
      summaryParts.push(`${diagnosticCount} connector-health diagnostic${diagnosticCount === 1 ? "" : "s"} included`);
    }
  }

  return {
    available: Boolean(envelope),
    mode,
    producer: envelope?.producer ?? null,
    connectorFamily: envelope?.connectorFamily ?? null,
    producedAt,
    isFixture,
    isStale,
    ageLabel,
    sourcesPresent,
    signalCountsBySource,
    hasExplicitSourceCoverage,
    sourceCoverageBySource,
    diagnosticCount,
    missingSources,
    summary: summaryParts.join(" · ")
  };
}

export function getMicrosoftSourceModeLabel(mode: "agent_handoff" | "graph_oauth" | "mixed") {
  switch (mode) {
    case "agent_handoff":
      return "Agent handoff";
    case "mixed":
      return "Mixed";
    case "graph_oauth":
    default:
      return "Graph OAuth";
  }
}
