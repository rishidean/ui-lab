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
