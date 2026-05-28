export const CHIEF_OF_STAFF_SIGNAL_SOURCES = ["outlook", "teams", "calendar"] as const;
export const CHIEF_OF_STAFF_SIGNAL_TYPES = ["decision", "follow_up", "meeting", "status"] as const;
export const CHIEF_OF_STAFF_SIGNAL_ATTENTION = ["high", "medium", "low"] as const;

export type ChiefOfStaffSignalSource = (typeof CHIEF_OF_STAFF_SIGNAL_SOURCES)[number];
export type ChiefOfStaffSignalType = (typeof CHIEF_OF_STAFF_SIGNAL_TYPES)[number];
export type ChiefOfStaffSignalAttention = (typeof CHIEF_OF_STAFF_SIGNAL_ATTENTION)[number];

export type ChiefOfStaffSignal = {
  id: string;
  source: ChiefOfStaffSignalSource;
  signalType: ChiefOfStaffSignalType;
  attention: ChiefOfStaffSignalAttention;
  title: string;
  summary: string;
  owner: string;
  sourceLabel: string;
  occurredAt: string;
  dueAt: string | null;
  sourceUrl: string | null;
  actionRequest: string | null;
  participants: string[];
  protectedContext: boolean;
};
