# Consumer-Facing Refactor — Design

Date: 2026-08-04. Status: approved pending Rishi's spec review.

Make the lab's components easier to adopt and configure: canonical
naming, generic + attributed comments, a real theme system demonstrated
with a dark preset, and four adoption fixes identified in review.

## 1. Canonical naming

One vocabulary everywhere — exported API, internals, comments, docs,
registry snippets. Breaking renames are deliberate (pre-launch).

| Element            | Canonical name      | API changes                                                                                                                         |
| ------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Left circle        | NavigationButton    | ref `navigationButtonRef` (internal)                                                                                                |
| Tab menu           | NavigationMenu      | state `isNavigationMenuOpen` (internal)                                                                                             |
| Menu row           | NavigationMenuItem  | (internal/comments)                                                                                                                 |
| Tab definition     | `Tab`               | type `TabDef` → `Tab`                                                                                                               |
| Center pill        | ContextualActionBar | prop `centerBarRef` → `actionBarRef`; prop `tabActions` → `contextualActions`                                                       |
| Action chip        | ActionButton        | type `ActionDef` → `Action`                                                                                                         |
| Filter strip       | FilterOptionSet     | type `FilterOption` unchanged                                                                                                       |
| Right circle       | UtilityButton       | prop `rightButtonRef` → `utilityButtonRef`; `showRightButton` → `showUtilityButton`                                                 |
| Utility definition | `UtilityAction`     | prop `rightButton` → `utilityAction` (new exported type `UtilityAction = { Icon; label }`); `onRightButtonClick` → `onUtilityClick` |

Also renamed in prose: NavigationBarOverview.md section headings and the
registry `tryIt`/`usage` text adopt the same vocabulary.

Additional renames from the straggler sweep:

- `onLogoClick` → `onCollapsedClick` (6 sites) — it fires on the
  collapsed NavigationButton tap, which shows the tab icon, not the logo.
  The `logo` prop itself stays (genuine no-tab brand-mark fallback).
- Demo data exports: `navigationActions` → `navigationContextualActions`,
  `navigationRightButtons` → `navigationUtilityActions`
  (navigationBarDemo.ts + all import sites).
- Stage CSS prefix: `.bs-demo` → `.sheet-demo` (consistency with the
  spelled-out `.navigation-demo`).

## 2. Comments + attribution

- Remove every `dStil` / `WAJOR` / `Dstil` reference (6 files:
  NavigationBar.tsx, navigation-bar/index.ts, BottomSheet.tsx,
  NavigationBarStage.tsx/.css, index.css). Rewrite surrounding comments
  as generic, useful explanations of behavior; keep the choreography
  beat comments.
- Standard header on NavigationBar.tsx, BottomSheet.tsx, and their two
  stages: `Part of Rishi's UI Lab — © 2026 Rishi Dean (rishidean.com) ·
MIT license · github.com/rishidean/ui-lab` (matches LICENSE).
  Home.tsx's byline is intentional and untouched; the shadcn `ui/`
  folder and stock hooks are third-party boilerplate, untouched.

## 3. Theme system (CSS token contract + presets)

Mechanism: the components' existing CSS-variable reads become a
formal, documented contract. No JS theme objects — CSS presets only.

- New `client/src/theme/theme.css`, imported once in `main.tsx`:
  - The full token contract, grouped and commented: canvas/surfaces,
    text scale, accent family (navigation purple), select pill,
    borders/shadows/blur, glass treatments, scrims.
  - `glass-nav` / `glass-overlay` move here from `index.css` (fixes the
    hidden dependency for copy-the-source consumers).
  - New component-scoped tokens for values currently hardcoded inline in
    NavigationBar.tsx and BottomSheet.css (circle gradients, sheet glass
    gradient, borders, shadows, grabber): `--nav-circle-bg`,
    `--nav-circle-border`, `--utility-circle-bg`, `--sheet-bg`,
    `--sheet-border`, `--sheet-grabber`, `--scrim`, plus shadow tokens.
    Components consume tokens instead of literals.
  - `:root` block = **Aurora** (the current light look, unchanged
    values). `.dark` block = **Ink**, the dark preset.
- Dark sweep: NavigationBarStage.css and BottomSheetStage.css replace
  hardcoded light values (#f5f5f5 canvas, white cards/glass, light
  scrims) with tokens so both stages render correctly in Ink.
- Switcher: the existing `ThemeContext` (light/dark, `.dark` on root,
  localStorage) becomes `switchable` in the lab shell with a sun/moon
  toggle in the header — every stage demos retheming live.
- Consumer story (documented in registry usage + theme.css header):
  copy the component + `theme.css`, edit a preset block or add
  `[data-ui-theme="yours"]`-style overrides. Components never change.
- BottomSheet.css keeps its literal fallbacks (drop-in safety) but the
  var names align with the contract.

## 4. Adoption fixes (from review)

1. **Dead grammar pruned**: remove the `isUtilityOpen` prop and its
   absorb branches from NavigationBar (no stage drives it); registry
   usage snippet rewritten against the new API. (Rishi pre-approved
   pruning "if the old grammar is dead" — it is.)
2. **Self-contained styling**: resolved by the theme system (§3).
3. **Timing contract exported**: NavigationBar exports
   `ACTION_SHEET_CLEAROUT_MS` and `UTILITY_CLEAROUT_MS` (computed from
   its internal delays × TEMPO); the stage's magic 440/500 timers use
   them, and the usage snippet shows the import.
4. **Filter by flag, not label**: `Action` gains `isFilter?: boolean`;
   the `label === "Filter"` special-case is dropped entirely (breaking,
   consistent with the naming break); demo data sets `isFilter: true`.

## Scope rule (Rishi, 2026-08-04)

App-side changes ONLY in service of decoupling the components: the
`theme.css` import, the minimal shell theme toggle, tokenizing the two
stage canvases so Ink renders correctly, and compile-level updates
forced by the renames. Everything else app-side is deferred.

## Verification

- `pnpm check` / `pnpm build` / prettier.
- Playwright frame captures: choreography regressions (menu open/select,
  filter open/select, workflow + utility sheets) in **Aurora**, then the
  same states in **Ink** — every capture read, both themes; plus the
  shell toggle itself.
- Grep gates: zero hits for `dStil|WAJOR|Dstil|rightButton|tabActions|
isUtilityOpen|label === "Filter"` in client/src after the sweep.

## Out of scope

- **PressAndSlidePicker — untouched entirely** (Rishi: acceptable even
  if incidentally broken; it has no dependency on the renamed API).
- README updates (Bottom Sheet row, Theming section) — deferred app
  polish.
- Accessibility pass (still next on the roadmap).
- Additional accent presets beyond Aurora + Ink (the mechanism supports
  them; add later).
- Renaming `BottomSheet` internals (already consistent).
