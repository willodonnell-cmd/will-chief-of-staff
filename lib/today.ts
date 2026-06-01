import {
  deriveAgentHandoffSourceStatus,
  type AgentHandoffSourceStatus
} from "@/lib/agent-handoff-source-status";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";
import {
  listActiveExecutiveCaptureItems,
  listTodayTasks,
  type LibraryItemSummary
} from "@/lib/capture-library";
import {
  mapChiefOfStaffSignalToExecutiveSignal,
  mapLibraryItemToExecutiveSignal,
  mapPriorityInboxItemToExecutiveSignal
} from "@/lib/executive-work-adapters";
import { listInitiativeOptions } from "@/lib/initiatives";
import { loadLocalAgentProducedMicrosoft365SignalEnvelopeWithSource } from "@/lib/microsoft-signal-intake";
import { listPriorityInboxItems } from "@/lib/priority-inbox-store";
import type { PriorityInboxRecommendedAction } from "@/lib/priority-inbox";
import {
  loadTodayCalendarSignalsWithStatus,
  resolveTodayMicrosoftSourceMode,
  shouldSuppressAgentCalendarSignal,
  type TodayCalendarSourceStatus,
  type TodayMicrosoftSourceMode
} from "@/lib/today-calendar-signals";
import {
  buildTodayExecutiveLeverageViewModel,
  type TodayExecutiveLeverageViewModel
} from "@/lib/today-executive-leverage";

type TaskRadarItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

export type TodayPageData = {
  glanceItems: Array<{
    label: string;
    value: string;
    tone?: "default" | "quiet" | "protected";
    href?: string;
  }>;
  highFocus: {
    title: string;
    summary: string;
    owner: string;
    timing: string;
    decision: string;
    href: string;
  } | null;
  quietPanel: {
    eyebrow: string;
    title: string;
    items: Array<{ label: string; detail: string; href?: string }>;
  } | null;
  inboxSummary: {
    needsReview: number;
    highPriority: number;
  } | null;
  taskSections: {
    overdue: TaskRadarItem[];
    dueSoon: TaskRadarItem[];
  };
  calendarSourceStatus?: TodayCalendarSourceStatus;
  microsoftSourceMode?: TodayMicrosoftSourceMode;
  agentHandoffSourceStatus?: AgentHandoffSourceStatus;
  executiveLeverage?: TodayExecutiveLeverageViewModel;
};

function recommendedActionLabel(action: PriorityInboxRecommendedAction): string {
  switch (action) {
    case "create_task":
      return "Create a task";
    case "add_commitment":
      return "Add a commitment";
    case "save_reference":
      return "Save as reference";
    case "mark_handled":
      return "Mark handled";
    case "defer":
      return "Defer this item";
    default:
      return "Review this item";
  }
}

function formatTaskTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function mapTodayTaskItem(item: LibraryItemSummary, kind: "overdue" | "dueSoon"): TaskRadarItem {
  const timingLabel = item.dueAt
    ? kind === "overdue"
      ? `Overdue since ${formatTaskTimestamp(item.dueAt)}`
      : `Due ${formatTaskTimestamp(item.dueAt)}`
    : "No due date";
  const priorityLabel = item.task?.priority
    ? `${item.task.priority.slice(0, 1).toUpperCase()}${item.task.priority.slice(1)} priority`
    : null;

  return {
    id: item.id,
    title: item.title,
    detail: [timingLabel, priorityLabel].filter(Boolean).join(" · "),
    href: `/library/${item.id}?from=%2F`
  };
}

