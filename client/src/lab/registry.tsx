/**
 * The Lab registry — one entry per invented component.
 * Adding a component: drop the source in client/src/components/<name>,
 * build a stage in client/src/stages, then register it here. Routes,
 * navigation, the landing page, and the code viewer all derive from this file.
 */
import type { ComponentType } from "react";
import NavigationBarStage from "@/stages/NavigationBarStage";
import PressAndSlidePickerStage from "@/stages/PressAndSlidePickerStage";
import BottomSheetStage from "@/stages/BottomSheetStage";
import UtilityModalStage from "@/stages/UtilityModalStage";
import navigationBarSource from "@/components/navigation-bar/NavigationBar.tsx?raw";
import pressAndSlidePickerSource from "@/components/press-and-slide-picker/PressAndSlidePicker.tsx?raw";
import bottomSheetSource from "@/components/bottom-sheet/BottomSheet.tsx?raw";
import utilityModalSource from "@/components/utility-modal/UtilityModal.tsx?raw";

export const LAB_NAME = "Rishi's UI Lab";
export const LAB_TAGLINE =
  "Original interaction components, built for real products. Live demos on the left, source on the right — take what you like.";
export const GITHUB_URL = "https://github.com/rishidean/ui-lab";
export const AUTHOR_URL = "https://rishidean.com";

export type PropRow = {
  name: string;
  type: string;
  def: string;
  note: string;
};

/** One narrated step of a component's presentation-mode walkthrough. */
export type PresentationBeat = {
  title: string;
  sub: string;
  /** Whether the option strip is out during this beat. */
  open: boolean;
  /** Committed option index shown on the trigger. */
  sel: number;
  /** Option index under the thumb (highlighted in the strip). */
  active: number;
};

/** Content for the showcase page (lab/Showcase.tsx). */
export type ShowcaseMeta = {
  /** Breadcrumb after the number, e.g. "interaction / gesture". */
  category: string;
  /** Hero one-liner under the headline. */
  lede: string;
  /** Short card blurb for the Home index grid. */
  blurb: string;
  problem: string;
  solution: string;
  propRows: PropRow[];
  /** Presentation-mode beats; omit to hide the presentation stage. */
  beats?: PresentationBeat[];
};

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
  showcase: ShowcaseMeta;
  aliases?: string[];
};

/** Sidebar/grid rows the lab intends to fill — built + still in the oven. */
export const PLANNED_COUNT = 9;

