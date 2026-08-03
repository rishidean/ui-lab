/**
 * Dstil source-stage reminder: the uploaded NavigationBar is the focal object.
 * The restrained ghost content exists only to provide real scrolling for its
 * built-in collapse choreography; it must never compete with the bottom bar.
 *
 * Playground states shown here: expanded, navigation open, filter menu,
 * workflow sheet (tap any action), collapsed (scroll down), and the four
 * right-button utilities — Search (bar morph), Export (compact sheet),
 * AI (large draggable sheet), Scan (modal takeover). Sheets and modals
 * share one clear-out grammar: nav circle out, bar sweeps into the
 * button, button fades — then the surface takes over its footprint.
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
// Both kinds run the same clear-out first (nav circle out, bar sweeps into
// the button, button fades — sequenced by isUtilitySheetOpen inside the
// NavigationBar). Then: modal takeovers (Scan) expand as a circle from the
// button's center point; bottom sheets (Export, Assistant) widen out of
// its footprint and stretch vertically — see UtilitySheetMorph below.
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
          {kind === "scan" && <ScanView onClose={onClose} />}
        </motion.div>
      </motion.div>
    </>
  );
}

/* Utility bottom sheets (Export, Assistant) as a morph of the RIGHT
   button: after the bar has cleared itself (nav circle fades, action bar
   sweeps into the button — sequenced by isUtilitySheetOpen inside the
   NavigationBar), the sheet appears at the button's exact footprint,
   widens outward to the full sheet width like a regrowing bar, then
   stretches up and down to its initial height. Title and Done fade in
   once geometry lands; body content a beat later. Close reverses. */
