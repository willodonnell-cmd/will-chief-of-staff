import type { Route } from "next";
import Link from "next/link";

type HighFocusItemProps = {
  title: string;
  summary: string;
  owner: string;
  timing: string;
  decision: string;
  href: string;
};

export function HighFocusItem({
  title,
  summary,
  owner,
  timing,
  decision,
  href
}: HighFocusItemProps) {
  return (
    <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
      <p className="section-label">High focus</p>
      <h3 className="mt-3 text-[1.35rem] font-semibold leading-snug tracking-[-0.01em] text-text md:text-[1.5rem]">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-text-muted">{summary}</p>

      <div className="mt-6 flex items-center justify-between gap-4 border-t border-line/65 pt-5 text-sm text-text-muted">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="rounded-full border border-line/70 bg-white/68 px-3 py-1.5 text-text-muted">{owner}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-subtle" />
            {timing}
          </span>
        </div>
        <Link href={href as Route} className="shrink-0 whitespace-nowrap font-medium text-text transition hover:text-text-muted">
          View in inbox →
        </Link>
      </div>
    </section>
  );
}
