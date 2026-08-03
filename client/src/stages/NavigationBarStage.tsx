/**
 * Dstil source-stage reminder: the uploaded NavigationBar is the focal object.
 * The restrained ghost content exists only to provide real scrolling for its
 * built-in collapse choreography; it must never compete with the bottom bar.
 *
 * Playground states shown here: expanded, navigation open, filter menu,
 * workflow sheet (tap any action), collapsed (scroll down).
 */
import { NavigationBar } from "@/components/navigation-bar";
import {
  navigationActions,
  navigationFilters,
  navigationRightButtons,
  navigationTabs,
} from "@/demos/navigationBarDemo";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type UIEvent, useCallback, useEffect, useRef, useState } from "react";
import "./NavigationBarStage.css";

const ghostCards = [72, 48, 84, 60, 94, 56, 78, 66];
const EASE = [0.2, 0, 0, 1] as const;

// Scroll hysteresis: collapsing requires a decisive downward pull (48–72px
// band); expanding only a small upward nudge (12–24px band). Movements under
// ~10px are ignored, and a short cooldown prevents rapid toggling when the
// scroll position hovers around a boundary.
const COLLAPSE_AFTER_PX = 56;
const EXPAND_AFTER_PX = 16;
const MIN_SCROLL_DELTA = 10;
const TOGGLE_COOLDOWN_MS = 350;
const ALWAYS_EXPANDED_ABOVE = 20;

