# NavigationBar drop-in pass — design

Date: 2026-09-14. Owner: Rishi. Status: proposed.

## Goal

A developer who has never seen this repo can put the NavigationBar in
their app in one sitting, the way they would a shadcn component: copy a
folder (or run one `npx shadcn add` line), paste a block of CSS
variables, follow a 25-line example, and pick a size. The choreography
is finished and stays exactly as it is; this pass changes only where
things live, what is exported, and what is documented.

## Non-goals

- No motion changes, no new beats, no timing props. Motion internals
  stay in-file constants (the drop-in-first rule).
- No conversion of the bar's Tailwind utilities to plain CSS. Tailwind
  is a declared peer requirement, as it is for shadcn.
- No changes to BottomSheet or UtilityModal beyond what the shared
  glass extraction forces on them.
- No free-form sizing. Three presets, not a number.

## Current state (measured, not assumed)

- `client/src/components/navigation-bar/` holds `NavigationBar.tsx`
  (2556 lines) and `index.ts`. The component imports `motion/react`,
  `lucide-react`, `cn` from `@/lib/utils`, and `focusWhenClear` from
  `@/lib/a11y`. It does not import BottomSheet or UtilityModal; the
  stage routes to them.
- ~330 lines of bar-specific CSS live in `client/src/theme/theme.css`
  (lines ~241–545): `.glass-nav`, `.nav-tab-ink`, `.nav-circle-*`,
  `.nav-action-chip*`, `.nav-menu-item`, `.nav-filter-option`,
  `.nav-search-*`, `.nav-assistant-*` and its keyframes,
  `.nav-action-divider`, `.dark` variants, and `--nav-dormant` math.
- Three rules in `theme.css` are shared with other components:
  `.glass-rim` (BottomSheet, the bar's menu), `.glass-overlay` (picker,
  the bar's menu and filter), `.scrollbar-hide` (the bar's action row).
- The bar reads these custom properties (TSX and CSS combined):
  `--accent-700 --accent-dormant --accent-soft --action-ghost-bg-hover
  --blur-lg --border-subtle --circle-shadow --glass-rim --gradient-brand
  --gray-900 --nav-circle-bg --nav-circle-border --nav-dormancy-depth
  --nav-dormant --nav-engage --nav-glass-drain --radius-md --scrim
  --scrim-light --select-bg --select-border --select-fg --shadow-xs
  --text-primary --text-secondary --text-tertiary --text-quaternary
  --utility-circle-bg --utility-circle-border`. This list is an input to
  a script, not something to maintain by hand (see Tokens).
- Sizing is all literals: circles `w-14 h-14`, chips `h-[34px]`, labels
  `text-[14px]`/`text-[13px]`, cluster `max-w-lg` with `gap-3`, root
  `px-[18px] pb-6`, menu `min-w-[210px]`, and in-file constants
  `ASSISTANT_INPUT_ROW_PX = 36`, `EDGE_FADE_PX = 28`.
- Scroll-collapse hysteresis (`COLLAPSE_AFTER_PX 56`, `EXPAND_AFTER_PX
  16`, `MIN_SCROLL_DELTA 10`, `TOGGLE_COOLDOWN_MS 350`,
  `ALWAYS_EXPANDED_ABOVE 20`, overlay guard, ratchet) lives in the
  stage, ~60 lines. Every consumer needs it.
- Usage documentation is one 140-line snippet string in
  `client/src/lab/registry.tsx` plus the 650-line stage.
- The lab serves `client/public/` statically (Vite root is `client/`).

## Design

### 1. The folder is the unit

`client/src/components/navigation-bar/` becomes self-contained:

```
navigation-bar/
  NavigationBar.tsx        — unchanged choreography; imports ./navigation-bar.css
  navigation-bar.css       — the ~330 lines moved out of theme.css, verbatim
  useCollapseOnScroll.ts   — the stage's hysteresis, extracted (section 5)
  lib.ts                   — cn + focusWhenClear, copied in (section 3)
  index.ts                 — exports the above
  README.md                — install, tokens, sizing, contracts (section 8)
```

