import "server-only";

import { getLatestExecutiveBriefForUser } from "@/lib/brief/load-executive-brief-page-data";
import {
  createSupabaseMeetingRecordsRepository,
  isMeetingRecordsSchemaUnavailableError,
  listMeetingRecordsForCalendarEventLookups,
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
import { buildInvestmentCommitteeCandidateRegistryEntries, getInvestmentCommitteePageData } from "@/lib/investment-committee";
import { selectTodayExecutiveItemCandidates } from "@/lib/today-executive-item-candidates";

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
  const executiveItemCandidates = await getTodayExecutiveItemCandidates().catch((error) => {
    console.error("[today] Failed to load Executive Item candidates.", error);
    return [];
  });

  const model = buildTodayViewModel({
    snapshot,
    openTasks: openTasks.slice(0, TODAY_OPEN_TASK_LIMIT),
    executiveItemCandidates
  });
  const calendarLookups =
    model.sourceLanes
      .find((lane) => lane.id === "calendar_meetings")
      ?.items.map((item) => ({
        calendarEventId: item.calendarEventId ?? meetingCalendarEventIdFromBriefItemId(item.id),
        calendarSourceSystemId: item.calendarSourceSystemId ?? "executive_brief"
      })) ?? [];

  if (calendarLookups.length === 0) {
    return model;
  }

  try {
    const repository = createSupabaseMeetingRecordsRepository(resolved.client);
    const records = await listMeetingRecordsForCalendarEventLookups(repository, {
      userId: resolved.user.id,
      lookups: calendarLookups
    });

    return attachMeetingRecordStatusesToTodayViewModel(model, records.map(summarizeMeetingRecordStatus));
  } catch (error) {
    if (!isMeetingRecordsSchemaUnavailableError(error)) {
      console.error("[today] Failed to load meeting record statuses.", error);
    }
    return model;
  }
}

export async function getTodayExecutiveItemCandidates() {
  const investmentCommitteeData = await getInvestmentCommitteePageData();
  return selectTodayExecutiveItemCandidates(
    buildInvestmentCommitteeCandidateRegistryEntries(investmentCommitteeData?.board ?? null)
  );
}
