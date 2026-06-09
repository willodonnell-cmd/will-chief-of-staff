import assert from "node:assert/strict";
import test from "node:test";

import {
  TASKROBIN_OBSIDIAN_EMAIL,
  getMeetingRecord,
  getOrCreateMeetingRecordForCalendarEvent,
  listMeetingRecordsForCalendarEvents,
  summarizeMeetingRecordStatus,
  updateMeetingObsidianExportStatus,
  updateMeetingTaskCandidateLinks,
  updateMeetingResearchSummary,
  updateMeetingTranscriptRefs,
  type JsonValue,
  type MeetingRecord,
  type MeetingRecordInsertRow,
  type MeetingRecordUpdateRow,
  type MeetingRecordsRepository
} from "../lib/meetings/meeting-records";
import {
  buildMeetingTaskCaptureInsert,
  findExistingTaskForMeetingCandidate,
  meetingTaskCandidateToTaskFields,
  stableMeetingTaskDedupeKey
} from "../lib/meetings/meeting-task-candidates";
import {
  buildMeetingRecordMarkdown,
  buildTaskRobinMeetingEmail,
  exportMeetingRecordToTaskRobin
} from "../lib/meetings/meeting-obsidian-export";
import { runManualMeetingResearch } from "../lib/meetings/meeting-research";
import {
  attachTranscriptAndGeneratePostMeetingSummary,
  matchTranscriptCandidate,
  type TranscriptCandidate
} from "../lib/meetings/meeting-transcripts";

function createMemoryMeetingRecordsRepository(seed: MeetingRecord[] = []) {
  const records = new Map(seed.map((record) => [record.id, { ...record }]));
  let nextId = seed.length + 1;

  function fromInsert(row: MeetingRecordInsertRow): MeetingRecord {
    const now = "2026-06-08T20:00:00.000Z";
    return {
      id: `meeting-record-${nextId++}`,
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
      createdAt: now,
      updatedAt: now
    };
  }

  function applyUpdate(record: MeetingRecord, row: MeetingRecordUpdateRow): MeetingRecord {
    return {
      ...record,
      researchStatus: row.research_status ?? record.researchStatus,
      researchRequestedAt:
        row.research_requested_at === undefined ? record.researchRequestedAt : row.research_requested_at,
      researchCompletedAt:
        row.research_completed_at === undefined ? record.researchCompletedAt : row.research_completed_at,
      researchSummary: row.research_summary === undefined ? record.researchSummary : row.research_summary,
      sourceRefs: row.source_refs === undefined ? record.sourceRefs : row.source_refs ?? [],
      transcriptStatus: row.transcript_status ?? record.transcriptStatus,
      transcriptRefs: row.transcript_refs === undefined ? record.transcriptRefs : row.transcript_refs ?? [],
      postMeetingStatus: row.post_meeting_status ?? record.postMeetingStatus,
      postMeetingSummary:
        row.post_meeting_summary === undefined ? record.postMeetingSummary : row.post_meeting_summary,
      taskCandidates: row.task_candidates === undefined ? record.taskCandidates : row.task_candidates ?? [],
      linkedTaskIds: row.linked_task_ids === undefined ? record.linkedTaskIds : row.linked_task_ids ?? [],
      obsidianExportStatus: row.obsidian_export_status ?? record.obsidianExportStatus,
      obsidianExportedAt:
        row.obsidian_exported_at === undefined ? record.obsidianExportedAt : row.obsidian_exported_at,
      obsidianEmailTo: row.obsidian_email_to ?? record.obsidianEmailTo,
      updatedAt: "2026-06-08T20:05:00.000Z"
    };
  }

  const repository: MeetingRecordsRepository = {
    async findByCalendarEvent(input) {
      return (
        [...records.values()].find(
          (record) =>
            record.userId === input.userId &&
            record.calendarSourceSystemId === input.calendarSourceSystemId &&
            record.calendarEventId === input.calendarEventId
        ) ?? null
      );
    },
    async findById(input) {
      const record = records.get(input.meetingRecordId);
      return record && record.userId === input.userId ? record : null;
    },
    async listByCalendarEvents(input) {
      return [...records.values()].filter(
        (record) =>
          record.userId === input.userId &&
          record.calendarSourceSystemId === input.calendarSourceSystemId &&
          input.calendarEventIds.includes(record.calendarEventId)
      );
    },
    async create(row) {
      const created = fromInsert(row);
      records.set(created.id, created);
      return created;
    },
    async update(input) {
      const existing = records.get(input.meetingRecordId);
      if (!existing || existing.userId !== input.userId) {
        return null;
      }

      const updated = applyUpdate(existing, input.row);
      records.set(updated.id, updated);
      return updated;
    }
  };

  return {
    repository,
    records
  };
}

