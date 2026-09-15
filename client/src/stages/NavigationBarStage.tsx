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
 * takeover). Three grammars total: workflow sheets, Export, and Scan all
 * launch from the receded bar via launchFromBar — one clear-out (circles
 * recede, labels fade), then mount from the now-full-width bar (Scan
 * alone measures its origin at press time, since the button itself is
 * what recedes). AI and Search are separate in-bar morphs with no
 * clear-out.
 */
import {
  NavigationBar,
  NAV_SIZE_SPECS,
  sheetClearoutMs,
  type AssistantMessage,
  type NavigationBarSize,
} from "@/components/navigation-bar";
import { BottomSheet, type SheetOrigin } from "@/components/bottom-sheet";
import { UtilityModal } from "@/components/utility-modal";
import { focusWhenClear } from "@/lib/a11y";
import { useRecordingMode } from "@/lab/recording";
import {
  navigationContextualActions,
  navigationFilters,
  navigationUtilityActions,
  navigationTabs,
} from "@/demos/navigationBarDemo";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Camera, X } from "lucide-react";
import { type UIEvent, useCallback, useEffect, useRef, useState } from "react";
import DemoControls from "./DemoControls";
import "./NavigationBarStage.css";

/** Per-tile height weights; rotated per filter so the grid reshuffles. */
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
/** Numeric demo-control override from the query string, clamped to the
    panel's own range; falls back to the default when absent or unparsable. */
