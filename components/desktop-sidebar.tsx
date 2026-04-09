"use client";

import type { Route } from "next";
import type { CSSProperties } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { CaptureShellControl } from "@/components/capture/capture-shell-control";
import { desktopPrimaryNav, desktopSecondaryNav } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function SidebarLink({
  href,
  label,
  icon: Icon,
  capture,
  active
}: {
  href: Route | { pathname: Route; query: { from: string } };
  label: string;
  icon: ComponentType<{ className?: string }>;
  capture?: boolean;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
        capture
          ? "bg-white text-[rgb(var(--color-shell))] shadow-lg shadow-black/20"
          : active
            ? "bg-white/8 text-white"
            : "text-[rgb(var(--color-shell-muted))] hover:bg-white/5 hover:text-white"
      )}
    >
      <Icon className={cn("h-5 w-5", capture ? "" : active ? "text-white" : "text-white/70")} />
      <span className={cn("font-medium", capture ? "text-[rgb(var(--color-shell))]" : "")}>{label}</span>
    </Link>
  );
}

function ShellRailControl({
  href,
  icon: Icon,
  label,
  active,
  style
}: {
  href: Route | { pathname: Route; query: { from: string } };
  icon: ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  style?: CSSProperties;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      style={style}
      className={cn(
        "shell-control relative inline-flex h-[3.43rem] w-[3.43rem] shrink-0 items-center justify-center rounded-[1.4rem] justify-self-center text-[rgb(var(--color-shell-muted))]",
        active && "shell-control-active text-white"
      )}
    >
      <Icon className={cn("h-[1.43rem] w-[1.43rem]", active ? "text-white" : "text-white/88")} />
    </Link>
  );
}

export function DesktopSidebar() {
  const pathname = usePathname();
  const visibleControls = desktopSecondaryNav;
  const railColumnCount = Math.max(3, visibleControls.length + 1);

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
    <aside className="hidden h-full min-h-0 w-[284px] flex-col border-r border-white/8 px-5 py-6 md:flex">
      <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-5">
        <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[rgb(var(--color-shell-muted))]">
          Command surface
        </p>
        <p className="mt-3 text-xl font-medium text-white">Protect attention. Pull depth only when needed.</p>
      </div>

      <nav className="mt-8 flex-1 space-y-2 overflow-y-auto pr-1">
        {desktopPrimaryNav.map((item) => (
          <SidebarLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname === item.href}
          />
        ))}
      </nav>

      <div className="mt-6 shrink-0 border-t border-white/8 pt-5">
        <div
          className="grid items-center px-4"
          style={{ gridTemplateColumns: `repeat(${railColumnCount}, minmax(0, 1fr))` }}
        >
          {visibleControls.map((item, index) => (
            item.isCapture ? (
              <CaptureShellControl
                key={item.href}
                href={hrefForItem(item.href, item.isCapture)}
                active={pathname === item.href}
                className="justify-self-center"
                style={{ gridColumn: `${index + 2} / span 1` }}
              />
            ) : (
              <ShellRailControl
                key={item.href}
                href={hrefForItem(item.href, item.isCapture)}
                icon={item.icon}
                label={item.label}
                active={pathname === item.href}
                style={{ gridColumn: `${index + 2} / span 1` }}
              />
            )
          ))}
        </div>
      </div>
    </aside>
  );
}
