/**
 * BottomSheet
 * Part of Rishi's UI Lab — © 2026 Rishi Dean (rishidean.com)
 * MIT license · github.com/rishidean/ui-lab
 *
 * A floating bottom sheet that grows out of the control that owns it.
 *
 * Bar-grammar morph (extracted from the NavigationBar demo's sheets): the
 * surface starts as a clone of its origin control — same rect, radius,
 * glass — widens in place to the sheet's width, stretches up and down to
 * its initial height, then reveals title and body in serial beats. Close
 * reverses the same geometry back into the origin control.
 *
 * Two stops only: the configured initial height and full screen (94% of
 * the viewport — still a floating card, never welded to the edges). With
 * `expandable`, a header control and the grab-bar drag snap between them;
 * dragging down at the initial height dismisses.
 *
 * Mount contract: render inside your own <AnimatePresence> and unmount to
 * close. Exit choreography runs on unmount; use onExitComplete to restore
 * the origin control (regrow, focus return).
 */
import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { useInertOutside } from "@/lib/a11y";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import "./BottomSheet.css";

/** Rect of the control the sheet grows out of — capture at press time via
 *  getBoundingClientRect(). */
export type SheetOrigin = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
};

export type BottomSheetProps = {
  origin: SheetOrigin;
  /** Header title; a ReactNode so it can carry an icon. */
  title: React.ReactNode;
  /** Accessible name for the dialog. */
  ariaLabel: string;
  /** Done, scrim tap, Escape, and drag-down all call this; the consumer
   *  unmounts the sheet to run the exit choreography. */
  onClose: () => void;
  /** Initial height: 0<h<=1 → fraction of the viewport (resolved to px);
   *  >1 → px; "auto" → content height. Default "auto". */
  height?: number | "auto";
  /** Shows the extend control and enables drag snapping to full. */
  expandable?: boolean;
  doneLabel?: string;
  /** Optional slot rendered in the header before the Done button. */
  headerExtra?: React.ReactNode;
  /** Override only; defaults to the system preference. */
  reducedMotion?: boolean;
  className?: string;
  children: React.ReactNode;
};

