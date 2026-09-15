# NavigationBar Drop-in Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the NavigationBar a self-contained, documented, sizeable folder that another developer can copy into their app in one sitting, without touching its choreography.

**Architecture:** Move the bar's CSS and two tiny helpers into `client/src/components/navigation-bar/`, split the three shared glass rules into `client/src/theme/glass.css`, derive the required CSS-variable list with a script, add a three-preset `size` prop driven by CSS custom properties, extract the stage's scroll-collapse hysteresis into a hook, and add five runnable examples wired into the lab site. Every task ends with the existing Playwright suite green.

**Tech Stack:** React 18 + TypeScript, Vite (root `client/`), Tailwind v4, `motion/react`, Playwright scripts in `scripts/a11y/*.mjs` run by `npm run test:a11y` against a dev server on port 4999.

**Spec:** `docs/superpowers/specs/2026-09-14-navigation-bar-drop-in-design.md`

## Global Constraints

- No motion changes. No timing becomes a prop. Beat constants stay in-file.
- Tailwind utilities stay; no conversion to plain CSS.
- No CSS rule is duplicated anywhere in the repo.
- Three size presets only: `compact | default | large`. No free number.
- The suite (`npm run test:a11y`, 123 assertions today) and `npm run check` must pass at the end of every task.
- Work on branch `worktree-nav-bar-drop-in` in the worktree at `.claude/worktrees/nav-bar-drop-in`. Run all commands from there.
- Commit trailer: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Section 7 of the spec (shadcn manifest) is optional and NOT in this plan. Decide after Task 9.

### Running the suite

The suite needs a dev server on port 4999. Start it in the background once per task, run the suite, stop it:

```bash
(npx vite --port 4999 --strictPort > /dev/null 2>&1 &)
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:4999/ && break; sleep 1; done
npm run -s test:a11y > /tmp/suite.log 2>&1; echo "exit=$?"
grep -c "^PASS" /tmp/suite.log; grep "^FAIL" /tmp/suite.log
pkill -f "vite --port 4999"
```

Expected at the end of every task: `exit=0`, PASS count ≥ 123 (higher once new scripts land), no FAIL lines.

---

### Task 1: Split the shared glass primitives into `theme/glass.css`

**Files:**
- Create: `client/src/theme/glass.css`
- Modify: `client/src/theme/theme.css` (remove lines ~212–235 `.glass-rim`, ~393–418 `.glass-overlay` + `.dark .glass-overlay`, ~547–556 `.scrollbar-hide`)
- Modify: `client/src/main.tsx:3-4`
- Test: `scripts/a11y/a11y-theme-split.mjs` (create)

**Interfaces:**
- Produces: `client/src/theme/glass.css` defining exactly `.glass-rim::before`, `.glass-overlay`, `.dark .glass-overlay`, `.scrollbar-hide`, `.scrollbar-hide::-webkit-scrollbar`. Tasks 2 and 9 rely on this file existing at that path.

- [ ] **Step 1: Write the failing split test**

Create `scripts/a11y/a11y-theme-split.mjs`. It is a plain Node script (no browser) so it runs inside the `test:a11y` loop:

```js
// Guards the CSS split: theme.css holds tokens only; shared glass
// primitives live in glass.css; the bar's rules live in its folder.
import { readFileSync, existsSync } from "node:fs";

const read = p => (existsSync(p) ? readFileSync(p, "utf8") : "");
const theme = read("client/src/theme/theme.css");
const glass = read("client/src/theme/glass.css");
const nav = read("client/src/components/navigation-bar/navigation-bar.css");

const selectors = css =>
  [...css.matchAll(/^(\.[^{\n]+?)\s*\{/gm)].map(m => m[1].trim());
const themeSel = selectors(theme);
const glassSel = selectors(glass);
const navSel = selectors(nav);

const results = [];
const push = (name, pass, detail) => results.push([name, pass, detail]);

push(
  "theme.css has no glass primitives",
  !themeSel.some(s => /glass-rim|glass-overlay|scrollbar-hide/.test(s)),
  themeSel.filter(s => /glass-rim|glass-overlay|scrollbar-hide/.test(s))
);
push(
  "glass.css defines the three primitives",
  ["glass-rim::before", "glass-overlay", "dark .glass-overlay", "scrollbar-hide"].every(
    s => glassSel.some(g => g.includes(s))
  ),
  glassSel
);
// Task 2 turns these two on; they fail until then and that is expected
// only while Task 2 is in progress — never commit with them failing.
push(
  "theme.css has no NavigationBar rules",
  !themeSel.some(s => /glass-nav|\.nav-/.test(s)),
  themeSel.filter(s => /glass-nav|\.nav-/.test(s))
);
push(
  "navigation-bar.css holds the bar's rules",
  ["glass-nav", "nav-circle-surface", "nav-action-chip", "nav-assistant-bubble"].every(
    s => navSel.some(n => n.includes(s))
  ),
  navSel.slice(0, 10)
);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
process.exit(results.every(r => r[1]) ? 0 : 1);
```

- [ ] **Step 2: Run it to see it fail**

Run: `node scripts/a11y/a11y-theme-split.mjs`
Expected: four FAIL lines (theme still has everything; glass.css and navigation-bar.css do not exist).

- [ ] **Step 3: Create `glass.css` by moving the three rules verbatim**

Open `client/src/theme/theme.css`. Cut these blocks, including their leading comment lines, and paste them in this order into a new `client/src/theme/glass.css`:

1. The `/* NOTE: this deliberately does NOT set position ... */` comment and the `.glass-rim::before { ... }` rule (starts around line 212, ends at the closing `}` around line 235).
2. The `/* Menu surface — same one-shadow-plus-inset system as the capsule. */` comment, `.glass-overlay { ... }` and `.dark .glass-overlay { ... }` (around lines 393–418).
3. The `/* Horizontal scroll rows hide their scrollbars ... */` comment, `.scrollbar-hide { ... }` and `.scrollbar-hide::-webkit-scrollbar { ... }` (the last rules in the file).

Put this header at the top of `glass.css`:

```css
/*
 * Shared glass primitives — used by NavigationBar (menu, filter, action
 * row), BottomSheet (rim), and PressAndSlidePicker (overlay). Part of
 * Rishi's UI Lab — © 2026 Rishi Dean (rishidean.com) · MIT.
 *
 * Load AFTER theme.css (tokens) and BEFORE any component CSS. main.tsx
 * does this; a consumer copying a component copies this file too.
 */
```

Do not edit any declaration. `git diff` on `theme.css` must show only deletions.

- [ ] **Step 4: Import it in `main.tsx`**

```tsx
import { createRoot } from "react-dom/client";
import App from "./App";
import "./theme/theme.css";
import "./theme/glass.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
```

- [ ] **Step 5: Run the split test and the suite**

Run: `node scripts/a11y/a11y-theme-split.mjs`
Expected: first two PASS, last two still FAIL (Task 2 fixes them). Do not commit yet — go straight to Task 2 so the loop never lands red. (If you must pause, leave the working tree dirty rather than committing a red test.)

Run the suite per "Running the suite" — but the loop will stop at the split test. Run the browser scripts directly instead to confirm nothing visual broke:

```bash
for f in scripts/a11y/a11y-bar-dormancy.mjs scripts/a11y/a11y-sheet.mjs scripts/a11y/a11y-menu.mjs; do node "$f" || echo "FAILED $f"; done
```

Expected: all PASS lines, no FAILED.

---

### Task 2: Move the bar's CSS into its folder

**Files:**
- Create: `client/src/components/navigation-bar/navigation-bar.css`
- Modify: `client/src/theme/theme.css` (remove the bar block: from the `/* One continuous frosted capsule ... */` comment just before `.glass-nav,` through the closing `}` of `.dark .nav-action-divider`)
- Modify: `client/src/components/navigation-bar/NavigationBar.tsx:35-40` (add the CSS import)
- Test: `scripts/a11y/a11y-theme-split.mjs` (from Task 1), full suite

**Interfaces:**
- Produces: `navigation-bar/navigation-bar.css` — every `.glass-nav`, `.nav-*`, `--nav-dormant` rule and the `nav-assistant-shimmer` keyframes. Task 4's collector reads this file.

