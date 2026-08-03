/**
 * The Lab registry — one entry per invented component.
 * Adding a component: drop the source in client/src/components/<name>,
 * build a stage in client/src/stages, then register it here. Routes,
 * navigation, the landing page, and the code viewer all derive from this file.
 */
import type { ComponentType } from "react";
import NavigationBarStage from "@/stages/NavigationBarStage";
import PressAndSlidePickerStage from "@/stages/PressAndSlidePickerStage";
import navigationBarSource from "@/components/navigation-bar/NavigationBar.tsx?raw";
import pressAndSlidePickerSource from "@/components/press-and-slide-picker/PressAndSlidePicker.tsx?raw";

export const LAB_NAME = "Rishi's UI Lab";
export const LAB_TAGLINE =
  "Original interaction components, built for real products. Live demos on the left, source on the right — take what you like.";
export const GITHUB_URL = "https://github.com/rishidean/ui-lab";
export const AUTHOR_URL = "https://rishidean.com";

export type LabComponent = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  tags: string[];
  status: "stable" | "experimental";
  accent: string; // CSS gradient for the card artwork
  Stage: ComponentType;
  source: string;
  sourceFile: string;
  dependencies: string[];
  usage: string;
  tryIt: string[];
  aliases?: string[];
};

const navigationBarUsage = `import { NavigationBar } from "@/components/navigation-bar";
import {
  Home, CreditCard, TrendingUp, ReceiptText,          // tabs
  ArrowDownToLine, ArrowUpFromLine, Send, HandCoins,  // actions
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Filter,
  Sparkles, ScanLine, Search, Download,               // right buttons
} from "lucide-react";

const tabs = [
  { id: "home", label: "Home", Icon: Home },
  { id: "spend", label: "Spend", Icon: CreditCard },
  { id: "trade", label: "Trade", Icon: TrendingUp },
  { id: "transactions", label: "Transactions", Icon: ReceiptText },
];

// Each tab carries its own contextual actions in the center pill.
// Design rule: pill chips are text-only (showIcon: false) — icons belong
// to the circular left/right buttons. Icon still feeds accessibility.
const tabActions = {
  home: [
    { Icon: ArrowDownToLine, label: "Deposit", showIcon: false },
    { Icon: ArrowUpFromLine, label: "Withdraw", showIcon: false },
  ],
  spend: [
    { Icon: Send, label: "Pay", showIcon: false },
    { Icon: HandCoins, label: "Request", showIcon: false },
  ],
  trade: [
    { Icon: ArrowDownLeft, label: "Buy", showIcon: false },
    { Icon: ArrowUpRight, label: "Sell", showIcon: false },
    { Icon: ArrowLeftRight, label: "Swap", showIcon: false },
  ],
  // "Filter" is special-cased: it expands filterOptions in place
  // and the chip shows the currently selected option.
  transactions: [{ Icon: Filter, label: "Filter", showIcon: false }],
};

const filterOptions = [
  { id: "pending", label: "Pending" },
  { id: "complete", label: "Complete" },
  { id: "scheduled", label: "Scheduled" },
];

// rightButton is a single prop — swap it per tab for a contextual
// right-side control (AI on Home, Scan on Spend, Search on Trade, ...).
const rightButtons = {
  home: { Icon: Sparkles, label: "AI" },
  spend: { Icon: ScanLine, label: "Scan" },
  trade: { Icon: Search, label: "Search" },
  transactions: { Icon: Download, label: "Export" },
};

<NavigationBar
  tabs={tabs}
  tabActions={tabActions}
  filterOptions={filterOptions}
  rightButton={rightButtons[activeTab]}
  isCollapsed={isCollapsed}          // drive from your scroll direction
  activeTab={activeTab}
  activeFilter={activeFilter}
  activeAction={activeAction}        // engaged action gets the lavender pill;
                                     // resting actions are plain labels
  isSearchOpen={isSearchOpen}        // capsule morphs into a search field
  onSearchClose={() => setIsSearchOpen(false)}
  onSearchChange={setQuery}
  searchPlaceholder="Search markets…"
  onTabChange={setActiveTab}
  onFilterChange={setActiveFilter}
  onActionClick={(label, tab) => console.log(label, tab)}
  onRightButtonClick={() => console.log("right button")}
  onLogoClick={() => setIsCollapsed(false)}
/>

/*
 * Styling contract: the component reads CSS custom properties
 * (--iris-700, --gradient-aurora, --surface-overlay, shadows, radii, text
 * scale) plus three utility classes: .glass-nav, .glass-overlay, and
 * .nav-action-chip. Copy the token block from client/src/index.css in this
 * repo, or remap the variables to your own design system.
 */`;

