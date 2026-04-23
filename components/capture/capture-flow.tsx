"use client";

import { useEffect, useRef, useState } from "react";
import { Shield, Sparkles } from "lucide-react";

import { persistCaptureAction } from "@/app/capture/actions";
import { CaptureMicrophoneIcon } from "@/components/icons/capture-microphone-icon";
import type { CapturePattern, CapturePrivacy } from "@/lib/captures";
import { cn } from "@/lib/utils";

type CaptureDraft = {
  pattern: CapturePattern;
  privacy: CapturePrivacy;
  summary: string;
  followUp: string;
  privateContext: string;
};

type FeedbackState =
  | {
      kind: "saved" | "save-failed" | "queued" | "status";
      message: string;
      draft?: CaptureDraft;
      queueId?: string;
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
  summary: "",
  followUp: "",
  privateContext: ""
};

const LOCAL_CAPTURE_QUEUE_KEY = "chief-of-staff.capture-queue";

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

function placeholderForPattern(pattern: CapturePattern) {
  return pattern === "note"
    ? "Capture the thought before it turns into work."
    : "Capture the next concrete task in one sentence.";
}

function submitLabelForPattern(pattern: CapturePattern) {
  return pattern === "note" ? "Save Note" : "Save Task";
}

function joinCaptureText(base: string, transcript: string) {
  if (!base) {
    return transcript;
  }

  if (!transcript) {
    return base;
  }

  return `${base}${base.endsWith(" ") ? "" : " "}${transcript}`;
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
      return "Voice Note access was denied. Type your note below and save it.";
    case "audio-capture":
      return "No microphone was available. Type your note below and save it.";
    case "network":
      return "Voice Note was interrupted. Type your note below and save it.";
    default:
      return "Voice Note is unavailable here. Type your note below and save it.";
  }
}

type CaptureFlowProps = {
  initialFrom?: string | null;
};

