"use client";

import type { NotificationItem } from "@/lib/notifications";
import { cn } from "@/lib/utils";

type NotificationRowProps = {
  item: NotificationItem;
};

const priorityTone: Record<NotificationItem["priority"], string> = {
  1: "text-white",
  2: "text-[rgb(var(--color-shell-text))]",
  3: "text-[rgb(var(--color-shell-text))]"
};

export function NotificationRow({ item }: NotificationRowProps) {
  return (
    <button
      type="button"
      className="shell-tray-row flex w-full items-start gap-3 rounded-[1.15rem] px-3 py-3 text-left"
    >
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/45" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-medium leading-5", priorityTone[item.priority])}>
          {item.title}
        </span>
        <span className="mt-1 block text-[0.83rem] leading-5 text-[rgb(var(--color-shell-muted))]">
          {item.detail}
        </span>
      </span>
      <span className="shrink-0 pt-0.5 text-[0.72rem] uppercase tracking-[0.18em] text-[rgb(var(--color-shell-muted))]">
        {item.timestamp}
      </span>
    </button>
  );
}