- [ ] **Step 1: Move the block verbatim**

In `theme.css`, the block begins with the comment `/* One continuous frosted capsule — a single soft shadow and one inset highlight ... */` followed by `/* \`--nav-dormant\`: how much dormancy is in effect right now ... */` and the selector list `.glass-nav,\n.nav-tab-ink,\n.nav-circle-trigger,\n.nav-circle-surface {`. It ends with the closing `}` of `.dark .nav-action-divider`. After Task 1 the `.glass-overlay` rules in the middle of that range are already gone. Cut the whole remaining range and paste it into `navigation-bar/navigation-bar.css` under this header:

```css
/*
 * NavigationBar styles — the glass capsule, circles, action chips, menu
 * rows, filter strip, search field, assistant bubbles, and the dormancy
 * math (`--nav-dormant`). Part of Rishi's UI Lab — © 2026 Rishi Dean
 * (rishidean.com) · MIT license · github.com/rishidean/ui-lab
 *
 * Reads tokens from theme.css and the shared primitives in glass.css
 * (.glass-rim, .glass-overlay, .scrollbar-hide). Load both before this
 * file — NavigationBar.tsx imports this file, so in the lab the order is
 * main.tsx (theme, glass) → component. Rule order INSIDE this file
 * matters: `.dark .glass-nav` overrides `.glass-nav`;
 * `.nav-action-chip--active` follows `.nav-action-chip`. Keep it.
 */
```

After the cut, `theme.css` must contain only the header comment, `:root { ... }` and `.dark { ... }`. Verify:

```bash
grep -n "^\.\|^@keyframes" client/src/theme/theme.css
```

Expected output: exactly one line, `.dark {` (plus its line number).

- [ ] **Step 2: Import the CSS from the component**

In `NavigationBar.tsx`, after the `lucide-react` import (line ~37), add:

```ts
import "./navigation-bar.css";
```

- [ ] **Step 3: Run the split test**

Run: `node scripts/a11y/a11y-theme-split.mjs`
Expected: four PASS lines, exit 0.

- [ ] **Step 4: Run the full suite**

Per "Running the suite". Expected: `exit=0`, PASS ≥ 127 (123 + the 4 split assertions), no FAIL. The dormancy script (`a11y-bar-dormancy.mjs`) is the one that would catch a lost rule; read its output lines specifically.

- [ ] **Step 5: Commit Tasks 1 and 2 together**

```bash
git add client/src/theme/glass.css client/src/theme/theme.css client/src/main.tsx \
  client/src/components/navigation-bar/navigation-bar.css \
  client/src/components/navigation-bar/NavigationBar.tsx \
  scripts/a11y/a11y-theme-split.mjs
git commit -m "refactor: NavigationBar CSS moves into its folder; shared glass into glass.css

theme.css is tokens only now. Rules moved verbatim; the split test
guards the boundary and the dormancy suite guards the render.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Fold `cn` and `focusWhenClear` into the folder

**Files:**
- Create: `client/src/components/navigation-bar/lib.ts`
- Modify: `client/src/components/navigation-bar/NavigationBar.tsx:35-36`
- Test: `npm run check`, full suite

**Interfaces:**
- Produces: `navigation-bar/lib.ts` exporting `cn(...inputs: ClassValue[]): string` and `focusWhenClear(el: HTMLElement | null, attempts?: number): void`. Task 8's examples import nothing from here; the bar does.

- [ ] **Step 1: Create `lib.ts`**

```ts
/**
 * Two helpers the NavigationBar needs, copied in so the folder is
 * self-contained. They are byte-for-byte the lab's `@/lib/utils` (cn)
 * and `@/lib/a11y` (focusWhenClear); if you already have a `cn`, point
 * the import in NavigationBar.tsx at yours and delete this one.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Focus `el` once it is no longer inside an `[inert]` subtree. Surfaces
 * that contain focus (BottomSheet, UtilityModal) mark everything outside
 * themselves inert while open and lift it on exit; a same-tick
 * `el.focus()` there can silently no-op, so this polls a few frames
 * instead of guessing a delay. Always `{ preventScroll: true }`.
 */
export function focusWhenClear(el: HTMLElement | null, attempts = 5) {
  if (!el) return;
  if (!el.closest("[inert]")) {
    el.focus({ preventScroll: true });
    return;
  }
  if (attempts <= 0) return;
  requestAnimationFrame(() => focusWhenClear(el, attempts - 1));
}
```

- [ ] **Step 2: Switch the bar's imports**

In `NavigationBar.tsx`, replace:

```ts
import { cn } from "@/lib/utils";
import { focusWhenClear } from "@/lib/a11y";
```

with:

```ts
import { cn, focusWhenClear } from "./lib";
```

Confirm no other `@/lib` import remains in the folder:

```bash
grep -n "@/lib" client/src/components/navigation-bar/*.ts client/src/components/navigation-bar/*.tsx
```

Expected: no output.

- [ ] **Step 3: Typecheck and run the suite**

Run: `npm run -s check && echo TYPES-OK`
Expected: `TYPES-OK`.

Run the suite per "Running the suite". Expected: `exit=0`, no FAIL.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/navigation-bar/lib.ts client/src/components/navigation-bar/NavigationBar.tsx
git commit -m "refactor: NavigationBar carries its own cn and focusWhenClear

Copies of @/lib/utils and @/lib/a11y so the folder has no lab imports.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Derive the required CSS variables and guard against drift

**Files:**
- Create: `scripts/registry/collect-vars.mjs`
- Create: `scripts/a11y/a11y-tokens.mjs`
- Test: `scripts/a11y/a11y-tokens.mjs`

**Interfaces:**
- Produces: `collectVars({ files, themeFile }) → { required: string[], defined: string[], light: Record<string,string>, dark: Record<string,string>, unresolved: string[] }` from `scripts/registry/collect-vars.mjs`. Task 9 uses it to render the README's variable block.

- [ ] **Step 1: Write the failing test**

Create `scripts/a11y/a11y-tokens.mjs`:

```js
// Drift guard: every CSS custom property the NavigationBar folder reads
// must be defined either by the folder itself or by theme.css presets.
import { collectVars } from "../registry/collect-vars.mjs";

const FOLDER = "client/src/components/navigation-bar";
const out = collectVars({
  files: [
    `${FOLDER}/NavigationBar.tsx`,
    `${FOLDER}/navigation-bar.css`,
    "client/src/theme/glass.css",
  ],
  themeFile: "client/src/theme/theme.css",
});

const results = [
  ["every read variable resolves", out.unresolved.length === 0, out.unresolved],
  ["required list is non-trivial", out.required.length >= 20, out.required.length],
  ["light and dark cover the same names",
    out.required.every(n => n in out.light && n in out.dark),
    out.required.filter(n => !(n in out.light && n in out.dark))],
];
for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
process.exit(results.every(r => r[1]) ? 0 : 1);
```

- [ ] **Step 2: Run it to see it fail**

Run: `node scripts/a11y/a11y-tokens.mjs`
Expected: `ERR_MODULE_NOT_FOUND` for `collect-vars.mjs`.

- [ ] **Step 3: Write the collector**

Create `scripts/registry/collect-vars.mjs`:

```js
// Collects the CSS custom properties a set of files READ (`var(--x)`),
// subtracts the ones those files DEFINE (`--x:`), and resolves the rest
// against theme.css's `:root` (light) and `.dark` blocks.
import { readFileSync } from "node:fs";

const READ_RE = /var\(\s*(--[a-zA-Z0-9-]+)/g;
const DEF_RE = /^\s*(--[a-zA-Z0-9-]+)\s*:/gm;

/** Returns `{ [name]: value }` for one `selector { ... }` block. */
function block(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return {};
  let depth = 0, i = css.indexOf("{", start);
  for (; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) break;
  }
  const body = css.slice(css.indexOf("{", start) + 1, i);
  const out = {};
  for (const m of body.matchAll(/^\s*(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/gm))
    out[m[1]] = m[2].replace(/\s+/g, " ").trim();
  return out;
}

