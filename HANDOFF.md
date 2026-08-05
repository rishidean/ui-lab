# Session Handoff — Rishi's UI Lab

Working doc for continuing the lab's component work in a fresh session.
Repo: `github.com/rishidean/ui-lab` (push to `main` auto-deploys on
Railway via the Dockerfile). Owner: Rishi (rishidean).

## Latest session (2026-08-04) — recap

Everything below landed, frame-verified, and is pushed/deployed:

1. Filter choreography (serial beats per the Overview spec).
2. BottomSheet extracted as a public registry entry (`/bottom-sheet`);
   NavigationBar's three sheets consume it.
3. Consumer refactor: canonical naming (breaking prop renames),
   attribution headers, theme.css token contract with Aurora/Ink presets
   - shell toggle, isUtilityOpen pruned, `Action.isFilter`, exported
     clear-out constants.
4. UtilityModal extracted (`/utility-modal`); all demo sheets are
   multi-level with shimmer skeletons; usage docs explain surface
   routing + file dependencies.
5. Rishi's sweep fixes: hover/pressed states on NavigationButton /
   UtilityButton / Done / expand; legible modal reveal (content visible
   from frame one); NavigationButton absorb pulse; filter-highlight
   second-open bug (stale AnimatePresence exit props + mid-widen
   measurement — see Gotchas).
6. **Accessibility pass:** new `client/src/lib/a11y.ts` — `useInertOutside`
   (native `inert` containment for BottomSheet + UtilityModal, dialogs take
   initial focus, scrims are pointer-only) and `focusWhenClear` (bounded
   rAF-poll focus return that waits for `inert` to lift; used at every
   `onExitComplete` focus-return site plus the filter chip's return — see
   Gotchas). NavigationBar's tab menu is a proper APG menu (ArrowUp/Down,
   Home/End, Enter/Space, Escape); the filter is a radiogroup (roving
   arrow keys + Enter/Space). `UtilityAction` gained `opensDialog?:
   boolean`, driving `aria-haspopup="dialog"` on the UtilityButton.
   `:focus-visible` rings added throughout the bar and both overlay
   components; pointer/touch interaction stays ring-free. Full regression
   sweep (a11y test suite + choreography frame captures) confirmed no
   change to pointer-flow visuals or geometry.

Design specs live in `docs/superpowers/specs/`, plans in
`docs/superpowers/plans/`.

## Project shape

- Vite 7 + React 19 + TS + Tailwind 4, pnpm. `pnpm check` (tsc), `pnpm build`,
  `pnpm format` (prettier). Express serves `dist/public` from `dist/index.js`.
- Verification loop used throughout: build → serve on :4999 → headless
  Playwright scripts capturing mid-animation frames at specific timestamps →
  read the screenshots → commit → push.
- `client/src/lab/registry.tsx` is the single source of truth for the site
  (names, usage snippets, tryIt hints). Keep it in sync with behavior changes.
- **Canonical vocabulary (2026-08-04 consumer refactor, spec in
  docs/superpowers/specs/):** NavigationButton / NavigationMenu(Item) /
  Tab / ContextualActionBar / ActionButton / FilterOptionSet /
  UtilityButton / UtilityAction. Props renamed to match (utilityAction,
  contextualActions, actionBarRef, utilityButtonRef, onUtilityClick,
  onCollapsedClick); the filter chip is marked by `Action.isFilter`;
  `isUtilityOpen` is fully pruned. NavigationBar exports
  ACTION_SHEET_CLEAROUT_MS / UTILITY_CLEAROUT_MS — the stage's sheet
  launch timers derive from them (never hardcode clear-out waits).
- ALL sheet/modal surfaces are shared components now: BottomSheet
  (workflow + Export + Assistant — every one `expandable`, skeleton
  bodies with the shimmer pulse; no fake feature content) and
  UtilityModal (Scan). The NavigationBar usage snippet documents the
  onUtilityClick surface-routing pattern + file dependencies.
