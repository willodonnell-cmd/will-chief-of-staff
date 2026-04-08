import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string;
  tone?: "neutral" | "moss" | "red";
};

export function MetricCard({ label, value, tone = "neutral" }: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-[1.5rem] border p-4 focus-elevation",
        tone === "neutral" && "border-line/70 bg-white/72",
        tone === "moss" && "border-accent-moss/25 bg-[rgba(104,118,86,0.08)]",
        tone === "red" && "border-accent-red/25 bg-[rgba(125,35,31,0.08)]"
      )}
    >
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-6 text-3xl font-medium tracking-[-0.03em] text-text">{value}</p>
    </div>
  );
}

