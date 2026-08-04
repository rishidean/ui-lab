/**
 * BottomSheet demo stage.
 * Part of Rishi's UI Lab — © 2026 Rishi Dean (rishidean.com)
 * MIT license · github.com/rishidean/ui-lab
 *
 * Two triggers, each the origin its sheet grows out of: a fixed-height sheet (60% of the viewport) and an auto-height
 * sheet. Both extend to full screen via the header control or the
 * grab-bar drag; drag down snaps back, then dismisses.
 */
import { BottomSheet, type SheetOrigin } from "@/components/bottom-sheet";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { CalendarRange, ListChecks, Send } from "lucide-react";
import { useRef, useState } from "react";
import "./BottomSheetStage.css";

type DemoKind = "fixed" | "auto";

export default function BottomSheetStage() {
  const prefersReducedMotion = useReducedMotion();
  const fixedRef = useRef<HTMLButtonElement | null>(null);
  const autoRef = useRef<HTMLButtonElement | null>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState<{
    kind: DemoKind;
    origin: SheetOrigin;
  } | null>(null);

  const openFrom = (kind: DemoKind, el: HTMLButtonElement | null) => {
    if (!el || open) return;
    lastTrigger.current = el;
    const r = el.getBoundingClientRect();
    setOpen({
      kind,
      origin: {
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        bottom: r.bottom,
      },
    });
  };
  const close = () => setOpen(null);

  return (
    <main className="bs-demo">
      <div className="bs-demo__canvas" aria-hidden="true">
        <div className="bs-demo__ghost-block" />
        <div className="bs-demo__ghost-block bs-demo__ghost-block--short" />
      </div>
      <div className="bs-demo__triggers">
        <button
          type="button"
          ref={fixedRef}
          onClick={() => openFrom("fixed", fixedRef.current)}
        >
          <CalendarRange aria-hidden="true" /> Weekly summary
        </button>
        <button
          type="button"
          ref={autoRef}
          onClick={() => openFrom("auto", autoRef.current)}
        >
          <ListChecks aria-hidden="true" /> Quick actions
        </button>
      </div>

      <AnimatePresence
        onExitComplete={() => {
          lastTrigger.current?.focus();
        }}
      >
        {open?.kind === "fixed" && (
          <BottomSheet
            key="fixed"
            origin={open.origin}
            title="Weekly summary"
            ariaLabel="Weekly summary"
            onClose={close}
            height={0.6}
            expandable
            reducedMotion={!!prefersReducedMotion}
          >
            <div className="bs-demo__rows" aria-hidden="true">
              <div className="bs-demo__row" />
              <div className="bs-demo__row" />
              <div className="bs-demo__row bs-demo__row--short" />
            </div>
          </BottomSheet>
        )}
        {open?.kind === "auto" && (
          <BottomSheet
            key="auto"
            origin={open.origin}
            title="Quick actions"
            ariaLabel="Quick actions"
            onClose={close}
            height="auto"
            expandable
            reducedMotion={!!prefersReducedMotion}
          >
            <div className="bs-demo__actions">
              <button type="button" onClick={close}>
                <Send aria-hidden="true" /> Send update
              </button>
              <button type="button" onClick={close}>
                <CalendarRange aria-hidden="true" /> Schedule review
              </button>
              <button type="button" onClick={close}>
                <ListChecks aria-hidden="true" /> Mark all done
              </button>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>
    </main>
  );
}
