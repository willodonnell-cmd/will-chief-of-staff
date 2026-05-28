import type { ChiefOfStaffSignal } from "./chief-of-staff-signal";
import type { AgentProducedMicrosoft365SignalEnvelope } from "./microsoft-signal-intake";

export type PrototypeDailyBriefInput = {
  brief: {
    slug: "today";
    highFocusTitle: string;
    highFocusSummary: string;
    highFocusOwner: string;
    highFocusTiming: string;
    highFocusDecision: string;
    quietPanelEyebrow: string;
    quietPanelTitle: string;
  };
  glanceItems: Array<{
    label: string;
    value: string;
    tone: "default" | "quiet" | "protected";
  }>;
  quietItems: Array<{
    label: string;
    detail: string;
  }>;
  supportNotes: Array<{
    eyebrow: string;
    title: string;
    body: string;
  }>;
  sourceSignals: ChiefOfStaffSignal[];
};

const ATTENTION_SCORE: Record<ChiefOfStaffSignal["attention"], number> = {
  high: 3,
  medium: 2,
  low: 1
};

function toDisplayDate(isoValue: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(isoValue));
}

function compareSignals(a: ChiefOfStaffSignal, b: ChiefOfStaffSignal) {
  const attentionDelta = ATTENTION_SCORE[b.attention] - ATTENTION_SCORE[a.attention];
  if (attentionDelta !== 0) {
    return attentionDelta;
  }

  if (a.dueAt && b.dueAt) {
    return Date.parse(a.dueAt) - Date.parse(b.dueAt);
  }

  if (a.dueAt) {
    return -1;
  }

  if (b.dueAt) {
    return 1;
  }

  return Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
}

function chooseHighFocus(signals: ChiefOfStaffSignal[]) {
  const sorted = [...signals].sort(compareSignals);
  return sorted[0] ?? null;
}

function formatHighFocusTiming(signal: ChiefOfStaffSignal) {
  if (signal.dueAt) {
    return `Action window: ${toDisplayDate(signal.dueAt)}`;
  }

  return `Last surfaced ${toDisplayDate(signal.occurredAt)}`;
}

function formatHighFocusDecision(signal: ChiefOfStaffSignal) {
  if (signal.actionRequest) {
    return signal.actionRequest;
  }

  switch (signal.signalType) {
    case "decision":
      return "Make the decision and close the loop.";
    case "follow_up":
      return "Respond or delegate the follow-up.";
    case "meeting":
      return "Confirm the meeting outcome and next step.";
    case "status":
    default:
      return "Review the update and decide whether it needs attention.";
  }
}

function summarizeQuietItem(signal: ChiefOfStaffSignal) {
  const detailParts = [`${signal.sourceLabel} · ${toDisplayDate(signal.occurredAt)}`];

  if (signal.actionRequest) {
    detailParts.push(signal.actionRequest);
  } else {
    detailParts.push(signal.summary);
  }

  return detailParts.join(" · ");
}

export function adaptMicrosoft365SignalsToPrototypeDailyBrief(
  envelope: AgentProducedMicrosoft365SignalEnvelope
): PrototypeDailyBriefInput {
  const highFocus = chooseHighFocus(envelope.signals);
  const decisionCount = envelope.signals.filter(
    (signal) => signal.attention === "high" || signal.signalType === "decision"
  ).length;
  const quietCount = envelope.signals.filter((signal) => signal.attention === "low").length;
  const protectedCount = envelope.signals.filter((signal) => signal.protectedContext).length;
  const quietItems = envelope.signals
    .filter((signal) => signal.id !== highFocus?.id)
    .sort(compareSignals)
    .slice(0, 3)
    .map((signal) => ({
      label: signal.title,
      detail: summarizeQuietItem(signal)
    }));
  const sourceLabels = [...new Set(envelope.signals.map((signal) => signal.sourceLabel))];

  return {
    brief: {
      slug: "today",
      highFocusTitle: highFocus?.title ?? "No foreground signal is active right now.",
      highFocusSummary:
        highFocus?.summary ??
        "The Microsoft signal intake returned structured output, but nothing currently requires foreground attention.",
      highFocusOwner: highFocus?.owner ?? "Chief of staff",
      highFocusTiming: highFocus ? formatHighFocusTiming(highFocus) : "No active deadline",
      highFocusDecision: highFocus ? formatHighFocusDecision(highFocus) : "No attention needed now.",
      quietPanelEyebrow: "Microsoft 365 background",
      quietPanelTitle:
        quietItems.length > 0
          ? "Signals that can stay in the background for now."
          : "No additional background signals were returned."
    },
    glanceItems: [
      {
        label: "Needs decision",
        value: String(decisionCount),
        tone: "default"
      },
      {
        label: "Quietly on track",
        value: String(quietCount),
        tone: "quiet"
      },
      {
        label: "Protected",
        value: protectedCount > 0 ? String(protectedCount) : "—",
        tone: "protected"
      }
    ],
    quietItems,
    supportNotes: [
      {
        eyebrow: "Signal intake",
        title: `${envelope.signals.length} structured Microsoft signals ready`,
        body: `ChatGPT Agent produced structured output from ${sourceLabels.join(", ")} at ${toDisplayDate(envelope.producedAt)}. The app can consume this brief input and does not reuse connector tokens.`
      }
    ],
    sourceSignals: envelope.signals
  };
}
