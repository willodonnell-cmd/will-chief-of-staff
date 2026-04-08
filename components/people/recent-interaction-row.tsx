type RecentInteractionRowProps = {
  date: string;
  title: string;
  note: string;
};

export function RecentInteractionRow({ date, title, note }: RecentInteractionRowProps) {
  return (
    <article className="rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.62)] px-4 py-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-medium text-text">{title}</p>
        <span className="text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle">{date}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-text-muted">{note}</p>
    </article>
  );
}

