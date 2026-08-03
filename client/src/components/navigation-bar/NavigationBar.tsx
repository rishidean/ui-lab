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

// Aura ease-standard (cubic-bezier(0.2, 0, 0, 1)); no spring/overshoot.
const EASE = [0.2, 0, 0, 1] as const;
// Keep the menu visually anchored to the circle it grows from: x ≈ 0 aligns
// the menu's left edge with the circle's left edge (the icon-centering math
// already lands within 2px), so the menu reads as the circle unfolding.
const MENU_FINE_TUNE = { x: -2, y: 15 };

// Choreography delays retuned for Aura: scaled so every element's
// (delay + duration) stays ≤ 340ms (the --dur-slow ceiling).
const OPEN_DELAYS = {
  rightButtonFade: 0.0,
  centerIconsFade: 0.04,
  centerSquish: 0.08,
  tabButtonFade: 0.1,
  menuGrow: 0.14,
};

const CLOSE_DELAYS = {
  menuFade: 0.0,
  tabButtonFadeIn: 0.0,
  menuShrink: 0.04,
  pillGrow: 0.08,
  actionsFadeIn: 0.12,
  rightButtonFadeIn: 0.14,
};

const SCROLL_COLLAPSE_DELAYS = {
  searchFade: 0.0,
  centerCollapse: 0.06,
  tabIconFade: 0.16,
  logoFadeIn: 0.18,
};

const SCROLL_EXPAND_DELAYS = {
  logoFade: 0.0,
  tabIconFadeIn: 0.0,
  centerExpand: 0.14,
  searchFadeIn: 0.16,
};

