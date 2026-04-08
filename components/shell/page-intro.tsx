type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageIntro({ eyebrow, title, description }: PageIntroProps) {
  return (
    <div className="space-y-4 md:space-y-5">
      <div className="min-w-0">
        <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">{eyebrow}</p>
        <h2 className="page-title">{title}</h2>
        <p className="mt-3 max-w-[58rem] text-sm leading-6 text-text-muted md:text-[0.95rem]">{description}</p>
      </div>
      <div className="flex justify-start md:justify-end">
        <div className="rounded-full border border-line/80 bg-white/70 px-4 py-2 text-sm text-text-muted">
          One responsive app for iPhone, iPad, and Mac
        </div>
      </div>
    </div>
  );
}
