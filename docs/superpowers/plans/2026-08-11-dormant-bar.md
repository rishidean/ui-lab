# Dormant Until Engaged — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The NavigationBar sits desaturated at rest — its glass drains colour from the page beneath it and its tab icon goes neutral — and returns to today's appearance the moment any bar surface is engaged.

**Architecture:** One unitless scalar, `--nav-engage` (0 rest → 1 engaged), is animated by framer on two elements. All colour maths lives in `theme/theme.css`, derived from that scalar. Framer cannot interpolate `var()` strings in this codebase, which is why a scalar drives CSS rather than the component animating colours directly.

**Tech Stack:** React 19, TypeScript, motion/react (framer) 12, Tailwind 4, Vite 7, pnpm. Verification is headless Playwright (`node scripts/a11y/<file>.mjs` against a production build served on `:4999`).

## Global Constraints

- **Engaged appearance is unchanged.** `--nav-engage: 1` must reproduce today's bar exactly — `saturate(1.45)` and `color: var(--accent-700)`. Any visual diff in an engaged state is a bug.
- **The committed filter chip's wash never moves.** It is `--accent-700` at 9% alpha and is not part of either channel.
- **Scroll-collapsed counts as REST**, not engaged.
- **Reduced motion:** the state still changes, at duration 0 (house convention — `dur()`/`del()` already return 0 under `prefersReducedMotion`).
- **Timing:** engage `DUR.direct` (0.2) on `EASE_OUT`, no delay. Rest `DUR.expand` (0.2) on `EASE_IN`, delay `0.08`. All wrapped in the file's existing `dur()` / `del()` helpers so `TEMPO` applies.
- **Never hardcode the token values** in the component. The component only ever writes `--nav-engage`.
- Verify against a production build: `pnpm build`, then serve with `PORT=4999 nohup node dist/index.js > /tmp/server.log 2>&1 &`. `setsid` does not exist on this machine; `pkill` in a compound command kills the command itself.
- Run `pnpm check` (tsc) and `npx prettier --write <touched files>` before each commit. Do NOT run `pnpm format` — it rewrites `pnpm-lock.yaml` and unrelated committed docs.

---

### Task 1: Token plumbing in theme.css

Adds the scalar, the dormant ink, and rewires the two CSS sites that consume them. No component changes — after this task the bar looks exactly as it does today, because `--nav-engage` defaults to 1.

**Files:**
- Modify: `client/src/theme/theme.css` (`:root` block ~line 24, `.dark` block ~line 104, `.glass-nav` ~line 162)
- Test: `scripts/a11y/a11y-bar-dormancy.mjs` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom property `--nav-engage` (unitless number, default `1`, inherited); `--accent-dormant` (a colour, per preset); `.glass-nav` saturation derived from `--nav-engage`; a `.nav-tab-ink` class applying the derived icon colour.

- [ ] **Step 1: Write the failing test**

Create `scripts/a11y/a11y-bar-dormancy.mjs`:

```js
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4999/navigation-bar?embed=1", {
  waitUntil: "networkidle",
});
await page.waitForTimeout(900);

const results = [];

// The CSS contract: one scalar drives glass saturation and icon ink.
// Probed on a detached node carrying the same classes, so this asserts
// the stylesheet itself rather than whatever state the bar is in.
const contract = await page.evaluate(() => {
  const el = document.createElement("div");
  el.className = "glass-nav nav-tab-ink";
  document.body.appendChild(el);
  const at = v => {
    el.style.setProperty("--nav-engage", String(v));
    const cs = getComputedStyle(el);
    return { filter: cs.backdropFilter, color: cs.color };
  };
  const rows = { rest: at(0), mid: at(0.5), engaged: at(1) };
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent-700")
    .trim();
  el.remove();
  return { ...rows, accent };
});

results.push(
  [
    "glass saturation is 1.45 at engage=1 (today's appearance)",
    /saturate\(1\.45\)/.test(contract.engaged.filter),
    contract.engaged,
  ],
  [
    "glass saturation drops to 0.3 at engage=0",
    /saturate\(0\.3\)/.test(contract.rest.filter),
    contract.rest,
  ],
  [
    "glass saturation interpolates at engage=0.5",
    /saturate\(0\.875\)/.test(contract.mid.filter),
    contract.mid,
  ],
  [
    "icon ink has zero chroma at engage=0",
    (() => {
      const m = contract.rest.color.match(/oklch\(([\d.]+)\s+([\d.]+)/);
      return m ? Number(m[2]) < 0.001 : false;
    })(),
    contract.rest,
  ],
  [
    "dormant ink keeps the accent's lightness (contrast preserved)",
    (() => {
      const rest = contract.rest.color.match(/oklch\(([\d.]+)/);
      const eng = contract.engaged.color.match(/oklch\(([\d.]+)/);
      if (!rest || !eng) return false;
      return Math.abs(Number(rest[1]) - Number(eng[1])) < 0.005;
    })(),
    { rest: contract.rest.color, engaged: contract.engaged.color },
  ]
);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm build && node scripts/a11y/a11y-bar-dormancy.mjs
```