export function collectVars({ files, themeFile }) {
  const sources = files.map(f => readFileSync(f, "utf8"));
  const read = new Set(), defined = new Set();
  for (const s of sources) {
    for (const m of s.matchAll(READ_RE)) read.add(m[1]);
    for (const m of s.matchAll(DEF_RE)) defined.add(m[1]);
  }
  const theme = readFileSync(themeFile, "utf8");
  const rootVars = block(theme, ":root");
  const darkVars = block(theme, ".dark");
  const required = [...read].filter(n => !defined.has(n)).sort();
  const light = {}, dark = {}, unresolved = [];
  for (const n of required) {
    if (n in rootVars) light[n] = rootVars[n];
    if (n in darkVars) dark[n] = darkVars[n];
    else if (n in rootVars) dark[n] = rootVars[n]; // light value carries
    if (!(n in rootVars)) unresolved.push(n);
  }
  return { required, defined: [...defined].sort(), light, dark, unresolved };
}

// CLI: node scripts/registry/collect-vars.mjs → prints the README block.
if (import.meta.url === `file://${process.argv[1]}`) {
  const FOLDER = "client/src/components/navigation-bar";
  const out = collectVars({
    files: [`${FOLDER}/NavigationBar.tsx`, `${FOLDER}/navigation-bar.css`, "client/src/theme/glass.css"],
    themeFile: "client/src/theme/theme.css",
  });
  const lines = [":root {"];
  for (const n of out.required) lines.push(`  ${n}: ${out.light[n]};`);
  lines.push("}", "", ".dark {");
  for (const n of out.required) if (out.dark[n] !== out.light[n]) lines.push(`  ${n}: ${out.dark[n]};`);
  lines.push("}");
  console.log(lines.join("\n"));
  if (out.unresolved.length) {
    console.error("UNRESOLVED:", out.unresolved.join(" "));
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run the test**

Run: `node scripts/a11y/a11y-tokens.mjs`
Expected: three PASS lines. If "every read variable resolves" fails, the detail lists names; each is either a real gap in `theme.css` (add it) or a variable defined inside a Tailwind arbitrary value the regex misread — inspect before touching the theme.

Also run the CLI once and eyeball it: `node scripts/registry/collect-vars.mjs | head -40`. The `--nav-dormant` and `--nav-engage` names must NOT appear in the `:root` block (they are defined by `navigation-bar.css`); `--accent-700`, `--select-bg`, `--text-primary` must.

- [ ] **Step 5: Commit**

```bash
git add scripts/registry/collect-vars.mjs scripts/a11y/a11y-tokens.mjs
git commit -m "test: derive the NavigationBar's required CSS variables; fail on drift

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `size` prop with three presets

**Files:**
- Modify: `client/src/components/navigation-bar/NavigationBar.tsx` (props type ~297–367; component signature ~369; root div at ~1505; class literals at 1581, 1622, 1636, 1781, 2069, 2094, 2146, 2174, 2278, 2376, 2404, 2426, 2504; `ASSISTANT_INPUT_ROW_PX` at ~671)
- Modify: `client/src/components/navigation-bar/index.ts`
- Test: `scripts/a11y/a11y-sizes.mjs` (create)

**Interfaces:**
- Produces: `export type NavigationBarSize = "compact" | "default" | "large"`, prop `size?: NavigationBarSize` (default `"default"`), and `export const NAV_SIZE_SPECS: Record<NavigationBarSize, { circle: number; chip: number; label: number; maxW: string }>`. Task 6 reads `NAV_SIZE_SPECS` keys for the select; Task 8's examples use `size`.

- [ ] **Step 1: Write the failing size test**

Create `scripts/a11y/a11y-sizes.mjs`:

```js
// Each size preset must keep the choreography intact: no overflow on the
// bar root except the Trade action row, labels inside the pill, dialog
// fully on screen. Drives the stage via the ?size= URL param (Task 6),
// so this script fails until both Task 5 and Task 6 land.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("scripts/a11y/shots", { recursive: true });
const browser = await chromium.launch();
const results = [];
const push = (name, pass, detail) => results.push([name, pass, detail]);

for (const size of ["compact", "default", "large"]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://localhost:4999/navigation-bar?recording=1&size=${size}`);
  await page.waitForTimeout(1500);

  const circle = await page.evaluate(() => {
    const el = document.querySelector(".nav-circle-surface");
    return el ? Math.round(el.getBoundingClientRect().width) : null;
  });
  const expected = { compact: 48, default: 56, large: 64 }[size];
  push(`${size}: circle is ${expected}px`, circle === expected, circle);

  const overflow = await page.evaluate(() => {
    const root = document.querySelector(".navigation-demo__nav-shell");
    return root ? root.scrollWidth - root.clientWidth : -1;
  });
  push(`${size}: no horizontal overflow at rest`, overflow <= 0, overflow);

  const labelsInside = await page.evaluate(() => {
    const chips = [...document.querySelectorAll(".nav-action-chip")];
    return chips.every(c => {
      const span = c.querySelector("span");
      if (!span) return true;
      const a = c.getBoundingClientRect(), b = span.getBoundingClientRect();
      return b.left >= a.left - 0.5 && b.right <= a.right + 0.5;
    });
  });
  push(`${size}: action labels sit inside their chips`, labelsInside, null);

  await page.screenshot({ path: `scripts/a11y/shots/size-${size}-rest.png` });

  // Deposit → sheet on screen → scrim close.
  await page.locator('button:has-text("Deposit")').click();
  await page.waitForTimeout(1800);
  const dialogTop = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return d ? Math.round(d.getBoundingClientRect().top) : null;
  });
  push(`${size}: workflow sheet opens on screen`, dialogTop !== null && dialogTop > 0, dialogTop);
  await page.screenshot({ path: `scripts/a11y/shots/size-${size}-sheet.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1800);

  // Menu → Trade; the five-action row is the one allowed overflow.
  await page.locator('button[aria-haspopup="menu"]').click();
  await page.waitForTimeout(1000);
  await page.locator('[role="menuitemradio"]', { hasText: "Trade" }).click();
  await page.waitForTimeout(2000);
  const rowScrolls = await page.evaluate(() => {
    const row = document.querySelector(".navigation-demo__nav-shell .overflow-x-auto");
    return row ? row.scrollWidth > row.clientWidth : false;
  });
  push(`${size}: Trade row overflows horizontally (by design)`, rowScrolls, null);

  // Search morph then Cancel.
  await page.locator('button[aria-label="Search"]').click();
  await page.waitForTimeout(1000);
  const searchInput = await page.locator('input[aria-label="Search"]').count();
  push(`${size}: search field mounts`, searchInput === 1, searchInput);
  await page.locator("button", { hasText: /^Cancel$/ }).click();
  await page.waitForTimeout(1500);

  // Menu → Transactions; filter expand and pick.
  await page.locator('button[aria-haspopup="menu"]').click();
  await page.waitForTimeout(1000);
  await page.locator('[role="menuitemradio"]', { hasText: "Transactions" }).click();
  await page.waitForTimeout(2000);
  await page.locator(".navigation-demo__nav-shell button", { hasText: "Pending" }).click();
  await page.waitForTimeout(1400);
  const radios = await page.locator('[role="radio"]').count();
  push(`${size}: filter strip expands with 3 options`, radios === 3, radios);
  await page.locator(".navigation-demo__nav-shell button", { hasText: "Scheduled" }).click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `scripts/a11y/shots/size-${size}-filter.png` });

  await page.close();
}

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
```

- [ ] **Step 2: Run it to see it fail**

Start the dev server (per "Running the suite"), then: `node scripts/a11y/a11y-sizes.mjs`
Expected: the `circle is 48px` and `64px` assertions FAIL (every preset renders 56 today). Stop the server afterwards or leave it for Step 6.

- [ ] **Step 3: Add the type, the specs, and the prop**

In `NavigationBar.tsx`, near the other module constants (after `const DEFAULT_TEMPO = 1.3;` ~line 159), add:

```ts
/** Three tuned scales. Not a free number: the choreography (pill
 *  stretch, menu absorb, assistant stretch) was verified at these three
 *  and nowhere else. Each preset writes four custom properties on the
 *  bar's root; every size-bearing class reads them. */
export type NavigationBarSize = "compact" | "default" | "large";
export const NAV_SIZE_SPECS: Record<
  NavigationBarSize,
  { circle: number; chip: number; label: number; maxW: string }
> = {
  compact: { circle: 48, chip: 30, label: 13, maxW: "28rem" },
  default: { circle: 56, chip: 34, label: 14, maxW: "32rem" },
  large: { circle: 64, chip: 38, label: 15, maxW: "36rem" },
};
```

In `NavigationBarProps` (after `tempo?: number;`), add:

```ts
  /** Cluster scale — circle, chip height, label size, max width. */
  size?: NavigationBarSize;
```

In the component's destructuring (`export const NavigationBar: React.FC<NavigationBarProps> = ({ ... })`), add `size = "default",`.

Inside the component body, right after the destructuring, add:

```ts
  const sizeSpec = NAV_SIZE_SPECS[size];
  const sizeVars = {
    "--nav-circle": `${sizeSpec.circle}px`,
    "--nav-chip-h": `${sizeSpec.chip}px`,
    "--nav-label": `${sizeSpec.label}px`,
    "--nav-max-w": sizeSpec.maxW,
  } as React.CSSProperties;
```

- [ ] **Step 4: Put the variables on the root and make the classes read them**

Root div (~line 1505):

```tsx
    <div
      className="relative px-[18px] pb-6 pointer-events-none"
      style={sizeVars}
      ref={navRef}
    >
```

Then these exact class-string edits (use the line numbers as a guide; search the strings):

| find | replace with |
| --- | --- |
| `max-w-lg mx-auto` (line ~1581) | `max-w-[var(--nav-max-w)] mx-auto` |
| `w-14 h-14` (lines ~1622, ~1636, ~2504 — three places) | `w-[var(--nav-circle)] h-[var(--nav-circle)]` |
| `min-w-[210px]` (line ~1781) | `min-w-[calc(var(--nav-circle)*3.75)]` |
| `h-[34px]` (lines ~2278, ~2376) | `h-[var(--nav-chip-h)]` |
| `text-[14px]` (lines ~2069, ~2146, ~2404, ~2426) | `text-[length:var(--nav-label)]` |
| `text-[13px]` (lines ~2094, ~2174, ~2278) | `text-[length:calc(var(--nav-label)-1px)]` |

Line ~1510 is a comment mentioning `max-w-lg`; update the comment text to `max-w-[var(--nav-max-w)]`.

`ASSISTANT_INPUT_ROW_PX` (~line 671) becomes derived:

```ts
  const ASSISTANT_INPUT_ROW_PX = sizeSpec.chip + 2;
```

(`EDGE_FADE_PX` stays a literal: the fade width on the scroll row is a visual constant, not part of the scale. This deviates from the spec's "three constants"; note it in the commit.)

- [ ] **Step 5: Export from `index.ts`**

```ts
export { NavigationBar, NAV_SIZE_SPECS, sheetClearoutMs } from "./NavigationBar";
export type {
  Action,
  AssistantMessage,
  FilterOption,
  NavigationBarProps,
  NavigationBarSize,
  NavTabId,
  Tab,
  UtilityAction,
} from "./NavigationBar";
```

- [ ] **Step 6: Typecheck and run the suite**

Run: `npm run -s check && echo TYPES-OK` → `TYPES-OK`.

Run the suite. Expected: everything that passed before still passes; `a11y-sizes.mjs` still FAILS on the `48px`/`64px` lines only, because the stage does not yet read `?size=` (Task 6). Confirm the `default` preset's assertions all PASS. Do not commit with the loop red — proceed to Task 6 and commit both together.

---

### Task 6: Size select in the demo controls and `?size=` param

**Files:**
- Modify: `client/src/stages/DemoControls.tsx`
- Modify: `client/src/stages/NavigationBarStage.tsx` (imports ~21–40; state ~143–158; `<DemoControls>` ~419–427; `<NavigationBar>` props ~477–500)
- Test: `scripts/a11y/a11y-sizes.mjs` (from Task 5), full suite

**Interfaces:**
- Consumes: `NavigationBarSize`, `NAV_SIZE_SPECS` from `@/components/navigation-bar`.
- Produces: URL param `size=compact|default|large` on the stage.

- [ ] **Step 1: Extend `DemoControls`**

Add to the props interface:

```ts
  size: NavigationBarSize;
  onSize: (value: NavigationBarSize) => void;
```

with `import type { NavigationBarSize } from "@/components/navigation-bar";` and `import { NAV_SIZE_SPECS } from "@/components/navigation-bar";`. Destructure `size, onSize`. Insert this row before the reduced-motion checkbox row:

```tsx
        <div className="demo-controls__row">
          <label htmlFor="demo-controls-size" className="demo-controls__label">
            <span>Size</span>
            <span className="demo-controls__value">
              {NAV_SIZE_SPECS[size].circle}px
            </span>
          </label>
          <select
            id="demo-controls-size"
            className="demo-controls__select"
            value={size}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              onSize(event.target.value as NavigationBarSize)
            }
          >
            {(Object.keys(NAV_SIZE_SPECS) as NavigationBarSize[]).map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
```

Add to `client/src/stages/DemoControls.css` (append):

```css
.demo-controls__select {
  width: 100%;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  background: transparent;
  color: inherit;
  font: inherit;
}
```

- [ ] **Step 2: Wire the stage**

In `NavigationBarStage.tsx`, extend the import from `@/components/navigation-bar` with `NAV_SIZE_SPECS` and `type NavigationBarSize`. Next to the other demo-control state:

```ts
  const [size, setSize] = useState<NavigationBarSize>(() => {
    const raw = new URLSearchParams(window.location.search).get("size");
    return raw && raw in NAV_SIZE_SPECS ? (raw as NavigationBarSize) : "default";
  });
```

Pass `size={size} onSize={setSize}` to `<DemoControls>` and `size={size}` to `<NavigationBar>`.

- [ ] **Step 3: Typecheck and run the suite**

`npm run -s check && echo TYPES-OK` → `TYPES-OK`.

Run the suite. Expected: `exit=0`, no FAIL, PASS count ≥ 127 + 3 (tokens) + 24 (sizes: 8 per preset).

Open the three `scripts/a11y/shots/size-*-rest.png` screenshots (Read tool) and confirm the clusters look like the same bar at three scales — no clipped label, no circle overlapping the pill.

- [ ] **Step 4: Commit Tasks 5 and 6**

```bash
git add client/src/components/navigation-bar client/src/stages/DemoControls.tsx \
  client/src/stages/DemoControls.css client/src/stages/NavigationBarStage.tsx \
  scripts/a11y/a11y-sizes.mjs
git commit -m "feat: NavigationBar size presets (compact / default / large)

Four custom properties on the root drive every size-bearing class; the
assistant row height derives from the chip height. EDGE_FADE_PX stays
literal — the fade is a visual constant, not part of the scale. The
stage gains a size select and ?size= param; a11y-sizes.mjs walks the
choreography per preset with screenshots.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Extract `useCollapseOnScroll`

**Files:**
- Create: `client/src/components/navigation-bar/useCollapseOnScroll.ts`
- Modify: `client/src/components/navigation-bar/index.ts`
- Modify: `client/src/stages/NavigationBarStage.tsx` (constants ~66–70; refs ~131–140; `overlayOpenRef` effect ~341–357; `setCollapsed` ~359–368; `handleScroll` ~371–404; `expandFromLogo` ~406–409; `onScroll` at ~450; `isCollapsed` / `onCollapsedClick` at ~487/497)
- Test: `scripts/a11y/a11y-collapse.mjs` (create), full suite

**Interfaces:**
- Produces:
  ```ts
  export function useCollapseOnScroll(opts: {
    overlayOpen: boolean;
    onChange?: (collapsed: boolean) => void;
  }): {
    isCollapsed: boolean;
    onScroll: (e: { currentTarget: { scrollTop: number } }) => void;
    expand: () => void;
  }
  ```
  Task 8's example 02 consumes it.

- [ ] **Step 1: Write the failing test**

Create `scripts/a11y/a11y-collapse.mjs`:

```js
// The collapse hysteresis, now a hook: a decisive scroll down collapses
// the bar to the logo; a small nudge up expands it; nothing happens
// while an overlay is open.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4999/navigation-bar?recording=1");
await page.waitForTimeout(1500);
const results = [];
const push = (name, pass, detail) => results.push([name, pass, detail]);

const scrollTo = top =>
  page.evaluate(t => {
    const el = document.querySelector(".navigation-demo__scroll-area");
    el.scrollTop = t;
  }, top);
const collapsed = () =>
  page.evaluate(() => !!document.querySelector('button[aria-label="Open controls"]'));

await scrollTo(30); await page.waitForTimeout(100);
await scrollTo(120); await page.waitForTimeout(600);
push("scrolling down 90px collapses", await collapsed(), null);

await scrollTo(90); await page.waitForTimeout(600);
push("nudging up 30px expands", !(await collapsed()), null);

// Overlay guard: open Deposit, scroll hard, bar must not collapse.
await page.locator('button:has-text("Deposit")').click();
await page.waitForTimeout(1600);
await scrollTo(400); await page.waitForTimeout(600);
push("no collapse while the sheet is open", !(await collapsed()), null);
await page.keyboard.press("Escape");
await page.waitForTimeout(1600);

// Hook export exists (typecheck covers the signature; this covers the
// index.ts surface at runtime via the example route from Task 8 —
// until then, assert the module is importable by name in the bundle).
const hookExported = await page.evaluate(async () => {
  try {
    const m = await import("/src/components/navigation-bar/index.ts");
    return typeof m.useCollapseOnScroll === "function";
  } catch {
    return false;
  }
});
push("useCollapseOnScroll is exported from the folder", hookExported, null);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
```

- [ ] **Step 2: Run it to see it fail**

With the dev server up: `node scripts/a11y/a11y-collapse.mjs`
Expected: first three PASS (the stage already behaves this way), last one FAIL.

- [ ] **Step 3: Write the hook**

Create `client/src/components/navigation-bar/useCollapseOnScroll.ts`:

```ts
/**
 * useCollapseOnScroll — the scroll hysteresis that folds the bar to its
 * logo. Every consumer needs this wiring, so it ships with the bar.
 *
 * Collapsing requires a decisive downward pull (COLLAPSE_AFTER_PX past
 * the anchor); expanding only a small upward nudge (EXPAND_AFTER_PX).
 * Movements under MIN_SCROLL_DELTA are ignored, a short cooldown stops
 * rapid toggling around a boundary, and nothing toggles while an overlay
 * (sheet, search, assistant, utility) is open — the anchor is kept fresh
 * so closing the overlay doesn't inherit stale scroll distance. Above
 * ALWAYS_EXPANDED_ABOVE the bar is always expanded.
 *
 * Feed it your scroll container's onScroll, or adapt window scroll:
 *   window.addEventListener("scroll", () =>
 *     onScroll({ currentTarget: { scrollTop: window.scrollY } }));
 */
import { useCallback, useRef, useState } from "react";

const COLLAPSE_AFTER_PX = 56;
const EXPAND_AFTER_PX = 16;
const MIN_SCROLL_DELTA = 10;
const TOGGLE_COOLDOWN_MS = 350;
const ALWAYS_EXPANDED_ABOVE = 20;

export type CollapseScrollEvent = { currentTarget: { scrollTop: number } };

export function useCollapseOnScroll({
  overlayOpen,
  onChange,
}: {
  /** True while a sheet / search / assistant / utility surface is open. */
  overlayOpen: boolean;
  /** Fired when the bar collapses (true) or expands (false). */
  onChange?: (collapsed: boolean) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const anchorRef = useRef(0);
  const collapsedRef = useRef(false);
  const lastToggleAtRef = useRef(0);
  const overlayRef = useRef(overlayOpen);
  overlayRef.current = overlayOpen;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const set = useCallback((next: boolean, anchor: number) => {
    collapsedRef.current = next;
    anchorRef.current = anchor;
    lastToggleAtRef.current = Date.now();
    setIsCollapsed(next);
    onChangeRef.current?.(next);
  }, []);

  const onScroll = useCallback(
    (event: CollapseScrollEvent) => {
      const scrollTop = event.currentTarget.scrollTop;

      if (scrollTop < ALWAYS_EXPANDED_ABOVE) {
        if (collapsedRef.current) set(false, scrollTop);
        anchorRef.current = scrollTop;
        return;
      }

      const delta = scrollTop - anchorRef.current;
      if (Math.abs(delta) < MIN_SCROLL_DELTA) return; // jitter

      if (overlayRef.current) {
        anchorRef.current = scrollTop;
        return;
      }

      const cooling = Date.now() - lastToggleAtRef.current < TOGGLE_COOLDOWN_MS;
      if (!collapsedRef.current) {
        if (delta > COLLAPSE_AFTER_PX && !cooling) set(true, scrollTop);
        else if (delta < 0) anchorRef.current = scrollTop; // ratchet up
      } else {
        if (delta < -EXPAND_AFTER_PX && !cooling) set(false, scrollTop);
        else if (delta > 0) anchorRef.current = scrollTop; // ratchet down
      }
    },
    [set]
  );

  const expand = useCallback(() => set(false, anchorRef.current), [set]);

  return { isCollapsed, onScroll, expand };
}
```

Add to `index.ts`:

```ts
export { useCollapseOnScroll } from "./useCollapseOnScroll";
export type { CollapseScrollEvent } from "./useCollapseOnScroll";
```

- [ ] **Step 4: Make the stage consume it**

In `NavigationBarStage.tsx`:

1. Delete the five constants `COLLAPSE_AFTER_PX … ALWAYS_EXPANDED_ABOVE` and the comment block above them that starts `// Scroll hysteresis:`.
2. Delete `anchorScrollRef`, `collapsedRef`, `lastToggleAtRef`, `overlayOpenRef`, the `useEffect` that sets `overlayOpenRef.current`, the `const [isCollapsed, setIsCollapsed] = useState(false);`, `setCollapsed`, and `handleScroll`.
3. Add, after the sheet/utility state declarations it depends on (it must come after `openSheet`, `sheetPrep`, `isSearchOpen`, `isAssistantOpen`, `utility`, `utilityClosing`, `utilSheet` are declared):

```ts
  const overlayOpen =
    openSheet !== null ||
    sheetPrep ||
    isSearchOpen ||
    isAssistantOpen ||
    utility !== null ||
    utilityClosing ||
    utilSheet !== null;
  const { isCollapsed, onScroll: handleScroll, expand } = useCollapseOnScroll({
    overlayOpen,
    onChange: collapsed => {
      if (collapsed) {
        setIsSearchOpen(false);
        setIsAssistantOpen(false);
      }
    },
  });
```

4. Replace `expandFromLogo`:

```ts
  const expandFromLogo = useCallback(() => {
    expand();
    scrollAreaRef.current?.scrollBy({ top: -140, behavior: "smooth" });
  }, [expand]);
```

5. `onScroll={handleScroll}`, `isCollapsed={isCollapsed}`, `onCollapsedClick={expandFromLogo}` stay as they are. Add `useCollapseOnScroll` to the import from `@/components/navigation-bar`. Remove the now-unused `UIEvent` type import if nothing else uses it.

- [ ] **Step 5: Typecheck and run the suite**

`npm run -s check && echo TYPES-OK` → `TYPES-OK` (this catches any leftover reference to the deleted refs).

Run the suite. Expected: `exit=0`, no FAIL, `a11y-collapse.mjs` four PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/navigation-bar/useCollapseOnScroll.ts \
  client/src/components/navigation-bar/index.ts client/src/stages/NavigationBarStage.tsx \
  scripts/a11y/a11y-collapse.mjs
git commit -m "feat: useCollapseOnScroll ships with the NavigationBar

The stage's hysteresis, extracted verbatim with its thresholds as in-file
constants. Every consumer needs this wiring; now they don't reverse-
engineer it from the stage.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Five runnable examples, wired into the site

**Files:**
- Create: `client/src/examples/navigation-bar/01-minimal.tsx`, `02-collapse-on-scroll.tsx`, `03-search.tsx`, `04-workflow-sheet.tsx`, `05-assistant.tsx`, `index.ts`
- Modify: `client/src/lab/registry.tsx` (`LabComponent` type ~57–73; the navigation-bar entry ~344–481)
- Modify: `client/src/lab/Showcase.tsx` (`CodePanels` ~99–120; bare-route branch ~208–215)
- Modify: `client/src/lab/Showcase.css` (append)
- Test: `scripts/a11y/a11y-examples.mjs` (create), `npm run check`, full suite

**Interfaces:**
- Consumes: `NavigationBar`, `useCollapseOnScroll`, `sheetClearoutMs`, types from `@/components/navigation-bar`; `BottomSheet`, `SheetOrigin` from `@/components/bottom-sheet`.
- Produces: `LabComponent.examples?: LabExample[]` where `LabExample = { id: string; title: string; source: string; Component: ComponentType }`; bare route `/<slug>?example=<id>`.

- [ ] **Step 1: Write the failing examples test**

Create `scripts/a11y/a11y-examples.mjs`:

```js
// Each example route must mount the bar, run its headline interaction,
// and log no console errors.
import { chromium } from "playwright";

const browser = await chromium.launch();
const results = [];
const push = (name, pass, detail) => results.push([name, pass, detail]);

async function open(id) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("console", m => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(`http://localhost:4999/navigation-bar?example=${id}`);
  await page.waitForTimeout(1200);
  const mounted = (await page.locator(".nav-circle-surface").count()) > 0;
  push(`${id}: bar mounts`, mounted, null);
  return { page, errors };
}
async function done(id, { page, errors }) {
  push(`${id}: no console errors`, errors.length === 0, errors);
  await page.close();
}

{ // 01 — tapping an action reports it
  const s = await open("01-minimal");
  await s.page.locator('button:has-text("Deposit")').click();
  await s.page.waitForTimeout(300);
  const text = await s.page.locator("[data-example-log]").textContent();
  push("01-minimal: onActionClick fires", (text ?? "").includes("Deposit"), text);
  await done("01-minimal", s);
}
{ // 02 — scrolling collapses
  const s = await open("02-collapse-on-scroll");
  await s.page.evaluate(() => {
    const el = document.querySelector("[data-example-scroll]");
    el.scrollTop = 30;
  });
  await s.page.waitForTimeout(100);
  await s.page.evaluate(() => {
    const el = document.querySelector("[data-example-scroll]");
    el.scrollTop = 140;
  });
  await s.page.waitForTimeout(700);
  const collapsed = (await s.page.locator('button[aria-label="Open controls"]').count()) === 1;
  push("02-collapse-on-scroll: collapses on scroll", collapsed, null);
  await done("02-collapse-on-scroll", s);
}
{ // 03 — search echoes
  const s = await open("03-search");
  await s.page.locator('button[aria-label="Search"]').click();
  await s.page.waitForTimeout(900);
  await s.page.keyboard.type("eth");
  await s.page.waitForTimeout(200);
  const text = await s.page.locator("[data-example-log]").textContent();
  push("03-search: query echoes", (text ?? "").includes("eth"), text);
  await done("03-search", s);
}
{ // 04 — sheet opens from Deposit
  const s = await open("04-workflow-sheet");
  await s.page.locator('button:has-text("Deposit")').click();
  await s.page.waitForTimeout(1800);
  const dialog = await s.page.locator('[role="dialog"]').count();
  push("04-workflow-sheet: sheet opens", dialog === 1, dialog);
  await s.page.keyboard.press("Escape");
  await s.page.waitForTimeout(1600);
  await done("04-workflow-sheet", s);
}
{ // 05 — assistant reply lands
  const s = await open("05-assistant");
  await s.page.locator('button[aria-label="AI"]').click();
  await s.page.waitForTimeout(1000);
  await s.page.keyboard.type("hi");
  await s.page.keyboard.press("Enter");
  await s.page.waitForTimeout(2500);
  const log = await s.page.locator('[role="log"]').textContent();
  push("05-assistant: reply appears", (log ?? "").includes("You said"), log);
  await s.page.locator("button", { hasText: /^Cancel$/ }).click();
  await s.page.waitForTimeout(1200);
  await done("05-assistant", s);
}

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
```

- [ ] **Step 2: Run it to see it fail**

With the dev server up: `node scripts/a11y/a11y-examples.mjs`
Expected: every "bar mounts" line passes (the route ignores `?example` and shows the stage) but the specific assertions FAIL (`[data-example-log]` does not exist, etc.).

- [ ] **Step 3: Write the examples**

All five share this shell. Keep each file ≤ 80 lines. Every example renders the bar inside a fixed shell it owns and a scrolling area with bottom padding, which is the "what you own" contract from the README.

`client/src/examples/navigation-bar/01-minimal.tsx`:

```tsx
/**
 * 01 — Minimal. Tabs, per-tab actions, and a click handler. No utilities,
 * no sheets, no scroll wiring. This is the whole required surface.
 */
import { useState } from "react";
import { Home, CreditCard, ArrowDownToLine, ArrowUpFromLine, Send } from "lucide-react";
import { NavigationBar, type Tab, type Action } from "@/components/navigation-bar";

const tabs: Tab[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "spend", label: "Spend", Icon: CreditCard },
];
// Actions are text-only by design (showIcon: false); the Icon still
// feeds accessibility.
const actions: Record<string, Action[]> = {
  home: [
    { Icon: ArrowDownToLine, label: "Deposit", showIcon: false },
    { Icon: ArrowUpFromLine, label: "Withdraw", showIcon: false },
  ],
  spend: [{ Icon: Send, label: "Pay", showIcon: false }],
};

export default function Minimal() {
  const [tab, setTab] = useState("home");
  const [last, setLast] = useState("nothing yet");
  return (
    <div style={{ minHeight: "100vh", paddingBottom: "9rem" }}>
      <p data-example-log style={{ padding: "1rem" }}>Last action: {last}</p>
      {/* You own the fixed shell: bottom edge + safe-area inset. */}
      <div style={{ position: "fixed", insetInline: 0, bottom: "env(safe-area-inset-bottom, 0)", pointerEvents: "none" }}>
        <NavigationBar
          tabs={tabs}
          contextualActions={actions}
          activeTab={tab}
          onTabChange={setTab}
          onActionClick={(label, onTab) => setLast(`${label} on ${onTab}`)}
          showUtilityButton={false}
        />
      </div>
    </div>
  );
}
```

`02-collapse-on-scroll.tsx`:

```tsx
/**
 * 02 — Collapse on scroll. useCollapseOnScroll owns the hysteresis; you
 * feed it your scroll container's onScroll and pass isCollapsed through.
 */
import { useState } from "react";
import { Home, CreditCard, ArrowDownToLine, Send } from "lucide-react";
import {
  NavigationBar,
  useCollapseOnScroll,
  type Tab,
  type Action,
} from "@/components/navigation-bar";

const tabs: Tab[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "spend", label: "Spend", Icon: CreditCard },
];
const actions: Record<string, Action[]> = {
  home: [{ Icon: ArrowDownToLine, label: "Deposit", showIcon: false }],
  spend: [{ Icon: Send, label: "Pay", showIcon: false }],
};

export default function CollapseOnScroll() {
  const [tab, setTab] = useState("home");
  // overlayOpen: true while any sheet/search/assistant is up — none here.
  const { isCollapsed, onScroll, expand } = useCollapseOnScroll({ overlayOpen: false });
  return (
    <div
      data-example-scroll
      onScroll={onScroll}
      style={{ height: "100vh", overflowY: "auto" }}
    >
      <div style={{ height: "220vh", padding: "1rem" }}>Scroll me.</div>
      <div style={{ position: "fixed", insetInline: 0, bottom: "env(safe-area-inset-bottom, 0)", pointerEvents: "none" }}>
        <NavigationBar
          tabs={tabs}
          contextualActions={actions}
          activeTab={tab}
          onTabChange={setTab}
          isCollapsed={isCollapsed}
          onCollapsedClick={expand}
          showUtilityButton={false}
        />
      </div>
    </div>
  );
}
```

`03-search.tsx`:

```tsx
/**
 * 03 — Search. The bar itself morphs into the field; no extra component.
 * The utility button on this tab is Search; onUtilityClick opens it.
 */
import { useState } from "react";
import { TrendingUp, ArrowDownLeft, Search } from "lucide-react";
import { NavigationBar, type Tab, type Action, type UtilityAction } from "@/components/navigation-bar";

const tabs: Tab[] = [{ id: "trade", label: "Trade", Icon: TrendingUp }];
const actions: Record<string, Action[]> = {
  trade: [{ Icon: ArrowDownLeft, label: "Buy", showIcon: false }],
};
const search: UtilityAction = { Icon: Search, label: "Search" };

export default function SearchExample() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  return (
    <div style={{ minHeight: "100vh", paddingBottom: "9rem" }}>
      <p data-example-log style={{ padding: "1rem" }}>
        typing: {query} · submitted: {submitted}
      </p>
      <div style={{ position: "fixed", insetInline: 0, bottom: "env(safe-area-inset-bottom, 0)", pointerEvents: "none" }}>
        <NavigationBar
          tabs={tabs}
          contextualActions={actions}
          activeTab="trade"
          utilityAction={search}
          onUtilityClick={() => setOpen(true)}
          isSearchOpen={open}
          onSearchChange={setQuery}
          onSearchSubmit={q => { setSubmitted(q); setOpen(false); }}
          onSearchClose={() => setOpen(false)}
          searchPlaceholder="Search markets…"
        />
      </div>
    </div>
  );
}
```

`04-workflow-sheet.tsx`:

```tsx
/**
 * 04 — Workflow sheet. Tapping an action clears the bar out
 * (isSheetOpen), you wait sheetClearoutMs(), measure the bar
 * (actionBarRef), and mount a BottomSheet from that rect. On close the
 * sheet contracts back and you drop the clear-out in onExitComplete.
 */
import { useCallback, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Home, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { NavigationBar, sheetClearoutMs, type Tab, type Action } from "@/components/navigation-bar";
import { BottomSheet, type SheetOrigin } from "@/components/bottom-sheet";

const tabs: Tab[] = [{ id: "home", label: "Home", Icon: Home }];
const actions: Record<string, Action[]> = {
  home: [
    { Icon: ArrowDownToLine, label: "Deposit", showIcon: false },
    { Icon: ArrowUpFromLine, label: "Withdraw", showIcon: false },
  ],
};

export default function WorkflowSheet() {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<string | null>(null); // engaged chip
  const [clearing, setClearing] = useState(false);           // isSheetOpen
  const [sheet, setSheet] = useState<{ title: string; origin: SheetOrigin } | null>(null);

  const launch = useCallback((label: string) => {
    setActive(label);
    setClearing(true);
    window.setTimeout(() => {
      const r = barRef.current?.getBoundingClientRect();
      if (!r) return;
      setSheet({ title: label, origin: { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom } });
    }, sheetClearoutMs());
  }, []);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: "9rem" }}>
      <div style={{ position: "fixed", insetInline: 0, bottom: "env(safe-area-inset-bottom, 0)", pointerEvents: "none", zIndex: 50 }}>
        <NavigationBar
          tabs={tabs}
          contextualActions={actions}
          activeTab="home"
          activeAction={active}
          actionBarRef={barRef}
          isSheetOpen={clearing}
          onActionClick={launch}
          showUtilityButton={false}
        />
      </div>
      <AnimatePresence onExitComplete={() => { setActive(null); setClearing(false); }}>
        {sheet && (
          <BottomSheet
            key={sheet.title}
            origin={sheet.origin}
            title={sheet.title}
            ariaLabel={`${sheet.title} workflow`}
            onClose={() => setSheet(null)}
            height="auto"
          >
            <p style={{ padding: "1rem 0" }}>Your {sheet.title.toLowerCase()} form goes here.</p>
          </BottomSheet>
        )}
      </AnimatePresence>
    </div>
  );
}
```

`05-assistant.tsx`:

```tsx
/**
 * 05 — Assistant. The AI utility morphs the bar into a chat input; you
 * own the transcript, so it survives close and reopen.
 */
