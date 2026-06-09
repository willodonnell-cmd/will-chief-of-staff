import {
  createTaskFromBriefCandidateAction,
  dismissBriefTaskCandidateAction,
  requestExecutiveBriefRefreshAction
} from "@/app/brief/actions";
import {
  createTaskFromMeetingCandidateAction,
  researchMeetingContextAction,
  saveMeetingToObsidianAction
} from "@/app/meetings/actions";
import type { JsonValue, StructuredExecutiveBriefItem } from "@/lib/brief/executive-brief-snapshots";
import type { ExecutiveBriefPageData, ExecutiveBriefSlot } from "@/lib/brief/load-executive-brief-page-data";
import { MeetingResearchSummaryPanel } from "@/components/meetings/meeting-research-summary-panel";
import {
  briefItemDomId,
  buildStructuredBriefSourceLanes,
  type BriefSourceLaneId,
  type StructuredBriefLaneEntry,
  type StructuredBriefSourceLane
} from "@/lib/brief/source-lanes";
import {
  meetingCalendarEventIdFromBriefItemId,
  type MeetingRecordStatusSummary,
  type MeetingTaskCandidate
} from "@/lib/meetings/meeting-records";

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Waiting";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Waiting";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles"
  }).format(parsed);
}

function formatOptionalTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles"
  }).format(parsed);
}

function BriefSlotCard({ slot }: { slot: ExecutiveBriefSlot }) {
  const snapshot = slot.snapshot;

  return (
    <div className="rounded-[1rem] border border-line/70 bg-white/62 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.62rem] uppercase tracking-[0.2em] text-text-subtle">Slot</p>
          <h3 className="mt-1 text-sm font-semibold tracking-[-0.01em] text-text">{slot.label}</h3>
        </div>
        <span className="rounded-full border border-line/70 bg-white/76 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.14em] text-text-subtle">
          {slot.status === "processed" ? "Processed" : "Waiting"}
        </span>
      </div>
      <p className="mt-3 text-xs font-medium text-text">{snapshot?.displayDate ?? `${slot.itemCount} brief snapshots`}</p>
      <p className="mt-1 text-xs text-text-subtle">{formatTimestamp(slot.processedAt)}</p>
      {snapshot ? (
        <p className="mt-2 line-clamp-1 text-xs leading-5 text-text-muted">{snapshot.subject}</p>
      ) : null}
    </div>
  );
}

function LatestProcessedSnapshotCard({
  latest
}: {
  latest: NonNullable<ExecutiveBriefPageData["latestSnapshot"]>;
}) {
  return (
    <section className="rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Latest processed snapshot</p>
          <h3 className="mt-2 text-[1rem] font-semibold leading-snug tracking-[-0.01em] text-text">
            {latest.displayDate ?? latest.subject}
          </h3>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Processed {formatTimestamp(latest.generatedAt ?? latest.createdAt)} from CloudMailIn.
          </p>
        </div>
        <span className="w-fit rounded-full border border-line/70 bg-white/76 px-3 py-1 text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle">
          {latest.slot}
        </span>
      </div>
    </section>
  );
}

