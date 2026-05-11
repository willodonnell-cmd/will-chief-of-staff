"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import {
  BOOTSTRAP_PEOPLE,
  type PersonIndex,
  addRecentlyViewed,
  getRecentlyViewed,
  searchPeople
} from "@/lib/people-search";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function PeopleSearchOverlay({ open, onClose }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentlyViewed, setRecentlyViewed] = useState<PersonIndex[]>([]);

  // Load recently viewed on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setRecentlyViewed(getRecentlyViewed());
      // Focus input after animation settles
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = query.length > 0 ? searchPeople(query, BOOTSTRAP_PEOPLE) : [];
  const displayList: PersonIndex[] = query.length > 0 ? results : recentlyViewed;
  const isRecentlyViewed = query.length === 0;
  const isEmpty = query.length > 0 && results.length === 0;

  function navigate(person: PersonIndex) {
    addRecentlyViewed(person);
    onClose();
    router.push(`/people/${person.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "Tab") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, displayList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const person = displayList[selectedIndex];
      if (person) navigate(person);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  const hasResults = displayList.length > 0;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex justify-center"
      style={{ paddingTop: "20vh", backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      {/* Panel — desktop centered modal */}
      <div
        className="hidden md:block"
        style={{ animation: "searchFadeIn 120ms ease forwards" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div
          className="relative flex items-center bg-white"
          style={{
            width: 560,
            height: 52,
            border: "1px solid rgba(0,0,0,0.15)",
            borderRadius: hasResults ? "10px 10px 0 0" : 10
          }}
        >
          <Search
            className="absolute left-4 text-text-muted"
            style={{ width: 16, height: 16, flexShrink: 0 }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search people..."
            className="h-full w-full bg-transparent text-text outline-none"
            style={{
              paddingLeft: 44,
              paddingRight: 16,
              fontSize: 18,
              fontWeight: 400
            }}
          />
        </div>

        {/* Results */}
        {hasResults && (
          <div
            className="overflow-hidden bg-white"
            style={{
              width: 560,
              border: "1px solid rgba(0,0,0,0.15)",
              borderTop: "none",
              borderRadius: "0 0 10px 10px",
              animation: "searchResultsFadeIn 80ms ease forwards",
              maxHeight: `${6 * 56}px`,
              overflowY: "auto"
            }}
          >
            {isRecentlyViewed && (
              <div
                className="text-text-muted"
                style={{
                  padding: "8px 16px 4px",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase"
                }}
              >
                Recently Viewed
              </div>
            )}
            {displayList.map((person, i) => (
              <ResultRow
                key={person.id}
                person={person}
                selected={i === selectedIndex}
                onSelect={() => navigate(person)}
                onHover={() => setSelectedIndex(i)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div
            className="flex flex-col items-center justify-center bg-white text-center text-text-muted"
            style={{
              width: 560,
              height: 72,
              border: "1px solid rgba(0,0,0,0.15)",
              borderTop: "none",
              borderRadius: "0 0 10px 10px",
              fontSize: 13
            }}
          >
            <span>&ldquo;{query}&rdquo; not found</span>
            <span className="mt-0.5">Check spelling or try a different name.</span>
          </div>
        )}
      </div>

      {/* Mobile: bottom sheet */}
      <div
        className="fixed inset-x-0 bottom-0 rounded-t-[1.5rem] bg-white md:hidden"
        style={{
          animation: "searchSlideUp 200ms ease forwards",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile input */}
        <div
          className="relative flex shrink-0 items-center"
          style={{
            height: 52,
            borderBottom: "1px solid rgba(0,0,0,0.1)",
            margin: "12px 16px 0"
          }}
        >
          <Search
            className="absolute left-0 text-text-muted"
            style={{ width: 16, height: 16 }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search people..."
            className="h-full w-full bg-transparent text-text outline-none"
            style={{ paddingLeft: 28, fontSize: 16 }}
            autoFocus
          />
        </div>

        {/* Mobile results */}
        <div className="flex-1 overflow-y-auto">
          {isRecentlyViewed && recentlyViewed.length > 0 && (
            <div
              className="text-text-muted"
              style={{
                padding: "10px 16px 4px",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase"
              }}
            >
              Recently Viewed
            </div>
          )}
          {displayList.map((person, i) => (
            <ResultRow
              key={person.id}
              person={person}
              selected={i === selectedIndex}
              onSelect={() => navigate(person)}
              onHover={() => setSelectedIndex(i)}
            />
          ))}
          {isEmpty && (
            <div
              className="flex flex-col items-center justify-center py-6 text-center text-text-muted"
              style={{ fontSize: 13 }}
            >
              <span>&ldquo;{query}&rdquo; not found</span>
              <span className="mt-0.5">Check spelling or try a different name.</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes searchFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes searchResultsFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes searchSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function ResultRow({
  person,
  selected,
  onSelect,
  onHover
}: {
  person: PersonIndex;
  selected: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const snippet = person.currentReadSnippet;
  const hasSnippet = snippet && snippet.trim().length > 0;

  return (
    <button
      type="button"
      className={cn(
        "flex w-full flex-col justify-center text-left transition-colors",
        selected ? "bg-[#f0ede8]" : "bg-transparent hover:bg-[#f0ede8]"
      )}
      style={{
        height: 56,
        padding: "12px 16px",
        borderLeft: selected ? "2px solid #1a1a1f" : "2px solid transparent",
        borderTop: "0.5px solid rgba(0,0,0,0.08)"
      }}
      onMouseEnter={onHover}
      onClick={onSelect}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[15px] font-medium text-text">{person.name}</span>
        <span className="shrink-0 text-[13px] text-text-muted">{person.organization}</span>
      </div>
      <div className="mt-0.5 truncate text-[13px] text-text-muted">
        {hasSnippet ? (
          <span className="text-[#6b6860]">{snippet}…</span>
        ) : (
          <span className="italic text-text-muted">No relationship brief yet</span>
        )}
      </div>
    </button>
  );
}
