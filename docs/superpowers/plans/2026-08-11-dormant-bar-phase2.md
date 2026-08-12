# Control Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the NavigationBar demo a small control panel exposing the three decisions a visitor cannot discover by clicking: dormancy depth, motion tempo, and reduced motion.

**Architecture:** Two new optional props on `NavigationBar` (`reducedMotion`, `tempo`), one breaking export change (`SHEET_CLEAROUT_MS` → `sheetClearoutMs(tempo)`), and a presentational `DemoControls` component owned by the stage. Dormancy depth needs no component change — it is already the `--nav-dormancy-depth` token, which the stage sets as an inline style.

**Tech Stack:** React 19, TypeScript, motion/react 12, Tailwind 4, Vite 7, pnpm.

## Context: what already landed

Phase 1 shipped `--nav-engage` (0 rest → 1 engaged), animated by framer on the bar's controls row and inherited by the pill and the tab glyph. A glass channel was tried and **reverted** — the pill does not composite its backdrop usably (measured ≤4/255 and identical across four backdrops). The surviving channel is the tab ink, scaled by `--nav-dormancy-depth` (default `1`).

`scripts/a11y/a11y-bar-dormancy.mjs` asserts the glass stays constant. **Do not re-introduce any engagement-driven glass change** — those assertions exist to prevent exactly that.

## Global Constraints

- **Defaults must reproduce today exactly.** `tempo` defaults to `1.3`, `reducedMotion` to the system preference. A consumer passing neither sees no change.
- **Never hardcode token values in components.** The stage sets `--nav-dormancy-depth`; the component only writes `--nav-engage`.
- Run `pnpm check` and `npx prettier --write <touched files>` before each commit. Never `pnpm format` — it rewrites `pnpm-lock.yaml` and unrelated committed docs.
- Build and serve: `pnpm build`, then `PORT=4999 nohup node dist/index.js > /tmp/server-wt.log 2>&1 &`. `setsid` does not exist here; `pkill` inside a compound command kills the command itself. A server is already running.
- Test scripts run from the repo root: `node scripts/a11y/<file>.mjs`. They import playwright as a bare specifier.

---

### Task 1: `reducedMotion` and `tempo` props

**BREAKING CHANGE** in step 3. Read the whole task first.

**Files:**
- Modify: `client/src/components/navigation-bar/NavigationBar.tsx`
- Modify: `client/src/components/navigation-bar/index.ts` (line 6)
- Modify: `client/src/stages/NavigationBarStage.tsx` (import line 23, call site ~line 239)

**Interfaces:**
- Produces: `reducedMotion?: boolean` and `tempo?: number` on `NavigationBarProps`; `export function sheetClearoutMs(tempo?: number): number`.

- [ ] **Step 1: `reducedMotion` override**

Add to the props type, beside the other optionals:

```tsx
  /** Override only; defaults to the system preference. Matches the same
   *  prop on BottomSheet and UtilityModal. */
  reducedMotion?: boolean;
```

Destructure as `reducedMotion,` (no default — `undefined` means follow the system). Then at the `prefersReducedMotion` declaration (~line 392):

```tsx
  const systemReducedMotion = useReducedMotion();
  const prefersReducedMotion = reducedMotion ?? !!systemReducedMotion;
```

Do NOT rename `prefersReducedMotion` — it is referenced throughout the file.

- [ ] **Step 2: `tempo` prop**

Rename the module constant, keeping its comment and extending it:

```tsx
// Global tempo knob: every duration and delay is multiplied by this.
// 1.0 = the nominal bands above; raise to make transitions more legible,
// lower to tighten. Tuned by feel on device. Consumers may override it
// with the `tempo` prop; the lab's demo exposes it as a slider.
const DEFAULT_TEMPO = 1.3;
```

Add the prop:

```tsx
  /** Multiplies every duration and delay. 1.0 is the nominal band;
   *  higher is more legible, lower is tighter. Defaults to 1.3. If you
   *  pass this, derive your sheet timing from `sheetClearoutMs(tempo)`
   *  with the SAME value, or the clear-out and your mount will desync. */
  tempo?: number;
```

Destructure with `tempo = DEFAULT_TEMPO,`. Point the helpers at it (~line 393):

```tsx
  const dur = (d: number) => (prefersReducedMotion ? 0 : d * tempo);
  const del = (d: number) => (prefersReducedMotion ? 0 : d * tempo);
```

Then find every remaining bare `TEMPO` inside the component body and replace with `tempo`:

```bash
grep -n "TEMPO" client/src/components/navigation-bar/NavigationBar.tsx
```

There are several beyond `dur`/`del` — the assistant focus-arm timer, `assistantSurfaceReady`, the assistant hold timer, and the assistant collapse constant. Several sit inside `useEffect` bodies: **add `tempo` to those dependency arrays.** After this, the only `DEFAULT_TEMPO` uses are its declaration and `sheetClearoutMs`'s default argument.

