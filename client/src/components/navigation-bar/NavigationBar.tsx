/**
 * NavigationBar
 * Part of Rishi's UI Lab — © 2026 Rishi Dean (rishidean.com)
 * MIT license · github.com/rishidean/ui-lab
 *
 * A glass bottom bar where navigation, actions, and filters share one
 * morphing surface. Three regions, named consistently throughout:
 *
 *   NavigationButton (left circle)  — current Tab's icon; opens the
 *     NavigationMenu (rows of NavigationMenuItems) grown out of itself.
 *   ContextualActionBar (center)    — per-tab ActionButtons, or a filter
 *     control that expands into the FilterOptionSet in place.
 *   UtilityButton (right circle)    — one high-value UtilityAction per
 *     tab (Search, Export, Assistant, Scan…); utility surfaces grow out
 *     of this button.
 *
 * The bar collapses into the NavigationButton on scroll down and regrows
 * on scroll up. Styling reads the token contract in theme/theme.css —
 * copy that file with this component and edit a preset to retheme.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { focusWhenClear } from "@/lib/a11y";
import { ChevronDown, Search as SearchGlyph, Sparkles, X } from "lucide-react";

// Default collapsed-state glyph: a small brand dot. A brand mark, not a
// placeholder icon — consumers pass `logo` to supply their own.
const DefaultLogo = () => (
  <span
    aria-hidden="true"
    className="block h-5 w-5 rounded-full"
    style={{
      background: "var(--gradient-brand)",
      boxShadow:
        "0 0 0 3px color-mix(in oklab, var(--accent-soft) 28%, transparent), inset 0 1px 1px rgba(255,255,255,0.6)",
    }}
  />
);

// Edge-fade affordance for horizontal scroll rows: fades content at an edge
// only while more content exists in that direction, and clears when the row
// fits or the user reaches the end.
const EDGE_FADE_PX = 28;

function useScrollEdgeFade(deps: React.DependencyList) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const update = () => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges(prev =>
      prev.left === left && prev.right === right ? prev : { left, right }
    );
  };

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const maskImage =
    edges.left && edges.right
      ? `linear-gradient(to right, transparent 0, black ${EDGE_FADE_PX}px, black calc(100% - ${EDGE_FADE_PX}px), transparent 100%)`
      : edges.right
        ? `linear-gradient(to right, black calc(100% - ${EDGE_FADE_PX}px), transparent 100%)`
        : edges.left
          ? `linear-gradient(to right, transparent 0, black ${EDGE_FADE_PX}px)`
          : undefined;

  return {
    ref,
    onScroll: update,
    style: { maskImage, WebkitMaskImage: maskImage },
  };
}

export type NavTabId = string;

export type Tab<T extends NavTabId = NavTabId> = {
  id: T;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

export type Action = {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  showIcon?: boolean;
  /** Marks this ActionButton as the filter control: it renders the
   *  current filter value with a chevron and expands the FilterOptionSet
   *  in place when pressed. */
  isFilter?: boolean;
};

/** The UtilityButton's per-tab action (Search, Export, Assistant…). */
export type UtilityAction = {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  /** Marks the action as opening a modal surface (sheet or takeover) —
   *  drives aria-haspopup="dialog" on the UtilityButton. */
  opensDialog?: boolean;
};

export type FilterOption = {
  id: string;
  label: string;
};

/** One transcript entry for assistant mode. The consumer owns the array;
 *  a `pending` entry renders the shimmer bubble and stays aria-hidden
 *  until its text lands. */
export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
};

