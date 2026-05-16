"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import {
  BOOTSTRAP_PEOPLE,
  type PersonIndex,
  addRecentlyViewed,
  getRecentlyViewed,
  mergePeopleSearchResults,
  searchPeople
} from "@/lib/people-search";
import { cn } from "@/lib/utils";

const CREATE_ROW_ID = "__create__";
/** Must stay in sync with `CREATE_NAME_MIN` in `lib/people-directory.ts`. */
const CREATE_NAME_MIN_LENGTH = 2;
/** Must stay in sync with `CREATE_ORG_MAX` in `lib/people-directory.ts`. */
const CREATE_ORG_MAX_LENGTH = 200;

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
  const [remotePeople, setRemotePeople] = useState<PersonIndex[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOrganization, setCreateOrganization] = useState("");

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setRecentlyViewed(getRecentlyViewed());
      setCreateError(null);
      setCreating(false);
      setCreateOrganization("");
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setCreateError(null);
    setCreateOrganization("");
  }, [query]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setRemotePeople([]);
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(() => {
      (async () => {
        try {
          const res = await fetch(`/api/people/search?q=${encodeURIComponent(q)}`);
          const json = (await res.json()) as { people?: PersonIndex[] };
          if (!cancelled) setRemotePeople(Array.isArray(json.people) ? json.people : []);
        } catch {
          if (!cancelled) setRemotePeople([]);
        }
      })();
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  const results = useMemo(() => {
    if (query.length === 0) return [];
    return mergePeopleSearchResults(searchPeople(query, BOOTSTRAP_PEOPLE), remotePeople);
  }, [query, remotePeople]);

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  const showCreateRow = useMemo(() => {
    if (trimmedQuery.length < CREATE_NAME_MIN_LENGTH) return false;
    return !results.some((p) => p.name.trim().toLowerCase() === trimmedQuery.toLowerCase());
  }, [trimmedQuery, results]);

  const searchRows = useMemo((): PersonIndex[] => {
    if (query.length === 0) return recentlyViewed;
    if (!showCreateRow) return results;
    return [
      ...results,
      {
        id: CREATE_ROW_ID,
        name: trimmedQuery,
        organization: "",
        currentReadSnippet: "Create new person in vault"
      }
    ];
  }, [query.length, results, showCreateRow, trimmedQuery, recentlyViewed]);

  const listForNav = useMemo(
    () => (query.length > 0 ? searchRows : recentlyViewed),
    [query.length, searchRows, recentlyViewed]
  );

  const isSearchMode = query.length > 0;
  const isRecentlyViewed = !isSearchMode;
  const isEmpty = isSearchMode && results.length === 0 && !showCreateRow;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(0, listForNav.length - 1)));
  }, [listForNav.length]);

  async function runCreate(name: string, organizationFromField?: string) {
    setCreateError(null);
    setCreating(true);
    const orgSource = organizationFromField ?? createOrganization;
    const orgPayload = orgSource.trim().slice(0, CREATE_ORG_MAX_LENGTH);
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: name,
          organization: orgPayload.length > 0 ? orgPayload : null
        })
      });
      const json = (await res.json()) as { ok?: boolean; person?: PersonIndex; error?: string };
      if (!res.ok || !json.ok || !json.person) {
        setCreateError(json.error ?? "Could not create person.");
        return;
      }
      addRecentlyViewed(json.person);
      onClose();
      router.push(`/people/${json.person.id}`);
      router.refresh();
    } catch {
      setCreateError("Network error.");
    } finally {
      setCreating(false);
    }
  }

  function navigate(person: PersonIndex) {
    if (person.id === CREATE_ROW_ID) {
      void runCreate(person.name);
      return;
    }
    addRecentlyViewed(person);
    onClose();
    router.push(`/people/${person.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "Tab") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, Math.max(0, listForNav.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const person = listForNav[selectedIndex];
      if (person) navigate(person);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  const showCreateOrgField = isSearchMode && showCreateRow;

  function handleCreateOrgKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (!creating && showCreateRow && trimmedQuery.length >= CREATE_NAME_MIN_LENGTH) {
        void runCreate(trimmedQuery, e.currentTarget.value);
      }
    }
  }

  const hasPanelBelow = isSearchMode
    ? listForNav.length > 0 || isEmpty || showCreateOrgField
    : listForNav.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center"
      style={{ paddingTop: "20vh", backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="hidden md:block"
        style={{ animation: "searchFadeIn 120ms ease forwards" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative flex items-center bg-white"
          style={{
            width: 560,
            height: 52,
            border: "1px solid rgba(0,0,0,0.15)",
            borderRadius: hasPanelBelow ? "10px 10px 0 0" : 10
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
            placeholder="Search people…"
            disabled={creating}
            className="h-full w-full bg-transparent text-text outline-none disabled:opacity-50"
            style={{
              paddingLeft: 44,
              paddingRight: 16,
              fontSize: 18,
              fontWeight: 400
            }}
          />
        </div>

        {showCreateOrgField ? (
          <div
            className="bg-white px-4 py-2.5"
            style={{ width: 560, border: "1px solid rgba(0,0,0,0.15)", borderTop: "none" }}
            onClick={(e) => e.stopPropagation()}
          >
            <label
              htmlFor="people-search-create-org-desktop"
              className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-[#a8a5a0]"
            >
              Company (optional)
            </label>
            <input
              id="people-search-create-org-desktop"
              type="text"
              value={createOrganization}
              onChange={(e) =>
                setCreateOrganization(e.target.value.slice(0, CREATE_ORG_MAX_LENGTH))
              }
              onKeyDown={handleCreateOrgKeyDown}
              placeholder="e.g. Prologis"
              disabled={creating}
              className="mt-1.5 w-full rounded-md border border-line/80 bg-white px-2.5 py-2 text-[15px] text-text outline-none ring-0 placeholder:text-text-muted/70 focus:border-text/25 disabled:opacity-50"
            />
          </div>
        ) : null}

        {createError ? (
          <div
            className="border-x border-b border-red-200 bg-red-50 px-4 py-2 text-center text-[13px] text-red-800"
            style={{ width: 560, borderTop: showCreateOrgField ? "none" : undefined }}
          >
            {createError}
          </div>
        ) : null}

        {hasPanelBelow && listForNav.length > 0 && (
          <div
            className="overflow-hidden bg-white"
            style={{
              width: 560,
              border: "1px solid rgba(0,0,0,0.15)",
              borderTop: createError || showCreateOrgField ? "none" : "none",
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
            {isSearchMode && listForNav.length > 0 && (
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
                {showCreateRow ? "Matches & new person" : "Matches"}
              </div>
            )}
            {listForNav.map((person, i) =>
              person.id === CREATE_ROW_ID ? (
                <CreatePersonRow
                  key={CREATE_ROW_ID}
                  name={person.name}
                  organizationDraft={createOrganization.trim()}
                  selected={i === selectedIndex}
                  disabled={creating}
                  onSelect={() => navigate(person)}
                  onHover={() => setSelectedIndex(i)}
                />
              ) : (
                <ResultRow
                  key={person.id}
                  person={person}
                  selected={i === selectedIndex}
                  onSelect={() => navigate(person)}
                  onHover={() => setSelectedIndex(i)}
                />
              )
            )}
          </div>
        )}

        {isEmpty && (
          <div
            className="flex flex-col items-center justify-center bg-white text-center text-text-muted"
            style={{
              width: 560,
              minHeight: 72,
              padding: "12px 16px",
              border: "1px solid rgba(0,0,0,0.15)",
              borderTop: showCreateOrgField || createError ? "none" : "none",
              borderRadius: "0 0 10px 10px",
              fontSize: 13
            }}
          >
            <span>&ldquo;{query}&rdquo; not found</span>
            <span className="mt-1">
              Type at least {CREATE_NAME_MIN_LENGTH} letters to add someone new to the vault.
            </span>
          </div>
        )}
      </div>

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
        <div
          className="relative flex shrink-0 items-center"
          style={{
            height: 52,
            borderBottom: "1px solid rgba(0,0,0,0.1)",
            margin: "12px 16px 0"
          }}
        >
          <Search className="absolute left-0 text-text-muted" style={{ width: 16, height: 16 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search people…"
            disabled={creating}
            className="h-full w-full bg-transparent text-text outline-none disabled:opacity-50"
            style={{ paddingLeft: 28, fontSize: 16 }}
            autoFocus
          />
        </div>

        {showCreateOrgField ? (
          <div className="mx-4 mt-1" onClick={(e) => e.stopPropagation()}>
            <label
              htmlFor="people-search-create-org-mobile"
              className="block text-[11px] font-semibold uppercase tracking-[0.07em] text-[#a8a5a0]"
            >
              Company (optional)
            </label>
            <input
              id="people-search-create-org-mobile"
              type="text"
              value={createOrganization}
              onChange={(e) =>
                setCreateOrganization(e.target.value.slice(0, CREATE_ORG_MAX_LENGTH))
              }
              onKeyDown={handleCreateOrgKeyDown}
              placeholder="e.g. Prologis"
              disabled={creating}
              className="mt-1.5 w-full rounded-md border border-line/80 bg-white px-2.5 py-2 text-[15px] text-text outline-none placeholder:text-text-muted/70 focus:border-text/25 disabled:opacity-50"
            />
          </div>
        ) : null}

        {createError ? (
          <div className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-center text-[13px] text-red-800">
            {createError}
          </div>
        ) : null}

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
          {isSearchMode && listForNav.length > 0 && (
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
              {showCreateRow ? "Matches & new person" : "Matches"}
            </div>
          )}
          {listForNav.map((person, i) =>
            person.id === CREATE_ROW_ID ? (
              <CreatePersonRow
                key={CREATE_ROW_ID}
                name={person.name}
                organizationDraft={createOrganization.trim()}
                selected={i === selectedIndex}
                disabled={creating}
                onSelect={() => navigate(person)}
                onHover={() => setSelectedIndex(i)}
              />
            ) : (
              <ResultRow
                key={person.id}
                person={person}
                selected={i === selectedIndex}
                onSelect={() => navigate(person)}
                onHover={() => setSelectedIndex(i)}
              />
            )
          )}
          {isEmpty && (
            <div
              className="flex flex-col items-center justify-center px-4 py-6 text-center text-text-muted"
              style={{ fontSize: 13 }}
            >
              <span>&ldquo;{query}&rdquo; not found</span>
              <span className="mt-1">
                Type at least {CREATE_NAME_MIN_LENGTH} letters to add someone new to the vault.
              </span>
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

function CreatePersonRow({
  name,
  organizationDraft,
  selected,
  disabled,
  onSelect,
  onHover
}: {
  name: string;
  organizationDraft: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const hasOrg = organizationDraft.length > 0;
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex w-full flex-col justify-center text-left transition-colors",
        selected ? "bg-[#f0ede8]" : "bg-transparent hover:bg-[#f0ede8]",
        disabled && "cursor-wait opacity-60"
      )}
      style={{
        minHeight: 56,
        padding: "12px 16px",
        borderLeft: selected ? "2px solid #1a1a1f" : "2px solid transparent",
        borderTop: "0.5px solid rgba(0,0,0,0.08)"
      }}
      onMouseEnter={onHover}
      onClick={onSelect}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[15px] font-medium text-text">
          Add &ldquo;{name}&rdquo; to vault
        </span>
        {hasOrg ? (
          <span className="shrink-0 truncate text-[13px] text-text-muted">{organizationDraft}</span>
        ) : null}
      </div>
      <div className="mt-0.5 text-[13px] text-text-muted">
        {disabled
          ? "Creating…"
          : hasOrg
            ? "Company will be saved on this new record."
            : "Creates a new person record you can open and edit."}
      </div>
    </button>
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
