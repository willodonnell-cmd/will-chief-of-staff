"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { persistCaptureAction } from "@/app/capture/actions";
import type {
  CapturePattern,
  CapturePrivacy,
  InitiativeOption,
  TaskCaptureSettings,
  TaskCategoryOption,
  TaskPriority
} from "@/lib/blackhawk-capture-model";
import { formatTaskPriorityLabel } from "@/lib/blackhawk-capture-model";
import type { NoteFields, TaskFields } from "@/lib/blackhawk-capture-model";
import { CaptureMicrophoneIcon } from "@/components/icons/capture-microphone-icon";
import {
  isSignalCaptureHandoff,
  SIGNAL_CAPTURE_HANDOFF_STORAGE_PREFIX,
  type SignalCaptureContext
} from "@/lib/signal-capture-drafts";
import { cn } from "@/lib/utils";

type CaptureDraft = {
  pattern: CapturePattern;
  privacy: CapturePrivacy;
  privateContext: string;
  note: {
    title: string;
    body: string;
    linkedInitiativeId: string | null;
  };
  task: {
    description: string;
    nextStep: string;
    desiredOutcome: string;
    priority: TaskPriority;
    categoryId: string | null;
    linkedInitiativeId: string | null;
  };
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
  pattern: "note",
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
    linkedInitiativeId: null
  }
};

const LOCAL_CAPTURE_QUEUE_KEY = "blackhawk.capture-queue.v2";
const LAST_PATTERN_KEY = "blackhawk.capture.last-pattern";

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

