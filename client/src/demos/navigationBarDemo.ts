/**
 * NavigationBar demo data — a fintech wallet scenario that exercises the
 * component's full breadth: per-tab contextual actions, in-place filter
 * expansion, and a right-side button that changes with the active tab.
 */
import type { ComponentType, SVGProps } from "react";
import type {
  ActionDef,
  FilterOption,
  TabDef,
} from "@/components/navigation-bar";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  CreditCard,
  Download,
  Filter,
  HandCoins,
  Home,
  ReceiptText,
  ScanLine,
  Search,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react";

export const navigationTabs: TabDef[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "spend", label: "Spend", Icon: CreditCard },
  { id: "trade", label: "Trade", Icon: TrendingUp },
  { id: "transactions", label: "Transactions", Icon: ReceiptText },
];

export const navigationActions: Record<string, ActionDef[]> = {
  home: [
    { Icon: ArrowDownToLine, label: "Deposit" },
    { Icon: ArrowUpFromLine, label: "Withdraw" },
  ],
  spend: [
    { Icon: Send, label: "Pay" },
    { Icon: HandCoins, label: "Request" },
  ],
  trade: [
    { Icon: ArrowDownLeft, label: "Buy" },
    { Icon: ArrowUpRight, label: "Sell" },
    { Icon: ArrowLeftRight, label: "Swap" },
  ],
  transactions: [{ Icon: Filter, label: "Filter" }],
};

export const navigationFilters: FilterOption[] = [
  { id: "pending", label: "Pending" },
  { id: "complete", label: "Complete" },
  { id: "scheduled", label: "Scheduled" },
];

/** The right-side button changes with the active tab. */
export const navigationRightButtons: Record<
  string,
  { Icon: ComponentType<SVGProps<SVGSVGElement>>; label: string }
> = {
  home: { Icon: Sparkles, label: "AI" },
  spend: { Icon: ScanLine, label: "Scan" },
  trade: { Icon: Search, label: "Search" },
  transactions: { Icon: Download, label: "Export" },
};
