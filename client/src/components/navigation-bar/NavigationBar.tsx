/**
 * NavigationBar — dStil
 * Adapted from the WAJOR NavigationBar paradigm.
 * Glass-premium bottom bar with: tab switcher (left), center action pill, right action button.
 * Collapses on scroll down, expands on scroll up.
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

export type TabDef<T extends NavTabId = NavTabId> = {
  id: T;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

export type ActionDef = {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  showIcon?: boolean;
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
  rightButtonFade: 0.0,
  centerIconsFade: 0.02,
  centerSquish: 0.05,
  menuGrow: 0.16,
};

// ── Navigation close/selection: reverse, slightly faster. The menu
//    collapses back into the button; hidden controls swap while invisible;
//    the bar regrows left-to-right; right utility returns last.
const CLOSE_DELAYS = {
  menuFade: 0.0,
  pillGrow: 0.08,
  actionsFadeIn: 0.16,
  // The bar finishes expanding at pillGrow + expand ≈ 0.28; the right
  // utility arrives just after — the dot on a horizontal "i".
  rightButtonFadeIn: 0.3,
  tabIconSwap: 0.1, // left icon updates as the menu clears it
};

const SCROLL_COLLAPSE_DELAYS = {
  searchFade: 0.0,
  labelFade: 0.04, // labels fade after movement begins
  pillFade: 0.12, // container fades late, once nearly shrunk
  centerCollapse: 0.0, // movement starts immediately
  tabIconFade: 0.14,
  logoFadeIn: 0.16,
};

const SCROLL_EXPAND_DELAYS = {
  logoFade: 0.0,
  tabIconFadeIn: 0.0,
  centerExpand: 0.0, // container expands first…
  labelFadeIn: 0.1, // …labels and dividers arrive in the final third
  rightReveal: 0.06, // right control follows the center bar
  searchFadeIn: 0.06,
};

const FILTER_DELAYS = {
  optionsFadeIn: 0.05,
  optionStagger: 0.02,
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
  onLogoClick?: () => void;
  onTabChange?: (tab: string) => void;
  activeTab?: string;
  onActionClick?: (label: string, tab: string) => void;
  /** Label of the currently engaged action, if any. The pill treatment is
   *  reserved for real state: only this chip gets the lavender inset fill. */
  activeAction?: string | null;
  /** Glyph shown in the collapsed state (and as fallback when no tab is
   *  active). Defaults to the aurora-dot brand mark. */
  logo?: React.ReactNode;
  /** Search mode: the left circle recedes and the capsule morphs into a
   *  search field, wiping right-to-left from the trigger. Controlled by the
   *  consumer (typically toggled from a Search right button). */
  isSearchOpen?: boolean;
  onSearchClose?: () => void;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  onRightButtonClick?: () => void;
  activeFilter?: string;
  onFilterChange?: (filterId: string) => void;
  filterOptions?: FilterOption[];
  tabs?: TabDef[];
  tabActions?: Record<string, ActionDef[]>;
  rightButton?: {
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    label: string;
  } | null;
  showRightButton?: boolean;
};

