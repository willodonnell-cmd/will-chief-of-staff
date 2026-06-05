import type { ClassifiedSignalCandidate, SignalCandidate } from "../types";
import { buildSignalId } from "../utils/ids";
import { minutesUntil } from "../utils/iso";
import { classifyRoutingSurface } from "./routing-classifier";

const PRIORITY_KEYWORDS = [
  "board",
  "executive",
  "direct report",
  "customer",
  "partner",
  "investor",
  "vendor",
  "relationship",
  "operations",
  "warehouse",
  "automation",
  "robotics",
  "ai",
  "supply chain",
  "tariff",
  "regulation",
  "capital",
  "energy",
  "data center",
  "prologis",
  "m&a",
  "partnership",
  "portfolio",
  "term sheet",
  "legal",
  "approval",
  "budget"
] as const;

const DECISION_KEYWORDS = ["approve", "decision", "sign off", "choose", "review", "term sheet"] as const;

function normalized(value: string) {
  return value.toLowerCase();
}

function firstSentence(value: string) {
  const sentence = value.replace(/\s+/g, " ").trim();
  return sentence.length > 180 ? `${sentence.slice(0, 177)}...` : sentence;
}

function matchedKeywords(candidate: SignalCandidate) {
  const text = normalized(candidate.rawText);
  return PRIORITY_KEYWORDS.filter((keyword) => text.includes(keyword));
}

function scoreCandidate(candidate: SignalCandidate, now: string) {
  let score = 0;
  const matched = matchedKeywords(candidate);
  score += Math.min(matched.length * 6, 24);
  score += candidate.directAsk ? 30 : 0;
  score += candidate.waitingOnWill ? 24 : 0;
  score += candidate.decisionRequired ? 20 : 0;
  score += candidate.openLoop ? 15 : 0;
  score -= candidate.likelyResolved ? 40 : 0;

  if (candidate.dueAt) {
    const minutes = minutesUntil(candidate.dueAt, now);
    if (minutes <= 24 * 60) {
      score += 24;
    } else if (minutes <= 72 * 60) {
      score += 12;
    }
  }

  if (candidate.source === "calendar") {
    score += 8;
  }

  if (candidate.source === "teams" && candidate.waitingOnWill) {
    score += 10;
  }

  return Math.max(score, 0);
}

function classifySignalType(candidate: SignalCandidate) {
  const text = normalized(candidate.rawText);
  if (candidate.source === "calendar") {
    return "meeting" as const;
  }

  if (DECISION_KEYWORDS.some((keyword) => text.includes(keyword)) || candidate.decisionRequired) {
    return "decision" as const;
  }

  if (candidate.directAsk || candidate.waitingOnWill || candidate.openLoop) {
    return "follow_up" as const;
  }

  return "status" as const;
}

function classifyAttention(candidate: SignalCandidate, score: number, now: string) {
  if (candidate.dueAt && minutesUntil(candidate.dueAt, now) <= 24 * 60) {
    return "high" as const;
  }

  if (score >= 70) {
    return "high" as const;
  }

  if (score >= 45) {
    return "medium" as const;
  }

  return "low" as const;
}

function buildActionRequest(candidate: SignalCandidate, signalType: ClassifiedSignalCandidate["signalType"]) {
  if (signalType === "meeting" && candidate.dueAt) {
    return `Prepare for ${candidate.titleSeed} before ${candidate.dueAt}.`;
  }

  if (signalType === "decision") {
    return `Decide how Will should respond on ${candidate.titleSeed}.`;
  }

  if (candidate.directAsk || candidate.waitingOnWill || candidate.openLoop) {
    return `Reply on ${candidate.titleSeed} and close the open loop.`;
  }

  return null;
}

function buildSummary(candidate: SignalCandidate, signalType: ClassifiedSignalCandidate["signalType"]) {
  const matched = matchedKeywords(candidate);
  const cues: string[] = [];

  if (candidate.waitingOnWill) {
    cues.push("someone appears to be waiting on Will");
  }

  if (candidate.decisionRequired || signalType === "decision") {
    cues.push("a decision is likely needed");
  }

  if (candidate.openLoop) {
    cues.push("the thread still looks open");
  }

  if (matched.length > 0) {
    cues.push(`it touches ${matched.slice(0, 2).join(" and ")}`);
  }

  const prefix = firstSentence(candidate.summarySeed || candidate.titleSeed);
  if (cues.length === 0) {
    return prefix;
  }

  return `${prefix} This matters because ${cues.join(", ")}.`;
}

export function classifySignalCandidate(candidate: SignalCandidate, now: string): ClassifiedSignalCandidate {
  const score = scoreCandidate(candidate, now);
  const signalType = classifySignalType(candidate);
  const attention = classifyAttention(candidate, score, now);
  const routing = classifyRoutingSurface(candidate, score);
  const title = firstSentence(candidate.titleSeed);
  const summary = buildSummary(candidate, signalType);

  return {
    ...candidate,
    id: buildSignalId(candidate.source, candidate.sourceRecordId, [candidate.sourceThreadId, title]),
    signalType,
    attention,
    routingSurface: routing.surface,
    routingReason: routing.reason,
    title,
    summary,
    actionRequest: routing.surface === "suppress" ? null : buildActionRequest(candidate, signalType),
    score,
    mergedSourceRecordIds: [candidate.sourceRecordId]
  };
}