function submitLabelForPattern(pattern: CapturePattern) {
  return pattern === "note" ? "Save" : "Save Task";
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

    const parsed = JSON.parse(raw) as QueuedCapture[];
    return Array.isArray(parsed) ? parsed : [];
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

function flattenTaskIntoNoteBody(task: CaptureDraft["task"]) {
  const sections = [
    task.description.trim(),
    task.nextStep.trim() ? `Next Step:\n${task.nextStep.trim()}` : null,
    task.desiredOutcome.trim() ? `Desired Outcome:\n${task.desiredOutcome.trim()}` : null
  ].filter((value): value is string => Boolean(value));

  return sections.join("\n\n");
}

type CaptureFlowProps = {
  initialFrom?: string | null;
  initialHandoffKey?: string | null;
  categories: TaskCategoryOption[];
  commonCategories: TaskCategoryOption[];
  captureSettings: TaskCaptureSettings;
  initiatives: InitiativeOption[];
};

function toDraftNote(note: NoteFields): CaptureDraft["note"] {
  return {
    title: note.title,
    body: note.body,
    linkedInitiativeId: note.linkedInitiativeId
  };
}

function toDraftTask(task: TaskFields): CaptureDraft["task"] {
  return {
    description: task.description,
    nextStep: task.nextStep,
    desiredOutcome: task.desiredOutcome,
    priority: task.priority,
    categoryId: task.categoryId,
    linkedInitiativeId: task.linkedInitiativeId
  };
}

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
  const [showNextStep, setShowNextStep] = useState(captureSettings.expandNextStepByDefault);
  const [showDesiredOutcome, setShowDesiredOutcome] = useState(captureSettings.expandDesiredOutcomeByDefault);
  const [signalContext, setSignalContext] = useState<SignalCaptureContext | null>(null);
  const [noteInitiativeQuery, setNoteInitiativeQuery] = useState("");
  const [taskInitiativeQuery, setTaskInitiativeQuery] = useState("");
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionBaseValueRef = useRef("");
  const syncInProgressRef = useRef(false);
  const appliedHandoffRef = useRef(false);

  useEffect(() => {
    const rememberedPattern =
      typeof window !== "undefined" ? (window.localStorage.getItem(LAST_PATTERN_KEY) as CapturePattern | null) : null;

    if (rememberedPattern === "task" || rememberedPattern === "note") {
      setDraft((current) => ({
        ...current,
        pattern: rememberedPattern
      }));
    }
  }, []);

  useEffect(() => {
    setShowNextStep(captureSettings.expandNextStepByDefault);
    setShowDesiredOutcome(captureSettings.expandDesiredOutcomeByDefault);
  }, [captureSettings.expandDesiredOutcomeByDefault, captureSettings.expandNextStepByDefault]);

  useEffect(() => {
    setNoteInitiativeQuery(initiativeLabel(initiatives, draft.note.linkedInitiativeId));
  }, [draft.note.linkedInitiativeId, initiatives]);

  useEffect(() => {
    setTaskInitiativeQuery(initiativeLabel(initiatives, draft.task.linkedInitiativeId));
  }, [draft.task.linkedInitiativeId, initiatives]);

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

      setDraft({
        pattern: parsed.pattern,
        privacy: parsed.privacy,
        privateContext: parsed.privateContext,
        note: toDraftNote(parsed.note),
        task: toDraftTask(parsed.task)
      });
      setSignalContext(parsed.sourceContext);
      setShowNextStep(Boolean(parsed.task.nextStep.trim()) || captureSettings.expandNextStepByDefault);
      setShowDesiredOutcome(
        Boolean(parsed.task.desiredOutcome.trim()) || captureSettings.expandDesiredOutcomeByDefault
      );
      setFeedback({
        kind: "status",
        message: "Drafted from Agent signal. Review and save only if it should become a task or note.",
        sourceContext: parsed.sourceContext
      });
      rememberPattern(parsed.pattern);
    } catch {
      // Ignore malformed handoff drafts and fall back to the normal capture composer.
    } finally {
      appliedHandoffRef.current = true;
    }
  }, [
    captureSettings.expandDesiredOutcomeByDefault,
    captureSettings.expandNextStepByDefault,
    initialHandoffKey
  ]);

  function rememberPattern(pattern: CapturePattern) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_PATTERN_KEY, pattern);
    }
  }

  function updateDraft(next: CaptureDraft | ((current: CaptureDraft) => CaptureDraft)) {
    setDraft(next);
  }

  function updateNote<K extends keyof CaptureDraft["note"]>(key: K, value: CaptureDraft["note"][K]) {
    updateDraft((current) => ({
      ...current,
      note: {
        ...current.note,
        [key]: value
      }
    }));
  }

  function updateTask<K extends keyof CaptureDraft["task"]>(key: K, value: CaptureDraft["task"][K]) {
    updateDraft((current) => ({
      ...current,
      task: {
        ...current.task,
        [key]: value
      }
    }));
  }

  function updatePrivacy(privacy: CapturePrivacy) {
    updateDraft((current) => ({
      ...current,
      privacy
    }));
  }

  function restoreDraft(nextDraft: CaptureDraft) {
    setDraft(nextDraft);
    setNoteInitiativeQuery(initiativeLabel(initiatives, nextDraft.note.linkedInitiativeId));
    setTaskInitiativeQuery(initiativeLabel(initiatives, nextDraft.task.linkedInitiativeId));
    window.requestAnimationFrame(() => {
      summaryRef.current?.focus();
    });
  }

  function switchPattern(nextPattern: CapturePattern) {
    if (nextPattern === draft.pattern) {
      return;
    }

    setSwitchNotice(null);

    if (nextPattern === "task") {
      const mappedDescription = preserveNoteTitleInTaskDescription(draft.note.title, draft.note.body);
      updateDraft((current) => ({
        ...current,
        pattern: "task",
        task: {
          ...current.task,
          description: mappedDescription || current.task.description,
          priority: current.task.priority ?? "medium",
          linkedInitiativeId: current.note.linkedInitiativeId ?? current.task.linkedInitiativeId
        }
      }));
      rememberPattern("task");
      return;
    }

    const hasStructuredTaskFields = Boolean(draft.task.nextStep.trim() || draft.task.desiredOutcome.trim());
    updateDraft((current) => ({
      ...current,
      pattern: "note",
      note: {
        ...current.note,
        body: flattenTaskIntoNoteBody(current.task) || current.note.body,
        linkedInitiativeId: current.task.linkedInitiativeId ?? current.note.linkedInitiativeId
      }
    }));

    if (hasStructuredTaskFields) {
      setSwitchNotice("Next Step and Desired Outcome were preserved, but they flatten into note text.");
    }

    rememberPattern("note");
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
        const result = await persistCaptureAction({
          sourcePath: queuedCapture.sourcePath,
          pattern: queuedCapture.pattern,
          privacy: queuedCapture.privacy,
          privateContext: queuedCapture.privateContext,
          note: queuedCapture.note,
          task: queuedCapture.task
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
    return draft.pattern === "note" ? draft.note.body : draft.task.description;
  }

  function setCurrentPrimaryValue(value: string) {
    if (draft.pattern === "note") {
      updateNote("body", value);
      return;
    }

    updateTask("description", value);
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
        message: `Voice capture is listening. Speak now, then ${submitLabelForPattern(draft.pattern)} when the text looks right.`
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

    const trimmedNoteBody = draft.note.body.trim();
    const trimmedTaskDescription = draft.task.description.trim();
    if (draft.pattern === "note" && !trimmedNoteBody) {
      summaryRef.current?.focus();
      return;
    }

    if (draft.pattern === "task" && !trimmedTaskDescription) {
      summaryRef.current?.focus();
      return;
    }

    const savedDraft: CaptureDraft = {
      ...draft,
      privateContext: draft.privateContext.trim(),
      note: {
        ...draft.note,
        title: draft.note.title.trim(),
        body: trimmedNoteBody
      },
      task: {
        ...draft.task,
        description: trimmedTaskDescription,
        nextStep: draft.task.nextStep.trim(),
        desiredOutcome: draft.task.desiredOutcome.trim()
      }
    };

    setIsPending(true);

    try {
      const result = await persistCaptureAction({
        sourcePath: initialFrom ?? null,
        pattern: savedDraft.pattern,
        privacy: savedDraft.privacy,
        privateContext: savedDraft.privateContext,
        note: savedDraft.note,
        task: savedDraft.task
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
        message: `Captured ${savedDraft.pattern} in ${inheritedContext.name}.`,
        draft: savedDraft,
        sourceContext: signalContext
      });
      setDraft((current) => ({
        ...defaultDraft,
        pattern: savedDraft.pattern,
        task: {
          ...defaultDraft.task,
          linkedInitiativeId: savedDraft.pattern === "task" ? current.task.linkedInitiativeId : null
        }
      }));
      setNoteInitiativeQuery("");
      if (savedDraft.pattern !== "task") {
        setTaskInitiativeQuery("");
      }
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
      pattern: failedDraft.pattern,
      task: {
        ...defaultDraft.task,
        linkedInitiativeId: failedDraft.pattern === "task" ? current.task.linkedInitiativeId : null
      }
    }));
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

  function handleInitiativeInput(kind: "note" | "task", value: string) {
    const trimmed = value.trim();
    const match = initiatives.find((initiative) => initiative.title.toLowerCase() === trimmed.toLowerCase()) ?? null;

    if (kind === "note") {
      setNoteInitiativeQuery(value);
      updateNote("linkedInitiativeId", match?.id ?? (trimmed ? draft.note.linkedInitiativeId : null));
      if (!trimmed) {
        updateNote("linkedInitiativeId", null);
      }
      return;
    }

    setTaskInitiativeQuery(value);
    updateTask("linkedInitiativeId", match?.id ?? (trimmed ? draft.task.linkedInitiativeId : null));
    if (!trimmed) {
      updateTask("linkedInitiativeId", null);
    }
  }

  const hybridHelper =
    draft.privacy === "hybrid"
      ? "Hybrid keeps the main capture attached to the current context while the private note remains protected."
      : draft.privacy === "protected"
        ? "Protected capture is private by default."
        : "Open capture stays available within the inherited context.";
  const selectedTaskCategory = categories.find((category) => category.id === draft.task.categoryId) ?? null;

  return (
    <div>
      <datalist id="capture-initiative-options">
        {initiatives.map((initiative) => (
          <option key={initiative.id} value={initiative.title} />
        ))}
      </datalist>

      <form onSubmit={handleSubmit} className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        {/* Left panel: What is this */}
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
              {submitLabelForPattern(draft.pattern)}
            </button>
          </div>

          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Type</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["note", "task"] as CapturePattern[]).map((pattern) => (
                <button
                  key={pattern}
                  type="button"
                  onClick={() => switchPattern(pattern)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200",
                    draft.pattern === pattern
                      ? "border-line bg-text text-white"
                      : "border-line/75 bg-white/60 text-text-muted hover:text-text"
                  )}
                >
                  {pattern === "note" ? "Note" : "Task"}
                </button>
              ))}
            </div>
            {switchNotice ? (
              <p className="mt-3 rounded-[1rem] border border-line/70 bg-white/72 px-4 py-3 text-sm leading-6 text-text-muted">
                {switchNotice}
              </p>
            ) : null}
          </div>

          {draft.pattern === "task" ? (
            <div>
              <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Priority</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["high", "medium", "low"] as TaskPriority[]).map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => updateTask("priority", priority)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition",
                      draft.task.priority === priority
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

          {draft.pattern === "task" ? (
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
                {selectedTaskCategory ? `${selectedTaskCategory.name} selected.` : "If you save without choosing, Blackhawk assigns TBD."}
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

            {(draft.privacy === "protected" || draft.privacy === "hybrid") && (
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
            )}
          </div>
        </section>

        {/* Right panel: What are you capturing + Save */}
        <section className="flex flex-col gap-5 rounded-[1.85rem] border border-line/75 bg-white/76 p-5 md:p-6">
          {draft.pattern === "note" ? (
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
                  ref={summaryRef}
                  rows={9}
                  value={draft.note.body}
                  onChange={(event) => updateNote("body", event.target.value)}
                  placeholder="Capture the thought before it turns into work."
                  className="mt-3 w-full resize-none rounded-[1.45rem] border border-line/80 bg-[rgba(255,255,255,0.72)] px-4 py-4 text-base text-text outline-none transition-colors duration-200 placeholder:text-text-subtle focus:border-text/30"
                />
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Task Description</span>
                <textarea
                  ref={summaryRef}
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
                  onClick={() => setShowNextStep((current) => !current)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Next Step</span>
                  {showNextStep ? <ChevronUp className="h-4 w-4 text-text-subtle" /> : <ChevronDown className="h-4 w-4 text-text-subtle" />}
                </button>
                {showNextStep ? (
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
                  onClick={() => setShowDesiredOutcome((current) => !current)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Desired Outcome</span>
                  {showDesiredOutcome ? <ChevronUp className="h-4 w-4 text-text-subtle" /> : <ChevronDown className="h-4 w-4 text-text-subtle" />}
                </button>
                {showDesiredOutcome ? (
                  <textarea
                    rows={3}
                    value={draft.task.desiredOutcome}
                    onChange={(event) => updateTask("desiredOutcome", event.target.value)}
                    placeholder="What does success look like?"
                    className="w-full resize-none rounded-[1.05rem] border border-line/75 bg-white/78 px-4 py-3 text-sm leading-6 text-text outline-none"
                  />
                ) : null}
              </div>
            </>
          )}

          <div className="rounded-[1.45rem] border border-line/75 bg-[rgba(255,255,255,0.58)] p-4">
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Linked Initiative</p>
            <input
              list="capture-initiative-options"
              value={draft.pattern === "note" ? noteInitiativeQuery : taskInitiativeQuery}
              onChange={(event) => handleInitiativeInput(draft.pattern, event.target.value)}
              placeholder="Optional initiative link"
              className="mt-3 w-full rounded-[1rem] border border-line/75 bg-white/78 px-4 py-3 text-sm text-text outline-none"
            />
            <p className="mt-3 text-sm text-text-muted">Optional and intentionally quieter than the main task or note fields.</p>
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
