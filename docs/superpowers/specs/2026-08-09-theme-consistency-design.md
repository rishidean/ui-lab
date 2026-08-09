# Theme Consistency Pass: Design Spec

**Scope:** `theme.css` contract (both presets), in-component color literals, demo-stage CSS, docs/registry sync
**Author:** Rishi Dean
**Status:** Approved design, not yet implemented
**Decision record:** direction and reach chosen via visual companion, 2026-08-09 — full pink adoption (option A)

---

## Why this exists

The lab-bench showcase chrome and the components it frames are two color
worlds on one page. The chrome is warm neutrals with a pink accent
(`--lab-*`: `#fbfbf9`/`#131417` canvases, `#c22a75`/`#ff5fa8` accents).
The components read the theme.css contract's violet world: iris
`#6d28d9`, aurora lilac `#c4b5fd`, plum-tinted text and shadows, frosted
violet glass. Rishi's call: the components adopt the site's world —
**full adoption**, state surfaces AND atmosphere (glows, pulse, shimmer,
brand gradient), chosen against a quieter pink-state-only option in a
side-by-side mockup review.

## Decisions already made

- **Direction:** components → site palette. The chrome (`--lab-*`,
  `labTheme.ts`, `Showcase.css`) is the reference and does not change.
- **Mechanism:** retune the Aurora/Ink presets IN PLACE in `theme.css` —
  the shipped contract itself moves; no site-scoped override layer. One
  source of truth.
- **Reach:** full adoption (mockup option A). Everything violet becomes
  pink-family or warm-neutral; nothing keeps the old hue.
- **Renames:** hue-named tokens become hue-neutral so the contract reads
  honestly after the swap (and after any future retheme):
  - `--iris-700` → `--accent-700`
  - `--aurora-lilac` → `--accent-soft`
  - `--gradient-aurora` → `--gradient-brand`
  - Preset names in comments: "Aurora" → "Bench (light)", "Ink" →
    "Bench (dark)".
    Breaking change to the theme contract; repo precedent accepts breaking
    renames with a docs sync.
- **Out of scope:** the PressAndSlidePicker (uncommitted overhaul in the
  working tree — untouched), typography (DM Sans stays; the pass is
  color-only), the lab chrome files, and any layout/motion change.

## Palette mapping

### Bench (light) — replaces Aurora (`:root`)

| Role                                | Old (violet world)          | New (bench world)                                                             |
| ----------------------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| Accent strong (`--accent-700`)      | `#6d28d9`                   | `#c22a75`                                                                     |
| Accent soft (`--accent-soft`)       | `#c4b5fd`                   | `#ff9ac8`                                                                     |
| Brand gradient (`--gradient-brand`) | lilac→fuchsia→periwinkle    | `#ff9ac8 → #ff5fa8 46% → #e879f9`                                             |
| Canvas (`--bg-canvas`)              | `#f5f5f5`                   | `#fbfbf9`                                                                     |
| Text primary                        | `#211a2c`                   | `#181a16`                                                                     |
| Text secondary                      | `#625a6d`                   | `#5c5f56`                                                                     |
| Text tertiary                       | `#81798b`                   | `#797c71` (interpolated lab scale)                                            |
| Text quaternary                     | `#9c95a4`                   | `#95988c`                                                                     |
| Icon ink (`--gray-900`)             | `#18141f`                   | `#181a16`                                                                     |
| Borders/shadows tint                | `rgb(48 36 72 / …)` plum    | `rgba(20 20 10 / …)` warm, same alphas                                        |
| Select pill                         | violet tint / `#5b21b6` ink | `rgba(194 42 117 / 0.10)` bg, `#a12160` ink, `rgba(194 42 117 / 0.22)` border |
| Ghost hover                         | `rgb(109 40 217 / 0.07)`    | `rgba(194 42 117 / 0.06)` (lab `--lab-press-bg`)                              |
| Circle/glass tints                  | iris color-mixes            | same color-mix recipes over `--accent-700` (recipes unchanged, hue follows)   |

### Bench (dark) — replaces Ink (`.dark`)

Same mapping against the lab dark ramp: canvases from
`#131417/#191b1f/#21242a/#2b2f36`, text `#e8e9ec/#9aa0a9/#61676f`
(interpolate the four-step component scale from the lab three-step),
accent `#ff5fa8` with `#12140c` accent-ink where ink-on-accent occurs,
glows/tints as `rgba(255 95 168 / …)` at the alphas the lilac versions
used. Shadows stay black-based (already hue-neutral in dark).

Exact derived values are the implementer's to tune within these
families; the table's named anchors are fixed. Contrast floor: all
text-on-surface pairs ≥ 4.5:1, state pills ≥ 4.5:1 for their label ink,
verified programmatically.

### In-component literals

Animated shadows and one-off glows live as literals in the components
(framer can't interpolate `var()` strings) and are documented as
tuned-by-eye. Every plum-tinted literal (`rgb(44 31 66 / …)`,
`rgb(48 36 72 / …)`, lilac glows, the absorb pulse, UtilityModal's rim,
BottomSheet's entrance/exit shadows, assistant shimmer stops if any
literal survives) moves to the warm/pink family at the same alphas.
`grep -n "44 31 66\|48 36 72\|53 42 75\|c4b5fd\|6d28d9\|a78bfa\|8b5cf6"`
across `client/src/components` must return zero hits when done.

### Demo-stage CSS

`NavigationBarStage.css`, `BottomSheetStage.css`, `UtilityModalStage.css`
(and `Home.tsx`/`App` canvas tints if violet): ghost cards, feature orb,
scan view, sheet skeletons — violet tints → the same roles in the bench
family, so demo canvases and components sit in one world.

## Docs & registry sync

- `theme.css` header comment: new preset names, retheme instructions
  unchanged in spirit.
- Registry usage snippets / dependencies notes that mention Aurora/Ink
  or the renamed tokens.
- `NavigationBarOverview.md` + component overviews: color vocabulary
  ("violet marks state" → "the accent marks state"; any lilac/iris
  mentions).
- HANDOFF.md is wrapped separately at session end, not in this pass.

## Verification

- `pnpm check` + prettier per task; full a11y harness green (focus-ring
  suites assert ring presence, not hue — expected to hold; fix at cause
  if not).
- Programmatic contrast checks for the table's text/surface pairs in
  both presets.
- Visual pass: light + dark screenshots of every stage (NavigationBar
  incl. assistant, workflow sheet, Export, Scan; BottomSheet page;
  UtilityModal page; Home) reviewed by Rishi via the companion tab
  before merge. Merge+push only on that approval.
- Token-rename sweep: `grep -rn "iris-700\|aurora-lilac\|gradient-aurora"`
  over `client/` returns zero hits.
