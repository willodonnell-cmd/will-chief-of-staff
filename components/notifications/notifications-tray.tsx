"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

import { NotificationRow } from "@/components/notifications/notification-row";
import { desktopNotificationItems } from "@/lib/notifications";
import { cn } from "@/lib/utils";

export function NotificationsTray() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const visibleItems = desktopNotificationItems.slice(0, 4);
  const hasNotifications = visibleItems.length > 0;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative hidden md:block">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "shell-control shell-control-notification relative inline-flex h-11 w-11 items-center justify-center rounded-[1.42rem] text-[rgb(var(--color-shell-muted))]",
          open && "shell-control-active shell-control-notification-active text-white"
        )}
      >
        <Bell className="h-[1.08rem] w-[1.08rem]" strokeWidth={1.9} />
        {hasNotifications ? (
          <span
            className="absolute right-[0.48rem] top-[0.48rem] h-1.5 w-1.5 rounded-full shadow-[0_0_0_3px_rgba(31,38,47,0.92)]"
            style={{ backgroundColor: "rgb(var(--color-accent-red))" }}
            aria-hidden="true"
          />
        ) : null}
      </button>

      {open ? (
        <div className="shell-tray absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[22rem] rounded-[1.6rem] p-3 text-[rgb(var(--color-shell-text))]">
          <div className="flex items-center justify-between px-1 pb-3">
            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.22em] text-[rgb(var(--color-shell-muted))]">
                Notifications
              </p>
              <p className="mt-1 text-sm text-[rgb(var(--color-shell-muted))]">
                Quiet, prioritized updates from across the operating surface.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {visibleItems.map((item) => (
              <NotificationRow key={item.id} item={item} />
            ))}
          </div>

          {desktopNotificationItems.length > visibleItems.length ? (
            <button
              type="button"
              className="mt-3 inline-flex items-center rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-sm text-[rgb(var(--color-shell-muted))] transition hover:border-white/12 hover:bg-white/6 hover:text-white"
            >
              View more
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