- [ ] **Step 3: the breaking export**

Replace the exported constant (~line 245). Keep the surrounding comment block and extend it:

```tsx
// Consumers flip isSheetOpen, wait this window, then measure the bar and
// mount their surface. Derived from the recede band (0.25) + a breath,
// × tempo — so it MUST be a function of tempo: a constant would desync
// the moment a consumer passes a non-default `tempo` prop.
export function sheetClearoutMs(tempo: number = DEFAULT_TEMPO): number {
  return Math.round((0.25 + 0.06) * tempo * 1000);
}
```

`client/src/components/navigation-bar/index.ts` line 6:

```ts
export { NavigationBar, sheetClearoutMs } from "./NavigationBar";
```

- [ ] **Step 4: update the only real caller**

In `NavigationBarStage.tsx`, change the import from `SHEET_CLEAROUT_MS` to `sheetClearoutMs`, and the call site (~line 239) to `sheetClearoutMs()`. Task 2 threads the stage's tempo state through it — leave this comment:

```tsx
        // Task 2 threads the stage's tempo state through here.
        prefersReducedMotion ? 0 : sheetClearoutMs()
```

- [ ] **Step 5: Verify**

```bash
pnpm check && pnpm build && pnpm test:a11y
```

Expected: tsc silent; 113 assertions, 0 failures. Timing is unchanged because every default reproduces 1.3.

Confirm the function reproduces the old constant — the old value was `403`:

```bash
node -e "console.log(Math.round((0.25+0.06)*1.3*1000))"
```

- [ ] **Step 6: Commit**

```bash
npx prettier --write client/src/components/navigation-bar/NavigationBar.tsx client/src/components/navigation-bar/index.ts client/src/stages/NavigationBarStage.tsx
git add client/src/components/navigation-bar/NavigationBar.tsx client/src/components/navigation-bar/index.ts client/src/stages/NavigationBarStage.tsx
git commit -m "feat!: reducedMotion and tempo props; SHEET_CLEAROUT_MS becomes sheetClearoutMs(tempo)"
```

---

### Task 2: The control panel

**Files:**
- Create: `client/src/stages/DemoControls.tsx`, `client/src/stages/DemoControls.css`
- Modify: `client/src/stages/NavigationBarStage.tsx`
- Test: `scripts/a11y/a11y-bar-dormancy.mjs` (extend)

**Interfaces:**
- Consumes: `tempo` / `reducedMotion` props and `sheetClearoutMs` (Task 1); `--nav-dormancy-depth` (already shipped).
- Produces: `DemoControls`, presentational, props `{ depth, onDepth, tempo, onTempo, reducedMotion, onReducedMotion }`.

- [ ] **Step 1: Build `DemoControls.tsx`**

A `<details>` element wrapping a `<fieldset>` with two range inputs and one checkbox. Requirements:

- Every control has a visible `<label>` bound by `htmlFor`/`id`, and renders its current value as text (e.g. `1.3×`, `60%`).
- Ranges: depth `min=0 max=1 step=0.05`; tempo `min=0.6 max=3 step=0.1`.
- `<summary>` reads "Demo controls". The `<details>` takes `defaultOpen` from a prop so the stage decides — do not read `window` inside the component.
- No colour literals. Use `--surface-overlay`, `--border-subtle`, `--text-primary`, `--text-secondary`, `--radius-md`, `--shadow-xs` from `theme/theme.css`.
- Position it top-right of the stage, `position: absolute`, above the scroll area but below the nav shell's z-index (the shell is `z-index: 50`).
- Add a short comment at the top of the file: this is a LAB affordance, not part of the component — a consumer dropping `NavigationBar` into their app gets none of this.

- [ ] **Step 2: Wire the stage**

In `NavigationBarStage.tsx` add three state values:

```tsx
  const [depth, setDepth] = useState(1);
  const [tempo, setTempo] = useState(1.3);
  const [reducedMotionOverride, setReducedMotionOverride] = useState(false);
```

Pass `tempo={tempo}` and `reducedMotion={reducedMotionOverride || undefined}` to `<NavigationBar>`. Set the depth token on the stage root:

```tsx
    <main
      className="navigation-demo"
      style={{ "--nav-dormancy-depth": depth } as React.CSSProperties}
    >
```

Thread `tempo` into the `sheetClearoutMs()` call from Task 1 and add `tempo` to that `useCallback`'s dependency array.

Render `<DemoControls>` inside the stage. It must NOT render in recording or presentation mode — find the existing gate the stage already uses for recording mode and reuse it rather than inventing a second mechanism. Compute `defaultOpen` as `window.innerWidth >= 640` in a `useState` initializer so it is read once, not on every render.

