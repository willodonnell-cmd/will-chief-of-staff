type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageIntro({ eyebrow, title, description }: PageIntroProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-medium tracking-[-0.03em] text-text md:text-4xl">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted md:text-base">{description}</p>
      </div>
      <div className="rounded-full border border-line/80 bg-white/70 px-4 py-2 text-sm text-text-muted">
        One responsive app for iPhone, iPad, and Mac
      </div>
    </div>
  );
}

