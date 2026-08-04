# BottomSheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the twin sheet morphs in `NavigationBarStage.tsx` into a public, drop-in `BottomSheet` registry component with two height stops (configurable initial ↔ full), then consume it from the NavigationBar demo and a new demo stage.

**Architecture:** Prop-driven component (spec: `docs/superpowers/specs/2026-08-03-bottom-sheet-design.md`). The component owns scrim, dialog semantics, Escape, origin-footprint morph beats, drag snapping, and the extend control. Consumers mount it inside their own `AnimatePresence` and unmount to close; `onExitComplete` remains their restore hook. Beat constants stay in-file, not props.

**Tech Stack:** React 19, motion/react (framer), Tailwind 4 utilities + component-scoped CSS, lucide-react, Vite 7, pnpm. Verification via `pnpm check`/`pnpm build` and headless Playwright frame captures (scripts in `/tmp/pw`, server on :4999).

## Global Constraints

- No `layout`/`layoutId` on morph surfaces; animate measured px values (HANDOFF gotcha).
- Heights: viewport fractions resolve to px numbers; px↔dvh never interpolates.
- Full stop = 94% viewport, floating card (radius 28, bottom 12) — never edge-welded.
- Exactly two stops: initial and full. Drag thresholds ±70px, elastic {top 0.16, bottom 0.24}, drag armed at 1100ms.
- Beats (raw seconds, no TEMPO): WIDEN 0.24 → +0.08 → STRETCH 0.28 → title 0.14 → +0.06 → body.
- Reduced motion: opacity-only, durations 0.01, drag disabled.
- Prettier before commit (`pnpm format`); commits carry the Claude trailer.
- Server restarts: `pkill -f "node dist/index.js"` alone, then `(PORT=4999 nohup node dist/index.js > /tmp/server.log 2>&1 < /dev/null &)`.

---

### Task 1: BottomSheet component

**Files:**

- Create: `client/src/components/bottom-sheet/BottomSheet.tsx`
- Create: `client/src/components/bottom-sheet/BottomSheet.css`
- Create: `client/src/components/bottom-sheet/index.ts`

**Interfaces:**

- Produces: `BottomSheet` (React FC) and `SheetOrigin` type, imported as `import { BottomSheet, type SheetOrigin } from "@/components/bottom-sheet"`. Props: `{ origin: SheetOrigin; title: ReactNode; ariaLabel: string; onClose: () => void; height?: number | "auto"; expandable?: boolean; doneLabel?: string; headerExtra?: ReactNode; reducedMotion?: boolean; className?: string; children: ReactNode }`.

- [ ] **Step 1: Write `BottomSheet.tsx`**

```tsx
/**
 * BottomSheet — dStil
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
import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
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

  const [isFull, setIsFull] = useState(false);

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
        type="button"
        aria-label="Close"
        className="bottom-sheet__scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: reduced ? 0.01 : 0.22,
          ease: EASE,
          delay: reduced ? 0 : STRETCH_AT,
        }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn("bottom-sheet", className)}
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
                  // Beat one: widen in place at the origin's height.
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
          className="bottom-sheet__grabber"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          transition={{
            duration: reduced ? 0.01 : 0.14,
            delay: reduced ? 0 : TITLE_AT,
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
            delay: reduced ? 0 : TITLE_AT,
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
            delay: reduced ? 0 : BODY_AT,
          }}
        >
          {children}
        </motion.div>
      </motion.div>
    </>
  );
};
```

- [ ] **Step 2: Write `BottomSheet.css`** (ported verbatim from the stage's sheet classes, renamed; theme variables with fallbacks so the component drops into apps without the lab's tokens)

