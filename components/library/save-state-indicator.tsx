import { cn } from "@/lib/utils";

type SaveStateIndicatorProps = {
  state: "saved" | "pending" | "error";
  detail?: string;
};

export function SaveStateIndicator({ state, detail }: SaveStateIndicatorProps) {
  if (state === "saved") {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.65rem] uppercase tracking-[0.18em]",
        state === "error"
          ? "border-accent-red/20 bg-[rgba(125,35,31,0.07)] text-[rgb(125,35,31)]"
          : "border-line/70 bg-white/70 text-text-subtle"
      )}
      title={detail || undefined}
    >
      {state === "pending" ? "Pending save" : "Needs review"}
    </span>
  );
}