function ExecutiveBriefSummaryDetails({
  latest,
  commandSummary
}: {
  latest: NonNullable<ExecutiveBriefPageData["latestSnapshot"]>;
  commandSummary: string[];
}) {
  return (
    <details
      className="rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4"
      data-brief-section="executive-brief-summary"
    >
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Executive Brief Summary</p>
            <h3 className="mt-1 text-sm font-semibold tracking-[-0.01em] text-text">
              {latest.displayDate ?? latest.subject}
            </h3>
          </div>
          <span className="w-fit rounded-full border border-line/70 bg-white/76 px-3 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-text-subtle">
            Processed {formatTimestamp(latest.generatedAt ?? latest.createdAt)}
          </span>
        </div>
      </summary>

      <div className="mt-4 space-y-4 border-t border-line/60 pt-4">
        <LatestProcessedSnapshotCard latest={latest} />
        {latest.humanBrief ? (
          <section className="rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Summary</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-muted">{latest.humanBrief}</p>
          </section>
        ) : null}

        {commandSummary.length > 0 ? (
          <section className="rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Command summary</p>
            <ul className="mt-3 space-y-2">
              {commandSummary.map((summary) => (
                <li key={summary} className="text-sm leading-6 text-text-muted">
                  {summary}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </details>
  );
}

function sanitizeFlashMessage(value?: string) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/-/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function compactText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function senderLabel(item: StructuredExecutiveBriefItem) {
  const sender = compactText(item.senderName);
  const email = compactText(item.senderEmail);
  if (sender && email && sender.toLowerCase() !== email.toLowerCase()) {
    return `${sender} <${email}>`;
  }

  return sender || email || null;
}

function sourceQualityLabel(item: StructuredExecutiveBriefItem, laneId: BriefSourceLaneId) {
  if (item.sourceUrl) {
    return "Source link available";
  }

  if (laneId === "calendar_meetings" && !item.startAt && !item.attendees?.length) {
    return "Calendar metadata unavailable";
  }

  if (laneId === "email" && !senderLabel(item)) {
    return "Sender unavailable";
  }

  return "Brief-only context";
}

function sourceRefDedupeKey(value: JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, JsonValue>;
  const url = compactText(typeof record.url === "string" ? record.url : null);
  const sourceSystemId = compactText(typeof record.sourceSystemId === "string" ? record.sourceSystemId : null);
  const sourceItemId = compactText(typeof record.sourceItemId === "string" ? record.sourceItemId : null);
  const sourceType = compactText(typeof record.sourceType === "string" ? record.sourceType : null);

  if (url) {
    return `url:${url.toLowerCase()}`;
  }

  if (sourceType && sourceSystemId) {
    return `system:${sourceType.toLowerCase()}:${sourceSystemId.toLowerCase()}`;
  }

  if (sourceType && sourceItemId) {
    return `item:${sourceType.toLowerCase()}:${sourceItemId.toLowerCase()}`;
  }

  return null;
}

function briefLaneEntryDedupeKey(entry: StructuredBriefLaneEntry) {
  if (entry.item.sourceUrl) {
    return `source:${entry.item.sourceUrl.toLowerCase()}`;
  }

  const refKey = (entry.item.sourceRefs ?? []).map(sourceRefDedupeKey).find((value): value is string => Boolean(value));
  return refKey ? `ref:${refKey}` : null;
}

function dedupeBriefLaneEntries(entries: StructuredBriefLaneEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = briefLaneEntryDedupeKey(entry);
    if (!key) {
      return true;
    }

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function BriefItemTaskForm({
  item,
  entryId,
  label = "Create Task"
}: {
  item: StructuredExecutiveBriefItem;
  entryId: string;
  label?: string;
}) {
  const source = [senderLabel(item), compactText(item.sourceLabel) || compactText(item.source)].filter(Boolean).join(" · ");

  return (
    <form action={createTaskFromBriefCandidateAction}>
      <input type="hidden" name="returnTo" value="/brief" />
      <input type="hidden" name="briefItemId" value={entryId} />
      <input type="hidden" name="description" value={item.title} />
      <input type="hidden" name="nextStep" value={item.recommendedAction ?? ""} />
      <input type="hidden" name="desiredOutcome" value={item.summary ?? ""} />
      <input type="hidden" name="priority" value={item.priority ?? "medium"} />
      <input type="hidden" name="source" value={source || item.source || "Executive Brief"} />
      <input type="hidden" name="sourceUrl" value={item.sourceUrl ?? ""} />
      <input type="hidden" name="sender" value={senderLabel(item) ?? ""} />
      <input type="hidden" name="dueAt" value={item.dueAt ?? ""} />
      <button
        type="submit"
        className="rounded-full border border-line/75 bg-white/84 px-3.5 py-2 text-sm font-medium text-text transition hover:bg-white"
      >
        {label}
      </button>
    </form>
  );
}

function StructuredItemCard({
  entry,
  item,
  laneId,
  contextLabel,
  taskCandidate = false,
  snapshotId = null
}: {
  entry: StructuredBriefLaneEntry;
  item: StructuredExecutiveBriefItem;
  laneId: BriefSourceLaneId;
  contextLabel?: string;
  taskCandidate?: boolean;
  snapshotId?: string | null;
}) {
  return (
    <article id={briefItemDomId(entry.id)} className="scroll-mt-6 rounded-[1.15rem] border border-line/70 bg-white/66 px-4 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {laneId === "email" ? (
            <p className="mb-1 text-[0.66rem] uppercase tracking-[0.18em] text-text-subtle">
              {senderLabel(item) ?? "Sender unavailable"}
            </p>
          ) : null}
          <h4 className="text-sm font-semibold leading-5 text-text">{item.title}</h4>
          {item.summary ? <p className="mt-2 text-sm leading-6 text-text-muted">{item.summary}</p> : null}
        </div>
        {item.priority ? (
          <span className="w-fit rounded-full border border-line/70 bg-white/76 px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.16em] text-text-subtle">
            {item.priority}
          </span>
        ) : null}
      </div>

      {item.recommendedAction ? (
        <p className="mt-3 rounded-[0.9rem] bg-[rgba(248,246,240,0.9)] px-3 py-2 text-xs leading-5 text-text-muted">
          Action: {item.recommendedAction}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem] uppercase tracking-[0.16em] text-text-subtle">
        <span>{sourceQualityLabel(item, laneId)}</span>
        {contextLabel ? <span>{contextLabel}</span> : null}
        {item.sourceLabel || item.source ? <span>{item.sourceLabel ?? item.source}</span> : null}
        {item.dueAt ? <span>Due {formatTimestamp(item.dueAt)}</span> : null}
      </div>

      {laneId === "email" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {item.sourceUrl ? (
            <a
              href={item.sourceUrl}
              className="rounded-full border border-line/75 bg-white/84 px-3.5 py-2 text-sm font-medium text-text transition hover:bg-white"
            >
              Open Source
            </a>
          ) : null}
          {!item.sourceUrl ? (
            <a
              href={`#${briefItemDomId(entry.id)}`}
              className="rounded-full border border-line/75 bg-white/70 px-3.5 py-2 text-sm font-medium text-text-muted transition hover:bg-white hover:text-text"
            >
              Open in Brief
            </a>
          ) : null}
          {!taskCandidate ? <BriefItemTaskForm item={item} entryId={entry.id} /> : null}
        </div>
      ) : null}

      {taskCandidate ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <BriefItemTaskForm item={item} entryId={entry.id} label="Create task" />

          {snapshotId ? (
            <form action={dismissBriefTaskCandidateAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="snapshotId" value={snapshotId} />
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="itemTitle" value={item.title} />
              <select
                name="reason"
                defaultValue="not_important"
                className="rounded-full border border-line/75 bg-white/84 px-3 py-2 text-xs text-text-muted outline-none"
                aria-label="Dismiss reason"
              >
                <option value="not_important">Not important</option>
                <option value="already_handled">Already handled</option>
                <option value="not_my_task">Not my task</option>
                <option value="bad_recommendation">Bad recommendation</option>
              </select>
              <button
                type="submit"
                className="rounded-full border border-line/75 bg-white/70 px-3.5 py-2 text-sm font-medium text-text-muted transition hover:bg-white hover:text-text"
              >
                Dismiss
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function meetingStatusIndicators(status: MeetingRecordStatusSummary | null) {
  if (!status) {
    return [];
  }

  return [
    status.researchStatus === "researched" ? "researched" : null,
    status.researchStatus === "researching" ? "researching" : null,
    status.researchStatus === "failed" ? "research failed" : null,
    status.transcriptStatus !== "none" ? "transcript attached" : null,
    status.taskCandidateCount > 0 ? "task candidates available" : null,
    status.obsidianExportStatus === "sent_to_taskrobin" ? "sent to TaskRobin" : null
  ].filter((value): value is string => Boolean(value));
}

function MeetingTaskCandidateList({
  candidates,
  meetingRecordId
}: {
  candidates: MeetingTaskCandidate[];
  meetingRecordId: string;
}) {
  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Task Candidates</p>
      {candidates.map((candidate) => {
        const linkedHref =
          candidate.linkedTaskHref ??
          (candidate.linkedTaskId ? `/library/${candidate.linkedTaskId}?from=%2Flibrary%2Ftasks` : null);
        const statusLabel =
          candidate.status === "already_exists"
            ? "Already Exists"
            : candidate.status === "created"
              ? "Task Created"
              : null;

        return (
          <div
            key={candidate.dedupeKey}
            className="flex flex-col gap-3 rounded-[0.9rem] border border-line/65 bg-white/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium leading-5 text-text">{candidate.title}</p>
              <p className="mt-1 text-[0.62rem] uppercase tracking-[0.16em] text-text-subtle">
                {candidate.taskType.replace(/_/g, " ")}
                {candidate.priority ? ` · ${candidate.priority}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {statusLabel ? (
                <span className="rounded-full border border-line/70 bg-white/76 px-3 py-1.5 text-xs font-medium text-text-muted">
                  {statusLabel}
                </span>
              ) : null}
              {linkedHref ? (
                <a
                  href={linkedHref}
                  className="rounded-full border border-line/75 bg-white/84 px-3 py-1.5 text-xs font-medium text-text transition hover:bg-white"
                >
                  Open Task
                </a>
              ) : (
                <form action={createTaskFromMeetingCandidateAction}>
                  <input type="hidden" name="returnTo" value="/brief" />
                  <input type="hidden" name="meetingRecordId" value={meetingRecordId} />
                  <input type="hidden" name="dedupeKey" value={candidate.dedupeKey} />
                  <button
                    type="submit"
                    className="rounded-full border border-line/75 bg-white/84 px-3 py-1.5 text-xs font-medium text-text transition hover:bg-white"
                  >
                    Create Task
                  </button>
                </form>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MeetingObsidianExportControl({
  status,
  meetingRecordId
}: {
  status: MeetingRecordStatusSummary;
  meetingRecordId: string;
}) {
  if (status.obsidianExportStatus === "sent_to_taskrobin") {
    return (
      <p className="mt-4 rounded-[0.9rem] border border-line/65 bg-white/60 px-3 py-2 text-xs font-medium text-text-muted">
        Sent to TaskRobin for Obsidian capture.
      </p>
    );
  }

  return (
    <form action={saveMeetingToObsidianAction} className="mt-4">
      <input type="hidden" name="returnTo" value="/brief" />
      <input type="hidden" name="meetingRecordId" value={meetingRecordId} />
      <button
        type="submit"
        disabled={status.obsidianExportStatus === "sending"}
        className="rounded-full border border-line/75 bg-white/84 px-3 py-1.5 text-xs font-medium text-text transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status.obsidianExportStatus === "failed" ? "Retry Save to Obsidian" : "Save to Obsidian"}
      </button>
    </form>
  );
}

function attendeeText(value: unknown) {
  if (typeof value === "string") {
    return compactText(value);
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return compactText(typeof record.name === "string" ? record.name : null) || compactText(typeof record.email === "string" ? record.email : null);
  }

  return "";
}

function attendeeLabel(item: StructuredExecutiveBriefItem) {
  const attendees = (item.attendees ?? []).map(attendeeText).filter(Boolean);
  if (attendees.length === 0) {
    return null;
  }

  if (attendees.length > 3) {
    return `Group meeting · ${attendees.length} attendees`;
  }

  return attendees.join(", ");
}

function formatMeetingWindow(item: StructuredExecutiveBriefItem) {
  const start = formatOptionalTimestamp(item.startAt);
  const end = formatOptionalTimestamp(item.endAt);
  if (start && end) {
    return `${start} - ${end}`;
  }

  return start ?? end ?? null;
}

function listDetail(values: string[] | null | undefined) {
  return values && values.length > 0 ? values.join(", ") : null;
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }

  return (
    <div className="grid gap-1 rounded-[0.9rem] border border-line/55 bg-white/48 px-3 py-2 sm:grid-cols-[8rem_1fr]">
      <p className="text-[0.62rem] uppercase tracking-[0.16em] text-text-subtle">{label}</p>
      <p className="text-sm leading-5 text-text-muted">{value}</p>
    </div>
  );
}

function MeetingContextCard({
  entry,
  status
}: {
  entry: StructuredBriefLaneEntry;
  status: MeetingRecordStatusSummary | null;
}) {
  const item = entry.item;
  const calendarEventId = item.calendarEventId ?? meetingCalendarEventIdFromBriefItemId(entry.id);
  const calendarSourceSystemId = item.calendarSourceSystemId ?? "executive_brief";
  const indicators = meetingStatusIndicators(status);

  return (
    <details id={briefItemDomId(entry.id)} className="scroll-mt-6 rounded-[1.15rem] border border-line/70 bg-white/66 px-4 py-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold leading-5 text-text">{item.title}</h4>
            <p className="mt-1 text-xs leading-5 text-text-subtle">
              {[formatMeetingWindow(item), attendeeLabel(item) ?? sourceQualityLabel(item, "calendar_meetings")]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {indicators.length > 0 ? (
              <p className="mt-1 text-[0.62rem] uppercase tracking-[0.16em] text-text-subtle">
                {indicators.join(" · ")}
              </p>
            ) : null}
          </div>
          <form action={researchMeetingContextAction} className="shrink-0">
            <input type="hidden" name="returnTo" value="/brief" />
            <input type="hidden" name="briefItemId" value={entry.id} />
            <input type="hidden" name="calendarEventId" value={calendarEventId} />
            <input type="hidden" name="calendarSourceSystemId" value={calendarSourceSystemId} />
            <input type="hidden" name="title" value={item.title} />
            <input type="hidden" name="startAt" value={item.startAt ?? item.dueAt ?? ""} />
            <input type="hidden" name="endAt" value={item.endAt ?? ""} />
            <input type="hidden" name="timezone" value={item.timezone ?? ""} />
            <input type="hidden" name="organizerName" value={item.organizerName ?? ""} />
            <input type="hidden" name="organizerEmail" value={item.organizerEmail ?? ""} />
            <input type="hidden" name="attendees" value={JSON.stringify(item.attendees ?? [])} />
            <input type="hidden" name="locationOrLink" value={item.locationOrLink ?? item.sourceUrl ?? ""} />
            <input type="hidden" name="descriptionSummary" value={item.descriptionSummary ?? item.summary ?? ""} />
            <input type="hidden" name="relatedCompanyNames" value={JSON.stringify(item.relatedCompanyNames ?? [])} />
            <input type="hidden" name="relatedPeopleNames" value={JSON.stringify(item.relatedPeopleNames ?? [])} />
            <input type="hidden" name="internalExternalClassification" value={item.internalExternalClassification ?? ""} />
            <input type="hidden" name="priorityReasons" value={JSON.stringify(item.priorityReasons ?? [])} />
            <input type="hidden" name="sourceRefs" value={JSON.stringify(item.sourceRefs ?? [])} />
            <button
              type="submit"
              className="rounded-full border border-[rgba(20,29,38,0.24)] bg-[rgb(var(--color-shell))] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[rgb(var(--color-shell))]/90"
            >
              Research Context
            </button>
          </form>
        </div>
      </summary>

      <div className="mt-4 border-t border-line/60 pt-4">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Calendar Event Details</p>
        <div className="mt-3 space-y-2">
          <DetailRow label="Time" value={formatMeetingWindow(item)} />
          <DetailRow label="Organizer" value={[item.organizerName, item.organizerEmail].filter(Boolean).join(" · ") || null} />
          <DetailRow label="Attendees" value={attendeeLabel(item)} />
          <DetailRow label="Location / Link" value={item.locationOrLink ?? item.sourceUrl} />
          <DetailRow label="Summary" value={item.descriptionSummary ?? item.summary} />
          <DetailRow label="Action" value={item.recommendedAction} />
          <DetailRow label="Research" value={status?.researchStatus ?? "not researched"} />
          <DetailRow label="Companies" value={listDetail(item.relatedCompanyNames)} />
          <DetailRow label="People" value={listDetail(item.relatedPeopleNames)} />
          <DetailRow label="Classification" value={item.internalExternalClassification} />
          <DetailRow label="Priority Reasons" value={listDetail(item.priorityReasons)} />
          <DetailRow label="Source" value={[sourceQualityLabel(item, "calendar_meetings"), item.sourceLabel ?? item.source].filter(Boolean).join(" · ")} />
        </div>
        <MeetingResearchSummaryPanel status={status} />
        {status ? (
          <>
            <MeetingTaskCandidateList candidates={status.taskCandidates} meetingRecordId={status.id} />
            <MeetingObsidianExportControl status={status} meetingRecordId={status.id} />
          </>
        ) : null}
      </div>
    </details>
  );
}

function sourceLaneTitle(lane: StructuredBriefSourceLane) {
  switch (lane.id) {
    case "calendar_meetings":
      return "Today and high-priority meeting context.";
    case "teams":
      return "Internal urgency and coordination signals.";
    case "email":
    default:
      return "Priority threads, decisions, follow-ups, and task candidates.";
  }
}

function SourceLaneSection({
  lane,
  snapshotId = null,
  meetingRecordStatuses
}: {
  lane: StructuredBriefSourceLane;
  snapshotId?: string | null;
  meetingRecordStatuses: Record<string, MeetingRecordStatusSummary>;
}) {
  if (lane.entries.length === 0) {
    return null;
  }

  const entries = dedupeBriefLaneEntries(lane.entries);
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">{lane.label}</p>
        <h3 className="mt-1 text-[1rem] font-semibold tracking-[-0.01em] text-text">{sourceLaneTitle(lane)}</h3>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {entries.map((entry) => (
          entry.section === "meetingPrep" ? (
            <MeetingContextCard
              key={entry.id}
              entry={entry}
              status={meetingRecordStatuses[entry.item.calendarEventId ?? meetingCalendarEventIdFromBriefItemId(entry.id)] ?? null}
            />
          ) : (
            <StructuredItemCard
              key={entry.id}
              entry={entry}
              item={entry.item}
              laneId={lane.id}
              contextLabel={entry.sectionLabel}
              taskCandidate={entry.taskCandidate}
              snapshotId={snapshotId}
            />
          )
        ))}
      </div>
    </section>
  );
}

export function ExecutiveBriefWorkspace({
  data,
  notice,
  error
}: {
  data: ExecutiveBriefPageData;
  notice?: string;
  error?: string;
}) {
  const latest = data.latestSnapshot;
  const structuredBrief = latest?.structuredBrief ?? null;
  const visibleTaskCandidates =
    structuredBrief?.taskCandidates.filter((item) => !data.dismissedTaskCandidateIds.includes(item.id)) ?? [];
  const sourceLanes = structuredBrief
    ? buildStructuredBriefSourceLanes({ structuredBrief, taskCandidates: visibleTaskCandidates })
    : [];
  const successMessage = sanitizeFlashMessage(notice);
  const errorMessage = sanitizeFlashMessage(error);

  return (
    <div className="space-y-6">
      {(successMessage || errorMessage) ? (
        <section
          className={`rounded-[1.35rem] border px-4 py-3 text-sm ${
            errorMessage
              ? "border-[rgba(125,35,31,0.18)] bg-[rgba(125,35,31,0.08)] text-[rgb(125,35,31)]"
              : "border-[rgba(36,92,62,0.18)] bg-[rgba(36,92,62,0.08)] text-[rgb(36,92,62)]"
          }`}
        >
          {errorMessage ?? successMessage}
        </section>
      ) : null}

      {latest ? (
        <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
          {structuredBrief ? (
            <div className="space-y-6">
              {sourceLanes.map((lane) => (
                <SourceLaneSection
                  key={lane.id}
                  lane={lane}
                  snapshotId={latest.id}
                  meetingRecordStatuses={data.meetingRecordStatuses}
                />
              ))}

              <ExecutiveBriefSummaryDetails latest={latest} commandSummary={structuredBrief.commandSummary} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[1.25rem] border border-line/70 bg-white/66 px-4 py-4">
                <p className="text-sm font-medium text-text">{latest.subject}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-muted">
                  {latest.humanBrief ?? "No human-readable brief section was found in this bundle."}
                </p>
              </div>
              <LatestProcessedSnapshotCard latest={latest} />
            </div>
          )}

          {latest.validationWarnings.length > 0 ? (
            <div className="mt-4 rounded-[1.1rem] border border-[rgba(170,102,31,0.35)] bg-[rgba(255,250,236,0.82)] px-4 py-3">
              <p className="text-sm leading-6 text-text-muted">{latest.validationWarnings.join(" ")}</p>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded-[1.75rem] border border-dashed border-line/80 bg-white/60 px-5 py-12 text-center md:px-8">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Empty state</p>
          <h3 className="mx-auto mt-3 max-w-2xl text-[1.35rem] font-semibold leading-snug tracking-[-0.02em] text-text">
            {data.emptyState.title}
          </h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-text-muted">{data.emptyState.detail}</p>
        </section>
      )}

      <details className="rounded-[1.25rem] border border-line/70 bg-white/58 px-4 py-4">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Agent-email intake</p>
              <h3 className="mt-1 text-sm font-semibold tracking-[-0.01em] text-text">
                Blackhawk Executive Brief surface
              </h3>
            </div>
            <span className="w-fit rounded-full border border-line/70 bg-white/76 px-3 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-text-subtle">
              Expand status
            </span>
          </div>
        </summary>

        <div className="mt-4 border-t border-line/60 pt-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <p className="max-w-3xl text-sm leading-6 text-text-muted">
              This compact status area tracks processed CloudMailIn brief slots and manual refreshes. The primary page
              content above stays focused on the latest actionable Executive Brief.
            </p>
            <form action={requestExecutiveBriefRefreshAction}>
              <button
                type="submit"
                className="rounded-full border border-line/85 bg-[rgb(var(--color-shell))] px-4 py-2 text-sm font-medium text-white transition hover:bg-[rgb(var(--color-shell))]"
              >
                Run Agent Refresh
              </button>
            </form>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-7">
            {data.slots.map((slot) => (
              <BriefSlotCard key={slot.label} slot={slot} />
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
