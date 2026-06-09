import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  EXECUTIVE_BRIEF_SLOT_LABELS,
  countStructuredExecutiveBriefItems,
  listExecutiveBriefSnapshotsForUser,
  type ExecutiveBriefSnapshot,
  type ExecutiveBriefSlotLabel
} from "@/lib/brief/executive-brief-snapshots";
import { buildStructuredBriefSourceLanes } from "@/lib/brief/source-lanes";
import {
  createSupabaseMeetingRecordsRepository,
  isMeetingRecordsSchemaUnavailableError,
  listMeetingRecordsForCalendarEvents,
  meetingCalendarEventIdFromBriefItemId,
  summarizeMeetingRecordStatus,
  type MeetingRecordStatusSummary
} from "@/lib/meetings/meeting-records";
import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

export type ExecutiveBriefSlot = {
  label: ExecutiveBriefSlotLabel;
  status: "waiting" | "processed";
  processedAt: string | null;
  itemCount: number;
  snapshot: ExecutiveBriefSnapshot | null;
};

export type ExecutiveBriefPageData = {
  latestSnapshot: ExecutiveBriefSnapshot | null;
  dismissedTaskCandidateIds: string[];
  meetingRecordStatuses: Record<string, MeetingRecordStatusSummary>;
  slots: ExecutiveBriefSlot[];
  emptyState: {
    title: string;
    detail: string;
  };
};

function buildEmptyExecutiveBriefPageData(): ExecutiveBriefPageData {
  return {
    latestSnapshot: null,
    dismissedTaskCandidateIds: [],
    meetingRecordStatuses: {},
    slots: EXECUTIVE_BRIEF_SLOT_LABELS.map((label) => ({
      label,
      status: "waiting",
      processedAt: null,
      itemCount: 0,
      snapshot: null
    })),
    emptyState: {
      title: "No processed Blackhawk Executive Brief exists yet.",
      detail:
        "Blackhawk is waiting for a BLACKHAWK_BRIEF_BUNDLE email through CloudMailIn. Once that agent-email bundle is processed, the latest snapshot will appear here."
    }
  };
}

async function listMeetingRecordStatusesForSnapshot(params: {
  client: SupabaseClient;
  userId: string;
  snapshot: ExecutiveBriefSnapshot | null;
}) {
  const structuredBrief = params.snapshot?.structuredBrief ?? null;
  if (!structuredBrief) {
    return {};
  }

  const meetingCalendarEventIds = buildStructuredBriefSourceLanes({ structuredBrief })
    .flatMap((lane) => lane.entries)
    .filter((entry) => entry.section === "meetingPrep")
    .map((entry) => entry.item.calendarEventId ?? meetingCalendarEventIdFromBriefItemId(entry.id));

  if (meetingCalendarEventIds.length === 0) {
    return {};
  }

  try {
    const repository = createSupabaseMeetingRecordsRepository(params.client);
    const records = await listMeetingRecordsForCalendarEvents(repository, {
      userId: params.userId,
      calendarSourceSystemId: "executive_brief",
      calendarEventIds: meetingCalendarEventIds
    });

    return Object.fromEntries(records.map((record) => {
      const status = summarizeMeetingRecordStatus(record);
      return [status.calendarEventId, status];
    }));
  } catch (error) {
    if (!isMeetingRecordsSchemaUnavailableError(error)) {
      console.error("[brief] Failed to load meeting record statuses.", error);
    }
    return {};
  }
}

function snapshotSortTime(snapshot: ExecutiveBriefSnapshot) {
  return Date.parse(snapshot.generatedAt ?? snapshot.createdAt) || 0;
}

function selectLatestExecutiveBriefSnapshot(snapshots: ExecutiveBriefSnapshot[]) {
  return snapshots.reduce<ExecutiveBriefSnapshot | null>((latest, snapshot) => {
    if (!latest || snapshotSortTime(snapshot) > snapshotSortTime(latest)) {
      return snapshot;
    }

    return latest;
  }, null);
}

export async function getLatestExecutiveBriefForUser(): Promise<ExecutiveBriefSnapshot | null> {
  const resolved = await resolveCurrentAppUser();

  if (!resolved) {
    return null;
  }

  const snapshots = await listExecutiveBriefSnapshotsForUser({
    client: resolved.client,
    userId: resolved.user.id
  });

  return selectLatestExecutiveBriefSnapshot(snapshots);
}

async function listDismissedTaskCandidateIds(params: {
  client: SupabaseClient;
  userId: string;
  snapshotId: string;
}) {
  const { data, error } = await params.client
    .from("executive_brief_item_feedback")
    .select("item_id")
    .eq("user_id", params.userId)
    .eq("snapshot_id", params.snapshotId)
    .eq("item_kind", "task_candidate")
    .eq("feedback_type", "dismissed")
    .returns<{ item_id: string }[]>();

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => row.item_id);
}

export async function loadExecutiveBriefPageData(): Promise<ExecutiveBriefPageData> {
  const emptyData = buildEmptyExecutiveBriefPageData();
  const resolved = await resolveCurrentAppUser();

  if (!resolved) {
    return emptyData;
  }

  try {
    const snapshots = await listExecutiveBriefSnapshotsForUser({
      client: resolved.client,
      userId: resolved.user.id
    });
    const latestBySlot = new Map<ExecutiveBriefSlotLabel, ExecutiveBriefSnapshot>();

    for (const snapshot of snapshots) {
      if (!latestBySlot.has(snapshot.slot)) {
        latestBySlot.set(snapshot.slot, snapshot);
      }
    }

    const latestSnapshot = selectLatestExecutiveBriefSnapshot(snapshots);
    const dismissedTaskCandidateIds = latestSnapshot
      ? await listDismissedTaskCandidateIds({
          client: resolved.client,
          userId: resolved.user.id,
          snapshotId: latestSnapshot.id
        })
      : [];
    const meetingRecordStatuses = await listMeetingRecordStatusesForSnapshot({
      client: resolved.client,
      userId: resolved.user.id,
      snapshot: latestSnapshot
    });

    return {
      latestSnapshot,
      dismissedTaskCandidateIds,
      meetingRecordStatuses,
      slots: EXECUTIVE_BRIEF_SLOT_LABELS.map((label) => {
        const snapshot = latestBySlot.get(label) ?? null;
        return {
          label,
          status: snapshot ? "processed" : "waiting",
          processedAt: snapshot?.generatedAt ?? snapshot?.createdAt ?? null,
          itemCount: snapshot ? Math.max(countStructuredExecutiveBriefItems(snapshot.structuredBrief), 1) : 0,
          snapshot
        };
      }),
      emptyState: emptyData.emptyState
    };
  } catch {
    return emptyData;
  }
}
