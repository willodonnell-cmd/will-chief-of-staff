export const BLACKHAWK_LIVE_BRIEF_CONTRACT_VERSION = "blackhawk.live-brief.v1" as const;

export const LIVE_BRIEF_SOURCE_NAMES = ["outlook", "calendar", "teams"] as const;
export type LiveBriefSourceName = (typeof LIVE_BRIEF_SOURCE_NAMES)[number];

export type LiveBriefSourceStatus = "available" | "partial" | "unavailable" | "error";
export type LiveBriefConfidence = "high" | "medium" | "low";
export type LiveBriefPriority = "critical" | "high" | "medium" | "low";
export type LiveBriefChange = "new" | "changed" | "reranked" | "unchanged";

export type LiveBriefSourceReference = {
  source: LiveBriefSourceName | "blackhawk_backend" | "obsidian" | "box" | "web" | "pitchbook";
  id: string;
  label: string;
  url: string | null;
  occurredAt: string | null;
};

export type LiveBriefItem = {
  id: string;
  canonicalIssueKey: string;
  kind: "top_action" | "decision" | "meeting_prep" | "waiting_on" | "personal_task";
  headline: string;
  explanation: string;
  priority: LiveBriefPriority;
  confidence: LiveBriefConfidence;
  change: LiveBriefChange;
  rank: number | null;
  context: string | null;
  whyNow: string | null;
  recommendedNextMove: string | null;
  relatedPeople: string[];
  relatedCompanies: string[];
  relatedTopic: string | null;
  dueAt: string | null;
  meetingStartAt: string | null;
  waitingOn: string | null;
  expectedTrigger: string | null;
  evidence: LiveBriefSourceReference[];
  sourceConflict: {
    summary: string;
    sources: LiveBriefSourceReference[];
  } | null;
  allowedActions: Array<
    "move_to_waiting_on" | "accept_as_task" | "dismiss" | "draft_response" | "run_deeper_research" | "adjust"
  >;
};

export type LiveBriefSection = {
  items: LiveBriefItem[];
  additionalItemCount: number;
};

export type BlackhawkLiveBrief = {
  contractVersion: typeof BLACKHAWK_LIVE_BRIEF_CONTRACT_VERSION;
  briefId: string;
  generatedAt: string;
  previousBriefId: string | null;
  refresh: {
    trigger: "open" | "scheduled" | "manual";
    status: "succeeded" | "partial" | "failed";
    startedAt: string;
    completedAt: string;
    materialChangeCount: number;
  };
  sourceCoverage: Record<LiveBriefSourceName, {
    status: LiveBriefSourceStatus;
    checkedAt: string;
    warning: string | null;
  }>;
  sections: {
    topActions: LiveBriefSection;
    decisionsNeeded: LiveBriefSection;
    meetingPrep: LiveBriefSection;
    waitingOn: LiveBriefSection;
    personal: LiveBriefSection;
  };
  navigation: {
    investmentCommittee: true;
    tasksAndWaitingOn: true;
    adminAndSettings: true;
  };
};

export type LiveBriefValidationOptions = {
  now?: string | Date;
  maximumAgeMinutes?: number;
};

export type LiveBriefValidationResult = {
  ok: boolean;
  errors: string[];
};

function isIsoDate(value: string) {
  return Boolean(value) && !Number.isNaN(Date.parse(value));
}

function allVisibleItems(brief: BlackhawkLiveBrief) {
  return [
    ...brief.sections.topActions.items,
    ...brief.sections.decisionsNeeded.items,
    ...brief.sections.meetingPrep.items,
    ...brief.sections.waitingOn.items,
    ...brief.sections.personal.items
  ];
}

