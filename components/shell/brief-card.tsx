import { cn } from "@/lib/utils";

type BriefCardProps = {
  title: string;
  eyebrow: string;
  body: string;
  tone?: "default" | "protected" | "quiet";
};

export function BriefCard({ title, eyebrow, body, tone = "default" }: BriefCardProps) {
  return (
    <section
      className={cn(
        "rounded-[1.75rem] border p-5 md:p-6",
        tone === "default" && "border-line/75 bg-white/76",
        tone === "protected" && "border-accent-red/25 bg-[rgba(125,35,31,0.08)]",
        tone === "quiet" && "border-accent-moss/20 bg-[rgba(104,118,86,0.08)]"
      )}
    >
      <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">{eyebrow}</p>
      <h3 className="mt-3 text-xl font-medium tracking-[-0.02em] text-text">{title}</h3>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">{body}</p>
    </section>
  );
}

