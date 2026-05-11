"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NotificationsTray } from "@/components/notifications/notifications-tray";
import { mobileShellActions } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between px-4 py-4 md:px-6 lg:px-8">
      <div>
        <h1 className="text-lg font-medium text-white">Blackhawk: Chief of Staff</h1>
      </div>
      <div className="flex items-center gap-3">
        {mobileShellActions.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-[1.3rem] border border-white/10 bg-white/5 text-[rgb(var(--color-shell-muted))] transition md:hidden",
                active && "border-white/14 bg-white/8 text-white"
              )}
            >
              <Icon className="h-4 w-4" />
            </Link>
          );
        })}

        <div className="hidden items-center gap-3 md:flex">
          <NotificationsTray />
        </div>
      </div>
    </header>
  );
}
