import Link from "next/link";

import { researchMeetingContextAction } from "@/app/meetings/actions";
import { CompactExecutiveList, type CompactExecutiveListItem } from "@/components/today/compact-executive-list";
import { ExecutiveCockpitSection } from "@/components/today/executive-cockpit-section";
import { GlanceChip } from "@/components/today/glance-chip";
import { PageIntro } from "@/components/shell/page-intro";
import { meetingCalendarEventIdFromBriefItemId, type MeetingRecordStatusSummary } from "@/lib/meetings/meeting-records";
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
        const calendarEventId = meetingCalendarEventIdFromBriefItemId(item.id);
        const indicators = meetingStatusIndicators(meetingRecordStatuses[calendarEventId] ?? null);
        return (
          <details
            key={item.id}
            className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4"
          >
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-6 text-text">{item.title}</p>
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
                  <input type="hidden" name="calendarSourceSystemId" value="executive_brief" />
                  <input type="hidden" name="title" value={item.title} />
                  <input type="hidden" name="descriptionSummary" value={item.summary ?? ""} />
                  <button
                    type="submit"
                    className="rounded-full border border-line/75 bg-white/70 px-3 py-1.5 text-xs font-medium text-text-muted transition hover:bg-white hover:text-text"
                  >
                    Research Context
                  </button>
                </form>
              </div>
            </summary>

            <div className="mt-4 border-t border-line/60 pt-4">
              <p className="section-label">Calendar Event Details</p>
              {item.summary ? <p className="mt-3 text-sm leading-6 text-text-muted">{item.summary}</p> : null}
              {item.actionLabel ? (
                <p className="mt-3 rounded-[0.9rem] bg-[rgba(248,246,240,0.9)] px-3 py-2 text-xs leading-5 text-text-muted">
                  Action: {item.actionLabel}
                </p>
              ) : null}
              {item.meta.length > 0 ? (
                <p className="mt-3 text-[12px] leading-5 text-text-subtle">{item.meta.join(" · ")}</p>
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

export default async function TodayPage() {
  const todayData = await getTodayPageData();

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
                {lane.id === "calendar_meetings" ? (
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
