import type { ReactNode } from "react";

import { AppHeader } from "@/components/app-header";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { PeopleSearchProvider } from "@/components/people/people-search-provider";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="h-[100dvh] overflow-hidden bg-transparent px-3 py-3 text-text sm:px-4 md:px-6 md:py-6">
      <div className="mx-auto flex h-full max-w-[1600px] overflow-hidden rounded-[2rem] border border-white/10 shell-panel text-[rgb(var(--color-shell-text))] shadow-2xl shadow-black/30">
        <DesktopSidebar />
        <PeopleSearchProvider>
          <div className="flex min-h-0 flex-1 flex-col">
            <AppHeader />
            <main className="min-h-0 flex-1 overflow-y-auto p-3 pb-24 md:p-4 md:pb-4 lg:p-6">
              <div className="content-plane min-h-full rounded-[1.75rem] p-4 text-text md:p-6 lg:p-8">
                {children}
              </div>
            </main>
          </div>
        </PeopleSearchProvider>
      </div>
      <MobileBottomNav />
    </div>
  );
}