```css
/* BottomSheet — self-contained styles. Reads the host app's theme
   variables where present, with neutral fallbacks. */

.bottom-sheet__scrim {
  position: fixed;
  inset: 0;
  z-index: 55;
  border: 0;
  padding: 0;
  background: rgb(24 18 34 / 0.22);
  cursor: pointer;
}

.bottom-sheet {
  position: fixed;
  z-index: 60;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 0.8);
  background: linear-gradient(
    180deg,
    rgb(255 255 255 / 0.96),
    rgb(250 248 255 / 0.9)
  );
  backdrop-filter: saturate(1.45) blur(18px);
  -webkit-backdrop-filter: saturate(1.45) blur(18px);
  padding: 0.5rem 1.25rem 2.25rem;
  font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
}

.bottom-sheet__grabber {
  flex: 0 0 auto;
  width: 2.25rem;
  height: 0.3rem;
  margin: 0.4rem auto 0.9rem;
  border-radius: 999px;
  background: rgb(53 42 75 / 0.16);
}

.bottom-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.bottom-sheet__header h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary, #241c33);
}

.bottom-sheet__header h2 svg {
  width: 1.1rem;
  height: 1.1rem;
  color: var(--gray-900, #241c33);
}

.bottom-sheet__header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bottom-sheet__done {
  border: 0;
  background: var(--select-bg, #ece7fb);
  color: var(--select-fg, #5b21b6);
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  cursor: pointer;
}

.bottom-sheet__expand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary, #55496b);
  cursor: pointer;
  transition: background-color 0.2s;
}

.bottom-sheet__expand:hover {
  background: rgb(53 42 75 / 0.08);
}

.bottom-sheet__expand svg {
  width: 1.1rem;
  height: 1.1rem;
}

.bottom-sheet__body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
```

- [ ] **Step 3: Write `index.ts`**

```ts
export { BottomSheet } from "./BottomSheet";
export type { BottomSheetProps, SheetOrigin } from "./BottomSheet";
```

- [ ] **Step 4: Typecheck** — Run `pnpm check`. Expected: clean (component compiles unused).

- [ ] **Step 5: Commit** — `pnpm format`, then commit `feat: BottomSheet — drop-in bar-grammar sheet with initial + full stops`.

---

### Task 2: NavigationBarStage consumes BottomSheet

**Files:**

- Modify: `client/src/stages/NavigationBarStage.tsx` (delete `ActionSheetMorph` ~line 458-628, `UtilitySheetMorph` ~line 155-383, local `BoxOrigin` type; replace the two `AnimatePresence` bodies)
- Modify: `client/src/stages/NavigationBarStage.css` (prune `__sheet-morph`, `__sheet-morph--flex`, `__sheet-scrim`, `__sheet-grabber`, `__sheet-header` (+`h2`/`button` blocks), `__assistant-title` (+svg) — keep `__sheet-body`, `__sheet-row`, `__sheet-bubble*`, `__sheet-input`, `__export-rows` (demo body content))

**Interfaces:**

- Consumes: `BottomSheet`, `SheetOrigin` from Task 1.
- Produces: unchanged stage behavior; `sheetOrigin`/`utilSheetOrigin` states retyped to `SheetOrigin | null`.

- [ ] **Step 1: Rewire imports and types** — add `import { BottomSheet, type SheetOrigin } from "@/components/bottom-sheet";`, delete the `BoxOrigin` type and replace its 4 usages with `SheetOrigin`. Remove now-unused Escape effects for `openSheet` and `utilSheet` (the component owns Escape; KEEP the Scan `utility` Escape effect).

- [ ] **Step 2: Replace the workflow-sheet AnimatePresence body**

```tsx
{
  openSheet && sheetOrigin && (
    <BottomSheet
      key={openSheet}
      origin={sheetOrigin}
      title={openSheet}
      ariaLabel={`${openSheet} workflow`}
      onClose={closeSheet}
      reducedMotion={!!prefersReducedMotion}
    >
      <div className="navigation-demo__sheet-body" aria-hidden="true">
        <div className="navigation-demo__sheet-row" />
        <div className="navigation-demo__sheet-row" />
        <div className="navigation-demo__sheet-row navigation-demo__sheet-row--short" />
      </div>
    </BottomSheet>
  );
}
```

- [ ] **Step 3: Replace the utility-sheet AnimatePresence body** (Export gains `expandable`; Assistant keeps its 0.62 initial and full stops)