function createTranscriptCandidate(overrides: Partial<TranscriptCandidate> = {}): TranscriptCandidate {
  return {
    id: "transcript-1",
    sourceType: "zoom",
    title: "Board prep",
    startedAt: "2026-06-09T17:02:00.000Z",
    endedAt: "2026-06-09T17:58:00.000Z",
    durationMinutes: 56,
    attendees: ["Will O'Donnell", "Noemy"],
    zoomMeetingId: null,
    recordingTimestamp: "2026-06-09T17:02:00.000Z",
    plaudTranscriptTimestamp: null,
    keywords: ["board", "approval"],
    text: "We decided to send the approval path and follow up with finance.",
    url: "https://zoom.example/recording-1",
    ...overrides
  };
}

test("getOrCreateMeetingRecordForCalendarEvent creates a durable record with default statuses", async () => {
  const memory = createMemoryMeetingRecordsRepository();

  const record = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "outlook-event-1",
    title: "Customer strategy review",
    startAt: "2026-06-09T17:00:00.000Z",
    endAt: "2026-06-09T18:00:00.000Z",
    attendees: [{ name: "Alex", email: "alex@example.com" }],
    internalExternalClassification: "external",
    relatedCompanyNames: ["Example Co"],
    priority: "high",
    priorityReasons: ["customer strategy"]
  });

  assert.equal(record.calendarSourceSystemId, "outlook");
  assert.equal(record.researchStatus, "not_researched");
  assert.equal(record.transcriptStatus, "none");
  assert.equal(record.postMeetingStatus, "not_started");
  assert.equal(record.obsidianExportStatus, "not_exported");
  assert.equal(record.obsidianEmailTo, TASKROBIN_OBSIDIAN_EMAIL);
  assert.deepEqual(record.relatedCompanyNames, ["Example Co"]);
  assert.deepEqual(record.priorityReasons, ["customer strategy"]);
});

test("getOrCreateMeetingRecordForCalendarEvent returns the existing record without overwriting it", async () => {
  const memory = createMemoryMeetingRecordsRepository();

  const first = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "event-1",
    title: "Original title"
  });

  const researched = await updateMeetingResearchSummary(memory.repository, {
    userId: "user-1",
    meetingRecordId: first.id,
    researchSummary: { version: "existing", generatedAt: "2026-06-08T20:01:00.000Z" },
    now: "2026-06-08T20:02:00.000Z"
  });

  assert.equal(researched?.researchStatus, "researched");

  const second = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "event-1",
    title: "Replacement title"
  });

  assert.equal(second.id, first.id);
  assert.equal(second.title, "Original title");
  assert.deepEqual(second.researchSummary, { version: "existing", generatedAt: "2026-06-08T20:01:00.000Z" });
  assert.equal(memory.records.size, 1);
});

test("getMeetingRecord is scoped to the owning user", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const record = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "event-1",
    title: "Board prep"
  });

  assert.equal((await getMeetingRecord(memory.repository, { userId: "user-1", meetingRecordId: record.id }))?.id, record.id);
  assert.equal(await getMeetingRecord(memory.repository, { userId: "user-2", meetingRecordId: record.id }), null);
});

test("listMeetingRecordsForCalendarEvents returns scoped status summaries for matching events", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const first = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "executive-brief:meetingPrep-meeting-1",
    calendarSourceSystemId: "executive_brief",
    title: "Board prep"
  });
  await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-2",
    calendarEventId: "executive-brief:meetingPrep-meeting-1",
    calendarSourceSystemId: "executive_brief",
    title: "Other user meeting"
  });

  const records = await listMeetingRecordsForCalendarEvents(memory.repository, {
    userId: "user-1",
    calendarSourceSystemId: "executive_brief",
    calendarEventIds: ["executive-brief:meetingPrep-meeting-1"]
  });

  assert.equal(records.length, 1);
  assert.equal(records[0]?.id, first.id);
  assert.deepEqual(summarizeMeetingRecordStatus(records[0]!), {
    id: first.id,
    calendarEventId: "executive-brief:meetingPrep-meeting-1",
    researchStatus: "not_researched",
    transcriptStatus: "none",
    taskCandidateCount: 0,
    taskCandidates: [],
    obsidianExportStatus: "not_exported"
  });
});

