import Link from "next/link";

import { createTaskFromBriefCandidateAction } from "@/app/brief/actions";
import {
  createTaskFromMeetingCandidateAction,
  researchMeetingContextAction,
  saveMeetingToObsidianAction
} from "@/app/meetings/actions";
import { MeetingResearchSummaryPanel } from "@/components/meetings/meeting-research-summary-panel";
import { CompactExecutiveList, type CompactExecutiveListItem } from "@/components/today/compact-executive-list";
import { ExecutiveCockpitSection } from "@/components/today/executive-cockpit-section";
import { GlanceChip } from "@/components/today/glance-chip";
import { PageIntro } from "@/components/shell/page-intro";
import {
  meetingCalendarEventIdFromBriefItemId,
  type MeetingRecordStatusSummary,
  type MeetingTaskCandidate
} from "@/lib/meetings/meeting-records";
import { getTodayPageData } from "@/lib/today";
import type { TodayBriefItem, TodaySourceLane, TodayTaskItem } from "@/lib/today-view-model";

export const dynamic = "force-dynamic";

function briefItemsToCompactList(items: TodayBriefItem[]): CompactExecutiveListItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    href: item.href,
    actionLabel: item.actionLabel,
    meta: item.meta
  }));
}

function tasksToCompactList(items: TodayTaskItem[]): CompactExecutiveListItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.detail,
    href: item.href,
    actionLabel: item.sourcePath === "/brief" ? "Brief task" : null,
    meta: item.sourcePath ? [item.sourcePath] : []
  }));
}

function BriefItemTaskForm({
  item,
  returnTo,
  buttonLabel = "Create Task"
}: {
  item: TodayBriefItem;
  returnTo: string;
  buttonLabel?: string;
}) {
  return (
    <form action={createTaskFromBriefCandidateAction}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="briefItemId" value={item.id} />
      <input type="hidden" name="description" value={item.taskDescription} />
      <input type="hidden" name="nextStep" value={item.taskNextStep ?? ""} />
      <input type="hidden" name="desiredOutcome" value={item.taskDesiredOutcome ?? ""} />
      <input type="hidden" name="priority" value={item.taskPriority ?? "medium"} />
      <input type="hidden" name="source" value={item.taskSource ?? item.sourceLabel ?? "Executive Brief"} />
      <input type="hidden" name="sourceUrl" value={item.sourceHref ?? ""} />
      <input type="hidden" name="sender" value={item.senderLabel ?? ""} />
      <input type="hidden" name="dueAt" value={item.taskDueAt ?? ""} />
      <button
        type="submit"
        className="rounded-full border border-line/75 bg-white/84 px-3 py-1.5 text-xs font-medium text-text transition hover:bg-white"
      >
        {buttonLabel}
      </button>
    </form>
  );
}

