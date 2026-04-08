import type { ReactNode } from "react";

import { AppHeader } from "@/components/app-header";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-transparent px-3 pb-28 pt-3 text-text sm:px-4 md:px-6 md:pb-6 md:pt-6">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1600px] overflow-hidden rounded-[2rem] border border-white/10 shell-panel text-[rgb(var(--color-shell-text))] shadow-2xl shadow-black/30">
        <DesktopSidebar />
        <div className="flex min-h-[calc(100vh-1.5rem)] flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 p-3 md:p-4 lg:p-6">
            <div className="content-plane min-h-full rounded-[1.75rem] border border-white/55 p-4 text-text shadow-focus md:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}

