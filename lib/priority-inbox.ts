export type PriorityInboxSource = "outlook" | "gmail" | "teams" | "manual" | "forwarded_email";
export type PriorityInboxSourceFilter = "all" | "email" | "teams" | "manual";
export type PriorityInboxVisibleState = "high_priority" | "needs_review" | "deferred" | "handled" | "dismissed";
export type PriorityInboxActiveState = Extract<PriorityInboxVisibleState, "high_priority" | "needs_review">;
export type PriorityInboxIngestionMode = "live_adapter" | "forwarded" | "manual";
export type PriorityInboxDisposition =
  | "source_opened"
  | "deferred"
  | "task_created"
  | "initiative_created"
  | "commitment_created"
  | "reference_saved"
  | "marked_handled"
  | "dismissed";

export type PriorityInboxRecommendedAction =
  | "defer"
  | "create_task"
  | "add_commitment"
  | "save_reference"
  | "mark_handled";

export type PriorityInboxCreatedObjectType = "task" | "commitment" | "initiative" | "reference";
export type PriorityInboxDeferredReason =
  | "not_now"
  | "waiting_for_context"
  | "follow_up_later"
  | "closer_to_meeting"
  | "waiting_for_reply";
export type PriorityInboxDispositionReason =
  | "cold_outreach"
  | "low_value"
  | "irrelevant"
  | "duplicate"
  | "generic_update"
  | "not_actionable"
  | "handled_by_email"
  | "handled_by_phone"
  | "handled_by_text"
  | "handled_in_meeting"
  | "delegated_elsewhere"
  | "no_further_action_needed"
  | "reply_needed"
  | "follow_up_needed"
  | "decision_needed"
  | "relationship_context"
  | "business_context"
  | "waiting_for_more_context";

export type PriorityInboxCreatedObject = {
  id?: string;
  type: PriorityInboxCreatedObjectType;
  title: string;
  href: string;
};

export type PriorityInboxManualAddInput = {
  sourceLink: string;
  sender: string;
  threadTitle: string;
  primaryLine: string;
  summary: string;
  visibleState: Extract<PriorityInboxVisibleState, "high_priority" | "needs_review" | "deferred">;
  whySurfaced: string;
  deferredUntil?: string | null;
  sensitiveContext?: string | null;
};

export type PriorityInboxCanonicalTaskInput = {
  description: string;
  nextStep?: string | null;
  desiredOutcome?: string | null;
  priority?: "high" | "medium" | "low" | null;
  categoryId?: string | null;
  linkedInitiativeId?: string | null;
};

export type PriorityInboxCanonicalCommitmentInput = {
  statement: string;
  owedTo: string;
  dueAt?: string | null;
  dueLabel?: string | null;
  contextNote?: string | null;
};

export type PriorityInboxCanonicalReferenceInput = {
  title: string;
  summary: string;
};

export type PriorityInboxTransitionPayload = {
  nextState: Extract<PriorityInboxVisibleState, "deferred" | "handled" | "dismissed">;
  disposition: PriorityInboxDisposition;
  dispositionLabel: string;
  dispositionReason?: PriorityInboxDispositionReason | null;
  deferredUntil?: string | null;
  deferredLabel?: string | null;
  deferredReason?: PriorityInboxDeferredReason | null;
  createdObject?: PriorityInboxCreatedObject | null;
  canonicalTask?: PriorityInboxCanonicalTaskInput | null;
  canonicalCommitment?: PriorityInboxCanonicalCommitmentInput | null;
  canonicalReference?: PriorityInboxCanonicalReferenceInput | null;
  confirmationExpiresAt?: string | null;
};

export type PriorityInboxTaskPrefill = {
  description: string;
  nextStep: string;
  desiredOutcome: string;
  priority: "high" | "medium" | "low" | null;
  categoryName?: string | null;
  linkedInitiativeTitle?: string | null;
  associatedWith: string;
};

export type PriorityInboxCommitmentPrefill = {
  statement: string;
  owedTo: string;
  dueLabel: string;
  contextNote: string;
  associatedWith: string;
};

export type PriorityInboxInitiativePrefill = {
  name: string;
  contextNote: string;
  associatedWith: string;
  suggestedFirstStep?: string;
};

