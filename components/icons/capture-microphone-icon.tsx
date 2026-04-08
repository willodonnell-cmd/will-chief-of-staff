import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type CaptureMicrophoneIconProps = ComponentPropsWithoutRef<"svg">;

export function CaptureMicrophoneIcon({ className, ...props }: CaptureMicrophoneIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className)}
      aria-hidden="true"
      {...props}
    >
      <rect x="7.75" y="2.75" width="8.5" height="11.25" rx="4.25" />
      <path d="M6 10.25c0 4.1 2.7 6.85 6 6.85s6-2.75 6-6.85" />
      <path d="M12 17.1v3.15" />
      <path d="M8.6 21.05h6.8" />
      <path d="M9.4 5.45h5.2" opacity="0.5" />
      <path d="M9.4 7.85h5.2" opacity="0.5" />
      <path d="M9.4 10.25h5.2" opacity="0.5" />
      <path d="M10.15 20.25h3.7" opacity="0.72" />
    </svg>
  );
}
