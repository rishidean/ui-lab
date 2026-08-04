# Accessibility Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full APG-grade accessibility for NavigationBar, BottomSheet, and UtilityModal — `inert`-based modal containment, initial focus, menu/radiogroup keyboard patterns, complete focus return, and visible focus rings — with zero visual change to the pointer choreography.

**Architecture:** A new `useInertOutside` hook (`client/src/lib/a11y.ts`) gives dialogs native containment by inerting every DOM sibling up the ancestor chain. Composite-widget keyboard logic (menu roving, filter radiogroup) lives in-file in NavigationBar.tsx per the drop-in-first rule. Focus rings are `:focus-visible`-only outline rules in the files that already own each control's styles.

**Tech Stack:** React 19, motion/react, Tailwind 4 + component CSS, Vite 7, pnpm. Verification via `pnpm check`/`pnpm build` and headless Playwright scripts in `/tmp/pw` (it has its own package.json with playwright installed) against the built server on :4999.

**Spec:** `docs/superpowers/specs/2026-08-04-accessibility-pass-design.md`

## Global Constraints

- No new npm dependencies. No changes to choreography timings, easings, or geometry — frame captures must stay pixel-identical for pointer flows.
- Focus rings use `outline` (never border/box-size changes) and fire on `:focus-visible` only.
- Drop-in-first: keyboard/roving logic for NavigationBar stays inside NavigationBar.tsx; only `client/src/lib/a11y.ts` is shared (a documented file dependency, like theme.css).
- Registry (`client/src/lab/registry.tsx`) stays in sync with behavior changes.
- All programmatic `.focus()` calls pass `{ preventScroll: true }`.
- Commit trailer on every commit: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Verification loop per task: `pnpm check && pnpm build`, then `pkill -f "node dist/index.js"` (alone — it exits 144 inside compound commands), then `(PORT=4999 setsid nohup node dist/index.js > /tmp/server.log 2>&1 < /dev/null &)`, then `node /tmp/pw/<script>.mjs`. Write scripts with the Write tool (heredocs fail silently).
- Demo data facts used by test scripts: tabs Home/Spend/Trade/Transactions; utility per tab = AI/Scan/Search/Export; Transactions has the filter chip (options Pending/Complete/Scheduled); demo route is `/navigation-bar`; the bar lives in `.navigation-demo__nav-shell`.
- Announcements (spec §7) are ALREADY implemented — stage sets `lastAction` ("X tab selected", "X filter selected") into an `aria-live="polite"` region. No task needed; final sweep just confirms it still renders.

---

### Task 1: `useInertOutside` hook + BottomSheet containment and initial focus

**Files:**
- Create: `client/src/lib/a11y.ts`
- Modify: `client/src/components/bottom-sheet/BottomSheet.tsx` (scrim ~line 159, dialog ~line 173)
- Modify: `client/src/components/bottom-sheet/BottomSheet.css` (add `.bottom-sheet:focus` rule)
- Test: `/tmp/pw/a11y-sheet.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `useInertOutside(active: boolean, ...keepRefs: React.RefObject<HTMLElement | null>[]): void` exported from `@/lib/a11y` — Task 2 imports it.

- [ ] **Step 1: Write the hook**

```ts
// client/src/lib/a11y.ts
/**
 * Shared a11y helpers for Rishi's UI Lab dialogs.
 * Part of Rishi's UI Lab — © 2026 Rishi Dean (rishidean.com)
 * MIT license · github.com/rishidean/ui-lab
 *
 * Copy this file alongside BottomSheet / UtilityModal — it is a file
 * dependency of both, the way theme/theme.css is.
 */
import { useEffect } from "react";
import type React from "react";

/**
 * While `active`, everything in the document EXCEPT the elements in
 * `keepRefs` (and their ancestors/descendants) is made `inert` — native
 * focus containment, click blocking, and screen-reader hiding in one
 * attribute. Climbs from the first kept element to document.body,
 * inerting each level's other siblings. Restores exactly the elements
 * it changed on cleanup (unmount), so an exit choreography stays inert
 * until the surface is gone — consumers return focus in
 * onExitComplete, which fires after cleanup.
 */