function UtilitySheetMorph({
  kind,
  origin,
  onClose,
  reducedMotion,
}: {
  kind: "export" | "assistant";
  origin: BoxOrigin;
  onClose: () => void;
  reducedMotion: boolean;
}) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const finalWidth = Math.min(vw - 24, 512);
  const finalLeft = (vw - finalWidth) / 2;

  // Assistant keeps its half ↔ full drag; heights resolved to px so the
  // morph interpolates cleanly from the button's numeric height.
  const [isFull, setIsFull] = useState(false);
  const sheetHeight =
    kind === "assistant"
      ? Math.round(vh * (isFull ? 0.94 : 0.62))
      : ("auto" as const);

  // After the entrance finishes, height changes (drag half ↔ full) use a
  // direct transition instead of the entrance's delayed one.
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOpened(true), reducedMotion ? 0 : 1100);
    return () => clearTimeout(t);
  }, [reducedMotion]);

  const buttonState = {
    left: origin.left,
    width: origin.width,
    bottom: vh - origin.bottom,
    height: origin.height,
    borderRadius: origin.height / 2,
    boxShadow:
      "0 10px 28px rgb(48 36 72 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.8)",
  };
  const sheetState = {
    left: finalLeft,
    width: finalWidth,
    bottom: 12,
    height: sheetHeight,
    borderRadius: 28,
    boxShadow:
      "0 24px 60px rgb(48 36 72 / 0.2), inset 0 1px 0 rgb(255 255 255 / 0.9)",
  };

  // Same beat structure as the workflow sheet: widen → beat → stretch →
  // title → beat → body.
  const WIDEN = 0.24;
  const STRETCH_AT = WIDEN + 0.08;
  const STRETCH = 0.28;
  const TITLE_AT = STRETCH_AT + STRETCH;
  const BODY_AT = TITLE_AT + 0.14 + 0.06;

  return (
    <>
      <motion.button
        type="button"
        aria-label="Close"
        className="navigation-demo__sheet-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: reducedMotion ? 0.01 : 0.22,
          ease: EASE,
          delay: reducedMotion ? 0 : STRETCH_AT,
        }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={kind === "assistant" ? "Assistant" : "Export"}
        className={
          "navigation-demo__sheet-morph" +
          (kind === "assistant" ? " navigation-demo__sheet-morph--flex" : "")
        }
        initial={reducedMotion ? { opacity: 0 } : buttonState}
        animate={reducedMotion ? { opacity: 1 } : sheetState}
        drag={kind === "assistant" && opened && !reducedMotion ? "y" : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.16, bottom: 0.24 }}
        onDragEnd={(_, info) => {
          if (info.offset.y < -70 && !isFull) setIsFull(true);
          else if (info.offset.y > 70) {
            if (isFull) setIsFull(false);
            else onClose();
          }
        }}
        exit={
          reducedMotion
            ? { opacity: 0 }
            : {
                ...buttonState,
                // Reverse beats: drop to the button's height first, then
                // narrow onto its footprint — the button fades back in
                // underneath as this lands.
                transition: {
                  bottom: { delay: 0.06, duration: 0.22, ease: EASE_IN },
                  height: { delay: 0.06, duration: 0.22, ease: EASE_IN },
                  left: { delay: 0.32, duration: 0.2, ease: EASE_IN },
                  width: { delay: 0.32, duration: 0.2, ease: EASE_IN },
                  borderRadius: { delay: 0.32, duration: 0.2, ease: EASE_IN },
                  boxShadow: { duration: 0.46, ease: EASE_IN },
                },
              }
        }
        transition={
          reducedMotion
            ? { duration: 0.01 }
            : opened
              ? { duration: 0.26, ease: EASE }
              : {
                  // Beat one: widen outward from the button's footprint.
                  left: { duration: WIDEN, ease: EASE_OUT },
                  width: { duration: WIDEN, ease: EASE_OUT },
                  borderRadius: { duration: WIDEN, ease: EASE_OUT },
                  // Beat two: stretch up and down simultaneously.
                  bottom: {
                    delay: STRETCH_AT,
                    duration: STRETCH,
                    ease: EASE_OUT,
                  },
                  height: {
                    delay: STRETCH_AT,
                    duration: STRETCH,
                    ease: EASE_OUT,
                  },
                  boxShadow: { duration: TITLE_AT, ease: EASE_OUT },
                }
        }
      >
        <motion.div
          className="navigation-demo__sheet-grabber"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          transition={{
            duration: reducedMotion ? 0.01 : 0.14,
            delay: reducedMotion ? 0 : TITLE_AT,
          }}
        />
        <motion.div
          style={{ minWidth: finalWidth - 40 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          transition={{
            duration: reducedMotion ? 0.01 : 0.14,
            ease: EASE_OUT,
            delay: reducedMotion ? 0 : TITLE_AT,
          }}
        >
          <div className="navigation-demo__sheet-header">
            {kind === "assistant" ? (
              <h2 className="navigation-demo__assistant-title">
                {/* The assistant icon carries over from the trigger. */}
                <Sparkles aria-hidden="true" /> Assistant
              </h2>
            ) : (
              <h2>Export</h2>
            )}
            <button type="button" onClick={onClose}>
              Done
            </button>
          </div>
        </motion.div>
        <motion.div
          style={
            kind === "assistant"
              ? {
                  minWidth: finalWidth - 40,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                }
              : { minWidth: finalWidth - 40 }
          }
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            y: 6,
            transition: { duration: reducedMotion ? 0.01 : 0.08 },
          }}
          transition={{
            duration: reducedMotion ? 0.01 : 0.18,
            ease: EASE_OUT,
            delay: reducedMotion ? 0 : BODY_AT,
          }}
        >
          {kind === "export" ? (
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
          ) : (
            <div
              className="navigation-demo__sheet-body"
              style={{ marginTop: "auto" }}
              aria-hidden="true"
            >
              <div className="navigation-demo__sheet-bubble navigation-demo__sheet-bubble--user" />
              <div className="navigation-demo__sheet-bubble navigation-demo__sheet-bubble--loading" />
              <div className="navigation-demo__sheet-input">Ask anything…</div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </>
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

/* Workflow sheet as a morph of the nav bar's center section: it starts as a
   pixel-perfect clone of the action bar (same rect, radius, glass) hovering
   where the bar sits — never from the viewport's bottom edge — and grows
   upward/outward into the sheet. Dismiss reverses the same geometry back
   into the originating action bar. */
type BoxOrigin = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
};

function ActionSheetMorph({
  label,
  origin,
  onClose,
  reducedMotion,
}: {
  label: string;
  origin: BoxOrigin;
  onClose: () => void;
  reducedMotion: boolean;
}) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  // Stretches to the full control-cluster width — a floating card, not a
  // full-bleed sheet welded to the viewport edge.
  const finalWidth = Math.min(vw - 24, 512);
  const finalLeft = (vw - finalWidth) / 2;

  // The emptied bar: 48px tall, fully rounded, resting elevation.
  const barState = {
    left: origin.left,
    width: origin.width,
    bottom: vh - origin.bottom,
    height: origin.height,
    borderRadius: 24,
    boxShadow:
      "0 10px 28px rgb(48 36 72 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.8)",
  };
  // The stretched sheet — reached in two geometry beats: first the bar
  // widens in place to the sheet's final width, then it stretches UP
  // (height grows) and DOWN (bottom edge drops toward — but never onto —
  // the viewport edge). Same container throughout; per-property delays
  // sequence the beats.
  const sheetState = {
    left: finalLeft,
    width: finalWidth,
    bottom: 12,
    height: "auto" as const,
    borderRadius: 28,
    boxShadow:
      "0 24px 60px rgb(48 36 72 / 0.2), inset 0 1px 0 rgb(255 255 255 / 0.9)",
  };

  // Sequence timing (seconds): widen → beat → stretch → title → beat → body.
  const WIDEN = 0.24;
  const STRETCH_AT = WIDEN + 0.08;
  const STRETCH = 0.28;
  const TITLE_AT = STRETCH_AT + STRETCH;
  const BODY_AT = TITLE_AT + 0.14 + 0.06;

  return (
    <>
      {/* Backdrop dims as the vertical stretch begins. */}
      <motion.button
        type="button"
        aria-label="Close sheet"
        className="navigation-demo__sheet-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: reducedMotion ? 0.01 : 0.22,
          ease: EASE,
          delay: reducedMotion ? 0 : STRETCH_AT,
        }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`${label} workflow`}
        className="navigation-demo__sheet-morph"
        initial={reducedMotion ? { opacity: 0 } : barState}
        animate={reducedMotion ? { opacity: 1 } : sheetState}
        exit={
          reducedMotion
            ? { opacity: 0 }
            : {
                ...barState,
                // Dismissal reverses the beats: drop back to bar height
                // first, then narrow onto the bar's footprint.
                transition: {
                  bottom: { delay: 0.06, duration: 0.22, ease: EASE_IN },
                  height: { delay: 0.06, duration: 0.22, ease: EASE_IN },
                  left: { delay: 0.32, duration: 0.2, ease: EASE_IN },
                  width: { delay: 0.32, duration: 0.2, ease: EASE_IN },
                  borderRadius: { delay: 0.32, duration: 0.2, ease: EASE_IN },
                  boxShadow: { duration: 0.46, ease: EASE_IN },
                },
              }
        }
        transition={
          reducedMotion
            ? { duration: 0.01 }
            : {
                // Beat one: widen in place at bar height.
                left: { duration: WIDEN, ease: EASE_OUT },
                width: { duration: WIDEN, ease: EASE_OUT },
                borderRadius: { duration: WIDEN, ease: EASE_OUT },
                // Beat two: stretch up and down simultaneously.
                bottom: {
                  delay: STRETCH_AT,
                  duration: STRETCH,
                  ease: EASE_OUT,
                },
                height: {
                  delay: STRETCH_AT,
                  duration: STRETCH,
                  ease: EASE_OUT,
                },
                boxShadow: { duration: TITLE_AT, ease: EASE_OUT },
              }
        }
      >
        {/* Grabber arrives with the title, once geometry has landed. */}
        <motion.div
          className="navigation-demo__sheet-grabber"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          transition={{
            duration: reducedMotion ? 0.01 : 0.14,
            delay: reducedMotion ? 0 : TITLE_AT,
          }}
        />
        {/* Title first, body a beat later; width is pinned so text never
            rewraps mid-grow. */}
        <motion.div
          style={{ minWidth: finalWidth - 40 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          transition={{
            duration: reducedMotion ? 0.01 : 0.14,
            ease: EASE_OUT,
            delay: reducedMotion ? 0 : TITLE_AT,
          }}
        >
          <div className="navigation-demo__sheet-header">
            <h2>{label}</h2>
            <button type="button" onClick={onClose}>
              Done
            </button>
          </div>
        </motion.div>
        <motion.div
          style={{ minWidth: finalWidth - 40 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            y: 6,
            transition: { duration: reducedMotion ? 0.01 : 0.08 },
          }}
          transition={{
            duration: reducedMotion ? 0.01 : 0.18,
            ease: EASE_OUT,
            delay: reducedMotion ? 0 : BODY_AT,
          }}
        >
          <div className="navigation-demo__sheet-body" aria-hidden="true">
            <div className="navigation-demo__sheet-row" />
            <div className="navigation-demo__sheet-row" />
            <div className="navigation-demo__sheet-row navigation-demo__sheet-row--short" />
          </div>
        </motion.div>
      </motion.div>
    </>
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
  const centerBarRef = useRef<HTMLDivElement | null>(null);
  const [sheetOrigin, setSheetOrigin] = useState<BoxOrigin | null>(null);
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
  const [utility, setUtility] = useState<UtilityKind | null>(null);
  const [utilityClosing, setUtilityClosing] = useState(false);
  const [utilityOrigin, setUtilityOrigin] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // ── Utility bottom sheets (Export, Assistant) — bar-grammar morph ──
  // utilSheetPrep drives the nav's clear-out (left circle, bar, then the
  // button itself) and stays true until the sheet has contracted back.
  const [utilSheet, setUtilSheet] = useState<"export" | "assistant" | null>(
    null
  );
  const [utilSheetPrep, setUtilSheetPrep] = useState(false);
  const [utilSheetOrigin, setUtilSheetOrigin] = useState<BoxOrigin | null>(
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
    (kind: "export" | "assistant") => {
      if (utilSheet || utilSheetPrep || utility || utilityClosing) return;
      const rect = rightButtonRef.current?.getBoundingClientRect();
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
        prefersReducedMotion ? 0 : 500
      );
    },
    [utilSheet, utilSheetPrep, utility, utilityClosing, prefersReducedMotion]
  );

  const closeUtilitySheet = useCallback(() => {
    setUtilSheet(null);
  }, []);

  // Escape closes an open utility sheet.
  useEffect(() => {
    if (!utilSheet) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeUtilitySheet();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [utilSheet, closeUtilitySheet]);

  // Modal takeovers (Scan): the SAME clear-out beats as the bottom sheets
  // — pressed feedback, nav circle out, bar sweeps into the button, button
  // fades — then the modal expands from the button's center point.
  const openUtility = useCallback(
    (kind: UtilityKind) => {
      // Locked the moment any utility transition begins; only one surface
      // can exist at a time.
      if (utility || utilityClosing || utilSheet || utilSheetPrep) return;
      const rect = rightButtonRef.current?.getBoundingClientRect();
      setUtilityOrigin(
        rect
          ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          : { x: window.innerWidth - 46, y: window.innerHeight - 52 }
      );
      setUtilSheetPrep(true);
      if (utilPrepTimer.current) clearTimeout(utilPrepTimer.current);
      utilPrepTimer.current = setTimeout(
        () => setUtility(kind),
        prefersReducedMotion ? 0 : 500
      );
    },
    [utility, utilityClosing, utilSheet, utilSheetPrep, prefersReducedMotion]
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
      openSheet !== null ||
      sheetPrep ||
      isSearchOpen ||
      utility !== null ||
      utilityClosing ||
      utilSheet !== null ||
      utilSheetPrep;
  }, [
    openSheet,
    sheetPrep,
    isSearchOpen,
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

  // The engaged action stays highlighted until the sheet has contracted
  // back into the bar (cleared in onExitComplete).
  const closeSheet = useCallback(() => {
    setOpenSheet(null);
  }, []);

  // Escape closes the workflow sheet.
  useEffect(() => {
    if (!openSheet) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSheet, closeSheet]);

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
          centerBarRef={centerBarRef}
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
          isActionSheetOpen={sheetPrep}
          // One clear-out grammar for the right-button surfaces: bottom
          // sheets (Export, Assistant) AND modal takeovers (Scan) — nav
          // circle out, bar sweeps into the button, button fades last.
          isUtilitySheetOpen={utilSheetPrep}
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
            if (sheetPrep || openSheet) return;
            // Capture the bar's rect as the stretch origin at press time.
            const rect = centerBarRef.current?.getBoundingClientRect();
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
              prefersReducedMotion ? 0 : 440
            );
          }}
          onRightButtonClick={() => {
            const label = rightButton?.label;
            if (!label) return;
            setLastAction(`${label} selected`);
            // Right-button utilities, all sharing the button as origin:
            //   Search → the bar itself morphs into a search field
            //   AI     → large draggable assistant sheet (bar-grammar morph)
            //   Export → compact actionable sheet (bar-grammar morph)
            //   Scan   → full-screen capture takeover (circle reveal)
            if (label === "Search") {
              setIsSearchOpen(true);
              return;
            }
            if (label === "Scan") {
              openUtility("scan");
              return;
            }
            openUtilitySheet(label === "AI" ? "assistant" : "export");
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

      {/* Utility bottom sheets — widen out of the right button and stretch
          vertically; contract back onto it on dismiss. */}
      <AnimatePresence
        onExitComplete={() => {
          setUtilSheetOrigin(null);
          setUtilSheetPrep(false); // button, bar, and circle fade back in
          rightButtonRef.current?.focus();
        }}
      >
        {utilSheet && utilSheetOrigin && (
          <UtilitySheetMorph
            key={utilSheet}
            kind={utilSheet}
            origin={utilSheetOrigin}
            onClose={closeUtilitySheet}
            reducedMotion={!!prefersReducedMotion}
          />
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
          <ActionSheetMorph
            key={openSheet}
            label={openSheet}
            origin={sheetOrigin}
            onClose={closeSheet}
            reducedMotion={!!prefersReducedMotion}
          />
        )}
      </AnimatePresence>

      <p className="sr-only" aria-live="polite">
        {lastAction}
      </p>
    </main>
  );
}
