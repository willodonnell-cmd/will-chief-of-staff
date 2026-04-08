type RecommendedChangeCardProps = {
  summary: string;
  impacts: string;
  why: string;
};

export function RecommendedChangeCard({ summary, impacts, why }: RecommendedChangeCardProps) {
  return (
    <div className="rounded-[1.4rem] border border-line/70 bg-white/78 px-4 py-4 transition-transform duration-200 ease-out hover:-translate-y-0.5">
      <p className="text-sm font-medium leading-6 text-text">{summary}</p>

      <div className="mt-4 space-y-3 text-sm leading-6 text-text-muted">
        <div>
          <p className="text-[0.67rem] uppercase tracking-[0.2em] text-text-subtle">What it impacts</p>
          <p className="mt-1">{impacts}</p>
        </div>
        <div>
          <p className="text-[0.67rem] uppercase tracking-[0.2em] text-text-subtle">Why</p>
          <p className="mt-1">{why}</p>
        </div>
      </div>
    </div>
  );
}
