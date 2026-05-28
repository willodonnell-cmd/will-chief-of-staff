"use client";

import { useState, useTransition } from "react";

import { persistCaptureAction } from "@/app/capture/actions";

type QuickCapturePanelProps = {
  sourcePath: string | null;
  onSaved?: () => void;
  compact?: boolean;
};

function subtlePillClass() {
  return "rounded-full border border-line/70 bg-white/72 px-3 py-1.5 text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle";
}

function primaryButtonClass() {
  return "rounded-full border border-[rgb(var(--color-shell))] bg-[rgb(var(--color-shell))] px-4 py-2 text-sm font-medium text-white transition hover:opacity-95 disabled:opacity-60";
}

export function QuickCapturePanel({ sourcePath, onSaved, compact = false }: QuickCapturePanelProps) {
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="rounded-[1.75rem] border border-line/75 bg-white/78 p-5 md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Quick Capture</p>
          <h2 className="section-title">{compact ? "Capture without leaving the page." : "Capture first. Classify later."}</h2>
          <p className="mt-2 max-w-[48rem] text-sm leading-6 text-text-muted">
            Paste an unstructured thought, task, reminder, meeting fragment, person update, company note, or research question without choosing structure first.
          </p>
        </div>
        <span className={subtlePillClass()}>Manual capture</span>
      </div>

      <div className="mt-5 space-y-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type or paste whatever Will needs to get out of his head."
          className="min-h-[150px] w-full rounded-[1.3rem] border border-line/75 bg-white/82 px-4 py-4 text-sm leading-6 text-text outline-none transition focus:border-line"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isPending || !draft.trim()}
            className={primaryButtonClass()}
            onClick={() => {
              const body = draft.trim();
              if (!body) {
                return;
              }

              startTransition(async () => {
                const result = await persistCaptureAction({
                  sourcePath,
                  pattern: "note",
                  privacy: "open",
                  privateContext: "",
                  note: {
                    title: "",
                    body,
                    linkedInitiativeId: null
                  }
                });

                if (result.ok) {
                  setDraft("");
                  setFeedback("Saved to manual capture.");
                  onSaved?.();
                  return;
                }

                setFeedback(result.message);
              });
            }}
          >
            {isPending ? "Saving..." : "Save capture"}
          </button>
          {feedback ? <p className="text-sm text-text-muted">{feedback}</p> : <p className="text-sm text-text-muted">Nothing else is required before saving.</p>}
        </div>
      </div>
    </section>
  );
}