export type PriorityInboxReferencePrefill = {
  title: string;
  summary: string;
};

export type PriorityInboxItem = {
  id: string;
  source: PriorityInboxSource;
  sourceLabel: string;
  sourceFamily: Exclude<PriorityInboxSourceFilter, "all">;
  ingestionMode: PriorityInboxIngestionMode;
  sourceLink: string | null;
  externalMessageId?: string | null;
  conversationId?: string | null;
  receivedAt?: string | null;
  sender: string;
  senderRole?: string;
  threadTitle: string;
  primaryLine: string;
  summary: string;
  timeLabel: string;
  visibleState: PriorityInboxVisibleState;
  priorVisibleState?: PriorityInboxActiveState;
  deferredUntil?: string | null;
  deferredLabel?: string | null;
  deferredReason?: PriorityInboxDeferredReason | null;
  disposition?: PriorityInboxDisposition | null;
  dispositionReason?: PriorityInboxDispositionReason | null;
  dispositionLabel?: string | null;
  updatedCue?: string | null;
  relationshipCue?: string | null;
  sensitiveContext?: string | null;
  attachmentCue?: string | null;
  groupedCue?: string | null;
  whySurfaced: string;
  supportingSignals: string[];
  recommendedAction: PriorityInboxRecommendedAction;
  taskPrefill?: PriorityInboxTaskPrefill;
  commitmentPrefill?: PriorityInboxCommitmentPrefill;
  initiativePrefill?: PriorityInboxInitiativePrefill;
  referencePrefill?: PriorityInboxReferencePrefill;
  createdObject?: PriorityInboxCreatedObject | null;
  lastChangedAt?: string | null;
  sourceMetadata?: Record<string, unknown> | null;
};

export type PriorityInboxSourceStatus = {
  id: string;
  label: string;
  kind: "healthy" | "warning";
};

export type PriorityInboxSourceConnectionState =
  | "connected"
  | "disconnected"
  | "needs_reauth"
  | "error"
  | "not_configured";

export type PriorityInboxSourceConnectionSummary = {
  source: Extract<PriorityInboxSource, "outlook" | "gmail" | "teams">;
  label: string;
  state: PriorityInboxSourceConnectionState;
  connectHref: string;
  canSync: boolean;
  accountLabel?: string | null;
  lastSyncedAt?: string | null;
  lastSyncError?: string | null;
  statusLabel: string;
};

export type PriorityInboxSourceCandidate = {
  source: Extract<PriorityInboxSource, "outlook" | "gmail" | "teams" | "forwarded_email">;
  sourceLabel: string;
  sourceFamily: Exclude<PriorityInboxSourceFilter, "all" | "manual">;
  ingestionMode?: Extract<PriorityInboxIngestionMode, "live_adapter" | "forwarded">;
  sourceLink: string | null;
  externalMessageId: string;
  conversationId?: string | null;
  receivedAt: string;
  sender: string;
  senderRole?: string | null;
  subject: string;
  primaryLine: string;
  snippet: string;
  visibleState: Extract<PriorityInboxVisibleState, "high_priority" | "needs_review">;
  whySurfaced: string;
  supportingSignals: string[];
  recommendedAction: PriorityInboxRecommendedAction;
  dispositionReason?: PriorityInboxDispositionReason | null;
  updatedCue?: string | null;
  relationshipCue?: string | null;
  attachmentCue?: string | null;
  groupedCue?: string | null;
  sensitiveContext?: string | null;
  taskPrefill?: PriorityInboxTaskPrefill;
  commitmentPrefill?: PriorityInboxCommitmentPrefill;
  initiativePrefill?: PriorityInboxInitiativePrefill;
  referencePrefill?: PriorityInboxReferencePrefill;
  sourceMetadata?: Record<string, unknown> | null;
};

function isoDate(offsetDays: number, hour = 9, minute = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
}

export function isDeferredDue(item: PriorityInboxItem, now = Date.now()) {
  if (item.visibleState !== "deferred" || !item.deferredUntil) {
    return false;
  }

  const dueAt = Date.parse(item.deferredUntil);
  if (Number.isNaN(dueAt)) {
    return false;
  }

  return dueAt <= now;
}

