export const DASHBOARD_SECTION_ORDER = [
  "decisions_needed",
  "people_waiting_on_will",
  "priority_inbox",
  "meeting_prep",
  "strategic_fyis",
  "follow_ups_open_loops",
  "recently_captured",
  "quick_capture",
  "links"
] as const;

export type DashboardSectionKey = (typeof DASHBOARD_SECTION_ORDER)[number];
export type DashboardSource =
  | "manual-capture"
  | "email"
  | "teams"
  | "calendar"
  | "transcript"
  | "document"
  | "taskrobin"
  | "brain"
  | "needs-review";
export type DashboardConfidence = "High" | "Medium" | "Needs Review";
export type DashboardPriority = "P1" | "P2" | "P3" | "Suppressed";
export type DashboardStatus = "Today" | "Priority" | "Waiting On" | "Snoozed" | "Parked" | "Done" | "Dismissed";
export type PrepLevel = "light" | "standard" | "deep";

export type ChiefOfStaffCard = {
  id: string;
  title: string;
  type: "priority" | "decision" | "follow_up" | "waiting_on" | "fyi" | "captured";
  status: DashboardStatus;
  priority: DashboardPriority;
  confidence: DashboardConfidence;
  source: DashboardSource;
  sourceAnchor: string;
  createdAt: string;
  updatedAt: string;
  reason: string;
  description: string;
  recommendedAction: string;
  sourceSummary: string;
  sourceHref?: string | null;
  dueDate?: string | null;
  counterparty?: string | null;
  expectedOutcome?: string | null;
  options?: string[];
  relatedMeetingId?: string | null;
  tags?: string[];
};

export type PreparedBriefSection = {
  label: string;
  body: string;
};

export type PreparedBrief = {
  id: string;
  meetingId: string;
  meetingTitle: string;
  startsAt: string;
  level: PrepLevel;
  confidence: DashboardConfidence;
  source: DashboardSource;
  sourceAnchor: string;
  whyShown: string;
  sourceSummary: string;
  sourceHref?: string | null;
  sections: PreparedBriefSection[];
  recommendedAction: string;
};

export type MeetingPrepCandidate = {
  id: string;
  meetingId: string;
  meetingTitle: string;
  startsAt: string;
  confidence: DashboardConfidence;
  source: DashboardSource;
  sourceAnchor: string;
  whyShown: string;
  sourceSummary: string;
  sourceHref?: string | null;
  availableSources: string[];
  suggestedPrepLevel: PrepLevel;
  recommendedAction: string;
  unusualTrigger: string;
};

export type ChiefOfStaffDashboardData = {
  decisionsNeeded: ChiefOfStaffCard[];
  peopleWaitingOnWill: ChiefOfStaffCard[];
  priorityInboxItems: ChiefOfStaffCard[];
  preparedBriefs: PreparedBrief[];
  prepCandidates: MeetingPrepCandidate[];
  strategicFyis: ChiefOfStaffCard[];
  followUpsOpenLoops: ChiefOfStaffCard[];
  recentlyCaptured: ChiefOfStaffCard[];
  lowValueNoiseFiltered: {
    count: number;
    label: string;
  };
  emptyStates: {
    decisionsNeeded: string;
    peopleWaitingOnWill: string;
    priorityInboxItems: string;
    meetingPrep: string;
    strategicFyis: string;
    followUpsOpenLoops: string;
    recentlyCaptured: string;
  };
  links: {
    brainHref: string;
    vaultSearchHref: string;
    investmentAgentHref: string;
  };
};

export type WaitingOnOverride = {
  counterparty: string;
  expectedOutcome: string;
};

export type ReviewRecord = {
  status?: Exclude<DashboardStatus, "Today" | "Priority">;
  snoozeUntil?: string | null;
  waitingOn?: WaitingOnOverride | null;
  promotedPrepLevel?: PrepLevel | null;
  ignoredPrep?: boolean;
};

export type DashboardReviewState = Record<string, ReviewRecord>;

export type DashboardAction =
  | { type: "done"; id: string }
  | { type: "dismiss"; id: string }
  | { type: "park"; id: string }
  | { type: "snooze"; id: string; until: string }
  | { type: "move_to_waiting_on"; id: string; counterparty: string; expectedOutcome: string }
  | { type: "prepare_candidate"; id: string; level: PrepLevel }
  | { type: "ignore_candidate"; id: string }
  | { type: "complete_prepared_brief"; id: string };

