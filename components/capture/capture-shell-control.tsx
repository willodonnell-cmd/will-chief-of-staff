"use client";

import type { Route } from "next";
import Link from "next/link";

import { CaptureMicrophoneIcon } from "@/components/icons/capture-microphone-icon";
import { cn } from "@/lib/utils";

type CaptureShellControlProps = {
  href: Route | { pathname: Route; query: { from: string } };
  active: boolean;
  mobile?: boolean;
};

export function CaptureShellControl({ href, active, mobile = false }: CaptureShellControlProps) {
  return (
    <Link
      href={href}
      aria-label="Capture"
      className={cn(
        "capture-control group relative inline-flex shrink-0 items-center justify-center text-[rgb(var(--color-shell-text))]",
        mobile ? "h-[3.71rem] w-[3.71rem] rounded-[1.48rem]" : "h-[3.43rem] w-[3.43rem] rounded-[1.4rem]",
        active && "capture-control-active"
      )}
    >
      <CaptureMicrophoneIcon
        className={cn(
          "transition duration-200 ease-out",
          mobile ? "h-[1.62rem] w-[1.62rem]" : "h-[1.43rem] w-[1.43rem]",
          active ? "text-white" : "text-white/88 group-hover:text-white"
        )}
      />
      <span className="sr-only">Capture</span>
    </Link>
  );
}