export function getResolvedVisibleState(item: PriorityInboxItem, now = Date.now()): PriorityInboxVisibleState {
  if (isDeferredDue(item, now)) {
    return item.priorVisibleState ?? "needs_review";
  }

  return item.visibleState;
}

export function getResurfacedCue(item: PriorityInboxItem, now = Date.now()) {
  if (!isDeferredDue(item, now)) {
    return null;
  }

  return item.deferredLabel ? `Deferred until ${item.deferredLabel}` : "Resurfaced";
}

export function matchesPriorityInboxSourceFilter(item: PriorityInboxItem, filter: PriorityInboxSourceFilter) {
  if (filter === "all") {
    return true;
  }

  return item.sourceFamily === filter;
}

export function getForwardedPriorityInboxDetailHref(itemId: string) {
  return `/inbox/${itemId}`;
}

export function getPriorityInboxOpenTarget(item: PriorityInboxItem) {
  if (item.sourceLink) {
    return {
      kind: "native" as const,
      href: item.sourceLink,
      label: "Open"
    };
  }

  if (item.source === "forwarded_email") {
    return {
      kind: "detail" as const,
      href: getForwardedPriorityInboxDetailHref(item.id),
      label: "Open details"
    };
  }

  return null;
}

export function titleCaseDispositionReason(reason: string | null | undefined) {
  if (!reason) {
    return null;
  }

  return reason
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function formatPriorityInboxDateTime(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function formatPriorityInboxTimestamp(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function formatPriorityInboxRelativeTime(value: string | null | undefined, now = Date.now()) {
  if (!value) {
    return "";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "";
  }

  const deltaMs = timestamp - now;
  const deltaMinutes = Math.round(deltaMs / 60_000);
  const relativeFormatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

  if (Math.abs(deltaMinutes) < 60) {
    return relativeFormatter.format(deltaMinutes, "minute");
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) {
    return relativeFormatter.format(deltaHours, "hour");
  }

  const deltaDays = Math.round(deltaHours / 24);
  if (Math.abs(deltaDays) < 7) {
    return relativeFormatter.format(deltaDays, "day");
  }

  return formatPriorityInboxTimestamp(value);
}

export const seedPriorityInboxItems: PriorityInboxItem[] = [
  {
    id: "board-packet-scope",
    source: "outlook",
    sourceLabel: "Outlook",
    sourceFamily: "email",
    ingestionMode: "live_adapter",
    sourceLink: "https://outlook.office.com/mail/",
    sender: "Amelia Hart",
    senderRole: "Finance",
    threadTitle: "Board packet scope changed after hiring-brief revision",
    primaryLine: "Decide whether the board packet should follow the narrowed hiring brief today.",
    summary:
      "Finance aligned the numbers, but the narrative still assumes the broader role. One executive decision likely clears the rest of the thread.",
    timeLabel: "18m ago",
    visibleState: "high_priority",
    dispositionReason: "decision_needed",
    updatedCue: "Deadline changed",
    relationshipCue: "Related commitment: Hiring brief narrative correction",
    sensitiveContext: "Prior tension around timing on this project. A crisp decision will likely lower friction.",
    attachmentCue: "Includes deck",
    whySurfaced: "Direct ask about a Friday board deadline.",
    supportingSignals: ["Important relationship message", "Meaningful accountability today"],
    recommendedAction: "create_task",
    taskPrefill: {
      description: "Confirm board packet follows the narrowed hiring brief",
      nextStep: "Make the board-packet scope decision and confirm the narrowed role framing.",
      desiredOutcome: "Finance and recruiting are aligned on one corrected board narrative.",
      priority: "high",
      categoryName: "Priority Action",
      associatedWith: "Amelia Hart · Board packet thread"
    },
    commitmentPrefill: {
      statement: "Get Amelia a final board-packet scope decision today.",
      owedTo: "Amelia Hart",
      dueLabel: "Today by 2:30 PM",
      contextNote: "A short decision should unblock finance and recruiting alignment.",
      associatedWith: "Board packet thread"
    },
    initiativePrefill: {
      name: "Board packet narrative correction",
      contextNote: "Small initiative if the packet rewrite needs a coordinated pass across finance and recruiting.",
      associatedWith: "Amelia Hart · Finance",
      suggestedFirstStep: "Capture the narrowed role framing and circulate a corrected narrative."
    },
    referencePrefill: {
      title: "Board packet scope change",
      summary: "Updated finance thread explaining why the narrowed hiring brief changes the narrative."
    }
  },
  {
    id: "customer-escalation-teams",
    source: "teams",
    sourceLabel: "Teams",
    sourceFamily: "teams",
    ingestionMode: "live_adapter",
    sourceLink: "https://teams.microsoft.com/",
    sender: "Priya Shah",
    senderRole: "Enterprise Success",
    threadTitle: "Northstar launch risk",
    primaryLine: "Approve the customer timeline adjustment before the launch channel hardens around the old date.",
    summary:
      "Priya mentioned you directly with a request to bless a revised launch date after two dependencies slipped this morning.",
    timeLabel: "27m ago",
    visibleState: "high_priority",
    dispositionReason: "follow_up_needed",
    relationshipCue: "Customer context: Northstar expansion is still in contract negotiation",
    attachmentCue: "Includes document link",
    whySurfaced: "New Teams mention asking for approval.",
    supportingSignals: ["Decision request", "Important customer context"],
    recommendedAction: "add_commitment",
    taskPrefill: {
      description: "Confirm whether Northstar launch date can move",
      nextStep: "Reply to Priya with a yes/no decision on the revised launch date.",
      desiredOutcome: "The customer-facing launch date is settled before the channel hardens around the old one.",
      priority: "high",
      categoryName: "Calendar",
      associatedWith: "Priya Shah · Northstar launch risk"
    },
    commitmentPrefill: {
      statement: "Give Priya a same-day answer on the Northstar launch date shift.",
      owedTo: "Priya Shah",
      dueLabel: "Today",
      contextNote: "The message carries customer accountability rather than general channel chatter.",
      associatedWith: "Teams · Northstar launch risk"
    },
    initiativePrefill: {
      name: "Northstar launch recovery",
      contextNote: "Use only if the timing slip becomes a broader cross-team recovery thread.",
      associatedWith: "Priya Shah · Enterprise Success",
      suggestedFirstStep: "Create one owner-facing task for the revised date approval."
    },
    referencePrefill: {
      title: "Northstar launch timing request",
      summary: "Teams ask requesting executive approval to shift the customer-facing launch date."
    }
  },
  {
    id: "partner-intro-gmail",
    source: "gmail",
    sourceLabel: "Gmail",
    sourceFamily: "email",
    ingestionMode: "live_adapter",
    sourceLink: "https://mail.google.com/mail/u/0/#inbox",
    sender: "Jordan Lee",
    senderRole: "Partnerships",
    threadTitle: "Partner intro request for tomorrow's calendar",
    primaryLine: "Choose whether to confirm the intro or push it a week before tomorrow's schedule locks.",
    summary:
      "A short answer should either confirm the intro or move it without spinning up a longer coordination thread.",
    timeLabel: "42m ago",
    visibleState: "high_priority",
    dispositionReason: "reply_needed",
    whySurfaced: "Likely commitment tied to tomorrow's timing window.",
    supportingSignals: ["External relationship relevance", "Deadline-sensitive follow-up"],
    recommendedAction: "mark_handled",
    taskPrefill: {
      description: "Resolve Jordan's partner intro timing",
      nextStep: "Confirm the intro or push it a week before tomorrow's schedule locks.",
      desiredOutcome: "Jordan has a clear answer and tomorrow's calendar stays coherent.",
      priority: "medium",
      categoryName: "Calendar",
      associatedWith: "Jordan Lee · Partner intro request"
    },
    commitmentPrefill: {
      statement: "Close the loop with Jordan on the partner intro timing.",
      owedTo: "Jordan Lee",
      dueLabel: "Today",
      contextNote: "Small but time-sensitive relationship follow-up.",
      associatedWith: "Gmail · Partner intro thread"
    },
    initiativePrefill: {
      name: "Partner intro coordination",
      contextNote: "Only worth elevating if the intro expands into a broader partnership workstream.",
      associatedWith: "Jordan Lee"
    },
    referencePrefill: {
      title: "Partner intro request",
      summary: "External intro request with timing tied to tomorrow's calendar."
    }
  },
  {
    id: "follow-up-thread",
    source: "gmail",
    sourceLabel: "Gmail",
    sourceFamily: "email",
    ingestionMode: "live_adapter",
    sourceLink: "https://mail.google.com/mail/u/0/#inbox",
    sender: "Mina Chen",
    senderRole: "Advisor",
    threadTitle: "Following up on next steps from Friday",
    primaryLine: "Decide whether this follow-up now needs a concrete next step or can wait for more context.",
    summary:
      "The tone is still warm, but the thread is aging enough that it may deserve a quick read before it quietly slips.",
    timeLabel: "Yesterday",
    visibleState: "needs_review",
    dispositionReason: "waiting_for_more_context",
    whySurfaced: "Important relationship thread drifting without closure.",
    supportingSignals: ["Follow-up from Friday", "Likely commitment or routing decision"],
    recommendedAction: "defer",
    taskPrefill: {
      description: "Decide next step for Mina follow-up",
      nextStep: "Review Friday context and choose between a reply or an intentional deferral.",
      desiredOutcome: "The advisor thread no longer drifts without a clear owner move.",
      priority: "medium",
      categoryName: "Waiting For",
      associatedWith: "Mina Chen · Friday follow-up"
    },
    commitmentPrefill: {
      statement: "Close the loop with Mina after reviewing Friday context.",
      owedTo: "Mina Chen",
      dueLabel: "Tomorrow morning",
      contextNote: "Useful if you want a visible obligation rather than another passive review.",
      associatedWith: "Friday follow-up thread"
    },
    initiativePrefill: {
      name: "Advisor follow-up clean-up",
      contextNote: "Only useful if several advisor threads need one coordinated response plan.",
      associatedWith: "Mina Chen"
    },
    referencePrefill: {
      title: "Mina Friday follow-up",
      summary: "Advisor thread that may need a small next-step decision."
    }
  },
  {
    id: "travel-note-manual",
    source: "manual",
    sourceLabel: "Manual / Capture",
    sourceFamily: "manual",
    ingestionMode: "manual",
    sourceLink: "/capture?from=%2Finbox",
    sender: "Blackhawk capture",
    threadTitle: "Travel note routed from capture",
    primaryLine: "Revisit Nora's family logistics note before travel confirmations go out.",
    summary:
      "This came in through a manual add because the timing matters, but the source context is private enough that the details should stay collapsed.",
    timeLabel: "Added 2h ago",
    visibleState: "needs_review",
    dispositionReason: "relationship_context",
    sensitiveContext: "Prior tension around trip timing. Consider a softer follow-up if plans shift again.",
    whySurfaced: "Manual add.",
    supportingSignals: ["Decision-relevant sensitive context", "Manual routing signal"],
    recommendedAction: "save_reference",
    referencePrefill: {
      title: "Nora travel logistics note",
      summary: "Private timing note worth retaining as quiet reference before travel confirmations."
    },
    taskPrefill: {
      description: "Review Nora travel note before confirmations",
      nextStep: "Revisit the logistics note before travel confirmations are sent.",
      desiredOutcome: "Travel confirmations go out without repeating the prior timing friction.",
      priority: "medium",
      categoryName: "Personal",
      associatedWith: "Manual capture · Nora travel note"
    },
    commitmentPrefill: {
      statement: "Check Nora's logistics note before finalizing travel confirmations.",
      owedTo: "Nora Patel",
      dueLabel: "Before confirmations go out",
      contextNote: "Use only if the note should become an explicit obligation.",
      associatedWith: "Manual capture"
    },
    initiativePrefill: {
      name: "Travel logistics cleanup",
      contextNote: "Only escalate if several travel-related notes need coordination.",
      associatedWith: "Manual capture"
    }
  },
  {
    id: "resurfaced-contract-thread",
    source: "outlook",
    sourceLabel: "Outlook",
    sourceFamily: "email",
    ingestionMode: "live_adapter",
    sourceLink: "https://outlook.office.com/mail/",
    sender: "Finance + Legal",
    senderRole: "Internal",
    threadTitle: "Compensation scenario follow-up",
    primaryLine: "Recheck whether the contract fallback is still the right path before tonight's review.",
    summary:
      "You deferred this until today after waiting for legal edits. The latest thread still looks ambiguous enough for review rather than action-first treatment.",
    timeLabel: "Deferred until today",
    visibleState: "deferred",
    priorVisibleState: "needs_review",
    deferredUntil: isoDate(0, 8, 30),
    deferredLabel: "today",
    deferredReason: "waiting_for_context",
    updatedCue: "New reply",
    attachmentCue: "2 files",
    whySurfaced: "Resurfaced from deferral.",
    supportingSignals: ["Important reply context", "Legal edits may change accountability"],
    recommendedAction: "mark_handled",
    taskPrefill: {
      description: "Review compensation fallback after legal edits",
      nextStep: "Recheck the contract fallback path against the latest legal reply.",
      desiredOutcome: "Tonight's review uses the right compensation fallback decision.",
      priority: "medium",
      categoryName: "Agenda",
      associatedWith: "Finance + Legal · Compensation scenario"
    },
    commitmentPrefill: {
      statement: "Give Finance + Legal a decision on the contract fallback after reviewing the edits.",
      owedTo: "Finance + Legal",
      dueLabel: "Today",
      contextNote: "Good fit if the thread has become an obligation rather than a read-only check.",
      associatedWith: "Outlook · Compensation scenario"
    },
    referencePrefill: {
      title: "Compensation scenario fallback",
      summary: "Deferred thread resurfaced after expected legal edits arrived."
    }
  },
  {
    id: "deferred-board-intro",
    source: "manual",
    sourceLabel: "Manual / Capture",
    sourceFamily: "manual",
    ingestionMode: "manual",
    sourceLink: "/capture?from=%2Finbox",
    sender: "Blackhawk manual route",
    threadTitle: "Board intro note",
    primaryLine: "Return to the board-intro draft closer to next week's meeting.",
    summary:
      "Useful later, but not worth competing with today's asks. It should stay out of the active layer until the timing is closer.",
    timeLabel: "Deferred",
    visibleState: "deferred",
    priorVisibleState: "needs_review",
    deferredUntil: isoDate(5, 9, 0),
    deferredLabel: "next week",
    deferredReason: "closer_to_meeting",
    whySurfaced: "Deferred until closer to the meeting.",
    supportingSignals: ["Manual routing signal", "Timing-dependent note"],
    recommendedAction: "save_reference",
    referencePrefill: {
      title: "Board intro draft note",
      summary: "Manual note intentionally backgrounded until the meeting gets closer."
    }
  },
  {
    id: "handled-recruiting-brief",
    source: "outlook",
    sourceLabel: "Outlook",
    sourceFamily: "email",
    ingestionMode: "live_adapter",
    sourceLink: "https://outlook.office.com/mail/",
    sender: "Chief of Staff",
    threadTitle: "Hiring brief narrowing",
    primaryLine: "Recruiting brief correction already routed into the library task system.",
    summary: "This was correctly surfaced, then converted into a task so the inbox does not need to keep holding it open.",
    timeLabel: "Handled 38m ago",
    visibleState: "handled",
    priorVisibleState: "high_priority",
    disposition: "task_created",
    dispositionLabel: "Task created",
    createdObject: {
      type: "task",
      title: "Send recruiting brief revision",
      href: "/library/tasks"
    },
    lastChangedAt: isoDate(0, 10, 45),
    whySurfaced: "Related to an active commitment.",
    supportingSignals: ["Direct accountability", "Resolved through task routing"],
    recommendedAction: "mark_handled"
  },
  {
    id: "dismissed-vendor-pitch",
    source: "gmail",
    sourceLabel: "Gmail",
    sourceFamily: "email",
    ingestionMode: "live_adapter",
    sourceLink: "https://mail.google.com/mail/u/0/#inbox",
    sender: "Vendor Growth Team",
    threadTitle: "Quick AI transformation idea for your executive team",
    primaryLine: "This was surfaced once and correctly marked as non-actionable.",
    summary: "Low-value outreach should train suppression rather than stay in the active layer.",
    timeLabel: "Dismissed yesterday",
    visibleState: "dismissed",
    priorVisibleState: "needs_review",
    disposition: "dismissed",
    dispositionReason: "cold_outreach",
    lastChangedAt: isoDate(-1, 15, 20),
    whySurfaced: "Model correction example retained for restore.",
    supportingSignals: ["Low-value vendor pitch"],
    recommendedAction: "mark_handled"
  }
];
