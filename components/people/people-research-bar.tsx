"use client";

import { useRef, useState } from "react";

import type { ResearchPayload, VaultSource } from "@/lib/people-research-types";

type ResultState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; name: string; data: ResearchPayload };

const VAULT_TABS: { key: VaultSource; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "notes", label: "Notes" },
  { key: "plaud", label: "Transcripts" },
  { key: "teams", label: "Teams" },
];

export function PeopleResearchBar() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ResultState>({ status: "idle" });
  const [activeTab, setActiveTab] = useState<VaultSource>("email");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = query.trim();
    if (!name) return;

    setResult({ status: "loading" });

    try {
      const res = await fetch("/api/people/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, organization: "", title: "", current_read: null }),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (json.error === "missing_key" || json.error === "no_provider") {
          setResult({ status: "error", message: "Web research is not configured." });
        } else {
          setResult({ status: "error", message: "Search failed. Try again." });
        }
        return;
      }

      const json = (await res.json()) as { ok: boolean; data: ResearchPayload };
      setResult({ status: "ok", name, data: json.data });
      setActiveTab("email");
    } catch {
      setResult({ status: "error", message: "Network error. Try again." });
    }
  }

  function handleClear() {
    setQuery("");
    setResult({ status: "idle" });
    inputRef.current?.focus();
  }

  const hasResult = result.status === "ok";
  const data = hasResult ? result.data : null;

  // Count vault hits per tab
  function vaultCount(tab: VaultSource): number {
    return data?.vault_results?.[tab]?.length ?? 0;
  }

  const totalVaultHits = VAULT_TABS.reduce((n, t) => n + vaultCount(t.key), 0);
  const hasWebResult =
    hasResult &&
    (!!data?.current_role?.text || (data?.recent_news?.length ?? 0) > 0);

  return (
    <section>
      {/* Search field */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search vault, email, and web for a person…"
          className="flex-1 rounded-[0.9rem] border border-line/75 bg-white/80 px-4 py-2.5 text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-line"
        />
        <button
          type="submit"
          disabled={!query.trim() || result.status === "loading"}
          className="rounded-[0.9rem] border border-line/75 bg-white/80 px-4 py-2.5 text-[13px] font-medium text-text transition-colors hover:bg-[#f0ede8] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {result.status === "loading" ? "Searching…" : "Search"}
        </button>
        {(hasResult || result.status === "error") && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-[0.9rem] border border-line/75 bg-white/80 px-4 py-2.5 text-[13px] text-text-muted transition-colors hover:text-text"
          >
            Clear
          </button>
        )}
      </form>

      {/* Loading */}
      {result.status === "loading" && (
        <p className="mt-3 text-[13px] text-text-muted">Searching vault and web…</p>
      )}

      {/* Error */}
      {result.status === "error" && (
        <p className="mt-3 text-[13px] text-text-muted">{result.message}</p>
      )}

      {/* Results */}
      {hasResult && (
        <div className="mt-4 rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">
            {result.name}
          </p>

          {/* Web: current role */}
          {data?.current_role?.text && (
            <p className="mt-3 text-sm leading-6 text-text">{data.current_role.text}</p>
          )}

          {/* Web: recent news */}
          {(data?.recent_news?.length ?? 0) > 0 && (
            <div className="mt-4 space-y-2">
              <p
                className="text-text-muted"
                style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}
              >
                Recent
              </p>
              {data!.recent_news.slice(0, 3).map((item, i) => (
                <div key={i} className="rounded-[1rem] border border-line/60 bg-white/60 px-4 py-3">
                  <p className="text-[13px] font-medium text-text">{item.headline}</p>
                  {item.text && (
                    <p className="mt-1 text-[12px] leading-5 text-text-muted">{item.text}</p>
                  )}
                  {item.date && (
                    <p className="mt-1 text-[11px] text-text-muted opacity-70">{item.date}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!hasWebResult && (
            <p className="mt-3 text-[13px] text-text-muted">No web results available.</p>
          )}

          {/* Vault results */}
          {totalVaultHits > 0 && (
            <div className="mt-5 border-t border-line/55 pt-4">
              <p
                className="text-text-muted"
                style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}
              >
                Vault
              </p>

              {/* Tabs */}
              <div className="mt-2 flex gap-2">
                {VAULT_TABS.filter((t) => vaultCount(t.key) > 0).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                      activeTab === t.key
                        ? "border-line bg-white text-text"
                        : "border-line/50 bg-transparent text-text-muted hover:text-text"
                    }`}
                  >
                    {t.label}
                    <span className="ml-1 opacity-60">({vaultCount(t.key)})</span>
                  </button>
                ))}
              </div>

              {/* Excerpts */}
              <div className="mt-3 space-y-2">
                {(data?.vault_results?.[activeTab] ?? []).map((ex, i) => (
                  <div key={i} className="rounded-[1rem] border border-line/60 bg-white/60 px-4 py-3">
                    <p
                      className="truncate text-text-muted"
                      style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.04em" }}
                    >
                      {ex.file}
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-text">
                      {ex.excerpt}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalVaultHits === 0 && (
            <p className="mt-4 text-[13px] text-text-muted border-t border-line/55 pt-4">
              No vault matches found.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
