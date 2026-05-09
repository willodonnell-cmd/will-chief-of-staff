import Link from "next/link";
import { notFound } from "next/navigation";

import { formatPriorityInboxTimestamp } from "@/lib/priority-inbox";
import { getForwardedPriorityInboxItemDetail } from "@/lib/priority-inbox-store";

type ForwardedInboxDetailPageProps = {
  params: Promise<{ id: string }>;
};

function detailValue(value: string | null | undefined, fallback = "Unavailable") {
  return value?.trim() || fallback;
}

export default async function ForwardedInboxDetailPage({ params }: ForwardedInboxDetailPageProps) {
  const { id } = await params;
  const result = await getForwardedPriorityInboxItemDetail(id);

  if (!result) {
    notFound();
  }

  const { item, detail } = result;
  const attachmentNames = detail.attachment_names ?? [];

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="rounded-[1.85rem] border border-line/75 bg-white/74 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.72rem] uppercase tracking-[0.24em] text-text-subtle">Forwarded email detail</p>
            <h1 className="page-title">{item.threadTitle}</h1>
            <p className="mt-3 text-sm leading-6 text-text-muted">
              This is the truthful fallback when a forwarded email does not have a recoverable native source link. Blackhawk keeps just enough forwarded structure to support triage without becoming a mailbox client.
            </p>
          </div>

          <Link href="/inbox" className="rounded-full border border-line/75 bg-white/78 px-4 py-2 text-sm font-medium text-text transition hover:bg-white">
            Back to inbox
          </Link>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
          <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Parsed summary</p>
          <div className="mt-5 space-y-4 text-sm text-text-muted">
            <div>
              <p className="font-medium text-text">Original sender</p>
              <p className="mt-1">{detailValue(detail.original_sender_name ?? detail.original_sender_email)}</p>
            </div>
            <div>
              <p className="font-medium text-text">Forwarded by</p>
              <p className="mt-1">{detailValue(detail.forwarded_by_name ?? detail.forwarded_by_email)}</p>
            </div>
            <div>
              <p className="font-medium text-text">Received timing</p>
              <p className="mt-1">
                {detail.original_received_at
                  ? formatPriorityInboxTimestamp(detail.original_received_at)
                  : detail.forwarded_at
                    ? `Forwarded ${formatPriorityInboxTimestamp(detail.forwarded_at)}`
                    : "Unavailable"}
              </p>
            </div>
            <div>
              <p className="font-medium text-text">Provider hint</p>
              <p className="mt-1">{detailValue(detail.provider_hint, "Unknown")}</p>
            </div>
            <div>
              <p className="font-medium text-text">Destination address</p>
              <p className="mt-1">{detail.destination_address}</p>
            </div>
            {detail.native_source_link ? (
              <div>
                <p className="font-medium text-text">Recovered native link</p>
                <a
                  href={detail.native_source_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex text-text transition hover:text-text-muted"
                >
                  Open native source
                </a>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-[1.75rem] border border-line/75 bg-white/68 p-5 md:p-6">
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Triage view</p>
            <p className="mt-4 text-[1.02rem] font-medium leading-6 text-text">{item.primaryLine}</p>
            <p className="mt-3 text-sm leading-6 text-text-muted">{item.summary}</p>
          </section>

          <section className="rounded-[1.75rem] border border-line/75 bg-white/68 p-5 md:p-6">
            <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Attachment cues</p>
            {attachmentNames.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {attachmentNames.map((attachment) => (
                  <span key={attachment} className="rounded-full border border-line/70 bg-white/70 px-2.5 py-1 text-[0.72rem] uppercase tracking-[0.16em] text-text-subtle">
                    {attachment}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-text-muted">No explicit attachment names were recovered from the forward.</p>
            )}
          </section>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/72 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Forwarded content</p>
        <div className="mt-5 rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.56)] p-4">
          <pre className="whitespace-pre-wrap text-sm leading-6 text-text-muted">{detail.detail_body || detail.raw_content}</pre>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line/75 bg-white/68 p-5 md:p-6">
        <p className="text-[0.72rem] uppercase tracking-[0.22em] text-text-subtle">Raw forwarded source</p>
        <div className="mt-5 rounded-[1.35rem] border border-line/70 bg-[rgba(255,255,255,0.56)] p-4">
          <pre className="whitespace-pre-wrap text-sm leading-6 text-text-muted">{detail.raw_content}</pre>
        </div>
      </section>
    </div>
  );
}