`theme.css` keeps the `:root` / `.dark` presets and nothing else that
belongs to one component. The three shared glass rules move to a new
`client/src/theme/glass.css`, imported by `main.tsx` right after
`theme.css`. The bar's CSS keeps using `.glass-rim` / `.glass-overlay`
/ `.scrollbar-hide` by class name; the README and the manifest list
`theme/glass.css` as a file to copy. No rule is duplicated anywhere in
the repo.

Rule order matters for two selectors (`.dark .glass-nav` overrides
`.glass-nav`; `.nav-action-chip--active` follows `.nav-action-chip`).
Moving the block verbatim preserves order inside the file; across files
the only dependency is that `glass.css` loads before the component CSS,
which Vite's import order guarantees in the lab and the README states
for consumers.

Verification: the dormancy suite measures backdrop effects at render
level and fails if a rule is lost; plus a grep test that no `.nav-` or
`.glass-nav` selector remains in `theme.css`.

### 2. Tokens

There is no hand-written `tokens.css`. The list of variables the bar
needs is derived, not maintained:

- `scripts/registry/collect-vars.mjs` reads every file in the folder
  plus `glass.css`, extracts `var(--…)` names, resolves each in
  `theme.css` under `:root` and `.dark`, and fails if any name is
  unresolved. `scripts/a11y/a11y-tokens.mjs` wraps it so the drift
  test runs in the existing `test:a11y` loop.
- The same collector feeds the manifest's `cssVars.light` /
  `cssVars.dark` (section 7). Values are the Bench presets.
- The README shows the resulting block once, generated, with a note
  that the manifest is the source of truth. A consumer who is not
  using shadcn pastes that block into their globals; one who is gets it
  injected.

Variables that are derived at runtime (`--nav-dormant`, `--nav-engage`)
are defined by the component CSS itself and are excluded from the
required list by the collector (it treats a name as required only if
the folder reads it and does not define it).

### 3. Helpers

`cn` (3 lines) and `focusWhenClear` (10 lines) are copied into
`navigation-bar/lib.ts`, header-commented as copies of `@/lib/utils`
and `@/lib/a11y`. The bar imports from `./lib`. The originals stay for
the rest of the lab. `clsx` and `tailwind-merge` remain npm
dependencies (declared in the manifest), as shadcn does.

### 4. Sizing

**Prop.** `size?: "compact" | "default" | "large"` (default
`"default"`). It sets four custom properties on the bar's root
element via an inline style:

| preset | `--nav-circle` | `--nav-chip-h` | `--nav-label` | `--nav-max-w` |
| --- | --- | --- | --- | --- |
| compact | 48px | 30px | 13px | 28rem |
| default | 56px | 34px | 14px | 32rem |
| large | 60px | 38px | 14px | 36rem |

**Classes.** The literals that define the cluster's scale read the
variables through Tailwind arbitrary values: `w-[var(--nav-circle)]
h-[var(--nav-circle)]`, `h-[var(--nav-chip-h)]`,
`text-[length:var(--nav-label)]`, `max-w-[var(--nav-max-w)]`. The
13px secondary label becomes `calc(var(--nav-label) - 1px)`. Padding,
gaps, and radii stay literal — they are not what a consumer means by
"bigger".

**Literal audit.** Rect-driven motion (sheet origins, pill stretch,
menu absorb) measures with `getBoundingClientRect` and needs no change.
Two constants are re-derived from the variables at render time:
`ASSISTANT_INPUT_ROW_PX` (chip height + 2) and the menu `min-w`
(circle × 3.75). `EDGE_FADE_PX` stays literal: the fade on the scroll
row is a visual constant, not part of the scale. Everything else in the
timing block is time, not size, and is untouched.