// ─── Motion system ──────────────────────────────────────────────────────
// Four component states: expanded, collapsed, navigation-open, search-active.
// One shared curve (ease-standard, no overshoot) across every transition.
// Two speed bands:
//   direct interactions        180–240ms  (press, menu, filter, label fades)
//   full component transforms  240–320ms  (collapse, expand, search morph)
// The three controls move on one continuous path — containers transform,
// labels fade only after movement has begun, nothing fades independently.
// prefers-reduced-motion collapses every duration and delay to 0.
// Easing rule: ease-out for reveals, ease-in for collapses, standard for
// everything symmetric.
const EASE = [0.2, 0, 0, 1] as const;
const EASE_OUT = [0, 0, 0.2, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

// Global tempo knob: every duration and delay is multiplied by this.
// 1.0 = the nominal bands above; raise to make transitions more legible,
// lower to tighten. Tuned by feel on device.
const TEMPO = 1.3;

const DUR = {
  press: 0.18, // pressed feedback, small fades
  direct: 0.2, // direct interactions
  menuOpen: 0.18,
  menuClose: 0.16,
  collapse: 0.26, // full transform: 220–280 band
  expand: 0.2, // reveal is faster than collapse: 180–220 band
  search: 0.28, // search morph: 260–320 band
  label: 0.12, // label/divider fades within a transform
};

// The menu is CSS-anchored to the left circle: its bottom-left corner sits
// at the circle's center (28px in from the circle's left/bottom), slightly
// overlapping the button's footprint, and it stays attached through resize
// with no measurement code.
const MENU_ANCHOR = { left: 28, bottom: 28 };
const MENU_ROW_STAGGER = 0.018; // ≤25ms per row

// ── Navigation open: the bar is ABSORBED into the left button, then the
//    menu grows out of it. Right utility fades first, center bar collapses
//    right-to-left into the circle, menu expands as the bar finishes.
const OPEN_DELAYS = {
  utilityButtonFade: 0.0, // 1. undot the i — right utility pops out first
  centerSquish: 0.12, //   2. then the bar absorbs right-to-left
  centerIconsFade: 0.14, //    labels fade just after movement begins
  menuGrow: 0.26, //   3. menu grows as the bar finishes
};

// ── Navigation close/selection — strictly serial beats. On selection the
//    pressed row confirms first (SELECT_CONFIRM_S hold, handled in
//    handleSelectTab), THEN the close sequence runs; plain dismissal skips
//    the confirm and starts here directly:
//    1. menu collapses into the left button while the left icon swaps to
//       the new tab (simultaneous),
//    2. beat, the action bar regrows left-to-right,
//    3. beat, the right utility fades in — beats 2+3 dot a horizontal "i".
const SELECT_CONFIRM_S = 0.16; // pressed-row confirmation hold
const CLOSE_DELAYS = {
  menuFade: 0.0, // collapse runs 0 → menuClose (0.16)
  tabIconSwap: 0.02, // left icon transitions with the collapse, not after
  pillGrow: 0.22, // bar regrows after the menu has landed + a beat
  actionsFadeIn: 0.3, // labels arrive in the regrow's final third
  // Bar finishes at pillGrow + expand ≈ 0.42; the utility dots the i.
  utilityButtonFadeIn: 0.46,
};

// Scroll collapse/expand use the same absorb/regrow grammar as the menu:
// undot the i (right pops out), bar absorbs into the circle; regrow the
// bar from the circle, then dot the i (right pops back in last).
const SCROLL_COLLAPSE_DELAYS = {
  rightUndot: 0.0, // 1. right utility pops out first
  centerCollapse: 0.12, // 2. bar absorbs right-to-left into the circle
  labelFade: 0.14, //    labels fade just after movement begins
  pillFade: 0.24, //    container fades late, once nearly shrunk
  tabIconFade: 0.14,
  logoFadeIn: 0.16,
};

const SCROLL_EXPAND_DELAYS = {
  logoFade: 0.0,
  tabIconFadeIn: 0.0,
  centerExpand: 0.0, // 1. bar regrows from the circle…
  labelFadeIn: 0.1, //    labels arrive in the final third
  rightReveal: 0.24, // 2. …then the right utility dots the i
};

// ── Sheet launch — ONE clear-out for every sheet surface (workflow
//    sheets and Export) and for the Scan takeover, replacing the old
//    fade-in-place and sweep-into-the-button grammars:
//    1. pressed feedback on the control,
//    2. both circles recede exactly as search/assistant open them,
//       while the pill's labels fade — the full-width glass stays put
//       as the seed the surface grows out of,
//    3. the consumer waits SHEET_CLEAROUT_MS, measures the pill (its
//       rect now spans the full row), and mounts the surface.
//    Close reverses: the surface contracts onto the bar, then labels
//    and both circles return together on the default bands — the exact
//    search-close return, per Rishi (no staggered ends).
const SHEET_DELAYS = {
  labelFade: 0.05, // labels leave just after the recede begins
};

// Consumers flip isSheetOpen, wait this window, then measure the bar
// and mount their surface. Derived from the recede band (0.25) + a
// breath, × TEMPO — retuning the bar keeps launch timing in sync.
export const SHEET_CLEAROUT_MS = Math.round((0.25 + 0.06) * TEMPO * 1000);

// ── Filter expansion — serial beats. The strip claims the RIGHT button's
//    space (the left circle never moves):
//    1. pressed feedback on the chip, the right utility pops out,
//    2. its width collapses so the strip widens into the vacated space,
//    3. the selected label fades once the strip has landed; the page dims,
//    4. the options reveal with the current value highlighted.
//    Selection: highlight slides → confirm hold → options fade → the chip
//    label returns (updated) while the strip is still wide → the strip
//    contracts → the right utility dots the i last.

const FILTER_DELAYS = {
  rightUndot: 0.0, // 1. right utility pops out first (0.12)
  barGrow: 0.12, // 2. its width collapses; the strip widens (lands ≈0.32)
  labelFade: 0.38, // 3. selected label fades after the strip lands
  scrimFade: 0.38, //    page dims as the label clears
  optionsFadeIn: 0.05, // 4. options reveal (mounts after the label exit)
  optionStagger: 0.02,
  confirmHold: 0.16, // hold after the highlight lands on the new value
  closeBarContract: 0.24, // strip contracts once the label is returning
  closeRightDotIn: 0.5, // right utility dots the i last
};

// Aura icon — clean single-stroke glyph that inherits the parent's color
// (iris on the circular buttons, tertiary on action chips, ink on the sparkle).
const NavIcon = ({
  Icon,
  className,
  size = 24,
  strokeWidth = 1.75,
}: {
  Icon: React.ComponentType<any>;
  className?: string;
  size?: number;
  strokeWidth?: number;
}) => (
  <span
    className={cn(
      "relative inline-flex items-center justify-center",
      className
    )}
    style={{ width: size, height: size }}
  >
    <Icon width={size} height={size} strokeWidth={strokeWidth} />
  </span>
);

export type NavigationBarProps = {
  isCollapsed?: boolean;
  /** Fired when the collapsed NavigationButton is tapped — expand the bar
   *  here. (Opening the NavigationMenu then requires a second tap.) */
  onCollapsedClick?: () => void;
  onTabChange?: (tab: string) => void;
  activeTab?: string;
  onActionClick?: (label: string, tab: string) => void;
  /** Label of the currently engaged action, if any. The pill treatment is
   *  reserved for real state: only this ActionButton gets the accent
   *  inset fill. */
  activeAction?: string | null;
  /** Glyph shown when no tab is active. Defaults to the brand
   *  mark. */
  logo?: React.ReactNode;
  /** Search mode: the NavigationButton recedes and the bar morphs into a
   *  search field, wiping right-to-left from the trigger. Controlled by
   *  the consumer (typically toggled from a Search UtilityButton). */
  isSearchOpen?: boolean;
  onSearchClose?: () => void;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  /** Fired on Enter with the current query; the field then closes. */
  onSearchSubmit?: (query: string) => void;
  /** Assistant mode: the bar morphs into a chat input with the exact
   *  search grammar, then stretches upward into a conversation card as
   *  messages accumulate. Controlled by the consumer, like search.
   *  Precedence: if both isSearchOpen and isAssistantOpen are set, the
   *  assistant branch wins (see isBarInputMode's render order) — treat
   *  the two as mutually exclusive. */
  isAssistantOpen?: boolean;
  onAssistantClose?: () => void;
  /** Fired with the trimmed draft on Enter/submit; empty drafts are
   *  swallowed. The consumer appends the message (and its reply). */
  onAssistantSubmit?: (text: string) => void;
  /** The conversation. Persistence across close/reopen falls out of the
   *  consumer owning this array. */
  assistantMessages?: AssistantMessage[];
  assistantPlaceholder?: string;
  /** Exposes the UtilityButton element — the shared origin that utility
   *  surfaces grow out of and contract back into. Typed as a RefObject
   *  (not the broader React.Ref) so the search-close and focus-return
   *  effects can read `.current` directly. */
  utilityButtonRef?: React.RefObject<HTMLButtonElement | null>;
  /** Exposes the ContextualActionBar element — the shared origin that
   *  workflow sheets grow out of on action press. */
  actionBarRef?: React.Ref<HTMLDivElement>;
  /** Sheet clear-out: both circles recede (search-style) and the pill's
   *  labels fade, leaving the full-width glass as the surface a sheet or
   *  takeover grows out of. Flip this, wait SHEET_CLEAROUT_MS, then
   *  measure the bar and mount the surface. */
  isSheetOpen?: boolean;
  onUtilityClick?: () => void;
  activeFilter?: string;
  onFilterChange?: (filterId: string) => void;
  filterOptions?: FilterOption[];
  tabs?: Tab[];
  /** ActionButtons for the ContextualActionBar, keyed by tab id. */
  contextualActions?: Record<string, Action[]>;
  /** The UtilityButton's action for the current tab (null hides it). */
  utilityAction?: UtilityAction | null;
  showUtilityButton?: boolean;
};

export const NavigationBar: React.FC<NavigationBarProps> = ({
  isCollapsed = false,
  onCollapsedClick,
  onTabChange,
  activeTab: externalActiveTab,
  onActionClick,
  activeAction = null,
  logo,
  isSearchOpen = false,
  onSearchClose,
  onSearchChange,
  searchPlaceholder = "Search…",
  onSearchSubmit,
  isAssistantOpen = false,
  onAssistantClose,
  onAssistantSubmit,
  assistantMessages = [],
  assistantPlaceholder = "Ask anything…",
  utilityButtonRef,
  actionBarRef,
  isSheetOpen = false,
  onUtilityClick,
  activeFilter = "",
  onFilterChange,
  filterOptions = [],
  tabs = [],
  contextualActions = {},
  utilityAction,
  showUtilityButton = true,
}) => {
  const [isNavigationMenuOpen, setIsNavigationMenuOpen] = useState(false);
  const menuId = React.useId();
  const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Roving tabindex: exactly one row is tabbable; arrows move it.
  const [menuFocusId, setMenuFocusId] = useState<string | null>(null);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(
    externalActiveTab || tabs[0]?.id || "home"
  );

  const prefersReducedMotion = useReducedMotion();
  const dur = (d: number) => (prefersReducedMotion ? 0 : d * TEMPO);
  const del = (d: number) => (prefersReducedMotion ? 0 : d * TEMPO);

  // Search and assistant are the two bar-internal input modes: both recede
  // the circles and hand the full row to the pill. Layout conditionals key
  // off this; mode-specific behavior (focus, submit) stays per-mode.
  const isBarInputMode = isSearchOpen || isAssistantOpen;
  // Sheets and takeovers borrow the input modes' recede: circles leave,
  // the pill hands its full width to the incoming surface.
  const isBarSurrendered = isBarInputMode || isSheetOpen;

  useEffect(() => {
    if (!externalActiveTab) return;
    setActiveTab(externalActiveTab);
    setIsFilterExpanded(false);
  }, [externalActiveTab]);

  useEffect(() => {
    if (!tabs?.length) return;
    const exists = tabs.some(t => t.id === activeTab);
    if (!exists) setActiveTab(tabs[0].id);
  }, [tabs, activeTab]);

  const prevCollapsedRef = useRef(isCollapsed);
  const animationStateRef = useRef<"idle" | "collapsing" | "expanding">("idle");

  if (isCollapsed !== prevCollapsedRef.current) {
    if (isCollapsed && !prevCollapsedRef.current)
      animationStateRef.current = "collapsing";
    else if (!isCollapsed && prevCollapsedRef.current)
      animationStateRef.current = "expanding";
    prevCollapsedRef.current = isCollapsed;
  }

  useEffect(() => {
    if (animationStateRef.current === "collapsing") {
      const timer = setTimeout(() => (animationStateRef.current = "idle"), 500);
      return () => clearTimeout(timer);
    }
    if (animationStateRef.current === "expanding") {
      const timer = setTimeout(() => (animationStateRef.current = "idle"), 800);
      return () => clearTimeout(timer);
    }
  }, [isCollapsed]);

  const navCollapsing = animationStateRef.current === "collapsing";
  const navExpanding = animationStateRef.current === "expanding";

  useEffect(() => {
    if (isCollapsed) {
      setIsNavigationMenuOpen(false);
      setIsFilterExpanded(false);
    }
  }, [isCollapsed]);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Text inputs match :focus-visible however focus arrives (browser
  // heuristic for keyboard-input elements) — including our programmatic
  // focus on open — so the search field's keyboard-only ring can't lean on
  // :focus-visible alone the way the buttons do. Track the last input
  // modality by hand and stamp it on the input at each focus; the theme's
  // ring rule requires data-kbd, keeping pointer flows pixel-identical.
  const lastInputWasKeyboard = useRef(false);
  useEffect(() => {
    const onKeyDown = () => {
      lastInputWasKeyboard.current = true;
    };
    const onPointerDown = (e: PointerEvent) => {
      // framer's keyboard-press support dispatches a synthetic pointerdown
      // (isTrusted=false, pointerType "") when Enter/Space activates a
      // motion button — only real pointers may reclassify the modality.
      if (!e.isTrusted) return;
      lastInputWasKeyboard.current = false;
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);
  const [searchFocusRing, setSearchFocusRing] = useState(false);

  useEffect(() => {
    if (isSearchOpen) {
      setIsNavigationMenuOpen(false);
      setIsFilterExpanded(false);
      setSearchQuery("");
      // The input mounts only after the actions row's exit finishes
      // (AnimatePresence mode="wait"), so a fixed timer from the open can
      // fire before the ref exists and silently no-op. Poll for the mount,
      // THEN wait until the field has reached most of its final width —
      // focusing earlier jumps the viewport mid-morph on mobile keyboards.
      let raf = 0;
      let timer: number | undefined;
      let tries = 0;
      const arm = () => {
        if (searchInputRef.current) {
          timer = window.setTimeout(
            () => searchInputRef.current?.focus({ preventScroll: true }),
            prefersReducedMotion ? 0 : 220 * TEMPO
          );
        } else if (tries++ < 120) {
          raf = requestAnimationFrame(arm);
        }
      };
      arm();
      return () => {
        cancelAnimationFrame(raf);
        if (timer !== undefined) window.clearTimeout(timer);
      };
    }
  }, [isSearchOpen, prefersReducedMotion]);

  // Search close (Cancel, Escape, Enter-submit): focus returns to the
  // utility button that opened it.
  const prevSearchOpenRef = useRef(isSearchOpen);
  useEffect(() => {
    const was = prevSearchOpenRef.current;
    prevSearchOpenRef.current = isSearchOpen;
    if (was && !isSearchOpen) {
      utilityButtonRef?.current?.focus({ preventScroll: true });
    }
  }, [isSearchOpen, utilityButtonRef]);

  const assistantInputRef = useRef<HTMLInputElement | null>(null);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantFocusRing, setAssistantFocusRing] = useState(false);

  // Assistant open mirrors search open: exclusive with menu/filter, draft
  // reset, focus deferred until the field has mostly widened. Same
  // poll-then-arm as search: the input mounts only after the actions
  // row's exit finishes (AnimatePresence mode="wait"), so a fixed timer
  // from the open can fire before the ref exists and silently no-op.
  useEffect(() => {
    if (isAssistantOpen) {
      setIsNavigationMenuOpen(false);
      setIsFilterExpanded(false);
      setAssistantDraft("");
      let raf = 0;
      let timer: number | undefined;
      let tries = 0;
      const arm = () => {
        if (assistantInputRef.current) {
          timer = window.setTimeout(
            () => assistantInputRef.current?.focus({ preventScroll: true }),
            prefersReducedMotion ? 0 : 220 * TEMPO
          );
        } else if (tries++ < 120) {
          raf = requestAnimationFrame(arm);
        }
      };
      arm();
      return () => {
        cancelAnimationFrame(raf);
        if (timer !== undefined) window.clearTimeout(timer);
      };
    }
  }, [isAssistantOpen, prefersReducedMotion]);

  // Close returns focus to the utility button, same as search.
  const prevAssistantOpenRef = useRef(isAssistantOpen);
  useEffect(() => {
    const was = prevAssistantOpenRef.current;
    prevAssistantOpenRef.current = isAssistantOpen;
    if (was && !isAssistantOpen) {
      utilityButtonRef?.current?.focus({ preventScroll: true });
    }
  }, [isAssistantOpen, utilityButtonRef]);

  const handleAssistantSubmit = () => {
    const text = assistantDraft.trim();
    if (!text) return;
    setAssistantDraft("");
    onAssistantSubmit?.(text);
  };

  // ── Assistant stretch ──────────────────────────────────────────────
  // The pill's height is a real height animation (never scaleY — text
  // must not distort): input row + measured transcript, capped at 62% of
  // the viewport, re-clamped on resize. Reopen-with-history runs two
  // beats: the open morph lands the plain input first, then the card
  // stretches to fit (assistantSurfaceReady gates the second beat).
  const ASSISTANT_INPUT_ROW_PX = 36;
  const ASSISTANT_HEIGHT_CAP = 0.62;

  const [assistantContentH, setAssistantContentH] = useState(0);
  const [viewportH, setViewportH] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight
  );
  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const transcriptObserver = useRef<ResizeObserver | null>(null);
  const setTranscriptContentRef = useCallback((el: HTMLDivElement | null) => {
    transcriptObserver.current?.disconnect();
    if (el && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() =>
        setAssistantContentH(el.offsetHeight)
      );
      ro.observe(el);
      transcriptObserver.current = ro;
      setAssistantContentH(el.offsetHeight);
    }
  }, []);
  useEffect(() => () => transcriptObserver.current?.disconnect(), []);

  const [assistantSurfaceReady, setAssistantSurfaceReady] = useState(false);
  useEffect(() => {
    if (!isAssistantOpen) {
      setAssistantSurfaceReady(false);
      return;
    }
    // Open morph is 0.24 + 0.06 delay; the stretch waits one extra beat.
    const t = setTimeout(
      () => setAssistantSurfaceReady(true),
      prefersReducedMotion ? 0 : Math.round((0.24 + 0.06 + 0.1) * TEMPO * 1000)
    );
    return () => clearTimeout(t);
  }, [isAssistantOpen, prefersReducedMotion]);

  // ── Assistant close/unmount lag ────────────────────────────────────
  // The close wipe runs as an ANIMATE retarget while the branch is still
  // mounted — not as an AnimatePresence exit. A delayed exit on the keyed
  // child left it in the "exiting" presence state for ~550ms, and framer's
  // exit-interruption bookkeeping does not reliably restore values when the
  // same key re-enters mid-exit (an exit-completed value with no animate
  // counterpart is never restored — ExitAnimationFeature only jumps values
  // named in `initial` and replays `animate`). Reopening in that window
  // stranded the transcript at opacity 0 (a stretched-but-empty card) and
  // could strand the branch clip at inset 100%. Keeping the branch mounted
  // through the wipe turns every rapid open/close into a plain retarget —
  // the one interruption path framer handles per the spec ("retargets from
  // current animated values; nothing snaps") — and the branch unmounts
  // (instant, valueless exit) only once fully invisible.
  // Close wipe mirrors the open wipe (search's band) — the height
  // contraction, when the card was stretched, runs concurrently rather
  // than as a separate beat, so both ends of the bar return together.
  const ASSISTANT_CLOSE_WIPE_DELAY_S = 0.06;
  const ASSISTANT_CLOSE_WIPE_S = 0.24;
  const [assistantHeld, setAssistantHeld] = useState(false);
  useEffect(() => {
    if (isAssistantOpen) {
      setAssistantHeld(true);
      return;
    }
    if (!assistantHeld) return;
    const t = setTimeout(
      () => setAssistantHeld(false),
      prefersReducedMotion
        ? 0
        : Math.round(
            (ASSISTANT_CLOSE_WIPE_DELAY_S + ASSISTANT_CLOSE_WIPE_S) *
              TEMPO *
              1000
          )
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAssistantOpen, assistantHeld, prefersReducedMotion]);
  // Mount immediately on open (isAssistantOpen leads assistantHeld by a
  // render); hold through the close wipe.
  const renderAssistantBranch = isAssistantOpen || assistantHeld;

  const hasTranscript = assistantMessages.length > 0;
  // Scroll-collapse and menu-open kill the pill's transform/paint
  // (scaleX/opacity) directly — height is real layout, so without this
  // guard the wrapping row would stay transcript-tall (and the bar's
  // footprint with it) while the pill sat invisible. A sheet doesn't
  // touch the pill's transform at all, but its surface grows from this
  // same footprint, so the stretch still has to collapse first.
  const assistantStretched =
    isAssistantOpen &&
    assistantSurfaceReady &&
    hasTranscript &&
    !isCollapsed &&
    !isSheetOpen;
  // assistantContentH measures the inner transcript column only — it
  // excludes the scroll container's own `pt-3` (12px) AND the pill's
  // vertical padding + border (10px padding + 2px border = 12px), neither
  // of which is part of that measurement. Both must be added back — plus
  // the input row's stretched-only mb-1.5 (6px) — so a below-cap card
  // fits its content with zero internal scroll.
  const assistantHeight = assistantStretched
    ? Math.min(
        ASSISTANT_INPUT_ROW_PX +
          assistantContentH +
          12 /* transcript pt-3 */ +
          12 /* pill padding + border */ +
          6 /* input row mb-1.5, stretched only */,
        Math.round(viewportH * ASSISTANT_HEIGHT_CAP)
      )
    : 48;

  // Ease selection follows the grammar: ease-out growing, ease-in
  // shrinking. Track the previous target to know the direction.
  const prevAssistantHeightRef = useRef(48);
  const assistantGrowing = assistantHeight >= prevAssistantHeightRef.current;
  useEffect(() => {
    prevAssistantHeightRef.current = assistantHeight;
  }, [assistantHeight]);

  // Transcript pins to the newest message through growth and reflow.
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [assistantMessages, assistantHeight]);

  // A sheet surface is exclusive: it closes the NavigationMenu and the
  // FilterOptionSet, and the bar's own controls lock as soon as the
  // transition begins.
  useEffect(() => {
    if (isSheetOpen) {
      setIsNavigationMenuOpen(false);
      setIsFilterExpanded(false);
    }
  }, [isSheetOpen]);

  // The chip that launched the workflow sheet gets focus back when the
  // bar's clear-out lifts (isSheetOpen falls in onExitComplete).
  // The workflow sheet is a BottomSheet running useInertOutside, whose
  // cleanup is NOT guaranteed to have committed by the time onExitComplete
  // fires — a same-tick .focus() on the chip can land on a still-inert
  // element and silently no-op (see focusWhenClear's docstring in
  // @/lib/a11y). Use focusWhenClear instead of a raw .focus() call.
  const actionChipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const lastEngagedActionRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeAction) lastEngagedActionRef.current = activeAction;
  }, [activeAction]);
  const prevSheetOpenForFocusRef = useRef(isSheetOpen);
  useEffect(() => {
    const was = prevSheetOpenForFocusRef.current;
    prevSheetOpenForFocusRef.current = isSheetOpen;
    if (was && !isSheetOpen) {
      const label = lastEngagedActionRef.current;
      // One-shot: consume the ref before handing off focus. A utility
      // surface (Export, Scan, ...) shares this same falling edge but
      // never repopulates the ref, so without clearing it here a utility
      // close on a later cycle would inherit a stale chip label from the
      // last workflow sheet and fight the stage's own focusWhenClear call.
      lastEngagedActionRef.current = null;
      if (label) focusWhenClear(actionChipRefs.current[label] ?? null);
    }
  }, [isSheetOpen]);

  const prevFilterExpandedRef = useRef(isFilterExpanded);
  useEffect(() => {
    prevFilterExpandedRef.current = isFilterExpanded;
  }, [isFilterExpanded]);
  const filterClosing = !isFilterExpanded && prevFilterExpandedRef.current;

  // ── Absorb pulse: when the ContextualActionBar finishes collapsing
  //    into the NavigationButton (menu open or scroll collapse), the
  //    circle's border flares briefly and settles — a visual "caught it"
  //    as the bar lands in the circle. Keyed so every landing retriggers.
  const [absorbPulse, setAbsorbPulse] = useState(0);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePulse = (delaySeconds: number) => {
    if (prefersReducedMotion) return;
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(
      () => setAbsorbPulse(k => k + 1),
      Math.round(Math.max(0, delaySeconds) * 1000)
    );
  };
  useEffect(
    () => () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    },
    []
  );
  // Menu open: the bar absorbs right-to-left and lands at
  // centerSquish + direct; the flare starts a breath early so its peak
  // coincides with the landing.
  useEffect(() => {
    if (isNavigationMenuOpen) {
      schedulePulse(del(OPEN_DELAYS.centerSquish + DUR.direct - 0.05));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavigationMenuOpen]);
  // Scroll collapse: same cue when the bar lands in the collapsed circle.
  useEffect(() => {
    if (isCollapsed) {
      schedulePulse(
        del(SCROLL_COLLAPSE_DELAYS.centerCollapse + DUR.collapse - 0.05)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollapsed]);

  const navRef = useRef<HTMLDivElement | null>(null);
  const navigationMenuContainerRef = useRef<HTMLDivElement | null>(null);

  const prevNavigationMenuOpenRef = useRef(isNavigationMenuOpen);
  useEffect(() => {
    prevNavigationMenuOpenRef.current = isNavigationMenuOpen;
  }, [isNavigationMenuOpen]);
  const prevNavigationMenuOpen = prevNavigationMenuOpenRef.current;
  const menuOpening = isNavigationMenuOpen && !prevNavigationMenuOpen;
  const menuClosing = !isNavigationMenuOpen && prevNavigationMenuOpen;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setIsNavigationMenuOpen(false);
        setIsFilterExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigationButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleNavigationButtonClick = () => {
    if (isCollapsed && onCollapsedClick) {
      // Tap on the collapsed control expands the bar only — opening the
      // menu requires a second, deliberate tap.
      onCollapsedClick();
      return;
    }
    if (isFilterExpanded) setIsFilterExpanded(false);
    setIsNavigationMenuOpen(open => !open);
  };

  const closeMenu = (returnFocus: boolean) => {
    setIsNavigationMenuOpen(false);
    if (returnFocus)
      navigationButtonRef.current?.focus({ preventScroll: true });
  };

  // Escape closes the menu and returns focus to the left control.
  useEffect(() => {
    if (!isNavigationMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavigationMenuOpen]);

  // Selection sequence, beat one: the pressed row visibly takes the
  // selection (highlight moves to it) and holds for a beat BEFORE the menu
  // collapses — the choice is confirmed while the menu is still up. The
  // tab itself commits when the collapse starts, so the left icon swaps
  // with the collapse rather than during the hold.
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const selectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (selectTimer.current) clearTimeout(selectTimer.current);
    },
    []
  );
  // Menu closed by any other path (Escape, toggle, outside click) while a
  // confirmation was pending: abandon the pending selection cleanly.
  useEffect(() => {
    if (!isNavigationMenuOpen && pendingTab !== null) {
      if (selectTimer.current) clearTimeout(selectTimer.current);
      setPendingTab(null);
    }
  }, [isNavigationMenuOpen, pendingTab]);

  const handleSelectTab = (id: string) => {
    if (pendingTab !== null) return; // one selection at a time
    setPendingTab(id);
    if (selectTimer.current) clearTimeout(selectTimer.current);
    selectTimer.current = setTimeout(
      () => {
        setPendingTab(null);
        setActiveTab(id);
        setIsNavigationMenuOpen(false);
        setIsFilterExpanded(false);
        navigationButtonRef.current?.focus({ preventScroll: true });
        onTabChange?.(id);
      },
      Math.round(dur(SELECT_CONFIRM_S) * 1000)
    );
  };

  const handleFilterClick = () => {
    setIsFilterExpanded(open => !open);
    setIsNavigationMenuOpen(false);
  };

  // Selection sequence: the highlight slides to the chosen value, HOLDS for
  // a confirmation beat once it lands, and only then does the strip begin
  // its close — the value is visibly committed before the control changes
  // shape. (Mirrors the menu's pressed-row confirmation hold.)
  const filterCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The color swap lags the slide: on selection the pill glides to the new
  // value FIRST (DUR.direct), and only once it lands do the labels trade
  // colors — an immediate recolor makes the slide's first frames read as
  // "nothing moved". While the pill is in flight this holds the OLD value's
  // id so the coloring stays put; aria-checked follows activeFilter
  // immediately (semantics don't wait for choreography).
  const [pendingFilterVisual, setPendingFilterVisual] = useState<string | null>(
    null
  );
  const filterVisualTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (filterCloseTimer.current) clearTimeout(filterCloseTimer.current);
      if (filterVisualTimer.current) clearTimeout(filterVisualTimer.current);
    },
    []
  );

  const handleSelectFilter = (filterId: string) => {
    if (filterId !== activeFilter) {
      // Keep coloring whatever is currently shown as active (a mid-flight
      // reselect keeps the visual it already had, not the aborted target).
      setPendingFilterVisual(pendingFilterVisual ?? activeFilter);
      if (filterVisualTimer.current) clearTimeout(filterVisualTimer.current);
      filterVisualTimer.current = setTimeout(
        () => setPendingFilterVisual(null),
        Math.round(dur(DUR.direct) * 1000)
      );
    }
    onFilterChange?.(filterId);
    if (filterCloseTimer.current) clearTimeout(filterCloseTimer.current);
    filterCloseTimer.current = setTimeout(
      () => setIsFilterExpanded(false),
      Math.round((dur(DUR.direct) + dur(FILTER_DELAYS.confirmHold)) * 1000)
    );
  };

  // Escape dismisses the filter strip, same as the menu.
  useEffect(() => {
    if (!isFilterExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFilterExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFilterExpanded]);

  // APG radiogroup: roving tabindex + focus return, mirroring the menu.
  const filterChipRef = useRef<HTMLButtonElement | null>(null);
  const [filterFocusId, setFilterFocusId] = useState<string | null>(null);
  // One-shot flag: focus the selected radio when the options first mount
  // (they appear AFTER the label exits under mode="wait", so an effect on
  // isFilterExpanded fires too early — the ref callback is the mount signal).
  const filterFocusApplied = useRef(false);
  // Mirror image of the above: the chip itself unmounts while the options
  // are showing and only remounts once they finish exiting (same
  // mode="wait" AnimatePresence), so a focus() call made the instant
  // isFilterExpanded flips false lands on a not-yet-mounted button and is
  // silently dropped. This flag is consumed by the chip's own ref callback
  // once it actually mounts.
  const pendingFilterFocusReturn = useRef(false);

  // Close: reset roving; return focus to the chip unless the user has
  // already clicked focus somewhere else on the page. Rides the existing
  // filterClosing falling-edge signal (~line 455) rather than a second
  // isFilterExpanded-tracking ref.
  //
  // The just-activated (or just-escaped-from) radio keeps DOM focus while
  // it fades out under AnimatePresence — a still-mounted exiting radio, not
  // document.body, so the check for "focus already moved on" is whether
  // activeElement is one of OUR OWN option buttons (still owned by the
  // closing strip) versus something genuinely outside it.
  useEffect(() => {
    if (!filterClosing) return;
    setFilterFocusId(null);
    filterFocusApplied.current = false;
    // A close can interrupt the slide (Escape mid-flight): drop the lagged
    // coloring so a reopen starts clean on the committed value.
    setPendingFilterVisual(null);
    if (filterVisualTimer.current) clearTimeout(filterVisualTimer.current);
    const el = document.activeElement;
    const stillOwnedByStrip =
      el === document.body ||
      el === null ||
      Object.values(filterOptionRefs.current).some(opt => opt === el);
    if (stillOwnedByStrip) {
      if (filterChipRef.current) {
        filterChipRef.current.focus({ preventScroll: true });
      } else {
        pendingFilterFocusReturn.current = true;
      }
    }
  }, [filterClosing]);

  // A pending focus return targets THIS tab's filter chip. If activeTab
  // changes before that chip remounts — e.g. a controlled `externalActiveTab`
  // swap closes the filter in the same render as effect ~372 — the flag must
  // not survive to fire on whatever chip (same tab, different tab, or none)
  // shows up next. Declared after the close effect above so that on a
  // render where both fire, this one runs last and wins.
  useEffect(() => {
    pendingFilterFocusReturn.current = false;
  }, [activeTab]);

  // Stable identity: this ref only ever targets the one filter chip, so it
  // doesn't need the per-item closures the menu rows / filter options use.
  // Keeping it memoized avoids detach/reattach churn on every render, and
  // gives the chip ref map below a single spot to fold an `actionChipRefs`
  // assignment into.
  const setFilterChipRef = useCallback((el: HTMLButtonElement | null) => {
    filterChipRef.current = el;
    if (el && pendingFilterFocusReturn.current) {
      pendingFilterFocusReturn.current = false;
      el.focus({ preventScroll: true });
    }
  }, []);

  // Per-label ref callbacks for the action chips, cached so each chip gets
  // a stable function identity across renders instead of a fresh inline
  // arrow every time. Keyed on label + isFilter (not label alone) so two
  // different tabs reusing the same action label with different isFilter
  // values can't hand back a stale closure. The filter chip's callback
  // also folds in `setFilterChipRef` so `filterChipRef` + the
  // pending-focus-return flow above stay wired exactly as before.
  const actionChipRefCallbacks = useRef<
    Record<string, (el: HTMLButtonElement | null) => void>
  >({});
  const getActionChipRef = useCallback(
    (label: string, isFilter: boolean) => {
      const key = `${label}:${isFilter}`;
      let callback = actionChipRefCallbacks.current[key];
      if (!callback) {
        callback = (el: HTMLButtonElement | null) => {
          actionChipRefs.current[label] = el;
          if (isFilter) setFilterChipRef(el);
        };
        actionChipRefCallbacks.current[key] = callback;
      }
      return callback;
    },
    [setFilterChipRef]
  );

  const handleFilterKeyDown = (e: React.KeyboardEvent) => {
    const ids = filterOptions.map(o => o.id);
    const current = Math.max(0, ids.indexOf(filterFocusId ?? activeFilter));
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown")
      next = (current + 1) % ids.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (current - 1 + ids.length) % ids.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ids.length - 1;
    if (next !== null) {
      e.preventDefault();
      setFilterFocusId(ids[next]);
      filterOptionRefs.current[ids[next]]?.focus({ preventScroll: true });
    }
  };
  // Note: arrows move focus WITHOUT selecting — selection (Enter/Space →
  // native click → handleSelectFilter) triggers the confirm-hold
  // choreography, so focus-follows-selection would fire it on every
  // keystroke.

  // Sliding selection highlight, measured against the option buttons.
  // (Deliberately not framer's layoutId — shared-layout projection takes
  // over ancestors' transform origins and breaks the pill's left-anchored
  // collapse.)
  const filterOptionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [filterHighlight, setFilterHighlight] = useState<{
    x: number;
    w: number;
  } | null>(null);

  // The strip may still be WIDENING into the UtilityButton's space when
  // the options mount, so a single mount-time measurement can capture a
  // mid-animation layout. A ResizeObserver on the active option keeps
  // the highlight tracking the real geometry until it settles (and
  // through any later reflow).
  const filterHighlightObserver = useRef<ResizeObserver | null>(null);
  // Measure `id`'s option and keep the observer glued to IT. Called from
  // both the mount-time ref callback AND the activeFilter layout effect:
  // framer's motion.button hands the DOM one stable internal ref and only
  // invokes our callback on mount/unmount, so a selection change never
  // re-runs it — without the effect-side call the observer would stay on
  // the open-time option, whose stale closure then snaps the pill BACK to
  // the old value when the recolor reflows it (the "highlight never
  // slides" bug).
  const trackFilterOption = useCallback((id: string) => {
    const apply = () => {
      const target = filterOptionRefs.current[id];
      if (!target) return;
      setFilterHighlight(prev =>
        prev && prev.x === target.offsetLeft && prev.w === target.offsetWidth
          ? prev
          : { x: target.offsetLeft, w: target.offsetWidth }
      );
    };
    apply();
    filterHighlightObserver.current?.disconnect();
    const el = filterOptionRefs.current[id];
    if (el && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(apply);
      ro.observe(el);
      filterHighlightObserver.current = ro;
    }
  }, []);

  useLayoutEffect(() => {
    if (!isFilterExpanded) {
      setFilterHighlight(null);
      return;
    }
    // Selection slides: on activeFilter change the buttons already exist.
    // (Initial placement happens in the option ref callback instead — the
    // options mount AFTER this flag flips, once the label has exited.)
    if (!filterOptionRefs.current[activeFilter]) return;
    trackFilterOption(activeFilter);
  }, [isFilterExpanded, activeFilter, filterOptions, trackFilterOption]);

  const measureFilterOption = (id: string, el: HTMLButtonElement | null) => {
    filterOptionRefs.current[id] = el;
    if (el && isFilterExpanded && id === activeFilter) {
      trackFilterOption(id);
      if (!filterFocusApplied.current) {
        filterFocusApplied.current = true;
        el.focus({ preventScroll: true });
      }
    }
  };
  useEffect(() => {
    if (!isFilterExpanded) filterHighlightObserver.current?.disconnect();
  }, [isFilterExpanded]);
  useEffect(() => () => filterHighlightObserver.current?.disconnect(), []);

  const activeTabDef = tabs.find(t => t.id === activeTab) ?? tabs[0];
  const otherTabs = tabs.filter(t => t.id !== activeTabDef?.id);
  const menuTabs = [...otherTabs, activeTabDef].filter(Boolean) as Tab[];

  // APG menu: focus moves to the active row when the menu opens; the
  // roving pointer resets when it closes. rAF waits for the rows to mount.
  useEffect(() => {
    if (isNavigationMenuOpen) {
      const index = menuTabs.findIndex(t => t.id === activeTab);
      requestAnimationFrame(() =>
        menuItemRefs.current[Math.max(0, index)]?.focus({ preventScroll: true })
      );
    } else {
      setMenuFocusId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNavigationMenuOpen]);

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      closeMenu(false);
      return;
    }
    const ids = menuTabs.map(t => t.id);
    const current = Math.max(0, ids.indexOf(menuFocusId ?? activeTab));
    let next: number | null = null;
    if (e.key === "ArrowDown") next = (current + 1) % ids.length;
    else if (e.key === "ArrowUp")
      next = (current - 1 + ids.length) % ids.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ids.length - 1;
    if (next !== null) {
      e.preventDefault();
      setMenuFocusId(ids[next]);
      menuItemRefs.current[next]?.focus({ preventScroll: true });
    }
  };

  const actionsForTab = contextualActions[activeTab] ?? [];
  const hasActions = actionsForTab.length > 0;
  const hasFilterAction = actionsForTab.some(a => a.isFilter);

  const actionsRowFade = useScrollEdgeFade([
    activeTab,
    actionsForTab.length,
    isSearchOpen,
    isAssistantOpen,
    isFilterExpanded,
  ]);
  const filterRowFade = useScrollEdgeFade([
    filterOptions.length,
    isFilterExpanded,
  ]);

  const currentFilterOption = filterOptions.find(f => f.id === activeFilter);

  // The pill (glass-nav) is permanently composited by its backdrop-filter,
  // and the labels fade in DURING the regrow (labelFadeIn overlaps
  // centerExpand by design) — so Chromium can capture the layer's raster
  // mid-scale and keep the blurry version after the transform settles,
  // until any repaint (hover) refreshes it. When a regrow lands
  // (scaleX → 1), nudge an inherited paint property for one frame to
  // force a fresh raster at scale 1. Invisible: a zero-offset, zero-blur,
  // transparent text-shadow.
  const pillElRef = useRef<HTMLDivElement | null>(null);
  const setPillRef = useCallback(
    (el: HTMLDivElement | null) => {
      pillElRef.current = el;
      if (typeof actionBarRef === "function") actionBarRef(el);
      else if (actionBarRef)
        (
          actionBarRef as React.MutableRefObject<HTMLDivElement | null>
        ).current = el;
    },
    [actionBarRef]
  );
  const repaintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (repaintTimer.current) clearTimeout(repaintTimer.current);
    },
    []
  );
  const repaintPillText = () => {
    const nudge = () => {
      const el = pillElRef.current;
      if (!el) return;
      el.style.textShadow = "0 0 0 rgba(0, 0, 0, 0)";
      requestAnimationFrame(() => {
        el.style.textShadow = "";
      });
    };
    nudge();
    // The labels' own fade can tail out ~30ms after the pill's scale lands
    // (scroll expand); a second nudge covers rasters settled in that gap.
    if (repaintTimer.current) clearTimeout(repaintTimer.current);
    repaintTimer.current = setTimeout(nudge, 200);
  };

  // Transition helpers — per-property timing so containers move first and
  // opacities follow, keeping the three controls on one continuous path.
  // Interrupted input (rapid open/close) has one behavior everywhere:
  // framer retargets from the current animated value; nothing snaps.
  const centerPillTransition = {
    // The container's shape change (scaleX) runs the full transform band;
    // ease-in when collapsing (menu open, scroll collapse), ease-out when
    // regrowing. On menu open the bar is absorbed right-to-left into the
    // left button; on close/selection it regrows left-to-right.
    scaleX: menuOpening
      ? {
          duration: dur(DUR.direct),
          ease: EASE_IN,
          delay: del(OPEN_DELAYS.centerSquish),
        }
      : menuClosing
        ? {
            duration: dur(DUR.expand),
            ease: EASE_OUT,
            delay: del(CLOSE_DELAYS.pillGrow),
          }
        : {
            duration: dur(navCollapsing ? DUR.collapse : DUR.expand),
            ease: navCollapsing ? EASE_IN : EASE_OUT,
            // Scroll collapse waits for the undot beat, like menu open.
            delay: del(
              navCollapsing ? SCROLL_COLLAPSE_DELAYS.centerCollapse : 0
            ),
          },
    // The absorb origin flips instantly (left for menu/scroll) — never
    // animated, only the scale is. Sheets no longer touch the pill's
    // shape, so this is the only origin the pill ever holds.
    originX: { duration: 0 },
    opacity: navCollapsing
      ? {
          duration: dur(DUR.label),
          ease: EASE_IN,
          delay: del(SCROLL_COLLAPSE_DELAYS.pillFade),
        }
      : navExpanding
        ? { duration: dur(DUR.label), ease: EASE_OUT }
        : menuOpening
          ? {
              duration: dur(DUR.label),
              ease: EASE_IN,
              delay: del(OPEN_DELAYS.centerSquish + 0.04),
            }
          : menuClosing
            ? {
                duration: dur(0.1),
                ease: EASE_OUT,
                delay: del(CLOSE_DELAYS.pillGrow),
              }
            : { duration: dur(DUR.direct), ease: EASE },
    // Assistant stretch/contract — ease-out growing (transcript arrives
    // or grows), ease-in shrinking (message list trims or the mode
    // closes), matching the grammar used everywhere else in this file.
    height: {
      duration: dur(0.3),
      ease: assistantGrowing ? EASE_OUT : EASE_IN,
    },
  };
  const centerIconsTransition = navCollapsing
    ? {
        duration: dur(DUR.label),
        ease: EASE_IN,
        delay: del(SCROLL_COLLAPSE_DELAYS.labelFade),
      }
    : navExpanding
      ? {
          duration: dur(DUR.label),
          ease: EASE_OUT,
          delay: del(SCROLL_EXPAND_DELAYS.labelFadeIn),
        }
      : {
          duration: dur(0.14),
          ease: menuOpening ? EASE_IN : EASE_OUT,
          delay: del(
            menuOpening
              ? OPEN_DELAYS.centerIconsFade
              : menuClosing
                ? CLOSE_DELAYS.actionsFadeIn
                : 0
          ),
        };
  const menuGrowTransition = {
    duration: dur(menuOpening ? DUR.menuOpen : DUR.menuClose),
    ease: menuOpening ? EASE_OUT : EASE_IN,
    delay: del(menuOpening ? OPEN_DELAYS.menuGrow : CLOSE_DELAYS.menuFade),
  };
  // Right utility = the dot on a horizontal "i": it pops out FIRST before
  // any absorb (menu open or scroll collapse) and pops back in LAST, after
  // the bar has fully landed (menu close/selection or scroll expand).
  const rightDotOut = { duration: dur(DUR.label), ease: EASE_IN };
  const rightDotIn = (delay: number) => ({
    duration: dur(0.14),
    ease: EASE_OUT,
    delay: del(delay),
  });
  const utilityButtonTransition = {
    // Width changes happen while the button is invisible: collapsing after
    // the undot, restoring during the regrow, so layout never jumps in view.
    // Filter expansion reuses the rule — the width collapses after the
    // undot so the strip widens into the vacated space, and restores (the
    // strip contracting) before the button fades back in.
    width: isFilterExpanded
      ? {
          duration: dur(DUR.expand),
          ease: EASE_OUT,
          delay: del(FILTER_DELAYS.barGrow),
        }
      : filterClosing
        ? {
            duration: dur(DUR.direct),
            ease: EASE_IN,
            delay: del(FILTER_DELAYS.closeBarContract),
          }
        : {
            duration: dur(navCollapsing ? DUR.collapse : DUR.expand),
            ease: navCollapsing ? EASE_IN : EASE_OUT,
            delay: del(
              navCollapsing ? SCROLL_COLLAPSE_DELAYS.centerCollapse : 0
            ),
          },
    scale: navCollapsing
      ? rightDotOut
      : navExpanding
        ? rightDotIn(SCROLL_EXPAND_DELAYS.rightReveal)
        : menuOpening
          ? rightDotOut
          : menuClosing
            ? rightDotIn(CLOSE_DELAYS.utilityButtonFadeIn)
            : isFilterExpanded
              ? rightDotOut
              : filterClosing
                ? rightDotIn(FILTER_DELAYS.closeRightDotIn)
                : { duration: dur(0.16), ease: EASE },
    opacity: navCollapsing
      ? rightDotOut
      : navExpanding
        ? rightDotIn(SCROLL_EXPAND_DELAYS.rightReveal)
        : menuOpening
          ? rightDotOut
          : menuClosing
            ? rightDotIn(CLOSE_DELAYS.utilityButtonFadeIn)
            : isFilterExpanded
              ? rightDotOut
              : filterClosing
                ? rightDotIn(FILTER_DELAYS.closeRightDotIn)
                : // Sheet and assistant closes deliberately take this
                  // default — both ends return together, like search.
                  { duration: dur(0.16), ease: EASE },
  };

  return (
    <div className="relative px-[18px] pb-6 pointer-events-none" ref={navRef}>
      {/* Dock wash — canvas fades up behind the floating cluster so it reads
          against scrolling content (mirrors .pf__nav::before). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[170px] z-0"
        style={{
          background:
            "linear-gradient(to top, var(--bg-canvas) 26%, color-mix(in oklab, var(--accent-soft) 13%, var(--bg-canvas)) 58%, transparent 100%)",
        }}
      />
      {/* Filter scrim — the page dims SLIGHTLY (lighter than the sheet
          scrims) once the strip has claimed its space, keeping attention
          on the options while the bar itself stays bright. Sits below the
          z-10 cluster; tapping it dismisses. */}
      <AnimatePresence>
        {isFilterExpanded && hasFilterAction && !isCollapsed && (
          <motion.button
            key="filter-scrim"
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 z-0 pointer-events-auto cursor-pointer"
            style={{
              background: "var(--scrim-light)",
              border: 0,
              padding: 0,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{
              opacity: 0,
              transition: { duration: dur(0.15), ease: EASE_IN },
            }}
            transition={{
              duration: dur(0.2),
              ease: EASE,
              delay: del(FILTER_DELAYS.scrimFade),
            }}
            onClick={() => setIsFilterExpanded(false)}
          />
        )}
      </AnimatePresence>
      <div className="relative z-10 flex items-center gap-3 max-w-lg mx-auto">
        <div className="flex items-center gap-2 w-full px-1 relative z-10">
          {/* LEFT: Tab Switcher / Logo */}
          <motion.div
            ref={navigationMenuContainerRef}
            className="relative h-14 flex items-center"
            style={{
              pointerEvents: isBarSurrendered ? "none" : "auto",
            }}
            animate={{
              width: isBarSurrendered ? 0 : 56,
              // Sheets and takeovers now recede the circle exactly like
              // search/assistant — width and opacity together, not a
              // fade-in-place. Filter expansion leaves it FIXED — the strip
              // only claims the right button's space, and the page dims
              // instead.
              opacity: isBarSurrendered ? 0 : 1,
            }}
            transition={{ duration: dur(0.25), ease: EASE }}
          >
            <motion.div
              className="relative w-14 h-14 group pointer-events-auto"
              whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
              /* Collapsed press dips slightly deeper before the expansion. */
              whileTap={
                prefersReducedMotion
                  ? undefined
                  : { scale: isCollapsed ? 0.9 : 0.93 }
              }
              transition={{ duration: dur(0.18), ease: EASE }}
            >
              {/* Selected-navigation circle. Stays fully visible while the
                  menu is open — the menu grows out of it and the two read
                  as one attached surface. */}
              <div
                className="w-14 h-14 rounded-full"
                style={{
                  background: "var(--nav-circle-bg)",
                  border: "1.5px solid var(--nav-circle-border)",
                  boxShadow: "var(--circle-shadow)",
                  backdropFilter: "saturate(1.5) blur(var(--blur-lg))",
                  WebkitBackdropFilter: "saturate(1.5) blur(var(--blur-lg))",
                }}
              />
              {/* Accent hover glow — same affordance as the UtilityButton,
                  so both circles answer the cursor identically. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  boxShadow:
                    "0 0 20px -2px color-mix(in oklab, var(--accent-soft) 48%, transparent)",
                }}
              />
              {/* Pressed fill — a visible commit on top of the tap scale. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-150 group-active:opacity-100"
                style={{
                  background:
                    "color-mix(in oklab, var(--accent-700) 14%, transparent)",
                }}
              />
              {/* Absorb pulse — the border flares as the bar lands in the
                  circle, then settles. Remounted per landing (key) so the
                  keyframes re-run; sits above the glass, below the icon. */}
              {absorbPulse > 0 && (
                <motion.span
                  key={absorbPulse}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{
                    boxShadow:
                      "0 0 18px 4px color-mix(in oklab, var(--accent-soft) 60%, transparent), inset 0 0 0 1.5px color-mix(in oklab, var(--accent-700) 45%, transparent)",
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{
                    duration: dur(0.34),
                    times: [0, 0.3, 1],
                    ease: EASE,
                  }}
                />
              )}

              <motion.button
                ref={navigationButtonRef}
                type="button"
                onClick={handleNavigationButtonClick}
                className="nav-circle-trigger absolute inset-[2px] rounded-full flex items-center justify-center transition-colors"
                style={{ color: "var(--accent-700)" }}
                aria-label={isCollapsed ? "Open controls" : undefined}
                title={isCollapsed ? "Open controls" : undefined}
                aria-haspopup="menu"
                aria-expanded={isNavigationMenuOpen}
                aria-controls={isNavigationMenuOpen ? menuId : undefined}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeTabDef?.id ?? "logo"}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{
                      duration: dur(0.15),
                      ease: EASE,
                      delay: del(
                        navCollapsing
                          ? SCROLL_COLLAPSE_DELAYS.logoFadeIn - 0.08
                          : navExpanding
                            ? SCROLL_EXPAND_DELAYS.tabIconFadeIn
                            : menuClosing
                              ? // Selection: icon swaps as the menu clears
                                // the button, not before.
                                CLOSE_DELAYS.tabIconSwap
                              : 0
                      ),
                    }}
                    className="flex items-center justify-center"
                  >
                    {/* Collapsed and expanded show the SAME current-tab
                        icon — the collapsed circle is the left control,
                        not a different button. Logo is the no-tab
                        fallback only. */}
                    {activeTabDef ? (
                      <NavIcon
                        Icon={activeTabDef.Icon}
                        className="w-6 h-6"
                        size={24}
                        strokeWidth={1.85}
                      />
                    ) : (
                      (logo ?? <DefaultLogo />)
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.button>
            </motion.div>

            {/* Tab Menu — CSS-anchored: bottom-left corner at the circle's
                center, overlapping the button footprint, attached through
                any resize. Origin-based reveal: upward expansion, slight
                rightward growth, fade, corner-radius settle, and elevation
                rising as it clears the button. */}
            <AnimatePresence>
              {isNavigationMenuOpen && (
                <motion.div
                  key="tab-menu"
                  id={menuId}
                  role="menu"
                  aria-label="Navigate"
                  onKeyDown={handleMenuKeyDown}
                  initial={{
                    opacity: 0,
                    scaleX: 0.85,
                    scaleY: 0.45,
                    borderRadius: 28,
                    boxShadow:
                      "0 4px 14px rgb(20 20 10 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.9)",
                  }}
                  animate={{
                    opacity: 1,
                    scaleX: 1,
                    scaleY: 1,
                    borderRadius: 21,
                    boxShadow:
                      "0 18px 44px rgb(20 20 10 / 0.16), inset 0 1px 0 rgb(255 255 255 / 0.9)",
                  }}
                  exit={{
                    opacity: 0,
                    scaleX: 0.88,
                    scaleY: 0.5,
                    borderRadius: 28,
                    boxShadow:
                      "0 4px 14px rgb(20 20 10 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.9)",
                  }}
                  transition={menuGrowTransition}
                  className="glass-overlay absolute z-40 pointer-events-auto p-1.5 min-w-[210px] overflow-hidden"
                  style={{
                    left: MENU_ANCHOR.left,
                    bottom: MENU_ANCHOR.bottom,
                    transformOrigin: "left bottom",
                    originX: 0,
                    originY: 1,
                  }}
                >
                  <div>
                    {menuTabs.map((tab, rowIndex) => {
                      const isActive = tab.id === activeTab;
                      // During the confirmation hold the highlight belongs
                      // to the pressed row; the divider stays put (it
                      // follows the committed tab) so rows never reflow.
                      const isHighlighted =
                        tab.id === (pendingTab ?? activeTab);
                      const Icon = tab.Icon;
                      return (
                        <React.Fragment key={tab.id}>
                          {isActive && (
                            <div
                              role="separator"
                              className="h-px my-1 mx-2"
                              style={{ background: "var(--border-subtle)" }}
                            />
                          )}
                          <motion.button
                            type="button"
                            /* menuitemradio: exactly one tab is current, and
                               AT should say so — aria-checked follows the
                               COMMITTED tab (not the confirmation-hold
                               highlight, which is visual choreography). */
                            role="menuitemradio"
                            aria-checked={isActive}
                            ref={el => {
                              menuItemRefs.current[rowIndex] = el;
                            }}
                            tabIndex={
                              (menuFocusId ?? activeTab) === tab.id ? 0 : -1
                            }
                            onClick={() => handleSelectTab(tab.id)}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{
                              duration: dur(0.14),
                              ease: EASE,
                              delay: del(
                                OPEN_DELAYS.menuGrow +
                                  rowIndex * MENU_ROW_STAGGER
                              ),
                            }}
                            whileTap={
                              prefersReducedMotion ? undefined : { scale: 0.97 }
                            }
                            className={cn(
                              "nav-menu-item flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm w-full text-left transition-colors duration-200",
                              isHighlighted
                                ? "font-semibold bg-[var(--select-bg)] text-[var(--select-fg)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--action-ghost-bg-hover)] hover:text-[var(--text-primary)]"
                            )}
                          >
                            <div className="flex items-center justify-center w-6 h-6">
                              <Icon
                                strokeWidth={1.75}
                                className="w-5 h-5"
                                style={{ opacity: 0.85 }}
                              />
                            </div>
                            <span>{tab.label}</span>
                          </motion.button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* CENTER: Actions pill / Filter expansion */}
          {hasActions && (
            <motion.div
              ref={setPillRef}
              className={cn(
                "relative flex-1 overflow-hidden pointer-events-auto z-10 min-w-0",
                "glass-nav",
                "px-2.5 py-[5px]"
              )}
              style={{
                // rounded-full (9999px) would turn a stretched, tall card
                // into a lozenge — 24px reads identically at the resting
                // 48px height and gives proper card corners once the
                // assistant transcript grows it.
                borderRadius: 24,
                pointerEvents:
                  isNavigationMenuOpen || isCollapsed || isSheetOpen
                    ? "none"
                    : "auto",
              }}
              animate={{
                // Menu open ABSORBS the bar — fully hidden, not dimmed.
                // Sheets no longer touch the pill's opacity/shape; they
                // only recede the circles (see isBarSurrendered).
                opacity: isCollapsed || isNavigationMenuOpen ? 0 : 1,
                scaleX: isCollapsed || isNavigationMenuOpen ? 0 : 1,
                // Animated alongside scaleX so framer holds the origin every
                // frame. The bar absorbs left, toward the menu/scroll
                // circle — the only absorb left once sheets stopped
                // sweeping the pill.
                originX: 0,
                // The assistant's transcript grows the card in place — a
                // real height animation, never scaleY (text must not
                // distort).
                height: assistantHeight,
              }}
              transition={centerPillTransition}
              onAnimationComplete={definition => {
                // Every regrow path (scroll expand, menu close) ends at
                // scaleX 1 — re-raster once it lands.
                if ((definition as { scaleX?: number }).scaleX === 1)
                  repaintPillText();
              }}
            >
              {/* `custom` feeds the CURRENT filter state to exiting
                  children — AnimatePresence otherwise resolves an exiting
                  child's props from its last render BEFORE removal, where
                  isFilterExpanded was still false, and the label-hold
                  delay silently vanishes from the second open onward. */}
              <AnimatePresence
                mode="wait"
                custom={isFilterExpanded && hasFilterAction}
              >
                {renderAssistantBranch ? (
                  <motion.div
                    key="assistant"
                    initial={{ clipPath: "inset(0 0 0 100%)" }}
                    // Open and close are BOTH animate retargets on the
                    // mounted branch (see the assistantHeld block for why
                    // this isn't an AnimatePresence exit). Close mirrors
                    // the open wipe on search's band; the height
                    // contraction (assistantHeight → 48) runs concurrently
                    // so both ends of the bar return together, like
                    // search-close.
                    animate={
                      isAssistantOpen
                        ? { clipPath: "inset(0 0 0 0%)", opacity: 1 }
                        : { clipPath: "inset(0 0 0 100%)", opacity: 0 }
                    }
                    // By unmount time the wipe has already landed — the
                    // exit is an instant formality so mode="wait" hands
                    // the pill to the next branch without a second beat.
                    exit={{ opacity: 0, transition: { duration: 0 } }}
                    transition={
                      isAssistantOpen
                        ? {
                            duration: dur(0.24),
                            ease: EASE,
                            delay: del(0.06),
                          }
                        : {
                            clipPath: {
                              duration: dur(ASSISTANT_CLOSE_WIPE_S),
                              ease: EASE_IN,
                              delay: del(ASSISTANT_CLOSE_WIPE_DELAY_S),
                            },
                            opacity: {
                              duration: dur(ASSISTANT_CLOSE_WIPE_S),
                              ease: EASE_IN,
                              delay: del(ASSISTANT_CLOSE_WIPE_DELAY_S),
                            },
                          }
                    }
                    className="flex flex-col w-full h-full"
                    onKeyDown={e => {
                      // Escape closes from anywhere inside the pill (menu/filter
                      // pattern) — the transcript is focusable-scrollable in Task 2.
                      if (e.key === "Escape") onAssistantClose?.();
                    }}
                  >
                    {hasTranscript && (
                      <motion.div
                        ref={transcriptScrollRef}
                        role="log"
                        aria-live="polite"
                        aria-label="Assistant conversation"
                        tabIndex={0}
                        // Fades ahead of the branch's delayed wipe. An
                        // animate retarget (not an exit) so a rapid reopen
                        // mid-close restores it — an exit-only value has no
                        // animate counterpart to be restored TO, and framer
                        // leaves it stranded at 0 (the empty-card bug).
                        animate={{ opacity: isAssistantOpen ? 1 : 0 }}
                        transition={{
                          duration: dur(0.12),
                          ease: isAssistantOpen ? EASE_OUT : EASE_IN,
                        }}
                        className="flex-1 min-h-0 overflow-y-auto px-2 pt-3"
                        style={{ overscrollBehaviorY: "contain" }}
                      >
                        <div
                          ref={setTranscriptContentRef}
                          className="flex flex-col gap-2 pb-2"
                        >
                          {assistantMessages.map(m => (
                            <motion.div
                              key={m.id}
                              aria-hidden={m.pending || undefined}
                              initial={{
                                opacity: 0,
                                y: prefersReducedMotion ? 0 : 20,
                              }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                duration: dur(DUR.direct),
                                ease: EASE_OUT,
                              }}
                              className={cn(
                                "nav-assistant-bubble",
                                m.role === "user"
                                  ? "nav-assistant-bubble--user"
                                  : "nav-assistant-bubble--assistant"
                              )}
                            >
                              {m.pending ? (
                                <span
                                  className="nav-assistant-shimmer"
                                  aria-hidden="true"
                                />
                              ) : (
                                m.text
                              )}
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                    {/* Stretched only: the row floats 6px off the card's
                        bottom edge (accounted in assistantHeight). At rest
                        it must fill the 36px content box exactly. */}
                    <div
                      className={cn(
                        "flex items-center gap-2 w-full h-9 shrink-0 px-2",
                        hasTranscript && "mb-1.5"
                      )}
                    >
                      <Sparkles
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0"
                        strokeWidth={2}
                        style={{ color: "var(--text-tertiary)" }}
                      />
                      <input
                        ref={assistantInputRef}
                        type="text"
                        aria-label="Ask the assistant"
                        value={assistantDraft}
                        placeholder={assistantPlaceholder}
                        onChange={e => setAssistantDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleAssistantSubmit();
                        }}
                        onFocus={() =>
                          setAssistantFocusRing(lastInputWasKeyboard.current)
                        }
                        data-kbd={assistantFocusRing ? "true" : undefined}
                        className="nav-search-input min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-[color:var(--text-quaternary)]"
                        style={{ color: "var(--text-primary)" }}
                      />
                      {assistantDraft && (
                        <button
                          type="button"
                          onClick={() => {
                            setAssistantDraft("");
                            assistantInputRef.current?.focus({
                              preventScroll: true,
                            });
                          }}
                          aria-label="Clear message"
                          className="nav-search-control shrink-0 rounded-full p-1.5 transition-colors hover:bg-[var(--action-ghost-bg-hover)]"
                        >
                          <X
                            className="h-4 w-4"
                            strokeWidth={2.25}
                            style={{ color: "var(--text-secondary)" }}
                          />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onAssistantClose}
                        className="nav-search-control shrink-0 rounded-full px-2.5 py-1.5 text-[13px] font-semibold transition-colors hover:bg-[var(--action-ghost-bg-hover)]"
                        style={{ color: "var(--select-fg)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                ) : isSearchOpen ? (
                  /* Search mode: wipes in right-to-left from the trigger,
                     slightly after the left control begins receding, so the
                     morph reads as one motion. Entry is a full transform
                     (search band); exit is a direct interaction. */
                  <motion.div
                    key="search"
                    role="search"
                    initial={{ clipPath: "inset(0 0 0 100%)" }}
                    animate={{ clipPath: "inset(0 0 0 0%)" }}
                    exit={{ clipPath: "inset(0 0 0 100%)", opacity: 0 }}
                    transition={{
                      duration: dur(0.24),
                      ease: EASE,
                      delay: del(0.06),
                    }}
                    className="flex items-center gap-2 w-full h-full px-2"
                  >
                    <SearchGlyph
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0"
                      strokeWidth={2}
                      style={{ color: "var(--text-tertiary)" }}
                    />
                    <input
                      ref={searchInputRef}
                      type="text"
                      aria-label="Search"
                      value={searchQuery}
                      placeholder={searchPlaceholder}
                      onChange={e => {
                        setSearchQuery(e.target.value);
                        onSearchChange?.(e.target.value);
                      }}
                      onKeyDown={e => {
                        if (e.key === "Escape") onSearchClose?.();
                        if (e.key === "Enter") {
                          onSearchSubmit?.(searchQuery);
                          onSearchClose?.();
                        }
                      }}
                      onFocus={() =>
                        setSearchFocusRing(lastInputWasKeyboard.current)
                      }
                      data-kbd={searchFocusRing ? "true" : undefined}
                      className="nav-search-input min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-[color:var(--text-quaternary)]"
                      style={{ color: "var(--text-primary)" }}
                    />
                    {/* Clear resets the query; Cancel exits search. Two
                        controls, two verbs — never one button doing both. */}
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          onSearchChange?.("");
                          searchInputRef.current?.focus({
                            preventScroll: true,
                          });
                        }}
                        aria-label="Clear search"
                        className="nav-search-control shrink-0 rounded-full p-1.5 transition-colors hover:bg-[var(--action-ghost-bg-hover)]"
                      >
                        <X
                          className="h-4 w-4"
                          strokeWidth={2.25}
                          style={{ color: "var(--text-secondary)" }}
                        />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onSearchClose}
                      className="nav-search-control shrink-0 rounded-full px-2.5 py-1.5 text-[13px] font-semibold transition-colors hover:bg-[var(--action-ghost-bg-hover)]"
                      style={{ color: "var(--select-fg)" }}
                    >
                      Cancel
                    </button>
                  </motion.div>
                ) : isFilterExpanded && hasFilterAction ? (
                  <motion.div
                    key="filter-options"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    /* Close, beat one: options fade out fast so the updated
                       chip label can return while the strip is still wide —
                       the contraction (right button width restoring) waits
                       for closeBarContract. */
                    exit={{
                      opacity: 0,
                      transition: { duration: dur(0.12), ease: EASE_IN },
                    }}
                    transition={{ duration: dur(0.15), ease: EASE }}
                    ref={filterRowFade.ref}
                    onScroll={filterRowFade.onScroll}
                    role="radiogroup"
                    aria-label={`${actionsForTab.find(a => a.isFilter)?.label ?? "Filter"} options`}
                    onKeyDown={handleFilterKeyDown}
                    className="relative flex items-center gap-1.5 w-full h-full overflow-x-auto overflow-y-hidden scrollbar-hide"
                    style={{
                      touchAction: "pan-x",
                      overscrollBehaviorX: "contain",
                      ...filterRowFade.style,
                    }}
                  >
                    {/* Measured sliding highlight — glides between values on
                        selection instead of blinking chip to chip. */}
                    {filterHighlight && (
                      <motion.span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-0 rounded-full"
                        style={{
                          top: "50%",
                          y: "-50%",
                          height: 34,
                          background: "var(--select-bg)",
                          border: "1px solid var(--select-border)",
                          boxShadow: "var(--shadow-xs)",
                        }}
                        initial={{
                          opacity: 0,
                          x: filterHighlight.x,
                          width: filterHighlight.w,
                        }}
                        animate={{
                          opacity: 1,
                          x: filterHighlight.x,
                          width: filterHighlight.w,
                        }}
                        transition={{
                          opacity: {
                            duration: dur(0.14),
                            ease: EASE,
                            delay: del(FILTER_DELAYS.optionsFadeIn),
                          },
                          x: { duration: dur(DUR.direct), ease: EASE },
                          width: { duration: dur(DUR.direct), ease: EASE },
                        }}
                      />
                    )}
                    {filterOptions.map((option, index) => {
                      const isActive = option.id === activeFilter;
                      // Coloring lags selection by the pill's slide (see
                      // pendingFilterVisual); aria-checked does not.
                      const isVisuallyActive =
                        option.id === (pendingFilterVisual ?? activeFilter);
                      return (
                        <motion.button
                          key={option.id}
                          ref={el => measureFilterOption(option.id, el)}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          tabIndex={
                            (filterFocusId ?? activeFilter) === option.id
                              ? 0
                              : -1
                          }
                          onClick={() => handleSelectFilter(option.id)}
                          /* Scale/fade only — a y offset here creates
                             transient vertical overflow inside the scroll
                             row, which strands chips mid-scroll. */
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.92 }}
                          transition={{
                            duration: dur(0.16),
                            ease: EASE,
                            delay: del(
                              FILTER_DELAYS.optionsFadeIn +
                                index * FILTER_DELAYS.optionStagger
                            ),
                          }}
                          whileTap={
                            prefersReducedMotion ? undefined : { scale: 0.96 }
                          }
                          className={cn(
                            "nav-filter-option relative z-10 flex-[1_1_0%] min-w-fit h-[34px] px-4 rounded-full text-[13px] font-medium whitespace-nowrap",
                            "transition-colors duration-200",
                            isVisuallyActive
                              ? "text-[color:var(--select-fg)]"
                              : "nav-action-chip text-[color:var(--text-secondary)]"
                          )}
                        >
                          {option.label}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                ) : (
                  <motion.div
                    key="actions"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isCollapsed ? 0 : 1 }}
                    /* Exiting to the filter strip: the label HOLDS while the
                       right button undots and the strip widens, then fades —
                       geometry before label, per the serial-beats grammar.
                       (mode="wait" then mounts the options after this.)
                       The exit variant resolves against AnimatePresence's
                       `custom`, so it sees the CURRENT exit reason. */
                    custom={isFilterExpanded && hasFilterAction}
                    variants={{
                      /* Both branches pin an explicit transition: a bare
                         `{ opacity: 0 }` inherits the `transition` PROP as
                         captured at the row's last render — if that render
                         happened mid menu-close, the search-open exit
                         silently carries menuClosing's 0.39s delay. */
                      exit: (toFilter: boolean) =>
                        toFilter
                          ? {
                              opacity: 0,
                              transition: {
                                duration: dur(0.12),
                                ease: EASE_IN,
                                delay: del(FILTER_DELAYS.labelFade),
                              },
                            }
                          : {
                              opacity: 0,
                              transition: {
                                duration: dur(0.14),
                                ease: EASE_IN,
                              },
                            },
                    }}
                    exit="exit"
                    transition={centerIconsTransition}
                    ref={actionsRowFade.ref}
                    onScroll={actionsRowFade.onScroll}
                    className="flex items-center gap-1.5 h-full w-full overflow-x-auto overflow-y-hidden scrollbar-hide"
                    style={{
                      touchAction: "pan-x",
                      overscrollBehaviorX: "contain",
                      ...actionsRowFade.style,
                    }}
                  >
                    {actionsForTab.map((action, actionIndex) => {
                      const isFilter = action.isFilter === true;
                      const isEngaged =
                        !isFilter && activeAction === action.label;
                      return (
                        <React.Fragment key={action.label}>
                          {actionIndex > 0 && (
                            <motion.span
                              aria-hidden="true"
                              className="nav-action-divider"
                              animate={{
                                opacity: isSheetOpen ? 0 : 1,
                              }}
                              transition={{
                                duration: dur(0.12),
                                ease: EASE_IN,
                                delay: del(
                                  isSheetOpen ? SHEET_DELAYS.labelFade : 0
                                ),
                              }}
                            />
                          )}
                          <motion.button
                            type="button"
                            ref={getActionChipRef(action.label, isFilter)}
                            aria-expanded={
                              isFilter ? isFilterExpanded : undefined
                            }
                            onClick={() => {
                              if (isFilter) {
                                handleFilterClick();
                                return;
                              }
                              onActionClick?.(action.label, activeTab);
                            }}
                            className={cn(
                              /* min-w-fit: with few actions chips stretch to
                                 fill; with many the row scrolls horizontally
                                 instead of squishing labels. */
                              "nav-action-chip group/action flex-[1_1_0%] min-w-fit h-[34px] px-4 rounded-full flex items-center justify-center text-center",
                              isEngaged && "nav-action-chip--active"
                            )}
                            whileTap={
                              prefersReducedMotion ? undefined : { scale: 0.96 }
                            }
                            /* Sheet clear-out, beat two: all labels
                               (dividers included) leave together, one beat
                               after the circles, before the surface mounts. */
                            animate={{ opacity: isSheetOpen ? 0 : 1 }}
                            transition={{
                              duration: dur(0.14),
                              ease: EASE,
                              opacity: {
                                duration: dur(0.12),
                                ease: EASE_IN,
                                delay: del(
                                  isSheetOpen ? SHEET_DELAYS.labelFade : 0
                                ),
                              },
                            }}
                          >
                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                              {isFilter ? (
                                /* Value + chevron: a control cue, not a CTA.
                                   Medium weight distinguishes "current value"
                                   from the heavier action verbs. */
                                <>
                                  <span className="text-[14px] font-medium text-inherit">
                                    {currentFilterOption?.label ?? action.label}
                                  </span>
                                  <ChevronDown
                                    aria-hidden="true"
                                    className={cn(
                                      "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                                      isFilterExpanded && "rotate-180"
                                    )}
                                    strokeWidth={2.25}
                                    style={{ color: "var(--text-tertiary)" }}
                                  />
                                </>
                              ) : (
                                <>
                                  {action.showIcon !== false && (
                                    <NavIcon
                                      Icon={action.Icon}
                                      size={16}
                                      className="text-[color:var(--text-tertiary)]"
                                    />
                                  )}
                                  <span className="text-[14px] font-semibold tracking-[-0.01em] text-inherit">
                                    {action.label}
                                  </span>
                                </>
                              )}
                            </span>
                          </motion.button>
                        </React.Fragment>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* RIGHT: Action button (Chat/AI) */}
          {showUtilityButton && utilityAction && (
            <motion.div
              className="relative h-14 flex items-center"
              style={{
                // Disabled the moment a utility transition begins — the
                // surface owns the interaction until it closes.
                pointerEvents:
                  isNavigationMenuOpen ||
                  isCollapsed ||
                  isBarSurrendered ||
                  isFilterExpanded
                    ? "none"
                    : "auto",
              }}
              animate={{
                // Filter expansion vacates the button's space entirely —
                // the strip widens into it (width collapses only after the
                // undot fade; see utilityButtonTransition).
                width:
                  isCollapsed || isBarSurrendered || isFilterExpanded ? 0 : 56,
                // Hidden states shrink it slightly as it fades, so every
                // return reads as a pop-in — dotting the horizontal "i".
                scale:
                  isCollapsed ||
                  isBarSurrendered ||
                  isNavigationMenuOpen ||
                  isFilterExpanded
                    ? 0.7
                    : 1,
                opacity:
                  // Menu open and filter expansion hide the right utility
                  // entirely (first out, last back); sheets and takeovers
                  // recede it exactly like search/assistant (isBarSurrendered).
                  isCollapsed ||
                  isBarSurrendered ||
                  isNavigationMenuOpen ||
                  isFilterExpanded
                    ? 0
                    : 1,
              }}
              transition={utilityButtonTransition}
            >
              <motion.button
                ref={utilityButtonRef}
                type="button"
                onClick={onUtilityClick}
                aria-label={utilityAction.label}
                aria-haspopup={utilityAction.opensDialog ? "dialog" : undefined}
                /* Gated like aria-haspopup: a one-shot utility action must
                   not permanently announce "collapsed". Search isn't a
                   dialog and unmounts this button while open, so it carries
                   no expanded state either. `isSheetOpen` alone can't tell
                   a utility sheet from a workflow one — but `activeAction`
                   is truthy for the whole lifetime of a workflow-chip sheet
                   (set at press, cleared in onExitComplete), so excluding
                   that case leaves only sheets this button itself opened. */
                aria-expanded={
                  utilityAction.opensDialog
                    ? isSheetOpen && !activeAction
                    : undefined
                }
                className="nav-circle-trigger group relative w-14 h-14 rounded-full flex items-center justify-center pointer-events-auto"
                whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.93 }}
                transition={{ duration: dur(0.18), ease: EASE }}
              >
                {/* Neutral action circle: frosted white with a muted
                    border and dark icon. Deliberately quieter than
                    the selected navigation circle on the left. */}
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "var(--utility-circle-bg)",
                    border: "1px solid var(--utility-circle-border)",
                    boxShadow: "var(--circle-shadow)",
                    backdropFilter: "saturate(1.4) blur(var(--blur-lg))",
                    WebkitBackdropFilter: "saturate(1.4) blur(var(--blur-lg))",
                  }}
                />
                {/* Accent hover glow */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    boxShadow:
                      "0 0 20px -2px color-mix(in oklab, var(--accent-soft) 48%, transparent)",
                  }}
                />
                {/* Pressed fill — a visible commit on top of the tap
                    scale, matching the NavigationButton. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-150 group-active:opacity-100"
                  style={{
                    background:
                      "color-mix(in oklab, var(--accent-700) 14%, transparent)",
                  }}
                />
                <span className="relative z-10 flex items-center justify-center">
                  <NavIcon
                    Icon={utilityAction.Icon}
                    size={22}
                    strokeWidth={2}
                    className="text-[color:var(--gray-900)]"
                  />
                </span>
              </motion.button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};
