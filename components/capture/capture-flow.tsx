"use client";

import { useRef, useState } from "react";
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

const defaultDraft: CaptureDraft = {
  pattern: "note",
  privacy: "open",
  summary: "",
  followUp: "",
  privateContext: ""
};

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
  return pattern === "note" ? "Capture note" : "Capture task";
}

type ConfirmationState = {
  message: string;
  draft: CaptureDraft;
} | null;

type CaptureFlowProps = {
  initialFrom?: string | null;
};

export function CaptureFlow({ initialFrom }: CaptureFlowProps) {
  const inheritedContext = labelForContext(initialFrom ?? null);
  const [draft, setDraft] = useState<CaptureDraft>(defaultDraft);
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null);
  const [isPending, setIsPending] = useState(false);
  const summaryRef = useRef<HTMLTextAreaElement>(null);

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
        setConfirmation({
          message: result.message,
          draft: savedDraft
        });
        return;
      }

      setConfirmation({
        message: `Captured ${savedDraft.pattern} in ${inheritedContext.name}.`,
        draft: savedDraft
      });
      setDraft({
        ...defaultDraft,
        pattern: savedDraft.pattern
      });
    } finally {
      setIsPending(false);
    }
  }

  function handleUndo() {
    if (!confirmation) {
      return;
    }

    restoreDraft(confirmation.draft);
    setConfirmation(null);
  }

  function handleEdit() {
    if (!confirmation) {
      return;
    }

    restoreDraft(confirmation.draft);
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
              <div className="inline-flex items-center gap-3 rounded-full border border-line/70 bg-white/70 px-3 py-2 text-text">
                <CaptureMicrophoneIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Capture</span>
              </div>
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
              confirmation ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
            )}
            aria-live="polite"
          >
            {confirmation ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-text-muted">
                <span>{confirmation.message}</span>
                <button type="button" onClick={handleUndo} className="font-medium text-text">
                  Undo
                </button>
                <button type="button" onClick={handleEdit} className="font-medium text-text">
                  Edit
                </button>
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
