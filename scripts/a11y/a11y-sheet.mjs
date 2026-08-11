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

// 5. Arm-window close: closing while the entrance has landed but before
// the drag-arm timer (OPENED_AT_MS = 1100) fires used to wedge the
// dialog permanently — the timer's setOpened re-render mid-exit reset
// framer's exit bookkeeping, so AnimatePresence never removed the child
// and the page stayed inert. Close at mount+800ms on the PAGE clock
// (Playwright's attach detection lags real mount, so a naive sleep can
// drift out of the ~564–1100ms danger window).
await page.evaluate(() => {
  window.__sheetMountAt = null;
  const mo = new MutationObserver(() => {
    if (document.querySelector('[role="dialog"]') && !window.__sheetMountAt) {
      window.__sheetMountAt = performance.now();
      mo.disconnect();
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
});
await page
  .locator(".navigation-demo__nav-shell button", { hasText: "Deposit" })
  .click();
await page.waitForFunction(() => window.__sheetMountAt !== null);
await page.waitForFunction(
  () => performance.now() - window.__sheetMountAt >= 800
);
await page.keyboard.press("Escape");
await page.waitForTimeout(2000); // exit choreography + slack
const armWindow = await page.evaluate(() => ({
  inert: document.querySelectorAll("[inert]").length,
  dialogs: document.querySelectorAll('[role="dialog"]').length,
  closedAt: Math.round(performance.now() - window.__sheetMountAt - 2000),
}));
results.push([
  "arm-window close unwedges (dialog unmounted)",
  armWindow.dialogs === 0,
  armWindow,
]);
results.push([
  "arm-window close restores inert",
  armWindow.inert === 0,
  armWindow,
]);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
