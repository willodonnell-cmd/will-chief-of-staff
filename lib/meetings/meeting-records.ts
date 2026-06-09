import type { SupabaseClient } from "@supabase/supabase-js";

import { withSupabaseTimeout } from "@/lib/supabase/request-timeout";

export const TASKROBIN_OBSIDIAN_EMAIL = "wodonnell@taskrobin.io";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = Record<string, JsonValue>;

export const MEETING_RESEARCH_STATUSES = ["not_researched", "researching", "researched", "failed"] as const;
export const MEETING_TRANSCRIPT_STATUSES = ["none", "pending", "attached", "processing", "summarized", "failed"] as const;
export const MEETING_POST_MEETING_STATUSES = ["not_started", "pending", "summarized", "failed"] as const;
export const MEETING_OBSIDIAN_EXPORT_STATUSES = ["not_exported", "sending", "sent_to_taskrobin", "failed"] as const;
export const MEETING_INTERNAL_EXTERNAL_CLASSIFICATIONS = ["internal", "external", "mixed", "unknown"] as const;
export const MEETING_PRIORITIES = ["low", "normal", "high", "critical"] as const;

export type MeetingResearchStatus = (typeof MEETING_RESEARCH_STATUSES)[number];
export type MeetingTranscriptStatus = (typeof MEETING_TRANSCRIPT_STATUSES)[number];
export type MeetingPostMeetingStatus = (typeof MEETING_POST_MEETING_STATUSES)[number];
export type MeetingObsidianExportStatus = (typeof MEETING_OBSIDIAN_EXPORT_STATUSES)[number];
export type MeetingInternalExternalClassification = (typeof MEETING_INTERNAL_EXTERNAL_CLASSIFICATIONS)[number];
export type MeetingPriority = (typeof MEETING_PRIORITIES)[number];

export type SourceCoverage = {
  sourceType: string;
  used: boolean;
  itemCount: number;
  internalOnlyReason: string | null;
};

export type CalendarEventDetails = {
  title: string;
  startAt: string | null;
  endAt: string | null;
  organizer: string | null;
  attendees: JsonValue[];
  locationOrLink: string | null;
  descriptionSummary: string | null;
};

export type RecentRelevantActivityGroup = {
  sourceType: string;
  title: string;
  summary: string;
  sourceRefs: JsonValue[];
};

export type SituationRead = {
  categories: Array<
    | "relationship_momentum"
    | "urgency"
    | "alignment"
    | "friction"
    | "decision_pressure"
    | "commercial_importance"
    | "execution_risk"
    | "strategic_relevance"
  >;
  summary: string;
  confidence: "low" | "medium" | "high";
  evidenceRefs: JsonValue[];
};

export type KeyPriority = {
  title: string;
  reason: string;
  sourceRefs: JsonValue[];
};

export type SuggestedQuestion = {
  question: string;
  reason: string;
  sourceRefs: JsonValue[];
};

export type MeetingTaskType = "prep" | "follow_up" | "decision" | "review" | "delegate" | "schedule" | "monitor";

export type MeetingTaskCandidate = {
  title: string;
  description: string | null;
  owner: string | null;
  priority: "low" | "medium" | "high" | null;
  dueDate: string | null;
  sourceRefs: JsonValue[];
  dedupeKey: string;
  meetingRecordId: string;
  taskType: MeetingTaskType;
};

export type MeetingResearchSummary = {
  meetingRecordId: string;
  generatedAt: string;
  sourceCoverage: SourceCoverage[];
  calendarEventDetails: CalendarEventDetails | null;
  highLevelContext: string | null;
  recentRelevantActivity: RecentRelevantActivityGroup[];
  situationRead: SituationRead | null;
  keyPriorities: KeyPriority[];
  suggestedQuestions: SuggestedQuestion[];
  relevantLinks: JsonValue[];
  taskCandidates: MeetingTaskCandidate[];
};

export type PostMeetingSummary = {
  generatedAt: string;
  sourceTranscriptRefs: JsonValue[];
  summary: string;
  decisions: JsonValue[];
  actionItemCandidates: MeetingTaskCandidate[];
  risksOrOpenIssues: JsonValue[];
  followUpDraftAvailable: boolean;
};