const pressAndSlidePickerUsage = `import { PressAndSlidePicker } from "@/components/press-and-slide-picker";

const options = [
  { key: "todo",        label: "To Do",       color: "#3B82F6", bg: "#DBEAFE" },
  { key: "in-progress", label: "In Progress", color: "#F59E0B", bg: "#FEF3C7" },
  { key: "done",        label: "Done",        color: "#22C55E", bg: "#DCFCE7" },
  { key: "blocked",     label: "Blocked",     color: "#EF4444", bg: "#FEE2E2" },
];

const [status, setStatus] = useState("todo");

<PressAndSlidePicker
  options={options}
  value={status}
  onChange={setStatus}
  itemWidth={92}            // px per option zone in the strip
  longPressDuration={275}   // ms before the gesture activates
  // renderChip={(option, isActive) => <YourChip ... />}
/>

/*
 * Interaction model: long-press (touch or mouse) opens the strip; slide to an
 * option and release to commit. A plain click opens an accessible fallback
 * listbox with full keyboard support. Haptics fire on supported devices.
 * Styling reads --surface-overlay, --border-subtle, --shadow-lg, and the text
 * scale variables — scope them per-page to restyle (see the demo's CSS).
 */`;

export const labComponents: LabComponent[] = [
  {
    slug: "navigation-bar",
    name: "Navigation Bar",
    tagline:
      "A glass bottom bar where navigation, actions, and filters share one surface.",
    description:
      "A mobile-first bottom bar that collapses navigation into a single morphing cluster: a tab switcher that blooms into a menu, a center pill carrying per-tab contextual actions, an in-place filter expansion, and one aurora accent button. Scroll down and it folds to a logo; scroll up and it returns. Every transition is choreographed — nothing pops.",
    tags: ["navigation", "mobile", "motion", "glassmorphism"],
    status: "stable",
    accent: "linear-gradient(135deg, #c4b5fd 0%, #f0abfc 46%, #a5b4fc 100%)",
    Stage: NavigationBarStage,
    source: navigationBarSource,
    sourceFile: "NavigationBar.tsx",
    dependencies: [
      "react",
      "motion",
      "lucide-react",
      "clsx + tailwind-merge (cn)",
    ],
    usage: navigationBarUsage,
    tryIt: [
      "Scroll the canvas down to collapse the bar, up to expand it",
      "Tap the left circle to open the tab menu — Home, Spend, Trade, Transactions",
      "Switch tabs — actions and the right-side button change with the tab",
      "Tap Deposit — a workflow sheet rises and the lavender pill marks the engaged action",
      "Open the tab menu — background controls dim rather than disappear",
      "On Trade, tap Search — the bar itself morphs into a search field",
      "On Home, tap the sparkle — the assistant sheet is the standard pattern",
      "On Trade, three actions share the pill: Buy, Sell, Swap",
      "On Transactions, tap the filter chip to expand Pending / Complete / Scheduled in place",
    ],
    aliases: ["action-bar"],
  },
  {
    slug: "press-and-slide-picker",
    name: "Press & Slide Picker",
    tagline: "Facebook-Reactions-style selection: long-press, slide, release.",
    description:
      "A one-gesture picker for small option sets. Long-press the chip and a strip of options springs out; slide to the one you want and release to commit — with haptic ticks along the way. A plain click opens an accessible fallback listbox with full keyboard navigation, so the fast path never excludes anyone. Viewport-aware positioning keeps the strip on screen anywhere you mount it.",
    tags: ["gesture", "input", "touch", "a11y"],
    status: "stable",
    accent:
      "linear-gradient(135deg, #93c5fd 0%, #fcd34d 40%, #86efac 75%, #fca5a5 100%)",
    Stage: PressAndSlidePickerStage,
    source: pressAndSlidePickerSource,
    sourceFile: "PressAndSlidePicker.tsx",
    dependencies: ["react", "clsx + tailwind-merge (cn)"],
    usage: pressAndSlidePickerUsage,
    tryIt: [
      "Long-press the chip, keep holding, slide across the strip, release",
      "Plain-click the chip for the keyboard-friendly fallback picker",
      "Try it on a phone — haptics fire as you cross options",
      "Press Escape mid-gesture to bail out without committing",
    ],
    aliases: ["picker"],
  },
];

export function getComponent(slug: string): LabComponent | undefined {
  return labComponents.find(c => c.slug === slug || c.aliases?.includes(slug));
}