const navigationBarUsage = `import {
  NavigationBar,
  ACTION_SHEET_CLEAROUT_MS,   // clear-out windows for launching sheet
  UTILITY_CLEAROUT_MS,        // surfaces from the bar (see below)
} from "@/components/navigation-bar";
import {
  Home, CreditCard, TrendingUp, ReceiptText,          // Tabs
  ArrowDownToLine, ArrowUpFromLine, Send, HandCoins,  // ActionButtons
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Filter,
  Sparkles, ScanLine, Search, Download,               // UtilityActions
} from "lucide-react";

const tabs = [
  { id: "home", label: "Home", Icon: Home },
  { id: "spend", label: "Spend", Icon: CreditCard },
  { id: "trade", label: "Trade", Icon: TrendingUp },
  { id: "transactions", label: "Transactions", Icon: ReceiptText },
];

// Each Tab carries its own ActionButtons in the ContextualActionBar.
// Design rule: ActionButtons are text-only (showIcon: false) — icons
// belong to the circular buttons. Icon still feeds accessibility.
const contextualActions = {
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
  // isFilter marks the filter control: the chip shows the current
  // filterOptions value and expands the FilterOptionSet in place.
  transactions: [
    { Icon: Filter, label: "Filter", showIcon: false, isFilter: true },
  ],
};

const filterOptions = [
  { id: "pending", label: "Pending" },
  { id: "complete", label: "Complete" },
  { id: "scheduled", label: "Scheduled" },
];

// One UtilityAction per tab drives the UtilityButton (AI on Home,
// Scan on Spend, Search on Trade, Export on Transactions).
// opensDialog marks actions whose surface is a dialog (sheet/modal):
// it drives aria-haspopup="dialog" on the UtilityButton. AI and Search
// both morph the bar itself in place — not dialogs, so they stay
// unmarked; Scan (modal) and Export (sheet) get opensDialog: true.
const utilityActions = {
  home: { Icon: Sparkles, label: "AI" },
  spend: { Icon: ScanLine, label: "Scan", opensDialog: true },
  trade: { Icon: Search, label: "Search" },
  transactions: { Icon: Download, label: "Export", opensDialog: true },
};

<NavigationBar
  tabs={tabs}
  contextualActions={contextualActions}
  filterOptions={filterOptions}
  utilityAction={utilityActions[activeTab]}
  isCollapsed={isCollapsed}          // drive from your scroll direction
  activeTab={activeTab}
  activeFilter={activeFilter}
  activeAction={activeAction}        // engaged ActionButton gets the pill;
                                     // resting actions are plain labels
  isSearchOpen={isSearchOpen}        // bar morphs into a search field
  onSearchClose={() => setIsSearchOpen(false)}
  onSearchChange={setQuery}
  onSearchSubmit={runSearch}         // Enter commits, then the field closes
  searchPlaceholder="Search markets…"
  isAssistantOpen={isAssistantOpen}  // AI on Home: bar morphs into a chat
                                      // input (search grammar), then
                                      // stretches upward as messages land
  onAssistantClose={() => setIsAssistantOpen(false)}
  onAssistantSubmit={sendToAssistant} // appends the message + reply; you
                                       // own the transcript, so it persists
                                       // across close/reopen
  assistantMessages={assistantMessages}
  assistantPlaceholder="Ask anything…"
  utilityButtonRef={utilityButtonRef} // shared origin: measure its bounds
                                      // and grow utility surfaces out of it
  actionBarRef={actionBarRef}         // shared origin for workflow sheets
  isActionSheetOpen={sheetPrep}       // flip, wait ACTION_SHEET_CLEAROUT_MS,
                                      // then mount your sheet (BottomSheet
                                      // pairs perfectly here)
  isUtilitySheetOpen={utilPrep}       // flip, wait UTILITY_CLEAROUT_MS,
                                      // then mount the utility surface
  onTabChange={setActiveTab}
  onFilterChange={setActiveFilter}
  onActionClick={(label, tab) => console.log(label, tab)}
  onUtilityClick={() => console.log("utility pressed")}
  onCollapsedClick={() => setIsCollapsed(false)}
/>

/*
 * Styling contract: the component reads the token contract in
 * client/src/theme/theme.css (accent family, text scale, select pill,
 * glass classes, scrims — with Aurora light and Ink dark presets).
 * Copy theme.css alongside the component and edit a preset block, or
 * remap the variables to your own design system.
 */

/*
 * Keyboard contract: the tab menu is a role="menu" — ArrowUp/ArrowDown,
 * Home/End, Enter/Space, Escape. The filter is a role="radiogroup" —
 * arrow keys rove the roving tabindex, Enter/Space selects. The
 * UtilityButton sets aria-haspopup="dialog" whenever the active
 * UtilityAction has opensDialog: true. The menu and filter are plain
 * popovers, not focus traps: roving tabindex + Escape + focus return
 * to their origin control, no inert containment. The sheet and modal
 * surfaces (BottomSheet, UtilityModal) go further — they contain focus
 * via useInertOutside (@/lib/a11y), which makes everything outside them
 * inert while open, and likewise return focus to their origin control
 * on close. :focus-visible rings are styled throughout every surface;
 * mouse/touch interaction stays ring-free — including the search input,
 * whose ring is modality-gated (text inputs match :focus-visible on any
 * focus, so the bar tracks keyboard vs pointer and applies the ring
 * only to keyboard-driven focus).
 */

/*
 * Utility surfaces — the bar renders only the UtilityButton; WHICH
 * surface opens is your routing decision inside onUtilityClick:
 *
 *   AI     → set isAssistantOpen (bar-internal mode, like Search — no
 *            clear-out, no dialog. The bar morphs into a chat input,
 *            then stretches upward into a conversation card once you
 *            append messages via onAssistantSubmit).
 *   Search → set isSearchOpen (the bar itself morphs into the field).
 *   Sheets → flip isUtilitySheetOpen, wait UTILITY_CLEAROUT_MS, then
 *            mount a BottomSheet (@/components/bottom-sheet) from the
 *            UtilityButton's rect. Workflow sheets from ActionButtons
 *            use the same pattern: isActionSheetOpen +
 *            ACTION_SHEET_CLEAROUT_MS from the bar's rect (actionBarRef).
 *   Modals → same clear-out, then mount a UtilityModal
 *            (@/components/utility-modal) from the UtilityButton's
 *            CENTER point — a full-screen circle-reveal takeover.
 *
 * The demo stage (client/src/stages/NavigationBarStage.tsx) wires all
 * three; each companion component has its own page with API and usage.
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

const bottomSheetUsage = `import { useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { BottomSheet, type SheetOrigin } from "@/components/bottom-sheet";
import { focusWhenClear } from "@/lib/a11y";

const triggerRef = useRef<HTMLButtonElement | null>(null);
const [origin, setOrigin] = useState<SheetOrigin | null>(null);

<button
  ref={triggerRef}
  onClick={() => {
    const r = triggerRef.current!.getBoundingClientRect();
    setOrigin({ top: r.top, left: r.left, width: r.width,
                height: r.height, bottom: r.bottom });
  }}
>
  Open
</button>

{/* Mount inside your own AnimatePresence; unmount to close. The exit
    choreography contracts the sheet back into the trigger, and
    onExitComplete is your restore hook — use focusWhenClear, not a
    plain .focus(), since BottomSheet stays inert-covered a beat past
    onExitComplete (see focusWhenClear's docstring in @/lib/a11y). */}
<AnimatePresence onExitComplete={() => focusWhenClear(triggerRef.current)}>
  {origin && (
    <BottomSheet
      origin={origin}        // the control the sheet grows out of
      title="Details"
      ariaLabel="Details"
      height={0.6}           // fraction of viewport, px, or "auto"
      expandable             // header control + drag: initial ↔ full
      onClose={() => setOrigin(null)}
    >
      {/* body */}
    </BottomSheet>
  )}
</AnimatePresence>`;

const utilityModalUsage = `import { useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { UtilityModal, type ModalOrigin } from "@/components/utility-modal";
import { focusWhenClear } from "@/lib/a11y";

const buttonRef = useRef<HTMLButtonElement | null>(null);
const [origin, setOrigin] = useState<ModalOrigin | null>(null);

<button
  ref={buttonRef}
  onClick={() => {
    const r = buttonRef.current!.getBoundingClientRect();
    setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }}
>
  Scan
</button>

{/* Mount inside your own AnimatePresence; unmount to close. The exit
    choreography contracts the circle back to the origin point, and
    onExitComplete is your restore hook — use focusWhenClear, not a
    plain .focus(), since UtilityModal stays inert-covered a beat past
    onExitComplete (see focusWhenClear's docstring in @/lib/a11y). */}
<AnimatePresence onExitComplete={() => focusWhenClear(buttonRef.current)}>
  {origin && (
    <UtilityModal
      origin={origin}     // the modal expands as a circle from this point
      ariaLabel="Scanner"
      onClose={() => setOrigin(null)}
    >
      {/* your full-screen surface — give it its own close control;
          the scrim is covered once the circle lands */}
    </UtilityModal>
  )}
</AnimatePresence>

/*
 * The modal supplies scrim, circle clip, and a --surface-modal sheet
 * (theme/theme.css) under your content — children supply the surface
 * and may cover the sheet entirely. In the NavigationBar demo, Scan's
 * permission / denied / active states are exactly such children.
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
      "theme/theme.css (token contract)",
      "@/components/bottom-sheet (sheet surfaces)",
      "@/components/utility-modal (modal takeovers)",
      "@/lib/a11y (focusWhenClear — focus return past inert)",
    ],
    showcase: {
      category: "navigation / motion",
      blurb: "A scroll-aware bar that collapses to the essentials.",
      lede: "Four bars' worth of controls. One surface that morphs instead of stacking.",
      problem:
        "Mobile apps stack a tab bar, an action row, a filter strip, and a search field — four layers of chrome before any content. Every new capability lands as another bar.",
      solution:
        "One glass pill owns the bottom edge. Tabs bloom into a menu, actions ride the center, filters expand in place, and search morphs the bar itself. Every surface grows out of the control that owns it.",
      propRows: [
        {
          name: "tabs",
          type: "Tab[]",
          def: "—",
          note: "Id, label, icon. Icons live on the circular buttons, never on chips.",
        },
        {
          name: "contextualActions",
          type: "Record<string, Action[]>",
          def: "—",
          note: "ActionButtons per tab. isFilter marks the filter chip.",
        },
        {
          name: "utilityAction",
          type: "UtilityAction | null",
          def: "—",
          note: "The right circle's action for the current tab. null hides it.",
        },
        {
          name: "activeTab / onTabChange",
          type: "string / (tab) => void",
          def: "—",
          note: "Controlled tab state.",
        },
        {
          name: "activeAction",
          type: "string | null",
          def: "null",
          note: "Engaged ActionButton gets the pill; resting actions stay ghost labels.",
        },
        {
          name: "activeFilter / onFilterChange",
          type: "string / (id) => void",
          def: "—",
          note: "Current filter value — the chip wears it, the option set commits it.",
        },
        {
          name: "filterOptions",
          type: "FilterOption[]",
          def: "—",
          note: "Options revealed when the filter chip expands in place.",
        },
        {
          name: "isCollapsed / onCollapsedClick",
          type: "boolean / () => void",
          def: "false",
          note: "Scroll-collapse state — drive it from your scroll direction.",
        },
        {
          name: "isSearchOpen / onSearch…",
          type: "boolean / handlers",
          def: "false",
          note: "The bar itself morphs into the search field; Enter submits, then closes.",
        },
        {
          name: "isActionSheetOpen",
          type: "boolean",
          def: "false",
          note: "Workflow-sheet clear-out. Flip, wait ACTION_SHEET_CLEAROUT_MS, mount.",
        },
        {
          name: "isUtilitySheetOpen",
          type: "boolean",
          def: "false",
          note: "Clear-out toward the UtilityButton. Flip, wait UTILITY_CLEAROUT_MS, mount.",
        },
        {
          name: "utilityButtonRef / actionBarRef",
          type: "RefObject",
          def: "—",
          note: "Shared origins that sheets and modals grow out of.",
        },
        {
          name: "onUtilityClick",
          type: "() => void",
          def: "—",
          note: "Your surface routing: search, bottom sheet, or modal takeover.",
        },
      ],
    },
    usage: navigationBarUsage,
    tryIt: [
      "Scroll the canvas down to collapse the bar, up to expand it",
      "Tap the NavigationButton to open the NavigationMenu — Home, Spend, Trade, Transactions",
      "Switch tabs — the ActionButtons and UtilityButton change with the tab",
      "Tap Deposit — the action bar itself grows into the workflow sheet, and contracts back on Done",
      "Open the tab menu — the bar is absorbed into the circle and the menu grows out of it",
      "On Trade, tap Search — the bar itself morphs into a search field",
      "On Home, tap the sparkle UtilityButton — the assistant sheet grows out of it (extend it to full screen)",
      "On Spend, tap Scan — full-screen takeover with permission and error states",
      "On Transactions, tap Export — a compact sheet grows from the button and contracts back into it",
      "On Trade, five actions overflow the pill — swipe the row horizontally",
      "On Transactions, tap the filter chip to expand Pending / Complete / Scheduled in place",
      "Pick a new filter value — the highlight slides over, the labels trade colors, and the strip contracts with the value committed",
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
    showcase: {
      category: "interaction / gesture",
      blurb: "Press, slide, release — one gesture instead of three.",
      lede: "A dropdown asks for three gestures to change one value. This asks for one.",
      problem:
        "I kept watching people tap a select, squint at a menu, tap again, and miss. On a phone that is a whole ceremony for picking “Weekly.”",
      solution:
        "Stole the gesture from the volume slider. Press, slide, let go. Your thumb never leaves the glass, and the value under it is always the one you are about to get.",
      propRows: [
        {
          name: "options",
          type: "PickerOption[]",
          def: "—",
          note: "Key, label, color, optional chip bg. Five or fewer feels best.",
        },
        {
          name: "value",
          type: "string",
          def: "—",
          note: "Key of the current selection.",
        },
        {
          name: "onChange",
          type: "(key: string) => void",
          def: "—",
          note: "Fires once, on release. Never mid-slide.",
        },
        {
          name: "itemWidth",
          type: "number",
          def: "80",
          note: "Pixels per option zone in the strip. Lower = twitchier.",
        },
        {
          name: "longPressDuration",
          type: "number",
          def: "275",
          note: "Hold time before the strip springs out. A plain click opens the fallback listbox.",
        },
        {
          name: "renderChip",
          type: "(option, active) => ReactNode",
          def: "—",
          note: "Bring your own chip; the gesture stays.",
        },
        {
          name: "disabled",
          type: "boolean",
          def: "false",
          note: "Ignores the gesture and the fallback alike.",
        },
      ],
      beats: [
        {
          title: "Three gestures.",
          sub: "Tap the select. Read the menu. Tap again. Hope you hit the right row.",
          open: false,
          sel: 3,
          active: 3,
        },
        {
          title: "Press.",
          sub: "Hold the chip. The options come to your thumb.",
          open: true,
          sel: 3,
          active: 3,
        },
        {
          title: "Slide.",
          sub: "The value under your thumb is always the one you are about to get.",
          open: true,
          sel: 3,
          active: 1,
        },
        {
          title: "Release.",
          sub: "One commit, on lift. Nothing fires mid-slide.",
          open: true,
          sel: 3,
          active: 1,
        },
        {
          title: "One gesture.",
          sub: "Same control. A third of the work. Free to steal.",
          open: false,
          sel: 1,
          active: 1,
        },
      ],
    },
    usage: pressAndSlidePickerUsage,
    tryIt: [
      "Long-press the chip, keep holding, slide across the strip, release",
      "Plain-click the chip for the keyboard-friendly fallback picker",
      "Try it on a phone — haptics fire as you cross options",
      "Press Escape mid-gesture to bail out without committing",
    ],
    aliases: ["picker"],
  },
  {
    slug: "bottom-sheet",
    name: "Bottom Sheet",
    tagline:
      "A sheet that grows out of the control that owns it — two stops: yours, and full screen.",
    description:
      "A floating bottom sheet with origin-aware choreography: it starts as a clone of its trigger, widens, then stretches to a configurable initial height in strictly serial beats. One control (and the grab-bar drag) extends it to full screen — still a floating card, never welded to the edge. Exactly two stops, no mid heights. Extracted from the Navigation Bar's workflow and utility sheets, which now consume it.",
    tags: ["overlay", "mobile", "motion", "glassmorphism"],
    status: "stable",
    accent: "linear-gradient(135deg, #a5b4fc 0%, #c4b5fd 45%, #fbcfe8 100%)",
    Stage: BottomSheetStage,
    source: bottomSheetSource,
    sourceFile: "BottomSheet.tsx",
    dependencies: [
      "react",
      "motion",
      "lucide-react",
      "clsx + tailwind-merge (cn)",
      "theme/theme.css (token contract)",
      "@/lib/a11y (useInertOutside — dialog containment)",
    ],
    showcase: {
      category: "overlay / motion",
      blurb: "A sheet that knows the difference between a flick and a drag.",
      lede: "Sheets teleport in from the screen edge. This one grows out of the button you pressed.",
      problem:
        "Bottom sheets appear from nowhere, welded to the bottom of the screen, with a mush of half-open heights between closed and full.",
      solution:
        "This one starts as a clone of its trigger and grows in strictly serial beats — widen, then stretch. Exactly two stops, drag snapping between them, and on close it contracts back into the control that owns it.",
      propRows: [
        {
          name: "origin",
          type: "SheetOrigin",
          def: "—",
          note: "Rect of the control the sheet grows out of — and contracts back into.",
        },
        {
          name: "title",
          type: "ReactNode",
          def: "—",
          note: "Header title; a node so it can carry an icon.",
        },
        {
          name: "ariaLabel",
          type: "string",
          def: "—",
          note: "Accessible name for the dialog.",
        },
        {
          name: "onClose",
          type: "() => void",
          def: "—",
          note: "Done, scrim, Escape, and drag-down all call it; unmount to run the exit.",
        },
        {
          name: "height",
          type: 'number | "auto"',
          def: '"auto"',
          note: "≤ 1 → viewport fraction, > 1 → px, auto → content height.",
        },
        {
          name: "expandable",
          type: "boolean",
          def: "false",
          note: "Chevron control + drag snapping to the full-screen stop.",
        },
        {
          name: "doneLabel",
          type: "string",
          def: '"Done"',
          note: "Header commit label.",
        },
        {
          name: "headerExtra",
          type: "ReactNode",
          def: "—",
          note: "Slot rendered in the header before the Done button.",
        },
        {
          name: "reducedMotion",
          type: "boolean",
          def: "system",
          note: "Override only; defaults to the OS preference.",
        },
      ],
    },
    usage: bottomSheetUsage,
    tryIt: [
      "Tap a trigger — the sheet grows out of the button that owns it",
      "Tap the chevrons (or drag the grab bar up) to extend to full screen",
      "Drag down to snap back to the initial height; drag down again to dismiss",
      "Escape and the scrim dismiss too; watch the sheet contract back into its trigger",
      "Quick actions is an auto-height sheet — it still extends to full",
    ],
    aliases: ["sheet"],
  },
  {
    slug: "utility-modal",
    name: "Utility Modal",
    tagline:
      "A full-screen takeover that expands as a circle from the control that owns it.",
    description:
      "A modal takeover for focused tasks that temporarily replace the page — a camera scanner, a full-screen editor. It expands as a circle from its trigger's center point and contracts back to it on close, so the surface reads as the control itself unfolding. Scrim, circle clip, a --surface-modal sheet, Escape, and dismissal are handled for you; your children supply the full-screen content and may paint over the sheet entirely. The Navigation Bar's Scan demo is a consumer.",
    tags: ["overlay", "mobile", "motion"],
    status: "stable",
    accent: "linear-gradient(135deg, #f0abfc 0%, #c4b5fd 50%, #93c5fd 100%)",
    Stage: UtilityModalStage,
    source: utilityModalSource,
    sourceFile: "UtilityModal.tsx",
    dependencies: [
      "react",
      "motion",
      "clsx + tailwind-merge (cn)",
      "theme/theme.css (token contract)",
      "@/lib/a11y (useInertOutside — dialog containment)",
    ],
    showcase: {
      category: "overlay / takeover",
      blurb: "A full-screen takeover that unfolds from the button you pressed.",
      lede: "A full-screen takeover that unfolds from the button's center point.",
      problem:
        "Full-screen tasks — a scanner, an editor — usually hard-cut to a new screen. The jump severs the thread back to the control that opened them.",
      solution:
        "The modal expands as a circle from the trigger's center and contracts back to the same point, so the surface reads as the control itself unfolding. Chrome only: scrim, clip, Escape. Your children supply the screen.",
      propRows: [
        {
          name: "origin",
          type: "ModalOrigin",
          def: "—",
          note: "Center point the circle expands from — and contracts back to.",
        },
        {
          name: "ariaLabel",
          type: "string",
          def: "—",
          note: "Accessible name for the dialog.",
        },
        {
          name: "onClose",
          type: "() => void",
          def: "—",
          note: "Scrim and Escape call it; unmount to run the exit choreography.",
        },
        {
          name: "growDuration",
          type: "number",
          def: "0.42",
          note: "Circle-grow seconds; the contraction runs at 0.85×.",
        },
        {
          name: "reducedMotion",
          type: "boolean",
          def: "system",
          note: "Override only; defaults to the OS preference.",
        },
      ],
    },
    usage: utilityModalUsage,
    tryIt: [
      "Tap the trigger — the takeover expands as a circle from the button's center",
      "Close it — the circle contracts back to the same point",
      "Escape and the scrim (visible mid-reveal) dismiss too",
      "Flip the theme toggle — the surface reads the token contract",
    ],
    aliases: ["modal-takeover"],
  },
];

export function getComponent(slug: string): LabComponent | undefined {
  return labComponents.find(c => c.slug === slug || c.aliases?.includes(slug));
}
