# BottomSheet — Design

Date: 2026-08-03. Status: approved pending Rishi's spec review.

## Purpose

Extract the sheet-morph choreography that exists twice in
`NavigationBarStage.tsx` (`ActionSheetMorph`, `UtilitySheetMorph`) into a
first-class, public registry component: `BottomSheet`. It opens out of an
origin control to a configurable initial height, and a control extends it
to a full-screen state. Exactly two stops — initial and full — no mid
heights.

## Design philosophy

Drop-in first (Rishi's standing rule for the lab): a prop-driven component
whose motion internals are well-commented in-file constants, not props.
Configure only what consumer apps genuinely vary on: origin, title, body,
initial height, expandability, dismiss handling. Readers who need more own
the source (copy-the-source model). No hook/primitives API unless a real
consumer someday needs composition.

## Component

`client/src/components/bottom-sheet/BottomSheet.tsx` (+ `index.ts`).
Self-contained styling (Tailwind utilities + inline styles, like
`NavigationBar.tsx`) — no stage CSS dependency. Demo-specific content
styling stays in the demo stages.

### API

```tsx
export type SheetOrigin = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
};

export type BottomSheetProps = {
  /** Rect of the control the sheet grows out of (and contracts back
   *  into). Capture at press time via getBoundingClientRect(). */
  origin: SheetOrigin;
  /** Header title — ReactNode so consumers can include an icon
   *  (the Assistant does). */
  title: React.ReactNode;
  /** Accessible name for the dialog (aria-label). */
  ariaLabel: string;
  /** Done button, scrim tap, Escape, and drag-down dismiss all call this;
   *  the consumer unmounts the sheet (inside AnimatePresence). */
  onClose: () => void;
  /** Initial height: 0<h<=1 → fraction of viewport (resolved to px —
   *  dvh does not interpolate); >1 → px; "auto" → content height.
   *  Default "auto". */
  height?: number | "auto";
  /** Shows the extend control and enables drag snapping to full.
   *  Default false. */
  expandable?: boolean;
  /** Default "Done". */
  doneLabel?: string;
  /** Optional slot rendered in the header next to Done. */
  headerExtra?: React.ReactNode;
  /** Override only; defaults to the component's own useReducedMotion().
   *  Opacity-only transitions when true. */
  reducedMotion?: boolean;
  className?: string;
  children: React.ReactNode; // body
};
```

Mount contract: the consumer renders `<BottomSheet>` inside its own
`AnimatePresence` and unmounts it to close — identical to today's morphs —
so `onExitComplete` restore hooks (bar regrow, focus return) keep working
unchanged. The component owns: scrim, dialog semantics
(`role="dialog"`, `aria-modal`), Escape handling, geometry, beats, drag,
and the extend control.

## States and geometry

- **Initial**: the configured height. Fractions resolve against
  `window.innerHeight`; `"auto"` sizes to content (framer animates
  auto fine — the px↔dvh gotcha is avoided by resolving to numbers).
- **Full**: 94% of viewport height, still a floating card — radius 28,
  bottom margin 12, sliver of dimmed page visible. Never edge-welded.
- Width in both states: `min(vw − 24, 512)`, centered (unchanged from
  the existing morphs).
- Exactly two stops. Transition initial ↔ full: single height/bottom
  animation, ~0.3s, standard EASE (the existing Assistant post-entrance
  transition band).

## Motion (moves in verbatim from the verified morphs)

Entrance, serial beats (raw seconds, no TEMPO — local to the morph):
WIDEN 0.24 from the origin footprint (left/width/borderRadius, EASE_OUT)
→ gap 0.08 → STRETCH 0.28 up+down simultaneously (bottom/height,
EASE_OUT) → grabber+title fade 0.14 at TITLE_AT → gap 0.06 → body at
BODY_AT (0.18, y 8→0). Scrim fades in at STRETCH_AT. Body min-width is
pinned to final width − 40 so text never rewraps mid-grow.

Exit reverses per-property: content out fast (0.08) → drop to origin
height (bottom/height 0.22 @ 0.06, EASE_IN) → narrow onto the footprint
(left/width/radius 0.2 @ 0.32) → shadow eases down across (0.46).

Reduced motion: opacity-only in/out, durations ~0.01, no geometry; drag
disabled (extend control still works — instant height change).

## Extend control + drag

- Header layout: grabber, then title row: title · [headerExtra] ·
  expand control (only when `expandable`) · Done.
- Expand control: small ghost icon button — chevron-up glyph, flipping
  to chevron-down when full; `aria-label` "Expand" / "Collapse".
- Drag (only when `expandable`, entrance complete, and not reduced
  motion — the existing `opened` gate, ~1.1s): framer `drag="y"`,
  constraints {0,0}, elastic {top 0.16, bottom 0.24}. On release:
  offset < −70 at initial → full; offset > 70 at full → initial;
  offset > 70 at initial → dismiss. (Verbatim the Assistant's thresholds,
  minus mid stops.)
- Non-expandable sheets: no control, drag only dismisses (offset > 70)
  — today's workflow/Export sheets never had drag; giving them
  drag-to-dismiss is a small deliberate upgrade, consistent with the
  grabber affordance.

## Refactor (NavigationBarStage)

Delete `ActionSheetMorph` and `UtilitySheetMorph`. Consumers become:

- Workflow sheet: `<BottomSheet origin={centerBarRect} title={label}
height="auto">` + existing ghost-row body.
- Export: origin = right button rect, `height="auto"`, `expandable` (the
  flagship demos the new control).
- Assistant: origin = right button rect, `height={0.62}`, `expandable`,
  title with Sparkles icon, chat body (flex layout handled by the body
  slot's own styles).

The bar's clear-out choreography (`isActionSheetOpen`,
`isUtilitySheetOpen`, prep timers) is untouched — the bar owns emptying
itself; the sheet owns being a sheet. `BoxOrigin` in the stage is
replaced by `SheetOrigin` imported from the component.

Behavior deltas accepted in the refactor (everything else must match the
verified frame captures): Export gains the expand control + drag;
workflow sheets gain drag-to-dismiss; Assistant's half↔full drag becomes
initial↔full (same 0.62/0.94 stops it has today).

## Registry entry + demo stage

- Registry slug `bottom-sheet`, name "Bottom Sheet", its own usage
  snippet (origin capture at press time + AnimatePresence mount) and
  tryIt hints.
- `client/src/stages/BottomSheetStage.tsx` (+ CSS): a simple canvas with
  two trigger buttons, each the origin its sheet grows out of —
  "Fixed height" (`height={0.6}`, `expandable`) and "Auto height"
  (`height="auto"`, `expandable`) — demonstrating open, extend to full,
  drag snapping, and dismissal. Triggers sit in the lower half of the
  canvas so the morph reads naturally.

## Verification

Frame-by-frame Playwright captures (the established loop):

1. NavigationBar regressions: workflow sheet open/close, Export
   open/close, Assistant open → drag/extend to full → back → dismiss —
   compared against the choreography specs in HANDOFF.md.
2. New: extend-control toggle (initial → full → initial) on both demo
   sheets; drag-past-threshold dismiss; reduced-motion end states.
3. `pnpm check`, `pnpm build`, prettier.

## Out of scope

- Focus trapping / full aria audit (roadmap item 2, the a11y pass).
- Beat-timing override props (add when a consumer needs them).
- Mid-height snap points, edge-welded full-screen mode.
