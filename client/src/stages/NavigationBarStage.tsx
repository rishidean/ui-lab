/**
 * NavigationBar demo stage.
 * Part of Rishi's UI Lab — © 2026 Rishi Dean (rishidean.com)
 * MIT license · github.com/rishidean/ui-lab
 *
 * The NavigationBar is the focal object; the restrained ghost content
 * exists only to provide real scrolling for its built-in collapse
 * choreography, and must never compete with the bottom bar.
 *
 * Playground states shown here: expanded, navigation open, filter menu,
 * workflow sheet (tap any action), collapsed (scroll down), and the four
 * right-button utilities — Search (bar morph), Export (compact sheet),
 * AI (in-bar chat morph — search grammar + upward stretch), Scan (modal
 * takeover). Sheets and modals share one clear-out grammar: nav circle
 * out, bar sweeps into the button, button fades — then the surface
 * takes over its footprint.
 */
import {
  NavigationBar,
  ACTION_SHEET_CLEAROUT_MS,
  UTILITY_CLEAROUT_MS,
  type AssistantMessage,
} from "@/components/navigation-bar";
import { BottomSheet, type SheetOrigin } from "@/components/bottom-sheet";
import { UtilityModal } from "@/components/utility-modal";
import { focusWhenClear } from "@/lib/a11y";
import {
  navigationContextualActions,
  navigationFilters,
  navigationUtilityActions,
  navigationTabs,
} from "@/demos/navigationBarDemo";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Camera, X } from "lucide-react";
import { type UIEvent, useCallback, useEffect, useRef, useState } from "react";
import "./NavigationBarStage.css";