import { useState } from "react";
import { Home, ArrowDownToLine, Sparkles } from "lucide-react";
import {
  NavigationBar,
  type Tab,
  type Action,
  type UtilityAction,
  type AssistantMessage,
} from "@/components/navigation-bar";

const tabs: Tab[] = [{ id: "home", label: "Home", Icon: Home }];
const actions: Record<string, Action[]> = {
  home: [{ Icon: ArrowDownToLine, label: "Deposit", showIcon: false }],
};
const ai: UtilityAction = { Icon: Sparkles, label: "AI" };

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  return (
    <div style={{ minHeight: "100vh", paddingBottom: "9rem" }}>
      <div style={{ position: "fixed", insetInline: 0, bottom: "env(safe-area-inset-bottom, 0)", pointerEvents: "none" }}>
        <NavigationBar
          tabs={tabs}
          contextualActions={actions}
          activeTab="home"
          utilityAction={ai}
          onUtilityClick={() => setOpen(true)}
          isAssistantOpen={open}
          onAssistantClose={() => setOpen(false)}
          assistantMessages={messages}
          onAssistantSubmit={text =>
            setMessages(m => [
              ...m,
              { id: `u${m.length}`, role: "user", text },
              { id: `a${m.length}`, role: "assistant", text: `You said: ${text}` },
            ])
          }
          assistantPlaceholder="Ask anything…"
        />
      </div>
    </div>
  );
}
```

Before writing 05, confirm the `AssistantMessage` shape:

```bash
grep -n "export type AssistantMessage" -A 6 client/src/components/navigation-bar/NavigationBar.tsx
```

Adjust the object literals to match exactly (field names and the role union). If `id` is not a field, drop it.

`client/src/examples/navigation-bar/index.ts`:

```ts
import type { ComponentType } from "react";
import Minimal from "./01-minimal";
import CollapseOnScroll from "./02-collapse-on-scroll";
import SearchExample from "./03-search";
import WorkflowSheet from "./04-workflow-sheet";
import Assistant from "./05-assistant";
import minimalSrc from "./01-minimal.tsx?raw";
import collapseSrc from "./02-collapse-on-scroll.tsx?raw";
import searchSrc from "./03-search.tsx?raw";
import sheetSrc from "./04-workflow-sheet.tsx?raw";
import assistantSrc from "./05-assistant.tsx?raw";

