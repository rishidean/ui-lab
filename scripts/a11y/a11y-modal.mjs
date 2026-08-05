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
