import type { StructuredExecutiveBrief, StructuredExecutiveBriefItem } from "@/lib/brief/executive-brief-snapshots";

export const BRIEF_SOURCE_LANES = [
  { id: "email", label: "Email" },
  { id: "calendar_meetings", label: "Calendar / Meetings" },
  { id: "teams", label: "Teams" }
] as const;

export type BriefSourceLaneId = (typeof BRIEF_SOURCE_LANES)[number]["id"];
export type StructuredBriefSectionKey =
  | "topMoves"
  | "decisionsNeeded"
  | "meetingPrep"
  | "carryForward"
  | "taskCandidates";

export type StructuredBriefLaneEntry = {
  id: string;
  item: StructuredExecutiveBriefItem;
  section: StructuredBriefSectionKey;
  sectionLabel: string;
  taskCandidate: boolean;
};

export type StructuredBriefSourceLane = {
  id: BriefSourceLaneId;
  label: string;
  entries: StructuredBriefLaneEntry[];
};

const SECTION_LABELS: Record<StructuredBriefSectionKey, string> = {
  topMoves: "Executive move",
  decisionsNeeded: "Decision",
  meetingPrep: "Meeting prep",
  carryForward: "Carry-forward",
  taskCandidates: "Task candidate"
};

function compactText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function sourceText(item: StructuredExecutiveBriefItem) {
  return [item.source, item.title, item.summary, item.recommendedAction].map(compactText).join(" ").toLowerCase();
}

export function resolveBriefSourceLaneId(input: {
  item: StructuredExecutiveBriefItem;
  section: StructuredBriefSectionKey;
}): BriefSourceLaneId {
  const text = sourceText(input.item);

  if (/\b(teams|chat|channel|dm|direct message|mention)\b/.test(text)) {
    return "teams";
  }

  if (
    input.section === "meetingPrep" ||
    /\b(calendar|meeting|meetings|prep|call|sync|event|invite|zoom)\b/.test(text)
  ) {
    return "calendar_meetings";
  }

  return "email";
}

function laneEntry(
  item: StructuredExecutiveBriefItem,
  section: StructuredBriefSectionKey,
  index: number
): StructuredBriefLaneEntry | null {
  if (!compactText(item.title)) {
    return null;
  }

  return {
    id: `${section}-${item.id || index + 1}`,
    item,
    section,
    sectionLabel: SECTION_LABELS[section],
    taskCandidate: section === "taskCandidates"
  };
}

export function buildStructuredBriefSourceLanes(input: {
  structuredBrief: StructuredExecutiveBrief;
  taskCandidates?: StructuredExecutiveBriefItem[];
}): StructuredBriefSourceLane[] {
  const entries = [
    ...input.structuredBrief.topMoves.map((item, index) => laneEntry(item, "topMoves", index)),
    ...input.structuredBrief.decisionsNeeded.map((item, index) => laneEntry(item, "decisionsNeeded", index)),
    ...input.structuredBrief.meetingPrep.map((item, index) => laneEntry(item, "meetingPrep", index)),
    ...input.structuredBrief.carryForward.map((item, index) => laneEntry(item, "carryForward", index)),
    ...(input.taskCandidates ?? input.structuredBrief.taskCandidates).map((item, index) =>
      laneEntry(item, "taskCandidates", index)
    )
  ].filter((entry): entry is StructuredBriefLaneEntry => Boolean(entry));

  return BRIEF_SOURCE_LANES.map((lane) => ({
    ...lane,
    entries: entries.filter((entry) => resolveBriefSourceLaneId(entry) === lane.id)
  })).filter((lane) => lane.entries.length > 0);
}
