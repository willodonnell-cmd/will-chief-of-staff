import type { WorkSignal, WorkSignalRelevance } from "@/lib/work-signals/types";

type OutlookRankingMetadata = {
  inferenceClassification?: string | null;
  isRead?: boolean | null;
  hasAttachments?: boolean | null;
  flagStatus?: string | null;
};

function getOutlookRankingMetadata(signal: WorkSignal): OutlookRankingMetadata {
  const outlook = signal.rawMetadata.outlook;
  if (!outlook || typeof outlook !== "object" || Array.isArray(outlook)) {
    return {};
  }

  return outlook as OutlookRankingMetadata;
}

export function scoreExecutiveRelevance(signal: WorkSignal): WorkSignalRelevance {
  const reasons: WorkSignalRelevance["reasons"] = [];
  const outlook = getOutlookRankingMetadata(signal);

  if (outlook.isRead === false) {
    reasons.push({ code: "unread", label: "Unread message", weight: 2 });
  }

  if (signal.importance === "high") {
    reasons.push({ code: "high_importance", label: "High importance", weight: 3 });
  }

  if (outlook.flagStatus === "flagged") {
    reasons.push({ code: "flagged", label: "Flagged in Outlook", weight: 2 });
  }

  if (outlook.inferenceClassification === "focused") {
    reasons.push({ code: "focused_inbox", label: "Focused Inbox classification", weight: 1 });
  }

  const timestamp = signal.timestamp ? Date.parse(signal.timestamp) : Number.NaN;
  if (Number.isFinite(timestamp)) {
    const ageHours = Math.max(0, (Date.now() - timestamp) / 3_600_000);

    if (ageHours <= 6) {
      reasons.push({ code: "recent", label: "Received within 6 hours", weight: 2 });
    } else if (ageHours <= 24) {
      reasons.push({ code: "recent", label: "Received within 24 hours", weight: 1 });
    }
  }

  if (outlook.hasAttachments) {
    reasons.push({ code: "attachments", label: "Includes attachments", weight: 1 });
  }

  if (signal.extractedActions.length > 0 || /\b(follow up|let me know|action required)\b/i.test(`${signal.title} ${signal.bodyOrSummary}`)) {
    reasons.push({ code: "direct_ask", label: "Direct ask or follow-up language", weight: 2 });
  }

  const score = reasons.reduce((total, reason) => total + reason.weight, 0);
  const level = score >= 7 ? "high" : score >= 4 ? "medium" : "low";

  return {
    score,
    level,
    reasons
  };
}

export function rankWorkSignals<T extends WorkSignal>(signals: T[]) {
  return [...signals].sort((left, right) => {
    const leftScore = scoreExecutiveRelevance(left).score;
    const rightScore = scoreExecutiveRelevance(right).score;

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    const rightTimestamp = Date.parse(right.timestamp ?? "");
    const leftTimestamp = Date.parse(left.timestamp ?? "");
    const normalizedRight = Number.isFinite(rightTimestamp) ? rightTimestamp : 0;
    const normalizedLeft = Number.isFinite(leftTimestamp) ? leftTimestamp : 0;

    return normalizedRight - normalizedLeft;
  });
}
