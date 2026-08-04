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

import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { ChevronDown, Search as SearchGlyph, X } from "lucide-react";

// Default collapsed-state glyph: a small aurora dot. A brand mark, not a
// placeholder icon — consumers pass `logo` to supply their own.
const DefaultLogo = () => (
  <span
    aria-hidden="true"
    className="block h-5 w-5 rounded-full"
    style={{
      background: "var(--gradient-aurora)",
      boxShadow:
        "0 0 0 3px color-mix(in oklab, var(--aurora-lilac) 28%, transparent), inset 0 1px 1px rgba(255,255,255,0.6)",
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
};

export type FilterOption = {
  id: string;
  label: string;
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

// ── Utility bottom sheets (Export, Assistant) — serial beats mirroring
//    the workflow sheet but anchored to the RIGHT button:
//    1. utility shows its pressed state (tap feedback),
//    2. the nav circle fades out,
//    3. the action bar collapses inward, left edge sweeping right,
//    4. the utility fades WHILE the sheet widens out of its footprint.
//    Close reverses: sheet contracts onto the button, utility fades back
//    in, the bar regrows, the nav circle returns last.
const UTILITY_SHEET_DELAYS = {
  leftFade: 0.0, // 2. nav circle out first
  barCollapse: 0.16, // 3. bar sweeps into the right button (dur ≈ direct)
  barFade: 0.24, //    pill surface fades late in the sweep
  rightFade: 0.4, // 4. utility fades as the sheet takes over its footprint
  closeRightFadeIn: 0.0, // sheet has landed on the button; button returns
  closeBarGrow: 0.16, // bar regrows out of it
  closeLeftFadeIn: 0.4, // nav circle dots the other end last
};

// ── Filter expansion — serial beats. The strip claims the RIGHT button's
//    space (the left circle never moves):
//    1. pressed feedback on the chip, the right utility pops out,
//    2. its width collapses so the strip widens into the vacated space,
//    3. the selected label fades once the strip has landed; the page dims,
//    4. the options reveal with the current value highlighted.
//    Selection: highlight slides → confirm hold → options fade → the chip
//    label returns (updated) while the strip is still wide → the strip
//    contracts → the right utility dots the i last.
// ── Clear-out windows for launching sheet surfaces from the bar ─────────
//    Consumers flip isActionSheetOpen / isUtilitySheetOpen, wait the
//    matching window, then mount their surface (see the demo stage). Both
//    derive from the delay tables above × TEMPO, so retuning the tempo or
//    the beats keeps launch timing in sync automatically.
// Workflow sheets: circles + labels fade (labels land ≈0.28) + a beat
// before the emptied bar begins its widen.
export const ACTION_SHEET_CLEAROUT_MS = Math.round(
  (0.28 + 0.06) * TEMPO * 1000
);
// Utility surfaces: mount as the UtilityButton begins its own fade.
export const UTILITY_CLEAROUT_MS = Math.round(
  UTILITY_SHEET_DELAYS.rightFade * TEMPO * 1000
);

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
   *  reserved for real state: only this ActionButton gets the lavender
   *  inset fill. */
  activeAction?: string | null;
  /** Glyph shown when no tab is active. Defaults to the aurora-dot brand
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
  /** Exposes the UtilityButton element — the shared origin that utility
   *  surfaces grow out of and contract back into. */
  utilityButtonRef?: React.Ref<HTMLButtonElement>;
  /** Exposes the ContextualActionBar element — the shared origin that
   *  workflow sheets grow out of on action press. */
  actionBarRef?: React.Ref<HTMLDivElement>;
  /** Workflow-sheet fade phase: the side circles and unselected actions
   *  fade out, leaving the empty bar in place as the surface a workflow
   *  sheet stretches out of. Flip this, wait ACTION_SHEET_CLEAROUT_MS,
   *  then mount the sheet. */
  isActionSheetOpen?: boolean;
  /** Utility bottom sheets: the NavigationButton fades first, the bar
   *  collapses inward toward the UtilityButton, and the UtilityButton
   *  itself fades as the sheet widens out of it. Flip this, wait
   *  UTILITY_CLEAROUT_MS, then mount the surface. Search and full-screen
   *  takeovers use their own sequences. */
  isUtilitySheetOpen?: boolean;
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
  utilityButtonRef,
  actionBarRef,
  isActionSheetOpen = false,
  isUtilitySheetOpen = false,
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
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(
    externalActiveTab || tabs[0]?.id || "home"
  );

  const prefersReducedMotion = useReducedMotion();
  const dur = (d: number) => (prefersReducedMotion ? 0 : d * TEMPO);
  const del = (d: number) => (prefersReducedMotion ? 0 : d * TEMPO);

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

  useEffect(() => {
    if (isSearchOpen) {
      setIsNavigationMenuOpen(false);
      setIsFilterExpanded(false);
      setSearchQuery("");
      // Focus only once the field has reached most of its final width, so
      // the mobile keyboard doesn't jump the viewport mid-morph.
      const t = setTimeout(
        () => searchInputRef.current?.focus(),
        prefersReducedMotion ? 0 : 220 * TEMPO
      );
      return () => clearTimeout(t);
    }
  }, [isSearchOpen, prefersReducedMotion]);

  // A sheet surface is exclusive: it closes the NavigationMenu and the
  // FilterOptionSet, and the bar's own controls lock as soon as the
  // transition begins.
  useEffect(() => {
    if (isActionSheetOpen || isUtilitySheetOpen) {
      setIsNavigationMenuOpen(false);
      setIsFilterExpanded(false);
    }
  }, [isActionSheetOpen, isUtilitySheetOpen]);

  const prevUtilitySheetRef = useRef(isUtilitySheetOpen);
  useEffect(() => {
    prevUtilitySheetRef.current = isUtilitySheetOpen;
  }, [isUtilitySheetOpen]);
  const utilitySheetClosing =
    !isUtilitySheetOpen && prevUtilitySheetRef.current;

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
    if (returnFocus) navigationButtonRef.current?.focus();
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
        navigationButtonRef.current?.focus();
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
  useEffect(
    () => () => {
      if (filterCloseTimer.current) clearTimeout(filterCloseTimer.current);
    },
    []
  );

  const handleSelectFilter = (filterId: string) => {
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

  // Sliding selection highlight, measured against the option buttons.
  // (Deliberately not framer's layoutId — shared-layout projection takes
  // over ancestors' transform origins and breaks the pill's left-anchored
  // collapse.)
  const filterOptionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [filterHighlight, setFilterHighlight] = useState<{
    x: number;
    w: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (!isFilterExpanded) {
      setFilterHighlight(null);
      return;
    }
    // Selection slides: on activeFilter change the buttons already exist.
    // (Initial placement happens in the option ref callback instead — the
    // options mount AFTER this flag flips, once the label has exited.)
    const el = filterOptionRefs.current[activeFilter];
    if (!el) return;
    setFilterHighlight({ x: el.offsetLeft, w: el.offsetWidth });
  }, [isFilterExpanded, activeFilter, filterOptions]);

  // The strip may still be WIDENING into the UtilityButton's space when
  // the options mount, so a single mount-time measurement can capture a
  // mid-animation layout. A ResizeObserver on the active option keeps
  // the highlight tracking the real geometry until it settles (and
  // through any later reflow).
  const filterHighlightObserver = useRef<ResizeObserver | null>(null);
  const measureFilterOption = (id: string, el: HTMLButtonElement | null) => {
    filterOptionRefs.current[id] = el;
    if (el && isFilterExpanded && id === activeFilter) {
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
      if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(apply);
        ro.observe(el);
        filterHighlightObserver.current = ro;
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
  const actionsForTab = contextualActions[activeTab] ?? [];
  const hasActions = actionsForTab.length > 0;
  const hasFilterAction = actionsForTab.some(a => a.isFilter);

  const actionsRowFade = useScrollEdgeFade([
    activeTab,
    actionsForTab.length,
    isSearchOpen,
    isFilterExpanded,
  ]);
  const filterRowFade = useScrollEdgeFade([
    filterOptions.length,
    isFilterExpanded,
  ]);

  const currentFilterOption = filterOptions.find(f => f.id === activeFilter);

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
        : isUtilitySheetOpen
          ? // Utility sheet: the bar sweeps inward toward the right button
            // AFTER the nav circle has left.
            {
              duration: dur(DUR.direct),
              ease: EASE_IN,
              delay: del(UTILITY_SHEET_DELAYS.barCollapse),
            }
          : utilitySheetClosing
            ? // Regrows out of the button once the utility has returned.
              {
                duration: dur(DUR.expand),
                ease: EASE_OUT,
                delay: del(UTILITY_SHEET_DELAYS.closeBarGrow),
              }
            : {
                duration: dur(navCollapsing ? DUR.collapse : DUR.expand),
                ease: navCollapsing ? EASE_IN : EASE_OUT,
                // Scroll collapse waits for the undot beat, like menu open.
                delay: del(
                  navCollapsing ? SCROLL_COLLAPSE_DELAYS.centerCollapse : 0
                ),
              },
    // The absorb origin flips instantly (left for menu/scroll, right for
    // utility surfaces) — never animated, only the scale is. Exception:
    // when a utility sheet closes, the bar must REGROW from the right, so
    // the flip back to 0 is held until the regrow has finished.
    originX: utilitySheetClosing
      ? { duration: 0, delay: del(UTILITY_SHEET_DELAYS.closeBarGrow + 0.22) }
      : { duration: 0 },
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
            : isUtilitySheetOpen
              ? // Surface fades late in the inward sweep.
                {
                  duration: dur(DUR.label),
                  ease: EASE_IN,
                  delay: del(UTILITY_SHEET_DELAYS.barFade),
                }
              : utilitySheetClosing
                ? {
                    duration: dur(0.1),
                    ease: EASE_OUT,
                    delay: del(UTILITY_SHEET_DELAYS.closeBarGrow),
                  }
                : { duration: dur(DUR.direct), ease: EASE },
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
                : isActionSheetOpen
                  ? // Fades in lockstep with the left circle — the two ends of
                    // the bar leave together before the labels follow.
                    { duration: dur(0.12), ease: EASE_IN }
                  : isUtilitySheetOpen
                    ? // Utility sheet: the button leaves LAST, as the sheet
                      // widens out of its footprint.
                      {
                        duration: dur(0.12),
                        ease: EASE_IN,
                        delay: del(UTILITY_SHEET_DELAYS.rightFade),
                      }
                    : utilitySheetClosing
                      ? // …and returns FIRST once the sheet has landed on it.
                        {
                          duration: dur(0.12),
                          ease: EASE_OUT,
                          delay: del(UTILITY_SHEET_DELAYS.closeRightFadeIn),
                        }
                      : { duration: dur(0.16), ease: EASE },
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
            "linear-gradient(to top, var(--bg-canvas) 26%, color-mix(in oklab, var(--aurora-lilac) 13%, var(--bg-canvas)) 58%, transparent 100%)",
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
            aria-label="Close filter options"
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
              pointerEvents:
                isSearchOpen || isActionSheetOpen || isUtilitySheetOpen
                  ? "none"
                  : "auto",
            }}
            animate={{
              width: isSearchOpen ? 0 : 56,
              // Utility surfaces and the sheet fade phases fade the left
              // control in place; search collapses it entirely. Filter
              // expansion leaves it FIXED — the strip only claims the
              // right button's space, and the page dims instead.
              opacity:
                isSearchOpen || isActionSheetOpen || isUtilitySheetOpen ? 0 : 1,
            }}
            transition={
              // Action-sheet fade phase: both circles drop out together,
              // first beat of the sequence.
              isActionSheetOpen
                ? { duration: dur(0.12), ease: EASE_IN }
                : isUtilitySheetOpen
                  ? // Utility sheet: nav circle leaves first…
                    {
                      duration: dur(0.12),
                      ease: EASE_IN,
                      delay: del(UTILITY_SHEET_DELAYS.leftFade),
                    }
                  : utilitySheetClosing
                    ? // …and returns last on close.
                      {
                        duration: dur(0.14),
                        ease: EASE_OUT,
                        delay: del(UTILITY_SHEET_DELAYS.closeLeftFadeIn),
                      }
                    : { duration: dur(0.25), ease: EASE }
            }
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
              {/* Aurora hover glow — same affordance as the UtilityButton,
                  so both circles answer the cursor identically. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  boxShadow:
                    "0 0 20px -2px color-mix(in oklab, var(--aurora-lilac) 48%, transparent)",
                }}
              />
              {/* Pressed fill — a visible commit on top of the tap scale. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-150 group-active:opacity-100"
                style={{
                  background:
                    "color-mix(in oklab, var(--iris-700) 14%, transparent)",
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
                      "0 0 18px 4px color-mix(in oklab, var(--aurora-lilac) 60%, transparent), inset 0 0 0 1.5px color-mix(in oklab, var(--iris-700) 45%, transparent)",
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
                className="absolute inset-[2px] rounded-full flex items-center justify-center transition-colors"
                style={{ color: "var(--iris-700)" }}
                aria-label={isCollapsed ? "Open controls" : undefined}
                title={isCollapsed ? "Open controls" : undefined}
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
                  initial={{
                    opacity: 0,
                    scaleX: 0.85,
                    scaleY: 0.45,
                    borderRadius: 28,
                    boxShadow:
                      "0 4px 14px rgb(44 31 66 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.9)",
                  }}
                  animate={{
                    opacity: 1,
                    scaleX: 1,
                    scaleY: 1,
                    borderRadius: 21,
                    boxShadow:
                      "0 18px 44px rgb(44 31 66 / 0.16), inset 0 1px 0 rgb(255 255 255 / 0.9)",
                  }}
                  exit={{
                    opacity: 0,
                    scaleX: 0.88,
                    scaleY: 0.5,
                    borderRadius: 28,
                    boxShadow:
                      "0 4px 14px rgb(44 31 66 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.9)",
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
                              className="h-px my-1 mx-2"
                              style={{ background: "var(--border-subtle)" }}
                            />
                          )}
                          <motion.button
                            type="button"
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
                              "flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm w-full text-left transition-colors duration-200",
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
              ref={actionBarRef}
              className={cn(
                "relative flex-1 h-12 rounded-full overflow-hidden pointer-events-auto z-10 min-w-0",
                "glass-nav",
                "px-2.5 py-[5px]"
              )}
              style={{
                pointerEvents:
                  isNavigationMenuOpen ||
                  isCollapsed ||
                  isActionSheetOpen ||
                  isUtilitySheetOpen
                    ? "none"
                    : "auto",
              }}
              animate={{
                // Menu open and utility surfaces ABSORB the bar — fully
                // hidden, not dimmed.
                opacity:
                  isCollapsed || isNavigationMenuOpen || isUtilitySheetOpen
                    ? 0
                    : 1,
                scaleX:
                  isCollapsed || isNavigationMenuOpen || isUtilitySheetOpen
                    ? 0
                    : 1,
                // Animated alongside scaleX so framer holds the origin every
                // frame. The bar absorbs toward whichever control owns the
                // transition: left for menu/scroll, RIGHT for utilities.
                originX: isUtilitySheetOpen ? 1 : 0,
              }}
              transition={centerPillTransition}
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
                {isSearchOpen ? (
                  /* Search mode: wipes in right-to-left from the trigger,
                     slightly after the left control begins receding, so the
                     morph reads as one motion. Entry is a full transform
                     (search band); exit is a direct interaction. */
                  <motion.div
                    key="search"
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
                      className="min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-[color:var(--text-quaternary)]"
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
                          searchInputRef.current?.focus();
                        }}
                        aria-label="Clear search"
                        className="shrink-0 rounded-full p-1.5 transition-colors hover:bg-[var(--action-ghost-bg-hover)]"
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
                      className="shrink-0 rounded-full px-2.5 py-1.5 text-[13px] font-semibold transition-colors hover:bg-[var(--action-ghost-bg-hover)]"
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
                      return (
                        <motion.button
                          key={option.id}
                          ref={el => measureFilterOption(option.id, el)}
                          type="button"
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
                            "relative z-10 flex-[1_1_0%] min-w-fit h-[34px] px-4 rounded-full text-[13px] font-medium whitespace-nowrap",
                            "transition-colors duration-200",
                            isActive
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
                          : { opacity: 0 },
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
                                opacity: isActionSheetOpen ? 0 : 1,
                              }}
                              transition={{
                                duration: dur(0.12),
                                ease: EASE_IN,
                                delay: del(isActionSheetOpen ? 0.16 : 0),
                              }}
                            />
                          )}
                          <motion.button
                            type="button"
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
                            /* Action-sheet fade phase, beat two: all labels
                               (dividers included) leave together, one beat
                               after the circles, before the bar moves. */
                            animate={{ opacity: isActionSheetOpen ? 0 : 1 }}
                            transition={{
                              duration: dur(0.14),
                              ease: EASE,
                              opacity: {
                                duration: dur(0.12),
                                ease: EASE_IN,
                                delay: del(isActionSheetOpen ? 0.16 : 0),
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
                  isSearchOpen ||
                  isFilterExpanded ||
                  isActionSheetOpen ||
                  isUtilitySheetOpen
                    ? "none"
                    : "auto",
              }}
              animate={{
                // Filter expansion vacates the button's space entirely —
                // the strip widens into it (width collapses only after the
                // undot fade; see utilityButtonTransition).
                width: isCollapsed || isSearchOpen || isFilterExpanded ? 0 : 56,
                // Hidden states shrink it slightly as it fades, so every
                // return reads as a pop-in — dotting the horizontal "i".
                scale:
                  isCollapsed ||
                  isSearchOpen ||
                  isNavigationMenuOpen ||
                  isFilterExpanded
                    ? 0.7
                    : 1,
                opacity:
                  // Menu open and filter expansion hide the right utility
                  // entirely (first out, last back); the sheet fade phases
                  // fade it in place. While a full-screen takeover is open
                  // it stays visible — that surface grows out of it and
                  // contracts back into it.
                  isCollapsed ||
                  isSearchOpen ||
                  isNavigationMenuOpen ||
                  isFilterExpanded ||
                  isActionSheetOpen ||
                  isUtilitySheetOpen
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
                className="group relative w-14 h-14 rounded-full flex items-center justify-center pointer-events-auto"
                whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.93 }}
                transition={{ duration: dur(0.18), ease: EASE }}
              >
                {/* Neutral action circle: frosted white with a muted
                    gray-lilac border and dark icon. Deliberately quieter than
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
                {/* Aurora hover glow */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    boxShadow:
                      "0 0 20px -2px color-mix(in oklab, var(--aurora-lilac) 48%, transparent)",
                  }}
                />
                {/* Pressed fill — a visible commit on top of the tap
                    scale, matching the NavigationButton. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-150 group-active:opacity-100"
                  style={{
                    background:
                      "color-mix(in oklab, var(--iris-700) 14%, transparent)",
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
