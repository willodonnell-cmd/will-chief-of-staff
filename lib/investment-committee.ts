import type { SupabaseClient } from "@supabase/supabase-js";

import type { ChiefOfStaffSignal } from "@/lib/chief-of-staff-signal";
import type {
  InvestmentCommitteeAgentThread,
  InvestmentCommitteeAgentEnvelope,
  InvestmentCommitteeAgentCycle,
  InvestmentCommitteeAgentDeal,
  InvestmentCommitteeAgentThreadKind
} from "@/lib/investment-committee-agent";

export const INVESTMENT_COMMITTEE_CYCLE_STATUSES = ["active", "completed", "archived"] as const;
export const INVESTMENT_COMMITTEE_DEAL_STATUSES = [
  "not_started",
  "reviewing",
  "reviewed",
  "questions_drafted",
  "questions_sent"
] as const;
export const INVESTMENT_COMMITTEE_STEP_KEYS = [
  "package_and_deals",
  "questions"
] as const;

export type InvestmentCommitteeCycleStatus = (typeof INVESTMENT_COMMITTEE_CYCLE_STATUSES)[number];
export type InvestmentCommitteeDealStatus = (typeof INVESTMENT_COMMITTEE_DEAL_STATUSES)[number];
export type InvestmentCommitteeStepKey = (typeof INVESTMENT_COMMITTEE_STEP_KEYS)[number];
export type InvestmentCommitteeStepState = "waiting" | "in_progress" | "done" | "needs_attention";

export type InvestmentCommitteeCycleRecord = {
  id: string;
  user_id: string;
  week_of: string;
  box_link: string | null;
  memo_due_at: string | null;
  questions_due_at: string | null;
  status: InvestmentCommitteeCycleStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
};

export type InvestmentCommitteeDealRecord = {
  id: string;
  user_id: string;
  cycle_id: string;
  title: string;
  memo_link: string | null;
  sponsor: string | null;
  status: InvestmentCommitteeDealStatus;
  question_notes: string | null;
  peer_question_notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
};

export type InvestmentCommitteeCounts = {
  totalDeals: number;
  reviewedDeals: number;
  draftedQuestionSets: number;
  sentQuestionSets: number;
  packageLinked: boolean;
};

export type InvestmentCommitteeWorkflowStep = {
  key: InvestmentCommitteeStepKey;
  label: string;
  state: InvestmentCommitteeStepState;
  detail: string;
};

export type InvestmentCommitteeTrafficSummary = {
  totalItems: number;
  requiresWillAction: number;
  laneOnlyItems: number;
  href: string;
};

export type InvestmentCommitteeDetectedDealSignal = {
  id: string;
  title: string;
  summary: string;
  href: string | null;
  occurredAt: string;
  mentionsWill: boolean;
  isQuestionSignal: boolean;
  kind: InvestmentCommitteeAgentThreadKind;
};

export type InvestmentCommitteeDetectedDeal = {
  key: string;
  title: string;
  trafficCount: number;
  peerQuestionCount: number;
  relatedSignals: InvestmentCommitteeDetectedDealSignal[];
};

export type InvestmentCommitteeDraftSeed = {
  weekOf: string;
  sourceTitle: string;
  sourceSummary: string | null;
  sourceHref: string | null;
};

export type InvestmentCommitteeBoardDeal = {
  id: string;
  title: string;
  memoUrl: string | null;
  peerQuestionSummary: string | null;
  answerSummary: string | null;
  threads: InvestmentCommitteeAgentDeal["threads"];
  willNotes: string;
  persistedDealId: string | null;
};

export type InvestmentCommitteeBoard = {
  source: "agent_run" | "local" | "fixture";
  statusNotice: string | null;
  weekOf: string;
  meetingDate: string | null;
  packageEmailSubject: string;
  packageEmailUrl: string | null;
  boxFolderUrl: string | null;
  questionsDueAt: string | null;
  resetAt: string | null;
  deals: InvestmentCommitteeBoardDeal[];
};

export type InvestmentCommitteePageData = {
  board: InvestmentCommitteeBoard | null;
  emptyState: {
    title: string;
    detail: string;
  } | null;
};

type OwnedCycleContext = {
  ok: true;
  client: InvestmentCommitteeClient;
  userId: string;
  cycle: InvestmentCommitteeCycleRecord;
};

type InvestmentCommitteeClient = { from: SupabaseClient["from"] };

async function resolveInvestmentCommitteeUser() {
  const { resolveCurrentAppUser } = await import("@/lib/supabase/current-user");
  return resolveCurrentAppUser();
}

function isDealStatus(value: string | null | undefined): value is InvestmentCommitteeDealStatus {
  return INVESTMENT_COMMITTEE_DEAL_STATUSES.includes(value as InvestmentCommitteeDealStatus);
}

