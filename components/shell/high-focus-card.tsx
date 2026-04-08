import { ArrowUpRight } from "lucide-react";

type HighFocusCardProps = {
  title: string;
  owner: string;
  timing: string;
  summary: string;
  decision: string;
};

export function HighFocusCard({
  title,
  owner,
  timing,
  summary,
  decision
}: HighFocusCardProps) {
  return (
    <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">High focus</p>
          <h3 className="mt-3 text-[1.8rem] font-medium tracking-[-0.04em] text-text md:text-[2.35rem]">
            {title}
          </h3>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-text-muted md:text-base">{summary}</p>
        </div>
        <div className="rounded-[1.4rem] border border-line/75 bg-white/65 px-4 py-3 text-sm text-text-muted">
          <p className="text-[0.68rem] uppercase tracking-[0.2em] text-text-subtle">Next decision</p>
          <p className="mt-2 font-medium text-text">{decision}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-line/70 pt-5 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
          <span className="rounded-full border border-line/70 bg-white/65 px-3 py-1.5">{owner}</span>
          <span className="flex items-center">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-text-subtle" />
            {timing}
          </span>
        </div>
        <div className="inline-flex items-center gap-2 text-sm font-medium text-text">
          Stay on the narrowest next move
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>
    </section>
  );
}