Expected: FAIL on every saturation assertion — `.glass-nav` still has the literal `saturate(1.45)`, so `--nav-engage` has no effect, and `.nav-tab-ink` does not exist so `color` resolves to the inherited default.

- [ ] **Step 3: Add the tokens**

In `client/src/theme/theme.css`, inside the `:root` block near `--accent-700: #c22a75;`:

```css
  /* Engagement scalar: 0 = the bar is at rest and drains colour, 1 = it
     is being operated and looks exactly as it always has. Defaults to 1
     so .glass-nav stays correct for any consumer that never animates it.
     NavigationBar writes this; nothing else should. */
  --nav-engage: 1;
  /* The tab icon's resting ink: the accent's own lightness with the
     chroma removed, so going neutral cannot change its contrast against
     the circle. First declaration is the fallback for engines without
     relative colour syntax. */
  --accent-dormant: #6d6a6b;
  --accent-dormant: oklch(from var(--accent-700) l 0 h);
```

Add the same two declarations inside the `.dark` block near `--accent-700: #ff5fa8;` — `--accent-dormant` re-derives from the dark accent automatically, and the fallback hex differs:

```css
  --nav-engage: 1;
  --accent-dormant: #a9a7a8;
  --accent-dormant: oklch(from var(--accent-700) l 0 h);
```

- [ ] **Step 4: Derive both channels from the scalar**

Replace the `backdrop-filter` pair in `.glass-nav` (both the standard and `-webkit-` lines):

```css
  backdrop-filter: saturate(calc(0.3 + 1.15 * var(--nav-engage)))
    blur(var(--blur-lg));
  -webkit-backdrop-filter: saturate(calc(0.3 + 1.15 * var(--nav-engage)))
    blur(var(--blur-lg));
```

`0.3 + 1.15 × 1 = 1.45`, so engaged is byte-identical to today.

Then add the icon-ink class immediately after the `.glass-nav` rule:

```css
/* The tab glyph's ink, mixed from the same engagement scalar as the
   glass so the two channels can never drift apart. */
.nav-tab-ink {
  color: color-mix(
    in oklab,
    var(--accent-700) calc(var(--nav-engage) * 100%),
    var(--accent-dormant)
  );
}
```

- [ ] **Step 5: Apply the ink class to the tab glyph**

In `client/src/components/navigation-bar/NavigationBar.tsx` at the NavigationButton (~line 1582), add `nav-tab-ink` to the className and delete the inline colour that would override it:

```tsx
                className="nav-tab-ink nav-circle-trigger absolute inset-[2px] rounded-full flex items-center justify-center transition-colors"
```

Remove the `style={{ color: "var(--accent-700)" }}` line entirely. At `--nav-engage: 1` `color-mix` resolves to 100% `--accent-700`, so this is not a visual change.

- [ ] **Step 6: Run the test to verify it passes**

```bash
pnpm build && node scripts/a11y/a11y-bar-dormancy.mjs
```

Expected: all five PASS.

- [ ] **Step 7: Confirm nothing moved yet**

```bash
pnpm check && node scripts/a11y/a11y-contrast.mjs && node scripts/a11y/a11y-menu.mjs
```

