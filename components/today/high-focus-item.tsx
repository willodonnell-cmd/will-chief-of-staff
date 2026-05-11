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
      <div className="brief-layout">
        <div className="brief-main">
          <p className="section-label">High focus</p>
          <h3 className="brief-title">{title}</h3>
          <p className="brief-body">{summary}</p>
        </div>

        <div className="brief-side rounded-[1.35rem] border border-line/70 bg-white/66 px-4 py-4">
          <p className="section-label">Next decision</p>
          <p className="mt-3 text-base font-medium leading-6 text-text">{decision}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-line/65 pt-5 text-sm text-text-muted md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-line/70 bg-white/68 px-3 py-1.5">{owner}</span>
          <span className="flex items-center">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-text-subtle" />
            {timing}
          </span>
        </div>
        <Link href={href as Route} className="font-medium text-text transition hover:text-text-muted">
          View in inbox →
        </Link>
      </div>
    </section>
  );
}
