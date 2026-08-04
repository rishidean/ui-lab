# Session Handoff — Rishi's UI Lab

Working doc for continuing the NavigationBar motion/design work in a fresh
session. Repo: `github.com/rishidean/ui-lab` (push to `main` auto-deploys on
Railway via the Dockerfile). Owner: Rishi (rishidean).

## Project shape

- Vite 7 + React 19 + TS + Tailwind 4, pnpm. `pnpm check` (tsc), `pnpm build`,
  `pnpm format` (prettier). Express serves `dist/public` from `dist/index.js`.
- Verification loop used throughout: build → serve on :4999 → headless
  Playwright scripts capturing mid-animation frames at specific timestamps →
  read the screenshots → commit → push.
- `client/src/lab/registry.tsx` is the single source of truth for the site
  (names, usage snippets, tryIt hints). Keep it in sync with behavior changes.

## The flagship: NavigationBar

`client/src/components/navigation-bar/NavigationBar.tsx` (component) +
`client/src/stages/NavigationBarStage.tsx` (demo stage) + stage CSS.

### Design grammar (settled, do not regress)

- **Pill = state.** Action chips are ghost labels at rest; lavender
  `--select-bg` pill only for engaged/selected. Purple = navigation,
  ink = action. Icons live only on the two circles; chips are text-only.
- **Every surface grows out of the control that owns it.** Menu ← left
  circle. Workflow sheet ← center bar. Utility sheets/modals ← right button.
  Search ← the bar itself morphs.
- **Undot / dot the horizontal "i".** Any absorb: right button pops out
  FIRST. Any regrow: right button returns LAST, after the bar lands.
- **Strictly serial beats.** Confirm → clear-out → geometry → title → body.
  Nothing overlaps unless the spec says "simultaneously".
- **Easing:** EASE_OUT [0,0,0.2,1] for reveals, EASE_IN [0.4,0,1,1] for
  collapses, EASE [0.2,0,0,1] symmetric. Global `TEMPO = 1.3` multiplies all
  durations/delays via `dur()`/`del()`. Reduced motion → 0 durations,
  opacity-only for surfaces.

### Choreography specs implemented (all verified frame-by-frame)

1. **Workflow sheet (action press):** circles fade together → beat → all
   labels fade → beat → emptied bar WIDENS in place to sheet width → beat →
   stretches up+down simultaneously → title/Done fade → beat → body. Close
   reverses (content out, drop to bar height, narrow onto footprint, controls
   return). `ActionSheetMorph` in the stage; `isActionSheetOpen` prop drives
   the bar's fade phase; stage `sheetPrep` + 440ms timer before mount.
2. **Tab selection from menu:** pressed row takes highlight and HOLDS
   (~160ms, `SELECT_CONFIRM_S`, `pendingTab` state) → menu collapses into
   left circle WHILE its icon swaps → beat → bar regrows left-to-right →
   beat → utility dots in (`CLOSE_DELAYS`: tabIconSwap 0.02, pillGrow 0.22,
   rightButtonFadeIn 0.46). Dismissal = same close without the hold.
3. **Utility bottom sheets (Export, Assistant):** utility pressed state →
   nav circle fades → bar sweeps inward L→R INTO the right button → button
   fades WHILE sheet widens out of its footprint → stretch up+down → title →
   beat → body. Close fully reverses (button returns first, bar regrows from
   the RIGHT — originX held at 1 until regrow lands — circle last).
   `UtilitySheetMorph` + `isUtilitySheetOpen` prop (`UTILITY_SHEET_DELAYS`),
   stage `utilSheetPrep` + 500ms timer. Assistant keeps half↔full drag
   (enabled only after entrance, `opened` state).
4. **Modal takeovers (Scan):** SAME clear-out as sheets, then the modal
   expands as a circle from the button's CENTER POINT (`UtilitySurface`
   clipPath). Close: circle contracts to the point, then restore. The legacy
   `isUtilityOpen` absorb path is no longer driven by the stage (prop still
   exists on the component).
