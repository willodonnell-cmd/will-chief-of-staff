"use client";

import { Globe, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { VaultExcerpt } from "@/lib/obsidian-search";
import type { Person } from "@/lib/person-vault";
import { isResearchPayloadEmpty, type ResearchPayload } from "@/lib/people-research-types";

type VaultTab = "current_read" | "open_loops" | "interactions";
type ExtTab = "overview" | "news" | "writing" | "network" | "email" | "plaud" | "teams" | "notes";

function isoDateTag(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string) {
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) return iso;
  return x.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function normalizeResearch(d: ResearchPayload): ResearchPayload {
  return {
    current_role:
      d.current_role && typeof d.current_role === "object"
        ? { text: d.current_role.text ?? "", source: d.current_role.source ?? "" }
        : { text: "", source: "" },
    recent_news: Array.isArray(d.recent_news) ? d.recent_news : [],
    writing: Array.isArray(d.writing) ? d.writing : [],
    network: Array.isArray(d.network) ? d.network : [],
    suggested_read_update:
      typeof d.suggested_read_update === "string" && d.suggested_read_update.trim()
        ? d.suggested_read_update
        : null
  };
}

const labelClass = "text-[9px] font-semibold uppercase tracking-[0.07em] text-[#a8a5a0]";
const blockClass =
  "rounded-[6px] border-l-2 border-[rgba(0,0,0,0.15)] bg-[#f0ede8] px-[9px] py-[7px]";
const microLabel = "text-[8px] font-semibold uppercase tracking-[0.07em] text-[#a8a5a0]";
const bodySm = "text-[10px] leading-[1.4] text-[#1a1a1f]";

function TabButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active ? "bg-[#f0ede8] font-semibold text-[#1a1a1f]" : "bg-transparent text-[#6b6860]"
      }`}
    >
      {children}
    </button>
  );
}

type PersonDetailClientProps = {
  initialPerson: Person;
};

export function PersonDetailClient({ initialPerson }: PersonDetailClientProps) {
  const [person, setPerson] = useState<Person>(initialPerson);
  const personRef = useRef(person);
  personRef.current = person;
  const [researchOpen, setResearchOpen] = useState(false);
  const [researchEpoch, setResearchEpoch] = useState(0);
  const [vaultTab, setVaultTab] = useState<VaultTab>("current_read");
  const [extTab, setExtTab] = useState<ExtTab>("overview");
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState(false);
  const [researchData, setResearchData] = useState<ResearchPayload | null>(null);
  const [addedKeys, setAddedKeys] = useState<Record<string, true>>({});
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [suggestionAccepted, setSuggestionAccepted] = useState(false);

  const markAdded = useCallback((key: string) => {
    setAddedKeys((prev) => ({ ...prev, [key]: true }));
    window.setTimeout(() => {
      setAddedKeys((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 2000);
  }, []);

  const appendWebResearch = useCallback((line: string) => {
    const tag = `[source: web research, ${isoDateTag()}]`;
    setPerson((p) => ({
      ...p,
      recent_interactions: [
        { date: isoDateTag(), context: "Web research", what_changed: `${tag} ${line}` },
        ...p.recent_interactions
      ]
    }));
  }, []);

  useEffect(() => {
    if (!researchOpen) return;

    const snapshot = personRef.current;
    const ac = new AbortController();
    let cancelled = false;

    (async () => {
      setResearchLoading(true);
      setResearchError(false);
      setResearchData(null);
      setSuggestionDismissed(false);
      setSuggestionAccepted(false);

      try {
        const res = await fetch("/api/people/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: snapshot.name,
            organization: snapshot.organization,
            title: snapshot.title,
            current_read: snapshot.current_read
          }),
          signal: ac.signal
        });
        const json = (await res.json()) as { ok: boolean; data?: ResearchPayload };
        if (cancelled || ac.signal.aborted) return;
        if (!json.ok || !json.data) {
          setResearchError(true);
          return;
        }
        const normalized = normalizeResearch(json.data);
        setResearchData(normalized);
        setPerson((p) => ({ ...p, last_researched: new Date().toISOString() }));
      } catch {
        if (!cancelled && !ac.signal.aborted) setResearchError(true);
      } finally {
        if (!cancelled && !ac.signal.aborted) setResearchLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [researchOpen, researchEpoch]);

  const toggleResearch = () => {
    setResearchOpen((open) => {
      if (!open) setResearchEpoch((e) => e + 1);
      return !open;
    });
  };

  const closeResearch = () => setResearchOpen(false);

  const suggested = researchData?.suggested_read_update?.trim();
  const showSuggestion =
    Boolean(suggested) && !suggestionDismissed && !suggestionAccepted && !researchLoading;

  const isNeedsAssessmentMarker = person.current_read?.trim() === "[NEEDS ASSESSMENT]";
  const hasVaultCurrentRead = Boolean(person.current_read && !isNeedsAssessmentMarker);

  return (
    <div className="space-y-6 lg:space-y-8">
      <div>
        <Link
          href="/people"
          className="text-sm text-text-muted transition hover:text-text"
        >
          ← All people
        </Link>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="section-label">{person.organization}</p>
            <h2 className="page-title">{person.name}</h2>
            <p className="mt-3 max-w-[58rem] text-sm leading-6 text-text-muted md:text-[0.95rem]">
              {person.title}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5 sm:pt-1">
            <button
              type="button"
              onClick={toggleResearch}
              className="inline-flex items-center gap-1.5 rounded-[7px] border-[0.5px] border-[rgba(0,0,0,0.15)] bg-transparent px-2.5 py-1.5 text-[11px] font-medium text-[#1a1a1f] transition-opacity hover:opacity-80"
            >
              <Globe className="size-3.5 text-[#1a1a1f]" strokeWidth={1.75} aria-hidden />
              Research
            </button>
            {person.last_researched ? (
              <p className={labelClass}>Last researched: {formatDisplayDate(person.last_researched)}</p>
            ) : null}
          </div>
        </div>
      </div>

      {researchOpen ? (
        <div className="rounded-[10px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[#ffffff] p-[10px]">
          <div className="mb-2 flex items-center justify-end">
            <button
              type="button"
              onClick={closeResearch}
              className="inline-flex items-center justify-center rounded-md p-1 text-[#6b6860] transition hover:bg-[#f0ede8]"
              aria-label="Close research"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-[9px] md:grid-cols-2">
            {/* Left: vault */}
            <div className="flex min-h-0 flex-col rounded-[10px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[#ffffff] p-3">
              <p className={labelClass}>What you know</p>
              <p className="mt-0.5 text-[9px] italic text-[#a8a5a0]">From vault</p>
              <div className="mt-3 flex flex-wrap gap-1">
                <TabButton active={vaultTab === "current_read"} onClick={() => setVaultTab("current_read")}>
                  Current read
                </TabButton>
                <TabButton active={vaultTab === "open_loops"} onClick={() => setVaultTab("open_loops")}>
                  Open loops
                </TabButton>
                <TabButton
                  active={vaultTab === "interactions"}
                  onClick={() => setVaultTab("interactions")}
                >
                  Interactions
                </TabButton>
              </div>
              <div className="mt-3 min-h-[120px] flex-1">
                {vaultTab === "current_read" ? (
                  <div>
                    <p className={microLabel}>Current read</p>
                    {isNeedsAssessmentMarker ? (
                      <p className="mt-2 text-[11px] italic text-[#6b6860]">
                        No current read yet. Add one from the person&apos;s brief.
                      </p>
                    ) : hasVaultCurrentRead ? (
                      <div className={`${blockClass} mt-2`}>
                        <p className={bodySm}>{person.current_read}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] italic text-[#6b6860]">
                        No current read yet. Add one from the person&apos;s brief.
                      </p>
                    )}
                  </div>
                ) : null}
                {vaultTab === "open_loops" ? (
                  <div>
                    {person.open_loops.length === 0 ? (
                      <p className="text-center text-[11px] text-[#6b6860]">
                        No open loops with this person.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {person.open_loops.map((loop, i) => (
                          <div key={`${loop.direction}-${i}`} className={blockClass}>
                            <p className={microLabel}>
                              {loop.direction === "i_owe" ? "I owe" : "They owe"}
                            </p>
                            <p className={`${bodySm} mt-1`}>{loop.text}</p>
                            {loop.by_when ? (
                              <p className="mt-1 text-[9px] text-[#a8a5a0]">By {loop.by_when}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
                {vaultTab === "interactions" ? (
                  <div>
                    {person.recent_interactions.length === 0 ? (
                      <p className="text-center text-[11px] text-[#6b6860]">
                        No interactions logged yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {person.recent_interactions.map((row, i) => (
                          <div key={`${row.date}-${i}`} className={blockClass}>
                            <p className={bodySm}>
                              <span className="text-[#6b6860]">{row.date}</span>
                              {" · "}
                              <span>{row.context}</span>
                              {" · "}
                              {row.what_changed}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Right: external */}
            <div className="flex min-h-0 flex-col rounded-[10px] border-[0.5px] border-[rgba(0,0,0,0.08)] bg-[#ffffff] p-3">
              <p className={labelClass}>What&apos;s out there</p>
              <p className="mt-0.5 text-[9px] italic text-[#a8a5a0]">Web · Email · Plaud · Teams · Notes</p>
              <div className="mt-3 flex flex-wrap gap-1">
                <TabButton active={extTab === "overview"} onClick={() => setExtTab("overview")}>
                  Overview
                </TabButton>
                <TabButton active={extTab === "news"} onClick={() => setExtTab("news")}>
                  News
                </TabButton>
                <TabButton active={extTab === "writing"} onClick={() => setExtTab("writing")}>
                  Writing
                </TabButton>
                <TabButton active={extTab === "network"} onClick={() => setExtTab("network")}>
                  Network
                </TabButton>
                <TabButton active={extTab === "email"} onClick={() => setExtTab("email")}>
                  Email
                </TabButton>
                <TabButton active={extTab === "plaud"} onClick={() => setExtTab("plaud")}>
                  Plaud
                </TabButton>
                <TabButton active={extTab === "teams"} onClick={() => setExtTab("teams")}>
                  Teams
                </TabButton>
                <TabButton active={extTab === "notes"} onClick={() => setExtTab("notes")}>
                  Notes
                </TabButton>
              </div>
              <div className="mt-3 min-h-[120px] flex-1">
                {researchLoading ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8">
                    <div className="research-loader-spin box-border size-[18px] rounded-full border-[1.5px] border-solid border-transparent [border-top-color:#1a1a1f]" />
                    <p className="text-[11px] text-[#a8a5a0]">Searching...</p>
                  </div>
                ) : researchError ? (
                  <p className="text-center text-[11px] text-[#a8a5a0]">
                    Research unavailable right now. Try again.
                  </p>
                ) : researchData && isResearchPayloadEmpty(researchData) ? (
                  <p className="text-center text-[11px] text-[#a8a5a0]">
                    No public information found for {person.name} at {person.organization}.
                  </p>
                ) : researchData ? (
                  <>
                    {extTab === "overview" ? (
                      <div className="space-y-2">
                        <div className={blockClass}>
                          <p className={microLabel}>Current role</p>
                          <p className={`${bodySm} mt-1`}>{researchData.current_role.text || "—"}</p>
                          {researchData.current_role.source ? (
                            <p className="mt-1 text-[9px] text-[#a8a5a0]">{researchData.current_role.source}</p>
                          ) : null}
                          {researchData.current_role.text ? (
                            <VaultAddButton
                              showAdded={Boolean(addedKeys["role"])}
                              onAdd={() => {
                                appendWebResearch(
                                  `Current role: ${researchData.current_role.text}${researchData.current_role.source ? ` (${researchData.current_role.source})` : ""}`
                                );
                                markAdded("role");
                              }}
                            />
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {extTab === "news" ? (
                      <div className="space-y-2">
                        {researchData.recent_news.length === 0 ? (
                          <p className="text-center text-[11px] text-[#a8a5a0]">No news items.</p>
                        ) : (
                          researchData.recent_news.map((item, i) => (
                            <div key={`news-${i}`} className={blockClass}>
                              <p className={microLabel}>News</p>
                              <p className={`${bodySm} mt-1 font-medium`}>{item.headline}</p>
                              {item.text ? <p className={`${bodySm} mt-1`}>{item.text}</p> : null}
                              <p className="mt-1 text-[9px] text-[#a8a5a0]">
                                {[item.source, item.date].filter(Boolean).join(" · ")}
                              </p>
                              <VaultAddButton
                                showAdded={Boolean(addedKeys[`news-${i}`])}
                                onAdd={() => {
                                  appendWebResearch(
                                    `News: ${item.headline}. ${item.text}`.trim()
                                  );
                                  markAdded(`news-${i}`);
                                }}
                              />
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                    {extTab === "writing" ? (
                      <div className="space-y-2">
                        {researchData.writing.length === 0 ? (
                          <p className="text-center text-[11px] text-[#a8a5a0]">No writing listed.</p>
                        ) : (
                          researchData.writing.map((item, i) => (
                            <div key={`w-${i}`} className={blockClass}>
                              <p className={microLabel}>Writing</p>
                              <p className={`${bodySm} mt-1`}>{item.title}</p>
                              <p className="mt-1 text-[9px] text-[#a8a5a0]">
                                {[item.platform, item.date].filter(Boolean).join(" · ")}
                              </p>
                              <VaultAddButton
                                showAdded={Boolean(addedKeys[`w-${i}`])}
                                onAdd={() => {
                                  appendWebResearch(
                                    `Writing: ${item.title} (${[item.platform, item.date].filter(Boolean).join(", ")})`
                                  );
                                  markAdded(`w-${i}`);
                                }}
                              />
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                    {extTab === "network" ? (
                      <div className="space-y-2">
                        {researchData.network.length === 0 ? (
                          <p className="text-center text-[11px] text-[#a8a5a0]">No network items.</p>
                        ) : (
                          researchData.network.map((item, i) => (
                            <div key={`n-${i}`} className={blockClass}>
                              <p className={microLabel}>Connection</p>
                              <p className={`${bodySm} mt-1`}>{item.connection}</p>
                              <p className={`${bodySm} mt-1 text-[#6b6860]`}>{item.context}</p>
                              <VaultAddButton
                                showAdded={Boolean(addedKeys[`n-${i}`])}
                                onAdd={() => {
                                  appendWebResearch(`Network: ${item.connection}. ${item.context}`);
                                  markAdded(`n-${i}`);
                                }}
                              />
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {/* Vault source tabs — available once researchData is populated */}
                {researchData && (extTab === "email" || extTab === "plaud" || extTab === "teams" || extTab === "notes") ? (
                  <VaultSourceTab
                    source={extTab}
                    excerpts={researchData.vault_results?.[extTab] ?? []}
                    personName={person.name}
                    addedKeys={addedKeys}
                    onAdd={(key, text) => {
                      appendWebResearch(text);
                      markAdded(key);
                    }}
                    blockClass={blockClass}
                    microLabel={microLabel}
                    bodySm={bodySm}
                  />
                ) : null}
              </div>

              {showSuggestion && suggested ? (
                <div
                  className="mt-3 rounded-[6px] px-[9px] py-[7px]"
                  style={{ backgroundColor: "#fef3c7" }}
                >
                  <p className="text-[8px] font-semibold uppercase tracking-[0.07em] text-[#92400e]">
                    Suggested current read update
                  </p>
                  <p className={`${bodySm} mt-2`}>{suggested}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const tag = `[source: research update, ${isoDateTag()}]`;
                        setPerson((p) => ({
                          ...p,
                          current_read: suggested,
                          recent_interactions: [
                            {
                              date: isoDateTag(),
                              context: "Research update",
                              what_changed: `${tag} Current read updated from research suggestion.`
                            },
                            ...p.recent_interactions
                          ]
                        }));
                        setSuggestionAccepted(true);
                      }}
                      className="rounded-lg bg-[#1a1a1f] px-3 py-1.5 text-[11px] font-medium text-white"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuggestionDismissed(true)}
                      className="rounded-lg border-[0.5px] border-[rgba(0,0,0,0.12)] bg-transparent px-3 py-1.5 text-[11px] font-medium text-[#6b6860]"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <section className="refined-b rounded-[1.9rem] p-5 md:p-7">
        <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">1. Current read</p>
        {!person.current_read ? (
          <>
            <h2 className="brief-title mt-2">No relationship brief is available yet.</h2>
            <p className="brief-body mt-3">
              This person was added from the bootstrap index. Seed a relationship brief in Supabase
              to populate this view with current read, quiet state, and protected context.
            </p>
          </>
        ) : isNeedsAssessmentMarker ? (
          <p className="brief-body mt-3 text-text-muted italic">
            No current read yet. Add one from the person&apos;s brief.
          </p>
        ) : (
          <>
            <h2 className="brief-title mt-2">Current read</h2>
            <p className="brief-body mt-3">{person.current_read}</p>
          </>
        )}
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">2. Next interaction</p>
        <p className="mt-3 text-sm text-text-muted">
          No next interaction needs foreground placement.
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">3. Open loops / commitments</p>
        <div className="mt-5 space-y-3">
          {person.open_loops.length === 0 ? (
            <p className="text-sm text-text-muted">No open loops.</p>
          ) : (
            person.open_loops.map((loop, i) => (
              <article
                key={`${loop.direction}-${i}`}
                className="rounded-[1.4rem] border border-line/70 bg-[rgba(255,255,255,0.64)] px-4 py-4"
              >
                <p className="text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle">
                  {loop.direction === "i_owe" ? "I owe" : "They owe"}
                </p>
                <p className="mt-2 text-sm font-medium text-text">{loop.text}</p>
                {loop.by_when ? (
                  <p className="mt-2 text-sm leading-6 text-text-muted">By {loop.by_when}</p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">4. Recent interactions</p>
        <div className="mt-5 space-y-3">
          {person.recent_interactions.length === 0 ? (
            <p className="text-sm text-text-muted">No recent interactions.</p>
          ) : (
            person.recent_interactions.map((row, i) => (
              <article
                key={`${row.date}-${i}`}
                className="rounded-[1.4rem] border border-line/70 bg-[rgba(255,255,255,0.64)] px-4 py-4"
              >
                <p className="text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle">{row.date}</p>
                <p className="mt-2 text-sm font-medium text-text">{row.context}</p>
                <p className="mt-2 text-sm leading-6 text-text-muted">{row.what_changed}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function VaultAddButton({ onAdd, showAdded }: { onAdd: () => void; showAdded: boolean }) {
  return (
    <div className="mt-2">
      {showAdded ? (
        <span className="text-[11px] text-[#a8a5a0]">Added</span>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="rounded-md border-[0.5px] border-[rgba(0,0,0,0.15)] bg-white px-2.5 py-1 text-[10px] font-medium text-[#1a1a1f] transition hover:opacity-90"
        >
          Add to vault
        </button>
      )}
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  email: "Email",
  plaud: "Plaud transcript",
  teams: "Teams",
  notes: "Vault note"
};

function VaultSourceTab({
  source,
  excerpts,
  personName,
  addedKeys,
  onAdd,
  blockClass,
  microLabel,
  bodySm
}: {
  source: string;
  excerpts: VaultExcerpt[];
  personName: string;
  addedKeys: Record<string, true>;
  onAdd: (key: string, text: string) => void;
  blockClass: string;
  microLabel: string;
  bodySm: string;
}) {
  if (excerpts.length === 0) {
    return (
      <p className="text-center text-[11px] text-[#a8a5a0]">
        No {SOURCE_LABELS[source] ?? source} mentions found for {personName}.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {excerpts.map((item, i) => {
        const key = `${source}-${i}`;
        const label = item.file.split("/").pop() ?? item.file;
        return (
          <div key={key} className={blockClass}>
            <p className={microLabel}>{label}</p>
            <p className={`${bodySm} mt-1 whitespace-pre-wrap`}>{item.excerpt}</p>
            <VaultAddButton
              showAdded={Boolean(addedKeys[key])}
              onAdd={() =>
                onAdd(
                  key,
                  `${SOURCE_LABELS[source] ?? source} (${label}): ${item.excerpt.slice(0, 300)}`
                )
              }
            />
          </div>
        );
      })}
    </div>
  );
}