export type MeetingRecord = {
  id: string;
  userId: string;
  calendarEventId: string;
  calendarSourceSystemId: string;
  title: string;
  startAt: string | null;
  endAt: string | null;
  timezone: string;
  organizerName: string | null;
  organizerEmail: string | null;
  attendees: JsonValue[];
  internalExternalClassification: MeetingInternalExternalClassification;
  relatedCompanyNames: string[];
  relatedPeopleNames: string[];
  priority: MeetingPriority;
  priorityReasons: string[];
  researchStatus: MeetingResearchStatus;
  researchRequestedAt: string | null;
  researchCompletedAt: string | null;
  researchSummary: JsonValue | null;
  sourceRefs: JsonValue[];
  transcriptStatus: MeetingTranscriptStatus;
  transcriptRefs: JsonValue[];
  postMeetingStatus: MeetingPostMeetingStatus;
  postMeetingSummary: JsonValue | null;
  taskCandidates: JsonValue[];
  linkedTaskIds: string[];
  obsidianExportStatus: MeetingObsidianExportStatus;
  obsidianExportedAt: string | null;
  obsidianEmailTo: string;
  createdAt: string;
  updatedAt: string;
};

export type MeetingRecordStatusSummary = {
  id: string;
  calendarEventId: string;
  researchStatus: MeetingResearchStatus;
  transcriptStatus: MeetingTranscriptStatus;
  taskCandidateCount: number;
  obsidianExportStatus: MeetingObsidianExportStatus;
};

export type MeetingRecordRow = {
  id: string;
  user_id: string;
  calendar_event_id: string;
  calendar_source_system_id: string;
  title: string;
  start_at: string | null;
  end_at: string | null;
  timezone: string;
  organizer_name: string | null;
  organizer_email: string | null;
  attendees: JsonValue[] | null;
  internal_external_classification: MeetingInternalExternalClassification;
  related_company_names: string[] | null;
  related_people_names: string[] | null;
  priority: MeetingPriority;
  priority_reasons: string[] | null;
  research_status: MeetingResearchStatus;
  research_requested_at: string | null;
  research_completed_at: string | null;
  research_summary: JsonValue | null;
  source_refs: JsonValue[] | null;
  transcript_status: MeetingTranscriptStatus;
  transcript_refs: JsonValue[] | null;
  post_meeting_status: MeetingPostMeetingStatus;
  post_meeting_summary: JsonValue | null;
  task_candidates: JsonValue[] | null;
  linked_task_ids: string[] | null;
  obsidian_export_status: MeetingObsidianExportStatus;
  obsidian_exported_at: string | null;
  obsidian_email_to: string;
  created_at: string;
  updated_at: string;
};

export type MeetingRecordInsertRow = Omit<MeetingRecordRow, "id" | "created_at" | "updated_at">;
export type MeetingRecordUpdateRow = Partial<
  Pick<
    MeetingRecordRow,
    | "research_status"
    | "research_requested_at"
    | "research_completed_at"
    | "research_summary"
    | "source_refs"
    | "transcript_status"
    | "transcript_refs"
    | "post_meeting_status"
    | "post_meeting_summary"
    | "task_candidates"
    | "linked_task_ids"
    | "obsidian_export_status"
    | "obsidian_exported_at"
    | "obsidian_email_to"
  >
>;

export type CalendarEventMeetingRecordInput = {
  userId: string;
  calendarEventId: string;
  calendarSourceSystemId?: string | null;
  title: string;
  startAt?: string | null;
  endAt?: string | null;
  timezone?: string | null;
  organizerName?: string | null;
  organizerEmail?: string | null;
  attendees?: JsonValue[] | null;
  internalExternalClassification?: MeetingInternalExternalClassification | null;
  relatedCompanyNames?: string[] | null;
  relatedPeopleNames?: string[] | null;
  priority?: MeetingPriority | null;
  priorityReasons?: string[] | null;
  sourceRefs?: JsonValue[] | null;
};

