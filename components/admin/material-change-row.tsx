type MaterialChangeRowProps = {
  changedAt: string;
  title: string;
  summary: string;
};

export function MaterialChangeRow({ changedAt, title, summary }: MaterialChangeRowProps) {
  return (
    <div className="rounded-[1.3rem] border border-line/65 bg-[rgba(255,255,255,0.62)] px-4 py-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-text">{title}</p>
          <p className="mt-2 text-sm leading-6 text-text-muted">{summary}</p>
        </div>
        <div className="rounded-full border border-line/70 bg-white/72 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-text-subtle">
          {changedAt}
        </div>
      </div>
    </div>
  );
}