Expected: tsc silent, both suites exit 0. The bar still renders identically — only the plumbing changed.

- [ ] **Step 8: Commit**

```bash
npx prettier --write client/src/theme/theme.css client/src/components/navigation-bar/NavigationBar.tsx scripts/a11y/a11y-bar-dormancy.mjs
git add client/src/theme/theme.css client/src/components/navigation-bar/NavigationBar.tsx scripts/a11y/a11y-bar-dormancy.mjs
git commit -m "feat: derive nav glass saturation and tab ink from a --nav-engage scalar"
```

---

### Task 2: Drive the scalar from bar state

**Files:**
- Modify: `client/src/components/navigation-bar/NavigationBar.tsx` (derive `isBarEngaged` next to `isBarSurrendered` ~line 402; convert the controls row ~line 1494 to a `motion.div` that animates the scalar)
- Test: `scripts/a11y/a11y-bar-dormancy.mjs` (extend)

**Interfaces:**
- Consumes: `--nav-engage` and `.nav-tab-ink` from Task 1.
- Produces: `const isBarEngaged: boolean` in `NavigationBar`.

- [ ] **Step 1: Write the failing test**

Append to `scripts/a11y/a11y-bar-dormancy.mjs`, immediately before the `for (const [name, pass, detail] …)` reporting loop:

```js
// The state machine: --nav-engage is 0 only at true rest.
// Read it off the pill AND the tab glyph — they inherit from the same
// animated ancestor, so if these two ever disagree the cascade broke.
const engageOf = () =>
  page.evaluate(() => {
    const read = sel => {
      const el = document.querySelector(sel);
      return el
        ? Number(getComputedStyle(el).getPropertyValue("--nav-engage"))
        : null;
    };
    const pill = read(".glass-nav");
    const ink = read(".nav-tab-ink");
    if (pill === null || ink === null) return null;
    if (Math.abs(pill - ink) > 0.001)
      throw new Error(`channels drifted: pill=${pill} ink=${ink}`);
    return pill;
  });
const settle = () => page.waitForTimeout(900);

await settle();
results.push(["at rest, --nav-engage is 0", (await engageOf()) < 0.02, {
  value: await engageOf(),
}]);

// Menu open — engaged.
await page.locator(".nav-circle-trigger").first().click();
await settle();
results.push(["menu open engages the bar", (await engageOf()) > 0.98, {
  value: await engageOf(),
}]);

// Escape back to rest.
await page.keyboard.press("Escape");
await settle();
results.push(["menu close returns to rest", (await engageOf()) < 0.02, {
  value: await engageOf(),
}]);

// Search (Trade tab's utility) — engaged.
await page.locator(".nav-circle-trigger").first().click();
await settle();
await page.locator("[role=menuitemradio]", { hasText: "Trade" }).click();
await settle();
await page.locator('button[aria-label="Search"]').click();
await settle();
results.push(["search engages the bar", (await engageOf()) > 0.98, {
  value: await engageOf(),
}]);
await page.keyboard.press("Escape");
await settle();

// Scroll-collapsed counts as REST, per the spec.
await page.evaluate(() => window.scrollTo(0, 600));
await page.waitForTimeout(1200);
results.push(["scroll-collapsed reads as rest", (await engageOf()) < 0.02, {
  value: await engageOf(),
}]);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1200);

// The committed filter chip's wash must never move.
await page.locator(".nav-circle-trigger").first().click();
await settle();
await page.locator("[role=menuitemradio]", { hasText: "Transactions" }).click();
await settle();
const chipWash = () =>
  page.evaluate(() => {
    const chip = [...document.querySelectorAll(".nav-action-chip")].find(
      c => getComputedStyle(c).backgroundColor !== "rgba(0, 0, 0, 0)"
    );
    return chip ? getComputedStyle(chip).backgroundColor : null;
  });
const washAtRest = await chipWash();
await page.locator(".nav-circle-trigger").first().click();
await settle();
const washEngaged = await chipWash();
await page.keyboard.press("Escape");
await settle();
results.push([
  "committed chip wash is identical at rest and engaged",
  washAtRest === washEngaged,
  { washAtRest, washEngaged },
]);
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm build && node scripts/a11y/a11y-bar-dormancy.mjs
```