```tsx
{
  utilSheet === "export" && utilSheetOrigin && (
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
      <div className="navigation-demo__export-rows">
        <button type="button" onClick={closeUtilitySheet}>
          <FileSpreadsheet aria-hidden="true" /> Download CSV
        </button>
        <button type="button" disabled aria-disabled="true">
          <FileText aria-hidden="true" /> Download PDF
          <span className="navigation-demo__export-unavailable">
            Unavailable
          </span>
        </button>
        <button type="button" onClick={closeUtilitySheet}>
          <Link2 aria-hidden="true" /> Share link
        </button>
      </div>
    </BottomSheet>
  );
}
{
  utilSheet === "assistant" && utilSheetOrigin && (
    <BottomSheet
      key="assistant"
      origin={utilSheetOrigin}
      title={
        <>
          <Sparkles aria-hidden="true" /> Assistant
        </>
      }
      ariaLabel="Assistant"
      onClose={closeUtilitySheet}
      height={0.62}
      expandable
      reducedMotion={!!prefersReducedMotion}
    >
      <div
        className="navigation-demo__sheet-body"
        style={{ marginTop: "auto" }}
        aria-hidden="true"
      >
        <div className="navigation-demo__sheet-bubble navigation-demo__sheet-bubble--user" />
        <div className="navigation-demo__sheet-bubble navigation-demo__sheet-bubble--loading" />
        <div className="navigation-demo__sheet-input">Ask anything…</div>
      </div>
    </BottomSheet>
  );
}
```

- [ ] **Step 4: Delete both morph components + prune CSS** per the Files list. Remove imports that become unused (check `X`? no — ScanView uses it; remove none blindly, run check).

- [ ] **Step 5: Verify** — `pnpm check && pnpm build`, restart :4999, re-run `/tmp/pw` regression captures: workflow sheet (Deposit open/close), Export open + extend + close, Assistant open + extend via drag + collapse + dismiss. Read frames against HANDOFF choreography specs 1 & 3.

- [ ] **Step 6: Commit** — `refactor: NavigationBar sheets consume BottomSheet`.

---

### Task 3: Registry entry + demo stage

**Files:**

- Create: `client/src/stages/BottomSheetStage.tsx`
- Create: `client/src/stages/BottomSheetStage.css`
- Modify: `client/src/lab/registry.tsx` (imports + new entry appended to `labComponents`)

**Interfaces:**

- Consumes: `BottomSheet`, `SheetOrigin` from Task 1.
- Produces: registry slug `bottom-sheet` (route `/bottom-sheet`).

- [ ] **Step 1: Write `BottomSheetStage.tsx`**

```tsx
/**
 * BottomSheet stage — two triggers, each the origin its sheet grows out
 * of: a fixed-height sheet (60% of the viewport) and an auto-height
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
```

