"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { persistCaptureAction } from "@/app/capture/actions";
import { CaptureMicrophoneIcon } from "@/components/icons/capture-microphone-icon";
import {
  capturePatternForExecutiveType,
  executiveWorkTypeForCaptureType,
  formatTaskPriorityLabel,
  getExecutiveCaptureTypeLabel,
  isExecutiveCaptureType,
  type CapturePattern,
  type CapturePrivacy,
  type ExecutiveCaptureMetadata,
  type ExecutiveCaptureType,
  type InitiativeOption,
  type TaskCaptureSettings,
  type TaskCategoryOption,
  type TaskPriority
} from "@/lib/blackhawk-capture-model";
import type { CaptureInput } from "@/lib/captures";
import {
  isSignalCaptureHandoff,
  SIGNAL_CAPTURE_HANDOFF_STORAGE_PREFIX,
  type SignalCaptureContext
} from "@/lib/signal-capture-drafts";
import { cn } from "@/lib/utils";

type NoteDraft = {
  title: string;
  body: string;
  linkedInitiativeId: string | null;
};

type TaskDraft = {
  description: string;
  nextStep: string;
  desiredOutcome: string;
  priority: TaskPriority;
  categoryId: string | null;
  linkedInitiativeId: string | null;
  dueAt: string;
};

type DecisionDraft = {
  question: string;
  recommendation: string;
  optionsTradeoffs: string;
  risks: string;
  deadline: string;
  linkedInitiativeId: string | null;
  relatedOpportunity: string;
  peopleInvolved: string;
  priority: TaskPriority;
};

type OpportunityDraft = {
  companyOrCounterparty: string;
  title: string;
  strategicRelevance: string;
  nextAction: string;
  owner: string;
  status: string;
  linkedInitiativeId: string | null;
  relatedPerson: string;
  priority: TaskPriority;
};

type WaitingOnDraft = {
  waitingOn: string;
  expectedOutcome: string;
  lastTouch: string;
  followUpAt: string;
  linkedInitiativeId: string | null;
  relatedOpportunity: string;
  priority: TaskPriority;
  delegatedTo: string;
  categoryId: string | null;
};

type MeetingNoteDraft = {
  meetingTitle: string;
  meetingAt: string;
  attendees: string;
  body: string;
  decisions: string;
  followUps: string;
  waitingOnItems: string;
  linkedInitiativeId: string | null;
  relatedCompany: string;
  relatedPerson: string;
};

type InitiativeQueryMap = Record<ExecutiveCaptureType, string>;

type CaptureDraft = {
  captureType: ExecutiveCaptureType;
  privacy: CapturePrivacy;
  privateContext: string;
  note: NoteDraft;
  task: TaskDraft;
  decision: DecisionDraft;
  opportunity: OpportunityDraft;
  waitingOn: WaitingOnDraft;
  meetingNote: MeetingNoteDraft;
};

type FeedbackState =
  | {
      kind: "saved" | "save-failed" | "queued" | "status";
      message: string;
      draft?: CaptureDraft;
      queueId?: string;
      sourceContext?: SignalCaptureContext | null;
    }
  | null;

type QueuedCapture = CaptureDraft & {
  id: string;
  sourcePath: string | null;
  queuedAt: string;
};

type SpeechRecognitionResultLike = {
  0?: {
    transcript?: string;
  };
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const defaultDraft: CaptureDraft = {
  captureType: "note",
  privacy: "open",
  privateContext: "",
  note: {
    title: "",
    body: "",
    linkedInitiativeId: null
  },
  task: {
    description: "",
    nextStep: "",
    desiredOutcome: "",
    priority: "medium",
    categoryId: null,
    linkedInitiativeId: null,
    dueAt: ""
  },
  decision: {
    question: "",
    recommendation: "",
    optionsTradeoffs: "",
    risks: "",
    deadline: "",
    linkedInitiativeId: null,
    relatedOpportunity: "",
    peopleInvolved: "",
    priority: "medium"
  },
  opportunity: {
    companyOrCounterparty: "",
    title: "",
    strategicRelevance: "",
    nextAction: "",
    owner: "",
    status: "",
    linkedInitiativeId: null,
    relatedPerson: "",
    priority: "medium"
  },
  waitingOn: {
    waitingOn: "",
    expectedOutcome: "",
    lastTouch: "",
    followUpAt: "",
    linkedInitiativeId: null,
    relatedOpportunity: "",
    priority: "medium",
    delegatedTo: "",
    categoryId: null
  },
  meetingNote: {
    meetingTitle: "",
    meetingAt: "",
    attendees: "",
    body: "",
    decisions: "",
    followUps: "",
    waitingOnItems: "",
    linkedInitiativeId: null,
    relatedCompany: "",
    relatedPerson: ""
  }
};

const LOCAL_CAPTURE_QUEUE_KEY = "blackhawk.capture-queue.v2";
const LAST_CAPTURE_TYPE_KEY = "blackhawk.capture.last-type";
const LEGACY_LAST_PATTERN_KEY = "blackhawk.capture.last-pattern";

function emptyInitiativeQueries(): InitiativeQueryMap {
  return {
    note: "",
    task: "",
    decision: "",
    opportunity: "",
    waiting_on: "",
    meeting_note: ""
  };
}

function labelForContext(from: string | null) {
  if (!from || from === "/capture") {
    return {
      name: "General capture",
      detail: "No route context inherited."
    };
  }

  const knownLabels: Record<string, string> = {
    "/": "Today",
    "/inbox": "Priority Inbox",
    "/people": "People",
    "/initiatives": "Initiatives",
    "/commitments": "Commitments"
  };

  const name = knownLabels[from] ?? from.replace(/^\//, "").replace(/-/g, " ");

  return {
    name,
    detail: "This capture will inherit the current working context."
  };
}

function submitLabelForCaptureType(captureType: ExecutiveCaptureType) {
  return `Save ${getExecutiveCaptureTypeLabel(captureType)}`;
}

function normalizeQueuedCapture(value: unknown): QueuedCapture | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const queued = value as Partial<QueuedCapture> & {
    pattern?: CapturePattern;
  };
  const captureType =
    (typeof queued.captureType === "string" && isExecutiveCaptureType(queued.captureType)
      ? queued.captureType
      : queued.pattern === "task"
        ? "task"
        : "note") as ExecutiveCaptureType;

  return {
    id: typeof queued.id === "string" ? queued.id : `${Date.now()}`,
    sourcePath: typeof queued.sourcePath === "string" || queued.sourcePath === null ? queued.sourcePath ?? null : null,
    queuedAt: typeof queued.queuedAt === "string" ? queued.queuedAt : new Date().toISOString(),
    ...defaultDraft,
    ...queued,
    captureType,
    note: {
      ...defaultDraft.note,
      ...queued.note
    },
    task: {
      ...defaultDraft.task,
      ...queued.task
    },
    decision: {
      ...defaultDraft.decision,
      ...queued.decision
    },
    opportunity: {
      ...defaultDraft.opportunity,
      ...queued.opportunity
    },
    waitingOn: {
      ...defaultDraft.waitingOn,
      ...queued.waitingOn
    },
    meetingNote: {
      ...defaultDraft.meetingNote,
      ...queued.meetingNote
    }
  };
}

function readQueuedCaptures() {
  if (typeof window === "undefined") {
    return [] as QueuedCapture[];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_CAPTURE_QUEUE_KEY);
    if (!raw) {
      return [] as QueuedCapture[];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [] as QueuedCapture[];
    }

    return parsed.map(normalizeQueuedCapture).filter((value): value is QueuedCapture => Boolean(value));
  } catch {
    return [] as QueuedCapture[];
  }
}

