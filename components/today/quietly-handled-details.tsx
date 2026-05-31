import type { Route } from "next";
import Link from "next/link";

import type { QuietlyHandledItem } from "@/lib/today-executive-leverage";

type QuietlyHandledDetailsProps = {
  items: QuietlyHandledItem[];
  totalCount?: number;
  hiddenCount?: number;
};

export function QuietlyHandledDetails({
  items,
  totalCount = items.length,
  hiddenCount = Math.max(0, totalCount - items.length)
}: QuietlyHandledDetailsProps) {
  if (totalCount === 0) {
    return (
      <section className="rounded-[1.75rem] border border-line/75 bg-white/66 p-5 md:p-6">
        <p className="section-label">Quietly handled</p>
        <h3 className="section-title mt-0">Suppressed to preserve focus.</h3>
        <p className="mt-2 text-sm leading-6 text-text-muted">No suppressed items right now.</p>
      </section>
    );
  }

  return (
    <details className="group rounded-[1.75rem] border border-line/75 bg-white/66 p-5 md:p-6">
      <summary className="flex cursor-pointer list-none flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="section-label">Quietly handled</p>
          <h3 className="section-title mt-0">Suppressed to preserve focus.</h3>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            {totalCount} low-priority, reference, or noise items stayed out of the foreground.
          </p>
        </div>

        <span className="text-sm font-medium text-text-muted transition group-open:text-text">
          Expand
        </span>
      </summary>

      <div className="mt-5 space-y-3 border-t border-line/55 pt-5">
        {items.map((item) =>
          item.href ? (
            <Link
              key={item.id}
              href={item.href as Route}
              className="block rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.6)] px-4 py-4 transition hover:bg-white/76"
            >
              <p className="text-sm font-medium leading-6 text-text">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">{item.summary}</p>
              <p className="mt-3 text-[12px] leading-5 text-text-subtle">
                {item.reason_suppressed}
              </p>
            </Link>
          ) : (
            <div
              key={item.id}
              className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.6)] px-4 py-4"
            >
              <p className="text-sm font-medium leading-6 text-text">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-text-muted">{item.summary}</p>
              <p className="mt-3 text-[12px] leading-5 text-text-subtle">
                {item.reason_suppressed}
              </p>
            </div>
          )
        )}

        {hiddenCount > 0 ? (
          <p className="text-sm leading-6 text-text-muted">
            +{hiddenCount} more low-priority items stayed out of the foreground.
          </p>
        ) : null}
      </div>
    </details>
  );
}
