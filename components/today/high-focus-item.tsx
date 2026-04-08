type HighFocusItemProps = {
  title: string;
  summary: string;
  owner: string;
  timing: string;
  decision: string;
};

export function HighFocusItem({
  title,
  summary,
  owner,
  timing,
  decision
}: HighFocusItemProps) {
  return (
    <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">High focus</p>
          <h3 className="mt-3 text-[1.85rem] font-medium tracking-[-0.04em] text-text md:text-[2.4rem]">
            {title}
          </h3>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-text-muted md:text-base">{summary}</p>
        </div>

        <div className="rounded-[1.35rem] border border-line/70 bg-white/66 px-4 py-4 lg:max-w-[17rem]">
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-text-subtle">Next decision</p>
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
        <p className="font-medium text-text">Keep the next move narrow.</p>
      </div>
    </section>
  );
}

