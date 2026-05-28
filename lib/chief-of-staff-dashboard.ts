import "server-only";

import {
  getChiefOfStaffDailyBriefData,
  type DailyBriefCardConfidence,
  type DailyBriefCardPriority,
  type DailyBriefCardSource,
  type DailyBriefItem
} from "@/lib/chief-of-staff-daily-brief";
import type {
  ChiefOfStaffCard,
  ChiefOfStaffDashboardData,
  DashboardConfidence,
  DashboardPriority,
  DashboardSource,
  PreparedBrief
} from "@/src/chief-of-staff-dashboard-state";

function mapPriority(priority: DailyBriefCardPriority): DashboardPriority {
  switch (priority) {
    case "p1":
      return "P1";
    case "p2":
      return "P2";
    case "p3":
    default:
      return "P3";
  }
}

function mapConfidence(confidence: DailyBriefCardConfidence): DashboardConfidence {
  switch (confidence) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "needs_review":
    default:
      return "Needs Review";
  }
}

function mapSource(source: DailyBriefCardSource): DashboardSource {
  switch (source) {
    case "manual_capture":
      return "manual-capture";
    case "email":
      return "email";
    case "teams":
      return "teams";
    case "calendar":
      return "calendar";
    case "transcript":
      return "transcript";
    case "document":
      return "document";
    case "taskrobin":
      return "taskrobin";
    case "brain":
      return "brain";
    case "needs_review":
    default:
      return "needs-review";
  }
}

function mapCardType(item: DailyBriefItem): ChiefOfStaffCard["type"] {
  if (item.recordType === "capture") {
    return item.tags.some((tag) => tag.toLowerCase() === "fyi") ? "fyi" : "captured";
  }

  return "priority";
}

function toCard(item: DailyBriefItem, typeOverride?: ChiefOfStaffCard["type"]): ChiefOfStaffCard {
  const type = typeOverride ?? mapCardType(item);
  const status =
    type === "waiting_on" ? "Waiting On" : item.priority === "p1" ? "Priority" : "Today";

  return {
    id: item.id,
    title: item.title,
    type,
    status,
    priority: mapPriority(item.priority),
    confidence: mapConfidence(item.confidence),
    source: mapSource(item.source),
    sourceAnchor: item.sourceAnchor,
    createdAt: item.timestamp ?? item.updatedAt ?? new Date().toISOString(),
    updatedAt: item.updatedAt ?? item.timestamp ?? new Date().toISOString(),
    reason: item.reason,
    description: item.bodyOrSummary,
    recommendedAction: item.recommendedAction,
    sourceSummary: item.sourceSummary,
    sourceHref: item.sourceHref,
    dueDate: item.dueDate,
    counterparty: item.counterparty,
    expectedOutcome: item.expectedOutcome,
    tags: item.tags
  };
}

function toPreparedBrief(brief: Awaited<ReturnType<typeof getChiefOfStaffDailyBriefData>>["meetingPrep"][number]): PreparedBrief {
  return {
    id: brief.id,
    meetingId: brief.meetingId,
    meetingTitle: brief.meetingTitle,
    startsAt: brief.startsAt,
    level: brief.level,
    confidence: mapConfidence(brief.confidence),
    source: mapSource(brief.source),
    sourceAnchor: brief.sourceAnchor,
    whyShown: brief.whyShown,
    sourceSummary: brief.sourceSummary,
    sourceHref: brief.sourceHref,
    sections: brief.sections,
    recommendedAction: brief.recommendedAction
  };
}

export async function getChiefOfStaffDashboardData(): Promise<ChiefOfStaffDashboardData> {
  const brief = await getChiefOfStaffDailyBriefData();

  return {
    decisionsNeeded: brief.decisionsNeeded.map((item) => toCard(item, "decision")),
    peopleWaitingOnWill: brief.peopleWaitingOnWill.map((item) => toCard(item, "waiting_on")),
    priorityInboxItems: brief.priorityInboxItems.map((item) => toCard(item, "priority")),
    preparedBriefs: brief.meetingPrep.map((item) => toPreparedBrief(item)),
    prepCandidates: [],
    strategicFyis: brief.strategicFyis.map((item) => toCard(item, "fyi")),
    followUpsOpenLoops: brief.followUpsOpenLoops.map((item) => toCard(item, "follow_up")),
    recentlyCaptured: brief.recentlyCaptured.map((item) => toCard(item, "captured")),
    lowValueNoiseFiltered: brief.lowValueNoiseFiltered,
    emptyStates: brief.emptyStates,
    links: {
      brainHref: "/library",
      vaultSearchHref: "/library?search=",
      investmentAgentHref: "/investment-agent"
    }
  };
}