export type DerivedDashboardView = {
  sectionOrder: DashboardSectionKey[];
  decisionsNeeded: ChiefOfStaffCard[];
  peopleWaitingOnWill: ChiefOfStaffCard[];
  peopleWaitingOnWillCount: number;
  priorityInboxItems: ChiefOfStaffCard[];
  preparedBriefs: PreparedBrief[];
  prepCandidates: MeetingPrepCandidate[];
  strategicFyis: ChiefOfStaffCard[];
  followUpsOpenLoops: ChiefOfStaffCard[];
  recentlyCaptured: ChiefOfStaffCard[];
  lowValueNoiseFiltered: ChiefOfStaffDashboardData["lowValueNoiseFiltered"];
};

export function formatDashboardSource(source: DashboardSource) {
  switch (source) {
    case "manual-capture":
      return "Manual capture";
    case "taskrobin":
      return "TaskRobin";
    case "needs-review":
      return "Needs Review";
    default:
      return source.charAt(0).toUpperCase() + source.slice(1);
  }
}

function isActiveSnooze(record: ReviewRecord | undefined, nowIso: string) {
  if (!record?.snoozeUntil) {
    return false;
  }

  const now = Date.parse(nowIso);
  const snoozeUntil = Date.parse(record.snoozeUntil);
  return !Number.isNaN(now) && !Number.isNaN(snoozeUntil) && snoozeUntil > now;
}

function isHiddenByReviewState(record: ReviewRecord | undefined, nowIso: string) {
  if (!record) {
    return false;
  }

  if (record.status === "Done" || record.status === "Dismissed" || record.status === "Parked") {
    return true;
  }

  return isActiveSnooze(record, nowIso);
}

function buildBriefSections(candidate: MeetingPrepCandidate, level: PrepLevel): PreparedBriefSection[] {
  const sharedSections: PreparedBriefSection[] = [
    {
      label: "Objective",
      body: candidate.recommendedAction
    },
    {
      label: "Attendees",
      body: candidate.sourceSummary
    },
    {
      label: "Recent context",
      body: candidate.whyShown
    },
    {
      label: "Talking points",
      body: "1. Confirm what matters now.\n2. Surface the one decision or unblock.\n3. Leave with the next owner and next step."
    },
    {
      label: "Sources",
      body: candidate.availableSources.join(" · ")
    }
  ];

  if (level === "light") {
    return sharedSections;
  }

  const standardSections: PreparedBriefSection[] = [
    ...sharedSections,
    {
      label: "Likely decisions",
      body: "Clarify whether a decision is required in the meeting and what must be confirmed immediately after."
    },
    {
      label: "Commitments and open loops",
      body: "Track the explicit owner, expected outcome, and what should move to Waiting On afterward."
    },
    {
      label: "Related sources",
      body: `${candidate.sourceAnchor}\n${candidate.availableSources.join("\n")}`
    }
  ];

  if (level === "standard") {
    return standardSections;
  }

  return [
    ...standardSections,
    {
      label: "Relationship context",
      body: "Note the stakeholder dynamic, what they likely care about, and what should stay out of the meeting unless it materially changes the read."
    },
    {
      label: "Risks and tensions",
      body: candidate.unusualTrigger
    },
    {
      label: "Strategic context",
      body: "Keep the meeting tied to the current executive priority instead of broad background or status theater."
    },
    {
      label: "Historical notes",
      body: "Use only source-grounded history already available in the repo surface. Do not invent narrative continuity."
    }
  ];
}

export function createPreparedBrief(candidate: MeetingPrepCandidate, level: PrepLevel): PreparedBrief {
  return {
    id: `${candidate.id}::prepared`,
    meetingId: candidate.meetingId,
    meetingTitle: candidate.meetingTitle,
    startsAt: candidate.startsAt,
    level,
    confidence: candidate.confidence,
    source: candidate.source,
    sourceAnchor: candidate.sourceAnchor,
    whyShown: candidate.whyShown,
    sourceSummary: candidate.sourceSummary,
    sourceHref: candidate.sourceHref,
    sections: buildBriefSections(candidate, level),
    recommendedAction: `Review the ${level} prep brief before the meeting.`
  };
}