export function CaptureFlow({ initialFrom }: CaptureFlowProps) {
  const inheritedContext = labelForContext(initialFrom ?? null);
  const [draft, setDraft] = useState<CaptureDraft>(defaultDraft);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isPending, setIsPending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionBaseSummaryRef = useRef("");
  const syncInProgressRef = useRef(false);

  function updateDraft<K extends keyof CaptureDraft>(key: K, value: CaptureDraft[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function restoreDraft(nextDraft: CaptureDraft) {
    setDraft(nextDraft);
    window.requestAnimationFrame(() => {
      summaryRef.current?.focus();
    });
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
          summary: queuedCapture.summary,
          followUp: queuedCapture.followUp,
          privateContext: queuedCapture.privateContext
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
    recognitionBaseSummaryRef.current = draft.summary.trim();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results ?? [])
        .map((result) => result?.[0]?.transcript ?? "")
        .join(" ")
        .trim();

      setDraft((current) => ({
        ...current,
        summary: joinCaptureText(recognitionBaseSummaryRef.current, transcript)
      }));
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
        message: "Voice Note is listening. Speak now, then Save Note when the text looks right."
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

    const trimmedSummary = draft.summary.trim();
    if (!trimmedSummary) {
      summaryRef.current?.focus();
      return;
    }

    const savedDraft: CaptureDraft = {
      ...draft,
      summary: trimmedSummary,
      followUp: draft.followUp.trim(),
      privateContext: draft.privateContext.trim()
    };

    setIsPending(true);

    try {
      const result = await persistCaptureAction({
        sourcePath: initialFrom ?? null,
        pattern: savedDraft.pattern,
        privacy: savedDraft.privacy,
        summary: savedDraft.summary,
        followUp: savedDraft.followUp,
        privateContext: savedDraft.privateContext
      });

      if (!result.ok) {
        setFeedback({
          kind: "save-failed",
          message: `${result.message} You can keep editing or save locally pending sync.`,
          draft: savedDraft
        });
        return;
      }

      setFeedback({
        kind: "saved",
        message: `Captured ${savedDraft.pattern} in ${inheritedContext.name}.`,
        draft: savedDraft
      });
      setDraft({
        ...defaultDraft,
        pattern: savedDraft.pattern
      });
      void syncQueuedCaptures();
    } finally {
      setIsPending(false);
    }
  }

  function handleSaveLocally() {
    if (!feedback?.draft) {
      return;
    }

    const queuedCapture = queueCaptureLocally(initialFrom ?? null, feedback.draft);
    setDraft({
      ...defaultDraft,
      pattern: feedback.draft.pattern
    });
    setFeedback({
      kind: "queued",
      message: "Saved locally only, not yet synced to Supabase.",
      draft: feedback.draft,
      queueId: queuedCapture.id
    });
  }

  function handleUndo() {
    if (!feedback?.draft) {
      return;
    }

    if (feedback.kind === "queued") {
      removeQueuedCapture(feedback.queueId);
    }

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

    restoreDraft(feedback.draft);
  }

  const hybridHelper =
    draft.privacy === "hybrid"
      ? "Hybrid keeps the main capture attached to the current context while the private note remains protected."
      : draft.privacy === "protected"
        ? "Protected capture is private by default."
        : "Open capture stays available within the inherited context.";

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="rounded-[1.85rem] border border-line/75 bg-white/78 p-5 focus-elevation md:p-6 lg:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
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
              <h2 className="page-title mt-4">Always available, with context already attached.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted md:text-base">
                Use note and task patterns without leaving the current working surface. Keep sensitive context private
                when needed, and confirm quietly once the capture lands.
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-line/75 bg-[rgba(255,255,255,0.62)] px-4 py-4 md:max-w-[16rem]">
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Inherited context</p>
              <p className="mt-3 text-base font-medium text-text">{inheritedContext.name}</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">{inheritedContext.detail}</p>
            </div>
          </div>
        </div>

        <aside className="rounded-[1.85rem] border border-line/75 bg-white/68 p-5 md:p-6">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Behavior</p>
          <div className="mt-4 space-y-4 text-sm leading-6 text-text-muted">
            <p>Capture stays present in the center of the iPhone nav and as a persistent shell action on larger screens.</p>
            <p>Undo and Edit remain available after capture so fast entry never traps the draft.</p>
            <p className="flex items-start gap-2">
              <Shield className="mt-1 h-4 w-4 shrink-0 text-accent-red" />
              Corvette red appears only around private or hybrid moments.
            </p>
          </div>
        </aside>
      </section>

      <form onSubmit={handleSubmit} className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[1.85rem] border border-line/75 bg-white/76 p-5 md:p-6">
          <div className="space-y-5">
            <div>
              <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Pattern</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["note", "task"] as CapturePattern[]).map((pattern) => (
                  <button
                    key={pattern}
                    type="button"
                    onClick={() => updateDraft("pattern", pattern)}
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
            </div>

            <div>
              <label className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle" htmlFor="summary">
                {draft.pattern === "note" ? "Note" : "Task"}
              </label>
              <textarea
                id="summary"
                ref={summaryRef}
                rows={5}
                value={draft.summary}
                onChange={(event) => updateDraft("summary", event.target.value)}
                placeholder={placeholderForPattern(draft.pattern)}
                className="mt-3 w-full resize-none rounded-[1.45rem] border border-line/80 bg-[rgba(255,255,255,0.72)] px-4 py-4 text-base text-text outline-none transition-colors duration-200 placeholder:text-text-subtle focus:border-text/30"
              />
            </div>

            <div>
              <label className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle" htmlFor="follow-up">
                {draft.pattern === "task" ? "Next step" : "Optional follow-up"}
              </label>
              <input
                id="follow-up"
                value={draft.followUp}
                onChange={(event) => updateDraft("followUp", event.target.value)}
                placeholder={draft.pattern === "task" ? "Owner, due cue, or follow-up" : "Turn this into a task if needed"}
                className="mt-3 w-full rounded-[1.3rem] border border-line/80 bg-[rgba(255,255,255,0.72)] px-4 py-3 text-sm text-text outline-none transition-colors duration-200 placeholder:text-text-subtle focus:border-text/30"
              />
            </div>
          </div>
        </section>

        <section className="rounded-[1.85rem] border border-line/75 bg-white/70 p-5 md:p-6">
          <div>
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
                  onClick={() => updateDraft("privacy", privacy)}
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
          </div>

          {(draft.privacy === "protected" || draft.privacy === "hybrid") && (
            <div className="mt-5">
              <label className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle" htmlFor="private-context">
                {draft.privacy === "hybrid" ? "Private context" : "Protected note"}
              </label>
              <textarea
                id="private-context"
                rows={4}
                value={draft.privateContext}
                onChange={(event) => updateDraft("privateContext", event.target.value)}
                placeholder={
                  draft.privacy === "hybrid"
                    ? "Add the sensitive detail that should stay protected."
                    : "Capture the private note."
                }
                className="mt-3 w-full resize-none rounded-[1.45rem] border border-accent-red/20 bg-[rgba(125,35,31,0.06)] px-4 py-4 text-sm text-text outline-none transition-colors duration-200 placeholder:text-text-subtle focus:border-accent-red/35"
              />
            </div>
          )}

          <div className="mt-6 rounded-[1.45rem] border border-line/75 bg-[rgba(255,255,255,0.58)] p-4">
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">After capture</p>
            <p className="mt-3 text-sm leading-6 text-text-muted">
              A single quiet confirmation appears after save, with Undo and Edit kept immediately adjacent.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full bg-text px-5 py-3 text-sm font-medium text-white transition-opacity duration-200 disabled:opacity-60"
            >
              <CaptureMicrophoneIcon className="h-4 w-4" />
              {submitLabelForPattern(draft.pattern)}
            </button>
            <p className="text-sm text-text-muted">Capture first. Sort and draft later.</p>
          </div>

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
        </section>
      </form>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/68 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Patterns</p>
            <h3 className="section-title">Two capture shapes, one quiet flow.</h3>
          </div>
          <Sparkles className="h-5 w-5 text-text-subtle" />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.35rem] border border-line/70 bg-white/64 p-4">
            <p className="text-sm font-medium text-text">Note pattern</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Fast intake for observations, fragments, and context that may become useful later.
            </p>
          </div>
          <div className="rounded-[1.35rem] border border-line/70 bg-white/64 p-4">
            <p className="text-sm font-medium text-text">Task pattern</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              Captures a concrete next move while keeping optional private context attached when the work is sensitive.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
