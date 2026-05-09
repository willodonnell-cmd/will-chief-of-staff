"use client";

import type { Route } from "next";
import type { CSSProperties } from "react";
import type { ComponentType } from "react";
import Image from "next/image";
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
      <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#1B2530] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: [
              "radial-gradient(ellipse 124% 108% at 50% 48%, rgba(150,160,171,0.26) 0%, rgba(118,129,141,0.16) 28%, rgba(77,88,100,0.08) 48%, rgba(27,37,48,0) 68%)",
              "radial-gradient(ellipse 138% 114% at 50% 48%, rgba(27,37,48,0) 34%, rgba(27,37,48,0.16) 56%, rgba(27,37,48,0.42) 76%, rgba(27,37,48,0.74) 100%)",
              "linear-gradient(180deg, rgba(34,43,53,0.88), rgba(24,32,41,0.94))"
            ].join(", ")
          }}
        />
        <div className="relative flex min-h-[7.4rem] items-center justify-center overflow-hidden px-2 py-3">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 inset-y-1"
            style={{
              background: [
                "radial-gradient(ellipse 112% 88% at 50% 54%, rgba(165,173,181,0.16) 0%, rgba(122,132,142,0.08) 26%, rgba(255,255,255,0) 48%)",
                "radial-gradient(ellipse 128% 98% at 50% 54%, rgba(27,37,48,0) 26%, rgba(27,37,48,0.14) 52%, rgba(27,37,48,0.4) 74%, rgba(27,37,48,0.82) 100%)"
              ].join(", ")
            }}
          />
          <Image
            src="/brand/stingray-side-profile.png"
            alt="Black 1967 Corvette Stingray convertible side profile."
            width={220}
            height={95}
            priority
            className="h-auto w-full max-w-[224px] object-contain"
            style={{
              WebkitMaskImage:
                "radial-gradient(ellipse 102% 88% at 50% 54%, rgba(0,0,0,1) 24%, rgba(0,0,0,0.985) 42%, rgba(0,0,0,0.9) 56%, rgba(0,0,0,0.62) 70%, rgba(0,0,0,0.22) 84%, transparent 96%)",
              maskImage:
                "radial-gradient(ellipse 102% 88% at 50% 54%, rgba(0,0,0,1) 24%, rgba(0,0,0,0.985) 42%, rgba(0,0,0,0.9) 56%, rgba(0,0,0,0.62) 70%, rgba(0,0,0,0.22) 84%, transparent 96%)"
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 118% 92% at 50% 54%, rgba(27,37,48,0) 18%, rgba(27,37,48,0.08) 40%, rgba(27,37,48,0.22) 58%, rgba(27,37,48,0.48) 76%, rgba(27,37,48,0.88) 100%)"
            }}
          />
        </div>
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