- [ ] **Step 3: Write the tests**

Append to `scripts/a11y/a11y-bar-dormancy.mjs`, before the reporting loop:

```js
// The panel is a lab affordance, but it must still be operable and
// labelled — it renders inside the same stage the a11y suites cover.
const panel = await page.evaluate(() => {
  const q = s => document.querySelector(s);
  const depth = q('input[type="range"][id*="depth"]');
  const tempo = q('input[type="range"][id*="tempo"]');
  const rm = q('input[type="checkbox"][id*="reduced"]');
  const labelled = el =>
    !!el && !!document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim();
  return {
    present: !!depth && !!tempo && !!rm,
    allLabelled: labelled(depth) && labelled(tempo) && labelled(rm),
    depthRange: depth && [depth.min, depth.max],
    tempoRange: tempo && [tempo.min, tempo.max],
  };
});
results.push(
  ["control panel renders all three controls", panel.present, panel],
  ["every control has an associated label", panel.allLabelled, panel],
  [
    "ranges match the spec",
    JSON.stringify(panel.depthRange) === '["0","1"]' &&
      JSON.stringify(panel.tempoRange) === '["0.6","3"]',
    panel,
  ]
);

// Dragging depth to 0 must switch dormancy off entirely: the resting
// tab ink becomes the full accent.
const setRange = (sel, value) =>
  page.evaluate(
    ([s, v]) => {
      const el = document.querySelector(s);
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      ).set;
      setter.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    [sel, value]
  );
const inkNow = () =>
  page.evaluate(
    () => getComputedStyle(document.querySelector(".nav-tab-ink")).color
  );

await setRange('input[type="range"][id*="depth"]', "0");
await page.waitForTimeout(700);
const inkDepth0 = await inkNow();
await setRange('input[type="range"][id*="depth"]', "1");
await page.waitForTimeout(700);
const inkDepth1 = await inkNow();
const chromaOf = s => Number(s.match(/oklch\([\d.]+\s+([\d.]+)/)?.[1] ?? NaN);
results.push([
  "depth 0 switches dormancy off (resting ink regains chroma)",
  chromaOf(inkDepth0) > 0.1 && chromaOf(inkDepth1) < 0.001,
  { inkDepth0, inkDepth1 },
]);
```

- [ ] **Step 4: Verify**

```bash
pnpm check && pnpm build && node scripts/a11y/a11y-bar-dormancy.mjs && pnpm test:a11y
```

Expected: tsc silent, new assertions PASS, every prior assertion still passing.

Also confirm the tempo slider genuinely changes timing: set it to `3`, open the nav menu, and verify the transition takes visibly longer than at `0.6` (measure the menu's settle time at both and report both numbers). If timing does not change, `tempo` is not threaded everywhere — go back to Task 1 Step 2.

- [ ] **Step 5: Commit**

```bash
npx prettier --write client/src/stages/DemoControls.tsx client/src/stages/DemoControls.css client/src/stages/NavigationBarStage.tsx scripts/a11y/a11y-bar-dormancy.mjs
git add client/src/stages/DemoControls.tsx client/src/stages/DemoControls.css client/src/stages/NavigationBarStage.tsx scripts/a11y/a11y-bar-dormancy.mjs
git commit -m "feat(demo): control panel for dormancy depth, tempo, and reduced motion"
```

---

### Task 3: Docs

**Files:**
- Modify: `NavigationBarOverview.md`, `client/src/lab/registry.tsx`, `README.md`

- [ ] **Step 1: Overview**

Extend the Dormancy section written in phase 1: the effect is the tab ink only, scaled by `--nav-dormancy-depth`; record that a glass channel was tried and reverted, with the measurement (≤4/255, identical across four backdrops) so nobody re-litigates it from scratch. Note the control panel is a lab affordance, not part of the component.

- [ ] **Step 2: Registry**

The navigation sample imports `SHEET_CLEAROUT_MS` — change to `sheetClearoutMs` and update the three comment references (~lines 80, 166, 211-214, 425). Add `tempo` and `reducedMotion` rows to `propRows` for the navigation-bar entry. Add a `tryIt` line for the control panel.

- [ ] **Step 3: README**

Add a short "Breaking changes" note: `SHEET_CLEAROUT_MS` became `sheetClearoutMs(tempo)`, migration is `SHEET_CLEAROUT_MS` → `sheetClearoutMs()`.

- [ ] **Step 4: Verify and commit**

```bash
pnpm check && pnpm build && pnpm test:a11y
npx prettier --write NavigationBarOverview.md client/src/lab/registry.tsx README.md
git add NavigationBarOverview.md client/src/lab/registry.tsx README.md
git commit -m "docs: control panel, tempo prop, and the sheetClearoutMs migration"
```
