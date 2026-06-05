import type { MicrosoftGraphClient } from "@/lib/microsoft-graph/client";
import { sourceResultFromError } from "@/lib/microsoft-graph/outlook";
import type { GraphEmailRecipient } from "@/lib/microsoft-graph/outlook";
import type { MicrosoftGraphSourceResult } from "@/lib/microsoft-graph/types";

type GraphDateTimeTimeZone = {
  dateTime?: string | null;
  timeZone?: string | null;
};

type GraphCalendarEvent = {
  id: string;
  subject?: string | null;
  organizer?: GraphEmailRecipient | null;
  attendees?: Array<GraphEmailRecipient & { type?: "required" | "optional" | "resource" | null }> | null;
  start?: GraphDateTimeTimeZone | null;
  end?: GraphDateTimeTimeZone | null;
  webLink?: string | null;
  location?: {
    displayName?: string | null;
  } | null;
  isOnlineMeeting?: boolean | null;
  onlineMeetingProvider?: string | null;
  bodyPreview?: string | null;
  isCancelled?: boolean | null;
  showAs?: string | null;
  importance?: "low" | "normal" | "high" | null;
};

export type CalendarSourceRecord = {
  id: string;
  subject: string;
  organizerName: string | null;
  organizerEmail: string | null;
  attendees: string[];
  start: string;
  end: string | null;
  webLink: string | null;
  location: string | null;
  isOnlineMeeting: boolean;
  onlineMeetingProvider: string | null;
  bodyPreview: string;
  showAs: string | null;
  importance: "low" | "normal" | "high";
};

function compact(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeGraphDate(value: GraphDateTimeTimeZone | null | undefined) {
  const dateTime = compact(value?.dateTime);
  if (!dateTime) {
    return null;
  }

  const withZone = /(?:z|[+-]\d{2}:\d{2})$/i.test(dateTime) ? dateTime : `${dateTime}Z`;
  const parsed = Date.parse(withZone);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function attendeeLabel(attendee: GraphEmailRecipient | null | undefined) {
  const name = compact(attendee?.emailAddress?.name);
  const address = compact(attendee?.emailAddress?.address);
  return name || address || null;
}

export function normalizeGraphCalendarEvent(event: GraphCalendarEvent): CalendarSourceRecord | null {
  if (event.isCancelled) {
    return null;
  }

  const id = compact(event.id);
  const start = normalizeGraphDate(event.start);
  if (!id || !start) {
    return null;
  }

  return {
    id,
    subject: compact(event.subject) || "Untitled meeting",
    organizerName: compact(event.organizer?.emailAddress?.name) || null,
    organizerEmail: compact(event.organizer?.emailAddress?.address) || null,
    attendees: (event.attendees ?? []).map(attendeeLabel).filter((value): value is string => Boolean(value)),
    start,
    end: normalizeGraphDate(event.end),
    webLink: compact(event.webLink) || null,
    location: compact(event.location?.displayName) || null,
    isOnlineMeeting: event.isOnlineMeeting ?? false,
    onlineMeetingProvider: compact(event.onlineMeetingProvider) || null,
    bodyPreview: compact(event.bodyPreview).slice(0, 800),
    showAs: compact(event.showAs) || null,
    importance: event.importance ?? "normal"
  };
}

export async function collectCalendarSource(
  client: MicrosoftGraphClient,
  options: {
    now?: string;
    lookaheadDays?: number;
    top?: number;
  } = {}
): Promise<MicrosoftGraphSourceResult<CalendarSourceRecord>> {
  const checkedAt = options.now ?? new Date().toISOString();
  const start = new Date(checkedAt).toISOString();
  const end = new Date(Date.parse(checkedAt) + (options.lookaheadDays ?? 7) * 24 * 60 * 60 * 1000).toISOString();
  const query = new URLSearchParams({
    startDateTime: start,
    endDateTime: end,
    $select:
      "id,subject,organizer,attendees,start,end,webLink,location,isOnlineMeeting,onlineMeetingProvider,bodyPreview,isCancelled,showAs,importance",
    $orderby: "start/dateTime",
    $top: `${Math.max(1, Math.min(options.top ?? 50, 50))}`
  });

  try {
    const events = await client.getJsonPages<GraphCalendarEvent>(
      `/me/calendarView?${query.toString()}`,
      {
        headers: {
          Prefer: 'outlook.timezone="UTC"'
        }
      }
    );
    const records = events
      .map(normalizeGraphCalendarEvent)
      .filter((record): record is CalendarSourceRecord => Boolean(record));

    return {
      records,
      coverage: {
        status: records.length > 0 ? "included" : "empty",
        checkedAt,
        signalCount: records.length,
        reason: null
      },
      errors: []
    };
  } catch (error) {
    return sourceResultFromError("calendar", error, checkedAt);
  }
}
