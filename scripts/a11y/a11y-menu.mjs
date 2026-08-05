import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4999/navigation-bar");
await page.waitForTimeout(1500);

const results = [];
const active = () =>
  page.evaluate(() => ({
    role: document.activeElement?.getAttribute("role"),
    checked: document.activeElement?.getAttribute("aria-checked"),
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
  [
    "focus on active menuitemradio",
    a.role === "menuitemradio" && a.text === "Home",
    a,
  ],
  ["active row aria-checked=true", a.checked === "true", a],
  ["trigger aria-expanded=true", a.expanded === "true", a]
);
const checkedCount = await page.evaluate(
  () =>
    document.querySelectorAll('[role="menuitemradio"][aria-checked="true"]')
      .length
);
results.push(["exactly one checked row", checkedCount === 1, { checkedCount }]);

// DOM/roving order is [Spend, Trade, Transactions, Home] — menuTabs puts
// the active tab LAST (pre-existing design: otherTabs, then a divider,
// then the current tab), so Home (the default active tab) is the last
// row, not the first. Down x4 is a full cycle and always returns to the
// start regardless of order. End (last item) is therefore Home; Home
// (first item) is therefore Spend.
for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowDown");
a = await active();
results.push(["ArrowDown wraps to Home", a.text === "Home", a]);
// ArrowUp from Home (last row) steps back to Transactions; roving moves
// focus only — the checked row must not change until Enter commits.
await page.keyboard.press("ArrowUp");
a = await active();
results.push(
  ["ArrowUp → previous item", a.text === "Transactions", a],
  ["arrow does NOT select", a.checked === "false", a]
);
// From the first row, ArrowUp wraps backward to the last (Home).
await page.keyboard.press("Home");
await page.keyboard.press("ArrowUp");
a = await active();
results.push(["ArrowUp wraps from first to last", a.text === "Home", a]);
await page.keyboard.press("End");
a = await active();
results.push(["End → last item", a.text === "Home", a]);
await page.keyboard.press("Home");
a = await active();
results.push(["Home → first item", a.text === "Spend", a]);

// Enter selects Trade (ArrowDown x1 from Spend, the first row), menu
// closes, focus returns.
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

// Tab path: reopen, Tab, menu closes and focus moves naturally out (not
// forced back to the trigger — no preventDefault on Tab).
await page.locator('button[aria-haspopup="menu"]').click();
await page.waitForTimeout(900);
await page.keyboard.press("Tab");
await page.waitForTimeout(300);
const tab = await page.evaluate(() => ({
  menus: document.querySelectorAll('[role="menu"]').length,
  expanded: document
    .querySelector('[aria-haspopup="menu"]')
    ?.getAttribute("aria-expanded"),
  focusIsTrigger:
    document.activeElement ===
    document.querySelector('button[aria-haspopup="menu"]'),
}));
results.push(
  ["Tab closes menu", tab.menus === 0, tab],
  ["Tab: aria-expanded=false", tab.expanded === "false", tab],
  ["Tab: focus moved beyond trigger", !tab.focusIsTrigger, tab]
);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
