type CollapsedCommitmentSectionProps = {
  eyebrow: string;
  title: string;
  summary: string;
  children: React.ReactNode;
};

export function CollapsedCommitmentSection({
  eyebrow,
  title,
  summary,
  children
}: CollapsedCommitmentSectionProps) {
  return (
    <details className="group rounded-[1.75rem] border border-line/75 bg-white/66 p-5 md:p-6">
      <summary className="flex cursor-pointer list-none flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="section-label">{eyebrow}</p>
          <h3 className="section-title">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-text-muted">{summary}</p>
        </div>
        <span className="text-sm font-medium text-text-muted transition group-open:text-text">Expand</span>
      </summary>
      <div className="mt-5 border-t border-line/55 pt-5">{children}</div>
    </details>
  );
}
