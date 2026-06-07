import Link from "next/link";
import { PageIntro } from "@/components/shell/page-intro";
import { CompactExecutiveList, type CompactExecutiveListItem } from "@/components/today/compact-executive-list";
import { ExecutiveCockpitSection } from "@/components/today/executive-cockpit-section";
import { GlanceChip } from "@/components/today/glance-chip";
import { QuietlyHandledDetails } from "@/components/today/quietly-handled-details";
import { TopNextActionCard } from "@/components/today/top-next-action-card";
import { sanitizeDisplayText } from "@/lib/agent-signal-brief";
import {
  getExecutiveRecommendedActionLabel,
  type ExecutiveRecommendedAction
} from "@/lib/executive-work";
import { getTodayPageData } from "@/lib/today";
import {
  getDecisionsSectionStatusNote,
  getMeetingSectionCountLabel,
  getMeetingSectionStatusNote,
  type TodayExecutiveLeverageViewModel
} from "@/lib/today-executive-leverage";

const EMPTY_EXECUTIVE_LEVERAGE: TodayExecutiveLeverageViewModel = {
  generated_at: "",
  topNextBestActions: [],
  consequentialMeetings: [],
  decisionsNeeded: [],
  protectedValueCreation: [],
  opportunityQueue: [],
  delegateWaitingOn: [],
  quietlyHandled: [],
  sourceCounts: {
    work_type: {},
    priority: {},
    source_type: {}
  },
  sectionOverlapCounts: {
    consequentialMeetings: 0,
    decisionsNeeded: 0,
    protectedValueCreation: 0,
    opportunityQueue: 0,
    delegateWaitingOn: 0,
    quietlyHandled: 0
  },
  sectionOverflowCounts: {
    consequentialMeetings: 0,
    decisionsNeeded: 0,
    protectedValueCreation: 0,
    opportunityQueue: 0,
    delegateWaitingOn: 0,
    quietlyHandled: 0
  },
  meetingSourceAttribution: {
    eligibleBySourceType: {},
    visibleBySourceType: {},
    surfacedAboveBySourceType: {},
    liveCalendarVisibleCount: 0,
    liveCalendarSurfacedAboveCount: 0
  },
  crossSectionCounts: {
    meetingItemsInTop3: 0,
    decisionRelevantMeetingsInMeetings: 0,
    decisionRelevantMeetingsInTop3: 0,
    decisionItemsSuppressedBecauseMeetingPrimary: 0,
    totalIcItems: 0,
    icItemsRequiringWillAction: 0,
    icItemsRoutedToIcLaneOnly: 0
  },
  emptyState: {
    title: "No executive leverage signals yet.",
    detail: "Today can stay quiet until decisions, meetings, opportunities, or follow-through signals accumulate."
  }
};

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function actionLabel(value: ExecutiveRecommendedAction | null | undefined) {
  if (!value) {
    return null;
  }

  return getExecutiveRecommendedActionLabel(value);
}

function compactMeta(values: Array<string | null | undefined>) {
  return values
    .map((value) => (value ? sanitizeDisplayText(value) : value))
    .filter((value): value is string => Boolean(value && value.trim()));
}

function countSummary(visible: number, overlap: number, overflow: number, emptyFallback: string) {
  if (visible === 0 && overlap === 0 && overflow === 0) {
    return emptyFallback;
  }

  if (overlap === 0 && overflow === 0) {
    return `${visible} visible`;
  }

  const parts = [`${visible} visible`];

  if (overlap > 0) {
    parts.push(`${overlap} surfaced above`);
  }

  if (overflow > 0) {
    parts.push(`${overflow} kept out of the foreground`);
  }

  return parts.join(" · ");
}

function sectionCountLabel(visible: number, overflow: number) {
  if (overflow > 0) {
    return `${visible} shown`;
  }

  return `${visible} visible`;
}

function sectionStatusNote(overlap: number, overflow: number, overflowLabel: string) {
  if (overlap === 0 && overflow === 0) {
    return undefined;
  }

  const parts: string[] = [];

  if (overlap > 0) {
    parts.push(`${overlap} already surfaced above.`);
  }

  if (overflow > 0) {
    parts.push(`${overflow} more ${overflowLabel} kept out of the foreground.`);
  }

  return parts.join(" ");
}

