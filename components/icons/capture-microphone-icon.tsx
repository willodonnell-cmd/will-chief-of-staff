import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type CaptureMicrophoneIconProps = ComponentPropsWithoutRef<"svg">;

export function CaptureMicrophoneIcon({ className, ...props }: CaptureMicrophoneIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className)}
      aria-hidden="true"
      {...props}
    >
      <rect x="8" y="3" width="8" height="11" rx="4" />
      <path d="M5.5 10.5c0 3.9 2.9 6.5 6.5 6.5s6.5-2.6 6.5-6.5" />
      <path d="M12 17v4" />
      <path d="M8.5 21h7" />
      <path d="M9 6.5h6" opacity="0.45" />
    </svg>
  );
}

