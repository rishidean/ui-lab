# Press & Slide Picker

Design spec and implementation record for the PressAndSlidePicker — a
Facebook-Reactions-style press-and-slide gesture picker. Source in
`client/src/components/press-and-slide-picker/PressAndSlidePicker.tsx`
(+ co-located `PressAndSlidePicker.css`), demo stage in
`client/src/stages/PressAndSlidePickerStage.tsx`. The original functional
spec (pre-lab, 2026-08-05 import) is preserved verbatim at
`docs/superpowers/specs/2026-08-05-press-and-slide-picker-design.md`;
deviations from it are recorded here. See `HANDOFF.md` for session
continuity.

## Demo stage (2026-09-15)

The stage is a task list — eight rows of gradient tiles (the
NavigationBar stage's tile grammar) each carrying one picker as its
status chip — because changing a status in a list is the problem the
component exists for. It shares the lab's DemoControls panel (option
set: status / priority / t-shirt size; long-press hold; option width;
all URL-pinnable as `?set=&hold=&item=` for recordings), embedded in
the site's demo canvas like the bar, with the panel hung from the left
so it never covers the chips. Covered by `scripts/a11y/a11y-picker-stage.mjs`.

## Sliding thumb (2026-09-15, Rishi's iteration #1)

The strip's highlight is one pill (`.psp-thumb`) that glides under the
labels instead of hopping item to item. The pointer handlers write its
`transform` straight to the DOM (never through React, so it cannot
fight a re-render); while tracking it is magnetised toward the nearest
slot centre (`C.thumbPull` = 0.35 of the finger's offset, 70ms linear so
it stays glued) and it locks into a slot with a 240ms ease on lift, on
leaving the zone, and as the strip dismisses. Only its hue is
React-driven, crossfading as the active option changes. Items no longer
paint their own pill; they keep the label tint. Reduced motion drops the
transform transitions. Covered by the "glides between slots" / "locks
onto the nearest slot" assertions in `a11y-picker-stage.mjs`.

## Hold affordance and drop-in packaging (2026-09-15)

- **Hold ring.** While the long-press timer runs, the chip wrapper
  carries `data-priming` and a hairline conic ring (`.psp-chip::after`,
  `--psp-prime` animated 0→360deg over `--psp-hold`, which the component
  stamps from `longPressDuration`) sweeps around it — the hold reads as
  registering before the strip appears. Cleared on move/lift/cancel and
  the moment the strip opens; reduced motion shows a static faint ring.
  Custom `renderChip` triggers get it for free (the ring is on the
  wrapper). Covered by `a11y-picker-stage.mjs`.
- **Drop-in #2.** The folder is self-contained (`lib.ts` copies `cn`;
  `README.md` carries install, the generated variable block, usage,
  contracts). `scripts/registry/build.mjs` builds
  `/r/press-and-slide-picker.{json,zip}` alongside the bar's; the Code
  tab shows the Install panel. The collector now treats reads with an
  inline fallback as optional (listed under a comment in the block, never
  a drift failure) — the picker reads every theme token that way.

## Purpose

The most frequent operation in a task tool is changing status, and in most
apps that's a dropdown: tap, scan, tap. The picker replaces it with one
continuous gesture — long-press the status chip, slide to the new value,
release. One motion, roughly a second, no overlay obscuring the list. The
interaction model comes from Facebook's Reactions picker; the component is
generic over any small (3–6), finite, mutually exclusive option set —
status, priority, t-shirt sizing.

## Structure

