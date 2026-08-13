# Session Handoff — 2026-08-13 14:21 EDT (branch: main)

Supersedes `SessionHandoff_0813_11:40.md`, which was written pre-merge and
describes `nav-glass-activation` as unmerged. It is now merged and
deployed.

## Status: NavigationBar is DONE

Rishi's call at the end of this session. The bar is finished; work moves
to the **overall site UI and functionality** next, and the
**PressAndSlidePicker** after that.

## What shipped this session

All on `main` at `f2784db`, Railway deployment `state=success`.

1. **BottomSheet arm-window wedge fixed** (`b294eb5`). Closing ~580–1100ms
   after mount permanently wedged the dialog with the page left `inert`.
   The drag-arm timer's `setOpened` re-render fired mid-exit and reset
   framer's exit bookkeeping, so the child was never removed and
   `onExitComplete` never fired. Gated on `useIsPresent()`.
2. **Assistant close unwinds in four beats** (`7fdf722`): transcript fades
   → card contracts to the resting input row → row contents fade → the bar
   returns exactly as it does pre-message.
3. **Dormant-until-engaged bar** — the headline. At rest the glass thins
   and desaturates and the tab glyph goes neutral; engaged it is
   byte-identical to before. Three channels ride one intermediate
   (`--nav-dormant = (1 - --nav-engage) * --nav-dormancy-depth`) so they
   cannot drift. Depth and sheerness are tokens, so consumers can dial or
   disable the whole thing without touching the component.
4. **The dock wash is gone.** A full-bleed 170px gradient painted BETWEEN
   the page and the bar. It made every backdrop effect measure as dead
   (1/255 with it, 15/255 without) and had already caused a working
   feature to be reverted on false evidence. Rishi spotted it visually
   after instrumentation had repeatedly missed it.
5. **`.glass-rim` gradient-edge system** across pill, both circles, menu,
   and sheet. A uniform border reads as a drawn stroke; this is a masked
   gradient ring, bright at the top. `border-image` cannot do it — it
   ignores `border-radius`.
6. **Menu is glass and dims the page** like the sheets. It had been ~99%
   opaque while the bar sits at ~26%.
7. **Two theme-blind shadow bugs** (menu, sheet). Shadows inside framer
   variants must be literals, so they cannot be theme-aware; both carried
   the light preset's shadow plus a full-strength white inset into dark
   mode — that inset was the "too thick top border".
8. **Demo control panel** (dormancy depth, tempo, reduced motion), plus
   `tempo?: number` and `reducedMotion?: boolean` props.
9. **Bolder demo cards** — at lightness 0.94 the effect measured 8/255 and
   was invisible; at 0.70/0.15 it measures 27/255.

**BREAKING:** `SHEET_CLEAROUT_MS` (constant) → `sheetClearoutMs(tempo)`
(function). A TEMPO-derived constant desyncs the moment a consumer passes
a non-default `tempo`. Noted in README.

Suite: **123 assertions, 0 failures** (verified on merged `main`, not just
the branch).

## Decisions made

- Engaged = any non-rest bar state, derived from state the component
  already tracks. Scroll-collapsed counts as REST.
- No a11y assertion was relaxed. Nothing gated this anyway — the suite
  checks token pairs over canvas, not glass opacity — so it gained
  coverage instead.
- The momentary regrow blur is **accepted, not fixed** (below).
- NavigationBar is done; next is site-wide UI/functionality, then Picker.

## Open questions / known issues

- **Momentary label blur on regrow — deliberately unfixed.** Pre-existing,
  GPU-only, self-resolving. Four attempts failed and were reverted: rAF
  repaint through the regrow (fires, no effect); delaying the label fade
  past the scale (pixel-verified, no effect); promoting labels to their
  own layer via `translateZ(0)` (no effect). Ruled out: stale bundle, page
  zoom. The two real fixes are structural — animate `width` instead of
  `scaleX`, or drop `backdrop-filter` for the duration — and both cost
  more than the symptom. Full record in a comment above
  `repaintPillText`. **Do not start a fifth point fix.**
- **Dormancy defaults were never ratified on device** — depth 1, drain 0.8
  (full liquid-glass at rest). Judged from screenshots only. Both are
  single tokens in `theme.css`.
- **Resting label legibility is now content-dependent.** 11.8:1 measured
  over the demo's content; nothing tests darker backdrops.
- `HANDOFF.md`'s NEXT UP was updated on disk but is **uncommitted**,
  because that file also carries Rishi's in-progress picker recap. It
  commits whenever the picker work is committed or discarded.

## Process notes worth keeping

- **Shell cwd silently reset to the main repo after a subagent run**, and
  three files were edited there instead of in the worktree. Caught,
  restored with `git checkout`, re-applied on the branch; the picker WIP
  was never touched. Always `cd` explicitly in the same command when
  working in a worktree.
- **Scrolling content behind the bar also COLLAPSES the bar**, so several
  backdrop measurements were of a hidden pill before it was caught. Any
  future backdrop measurement must assert the pill is expanded (width
  ~218 at 390px viewport) first.
- The merge required parking the picker WIP in a named stash, because two
  of its files (`HANDOFF.md`, `registry.tsx`) were also changed on the
  branch. Stash **without** `-u`: an untracked-inclusive stash would sweep
  `.claude/`, which contains live worktrees.

## Next steps

1. **Site UI and functionality** — the whole lab site, not the components.
   Existing leftovers that fold into this: registry `dependencies` arrays
   are prose and should link to files/sources; README needs a Bottom Sheet
   row and a Theming section.
2. **Then PressAndSlidePicker** — the overhaul is still uncommitted in the
   working tree (5 modified, 4 untracked files). Decide commit vs discard
   when picking it up.
3. Optional, whenever: judge the dormancy defaults on a real device.
