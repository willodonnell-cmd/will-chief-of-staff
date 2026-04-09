export type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  priority: 1 | 2 | 3;
};

export const desktopNotificationItems: NotificationItem[] = [
  {
    id: "board-prep-window",
    title: "Board prep window tightened",
    detail: "The hiring brief needs a final decision before tomorrow's review pack locks.",
    timestamp: "12m ago",
    priority: 1
  },
  {
    id: "admin-recommendation",
    title: "New admin recommendation available",
    detail: "A communications drift adjustment is ready for review in Admin.",
    timestamp: "47m ago",
    priority: 2
  },
  {
    id: "relationship-context",
    title: "Protected relationship context updated",
    detail: "A recent people brief includes protected context worth keeping in mind.",
    timestamp: "1h ago",
    priority: 2
  },
  {
    id: "initiative-review",
    title: "Initiative review note added",
    detail: "Operating rhythm framing changed since the last strategic review.",
    timestamp: "3h ago",
    priority: 3
  },
  {
    id: "commitment-risk",
    title: "Commitment risk is rising quietly",
    detail: "An external dependency has slipped and may need a nudge soon.",
    timestamp: "Yesterday",
    priority: 3
  }
];