Expected: the rest assertions FAIL with `value: 1` — nothing writes `--nav-engage` yet, so it sits at its `1` default in every state.

- [ ] **Step 3: Derive `isBarEngaged`**

In `NavigationBar.tsx`, directly beneath `isBarSurrendered` (~line 402):

```tsx
  // Dormancy: the bar drains its colour when it is chrome and takes it
  // back when it is the thing being operated. Every term here is a
  // state the bar already tracks, so this can never disagree with the
  // choreography. Scroll-collapse is deliberately NOT engagement — a
  // collapsed bar is the definition of getting out of the way.
  const isBarEngaged =
    isBarSurrendered ||
    isNavigationMenuOpen ||
    isFilterExpanded ||
    activeAction !== null;
```

If `activeAction` is declared below this point, move the `isBarEngaged` declaration to just after it rather than hoisting state — check the actual order before editing.

- [ ] **Step 4: Animate the scalar once, on the shared ancestor**

The pill and the left circle are siblings, but custom properties inherit — so the scalar is animated ONCE on the row that contains both, and both consumers pick it up. This is why the two channels cannot drift apart: there is only one animated value in the tree.

The row is the plain `<div className="flex items-center gap-2 w-full px-1 relative z-10">` that wraps the LEFT / CENTER / RIGHT groups (~line 1494, directly inside `<div className="relative z-10 flex items-center gap-3 max-w-lg mx-auto">`). Convert it to a `motion.div`:

```tsx
        <motion.div
          className="flex items-center gap-2 w-full px-1 relative z-10"
          // Dormancy is one inherited scalar: the pill's glass and the
          // tab glyph's ink both derive from it in theme.css, so they
          // can never fall out of step. Eager to engage, lazy to leave —
          // the delay on the return also debounces travel between two
          // engaged states, so closing the menu to open the filter
          // never flashes dormant in between.
          animate={{ "--nav-engage": isBarEngaged ? 1 : 0 }}
          transition={
            isBarEngaged
              ? { duration: dur(DUR.direct), ease: EASE_OUT }
              : {
                  duration: dur(DUR.expand),
                  ease: EASE_IN,
                  delay: del(0.08),
                }
          }
        >
```

Close it with `</motion.div>` instead of `</div>` — find the matching closing tag for that element and change it. Do not touch the outer `max-w-lg` wrapper.

TypeScript note: framer types `animate` as `TargetAndTransition`, which accepts CSS custom property keys as strings. If tsc rejects the `"--nav-engage"` key, cast the object `as TargetAndTransition` (imported from `motion/react`) rather than reaching for `any`.

Verify the closing tag matched correctly before moving on:

```bash
pnpm check
```

Expected: silent. A JSX mismatch here surfaces as a tsc parse error.

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm build && node scripts/a11y/a11y-bar-dormancy.mjs
```

Expected: every assertion PASS, including the chip-wash equality.

- [ ] **Step 6: Run the full suite for regressions**

```bash
pnpm check && pnpm test:a11y
```

Expected: tsc silent; 99 existing assertions still pass, 0 failures.

- [ ] **Step 7: Commit**

```bash
npx prettier --write client/src/components/navigation-bar/NavigationBar.tsx scripts/a11y/a11y-bar-dormancy.mjs
git add client/src/components/navigation-bar/NavigationBar.tsx scripts/a11y/a11y-bar-dormancy.mjs
git commit -m "feat: bar goes dormant at rest, engages on any active surface"
```

---

### Task 3: Contrast coverage for the dormant ink

**Files:**
- Modify: `scripts/a11y/a11y-contrast.mjs` (`TOKEN_NAMES` ~line 98, `runPreset` ~line 122)

**Interfaces:**
- Consumes: `--accent-dormant` from Task 1.
- Produces: two new assertions (one per preset).

- [ ] **Step 1: Write the failing assertion**

Add `"--accent-dormant"` to the `TOKEN_NAMES` array, then inside `runPreset`, beside the other `check(...)` calls:

```js
  // The dormant tab ink sits on the nav circle's fill. It is the accent
  // with chroma stripped at identical lightness, so this ratio must
  // track the accent's own — if it ever diverges, the derivation broke.
  const accentDormantRgb = resolveOverBackdrop(t["--accent-dormant"], canvasRgb);
  check("dormant tab ink on canvas", accentDormantRgb, canvasRgb, 3.0);