- **Chip (trigger):** a fully-rounded pill shaped like the bar's
  `nav-action-chip` — inline dot plus the current label in 13px DM Sans,
  sentence case. It rests as a soft tint of the option's color (9%
  `color-mix` background, 18% border) and firms up when the strip engages
  (16% / 34% plus the nav chip's inset shadow). Colors come from the
  consumer's `options` array (`color` + optional `bg`) — per-option colors
  are props, not theme tokens, by design. `renderChip` swaps in a custom
  trigger; the demo stage uses it for recording prominence.
- **Strip (gesture surface):** a fully-rounded glass capsule holding one
  row of 34px pill chips — the NavigationBar filter strip's proportions on
  the gesture layer — portaled to `document.body`.
- **Fallback listbox (tap surface):** the same options as a static
  `role="listbox"` menu with roving focus, opened by plain click or
  keyboard, visually identical to the strip.

## Interaction contract

### Gesture mode (primary)

1. Press and hold the chip for 275ms (`longPressDuration`).
2. The strip appears below the chip (above if there's no room), current
   value pre-highlighted.
3. Selection tracking begins only once the pointer enters the strip's hit
   zone (enter-gate — the strip never jumps to whatever is under the
   finger at open). The hit zone extends 8px horizontally / 16px
   vertically beyond the visual bounds (halo).
4. Crossing an option boundary fires a light haptic; the tinted pill hops
   to the option under the finger — the gesture-layer echo of the filter
   strip's sliding highlight. No scale-up; the pill is the state.
5. Release commits; a changed value fires a heavy haptic. Moving more than
   36px vertically away while outside the zone cancels. Escape cancels.
6. The click event after a completed gesture is suppressed so it can't
   also open the fallback.

### Tap mode (fallback)

Plain click (or Enter/Space/ArrowDown on the focused chip) opens the
listbox. Arrow keys rove, Enter/Space selects, Escape or click-away
dismisses and returns focus to the chip. Options are divs with
`role="option"`, not buttons, so the picker can nest inside card-as-button
consumers; `stopPropagation` keeps selections from triggering the host.

### Scroll and resize

Any ancestor scroll or a viewport resize dismisses both surfaces without
committing (capture-phase window listener — the lab shell scrolls an inner
container, not the window). The anchor rect is captured once at open;
dismiss-on-scroll is what keeps it honest.

## Positioning

Both surfaces are portaled to `document.body` and positioned `fixed` at
viewport coordinates from the chip's `getBoundingClientRect()`:

- Centered horizontally on the chip, clamped to 8px inside both viewport
  edges. Item widths compress proportionally down to a 40px floor when the
  ideal width exceeds the viewport; labels drop from 13px to 12px below
  60px items.
- Prefers below the chip; flips above when there's no room.

**Deviation from the original spec:** the spec called for "no portal
dependency" so the component could run in artifact renderers without
`react-dom`. In the lab that constraint is gone and the portal is
load-bearing — without it, any transformed ancestor (the old demo stage
scaled the picker 1.35×) becomes the containing block for
`position: fixed` and re-bases the strip far from the chip. This was the
shipped positioning bug. `getBoundingClientRect()` returns post-transform
viewport coordinates, so portal + fixed + the existing math is correct
even inside scaled ancestors.

## Visual design

**Deviation from the original spec:** the spec's strip was a fixed dark
surface (`rgba(28,28,30,.96)`, 16px blur, system font). The lab build
instead sits on the site's theme contract:

- Strip and listbox are fully-rounded glass capsules on `.glass-overlay`
  (theme/glass.css) — Aurora glass in light, Ink glass in dark — holding one row
  of 34px `rounded-full` pill chips: the NavigationBar filter strip's
  proportions (`h-[34px]`, 13px DM Sans medium, sentence case).
- **Pill = state**, per the bar's settled grammar: options rest as ghost
  dot-plus-label chips (`--text-secondary`); the active/selected option
  carries the select-pill formula translated into its own hue —
  `color-mix(in oklab, <option color> 16%, transparent)` background, 28%
  border, and label ink of `color-mix(<option color> 58%, --gray-900)`.
  Because `--gray-900` inverts per theme, the same mix yields darkened
  color-on-tint in light mode and lightened color-on-tint in dark. The
  saturated hue itself lives only in the 7px dots.
- The committed value stays typographically present while the pill is
  under the finger elsewhere: its label holds `--text-primary` at weight
  600 (labels trade colors — the NavigationBar move).
- Focus rings follow the site convention: `:focus-visible` only,
  outline-based, `color-mix(in oklab, var(--iris-700) …, transparent)` —
  ring outside the chip (offset 2), inside the listbox options
  (offset -2). Hover on listbox options is a background hint
  (`--action-ghost-bg-hover`), not an outline.

## Motion

**Deviation from the original spec:** the spec's 3-keyframe entrance with
102% overshoot is replaced by the site grammar — no overshoot anywhere.

- Curves: EASE `[0.2,0,0,1]` for item highlight, EASE_OUT `[0,0,0.2,1]`
  for reveals, EASE_IN `[0.4,0,1,1]` for the exit.
- Durations: `DUR = { stripIn: 0.2, stripOut: 0.14, item: 0.14 }` × the
  site `TEMPO` (1.3). TS constants are the single source; they reach the
  CSS as `--psp-*` custom properties stamped on the portal roots, and the
  JS unmount timer derives from the same table.
- Entrance: fade + 4px rise from 96% scale. Exit: fade + 2px drop to 98%.
- `prefers-reduced-motion`: CSS disables all animation/transitions and
  the dismiss path unmounts immediately instead of waiting out the timer.

## Implementation notes

- Gesture engine is dependency-free (raw touch/mouse events, refs for
  stale-closure safety); no motion library — mount/dismiss is CSS.
- Scroll-vs-longpress discrimination: >10px movement during the hold
  window cancels the press and yields to scroll.
- Haptics via `navigator.vibrate` (6/12/20ms); silently no-ops on iOS
  Safari.
- Body scroll is locked during the gesture; inner scrollers are covered by
  the dismiss-on-scroll listener instead.
- The old injected `<style data-psp>` singleton is gone — styles live in
  the co-located CSS file (BottomSheet pattern, `var(--token, fallback)`).

## What this doesn't do (unchanged from spec)

No option reordering, no multi-select, no nested options, no animated
color-morph on the chip after commit.