function decisionSignalSummary(leverage: TodayExecutiveLeverageViewModel) {
  const parts: string[] = [];
  parts.push(`${leverage.decisionsNeeded.length} visible`);

  if (leverage.crossSectionCounts.decisionItemsSuppressedBecauseMeetingPrimary > 0) {
    parts.push(`${leverage.crossSectionCounts.decisionItemsSuppressedBecauseMeetingPrimary} in meetings or Top 3`);
  }

  if (leverage.sectionOverlapCounts.decisionsNeeded > 0) {
    parts.push(`${leverage.sectionOverlapCounts.decisionsNeeded} surfaced above`);
  }

  if (leverage.sectionOverflowCounts.decisionsNeeded > 0) {
    parts.push(`${leverage.sectionOverflowCounts.decisionsNeeded} kept out of the foreground`);
  }

  return parts.join(" · ");
}

function investmentCommitteeSummary(leverage: TodayExecutiveLeverageViewModel) {
  const total = leverage.crossSectionCounts.totalIcItems;
  if (total <= 0) {
    return null;
  }

  const requiresWillAction = leverage.crossSectionCounts.icItemsRequiringWillAction;
  const laneOnly = leverage.crossSectionCounts.icItemsRoutedToIcLaneOnly;
  const parts = [
    `${total} IC ${total === 1 ? "item" : "items"} detected`,
    `${requiresWillAction} ${requiresWillAction === 1 ? "requires" : "require"} Will action`
  ];

  if (laneOnly > 0) {
    parts.push(`${laneOnly} kept in the IC lane`);
  }

  return parts.join(" · ");
}