export function applyDashboardAction(state: DashboardReviewState, action: DashboardAction): DashboardReviewState {
  const next = { ...state };
  const current = next[action.id] ?? {};

  switch (action.type) {
    case "done":
      next[action.id] = { ...current, status: "Done" };
      return next;
    case "dismiss":
      next[action.id] = { ...current, status: "Dismissed" };
      return next;
    case "park":
      next[action.id] = { ...current, status: "Parked" };
      return next;
    case "snooze":
      next[action.id] = { ...current, status: "Snoozed", snoozeUntil: action.until };
      return next;
    case "move_to_waiting_on":
      next[action.id] = {
        ...current,
        status: "Waiting On",
        waitingOn: {
          counterparty: action.counterparty,
          expectedOutcome: action.expectedOutcome
        }
      };
      return next;
    case "prepare_candidate":
      next[action.id] = { ...current, promotedPrepLevel: action.level, ignoredPrep: false };
      return next;
    case "ignore_candidate":
      next[action.id] = { ...current, ignoredPrep: true, status: "Dismissed" };
      return next;
    case "complete_prepared_brief":
      next[action.id] = { ...current, status: "Done" };
      return next;
  }
}

function toWaitingOnCard(card: ChiefOfStaffCard, override: WaitingOnOverride | null | undefined): ChiefOfStaffCard {
  return {
    ...card,
    status: "Waiting On",
    type: "waiting_on",
    counterparty: override?.counterparty ?? card.counterparty ?? "Counterparty needs to be confirmed",
    expectedOutcome: override?.expectedOutcome ?? card.expectedOutcome ?? "Expected outcome needs to be confirmed",
    recommendedAction: "Check when the trigger arrives instead of carrying it in the top layer."
  };
}

function deriveCardList(cards: ChiefOfStaffCard[], reviewState: DashboardReviewState, nowIso: string) {
  const visible: ChiefOfStaffCard[] = [];
  const waitingOn: ChiefOfStaffCard[] = [];

  for (const card of cards) {
    const record = reviewState[card.id];

    if (record?.status === "Waiting On") {
      waitingOn.push(toWaitingOnCard(card, record.waitingOn));
      continue;
    }

    if (isHiddenByReviewState(record, nowIso)) {
      continue;
    }

    visible.push(card);
  }

  return { visible, waitingOn };
}

export function deriveDashboardView(
  data: ChiefOfStaffDashboardData,
  reviewState: DashboardReviewState,
  nowIso: string
): DerivedDashboardView {
  const decisionsNeeded = deriveCardList(data.decisionsNeeded, reviewState, nowIso);
  const priorityInboxItems = deriveCardList(data.priorityInboxItems, reviewState, nowIso);
  const strategicFyis = deriveCardList(data.strategicFyis, reviewState, nowIso);
  const followUpsOpenLoops = deriveCardList(data.followUpsOpenLoops, reviewState, nowIso);
  const recentlyCaptured = deriveCardList(data.recentlyCaptured, reviewState, nowIso);
  const initialPeopleWaiting = deriveCardList(data.peopleWaitingOnWill, reviewState, nowIso);

  const preparedBriefs = [
    ...data.preparedBriefs.filter((brief) => !isHiddenByReviewState(reviewState[brief.id], nowIso)),
    ...data.prepCandidates
      .filter((candidate) => {
        const record = reviewState[candidate.id];
        return Boolean(record?.promotedPrepLevel) && !isHiddenByReviewState(record, nowIso);
      })
      .map((candidate) => createPreparedBrief(candidate, reviewState[candidate.id]?.promotedPrepLevel ?? "light"))
  ].sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));

  const prepCandidates = data.prepCandidates
    .filter((candidate) => {
      const record = reviewState[candidate.id];

      if (record?.promotedPrepLevel || record?.ignoredPrep) {
        return false;
      }

      return !isHiddenByReviewState(record, nowIso);
    })
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));

  const peopleWaitingOnWill = [
    ...initialPeopleWaiting.visible,
    ...decisionsNeeded.waitingOn,
    ...priorityInboxItems.waitingOn,
    ...followUpsOpenLoops.waitingOn
  ];

  return {
    sectionOrder: [...DASHBOARD_SECTION_ORDER],
    decisionsNeeded: decisionsNeeded.visible.slice(0, 3),
    peopleWaitingOnWill: peopleWaitingOnWill.slice(0, 3),
    peopleWaitingOnWillCount: peopleWaitingOnWill.length,
    priorityInboxItems: priorityInboxItems.visible.slice(0, 5),
    preparedBriefs,
    prepCandidates,
    strategicFyis: strategicFyis.visible.slice(0, 3),
    followUpsOpenLoops: followUpsOpenLoops.visible.slice(0, 4),
    recentlyCaptured: recentlyCaptured.visible.slice(0, 4),
    lowValueNoiseFiltered: data.lowValueNoiseFiltered
  };
}