function startOfWeek(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + offset);
  return value;
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toIsoLocalMinute(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  const hours = `${value.getHours()}`.padStart(2, "0");
  const minutes = `${value.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSignalText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeUrl(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

function normalizeDateOnly(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return trimmed;
}

function normalizeTimestampInput(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function compareCyclesByWeekDesc(a: InvestmentCommitteeCycleRecord, b: InvestmentCommitteeCycleRecord) {
  return Date.parse(b.week_of) - Date.parse(a.week_of);
}

function compareDealsForDisplay(a: InvestmentCommitteeDealRecord, b: InvestmentCommitteeDealRecord) {
  if (a.sort_order !== b.sort_order) {
    return a.sort_order - b.sort_order;
  }

  return Date.parse(a.created_at) - Date.parse(b.created_at);
}

export function listVisibleInvestmentCommitteeDeals(
  deals: InvestmentCommitteeDealRecord[]
): InvestmentCommitteeDealRecord[] {
  return deals
    .filter((deal) => !deal.deleted_at && !deal.archived_at)
    .sort(compareDealsForDisplay);
}

function findPersistedDealForTitle(
  persistedDeals: InvestmentCommitteeDealRecord[],
  title: string
) {
  const payloadKey = normalizeDealKey(title);

  return (
    persistedDeals.find((deal) => normalizeDealKey(deal.title) === payloadKey) ??
    persistedDeals.find((deal) => {
      const dealKey = normalizeDealKey(deal.title);
      return (
        dealKey.length >= 8 &&
        payloadKey.length >= 8 &&
        (dealKey.includes(payloadKey) || payloadKey.includes(dealKey))
      );
    }) ??
    null
  );
}

function findPersistedDealForBoard(
  persistedDeals: InvestmentCommitteeDealRecord[],
  payloadDeal: InvestmentCommitteeAgentDeal
) {
  return findPersistedDealForTitle(persistedDeals, payloadDeal.title);
}

export function shouldClearInvestmentCommitteeBoard(
  cycle: Pick<InvestmentCommitteeAgentCycle, "resetAt">,
  now = new Date()
) {
  if (!cycle.resetAt) {
    return false;
  }

  const resetAt = Date.parse(cycle.resetAt);
  if (Number.isNaN(resetAt)) {
    return false;
  }

  return resetAt <= now.getTime();
}

export function shouldHideInvestmentCommitteeBoard(
  source: "local" | "fixture" | null,
  cycle: Pick<InvestmentCommitteeAgentCycle, "resetAt">,
  now = new Date()
) {
  if (!shouldClearInvestmentCommitteeBoard(cycle, now)) {
    return false;
  }

  return source !== "fixture";
}

export function buildInvestmentCommitteeBoard(
  envelope: InvestmentCommitteeAgentEnvelope,
  persistedDeals: InvestmentCommitteeDealRecord[],
  source: "local" | "fixture",
  statusNotice: string | null = null
): InvestmentCommitteeBoard {
  return {
    source,
    statusNotice,
    weekOf: envelope.cycle.weekOf,
    meetingDate: envelope.cycle.meetingDate,
    packageEmailSubject: envelope.cycle.packageEmailSubject,
    packageEmailUrl: envelope.cycle.packageEmailUrl,
    boxFolderUrl: envelope.cycle.boxFolderUrl,
    questionsDueAt: envelope.cycle.questionsDueAt,
    resetAt: envelope.cycle.resetAt,
    deals: envelope.deals.map((deal) => {
      const persisted = findPersistedDealForBoard(persistedDeals, deal);

      return {
        id: deal.id,
        title: deal.title,
        memoUrl: deal.memoUrl,
        peerQuestionSummary: deal.peerQuestionSummary,
        answerSummary: deal.answerSummary,
        threads: [...deal.threads].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)),
        willNotes: persisted?.question_notes ?? "",
        persistedDealId: persisted?.id ?? null
      };
    })
  };
}

function signalLooksAnswerRelated(signal: ChiefOfStaffSignal) {
  const combined = normalizeSignalText([signal.title, signal.summary, signal.sourceLabel].filter(Boolean).join(" "));
  return /\b(answer|answers|responses?|weekend q[+&]?a)\b/.test(combined);
}

function signalLooksPackageRelated(signal: ChiefOfStaffSignal) {
  return packageCueScore(signal) >= 8;
}

function mapSignalToBoardThread(signal: ChiefOfStaffSignal): InvestmentCommitteeAgentThread {
  let kind: InvestmentCommitteeAgentThreadKind = "general";
  if (signalLooksPackageRelated(signal)) {
    kind = "package";
  } else if (signalLooksAnswerRelated(signal)) {
    kind = "answer";
  } else if (signalLooksQuestionRelated(signal)) {
    kind = "question";
  }

  return {
    id: signal.id,
    subject: signal.sourceReference ?? signal.title,
    sender: signal.owner,
    kind,
    occurredAt: signal.occurredAt,
    sourceUrl: signal.sourceUrl ?? null,
    summary: signal.summary,
    mentionsWill: signalMentionsWill(signal)
  };
}

function deriveBoardWeekOf(signals: ChiefOfStaffSignal[], producedAt?: string | null) {
  const anchor =
    signals
      .map((signal) => Date.parse(signal.occurredAt))
      .filter((value) => !Number.isNaN(value))
      .sort((a, b) => b - a)[0] ??
    (producedAt ? Date.parse(producedAt) : Number.NaN);

  return defaultInvestmentCommitteeCycleValues(Number.isNaN(anchor) ? new Date() : new Date(anchor)).weekOf;
}

function deriveBoardQuestionsDueAt(signals: ChiefOfStaffSignal[]) {
  const dueCandidates = signals
    .map((signal) => signal.dueAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, parsed: Date.parse(value) }))
    .filter((entry) => !Number.isNaN(entry.parsed))
    .sort((a, b) => a.parsed - b.parsed);

  return dueCandidates[0]?.value ?? null;
}

function buildTrafficBoardStatusNotice(source: "agent_run" | "local", producedAt: string | null) {
  const label =
    source === "agent_run"
      ? "Showing current routed Investment Committee traffic from the latest Agent run."
      : "Showing current routed Investment Committee traffic from the local Agent payload in this workspace.";

  if (!producedAt) {
    return `${label} The dedicated weekly package payload can still add Box links and richer memo metadata later.`;
  }

  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(producedAt));

  return `${label} Latest traffic observed ${formatted}. The dedicated weekly package payload can still add Box links and richer memo metadata later.`;
}

export function buildInvestmentCommitteeBoardFromSignals(
  signals: ChiefOfStaffSignal[],
  persistedDeals: InvestmentCommitteeDealRecord[],
  options?: {
    source?: "agent_run" | "local";
    producedAt?: string | null;
    statusNotice?: string | null;
  }
): InvestmentCommitteeBoard | null {
  if (signals.length === 0) {
    return null;
  }

  const weekOf = deriveBoardWeekOf(signals, options?.producedAt ?? null);
  const seed = deriveInvestmentCommitteeDraftSeed(signals, new Date(`${weekOf}T12:00:00`));
  const detectedDeals = deriveInvestmentCommitteeDetectedDeals(signals);

  if (detectedDeals.length === 0) {
    return null;
  }

  const source = options?.source ?? "agent_run";
  const statusNotice = options?.statusNotice ?? buildTrafficBoardStatusNotice(source, options?.producedAt ?? null);

  return {
    source,
    statusNotice,
    weekOf,
    meetingDate: null,
    packageEmailSubject: seed?.sourceTitle ?? "Current Investment Committee and Energy Investment Committee traffic",
    packageEmailUrl: seed?.sourceHref ?? null,
    boxFolderUrl: null,
    questionsDueAt: deriveBoardQuestionsDueAt(signals),
    resetAt: null,
    deals: detectedDeals.map((deal) => {
      const relatedSignals = deal.relatedSignals
        .map((related) => signals.find((signal) => signal.id === related.id))
        .filter((signal): signal is ChiefOfStaffSignal => Boolean(signal))
        .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
      const persisted = findPersistedDealForTitle(persistedDeals, deal.title);
      const threads = relatedSignals.map(mapSignalToBoardThread);
      const questionSignal = relatedSignals.find(signalLooksQuestionPromptRelated);
      const answerSignal = relatedSignals.find(signalLooksAnswerRelated);
      const memoSignal = relatedSignals.find((signal) => Boolean(signal.sourceUrl));

      return {
        id: deal.key,
        title: deal.title,
        memoUrl: memoSignal?.sourceUrl ?? null,
        peerQuestionSummary: questionSignal?.summary ?? null,
        answerSummary: answerSignal?.summary ?? null,
        threads,
        willNotes: persisted?.question_notes ?? "",
        persistedDealId: persisted?.id ?? null
      };
    })
  };
}

export function selectCurrentInvestmentCommitteeCycle(
  cycles: InvestmentCommitteeCycleRecord[]
): InvestmentCommitteeCycleRecord | null {
  const visibleCycles = cycles
    .filter((cycle) => !cycle.deleted_at)
    .sort(compareCyclesByWeekDesc);

  const activeCycle = visibleCycles.find((cycle) => cycle.status === "active" && !cycle.archived_at);
  if (activeCycle) {
    return activeCycle;
  }

  return visibleCycles.find((cycle) => !cycle.archived_at) ?? null;
}

export function calculateInvestmentCommitteeCounts(
  cycle: InvestmentCommitteeCycleRecord | null,
  deals: InvestmentCommitteeDealRecord[]
): InvestmentCommitteeCounts {
  const visibleDeals = listVisibleInvestmentCommitteeDeals(deals);
  const reviewedDeals = visibleDeals.filter((deal) =>
    deal.status === "reviewed" || deal.status === "questions_drafted" || deal.status === "questions_sent"
  ).length;
  const draftedQuestionSets = visibleDeals.filter(
    (deal) => deal.status === "questions_drafted" || deal.status === "questions_sent"
  ).length;
  const sentQuestionSets = visibleDeals.filter((deal) => deal.status === "questions_sent").length;

  return {
    totalDeals: visibleDeals.length,
    reviewedDeals,
    draftedQuestionSets,
    sentQuestionSets,
    packageLinked: Boolean(cycle?.box_link?.trim())
  };
}

function timingRequiresAttention(dueAt: string | null) {
  if (!dueAt) {
    return false;
  }

  return Date.parse(dueAt) <= Date.now();
}

export function calculateInvestmentCommitteeSteps(
  cycle: InvestmentCommitteeCycleRecord | null,
  deals: InvestmentCommitteeDealRecord[],
  options?: {
    detectedDealCount?: number;
    hasPackageSignal?: boolean;
  }
): InvestmentCommitteeWorkflowStep[] {
  const counts = calculateInvestmentCommitteeCounts(cycle, deals);
  const detectedDealCount = options?.detectedDealCount ?? 0;
  const hasPackageSignal = options?.hasPackageSignal ?? false;
  const displayDealCount = counts.totalDeals > 0 ? counts.totalDeals : detectedDealCount;
  const packageAndDealsState: InvestmentCommitteeStepState =
    counts.packageLinked || counts.totalDeals > 0
      ? "done"
      : hasPackageSignal || detectedDealCount > 0
        ? "in_progress"
        : cycle && timingRequiresAttention(cycle.memo_due_at)
          ? "needs_attention"
          : "waiting";
  const questionsState: InvestmentCommitteeStepState =
    displayDealCount === 0
      ? "waiting"
      : counts.sentQuestionSets >= displayDealCount && displayDealCount > 0
        ? "done"
        : counts.draftedQuestionSets > 0 || counts.reviewedDeals > 0
          ? "in_progress"
          : timingRequiresAttention(cycle?.questions_due_at ?? null)
            ? "needs_attention"
            : "waiting";

  return [
    {
      key: "package_and_deals",
      label: "Package and Deals",
      state: packageAndDealsState,
      detail:
        counts.totalDeals > 0
          ? `${counts.totalDeals} tracked deal${counts.totalDeals === 1 ? "" : "s"} in this cycle.`
          : detectedDealCount > 0
            ? `${detectedDealCount} deal${detectedDealCount === 1 ? "" : "s"} detected from this week's IC traffic.`
            : hasPackageSignal
              ? "Weekly package detected. Confirm the Box link and deal list."
              : "Waiting for the weekly package or deal list."
    },
    {
      key: "questions",
      label: "Questions",
      state: questionsState,
      detail:
        displayDealCount > 0
          ? `${counts.draftedQuestionSets} drafted, ${counts.sentQuestionSets} sent, ${displayDealCount} total deal${displayDealCount === 1 ? "" : "s"}.`
          : "Questions stay quiet until this week's deals are identified."
    }
  ];
}