- [ ] **Step 2: Write `BottomSheetStage.css`** (canvas + glass trigger pills + ghost body rows; mirror the lab's restrained ghost-content style — muted blocks, DM Sans, theme variables)

```css
/* BottomSheet demo — restrained canvas; the sheet is the focal object. */

.bs-demo {
  position: relative;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 2.25rem;
  padding: 2.5rem 1.25rem 5rem;
  background: var(--bg-canvas, #f6f4fb);
}

.bs-demo__canvas {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  justify-content: center;
}

.bs-demo__ghost-block {
  height: 7.5rem;
  border-radius: 1.25rem;
  background: rgb(255 255 255 / 0.6);
  border: 1px solid rgb(255 255 255 / 0.8);
}

.bs-demo__ghost-block--short {
  height: 4.5rem;
  opacity: 0.7;
}

.bs-demo__triggers {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.bs-demo__triggers button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid rgb(88 71 116 / 0.14);
  background: linear-gradient(
    180deg,
    rgb(255 255 255 / 0.9),
    rgb(255 255 255 / 0.66)
  );
  box-shadow: 0 10px 28px rgb(48 36 72 / 0.12);
  backdrop-filter: saturate(1.4) blur(14px);
  -webkit-backdrop-filter: saturate(1.4) blur(14px);
  border-radius: 999px;
  padding: 0.7rem 1.15rem;
  font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #241c33);
  cursor: pointer;
}

.bs-demo__triggers button svg {
  width: 1rem;
  height: 1rem;
  color: var(--text-secondary, #55496b);
}

.bs-demo__rows,
.bs-demo__actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.bs-demo__row {
  height: 3.25rem;
  border-radius: 1rem;
  background: rgb(53 42 75 / 0.06);
}

.bs-demo__row--short {
  width: 62%;
  height: 2.5rem;
}

.bs-demo__actions button {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border: 1px solid rgb(88 71 116 / 0.12);
  background: rgb(255 255 255 / 0.7);
  border-radius: 1rem;
  padding: 0.85rem 1rem;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #241c33);
  cursor: pointer;
}

.bs-demo__actions button svg {
  width: 1rem;
  height: 1rem;
  color: var(--text-secondary, #55496b);
}
```

- [ ] **Step 3: Register in `registry.tsx`** — add imports:

```tsx
import BottomSheetStage from "@/stages/BottomSheetStage";
import bottomSheetSource from "@/components/bottom-sheet/BottomSheet.tsx?raw";
```

usage snippet const:

```tsx
const bottomSheetUsage = `import { useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { BottomSheet, type SheetOrigin } from "@/components/bottom-sheet";

const triggerRef = useRef<HTMLButtonElement | null>(null);
const [origin, setOrigin] = useState<SheetOrigin | null>(null);

<button
  ref={triggerRef}
  onClick={() => {
    const r = triggerRef.current!.getBoundingClientRect();
    setOrigin({ top: r.top, left: r.left, width: r.width,
                height: r.height, bottom: r.bottom });
  }}
>
  Open
</button>

{/* Mount inside your own AnimatePresence; unmount to close. The exit
    choreography contracts the sheet back into the trigger, and
    onExitComplete is your restore hook. */}
<AnimatePresence onExitComplete={() => triggerRef.current?.focus()}>
  {origin && (
    <BottomSheet
      origin={origin}        // the control the sheet grows out of
      title="Details"
      ariaLabel="Details"
      height={0.6}           // fraction of viewport, px, or "auto"
      expandable             // header control + drag: initial ↔ full
      onClose={() => setOrigin(null)}
    >
      {/* body */}
    </BottomSheet>
  )}
</AnimatePresence>`;
```

entry appended to `labComponents`:

```tsx
{
  slug: "bottom-sheet",
  name: "Bottom Sheet",
  tagline: "A sheet that grows out of the control that owns it — two stops: yours, and full screen.",
  description:
    "A floating bottom sheet with origin-aware choreography: it starts as a clone of its trigger, widens, then stretches to a configurable initial height in strictly serial beats. One control (and the grab-bar drag) extends it to full screen — still a floating card, never welded to the edge. Exactly two stops, no mid heights. Extracted from the Navigation Bar's workflow and utility sheets, which now consume it.",
  tags: ["overlay", "mobile", "motion", "glassmorphism"],
  status: "stable",
  accent: "linear-gradient(135deg, #a5b4fc 0%, #c4b5fd 45%, #fbcfe8 100%)",
  Stage: BottomSheetStage,
  source: bottomSheetSource,
  sourceFile: "BottomSheet.tsx",
  dependencies: ["react", "motion", "lucide-react", "clsx + tailwind-merge (cn)"],
  usage: bottomSheetUsage,
  tryIt: [
    "Tap a trigger — the sheet grows out of the button that owns it",
    "Tap the chevrons (or drag the grab bar up) to extend to full screen",
    "Drag down to snap back to the initial height; drag down again to dismiss",
    "Escape and the scrim dismiss too; watch the sheet contract back into its trigger",
    "Quick actions is an auto-height sheet — it still extends to full",
  ],
  aliases: ["sheet"],
},
```

- [ ] **Step 4: Verify** — `pnpm check && pnpm build`, restart :4999, Playwright captures on `/bottom-sheet`: open fixed sheet (entrance beats), extend via control (mid + settled frames), collapse, drag-dismiss; open auto sheet + extend; reduced-motion end states. Read every frame.

- [ ] **Step 5: Commit** — `feat: Bottom Sheet registry entry + demo stage`.

---

### Task 4: Docs sync + push

**Files:**

- Modify: `HANDOFF.md` (NEXT UP item 1 → done; promote a11y pass; note BottomSheet in project shape)
- Modify: `NavigationBarOverview.md` (Workflow/Utility sheet sections: one-line note that the surface is the shared `BottomSheet` component; Export now expandable)

- [ ] **Step 1: Update both docs** as above (exact wording at implementer's discretion — keep the verified beat descriptions untouched).
- [ ] **Step 2: `pnpm format && pnpm check`**, commit `docs: BottomSheet extraction recorded`, `git push origin main`.
