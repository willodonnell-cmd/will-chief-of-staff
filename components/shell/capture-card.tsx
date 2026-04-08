import { Mic, Paperclip, Sparkles } from "lucide-react";

export function CaptureCard() {
  return (
    <section className="rounded-[1.85rem] border border-line/75 bg-[rgba(255,255,255,0.82)] p-5 focus-elevation md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">Capture</p>
          <h3 className="mt-3 text-2xl font-medium tracking-[-0.03em] text-text">Always available, never noisy.</h3>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            Capture sits at the center of the mobile nav and as a persistent action on larger screens, ready for voice notes,
            links, and fragmented thoughts before they become work.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line/60 bg-white px-4 py-3 text-sm text-text-muted">
            <Mic className="mb-3 h-5 w-5 text-text" />
            Voice
          </div>
          <div className="rounded-2xl border border-line/60 bg-white px-4 py-3 text-sm text-text-muted">
            <Paperclip className="mb-3 h-5 w-5 text-text" />
            Files
          </div>
          <div className="rounded-2xl border border-line/60 bg-white px-4 py-3 text-sm text-text-muted">
            <Sparkles className="mb-3 h-5 w-5 text-text" />
            AI draft
          </div>
        </div>
      </div>
    </section>
  );
}