export const NavigationBar: React.FC<NavigationBarProps> = ({
  isCollapsed = false,
  onLogoClick,
  onTabChange,
  activeTab: externalActiveTab,
  onActionClick,
  activeAction = null,
  logo,
  isSearchOpen = false,
  onSearchClose,
  onSearchChange,
  searchPlaceholder = "Search…",
  onRightButtonClick,
  activeFilter = "",
  onFilterChange,
  filterOptions = [],
  tabs = [],
  tabActions = {},
  rightButton,
  showRightButton = true,
}) => {
  const [isTabMenuOpen, setIsTabMenuOpen] = useState(false);
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
      setIsTabMenuOpen(false);
      setIsFilterExpanded(false);
    }
  }, [isCollapsed]);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isSearchOpen) {
      setIsTabMenuOpen(false);
      setIsFilterExpanded(false);
      // Focus only once the field has reached most of its final width, so
      // the mobile keyboard doesn't jump the viewport mid-morph.
      const t = setTimeout(
        () => searchInputRef.current?.focus(),
        prefersReducedMotion ? 0 : 220 * TEMPO
      );
      return () => clearTimeout(t);
    }
  }, [isSearchOpen, prefersReducedMotion]);

  const navRef = useRef<HTMLDivElement | null>(null);
  const tabMenuContainerRef = useRef<HTMLDivElement | null>(null);

  const prevTabMenuOpenRef = useRef(isTabMenuOpen);
  useEffect(() => {
    prevTabMenuOpenRef.current = isTabMenuOpen;
  }, [isTabMenuOpen]);
  const prevTabMenuOpen = prevTabMenuOpenRef.current;
  const menuOpening = isTabMenuOpen && !prevTabMenuOpen;
  const menuClosing = !isTabMenuOpen && prevTabMenuOpen;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setIsTabMenuOpen(false);
        setIsFilterExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleTabButtonClick = () => {
    if (isCollapsed && onLogoClick) {
      // Tap on the collapsed control expands the bar only — opening the
      // menu requires a second, deliberate tap.
      onLogoClick();
      return;
    }
    if (isFilterExpanded) setIsFilterExpanded(false);
    setIsTabMenuOpen(open => !open);
  };

  const closeMenu = (returnFocus: boolean) => {
    setIsTabMenuOpen(false);
    if (returnFocus) navButtonRef.current?.focus();
  };

  // Escape closes the menu and returns focus to the left control.
  useEffect(() => {
    if (!isTabMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTabMenuOpen]);

  const handleSelectTab = (id: string) => {
    setActiveTab(id);
    setIsTabMenuOpen(false);
    setIsFilterExpanded(false);
    navButtonRef.current?.focus();
    onTabChange?.(id);
  };

  const handleFilterClick = () => {
    setIsFilterExpanded(open => !open);
    setIsTabMenuOpen(false);
  };

  // Selection sequence: highlight slides to the chosen value first, then the
  // strip closes and the chip label updates — the value is visibly committed
  // before the control changes shape.
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
      prefersReducedMotion ? 0 : 200 * TEMPO
    );
  };

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
    const el = filterOptionRefs.current[activeFilter];
    if (!el) return;
    setFilterHighlight({ x: el.offsetLeft, w: el.offsetWidth });
  }, [isFilterExpanded, activeFilter, filterOptions]);

  const activeTabDef = tabs.find(t => t.id === activeTab) ?? tabs[0];
  const otherTabs = tabs.filter(t => t.id !== activeTabDef?.id);
  const menuTabs = [...otherTabs, activeTabDef].filter(Boolean) as TabDef[];
  const actionsForTab = tabActions[activeTab] ?? [];
  const hasActions = actionsForTab.length > 0;
  const hasFilterAction = actionsForTab.some(a => a.label === "Filter");

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

  // Measured so the right button can travel toward the left control during
  // collapse (one continuous path) instead of fading out in place.
  // offsetWidth ignores the scaleX transform, so the measurement is stable
  // mid-animation.
  const pillRef = useRef<HTMLDivElement | null>(null);
  const [pillTravel, setPillTravel] = useState(0);
  useEffect(() => {
    const el = pillRef.current;
    if (!el) return;
    const measure = () => setPillTravel(el.offsetWidth + 8);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasActions]);
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
        : {
            duration: dur(navCollapsing ? DUR.collapse : DUR.expand),
            ease: navCollapsing ? EASE_IN : EASE_OUT,
          },
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
  const rightButtonTransition = {
    // Position/size travel with the collapse transform; opacity trails so
    // the button visibly approaches the left control before it fades.
    x: {
      duration: dur(navCollapsing ? DUR.collapse : DUR.expand),
      ease: navCollapsing ? EASE_IN : EASE_OUT,
      delay: del(navExpanding ? SCROLL_EXPAND_DELAYS.rightReveal : 0),
    },
    width: {
      duration: dur(navCollapsing ? DUR.collapse : DUR.expand),
      ease: navCollapsing ? EASE_IN : EASE_OUT,
      delay: del(navExpanding ? SCROLL_EXPAND_DELAYS.rightReveal : 0),
    },
    scale: menuOpening
      ? { duration: dur(DUR.label), ease: EASE_IN }
      : menuClosing
        ? // Arrives with the opacity beat — a crisp pop, not a drift.
          {
            duration: dur(0.14),
            ease: EASE_OUT,
            delay: del(CLOSE_DELAYS.rightButtonFadeIn),
          }
        : {
            duration: dur(navCollapsing ? DUR.collapse : DUR.expand),
            ease: navCollapsing ? EASE_IN : EASE_OUT,
            delay: del(navExpanding ? SCROLL_EXPAND_DELAYS.rightReveal : 0),
          },
    opacity: navCollapsing
      ? { duration: dur(0.14), ease: EASE_IN, delay: del(0.1) }
      : navExpanding
        ? {
            duration: dur(DUR.label),
            ease: EASE_OUT,
            delay: del(SCROLL_EXPAND_DELAYS.rightReveal + 0.04),
          }
        : menuOpening
          ? // The right utility is the FIRST thing to go on menu open.
            { duration: dur(DUR.label), ease: EASE_IN }
          : menuClosing
            ? // …and the LAST thing to return on close/selection.
              {
                duration: dur(0.14),
                ease: EASE_OUT,
                delay: del(CLOSE_DELAYS.rightButtonFadeIn),
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
      <div className="relative z-10 flex items-center gap-3 max-w-lg mx-auto">
        <div className="flex items-center gap-2 w-full px-1 relative z-10">
          {/* LEFT: Tab Switcher / Logo */}
          <motion.div
            ref={tabMenuContainerRef}
            className="relative h-14 flex items-center"
            style={{ pointerEvents: isSearchOpen ? "none" : "auto" }}
            animate={{
              width: isSearchOpen ? 0 : 56,
              opacity: isSearchOpen ? 0 : isFilterExpanded ? 0.45 : 1,
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
                  background:
                    "linear-gradient(180deg, color-mix(in oklab, var(--iris-700) 5%, white), color-mix(in oklab, var(--iris-700) 11%, white))",
                  border:
                    "1.5px solid color-mix(in oklab, var(--iris-700) 30%, white)",
                  boxShadow:
                    "0 10px 28px rgb(48 36 72 / 0.12), inset 0 1px 0 rgba(255,255,255,0.8)",
                  backdropFilter: "saturate(1.5) blur(var(--blur-lg))",
                  WebkitBackdropFilter: "saturate(1.5) blur(var(--blur-lg))",
                }}
              />

              <motion.button
                ref={navButtonRef}
                type="button"
                onClick={handleTabButtonClick}
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
              {isTabMenuOpen && (
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
                              isActive
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
              ref={pillRef}
              className={cn(
                "relative flex-1 h-12 rounded-full overflow-hidden pointer-events-auto z-10 min-w-0",
                "glass-nav",
                "px-2.5 py-[5px]"
              )}
              style={{
                // Dim (don't remove) while the nav menu is open — background
                // controls stay present but clearly inactive.
                pointerEvents: isTabMenuOpen || isCollapsed ? "none" : "auto",
              }}
              animate={{
                // Menu open ABSORBS the bar — fully hidden, not dimmed.
                opacity: isCollapsed || isTabMenuOpen ? 0 : 1,
                scaleX: isCollapsed || isTabMenuOpen ? 0 : 1,
                // Animated alongside scaleX so framer holds the origin at the
                // left edge every frame — the pill always shrinks toward the
                // left control, never toward its own center.
                originX: 0,
              }}
              transition={centerPillTransition}
            >
              <AnimatePresence mode="wait">
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
                      placeholder={searchPlaceholder}
                      onChange={e => onSearchChange?.(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Escape") onSearchClose?.();
                      }}
                      className="min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-[color:var(--text-quaternary)]"
                      style={{ color: "var(--text-primary)" }}
                    />
                    <button
                      type="button"
                      onClick={onSearchClose}
                      aria-label="Close search"
                      className="shrink-0 rounded-full p-1.5 transition-colors hover:bg-[var(--action-ghost-bg-hover)]"
                    >
                      <X
                        className="h-4 w-4"
                        strokeWidth={2.25}
                        style={{ color: "var(--text-secondary)" }}
                      />
                    </button>
                  </motion.div>
                ) : isFilterExpanded && hasFilterAction ? (
                  <motion.div
                    key="filter-options"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
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
                          ref={el => {
                            filterOptionRefs.current[option.id] = el;
                          }}
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
                    exit={{ opacity: 0 }}
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
                      const isFilter = action.label === "Filter";
                      const isEngaged =
                        !isFilter && activeAction === action.label;
                      return (
                        <React.Fragment key={action.label}>
                          {actionIndex > 0 && (
                            <span
                              aria-hidden="true"
                              className="nav-action-divider"
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
                            transition={{ duration: dur(0.14), ease: EASE }}
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
          {showRightButton && rightButton && (
            <motion.div
              className="relative h-14 flex items-center"
              style={{
                pointerEvents:
                  isTabMenuOpen || isCollapsed || isSearchOpen
                    ? "none"
                    : "auto",
              }}
              animate={{
                width: isCollapsed || isSearchOpen ? 0 : 56,
                // Collapse: travel toward the left control along the same
                // path the center bar shrinks on, scaling down slightly.
                x: isCollapsed ? -pillTravel : 0,
                // Menu open shrinks it slightly as it fades, so the return
                // reads as a pop-in — dotting the horizontal "i".
                scale:
                  isCollapsed || isSearchOpen ? 0.8 : isTabMenuOpen ? 0.7 : 1,
                opacity:
                  // Menu open hides the right utility entirely (first out,
                  // last back); filter expansion only dims it.
                  isCollapsed || isSearchOpen || isTabMenuOpen
                    ? 0
                    : isFilterExpanded
                      ? 0.35
                      : 1,
              }}
              transition={rightButtonTransition}
            >
              <motion.button
                type="button"
                onClick={onRightButtonClick}
                aria-label={rightButton.label}
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
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.66))",
                    border: "1px solid rgb(88 71 116 / 0.14)",
                    boxShadow:
                      "0 10px 28px rgb(48 36 72 / 0.12), inset 0 1px 0 rgba(255,255,255,0.8)",
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
                <span className="relative z-10 flex items-center justify-center">
                  <NavIcon
                    Icon={rightButton.Icon}
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
