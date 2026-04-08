type SupportingPointProps = {
  children: React.ReactNode;
};

export function SupportingPoint({ children }: SupportingPointProps) {
  return (
    <div className="flex gap-3 rounded-[1.25rem] border border-line/60 bg-[rgba(255,255,255,0.54)] px-4 py-3">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-text-subtle" />
      <p className="text-sm leading-6 text-text-muted">{children}</p>
    </div>
  );
}

