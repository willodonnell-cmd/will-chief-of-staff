import type { Route } from "next";
import type { ComponentType } from "react";
import {
  BriefcaseBusiness,
  Inbox,
  SlidersHorizontal,
  Target,
  Users,
  Waypoints
} from "lucide-react";

import { CaptureMicrophoneIcon } from "@/components/icons/capture-microphone-icon";

export type NavItem = {
  label: string;
  href: Route;
  icon: ComponentType<{ className?: string }>;
  shortLabel?: string;
  isCapture?: boolean;
};

export const mobileNavItems: NavItem[] = [
  { label: "Today", href: "/", icon: Target },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Capture", href: "/capture", icon: CaptureMicrophoneIcon, isCapture: true },
  { label: "People", href: "/people", icon: Users },
  { label: "Initiatives", href: "/initiatives", icon: Waypoints, shortLabel: "Plans" }
];

export const mobileShellActions: NavItem[] = [
  { label: "Commitments", href: "/commitments", icon: BriefcaseBusiness },
  { label: "Admin", href: "/admin", icon: SlidersHorizontal }
];

export const desktopPrimaryNav: NavItem[] = [
  { label: "Today", href: "/", icon: Target },
  { label: "Priority Inbox", href: "/inbox", icon: Inbox },
  { label: "People", href: "/people", icon: Users },
  { label: "Initiatives", href: "/initiatives", icon: Waypoints },
  { label: "Commitments", href: "/commitments", icon: BriefcaseBusiness },
  { label: "Admin", href: "/admin", icon: SlidersHorizontal }
];

export const desktopSecondaryNav: NavItem[] = [
  { label: "Capture", href: "/capture", icon: CaptureMicrophoneIcon, isCapture: true }
];
