"use client";

import { Copy, Download } from "lucide-react";
import { useMemo, useState } from "react";

import {
  buildPriorityInboxDigestDocument,
  priorityInboxDigestFilename,
  selectPriorityInboxDigestItems
} from "@/lib/priority-inbox-digest";
import type { PriorityInboxItem, PriorityInboxSourceFilter } from "@/lib/priority-inbox";

type Props = {
  items: PriorityInboxItem[];
  sourceFilter: PriorityInboxSourceFilter;
  now: number;
};

export function PriorityInboxDigestBar({ items, sourceFilter, now }: Props) {
  const [copied, setCopied] = useState(false);
  const digestSourceItems = useMemo(
    () => selectPriorityInboxDigestItems(items, sourceFilter, now),
    [items, sourceFilter, now]
  );

  const doc = useMemo(
    () => buildPriorityInboxDigestDocument(digestSourceItems, now),
    [digestSourceItems, now]
  );

  const disabled = digestSourceItems.length === 0;

  async function handleCopy() {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(doc);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert("Could not copy to clipboard.");
    }
  }

  function handleDownload() {
    if (disabled) return;
    const blob = new Blob([doc], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = priorityInboxDigestFilename(now);
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <button
        type="button"
        disabled={disabled}
        title={
          disabled ? "Nothing in the active export layer for this filter." : "Copy digest for ChatGPT"
        }
        onClick={() => void handleCopy()}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-line/70 bg-[rgba(255,255,255,0.62)] px-3.5 py-2 text-sm text-text-muted transition hover:bg-white hover:text-text disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Copy className="size-4 shrink-0 opacity-80" strokeWidth={1.75} aria-hidden />
        {copied ? "Copied" : "Copy digest for ChatGPT"}
      </button>
      <button
        type="button"
        disabled={disabled}
        title={disabled ? "Nothing to download." : "Download .md file"}
        onClick={handleDownload}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-line/70 bg-[rgba(255,255,255,0.62)] px-3.5 py-2 text-sm text-text-muted transition hover:bg-white hover:text-text disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Download className="size-4 shrink-0 opacity-80" strokeWidth={1.75} aria-hidden />
        Download .md
      </button>
      <p className="text-xs leading-5 text-text-muted sm:ml-1">
        Active layer: High Priority, Needs Review, and deferred items that are due back. Respects the
        Email/Teams filter.
      </p>
    </div>
  );
}
