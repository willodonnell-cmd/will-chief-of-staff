import { resolveCurrentAppUser } from "@/lib/supabase/current-user";

type InboxThreadRecord = {
  section: "needs_attention" | "possible_misses" | "priority_threads";
  sender: string;
  subject: string;
  preview: string;
  received_label: string;
  action_label: string;
  elevated: boolean;
  protected_thread: boolean;
};

type InboxItem = {
  sender: string;
  subject: string;
  preview: string;
  received: string;
  action?: string;
  elevated?: boolean;
  protectedThread?: boolean;
};

export type InboxPageData = {
  needsAttention: InboxItem[];
  possibleMisses: InboxItem[];
  priorityThreads: InboxItem[];
};

function mapInboxItem(item: InboxThreadRecord): InboxItem {
  return {
    sender: item.sender,
    subject: item.subject,
    preview: item.preview,
    received: item.received_label,
    action: item.action_label,
    elevated: item.elevated,
    protectedThread: item.protected_thread
  };
}

export async function getInboxPageData(): Promise<InboxPageData | null> {
  const resolved = await resolveCurrentAppUser();
  if (!resolved) {
    return null;
  }

  const { client, user } = resolved;

  const { data: threads, error } = await client
    .from("inbox_threads")
    .select("section, sender, subject, preview, received_label, action_label, elevated, protected_thread")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .returns<InboxThreadRecord[]>();

  if (error || !threads) {
    return null;
  }

  const bySection = (section: InboxThreadRecord["section"]) =>
    threads.filter((thread) => thread.section === section).map(mapInboxItem);

  return {
    needsAttention: bySection("needs_attention"),
    possibleMisses: bySection("possible_misses"),
    priorityThreads: bySection("priority_threads")
  };
}
