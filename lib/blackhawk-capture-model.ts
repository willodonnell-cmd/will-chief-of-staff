import type { ExecutiveWorkType } from "@/lib/executive-work";

export type CapturePattern = "note" | "task";
export type CapturePrivacy = "open" | "protected" | "hybrid";
export type TaskPriority = "high" | "medium" | "low";
export type TaskCategoryStatus = "active" | "inactive";
export const EXECUTIVE_CAPTURE_TYPES = [
  "note",
  "task",
  "decision",
  "opportunity",
  "waiting_on",
  "meeting_note"
] as const;

export type ExecutiveCaptureType = (typeof EXECUTIVE_CAPTURE_TYPES)[number];

export const EXECUTIVE_CAPTURE_TYPE_LABELS: Record<ExecutiveCaptureType, string> = {
  note: "Note",
  task: "Task",
  decision: "Decision",
  opportunity: "Opportunity",
  waiting_on: "Waiting On",
  meeting_note: "Meeting Note"
};

export type TaskCategoryOption = {
  id: string;
  slug: string;
  name: string;
  status: TaskCategoryStatus;
  sortOrder: number;
  isFallback: boolean;
};

export type TaskCaptureSettings = {
  expandNextStepByDefault: boolean;
  expandDesiredOutcomeByDefault: boolean;
};

export type InitiativeOption = {
  id: string;
  title: string;
  status: string;
};

export type ExecutiveCaptureMetadata = {
  captureType: ExecutiveCaptureType;
  companyOrCounterparty?: string | null;
  strategicRelevance?: string | null;
  owner?: string | null;
  status?: string | null;
  nextAction?: string | null;
  relatedCompany?: string | null;
  relatedOpportunity?: string | null;
  relatedPerson?: string | null;
  decisionQuestion?: string | null;
  recommendation?: string | null;
  optionsTradeoffs?: string | null;
  risks?: string | null;
  deadline?: string | null;
  peopleInvolved?: string | null;
  waitingOn?: string | null;
  expectedOutcome?: string | null;
  delegatedTo?: string | null;
  lastTouch?: string | null;
  followUpAt?: string | null;
  meetingTitle?: string | null;
  meetingAt?: string | null;
  attendees?: string | null;
  decisions?: string | null;
  followUps?: string | null;
  waitingOnItems?: string | null;
};

export type NoteFields = {
  title: string;
  body: string;
  linkedInitiativeId: string | null;
};

export type TaskFields = {
  description: string;
  nextStep: string;
  desiredOutcome: string;
  priority: TaskPriority;
  categoryId: string | null;
  linkedInitiativeId: string | null;
  dueAt?: string | null;
};

type BaseCaptureInput = {
  sourcePath: string | null;
  privacy: CapturePrivacy;
  privateContext: string;
  dueAt?: string | null;
  executiveWorkType?: ExecutiveWorkType | null;
  executiveMetadata?: ExecutiveCaptureMetadata | null;
};

export type BlackhawkCaptureInput =
  | (BaseCaptureInput & {
      pattern: "note";
      note: NoteFields;
    })
  | (BaseCaptureInput & {
      pattern: "task";
      task: TaskFields;
    });

export type TaskComposerPrefill = {
  description: string;
  nextStep: string;
  desiredOutcome: string;
  priority: TaskPriority | null;
  categoryName: string | null;
  linkedInitiativeTitle: string | null;
};

export function isTaskPriority(value: string | null | undefined): value is TaskPriority {
  return value === "high" || value === "medium" || value === "low";
}

export function isExecutiveCaptureType(value: string | null | undefined): value is ExecutiveCaptureType {
  return typeof value === "string" && EXECUTIVE_CAPTURE_TYPES.includes(value as ExecutiveCaptureType);
}

export function getExecutiveCaptureTypeLabel(value: ExecutiveCaptureType) {
  return EXECUTIVE_CAPTURE_TYPE_LABELS[value];
}

export function capturePatternForExecutiveType(value: ExecutiveCaptureType): CapturePattern {
  switch (value) {
    case "task":
    case "waiting_on":
      return "task";
    case "note":
    case "decision":
    case "opportunity":
    case "meeting_note":
    default:
      return "note";
  }
}

export function executiveWorkTypeForCaptureType(value: ExecutiveCaptureType): ExecutiveWorkType | null {
  switch (value) {
    case "decision":
      return "decision";
    case "opportunity":
      return "opportunity";
    case "waiting_on":
      return "delegation";
    case "meeting_note":
      return "meeting";
    case "note":
    case "task":
    default:
      return null;
  }
}

export function formatTaskPriorityLabel(priority: TaskPriority) {
  return `${priority.slice(0, 1).toUpperCase()}${priority.slice(1)}`;
}

export function computeNoteDisplayTitle(title: string, body: string) {
  const trimmedTitle = title.trim();
  if (trimmedTitle) {
    return trimmedTitle;
  }

  const firstLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine ?? "Untitled note";
}

export function computeTaskDisplayTitle(description: string) {
  const collapsed = description.replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return "Untitled task";
  }

  if (collapsed.length <= 120) {
    return collapsed;
  }

  return `${collapsed.slice(0, 117).trimEnd()}...`;
}

export function buildNoteWorkingContent(note: NoteFields) {
  const sections = [note.title.trim() ? `Title:\n${note.title.trim()}` : null, note.body.trim()].filter(
    (value): value is string => Boolean(value)
  );

  return sections.join("\n\n").trim();
}

export function buildTaskWorkingContent(task: TaskFields, extras?: { categoryName?: string | null; initiativeTitle?: string | null }) {
  const sections = [
    task.description.trim() ? `Task Description:\n${task.description.trim()}` : null,
    task.nextStep.trim() ? `Next Step:\n${task.nextStep.trim()}` : null,
    task.desiredOutcome.trim() ? `Desired Outcome:\n${task.desiredOutcome.trim()}` : null,
    `Priority: ${formatTaskPriorityLabel(task.priority)}`,
    extras?.categoryName ? `Category: ${extras.categoryName}` : null,
    extras?.initiativeTitle ? `Linked Initiative: ${extras.initiativeTitle}` : null,
    task.dueAt?.trim() ? `Due: ${task.dueAt.trim()}` : null
  ].filter((value): value is string => Boolean(value));

  return sections.join("\n\n").trim();
}

export function findCategoryByName(categories: TaskCategoryOption[], name: string | null | undefined) {
  const normalized = name?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    categories.find((category) => category.name.trim().toLowerCase() === normalized) ??
    categories.find((category) => category.slug.trim().toLowerCase() === normalized) ??
    null
  );
}

export function findInitiativeByTitle(initiatives: InitiativeOption[], title: string | null | undefined) {
  const normalized = title?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return initiatives.find((initiative) => initiative.title.trim().toLowerCase() === normalized) ?? null;
}
