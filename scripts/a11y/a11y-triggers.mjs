import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4999/navigation-bar");
await page.waitForTimeout(1500);

const results = [];

// 1. On load (Home): the AI utility opens an in-bar mode (like Search),
//    so it carries NO aria-haspopup and NO aria-expanded.
let ai = await page.evaluate(() => {
  const btn = document.querySelector('button[aria-label="AI"]');
  return {
    haspopup: btn?.getAttribute("aria-haspopup"),
    expanded: btn?.getAttribute("aria-expanded"),
  };
});
results.push(
  ["Home utility button has no aria-haspopup", ai.haspopup === null, ai],
  ["Home utility button has no aria-expanded", ai.expanded === null, ai]
);

// 2. Click "Deposit", wait for sheet open; press Escape, wait → focus
//    returns to the chip (document.activeElement textContent contains
//    "Deposit").
await page.locator('button:has-text("Deposit")').click();
await page.waitForTimeout(1600);
await page.keyboard.press("Escape");
await page.waitForTimeout(1600);
let depositFocus = await page.evaluate(
  () => document.activeElement?.textContent ?? ""
);
results.push([
  "Deposit chip focus return after workflow sheet close",
  depositFocus.includes("Deposit"),
  depositFocus,
]);

// 3. Navigate to Trade via the menu: utility button (Search) has NO
//    aria-haspopup. Click it → role=search exists, focus on the input.
await page.locator('button[aria-haspopup="menu"]').click();
await page.waitForTimeout(900);
await page.locator('[role="menuitemradio"]', { hasText: "Trade" }).click();
await page.waitForTimeout(1900);
let searchBtn = await page.evaluate(() => {
  const btn = document.querySelector('button[aria-label="Search"]');
  return {
    haspopup: btn?.getAttribute("aria-haspopup"),
    expanded: btn?.getAttribute("aria-expanded"),
  };
});
results.push([
  "Trade utility button (Search) has no aria-haspopup",
  searchBtn.haspopup === null,
  searchBtn,
]);
// aria-expanded is gated the same way — a non-dialog action must not
// carry (and permanently announce) a collapsed/expanded state.
results.push([
  "Trade utility button (Search) has no aria-expanded",
  searchBtn.expanded === null,
  searchBtn,
]);

await page.locator('button[aria-label="Search"]').click();
await page.waitForTimeout(900);
let searchState = await page.evaluate(() => {
  const region = document.querySelector('[role="search"]');
  const input = document.querySelector('input[aria-label="Search"]');
  return {
    hasRegion: !!region,
    focusIsInput: document.activeElement === input,
  };
});
results.push(
  ["role=search region present", searchState.hasRegion, searchState],
  ["focus moved to search input", searchState.focusIsInput, searchState]
);

// 4. Press Escape → focus returns to the Search utility button, and
//    role=search is gone.
await page.keyboard.press("Escape");
await page.waitForTimeout(700);
let afterSearchClose = await page.evaluate(() => ({
  focusIsUtilityButton:
    document.activeElement ===
    document.querySelector('button[aria-label="Search"]'),
  regionGone: !document.querySelector('[role="search"]'),
}));
results.push(
  [
    "focus returns to Search utility button",
    afterSearchClose.focusIsUtilityButton,
    afterSearchClose,
  ],
  [
    "role=search removed after close",
    afterSearchClose.regionGone,
    afterSearchClose,
  ]
);

// 5. Reopen Export path: menu → Transactions; click Export → dialog open,
//    aria-expanded=true; Escape → focus back on Export button.
await page.locator('button[aria-haspopup="menu"]').click();
await page.waitForTimeout(900);
await page
  .locator('[role="menuitemradio"]', { hasText: "Transactions" })
  .click();
await page.waitForTimeout(1900);
await page.locator('button[aria-label="Export"]').click();
await page.waitForTimeout(1800);
let exportOpen = await page.evaluate(() => {
  const btn = document.querySelector('button[aria-label="Export"]');
  return {
    dialogOpen: document.querySelectorAll('[role="dialog"]').length > 0,
    expanded: btn?.getAttribute("aria-expanded"),
  };
});
results.push(
  ["Export dialog open", exportOpen.dialogOpen, exportOpen],
  [
    "Export utility button aria-expanded=true",
    exportOpen.expanded === "true",
    exportOpen,
  ]
);

await page.keyboard.press("Escape");
await page.waitForTimeout(1600);
let afterExportClose = await page.evaluate(
  () =>
    document.activeElement ===
    document.querySelector('button[aria-label="Export"]')
);
results.push([
  "focus returns to Export utility button",
  afterExportClose,
  afterExportClose,
]);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
