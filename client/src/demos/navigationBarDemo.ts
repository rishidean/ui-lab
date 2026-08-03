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
  Coins,
  CreditCard,
  Download,
  Filter,
  HandCoins,
  Home,
  ReceiptText,
  Repeat,
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

// Center-pill actions are text-only by design (showIcon: false) — icons
// belong to the left/right circular buttons. The Icon still feeds a11y
// and any consumer that opts icons back on.
export const navigationActions: Record<string, ActionDef[]> = {
  home: [
    { Icon: ArrowDownToLine, label: "Deposit", showIcon: false },
    { Icon: ArrowUpFromLine, label: "Withdraw", showIcon: false },
  ],
  spend: [
    { Icon: Send, label: "Pay", showIcon: false },
    { Icon: HandCoins, label: "Request", showIcon: false },
  ],
  // Five actions on Trade deliberately overflow the pill on phones —
  // the row scrolls horizontally instead of squishing labels.
  trade: [
    { Icon: ArrowDownLeft, label: "Buy", showIcon: false },
    { Icon: ArrowUpRight, label: "Sell", showIcon: false },
    { Icon: ArrowLeftRight, label: "Swap", showIcon: false },
    { Icon: Coins, label: "Stake", showIcon: false },
    { Icon: Repeat, label: "Convert", showIcon: false },
  ],
  transactions: [{ Icon: Filter, label: "Filter", showIcon: false }],
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
