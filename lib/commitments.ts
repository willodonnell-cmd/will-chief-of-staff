import { listLibraryItems, type LibraryItemSummary, type LibraryTaskPriority } from "@/lib/capture-library";

const COMMITMENTS_DUE_SOON_WINDOW_MS = 1000 * 60 * 60 * 24 * 3;
const COMPLETED_COMMITMENTS_LIMIT = 6;

type CommitmentTone = "overdue" | "soon" | "active" | "quiet";

export type CommitmentItem = {
  id: string;
  title: string;
  summary: string;
  href: string;
  stateLabel: string;
  dueLabel: string;
  activityLabel: string;
  priorityLabel: string | null;
  tone: CommitmentTone;
};

export type CommitmentsPageData = {
  overview: {
    title: string;
    summary: string;
    href: string;
    stateLabel: string;
    timingLabel: string;
    activityLabel: string;
    priorityLabel: string;
    posture: string;
    sourceNote: string;
    metrics: Array<{
      label: string;
      value: string;
      tone: "default" | "quiet" | "alert";
    }>;
  } | null;
  sections: {
    overdue: CommitmentItem[];
    dueSoon: CommitmentItem[];
    upcomingLater: CommitmentItem[];
    activeNoDue: CommitmentItem[];
    completed: CommitmentItem[];
  };
};

function dueAtTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatTimestamp(value: string | null, options?: Intl.DateTimeFormatOptions) {
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
    minute: "2-digit",
    ...options
  }).format(date);
}

function priorityRank(priority: LibraryTaskPriority | null | undefined) {
  if (priority === "high") {
    return 3;
  }

  if (priority === "medium") {
    return 2;
  }

  if (priority === "low") {
    return 1;
  }

  return 0;
}

function compareByPriority(left: LibraryItemSummary, right: LibraryItemSummary) {
  return priorityRank(right.task?.priority) - priorityRank(left.task?.priority);
}

function compareByLastActiveDesc(left: LibraryItemSummary, right: LibraryItemSummary) {
  return Date.parse(right.lastActiveAt) - Date.parse(left.lastActiveAt);
}

function compareByDueAtAsc(left: LibraryItemSummary, right: LibraryItemSummary) {
  const leftDueAt = dueAtTimestamp(left.task?.dueAt ?? left.dueAt) ?? Number.POSITIVE_INFINITY;
  const rightDueAt = dueAtTimestamp(right.task?.dueAt ?? right.dueAt) ?? Number.POSITIVE_INFINITY;

  if (leftDueAt !== rightDueAt) {
    return leftDueAt - rightDueAt;
  }

  const priorityComparison = compareByPriority(left, right);
  if (priorityComparison !== 0) {
    return priorityComparison;
  }

  return compareByLastActiveDesc(left, right);
}

function compareByCompletedAtDesc(left: LibraryItemSummary, right: LibraryItemSummary) {
  const leftCompletedAt = Date.parse(left.completedAt ?? left.lastActiveAt);
  const rightCompletedAt = Date.parse(right.completedAt ?? right.lastActiveAt);

  if (leftCompletedAt !== rightCompletedAt) {
    return rightCompletedAt - leftCompletedAt;
  }

  return compareByLastActiveDesc(left, right);
}

function buildCommitmentHref(id: string) {
  return `/library/${id}?from=%2Fcommitments`;
}

function stateLabelForItem(item: LibraryItemSummary, now: number) {
  if (item.status === "completed") {
    return "Completed";
  }

  const dueAt = dueAtTimestamp(item.task?.dueAt ?? item.dueAt);
  if (dueAt === null) {
    return "Active";
  }

  if (dueAt < now) {
    return "Overdue";
  }

  if (dueAt <= now + COMMITMENTS_DUE_SOON_WINDOW_MS) {
    return "Due soon";
  }

  return "Upcoming";
}

function toneForItem(item: LibraryItemSummary, now: number): CommitmentTone {
  const state = stateLabelForItem(item, now);

  if (state === "Overdue") {
    return "overdue";
  }

  if (state === "Due soon") {
    return "soon";
  }

  if (state === "Completed" || state === "Upcoming") {
    return "quiet";
  }

  return "active";
}

function dueLabelForItem(item: LibraryItemSummary, now: number) {
  const dueAt = item.task?.dueAt ?? item.dueAt;
  const formattedDueAt = formatTimestamp(dueAt);

  if (!formattedDueAt) {
    return item.status === "completed" ? "Completed with no due date" : "No due date";
  }

  if (item.status === "completed") {
    return `Was due ${formattedDueAt}`;
  }

  const dueAtTime = dueAtTimestamp(dueAt);
  if (dueAtTime !== null && dueAtTime < now) {
    return `Overdue since ${formattedDueAt}`;
  }

  return `Due ${formattedDueAt}`;
}

function activityLabelForItem(item: LibraryItemSummary) {
  if (item.status === "completed") {
    const completedAt = formatTimestamp(item.completedAt);
    if (completedAt) {
      return `Completed ${completedAt}`;
    }
  }

  const lastActiveAt = formatTimestamp(item.lastActiveAt);
  return lastActiveAt ? `Last active ${lastActiveAt}` : "Recent activity unavailable";
}

function priorityLabelForItem(item: LibraryItemSummary) {
  const priority = item.task?.priority;

  if (!priority) {
    return null;
  }

  return `${priority.slice(0, 1).toUpperCase()}${priority.slice(1)} priority`;
}