function writeQueuedCaptures(captures: QueuedCapture[]) {
  if (typeof window === "undefined") {
    return;
  }

  if (captures.length === 0) {
    window.localStorage.removeItem(LOCAL_CAPTURE_QUEUE_KEY);
    return;
  }

  window.localStorage.setItem(LOCAL_CAPTURE_QUEUE_KEY, JSON.stringify(captures));
}

function queueCaptureLocally(sourcePath: string | null, draft: CaptureDraft) {
  const queuedCapture: QueuedCapture = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
    sourcePath,
    queuedAt: new Date().toISOString(),
    ...draft
  };

  const nextQueue = [...readQueuedCaptures(), queuedCapture];
  writeQueuedCaptures(nextQueue);
  return queuedCapture;
}

function removeQueuedCapture(queueId: string | undefined) {
  if (!queueId) {
    return;
  }

  const nextQueue = readQueuedCaptures().filter((item) => item.id !== queueId);
  writeQueuedCaptures(nextQueue);
}

function microphoneSupportMessage(error?: string) {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Voice capture access was denied. Type below and save when ready.";
    case "audio-capture":
      return "No microphone was available. Type below and save when ready.";
    case "network":
      return "Voice capture was interrupted. Type below and save when ready.";
    default:
      return "Voice capture is unavailable here. Type below and save when ready.";
  }
}

function initiativeLabel(options: InitiativeOption[], id: string | null) {
  return options.find((option) => option.id === id)?.title ?? "";
}

function initiativeQueriesFromDraft(draft: CaptureDraft, initiatives: InitiativeOption[]): InitiativeQueryMap {
  return {
    note: initiativeLabel(initiatives, draft.note.linkedInitiativeId),
    task: initiativeLabel(initiatives, draft.task.linkedInitiativeId),
    decision: initiativeLabel(initiatives, draft.decision.linkedInitiativeId),
    opportunity: initiativeLabel(initiatives, draft.opportunity.linkedInitiativeId),
    waiting_on: initiativeLabel(initiatives, draft.waitingOn.linkedInitiativeId),
    meeting_note: initiativeLabel(initiatives, draft.meetingNote.linkedInitiativeId)
  };
}

function preserveNoteTitleInTaskDescription(title: string, body: string) {
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();

  if (!trimmedTitle) {
    return trimmedBody;
  }

  if (!trimmedBody) {
    return trimmedTitle;
  }

  if (trimmedBody.toLowerCase().startsWith(trimmedTitle.toLowerCase())) {
    return trimmedBody;
  }

  return `${trimmedTitle}\n\n${trimmedBody}`;
}

function flattenTaskIntoNoteBody(task: TaskDraft) {
  const sections = [
    task.description.trim(),
    task.nextStep.trim() ? `Next Step:\n${task.nextStep.trim()}` : null,
    task.desiredOutcome.trim() ? `Desired Outcome:\n${task.desiredOutcome.trim()}` : null
  ].filter((value): value is string => Boolean(value));

  return sections.join("\n\n");
}

function firstNonEmpty(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim() ?? "").find(Boolean) ?? "";
}

