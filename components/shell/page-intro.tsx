type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageIntro({ eyebrow, title, description }: PageIntroProps) {
  return (
    <div className="min-w-0">
      <p className="section-label">{eyebrow}</p>
      <h2 className="page-title">{title}</h2>
      <p className="mt-3 max-w-[58rem] text-sm leading-6 text-text-muted md:text-[0.95rem]">{description}</p>
    </div>
  );
}
