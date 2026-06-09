import {
  TASKROBIN_OBSIDIAN_EMAIL,
  updateMeetingObsidianExportStatus,
  type JsonValue,
  type MeetingRecord,
  type MeetingRecordsRepository,
  type MeetingResearchSummary,
  type MeetingTaskCandidate,
  type PostMeetingSummary
} from "@/lib/meetings/meeting-records";

export type TaskRobinEmail = {
  to: string;
  subject: string;
  body: string;
};

export type TaskRobinEmailProvider = (
  email: TaskRobinEmail
) => Promise<{ ok: true; providerMessageId?: string | null } | { ok: false; error: "not_configured" | "upstream" | "network" }>;

function compactText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function multilineText(value: string | null | undefined) {
  return value?.replace(/\r\n/g, "\n").trim() ?? "";
}

function datePart(value: string | null | undefined) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
}

function yamlScalar(value: string | null | undefined) {
  const text = compactText(value);
  if (!text) {
    return "";
  }
  return JSON.stringify(text);
}

function yamlArray(values: string[]) {
  const filtered = values.map(compactText).filter(Boolean);
  if (filtered.length === 0) {
    return "";
  }
  return `[${filtered.map((value) => JSON.stringify(value)).join(", ")}]`;
}

function isRecord(value: JsonValue | null | undefined): value is Record<string, JsonValue> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asArray(value: JsonValue | null | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: JsonValue | null | undefined) {
  return typeof value === "string" ? multilineText(value) : "";
}

function parseResearchSummary(value: JsonValue | null): MeetingResearchSummary | null {
  if (!isRecord(value)) {
    return null;
  }
  return value as MeetingResearchSummary;
}

function parsePostMeetingSummary(value: JsonValue | null): PostMeetingSummary | null {
  if (!isRecord(value)) {
    return null;
  }
  return value as PostMeetingSummary;
}

function formatDateTime(value: string | null | undefined) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString();
}

function jsonLine(value: JsonValue) {
  if (typeof value === "string") {
    return compactText(value);
  }
  if (isRecord(value)) {
    const title = typeof value.title === "string" ? compactText(value.title) : "";
    const summary = typeof value.summary === "string" ? compactText(value.summary) : "";
    const url = typeof value.url === "string" ? compactText(value.url) : "";
    const href = typeof value.href === "string" ? compactText(value.href) : "";
    const label = [title, summary].filter(Boolean).join(": ");
    const link = url || href;
    return [label || JSON.stringify(value), link].filter(Boolean).join(" ");
  }
  return JSON.stringify(value);
}

function listBlock(values: Array<string | JsonValue>) {
  const lines = values
    .map((value) => (typeof value === "string" ? compactText(value) : jsonLine(value)))
    .filter(Boolean)
    .map((value) => `- ${value}`);
  return lines.length > 0 ? lines.join("\n") : "";
}

function taskCandidateBlock(candidates: MeetingTaskCandidate[]) {
  return listBlock(
    candidates.map((candidate) => {
      const detail = [
        candidate.description,
        candidate.owner ? `Owner: ${candidate.owner}` : null,
        candidate.priority ? `Priority: ${candidate.priority}` : null,
        candidate.dueDate ? `Due: ${candidate.dueDate}` : null,
        `Type: ${candidate.taskType}`
      ]
        .filter(Boolean)
        .join("; ");
      return detail ? `${candidate.title} (${detail})` : candidate.title;
    })
  );
}

function section(title: string, body: string | null | undefined) {
  const content = multilineText(body);
  return content ? `## ${title}\n\n${content}` : null;
}

function calendarDetails(record: MeetingRecord, research: MeetingResearchSummary | null) {
  const details = research?.calendarEventDetails;
  const lines = [
    `Title: ${details?.title ?? record.title}`,
    record.startAt || details?.startAt ? `Start: ${formatDateTime(details?.startAt ?? record.startAt)}` : null,
    record.endAt || details?.endAt ? `End: ${formatDateTime(details?.endAt ?? record.endAt)}` : null,
    record.timezone ? `Timezone: ${record.timezone}` : null,
    details?.organizer || record.organizerName || record.organizerEmail
      ? `Organizer: ${details?.organizer ?? [record.organizerName, record.organizerEmail].filter(Boolean).join(" ")}`
      : null,
    record.attendees.length > 0 ? `Attendees: ${record.attendees.map(jsonLine).join(", ")}` : null,
    details?.locationOrLink ? `Location / Link: ${details.locationOrLink}` : null,
    details?.descriptionSummary ? `Description: ${details.descriptionSummary}` : null
  ].filter((line): line is string => Boolean(line && compactText(line)));

  return lines.join("\n");
}