**Guidance** (README): designed for a 360–512px cluster, centred on
wider screens; the consumer owns the fixed shell, the safe-area inset,
and the page's bottom padding; never scale with `zoom` or `transform`
(a transformed ancestor becomes the containing block for
`position: fixed`; the picker paid for that on 2026-08-05).

**Demo.** The stage's control panel gains a size select so the lab
shows the presets. Recording mode already hides the panel; the URL
param pattern (`?size=large`) is added alongside `depth`/`tempo`/`rm`.

**Test.** `scripts/a11y/a11y-sizes.mjs` renders each preset at 390px
and walks Deposit → scrim close, menu → Trade, filter expand → pick,
Search → Cancel, asserting after each: no horizontal overflow on the
root except the Trade action row; the pill's labels are fully inside
the pill's box; the dialog's top is below the viewport's top;
screenshots of the resting bar per preset into `scripts/a11y/shots/`.

### 5. `useCollapseOnScroll`

Extracted from the stage verbatim and exported from the folder:

```ts
export function useCollapseOnScroll(opts: {
  /** True while a sheet / search / assistant / utility is open. */
  overlayOpen: boolean;
  /** Fired when the bar collapses or expands. */
  onChange?: (collapsed: boolean) => void;
}): {
  isCollapsed: boolean;
  onScroll: (e: { currentTarget: { scrollTop: number } }) => void;
  expand: () => void;
}
```

The five thresholds stay in-file constants in the hook, with the
stage's comment moved along. The stage consumes the hook; its own copy
is deleted. `onScroll` is shaped for both React's scroll event and a
window-scroll adapter (`{ currentTarget: { scrollTop: window.scrollY } }`),
which is what example 02 shows.

This passes the drop-in rule: it is not a motion knob, it is the one
piece of app wiring every consumer must write, and today they would
have to reverse-engineer it from the stage.

### 6. Examples

`client/src/examples/navigation-bar/` holds five files, each a default
export component with the data it needs inline, each ≤ 80 lines
including comments:

| file | shows |
| --- | --- |
| `01-minimal.tsx` | tabs + contextual actions + `onActionClick`. No utilities, no sheets, no scroll. |
| `02-collapse-on-scroll.tsx` | `useCollapseOnScroll` driving `isCollapsed` from a scrolling container. |
| `03-search.tsx` | `isSearchOpen`, `onSearchChange`, `onSearchSubmit`, `onSearchClose`. |
| `04-workflow-sheet.tsx` | Deposit → `isSheetOpen`, `sheetClearoutMs`, `actionBarRef`, `<BottomSheet>`. |
| `05-assistant.tsx` | `isAssistantOpen`, owned transcript, `onAssistantSubmit`, `onAssistantClose`. |

They are typechecked by `npm run check` because they live under
`client/src`. They are rendered on the site two ways:

- **Code tab**: a new "examples" panel per file (source via `?raw`,
  copy chip), placed above the usage snippet. `LabComponent` gains
  `examples?: { name: string; source: string; Component: ComponentType }[]`.
- **Bare route**: `/navigation-bar?example=04-workflow-sheet` renders
  that example full-viewport instead of the stage (same branch of
  `Showcase.tsx` that handles `embed` / recording). This is what the
  tests and the size test drive; it is also a clean URL to send someone.

`navigationBarUsage` in `registry.tsx` shrinks to the prop table plus
a pointer to the examples. Its three contract comments (styling,
keyboard, utility routing) move to the folder README, where a copier
will find them.

A test, `scripts/a11y/a11y-examples.mjs`, loads each example route and
asserts the bar mounts, the example's headline interaction works (tap
Deposit → dialog appears; type in search → value echoes; etc.), and no
console errors were logged.

### 7. Registry manifest (optional — decided after sections 1–6 land)

Rishi's call, 2026-09-14: the shadcn CLI is a distribution convenience,
not the substance. Sections 1–6 deliver the drop-in on their own
("copy these files, paste this block"). Build this section only if,
once the folder is clean, it is as small as it looks.