function demoParam(name: string, fallback: number, min: number, max: number) {
  const raw = new URLSearchParams(window.location.search).get(name);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

const COLLAPSE_AFTER_PX = 56;
const EXPAND_AFTER_PX = 16;
const MIN_SCROLL_DELTA = 10;
const TOGGLE_COOLDOWN_MS = 350;
const ALWAYS_EXPANDED_ABOVE = 20;

// ── UtilityButton surfaces ──────────────────────────────────────────────
// Every kind runs the same clear-out first (both circles recede, labels
// fade — sequenced by isSheetOpen inside the NavigationBar). Then: modal
// takeovers (Scan) use the shared UtilityModal (circle-reveal from the
// button's center point); bottom sheets (Export) use the shared
// BottomSheet (widen out of its footprint, stretch vertically); AI is
// its own in-bar chat morph (search grammar + upward stretch), owned by
// the NavigationBar itself.
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

  // ── Demo controls (lab-only) ──
  // Recording mode (H / ?recording=1) is the app's existing "hide every
  // demo affordance" gate (see LabShell, Showcase) — reused here rather
  // than inventing a second mechanism, since a control panel showing up
  // in a screen recording would defeat the point of that mode.
  const chromeHidden = useRecordingMode();
  // Initial values can ride the URL (?depth=0.65&tempo=1.5&rm=1) so a
  // recording — where the panel itself is hidden — can still pin them.
  const [depth, setDepth] = useState(() =>
    demoParam("depth", 1, 0, 1)
  );
  const [tempo, setTempo] = useState(() =>
    demoParam("tempo", 1.3, 0.6, 3)
  );
  const [reducedMotionOverride, setReducedMotionOverride] = useState(
    () => new URLSearchParams(window.location.search).get("rm") === "1"
  );
  const [size, setSize] = useState<NavigationBarSize>(() => {
    const raw = new URLSearchParams(window.location.search).get("size");
    return raw && raw in NAV_SIZE_SPECS ? (raw as NavigationBarSize) : "default";
  });
  // Read once at mount — never on every render — so the panel starts
  // open on wide viewports and collapsed on narrow ones.
  const [controlsDefaultOpen] = useState(() => window.innerWidth >= 640);

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
  // One flag drives the clear-out for every bar-launched surface (workflow
  // sheets, Export, Scan): pressed feedback → fade phase (circles recede,
  // labels fade) → the emptied, full-width bar becomes the mount origin.
  // sheetPrep stays true until the surface has contracted back into the bar.
  const [sheetPrep, setSheetPrep] = useState(false);
  const prepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (prepTimer.current) clearTimeout(prepTimer.current);
    },
    []
  );

  const measureBar = useCallback((): SheetOrigin => {
    const rect = actionBarRef.current?.getBoundingClientRect();
    return rect
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
        };
  }, []);

  // One launch for every bar surface: flip the clear-out, wait for the
  // recede, THEN measure the pill — its rect now spans the full row —
  // and mount. (Press-time measuring would bake in the narrower
  // pre-recede rect.)
  const launchFromBar = useCallback(
    (mount: () => void) => {
      setSheetPrep(true);
      if (prepTimer.current) clearTimeout(prepTimer.current);
      prepTimer.current = setTimeout(
        mount,
        prefersReducedMotion ? 0 : sheetClearoutMs(tempo)
      );
    },
    [prefersReducedMotion, tempo]
  );

  const [utility, setUtility] = useState<"scan" | null>(null);
  const [utilityClosing, setUtilityClosing] = useState(false);
  const [utilityOrigin, setUtilityOrigin] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // ── Utility bottom sheets (Export) — bar-grammar morph ──
  // Launched via launchFromBar; sheetPrep drives the nav's clear-out and
  // stays true until the sheet has contracted back.
  const [utilSheet, setUtilSheet] = useState<"export" | null>(null);
  const [utilSheetOrigin, setUtilSheetOrigin] = useState<SheetOrigin | null>(
    null
  );

  const openUtilitySheet = useCallback(
    (kind: "export") => {
      if (utilSheet || sheetPrep || utility || utilityClosing) return;
      launchFromBar(() => {
        setUtilSheetOrigin(measureBar());
        setUtilSheet(kind);
      });
    },
    [utilSheet, sheetPrep, utility, utilityClosing, launchFromBar, measureBar]
  );

  const closeUtilitySheet = useCallback(() => {
    setUtilSheet(null);
  }, []);

  // (Escape is handled by the BottomSheet itself.)

  // Modal takeovers (Scan): the SAME clear-out as the bottom sheets —
  // pressed feedback, both circles recede, labels fade — then the modal
  // circle-reveals from the button's center point (captured at press,
  // before the button itself recedes).
  const openUtility = useCallback(
    (kind: "scan") => {
      // Locked the moment any utility transition begins; only one surface
      // can exist at a time.
      if (utility || utilityClosing || utilSheet || sheetPrep) return;
      // Captured at press time — the button is gone post-recede, so this
      // is the only chance to read its center as the reveal origin.
      const rect = utilityButtonRef.current?.getBoundingClientRect();
      setUtilityOrigin(
        rect
          ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          : { x: window.innerWidth - 46, y: window.innerHeight - 52 }
      );
      launchFromBar(() => setUtility(kind));
    },
    [utility, utilityClosing, utilSheet, sheetPrep, launchFromBar]
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
      utilSheet !== null;
  }, [
    openSheet,
    sheetPrep,
    isSearchOpen,
    isAssistantOpen,
    utility,
    utilityClosing,
    utilSheet,
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
    <main
      className="navigation-demo"
      style={{ "--nav-dormancy-depth": depth } as React.CSSProperties}
    >
      {!chromeHidden && (
        <DemoControls
          depth={depth}
          onDepth={setDepth}
          tempo={tempo}
          onTempo={setTempo}
          reducedMotion={reducedMotionOverride}
          onReducedMotion={setReducedMotionOverride}
          size={size}
          onSize={setSize}
          defaultOpen={controlsDefaultOpen}
        />
      )}
      <div
        ref={scrollAreaRef}
        className="navigation-demo__scroll-area"
        aria-label="Scrollable Navigation Bar demonstration canvas"
        onScroll={handleScroll}
      >
        <div className="navigation-demo__content" aria-hidden="true">
          <div className="navigation-demo__feature-card" />

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
            {cardsForView.map((weight, index) => (
              <div
                className="navigation-demo__ghost-card"
                key={`${weight}-${index}`}
                // Plain tiles; the weight only varies height so the
                // per-filter reshuffle still visibly changes the page.
                style={{ minHeight: `${5.5 + weight / 24}rem` }}
              />
            ))}
          </motion.div>
        </div>
      </div>

      <div className="navigation-demo__nav-shell">
        <NavigationBar
          tempo={tempo}
          size={size}
          reducedMotion={reducedMotionOverride || undefined}
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
          // One clear-out grammar for every sheet surface: workflow sheets,
          // bottom sheets (Export), AND modal takeovers (Scan) — both
          // circles recede, labels fade. AI is its own in-bar chat morph
          // and isn't part of this grammar.
          isSheetOpen={sheetPrep}
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
            setActiveAction(label);
            setLastAction(`${label} selected in ${tab}`);
            // Fade phase first: both circles out together, beat, then all
            // action labels out (0.16 + 0.12 at TEMPO ≈ 365ms), beat — then
            // the emptied bar begins its widen-and-stretch.
            launchFromBar(() => {
              setSheetOrigin(measureBar());
              setOpenSheet(label);
            });
          }}
          onUtilityClick={() => {
            const label = utilityAction?.label;
            if (!label) return;
            setLastAction(`${label} selected`);
            // Three grammars for the right-button utilities:
            //   AI, Search    → in-bar morphs, no clear-out, no sheet
            //   Export, Scan  → launched from the receded bar
            //                   (launchFromBar), same grammar as the
            //                   workflow sheet
            if (label === "AI") {
              // Assistant is an in-bar mode like Search — no clear-out, no sheet.
              if (utilSheet || sheetPrep || utility || utilityClosing) return;
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
          setSheetPrep(false); // button, bar, and circle fade back in
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

      {/* Utility bottom sheets — grow from the receded bar (launchFromBar)
          and stretch vertically; contract back onto it on dismiss. */}
      <AnimatePresence
        onExitComplete={() => {
          setUtilSheetOrigin(null);
          setSheetPrep(false); // button, bar, and circle fade back in
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