export type LabExample = {
  id: string;
  title: string;
  source: string;
  Component: ComponentType;
};

export const navigationBarExamples: LabExample[] = [
  { id: "01-minimal", title: "01 · Minimal", source: minimalSrc, Component: Minimal },
  { id: "02-collapse-on-scroll", title: "02 · Collapse on scroll", source: collapseSrc, Component: CollapseOnScroll },
  { id: "03-search", title: "03 · Search", source: searchSrc, Component: SearchExample },
  { id: "04-workflow-sheet", title: "04 · Workflow sheet", source: sheetSrc, Component: WorkflowSheet },
  { id: "05-assistant", title: "05 · Assistant", source: assistantSrc, Component: Assistant },
];
```

- [ ] **Step 4: Register and route**

`registry.tsx`: import `{ navigationBarExamples, type LabExample }` from `@/examples/navigation-bar`; add `examples?: LabExample[];` to `LabComponent`; add `examples: navigationBarExamples,` to the navigation-bar entry (next to `usage`).

`Showcase.tsx`, in the bare-route branch:

```tsx
  const { Stage } = component;
  const exampleId = useMemo(
    () => new URLSearchParams(window.location.search).get("example"),
    []
  );
  const Example = component.examples?.find(e => e.id === exampleId)?.Component;

  // Truly bare: iframe embeds, recording mode (H), and example routes.
  if (Example) {
    return (
      <div className="lab-bare">
        <Example />
      </div>
    );
  }
  if (embedded || chromeHidden) {
    return (
      <div className="lab-bare">
        <Stage />
      </div>
    );
  }
