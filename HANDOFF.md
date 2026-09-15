# Session Handoff — Rishi's UI Lab

Working doc for continuing the lab's component work in a fresh session.
Repo: `github.com/rishidean/ui-lab` (push to `main` auto-deploys on
Railway via the Dockerfile). Owner: Rishi (rishidean).

## Latest session (2026-09-15) — recap

**NavigationBar drop-in pass — merged to `main` and deployed.**
Design in `docs/superpowers/specs/2026-09-14-navigation-bar-drop-in-design.md`.
The component now stands on its own as something a stranger can copy
out of the lab:

1. **CSS split into three layers.** `theme/glass.css` holds the three
   shared glass primitives, `navigation-bar.css` holds the component's
   own rules, and `theme/theme.css` is tokens-only — no component-specific
   CSS left behind in the shared theme file.
2. **`lib.ts`** folds `cn` and `focusWhenClear` into the component
   folder so it is self-contained; a consumer with an existing `cn` can
   delete it and repoint one import.
3. **A variable collector plus a drift test.** `scripts/registry/collect-vars.mjs`
   prints the exact `:root` / `.dark` block the component reads;
   `a11y-tokens.mjs` uses it to catch the README's pasted block drifting
   from the real token contract.
4. **`size="compact" | "default" | "large"` presets**, each writing five
   root variables (`--nav-circle`, `--nav-chip-h`, `--nav-label`,
   `--nav-chip-px`, `--nav-max-w`). Covered by `a11y-sizes.mjs`.
5. **`useCollapseOnScroll`** ships with the bar (scroll hysteresis,
   overlay-aware, cooldown-gated). Covered by `a11y-collapse.mjs`.
6. **Five runnable examples** (`client/src/examples/navigation-bar/01-minimal.tsx`
   … `05-assistant.tsx`), each live at `/navigation-bar?example=<id>` and
   listed on the Code tab. Covered by `a11y-examples.mjs`.
7. **The component README** (`client/src/components/navigation-bar/README.md`):
   install, the generated CSS variable block, minimal usage, sizing, the
   styling/keyboard/utility contracts, and what the consumer still owns.
   The registry's `navigationBarUsage` string shrank to prop wiring plus
   a pointer at the README; its three long contract comments moved there
   as prose.

Suite: 186 PASS / 0 FAIL (123 → 186 across the pass).

## Latest session (2026-09-14) — recap

**NavigationBar demo canvas and a headless recording pipeline.** Both
on `main` and deployed (`c2ebd72`, `39858f7`):

1. **Canvas cards are plain gradient tiles** — no icons, no skeleton
   lines. The saturated skeleton cards shouted over the bar on screen and
   in recordings. Pastel in light, dusty low-lightness in dark; the four
   content hues stay so the dormant glass still has chroma to drain.
2. **Recording pipeline.** `scripts/record/nav-bar.mjs` drives the
   ten-beat click-through in recording mode via Playwright (tap ring at
   every click, pauses scaled to tempo) → WebM → ffmpeg. Assets and a
   README in `demos/navigation-bar/` (full, 1.25×, and a bar-focused
   360px crop with the full-screen Scan beat cut). Playwright caps
   recordings at 1×; QuickTime over the same URL is the crisp path.
3. **Demo controls ride the URL** — `?depth=0.65&tempo=1.5&rm=0` — so a
   recording (panel hidden) can still pin them. Read once at mount,
   clamped to the panel's ranges.

Suite still 123 / 0. The PressAndSlidePicker overhaul remains
uncommitted in the working tree, untouched.

## Latest session (2026-08-13) — recap

**Two fixes on `main`, then a long exploratory branch that is pushed but
NOT merged.** Per-session detail in
`session_handoffs/SessionHandoff_0813_11:40.md`.

Shipped to `main` and deployed:

1. **BottomSheet arm-window wedge** (`b294eb5`): closing ~580–1100ms
   after mount permanently wedged the dialog (page left `inert`). The
   drag-arm timer's `setOpened` re-render fired mid-exit and reset
   framer's exit bookkeeping, so the child was never removed and
   `onExitComplete` never fired. Gated on `useIsPresent()`. Covered by a
   new arm-window case in `a11y-sheet.mjs`.
2. **Assistant close in four beats** (`7fdf722`): transcript fades →
   card contracts to the resting input row → row contents fade → the bar
   returns exactly as it does pre-message.

