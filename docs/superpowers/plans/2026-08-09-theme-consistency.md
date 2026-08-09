# Theme Consistency Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the component world from violet to the site's bench palette — both theme.css presets retuned in place, hue-neutral token renames, every violet literal swept, with contrast checks and a user-facing visual gate before merge.

**Architecture:** theme.css is the single source of truth; most surfaces follow automatically once its presets move (stages and components read tokens). The remaining work is the token renames' ripple (one component file), the animated-shadow literals framer can't read from vars, stage-CSS tints, and docs. Spec (authoritative, includes the palette mapping table): `docs/superpowers/specs/2026-08-09-theme-consistency-design.md`.

**Tech Stack:** CSS custom properties, React/TS, Playwright (a11y harness + screenshots), pnpm.

## Global Constraints

- Execution happens in an isolated worktree (SDD setup). The main checkout carries uncommitted PressAndSlidePicker work — `client/src/lab/registry.tsx` and everything under `press-and-slide-picker`/`PressAndSlidePickerStage` are OUT OF SCOPE and must appear in no commit.
- Every grep gate in this plan excludes picker files: append `| grep -v -i "press-and-slide"` to the sweeps.
- Renames (breaking, spec-fixed): `--iris-700` → `--accent-700`; `--aurora-lilac` → `--accent-soft`; `--gradient-aurora` → `--gradient-brand`; preset comment names "Aurora"/"Ink" → "Bench (light)"/"Bench (dark)".
- Anchor values (spec-fixed): light accent `#c22a75`, accent-soft `#ff9ac8`, gradient `#ff9ac8 → #ff5fa8 46% → #e879f9`, canvas `#fbfbf9`, text primary `#181a16`; dark accent `#ff5fa8` on the lab ramp `#131417/#191b1f/#21242a/#2b2f36`, dark text from `#e8e9ec/#9aa0a9/#61676f`. Derived values are tunable within these families; anchors are not.
- Warm shadow/border tint family: `rgba(20 20 10 / …)` light — keep each literal's existing alpha.
- Contrast floor: text-on-surface and pill-label pairs ≥ 4.5:1, both presets, verified programmatically (Task 4's suite).
- Typography, layout, motion: untouched. This pass changes colors only.
- Verification loop per task: `pnpm check` + `npx prettier --check` on touched files. Task 4 runs the full harness; Task 5 ends at the visual gate (controller pushes before/afters to the brainstorm companion tab; the USER approves before any merge).
- Comment style: match each file's voice.

---

### Task 1: theme.css presets + token renames (with their ripple)

**Files:**

- Modify: `client/src/theme/theme.css` (341 lines — the whole file is in scope)
- Modify: `client/src/components/navigation-bar/NavigationBar.tsx` (9 token references)

**Interfaces:**

- Produces: renamed tokens `--accent-700`, `--accent-soft`, `--gradient-brand` with bench values; every other token's value moved to the bench world. Later tasks rely on these exact names.

- [ ] **Step 1: Retune the `:root` (light) preset**

Apply the spec's Bench-light mapping table. Concretely, the anchor swaps (derived tokens follow the same recipes over the new anchors — color-mix recipes stay structurally identical):

```css
--accent-700: #c22a75; /* was --iris-700: #6d28d9 */
--accent-soft: #ff9ac8; /* was --aurora-lilac: #c4b5fd */
--gradient-brand: linear-gradient(
  135deg,
  #ff9ac8 0%,
  #ff5fa8 46%,
  #e879f9 100%
);
--bg-canvas: #fbfbf9;
--text-primary: #181a16;
--text-secondary: #5c5f56;
--text-tertiary: #797c71;
--text-quaternary: #95988c;
--gray-900: #181a16;
--border-subtle: rgb(20 20 10 / 0.11);
--select-bg: rgb(252 231 243 / 0.92);
--select-fg: #a12160;
--select-border: rgb(194 42 117 / 0.22);
--action-ghost-bg-hover: rgb(194 42 117 / 0.06);
--surface-modal: #fdfcfa;
```

Every remaining plum-tinted value in the light preset (`--shadow-*`,
`--circle-shadow`, `--sheet-*`, `--nav-circle-*`, `--utility-circle-*`,
scrims, glass classes below the presets) moves to the same role in the
warm family: shadow inks `rgb(48 36 72 / a)` → `rgb(20 20 10 / a)` (same
alphas), whites stay, color-mixes over the renamed accents stand as-is.

- [ ] **Step 2: Retune the `.dark` preset**

Same roles over the lab dark ramp: canvas `#131417`, surfaces from
`#191b1f`/`#21242a`, borders `#2b2f36`-family alphas, text scale
interpolated from `#e8e9ec/#9aa0a9/#61676f` (four steps), accent
`#ff5fa8`, accent-soft a lifted pink (e.g. `#ffb1d4`), select pill
`rgba(255 95 168 / 0.14)` bg with a light pink ink ≥4.5:1 on it,
gradient rebuilt from the same three stops (they read on dark as-is —
verify in Task 4/5). Dark shadows stay black-based.

- [ ] **Step 3: Rename the tokens and update every reference**

In theme.css: rename the three declarations and ALL in-file uses (~20).
Update the header comment: presets are "Bench (light)" / "Bench (dark)";
keep the copy-this-file retheme instructions. In NavigationBar.tsx:
update the 9 `var(--iris-700)`/`var(--aurora-lilac)`/`var(--gradient-aurora)`
references to the new names — values-only change, no structural edits.

- [ ] **Step 4: Verify**

```bash
pnpm check
npx prettier --check client/src/theme/theme.css client/src/components/navigation-bar/NavigationBar.tsx
grep -rn "iris-700\|aurora-lilac\|gradient-aurora" client/ | grep -v -i "press-and-slide"
```

The grep must return zero hits. Then `pnpm build` and a quick headless
screenshot of `/navigation-bar` (light + `.dark` toggled) to confirm the
page renders pink/warm with no obviously broken surface — save the shots
to the SDD workspace for the report.

- [ ] **Step 5: Commit**

```bash
git add client/src/theme/theme.css client/src/components/navigation-bar/NavigationBar.tsx
git commit -m "feat: theme contract moves to the bench palette; hue-neutral token names"
```

---

### Task 2: In-component literal sweep

**Files:**

- Modify: `client/src/components/navigation-bar/NavigationBar.tsx:1581-1597` (menu grow/close shadows)
- Modify: `client/src/components/bottom-sheet/BottomSheet.tsx:173,182` (origin/sheet shadow literals)
- Modify: `client/src/components/bottom-sheet/BottomSheet.css` (lines 37, 73, 90, 96, 102, 124, 130 — var fallbacks + one inset shadow)
- Check (likely no-op): `client/src/components/utility-modal/UtilityModal.css`, `UtilityModal.tsx`

**Interfaces:**

- Consumes: Task 1's renamed tokens/values.

- [ ] **Step 1: Sweep the known literals**

- NavigationBar menu shadows: `rgb(44 31 66 / a)` → `rgb(20 20 10 / a)`, same alphas, white insets unchanged.
- BottomSheet.tsx `originState`/`sheetState` boxShadows: `rgb(48 36 72 / a)` → `rgb(20 20 10 / a)`.
- BottomSheet.css: var FALLBACKS must equal the new preset values (`#5b21b6` → `#a12160`; `rgb(53 42 75 / 0.16)` grabber → `rgb(20 20 10 / 0.16)`; `rgb(53 42 75 / 0.08)` hover → `rgba(194 42 117 / 0.06)`; the `rgb(49 36 72 / 0.18)` inset → `rgb(20 20 10 / 0.18)`).
- UtilityModal: grep both files for the violet families; retint any hit (the modal's rim/scrim literals) the same way. If genuinely zero hits, note that in the report.

- [ ] **Step 2: The zero-hits gate**

```bash
grep -rn "44 31 66\|48 36 72\|53 42 75\|49 36 72\|c4b5fd\|6d28d9\|a78bfa\|8b5cf6\|f0abfc\|a5b4fc\|ede9fe\|5b21b6\|7c3aed" client/src/components | grep -v -i "press-and-slide"
```

Zero hits required. Also re-check the components' remaining hex/rgb
literals by eye (`grep -n "rgb\|#[0-9a-f]\{6\}" <component files>`) for
any violet the pattern list missed — judgment call, list what you leave
and why in the report.

- [ ] **Step 3: Verify + commit**

`pnpm check` + prettier on touched files.

```bash
git add client/src/components/
git commit -m "feat: retint component literals to the bench family"
```

---

### Task 3: Stage CSS + site surfaces

**Files:**

- Modify: `client/src/stages/NavigationBarStage.css:175` (+ any violet tints found)
- Modify: `client/src/stages/BottomSheetStage.css:54,82`
- Modify: `client/src/stages/UtilityModalStage.css:55,116`
- Check (likely no-op): `client/src/pages/Home.tsx`, `client/src/App.tsx`, `client/src/index.css`, `client/src/stages/*.tsx` inline styles
- DO NOT TOUCH: `PressAndSlidePickerStage.*`

**Interfaces:**

- Consumes: Task 1's tokens (stages mostly read them — the retune carries most stage surfaces automatically).

- [ ] **Step 1: Retint the known literals** (same warm/pink mapping, same alphas), then sweep each in-scope stage file plus the site files for violet-family literals the known list missed — the ghost cards, feature orb, and scan view read tokens, but verify by rendering, not assumption.

- [ ] **Step 2: Zero-hits gate over `client/src/stages client/src/pages` (same pattern list, same picker exclusion), `pnpm check`, prettier.**

- [ ] **Step 3: Commit**

```bash
git add client/src/stages/NavigationBarStage.css client/src/stages/BottomSheetStage.css client/src/stages/UtilityModalStage.css
git commit -m "feat: demo stages join the bench palette"
```

(Add Home/App/index.css to the same commit only if they needed edits.)

---

### Task 4: Contrast suite + full harness

**Files:**

- Create: `scripts/a11y/a11y-contrast.mjs` (named so `pnpm test:a11y`'s glob picks it up permanently)
- Modify: `scripts/a11y/README.md` (table row)

**Interfaces:**

- Consumes: the shipped presets from Tasks 1–3, served at `:4999`.

- [ ] **Step 1: Write the suite**

Playwright: load `/navigation-bar`, read computed values of the pairs via
`getComputedStyle(document.documentElement).getPropertyValue(...)` for
BOTH presets (toggle `.dark` on the root between passes). Compute WCAG
relative-luminance contrast in-page or in-node (implement the standard
formula — no new dependency). Assert ≥ 4.5:1 for:
`--text-primary`/`--text-secondary`/`--text-tertiary` on `--bg-canvas`,
`--text-primary` on `--surface-overlay` (resolve alpha over canvas),
`--select-fg` on `--select-bg` (alpha-resolved), and the accent-ink pair
wherever ink-on-accent occurs (light: white on `#c22a75`; dark:
`#12140c` on `#ff5fa8`). `--text-quaternary` is placeholder-grade:
assert ≥ 3:1 and print its ratio rather than failing at 4.5 (comment
why). Print PASS/FAIL per pair; exit non-zero on failure; match the
harness's output style (copy the tail from `a11y-triggers.mjs`).

- [ ] **Step 2: Run the full loop**

```bash
pnpm build
PORT=4999 node dist/index.js &
pnpm test:a11y
```

All suites green, including the new one. If a contrast pair fails, tune
the DERIVED value (never an anchor) and re-run. Kill the server.

- [ ] **Step 3: Commit**

```bash
git add scripts/a11y/
git commit -m "test: contrast suite for the bench presets"
```

---

### Task 5: Docs sync + screenshot set for the visual gate

**Files:**

- Modify: `NavigationBarOverview.md` (color vocabulary: violet/iris/lilac mentions → accent/bench terms)
- Modify: `client/src/lab/registry.tsx` — navigation/bottom-sheet/utility-modal entries ONLY: Aurora/Ink preset mentions, renamed-token mentions in usage snippets and dependency notes. NOTHING in picker regions.
- Screenshots: light + dark of `/` (Home), `/navigation-bar` (resting, assistant open, workflow sheet, Export, Scan), `/bottom-sheet`, `/utility-modal` — saved to the SDD workspace as `gate-<page>-<state>-<preset>.png`.

**Interfaces:**

- Consumes: everything shipped; produces the image set the controller pushes to the companion tab.

- [ ] **Step 1: Docs sweep** — `grep -rn -i "aurora\|iris\|lilac\|violet\|purple" NavigationBarOverview.md client/src/lab/registry.tsx scripts/a11y/README.md` (picker regions excluded); update every stale mention to bench vocabulary. theme.css's header was Task 1.

- [ ] **Step 2: Screenshot set** — production build on `:4999`, headless Playwright, 390×844, both presets (toggle the site's theme switch or stamp `.dark` on the root); drive the states via the same selectors the a11y suites use (AI button, Deposit, Export on Transactions, Scan on Spend). Name files exactly per the pattern above.

- [ ] **Step 3: Verify + commit**

`pnpm check`, prettier on touched files, then:

```bash
git add NavigationBarOverview.md client/src/lab/registry.tsx
git commit -m "docs: bench-palette vocabulary sweep"
```

The visual GATE itself is not this task's to run: the controller pushes
the before/after set to the brainstorm companion and the USER approves
before merge. Do not merge or push anything.

---

## Self-Review Notes

- **Spec coverage:** presets+renames (T1), literals (T2), stages/site (T3), contrast floor (T4 as a permanent suite), docs/registry + visual-gate materials (T5). The gate and merge stay with the controller/user per spec.
- **Type consistency:** token names identical across tasks; grep pattern list identical in T2/T3 gates.
- **Judgment latitude:** derived values tunable within families (spec's rule); T2/T3 "sweep by eye" steps require the implementer to list anything deliberately left, so the reviewer sees the judgment.