test("update helpers persist research, transcript, and Obsidian state without creating tasks", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const record = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "event-1",
    title: "Partner sync"
  });

  const researchTaskCandidate = {
    title: "Send partner follow-up",
    description: null,
    owner: null,
    priority: "high" as const,
    dueDate: null,
    sourceRefs: [] as JsonValue[],
    dedupeKey: "meeting-record-1:follow-up",
    meetingRecordId: record.id,
    taskType: "follow_up" as const
  };
  const researched = await updateMeetingResearchSummary(memory.repository, {
    userId: "user-1",
    meetingRecordId: record.id,
    researchSummary: {
      meetingRecordId: record.id,
      generatedAt: "2026-06-08T20:10:00.000Z",
      sourceCoverage: [],
      calendarEventDetails: null,
      highLevelContext: "Evidence-backed context.",
      recentRelevantActivity: [],
      situationRead: null,
      keyPriorities: [],
      suggestedQuestions: [],
      relevantLinks: [],
      taskCandidates: [researchTaskCandidate]
    },
    sourceRefs: [{ sourceType: "calendar", id: "event-1" }],
    taskCandidates: [researchTaskCandidate],
    now: "2026-06-08T20:11:00.000Z"
  });

  assert.equal(researched?.researchStatus, "researched");
  assert.equal(researched?.researchCompletedAt, "2026-06-08T20:11:00.000Z");
  assert.deepEqual(researched?.taskCandidates, [researchTaskCandidate]);
  assert.deepEqual(researched?.linkedTaskIds, []);

  const transcript = await updateMeetingTranscriptRefs(memory.repository, {
    userId: "user-1",
    meetingRecordId: record.id,
    transcriptStatus: "attached",
    transcriptRefs: [{ sourceType: "zoom", id: "recording-1" }]
  });

  assert.equal(transcript?.transcriptStatus, "attached");
  assert.deepEqual(transcript?.transcriptRefs, [{ sourceType: "zoom", id: "recording-1" }]);

  const exported = await updateMeetingObsidianExportStatus(memory.repository, {
    userId: "user-1",
    meetingRecordId: record.id,
    obsidianExportStatus: "sent_to_taskrobin",
    obsidianExportedAt: "2026-06-08T20:12:00.000Z"
  });

  assert.equal(exported?.obsidianExportStatus, "sent_to_taskrobin");
  assert.equal(exported?.obsidianExportedAt, "2026-06-08T20:12:00.000Z");
  assert.equal(exported?.obsidianEmailTo, TASKROBIN_OBSIDIAN_EMAIL);
});

test("meeting research task candidate maps to a task payload with meeting metadata and source refs", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const record = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "event-1",
    calendarSourceSystemId: "executive_brief",
    title: "Board prep",
    startAt: "2026-06-09T17:00:00.000Z",
    relatedCompanyNames: ["Example Co"]
  });
  const candidate = {
    title: "Prepare approval path",
    description: "Use the latest board packet.",
    owner: "Will",
    priority: "high" as const,
    dueDate: "2026-06-09T16:00:00.000Z",
    sourceRefs: [{ sourceType: "executive_brief", briefItemId: "meetingPrep-board" }] as JsonValue[],
    dedupeKey: "board-prep-approval-path",
    meetingRecordId: record.id,
    taskType: "prep" as const
  };

  const fields = meetingTaskCandidateToTaskFields(candidate);
  assert.equal(fields.description, "Prepare approval path");
  assert.equal(fields.nextStep, "Use the latest board packet.");
  assert.equal(fields.desiredOutcome, "Owner: Will");
  assert.equal(fields.priority, "high");
  assert.equal(fields.dueAt, "2026-06-09T16:00:00.000Z");
  assert.equal(stableMeetingTaskDedupeKey(candidate), "board-prep-approval-path");

  const insert = buildMeetingTaskCaptureInsert({
    userId: "user-1",
    meetingRecord: record,
    candidate,
    category: {
      id: "category-1",
      name: "TBD",
      status: "active",
      is_fallback: true
    },
    now: "2026-06-08T22:00:00.000Z"
  });

  assert.equal(insert.type, "task");
  assert.equal(insert.source_path, "/meetings");
  assert.equal(insert.priority, "high");
  assert.equal(insert.due_at, "2026-06-09T16:00:00.000Z");
  assert.equal(insert.capture_metadata.meetingRecordId, record.id);
  assert.equal(insert.capture_metadata.meetingTaskCandidateDedupeKey, "board-prep-approval-path");
  assert.deepEqual(insert.capture_metadata.meetingTaskCandidateSourceRefs, candidate.sourceRefs);
  assert.match(insert.original_content, /MeetingRecord/);
});

