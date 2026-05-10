import { cn } from "@/lib/utils";

type GlanceChipProps = {
  label: string;
  value: string;
  tone?: "default" | "quiet" | "protected";
};

export function GlanceChip({ label, value, tone = "default" }: GlanceChipProps) {
  return (
    <div
      className={cn(
        "rounded-[1.35rem] border px-4 py-4",
        tone === "default" && "border-line/70 bg-white/72",
        tone === "quiet" && "border-accent-moss/18 bg-[rgba(104,118,86,0.08)]",
        tone === "protected" && "border-accent-red/18 bg-[rgba(125,35,31,0.08)]"
      )}
    >
      <p className="section-label">{label}</p>
      <p className="mt-3 text-2xl font-medium tracking-[-0.03em] text-text">{value}</p>
    </div>
  );
}