const EASE = [0.2, 0, 0, 1] as const;
const EASE_OUT = [0, 0, 0.2, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

// ── Entrance beats (raw seconds — deliberately outside any consumer
//    TEMPO): widen from the origin footprint → beat → stretch up+down →
//    title → beat → body. Close reverses per-property below.
const WIDEN = 0.24;
const STRETCH_AT = WIDEN + 0.08;
const STRETCH = 0.28;
const TITLE_AT = STRETCH_AT + STRETCH;
const BODY_AT = TITLE_AT + 0.14 + 0.06;

// Post-entrance height changes (initial ↔ full) use one settled band.
const SETTLED = { duration: 0.26, ease: EASE };

// Full stop: 94% of the viewport — a floating card, never edge-welded.
const FULL_FRACTION = 0.94;
// Drag release threshold (px) for snapping between stops / dismissing.
const DRAG_PX = 70;
// Drag arms only once the entrance has fully landed.
const OPENED_AT_MS = 1100;

export const BottomSheet: React.FC<BottomSheetProps> = ({
  origin,
  title,
  ariaLabel,
  onClose,
  height = "auto",
  expandable = false,
  doneLabel = "Done",
  headerExtra,
  reducedMotion,
  className,
  children,
}) => {
  const systemReduced = useReducedMotion();
  const reduced = reducedMotion ?? !!systemReduced;

  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  // Floating-card width, centered (same clamp as the NavigationBar's
  // control cluster so morphs read as the same object changing shape).
  const finalWidth = Math.min(vw - 24, 512);
  const finalLeft = (vw - finalWidth) / 2;

  // A full-width origin (the NavigationBar's receded pill) has nothing
  // to widen — the widen beat would be a ~240ms no-op delaying the
  // stretch. Skip straight to the vertical growth; small origins
  // (buttons, chips) keep the two-beat entrance.
  const originFullWidth = origin.width >= finalWidth - 8;
  const stretchAt = originFullWidth ? 0.06 : STRETCH_AT;
  const settleDur = originFullWidth ? 0.18 : WIDEN;
  const titleAt = stretchAt + STRETCH;
  const bodyAt = titleAt + 0.14 + 0.06;

  const [isFull, setIsFull] = useState(false);

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrimRef = useRef<HTMLButtonElement | null>(null);
  // Everything outside the sheet + scrim is inert while mounted — focus
  // cannot escape, the page is hidden from screen readers, and the exit
  // choreography stays covered until unmount.
  useInertOutside(true, sheetRef, scrimRef);
  // Initial focus: the dialog itself, so its aria-label announces without
  // disturbing the entrance beats (skeleton bodies have no controls).
  useEffect(() => {
    sheetRef.current?.focus({ preventScroll: true });
  }, []);

  // Fractions resolve to px — framer interpolates numbers, never px↔dvh.
  const initialHeight =
    height === "auto"
      ? ("auto" as const)
      : height <= 1
        ? Math.round(vh * height)
        : height;
  const sheetHeight = isFull ? Math.round(vh * FULL_FRACTION) : initialHeight;

  // After the entrance lands, height changes switch to the settled band
  // and the drag arms.
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOpened(true), reduced ? 0 : OPENED_AT_MS);
    return () => clearTimeout(t);
  }, [reduced]);

  // The sheet owns its dismissal paths: Done, scrim, Escape, drag-down.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const originState = {
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

  return (
    <>
      {/* Backdrop dims as the vertical stretch begins; the page beneath
          stays rendered as context. */}
      <motion.button
        ref={scrimRef}
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className="bottom-sheet__scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: reduced ? 0.01 : 0.22,
          ease: EASE,
          delay: reduced ? 0 : stretchAt,
        }}
        onClick={onClose}
      />
      <motion.div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn("bottom-sheet", className)}
        // Reduced motion animates opacity only — the sheet's geometry is
        // then applied statically here, or it would render unpositioned.
        style={
          reduced
            ? {
                left: finalLeft,
                width: finalWidth,
                bottom: 12,
                height: sheetHeight === "auto" ? undefined : sheetHeight,
                borderRadius: 28,
                boxShadow: sheetState.boxShadow,
              }
            : undefined
        }
        initial={reduced ? { opacity: 0 } : originState}
        animate={reduced ? { opacity: 1 } : sheetState}
        // Drag is a dismissal affordance on every sheet; snapping UP to
        // full requires `expandable`. Armed only after the entrance.
        drag={opened && !reduced ? "y" : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.16, bottom: 0.24 }}
        onDragEnd={(_, info) => {
          if (info.offset.y < -DRAG_PX && expandable && !isFull) {
            setIsFull(true);
          } else if (info.offset.y > DRAG_PX) {
            if (isFull) setIsFull(false);
            else onClose();
          }
        }}
        exit={
          reduced
            ? { opacity: 0 }
            : {
                ...originState,
                // Reverse beats: drop to the origin's height first, then
                // narrow onto its footprint — the origin control restores
                // beneath as this lands.
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
          reduced
            ? { duration: 0.01 }
            : opened
              ? SETTLED
              : {
                  // Beat one: widen in place at the origin's height (a
                  // full-width origin collapses this to a quick settle).
                  left: { duration: settleDur, ease: EASE_OUT },
                  width: { duration: settleDur, ease: EASE_OUT },
                  borderRadius: { duration: settleDur, ease: EASE_OUT },
                  boxShadow: { duration: settleDur, ease: EASE_OUT },
                  // Beat two: stretch up and down simultaneously.
                  bottom: {
                    delay: stretchAt,
                    duration: STRETCH,
                    ease: EASE_OUT,
                  },
                  height: {
                    delay: stretchAt,
                    duration: STRETCH,
                    ease: EASE_OUT,
                  },
                }
        }
      >
        {/* Grabber arrives with the title, once geometry has landed. */}
        <motion.div
          className="bottom-sheet__grabber"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          transition={{
            duration: reduced ? 0.01 : 0.14,
            delay: reduced ? 0 : titleAt,
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
            duration: reduced ? 0.01 : 0.14,
            ease: EASE_OUT,
            delay: reduced ? 0 : titleAt,
          }}
        >
          <div className="bottom-sheet__header">
            <h2>{title}</h2>
            <div className="bottom-sheet__header-actions">
              {headerExtra}
              {expandable && (
                <button
                  type="button"
                  className="bottom-sheet__expand"
                  aria-label={isFull ? "Collapse" : "Expand"}
                  onClick={() => setIsFull(f => !f)}
                >
                  {isFull ? (
                    <ChevronsDown aria-hidden="true" />
                  ) : (
                    <ChevronsUp aria-hidden="true" />
                  )}
                </button>
              )}
              <button
                type="button"
                className="bottom-sheet__done"
                onClick={onClose}
              >
                {doneLabel}
              </button>
            </div>
          </div>
        </motion.div>
        <motion.div
          className="bottom-sheet__body"
          style={{ minWidth: finalWidth - 40 }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            opacity: 0,
            y: 6,
            transition: { duration: reduced ? 0.01 : 0.08 },
          }}
          transition={{
            duration: reduced ? 0.01 : 0.18,
            ease: EASE_OUT,
            delay: reduced ? 0 : bodyAt,
          }}
        >
          {children}
        </motion.div>
      </motion.div>
    </>
  );
};