On branch **`nav-glass-activation`** (28 commits, unmerged):

3. **Dormant-until-engaged bar.** At rest the glass thins and
   desaturates and the tab glyph goes neutral; engaged it is byte-identical
   to today. Three channels ride one intermediate — `--nav-dormant =
(1 - --nav-engage) * --nav-dormancy-depth` — so they cannot drift.
   `--nav-glass-drain` caps the sheerness. Spec + amendment in
   `docs/superpowers/specs/2026-08-11-dormant-bar-design.md`.
4. **The dock wash is gone, and finding it was the session.** The
   component painted a full-bleed 170px gradient BETWEEN the page and the
   bar, which made every backdrop effect measure as dead (1/255 with it,
   15/255 without) and had already caused a working feature to be
   reverted on false evidence. Do not reintroduce any opaque layer under
   the cluster — the dormancy suite guards this at render level.
5. **Gradient rim system** (`.glass-rim`): a masked gradient ring, bright
   at the top, on the pill, both circles, the menu, and the sheet.
   `border-image` cannot do this — it ignores `border-radius`.
6. **Menu is glass and dims the page**, matching the sheets; it was ~99%
   opaque while the bar sits at ~26%.
7. **Two theme-blind shadow bugs fixed** (menu, sheet). Shadows inside
   framer variants must be literals, so they cannot be theme-aware; both
   carried the light preset's shadow plus a full-strength white inset
   into dark mode — that inset was the "too thick top border". Zero
   shadows now live inside animated variants; the circles were audited
   and are clean.
8. **Demo control panel** — dormancy depth, tempo, reduced motion. Needed
   `tempo?: number` and `reducedMotion?: boolean` props, and BREAKING:
   `SHEET_CLEAROUT_MS` → `sheetClearoutMs(tempo)`.

Suite: 123 assertions, 0 failures.

**Known issue, deliberately left:** momentary label blur on the pill's
regrow — pre-existing, GPU-only, self-resolving. Four fixes failed and
were reverted; the full record is in a comment above `repaintPillText`.
The remaining options are structural (animate `width` instead of
`scaleX`, or drop `backdrop-filter` for the duration) and cost more than
the symptom. **Do not start a fifth point fix.**

## Latest session (2026-08-09, second session) — recap

**Close symmetry, sheet morph unification, and the theme consistency
pass.** All merged to main and deployed (`origin/main` at `cbf0fb8`);
per-session detail in `session_handoffs/SessionHandoff_0809_20:48.md`:

1. **Close symmetry** (`48cff75`): assistant and sheet closes return
   both ends of the bar together, exactly like Search-close — the
   delayed serial-beat circle returns were deleted; measured, all
   three closes start both ends within one 50ms sample.
2. **Sheet morph unification** (spec + plan committed, 7 commits
   through `ce6451d`): one launch grammar — workflow sheets, Export,
   and Scan's clear-out all recede search-style; the emptied
   full-width pill is the seed; `BottomSheet` skips its widen beat for
   full-width origins (`SKIP_WIDEN_SLACK`, stretch ~70ms vs old
   ~333ms). BREAKING: `isSheetOpen` + `SHEET_CLEAROUT_MS` replace
   `isActionSheetOpen`/`isUtilitySheetOpen` and both old clear-out
   constants; `UTILITY_SHEET_DELAYS` and the inward sweep are gone.
   Motion comment-tables now describe three grammars (bar-internal
   morph / sheet launch / takeover). Final review fixed a
   chip-vs-utility focus race (one-shot `lastEngagedActionRef`) and
   workflow-sheet `aria-expanded` (`isSheetOpen && !activeAction`).