export type MeetingRecordsRepository = {
  findByCalendarEvent(input: {
    userId: string;
    calendarSourceSystemId: string;
    calendarEventId: string;
  }): Promise<MeetingRecord | null>;
  findById(input: { userId: string; meetingRecordId: string }): Promise<MeetingRecord | null>;
  listByCalendarEvents(input: {
    userId: string;
    calendarSourceSystemId: string;
    calendarEventIds: string[];
  }): Promise<MeetingRecord[]>;
  create(row: MeetingRecordInsertRow): Promise<MeetingRecord>;
  update(input: { userId: string; meetingRecordId: string; row: MeetingRecordUpdateRow }): Promise<MeetingRecord | null>;
};

const MEETING_RECORD_SELECT =
  "id, user_id, calendar_event_id, calendar_source_system_id, title, start_at, end_at, timezone, organizer_name, organizer_email, attendees, internal_external_classification, related_company_names, related_people_names, priority, priority_reasons, research_status, research_requested_at, research_completed_at, research_summary, source_refs, transcript_status, transcript_refs, post_meeting_status, post_meeting_summary, task_candidates, linked_task_ids, obsidian_export_status, obsidian_exported_at, obsidian_email_to, created_at, updated_at";

function compactText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = compactText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeRequiredText(value: string | null | undefined, fallback: string) {
  return normalizeOptionalText(value) ?? fallback;
}

function normalizeStringArray(values: string[] | null | undefined) {
  return (values ?? []).map(compactText).filter((value) => value.length > 0);
}

function normalizeJsonArray(values: JsonValue[] | null | undefined) {
  return values ?? [];
}

export function meetingCalendarEventIdFromBriefItemId(itemId: string) {
  return `executive-brief:${compactText(itemId) || "unknown-meeting"}`;
}

export function isMeetingRecordsSchemaUnavailableError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const normalized = message.toLowerCase();
  return (
    normalized.includes("could not find the table 'public.meeting_records'") ||
    normalized.includes('relation "public.meeting_records" does not exist') ||
    normalized.includes("relation 'public.meeting_records' does not exist")
  );
}