`scripts/registry/build.mjs` writes `client/public/r/navigation-bar.json`
following shadcn's `registry-item.json` schema
(`https://ui.shadcn.com/schema/registry-item.json`):

- `name: "navigation-bar"`, `type: "registry:component"`, `title`,
  `description` (from the lab registry entry).
- `dependencies`: `motion`, `lucide-react`, `clsx`, `tailwind-merge`.
- `registryDependencies`: none. BottomSheet and UtilityModal are
  documented as optional companions, not dependencies.
- `files`: every file in the folder plus `theme/glass.css`, content
  inlined, `type: "registry:component"` for TSX/TS, `registry:file`
  with a `target` for CSS.
- `cssVars`: `light` and `dark` from the collector (section 2).
- `docs`: the README's install section.

The build runs as part of `npm run build` (before Vite), so the served
file cannot lag the source. The README's install line is
`npx shadcn@latest add https://lab.rishidean.com/r/navigation-bar.json`.
Validation: the build script fetches nothing; a unit check asserts the
output has every required top-level key and that every file listed
exists. A manual `npx shadcn add` into a scratch Vite app is the
acceptance test for this section and is recorded in the plan as a
human step.

The site leftover "registry `dependencies` arrays should link to their
source" is closed by rendering the Props/Code tab's dependency list
from the manifest for this component. Other components keep their
prose lists for now.

### 8. Documentation

`navigation-bar/README.md`, in this order: what it is (two lines);
install (shadcn line; or copy these files); the CSS variables block;
minimal usage (example 01 inline); sizing; the three contracts
(styling, keyboard, utility routing) moved from the usage string;
companions (BottomSheet, UtilityModal) with the clear-out pattern;
what you own (fixed shell, safe-area, page padding, scroll wiring).

`HANDOFF.md` gets the recap; the project README gets a one-line
"install" pointer per component once the manifest exists.

## Testing summary

| what | how |
| --- | --- |
| Nothing visual regressed | dormancy suite + full `test:a11y` (123 today) after every section |
| CSS fully extracted | grep test: no `nav-`/`glass-nav` selectors in `theme.css` |
| Tokens complete | collector resolves every `var(--…)` the folder reads |
| Presets don't break choreography | `a11y-sizes.mjs`, per-preset walk + screenshots |
| Examples work | `a11y-examples.mjs`, each route mounts and its interaction fires |
| Manifest valid | build check for keys and files; manual `shadcn add` into a scratch app |
| Types | `npm run check` covers examples and the hook |

## Order

1. Section 1 + 3 (folder, CSS split, helpers) — prerequisite for
   everything being honest. Suite green before moving on.
2. Section 2 (collector + drift test).
3. Section 4 (size prop, literal audit, demo select, size test).
4. Section 5 (hook) then 6 (examples, site wiring, example test).
5. Section 8 (README, usage shrink, handoff).
6. Section 7 (manifest) — optional, decided at this point.

Each of 1–4 is one session; 5 and 6 are an afternoon each. Work happens on the
`worktree-nav-bar-drop-in` branch; merge to `main` deploys.

## Risks

- **Lost CSS rule during the move.** Mitigated by moving verbatim in
  one commit and running the dormancy suite immediately.
- **Tailwind arbitrary values with `var()` inside `text-[…]`.** Tailwind
  v4 needs the `length:` hint for font-size; the size test catches a
  silently ignored class.
- **A preset that the choreography was not tuned for.** The presets
  are deliberately close to the current scale (−8 / +4px on the circle — 64px
  overflowed a two-action row at 390px during implementation, so large is 60,
  and its label stays 14px — the pill's row does not widen with the circles,
  so a 15px label overflowed by 7px regardless of circle size); the
  size test screenshots make any wobble visible before merge.
- **The manifest schema drifting.** The build script pins the `$schema`
  URL; the manual `shadcn add` step is the real check.