5. **Search:** bar morphs into the field right-to-left (unchanged this
   round). Scroll collapse/expand: absorb/regrow with hysteresis (unchanged).
6. **Filter strip (Transactions):** serial beats per the Overview spec —
   chip pressed feedback → RHS undots → its width collapses so the strip
   widens into the vacated space (left circle FIXED) → label fades after
   the geometry lands → page dims (light scrim, in-component) → options
   reveal with the measured highlight pill (placed via option ref callback,
   NOT the useLayoutEffect — options mount after the label exits under
   AnimatePresence mode="wait", so the effect alone measures too early).
   Selection: highlight slides → confirm hold (DUR.direct +
   FILTER_DELAYS.confirmHold) → options fade → chip label returns updated
   while the strip is still wide → strip contracts → RHS dots in last;
   the stage reshuffles its ghost cards with a short content transition
   during the collapse. Dismissal (scrim tap / outside / Escape) = same
   close, no hold, no label change. All in FILTER_DELAYS.

### Timing constants live at the top of NavigationBar.tsx

`OPEN_DELAYS`, `CLOSE_DELAYS`, `SCROLL_COLLAPSE/EXPAND_DELAYS`,
`UTILITY_SHEET_DELAYS`, `FILTER_DELAYS`, `DUR`, `TEMPO`. Morph beat timings
(WIDEN 0.24 / gap 0.08 / STRETCH 0.28 / title / gap 0.06 / body) are local to
the two morph components in the stage (raw seconds, no TEMPO).

## NEXT UP (the reason for this handoff)

1. **Accessibility pass** — focus trapping in sheets/modals, focus return
   (partially done: onExitComplete focuses the origin control), aria audit,
   keyboard paths for every surface.

(Both previous items landed, frame-verified: Filter choreography — see
Choreography specs #6 and the Overview's Filtering section — and the
**BottomSheet extraction**: `client/src/components/bottom-sheet/` is a
public registry entry (`/bottom-sheet`, spec in
`docs/superpowers/specs/2026-08-03-bottom-sheet-design.md`) that owns
scrim/Escape/morph beats/drag; two stops only, configurable initial +
full (94%, floating card), chevron header control + drag snapping.
`ActionSheetMorph`/`UtilitySheetMorph` are deleted — the workflow sheet,
Export (now expandable), and Assistant mount `<BottomSheet>` inside the
stage's AnimatePresence; the bar's clear-out props are unchanged. Design
rule from Rishi: lab components are drop-in-first — prop-driven, motion
internals stay in-file constants, configure only app-critical surfaces.)

## Remaining roadmap after that

2. **Code cleanup + on-page instructions** — surface the registry `tryIt`
   hints on the Preview tab; prune the now-unused `isUtilityOpen` absorb
   branches if Rishi agrees the old grammar is dead; update the registry
   `usage` snippet (it still documents `isUtilityOpen`).
3. **Site description** (About/landing copy).

## Housekeeping

- Rishi should revoke the `ghp_…` push token when iteration ends (he knows).
  Pushes go: `git push https://rishidean:<token>@github.com/rishidean/ui-lab.git main`.
- Commit trailer convention: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Custom domain (lab.rishidean.com) still pending in Railway → Networking.

## Gotchas learned the hard way

- Never combine framer's `layout`/`layoutId` with manual scaleX/origin
  animation on these surfaces (FLIP fights, origin hijacking). Measure and
  animate x/width instead.
- `originX` must be set inside `animate` (not style) to hold every frame;
  flips are `{ duration: 0 }`, optionally delayed (see utility-sheet close).
- Height `"auto"` animates fine in framer; px↔dvh does NOT — resolve dvh to
  px numbers (see Assistant heights).
- `pkill` in a compound bash command kills the command itself (exit 144) —
  run it alone, then restart with
  `(PORT=4999 setsid nohup node dist/index.js > /tmp/server.log 2>&1 < /dev/null &)`.
- Playwright scripts: write via the Write tool into /tmp/pw (heredocs inside
  compound commands fail silently), `node /tmp/pw/<script>.mjs`, view the
  PNGs directly.
