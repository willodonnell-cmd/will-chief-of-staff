import {
  getMicrosoftGraphClientForUser,
  MicrosoftGraphConnectionRequiredError,
  type MicrosoftGraphClient
} from "@/lib/microsoft-graph/client";
import { collectCalendarSource, type CalendarSourceRecord } from "@/lib/microsoft-graph/calendar";
import { collectOutlookSource, type OutlookSourceRecord } from "@/lib/microsoft-graph/outlook";
import { collectTeamsSource, type TeamsSourceRecord } from "@/lib/microsoft-graph/teams";
import type {
  MicrosoftGraphConnectionRepository,
  MicrosoftGraphSourceError,
  MicrosoftGraphSourceResult
} from "@/lib/microsoft-graph/types";
import type { AgentProducedMicrosoft365SignalEnvelope } from "@/lib/microsoft-signal-intake";
import type {
  ChiefOfStaffSignal,
  ChiefOfStaffSignalAttention,
  ChiefOfStaffSignalType
} from "@/lib/chief-of-staff-signal";

const WILL_OWNER = "Will O'Donnell";
const DEFAULT_LOOKBACK_HOURS = 72;
const DEFAULT_CALENDAR_LOOKAHEAD_DAYS = 7;
const SIGNAL_LIMIT_PER_SOURCE = 20;

export type Microsoft365SignalRunOptions = {
  userId: string;
  now?: string;
  lookbackHours?: number;
  calendarLookaheadDays?: number;
  manualRunRequestId?: string | null;
  runSource?: "blackhawk_native_graph";
  graphClient?: MicrosoftGraphClient;
  connectionRepository?: MicrosoftGraphConnectionRepository;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
};

export type Microsoft365SignalRunResult = {
  envelope: AgentProducedMicrosoft365SignalEnvelope;
  sourceErrors: MicrosoftGraphSourceError[];
};

type Classification = {
  signalType: ChiefOfStaffSignalType;
  attention: ChiefOfStaffSignalAttention;
  category: string | null;
  actionRequest: string | null;
  whyItMatters: string;
};