export function defaultInvestmentCommitteeCycleValues(now = new Date()) {
  const week = startOfWeek(now);
  const wednesday = new Date(week);
  wednesday.setDate(week.getDate() + 2);
  wednesday.setHours(12, 0, 0, 0);
  const friday = new Date(week);
  friday.setDate(week.getDate() + 4);
  friday.setHours(15, 0, 0, 0);

  return {
    weekOf: toDateOnly(week),
    memoDueAt: toIsoLocalMinute(wednesday),
    questionsDueAt: toIsoLocalMinute(friday)
  };
}

function packageCueScore(signal: ChiefOfStaffSignal) {
  const combined = normalizeSignalText(
    [signal.title, signal.summary, signal.actionRequest, signal.owner, signal.sourceLabel, ...signal.participants]
      .filter(Boolean)
      .join(" ")
  );

  let score = 0;

  if (signal.category === "IC") {
    score += 4;
  }

  if (signal.source === "outlook") {
    score += 2;
  }

  if (/\bsusan pi\b/.test(combined)) {
    score += 4;
  }

  if (/\bbox\b/.test(combined)) {
    score += 5;
  }

  if (/\b(ic memos?|investment committee|this week'?s memos?|weekly ic package|memo package|approval package)\b/.test(combined)) {
    score += 6;
  }

  if (/\b(package|memos?|deal list|questions due|friday|wednesday)\b/.test(combined)) {
    score += 2;
  }

  return score;
}

export function deriveInvestmentCommitteeDraftSeed(
  signals: ChiefOfStaffSignal[],
  now = new Date()
): InvestmentCommitteeDraftSeed | null {
  const icSignals = signals.filter((signal) => signal.category === "IC");
  if (icSignals.length === 0) {
    return null;
  }

  const bestSignal = [...icSignals]
    .map((signal) => ({
      signal,
      score: packageCueScore(signal)
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return Date.parse(b.signal.occurredAt) - Date.parse(a.signal.occurredAt);
    })[0]?.signal;

  if (!bestSignal) {
    return null;
  }

  return {
    weekOf: defaultInvestmentCommitteeCycleValues(now).weekOf,
    sourceTitle: bestSignal.title,
    sourceSummary: bestSignal.summary || null,
    sourceHref: bestSignal.sourceUrl ?? null
  };
}

function cleanupDealCandidate(value: string) {
  return value
    .replace(/^(re|fw|fwd)\s*:\s*/i, "")
    .replace(/^q[+&]?a\s+(summary|responses?)\s*-\s*/i, "")
    .replace(/\s*-\s*iicm$/i, "")
    .replace(/\s*-\s*energy investment committee$/i, "")
    .replace(/\s*-\s*investment committee$/i, "")
    .replace(/\s*-\s*energy ic$/i, "")
    .replace(/\s*-\s*energy ic memo$/i, "")
    .replace(/\s+ic memo$/i, "")
    .replace(/\s*-\s*energy$/i, "")
    .replace(/\s+committee questions summarized$/i, "")
    .replace(/\s+committee q&a compiled$/i, "")
    .replace(/\s+thread active$/i, "")
    .replace(/\s+memo circulated$/i, "")
    .replace(/\s+packet answers will question$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDealKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function looksLikeGenericInvestmentCommitteeLabel(value: string) {
  if (
    /\b(sent|circulated|ready|shared)\b.*\b(investment committee|energy investment committee|energy ic|ic package|ic memos?|package|memos?)\b/i.test(
      value
    )
  ) {
    return true;
  }

  const stripped = normalizeDealKey(value)
    .replace(/\b(energy investment committee|investment committee|energy ic|ic memos?|ic package|weekly ic package)\b/g, " ")
    .replace(/\b(package|packages|memo|memos|approval|committee|questions|comments|circulated|review|ready|this|week|sent)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const withoutCalendarWords = stripped
    .replace(
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/g,
      " "
    )
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return withoutCalendarWords.length < 6;
}

function signalMentionsWill(signal: ChiefOfStaffSignal) {
  const combined = normalizeSignalText(
    [signal.title, signal.summary, signal.actionRequest, signal.owner, ...signal.participants].filter(Boolean).join(" ")
  );
  return /\bwill\b|\bwill o['’]?\s*donnell\b/.test(combined);
}

function signalLooksQuestionRelated(signal: ChiefOfStaffSignal) {
  const combined = normalizeSignalText([signal.title, signal.summary, signal.sourceLabel].filter(Boolean).join(" "));
  return /\b(q[+&]?a|question|questions|response|responses|answer|answers)\b/.test(combined);
}

function signalLooksQuestionPromptRelated(signal: ChiefOfStaffSignal) {
  if (signalLooksAnswerRelated(signal)) {
    return false;
  }

  const combined = normalizeSignalText([signal.title, signal.summary, signal.sourceLabel].filter(Boolean).join(" "));
  return /\b(q[+&]?a|question|questions)\b/.test(combined);
}

function signalLooksApprovedStatus(signal: ChiefOfStaffSignal) {
  const combined = normalizeSignalText(
    [signal.title, signal.sourceReference ?? "", signal.sourceLabel].filter(Boolean).join(" ")
  );
  return /\bapproved\b/.test(combined);
}

function extractDealCandidateFromSignal(signal: ChiefOfStaffSignal) {
  if (signalLooksApprovedStatus(signal)) {
    return null;
  }

  const candidates = [
    cleanupDealCandidate(signal.sourceLabel),
    cleanupDealCandidate(signal.sourceReference ?? ""),
    cleanupDealCandidate(signal.title)
  ].filter((value) => value.length > 0);
  const ownerKey = normalizeDealKey(signal.owner);

  const selected = candidates.find((value) => {
    const candidateKey = normalizeDealKey(value);
    return (
      candidateKey !== ownerKey &&
      !/\b(ic memos? for|weekly ic package)\b/i.test(value) &&
      !looksLikeGenericInvestmentCommitteeLabel(value)
    );
  });
  if (!selected) {
    return null;
  }

  return {
    title: selected,
    key: normalizeDealKey(selected)
  };
}

function findMatchingDetectedDealIndex(
  deals: InvestmentCommitteeDetectedDeal[],
  candidate: { key: string; title: string }
) {
  return deals.findIndex((deal) => {
    if (deal.key === candidate.key) {
      return true;
    }

    return (
      deal.key.length >= 8 &&
      candidate.key.length >= 8 &&
      (deal.key.includes(candidate.key) || candidate.key.includes(deal.key))
    );
  });
}

export function deriveInvestmentCommitteeDetectedDeals(
  signals: ChiefOfStaffSignal[]
): InvestmentCommitteeDetectedDeal[] {
  const detectedDeals: InvestmentCommitteeDetectedDeal[] = [];

  for (const signal of signals) {
    if (signal.category !== "IC") {
      continue;
    }

    const candidate = extractDealCandidateFromSignal(signal);
    if (!candidate) {
      continue;
    }

    const signalShape: InvestmentCommitteeDetectedDealSignal = {
      id: signal.id,
      title: signal.title,
      summary: signal.summary,
      href: signal.sourceUrl ?? null,
      occurredAt: signal.occurredAt,
      mentionsWill: signalMentionsWill(signal),
      isQuestionSignal: signalLooksQuestionRelated(signal),
      kind: signalLooksQuestionRelated(signal) ? "question" : "general"
    };

    const existingIndex = findMatchingDetectedDealIndex(detectedDeals, candidate);
    if (existingIndex >= 0) {
      const existing = detectedDeals[existingIndex];
      existing.trafficCount += 1;
      if (signalShape.isQuestionSignal) {
        existing.peerQuestionCount += 1;
      }
      existing.relatedSignals.push(signalShape);
      if (candidate.title.length > existing.title.length) {
        existing.title = candidate.title;
      }
      continue;
    }

    detectedDeals.push({
      key: candidate.key,
      title: candidate.title,
      trafficCount: 1,
      peerQuestionCount: signalShape.isQuestionSignal ? 1 : 0,
      relatedSignals: [signalShape]
    });
  }

  return detectedDeals
    .map((deal) => ({
      ...deal,
      relatedSignals: [...deal.relatedSignals].sort((a, b) => {
        if (Number(b.isQuestionSignal) !== Number(a.isQuestionSignal)) {
          return Number(b.isQuestionSignal) - Number(a.isQuestionSignal);
        }

        return Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
      })
    }))
    .sort((a, b) => {
      if (b.peerQuestionCount !== a.peerQuestionCount) {
        return b.peerQuestionCount - a.peerQuestionCount;
      }

      if (b.trafficCount !== a.trafficCount) {
        return b.trafficCount - a.trafficCount;
      }

      return a.title.localeCompare(b.title);
    });
}

async function listInvestmentCommitteeCyclesForUser(userId: string, client: InvestmentCommitteeClient) {
  const { data, error } = await client
    .from("investment_committee_cycles")
    .select(
      "id, user_id, week_of, box_link, memo_due_at, questions_due_at, status, notes, created_at, updated_at, archived_at, deleted_at"
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("week_of", { ascending: false })
    .returns<InvestmentCommitteeCycleRecord[]>();

  if (error) {
    return [];
  }

  return data ?? [];
}

function findInvestmentCommitteeCycleForWeek(
  cycles: InvestmentCommitteeCycleRecord[],
  weekOf: string
) {
  return (
    cycles.find((cycle) => cycle.week_of === weekOf && !cycle.archived_at) ??
    cycles.find((cycle) => cycle.week_of === weekOf) ??
    null
  );
}

async function listInvestmentCommitteeDealsForCycle(
  client: InvestmentCommitteeClient,
  cycleId: string
) {
  const { data, error } = await client
    .from("investment_committee_deals")
    .select(
      "id, user_id, cycle_id, title, memo_link, sponsor, status, question_notes, peer_question_notes, sort_order, created_at, updated_at, archived_at, deleted_at"
    )
    .eq("cycle_id", cycleId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<InvestmentCommitteeDealRecord[]>();

  if (error) {
    return [];
  }

  return data ?? [];
}

export async function getInvestmentCommitteePageData(): Promise<InvestmentCommitteePageData | null> {
  const resolved = await resolveInvestmentCommitteeUser();
  const { loadLocalInvestmentCommitteeAgentEnvelope } = await import("@/lib/investment-committee-agent");
  const envelope = await loadLocalInvestmentCommitteeAgentEnvelope().catch(() => null);

  if (!envelope || shouldHideInvestmentCommitteeBoard("local", envelope.cycle)) {
    return {
      board: null,
      emptyState: {
        title: "No current Investment Committee cycle found.",
        detail: "Current week data is not available."
      }
    };
  }

  const cycleForWeek = resolved
    ? findInvestmentCommitteeCycleForWeek(
        await listInvestmentCommitteeCyclesForUser(resolved.user.id, resolved.client),
        envelope.cycle.weekOf
      )
    : null;
  const visiblePersistedDeals =
    resolved && cycleForWeek
      ? listVisibleInvestmentCommitteeDeals(await listInvestmentCommitteeDealsForCycle(resolved.client, cycleForWeek.id))
      : [];

  return {
    board: buildInvestmentCommitteeBoard(envelope, visiblePersistedDeals, "local"),
    emptyState: null
  };
}

async function getOwnedCycle(cycleId: string): Promise<OwnedCycleContext | { ok: false; error: string }> {
  const resolved = await resolveInvestmentCommitteeUser();
  if (!resolved) {
    return { ok: false, error: "No active app user could be resolved." };
  }

  const { data, error } = await resolved.client
    .from("investment_committee_cycles")
    .select(
      "id, user_id, week_of, box_link, memo_due_at, questions_due_at, status, notes, created_at, updated_at, archived_at, deleted_at"
    )
    .eq("user_id", resolved.user.id)
    .eq("id", cycleId)
    .maybeSingle<InvestmentCommitteeCycleRecord>();

  if (error || !data || data.deleted_at) {
    return { ok: false, error: "That investment committee cycle could not be found." };
  }

  return {
    ok: true,
    client: resolved.client,
    userId: resolved.user.id,
    cycle: data
  };
}

async function ensureInvestmentCommitteeCycleForWeek(
  client: InvestmentCommitteeClient,
  userId: string,
  input: {
    weekOf: string;
    boxFolderUrl?: string | null;
    meetingDate?: string | null;
    questionsDueAt?: string | null;
  }
) {
  const existingCycles = await listInvestmentCommitteeCyclesForUser(userId, client);
  const existing = findInvestmentCommitteeCycleForWeek(existingCycles, input.weekOf);
  if (existing) {
    return existing;
  }

  const insertPayload = {
    user_id: userId,
    week_of: input.weekOf,
    box_link: normalizeUrl(input.boxFolderUrl),
    memo_due_at: normalizeTimestampInput(input.meetingDate),
    questions_due_at: normalizeTimestampInput(input.questionsDueAt),
    status: "active" as const
  };

  const { error } = await client.from("investment_committee_cycles").insert(insertPayload);
  if (error) {
    throw new Error("Cycle could not be created.");
  }

  const refreshedCycles = await listInvestmentCommitteeCyclesForUser(userId, client);
  const created = findInvestmentCommitteeCycleForWeek(refreshedCycles, input.weekOf);
  if (!created) {
    throw new Error("Cycle could not be resolved after creation.");
  }

  return created;
}

function findPersistedDealByTitle(
  deals: InvestmentCommitteeDealRecord[],
  title: string
) {
  const titleKey = normalizeDealKey(title);

  return (
    deals.find((deal) => normalizeDealKey(deal.title) === titleKey) ??
    deals.find((deal) => {
      const dealKey = normalizeDealKey(deal.title);
      return (
        dealKey.length >= 8 &&
        titleKey.length >= 8 &&
        (dealKey.includes(titleKey) || titleKey.includes(dealKey))
      );
    }) ??
    null
  );
}

export async function saveInvestmentCommitteeWillNotes(input: {
  weekOf: string;
  title: string;
  memoUrl?: string | null;
  note?: string | null;
  boxFolderUrl?: string | null;
  meetingDate?: string | null;
  questionsDueAt?: string | null;
}) {
  const resolved = await resolveInvestmentCommitteeUser();
  if (!resolved) {
    return { ok: false as const, error: "No active app user could be resolved." };
  }

  const weekOf = normalizeDateOnly(input.weekOf);
  if (!weekOf) {
    return { ok: false as const, error: "Week of is required." };
  }

  const title = normalizeText(input.title);
  if (!title) {
    return { ok: false as const, error: "Deal title is required." };
  }

  try {
    const cycle = await ensureInvestmentCommitteeCycleForWeek(resolved.client, resolved.user.id, {
      weekOf,
      boxFolderUrl: input.boxFolderUrl,
      meetingDate: input.meetingDate,
      questionsDueAt: input.questionsDueAt
    });
    const visibleDeals = listVisibleInvestmentCommitteeDeals(
      await listInvestmentCommitteeDealsForCycle(resolved.client, cycle.id)
    );
    const existingDeal = findPersistedDealByTitle(visibleDeals, title);
    const normalizedMemoUrl = normalizeUrl(input.memoUrl);
    const normalizedNote = normalizeText(input.note);

    if (!existingDeal) {
      const nextSortOrder = visibleDeals.reduce((max, deal) => Math.max(max, deal.sort_order), -1) + 1;
      const { error } = await resolved.client.from("investment_committee_deals").insert({
        user_id: resolved.user.id,
        cycle_id: cycle.id,
        title,
        memo_link: normalizedMemoUrl,
        status: "not_started",
        question_notes: normalizedNote,
        sort_order: nextSortOrder
      });

      if (error) {
        return { ok: false as const, error: "Will notes could not be saved." };
      }

      return { ok: true as const };
    }

    const { error } = await resolved.client
      .from("investment_committee_deals")
      .update({
        title,
        memo_link: normalizedMemoUrl ?? existingDeal.memo_link,
        question_notes: normalizedNote
      })
      .eq("user_id", resolved.user.id)
      .eq("id", existingDeal.id);

    return error
      ? { ok: false as const, error: "Will notes could not be saved." }
      : { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Will notes could not be saved."
    };
  }
}

export async function saveInvestmentCommitteeCycle(input: {
  cycleId?: string | null;
  weekOf: string;
  boxLink?: string | null;
  memoDueAt?: string | null;
  questionsDueAt?: string | null;
  notes?: string | null;
}) {
  const resolved = await resolveInvestmentCommitteeUser();
  if (!resolved) {
    return { ok: false as const, error: "No active app user could be resolved." };
  }

  const weekOf = normalizeDateOnly(input.weekOf);
  if (!weekOf) {
    return { ok: false as const, error: "Week of is required." };
  }

  const payload = {
    week_of: weekOf,
    box_link: normalizeUrl(input.boxLink),
    memo_due_at: normalizeTimestampInput(input.memoDueAt),
    questions_due_at: normalizeTimestampInput(input.questionsDueAt),
    notes: normalizeText(input.notes)
  };

  if (input.cycleId) {
    const owned = await getOwnedCycle(input.cycleId);
    if (!owned.ok) {
      return owned;
    }

    const { error } = await owned.client
      .from("investment_committee_cycles")
      .update(payload)
      .eq("user_id", owned.userId)
      .eq("id", input.cycleId);

    return error
      ? { ok: false as const, error: "Cycle could not be updated." }
      : { ok: true as const };
  }

  const { error } = await resolved.client.from("investment_committee_cycles").insert({
    user_id: resolved.user.id,
    ...payload,
    status: "active"
  });

  return error
    ? { ok: false as const, error: "Cycle could not be created." }
    : { ok: true as const };
}

export async function updateInvestmentCommitteeCycleStatus(
  cycleId: string,
  status: InvestmentCommitteeCycleStatus
) {
  const owned = await getOwnedCycle(cycleId);
  if (!owned.ok) {
    return owned;
  }

  const updates: Record<string, string | null> = {
    status
  };

  if (status === "archived") {
    updates.archived_at = new Date().toISOString();
  } else if (owned.cycle.archived_at) {
    updates.archived_at = null;
  }

  const { error } = await owned.client
    .from("investment_committee_cycles")
    .update(updates)
    .eq("user_id", owned.userId)
    .eq("id", cycleId);

  return error
    ? { ok: false as const, error: "Cycle status could not be updated." }
    : { ok: true as const };
}

export async function addInvestmentCommitteeDeal(input: {
  cycleId: string;
  title: string;
  memoLink?: string | null;
  sponsor?: string | null;
}) {
  const owned = await getOwnedCycle(input.cycleId);
  if (!owned.ok) {
    return owned;
  }

  const title = normalizeText(input.title);
  if (!title) {
    return { ok: false as const, error: "Deal title is required." };
  }

  const { data: latestDeal } = await owned.client
    .from("investment_committee_deals")
    .select("sort_order")
    .eq("cycle_id", input.cycleId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();

  const { error } = await owned.client.from("investment_committee_deals").insert({
    user_id: owned.userId,
    cycle_id: input.cycleId,
    title,
    memo_link: normalizeUrl(input.memoLink),
    sponsor: normalizeText(input.sponsor),
    status: "not_started",
    sort_order: (latestDeal?.sort_order ?? -1) + 1
  });

  return error
    ? { ok: false as const, error: "Deal could not be added." }
    : { ok: true as const };
}

async function getOwnedDeal(dealId: string) {
  const resolved = await resolveInvestmentCommitteeUser();
  if (!resolved) {
    return { ok: false as const, error: "No active app user could be resolved." };
  }

  const { data, error } = await resolved.client
    .from("investment_committee_deals")
    .select(
      "id, user_id, cycle_id, title, memo_link, sponsor, status, question_notes, peer_question_notes, sort_order, created_at, updated_at, archived_at, deleted_at"
    )
    .eq("user_id", resolved.user.id)
    .eq("id", dealId)
    .maybeSingle<InvestmentCommitteeDealRecord>();

  if (error || !data || data.deleted_at) {
    return { ok: false as const, error: "That deal could not be found." };
  }

  return {
    ok: true as const,
    client: resolved.client,
    userId: resolved.user.id,
    deal: data
  };
}

export async function updateInvestmentCommitteeDeal(input: {
  dealId: string;
  title: string;
  memoLink?: string | null;
  sponsor?: string | null;
  status: string;
  questionNotes?: string | null;
  peerQuestionNotes?: string | null;
}) {
  const owned = await getOwnedDeal(input.dealId);
  if (!owned.ok) {
    return owned;
  }

  const title = normalizeText(input.title);
  if (!title) {
    return { ok: false as const, error: "Deal title is required." };
  }

  if (!isDealStatus(input.status)) {
    return { ok: false as const, error: "Deal status is invalid." };
  }

  const { error } = await owned.client
    .from("investment_committee_deals")
    .update({
      title,
      memo_link: normalizeUrl(input.memoLink),
      sponsor: normalizeText(input.sponsor),
      status: input.status,
      question_notes: normalizeText(input.questionNotes),
      peer_question_notes: normalizeText(input.peerQuestionNotes)
    })
    .eq("user_id", owned.userId)
    .eq("id", input.dealId);

  return error
    ? { ok: false as const, error: "Deal could not be updated." }
    : { ok: true as const };
}

export async function updateInvestmentCommitteeDealStatus(dealId: string, status: string) {
  const owned = await getOwnedDeal(dealId);
  if (!owned.ok) {
    return owned;
  }

  if (!isDealStatus(status)) {
    return { ok: false as const, error: "Deal status is invalid." };
  }

  const { error } = await owned.client
    .from("investment_committee_deals")
    .update({ status })
    .eq("user_id", owned.userId)
    .eq("id", dealId);

  return error
    ? { ok: false as const, error: "Deal status could not be updated." }
    : { ok: true as const };
}

export function formatCycleDateTimeInput(value: string | null) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return toIsoLocalMinute(parsed);
}

export function formatCycleStatusLabel(status: InvestmentCommitteeCycleStatus) {
  switch (status) {
    case "active":
      return "Active";
    case "completed":
      return "Completed";
    case "archived":
      return "Archived";
  }
}

export function formatDealStatusLabel(status: InvestmentCommitteeDealStatus) {
  switch (status) {
    case "not_started":
      return "Not started";
    case "reviewing":
      return "Reviewing";
    case "reviewed":
      return "Reviewed";
    case "questions_drafted":
      return "Questions drafted";
    case "questions_sent":
      return "Questions sent";
  }
}

export function formatStepStateLabel(state: InvestmentCommitteeStepState) {
  switch (state) {
    case "waiting":
      return "Waiting";
    case "in_progress":
      return "In progress";
    case "done":
      return "Done";
    case "needs_attention":
      return "Needs attention";
  }
}

export function getStepToneClass(state: InvestmentCommitteeStepState) {
  switch (state) {
    case "done":
      return "pill-live";
    case "in_progress":
      return "pill-watch";
    case "needs_attention":
      return "pill-priority";
    case "waiting":
    default:
      return "pill-signal";
  }
}
