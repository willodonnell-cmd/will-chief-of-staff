import "server-only";

import { getLatestExecutiveBriefForUser } from "@/lib/brief/load-executive-brief-page-data";
import {
  createSupabaseMeetingRecordsRepository,
  isMeetingRecordsSchemaUnavailableError,
  listMeetingRecordsForCalendarEvents,
  meetingCalendarEventIdFromBriefItemId,
  summarizeMeetingRecordStatus
} from "@/lib/meetings/meeting-records";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";
import {
  listLibraryItems,
  type LibraryItemSummary
} from "@/lib/capture-library";
import {
  attachMeetingRecordStatusesToTodayViewModel,
  buildTodayViewModel,
  type TodayViewModel
} from "@/lib/today-view-model";

export type TodayPageData = TodayViewModel;

const TODAY_OPEN_TASK_LIMIT = 8;

async function listOpenLibraryTasks(): Promise<LibraryItemSummary[]> {
  return listLibraryItems({
    scope: "tasks",
    mode: "tasks",
    view: null,
    search: "",
    type: "task",
    status: "active",
    priority: "all",
    due: "all",
    category: "all"
  });
}

export async function getTodayPageData(): Promise<TodayPageData | null> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return null;
  }

  const [snapshot, openTasks] = await Promise.all([
    getLatestExecutiveBriefForUser().catch(() => null),
    listOpenLibraryTasks().catch(() => [])
  ]);

  const model = buildTodayViewModel({
    snapshot,
    openTasks: openTasks.slice(0, TODAY_OPEN_TASK_LIMIT)
  });
  const calendarEventIds =
    model.sourceLanes
      .find((lane) => lane.id === "calendar_meetings")
      ?.items.map((item) => item.calendarEventId ?? meetingCalendarEventIdFromBriefItemId(item.id)) ?? [];

  if (calendarEventIds.length === 0) {
    return model;
  }

  try {
    const repository = createSupabaseMeetingRecordsRepository(resolved.client);
    const records = await listMeetingRecordsForCalendarEvents(repository, {
      userId: resolved.user.id,
      calendarSourceSystemId: "executive_brief",
      calendarEventIds
    });

    return attachMeetingRecordStatusesToTodayViewModel(model, records.map(summarizeMeetingRecordStatus));
  } catch (error) {
    if (!isMeetingRecordsSchemaUnavailableError(error)) {
      console.error("[today] Failed to load meeting record statuses.", error);
    }
    return model;
  }
}
