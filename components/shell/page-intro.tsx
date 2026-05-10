type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageIntro({ eyebrow, title, description }: PageIntroProps) {
  return (
    <div className="space-y-4 md:space-y-5">
      <div className="min-w-0">
        <p className="section-label">{eyebrow}</p>
        <h2 className="page-title">{title}</h2>
        <p className="mt-3 max-w-[58rem] text-sm leading-6 text-text-muted md:text-[0.95rem]">{description}</p>
      </div>
      <div className="flex justify-start md:justify-end">
        <div className="chip">
          One responsive app for iPhone, iPad, and Mac
        </div>
      </div>
    </div>
  );
}
