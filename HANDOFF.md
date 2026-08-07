# Session Handoff — Rishi's UI Lab

Working doc for continuing the lab's component work in a fresh session.
Repo: `github.com/rishidean/ui-lab` (push to `main` auto-deploys on
Railway via the Dockerfile). Owner: Rishi (rishidean).

## Latest session (2026-08-06) — recap

**Showcase redesign shipped** — the component pages now render the "lab
bench" design from Rishi's Claude Design project (design source archived
at `docs/superpowers/specs/2026-08-06-showcase-redesign.dc.html`;
implemented from the uploaded export since /design-login isn't available
in remote sessions):

1. **`lab/Showcase.tsx` + `Showcase.css`** replace `ComponentPage` (and
   `CodeBlock`, both deleted) on every component route. Framed card:
   header (logo / built·planned count / faux ⌘K / theme toggle /
   Present), 288px index sidebar filled to `PLANNED_COUNT` (9) with
   "in the oven" rows, hero, Demo/Code/Props tabs + Desktop/Mobile
   viewport toggle, tryIt hints under the canvas, problem / "what I did"
   columns, fair-warning banner, "rest of the lab" grid, footer.
   Space Grotesk + JetBrains Mono (added to index.html), pink accent,
   dark/light `--lab-*` palettes keyed off the existing ThemeContext
   (site default stays light until Home gets its dark pass).
2. **Registry `showcase` metadata** — category, lede, problem, solution,
   real `propRows` for all four components, presentation `beats` (picker
   only). Copy for the picker is verbatim from the design; the other
   three are authored in the same voice.
3. **Demo canvas strategy:** the picker gets a bespoke in-page demo
   (digest-frequency card hosting the REAL PressAndSlidePicker + live
   readout; mobile = 390px card with handle) in `lab/PickerShowcase.tsx`.
   The other components embed their own route in an `<iframe
src="/{slug}?embed=1">` — a true nested viewport, so the stages'
   `position: fixed` choreography and rect-measured morphs run
   untouched (they'd break under a transformed wrapper; no portals
   anywhere, so the frame contains everything). Desktop = full-width
   640px frame, Mobile = 390×720 device frame. The iframe remounts on
   theme change (localStorage is shared) but NOT on view change.
