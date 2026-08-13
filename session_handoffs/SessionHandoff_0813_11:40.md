# Session Handoff — 2026-08-13 11:40 (branch: nav-glass-activation)

## What was worked on

Two things landed on `main` early, then a long exploratory branch that is
**pushed but NOT merged**.

### On `main` (deployed)

1. **BottomSheet arm-window wedge fixed** (`b294eb5`). Closing between
   ~580–1100ms after mount permanently wedged the dialog with the page
   left `inert`. Cause: the drag-arm timer's `setOpened` re-render fired
   mid-exit, resetting framer's exit bookkeeping, so the child was never
   removed and `onExitComplete` never fired. Gated on `useIsPresent()`.
2. **Assistant close unwinds in four beats** (`7fdf722`) — transcript
   fades, card contracts to the resting input row, row contents fade,
   then the bar returns exactly as it does pre-message.

### On `nav-glass-activation` (28 commits, unmerged)

**Dormant-until-engaged NavigationBar.** At rest the bar drains: the
glass thins and desaturates, the tab glyph goes neutral. Engaged — any
non-rest state — it returns to exactly today's appearance. Three channels
ride one intermediate, `--nav-dormant = (1 - --nav-engage) *
--nav-dormancy-depth`, so they cannot drift.

**The dock wash removal is the finding of the session.** The component
painted a full-bleed 170px gradient BETWEEN the page and the bar. It made
every backdrop-based effect measure as dead — a saturation swing moved
the rendered pill 1/255 with it, 15/255 without. It had already caused a
working feature to be reverted on false evidence before it was found.
Rishi spotted it visually; no amount of instrumentation had.

**Demo control panel** (`DemoControls`, a lab affordance, not part of the
component): dormancy depth, tempo, reduced-motion override. Required two
new props and one breaking export change.

**Gradient rim system.** A uniform bright border reads as a drawn stroke;
`.glass-rim` is a masked gradient ring — bright along the top, nearly
gone at the sides, picking up at the bottom. `border-image` cannot do
this (it ignores `border-radius`). Applied to the pill, both circles, the
menu, and the sheet.

**Menu is glass and dims the page**, matching the sheets. It was ~99%
opaque while the bar sits at ~26% — a see-through capsule spawning a
solid slab.

**Two theme-blind shadow bugs.** Shadows inside framer variants must be
literals (framer will not interpolate `var()`), so they cannot be
theme-aware. The menu and the sheet both carried the LIGHT preset's
shadow plus a full-strength white inset into dark mode — that inset was
the "too thick top border". There are now zero shadows inside animated
variants; the circles were audited and are clean.

**Bolder demo cards.** At lightness 0.94 the dormancy effect measured
8/255 and was invisible; at 0.70/0.15 it measures 27/255.

## Decisions made

- Engaged = any non-rest bar state, derived from state the component
  already computes. Scroll-collapsed counts as REST.
- `--nav-dormancy-depth` and `--nav-glass-drain` are tokens, so consumers
  can dial or disable the effect without touching the component.
- BREAKING: `SHEET_CLEAROUT_MS` (constant) → `sheetClearoutMs(tempo)`
  (function). A TEMPO-derived constant desyncs the moment a consumer
  passes a non-default `tempo`. One real caller in-repo.
- No a11y assertion was relaxed. Nothing gated this anyway — the suite
  checks token pairs over canvas, not glass opacity. It gained coverage
  instead. Suite: 123 assertions, 0 failures.

## Open questions / known issues

- **Momentary label blur on regrow — UNRESOLVED, left deliberately.**
  Pre-existing, GPU-only, self-resolving. Four fixes failed: rAF repaint
  through the regrow (fires, no effect); delaying the label fade past the
  scale (pixel-verified, no effect); promoting labels to their own layer
  (no effect); all reverted. Ruled out: stale bundle, page zoom. The two
  real fixes are structural — animate `width` instead of `scaleX`, or
  drop `backdrop-filter` for the duration — and both cost more than the
  symptom is worth. Rishi's call: leave it. Full record in a comment
  above `repaintPillText`; **do not start a fifth point fix.**
- Dormancy default ships at depth 1 / drain 0.8 (full liquid-glass at
  rest). Never explicitly ratified — worth a look on device.
- Resting label legibility is now content-dependent. Measured 11.8:1 at
  rest over the demo's content, but over much darker content it would
  fall. No test covers this; the demo's content is the only case checked.

## Process notes

- **I edited three files in the MAIN worktree by mistake** when the shell
  cwd silently reset after a subagent run. Caught immediately, restored
  with `git checkout`, and re-applied on the branch. Rishi's uncommitted
  PressAndSlidePicker work was never touched — verify with `git status`
  on main if in doubt. Lesson: always `cd` explicitly in the same command
  when working in a worktree.
- Several intermediate measurements were invalid before being caught:
  scrolling to put content behind the bar also COLLAPSES the bar, so a
  hidden pill was being diffed. Any future backdrop measurement must
  assert the pill is expanded (width ~218 at 390px) first.

## Next steps

Nothing queued. The branch is pushed and unmerged — `main` is untouched
and still carries Rishi's uncommitted picker work. Merging is a deliberate
decision: it changes the flagship's resting appearance and ships a
breaking export rename.