```

- [ ] **Step 2: Run it**

```bash
node scripts/a11y/a11y-contrast.mjs
```

Expected: PASS in both presets. If either FAILS, the fallback hex is being used instead of the derived value — check that the browser supports relative colour syntax before adjusting the threshold.

- [ ] **Step 3: Commit**

```bash
npx prettier --write scripts/a11y/a11y-contrast.mjs
git add scripts/a11y/a11y-contrast.mjs
git commit -m "test: assert dormant tab ink contrast in both presets"
```

---

### Task 4: Real-Chrome raster check and docs

Headless Chromium software-rasterizes and cannot reproduce compositing artifacts. This bar is permanently composited and already carries a re-raster nudge for a related bug, so the animated `backdrop-filter` needs eyes in a real GPU-backed browser.

**Files:**
- Modify: `NavigationBarOverview.md` (motion-design section), `client/src/lab/registry.tsx` (`tryIt` array for the navigation-bar entry), `HANDOFF.md` (gotchas, only if the raster check finds something)

**Interfaces:**
- Consumes: the finished behaviour from Task 2.
- Produces: documentation only.

- [ ] **Step 1: Drive a real Chrome**

Serve the build, then use the `claude-in-chrome` tools (NOT headless Playwright) to open `http://localhost:4999/navigation-bar`, and step through: rest → open the menu → close → open the filter → commit a value → scroll to collapse → scroll back.

Watch specifically for text that stays blurry after a transition settles, and for the glass holding a stale saturation after `--nav-engage` lands. Both are the known failure mode for this surface.

- [ ] **Step 2: If artifacts appear, apply the existing fix pattern**

`repaintPillText()` already exists in the component (~line 1209): it toggles a transparent `text-shadow` for one frame to force a repaint, and is already called from `onAnimationComplete` when `scaleX` lands. Extend that same handler to also fire when `--nav-engage` completes. Do not invent a new mechanism.

If no artifacts appear, skip this step and say so explicitly in the commit message — a negative result is worth recording.

- [ ] **Step 3: Document the behaviour**

In `NavigationBarOverview.md`, add to the motion-design material:

```markdown
### Dormancy

The bar is chrome until you use it. At rest its glass drains saturation
(`saturate(0.3)`), so page colour passing underneath reads gray, and the
tab glyph drops to a neutral ink at the accent's exact lightness. Engage
any surface — menu, filter, search, assistant, a sheet, or a pressed
action — and both return to full colour on a fast ease-out; letting go
returns to dormant more slowly, with a short delay that keeps travel
between two engaged states from flashing gray in between.

A committed filter chip keeps its accent wash in every state: dormancy
never hides state. Scroll-collapse counts as rest — a collapsed bar is
already getting out of your way.

One scalar drives it, `--nav-engage` (0 → 1), with both the glass
saturation and the glyph ink derived from it in `theme/theme.css`. The
component never writes a colour.
```

Add to the `tryIt` array in `registry.tsx` for the navigation-bar entry:

```tsx
      "Leave the bar alone — it desaturates, and the page beneath reads gray through the glass; touch any surface and colour returns",
```

- [ ] **Step 4: Commit**

```bash
npx prettier --write NavigationBarOverview.md client/src/lab/registry.tsx
git add NavigationBarOverview.md client/src/lab/registry.tsx
git commit -m "docs: document bar dormancy"
```

---

## Judging it

The branch exists so this can be judged on screen rather than argued about. After Task 4, capture rest and engaged frames at 390×844 in both presets and put them side by side. If the effect reads as too subtle, the fallback named in the spec is to keep the icon channel and drop the glass channel — that is a two-line revert in `theme.css`, not a redesign. If it reads as too strong, `0.3` is the only number to move.
