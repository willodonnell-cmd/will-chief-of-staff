import type { Route } from "next";
import type { ComponentType } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  CandlestickChart,
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
  external?: false;
};

export type ExternalNavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  external: true;
};

export type AnyNavItem = NavItem | ExternalNavItem;

export const mobileNavItems: NavItem[] = [
  { label: "Today", href: "/", icon: Target },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Capture", href: "/capture", icon: CaptureMicrophoneIcon, isCapture: true },
  { label: "People", href: "/people", icon: Users },
  { label: "Initiatives", href: "/initiatives", icon: Waypoints, shortLabel: "Plans" }
];

export const mobileShellActions: NavItem[] = [
  { label: "Commitments", href: "/commitments", icon: BriefcaseBusiness },
  { label: "Library", href: "/library", icon: BookOpen },
  { label: "Admin", href: "/admin", icon: SlidersHorizontal }
];

export const desktopPrimaryNav: AnyNavItem[] = [
  { label: "Today", href: "/", icon: Target },
  { label: "Priority Inbox", href: "/inbox", icon: Inbox },
  { label: "People", href: "/people", icon: Users },
  { label: "Dossier", href: "https://odossier.vercel.app", icon: CandlestickChart, external: true },
  { label: "Library", href: "/library", icon: BookOpen },
  { label: "Initiatives", href: "/initiatives", icon: Waypoints },
  { label: "Commitments", href: "/commitments", icon: BriefcaseBusiness },
  { label: "Admin", href: "/admin", icon: SlidersHorizontal }
];

export const desktopSecondaryNav: NavItem[] = [
  { label: "Capture", href: "/capture", icon: CaptureMicrophoneIcon, isCapture: true }
];

// Kept for backwards compat — Dossier is now inline in desktopPrimaryNav
export const desktopExternalLinks: ExternalNavItem[] = [];
