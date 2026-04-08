import { cn } from "@/lib/utils";

type GlancePillProps = {
  label: string;
  value: string;
  tone?: "neutral" | "moss" | "red";
};

export function GlancePill({ label, value, tone = "neutral" }: GlancePillProps) {
  return (
    <div
      className={cn(
        "rounded-[1.4rem] border px-4 py-4",
        tone === "neutral" && "border-line/70 bg-white/70",
        tone === "moss" && "border-accent-moss/20 bg-[rgba(104,118,86,0.07)]",
        tone === "red" && "border-accent-red/20 bg-[rgba(125,35,31,0.07)]"
      )}
    >
      <p className="text-[0.72rem] uppercase tracking-[0.2em] text-text-subtle">{label}</p>
      <p className="mt-3 text-2xl font-medium tracking-[-0.03em] text-text">{value}</p>
    </div>
  );
}