test("post-meeting action candidate maps to a stable follow-up task payload", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const record = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "event-2",
    title: "Finance debrief"
  });
  const candidate = {
    title: "Follow up with finance",
    description: null,
    owner: null,
    priority: null,
    dueDate: null,
    sourceRefs: [{ sourceType: "zoom", id: "recording-1" }] as JsonValue[],
    dedupeKey: `${record.id}:finance-follow-up`,
    meetingRecordId: record.id,
    taskType: "follow_up" as const
  };

  const fields = meetingTaskCandidateToTaskFields(candidate);
  assert.equal(fields.description, "Follow up with finance");
  assert.equal(fields.nextStep, "Follow up with finance");
  assert.equal(fields.desiredOutcome, "");
  assert.equal(fields.priority, "medium");
  assert.equal(stableMeetingTaskDedupeKey(candidate), `${record.id}:finance-follow-up`);
});

test("meeting task dedupe finds existing tasks by candidate key before creating a duplicate", () => {
  const candidate = {
    title: "Prepare approval path",
    description: null,
    owner: null,
    priority: "high" as const,
    dueDate: null,
    sourceRefs: [] as JsonValue[],
    dedupeKey: "board-prep-approval-path",
    meetingRecordId: "meeting-record-1",
    taskType: "prep" as const
  };

  const existing = findExistingTaskForMeetingCandidate(
    [
      {
        id: "capture-1",
        title: "Prepare approval path",
        task_description: "Prepare approval path",
        capture_metadata: {
          meetingRecordId: "meeting-record-1",
          meetingTaskCandidateDedupeKey: "board-prep-approval-path"
        }
      }
    ],
    candidate
  );

  assert.equal(existing?.id, "capture-1");
});

test("meeting task candidate status updates after task creation without auto-creating tasks", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const record = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "event-1",
    title: "Board prep"
  });
  const candidate = {
    title: "Prepare approval path",
    description: null,
    owner: null,
    priority: "high" as const,
    dueDate: null,
    sourceRefs: [] as JsonValue[],
    dedupeKey: "board-prep-approval-path",
    meetingRecordId: record.id,
    taskType: "prep" as const
  };
  const withCandidate = await updateMeetingResearchSummary(memory.repository, {
    userId: "user-1",
    meetingRecordId: record.id,
    researchSummary: null,
    taskCandidates: [candidate]
  });

  assert.deepEqual(withCandidate?.linkedTaskIds, []);

  const linked = await updateMeetingTaskCandidateLinks(memory.repository, {
    userId: "user-1",
    meetingRecord: withCandidate!,
    dedupeKey: "board-prep-approval-path",
    linkedTaskId: "capture-1",
    linkedTaskHref: "/library/capture-1?from=%2Flibrary%2Ftasks",
    status: "created",
    linkedAt: "2026-06-08T22:10:00.000Z"
  });
  const status = summarizeMeetingRecordStatus(linked!);

  assert.deepEqual(linked?.linkedTaskIds, ["capture-1"]);
  assert.equal(status.taskCandidates[0]?.status, "created");
  assert.equal(status.taskCandidates[0]?.linkedTaskId, "capture-1");
  assert.equal(status.taskCandidates[0]?.linkedTaskHref, "/library/capture-1?from=%2Flibrary%2Ftasks");
});