export default function NavigationBarStage() {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const anchorScrollRef = useRef(0);
  const collapsedRef = useRef(false);
  const [activeTab, setActiveTab] = useState("home");
  const [activeFilter, setActiveFilter] = useState("pending");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [openSheet, setOpenSheet] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [lastAction, setLastAction] = useState("Navigation Bar ready");
  const prefersReducedMotion = useReducedMotion();

  const lastToggleAtRef = useRef(0);
  const overlayOpenRef = useRef(false);
  // Collapse is disabled while any overlay state is active (sheet, search).
  useEffect(() => {
    overlayOpenRef.current = openSheet !== null || isSearchOpen;
  }, [openSheet, isSearchOpen]);

  const setCollapsed = useCallback((next: boolean, anchor: number) => {
    collapsedRef.current = next;
    anchorScrollRef.current = anchor;
    lastToggleAtRef.current = Date.now();
    setIsCollapsed(next);
    if (next) setIsSearchOpen(false);
  }, []);

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const scrollTop = event.currentTarget.scrollTop;

      if (scrollTop < ALWAYS_EXPANDED_ABOVE) {
        if (collapsedRef.current) setCollapsed(false, scrollTop);
        anchorScrollRef.current = scrollTop;
        return;
      }

      const delta = scrollTop - anchorScrollRef.current;
      if (Math.abs(delta) < MIN_SCROLL_DELTA) return; // ignore jitter

      // No collapse while a sheet or search is open; keep the anchor fresh
      // so closing the overlay doesn't inherit stale scroll distance.
      if (overlayOpenRef.current) {
        anchorScrollRef.current = scrollTop;
        return;
      }

      const cooling = Date.now() - lastToggleAtRef.current < TOGGLE_COOLDOWN_MS;

      if (!collapsedRef.current) {
        if (delta > COLLAPSE_AFTER_PX && !cooling)
          setCollapsed(true, scrollTop);
        else if (delta < 0) anchorScrollRef.current = scrollTop; // ratchet up
      } else {
        if (delta < -EXPAND_AFTER_PX && !cooling)
          setCollapsed(false, scrollTop);
        else if (delta > 0) anchorScrollRef.current = scrollTop; // ratchet down
      }
    },
    [setCollapsed]
  );

  const expandFromLogo = useCallback(() => {
    setCollapsed(false, scrollAreaRef.current?.scrollTop ?? 0);
    scrollAreaRef.current?.scrollBy({ top: -140, behavior: "smooth" });
  }, [setCollapsed]);

  const closeSheet = useCallback(() => {
    setOpenSheet(null);
    setActiveAction(null);
  }, []);

  const rightButton = navigationRightButtons[activeTab] ?? null;

  return (
    <main className="navigation-demo">
      <div
        ref={scrollAreaRef}
        className="navigation-demo__scroll-area"
        aria-label="Scrollable Navigation Bar demonstration canvas"
        onScroll={handleScroll}
      >
        <div className="navigation-demo__content" aria-hidden="true">
          <div className="navigation-demo__feature-card">
            <div className="navigation-demo__feature-orb" />
            <div className="navigation-demo__feature-lines">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="navigation-demo__card-grid">
            {ghostCards.map((width, index) => (
              <div
                className="navigation-demo__ghost-card"
                key={`${width}-${index}`}
              >
                <span className="navigation-demo__ghost-icon" />
                <div className="navigation-demo__ghost-lines">
                  <span style={{ width: `${width}%` }} />
                  <span style={{ width: `${Math.max(32, width - 22)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="navigation-demo__nav-shell">
        <NavigationBar
          isCollapsed={isCollapsed}
          activeTab={activeTab}
          activeFilter={activeFilter}
          activeAction={activeAction}
          tabs={navigationTabs}
          tabActions={navigationActions}
          filterOptions={navigationFilters}
          rightButton={rightButton}
          onLogoClick={expandFromLogo}
          isSearchOpen={isSearchOpen}
          onSearchClose={() => setIsSearchOpen(false)}
          onSearchChange={query =>
            setLastAction(query ? `Searching for ${query}` : "Search cleared")
          }
          searchPlaceholder="Search markets…"
          onTabChange={tab => {
            setActiveTab(tab);
            setActiveAction(null);
            setOpenSheet(null);
            setIsSearchOpen(false);
            setLastAction(`${tab} tab selected`);
            // Selection choreography is component-side now: the menu
            // collapses into the left button and the bar regrows with the
            // new tab's controls (swapped while hidden).
          }}
          onFilterChange={filter => {
            setActiveFilter(filter);
            setLastAction(`${filter} filter selected`);
          }}
          onActionClick={(label, tab) => {
            setActiveAction(label);
            setOpenSheet(label);
            setLastAction(`${label} selected in ${tab}`);
          }}
          onRightButtonClick={() => {
            const label = rightButton?.label;
            if (!label) return;
            setLastAction(`${label} selected`);
            // Illustrative right-button behaviors:
            //   Search → the bar itself morphs into a search field
            //   AI     → assistant sheet (standard pattern, placeholder)
            //   Scan / Export → workflow sheet
            if (label === "Search") {
              setIsSearchOpen(true);
              return;
            }
            setOpenSheet(label === "AI" ? "Assistant" : label);
          }}
        />
      </div>

      {/* Workflow bottom sheet — the "workflow open" playground state.
          The scrim dims everything behind it, including the bar; the sheet
          rises from directly beneath the engaged action. */}
      <AnimatePresence>
        {openSheet && (
          <>
            <motion.button
              key="sheet-scrim"
              type="button"
              aria-label="Close sheet"
              className="navigation-demo__sheet-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.22,
                ease: EASE,
              }}
              onClick={closeSheet}
            />
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label={`${openSheet} workflow`}
              className="navigation-demo__sheet"
              initial={{ y: prefersReducedMotion ? 0 : "100%" }}
              animate={{ y: 0 }}
              exit={{ y: prefersReducedMotion ? 0 : "100%" }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.34,
                ease: EASE,
              }}
            >
              <div
                className="navigation-demo__sheet-grabber"
                aria-hidden="true"
              />
              <div className="navigation-demo__sheet-header">
                <h2>{openSheet}</h2>
                <button type="button" onClick={closeSheet}>
                  Done
                </button>
              </div>
              {openSheet === "Assistant" ? (
                /* Standard assistant pattern: ghost conversation + input. */
                <div className="navigation-demo__sheet-body" aria-hidden="true">
                  <div className="navigation-demo__sheet-bubble navigation-demo__sheet-bubble--user" />
                  <div className="navigation-demo__sheet-bubble" />
                  <div className="navigation-demo__sheet-bubble navigation-demo__sheet-bubble--user navigation-demo__sheet-bubble--short" />
                  <div className="navigation-demo__sheet-input">
                    Ask anything…
                  </div>
                </div>
              ) : (
                <div className="navigation-demo__sheet-body" aria-hidden="true">
                  <div className="navigation-demo__sheet-row" />
                  <div className="navigation-demo__sheet-row" />
                  <div className="navigation-demo__sheet-row navigation-demo__sheet-row--short" />
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <p className="sr-only" aria-live="polite">
        {lastAction}
      </p>
    </main>
  );
}
