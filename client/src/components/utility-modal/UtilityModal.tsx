/**
 * UtilityModal
 * Part of Rishi's UI Lab — © 2026 Rishi Dean (rishidean.com)
 * MIT license · github.com/rishidean/ui-lab
 *
 * A full-screen modal takeover that expands as a circle from the center
 * point of the control that owns it, and contracts back to the same
 * point on close. Use it for focused tasks that temporarily replace the
 * page context (a camera scanner, a full-screen editor) — for surfaces
 * that should stay attached to the page, use BottomSheet instead.
 *
 * Mount contract: render inside your own <AnimatePresence> and unmount
 * to close. Exit choreography runs on unmount; use onExitComplete to
 * restore the origin control (fade it back in, return focus).
 *
 * Styling reads the token contract in theme/theme.css — copy that file
 * with this component. The modal supplies the scrim, the circle clip,
 * and a `--surface-modal` sheet under your content, so the takeover
 * reads against the page even before children paint anything; your
 * children supply the full-screen surface and its close control (and
 * may paint over the sheet entirely, as a camera view would).
 */
import React, { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { useInertOutside } from "@/lib/a11y";
import "./UtilityModal.css";

/** Center point of the control the modal expands from — capture at
 *  press time: `{ x: rect.left + rect.width / 2, y: rect.top +
 *  rect.height / 2 }`. */
export type ModalOrigin = { x: number; y: number };

export type UtilityModalProps = {
  origin: ModalOrigin;
  /** Accessible name for the dialog. */
  ariaLabel: string;
  /** Scrim tap and Escape call this; the consumer unmounts the modal to
   *  run the exit choreography. Give your content its own close control
   *  too — the scrim is fully covered once the circle lands. */
  onClose: () => void;
  /** Circle-grow duration in seconds; the contraction runs at 0.85×. */
  growDuration?: number;
  /** Override only; defaults to the system preference. */
  reducedMotion?: boolean;
  className?: string;
  children: React.ReactNode;
};

const EASE = [0.2, 0, 0, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

// Small beat before the circle starts growing: the button-sized circle
// registers over its (fading) origin control, so the reveal reads as
// the control unfolding rather than a cut. The grow itself uses the
// symmetric ease — an ease-out here front-loads the motion and the
// origin moment is gone within two frames.
const REVEAL_DELAY = 0.06;

export const UtilityModal: React.FC<UtilityModalProps> = ({
  origin,
  ariaLabel,
  onClose,
  growDuration = 0.42,
  reducedMotion,
  className,
  children,
}) => {
  const systemReduced = useReducedMotion();
  const reduced = reducedMotion ?? !!systemReduced;

  const grow = growDuration;
  // Near-symmetric contraction: a fast (0.7×) shrink plus an instant
  // scrim lift read as a flash on phones, not a close choreography.
  const shrink = grow * 0.85;

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

  const modalRef = useRef<HTMLDivElement | null>(null);
  const scrimRef = useRef<HTMLButtonElement | null>(null);
  // Everything outside the modal + scrim is inert while mounted — focus
  // cannot escape, the page is hidden from screen readers, and the exit
  // choreography stays covered until unmount.
  useInertOutside(true, modalRef, scrimRef);
  // Initial focus: the dialog itself, so its aria-label announces without
  // disturbing the entrance beats.
  useEffect(() => {
    modalRef.current?.focus({ preventScroll: true });
  }, []);

  // The modal owns its dismissal paths: scrim tap and Escape.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Reduced motion: opacity-only, no geometry.
  const clipProps = reduced
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
        transition: { duration: grow, ease: EASE, delay: REVEAL_DELAY },
      };

  return (
    <>
      {/* Backdrop dims after the surface begins growing; the page
          beneath stays rendered as context until the circle covers it. */}
      <motion.button
        ref={scrimRef}
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className="utility-modal__scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        /* The scrim keeps dimming the page while the circle contracts,
           and lifts only once the surface has landed back on the origin
           — lifting it with the contraction reads as a hard cut. */
        exit={{
          opacity: 0,
          transition: {
            duration: reduced ? 0.01 : 0.2,
            ease: EASE,
            delay: reduced ? 0 : shrink * 0.75,
          },
        }}
        transition={{
          duration: reduced ? 0.01 : 0.24,
          ease: EASE,
          delay: reduced ? 0 : REVEAL_DELAY + 0.06,
        }}
        onClick={onClose}
      />
      {/* The halo carries the disc's drop-shadow: filters are applied
          BEFORE clip-path on the same element, so a shadow on the
          clipped div itself would be clipped away — it must live on a
          wrapper. (The wrapper is full-viewport, so the containing
          block it creates for the fixed child changes nothing.) */}
      <div className="utility-modal__halo">
        <motion.div
          ref={modalRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          className={cn("utility-modal", className)}
          {...clipProps}
          exit={{
            ...clipProps.exit,
            transition: {
              duration: reduced ? 0.01 : shrink,
              ease: EASE_IN,
            },
          }}
        >
          {/* Destination content is visible from the FIRST frame — the
              button-sized circle shows a porthole of the surface, and the
              growth stays legible the whole way. (Fading content in late
              makes most of the reveal invisible.) Symmetrically, content
              carries NO exit fade: it stays painted to the last frame and
              the contracting circle clips it away — an early fade leaves
              an empty disc shrinking against the page. */}
          <motion.div
            className="utility-modal__content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: reduced ? 0.01 : 0.12,
              ease: EASE,
              delay: reduced ? 0 : REVEAL_DELAY,
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      </div>
    </>
  );
};
