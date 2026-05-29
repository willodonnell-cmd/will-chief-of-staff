import type { ChiefOfStaffSignal } from "@/lib/chief-of-staff-signal";
import type { AgentProducedMicrosoft365SignalEnvelopeSource } from "@/lib/microsoft-signal-intake";

const CONNECTOR_HEALTH_DIRECT_PHRASES = [
  "could not be inspected",
  "could not be reviewed",
  "not inspected",
  "not reviewed"
] as const;

const CONNECTOR_HEALTH_ISSUE_TERMS = [
  "unavailable",
  "inaccessible",
  "failed",
  "failure",
  "blocked"
] as const;

const CONNECTOR_HEALTH_SOURCE_LINKED_ISSUE_TERMS = [
  "unavailable",
  "inaccessible",
  "failed",
  "failure"
] as const;

const CONNECTOR_HEALTH_CAPABILITY_TERMS = [
  "inspection",
  "inspected",
  "review",
  "reviewed",
  "reauthorize",
  "refresh",
  "permission",
  "access"
] as const;

const URL_PATTERN = /https?:\/\/[^\s)<>"\]]+/gi;
const BRACKETED_URL_PATTERN = /\[https?:\/\/[^\s<>"\]]+/gi;
const STANDARD_MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi;
const LOOSE_MARKDOWN_LINK_PATTERN = /(^|[\s(>·,:;-])([^\]\n]{1,80})]\((https?:\/\/[^)\s]+)\)/gi;
const TRAILING_DISPLAY_LINK_PATTERN =
  /\s*(?:[·|,:;-]\s*)?\b(?:open|view|source|link)\b(?=\s*$)/gi;
const EDGE_SEPARATOR_PATTERN = /^[\s·|,:;-]+|[\s·|,:;-]+$/g;
const DUPLICATE_SEPARATOR_PATTERN = /\s*[·|,:;-]\s*(?=[·|,:;-])/g;

function normalizeSignalText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesAnyTerm(value: string, terms: readonly string[]) {
  return terms.some((term) => value.includes(term));
}

export function stripMarkdownLinks(value: string) {
  return value
    .replace(STANDARD_MARKDOWN_LINK_PATTERN, "$1")
    .replace(LOOSE_MARKDOWN_LINK_PATTERN, (_match, prefix: string, label: string) => `${prefix}${label}`);
}

export function sanitizeDisplayText(value: string) {
  return stripMarkdownLinks(value)
    .replace(BRACKETED_URL_PATTERN, "")
    .replace(URL_PATTERN, "")
    .replace(TRAILING_DISPLAY_LINK_PATTERN, "")
    .replace(DUPLICATE_SEPARATOR_PATTERN, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(EDGE_SEPARATOR_PATTERN, "")
    .trim();
}

export function getDisplaySourceHref(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const candidate = value.match(URL_PATTERN)?.[0];
  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getAgentSignalBriefIntroDescription(
  source: AgentProducedMicrosoft365SignalEnvelopeSource
) {
  if (source === "local") {
    return "This page renders ignored local Agent JSON produced for the handoff. It does not add live Microsoft access, connector reuse, or app-owned Outlook runtime behavior.";
  }

  return "This page renders the sanitized fixture fallback. It does not add live Microsoft access, connector reuse, or app-owned Outlook runtime behavior.";
}

export function getQuietItemsFallbackDetail() {
  return "This payload currently resolves into a foreground brief without additional quiet items.";
}

export function getConnectorHealthEmptyStateDetail() {
  return "No connector availability, permission, or inspection issues surfaced in this payload.";
}

export function getEmptySourceGroupDetail(sourceHeading: string) {
  return `No ${sourceHeading} signals were included in this payload.`;
}

export function isConnectorHealthSignal(signal: ChiefOfStaffSignal) {
  if (signal.signalType !== "status") {
    return false;
  }

  const normalizedSourceLabel = normalizeSignalText(signal.sourceLabel);
  const normalizedContextFields = [
    signal.title,
    signal.summary,
    signal.actionRequest
  ].map(normalizeSignalText);

  if (
    normalizedContextFields.some((field) =>
      includesAnyTerm(field, CONNECTOR_HEALTH_DIRECT_PHRASES)
    )
  ) {
    return true;
  }

  for (const field of normalizedContextFields) {
    const hasConnectorReference = field.includes("connector");
    const hasIssueTerm = includesAnyTerm(field, CONNECTOR_HEALTH_ISSUE_TERMS);
    const hasCapabilityTerm = includesAnyTerm(field, CONNECTOR_HEALTH_CAPABILITY_TERMS);

    if (hasConnectorReference && (hasIssueTerm || hasCapabilityTerm)) {
      return true;
    }

    if (hasIssueTerm && hasCapabilityTerm) {
      return true;
    }
  }

  if (!normalizedSourceLabel.includes("connector")) {
    return false;
  }

  return normalizedContextFields.some((field) =>
    includesAnyTerm(field, CONNECTOR_HEALTH_SOURCE_LINKED_ISSUE_TERMS)
  );
}
