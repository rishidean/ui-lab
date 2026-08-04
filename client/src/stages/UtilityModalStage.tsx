/**
 * UtilityModal demo stage.
 * Part of Rishi's UI Lab — © 2026 Rishi Dean (rishidean.com)
 * MIT license · github.com/rishidean/ui-lab
 *
 * One trigger — the modal expands as a circle from the trigger's center
 * point to a full-screen skeleton surface, and contracts back to the
 * same point on close.
 */
import { UtilityModal, type ModalOrigin } from "@/components/utility-modal";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { Maximize2, X } from "lucide-react";
import { useRef, useState } from "react";
import "./UtilityModalStage.css";

export default function UtilityModalStage() {
  const prefersReducedMotion = useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [origin, setOrigin] = useState<ModalOrigin | null>(null);

  const open = () => {
    const el = triggerRef.current;
    if (!el || origin) return;
    const r = el.getBoundingClientRect();
    setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };
  const close = () => setOrigin(null);

  return (
    <main className="modal-demo">
      <div className="modal-demo__canvas" aria-hidden="true">
        <div className="modal-demo__ghost-block" />
        <div className="modal-demo__ghost-block modal-demo__ghost-block--short" />
      </div>
      <div className="modal-demo__triggers">
        <button type="button" ref={triggerRef} onClick={open}>
          <Maximize2 aria-hidden="true" /> Open takeover
        </button>
      </div>

      <AnimatePresence onExitComplete={() => triggerRef.current?.focus()}>
        {origin && (
          <UtilityModal
            key="takeover"
            origin={origin}
            ariaLabel="Takeover demo"
            onClose={close}
            reducedMotion={!!prefersReducedMotion}
          >
            <div className="modal-demo__surface">
              <button
                type="button"
                className="modal-demo__close"
                aria-label="Close"
                onClick={close}
              >
                <X aria-hidden="true" />
              </button>
              <div className="modal-demo__rows" aria-hidden="true">
                <div className="modal-demo__row" />
                <div className="modal-demo__row" />
                <div className="modal-demo__row modal-demo__row--short" />
              </div>
            </div>
          </UtilityModal>
        )}
      </AnimatePresence>
    </main>
  );
}
