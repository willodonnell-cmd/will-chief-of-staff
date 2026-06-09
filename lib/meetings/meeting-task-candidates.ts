import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildTaskWorkingContent,
  computeTaskDisplayTitle,
  type ExecutiveCaptureMetadata,
  type TaskPriority
} from "@/lib/blackhawk-capture-model";
import {
  normalizeMeetingTaskCandidates,
  updateMeetingTaskCandidateLinks,
  type JsonValue,
  type MeetingRecord,
  type MeetingRecordsRepository,
  type MeetingTaskCandidate
} from "@/lib/meetings/meeting-records";
import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";

type TaskCategoryRow = {
  id: string;
  name: string;
  status: string;
  is_fallback: boolean;
};

type ExistingTaskRow = {
  id: string;
  title: string | null;
  task_description: string | null;
  capture_metadata: Record<string, unknown> | null;
};

type MeetingTaskCaptureInsert = {
  user_id: string;
  source_path: string;
  pattern: "task";
  privacy: "open";
  summary: string;
  follow_up: string | null;
  private_context: string;
  type: "task";
  title: string;
  task_description: string;
  task_next_step: string | null;
  task_desired_outcome: string | null;
  task_category_id: string;
  linked_initiative_id: null;
  origin_type: "capture";
  original_content: string;
  working_content: string;
  last_active_at: string;
  due_at: string | null;
  priority: TaskPriority;
  executive_work_type: "meeting";
  capture_metadata: ExecutiveCaptureMetadata & Record<string, JsonValue>;
  save_state: "saved";
  save_state_detail: null;
};

export type MeetingTaskCandidateLinkResult =
  | {
      ok: true;
      status: "created" | "already_exists";
      captureId: string;
      href: string;
      record: MeetingRecord | null;
    }
  | {
      ok: false;
      error: "meeting-not-found" | "candidate-not-found" | "category-missing" | "task-create-failed" | "storage";
    };

function compactText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function taskHref(captureId: string) {
  return `/library/${captureId}?from=%2Flibrary%2Ftasks`;
}

function normalizedTaskText(value: string | null | undefined) {
  return compactText(value).toLowerCase();
}

export function stableMeetingTaskDedupeKey(candidate: MeetingTaskCandidate) {
  return compactText(candidate.dedupeKey) || `${candidate.meetingRecordId}:${candidate.taskType}:${normalizedTaskText(candidate.title)}`;
}

export function meetingTaskCandidateToTaskFields(candidate: MeetingTaskCandidate) {
  const description = compactText(candidate.title);
  const detail = compactText(candidate.description);
  const owner = compactText(candidate.owner);
  const priority = candidate.priority ?? "medium";
  const nextStep = detail || description;
  const desiredOutcome = owner ? `Owner: ${owner}` : "";

  return {
    description,
    nextStep,
    desiredOutcome,
    priority,
    dueAt: compactText(candidate.dueDate) || null
  };
}

function sourceRefsText(sourceRefs: JsonValue[]) {
  if (sourceRefs.length === 0) {
    return null;
  }

  return `Source refs:\n${JSON.stringify(sourceRefs, null, 2)}`;
}

export function buildMeetingTaskCaptureInsert(input: {
  userId: string;
  meetingRecord: MeetingRecord;
  candidate: MeetingTaskCandidate;
  category: TaskCategoryRow;
  now: string;
}): MeetingTaskCaptureInsert {
  const taskFields = meetingTaskCandidateToTaskFields(input.candidate);
  const dedupeKey = stableMeetingTaskDedupeKey(input.candidate);
  const metadata = {
    captureType: "task",
    meetingRecordId: input.meetingRecord.id,
    meetingCalendarEventId: input.meetingRecord.calendarEventId,
    meetingCalendarSourceSystemId: input.meetingRecord.calendarSourceSystemId,
    meetingTitle: input.meetingRecord.title,
    meetingAt: input.meetingRecord.startAt,
    meetingTaskType: input.candidate.taskType,
    meetingTaskCandidateDedupeKey: dedupeKey,
    meetingTaskCandidateSourceRefs: input.candidate.sourceRefs,
    owner: input.candidate.owner,
    relatedCompany: input.meetingRecord.relatedCompanyNames[0] ?? null,
    relatedPerson: input.meetingRecord.relatedPeopleNames[0] ?? null
  } satisfies ExecutiveCaptureMetadata & Record<string, JsonValue>;
  const workingContent = buildTaskWorkingContent(
    {
      description: taskFields.description,
      nextStep: taskFields.nextStep,
      desiredOutcome: taskFields.desiredOutcome,
      priority: taskFields.priority,
      categoryId: input.category.id,
      linkedInitiativeId: null,
      dueAt: taskFields.dueAt
    },
    {
      categoryName: input.category.name,
      initiativeTitle: null
    }
  );
  const sourceSection = sourceRefsText(input.candidate.sourceRefs);
  const originalContent = [
    workingContent,
    `MeetingRecord: ${input.meetingRecord.id}`,
    `Meeting: ${input.meetingRecord.title}`,
    `Candidate dedupe key: ${dedupeKey}`,
    sourceSection
  ]
    .filter((section): section is string => Boolean(section))
    .join("\n\n");

  return {
    user_id: input.userId,
    source_path: "/meetings",
    pattern: "task",
    privacy: "open",
    summary: taskFields.description,
    follow_up: [taskFields.nextStep, taskFields.desiredOutcome].filter(Boolean).join("\n\n") || null,
    private_context: `MeetingRecord ${input.meetingRecord.id}; candidate ${dedupeKey}`,
    type: "task",
    title: computeTaskDisplayTitle(taskFields.description),
    task_description: taskFields.description,
    task_next_step: taskFields.nextStep || null,
    task_desired_outcome: taskFields.desiredOutcome || null,
    task_category_id: input.category.id,
    linked_initiative_id: null,
    origin_type: "capture",
    original_content: originalContent,
    working_content: workingContent,
    last_active_at: input.now,
    due_at: taskFields.dueAt,
    priority: taskFields.priority,
    executive_work_type: "meeting",
    capture_metadata: metadata,
    save_state: "saved",
    save_state_detail: null
  };
}