export default async function TodayPage() {
  const todayData = await getTodayPageData();

  if (!todayData) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <PageIntro
          eyebrow="Today"
          title="Executive leverage cockpit."
          description="Sign in to see the decisions, opportunities, meetings, delegation, and strategic work that need attention now."
        />
      </div>
    );
  }

  const leverage = todayData.executiveLeverage ?? EMPTY_EXECUTIVE_LEVERAGE;
  const calendarSourceStatus = todayData.calendarSourceStatus;
  const microsoftSourceMode = todayData.microsoftSourceMode;
  const totalDecisionSignals =
    leverage.decisionsNeeded.length +
    leverage.crossSectionCounts.decisionItemsSuppressedBecauseMeetingPrimary +
    leverage.sectionOverlapCounts.decisionsNeeded +
    leverage.sectionOverflowCounts.decisionsNeeded;
  const totalOpportunitySignals =
    leverage.opportunityQueue.length +
    leverage.sectionOverlapCounts.opportunityQueue +
    leverage.sectionOverflowCounts.opportunityQueue;
  const totalQuietSignals =
    leverage.quietlyHandled.length +
    leverage.sectionOverlapCounts.quietlyHandled +
    leverage.sectionOverflowCounts.quietlyHandled;
  const totalSuppressedQuietSignals =
    leverage.quietlyHandled.length + leverage.sectionOverflowCounts.quietlyHandled;
  const icSummary = investmentCommitteeSummary(leverage);
  const trustRow = [
    {
      label: "Visible now",
      value: `${leverage.topNextBestActions.length} foreground`,
      detail: "Top actions on the command surface",
      tone: "default" as const
    },
    {
      label: "Decision signals",
      value: `${totalDecisionSignals} total`,
      detail:
        totalDecisionSignals > 0
          ? decisionSignalSummary(leverage)
          : "No decision signals",
      tone: "default" as const
    },
    {
      label: "Opportunity signals",
      value: `${totalOpportunitySignals} total`,
      detail: countSummary(
        leverage.opportunityQueue.length,
        leverage.sectionOverlapCounts.opportunityQueue,
        leverage.sectionOverflowCounts.opportunityQueue,
        "No opportunity signals"
      ),
      tone: "quiet" as const
    },
    {
      label: "Quiet signals",
      value: `${totalQuietSignals} total`,
      detail: countSummary(
        leverage.quietlyHandled.length,
        leverage.sectionOverlapCounts.quietlyHandled,
        leverage.sectionOverflowCounts.quietlyHandled,
        "No quiet signals"
      ),
      tone: "protected" as const
    }
  ];

  const meetingItems: CompactExecutiveListItem[] = leverage.consequentialMeetings.map((item) => ({
    id: item.id,
    title: item.title,
    summary: sanitizeDisplayText(item.summary || item.why_consequential),
    actionLabel: actionLabel(item.recommended_action),
    href: item.href ?? null,
    meta: compactMeta([item.source_label_compact, formatTimestamp(item.meeting_time)])
  }));
  const meetingStatusNote = getMeetingSectionStatusNote({
    meetingSourceAttribution: leverage.meetingSourceAttribution,
    microsoftSourceMode,
    calendarSourceStatus,
    surfacedAboveCount: leverage.crossSectionCounts.meetingItemsInTop3,
    overflowCount: leverage.sectionOverflowCounts.consequentialMeetings
  });
  const compactMeetingState =
    leverage.crossSectionCounts.meetingItemsInTop3 > 0
      ? leverage.crossSectionCounts.meetingItemsInTop3 === 1
        ? "1 meeting item is already in Top 3."
        : `${leverage.crossSectionCounts.meetingItemsInTop3} meeting items are already in Top 3.`
      : "No meeting-prep items need foreground attention right now.";

  const decisionItems: CompactExecutiveListItem[] = leverage.decisionsNeeded.map((item) => ({
    id: item.id,
    title: item.title,
    summary: sanitizeDisplayText(item.decision_question),
    actionLabel: actionLabel(item.recommended_action),
    href: item.href ?? null,
    meta: compactMeta([
      item.priority ? `${item.priority} priority` : null,
      formatTimestamp(item.deadline)
    ])
  }));

  const protectedValueItems: CompactExecutiveListItem[] = leverage.protectedValueCreation.map((item) => ({
    id: item.id,
    title: item.title,
    summary: sanitizeDisplayText(item.current_focus ?? item.latest_movement ?? "No recent movement surfaced."),
    actionLabel: actionLabel(item.recommended_action),
    href: item.href ?? null,
    meta: compactMeta([
      item.blocker ? `Blocker: ${item.blocker}` : null,
      item.related_signal_count > 0 ? `${item.related_signal_count} related signals` : null
    ])
  }));

  const opportunityItems: CompactExecutiveListItem[] = leverage.opportunityQueue.map((item) => ({
    id: item.id,
    title:
      item.company_or_counterparty && item.company_or_counterparty !== item.title
        ? `${item.company_or_counterparty} · ${item.title}`
        : item.title,
    summary: sanitizeDisplayText(item.strategic_relevance ?? "No strategic relevance note surfaced."),
    actionLabel: item.recommended_action_label,
    href: item.href ?? null,
    meta: compactMeta([formatTimestamp(item.last_touch_at), item.owner])
  }));

  const delegationItems: CompactExecutiveListItem[] = leverage.delegateWaitingOn.map((item) => ({
    id: item.id,
    title: item.title,
    summary: sanitizeDisplayText(item.expected_outcome ?? item.waiting_on ?? "Follow-through is still open."),
    actionLabel: actionLabel(item.recommended_action),
    href: item.href ?? null,
    meta: compactMeta([
      item.delegated_to ? `Delegated to ${item.delegated_to}` : null,
      item.waiting_on ? `Waiting on ${item.waiting_on}` : null,
      formatTimestamp(item.last_touch_at)
    ])
  }));

  return (
    <div className="space-y-8 lg:space-y-10">
      <PageIntro
        eyebrow="Today"
        title="Executive leverage cockpit."
        description="A ranked view of the decisions, opportunities, meetings, delegation, and strategic work that need Will&apos;s attention now."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {trustRow.map((item) => (
          <GlanceChip
            key={item.label}
            label={item.label}
            value={item.value}
            detail={item.detail}
            tone={item.tone}
          />
        ))}
      </section>

      {icSummary ? (
        <Link
          href="/investment-committee"
          className="refined-b block rounded-[1.4rem] px-4 py-3 transition hover:bg-[rgba(255,255,255,0.68)]"
        >
          <p className="section-label">IC routing</p>
          <p className="mt-2 text-sm leading-6 text-text-muted">{icSummary}</p>
        </Link>
      ) : null}

      <section className="space-y-4">
        <div>
          <p className="section-label">Now</p>
          <h3 className="page-title mt-2 text-[1.9rem] md:text-[2.2rem]">Top 3 next best actions.</h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-text-muted">
            The highest-leverage actions that deserve foreground attention right now.
          </p>
        </div>

        {leverage.topNextBestActions.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <TopNextActionCard item={leverage.topNextBestActions[0]} rank={1} featured />

            <div className="grid gap-4">
              {leverage.topNextBestActions.slice(1).map((item, index) => (
                <TopNextActionCard key={item.id} item={item} rank={index + 2} />
              ))}
            </div>
          </div>
        ) : (
          <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
            <p className="section-label">Now</p>
            <p className="mt-3 text-[1.08rem] font-medium text-text">
              No high-leverage actions need foreground attention right now.
            </p>
          </section>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <p className="section-label">Today&apos;s leverage context</p>
          <h3 className="text-[1.35rem] font-semibold leading-snug tracking-[-0.02em] text-text">
            Meeting context and decisions that shape the day.
          </h3>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ExecutiveCockpitSection
            eyebrow="Meetings & prep"
            title="Upcoming meetings and prep context."
            count={getMeetingSectionCountLabel({
              visibleCount: leverage.consequentialMeetings.length,
              surfacedAboveCount: leverage.crossSectionCounts.meetingItemsInTop3,
              microsoftSourceMode,
              calendarSourceStatus
            })}
            statusNote={meetingStatusNote}
            compact={meetingItems.length === 0}
            className="self-start"
          >
            <CompactExecutiveList
              items={meetingItems}
              emptyState={
                compactMeetingState
              }
            />
          </ExecutiveCockpitSection>

          <ExecutiveCockpitSection
            eyebrow="Decisions needed"
            title="Judgment calls waiting on Will."
            count={sectionCountLabel(leverage.decisionsNeeded.length, leverage.sectionOverflowCounts.decisionsNeeded)}
            statusNote={getDecisionsSectionStatusNote({
              overlapCount: leverage.sectionOverlapCounts.decisionsNeeded,
              overflowCount: leverage.sectionOverflowCounts.decisionsNeeded,
              crossSectionCounts: leverage.crossSectionCounts
            })}
            className="self-start"
          >
            <CompactExecutiveList
              items={decisionItems}
              emptyState={
                leverage.sectionOverlapCounts.decisionsNeeded > 0
                  ? "Decision items that need attention are already surfaced above."
                  : "No decisions are waiting on Will."
              }
            />
          </ExecutiveCockpitSection>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="section-label">Active workstreams</p>
          <h3 className="text-[1.35rem] font-semibold leading-snug tracking-[-0.02em] text-text">
            Strategic motion and opportunity flow.
          </h3>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <ExecutiveCockpitSection
            eyebrow="Protected value creation"
            title="Initiatives that should keep moving."
            count={sectionCountLabel(
              leverage.protectedValueCreation.length,
              leverage.sectionOverflowCounts.protectedValueCreation
            )}
            statusNote={sectionStatusNote(
              leverage.sectionOverlapCounts.protectedValueCreation,
              leverage.sectionOverflowCounts.protectedValueCreation,
              "initiative signals"
            )}
          >
            <CompactExecutiveList
              items={protectedValueItems}
              emptyState={
                leverage.sectionOverlapCounts.protectedValueCreation > 0
                  ? "Initiative movement needing attention is already surfaced above."
                  : "No active initiative movement surfaced."
              }
            />
          </ExecutiveCockpitSection>

          <ExecutiveCockpitSection
            eyebrow="Deal / opportunity queue"
            title="Short queue of opportunities worth watching."
            count={sectionCountLabel(
              leverage.opportunityQueue.length,
              leverage.sectionOverflowCounts.opportunityQueue
            )}
            statusNote={sectionStatusNote(
              leverage.sectionOverlapCounts.opportunityQueue,
              leverage.sectionOverflowCounts.opportunityQueue,
              "opportunity items"
            )}
          >
            <CompactExecutiveList
              items={opportunityItems}
              emptyState={
                leverage.sectionOverlapCounts.opportunityQueue > 0
                  ? "Opportunity items needing attention are already surfaced above."
                  : "No active opportunities surfaced."
              }
            />
          </ExecutiveCockpitSection>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="section-label">Follow-through and noise control</p>
          <h3 className="text-[1.35rem] font-semibold leading-snug tracking-[-0.02em] text-text">
            What is waiting, and what can stay quiet.
          </h3>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.88fr)]">
          <ExecutiveCockpitSection
            eyebrow="Delegate / waiting on"
            title="Open follow-through that still matters."
            count={sectionCountLabel(
              leverage.delegateWaitingOn.length,
              leverage.sectionOverflowCounts.delegateWaitingOn
            )}
            statusNote={sectionStatusNote(
              leverage.sectionOverlapCounts.delegateWaitingOn,
              leverage.sectionOverflowCounts.delegateWaitingOn,
              "waiting items"
            )}
          >
            <CompactExecutiveList
              items={delegationItems}
              emptyState={
                leverage.sectionOverlapCounts.delegateWaitingOn > 0
                  ? "Delegated follow-through requiring attention is already surfaced above."
                  : "No delegated follow-through is waiting."
              }
            />
          </ExecutiveCockpitSection>

          <QuietlyHandledDetails
            items={leverage.quietlyHandled}
            totalCount={totalSuppressedQuietSignals}
            hiddenCount={leverage.sectionOverflowCounts.quietlyHandled}
          />
        </div>
      </section>
    </div>
  );
}
