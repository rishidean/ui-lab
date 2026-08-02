/**
 * Dstil NavigationBar demo contract: keep sample data separate from the uploaded
 * component so future demos can supply their own tabs, actions, and filters.
 */
import type {
  ActionDef,
  FilterOption,
  TabDef,
} from "@/components/navigation-bar";
import {
  Activity,
  CalendarDays,
  Filter,
  Home,
  MessageCircle,
  MoonStar,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";

export const navigationTabs: TabDef[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "activity", label: "Activity", Icon: Activity },
  { id: "settings", label: "Settings", Icon: Settings },
];

export const navigationActions: Record<string, ActionDef[]> = {
  home: [
    { Icon: Search, label: "Search" },
    { Icon: Filter, label: "Filter" },
  ],
  activity: [
    { Icon: RefreshCw, label: "Refresh" },
    { Icon: CalendarDays, label: "Filter" },
  ],
  settings: [
    { Icon: UserRound, label: "Profile" },
    { Icon: MoonStar, label: "Theme" },
  ],
};

export const navigationFilters: FilterOption[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "7 days" },
  { id: "month", label: "30 days" },
];

export const navigationRightButton = {
  Icon: Sparkles,
  label: "Ask Dstil",
};

export const navigationDemoIcons = {
  message: MessageCircle,
};
