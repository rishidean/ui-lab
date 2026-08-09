# Sheet Morph Unification: Design Spec

**Components:** `NavigationBar` (launch grammar), `BottomSheet` (entrance contingency), NavigationBar demo stage
**Author:** Rishi Dean
**Status:** Approved design, not yet implemented
**Builds on:** `2026-08-08-assistant-in-bar-design.md` (the assistant bar-morph this generalizes from)

---

## Why this exists

The NavigationBar now has three launch grammars where it should have two.
Search and the Assistant morph the bar itself — circles recede outward,
the pill becomes the surface. But the sheet-backed surfaces still run an
older, inward grammar: workflow sheets fade the bar's chrome in place,
and Export runs a three-beat sweep that absorbs the bar INTO the utility
button before the sheet blooms back out of that small footprint. Rishi's
read: the collapse-into-the-button launch fights the outward feel the
assistant established.

This change gives every sheet the search-style launch: circles recede,
the emptied pill stays as a full-width seed, and the BottomSheet grows
straight up out of it — one continuous surface, whichever control was
pressed. The sheet itself is untouched once open: stops, drag, scrim,
and dialog semantics all survive. The priority named for this work:
**it must look good, and the code must be un-hacky enough that outside
developers can follow it.** The design leans on deletion — one grammar
replaces two, and the inward-sweep choreography is removed outright.

## Decisions already made

- **Scope:** workflow sheets (Deposit, Withdraw, Pay, Request, Buy,
  Sell, Swap, Stake, Convert) and Export unify. **Scan stays as-is**
  (circle-reveal takeover — a different surface type, deliberately).
- **BottomSheet remains a standalone public component.** Only the
  launch/close seam changes; its open-state behavior (two stops, drag
  snapping, scrim, inert containment) is untouched.
- **The launch is the search grammar:** both circles recede, the pill
  empties but keeps its glass, the sheet grows from the full bar rect.
  Close reverses back onto the bar, then the circles return.
- **Breaking renames are acceptable** (repo precedent: the 2026-08-04
  consumer refactor). The demo stage is the only consumer.

## API changes

### NavigationBar

```ts
// REMOVED (breaking):
isActionSheetOpen?: boolean;
isUtilitySheetOpen?: boolean;
export const ACTION_SHEET_CLEAROUT_MS: number;
export const UTILITY_CLEAROUT_MS: number;

// ADDED:
/** Sheet clear-out: both circles recede (search-style) and the pill's
 *  labels fade, leaving the full-width glass as the surface a
 *  BottomSheet grows out of. Flip this, wait SHEET_CLEAROUT_MS, then
 *  measure the bar and mount the sheet. */
isSheetOpen?: boolean;
export const SHEET_CLEAROUT_MS: number;
```

`SHEET_CLEAROUT_MS` derives from the recede beats × `TEMPO` exactly as
its predecessors did — retuning the bar keeps consumers in sync. Target
≈ 0.3s × TEMPO (recede band + a breath): roughly half today's utility
clear-out, because there is no sweep-into-the-button beat anymore.

Internally, the circle conditionals that read `isSearchOpen`-era flags
extend to one predicate: circles recede when
`isBarInputMode || isSheetOpen`. The `UTILITY_SHEET_DELAYS` table, the
inward-sweep `scaleX`/`originX` branches on the pill, and the
`utilitySheetClosing` falling-edge machinery are **deleted** — every
transition ternary in the file loses a branch.

### BottomSheet (contingency, non-breaking)

When the mount-time `origin` is already at least the sheet's target
width, the entrance skips the widen beat and goes straight to the
stretch (the widen would be a ~240ms no-op that delays the growth).
Implemented as a derived internal check on origin vs. target width — no
new prop, consumers never think about it. All other entrances behave
exactly as today.

## Choreography

All bar-side timing runs through `dur`/`del` (× TEMPO, 0 under reduced
motion), existing EASE constants, ease-out reveals / ease-in collapses.

### Launch (identical for every sheet surface)

1. Press feedback on the control (existing chip/button tap scale).
2. Circles recede — left width→0, utility width→0, the same 0.25-band
   treatment search uses. Simultaneously the pill's labels and dividers
   fade (the existing action fade becomes the only fade variant).
3. At `SHEET_CLEAROUT_MS` the stage measures the pill's rect — AFTER
   the recede, so it spans the full row — and mounts the BottomSheet.
4. The sheet's clone lands pixel-on-pixel on the emptied pill (same
   glass, same 24px radius, now same width) and stretches upward into
   the card; the skip-widen check makes the stretch immediate. Scrim
   fades in with the stretch, as today.

### Close (Done / Escape / scrim tap / drag-down)

1. The sheet contracts back down onto the bar rect (BottomSheet's
   existing reverse geometry).
2. `onExitComplete` → the stage drops `isSheetOpen`.
3. The pill's labels fade back in, then the circles dot the ends —
   reusing search-close's return beats, not new ones.
4. Focus returns as today: pressed chip for workflow sheets
   (`focusWhenClear`), utility button for Export.

### Documentation deliverable

The bar's motion comment-tables are rewritten to describe THREE
grammars — bar-internal morph (Search, Assistant), sheet launch (this),
takeover (Scan) — instead of today's five. Those tables are the file's
real documentation; shrinking them is part of the work, not an
afterthought.

## Demo stage changes

- The action-press path and `openUtilitySheet` converge on one
  `openSheet(kind)` helper: set `isSheetOpen`, wait `SHEET_CLEAROUT_MS`,
  measure `actionBarRef`, mount. One code path instead of two.
- Origin capture moves from press-time to the timer callback
  (mount-time) — capturing at press would bake in the narrower
  pre-recede rect.
- `sheetPrep`/`utilSheetPrep` merge into the single flag; the
  `overlayOpenRef` disjunction shrinks accordingly.
- Export's sheet keeps `height="auto" expandable`; workflow sheets keep
  their current props. Assistant/search stage wiring untouched.

## Accessibility & testing

- Dialog semantics unchanged (inert containment, initial focus, Escape,
  focus return) — `a11y-sheet.mjs` and `a11y-bottom-sheet-stage.mjs`
  should pass with at most timing-window adjustments for the shorter
  clear-out.
- `a11y-triggers.mjs`: Export's `aria-haspopup="dialog"` semantics are
  unchanged; assertions that wait on old clear-out timings get their
  waits retuned.
- Verification loop: `pnpm check`, prettier, `pnpm build`, full
  `pnpm test:a11y` against `:4999`, plus a headless choreography script
  (throwaway, in the SDD workspace) asserting: post-recede origin width
  ≈ full row width; no widen beat when origin is full-width (stretch
  starts ≤ 1 frame after mount); close lands the sheet back on the bar
  rect before circles return. Browser-pane screenshots for the visual
  pass — launch, open card, drag-to-full, close.

## Edge cases

- Press while another surface is transitioning: existing stage guards
  (one surface at a time) carry over to the single `openSheet` path.
- Scroll-collapse stays disabled while `isSheetOpen` (existing
  `overlayOpenRef` pattern).
- Rapid open/close retargets from current animated values — framer
  default, matching the assistant's behavior.
- Reduced motion: clear-out window 0, sheet entrance instant
  (BottomSheet's existing reduced-motion path).
- Window resize while open: BottomSheet already re-resolves its stops;
  the origin rect is only used at mount/exit, and exit-to-a-moved-bar
  is no worse than today (same rect-capture semantics).