export function mapMeetingRecordRow(row: MeetingRecordRow): MeetingRecord {
  return {
    id: row.id,
    userId: row.user_id,
    calendarEventId: row.calendar_event_id,
    calendarSourceSystemId: row.calendar_source_system_id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    timezone: row.timezone,
    organizerName: row.organizer_name,
    organizerEmail: row.organizer_email,
    attendees: row.attendees ?? [],
    internalExternalClassification: row.internal_external_classification,
    relatedCompanyNames: row.related_company_names ?? [],
    relatedPeopleNames: row.related_people_names ?? [],
    priority: row.priority,
    priorityReasons: row.priority_reasons ?? [],
    researchStatus: row.research_status,
    researchRequestedAt: row.research_requested_at,
    researchCompletedAt: row.research_completed_at,
    researchSummary: row.research_summary,
    sourceRefs: row.source_refs ?? [],
    transcriptStatus: row.transcript_status,
    transcriptRefs: row.transcript_refs ?? [],
    postMeetingStatus: row.post_meeting_status,
    postMeetingSummary: row.post_meeting_summary,
    taskCandidates: row.task_candidates ?? [],
    linkedTaskIds: row.linked_task_ids ?? [],
    obsidianExportStatus: row.obsidian_export_status,
    obsidianExportedAt: row.obsidian_exported_at,
    obsidianEmailTo: row.obsidian_email_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function summarizeMeetingRecordStatus(record: MeetingRecord): MeetingRecordStatusSummary {
  return {
    id: record.id,
    calendarEventId: record.calendarEventId,
    researchStatus: record.researchStatus,
    transcriptStatus: record.transcriptStatus,
    taskCandidateCount: record.taskCandidates.length,
    obsidianExportStatus: record.obsidianExportStatus
  };
}

export function buildMeetingRecordInsert(input: CalendarEventMeetingRecordInput): MeetingRecordInsertRow {
  return {
    user_id: input.userId,
    calendar_event_id: normalizeRequiredText(input.calendarEventId, "unknown-calendar-event"),
    calendar_source_system_id: normalizeRequiredText(input.calendarSourceSystemId, "outlook"),
    title: normalizeRequiredText(input.title, "Untitled meeting"),
    start_at: input.startAt ?? null,
    end_at: input.endAt ?? null,
    timezone: normalizeRequiredText(input.timezone, "America/Los_Angeles"),
    organizer_name: normalizeOptionalText(input.organizerName),
    organizer_email: normalizeOptionalText(input.organizerEmail),
    attendees: normalizeJsonArray(input.attendees),
    internal_external_classification: input.internalExternalClassification ?? "unknown",
    related_company_names: normalizeStringArray(input.relatedCompanyNames),
    related_people_names: normalizeStringArray(input.relatedPeopleNames),
    priority: input.priority ?? "normal",
    priority_reasons: normalizeStringArray(input.priorityReasons),
    research_status: "not_researched",
    research_requested_at: null,
    research_completed_at: null,
    research_summary: null,
    source_refs: normalizeJsonArray(input.sourceRefs),
    transcript_status: "none",
    transcript_refs: [],
    post_meeting_status: "not_started",
    post_meeting_summary: null,
    task_candidates: [],
    linked_task_ids: [],
    obsidian_export_status: "not_exported",
    obsidian_exported_at: null,
    obsidian_email_to: TASKROBIN_OBSIDIAN_EMAIL
  };
}

export function createSupabaseMeetingRecordsRepository(client: SupabaseClient): MeetingRecordsRepository {
  return {
    async findByCalendarEvent(input) {
      const response = await withSupabaseTimeout(
        client
          .from("meeting_records")
          .select(MEETING_RECORD_SELECT)
          .eq("user_id", input.userId)
          .eq("calendar_source_system_id", input.calendarSourceSystemId)
          .eq("calendar_event_id", input.calendarEventId)
          .maybeSingle<MeetingRecordRow>()
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data ? mapMeetingRecordRow(response.data) : null;
    },
    async findById(input) {
      const response = await withSupabaseTimeout(
        client
          .from("meeting_records")
          .select(MEETING_RECORD_SELECT)
          .eq("user_id", input.userId)
          .eq("id", input.meetingRecordId)
          .maybeSingle<MeetingRecordRow>()
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data ? mapMeetingRecordRow(response.data) : null;
    },
    async listByCalendarEvents(input) {
      const calendarEventIds = [...new Set(input.calendarEventIds.map(compactText).filter(Boolean))];
      if (calendarEventIds.length === 0) {
        return [];
      }

      const response = await withSupabaseTimeout(
        client
          .from("meeting_records")
          .select(MEETING_RECORD_SELECT)
          .eq("user_id", input.userId)
          .eq("calendar_source_system_id", input.calendarSourceSystemId)
          .in("calendar_event_id", calendarEventIds)
          .returns<MeetingRecordRow[]>()
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return (response.data ?? []).map(mapMeetingRecordRow);
    },
    async create(row) {
      const response = await withSupabaseTimeout(
        client.from("meeting_records").insert(row).select(MEETING_RECORD_SELECT).single<MeetingRecordRow>()
      );

      if (response.error || !response.data) {
        throw new Error(response.error?.message ?? "Meeting record could not be created.");
      }

      return mapMeetingRecordRow(response.data);
    },
    async update(input) {
      const response = await withSupabaseTimeout(
        client
          .from("meeting_records")
          .update(input.row)
          .eq("user_id", input.userId)
          .eq("id", input.meetingRecordId)
          .select(MEETING_RECORD_SELECT)
          .maybeSingle<MeetingRecordRow>()
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data ? mapMeetingRecordRow(response.data) : null;
    }
  };
}

export async function getOrCreateMeetingRecordForCalendarEvent(
  repository: MeetingRecordsRepository,
  input: CalendarEventMeetingRecordInput
) {
  const calendarSourceSystemId = normalizeRequiredText(input.calendarSourceSystemId, "outlook");
  const calendarEventId = normalizeRequiredText(input.calendarEventId, "unknown-calendar-event");
  const existing = await repository.findByCalendarEvent({
    userId: input.userId,
    calendarSourceSystemId,
    calendarEventId
  });

  if (existing) {
    return existing;
  }

  try {
    return await repository.create(
      buildMeetingRecordInsert({
        ...input,
        calendarEventId,
        calendarSourceSystemId
      })
    );
  } catch (error) {
    const racedExisting = await repository.findByCalendarEvent({
      userId: input.userId,
      calendarSourceSystemId,
      calendarEventId
    });
    if (racedExisting) {
      return racedExisting;
    }
    throw error;
  }
}

export async function getMeetingRecord(
  repository: MeetingRecordsRepository,
  input: { userId: string; meetingRecordId: string }
) {
  return repository.findById(input);
}

export async function listMeetingRecordsForCalendarEvents(
  repository: MeetingRecordsRepository,
  input: {
    userId: string;
    calendarSourceSystemId: string;
    calendarEventIds: string[];
  }
) {
  return repository.listByCalendarEvents(input);
}

export async function updateMeetingResearchSummary(
  repository: MeetingRecordsRepository,
  input: {
    userId: string;
    meetingRecordId: string;
    researchSummary: MeetingResearchSummary | JsonRecord | null;
    sourceRefs?: JsonValue[] | null;
    taskCandidates?: MeetingTaskCandidate[] | JsonValue[] | null;
    researchStatus?: MeetingResearchStatus;
    researchRequestedAt?: string | null;
    researchCompletedAt?: string | null;
    now?: string;
  }
) {
  const completedAt = input.researchCompletedAt ?? input.now ?? new Date().toISOString();
  return repository.update({
    userId: input.userId,
    meetingRecordId: input.meetingRecordId,
    row: {
      research_status: input.researchStatus ?? "researched",
      research_requested_at: input.researchRequestedAt,
      research_completed_at: completedAt,
      research_summary: input.researchSummary,
      source_refs: input.sourceRefs ?? undefined,
      task_candidates: input.taskCandidates ?? undefined
    }
  });
}

export async function updateMeetingTranscriptRefs(
  repository: MeetingRecordsRepository,
  input: {
    userId: string;
    meetingRecordId: string;
    transcriptStatus: MeetingTranscriptStatus;
    transcriptRefs: JsonValue[];
    postMeetingStatus?: MeetingPostMeetingStatus;
    postMeetingSummary?: PostMeetingSummary | JsonRecord | null;
  }
) {
  return repository.update({
    userId: input.userId,
    meetingRecordId: input.meetingRecordId,
    row: {
      transcript_status: input.transcriptStatus,
      transcript_refs: input.transcriptRefs,
      post_meeting_status: input.postMeetingStatus,
      post_meeting_summary: input.postMeetingSummary
    }
  });
}

export async function updateMeetingPostMeetingSummary(
  repository: MeetingRecordsRepository,
  input: {
    userId: string;
    meetingRecordId: string;
    postMeetingStatus: MeetingPostMeetingStatus;
    postMeetingSummary: PostMeetingSummary | JsonRecord | null;
    taskCandidates?: MeetingTaskCandidate[] | JsonValue[] | null;
  }
) {
  return repository.update({
    userId: input.userId,
    meetingRecordId: input.meetingRecordId,
    row: {
      post_meeting_status: input.postMeetingStatus,
      post_meeting_summary: input.postMeetingSummary,
      task_candidates: input.taskCandidates ?? undefined
    }
  });
}

export async function updateMeetingObsidianExportStatus(
  repository: MeetingRecordsRepository,
  input: {
    userId: string;
    meetingRecordId: string;
    obsidianExportStatus: MeetingObsidianExportStatus;
    obsidianExportedAt?: string | null;
    obsidianEmailTo?: string | null;
  }
) {
  return repository.update({
    userId: input.userId,
    meetingRecordId: input.meetingRecordId,
    row: {
      obsidian_export_status: input.obsidianExportStatus,
      obsidian_exported_at: input.obsidianExportedAt,
      obsidian_email_to: normalizeRequiredText(input.obsidianEmailTo, TASKROBIN_OBSIDIAN_EMAIL)
    }
  });
}