export function useInertOutside(
  active: boolean,
  ...keepRefs: React.RefObject<HTMLElement | null>[]
) {
  useEffect(() => {
    if (!active) return;
    const kept = keepRefs
      .map(r => r.current)
      .filter((el): el is HTMLElement => el !== null);
    if (kept.length === 0) return;
    const changed: Element[] = [];
    let node: HTMLElement = kept[0];
    while (node.parentElement && node !== document.body) {
      const parent = node.parentElement;
      for (const sibling of Array.from(parent.children)) {
        if (sibling === node) continue;
        if (kept.some(k => sibling === k || sibling.contains(k))) continue;
        if (sibling.hasAttribute("inert")) continue;
        sibling.setAttribute("inert", "");
        changed.push(sibling);
      }
      node = parent;
    }
    return () => {
      for (const el of changed) el.removeAttribute("inert");
    };
    // keepRefs are stable RefObjects; contents are read inside the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
```

- [ ] **Step 2: Wire BottomSheet**

In `BottomSheet.tsx`:

1. Add imports: `useRef` (extend the existing React import) and `import { useInertOutside } from "@/lib/a11y";`.
2. Inside the component body (near the `opened` state):

```ts
const sheetRef = useRef<HTMLDivElement | null>(null);
const scrimRef = useRef<HTMLButtonElement | null>(null);
// Everything outside the sheet + scrim is inert while mounted — focus
// cannot escape, the page is hidden from screen readers, and the exit
// choreography stays covered until unmount.
useInertOutside(true, sheetRef, scrimRef);
// Initial focus: the dialog itself, so its aria-label announces without
// disturbing the entrance beats (skeleton bodies have no controls).
useEffect(() => {
  sheetRef.current?.focus({ preventScroll: true });
}, []);
```

3. Scrim button (~line 159): add `ref={scrimRef}`, replace `aria-label="Close"` with `aria-hidden="true"` and add `tabIndex={-1}` — it's a pointer-only affordance; Done and Escape are the accessible close paths.
4. Dialog `motion.div` (~line 173): add `ref={sheetRef}` and `tabIndex={-1}`.

- [ ] **Step 3: Suppress the container's focus outline**

Append to `BottomSheet.css`:

```css
/* The dialog container takes initial focus (tabIndex -1) so its label
   announces; it is not an interactive control, so no ring. */
.bottom-sheet:focus {
  outline: none;
}
```

- [ ] **Step 4: Build and serve**

Run: `pnpm check && pnpm build`. Expected: both clean.
Then restart the server (see Global Constraints loop).

- [ ] **Step 5: Write and run the containment test**

Write `/tmp/pw/a11y-sheet.mjs`:

```js
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4999/navigation-bar");
await page.waitForTimeout(1500);

// Open the workflow sheet from an action chip (Home tab → "Deposit").
await page
  .locator(".navigation-demo__nav-shell button", { hasText: "Deposit" })
  .click();
await page.waitForTimeout(1600); // clear-out + entrance

const results = [];
const active = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    return {
      tag: el?.tagName,
      cls: el?.className?.toString().slice(0, 60),
      inDialog: !!el?.closest('[role="dialog"]'),
    };
  });

// 1. Initial focus is the dialog container.
const first = await active();
results.push(["initial focus in dialog", first.inDialog, first]);

// 2. Background is inert.
const inertCount = await page.evaluate(
  () => document.querySelectorAll("[inert]").length
);
results.push(["background inert applied", inertCount > 0, { inertCount }]);

// 3. Tab cycling never escapes the dialog (expand, Done, browser wraps).
let escaped = false;
for (let i = 0; i < 8; i++) {
  await page.keyboard.press("Tab");
  const a = await active();
  if (!a.inDialog && a.tag !== "BODY") escaped = { i, ...a };
}
results.push(["Tab never escapes dialog", !escaped, escaped]);

// 4. Escape closes; inert restored; focus back on a nav control.
await page.keyboard.press("Escape");
await page.waitForTimeout(1400); // exit choreography + onExitComplete
const after = await page.evaluate(() => ({
  inert: document.querySelectorAll("[inert]").length,
  dialogs: document.querySelectorAll('[role="dialog"]').length,
  activeTag: document.activeElement?.tagName,
}));
results.push(["inert restored after close", after.inert === 0, after]);
results.push(["dialog unmounted", after.dialogs === 0, after]);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
```

Run: `node /tmp/pw/a11y-sheet.mjs`. Expected: all PASS. (Run it BEFORE Step 2's
changes if you want to see the failing baseline — focus escapes and inertCount
is 0 on the unmodified build.)

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/a11y.ts client/src/components/bottom-sheet/
git commit -m "feat: inert-based containment + initial focus for BottomSheet"
```

---

### Task 2: UtilityModal containment and initial focus

**Files:**
- Modify: `client/src/components/utility-modal/UtilityModal.tsx` (scrim ~line 111, dialog ~line 125)
- Modify: `client/src/components/utility-modal/UtilityModal.css` (add `.utility-modal:focus` rule)
- Test: `/tmp/pw/a11y-modal.mjs`

**Interfaces:**
- Consumes: `useInertOutside` from `@/lib/a11y` (Task 1).
- Produces: nothing downstream.

- [ ] **Step 1: Wire UtilityModal**

Mirror Task 1 Step 2 exactly, in `UtilityModal.tsx`:

1. Extend the React import with `useRef`; add `import { useInertOutside } from "@/lib/a11y";`.
2. In the component body:

```ts
const modalRef = useRef<HTMLDivElement | null>(null);
const scrimRef = useRef<HTMLButtonElement | null>(null);
useInertOutside(true, modalRef, scrimRef);
useEffect(() => {
  modalRef.current?.focus({ preventScroll: true });
}, []);
```

3. Scrim button: add `ref={scrimRef}`, replace `aria-label="Close"` with `aria-hidden="true"`, add `tabIndex={-1}` (children must supply the accessible close control — ScanView already does).
4. Dialog `motion.div`: add `ref={modalRef}` and `tabIndex={-1}`.
5. Append to `UtilityModal.css`:

```css
.utility-modal:focus {
  outline: none;
}
```

- [ ] **Step 2: Build, serve, test**

`pnpm check && pnpm build`, restart :4999. Write `/tmp/pw/a11y-modal.mjs`:

```js
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4999/navigation-bar");
await page.waitForTimeout(1500);

// Scan lives on the Spend tab: menu → Spend row → utility button.
await page.locator(".navigation-demo__nav-shell button").first().click();
await page.waitForTimeout(1000);
await page
  .locator(".navigation-demo__nav-shell button", { hasText: "Spend" })
  .click();
await page.waitForTimeout(1800);
await page.locator('button[aria-label="Scan"]').click();
await page.waitForTimeout(1600); // clear-out + circle grow

const results = [];
const active = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    return {
      tag: el?.tagName,
      cls: el?.className?.toString().slice(0, 60),
      inDialog: !!el?.closest('[role="dialog"]'),
    };
  });

const first = await active();
results.push(["initial focus in dialog", first.inDialog, first]);

const inertCount = await page.evaluate(
  () => document.querySelectorAll("[inert]").length
);
results.push(["background inert applied", inertCount > 0, { inertCount }]);

// ScanView's close control is inside the dialog — Tab must stay within.
let escaped = false;
for (let i = 0; i < 8; i++) {
  await page.keyboard.press("Tab");
  const a = await active();
  if (!a.inDialog && a.tag !== "BODY") escaped = { i, ...a };
}
results.push(["Tab never escapes dialog", !escaped, escaped]);

await page.keyboard.press("Escape");
await page.waitForTimeout(1400); // contraction + onExitComplete
const after = await page.evaluate(() => ({
  inert: document.querySelectorAll("[inert]").length,
  dialogs: document.querySelectorAll('[role="dialog"]').length,
  focusIsUtility:
    document.activeElement ===
    document.querySelector('button[aria-label="Scan"]'),
}));
results.push(["inert restored after close", after.inert === 0, after]);
results.push(["dialog unmounted", after.dialogs === 0, after]);
results.push(["focus returned to utility button", after.focusIsUtility, after]);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
```

Run: `node /tmp/pw/a11y-modal.mjs`. Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/utility-modal/
git commit -m "feat: inert-based containment + initial focus for UtilityModal"
```

---

### Task 3: NavigationMenu — APG menu pattern

**Files:**
- Modify: `client/src/components/navigation-bar/NavigationBar.tsx` — trigger button ~line 1038, menu container ~line 1096, menu rows ~line 1149, state block near `closeMenu` ~line 527
- Test: `/tmp/pw/a11y-menu.mjs`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: menu rows carry className `nav-menu-item` (Task 6 styles it).

- [ ] **Step 1: Add ids, refs, and roving state**

Near the top of the component (with the other state, after `isNavigationMenuOpen`):

```ts
const menuId = React.useId();
const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
// Roving tabindex: exactly one row is tabbable; arrows move it.
const [menuFocusId, setMenuFocusId] = useState<string | null>(null);
```

After `closeMenu` (~line 530), add open/close focus management:

```ts
// APG menu: focus moves to the active row when the menu opens; the
// roving pointer resets when it closes. rAF waits for the rows to mount.
useEffect(() => {
  if (isNavigationMenuOpen) {
    const index = menuTabs.findIndex(t => t.id === activeTab);
    requestAnimationFrame(() =>
      menuItemRefs.current[Math.max(0, index)]?.focus({ preventScroll: true })
    );
  } else {
    setMenuFocusId(null);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isNavigationMenuOpen]);

const handleMenuKeyDown = (e: React.KeyboardEvent) => {
  const ids = menuTabs.map(t => t.id);
  const current = Math.max(0, ids.indexOf(menuFocusId ?? activeTab));
  let next: number | null = null;
  if (e.key === "ArrowDown") next = (current + 1) % ids.length;
  else if (e.key === "ArrowUp") next = (current - 1 + ids.length) % ids.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = ids.length - 1;
  if (next !== null) {
    e.preventDefault();
    setMenuFocusId(ids[next]);
    menuItemRefs.current[next]?.focus({ preventScroll: true });
  }
};
```

(`menuTabs` is the existing derived list the rows map over. If `menuTabs` is
declared later in the file than this block, move this block below it.)

- [ ] **Step 2: Wire the markup**

1. Trigger button (`ref={navigationButtonRef}`, ~line 1038): add

```tsx
aria-haspopup="menu"
aria-expanded={isNavigationMenuOpen}
aria-controls={isNavigationMenuOpen ? menuId : undefined}
```

2. Menu container `motion.div` (key="tab-menu", ~line 1096): add `id={menuId}`,
   `role="menu"`, `aria-label="Navigate"`, `onKeyDown={handleMenuKeyDown}`.
3. Each row `motion.button` (~line 1149): add

```tsx
role="menuitem"
ref={el => {
  menuItemRefs.current[rowIndex] = el;
}}
tabIndex={(menuFocusId ?? activeTab) === tab.id ? 0 : -1}
```

and append `"nav-menu-item"` to its `cn(...)` class list.

Enter/Space activation is native button behavior; Escape close + focus return
already exist (`closeMenu(true)`); `handleSelectTab` already returns focus to
the NavigationButton after the confirm hold.

- [ ] **Step 3: Build, serve, test**

`pnpm check && pnpm build`, restart :4999. Write `/tmp/pw/a11y-menu.mjs`:

```js
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4999/navigation-bar");
await page.waitForTimeout(1500);

const results = [];
const active = () =>
  page.evaluate(() => ({
    role: document.activeElement?.getAttribute("role"),
    text: document.activeElement?.textContent?.trim(),
    expanded: document
      .querySelector('[aria-haspopup="menu"]')
      ?.getAttribute("aria-expanded"),
  }));

// Open the menu; focus lands on the active row (Home).
await page.locator('button[aria-haspopup="menu"]').click();
await page.waitForTimeout(900);
let a = await active();
results.push(
  ["focus on active menuitem", a.role === "menuitem" && a.text === "Home", a],
  ["trigger aria-expanded=true", a.expanded === "true", a]
);

// Arrow roving with wraparound: Down x4 returns to Home; End → Transactions.
for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowDown");
a = await active();
results.push(["ArrowDown wraps to Home", a.text === "Home", a]);
await page.keyboard.press("End");
a = await active();
results.push(["End → last item", a.text === "Transactions", a]);
await page.keyboard.press("Home");
a = await active();
results.push(["Home → first item", a.text === "Home", a]);

// Enter selects Trade (ArrowDown x2 from Home), menu closes, focus returns.
await page.keyboard.press("ArrowDown");
await page.keyboard.press("ArrowDown");
await page.keyboard.press("Enter");
await page.waitForTimeout(1800); // confirm hold + collapse
const after = await page.evaluate(() => ({
  menus: document.querySelectorAll('[role="menu"]').length,
  focusIsTrigger:
    document.activeElement ===
    document.querySelector('button[aria-haspopup="menu"]'),
  expanded: document
    .querySelector('[aria-haspopup="menu"]')
    ?.getAttribute("aria-expanded"),
}));
results.push(
  ["menu closed after Enter", after.menus === 0, after],
  ["focus returned to trigger", after.focusIsTrigger, after],
  ["aria-expanded=false", after.expanded === "false", after]
);

// Escape path: reopen, Escape, focus returns.
await page.locator('button[aria-haspopup="menu"]').click();
await page.waitForTimeout(900);
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
const esc = await page.evaluate(() => ({
  focusIsTrigger:
    document.activeElement ===
    document.querySelector('button[aria-haspopup="menu"]'),
}));
results.push(["Escape returns focus", esc.focusIsTrigger, esc]);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
```

Run: `node /tmp/pw/a11y-menu.mjs`. Expected: all PASS. Note: the test selects
Trade — the page ends on the Trade tab; that's fine, each script starts fresh.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/navigation-bar/NavigationBar.tsx
git commit -m "feat: APG menu pattern for NavigationMenu"
```

---

### Task 4: Filter strip — radiogroup with roving focus and focus return

**Files:**
- Modify: `client/src/components/navigation-bar/NavigationBar.tsx` — filter state block ~lines 582-669, filter scrim ~line 908, options row ~line 1307, option buttons ~line 1367, filter chip inside the actions map ~line 1460
- Test: `/tmp/pw/a11y-filter.mjs`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: option buttons carry className `nav-filter-option` (Task 6 styles it); chip carries `filterChipRef`.

- [ ] **Step 1: Add chip ref, roving state, and focus return**

With the existing filter state (~line 620):

```ts
const filterChipRef = useRef<HTMLButtonElement | null>(null);
const [filterFocusId, setFilterFocusId] = useState<string | null>(null);
// One-shot flag: focus the selected radio when the options first mount
// (they appear AFTER the label exits under mode="wait", so an effect on
// isFilterExpanded fires too early — the ref callback is the mount signal).
const filterFocusApplied = useRef(false);

// Close: reset roving; return focus to the chip unless the user has
// already clicked focus somewhere else on the page.
const prevFilterExpandedRef = useRef(isFilterExpanded);
useEffect(() => {
  const was = prevFilterExpandedRef.current;
  prevFilterExpandedRef.current = isFilterExpanded;
  if (was && !isFilterExpanded) {
    setFilterFocusId(null);
    filterFocusApplied.current = false;
    const el = document.activeElement;
    if (el === document.body || el === null) {
      filterChipRef.current?.focus({ preventScroll: true });
    }
  }
}, [isFilterExpanded]);

const handleFilterKeyDown = (e: React.KeyboardEvent) => {
  const ids = filterOptions.map(o => o.id);
  const current = Math.max(0, ids.indexOf(filterFocusId ?? activeFilter));
  let next: number | null = null;
  if (e.key === "ArrowRight" || e.key === "ArrowDown")
    next = (current + 1) % ids.length;
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
    next = (current - 1 + ids.length) % ids.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = ids.length - 1;
  if (next !== null) {
    e.preventDefault();
    setFilterFocusId(ids[next]);
    filterOptionRefs.current[ids[next]]?.focus({ preventScroll: true });
  }
};
```

Note: arrows move focus WITHOUT selecting — selection (Enter/Space → native
click → `handleSelectFilter`) triggers the confirm-hold choreography, so
focus-follows-selection would fire it on every keystroke.

In `measureFilterOption` (~line 646), inside the existing
`if (el && isFilterExpanded && id === activeFilter)` branch, after `apply()`:

```ts
if (!filterFocusApplied.current) {
  filterFocusApplied.current = true;
  el.focus({ preventScroll: true });
}
```

- [ ] **Step 2: Wire the markup**

1. Filter chip: in the actions map (~line 1460), the chip is the
   `motion.button` rendered when `action.isFilter`. Give it (conditionally,
   only when `isFilter`):

```tsx
ref={isFilter ? filterChipRef : undefined}
aria-expanded={isFilter ? isFilterExpanded : undefined}
```

2. Options row `motion.div` (key="filter-options", ~line 1307): add

```tsx
role="radiogroup"
aria-label={`${actionsForTab.find(a => a.isFilter)?.label ?? "Filter"} options`}
onKeyDown={handleFilterKeyDown}
```

3. Option buttons (~line 1367): add

```tsx
role="radio"
aria-checked={isActive}
tabIndex={(filterFocusId ?? activeFilter) === option.id ? 0 : -1}
```

and append `"nav-filter-option"` to the `cn(...)` class list.

4. Filter scrim (~line 908, `aria-label="Close filter options"`): make it
   pointer-only — replace the aria-label with `aria-hidden="true"` and add
   `tabIndex={-1}` (Escape and the chip toggle are the accessible dismissals).
5. Escape handler (~line 612) and selection close timer (~line 603) need no
   change — the focus return rides the `isFilterExpanded` falling edge added
   in Step 1.

- [ ] **Step 3: Build, serve, test**

`pnpm check && pnpm build`, restart :4999. Write `/tmp/pw/a11y-filter.mjs`:

```js
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4999/navigation-bar");
await page.waitForTimeout(1500);

// Navigate to Transactions (menu → row), then open the filter chip.
await page.locator('button[aria-haspopup="menu"]').click();
await page.waitForTimeout(900);
await page
  .locator('[role="menuitem"]', { hasText: "Transactions" })
  .click();
await page.waitForTimeout(1900);
await page
  .locator(".navigation-demo__nav-shell button", { hasText: "Pending" })
  .click();
await page.waitForTimeout(1400); // serial open beats

const results = [];
const active = () =>
  page.evaluate(() => ({
    role: document.activeElement?.getAttribute("role"),
    checked: document.activeElement?.getAttribute("aria-checked"),
    text: document.activeElement?.textContent?.trim(),
  }));

let a = await active();
results.push(
  ["focus on selected radio", a.role === "radio" && a.text === "Pending", a]
);
const group = await page.evaluate(() => ({
  count: document.querySelectorAll('[role="radiogroup"] [role="radio"]').length,
}));
results.push(["3 radios in radiogroup", group.count === 3, group]);

// Roving without selection.
await page.keyboard.press("ArrowRight");
a = await active();
results.push(["ArrowRight → Complete", a.text === "Complete", a]);
results.push(["arrow does NOT select", a.checked === "false", a]);

// Enter selects; strip closes after confirm hold; focus returns to chip.
await page.keyboard.press("Enter");
await page.waitForTimeout(2200); // slide + hold + close beats
const after = await page.evaluate(() => {
  const chip = [
    ...document.querySelectorAll(".navigation-demo__nav-shell button"),
  ].find(b => b.textContent?.includes("Complete"));
  return {
    chipShowsComplete: !!chip,
    focusIsChip: document.activeElement === chip,
    radios: document.querySelectorAll('[role="radio"]').length,
    chipExpanded: chip?.getAttribute("aria-expanded"),
  };
});
results.push(
  ["chip label updated", after.chipShowsComplete, after],
  ["strip closed", after.radios === 0, after],
  ["focus returned to chip", after.focusIsChip, after],
  ["chip aria-expanded=false", after.chipExpanded === "false", after]
);

// Escape path: reopen, Escape, focus returns, no selection change.
await page
  .locator(".navigation-demo__nav-shell button", { hasText: "Complete" })
  .click();
await page.waitForTimeout(1400);
await page.keyboard.press("Escape");
await page.waitForTimeout(1200);
const esc = await page.evaluate(() => {
  const chip = [
    ...document.querySelectorAll(".navigation-demo__nav-shell button"),
  ].find(b => b.textContent?.includes("Complete"));
  return { focusIsChip: document.activeElement === chip };
});
results.push(["Escape returns focus to chip", esc.focusIsChip, esc]);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
```

Run: `node /tmp/pw/a11y-filter.mjs`. Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/navigation-bar/NavigationBar.tsx
git commit -m "feat: filter strip radiogroup with roving focus + focus return"
```

---

### Task 5: Utility button semantics, search landmark, workflow-chip focus return

**Files:**
- Modify: `client/src/components/navigation-bar/NavigationBar.tsx` — UtilityAction type (top of file), utility button ~line 1583, search block ~line 1240, action chips ~line 1459, search-close effect near the search state
- Modify: `client/src/demos/navigationBarDemo.ts` — `navigationUtilityActions` ~line 74
- Test: `/tmp/pw/a11y-triggers.mjs`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `UtilityAction` gains optional `opensDialog?: boolean` (public API, additive).

- [ ] **Step 1: Type + demo data**

In the `UtilityAction` type definition in NavigationBar.tsx add:

```ts
/** Marks the action as opening a modal surface (sheet or takeover) —
 *  drives aria-haspopup="dialog" on the UtilityButton. */
opensDialog?: boolean;
```

In `navigationBarDemo.ts`, mark the dialog-opening actions (Search morphs the
bar in place — not a dialog):

```ts
export const navigationUtilityActions: Record<string, UtilityAction> = {
  home: { Icon: Sparkles, label: "AI", opensDialog: true },
  spend: { Icon: ScanLine, label: "Scan", opensDialog: true },
  trade: { Icon: Search, label: "Search" },
  transactions: { Icon: Download, label: "Export", opensDialog: true },
};
```

- [ ] **Step 2: Utility button aria**

On the utility `motion.button` (~line 1583, `ref={utilityButtonRef}`), add:

```tsx
aria-haspopup={utilityAction.opensDialog ? "dialog" : undefined}
aria-expanded={isUtilitySheetOpen || !!isSearchOpen}
```

(Only one surface can be open at a time; the button owns whichever it is.)

- [ ] **Step 3: Search landmark, label, and focus return**

1. Search wrapper `motion.div` (key="search", ~line 1240): add `role="search"`.
2. The `<input>` (~line 1258): add `aria-label="Search"`.
3. Near the existing search-focus effect (~line 420), add a falling-edge
   focus return to the utility button (search opens via `onUtilityClick`, so
   that button is the origin control):

```ts
// Search close (Cancel, Escape, Enter-submit): focus returns to the
// utility button that opened it.
const prevSearchOpenRef = useRef(isSearchOpen);
useEffect(() => {
  const was = prevSearchOpenRef.current;
  prevSearchOpenRef.current = isSearchOpen;
  if (was && !isSearchOpen) {
    utilityButtonRef?.current?.focus({ preventScroll: true });
  }
}, [isSearchOpen, utilityButtonRef]);
```

(`utilityButtonRef` is an optional prop — keep the `?.` chain.)

- [ ] **Step 4: Workflow-sheet focus return to the origin chip**

The workflow sheet's `onExitComplete` in the stage clears state but focuses
nothing — the origin is an action chip INSIDE the bar, so the bar handles it.
Near the action-sheet state in NavigationBar.tsx:

```ts
// The chip that launched the workflow sheet gets focus back when the
// bar's clear-out lifts (isActionSheetOpen falls in onExitComplete,
// after the sheet is gone and inert is restored).
const actionChipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
const lastEngagedActionRef = useRef<string | null>(null);
useEffect(() => {
  if (activeAction) lastEngagedActionRef.current = activeAction;
}, [activeAction]);
const prevActionSheetOpenRef = useRef(isActionSheetOpen);
useEffect(() => {
  const was = prevActionSheetOpenRef.current;
  prevActionSheetOpenRef.current = isActionSheetOpen;
  if (was && !isActionSheetOpen) {
    const label = lastEngagedActionRef.current;
    if (label) actionChipRefs.current[label]?.focus({ preventScroll: true });
  }
}, [isActionSheetOpen]);
```

On each action-chip `motion.button` (~line 1459), add:

```tsx
ref={el => {
  actionChipRefs.current[action.label] = el;
}}
```

(The filter chip gets `filterChipRef` from Task 4 — a button can't take two
refs. In the chip's ref callback, set both: store into `actionChipRefs` always,
and when `isFilter` also assign `filterChipRef.current = el`.)

- [ ] **Step 5: Build, serve, test**

`pnpm check && pnpm build`, restart :4999. Write `/tmp/pw/a11y-triggers.mjs`
asserting, with the same PASS/FAIL + exit-code convention as prior scripts:

1. On load (Home): utility button (`button[aria-label="AI"]`) has
   `aria-haspopup="dialog"` and `aria-expanded="false"`.
2. Click "Deposit", wait 1600ms → sheet open; press Escape, wait 1600ms →
   `document.activeElement?.textContent` contains "Deposit" (chip focus
   return).
3. Navigate to Trade via the menu (`button[aria-haspopup="menu"]` → menuitem
   "Trade", wait 1900ms): utility button `button[aria-label="Search"]` has NO
   `aria-haspopup` attribute. Click it, wait 900ms → `[role="search"]` exists
   and `document.activeElement` is the input with `aria-label="Search"`.
4. Press Escape, wait 700ms → focus is `button[aria-label="Search"]` (utility
   button focus return), and `[role="search"]` is gone.
5. Reopen Export path: menu → "Transactions", wait 1900ms; click
   `button[aria-label="Export"]`, wait 1800ms → dialog open and the button's
   `aria-expanded` is "true"; Escape, wait 1600ms → focus back on
   `button[aria-label="Export"]` (existing stage behavior, now asserted).

Run: `node /tmp/pw/a11y-triggers.mjs`. Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/navigation-bar/NavigationBar.tsx client/src/demos/navigationBarDemo.ts
git commit -m "feat: trigger aria semantics, search landmark, chip focus return"
```

---

### Task 6: Focus-visible rings

**Files:**
- Modify: `client/src/theme/theme.css` — extend the block around the existing `.nav-action-chip:focus-visible` rule (~line 228)
- Modify: `client/src/components/navigation-bar/NavigationBar.tsx` — add class hooks: NavigationButton ~line 1042, utility button ~line 1588, search Clear ~line 1288, search Cancel ~line 1300
- Test: `/tmp/pw/a11y-focus-rings.mjs`

**Interfaces:**
- Consumes: `nav-menu-item` (Task 3), `nav-filter-option` (Task 4) class names.
- Produces: nothing downstream.

Already ringed (verify, don't duplicate): `.nav-action-chip:focus-visible`
(theme.css:228), `.bottom-sheet__done` / `.bottom-sheet__expand`
(BottomSheet.css:99).

- [ ] **Step 1: Class hooks**

1. NavigationButton inner `motion.button` (~line 1042): append
   `"nav-circle-trigger"` to its className.
2. Utility `motion.button` (~line 1588): append `"nav-circle-trigger"`.
3. Search Clear button (~line 1288) and Cancel button (~line 1300): append
   `"nav-search-control"`.
4. Search `<input>` (~line 1274): append `"nav-search-input"`.

- [ ] **Step 2: Rules in theme.css**

Below the `.nav-action-chip:focus-visible` rule:

```css
/* Keyboard focus rings — :focus-visible only, outline-based so pointer
   flows stay pixel-identical. Circles ring outside; inset surfaces ring
   inside their own radius. */
.nav-circle-trigger:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--iris-700) 55%, transparent);
  outline-offset: 2px;
  border-radius: 9999px;
}

.nav-menu-item:focus-visible,
.nav-filter-option:focus-visible,
.nav-search-control:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--iris-700) 34%, transparent);
  outline-offset: -2px;
}

.nav-search-input:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--iris-700) 34%, transparent);
  outline-offset: -2px;
  border-radius: 9999px;
}
```

- [ ] **Step 3: Build, serve, test**

`pnpm check && pnpm build`, restart :4999. Write
`/tmp/pw/a11y-focus-rings.mjs`: for each of (a) the NavigationButton
(`button[aria-haspopup="menu"]`), (b) a menu item (open the menu first), and
(c) the utility button, focus it via `page.keyboard.press("Tab")` navigation
or `el.focus()` preceded by a real `page.keyboard.press("Tab")` elsewhere
(programmatic `.focus()` alone won't match `:focus-visible` — drive focus
with Tab presses only), then assert
`getComputedStyle(el).outlineStyle === "solid"` and take a zoomed screenshot
(`/tmp/pw/shots/ring-*.png`) for each. Read the screenshots — rings must sit
on the control, not clipped by `overflow-hidden` ancestors. Also capture one
pointer-flow screenshot (click Home chip area) and confirm no ring appears on
mouse interaction.

Run: `node /tmp/pw/a11y-focus-rings.mjs`. Expected: all PASS + rings visible
in shots. If a ring is clipped by the pill's `overflow-hidden`, switch that
control's rule to `outline-offset: -2px` (inside) rather than restructuring
the DOM.

- [ ] **Step 4: Commit**

```bash
git add client/src/theme/theme.css client/src/components/navigation-bar/NavigationBar.tsx
git commit -m "feat: focus-visible rings across NavigationBar controls"
```

---

### Task 7: Registry/docs sync, full regression sweep, push

**Files:**
- Modify: `client/src/lab/registry.tsx` — dependencies arrays ~lines 272, 333, 363; NavigationBar usage snippet (the block around line 130)
- Modify: `HANDOFF.md` — mark the accessibility pass done, note the a11y.ts dependency and new keyboard behaviors
- Test: full `/tmp/pw` a11y suite + existing frame-capture scripts

**Interfaces:**
- Consumes: everything prior.
- Produces: nothing — terminal task.

- [ ] **Step 1: Registry sync**

1. Add `"@/lib/a11y (useInertOutside — dialog containment)"` to the
   `dependencies` arrays of the navigation-bar (~272), bottom-sheet (~333),
   and utility-modal (~363) entries.
2. In the NavigationBar usage snippet comment block (~line 130), add one line
   noting the keyboard contract: menu = arrow keys/Home/End/Enter/Escape,
   filter = radiogroup arrows + Enter, all surfaces trap focus via inert and
   return focus to their origin control.

- [ ] **Step 2: Full verification sweep**

`pnpm check && pnpm build`, restart :4999, then run in order:

```bash
node /tmp/pw/a11y-sheet.mjs
node /tmp/pw/a11y-modal.mjs
node /tmp/pw/a11y-menu.mjs
node /tmp/pw/a11y-filter.mjs
node /tmp/pw/a11y-triggers.mjs
node /tmp/pw/a11y-focus-rings.mjs
```

Expected: every script all-PASS. Then run the existing choreography captures
(`/tmp/pw/filter-open.mjs`, `/tmp/pw/filter-select.mjs`,
`/tmp/pw/filter-dismiss.mjs`, plus the sheet/menu capture scripts present in
/tmp/pw) and READ the frames against HANDOFF's choreography specs — the
pointer-flow frames must look identical to before this pass (no rings, no
geometry shifts). Also confirm the stage's `aria-live` region still renders
(`page.locator('p.sr-only[aria-live="polite"]')` exists — spec §7, already
implemented).

- [ ] **Step 3: Update HANDOFF.md**

Move "Accessibility pass" out of NEXT UP (roadmap item 2 becomes next); add a
recap line summarizing what landed (inert containment, APG menu/radiogroup,
focus return everywhere, focus-visible rings, `@/lib/a11y` dependency).

- [ ] **Step 4: Commit and push**

```bash
git add client/src/lab/registry.tsx HANDOFF.md
git commit -m "docs: registry + handoff sync for accessibility pass"
git push https://rishidean:<token>@github.com/rishidean/ui-lab.git main
```

(Token: ask Rishi — per HANDOFF housekeeping it's his existing `ghp_…` token.)
