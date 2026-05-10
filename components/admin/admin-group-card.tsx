import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

type AdminGroupCardProps = {
  eyebrow: string;
  title: string;
  summary: string;
  currentState: string;
  note: string;
  icon: ComponentType<{ className?: string }>;
  secondary?: boolean;
};

export function AdminGroupCard({
  eyebrow,
  title,
  summary,
  currentState,
  note,
  icon: Icon,
  secondary = false
}: AdminGroupCardProps) {
  return (
    <section
      className={cn(
        "rounded-[1.55rem] border px-5 py-5 transition-transform duration-200 ease-out hover:-translate-y-0.5",
        secondary
          ? "border-line/65 bg-[rgba(255,255,255,0.6)]"
          : "border-line/75 bg-white/72 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.34)]"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-label">{eyebrow}</p>
          <h3 className="section-title mt-2">{title}</h3>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-2xl border",
            secondary ? "border-line/55 bg-white/65" : "border-line/65 bg-white/78"
          )}
        >
          <Icon className="h-4.5 w-4.5 text-text-muted" />
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-text-muted">{summary}</p>

      <div className="mt-5 rounded-[1.2rem] border border-line/60 bg-[rgba(255,255,255,0.72)] px-4 py-3">
        <p className="section-label">Current state</p>
        <p className="mt-2 text-sm font-medium leading-6 text-text">{currentState}</p>
      </div>

      <p className="mt-4 text-sm leading-6 text-text-muted">{note}</p>
    </section>
  );
}
