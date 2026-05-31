import { sanitizeDisplayText } from "@/lib/agent-signal-brief";
import {
  mapOutlookCalendarEventToExecutiveSignal
} from "@/lib/executive-work-adapters";
import type { ExecutiveSignal } from "@/lib/executive-work";
import { listOutlookCalendarViewEvents, type OutlookCalendarViewEvent } from "@/lib/outlook";
import type {
  OutlookAccessTokenResult,
  OutlookSourceConnectionStatus
} from "@/lib/priority-inbox-sources";

const LIVE_CALENDAR_WINDOW_MS = 48 * 60 * 60 * 1000;

export type TodayCalendarSourceStatus = {
  connected: boolean;
  hasCalendarScope: boolean;
  needsReconnect: boolean;
  fetchAttempted: boolean;
  fetchSucceeded: boolean;
  reviewedEventCount: number;
  mappedSignalCount: number;
  liveCalendarVisibleCount: number;
  liveCalendarSurfacedAboveCount: number;
  message?: string;
  connectHref?: string | null;
};

export type TodayMicrosoftSourceMode = "agent_handoff" | "graph_oauth" | "mixed";

function normalizeSignalIdentityTitle(value: string) {
  return sanitizeDisplayText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function signalMeetingTimestamp(signal: ExecutiveSignal) {
  const candidate = signal.due_at ?? signal.source_received_at ?? signal.created_at ?? null;
  if (!candidate) {
    return null;
  }

  const parsed = Date.parse(candidate);
  return Number.isNaN(parsed) ? null : parsed;
}

export function shouldSuppressAgentCalendarSignal(
  signal: ExecutiveSignal,
  liveCalendarSignals: ExecutiveSignal[]
) {
  if (signal.source_type !== "calendar") {
    return false;
  }

  const normalizedTitle = normalizeSignalIdentityTitle(signal.title);
  const signalTimestamp = signalMeetingTimestamp(signal);

  return liveCalendarSignals.some((liveSignal) => {
    if (liveSignal.source_type !== "outlook_calendar") {
      return false;
    }

    if (normalizeSignalIdentityTitle(liveSignal.title) !== normalizedTitle) {
      return false;
    }

    const liveTimestamp = signalMeetingTimestamp(liveSignal);
    if (signalTimestamp === null || liveTimestamp === null) {
      return true;
    }

    return Math.abs(liveTimestamp - signalTimestamp) <= 2 * 60 * 60 * 1000;
  });
}

export function resolveTodayMicrosoftSourceMode(input: {
  hasAgentHandoff: boolean;
  calendarSourceStatus?: TodayCalendarSourceStatus | null;
  liveCalendarSignalCount?: number;
}): TodayMicrosoftSourceMode {
  const hasAgentHandoff = input.hasAgentHandoff;
  const calendarSourceStatus = input.calendarSourceStatus;
  const hasLiveGraphCalendar =
    (input.liveCalendarSignalCount ?? 0) > 0 ||
    Boolean(calendarSourceStatus?.fetchSucceeded) ||
    Boolean(calendarSourceStatus?.connected && calendarSourceStatus?.hasCalendarScope);

  if (hasAgentHandoff && hasLiveGraphCalendar) {
    return "mixed";
  }

  if (hasAgentHandoff) {
    return "agent_handoff";
  }

  return "graph_oauth";
}

export function shouldShowAppNativeCalendarReconnectPrompt(input: {
  sourceMode: TodayMicrosoftSourceMode;
  calendarSourceStatus?: TodayCalendarSourceStatus | null;
}) {
  return Boolean(input.calendarSourceStatus?.needsReconnect && input.sourceMode !== "agent_handoff");
}

export async function listTransientOutlookCalendarExecutiveSignals(options?: {
  now?: Date;
  getAccessToken?: () => Promise<OutlookAccessTokenResult>;
  listCalendarViewEvents?: (
    accessToken: string,
    opts: { startDateTime: Date; endDateTime: Date; top?: number }
  ) => Promise<OutlookCalendarViewEvent[]>;
}) {
  const now = options?.now ?? new Date();
  const listCalendarEvents = options?.listCalendarViewEvents ?? listOutlookCalendarViewEvents;
  const getAccessToken =
    options?.getAccessToken ??
    (async () => {
      const { getOutlookAccessTokenForCurrentUser } = await import("@/lib/priority-inbox-sources");
      return getOutlookAccessTokenForCurrentUser(["Calendars.Read"]);
    });
  const accessTokenResult = await getAccessToken();

  if (!accessTokenResult.ok) {
    return [] as ExecutiveSignal[];
  }

  try {
    const events = await listCalendarEvents(accessTokenResult.accessToken, {
      startDateTime: now,
      endDateTime: new Date(now.getTime() + LIVE_CALENDAR_WINDOW_MS),
      top: 50
    });

    return events
      .map((event) => mapOutlookCalendarEventToExecutiveSignal(event, { now }))
      .filter((signal): signal is ExecutiveSignal => Boolean(signal));
  } catch {
    return [] as ExecutiveSignal[];
  }
}

export async function loadTodayCalendarSignalsWithStatus(options?: {
  now?: Date;
  getConnectionStatus?: () => Promise<OutlookSourceConnectionStatus>;
  getAccessToken?: () => Promise<OutlookAccessTokenResult>;
  listCalendarViewEvents?: (
    accessToken: string,
    opts: { startDateTime: Date; endDateTime: Date; top?: number }
  ) => Promise<OutlookCalendarViewEvent[]>;
}) {
  const now = options?.now ?? new Date();
  const listCalendarEvents = options?.listCalendarViewEvents ?? listOutlookCalendarViewEvents;
  const getAccessToken =
    options?.getAccessToken ??
    (async () => {
      const { getOutlookAccessTokenForCurrentUser } = await import("@/lib/priority-inbox-sources");
      return getOutlookAccessTokenForCurrentUser(["Calendars.Read"]);
    });
  const getConnectionStatus =
    options?.getConnectionStatus ??
    (async () => {
      const { getOutlookSourceConnectionStatusForCurrentUser } = await import("@/lib/priority-inbox-sources");
      return getOutlookSourceConnectionStatusForCurrentUser();
    });

  const connectionStatus = await getConnectionStatus();

  if (!connectionStatus.connected) {
    return {
      signals: [] as ExecutiveSignal[],
      status: {
        connected: false,
        hasCalendarScope: false,
        needsReconnect: false,
        fetchAttempted: false,
        fetchSucceeded: false,
        reviewedEventCount: 0,
        mappedSignalCount: 0,
        liveCalendarVisibleCount: 0,
        liveCalendarSurfacedAboveCount: 0,
        connectHref: connectionStatus.connectHref
      } satisfies TodayCalendarSourceStatus
    };
  }

  if (!connectionStatus.hasCalendarScope) {
    return {
      signals: [] as ExecutiveSignal[],
      status: {
        connected: true,
        hasCalendarScope: false,
        needsReconnect: true,
        fetchAttempted: false,
        fetchSucceeded: false,
        reviewedEventCount: 0,
        mappedSignalCount: 0,
        liveCalendarVisibleCount: 0,
        liveCalendarSurfacedAboveCount: 0,
        message: "Reconnect Outlook to include live calendar context.",
        connectHref: connectionStatus.connectHref
      } satisfies TodayCalendarSourceStatus
    };
  }

  const accessTokenResult = await getAccessToken().catch(
    () =>
      ({
        ok: false,
        error: "Live calendar context is temporarily unavailable.",
        requiresReconnect: false
      }) satisfies OutlookAccessTokenResult
  );

  if (!accessTokenResult.ok) {
    return {
      signals: [] as ExecutiveSignal[],
      status: {
        connected: true,
        hasCalendarScope: true,
        needsReconnect: "requiresReconnect" in accessTokenResult ? (accessTokenResult.requiresReconnect ?? false) : false,
        fetchAttempted: true,
        fetchSucceeded: false,
        reviewedEventCount: 0,
        mappedSignalCount: 0,
        liveCalendarVisibleCount: 0,
        liveCalendarSurfacedAboveCount: 0,
        message: accessTokenResult.error || "Live calendar context is temporarily unavailable.",
        connectHref: connectionStatus.connectHref
      } satisfies TodayCalendarSourceStatus
    };
  }

  try {
    const events = await listCalendarEvents(accessTokenResult.accessToken, {
      startDateTime: now,
      endDateTime: new Date(now.getTime() + LIVE_CALENDAR_WINDOW_MS),
      top: 50
    });
    const signals = events
      .map((event) => mapOutlookCalendarEventToExecutiveSignal(event, { now }))
      .filter((signal): signal is ExecutiveSignal => Boolean(signal));

    return {
      signals,
      status: {
        connected: true,
        hasCalendarScope: true,
        needsReconnect: false,
        fetchAttempted: true,
        fetchSucceeded: true,
        reviewedEventCount: events.length,
        mappedSignalCount: signals.length,
        liveCalendarVisibleCount: 0,
        liveCalendarSurfacedAboveCount: 0,
        connectHref: connectionStatus.connectHref
      } satisfies TodayCalendarSourceStatus
    };
  } catch {
    return {
      signals: [] as ExecutiveSignal[],
      status: {
        connected: true,
        hasCalendarScope: true,
        needsReconnect: false,
        fetchAttempted: true,
        fetchSucceeded: false,
        reviewedEventCount: 0,
        mappedSignalCount: 0,
        liveCalendarVisibleCount: 0,
        liveCalendarSurfacedAboveCount: 0,
        message: "Live calendar context is temporarily unavailable.",
        connectHref: connectionStatus.connectHref
      } satisfies TodayCalendarSourceStatus
    };
  }
}