const FILTER_DELAYS = {
  optionsFadeIn: 0.06,
  optionStagger: 0.03,
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
  const dur = (d: number) => (prefersReducedMotion ? 0 : d);
  const del = (d: number) => (prefersReducedMotion ? 0 : d);

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

  useEffect(() => {
    if (isSearchOpen) {
      setIsTabMenuOpen(false);
      setIsFilterExpanded(false);
    }
  }, [isSearchOpen]);

  const navRef = useRef<HTMLDivElement | null>(null);
  const tabMenuContainerRef = useRef<HTMLDivElement | null>(null);
  const tabButtonIconRef = useRef<HTMLDivElement | null>(null);
  const menuActiveIconRef = useRef<HTMLDivElement | null>(null);
  const [menuIconOffset, setMenuIconOffset] = useState({ x: 0, y: 0 });

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

  useLayoutEffect(() => {
    if (!isTabMenuOpen) {
      setMenuIconOffset({ x: 0, y: 0 });
      return;
    }
    const containerEl = tabMenuContainerRef.current;
    const buttonIconEl = tabButtonIconRef.current;
    const menuIconEl = menuActiveIconRef.current;
    if (!containerEl || !buttonIconEl || !menuIconEl) return;
    const containerRect = containerEl.getBoundingClientRect();
    const buttonRect = buttonIconEl.getBoundingClientRect();
    const menuRect = menuIconEl.getBoundingClientRect();
    setMenuIconOffset({
      x:
        buttonRect.left +
        buttonRect.width / 2 -
        containerRect.left -
        (menuRect.left + menuRect.width / 2 - containerRect.left) +
        MENU_FINE_TUNE.x,
      y:
        buttonRect.top +
        buttonRect.height / 2 -
        containerRect.top -
        (menuRect.top + menuRect.height / 2 - containerRect.top) +
        MENU_FINE_TUNE.y,
    });
  }, [isTabMenuOpen, activeTab]);

  const handleTabButtonClick = () => {
    if (isCollapsed && onLogoClick) {
      onLogoClick();
      return;
    }
    if (isFilterExpanded) setIsFilterExpanded(false);
    setIsTabMenuOpen(open => !open);
  };

  const handleSelectTab = (id: string) => {
    setActiveTab(id);
    setIsTabMenuOpen(false);
    setIsFilterExpanded(false);
    onTabChange?.(id);
  };

  const handleFilterClick = () => {
    setIsFilterExpanded(open => !open);
    setIsTabMenuOpen(false);
  };

  const handleSelectFilter = (filterId: string) => {
    onFilterChange?.(filterId);
    setIsFilterExpanded(false);
  };

  const activeTabDef = tabs.find(t => t.id === activeTab) ?? tabs[0];
  const otherTabs = tabs.filter(t => t.id !== activeTabDef?.id);
  const menuTabs = [...otherTabs, activeTabDef].filter(Boolean) as TabDef[];
  const actionsForTab = tabActions[activeTab] ?? [];
  const hasActions = actionsForTab.length > 0;
  const hasFilterAction = actionsForTab.some(a => a.label === "Filter");
  const currentFilterOption = filterOptions.find(f => f.id === activeFilter);

  // Transition helpers
  const centerPillTransition = {
    duration: dur(0.2),
    ease: EASE,
    delay: del(
      navCollapsing
        ? SCROLL_COLLAPSE_DELAYS.centerCollapse
        : navExpanding
          ? SCROLL_EXPAND_DELAYS.centerExpand
          : menuOpening
            ? OPEN_DELAYS.centerSquish
            : menuClosing
              ? CLOSE_DELAYS.pillGrow
              : 0
    ),
  };
  const centerIconsTransition = {
    duration: dur(0.14),
    ease: EASE,
    delay: del(
      menuOpening
        ? OPEN_DELAYS.centerIconsFade
        : menuClosing
          ? CLOSE_DELAYS.actionsFadeIn
          : 0
    ),
  };
  const tabButtonTransition = {
    duration: dur(0.14),
    ease: EASE,
    delay: del(
      menuOpening
        ? OPEN_DELAYS.tabButtonFade
        : menuClosing
          ? CLOSE_DELAYS.tabButtonFadeIn
          : 0
    ),
  };
  const menuGrowTransition = {
    duration: dur(0.2),
    ease: EASE,
    delay: del(menuOpening ? OPEN_DELAYS.menuGrow : CLOSE_DELAYS.menuFade),
  };
  const rightButtonTransition = {
    duration: dur(0.16),
    ease: EASE,
    delay: del(
      navCollapsing
        ? SCROLL_COLLAPSE_DELAYS.searchFade
        : navExpanding
          ? SCROLL_EXPAND_DELAYS.searchFadeIn
          : menuOpening
            ? OPEN_DELAYS.rightButtonFade
            : menuClosing
              ? CLOSE_DELAYS.rightButtonFadeIn
              : 0
    ),
  };

  const soloIconAnimate = menuOpening
    ? { opacity: 0, scale: 0.9 }
    : menuClosing
      ? { opacity: [0, 1, 0], scale: [0.8, 1, 1] }
      : { opacity: 0, scale: 1 };
  const soloIconTransition = menuOpening
    ? { duration: dur(0.14), ease: EASE }
    : menuClosing
      ? {
          opacity: { duration: dur(0.13), ease: EASE },
          scale: { duration: dur(0.13), ease: EASE },
        }
      : { duration: dur(0.13), ease: EASE };

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
              whileTap={prefersReducedMotion ? undefined : { scale: 0.93 }}
              transition={{ duration: dur(0.18), ease: EASE }}
            >
              {/* Selected-navigation circle: faint iris-tinted fill with a
                  slightly stronger purple border — this is the one element
                  that reads "current place" in the resting composition. */}
              <motion.div
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
                animate={{
                  opacity: isTabMenuOpen ? 0 : 1,
                  scale: isTabMenuOpen ? 0.96 : 1,
                }}
                transition={tabButtonTransition}
              />

              <motion.button
                type="button"
                onClick={handleTabButtonClick}
                className="absolute inset-[2px] rounded-full flex items-center justify-center transition-colors"
                style={{ color: "var(--iris-700)" }}
                aria-label={isCollapsed ? "Open controls" : undefined}
                title={isCollapsed ? "Open controls" : undefined}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {!isTabMenuOpen && !menuClosing && (
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
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Solo icon for menu transition */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                initial={false}
                animate={soloIconAnimate}
                transition={soloIconTransition}
              >
                <div
                  ref={tabButtonIconRef}
                  className="flex items-center justify-center"
                  style={{ color: "var(--iris-700)" }}
                >
                  {activeTabDef ? (
                    <activeTabDef.Icon className="w-6 h-6" strokeWidth={1.85} />
                  ) : (
                    (logo ?? <DefaultLogo />)
                  )}
                </div>
              </motion.div>
            </motion.div>

            {/* Tab Menu Dropdown */}
            <AnimatePresence>
              {isTabMenuOpen && (
                <motion.div
                  key="tab-menu"
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    x: menuIconOffset.x,
                    y: menuIconOffset.y,
                  }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={menuGrowTransition}
                  className="absolute top-0 left-0 z-40 pointer-events-auto"
                  style={{ transformOrigin: "left bottom" }}
                >
                  <div className="glass-overlay rounded-[var(--radius-xl)] p-1.5 min-w-[210px] overflow-hidden">
                    {menuTabs.map(tab => {
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
                          <button
                            type="button"
                            onClick={() => handleSelectTab(tab.id)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] text-sm w-full text-left transition-colors duration-200",
                              isActive
                                ? "font-semibold bg-[var(--select-bg)] text-[var(--select-fg)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--action-ghost-bg-hover)] hover:text-[var(--text-primary)]"
                            )}
                          >
                            <motion.div
                              ref={isActive ? menuActiveIconRef : undefined}
                              className="flex items-center justify-center w-6 h-6"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{
                                opacity: {
                                  duration: dur(0.16),
                                  ease: EASE,
                                  delay: del(OPEN_DELAYS.menuGrow),
                                },
                              }}
                            >
                              <Icon
                                strokeWidth={1.75}
                                className="w-5 h-5"
                                style={{ opacity: 0.85 }}
                              />
                            </motion.div>
                            <span>{tab.label}</span>
                          </button>
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
              layout
              className={cn(
                "relative flex-1 h-12 rounded-full overflow-hidden pointer-events-auto z-10 min-w-0",
                "glass-nav",
                "px-2.5 py-[5px]"
              )}
              style={{
                transformOrigin: "left center",
                // Dim (don't remove) while the nav menu is open — background
                // controls stay present but clearly inactive.
                pointerEvents: isTabMenuOpen || isCollapsed ? "none" : "auto",
              }}
              animate={{
                opacity: isCollapsed ? 0 : isTabMenuOpen ? 0.35 : 1,
                scaleX: isCollapsed ? 0 : 1,
              }}
              transition={centerPillTransition}
            >
              <AnimatePresence mode="wait">
                {isSearchOpen ? (
                  /* Search mode: wipes in right-to-left from the trigger. */
                  <motion.div
                    key="search"
                    initial={{ clipPath: "inset(0 0 0 100%)" }}
                    animate={{ clipPath: "inset(0 0 0 0%)" }}
                    exit={{ clipPath: "inset(0 0 0 100%)", opacity: 0 }}
                    transition={{ duration: dur(0.26), ease: EASE }}
                    className="flex items-center gap-2 w-full h-full px-2"
                  >
                    <SearchGlyph
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0"
                      strokeWidth={2}
                      style={{ color: "var(--text-tertiary)" }}
                    />
                    <input
                      autoFocus
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
                    className="flex items-center gap-1.5 w-full h-full overflow-x-auto overflow-y-hidden scrollbar-hide"
                    style={{
                      touchAction: "pan-x",
                      overscrollBehaviorX: "contain",
                    }}
                  >
                    {filterOptions.map((option, index) => {
                      const isActive = option.id === activeFilter;
                      return (
                        <motion.button
                          key={option.id}
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
                            "flex-[1_1_0%] min-w-fit h-[38px] px-4 rounded-full text-[13px] font-medium whitespace-nowrap",
                            isActive
                              ? "transition-colors duration-200"
                              : "nav-action-chip text-[color:var(--text-secondary)]"
                          )}
                          style={
                            isActive
                              ? {
                                  background: "var(--select-bg)",
                                  border: "1px solid var(--select-border)",
                                  color: "var(--select-fg)",
                                  boxShadow: "var(--shadow-xs)",
                                }
                              : undefined
                          }
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
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={centerIconsTransition}
                    className="flex items-center gap-1.5 h-full w-full overflow-x-auto overflow-y-hidden scrollbar-hide"
                    style={{
                      touchAction: "pan-x",
                      overscrollBehaviorX: "contain",
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
                              "nav-action-chip group/action flex-[1_1_0%] min-w-fit h-[38px] px-4 rounded-full flex items-center justify-center text-center",
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
                opacity:
                  isCollapsed || isSearchOpen
                    ? 0
                    : isTabMenuOpen || isFilterExpanded
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