```

`CodePanels` gets the examples above the usage panel:

```tsx
function CodePanels({ component }: { component: LabComponent }) {
  return (
    <div className="lab-code-stack">
      <div className="lab-code">
        <div className="lab-code__head">
          <span>{component.sourceFile}</span>
          <CopyChip text={component.source} />
        </div>
        <pre className="lab-code__pre">{component.source}</pre>
      </div>
      {component.examples?.map(ex => (
        <div className="lab-code" key={ex.id}>
          <div className="lab-code__head">
            <span>
              {ex.title}
              <a
                className="lab-code__open"
                href={`/${component.slug}?example=${ex.id}`}
                target="_blank"
                rel="noreferrer"
              >
                open ↗
              </a>
            </span>
            <CopyChip text={ex.source} />
          </div>
          <pre className="lab-code__pre">{ex.source}</pre>
        </div>
      ))}
      <div className="lab-code">
        <div className="lab-code__head">
          <span>usage</span>
          <CopyChip text={component.usage} />
        </div>
        <pre className="lab-code__pre">{component.usage}</pre>
      </div>
    </div>
  );
}
```

Append to `Showcase.css`:

```css
.lab-code__open {
  margin-left: 0.6rem;
  font-size: 12px;
  color: var(--lab-muted, inherit);
  text-decoration: none;
}
.lab-code__open:hover {
  text-decoration: underline;
}
```

- [ ] **Step 5: Typecheck, run the examples test, run the suite**

`npm run -s check && echo TYPES-OK` → `TYPES-OK`. Fix any prop-type mismatch in the examples by reading the prop, never by casting.

With the server up: `node scripts/a11y/a11y-examples.mjs` → 15 PASS.

Full suite → `exit=0`, no FAIL.

- [ ] **Step 6: Commit**

```bash
git add client/src/examples client/src/lab/registry.tsx client/src/lab/Showcase.tsx \
  client/src/lab/Showcase.css scripts/a11y/a11y-examples.mjs