test("meeting record markdown omits empty optional sections and preserves links", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const record = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "event-1",
    title: "Board prep",
    startAt: "2026-06-09T17:00:00.000Z",
    relatedCompanyNames: ["Example Co"],
    relatedPeopleNames: ["Alex"]
  });
  const researched = await updateMeetingResearchSummary(memory.repository, {
    userId: "user-1",
    meetingRecordId: record.id,
    researchSummary: {
      meetingRecordId: record.id,
      generatedAt: "2026-06-08T20:10:00.000Z",
      sourceCoverage: [],
      calendarEventDetails: {
        title: "Board prep",
        startAt: "2026-06-09T17:00:00.000Z",
        endAt: null,
        organizer: "Will",
        attendees: [],
        locationOrLink: "https://meet.example/board",
        descriptionSummary: null
      },
      highLevelContext: "Prepare the approval path.",
      recentRelevantActivity: [],
      situationRead: null,
      keyPriorities: [],
      suggestedQuestions: [],
      relevantLinks: [{ title: "Board packet", url: "https://example.com/packet" }],
      taskCandidates: []
    }
  });

  const markdown = buildMeetingRecordMarkdown(researched!);
  assert.match(markdown, /type: meeting/);
  assert.match(markdown, /# Board prep/);
  assert.match(markdown, /Calendar Event Details/);
  assert.match(markdown, /https:\/\/example.com\/packet/);
  assert.doesNotMatch(markdown, /Suggested Questions/);
  assert.doesNotMatch(markdown, /Key Priorities/);
  assert.doesNotMatch(markdown, /Situation Read/);
});

test("meeting record markdown omits unsupported research and transcript sections even when populated", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const record = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "event-1",
    title: "Unsupported section check"
  });
  const researched = await updateMeetingResearchSummary(memory.repository, {
    userId: "user-1",
    meetingRecordId: record.id,
    researchSummary: {
      meetingRecordId: record.id,
      generatedAt: "2026-06-08T20:10:00.000Z",
      sourceCoverage: [
        {
          sourceType: "pitchbook",
          used: false,
          itemCount: 0,
          internalOnlyReason: "PitchBook connector is not available to this code path."
        },
        {
          sourceType: "web_news",
          used: false,
          itemCount: 0,
          internalOnlyReason: "Web/news adapter is not enabled for meeting research in this phase."
        }
      ],
      calendarEventDetails: null,
      highLevelContext: "Supported context stays in the note.",
      recentRelevantActivity: [],
      situationRead: {
        categories: ["urgency"],
        summary: "Unsupported situation read should stay out.",
        confidence: "medium",
        evidenceRefs: []
      },
      keyPriorities: [
        {
          title: "Unsupported priority",
          reason: "This should stay out of the export.",
          sourceRefs: []
        }
      ],
      suggestedQuestions: [
        {
          question: "Unsupported question?",
          reason: "This should stay out of the export.",
          sourceRefs: []
        }
      ],
      relevantLinks: [],
      taskCandidates: []
    }
  });
  const withTranscript = await updateMeetingTranscriptRefs(memory.repository, {
    userId: "user-1",
    meetingRecordId: record.id,
    transcriptStatus: "attached",
    transcriptRefs: [{ title: "Unsupported transcript reference", url: "https://example.com/transcript" }]
  });

  const markdown = buildMeetingRecordMarkdown(withTranscript ?? researched!);
  assert.match(markdown, /Supported context stays in the note/);
  assert.doesNotMatch(markdown, /Situation Read/);
  assert.doesNotMatch(markdown, /Unsupported situation read/);
  assert.doesNotMatch(markdown, /Key Priorities/);
  assert.doesNotMatch(markdown, /Unsupported priority/);
  assert.doesNotMatch(markdown, /Suggested Questions/);
  assert.doesNotMatch(markdown, /Unsupported question/);
  assert.doesNotMatch(markdown, /Transcript Reference/);
  assert.doesNotMatch(markdown, /Unsupported transcript reference/);
  assert.doesNotMatch(markdown, /PitchBook/);
  assert.doesNotMatch(markdown, /Web\/news/);
});

test("TaskRobin meeting email uses the configured MeetingRecord destination and subject", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const record = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "event-1",
    title: "Partner sync",
    startAt: "2026-06-09T17:00:00.000Z"
  });
  const email = buildTaskRobinMeetingEmail(record);

  assert.equal(email.to, TASKROBIN_OBSIDIAN_EMAIL);
  assert.equal(email.subject, "Blackhawk Meeting Note - Partner sync - 2026-06-09");
  assert.match(email.body, /calendar_event_id/);
});

