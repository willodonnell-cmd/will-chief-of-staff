"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { PeopleSearchOverlay } from "@/components/people/people-search-overlay";

type PeopleSearchContextValue = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const PeopleSearchContext = createContext<PeopleSearchContextValue>({
  open: () => {},
  close: () => {},
  isOpen: false
});

export function usePeopleSearch() {
  return useContext(PeopleSearchContext);
}

export function PeopleSearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <PeopleSearchContext.Provider value={{ open, close, isOpen }}>
      {children}
      <PeopleSearchOverlay open={isOpen} onClose={close} />
    </PeopleSearchContext.Provider>
  );
}