function toIsoTimestamp(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function compactMetadata(
  captureType: ExecutiveCaptureType,
  fields: Record<string, string | null | undefined>
): ExecutiveCaptureMetadata {
  const metadata: Record<string, string> = {
    captureType
  };

  for (const [key, value] of Object.entries(fields)) {
    const trimmed = value?.trim() ?? "";
    if (trimmed) {
      metadata[key] = trimmed;
    }
  }

  return metadata as ExecutiveCaptureMetadata;
}

function composeDecisionBody(draft: DecisionDraft) {
  return [
    `Decision Question:\n${draft.question.trim()}`,
    draft.recommendation.trim() ? `Recommendation:\n${draft.recommendation.trim()}` : null,
    draft.optionsTradeoffs.trim() ? `Options / Tradeoffs:\n${draft.optionsTradeoffs.trim()}` : null,
    draft.risks.trim() ? `Risks:\n${draft.risks.trim()}` : null,
    draft.peopleInvolved.trim() ? `People Involved:\n${draft.peopleInvolved.trim()}` : null,
    draft.relatedOpportunity.trim() ? `Related Opportunity:\n${draft.relatedOpportunity.trim()}` : null
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
}

function composeOpportunityBody(draft: OpportunityDraft) {
  return [
    `Company / Counterparty:\n${draft.companyOrCounterparty.trim()}`,
    `Why It Matters:\n${draft.strategicRelevance.trim()}`,
    draft.nextAction.trim() ? `Next Action:\n${draft.nextAction.trim()}` : null,
    draft.owner.trim() ? `Owner:\n${draft.owner.trim()}` : null,
    draft.status.trim() ? `Status:\n${draft.status.trim()}` : null,
    draft.relatedPerson.trim() ? `Related Person:\n${draft.relatedPerson.trim()}` : null
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
}

function composeMeetingBody(draft: MeetingNoteDraft) {
  return [
    draft.meetingAt.trim() ? `Meeting Time:\n${draft.meetingAt.trim()}` : null,
    draft.attendees.trim() ? `Attendees:\n${draft.attendees.trim()}` : null,
    draft.body.trim() ? `Notes:\n${draft.body.trim()}` : null,
    draft.decisions.trim() ? `Decisions:\n${draft.decisions.trim()}` : null,
    draft.followUps.trim() ? `Follow-ups:\n${draft.followUps.trim()}` : null,
    draft.waitingOnItems.trim() ? `Waiting On:\n${draft.waitingOnItems.trim()}` : null,
    draft.relatedCompany.trim() ? `Related Company:\n${draft.relatedCompany.trim()}` : null,
    draft.relatedPerson.trim() ? `Related Person:\n${draft.relatedPerson.trim()}` : null
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n\n");
}

function resolveInitiativeIdForCaptureType(draft: CaptureDraft, captureType: ExecutiveCaptureType) {
  switch (captureType) {
    case "note":
      return draft.note.linkedInitiativeId;
    case "task":
      return draft.task.linkedInitiativeId;
    case "decision":
      return draft.decision.linkedInitiativeId;
    case "opportunity":
      return draft.opportunity.linkedInitiativeId;
    case "waiting_on":
      return draft.waitingOn.linkedInitiativeId;
    case "meeting_note":
      return draft.meetingNote.linkedInitiativeId;
  }
}

type BuildSubmissionResult =
  | {
      ok: true;
      input: CaptureInput;
    }
  | {
      ok: false;
    };

function buildSubmissionInput(draft: CaptureDraft): BuildSubmissionResult {
  switch (draft.captureType) {
    case "note": {
      const body = draft.note.body.trim();
      if (!body) {
        return { ok: false };
      }

      return {
        ok: true,
        input: {
          sourcePath: null,
          pattern: "note",
          privacy: draft.privacy,
          privateContext: draft.privateContext.trim(),
          note: {
            title: draft.note.title.trim(),
            body,
            linkedInitiativeId: draft.note.linkedInitiativeId
          },
          executiveMetadata: compactMetadata("note", {})
        }
      };
    }
    case "task": {
      const description = draft.task.description.trim();
      if (!description) {
        return { ok: false };
      }

      return {
        ok: true,
        input: {
          sourcePath: null,
          pattern: "task",
          privacy: draft.privacy,
          privateContext: draft.privateContext.trim(),
          dueAt: toIsoTimestamp(draft.task.dueAt),
          task: {
            description,
            nextStep: draft.task.nextStep.trim(),
            desiredOutcome: draft.task.desiredOutcome.trim(),
            priority: draft.task.priority,
            categoryId: draft.task.categoryId,
            linkedInitiativeId: draft.task.linkedInitiativeId,
            dueAt: toIsoTimestamp(draft.task.dueAt)
          },
          executiveMetadata: compactMetadata("task", {})
        }
      };
    }
    case "decision": {
      const question = draft.decision.question.trim();
      if (!question) {
        return { ok: false };
      }

      return {
        ok: true,
        input: {
          sourcePath: null,
          pattern: "note",
          privacy: draft.privacy,
          privateContext: draft.privateContext.trim(),
          dueAt: toIsoTimestamp(draft.decision.deadline),
          executiveWorkType: executiveWorkTypeForCaptureType("decision"),
          executiveMetadata: compactMetadata("decision", {
            decisionQuestion: question,
            recommendation: draft.decision.recommendation,
            optionsTradeoffs: draft.decision.optionsTradeoffs,
            risks: draft.decision.risks,
            deadline: toIsoTimestamp(draft.decision.deadline),
            relatedOpportunity: draft.decision.relatedOpportunity,
            peopleInvolved: draft.decision.peopleInvolved
          }),
          note: {
            title: question,
            body: composeDecisionBody(draft.decision),
            linkedInitiativeId: draft.decision.linkedInitiativeId
          }
        }
      };
    }
    case "opportunity": {
      const title = draft.opportunity.title.trim();
      const companyOrCounterparty = draft.opportunity.companyOrCounterparty.trim();
      const strategicRelevance = draft.opportunity.strategicRelevance.trim();
      if (!title || !companyOrCounterparty || !strategicRelevance) {
        return { ok: false };
      }

      return {
        ok: true,
        input: {
          sourcePath: null,
          pattern: "note",
          privacy: draft.privacy,
          privateContext: draft.privateContext.trim(),
          executiveWorkType: executiveWorkTypeForCaptureType("opportunity"),
          executiveMetadata: compactMetadata("opportunity", {
            companyOrCounterparty,
            strategicRelevance,
            nextAction: draft.opportunity.nextAction,
            owner: draft.opportunity.owner,
            status: draft.opportunity.status,
            relatedPerson: draft.opportunity.relatedPerson
          }),
          note: {
            title,
            body: composeOpportunityBody(draft.opportunity),
            linkedInitiativeId: draft.opportunity.linkedInitiativeId
          }
        }
      };
    }
    case "waiting_on": {
      const waitingOn = draft.waitingOn.waitingOn.trim();
      const expectedOutcome = draft.waitingOn.expectedOutcome.trim();
      if (!waitingOn || !expectedOutcome) {
        return { ok: false };
      }

      return {
        ok: true,
        input: {
          sourcePath: null,
          pattern: "task",
          privacy: draft.privacy,
          privateContext: draft.privateContext.trim(),
          dueAt: toIsoTimestamp(draft.waitingOn.followUpAt),
          executiveWorkType: executiveWorkTypeForCaptureType("waiting_on"),
          executiveMetadata: compactMetadata("waiting_on", {
            waitingOn,
            expectedOutcome,
            lastTouch: draft.waitingOn.lastTouch,
            followUpAt: toIsoTimestamp(draft.waitingOn.followUpAt),
            relatedOpportunity: draft.waitingOn.relatedOpportunity,
            delegatedTo: draft.waitingOn.delegatedTo
          }),
          task: {
            description: `Waiting on ${waitingOn}`,
            nextStep: draft.waitingOn.lastTouch.trim() ? `Last touch: ${draft.waitingOn.lastTouch.trim()}` : "",
            desiredOutcome: expectedOutcome,
            priority: draft.waitingOn.priority,
            categoryId: draft.waitingOn.categoryId,
            linkedInitiativeId: draft.waitingOn.linkedInitiativeId,
            dueAt: toIsoTimestamp(draft.waitingOn.followUpAt)
          }
        }
      };
    }
    case "meeting_note": {
      const meetingTitle = draft.meetingNote.meetingTitle.trim();
      const body = draft.meetingNote.body.trim();
      if (!meetingTitle || !body) {
        return { ok: false };
      }

      return {
        ok: true,
        input: {
          sourcePath: null,
          pattern: "note",
          privacy: draft.privacy,
          privateContext: draft.privateContext.trim(),
          dueAt: toIsoTimestamp(draft.meetingNote.meetingAt),
          executiveWorkType: executiveWorkTypeForCaptureType("meeting_note"),
          executiveMetadata: compactMetadata("meeting_note", {
            meetingTitle,
            meetingAt: toIsoTimestamp(draft.meetingNote.meetingAt),
            attendees: draft.meetingNote.attendees,
            decisions: draft.meetingNote.decisions,
            followUps: draft.meetingNote.followUps,
            waitingOnItems: draft.meetingNote.waitingOnItems,
            relatedCompany: draft.meetingNote.relatedCompany,
            relatedPerson: draft.meetingNote.relatedPerson
          }),
          note: {
            title: meetingTitle,
            body: composeMeetingBody(draft.meetingNote),
            linkedInitiativeId: draft.meetingNote.linkedInitiativeId
          }
        }
      };
    }
  }
}

type CaptureFlowProps = {
  initialFrom?: string | null;
  initialHandoffKey?: string | null;
  categories: TaskCategoryOption[];
  commonCategories: TaskCategoryOption[];
  captureSettings: TaskCaptureSettings;
  initiatives: InitiativeOption[];
};

export function CaptureFlow({
  initialFrom,
  initialHandoffKey,
  categories,
  commonCategories,
  captureSettings,
  initiatives
}: CaptureFlowProps) {
  const inheritedContext = labelForContext(initialFrom ?? null);
  const [draft, setDraft] = useState<CaptureDraft>(defaultDraft);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [switchNotice, setSwitchNotice] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const [showTaskNextStep, setShowTaskNextStep] = useState(captureSettings.expandNextStepByDefault);
  const [showTaskDesiredOutcome, setShowTaskDesiredOutcome] = useState(
    captureSettings.expandDesiredOutcomeByDefault
  );
  const [showDecisionDetails, setShowDecisionDetails] = useState(false);
  const [showOpportunityDetails, setShowOpportunityDetails] = useState(false);
  const [showWaitingOnDetails, setShowWaitingOnDetails] = useState(false);
  const [showMeetingDetails, setShowMeetingDetails] = useState(false);
  const [signalContext, setSignalContext] = useState<SignalCaptureContext | null>(null);
  const [initiativeQueries, setInitiativeQueries] = useState<InitiativeQueryMap>(emptyInitiativeQueries());
  const summaryRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionBaseValueRef = useRef("");
  const syncInProgressRef = useRef(false);
  const appliedHandoffRef = useRef(false);

  const waitingOnCategoryId =
    categories.find(
      (category) =>
        category.slug.trim().toLowerCase() === "waiting-for" ||
        category.name.trim().toLowerCase() === "waiting for"
    )?.id ?? null;
  const selectedTaskCategory = categories.find((category) => category.id === draft.task.categoryId) ?? null;

  function setSummaryRef(node: HTMLTextAreaElement | HTMLInputElement | null) {
    summaryRef.current = node;
  }

  useEffect(() => {
    const rememberedType =
      typeof window !== "undefined"
        ? (window.localStorage.getItem(LAST_CAPTURE_TYPE_KEY) as ExecutiveCaptureType | null)
        : null;
    const legacyPattern =
      typeof window !== "undefined"
        ? (window.localStorage.getItem(LEGACY_LAST_PATTERN_KEY) as CapturePattern | null)
        : null;

    if (rememberedType && isExecutiveCaptureType(rememberedType)) {
      setDraft((current) => ({
        ...current,
        captureType: rememberedType
      }));
      return;
    }

    if (legacyPattern === "task" || legacyPattern === "note") {
      setDraft((current) => ({
        ...current,
        captureType: legacyPattern
      }));
    }
  }, []);

  useEffect(() => {
    setShowTaskNextStep(captureSettings.expandNextStepByDefault);
    setShowTaskDesiredOutcome(captureSettings.expandDesiredOutcomeByDefault);
  }, [captureSettings.expandDesiredOutcomeByDefault, captureSettings.expandNextStepByDefault]);

  useEffect(() => {
    if (!waitingOnCategoryId) {
      return;
    }

    setDraft((current) =>
      current.waitingOn.categoryId
        ? current
        : {
            ...current,
            waitingOn: {
              ...current.waitingOn,
              categoryId: waitingOnCategoryId
            }
          }
    );
  }, [waitingOnCategoryId]);

  useEffect(() => {
    if (typeof window === "undefined" || !initialHandoffKey || appliedHandoffRef.current) {
      return;
    }

    const raw = window.sessionStorage.getItem(
      `${SIGNAL_CAPTURE_HANDOFF_STORAGE_PREFIX}:${initialHandoffKey}`
    );
    if (!raw) {
      appliedHandoffRef.current = true;
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isSignalCaptureHandoff(parsed)) {
        appliedHandoffRef.current = true;
        return;
      }

      const nextDraft: CaptureDraft = {
        ...defaultDraft,
        captureType: parsed.pattern,
        privacy: parsed.privacy,
        privateContext: parsed.privateContext,
        note: {
          title: parsed.note.title,
          body: parsed.note.body,
          linkedInitiativeId: parsed.note.linkedInitiativeId
        },
        task: {
          description: parsed.task.description,
          nextStep: parsed.task.nextStep,
          desiredOutcome: parsed.task.desiredOutcome,
          priority: parsed.task.priority,
          categoryId: parsed.task.categoryId,
          linkedInitiativeId: parsed.task.linkedInitiativeId,
          dueAt: ""
        }
      };

      setDraft(nextDraft);
      setInitiativeQueries(initiativeQueriesFromDraft(nextDraft, initiatives));
      setSignalContext(parsed.sourceContext);
      setShowTaskNextStep(Boolean(parsed.task.nextStep.trim()) || captureSettings.expandNextStepByDefault);
      setShowTaskDesiredOutcome(
        Boolean(parsed.task.desiredOutcome.trim()) || captureSettings.expandDesiredOutcomeByDefault
      );
      setFeedback({
        kind: "status",
        message: "Drafted from Agent signal. Review and save only if it should become a capture.",
        sourceContext: parsed.sourceContext
      });
      rememberCaptureType(parsed.pattern);
    } catch {
      // Ignore malformed handoff drafts and fall back to the normal capture composer.
    } finally {
      appliedHandoffRef.current = true;
    }
  }, [
    captureSettings.expandDesiredOutcomeByDefault,
    captureSettings.expandNextStepByDefault,
    initialHandoffKey,
    initiatives
  ]);

  function rememberCaptureType(captureType: ExecutiveCaptureType) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_CAPTURE_TYPE_KEY, captureType);
      window.localStorage.setItem(LEGACY_LAST_PATTERN_KEY, capturePatternForExecutiveType(captureType));
    }
  }

  function restoreDraft(nextDraft: CaptureDraft) {
    setDraft(nextDraft);
    setInitiativeQueries(initiativeQueriesFromDraft(nextDraft, initiatives));
    window.requestAnimationFrame(() => {
      summaryRef.current?.focus();
    });
  }

  function updateNote<K extends keyof NoteDraft>(key: K, value: NoteDraft[K]) {
    setDraft((current) => ({
      ...current,
      note: {
        ...current.note,
        [key]: value
      }
    }));
  }

  function updateTask<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setDraft((current) => ({
      ...current,
      task: {
        ...current.task,
        [key]: value
      }
    }));
  }

  function updateDecision<K extends keyof DecisionDraft>(key: K, value: DecisionDraft[K]) {
    setDraft((current) => ({
      ...current,
      decision: {
        ...current.decision,
        [key]: value
      }
    }));
  }

  function updateOpportunity<K extends keyof OpportunityDraft>(key: K, value: OpportunityDraft[K]) {
    setDraft((current) => ({
      ...current,
      opportunity: {
        ...current.opportunity,
        [key]: value
      }
    }));
  }

  function updateWaitingOn<K extends keyof WaitingOnDraft>(key: K, value: WaitingOnDraft[K]) {
    setDraft((current) => ({
      ...current,
      waitingOn: {
        ...current.waitingOn,
        [key]: value
      }
    }));
  }

  function updateMeetingNote<K extends keyof MeetingNoteDraft>(key: K, value: MeetingNoteDraft[K]) {
    setDraft((current) => ({
      ...current,
      meetingNote: {
        ...current.meetingNote,
        [key]: value
      }
    }));
  }

  function updatePrivacy(privacy: CapturePrivacy) {
    setDraft((current) => ({
      ...current,
      privacy
    }));
  }

  function updatePriority(priority: TaskPriority) {
    setDraft((current) => {
      switch (current.captureType) {
        case "task":
          return {
            ...current,
            task: {
              ...current.task,
              priority
            }
          };
        case "decision":
          return {
            ...current,
            decision: {
              ...current.decision,
              priority
            }
          };
        case "opportunity":
          return {
            ...current,
            opportunity: {
              ...current.opportunity,
              priority
            }
          };
        case "waiting_on":
          return {
            ...current,
            waitingOn: {
              ...current.waitingOn,
              priority
            }
          };
        default:
          return current;
      }
    });
  }

  function currentPriority() {
    switch (draft.captureType) {
      case "task":
        return draft.task.priority;
      case "decision":
        return draft.decision.priority;
      case "opportunity":
        return draft.opportunity.priority;
      case "waiting_on":
        return draft.waitingOn.priority;
      default:
        return null;
    }
  }

  function switchCaptureType(nextType: ExecutiveCaptureType) {
    if (nextType === draft.captureType) {
      return;
    }

    setSwitchNotice(null);
    setDraft((current) => {
      const nextDraft = { ...current, captureType: nextType };

      if (nextType === "task" && !current.task.description.trim()) {
        nextDraft.task = {
          ...current.task,
          description:
            preserveNoteTitleInTaskDescription(
              current.note.title,
              current.note.body || current.decision.question || current.meetingNote.body
            ) || current.task.description,
          linkedInitiativeId:
            current.note.linkedInitiativeId ??
            current.decision.linkedInitiativeId ??
            current.task.linkedInitiativeId
        };
      }

      if (nextType === "note" && !current.note.body.trim()) {
        nextDraft.note = {
          ...current.note,
          body: flattenTaskIntoNoteBody(current.task) || current.note.body,
          linkedInitiativeId: current.task.linkedInitiativeId ?? current.note.linkedInitiativeId
        };
      }

      if (nextType === "decision" && !current.decision.question.trim()) {
        nextDraft.decision = {
          ...current.decision,
          question: firstNonEmpty([current.note.title, current.task.description, current.note.body])
        };
      }

      if (nextType === "opportunity" && !current.opportunity.title.trim()) {
        nextDraft.opportunity = {
          ...current.opportunity,
          title: firstNonEmpty([current.note.title, current.task.description]),
          strategicRelevance: current.note.body.trim() || current.opportunity.strategicRelevance
        };
      }

      if (nextType === "waiting_on") {
        nextDraft.waitingOn = {
          ...current.waitingOn,
          expectedOutcome: current.waitingOn.expectedOutcome || current.task.desiredOutcome,
          categoryId: current.waitingOn.categoryId ?? waitingOnCategoryId
        };
      }

      if (nextType === "meeting_note" && !current.meetingNote.body.trim()) {
        nextDraft.meetingNote = {
          ...current.meetingNote,
          meetingTitle: current.meetingNote.meetingTitle || firstNonEmpty([current.note.title, current.task.description]),
          body: current.meetingNote.body || current.note.body
        };
      }

      return nextDraft;
    });
    rememberCaptureType(nextType);
  }

  async function syncQueuedCaptures() {
    if (syncInProgressRef.current) {
      return;
    }

    const storedQueuedCaptures = readQueuedCaptures();
    if (storedQueuedCaptures.length === 0) {
      return;
    }

    syncInProgressRef.current = true;

    try {
      const remaining: QueuedCapture[] = [];
      let syncedCount = 0;

      for (const queuedCapture of storedQueuedCaptures) {
        const submission = buildSubmissionInput(queuedCapture);
        if (!submission.ok) {
          remaining.push(queuedCapture);
          continue;
        }

        const result = await persistCaptureAction({
          ...submission.input,
          sourcePath: queuedCapture.sourcePath
        });

        if (!result.ok) {
          remaining.push(queuedCapture);
          continue;
        }

        syncedCount += 1;
      }

      writeQueuedCaptures(remaining);

      if (syncedCount > 0) {
        setFeedback({
          kind: "status",
          message: `Synced ${syncedCount} pending capture${syncedCount === 1 ? "" : "s"} to Supabase.`
        });
      }
    } finally {
      syncInProgressRef.current = false;
    }
  }

  useEffect(() => {
    void syncQueuedCaptures();

    function handleOnline() {
      void syncQueuedCaptures();
    }

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
      recognitionRef.current?.stop();
    };
  }, []);

  function currentPrimaryValue() {
    switch (draft.captureType) {
      case "note":
        return draft.note.body;
      case "task":
        return draft.task.description;
      case "decision":
        return draft.decision.question;
      case "opportunity":
        return draft.opportunity.title;
      case "waiting_on":
        return draft.waitingOn.waitingOn;
      case "meeting_note":
        return draft.meetingNote.body;
    }
  }

  function setCurrentPrimaryValue(value: string) {
    switch (draft.captureType) {
      case "note":
        updateNote("body", value);
        return;
      case "task":
        updateTask("description", value);
        return;
      case "decision":
        updateDecision("question", value);
        return;
      case "opportunity":
        updateOpportunity("title", value);
        return;
      case "waiting_on":
        updateWaitingOn("waitingOn", value);
        return;
      case "meeting_note":
        updateMeetingNote("body", value);
        return;
    }
  }

  function handleMicrophoneToggle() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const browserWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setFeedback({
        kind: "status",
        message: microphoneSupportMessage()
      });
      summaryRef.current?.focus();
      return;
    }

    const recognition = new Recognition();
    recognitionBaseValueRef.current = currentPrimaryValue().trim();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results ?? [])
        .map((result) => result?.[0]?.transcript ?? "")
        .join(" ")
        .trim();

      const nextValue = [recognitionBaseValueRef.current, transcript].filter(Boolean).join(" ").trim();
      setCurrentPrimaryValue(nextValue);
    };

    recognition.onerror = (event) => {
      recognitionRef.current = null;
      setIsListening(false);
      setFeedback({
        kind: "status",
        message: microphoneSupportMessage(event.error)
      });
      summaryRef.current?.focus();
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      summaryRef.current?.focus();
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      setFeedback({
        kind: "status",
        message: `Voice capture is listening. Speak now, then ${submitLabelForCaptureType(
          draft.captureType
        )} when the text looks right.`
      });
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setFeedback({
        kind: "status",
        message: microphoneSupportMessage()
      });
      summaryRef.current?.focus();
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submission = buildSubmissionInput(draft);
    if (!submission.ok) {
      summaryRef.current?.focus();
      return;
    }

    const savedDraft: CaptureDraft = {
      ...draft,
      privateContext: draft.privateContext.trim()
    };

    setIsPending(true);

    try {
      const result = await persistCaptureAction({
        ...submission.input,
        sourcePath: initialFrom ?? null
      });

      if (!result.ok) {
        setFeedback({
          kind: "save-failed",
          message: `${result.message} You can keep editing or save locally pending sync.`,
          draft: savedDraft,
          sourceContext: signalContext
        });
        return;
      }

      setFeedback({
        kind: "saved",
        message: `Captured ${getExecutiveCaptureTypeLabel(savedDraft.captureType).toLowerCase()} in ${inheritedContext.name}.`,
        draft: savedDraft,
        sourceContext: signalContext
      });
      setDraft((current) => ({
        ...defaultDraft,
        captureType: savedDraft.captureType,
        task: {
          ...defaultDraft.task,
          linkedInitiativeId: savedDraft.captureType === "task" ? current.task.linkedInitiativeId : null
        },
        waitingOn: {
          ...defaultDraft.waitingOn,
          categoryId: waitingOnCategoryId
        }
      }));
      setInitiativeQueries(emptyInitiativeQueries());
      setSignalContext(null);
      void syncQueuedCaptures();
    } finally {
      setIsPending(false);
    }
  }

  function handleSaveLocally() {
    if (!feedback?.draft) {
      return;
    }

    const failedDraft = feedback.draft;
    const queuedCapture = queueCaptureLocally(initialFrom ?? null, failedDraft);
    setDraft((current) => ({
      ...defaultDraft,
      captureType: failedDraft.captureType,
      task: {
        ...defaultDraft.task,
        linkedInitiativeId: failedDraft.captureType === "task" ? current.task.linkedInitiativeId : null
      },
      waitingOn: {
        ...defaultDraft.waitingOn,
        categoryId: waitingOnCategoryId
      }
    }));
    setInitiativeQueries(emptyInitiativeQueries());
    setFeedback({
      kind: "queued",
      message: "Saved locally only, not yet synced to Supabase.",
      draft: failedDraft,
      queueId: queuedCapture.id,
      sourceContext: signalContext
    });
    setSignalContext(null);
  }

  function handleUndo() {
    if (!feedback?.draft) {
      return;
    }

    if (feedback.kind === "queued") {
      removeQueuedCapture(feedback.queueId);
    }

    setSignalContext(feedback.sourceContext ?? null);
    restoreDraft(feedback.draft);
    setFeedback(null);
  }

  function handleEdit() {
    if (!feedback?.draft) {
      return;
    }

    if (feedback.kind === "queued") {
      removeQueuedCapture(feedback.queueId);
    }

    setSignalContext(feedback.sourceContext ?? null);
    restoreDraft(feedback.draft);
  }

  function handleInitiativeInput(value: string) {
    const trimmed = value.trim();
    const match = initiatives.find((initiative) => initiative.title.toLowerCase() === trimmed.toLowerCase()) ?? null;
    setInitiativeQueries((current) => ({
      ...current,
      [draft.captureType]: value
    }));

    const nextId = trimmed ? match?.id ?? resolveInitiativeIdForCaptureType(draft, draft.captureType) : null;
    switch (draft.captureType) {
      case "note":
        updateNote("linkedInitiativeId", nextId);
        return;
      case "task":
        updateTask("linkedInitiativeId", nextId);
        return;
      case "decision":
        updateDecision("linkedInitiativeId", nextId);
        return;
      case "opportunity":
        updateOpportunity("linkedInitiativeId", nextId);
        return;
      case "waiting_on":
        updateWaitingOn("linkedInitiativeId", nextId);
        return;
      case "meeting_note":
        updateMeetingNote("linkedInitiativeId", nextId);
        return;
    }
  }

  const hybridHelper =
    draft.privacy === "hybrid"
      ? "Hybrid keeps the main capture attached to the current context while the private note remains protected."
      : draft.privacy === "protected"
        ? "Protected capture is private by default."
        : "Open capture stays available within the inherited context.";

  return (
    <div>
      <datalist id="capture-initiative-options">
        {initiatives.map((initiative) => (
          <option key={initiative.id} value={initiative.title} />
        ))}
      </datalist>

      <form onSubmit={handleSubmit} className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <section className="flex flex-col gap-5 rounded-[1.85rem] border border-line/75 bg-white/76 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleMicrophoneToggle}
              aria-pressed={isListening}
              disabled={isPending}
              className="inline-flex items-center gap-3 rounded-full border border-line/70 bg-white/70 px-3 py-2 text-text disabled:opacity-60"
            >
              <CaptureMicrophoneIcon className="h-5 w-5" />
              <span className="text-sm font-medium">Capture</span>
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full bg-text px-4 py-2 text-sm font-medium text-white transition-opacity duration-200 disabled:opacity-60"
            >
              {submitLabelForCaptureType(draft.captureType)}
            </button>
          </div>

          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">What are you capturing?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                ["note", "task", "decision", "opportunity", "waiting_on", "meeting_note"] as ExecutiveCaptureType[]
              ).map((captureType) => (
                <button
                  key={captureType}
                  type="button"
                  onClick={() => switchCaptureType(captureType)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200",
                    draft.captureType === captureType
                      ? "border-line bg-text text-white"
                      : "border-line/75 bg-white/60 text-text-muted hover:text-text"
                  )}
                >
                  {getExecutiveCaptureTypeLabel(captureType)}
                </button>
              ))}
            </div>
            {switchNotice ? (
              <p className="mt-3 rounded-[1rem] border border-line/70 bg-white/72 px-4 py-3 text-sm leading-6 text-text-muted">
                {switchNotice}
              </p>
            ) : null}
          </div>

          {currentPriority() ? (
            <div>
              <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Priority</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["high", "medium", "low"] as TaskPriority[]).map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => updatePriority(priority)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition",
                      currentPriority() === priority
                        ? "border-line bg-[rgb(var(--color-shell))] text-white"
                        : "border-line/75 bg-white/60 text-text-muted hover:text-text"
                    )}
                  >
                    {formatTaskPriorityLabel(priority)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {draft.captureType === "task" ? (
            <div>
              <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Category</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {commonCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => updateTask("categoryId", category.id)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition",
                      draft.task.categoryId === category.id
                        ? "border-line bg-[rgb(var(--color-shell))] text-white"
                        : "border-line/75 bg-white/60 text-text-muted hover:text-text"
                    )}
                  >
                    {category.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowMoreCategories((current) => !current)}
                  className="rounded-full border border-line/75 bg-white/60 px-4 py-2 text-sm font-medium text-text-muted transition hover:text-text"
                >
                  More
                </button>
              </div>
              {showMoreCategories ? (
                <select
                  value={draft.task.categoryId ?? ""}
                  onChange={(event) => updateTask("categoryId", event.target.value || null)}
                  className="mt-3 w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                >
                  <option value="">Leave uncategorized for now</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <p className="mt-3 text-sm text-text-muted">
                {selectedTaskCategory
                  ? `${selectedTaskCategory.name} selected.`
                  : "If you save without choosing, Blackhawk assigns TBD."}
              </p>
            </div>
          ) : null}

          {draft.captureType === "waiting_on" ? (
            <div className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.58)] p-4">
              <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Category</p>
              <p className="mt-3 text-sm text-text-muted">
                Waiting On captures stay on the existing task track and default to the Waiting For category when it exists.
              </p>
            </div>
          ) : null}

          {signalContext ? (
            <div className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.58)] p-4">
              <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">
                {signalContext.heading}
              </p>
              <p className="mt-3 text-sm font-medium text-text">{signalContext.signalTitle}</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-text-muted">
                {signalContext.entries.map((entry) => (
                  <p key={`${entry.label}-${entry.value}`} className="break-words">
                    <span className="font-medium text-text">{entry.label}:</span>{" "}
                    {entry.href ? (
                      <a
                        href={entry.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-text transition hover:text-text-muted"
                      >
                        {entry.value}
                      </a>
                    ) : (
                      entry.value
                    )}
                  </p>
                ))}
              </div>
              <p className="mt-3 text-sm text-text-muted">
                This context is here to guide the draft. You still decide what gets saved.
              </p>
            </div>
          ) : null}

          <div className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.58)] p-4">
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Context</p>
            <p className="mt-3 text-sm text-text-muted">{inheritedContext.name}</p>
            <p className="mt-2 text-sm text-text-muted">{inheritedContext.detail}</p>
          </div>

          <div className="mt-auto">
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Privacy</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                ["open", "Open"],
                ["protected", "Protected"],
                ["hybrid", "Hybrid"]
              ] as Array<[CapturePrivacy, string]>).map(([privacy, label]) => (
                <button
                  key={privacy}
                  type="button"
                  onClick={() => updatePrivacy(privacy)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200",
                    draft.privacy === privacy
                      ? privacy === "protected" || privacy === "hybrid"
                        ? "border-accent-red/35 bg-[rgba(125,35,31,0.1)] text-text"
                        : "border-line bg-text text-white"
                      : "border-line/75 bg-white/60 text-text-muted hover:text-text"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm leading-6 text-text-muted">{hybridHelper}</p>

            {(draft.privacy === "protected" || draft.privacy === "hybrid") ? (
              <div className="mt-5">
                <label className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle" htmlFor="private-context">
                  {draft.privacy === "hybrid" ? "Private context" : "Protected note"}
                </label>
                <textarea
                  id="private-context"
                  rows={4}
                  value={draft.privateContext}
                  onChange={(event) => setDraft((current) => ({ ...current, privateContext: event.target.value }))}
                  placeholder={
                    draft.privacy === "hybrid"
                      ? "Add the sensitive detail that should stay protected."
                      : "Capture the private note."
                  }
                  className="mt-3 w-full resize-none rounded-[1.45rem] border border-accent-red/20 bg-[rgba(125,35,31,0.06)] px-4 py-4 text-sm text-text outline-none transition-colors duration-200 placeholder:text-text-subtle focus:border-accent-red/35"
                />
              </div>
            ) : null}
          </div>
        </section>

        <section className="flex flex-col gap-5 rounded-[1.85rem] border border-line/75 bg-white/76 p-5 md:p-6">
          {draft.captureType === "note" ? (
            <>
              <label className="block">
                <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Title (Optional)</span>
                <input
                  value={draft.note.title}
                  onChange={(event) => updateNote("title", event.target.value)}
                  placeholder="Short title if it helps retrieval later"
                  className="mt-3 w-full rounded-[1.3rem] border border-line/80 bg-[rgba(255,255,255,0.72)] px-4 py-3 text-sm text-text outline-none transition-colors duration-200 placeholder:text-text-subtle focus:border-text/30"
                />
              </label>

              <label className="block">
                <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Body</span>
                <textarea
                  ref={setSummaryRef}
                  rows={9}
                  value={draft.note.body}
                  onChange={(event) => updateNote("body", event.target.value)}
                  placeholder="Capture the thought before it turns into work."
                  className="mt-3 w-full resize-none rounded-[1.45rem] border border-line/80 bg-[rgba(255,255,255,0.72)] px-4 py-4 text-base text-text outline-none transition-colors duration-200 placeholder:text-text-subtle focus:border-text/30"
                />
              </label>
            </>
          ) : null}

          {draft.captureType === "task" ? (
            <>
              <label className="block">
                <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Task Description</span>
                <textarea
                  ref={setSummaryRef}
                  rows={6}
                  value={draft.task.description}
                  onChange={(event) => updateTask("description", event.target.value)}
                  placeholder="Capture the next concrete task in one sentence."
                  className="mt-3 w-full resize-none rounded-[1.45rem] border border-line/80 bg-[rgba(255,255,255,0.72)] px-4 py-4 text-base text-text outline-none transition-colors duration-200 placeholder:text-text-subtle focus:border-text/30"
                />
              </label>

              <div className="space-y-3 rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.58)] p-4">
                <button
                  type="button"
                  onClick={() => setShowTaskNextStep((current) => !current)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Next Step</span>
                  {showTaskNextStep ? <ChevronUp className="h-4 w-4 text-text-subtle" /> : <ChevronDown className="h-4 w-4 text-text-subtle" />}
                </button>
                {showTaskNextStep ? (
                  <input
                    value={draft.task.nextStep}
                    onChange={(event) => updateTask("nextStep", event.target.value)}
                    placeholder="What should happen next?"
                    className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                  />
                ) : null}
              </div>

              <div className="space-y-3 rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.58)] p-4">
                <button
                  type="button"
                  onClick={() => setShowTaskDesiredOutcome((current) => !current)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Desired Outcome</span>
                  {showTaskDesiredOutcome ? <ChevronUp className="h-4 w-4 text-text-subtle" /> : <ChevronDown className="h-4 w-4 text-text-subtle" />}
                </button>
                {showTaskDesiredOutcome ? (
                  <textarea
                    rows={3}
                    value={draft.task.desiredOutcome}
                    onChange={(event) => updateTask("desiredOutcome", event.target.value)}
                    placeholder="What does success look like?"
                    className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/78 px-4 py-3 text-sm leading-6 text-text outline-none"
                  />
                ) : null}
              </div>

              <label className="block rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.58)] p-4">
                <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Due Date (Optional)</span>
                <input
                  type="datetime-local"
                  value={draft.task.dueAt}
                  onChange={(event) => updateTask("dueAt", event.target.value)}
                  className="mt-3 w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                />
              </label>
            </>
          ) : null}

          {draft.captureType === "decision" ? (
            <>
              <label className="block">
                <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Decision Question</span>
                <textarea
                  ref={setSummaryRef}
                  rows={4}
                  value={draft.decision.question}
                  onChange={(event) => updateDecision("question", event.target.value)}
                  placeholder="What is the decision that needs to be made?"
                  className="mt-3 w-full resize-none rounded-[1.45rem] border border-line/80 bg-[rgba(255,255,255,0.72)] px-4 py-4 text-base text-text outline-none transition-colors duration-200 placeholder:text-text-subtle focus:border-text/30"
                />
              </label>

              <div className="space-y-3 rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.58)] p-4">
                <button
                  type="button"
                  onClick={() => setShowDecisionDetails((current) => !current)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">More Decision Context</span>
                  {showDecisionDetails ? <ChevronUp className="h-4 w-4 text-text-subtle" /> : <ChevronDown className="h-4 w-4 text-text-subtle" />}
                </button>
                {showDecisionDetails ? (
                  <div className="space-y-3">
                    <textarea
                      rows={3}
                      value={draft.decision.recommendation}
                      onChange={(event) => updateDecision("recommendation", event.target.value)}
                      placeholder="Recommendation (Optional)"
                      className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/78 px-4 py-3 text-sm leading-6 text-text outline-none"
                    />
                    <textarea
                      rows={3}
                      value={draft.decision.optionsTradeoffs}
                      onChange={(event) => updateDecision("optionsTradeoffs", event.target.value)}
                      placeholder="Options / tradeoffs (Optional)"
                      className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/78 px-4 py-3 text-sm leading-6 text-text outline-none"
                    />
                    <textarea
                      rows={3}
                      value={draft.decision.risks}
                      onChange={(event) => updateDecision("risks", event.target.value)}
                      placeholder="Risks (Optional)"
                      className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/78 px-4 py-3 text-sm leading-6 text-text outline-none"
                    />
                    <input
                      value={draft.decision.peopleInvolved}
                      onChange={(event) => updateDecision("peopleInvolved", event.target.value)}
                      placeholder="People involved (Optional)"
                      className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                    />
                    <input
                      value={draft.decision.relatedOpportunity}
                      onChange={(event) => updateDecision("relatedOpportunity", event.target.value)}
                      placeholder="Related opportunity (Optional)"
                      className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                    />
                    <input
                      type="datetime-local"
                      value={draft.decision.deadline}
                      onChange={(event) => updateDecision("deadline", event.target.value)}
                      className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                    />
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {draft.captureType === "opportunity" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Company / Counterparty</span>
                  <input
                    value={draft.opportunity.companyOrCounterparty}
                    onChange={(event) => updateOpportunity("companyOrCounterparty", event.target.value)}
                    placeholder="Who is the counterparty?"
                    className="mt-3 w-full rounded-[1.3rem] border border-line/80 bg-[rgba(255,255,255,0.72)] px-4 py-3 text-sm text-text outline-none transition-colors duration-200 placeholder:text-text-subtle focus:border-text/30"
                  />
                </label>

                <label className="block">
                  <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Title</span>
                  <input
                    ref={setSummaryRef}
                    value={draft.opportunity.title}
                    onChange={(event) => updateOpportunity("title", event.target.value)}
                    placeholder="What is the opportunity?"
                    className="mt-3 w-full rounded-[1.3rem] border border-line/80 bg-[rgba(255,255,255,0.72)] px-4 py-3 text-sm text-text outline-none transition-colors duration-200 placeholder:text-text-subtle focus:border-text/30"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Why It Matters</span>
                <textarea
                  rows={5}
                  value={draft.opportunity.strategicRelevance}
                  onChange={(event) => updateOpportunity("strategicRelevance", event.target.value)}
                  placeholder="Why does this matter strategically?"
                  className="mt-3 w-full resize-none rounded-[1.45rem] border border-line/80 bg-[rgba(255,255,255,0.72)] px-4 py-4 text-base text-text outline-none transition-colors duration-200 placeholder:text-text-subtle focus:border-text/30"
                />
              </label>

              <div className="space-y-3 rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.58)] p-4">
                <button
                  type="button"
                  onClick={() => setShowOpportunityDetails((current) => !current)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">More Opportunity Context</span>
                  {showOpportunityDetails ? <ChevronUp className="h-4 w-4 text-text-subtle" /> : <ChevronDown className="h-4 w-4 text-text-subtle" />}
                </button>
                {showOpportunityDetails ? (
                  <div className="space-y-3">
                    <input
                      value={draft.opportunity.nextAction}
                      onChange={(event) => updateOpportunity("nextAction", event.target.value)}
                      placeholder="Next action (Optional)"
                      className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                    />
                    <input
                      value={draft.opportunity.owner}
                      onChange={(event) => updateOpportunity("owner", event.target.value)}
                      placeholder="Owner (Optional)"
                      className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                    />
                    <input
                      value={draft.opportunity.status}
                      onChange={(event) => updateOpportunity("status", event.target.value)}
                      placeholder="Status (Optional)"
                      className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                    />
                    <input
                      value={draft.opportunity.relatedPerson}
                      onChange={(event) => updateOpportunity("relatedPerson", event.target.value)}
                      placeholder="Related person (Optional)"
                      className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                    />
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {draft.captureType === "waiting_on" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Waiting On</span>
                  <input
                    ref={setSummaryRef}
                    value={draft.waitingOn.waitingOn}
                    onChange={(event) => updateWaitingOn("waitingOn", event.target.value)}
                    placeholder="Person or team"
                    className="mt-3 w-full rounded-[1.3rem] border border-line/80 bg-[rgba(255,255,255,0.72)] px-4 py-3 text-sm text-text outline-none transition-colors duration-200 placeholder:text-text-subtle focus:border-text/30"
                  />
                </label>

                <label className="block">
                  <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Expected Outcome</span>
                  <input
                    value={draft.waitingOn.expectedOutcome}
                    onChange={(event) => updateWaitingOn("expectedOutcome", event.target.value)}
                    placeholder="What are you expecting back?"
                    className="mt-3 w-full rounded-[1.3rem] border border-line/80 bg-[rgba(255,255,255,0.72)] px-4 py-3 text-sm text-text outline-none transition-colors duration-200 placeholder:text-text-subtle focus:border-text/30"
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.58)] p-4">
                <button
                  type="button"
                  onClick={() => setShowWaitingOnDetails((current) => !current)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Follow-up Details</span>
                  {showWaitingOnDetails ? <ChevronUp className="h-4 w-4 text-text-subtle" /> : <ChevronDown className="h-4 w-4 text-text-subtle" />}
                </button>
                {showWaitingOnDetails ? (
                  <div className="space-y-3">
                    <input
                      value={draft.waitingOn.lastTouch}
                      onChange={(event) => updateWaitingOn("lastTouch", event.target.value)}
                      placeholder="Last touch (Optional)"
                      className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                    />
                    <input
                      type="datetime-local"
                      value={draft.waitingOn.followUpAt}
                      onChange={(event) => updateWaitingOn("followUpAt", event.target.value)}
                      className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                    />
                    <input
                      value={draft.waitingOn.delegatedTo}
                      onChange={(event) => updateWaitingOn("delegatedTo", event.target.value)}
                      placeholder="Delegated to (Optional)"
                      className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                    />
                    <input
                      value={draft.waitingOn.relatedOpportunity}
                      onChange={(event) => updateWaitingOn("relatedOpportunity", event.target.value)}
                      placeholder="Related opportunity (Optional)"
                      className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                    />
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {draft.captureType === "meeting_note" ? (
            <>
              <label className="block">
                <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Meeting Title</span>
                <input
                  value={draft.meetingNote.meetingTitle}
                  onChange={(event) => updateMeetingNote("meetingTitle", event.target.value)}
                  placeholder="Which meeting is this for?"
                  className="mt-3 w-full rounded-[1.3rem] border border-line/80 bg-[rgba(255,255,255,0.72)] px-4 py-3 text-sm text-text outline-none transition-colors duration-200 placeholder:text-text-subtle focus:border-text/30"
                />
              </label>

              <label className="block">
                <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Notes</span>
                <textarea
                  ref={setSummaryRef}
                  rows={7}
                  value={draft.meetingNote.body}
                  onChange={(event) => updateMeetingNote("body", event.target.value)}
                  placeholder="Capture the meeting notes before they evaporate."
                  className="mt-3 w-full resize-none rounded-[1.45rem] border border-line/80 bg-[rgba(255,255,255,0.72)] px-4 py-4 text-base text-text outline-none transition-colors duration-200 placeholder:text-text-subtle focus:border-text/30"
                />
              </label>

              <div className="space-y-3 rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.58)] p-4">
                <button
                  type="button"
                  onClick={() => setShowMeetingDetails((current) => !current)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">More Meeting Context</span>
                  {showMeetingDetails ? <ChevronUp className="h-4 w-4 text-text-subtle" /> : <ChevronDown className="h-4 w-4 text-text-subtle" />}
                </button>
                {showMeetingDetails ? (
                  <div className="space-y-3">
                    <input
                      type="datetime-local"
                      value={draft.meetingNote.meetingAt}
                      onChange={(event) => updateMeetingNote("meetingAt", event.target.value)}
                      className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                    />
                    <input
                      value={draft.meetingNote.attendees}
                      onChange={(event) => updateMeetingNote("attendees", event.target.value)}
                      placeholder="Attendees (Optional)"
                      className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                    />
                    <textarea
                      rows={3}
                      value={draft.meetingNote.decisions}
                      onChange={(event) => updateMeetingNote("decisions", event.target.value)}
                      placeholder="Decisions (Optional)"
                      className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/78 px-4 py-3 text-sm leading-6 text-text outline-none"
                    />
                    <textarea
                      rows={3}
                      value={draft.meetingNote.followUps}
                      onChange={(event) => updateMeetingNote("followUps", event.target.value)}
                      placeholder="Follow-ups (Optional)"
                      className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/78 px-4 py-3 text-sm leading-6 text-text outline-none"
                    />
                    <textarea
                      rows={3}
                      value={draft.meetingNote.waitingOnItems}
                      onChange={(event) => updateMeetingNote("waitingOnItems", event.target.value)}
                      placeholder="Waiting-on items (Optional)"
                      className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/78 px-4 py-3 text-sm leading-6 text-text outline-none"
                    />
                    <input
                      value={draft.meetingNote.relatedCompany}
                      onChange={(event) => updateMeetingNote("relatedCompany", event.target.value)}
                      placeholder="Related company (Optional)"
                      className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                    />
                    <input
                      value={draft.meetingNote.relatedPerson}
                      onChange={(event) => updateMeetingNote("relatedPerson", event.target.value)}
                      placeholder="Related person (Optional)"
                      className="w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
                    />
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          <div className="rounded-[1.45rem] border border-line/75 bg-[rgba(255,255,255,0.58)] p-4">
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Linked Initiative</p>
            <input
              list="capture-initiative-options"
              value={initiativeQueries[draft.captureType]}
              onChange={(event) => handleInitiativeInput(event.target.value)}
              placeholder="Optional initiative link"
              className="mt-3 w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
            />
            <p className="mt-3 text-sm text-text-muted">
              Optional and intentionally quieter than the main capture fields.
            </p>
          </div>

          <div className="mt-auto">
            <div
              className={cn(
                "mt-4 min-h-6 text-sm transition-all duration-200",
                feedback ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
              )}
              aria-live="polite"
            >
              {feedback ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-text-muted">
                  <span>{feedback.message}</span>
                  {feedback.kind === "save-failed" && feedback.draft ? (
                    <>
                      <button type="button" onClick={handleSaveLocally} className="font-medium text-text">
                        Save locally
                      </button>
                      <button type="button" onClick={handleEdit} className="font-medium text-text">
                        Keep editing
                      </button>
                    </>
                  ) : null}
                  {feedback.draft && feedback.kind !== "save-failed" ? (
                    <>
                      <button type="button" onClick={handleUndo} className="font-medium text-text">
                        Undo
                      </button>
                      <button type="button" onClick={handleEdit} className="font-medium text-text">
                        Edit
                      </button>
                    </>
                  ) : null}
                </div>
              ) : (
                <span>&nbsp;</span>
              )}
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
