import "server-only";

import {
  EXECUTIVE_BRIEF_SLOT_LABELS,
  listExecutiveBriefSnapshotsForUser,
  type ExecutiveBriefSnapshot,
  type ExecutiveBriefSlotLabel
} from "@/lib/brief/executive-brief-snapshots";
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
  slots: ExecutiveBriefSlot[];
  emptyState: {
    title: string;
    detail: string;
  };
};

function buildEmptyExecutiveBriefPageData(): ExecutiveBriefPageData {
  return {
    latestSnapshot: null,
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

function snapshotSortTime(snapshot: ExecutiveBriefSnapshot) {
  return Date.parse(snapshot.generatedAt ?? snapshot.createdAt) || 0;
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

    const latestSnapshot = snapshots.reduce<ExecutiveBriefSnapshot | null>((latest, snapshot) => {
      if (!latest || snapshotSortTime(snapshot) > snapshotSortTime(latest)) {
        return snapshot;
      }

      return latest;
    }, null);

    return {
      latestSnapshot,
      slots: EXECUTIVE_BRIEF_SLOT_LABELS.map((label) => {
        const snapshot = latestBySlot.get(label) ?? null;
        return {
          label,
          status: snapshot ? "processed" : "waiting",
          processedAt: snapshot?.generatedAt ?? snapshot?.createdAt ?? null,
          itemCount: snapshot ? 1 : 0,
          snapshot
        };
      }),
      emptyState: emptyData.emptyState
    };
  } catch {
    return emptyData;
  }
}
