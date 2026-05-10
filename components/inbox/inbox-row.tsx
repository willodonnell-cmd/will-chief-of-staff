import { cn } from "@/lib/utils";

type InboxRowProps = {
  sender: string;
  subject: string;
  preview: string;
  received: string;
  action?: string;
  elevated?: boolean;
  protectedThread?: boolean;
};

export function InboxRow({
  sender,
  subject,
  preview,
  received,
  action = "Open",
  elevated = false,
  protectedThread = false
}: InboxRowProps) {
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-[1.4rem] border px-4 py-4 transition-colors duration-200 md:flex-row md:items-center md:justify-between",
        elevated
          ? "refined-b"
          : protectedThread
            ? "border-accent-red/18 bg-[rgba(125,35,31,0.06)]"
            : "border-line/70 bg-[rgba(255,255,255,0.64)]"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-sm font-medium text-text">{sender}</p>
          <span className="section-label">{received}</span>
          {protectedThread ? (
            <span className="rounded-full border border-accent-red/22 px-2 py-0.5 text-[0.68rem] uppercase tracking-[0.16em] text-text-subtle">
              Protected
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm font-medium text-text">{subject}</p>
        <p className="mt-1 text-sm leading-6 text-text-muted">{preview}</p>
      </div>

      <div className="md:pl-4">
        <button
          type="button"
          className={cn(elevated ? "btn-primary" : "btn-secondary")}
        >
          {action}
        </button>
      </div>
    </article>
  );
}