git commit -m "feat: five runnable NavigationBar examples, on the Code tab and as bare routes

Typechecked because they live under client/src; each route is driven
by a11y-examples.mjs.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: README, usage shrink, handoff

**Files:**
- Create: `client/src/components/navigation-bar/README.md`
- Modify: `client/src/lab/registry.tsx` (`navigationBarUsage` ~78–222; the `dependencies` array ~356–365)
- Modify: `HANDOFF.md` (top recap; NEXT UP item 0)
- Test: `npm run check`, full suite

- [ ] **Step 1: Generate the variable block**

```bash
node scripts/registry/collect-vars.mjs > /tmp/vars.css; wc -l /tmp/vars.css
```

Expected: exit 0, a `:root { … }` block followed by a `.dark { … }` block.

- [ ] **Step 2: Write the README**

`client/src/components/navigation-bar/README.md`, sections in this order. Paste `/tmp/vars.css` verbatim into the "CSS variables" fenced block. Move the three contract comments (styling, keyboard, utility routing) out of `navigationBarUsage` in `registry.tsx` into the sections named below — same text, formatted as prose.

```markdown
# NavigationBar

A glass bottom bar where navigation, actions, and filters share one
surface: a tab switcher that blooms into a menu, a centre pill carrying
per-tab actions, an in-place filter expansion, and one accent utility
button that can morph the bar into search or an assistant chat. Every
transition is choreographed; nothing pops.

## Install

Copy these files into your project (paths are the lab's; put them
wherever you keep components):

- `components/navigation-bar/` — the whole folder (`NavigationBar.tsx`,
  `navigation-bar.css`, `useCollapseOnScroll.ts`, `lib.ts`, `index.ts`)
- `theme/glass.css` — three shared glass primitives; load it before the
  component's CSS

npm dependencies: `motion`, `lucide-react`, `clsx`, `tailwind-merge`.
Tailwind v4 is required (the bar uses utilities inline).

## CSS variables

The bar reads these custom properties. Paste into your global CSS and
adjust, or remap them to your own design tokens. This block is
generated by `scripts/registry/collect-vars.mjs`; do not hand-edit it.

```css
<paste /tmp/vars.css here>
```

## Minimal usage

<paste the body of client/src/examples/navigation-bar/01-minimal.tsx>

More: `examples/navigation-bar/02–05` cover scroll-collapse, search, the
workflow sheet, and the assistant. Each opens live at
`/navigation-bar?example=<id>` on the lab site.

## Sizing

`size="compact" | "default" | "large"` — 48 / 56 / 64px circles with
matching chip heights and label sizes. Three presets, not a number: the
choreography was verified at these and nowhere else.

The bar is designed for a 360–512px cluster and stays centred on wider
screens. You own the fixed shell (`position: fixed; inset-inline: 0;
bottom: env(safe-area-inset-bottom)`), the `pointer-events: none`
wrapper (the bar re-enables pointer events on its controls), and the
page's bottom padding so content is not hidden behind the bar. Never
scale the bar with `zoom` or `transform`: a transformed ancestor
becomes the containing block for `position: fixed` and every surface
that grows out of the bar lands in the wrong place.

## Styling contract

<the styling comment from navigationBarUsage, as prose>

## Keyboard contract

<the keyboard comment from navigationBarUsage, as prose>

## Utility surfaces

<the utility-routing comment from navigationBarUsage, as prose;
BottomSheet and UtilityModal are optional companions with their own
pages>

## What you own

- The fixed shell and safe-area inset (above).
- Scroll wiring: `useCollapseOnScroll` (example 02).
- The clear-out handshake for sheets: flip `isSheetOpen`, wait
  `sheetClearoutMs(tempo)`, measure `actionBarRef` / `utilityButtonRef`,
  mount your surface, drop `isSheetOpen` in `onExitComplete` (example 04).
- The assistant transcript (example 05).
```