test("exportMeetingRecordToTaskRobin marks sent only after email provider succeeds", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const record = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "event-1",
    title: "Partner sync",
    startAt: "2026-06-09T17:00:00.000Z"
  });
  let sentTo: string | null = null;

  const result = await exportMeetingRecordToTaskRobin({
    repository: memory.repository,
    userId: "user-1",
    meetingRecordId: record.id,
    now: "2026-06-09T18:00:00.000Z",
    provider: async (email) => {
      sentTo = email.to;
      assert.match(email.body, /Partner sync/);
      return { ok: true, providerMessageId: "email-1" };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(sentTo, TASKROBIN_OBSIDIAN_EMAIL);
  assert.equal(result.record?.obsidianExportStatus, "sent_to_taskrobin");
  assert.equal(result.record?.obsidianExportedAt, "2026-06-09T18:00:00.000Z");
});

test("exportMeetingRecordToTaskRobin marks failed when email provider is unavailable", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const record = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "event-1",
    title: "Partner sync"
  });

  const result = await exportMeetingRecordToTaskRobin({
    repository: memory.repository,
    userId: "user-1",
    meetingRecordId: record.id,
    provider: async () => ({ ok: false, error: "not_configured" })
  });

  assert.equal(result.ok, false);
  assert.equal(result.record?.obsidianExportStatus, "failed");
  assert.equal(result.record?.obsidianExportedAt, null);
});

test("matchTranscriptCandidate uses meeting metadata beyond title for confidence", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const record = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "event-1",
    title: "Board prep",
    startAt: "2026-06-09T17:00:00.000Z",
    endAt: "2026-06-09T18:00:00.000Z",
    attendees: ["Will O'Donnell", "Noemy"],
    priorityReasons: ["board approval"]
  });

  const high = matchTranscriptCandidate(record, createTranscriptCandidate());
  assert.equal(high.confidence, "high");
  assert.match(high.reasons.join(" "), /window/);
  assert.match(high.reasons.join(" "), /attendees/);

  const titleOnly = matchTranscriptCandidate(
    record,
    createTranscriptCandidate({
      startedAt: "2026-06-12T17:02:00.000Z",
      endedAt: "2026-06-12T17:58:00.000Z",
      durationMinutes: null,
      attendees: [],
      keywords: []
    })
  );
  assert.equal(titleOnly.confidence, "low");
});

test("attachTranscriptAndGeneratePostMeetingSummary attaches high-confidence transcripts and stores candidates only", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const record = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "event-1",
    title: "Board prep",
    startAt: "2026-06-09T17:00:00.000Z",
    endAt: "2026-06-09T18:00:00.000Z",
    attendees: ["Will O'Donnell", "Noemy"],
    priorityReasons: ["board approval"]
  });

  const result = await attachTranscriptAndGeneratePostMeetingSummary(memory.repository, {
    meetingRecord: record,
    candidates: [createTranscriptCandidate()],
    now: "2026-06-09T19:00:00.000Z",
    provider: async (input) => ({
      ok: true,
      summary: {
        generatedAt: input.generatedAt,
        sourceTranscriptRefs: [input.transcriptRef],
        summary: "Approval path was discussed and finance follow-up is needed.",
        decisions: [{ title: "Send approval path" }],
        actionItemCandidates: [
          {
            title: "Follow up with finance",
            description: "Confirm finance inputs from board prep.",
            owner: null,
            priority: "high",
            dueDate: null,
            sourceRefs: [input.transcriptRef],
            dedupeKey: `${input.meetingRecord.id}:finance-follow-up`,
            meetingRecordId: input.meetingRecord.id,
            taskType: "follow_up"
          }
        ],
        risksOrOpenIssues: [],
        followUpDraftAvailable: false
      }
    })
  });

  assert.equal(result.ok, true);
  assert.equal(result.record.transcriptStatus, "summarized");
  assert.equal(result.record.postMeetingStatus, "summarized");
  assert.equal(result.record.taskCandidates.length, 1);
  assert.deepEqual(result.record.linkedTaskIds, []);
});

test("attachTranscriptAndGeneratePostMeetingSummary does not attach medium confidence without confirmation", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const record = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "event-1",
    title: "Partner sync",
    startAt: "2026-06-09T17:00:00.000Z",
    endAt: "2026-06-09T18:00:00.000Z"
  });

  const result = await attachTranscriptAndGeneratePostMeetingSummary(memory.repository, {
    meetingRecord: record,
    candidates: [
      createTranscriptCandidate({
        title: "Different title",
        attendees: [],
        keywords: [],
        durationMinutes: 56
      })
    ],
    provider: async () => {
      throw new Error("provider should not run for unconfirmed medium confidence");
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "needs_confirmation");
  assert.equal(result.record.transcriptStatus, "none");
  assert.equal(result.record.postMeetingStatus, "not_started");
});