export async function getTodayPageData(): Promise<TodayPageData | null> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return null;
  }

  const [inboxItems, initiatives, taskSections, executiveCaptureItems, agentEnvelopeResult, liveCalendarResult] =
    await Promise.all([
    listPriorityInboxItems(),
    listInitiativeOptions(),
    listTodayTasks(),
    listActiveExecutiveCaptureItems(),
    loadLocalAgentProducedMicrosoft365SignalEnvelopeWithSource().catch(() => null),
    loadTodayCalendarSignalsWithStatus()
    ]);
  const agentSignalEnvelope = agentEnvelopeResult?.envelope ?? null;
  const liveCalendarSignals = liveCalendarResult.signals;

  const taskSignals = [...taskSections.overdue, ...taskSections.dueSoon];
  const taskSignalIds = new Set(taskSignals.map((item) => item.id));
  const executiveCaptureSignals = executiveCaptureItems
    .filter((item) => !taskSignalIds.has(item.id))
    .map((item) => mapLibraryItemToExecutiveSignal(item));
  const mappedAgentSignals = (agentSignalEnvelope?.signals ?? []).map((signal) =>
    mapChiefOfStaffSignalToExecutiveSignal(signal)
  );
  const filteredAgentSignals = mappedAgentSignals.filter(
    (signal) => !shouldSuppressAgentCalendarSignal(signal, liveCalendarSignals)
  );
  const hasAgentHandoff = Boolean(agentSignalEnvelope);
  const executiveSignals = [
    ...inboxItems.map((item) => mapPriorityInboxItemToExecutiveSignal(item)),
    ...taskSignals.map((item) => mapLibraryItemToExecutiveSignal(item)),
    ...executiveCaptureSignals,
    ...liveCalendarSignals,
    ...filteredAgentSignals
  ];
  const executiveLeverage = buildTodayExecutiveLeverageViewModel({
    executiveSignals,
    initiatives,
    generatedAt: new Date().toISOString()
  });
  const calendarSourceStatus: TodayCalendarSourceStatus = {
    ...liveCalendarResult.status,
    liveCalendarVisibleCount: executiveLeverage.meetingSourceAttribution.liveCalendarVisibleCount,
    liveCalendarSurfacedAboveCount: executiveLeverage.meetingSourceAttribution.liveCalendarSurfacedAboveCount
  };
  const microsoftSourceMode = resolveTodayMicrosoftSourceMode({
    hasAgentHandoff,
    calendarSourceStatus,
    liveCalendarSignalCount: liveCalendarSignals.length
  });
  const agentHandoffSourceStatus = deriveAgentHandoffSourceStatus({
    envelope: agentSignalEnvelope
        ? {
          producer: agentSignalEnvelope.producer,
          connectorFamily: agentSignalEnvelope.connectorFamily,
          producedAt: agentSignalEnvelope.producedAt,
          sourceCoverage: agentSignalEnvelope.sourceCoverage,
          signals: agentSignalEnvelope.signals
        }
      : null,
    source: agentEnvelopeResult?.source ?? "missing"
  });

  const highPriorityItems = inboxItems.filter((item) => item.visibleState === "high_priority");
  const needsReviewItems = inboxItems.filter((item) => item.visibleState === "needs_review");
  const protectedCount = inboxItems.filter(
    (item) =>
      item.sensitiveContext &&
      item.visibleState !== "handled" &&
      item.visibleState !== "dismissed"
  ).length;

  const topItem = highPriorityItems[0] ?? needsReviewItems[0] ?? null;

  const glanceItems: TodayPageData["glanceItems"] = [
    {
      label: "Needs decision",
      value: String(highPriorityItems.length + needsReviewItems.length),
      tone: "default",
      href: "/inbox"
    },
    {
      label: "Quietly on track",
      value: String(initiatives.length),
      tone: "quiet",
      href: "/initiatives"
    },
    {
      label: "Protected",
      value: protectedCount > 0 ? String(protectedCount) : "—",
      tone: "protected",
      href: "/inbox"
    }
  ];

  const highFocus: TodayPageData["highFocus"] = topItem
    ? {
        title: topItem.threadTitle,
        summary: topItem.summary,
        owner: topItem.sender,
        timing: topItem.timeLabel,
        decision: recommendedActionLabel(topItem.recommendedAction),
        href: "/inbox"
      }
    : null;

  const quietPanel: TodayPageData["quietPanel"] =
    initiatives.length > 0
      ? {
          eyebrow: "Active initiatives",
          title: "Running in the background.",
          items: initiatives.slice(0, 4).map((initiative) => ({
            label: initiative.title,
            detail: initiative.status === "quiet" ? "Quietly on track" : "Active",
            href: "/initiatives"
          }))
        }
      : null;

  const inboxSummary: TodayPageData["inboxSummary"] =
    highPriorityItems.length + needsReviewItems.length > 0
      ? {
          needsReview: needsReviewItems.length,
          highPriority: highPriorityItems.length
        }
      : null;

  return {
    glanceItems,
    highFocus,
    quietPanel,
    inboxSummary,
    calendarSourceStatus,
    microsoftSourceMode,
    agentHandoffSourceStatus,
    executiveLeverage,
    taskSections: {
      overdue: taskSections.overdue.map((item) => mapTodayTaskItem(item, "overdue")),
      dueSoon: taskSections.dueSoon.map((item) => mapTodayTaskItem(item, "dueSoon"))
    }
  };
}
