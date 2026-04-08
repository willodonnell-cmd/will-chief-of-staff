import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  CirclePlus,
  Inbox,
  Target,
  Users,
  Waypoints
} from "lucide-react";

export type NavItem = {
  label: string;
  href: Route;
  icon: LucideIcon;
  shortLabel?: string;
  isCapture?: boolean;
};

export const mobileNavItems: NavItem[] = [
  { label: "Today", href: "/", icon: Target },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Capture", href: "/capture", icon: CirclePlus, isCapture: true },
  { label: "People", href: "/people", icon: Users },
  { label: "Initiatives", href: "/initiatives", icon: Waypoints, shortLabel: "Plans" }
];

export const desktopPrimaryNav: NavItem[] = [
  { label: "Today", href: "/", icon: Target },
  { label: "Priority Inbox", href: "/inbox", icon: Inbox },
  { label: "People", href: "/people", icon: Users },
  { label: "Initiatives", href: "/initiatives", icon: Waypoints },
  { label: "Commitments", href: "/commitments", icon: BriefcaseBusiness }
];

export const desktopSecondaryNav: NavItem[] = [
  { label: "Capture", href: "/capture", icon: CirclePlus, isCapture: true }
];