function mapCommitmentItem(item: LibraryItemSummary, now: number): CommitmentItem {
  return {
    id: item.id,
    title: item.title,
    summary: item.preview,
    href: buildCommitmentHref(item.id),
    stateLabel: stateLabelForItem(item, now),
    dueLabel: dueLabelForItem(item, now),
    activityLabel: activityLabelForItem(item),
    priorityLabel: priorityLabelForItem(item),
    tone: toneForItem(item, now)
  };
}

function postureForSections(sections: CommitmentsPageData["sections"]) {
  if (sections.overdue.length > 0) {
    return sections.overdue.length === 1
      ? "1 overdue commitment currently needs recovery first."
      : `${sections.overdue.length} overdue commitments currently need recovery first.`;
  }

  if (sections.dueSoon.length > 0) {
    return sections.dueSoon.length === 1
      ? "1 commitment is due inside the next 72 hours."
      : `${sections.dueSoon.length} commitments are due inside the next 72 hours.`;
  }

  if (sections.activeNoDue.length > 0) {
    return sections.activeNoDue.length === 1
      ? "1 active commitment is moving without a due date yet."
      : `${sections.activeNoDue.length} active commitments are moving without a due date yet.`;
  }

  if (sections.upcomingLater.length > 0) {
    return sections.upcomingLater.length === 1
      ? "1 commitment is dated, but not near-term."
      : `${sections.upcomingLater.length} commitments are dated, but not near-term.`;
  }

  if (sections.completed.length > 0) {
    return "No active commitments are currently surfaced; only recent completions remain in view.";
  }

  return "No canonical task commitments are in the library yet.";
}

export async function getCommitmentsPageData(now = Date.now()): Promise<CommitmentsPageData> {
  const tasks = await listLibraryItems({
    scope: "tasks",
    mode: "tasks",
    view: null,
    search: "",
    type: "task",
    status: "all",
    priority: "all",
    due: "all",
    category: "all"
  });

  const overdue = tasks
    .filter((item) => item.status !== "completed")
    .filter((item) => {
      const dueAt = dueAtTimestamp(item.task?.dueAt ?? item.dueAt);
      return dueAt !== null && dueAt < now;
    })
    .sort(compareByDueAtAsc);

  const dueSoon = tasks
    .filter((item) => item.status !== "completed")
    .filter((item) => {
      const dueAt = dueAtTimestamp(item.task?.dueAt ?? item.dueAt);
      return dueAt !== null && dueAt >= now && dueAt <= now + COMMITMENTS_DUE_SOON_WINDOW_MS;
    })
    .sort(compareByDueAtAsc);

  const upcomingLater = tasks
    .filter((item) => item.status !== "completed")
    .filter((item) => {
      const dueAt = dueAtTimestamp(item.task?.dueAt ?? item.dueAt);
      return dueAt !== null && dueAt > now + COMMITMENTS_DUE_SOON_WINDOW_MS;
    })
    .sort(compareByDueAtAsc);

  const activeNoDue = tasks
    .filter((item) => item.status !== "completed")
    .filter((item) => dueAtTimestamp(item.task?.dueAt ?? item.dueAt) === null)
    .sort((left, right) => {
      const priorityComparison = compareByPriority(left, right);
      if (priorityComparison !== 0) {
        return priorityComparison;
      }

      return compareByLastActiveDesc(left, right);
    });

  const completed = tasks
    .filter((item) => item.status === "completed")
    .sort(compareByCompletedAtDesc)
    .slice(0, COMPLETED_COMMITMENTS_LIMIT);

  const sections = {
    overdue: overdue.map((item) => mapCommitmentItem(item, now)),
    dueSoon: dueSoon.map((item) => mapCommitmentItem(item, now)),
    upcomingLater: upcomingLater.map((item) => mapCommitmentItem(item, now)),
    activeNoDue: activeNoDue.map((item) => mapCommitmentItem(item, now)),
    completed: completed.map((item) => mapCommitmentItem(item, now))
  };

  const leadItem = overdue[0] ?? dueSoon[0] ?? activeNoDue[0] ?? upcomingLater[0] ?? completed[0] ?? null;

  return {
    overview: leadItem
      ? {
          title: leadItem.title,
          summary: leadItem.preview,
          href: buildCommitmentHref(leadItem.id),
          stateLabel: stateLabelForItem(leadItem, now),
          timingLabel: dueLabelForItem(leadItem, now),
          activityLabel: activityLabelForItem(leadItem),
          priorityLabel: priorityLabelForItem(leadItem) ?? "No explicit priority",
          posture: postureForSections(sections),
          sourceNote: "This page reads directly from canonical Library task objects. Open detail to edit the source item.",
          metrics: [
            {
              label: "Overdue",
              value: String(sections.overdue.length),
              tone: sections.overdue.length > 0 ? "alert" : "quiet"
            },
            {
              label: "Due soon",
              value: String(sections.dueSoon.length),
              tone: sections.dueSoon.length > 0 ? "default" : "quiet"
            },
            {
              label: "Active, no date",
              value: String(sections.activeNoDue.length),
              tone: sections.activeNoDue.length > 0 ? "default" : "quiet"
            }
          ]
        }
      : null,
    sections
  };
}
