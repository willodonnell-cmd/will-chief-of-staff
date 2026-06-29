import type { ReactNode } from "react";

type WatchAppShellProps = {
  children: ReactNode;
};

export function WatchAppShell({ children }: WatchAppShellProps) {
  return (
    <div className="min-h-screen bg-[#f4efe8] px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1520px] rounded-[2rem] border border-black/10 bg-[rgba(255,253,248,0.9)] shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur">
        {children}
      </div>
    </div>
  );
}
