type SupportNoteProps = {
  eyebrow: string;
  title: string;
  body: string;
};

export function SupportNote({ eyebrow, title, body }: SupportNoteProps) {
  return (
    <section className="rounded-[1.75rem] border border-line/75 bg-white/70 p-5 md:p-6">
      <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">{eyebrow}</p>
      <h3 className="section-title">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-text-muted">{body}</p>
    </section>
  );
}