- [ ] **Step 3: Shrink `navigationBarUsage`**

Replace the string in `registry.tsx` with the prop-table-plus-pointer form: keep the import block, `tabs`, `contextualActions`, `filterOptions`, `utilityActions`, and the `<NavigationBar … />` element with its inline comments; delete the three trailing `/* … */` blocks (now in the README) and end with:

```
/*
 * Runnable examples (Code tab, or /navigation-bar?example=<id>):
 *   01-minimal · 02-collapse-on-scroll · 03-search · 04-workflow-sheet
 *   · 05-assistant. Install, CSS variables, sizing, and the styling /
 * keyboard / utility contracts: client/src/components/navigation-bar/README.md
 */
```

Update the `dependencies` array to the real list:

```ts
    dependencies: [
      "react",
      "motion",
      "lucide-react",
      "clsx + tailwind-merge (cn, copied into the folder)",
      "theme/theme.css (tokens — see README for the generated list)",
      "theme/glass.css (shared glass primitives)",
      "optional: @/components/bottom-sheet, @/components/utility-modal (companion surfaces)",
    ],
```

- [ ] **Step 4: Handoff**

Add a "Latest session" recap at the top of `HANDOFF.md` listing: the CSS split (`glass.css`, `navigation-bar.css`, theme.css tokens-only), `lib.ts`, the collector + drift test, `size` presets + `a11y-sizes.mjs`, `useCollapseOnScroll` + `a11y-collapse.mjs`, the five examples + `a11y-examples.mjs` + the `?example=` route, the README, and the new suite count. In NEXT UP, mark item 0 done and leave one line: "Optional: shadcn registry manifest (spec §7) — decide now that the folder is clean."

- [ ] **Step 5: Typecheck, run the suite, commit**

`npm run -s check && echo TYPES-OK` → `TYPES-OK`. Full suite → `exit=0`.

```bash
git add client/src/components/navigation-bar/README.md client/src/lab/registry.tsx HANDOFF.md
git commit -m "docs: NavigationBar README (install, variables, sizing, contracts); usage shrinks to a pointer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Merge

**Files:** none new.

- [ ] **Step 1: Final verification on the branch**

`npm run -s check && echo TYPES-OK`; full suite with PASS count recorded; `npm run build` succeeds.

- [ ] **Step 2: Hand off for merge**

Use `superpowers:finishing-a-development-branch`. The branch is `worktree-nav-bar-drop-in`; merging to `main` deploys to Railway. Report the final PASS count and the three `scripts/a11y/shots/size-*-rest.png` screenshots in the summary.
