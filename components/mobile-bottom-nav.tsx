"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { mobileNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();

  function hrefForItem(href: Route, isCapture?: boolean) {
    if (!isCapture || pathname === href) {
      return href;
    }

    return {
      pathname: href,
      query: { from: pathname }
    };
  }

  return (
    <nav className="fixed inset-x-0 bottom-4 z-50 px-3 md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 rounded-[2rem] border border-white/10 bg-[rgba(18,24,30,0.92)] p-2 shadow-2xl shadow-black/35 backdrop-blur-xl">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={hrefForItem(item.href, item.isCapture)}
              className={cn(
                "flex min-h-[72px] flex-col items-center justify-center rounded-[1.4rem] px-1 text-center transition-colors duration-200",
                item.isCapture
                  ? "relative -mt-6 bg-white text-[rgb(var(--color-shell))] shadow-lg shadow-black/30"
                  : active
                    ? "bg-white/8 text-white"
                    : "text-[rgb(var(--color-shell-muted))]"
              )}
            >
              <Icon className={cn("h-5 w-5", item.isCapture ? "h-6 w-6" : "")} />
              <span className={cn("mt-2 text-[11px] font-medium", item.isCapture ? "" : active ? "text-white" : "")}>
                {item.shortLabel ?? item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
