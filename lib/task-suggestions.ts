import type {
  InitiativeOption,
  NoteFields,
  TaskCategoryOption,
  TaskComposerPrefill
} from "@/lib/blackhawk-capture-model";
import { findCategoryByName, findInitiativeByTitle } from "@/lib/blackhawk-capture-model";
import type { PriorityInboxItem } from "@/lib/priority-inbox";

function firstSentence(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(/^[^.!?]+[.!?]?/);
  return match?.[0]?.trim() ?? trimmed;
}

function detectCategoryNameFromText(value: string) {
  const lowered = value.toLowerCase();

  if (/\b(calendar|meeting|schedule|reschedule|invite)\b/.test(lowered)) {
    return "Calendar";
  }

  if (/\b(waiting|follow up|follow-up|reply|respond|hear back|approval)\b/.test(lowered)) {
    return "Waiting For";
  }

  if (/\bagenda|prep\b/.test(lowered)) {
    return "Agenda";
  }

  if (/\b(personal|home|family|doctor|kids|travel)\b/.test(lowered)) {
    return "Personal";
  }

  if (/\bwith\b|\bfrom\b|\bask\b/.test(lowered)) {
    return "Person";
  }

  return null;
}

function detectPriorityFromText(value: string) {
  const lowered = value.toLowerCase();

  if (/\b(asap|urgent|today|immediately|by tomorrow|tonight)\b/.test(lowered)) {
    return "high" as const;
  }

  if (/\b(whenever|someday|low priority|low-priority)\b/.test(lowered)) {
    return "low" as const;
  }

  return "medium" as const;
}

export function buildNoteToTaskPrefill(note: NoteFields): TaskComposerPrefill {
  const noteBody = note.body.trim();
  const noteTitle = note.title.trim();
  const description = noteBody || noteTitle;
  const nextStep = noteTitle && noteBody ? noteTitle : "";

  return {
    description,
    nextStep,
    desiredOutcome: "",
    priority: detectPriorityFromText(`${noteTitle}\n${noteBody}`),
    categoryName: detectCategoryNameFromText(`${noteTitle}\n${noteBody}`),
    linkedInitiativeTitle: null
  };
}

export function buildPriorityInboxTaskPrefill(item: PriorityInboxItem): TaskComposerPrefill {
  const description = item.taskPrefill?.description?.trim() || item.primaryLine.trim();
  const nextStep = item.taskPrefill?.nextStep?.trim() || "";
  const desiredOutcome = item.taskPrefill?.desiredOutcome?.trim() || "";
  const combined = [item.primaryLine, item.summary, nextStep, desiredOutcome].join("\n");

  return {
    description,
    nextStep,
    desiredOutcome,
    priority: item.taskPrefill?.priority ?? (item.visibleState === "high_priority" ? "high" : detectPriorityFromText(combined)),
    categoryName: item.taskPrefill?.categoryName ?? detectCategoryNameFromText(combined),
    linkedInitiativeTitle: item.taskPrefill?.linkedInitiativeTitle ?? firstSentence(item.threadTitle)
  };
}

export function resolvePrefillCategoryId(categories: TaskCategoryOption[], prefill: TaskComposerPrefill) {
  return findCategoryByName(categories, prefill.categoryName)?.id ?? null;
}

export function resolvePrefillInitiativeId(initiatives: InitiativeOption[], prefill: TaskComposerPrefill) {
  return findInitiativeByTitle(initiatives, prefill.linkedInitiativeTitle)?.id ?? null;
}
