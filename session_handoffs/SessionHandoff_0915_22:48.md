# Session Handoff — 2026-09-15 22:48 EDT (branch: main)

Supersedes `SessionHandoff_0813_14:21.md`. Two days of work (09-14 and
09-15), 29 commits on `main` since `7557455`, all deployed to
https://ui-lab.r7n.co (the customer-facing URL; `lab.rishidean.com` is
dropped). `HANDOFF.md` carries the running recap; this file is the
session record.

## Status

- **NavigationBar**: done, and now a drop-in (see below). No choreography
  changes this session and none planned.
- **PressAndSlidePicker**: the overhaul that sat uncommitted for six weeks
  is committed (`3109c95`), the component went through three iterations
  Rishi asked for, and it is drop-in #2. Real-device pass still owed.
- **Site**: every component embeds its stage iframe with one toolbar
  (viewport toggle + controls pill); presentation mode is deleted.

## What shipped, in order

**Day 1 (09-14) — demo canvas and recording**
1. Nav demo cards became plain gradient tiles (`c2ebd72`); recording
   pipeline `scripts/record/nav-bar.mjs` + `post-nav-bar.sh` → three MP4s
   in `demos/navigation-bar/` (`39858f7`, `7557455`); demo controls ride
   the URL (`?depth=&tempo=&rm=`).
2. **NavigationBar drop-in pass** (spec `docs/superpowers/specs/2026-09-14-…`,
   plan `docs/superpowers/plans/2026-09-15-…`, executed subagent-driven,
   merged `ff9cf8b`): CSS split (`theme/glass.css` + `navigation-bar.css`,
   `theme.css` tokens-only), `lib.ts`, variable collector + drift test,
   `size` presets (compact / default / large — large is 60px, not 64,
   with a fifth `--nav-chip-px` variable; both measured at 390px),
   `useCollapseOnScroll`, five runnable examples, component README.
3. **Install artifacts** (`22b65d3`): `scripts/registry/build.mjs` writes
   `/r/<slug>.{json,zip}` (shadcn item format + hand-written STORE zip)
   before dev/build; Code tab opens with an Install panel. `.lab-main`
   got `min-width: 0` (the Code tab used to stretch past the viewport).
4. **Toolbar** (`5b4bc9e`): viewport toggle + "controls" pill above the
   canvas, 16px clear; the pill drives the stage's DemoControls over
   postMessage; embedded panels render headless.

**Day 2 (09-15) — picker**
5. Picker overhaul committed; stage is a task list (8 rows, one picker
   each) in the bar stage's tile grammar; DemoControls became a shared
   shell (`stages/DemoControls.tsx` + `useDemoControls.ts`) (`675f761`).
6. Picker is drop-in #2 + hold-affordance ring (`a51f636`). Collector
   treats fallback reads as optional; both READMEs guarded.
7. Rishi's three iterations: (1) sliding thumb pill, magnetised, locks
   on lift (`a4aac3a`); (2) selected option nearest the finger, divider,
   rest natural; (3) strip grows where there is room — horizontal full →
   compact (no dot) → vertical down/up → centred fallback, longest label
   canvas-measured (`76dbf67`). Then: size set default, "Opens" control
   (`placement` prop), presentation mode removed (`5adde47`); vertical
   corner radius matched to the pills (`aa2728f`); picker examples,
   label-sized columns, repo hygiene, README install section (`feabc50`).

Suite: 123 → 257 assertions, 0 failures throughout.

## Decisions made (Rishi's)
- shadcn CLI is a distribution convenience, not the substance; the folder
  + README are. Manifest built anyway once the folder was clean.
- Large preset 60px/14px label (not 64/15); fifth chip-padding variable.
- `up`/`down` placements mean a **column**; horizontal-above only happens
  under auto when there is no room below.
- Presentation mode (beats, present button, PickerShowcase) deleted.
- `.claude/worktrees` and every `node_modules` are Dropbox-ignored (xattr).

## Open / next
- **Real-device pass on the picker gesture** (pull 0.35, cross-axis
  escape 36px, haptics). Only Rishi can do this.
- Consider moving the checkout out of Dropbox — git stalled for minutes
  during a Dropbox self-update (see memory note "Dropbox git stalls").
- Stale remote branch `origin/claude/ui-lab-design-impl-rblpj5` — unknown
  origin, left alone. `.claude/worktrees/site-controls-strip/` directory
  lingers on disk (not a git worktree any more; gitignored).
- Picker: a shared-strip `PressAndSlideGroup` if the list case wants one.

## Environment notes (also in memory)
- `/usr/bin/git` may demand the Xcode license; use
  `/Library/Developer/CommandLineTools/usr/bin/git`.
- Warm the dev server before `test:a11y`; a cold Vite reload fails the
  first script spuriously.
- Never put `pkill -f "<pattern>"` on the same shell line as a git
  command whose text matches the pattern — it kills the shell and orphans
  git holding `index.lock`.