function EmailSummaryList({
  items,
  tasks
}: {
  items: TodayBriefItem[];
  tasks: TodayTaskItem[];
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.16em] text-text-subtle">
                {item.senderLabel ?? "Sender unavailable"}
              </p>
              <h4 className="mt-1 text-sm font-medium leading-6 text-text">{item.title}</h4>
              {item.summary ? (
                <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-text-muted">{item.summary}</p>
              ) : null}
              {item.actionLabel ? (
                <p className="mt-2 rounded-[0.9rem] bg-[rgba(248,246,240,0.9)] px-3 py-2 text-xs leading-5 text-text-muted">
                  Next move: {item.actionLabel}
                </p>
              ) : null}
              <p className="mt-3 text-[12px] leading-5 text-text-subtle">
                {[item.sourceQualityLabel, item.sourceLabel, ...item.meta].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className="chip shrink-0">{item.actionLabel ? "Action" : "Email"}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {item.sourceHref ? (
              <a
                href={item.sourceHref}
                className="rounded-full border border-line/75 bg-white/84 px-3 py-1.5 text-xs font-medium text-text transition hover:bg-white"
              >
                Open Source
              </a>
            ) : null}
            {!item.sourceHref ? (
              <a
                href={item.briefHref}
                className="rounded-full border border-line/75 bg-white/70 px-3 py-1.5 text-xs font-medium text-text-muted transition hover:bg-white hover:text-text"
              >
                Open in Brief
              </a>
            ) : null}
            {item.canCreateTask ? <BriefItemTaskForm item={item} returnTo="/" /> : null}
          </div>
        </article>
      ))}

      {tasksToCompactList(tasks).map((item) => (
        <a
          key={`lane-task-${item.id}`}
          href={item.href ?? "#"}
          className="block rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4 transition hover:bg-white/78"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-sm font-medium leading-6 text-text">{item.title}</p>
            <span className="chip shrink-0">Brief task</span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-text-muted">{item.summary}</p>
        </a>
      ))}
    </div>
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
      <p className="section-label">Task Candidates</p>
      {candidates.map((candidate) => {
        const linkedHref = candidate.linkedTaskHref ?? (candidate.linkedTaskId ? `/library/${candidate.linkedTaskId}?from=%2Flibrary%2Ftasks` : null);
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
              <p className="mt-1 text-[11px] uppercase tracking-[0.15em] text-text-subtle">
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
                  <input type="hidden" name="returnTo" value="/" />
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
      <input type="hidden" name="returnTo" value="/" />
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

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }

  return (
    <div className="grid gap-1 rounded-[0.9rem] border border-line/55 bg-white/48 px-3 py-2 sm:grid-cols-[8rem_1fr]">
      <p className="text-[11px] uppercase tracking-[0.16em] text-text-subtle">{label}</p>
      <p className="text-sm leading-5 text-text-muted">{value}</p>
    </div>
  );
}

function attendeeDetail(item: TodayBriefItem) {
  if (item.attendeeLabel) {
    return item.attendeeLabel;
  }

  return item.attendees.length === 0 ? null : `${item.attendees.length} attendees`;
}

function listDetail(values: string[]) {
  return values.length > 0 ? values.join(", ") : null;
}

function MeetingContextList({
  items,
  meetingRecordStatuses
}: {
  items: TodayBriefItem[];
  meetingRecordStatuses: Record<string, MeetingRecordStatusSummary>;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const calendarEventId = item.calendarEventId ?? meetingCalendarEventIdFromBriefItemId(item.id);
        const calendarSourceSystemId = item.calendarSourceSystemId ?? "executive_brief";
        const status = meetingRecordStatuses[calendarEventId] ?? null;
        const indicators = meetingStatusIndicators(status);
        return (
          <details
            key={item.id}
            className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4"
          >
            <summary className="cursor-pointer list-none">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-6 text-text">{item.title}</p>
                  <p className="mt-1 text-[12px] leading-5 text-text-subtle">
                    {[item.timeLabel, item.attendeeLabel ?? item.sourceQualityLabel].filter(Boolean).join(" · ")}
                  </p>
                  {indicators.length > 0 ? (
                    <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-text-subtle">
                      {indicators.join(" · ")}
                    </p>
                  ) : null}
                </div>
                <form action={researchMeetingContextAction} className="shrink-0">
                  <input type="hidden" name="returnTo" value="/" />
                  <input type="hidden" name="briefItemId" value={item.id} />
                  <input type="hidden" name="calendarEventId" value={calendarEventId} />
                  <input type="hidden" name="calendarSourceSystemId" value={calendarSourceSystemId} />
                  <input type="hidden" name="title" value={item.title} />
                  <input type="hidden" name="startAt" value={item.startAt ?? ""} />
                  <input type="hidden" name="endAt" value={item.endAt ?? ""} />
                  <input type="hidden" name="timezone" value={item.timezone ?? ""} />
                  <input type="hidden" name="organizerName" value={item.organizerName ?? ""} />
                  <input type="hidden" name="organizerEmail" value={item.organizerEmail ?? ""} />
                  <input type="hidden" name="attendees" value={JSON.stringify(item.attendees)} />
                  <input type="hidden" name="locationOrLink" value={item.locationOrLink ?? item.sourceHref ?? ""} />
                  <input type="hidden" name="descriptionSummary" value={item.descriptionSummary ?? item.summary ?? ""} />
                  <input type="hidden" name="relatedCompanyNames" value={JSON.stringify(item.relatedCompanyNames)} />
                  <input type="hidden" name="relatedPeopleNames" value={JSON.stringify(item.relatedPeopleNames)} />
                  <input type="hidden" name="internalExternalClassification" value={item.internalExternalClassification ?? ""} />
                  <input type="hidden" name="priorityReasons" value={JSON.stringify(item.priorityReasons)} />
                  <input type="hidden" name="sourceRefs" value={JSON.stringify(item.sourceRefs)} />
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
              <p className="section-label">Calendar Event Details</p>
              <div className="mt-3 space-y-2">
                <DetailRow label="Time" value={item.timeLabel} />
                <DetailRow label="Organizer" value={[item.organizerName, item.organizerEmail].filter(Boolean).join(" · ") || null} />
                <DetailRow label="Attendees" value={attendeeDetail(item)} />
                <DetailRow label="Location / Link" value={item.locationOrLink ?? item.sourceHref} />
                <DetailRow label="Summary" value={item.descriptionSummary ?? item.summary} />
                <DetailRow label="Action" value={item.actionLabel} />
                <DetailRow label="Research" value={status?.researchStatus ?? "not researched"} />
                <DetailRow label="Companies" value={listDetail(item.relatedCompanyNames)} />
                <DetailRow label="People" value={listDetail(item.relatedPeopleNames)} />
                <DetailRow label="Classification" value={item.internalExternalClassification} />
                <DetailRow label="Priority Reasons" value={listDetail(item.priorityReasons)} />
                <DetailRow label="Source" value={[item.sourceQualityLabel, item.sourceLabel].filter(Boolean).join(" · ")} />
              </div>
              <MeetingResearchSummaryPanel status={status ?? null} />
              {item.actionLabel ? (
                <p className="mt-3 rounded-[0.9rem] bg-[rgba(248,246,240,0.9)] px-3 py-2 text-xs leading-5 text-text-muted">
                  Action: {item.actionLabel}
                </p>
              ) : null}
              {item.meta.length > 0 ? (
                <p className="mt-3 text-[12px] leading-5 text-text-subtle">{item.meta.join(" · ")}</p>
              ) : null}
              {status ? (
                <>
                  <MeetingTaskCandidateList candidates={status.taskCandidates} meetingRecordId={status.id} />
                  <MeetingObsidianExportControl status={status} meetingRecordId={status.id} />
                </>
              ) : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function sourceLaneTitle(lane: TodaySourceLane) {
  switch (lane.id) {
    case "calendar_meetings":
      return "Meeting context from the latest brief.";
    case "teams":
      return "Internal urgency and coordination.";
    case "email":
    default:
      return "Priority asks, decisions, and follow-up.";
  }
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function sanitizeFlashMessage(value?: string) {
  return value?.replace(/-/g, " ").replace(/\b\w/g, (match) => match.toUpperCase()) ?? null;
}

type TodayPageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const [{ notice, error }, todayData] = await Promise.all([searchParams, getTodayPageData()]);
  const successMessage = sanitizeFlashMessage(notice);
  const errorMessage = sanitizeFlashMessage(error);

  if (!todayData) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <PageIntro
          eyebrow="Today"
          title="Executive operating surface."
          description="Sign in to see the current Executive Brief, open tasks, and day-level operating context."
        />
      </div>
    );
  }

  const briefFreshness = todayData.briefFreshness;
  const emailLane = todayData.sourceLanes.find((lane) => lane.id === "email");
  const calendarLane = todayData.sourceLanes.find((lane) => lane.id === "calendar_meetings");
  const teamsLane = todayData.sourceLanes.find((lane) => lane.id === "teams");

  return (
    <div className="space-y-8 lg:space-y-10">
      <PageIntro
        eyebrow="Today"
        title="Executive operating surface."
        description="A thin view over the latest Executive Brief snapshot and the current task library."
      />

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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <GlanceChip
          label="Brief freshness"
          value={briefFreshness.label}
          detail={briefFreshness.detail}
          tone={briefFreshness.status === "processed" ? "default" : "protected"}
          href="/brief"
        />
        <GlanceChip
          label="Email"
          value={String((emailLane?.items.length ?? 0) + (emailLane?.tasks.length ?? 0))}
          detail="Priority asks, decisions, and follow-up"
          href="/brief"
        />
        <GlanceChip
          label="Calendar / Meetings"
          value={String(calendarLane?.items.length ?? 0)}
          detail="Meeting context from the latest brief"
          href="/brief"
        />
        <GlanceChip
          label="Teams"
          value={String(teamsLane?.items.length ?? 0)}
          detail="Internal urgency and coordination"
          tone="quiet"
          href="/brief"
        />
      </section>

      {todayData.emptyState ? (
        <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="section-label">Executive Brief status</p>
              <h3 className="mt-3 text-[1.25rem] font-semibold tracking-[-0.02em] text-text">
                {todayData.emptyState.title}
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">{todayData.emptyState.detail}</p>
            </div>
            <Link href="/brief" className="text-sm font-medium text-text-muted transition hover:text-text">
              Open full brief
            </Link>
          </div>
        </section>
      ) : null}

      {todayData.sourceLanes.length > 0 ? (
        <section className="space-y-4">
          {todayData.sourceLanes.map((lane) => {
            const laneItems = [
              ...briefItemsToCompactList(lane.items),
              ...tasksToCompactList(lane.tasks).map((item) => ({
                ...item,
                id: `lane-task-${item.id}`
              }))
            ];

            return (
              <ExecutiveCockpitSection
                key={lane.id}
                eyebrow={lane.label}
                title={sourceLaneTitle(lane)}
                count={countLabel(laneItems.length, "item")}
                statusNote={
                  lane.id === "email" && todayData.openTasks.length > 0
                    ? "Brief-created tasks are included when available."
                    : undefined
                }
              >
                {lane.id === "email" ? (
                  <EmailSummaryList items={lane.items} tasks={lane.tasks} />
                ) : lane.id === "calendar_meetings" ? (
                  <MeetingContextList items={lane.items} meetingRecordStatuses={todayData.meetingRecordStatuses} />
                ) : (
                  <CompactExecutiveList items={laneItems} emptyState="" />
                )}
              </ExecutiveCockpitSection>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