- **Theme system:** `client/src/theme/theme.css` is the component token
  contract — Aurora (light, :root) and Ink (dark, .dark) presets, glass
  classes included. Shell has a sun/moon toggle (ThemeContext,
  localStorage). Animated shadows stay literal in components (framer
  can't interpolate var() strings). PressAndSlidePicker deliberately
  untouched by all of this.

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
   expands as a circle from the button's CENTER POINT — now the shared
   `UtilityModal` component (`client/src/components/utility-modal/`, its
   own registry entry at `/utility-modal`; chrome-only, children supply
   the surface; ScanView content stays in the stage). Close: circle
   contracts to the point, then restore. The legacy `isUtilityOpen`
   absorb path has been REMOVED entirely (2026-08-04).
5. **Search:** bar morphs into the field right-to-left (unchanged this
   round). Scroll collapse/expand: absorb/regrow with hysteresis; on ANY
   absorb into the NavigationButton (menu open or scroll collapse) the
   circle's border pulses briefly as the bar lands (`absorbPulse` keyed
   flare, timed to centerSquish/centerCollapse + travel − 0.05; skipped
   under reduced motion).
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

1. **On-page instructions + deferred app polish** — surface the registry
   `tryIt` hints on the Preview tab; README updates (Bottom Sheet row,
   Theming section); dark pass on Home/landing. (The isUtilityOpen prune
   and usage-snippet rewrite are done.)

(All previous items landed, frame-verified: Filter choreography — see
Choreography specs #6 and the Overview's Filtering section — the
**BottomSheet extraction**: `client/src/components/bottom-sheet/` is a
public registry entry (`/bottom-sheet`, spec in
`docs/superpowers/specs/2026-08-03-bottom-sheet-design.md`) that owns
scrim/Escape/morph beats/drag; two stops only, configurable initial +
full (94%, floating card), chevron header control + drag snapping.
`ActionSheetMorph`/`UtilitySheetMorph` are deleted — the workflow sheet,
Export (now expandable), and Assistant mount `<BottomSheet>` inside the
stage's AnimatePresence; the bar's clear-out props are unchanged. Design
rule from Rishi: lab components are drop-in-first — prop-driven, motion
internals stay in-file constants, configure only app-critical surfaces.
And the **Accessibility pass**: inert containment via `@/lib/a11y`
`useInertOutside`, APG menu + radiogroup keyboard semantics, focus return
everywhere via `focusWhenClear`, `:focus-visible` rings throughout — see
the latest-session recap above for the full list.)

## Remaining roadmap after that

2. **Site description** (About/landing copy).

## Housekeeping

- Rishi should revoke the `ghp_…` push token when iteration ends (he knows).
  Pushes go: `git push https://rishidean:<token>@github.com/rishidean/ui-lab.git main`.
- Commit trailer convention: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Custom domain (lab.rishidean.com) still pending in Railway → Networking.

## Gotchas learned the hard way

- AnimatePresence resolves an exiting child's `exit` prop from its last
  render BEFORE removal — a conditional exit keyed on the state change
  that CAUSED the removal reads the stale (false) branch, silently, and
  only from the second occurrence onward. Use `custom` on both
  AnimatePresence and the child with a dynamic exit variant (see the
  actions row's label-hold). Corollary: never trust a single mount-time
  measurement of geometry that animates — the filter highlight tracks
  its option with a ResizeObserver until layout settles.

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
- `AnimatePresence onExitComplete` fires before `useInertOutside`'s cleanup
  actually commits (its `removeAttribute("inert")` runs in the exiting
  surface's own passive-effect teardown, a frame or more later). A
  same-tick `.focus()` on the origin control inside `onExitComplete` can
  therefore land on a still-`inert` element and silently no-op. Always
  return focus via `focusWhenClear` (`@/lib/a11y`) — it polls up to 5 rAFs
  waiting for `inert` to lift before focusing — never a raw `.focus()`.
- The filter's `AnimatePresence mode="wait"` remounts the chip only after
  the options finish exiting, so focus can't return to a ref that hasn't
  re-attached yet at close time. Pattern: set a `pendingFilterFocusReturn`
  ref flag when the close begins, then consume it (and call
  `focusWhenClear`) inside the chip's own `ref` callback once it
  re-attaches — see `NavigationBar.tsx` around the filter close handler.