function researchActivityBlock(research: MeetingResearchSummary | null) {
  const groups = research?.recentRelevantActivity ?? [];
  if (groups.length === 0) {
    return "";
  }
  return groups
    .map((group) =>
      [`### ${group.title}`, group.summary, group.sourceRefs.length > 0 ? listBlock(group.sourceRefs) : null]
        .filter((line): line is string => Boolean(line))
        .join("\n\n")
    )
    .join("\n\n");
}

export function buildMeetingRecordMarkdown(record: MeetingRecord) {
  const research = parseResearchSummary(record.researchSummary);
  const postMeeting = parsePostMeetingSummary(record.postMeetingSummary);
  const relevantLinks = [...(research?.relevantLinks ?? []), ...record.sourceRefs];
  const researchTaskCandidates = research?.taskCandidates ?? [];
  const postMeetingCandidates = postMeeting?.actionItemCandidates ?? [];
  const allTaskCandidates = [...researchTaskCandidates, ...postMeetingCandidates];
  const decisions = asArray(postMeeting?.decisions as JsonValue | null);
  const risks = asArray(postMeeting?.risksOrOpenIssues as JsonValue | null);

  const frontmatter = [
    "---",
    "type: meeting",
    "source: blackhawk",
    `date: ${datePart(record.startAt)}`,
    `calendar_event_id: ${yamlScalar(record.calendarEventId)}`,
    `company: ${yamlArray(record.relatedCompanyNames)}`,
    `people: ${yamlArray(record.relatedPeopleNames)}`,
    `internal_external: ${yamlScalar(record.internalExternalClassification)}`,
    "tags: [blackhawk, meeting]",
    "---"
  ].join("\n");
  const sections = [
    `# ${record.title}`,
    section("Calendar Event Details", calendarDetails(record, research)),
    section("Pre-Meeting Context", [asText(research?.highLevelContext as JsonValue | null), researchActivityBlock(research)].filter(Boolean).join("\n\n")),
    section("Post-Meeting Summary", postMeeting?.summary ?? ""),
    section("Decisions", listBlock(decisions)),
    section("Action Items", taskCandidateBlock(allTaskCandidates)),
    section("Risks / Open Issues", listBlock(risks)),
    section("Relevant Links", listBlock(relevantLinks))
  ].filter((entry): entry is string => Boolean(entry));

  return [frontmatter, ...sections].join("\n\n").trim();
}

export function buildTaskRobinMeetingEmail(record: MeetingRecord): TaskRobinEmail {
  const date = datePart(record.startAt) || datePart(record.createdAt) || "undated";
  return {
    to: record.obsidianEmailTo || TASKROBIN_OBSIDIAN_EMAIL,
    subject: `Blackhawk Meeting Note - ${record.title} - ${date}`,
    body: buildMeetingRecordMarkdown(record)
  };
}

export async function sendTaskRobinEmailViaResend(email: TaskRobinEmail): ReturnType<TaskRobinEmailProvider> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.TASKROBIN_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return { ok: false, error: "not_configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from,
        to: [email.to],
        subject: email.subject,
        text: email.body
      })
    });
    if (!response.ok) {
      return { ok: false, error: "upstream" };
    }
    const data = await response.json().catch(() => null) as { id?: string } | null;
    return { ok: true, providerMessageId: data?.id ?? null };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function exportMeetingRecordToTaskRobin(input: {
  repository: MeetingRecordsRepository;
  userId: string;
  meetingRecordId: string;
  now?: string;
  provider?: TaskRobinEmailProvider;
}) {
  const record = await input.repository.findById({
    userId: input.userId,
    meetingRecordId: input.meetingRecordId
  });
  if (!record) {
    return { ok: false as const, error: "meeting-not-found" as const, record: null };
  }

  await updateMeetingObsidianExportStatus(input.repository, {
    userId: input.userId,
    meetingRecordId: record.id,
    obsidianExportStatus: "sending",
    obsidianEmailTo: record.obsidianEmailTo || TASKROBIN_OBSIDIAN_EMAIL
  });

  const email = buildTaskRobinMeetingEmail(record);
  const provider = input.provider ?? sendTaskRobinEmailViaResend;
  const sent = await provider(email);
  if (!sent.ok) {
    const failed = await updateMeetingObsidianExportStatus(input.repository, {
      userId: input.userId,
      meetingRecordId: record.id,
      obsidianExportStatus: "failed",
      obsidianEmailTo: email.to
    });
    return { ok: false as const, error: sent.error, record: failed, email };
  }

  const exported = await updateMeetingObsidianExportStatus(input.repository, {
    userId: input.userId,
    meetingRecordId: record.id,
    obsidianExportStatus: "sent_to_taskrobin",
    obsidianExportedAt: input.now ?? new Date().toISOString(),
    obsidianEmailTo: email.to
  });
  return { ok: true as const, record: exported, email, providerMessageId: sent.providerMessageId ?? null };
}