export function findExistingTaskForMeetingCandidate(tasks: ExistingTaskRow[], candidate: MeetingTaskCandidate) {
  const dedupeKey = stableMeetingTaskDedupeKey(candidate);
  const title = normalizedTaskText(candidate.title);

  return (
    tasks.find((task) => task.capture_metadata?.meetingTaskCandidateDedupeKey === dedupeKey) ??
    tasks.find((task) => {
      const metadata = task.capture_metadata;
      return (
        metadata?.meetingRecordId === candidate.meetingRecordId &&
        normalizedTaskText(task.task_description ?? task.title) === title
      );
    }) ??
    null
  );
}

async function selectFallbackTaskCategory(client: SupabaseClient, userId: string) {
  const response = await withSupabaseTimeout(
    client
      .from("task_categories")
      .select("id, name, status, is_fallback")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .returns<TaskCategoryRow[]>()
  );
  const activeCategories = (response.data ?? []).filter((category) => category.status === "active");
  return activeCategories.find((category) => category.is_fallback) ?? activeCategories[0] ?? null;
}

async function listCandidateDedupeTasks(client: SupabaseClient, input: { userId: string; candidate: MeetingTaskCandidate }) {
  const response = await withSupabaseTimeout(
    client
      .from("captures")
      .select("id, title, task_description, capture_metadata")
      .eq("user_id", input.userId)
      .eq("type", "task")
      .is("deleted_at", null)
      .returns<ExistingTaskRow[]>()
  );
  return findExistingTaskForMeetingCandidate(response.data ?? [], input.candidate);
}

export async function createTaskFromMeetingTaskCandidate(input: {
  client: SupabaseClient;
  repository: MeetingRecordsRepository;
  userId: string;
  meetingRecordId: string;
  dedupeKey: string;
  now?: string;
}): Promise<MeetingTaskCandidateLinkResult> {
  const meetingRecord = await input.repository.findById({
    userId: input.userId,
    meetingRecordId: input.meetingRecordId
  });
  if (!meetingRecord) {
    return { ok: false, error: "meeting-not-found" };
  }

  const candidate = normalizeMeetingTaskCandidates(meetingRecord.taskCandidates, meetingRecord.id).find(
    (entry) => stableMeetingTaskDedupeKey(entry) === compactText(input.dedupeKey)
  );
  if (!candidate) {
    return { ok: false, error: "candidate-not-found" };
  }

  const existing = await listCandidateDedupeTasks(input.client, {
    userId: input.userId,
    candidate
  });
  if (existing) {
    const updated = await updateMeetingTaskCandidateLinks(input.repository, {
      userId: input.userId,
      meetingRecord,
      dedupeKey: candidate.dedupeKey,
      linkedTaskId: existing.id,
      linkedTaskHref: taskHref(existing.id),
      status: "already_exists",
      linkedAt: input.now
    });
    return {
      ok: true,
      status: "already_exists",
      captureId: existing.id,
      href: taskHref(existing.id),
      record: updated
    };
  }

  const category = await selectFallbackTaskCategory(input.client, input.userId);
  if (!category) {
    return { ok: false, error: "category-missing" };
  }

  const now = input.now ?? new Date().toISOString();
  const insertPayload = buildMeetingTaskCaptureInsert({
    userId: input.userId,
    meetingRecord,
    candidate,
    category,
    now
  });
  const insert = await withSupabaseTimeout(
    input.client.from("captures").insert(insertPayload).select("id, title").single<{ id: string; title: string }>()
  );
  if (insert.error || !insert.data) {
    return { ok: false, error: "task-create-failed" };
  }

  const updated = await updateMeetingTaskCandidateLinks(input.repository, {
    userId: input.userId,
    meetingRecord,
    dedupeKey: candidate.dedupeKey,
    linkedTaskId: insert.data.id,
    linkedTaskHref: taskHref(insert.data.id),
    status: "created",
    linkedAt: now
  });

  return {
    ok: true,
    status: "created",
    captureId: insert.data.id,
    href: taskHref(insert.data.id),
    record: updated
  };
}