const ghostCards = [72, 48, 84, 60, 94, 56, 78, 66];
const ASSISTANT_REPLIES = [
  "You spent $342 on dining this month — 18% under your usual pace.",
  "Your portfolio is up 2.4% this week, led by the index funds.",
  "Done — I drafted that transfer. Review it on the Spend tab.",
];
const EASE = [0.2, 0, 0, 1] as const;
const EASE_OUT = [0, 0, 0.2, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

// Scroll hysteresis: collapsing requires a decisive downward pull (48–72px
// band); expanding only a small upward nudge (12–24px band). Movements under
// ~10px are ignored, and a short cooldown prevents rapid toggling when the
// scroll position hovers around a boundary.
const COLLAPSE_AFTER_PX = 56;
const EXPAND_AFTER_PX = 16;
const MIN_SCROLL_DELTA = 10;
const TOGGLE_COOLDOWN_MS = 350;
const ALWAYS_EXPANDED_ABOVE = 20;

// ── UtilityButton surfaces ──────────────────────────────────────────────
// Every kind runs the same clear-out first (NavigationButton out, bar
// sweeps into the UtilityButton, button fades — sequenced by
// isUtilitySheetOpen inside the NavigationBar). Then: modal takeovers
// (Scan) use the shared UtilityModal (circle-reveal from the button's
// center point); bottom sheets (Export) use the shared BottomSheet
// (widen out of its footprint, stretch vertically); AI is its own
// in-bar chat morph (search grammar + upward stretch), owned by the
// NavigationBar itself.
/* Scan: full-screen capture takeover. Demonstrates the permission and
   error/unavailable states before the active viewfinder. */
function ScanView({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<"permission" | "active" | "denied">(
    "permission"
  );
  return (
    <div className="navigation-demo__scan">
      <button
        type="button"
        className="navigation-demo__scan-close"
        aria-label="Close scanner"
        onClick={onClose}
      >
        <X aria-hidden="true" />
      </button>

      {phase === "permission" && (
        <div className="navigation-demo__scan-card">
          <Camera aria-hidden="true" />
          <h2>Camera access</h2>
          <p>Allow camera use to scan codes and documents.</p>
          <div className="navigation-demo__scan-actions">
            <button type="button" onClick={() => setPhase("active")}>
              Allow
            </button>
            <button
              type="button"
              className="navigation-demo__scan-secondary"
              onClick={() => setPhase("denied")}
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {phase === "denied" && (
        <div className="navigation-demo__scan-card">
          <Camera aria-hidden="true" />
          <h2>Camera unavailable</h2>
          <p>Enable camera access in Settings to scan.</p>
          <div className="navigation-demo__scan-actions">
            <button type="button" onClick={() => setPhase("permission")}>
              Try again
            </button>
          </div>
        </div>
      )}

      {phase === "active" && (
        <div className="navigation-demo__scan-stage" aria-hidden="true">
          <div className="navigation-demo__scan-frame" />
          <p>Align the code within the frame</p>
        </div>
      )}
    </div>
  );
}

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

  // ── Assistant mode (in-bar chat) ──
  // The stage owns the transcript so it survives close/reopen; replies
  // are canned with a delay long enough that pending → reply → stretch
  // reads as three beats.
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<
    AssistantMessage[]
  >([]);
  const assistantReplyTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const assistantReplyCount = useRef(0);
  useEffect(
    () => () => {
      if (assistantReplyTimer.current)
        clearTimeout(assistantReplyTimer.current);
    },
    []
  );

  const handleAssistantSubmit = useCallback(
    (text: string) => {
      const stamp = Date.now();
      setAssistantMessages(prev => [
        ...prev,
        { id: `u-${stamp}`, role: "user", text },
        { id: `a-${stamp}`, role: "assistant", text: "", pending: true },
      ]);
      setLastAction(`Asked assistant: ${text}`);
      if (assistantReplyTimer.current)
        clearTimeout(assistantReplyTimer.current);
      assistantReplyTimer.current = setTimeout(
        () => {
          const reply =
            ASSISTANT_REPLIES[
              assistantReplyCount.current % ASSISTANT_REPLIES.length
            ];
          assistantReplyCount.current += 1;
          // Resolve every pending bubble — rapid submits share one reply
          // beat rather than stranding earlier shimmers.
          setAssistantMessages(prev =>
            prev.map(m =>
              m.pending ? { ...m, text: reply, pending: false } : m
            )
          );
        },
        prefersReducedMotion ? 400 : 1400
      );
    },
    [prefersReducedMotion]
  );

  // ── Utility surface state ──
  const utilityButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionBarRef = useRef<HTMLDivElement | null>(null);
  const [sheetOrigin, setSheetOrigin] = useState<SheetOrigin | null>(null);
  // Action-press sequence: pressed feedback → fade phase (circles and
  // unselected actions out, selected label lingering) → the emptied bar
  // stretches into the sheet. sheetPrep drives the fade phase and stays
  // true until the sheet has contracted back.
  const [sheetPrep, setSheetPrep] = useState(false);
  const prepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (prepTimer.current) clearTimeout(prepTimer.current);
    },
    []
  );
  const [utility, setUtility] = useState<"scan" | null>(null);
  const [utilityClosing, setUtilityClosing] = useState(false);
  const [utilityOrigin, setUtilityOrigin] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // ── Utility bottom sheets (Export) — bar-grammar morph ──
  // utilSheetPrep drives the nav's clear-out (left circle, bar, then the
  // button itself) and stays true until the sheet has contracted back.
  const [utilSheet, setUtilSheet] = useState<"export" | null>(null);
  const [utilSheetPrep, setUtilSheetPrep] = useState(false);
  const [utilSheetOrigin, setUtilSheetOrigin] = useState<SheetOrigin | null>(
    null
  );
  const utilPrepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (utilPrepTimer.current) clearTimeout(utilPrepTimer.current);
    },
    []
  );

  const openUtilitySheet = useCallback(
    (kind: "export") => {
      if (utilSheet || utilSheetPrep || utility || utilityClosing) return;
      const rect = utilityButtonRef.current?.getBoundingClientRect();
      setUtilSheetOrigin(
        rect
          ? {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              bottom: rect.bottom,
            }
          : {
              top: window.innerHeight - 94,
              left: window.innerWidth - 74,
              width: 56,
              height: 56,
              bottom: window.innerHeight - 38,
            }
      );
      // Clear-out first: nav circle fades (0.12 @ 0), bar sweeps into the
      // button (0.2 @ 0.16) — at TEMPO ≈ 470ms. The sheet mounts as the
      // button begins its own fade (0.4 ≈ 520ms), widening while it goes.
      setUtilSheetPrep(true);
      if (utilPrepTimer.current) clearTimeout(utilPrepTimer.current);
      utilPrepTimer.current = setTimeout(
        () => setUtilSheet(kind),
        prefersReducedMotion ? 0 : UTILITY_CLEAROUT_MS
      );
    },
    [utilSheet, utilSheetPrep, utility, utilityClosing, prefersReducedMotion]
  );

  const closeUtilitySheet = useCallback(() => {
    setUtilSheet(null);
  }, []);

  // (Escape is handled by the BottomSheet itself.)

  // Modal takeovers (Scan): the SAME clear-out beats as the bottom sheets
  // — pressed feedback, nav circle out, bar sweeps into the button, button
  // fades — then the modal expands from the button's center point.
  const openUtility = useCallback(
    (kind: "scan") => {
      // Locked the moment any utility transition begins; only one surface
      // can exist at a time.
      if (utility || utilityClosing || utilSheet || utilSheetPrep) return;
      const rect = utilityButtonRef.current?.getBoundingClientRect();
      setUtilityOrigin(
        rect
          ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          : { x: window.innerWidth - 46, y: window.innerHeight - 52 }
      );
      setUtilSheetPrep(true);
      if (utilPrepTimer.current) clearTimeout(utilPrepTimer.current);
      utilPrepTimer.current = setTimeout(
        () => setUtility(kind),
        prefersReducedMotion ? 0 : UTILITY_CLEAROUT_MS
      );
    },
    [utility, utilityClosing, utilSheet, utilSheetPrep, prefersReducedMotion]
  );

  const closeUtility = useCallback(() => {
    setUtility(null);
    setUtilityClosing(true);
  }, []);

  // (Escape is handled by the UtilityModal itself.)

  const lastToggleAtRef = useRef(0);
  const overlayOpenRef = useRef(false);
  // Collapse is disabled while any overlay state is active.
  useEffect(() => {
    overlayOpenRef.current =
      openSheet !== null ||
      sheetPrep ||
      isSearchOpen ||
      isAssistantOpen ||
      utility !== null ||
      utilityClosing ||
      utilSheet !== null ||
      utilSheetPrep;
  }, [
    openSheet,
    sheetPrep,
    isSearchOpen,
    isAssistantOpen,
    utility,
    utilityClosing,
    utilSheet,
    utilSheetPrep,
  ]);

  const setCollapsed = useCallback((next: boolean, anchor: number) => {
    collapsedRef.current = next;
    anchorScrollRef.current = anchor;
    lastToggleAtRef.current = Date.now();
    setIsCollapsed(next);
    if (next) {
      setIsSearchOpen(false);
      setIsAssistantOpen(false);
    }
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

      // No collapse while a sheet, search, or utility is open; keep the
      // anchor fresh so closing doesn't inherit stale scroll distance.
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

  // The engaged action stays highlighted until the sheet has contracted
  // back into the bar (cleared in onExitComplete).
  const closeSheet = useCallback(() => {
    setOpenSheet(null);
  }, []);

  // (Escape is handled by the BottomSheet itself.)

  const utilityAction = navigationUtilityActions[activeTab] ?? null;

  // Ghost cards reshuffle deterministically per filter value so a selection
  // visibly changes the page (same count — scroll position never jumps).
  const filterIndex = Math.max(
    0,
    navigationFilters.findIndex(f => f.id === activeFilter)
  );
  const rot = (filterIndex * 3) % ghostCards.length;
  const cardsForView = [...ghostCards.slice(rot), ...ghostCards.slice(0, rot)];

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

          {/* The "main view" the filter governs: cards reshuffle per filter
              value and the grid runs a short content transition DURING the
              strip's collapse — the page answers the selection while the
              control is still closing. */}
          <motion.div
            key={activeFilter}
            className="navigation-demo__card-grid"
            initial={{ opacity: 0.35 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: prefersReducedMotion ? 0.01 : 0.3,
              ease: EASE,
              delay: prefersReducedMotion ? 0 : 0.12,
            }}
          >
            {cardsForView.map((width, index) => (
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
          </motion.div>
        </div>
      </div>

      <div className="navigation-demo__nav-shell">
        <NavigationBar
          isCollapsed={isCollapsed}
          activeTab={activeTab}
          activeFilter={activeFilter}
          activeAction={activeAction}
          tabs={navigationTabs}
          contextualActions={navigationContextualActions}
          filterOptions={navigationFilters}
          utilityAction={utilityAction}
          utilityButtonRef={utilityButtonRef}
          actionBarRef={actionBarRef}
          onCollapsedClick={expandFromLogo}
          isSearchOpen={isSearchOpen}
          onSearchClose={() => setIsSearchOpen(false)}
          onSearchChange={query =>
            setLastAction(query ? `Searching for ${query}` : "Search cleared")
          }
          onSearchSubmit={query =>
            setLastAction(query ? `Searched ${query}` : "Search closed")
          }
          searchPlaceholder="Search markets…"
          isAssistantOpen={isAssistantOpen}
          onAssistantClose={() => setIsAssistantOpen(false)}
          onAssistantSubmit={handleAssistantSubmit}
          assistantMessages={assistantMessages}
          isActionSheetOpen={sheetPrep}
          // One clear-out grammar for the right-button surfaces: bottom
          // sheets (Export) AND modal takeovers (Scan) — nav circle out,
          // bar sweeps into the button, button fades last. AI is its own
          // in-bar chat morph and isn't part of this grammar.
          isUtilitySheetOpen={utilSheetPrep}
          onTabChange={tab => {
            setActiveTab(tab);
            setActiveAction(null);
            setOpenSheet(null);
            setIsSearchOpen(false);
            setIsAssistantOpen(false);
            setLastAction(`${tab} tab selected`);
          }}
          onFilterChange={filter => {
            setActiveFilter(filter);
            setLastAction(`${filter} filter selected`);
          }}
          onActionClick={(label, tab) => {
            if (sheetPrep || openSheet) return;
            // Capture the bar's rect as the stretch origin at press time.
            const rect = actionBarRef.current?.getBoundingClientRect();
            setSheetOrigin(
              rect
                ? {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    bottom: rect.bottom,
                  }
                : {
                    top: window.innerHeight - 86,
                    left: 80,
                    width: window.innerWidth - 160,
                    height: 48,
                    bottom: window.innerHeight - 38,
                  }
            );
            setActiveAction(label);
            setLastAction(`${label} selected in ${tab}`);
            // Fade phase first: both circles out together, beat, then all
            // action labels out (0.16 + 0.12 at TEMPO ≈ 365ms), beat — then
            // the emptied bar begins its widen-and-stretch.
            setSheetPrep(true);
            if (prepTimer.current) clearTimeout(prepTimer.current);
            prepTimer.current = setTimeout(
              () => setOpenSheet(label),
              prefersReducedMotion ? 0 : ACTION_SHEET_CLEAROUT_MS
            );
          }}
          onUtilityClick={() => {
            const label = utilityAction?.label;
            if (!label) return;
            setLastAction(`${label} selected`);
            // Right-button utilities, all sharing the button as origin:
            //   AI     → in-bar chat morph (search grammar + upward stretch)
            //   Search → the bar itself morphs into a search field
            //   Export → compact actionable sheet (bar-grammar morph)
            //   Scan   → full-screen capture takeover (circle reveal)
            if (label === "AI") {
              // Assistant is an in-bar mode like Search — no clear-out, no sheet.
              if (utilSheet || utilSheetPrep || utility || utilityClosing)
                return;
              setIsAssistantOpen(true);
              return;
            }
            if (label === "Search") {
              setIsSearchOpen(true);
              return;
            }
            if (label === "Scan") {
              openUtility("scan");
              return;
            }
            openUtilitySheet("export");
          }}
        />
      </div>

      {/* Modal takeovers (Scan) — expand from the button's center point
          after the clear-out; contraction hands back to the bar restore. */}
      <AnimatePresence
        onExitComplete={() => {
          setUtilityClosing(false);
          setUtilityOrigin(null);
          setUtilSheetPrep(false); // button, bar, and circle fade back in
          // Focus returns to the origin control — see focusWhenClear's
          // docstring in @/lib/a11y for why this can't be a plain
          // .focus() call.
          focusWhenClear(utilityButtonRef.current);
        }}
      >
        {utility && utilityOrigin && (
          <UtilityModal
            key="scan"
            origin={utilityOrigin}
            ariaLabel="Scanner"
            onClose={closeUtility}
            reducedMotion={!!prefersReducedMotion}
          >
            <ScanView onClose={closeUtility} />
          </UtilityModal>
        )}
      </AnimatePresence>

      {/* Utility bottom sheets — widen out of the right button and stretch
          vertically; contract back onto it on dismiss. */}
      <AnimatePresence
        onExitComplete={() => {
          setUtilSheetOrigin(null);
          setUtilSheetPrep(false); // button, bar, and circle fade back in
          // BottomSheet applies useInertOutside too — same race as above.
          focusWhenClear(utilityButtonRef.current);
        }}
      >
        {utilSheet === "export" && utilSheetOrigin && (
          <BottomSheet
            key="export"
            origin={utilSheetOrigin}
            title="Export"
            ariaLabel="Export"
            onClose={closeUtilitySheet}
            height="auto"
            expandable
            reducedMotion={!!prefersReducedMotion}
          >
            <div className="navigation-demo__sheet-body" aria-hidden="true">
              <div className="navigation-demo__sheet-row" />
              <div className="navigation-demo__sheet-row" />
              <div className="navigation-demo__sheet-row navigation-demo__sheet-row--short" />
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>

      {/* Workflow sheet — grows out of the nav bar's center section on
          action press and contracts back into it on dismiss. */}
      <AnimatePresence
        onExitComplete={() => {
          setActiveAction(null);
          setSheetOrigin(null);
          setSheetPrep(false); // circles and actions fade back in
        }}
      >
        {openSheet && sheetOrigin && (
          <BottomSheet
            key={openSheet}
            origin={sheetOrigin}
            title={openSheet}
            ariaLabel={`${openSheet} workflow`}
            onClose={closeSheet}
            height="auto"
            expandable
            reducedMotion={!!prefersReducedMotion}
          >
            <div className="navigation-demo__sheet-body" aria-hidden="true">
              <div className="navigation-demo__sheet-row" />
              <div className="navigation-demo__sheet-row" />
              <div className="navigation-demo__sheet-row navigation-demo__sheet-row--short" />
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>

      <p className="sr-only" aria-live="polite">
        {lastAction}
      </p>
    </main>
  );
}