test("attachTranscriptAndGeneratePostMeetingSummary marks transcript processing failed when summary provider fails", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const record = await getOrCreateMeetingRecordForCalendarEvent(memory.repository, {
    userId: "user-1",
    calendarEventId: "event-1",
    title: "Board prep",
    startAt: "2026-06-09T17:00:00.000Z",
    endAt: "2026-06-09T18:00:00.000Z",
    attendees: ["Will O'Donnell", "Noemy"]
  });

  const result = await attachTranscriptAndGeneratePostMeetingSummary(memory.repository, {
    meetingRecord: record,
    candidates: [createTranscriptCandidate()],
    provider: async () => ({ ok: false, error: "no_provider" })
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "no_provider");
  assert.equal(result.record.transcriptStatus, "failed");
  assert.equal(result.record.postMeetingStatus, "failed");
  assert.match(JSON.stringify(result.record.postMeetingSummary), /no_provider/);
});

test("runManualMeetingResearch creates a record, sends bounded source context, and saves candidates only", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const result = await runManualMeetingResearch(
    memory.repository,
    {
      userId: "user-1",
      calendarEventId: "executive-brief:meetingPrep-board",
      calendarSourceSystemId: "executive_brief",
      title: "Board prep",
      startAt: "2026-06-09T17:00:00.000Z",
      descriptionSummary: "Prepare the approval path.",
      sourceRefs: [{ sourceType: "executive_brief", briefItemId: "meetingPrep-board" }]
    },
    {
      now: "2026-06-08T21:00:00.000Z",
      provider: async (input) => {
        assert.equal(input.meetingRecord.researchStatus, "researching");
        assert.equal(input.sourceContext.calendarEventDetails.title, "Board prep");
        assert.equal(
          input.sourceContext.sourceCoverage.find((source) => source.sourceType === "calendar_event_details")?.used,
          true
        );
        assert.equal(
          input.sourceContext.sourceCoverage.find((source) => source.sourceType === "pitchbook")?.used,
          false
        );

        return {
          ok: true,
          summary: {
            meetingRecordId: input.meetingRecord.id,
            generatedAt: "2026-06-08T21:01:00.000Z",
            sourceCoverage: input.sourceContext.sourceCoverage,
            calendarEventDetails: input.sourceContext.calendarEventDetails,
            highLevelContext: "Approval path prep is the only supported context.",
            recentRelevantActivity: [],
            situationRead: null,
            keyPriorities: [],
            suggestedQuestions: [],
            relevantLinks: [],
            taskCandidates: [
              {
                title: "Prepare approval path",
                description: null,
                owner: null,
                priority: "high",
                dueDate: null,
                sourceRefs: [{ sourceType: "executive_brief", briefItemId: "meetingPrep-board" }],
                dedupeKey: "board-prep-approval-path",
                meetingRecordId: input.meetingRecord.id,
                taskType: "prep"
              }
            ]
          }
        };
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.record?.researchStatus, "researched");
  assert.equal(result.record?.researchRequestedAt, "2026-06-08T21:00:00.000Z");
  assert.equal(result.record?.researchCompletedAt, "2026-06-08T21:01:00.000Z");
  assert.equal(result.record?.taskCandidates.length, 1);
  assert.deepEqual(result.record?.linkedTaskIds, []);
});

test("runManualMeetingResearch marks the record failed when the provider is unavailable", async () => {
  const memory = createMemoryMeetingRecordsRepository();
  const result = await runManualMeetingResearch(
    memory.repository,
    {
      userId: "user-1",
      calendarEventId: "event-1",
      title: "Partner sync"
    },
    {
      now: "2026-06-08T21:00:00.000Z",
      provider: async () => ({ ok: false, error: "no_provider" })
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, "no_provider");
  assert.equal(result.record?.researchStatus, "failed");
  assert.deepEqual(result.record?.linkedTaskIds, []);
  assert.match(JSON.stringify(result.record?.researchSummary), /no_provider/);
});