export function validateBlackhawkLiveBrief(
  brief: BlackhawkLiveBrief,
  options: LiveBriefValidationOptions = {}
): LiveBriefValidationResult {
  const errors: string[] = [];
  const visibleItems = allVisibleItems(brief);
  const sectionKinds: Array<[LiveBriefSection, LiveBriefItem["kind"], string]> = [
    [brief.sections.topActions, "top_action", "Top Actions"],
    [brief.sections.decisionsNeeded, "decision", "Decisions Needed"],
    [brief.sections.meetingPrep, "meeting_prep", "Meeting Preparation"],
    [brief.sections.waitingOn, "waiting_on", "Waiting On"],
    [brief.sections.personal, "personal_task", "Personal"]
  ];

  if (brief.contractVersion !== BLACKHAWK_LIVE_BRIEF_CONTRACT_VERSION) {
    errors.push(`Unsupported contract version: ${brief.contractVersion}.`);
  }

  if (!brief.briefId.trim()) {
    errors.push("briefId is required.");
  }

  if (!isIsoDate(brief.generatedAt)) {
    errors.push("generatedAt must be an ISO-compatible timestamp.");
  }

  if (brief.sections.topActions.items.length > 5) {
    errors.push("The opening brief may contain at most five top actions.");
  }

  for (const [section, expectedKind, label] of sectionKinds) {
    if (section.additionalItemCount < 0 || !Number.isInteger(section.additionalItemCount)) {
      errors.push(`${label} additionalItemCount must be a non-negative integer.`);
    }
    for (const item of section.items) {
      if (item.kind !== expectedKind) {
        errors.push(`Item ${item.id} has kind ${item.kind} but appears in ${label}.`);
      }
    }
  }

  const lowConfidenceItems = visibleItems.filter((item) => item.confidence === "low");
  if (lowConfidenceItems.length > 1) {
    errors.push("The opening brief may contain at most one low-confidence item.");
  }

  const ids = new Set<string>();
  const issueKeys = new Set<string>();
  for (const item of visibleItems) {
    if (ids.has(item.id)) {
      errors.push(`Duplicate brief item id: ${item.id}.`);
    }
    ids.add(item.id);

    if (issueKeys.has(item.canonicalIssueKey)) {
      errors.push(`Duplicate executive issue: ${item.canonicalIssueKey}. Combine related sources into one item.`);
    }
    issueKeys.add(item.canonicalIssueKey);

    if (!item.headline.trim() || !item.explanation.trim()) {
      errors.push(`Item ${item.id} requires a headline and one-sentence explanation.`);
    }

    if (item.evidence.length === 0) {
      errors.push(`Item ${item.id} has no supporting source.`);
    }

    if (item.sourceConflict && item.sourceConflict.sources.length < 2) {
      errors.push(`Item ${item.id} source conflict must preserve at least two sources.`);
    }

    if (item.kind === "personal_task" && !brief.sections.personal.items.some((candidate) => candidate.id === item.id)) {
      errors.push(`Personal task ${item.id} must remain in the Personal section.`);
    }

    if (/\binvestment committee\b|\bIC\b/i.test(`${item.headline} ${item.explanation}`)) {
      errors.push(`Item ${item.id} appears to be Investment Committee work and must stay outside the main brief.`);
    }
  }

  for (const source of LIVE_BRIEF_SOURCE_NAMES) {
    const coverage = brief.sourceCoverage[source];
    if (!coverage) {
      errors.push(`Missing source coverage for ${source}.`);
      continue;
    }
    if (!isIsoDate(coverage.checkedAt)) {
      errors.push(`Source coverage for ${source} requires a checkedAt timestamp.`);
    }
    if (coverage.status !== "available" && !coverage.warning?.trim()) {
      errors.push(`Source coverage for ${source} requires a warning when it is not fully available.`);
    }
  }

  if (options.maximumAgeMinutes !== undefined && isIsoDate(brief.generatedAt)) {
    const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
    const ageMinutes = (now.getTime() - Date.parse(brief.generatedAt)) / 60_000;
    if (ageMinutes > options.maximumAgeMinutes) {
      errors.push(`Brief is stale by ${Math.floor(ageMinutes - options.maximumAgeMinutes)} minute(s).`);
    }
  }

  return { ok: errors.length === 0, errors };
}