3. **Theme consistency pass** (spec + plan, 11 commits through
   `cbf0fb8`): the component world adopted the bench palette — presets
   renamed "Bench (light)/(dark)", tokens hue-neutral
   (`--accent-700`/`--accent-soft`/`--gradient-brand`), pink accent
   `#c22a75`/`#ff5fa8`, warm neutrals, every violet literal/fallback
   swept (components, stages, LabShell's 404 dot). Permanent
   `a11y-contrast.mjs` suite (14 WCAG pairs, both presets; suite now
   10 files). Gate feedback: dark backings that read plum went neutral
   lab-ramp (orb = graphite + pink rim); backing/placeholder surfaces
   are strictly neutral — pink is state/decoration only. The ambiguous
   LIGHT/DARK header button is now a shared sun|moon segmented
   `ThemeToggle` (aria-pressed pair, persistence intact).

Known issues filed as task chips: BottomSheet arm-window wedge
(close at ~580–1100ms post-mount permanently wedges the dialog —
pre-existing, deterministic repro in the chip) and dead registry
`accent:` gradient fields. LabShell's 404 theme button deliberately
kept its old pattern (different token system).

## Previous session (2026-08-09, first session) — recap

**Assistant hardening, mainline reconciliation, and a chrome declutter.**
Everything landed, verified (tsc + prettier + full a11y sweep per
change), and is pushed/deployed:

1. **Post-review assistant fixes** (landed after the 08-08 recap below
   was written): pill geometry corrected — the input row is 36px inside
   the pill's 12px padding+border box, so the assistant centers
   identically to Search and a below-cap card fits with zero internal
   scroll (`3542d84`); transcript scroll region keyboard-focusable
   (`tabIndex 0`); rapid-reopen strand fixed — a delayed
   AnimatePresence exit on the keyed branch left mid-exit values
   unrestored when the same key re-entered, so `assistantHeld` now
   keeps the branch mounted through the close wipe and every toggle is
   an animate retarget (`50806af`); bottom breathing room per Rishi
   (8px above the input row, 6px stretched-only margin below, height
   formula in sync); assistant focus-arm aligned with Search's
   poll-then-arm (`2132053`) — a fixed timer could fire before the
   input mounts under `mode="wait"`. a11y-assistant.mjs now asserts
   VISIBILITY (computed clip-path/opacity), not just DOM presence, plus
   a 200ms rapid-reopen case.
2. **Mainline reconciliation** (`fc185bf`): local main (assistant line,
   12 commits) and origin/main (showcase-redesign line, 7 commits) had
   diverged from `68cffc8`. Merged remote into local — HANDOFF recaps
   stacked chronologically, NavigationBar.tsx / registry.tsx /
   theme.css auto-merged (remote's poll-then-arm search fix + explicit
   exit transitions coexist with the assistant rework) — verified with
   the full harness, pushed. The assistant now lives inside the
   lab-bench showcase chrome.
3. **Chrome declutter per Rishi** (`6f63633`): index rail lists only
   built components (oven rows gone), faux ⌘K removed from both
   headers, built/planned header count removed, "rest of the lab" grid
   removed (redundant with the rail), Home's index/count + click-hint
   row removed, component footer link is just "rishidean.com →". Dead
   CSS and `labRows` removed; the stale assistant-sheet tryIt hint now
   describes the bar morph. `PLANNED_COUNT` in registry.tsx is dead but
   left in place (the working tree carries uncommitted picker edits to
   that file — don't sweep them into a commit).

## Previous session (2026-08-08) — recap

**NavigationBar assistant mode shipped** (Rishi's call — spec in
`docs/superpowers/specs/2026-08-08-assistant-in-bar-design.md`). The AI
utility on Home no longer opens a bottom sheet; pressing it morphs the
bar itself into a chat input using the exact Search grammar, then
stretches upward into a conversation card as messages accumulate.
Everything below landed, verified, and is pushed/deployed:

1. **Open + stretch choreography** (`0670434`, `7e0793d`, `d916eb2`,
   `476ee96`): the assistant opens identically to Search (sparkle glyph,
   "Ask anything…" placeholder, same focus-after-widen timing); on first
   send the bar runs a real height animation on the center pill — never
   `scaleY`, so text can't distort — growing from 48px toward
   fit-content, capped at 62% of viewport height (the old Assistant
   sheet's stop, now a hard ceiling on the chat card instead of a drag
   stop). Past the cap the transcript scrolls internally, pinned to the
   newest message, and re-clamps on window resize. Close runs three
   serial beats (transcript fade → card contract → Search-style wipe);
   reopen replays two beats (plain input lands, then the card
   re-stretches to the preserved transcript a beat later).
2. **Demo swap + BottomSheet deletion** (`bbd17d8`): the stage's AI
   branch flips `isAssistantOpen` instead of calling
   `openUtilitySheet("assistant")`; the assistant's ghost-bubble
   `BottomSheet` block and its now-unused CSS are deleted. The stage
   owns `assistantMessages` across close/reopen and fakes replies with a
   canned delay (1.4s normal / 400ms reduced motion) so pending → reply
   → stretch reads as three distinct beats.
3. **Accessibility pass** (`07948d2`): new `a11y-assistant.mjs` covers
   focus landing on open, `role="log"`/`aria-live="polite"` on the
   transcript, the pending bubble's `aria-hidden`, Escape-to-close with
   focus returned to the AI button, and transcript persistence on
   reopen. The stale AI-sheet trigger assertions in `a11y-triggers.mjs`
   are retired. Full suite: 9 files, 72 assertions, 0 failures.
4. **Docs + programmatic verification** (this session):
   `NavigationBarOverview.md` gained an Assistant motion-design section
   (mirroring Search) and dropped every "AI Assistant (bottom sheet)"
   reference; the Utility Action Sheet section is Export-only now, and
   the 62% figure is called out as the chat card's height cap rather
   than a `BottomSheet` stop. `registry.tsx`'s sample code reflects
   `isAssistantOpen` (AI is bar-internal, not a dialog — `opensDialog`
   examples now cite Scan/Export). A throwaway Playwright script
   (`.superpowers/sdd/2026-08-08-assistant-in-bar/verify-task5.mjs`, not
   committed) verified against a production build on `:4999`: monotonic
   height growth capped at 62vh across 3+ exchanges, internal scroll
   pinned to bottom past the cap, re-stretch on reopen without a new
   submit, tab-change-while-open closing the assistant with transcript
   restore on return to Home (via a native DOM click on the
   NavigationButton, since it's intentionally inert during input mode —
   a real user must Escape first), and reduced-motion open → submit →
   reply. 11/11 checks passed; `pnpm check` clean.

## Previous session (2026-08-06) — recap

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
6. **PressAndSlidePicker overhaul:** fixed the strip-lands-far-from-chip
   bug (no portal + the stage's `scale(1.35)` wrapper — a transformed
   ancestor is the containing block for `position: fixed`; strip,
   fallback listbox, and click-away now portal to `document.body`) and
   brought the picker onto the design system: fully-rounded
   `.glass-overlay` capsules holding 34px pill chips (the filter strip's
   proportions — pill = state, active option tinted in its own hue via
   color-mix with `--gray-900` label ink), DM Sans, site EASE/TEMPO
   motion (injected style tag replaced by co-located CSS),
   `:focus-visible` ring conventions, dismiss-on-scroll/resize. Stage
   lost its scale transform + dark token overrides (now
   theme-aware, demos `renderChip`). Original spec preserved at
   `docs/superpowers/specs/2026-08-05-press-and-slide-picker-design.md`;
   record in `PressAndSlidePickerOverview.md`.

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
  (workflow + Export — every one `expandable`, skeleton bodies with the
  shimmer pulse; no fake feature content) and UtilityModal (Scan). The
  Assistant no longer uses BottomSheet — as of the 2026-08-08 session it's
  a bar-internal mode (see the latest-session recap above), so it isn't
  in this list. The NavigationBar usage snippet documents the
  onUtilityClick surface-routing pattern + file dependencies.
- **Theme system:** `client/src/theme/theme.css` is the component token
  contract — Aurora (light, :root) and Ink (dark, .dark) presets, glass
  classes included. Shell has a sun/moon toggle (ThemeContext,
  localStorage). Animated shadows stay literal in components (framer
  can't interpolate var() strings). PressAndSlidePicker joined the
  contract in the 2026-08-05 overhaul (glass-overlay surfaces, DM Sans,
  radius/text tokens, site motion grammar, portal to body — see
  `PressAndSlidePickerOverview.md`).

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
3. **Utility bottom sheets (Export):** utility pressed state → nav circle
   fades → bar sweeps inward L→R INTO the right button → button fades
   WHILE sheet widens out of its footprint → stretch up+down → title →
   beat → body. Close fully reverses (button returns first, bar regrows from
   the RIGHT — originX held at 1 until regrow lands — circle last).
   `UtilitySheetMorph` + `isUtilitySheetOpen` prop (`UTILITY_SHEET_DELAYS`),
   stage `utilSheetPrep` + 500ms timer. Export keeps the sheet's half↔full
   drag (enabled only after entrance, `opened` state). The Assistant used
   to share this surface but moved off it entirely on 2026-08-08 — see
   item 7 below.
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
7. **Assistant (2026-08-08):** a bar-internal mode, sibling of Search
   (item 5) rather than a bottom sheet — no drag, no half↔full stops.
   Open morph is identical to Search's. On first send the bar itself
   runs a real height animation (never `scaleY`) from 48px toward
   fit-content, capped at 62% of viewport height as a hard ceiling (the
   old sheet's stop, repurposed — not a drag stop). Past the cap the
   transcript scrolls internally, pinned to the newest message. Close is
   three serial beats (transcript fade → card contract → Search-style
   wipe); reopen replays two beats (plain input lands, then the card
   re-stretches to the preserved transcript). `isAssistantOpen` prop; see
   the Overview's Assistant section and the 2026-08-08 recap above.

### Timing constants live at the top of NavigationBar.tsx

`OPEN_DELAYS`, `CLOSE_DELAYS`, `SCROLL_COLLAPSE/EXPAND_DELAYS`,
`SHEET_DELAYS`, `FILTER_DELAYS`, `DUR`, `TEMPO`. Morph beat timings
(WIDEN 0.24 / gap 0.08 / STRETCH 0.28 / title / gap 0.06 / body) are local to
the two morph components in the stage (raw seconds, no TEMPO).

## NEXT UP (the reason for this handoff)

**The NavigationBar drop-in pass is merged and live**:
the CSS split (`glass.css` / `navigation-bar.css` / tokens-only
`theme.css`), the self-contained `lib.ts`, the variable collector +
drift test, `size` presets, `useCollapseOnScroll`, five runnable
examples, and the component README. The optional manifest (spec §7)
landed the same day: `scripts/registry/build.mjs` writes
`client/public/r/navigation-bar.{json,zip}` before every `dev`/`build`
(gitignored), the Code tab opens with an Install panel (one-command
`npx shadcn add <origin>/r/navigation-bar.json`, or the zip), the
Desktop/Mobile switch moved from the tab row to an icon toggle on the
demo canvas (Demo tab only), and `.lab-main` got `min-width: 0` so the
Code tab no longer stretches past the viewport. `a11y-site.mjs` covers
all of it. Suite: 203 / 0.

0. ~~**NavigationBar drop-in pass**~~ — DONE 2026-09-15 (see the latest
   recap). The plan below is kept as the record of what was decided.
1. **Overall site UI and functionality** — the lab site itself, not the
   components. Existing leftovers that fold into this: the registry
   `dependencies` arrays are prose today and should link to their
   file/source; README still needs a Bottom Sheet row and a Theming
   section.
2. **Resume PressAndSlidePicker** — its overhaul is still uncommitted in
   the working tree (5 modified, 4 untracked files). Decide commit vs
   discard when picking it up.

Worth a look on device whenever convenient: the dormancy defaults (depth
1, drain 0.8 — full liquid-glass at rest) were judged from screenshots
only, never ratified on hardware. Both are single tokens in `theme.css`.
Note too that resting label legibility is now content-dependent — 11.8:1
measured over the demo's content, but no test covers darker backdrops.

Available whenever, as filed task chips: the BottomSheet arm-window
wedge fix (pre-existing bug, deterministic repro in the chip) and the
dead registry `accent:` field cleanup.

Older site-wide leftovers, still open but behind the above:

- **Site code + dependency links** — the registry `dependencies`
  arrays are prose today; make each entry link to its file/source.
  Also still open: README updates (Bottom Sheet row, Theming section).

(All previous items landed, frame-verified: Filter choreography — see
Choreography specs #6 and the Overview's Filtering section — the
**BottomSheet extraction**: `client/src/components/bottom-sheet/` is a
public registry entry (`/bottom-sheet`, spec in
`docs/superpowers/specs/2026-08-03-bottom-sheet-design.md`) that owns
scrim/Escape/morph beats/drag; two stops only, configurable initial +
full (94%, floating card), chevron header control + drag snapping.
`ActionSheetMorph`/`UtilitySheetMorph` are deleted — the workflow sheet
and Export (now expandable) mount `<BottomSheet>` inside the stage's
AnimatePresence; the bar's clear-out props are unchanged. (The Assistant
mounted `<BottomSheet>` too at the time this paragraph was written; the
2026-08-08 session moved it off the sheet entirely into an in-bar chat
morph — see the latest-session recap above.) Design
rule from Rishi: lab components are drop-in-first — prop-driven, motion
internals stay in-file constants, configure only app-critical surfaces.
And the **Accessibility pass**: inert containment via `@/lib/a11y`
`useInertOutside` (BottomSheet + UtilityModal), APG menu + radiogroup
keyboard semantics with plain (non-inert) focus return for those two,
`focusWhenClear` for every inert-guarded surface's focus return,
`:focus-visible` rings throughout — see the latest-session recap above for
the full list.)

### Drop-in pass: the plan (2026-09-14) — implemented 2026-09-15

Three things a reader hits today when they try to lift the bar into
their own app. Each has a state-of-play and a recommended fix; the
suggested order is at the end.

**Gap 1 — dependencies, and the shadcn shape.** What the component
actually needs right now, measured from its imports and from
`theme.css`:

| Need | Where it lives today | Notes |
| --- | --- | --- |
| `react`, `motion`, `lucide-react` | npm | Fine — shadcn declares these the same way. |
| `cn` (clsx + tailwind-merge) | `@/lib/utils` | Same as shadcn's `lib/utils`. |
| `focusWhenClear` | `@/lib/a11y` | Ten lines; the bar uses only this export. |
| Tailwind utilities | ~57 `className`s, arbitrary values (`h-[34px]`, `max-w-lg`) | Tailwind v4, no config file — a peer requirement, as with shadcn. |
| Bar-specific CSS | `theme.css` lines ~218–545 (`.glass-nav`, `.nav-*`, `.glass-overlay`, `.glass-rim`, assistant bubbles) | ~330 lines of component CSS living in the site's theme file. This is the real blocker. |
| Tokens | `theme.css` `:root` / `.dark` presets (`--accent-*`, `--text-*`, `--radius-*`, `--nav-*`, `--glass-rim`, `--bg-*`) | The bar reads perhaps 25 of the file's variables. |
| BottomSheet / UtilityModal | separate components | NOT imported by the bar — the stage routes to them. They are optional companions, not dependencies. Say so. |

Recommended fix, in order:

1. **Extract the bar's CSS out of `theme.css`** into
   `navigation-bar/navigation-bar.css`, imported by the component
   (the picker already does this — co-located CSS, no injected style
   tag). `theme.css` keeps only tokens. After this, "copy the folder"
   is true.
2. **Ship a `tokens.css` next to it** — the minimal `:root` / `.dark`
   block of variables the bar reads, with the Bench presets as defaults,
   annotated required vs cosmetic. Consumers paste it into their globals
   or remap it to their system. Grep the extracted CSS + TSX for `var(`
   to build the list; do not hand-write it.
3. **Fold `cn` and `focusWhenClear` into the folder** (or list them as
   files-to-copy, shadcn-style). Both are tiny; a second copy costs
   nothing and removes two `@/` imports.
4. **Registry manifest.** shadcn's registry-item schema
   (`{ name, type: "registry:component", files[], dependencies[],
   registryDependencies[], cssVars }`) is exactly this inventory in
   JSON. Serve it as `/r/navigation-bar.json` and the drop-in becomes
   `npx shadcn add https://lab.rishidean.com/r/navigation-bar.json`.
   The site leftover "registry `dependencies` arrays should link to
   their file/source" folds into this — generate the prose list from the
   manifest instead of maintaining both. Stretch goal; 1–3 are the
   substance.

Keep Tailwind. Converting 57 classNames to plain CSS is a week of
regression risk for a component whose whole value is choreography, and
shadcn consumers already have Tailwind. What must NOT happen: motion
timings becoming props (drop-in-first rule — internals stay in-file
constants).

**Gap 2 — usage examples.** Today there is one 140-line mega-snippet in
`registry.tsx` (`navigationBarUsage`) showing every prop at once, plus
the 650-line stage as the "real" example. Neither is a starting point.

Recommended fix: **tiered, runnable examples as real files** under
`client/src/examples/navigation-bar/`, rendered on the Code tab via
`?raw` imports so they are typechecked and cannot rot:

- `01-minimal.tsx` — tabs + contextual actions + `onActionClick`
  logging. ~25 lines. No utilities, no sheets, no scroll. Proves it
  works.
- `02-collapse-on-scroll.tsx` — adds `isCollapsed`. Every consumer
  needs this and today the hysteresis lives as ~60 lines in the stage
  (`COLLAPSE_AFTER_PX`, the arm band, cooldown). Export it from the
  component folder as `useCollapseOnScroll(scrollRef)` — this passes
  the drop-in rule because it is app-critical for every consumer, not
  an internal knob.
- `03-search.tsx` — `isSearchOpen` / `onSearchSubmit`. Bar-internal,
  zero extra components.
- `04-workflow-sheet.tsx` — Deposit → `isSheetOpen`, `sheetClearoutMs`,
  `actionBarRef`, mount `<BottomSheet>`. The one pattern people will
  get wrong; show it in isolation.
- `05-assistant.tsx` — the in-bar chat morph with an owned transcript.

The mega-snippet then shrinks to the prop table plus links to these.
Keep its three contract comments (styling, keyboard, utility routing)
— they are the best prose in the repo — but move them into the README
of the component folder where a copier will actually find them.

**Gap 3 — sizing.** There is no sizing story. Everything is a literal:
circles `w-14 h-14` (56px), chips `h-[34px]`, labels `text-[14px]` /
`text-[13px]`, cluster `max-w-lg` (512px) centred with `gap-3`, menu
`min-w-[210px]`, `ASSISTANT_INPUT_ROW_PX = 36`,
`ASSISTANT_HEIGHT_CAP = 0.62`, `EDGE_FADE_PX = 28`. The fixed shell
(bottom, safe-area inset, `pointer-events: none` wrapper) and the page's
bottom padding (15rem in the demo) are the consumer's job and nowhere
documented.

Recommended fix — guidance first, then one affordance:

1. **Guidance** (component README): the bar is designed for a 360–512px
   cluster and stays centred at `max-w-lg` on wider screens; the
   consumer owns the fixed shell + `env(safe-area-inset-bottom)` + page
   bottom padding so content is not hidden; do not scale it with CSS
   `zoom` or `transform` — a transformed ancestor becomes the containing
   block for `position: fixed` and the picker already paid for that
   lesson (2026-08-05).
2. **Affordance: a `size` prop with presets, implemented as CSS
   variables on the root.** `compact` (48px circle / 30px chip / 13px
   label), `default` (56 / 34 / 14), `large` (64 / 38 / 15). Set
   `--nav-circle`, `--nav-chip-h`, `--nav-label`, `--nav-max-w` once on
   the root and have the Tailwind arbitrary values read them
   (`w-[var(--nav-circle)]`). Three presets, not a free number: a free
   number invites values the choreography was never tuned for.
3. **Audit the literal pixels.** Rect-driven motion (sheet origins,
   pill stretch, menu absorb) uses `getBoundingClientRect` and is
   size-agnostic; the risk is the handful of literals above. Derive
   `ASSISTANT_INPUT_ROW_PX`, the menu `min-w`, and `EDGE_FADE_PX` from
   the variables and leave the rest alone.
4. **Prove it.** One more `scripts/a11y`-style script that renders each
   preset, walks Deposit / menu / filter / search, and asserts nothing
   overflows except Trade's intentional five-action scroll — with
   screenshots into `scripts/a11y/shots/`. Without this, `size` will
   quietly break the choreography for one preset and nobody will know.

**Suggested order:** Gap 1 steps 1–3 (CSS extraction, tokens, fold the
helpers — this is the prerequisite for everything else being honest)
→ Gap 3 steps 2–4 (size variables, literal audit, preset test)
→ Gap 2 (examples; write them against the finished folder so they are
right the first time) → Gap 1 step 4 (manifest). Each of the first three
is a single-session job; the manifest is an afternoon once the folder
is clean. Re-run the dormancy suite after the CSS extraction: it
measures backdrop effects at render level and will catch a lost rule.

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

- A component inside `<AnimatePresence>` stays MOUNTED through its exit,
  so any pending timer it owns keeps running — and a `setState` that
  fires mid-exit resets framer's exit bookkeeping: the animations still
  complete visually, but the child is never removed and
  `onExitComplete` never fires. That was the BottomSheet arm-window
  wedge: `OPENED_AT_MS`'s drag-arming timer landing between the
  entrance and 1100ms left the dialog painted at origin size with the
  page permanently `inert`. Gate every in-surface timer/interval on
  `useIsPresent()` (`motion/react`) — it flips false the instant the
  close begins, and the effect cleanup cancels the timer.
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
