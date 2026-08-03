/**
 * Dstil source-stage reminder: the uploaded NavigationBar is the focal object.
 * The restrained ghost content exists only to provide real scrolling for its
 * built-in collapse choreography; it must never compete with the bottom bar.
 *
 * Playground states shown here: expanded, navigation open, filter menu,
 * workflow sheet (tap any action), collapsed (scroll down), and the four
 * right-button utilities — Search (bar morph), Export (compact sheet),
 * AI (large draggable sheet), Scan (full-screen takeover). Every utility
 * grows out of the right button and contracts back into it.
 */
import { NavigationBar } from "@/components/navigation-bar";
import {
  navigationActions,
  navigationFilters,
  navigationRightButtons,
  navigationTabs,
} from "@/demos/navigationBarDemo";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Camera,
  FileSpreadsheet,
  FileText,
  Link2,
  Sparkles,
  X,
} from "lucide-react";
import { type UIEvent, useCallback, useEffect, useRef, useState } from "react";
import "./NavigationBarStage.css";

const ghostCards = [72, 48, 84, 60, 94, 56, 78, 66];
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

// ── Right-button utility surfaces ────────────────────────────────────────
// Every utility uses the same shared-origin geometry: a circle reveal that
// begins at the right button's exact bounds (28px radius at its center) and
// grows to cover the destination. Close reverses the same geometry, faster.
// Content fades in once the surface passes ~60% of its growth.
type UtilityKind = "export" | "assistant" | "scan";

const UTILITY_GROW: Record<UtilityKind, number> = {
  export: 0.34,
  assistant: 0.4,
  scan: 0.28, // quick transition into the full-screen takeover
};

function UtilitySurface({
  kind,
  origin,
  onClose,
  reducedMotion,
}: {
  kind: UtilityKind;
  origin: { x: number; y: number };
  onClose: () => void;
  reducedMotion: boolean;
}) {
  const grow = UTILITY_GROW[kind];
  const shrink = grow * 0.7;
  // Radius that covers the whole viewport from the origin point.
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const R = Math.ceil(
    Math.hypot(
      Math.max(origin.x, vw - origin.x),
      Math.max(origin.y, vh - origin.y)
    )
  );
  const at = `${origin.x}px ${origin.y}px`;

  // Reduced motion: opacity-only, no geometry.
  const clipProps = reducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.01 },
      }
    : {
        initial: { clipPath: `circle(28px at ${at})` },
        animate: { clipPath: `circle(${R}px at ${at})` },
        exit: { clipPath: `circle(28px at ${at})` },
        transition: { duration: grow, ease: EASE_OUT },
      };

  return (
    <>
      {/* Backdrop dims after the surface begins growing; the page beneath
          stays rendered as context. */}
      <motion.button
        type="button"
        aria-label="Close"
        className="navigation-demo__utility-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: reducedMotion ? 0.01 : 0.24,
          ease: EASE,
          delay: reducedMotion ? 0 : 0.06,
        }}
        onClick={onClose}
      />
      <motion.div
        className="navigation-demo__utility-clip"
        {...clipProps}
        exit={{
          ...clipProps.exit,
          transition: {
            duration: reducedMotion ? 0.01 : shrink,
            ease: EASE_IN,
          },
        }}
      >
        {/* Destination content reveals after ~60% of the growth. */}
        <motion.div
          className="navigation-demo__utility-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: reducedMotion ? 0.01 : 0.16,
            ease: EASE_OUT,
            delay: reducedMotion ? 0 : grow * 0.6,
          }}
        >
          {kind === "export" && <ExportSheet onClose={onClose} />}
          {kind === "assistant" && (
            <AssistantSheet onClose={onClose} reducedMotion={reducedMotion} />
          )}
          {kind === "scan" && <ScanView onClose={onClose} />}
        </motion.div>
      </motion.div>
    </>
  );
}

/* Export: compact sheet — concise, immediately actionable choices.
   One row demonstrates the "unavailable" utility state. */
function ExportSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="navigation-demo__sheet navigation-demo__sheet--compact">
      <div className="navigation-demo__sheet-grabber" aria-hidden="true" />
      <div className="navigation-demo__sheet-header">
        <h2>Export</h2>
        <button type="button" onClick={onClose}>
          Done
        </button>
      </div>
      <div className="navigation-demo__export-rows">
        <button type="button" onClick={onClose}>
          <FileSpreadsheet aria-hidden="true" /> Download CSV
        </button>
        <button type="button" disabled aria-disabled="true">
          <FileText aria-hidden="true" /> Download PDF
          <span className="navigation-demo__export-unavailable">
            Unavailable
          </span>
        </button>
        <button type="button" onClick={onClose}>
          <Link2 aria-hidden="true" /> Share link
        </button>
      </div>
    </div>
  );
}

/* AI: large sheet, draggable between half and full height. The first
   bubble shimmers — the assistant's loading state. */