function compact(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function truncate(value: string, max = 420) {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max - 1).trim()}...`;
}

function dedupe(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    const normalized = compact(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    next.push(normalized);
  }

  return next;
}

function hasAny(text: string, keywords: readonly string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

const DIRECT_ASK_KEYWORDS = [
  "can you",
  "could you",
  "please",
  "need you",
  "needs your",
  "waiting on",
  "follow up",
  "respond",
  "reply",
  "review",
  "approve",
  "decision",
  "decide",
  "confirm",
  "send",
  "provide"
] as const;

const STRATEGIC_KEYWORDS = [
  "board",
  "ceo",
  "customer",
  "partner",
  "vendor",
  "strategy",
  "strategic",
  "budget",
  "forecast",
  "deal",
  "investment",
  "diligence",
  "approval",
  "capital",
  "portfolio",
  "committee",
  "executive"
] as const;

const INVESTMENT_COMMITTEE_KEYWORDS = [
  "investment committee",
  "ic memo",
  "ic package",
  "ic pre-review",
  "investment memo",
  "approval package",
  "capital allocation",
  "committee questions",
  "committee comments",
  "ficm",
  "iicm"
] as const;

const LOW_SIGNAL_KEYWORDS = [
  "newsletter",
  "unsubscribe",
  "webinar",
  "promotion",
  "promo",
  "cold sales",
  "cold outreach",
  "press release",
  "pr blast",
  "generic fyi",
  "fyi only",
  "recruiting",
  "sponsored",
  "no action required"
] as const;

const LOW_CALENDAR_KEYWORDS = [
  "hold",
  "focus time",
  "focus block",
  "busy",
  "lunch",
  "commute",
  "travel",
  "ooo",
  "out of office",
  "placeholder"
] as const;

function classifyText(input: {
  source: "outlook" | "calendar" | "teams";
  title: string;
  summary: string;
  participants: string[];
  importance?: "low" | "normal" | "high";
  isMeetingSoon?: boolean;
  isLowCalendar?: boolean;
}): Classification {
  const text = compact([input.title, input.summary, ...input.participants].join(" ")).toLowerCase();
  const directAsk = hasAny(text, DIRECT_ASK_KEYWORDS) || /\?\s*$/.test(input.summary);
  const strategic = hasAny(text, STRATEGIC_KEYWORDS);
  const investmentCommittee = hasAny(text, INVESTMENT_COMMITTEE_KEYWORDS) || /\bic\b.+\b(memo|package|approval|questions|comments)\b/i.test(text);
  const lowSignal = hasAny(text, LOW_SIGNAL_KEYWORDS) || input.isLowCalendar;

  if (investmentCommittee) {
    return {
      signalType: directAsk ? "follow_up" : "status",
      attention: directAsk ? "medium" : "low",
      category: "IC",
      actionRequest: directAsk ? `Review and route Investment Committee context: ${input.title}` : null,
      whyItMatters: "Investment Committee material is routed out of Priority Inbox for the dedicated IC workflow."
    };
  }

  if (lowSignal) {
    return {
      signalType: "status",
      attention: "low",
      category: "general",
      actionRequest: null,
      whyItMatters: "This appears to be low-context, promotional, administrative, or generic FYI material."
    };
  }

  if (input.source === "calendar") {
    return {
      signalType: "meeting",
      attention: input.importance === "high" || strategic || input.isMeetingSoon ? "high" : "medium",
      category: strategic ? "strategic" : "general",
      actionRequest: `Prepare for ${input.title}.`,
      whyItMatters: strategic
        ? "This meeting has executive, strategic, customer, partner, deal, or governance context."
        : "Upcoming meeting context may require preparation or follow-up."
    };
  }

  if (directAsk) {
    return {
      signalType: "follow_up",
      attention: input.importance === "high" || strategic ? "high" : "medium",
      category: strategic ? "strategic" : "general",
      actionRequest: `Close the loop on ${input.title}.`,
      whyItMatters: strategic
        ? "The item contains a direct ask with strategic or executive context."
        : "The item appears to require a direct response or follow-up."
    };
  }

  if (strategic) {
    return {
      signalType: "decision",
      attention: input.importance === "low" ? "medium" : "high",
      category: "strategic",
      actionRequest: `Review the strategic context in ${input.title}.`,
      whyItMatters: "The item references executive, board, customer, partner, vendor, deal, investment, or strategic work."
    };
  }

  return {
    signalType: "status",
    attention: input.source === "teams" ? "low" : "medium",
    category: "general",
    actionRequest: null,
    whyItMatters: "Recent Microsoft 365 activity may be useful background, but no direct action was detected."
  };
}

function sourceWindow(now: string, lookbackHours: number) {
  return {
    start: new Date(Date.parse(now) - lookbackHours * 60 * 60 * 1000).toISOString(),
    end: now
  };
}

function outlookSignal(record: OutlookSourceRecord): ChiefOfStaffSignal {
  const sender = record.senderName ?? record.fromName ?? record.senderEmail ?? record.fromEmail ?? "Unknown sender";
  const participants = dedupe([
    WILL_OWNER,
    sender,
    ...record.toRecipients,
    ...record.ccRecipients
  ]);
  const summary = truncate(record.bodyPreview || `Recent Outlook message from ${sender}.`);
  const classification = classifyText({
    source: "outlook",
    title: record.subject,
    summary,
    participants,
    importance: record.importance
  });

  return {
    id: `outlook-${record.id}`,
    source: "outlook",
    signalType: classification.signalType,
    attention: classification.attention,
    title: record.subject,
    summary,
    whyItMatters: classification.whyItMatters,
    owner: WILL_OWNER,
    sourceLabel: sender,
    sourceReference: record.conversationId ? `Outlook conversation ${record.conversationId}` : "Outlook message",
    occurredAt: record.receivedDateTime,
    dueAt: null,
    sourceUrl: record.webLink,
    category: classification.category,
    actionRequest: classification.actionRequest,
    participants,
    protectedContext: true,
    metadata: {
      nativeGraph: true,
      sourceRecordId: record.id,
      conversationId: record.conversationId,
      importance: record.importance,
      hasAttachments: record.hasAttachments,
      categories: record.categories
    }
  };
}

function calendarSignal(record: CalendarSourceRecord, now: string): ChiefOfStaffSignal {
  const participants = dedupe([WILL_OWNER, record.organizerName ?? record.organizerEmail, ...record.attendees]);
  const summary = truncate(
    record.bodyPreview ||
      [
        record.location ? `Location: ${record.location}` : null,
        record.isOnlineMeeting ? "Online meeting." : null
      ]
        .filter(Boolean)
        .join(" ") ||
      "Upcoming calendar event."
  );
  const startMs = Date.parse(record.start);
  const isMeetingSoon = !Number.isNaN(startMs) && startMs - Date.parse(now) <= 24 * 60 * 60 * 1000;
  const isLowCalendar =
    record.showAs === "free" ||
    hasAny(`${record.subject} ${summary}`.toLowerCase(), LOW_CALENDAR_KEYWORDS);
  const classification = classifyText({
    source: "calendar",
    title: record.subject,
    summary,
    participants,
    importance: record.importance,
    isMeetingSoon,
    isLowCalendar
  });

  return {
    id: `calendar-${record.id}`,
    source: "calendar",
    signalType: classification.signalType,
    attention: classification.attention,
    title: record.subject,
    summary,
    whyItMatters: classification.whyItMatters,
    owner: WILL_OWNER,
    sourceLabel: "Outlook Calendar",
    sourceReference: record.organizerName ?? record.organizerEmail ?? "Calendar event",
    occurredAt: record.start,
    dueAt: record.start,
    sourceUrl: record.webLink,
    category: classification.category,
    actionRequest: classification.actionRequest,
    participants,
    protectedContext: true,
    metadata: {
      nativeGraph: true,
      sourceRecordId: record.id,
      end: record.end,
      location: record.location,
      isOnlineMeeting: record.isOnlineMeeting,
      onlineMeetingProvider: record.onlineMeetingProvider,
      showAs: record.showAs
    }
  };
}

function teamsSignal(record: TeamsSourceRecord): ChiefOfStaffSignal {
  const title = record.chatTopic
    ? `${record.chatTopic}: recent Teams message`
    : `Teams message from ${record.from ?? "unknown sender"}`;
  const participants = dedupe([WILL_OWNER, record.from]);
  const summary = truncate(record.preview || "Recent Teams message.");
  const classification = classifyText({
    source: "teams",
    title,
    summary,
    participants
  });

  return {
    id: `teams-${record.chatId}-${record.messageId}`,
    source: "teams",
    signalType: classification.signalType,
    attention: classification.attention,
    title,
    summary,
    whyItMatters: classification.whyItMatters,
    owner: WILL_OWNER,
    sourceLabel: record.chatTopic ?? record.from ?? "Microsoft Teams",
    sourceReference: `Teams chat ${record.chatId}`,
    occurredAt: record.createdDateTime,
    dueAt: null,
    sourceUrl: record.webUrl,
    category: classification.category,
    actionRequest: classification.actionRequest,
    participants,
    protectedContext: true,
    metadata: {
      nativeGraph: true,
      sourceRecordId: record.messageId,
      chatId: record.chatId,
      chatType: record.chatType
    }
  };
}

function sourceErrors<TRecord>(result: MicrosoftGraphSourceResult<TRecord>) {
  return result.errors;
}

function sortSignalsByAttentionAndTime(left: ChiefOfStaffSignal, right: ChiefOfStaffSignal) {
  const attentionScore: Record<ChiefOfStaffSignalAttention, number> = {
    high: 3,
    medium: 2,
    low: 1
  };
  const scoreDelta = attentionScore[right.attention] - attentionScore[left.attention];
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  return Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
}

export async function runMicrosoft365SignalPullForUser(
  options: Microsoft365SignalRunOptions
): Promise<Microsoft365SignalRunResult> {
  const now = options.now ?? new Date().toISOString();
  const lookbackHours = options.lookbackHours ?? DEFAULT_LOOKBACK_HOURS;
  const calendarLookaheadDays = options.calendarLookaheadDays ?? DEFAULT_CALENDAR_LOOKAHEAD_DAYS;
  const { start: windowStart, end: windowEnd } = sourceWindow(now, lookbackHours);
  const graph =
    options.graphClient ??
    (
      await getMicrosoftGraphClientForUser({
        userId: options.userId,
        repository: options.connectionRepository,
        env: options.env,
        fetchImpl: options.fetchImpl
      })
    ).client;

  if (!graph) {
    throw new MicrosoftGraphConnectionRequiredError("Connect Microsoft 365 to run native Blackhawk signal pulls.");
  }

  const [outlook, calendar, teams] = await Promise.all([
    collectOutlookSource(graph, { now, lookbackHours }),
    collectCalendarSource(graph, { now, lookaheadDays: calendarLookaheadDays }),
    collectTeamsSource(graph, { now, lookbackHours })
  ]);

  const outlookSignals = outlook.records.slice(0, SIGNAL_LIMIT_PER_SOURCE).map(outlookSignal);
  const calendarSignals = calendar.records.slice(0, SIGNAL_LIMIT_PER_SOURCE).map((record) => calendarSignal(record, now));
  const teamsSignals = teams.records.slice(0, SIGNAL_LIMIT_PER_SOURCE).map(teamsSignal);
  const signals = [...outlookSignals, ...calendarSignals, ...teamsSignals].sort(sortSignalsByAttentionAndTime);
  const sourceErrorsList = [
    ...sourceErrors(outlook),
    ...sourceErrors(calendar),
    ...sourceErrors(teams)
  ];

  return {
    envelope: {
      producer: "blackhawk_native",
      connectorFamily: "microsoft_365",
      producedAt: now,
      tenantLabel: "Blackhawk Microsoft Graph",
      status: "succeeded",
      sourcesChecked: ["outlook", "calendar", "teams"],
      windowStart,
      windowEnd,
      sourceCoverage: {
        outlook: {
          ...outlook.coverage,
          signalCount: outlookSignals.length
        },
        calendar: {
          ...calendar.coverage,
          signalCount: calendarSignals.length
        },
        teams: {
          ...teams.coverage,
          signalCount: teamsSignals.length
        }
      },
      signals,
      manualRunRequestId: options.manualRunRequestId ?? undefined,
      runSource: options.runSource ?? "blackhawk_native_graph"
    },
    sourceErrors: sourceErrorsList
  };
}