4. **Bare-stage fallback:** `?embed=1`, recording mode (H key), and
   viewports <1024px all render just the Stage full-viewport (plus a
   small "← index" chip when it's a human, not an iframe/recording).
   Phones get the components themselves, and the a11y suites — which
   all run at 390×844 — see the same DOM as before: **63/63 PASS**.
5. **Presentation mode** (the old "Record mode" roadmap item): shown for
   components with `beats` — 1920×1080 stage scaled to fit, 5 narrated
   picker beats driving a scripted strip replica (horizontal, true to
   the real gesture — the design's vertical fan misrepresented the
   component), beat dots, play/pause at 2600ms, click-to-take-control,
   ← / → / Space stepping, Escape releases. The Mobile/Desktop toggle
   closes the other roadmap item; tryIt hints now surface on the Demo
   tab (old "surface tryIt on Preview" item).

**Home redesign shipped too** (2026-08-07, same session): `pages/Home.tsx`
rewritten per "UI Lab - Home.dc.html" — full-bleed header strip, the
"Interactions worth stealing." hero (accent on the last word),
"open the first one" CTA + built·planned chip, the 9-slot index grid
(registry `showcase.blurb` card one-liners — design copy for the first
three, Utility Modal authored to match), the "not a frontend developer"
banner, and the footer. Responsive: grid 3→2→1 columns, clamped hero
type, ⌘K chip hidden under 640px. Shared palette/rows moved to
`lab/labTheme.ts` (Showcase imports it too); Home carries its own
chrome, so LabShell now only wraps the 404. Suite re-run: 63/63 PASS.

**Picker popover fix** (2026-08-07, post-merge): Rishi's phone repro —
tapping the picker chip showed no options. Root cause predates the
redesign: the stage's plinth `transform: scale(1.35)` on
`.picker-demo__object` (since 2026-08-03) made it the containing block
for the picker's `position: fixed` strip/listbox, which rendered
in-tree — inline top/left were computed correctly but painted offset
AND scaled (390×844: listbox at y≈993, w≈461 — fully off-screen).
Fix in the component: strip, fallback listbox, and scrim now render via
`createPortal(document.body)`, with the token contract
(`--surface-overlay` etc.) forwarded from the chip's computed style so
scoped theming survives the portal; fallback top also gains the missing
viewport clamp (flips above the chip when there's no room below).
Verified on phone bare stage (tap + long-press strip) and the showcase
demo card; suite 63/63. See the new Gotcha at the bottom.

**Sticky headers + mobile component chrome** (2026-08-07, continued):
site headers are sticky-glass (`overflow: clip` on the showcase card —
NOT hidden, which would make it the sticky containing block;
color-mix + backdrop-blur on both headers). Component pages <1024px get
compact chrome instead of the bare stage: mini header, horizontally
scrolling component-chip strip, Demo/Code/Props tabs (stacked props
cards, no Desktop/Mobile toggle on-device); `?embed=1`/recording stay
truly bare, the "← index" chip is gone. This surfaced TWO latent
NavigationBar bugs, both fixed in-component: (1) the actions row's
search-open exit was a bare `{ opacity: 0 }`, inheriting the
`transition` PROP captured at its last render — mid menu-close that
carries CLOSE_DELAYS.actionsFadeIn's 0.39s delay, slowing search-open
~430ms (exit now pins explicit transitions in both variant branches);
(2) the search-input focus ran on a fixed 286ms timer from open, racing
the mode="wait" mount of the input (54ms margin!) — it now rAF-polls
for the mount, then applies the same most-of-final-width delay. Suite
63/63.

**UtilityModal luster pass** (2026-08-07, Rishi's mobile feedback —
"something is happening but not really" on open, dismiss "feels like a
flash"): the demo surface was `--bg-canvas` on `--bg-canvas`, so the
circle revealed a sheet identical to the page it covered. Fixes, in
component: (1) new `--surface-modal` token (Aurora #fdfcff / Ink
#251f31, theme.css) painted by the modal itself under children —
full-bleed children like Scan's camera simply cover it; the demo
stage's surface went transparent. (2) A drop-shadow rim on the disc via
a new `.utility-modal__halo` wrapper — filter must sit on an ANCESTOR
of the clipped element (filter applies before clip-path on the same
element, which clips the shadow away). (3) Close choreography: content
no longer exit-fades (it stays painted and the circle clips it away —
the early fade left an empty disc), contraction is 0.85× grow (was
0.7×), and the scrim lifts only after the circle lands (exit delay
0.75×shrink). Registry copy + prop notes updated. Suite 63/63.

## Previous session (2026-08-05) — recap

**NavigationBar is DONE** (Rishi's call). Everything below landed,
verified, and is pushed/deployed:

1. **Filter highlight slide fix + sequencing** (`63237b1`): the sliding
   highlight never moved on selection — framer's `motion.button` invokes
   ref callbacks only on mount/unmount (stable internal ref), so the
   selection-time re-measure never ran and the stale ResizeObserver
   snapped the pill back (see Gotchas). `trackFilterOption` now re-points
   the observer from both the mount ref callback and the activeFilter
   layout effect. New sequencing per Rishi: pill slides first
   (DUR.direct), THEN labels trade colors (`pendingFilterVisual` lags
   activeFilter), then confirm hold + close. aria-checked immediate.
2. **Modality-gated search focus ring** (`d80c264`): text inputs match
   `:focus-visible` on ANY focus (browser heuristic), so the a11y pass's
   ring showed on pointer opens. The bar tracks last input modality
   (capture-phase keydown/pointerdown, ignoring framer's untrusted
   synthetic pointerdown — see Gotchas) and stamps `data-kbd` on the
   input at each focus; the theme rule requires it.
3. **Blurry action labels after scroll regrow** (`cfb81df`): the pill is
   permanently composited (glass-nav backdrop-filter) and labels fade in
   DURING the regrow, so Chromium kept a mid-scale text raster until any
   repaint (hover fixed it). `onAnimationComplete` on the pill now nudges
   an invisible inherited paint property (transparent text-shadow) when
   any regrow lands at scaleX 1 — twice (immediate + 200ms tail).
   Headless Chromium software-rasterizes and can NOT repro this; it was
   verified by driving Rishi's real Chrome (claude-in-chrome). Rishi's
   own Chrome still showed blur afterward while a fresh Safari was clean
   — unresolved whether that's per-site page zoom or profile state; the
   fix is confirmed good in a clean Chrome profile/tab.
4. **Docs/copy sync** (`2e1f9ed`): Overview documents the filter
   color-lag beat, gated search ring, and re-raster nudge; a11y design
   spec gained a dated amendment; registry fixed the bar's @/lib/a11y
   dependency line (focusWhenClear, NOT useInertOutside), usage utility
   actions carry opensDialog, tryIt gained the filter-selection hint.
5. **The four deferred a11y minors** (`05c7435`): menu rows are
   `menuitemradio` + `aria-checked` (committed tab, not the hold
   highlight); UtilityButton `aria-expanded` gated on `opensDialog` like
   `aria-haspopup` (Search carries neither); themed white
   `:focus-visible` ring on ScanView's close control; a11y-menu.mjs
   covers ArrowUp + checked-row assertions, a11y-triggers asserts the
   Search gate, all `menuitem` selectors → `menuitemradio`. Suite is now
   63 assertions, 0 failures.

## Previous session (2026-08-04) — recap

Everything below landed, frame-verified, and is pushed/deployed:

1. Filter choreography (serial beats per the Overview spec).
2. BottomSheet extracted as a public registry entry (`/bottom-sheet`);
   NavigationBar's three sheets consume it.
3. Consumer refactor: canonical naming (breaking prop renames),
   attribution headers, theme.css token contract with Aurora/Ink presets
   - shell toggle, isUtilityOpen pruned, `Action.isFilter`, exported
     clear-out constants. Also breaking: `utilityButtonRef` narrowed from
     `React.Ref` to `React.RefObject<HTMLButtonElement | null>` — callback
     refs are no longer accepted.
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
   `onExitComplete` focus-return site — see Gotchas). The menu and filter
   are plain popovers, not inert-guarded, so their focus return is a
   direct `.focus({ preventScroll: true })` (the filter chip's return in
   particular — no inert involved there, so no need to wait for it to
   lift). NavigationBar's tab menu is a proper APG menu (ArrowUp/Down,
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

The 2026-08-05 session closed out the old item 1 entirely (sweep fixes +
all four deferred a11y minors — see the latest-session recap) and the
NavigationBar-scoped parts of items 2–3 (Overview/spec sync, registry
copy/usage/tryIt corrections). **NavigationBar is done.** What remains
is site-wide, not component work:

1. ~~**Home redesign**~~ — SHIPPED 2026-08-07 (see the latest-session
   recap). The old "site copy pass" and "dark pass on Home" items went
   with it. LabShell survives only for the 404 — fold it away whenever
   NotFound gets the lab treatment.
2. **Site code + dependency links** — the registry `dependencies`
   arrays are prose today; make each entry link to its file/source.
   Also still open: README updates (Bottom Sheet row, Theming section).
   (2026-08-06 closed: tryIt hints now render under the showcase demo
   canvas; Mobile/Desktop toggle and presentation/record mode shipped
   with the showcase redesign.)

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
`useInertOutside` (BottomSheet + UtilityModal), APG menu + radiogroup
keyboard semantics with plain (non-inert) focus return for those two,
`focusWhenClear` for every inert-guarded surface's focus return,
`:focus-visible` rings throughout — see the latest-session recap above for
the full list.)

## Remaining roadmap after that

**Site Fixes epic — SHIPPED 2026-08-06** with the showcase redesign
(the .dc.html design served as the spec):

- ~~**Mobile/desktop toggle**~~ — the showcase's Desktop/Mobile views
  (device-framed iframe for stage-hosted components).
- ~~**Record mode**~~ — presentation mode with narrated beats (picker
  has the first beat script; add `beats` + a beat visual to give other
  components one). The old H-key recording mode also still works.

## Housekeeping

- The `ghp_…` push token stays live until UI Lab v1 (Rishi's call,
  2026-08-04) — no revoke reminders needed. Credentials are stored, so a
  plain `git push origin main` works.
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
- Same capture rule applies to the `transition` PROP: an exit variant
  without its own transition (`exit: { opacity: 0 }`) inherits the
  component's `transition` as of the LAST render — if that prop is
  state-dependent (menuClosing/navCollapsing branches), the exit can
  silently carry a stale multi-hundred-ms delay. Pin an explicit
  transition inside every exit variant branch. Downstream hazard: under
  `mode="wait"` the NEXT child's mount waits for that exit, so anything
  scheduled on a fixed timer from the state flip (the search input's
  focus) races it — poll for the mount instead.

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
  PNGs directly. The a11y regression suites are the exception — they live
  IN the repo (`scripts/a11y/`, run with `pnpm test:a11y` against a build
  on :4999, playwright is a devDependency; see scripts/a11y/README.md).
  Run them before pushing anything that touches focus, aria, or the
  surfaces' mount/unmount choreography.
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
  ref flag when the close begins, then consume it inside the chip's own
  `ref` callback once it re-attaches, calling a plain
  `.focus({ preventScroll: true })` there — the filter isn't inert-guarded
  (see above), so `focusWhenClear`'s inert-polling isn't needed, only the
  remount-timing workaround. See `NavigationBar.tsx` around the filter
  close handler.
- Framer's `motion.*` components hand the DOM ONE stable internal ref and
  invoke your ref callback only on mount/unmount — never because the
  inline callback's identity (or captured state) changed. Any "re-measure
  when X changes" logic must live in an effect keyed on X and share code
  with the mount-time callback (see `trackFilterOption`). A ResizeObserver
  attached inside a motion ref callback silently stays on the old element
  across selection changes.
- Framer's keyboard-press support (Enter/Space on a motion button)
  dispatches a SYNTHETIC `pointerdown` (`isTrusted: false`,
  `pointerType: ""`) before the click. Any input-modality tracker must
  ignore untrusted pointer events or every keyboard activation
  reclassifies as pointer one millisecond later.
- Text inputs match `:focus-visible` on ANY focus — pointer clicks and
  programmatic `.focus()` included (browser heuristic for keyboard-input
  elements). A keyboard-only ring on an input needs an explicit modality
  gate (`data-kbd`, see the search field); `:focus-visible` alone is only
  sufficient for buttons.
- A permanently composited surface (backdrop-filter, will-change) that
  scale-animates while text fades in inside it can keep the mid-scale
  raster after the transform settles — blurry text until an unrelated
  repaint. GPU-only: headless Chromium software-rasterizes and will NOT
  reproduce it; drive a real Chrome (claude-in-chrome) to verify. Fix
  pattern: on animation-complete at scale 1, toggle an invisible
  inherited paint property (transparent text-shadow) for one frame.
- A `position: fixed` element inside a transformed (or filtered /
  will-change: transform) ancestor is NOT viewport-fixed — that ancestor
  becomes its containing block, so correct inline top/left paint offset
  and scaled. Inline-style inspection looks right while the rendered
  rect is wrong; compare `el.style.top` against
  `getBoundingClientRect()` to catch it. Any in-tree popover a consumer
  might mount under a transform (demo plinths use `scale()`!) must
  portal to document.body — and CSS custom properties don't follow: read
  the token values off the anchor's `getComputedStyle` and re-apply them
  on the portal wrapper (see PressAndSlidePicker's PORTAL_TOKEN_KEYS).
- Fix verification races the Railway deploy AND the browser tab: a
  just-pushed fix takes minutes to deploy, and an already-open SPA tab
  keeps running its old bundle until a reload — "still broken" right
  after a push usually means stale bundle, not failed fix. Check the
  deployed asset hash (`curl … | grep assets/index-`) and grep the bundle
  for a signature of the change before re-opening the investigation.
  Persistent text blur in ONE Chrome profile only (clean profile/Safari
  fine) suggests per-site page zoom ≠ 100% — no code fix applies.
