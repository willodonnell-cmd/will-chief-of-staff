import type {
  CapturePrivacy,
  CapturePattern,
  NoteFields,
  TaskFields,
  TaskPriority
} from "@/lib/blackhawk-capture-model";
import type { ChiefOfStaffSignal, ChiefOfStaffSignalAttention, ChiefOfStaffSignalSource } from "@/lib/chief-of-staff-signal";
import { getDisplaySourceHref, sanitizeDisplayText } from "@/lib/agent-signal-brief";

export const SIGNAL_CAPTURE_HANDOFF_STORAGE_PREFIX = "blackhawk.capture-signal-handoff.v1";

export type SignalCaptureContextEntry = {
  label: string;
  value: string;
  href?: string;
};

export type SignalCaptureContext = {
  signalId: string;
  signalTitle: string;
  heading: string;
  entries: SignalCaptureContextEntry[];
};

export type SignalCaptureHandoff = {
  kind: "agent_signal";
  pattern: CapturePattern;
  privacy: CapturePrivacy;
  privateContext: string;
  note: NoteFields;
  task: TaskFields;
  sourceContext: SignalCaptureContext;
};

function formatSignalSource(source: ChiefOfStaffSignalSource) {
  switch (source) {
    case "outlook":
      return "Outlook";
    case "teams":
      return "Teams";
    case "calendar":
      return "Calendar";
  }
}

function formatSignalTimestamp(isoValue: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles"
  }).format(new Date(isoValue));
}

function deriveDesiredOutcome(summary: string) {
  const normalized = sanitizeDisplayText(summary).replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const firstSentence = normalized.match(/^(.{1,180}?[.!?])(?:\s|$)/)?.[1]?.trim() ?? null;
  if (firstSentence) {
    return firstSentence;
  }

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177).trimEnd()}...`;
}

function buildSignalContext(signal: ChiefOfStaffSignal): SignalCaptureContext {
  const sourceHref = getDisplaySourceHref(signal.sourceUrl);
  const entries: SignalCaptureContextEntry[] = [
    {
      label: "Source",
      value: formatSignalSource(signal.source)
    },
    {
      label: "Label",
      value: sanitizeDisplayText(signal.sourceLabel) || "Signal source"
    },
    {
      label: "Occurred",
      value: formatSignalTimestamp(signal.occurredAt)
    }
  ];

  if (sourceHref) {
    entries.push({
      label: "Source URL",
      value: sourceHref,
      href: sourceHref
    });
  }

  return {
    signalId: signal.id,
    signalTitle: sanitizeDisplayText(signal.title) || signal.title,
    heading: "Signal context",
    entries
  };
}

function buildNoteBody(signal: ChiefOfStaffSignal, sourceContext: SignalCaptureContext) {
  const sections = [
    sanitizeDisplayText(signal.summary),
    signal.actionRequest
      ? `Action request:\n${sanitizeDisplayText(signal.actionRequest)}`
      : null,
    [
      "Source context:",
      ...sourceContext.entries.map((entry) => `${entry.label}: ${entry.value}`)
    ].join("\n")
  ].filter((value): value is string => Boolean(value));

  return sections.join("\n\n");
}

export function mapSignalAttentionToTaskPriority(
  attention: ChiefOfStaffSignalAttention
): TaskPriority {
  switch (attention) {
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
  }
}

export function buildTaskCaptureDraftFromSignal(signal: ChiefOfStaffSignal): SignalCaptureHandoff {
  const sourceContext = buildSignalContext(signal);

  return {
    kind: "agent_signal",
    pattern: "task",
    privacy: "open",
    privateContext: "",
    note: {
      title: "",
      body: "",
      linkedInitiativeId: null
    },
    task: {
      description: sanitizeDisplayText(signal.title) || signal.title,
      nextStep: sanitizeDisplayText(signal.actionRequest ?? ""),
      desiredOutcome: deriveDesiredOutcome(signal.summary),
      priority: mapSignalAttentionToTaskPriority(signal.attention),
      categoryId: null,
      linkedInitiativeId: null
    },
    sourceContext
  };
}

export function buildNoteCaptureDraftFromSignal(signal: ChiefOfStaffSignal): SignalCaptureHandoff {
  const sourceContext = buildSignalContext(signal);
  const title = sanitizeDisplayText(signal.title) || signal.title;

  return {
    kind: "agent_signal",
    pattern: "note",
    privacy: "open",
    privateContext: "",
    note: {
      title,
      body: buildNoteBody(signal, sourceContext),
      linkedInitiativeId: null
    },
    task: {
      description: title,
      nextStep: sanitizeDisplayText(signal.actionRequest ?? ""),
      desiredOutcome: deriveDesiredOutcome(signal.summary),
      priority: mapSignalAttentionToTaskPriority(signal.attention),
      categoryId: null,
      linkedInitiativeId: null
    },
    sourceContext
  };
}

export function isSignalCaptureHandoff(value: unknown): value is SignalCaptureHandoff {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const handoff = value as Partial<SignalCaptureHandoff>;
  return (
    handoff.kind === "agent_signal" &&
    (handoff.pattern === "note" || handoff.pattern === "task") &&
    handoff.privacy === "open" &&
    typeof handoff.privateContext === "string" &&
    typeof handoff.note?.title === "string" &&
    typeof handoff.note?.body === "string" &&
    typeof handoff.task?.description === "string" &&
    typeof handoff.task?.nextStep === "string" &&
    typeof handoff.task?.desiredOutcome === "string" &&
    (handoff.task?.priority === "high" ||
      handoff.task?.priority === "medium" ||
      handoff.task?.priority === "low") &&
    typeof handoff.sourceContext?.signalId === "string" &&
    typeof handoff.sourceContext?.signalTitle === "string" &&
    Array.isArray(handoff.sourceContext?.entries)
  );
}