function AssistantSheet({
  onClose,
  reducedMotion,
}: {
  onClose: () => void;
  reducedMotion: boolean;
}) {
  const [isFull, setIsFull] = useState(false);
  return (
    <motion.div
      className="navigation-demo__sheet navigation-demo__sheet--assistant"
      animate={{ height: isFull ? "94dvh" : "62dvh" }}
      transition={{ duration: reducedMotion ? 0 : 0.26, ease: EASE }}
      drag={reducedMotion ? false : "y"}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.16, bottom: 0.24 }}
      onDragEnd={(_, info) => {
        if (info.offset.y < -70 && !isFull) setIsFull(true);
        else if (info.offset.y > 70) {
          if (isFull) setIsFull(false);
          else onClose();
        }
      }}
    >
      <div className="navigation-demo__sheet-grabber" aria-hidden="true" />
      <div className="navigation-demo__sheet-header">
        <h2 className="navigation-demo__assistant-title">
          {/* The assistant icon carries over from the trigger button. */}
          <Sparkles aria-hidden="true" /> Assistant
        </h2>
        <button type="button" onClick={onClose}>
          Done
        </button>
      </div>
      <div className="navigation-demo__sheet-body" aria-hidden="true">
        <div className="navigation-demo__sheet-bubble navigation-demo__sheet-bubble--user" />
        <div className="navigation-demo__sheet-bubble navigation-demo__sheet-bubble--loading" />
        <div className="navigation-demo__sheet-input">Ask anything…</div>
      </div>
    </motion.div>
  );
}

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

  // ── Utility surface state ──
  const rightButtonRef = useRef<HTMLButtonElement | null>(null);
  const [utility, setUtility] = useState<UtilityKind | null>(null);
  const [utilityClosing, setUtilityClosing] = useState(false);
  const [utilityOrigin, setUtilityOrigin] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const openUtility = useCallback(
    (kind: UtilityKind) => {
      // The right button is disabled the moment a transition begins; only
      // one surface can exist at a time.
      if (utility || utilityClosing) return;
      const rect = rightButtonRef.current?.getBoundingClientRect();
      setUtilityOrigin(
        rect
          ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          : { x: window.innerWidth - 46, y: window.innerHeight - 52 }
      );
      setUtility(kind);
    },
    [utility, utilityClosing]
  );

  const closeUtility = useCallback(() => {
    setUtility(null);
    setUtilityClosing(true);
  }, []);

  // Escape closes any open utility.
  useEffect(() => {
    if (!utility) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeUtility();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [utility, closeUtility]);

  const lastToggleAtRef = useRef(0);
  const overlayOpenRef = useRef(false);
  // Collapse is disabled while any overlay state is active.
  useEffect(() => {
    overlayOpenRef.current =
      openSheet !== null || isSearchOpen || utility !== null || utilityClosing;
  }, [openSheet, isSearchOpen, utility, utilityClosing]);

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
          rightButtonRef={rightButtonRef}
          onLogoClick={expandFromLogo}
          isSearchOpen={isSearchOpen}
          onSearchClose={() => setIsSearchOpen(false)}
          onSearchChange={query =>
            setLastAction(query ? `Searching for ${query}` : "Search cleared")
          }
          onSearchSubmit={query =>
            setLastAction(query ? `Searched ${query}` : "Search closed")
          }
          searchPlaceholder="Search markets…"
          // Bar controls absorb toward the right button while a utility is
          // open, and restore only after the surface has contracted.
          isUtilityOpen={utility !== null || utilityClosing}
          onTabChange={tab => {
            setActiveTab(tab);
            setActiveAction(null);
            setOpenSheet(null);
            setIsSearchOpen(false);
            setLastAction(`${tab} tab selected`);
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
            // Right-button utilities, all sharing the button as origin:
            //   Search → the bar itself morphs into a search field
            //   AI     → large draggable assistant sheet
            //   Scan   → full-screen capture takeover
            //   Export → compact actionable sheet
            if (label === "Search") {
              setIsSearchOpen(true);
              return;
            }
            openUtility(
              label === "AI"
                ? "assistant"
                : label === "Scan"
                  ? "scan"
                  : "export"
            );
          }}
        />
      </div>

      {/* Right-button utility surfaces — shared-origin grow/contract. */}
      <AnimatePresence
        onExitComplete={() => {
          setUtilityClosing(false);
          setUtilityOrigin(null);
          // Focus returns to the origin control.
          rightButtonRef.current?.focus();
        }}
      >
        {utility && utilityOrigin && (
          <UtilitySurface
            key={utility}
            kind={utility}
            origin={utilityOrigin}
            onClose={closeUtility}
            reducedMotion={!!prefersReducedMotion}
          />
        )}
      </AnimatePresence>

      {/* Workflow bottom sheet — the "workflow open" playground state for
          center-bar actions. The scrim dims everything behind it. */}
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
              <div className="navigation-demo__sheet-body" aria-hidden="true">
                <div className="navigation-demo__sheet-row" />
                <div className="navigation-demo__sheet-row" />
                <div className="navigation-demo__sheet-row navigation-demo__sheet-row--short" />
              </div>
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
