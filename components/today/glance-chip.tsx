import type { Route } from "next";
import Link from "next/link";

import { cn } from "@/lib/utils";

type GlanceChipProps = {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "quiet" | "protected";
  href?: string;
};

const chipClass = (tone: GlanceChipProps["tone"]) =>
  cn(
    "rounded-[1.35rem] border px-4 py-4 transition-colors duration-150",
    tone === "default" && "border-line/70 bg-white/72 hover:bg-white/90",
    tone === "quiet" && "border-accent-moss/18 bg-[rgba(104,118,86,0.08)] hover:bg-[rgba(104,118,86,0.13)]",
    tone === "protected" && "border-accent-red/18 bg-[rgba(125,35,31,0.08)] hover:bg-[rgba(125,35,31,0.12)]"
  );

const inner = (label: string, value: string, detail?: string) => (
  <>
    <p className="section-label">{label}</p>
    <p className="mt-3 text-2xl font-medium tracking-[-0.03em] text-text">{value}</p>
    {detail ? <p className="mt-2 text-sm leading-5 text-text-muted">{detail}</p> : null}
  </>
);

export function GlanceChip({ label, value, detail, tone = "default", href }: GlanceChipProps) {
  if (href) {
    return (
      <Link href={href as Route} className={chipClass(tone)}>
        {inner(label, value, detail)}
      </Link>
    );
  }

  return (
    <div className={chipClass(tone)}>
      {inner(label, value, detail)}
    </div>
  );
}
