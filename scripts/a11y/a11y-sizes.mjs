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
  const expected = { compact: 48, default: 56, large: 60 }[size];
  push(`${size}: circle is ${expected}px`, circle === expected, circle);

  const overflow = await page.evaluate(() => {
    const root = document.querySelector(".navigation-demo__nav-shell");
    return root ? root.scrollWidth - root.clientWidth : -1;
  });
  push(`${size}: no horizontal overflow at rest`, overflow <= 0, overflow);

  // Every element sized by --nav-circle must actually render at that width.
  // (.nav-circle-surface/.nav-circle-trigger alone also match the inset-[2px]
  // tap target and the inset-0 surface, which are deliberately not circle-sized.)
  const circles = await page.evaluate(() =>
    [...document.querySelectorAll('[class*="w-[var(--nav-circle)]"]')]
      .map(el => Math.round(el.getBoundingClientRect().width)));
  push(`${size}: both circles are the same width`, circles.length >= 2 && circles.every(w => w === circles[0]), circles);

  // The two flex slots that HOLD the circles (left tab switcher, right utility
  // button). They are the only elements carrying h-[var(--nav-circle)] without
  // w-[var(--nav-circle)] — their width is the framer animate target, which is
  // exactly what used to be hardcoded to 56 and pinned the action row.
  const slots = await page.evaluate(() =>
    [...document.querySelectorAll(
      '[class*="h-[var(--nav-circle)]"]:not([class*="w-[var(--nav-circle)]"])'
    )].map(el => Math.round(el.getBoundingClientRect().width)));
  push(`${size}: circle slots match the circle`, slots.length === 2 && slots.every(w => w === expected), slots);
  const rowOverflow = await page.evaluate(() => {
    const row = document.querySelector(".navigation-demo__nav-shell .overflow-x-auto");
    return row ? row.scrollWidth - row.clientWidth : -1;
  });
  push(`${size}: two-action row fits at rest`, rowOverflow <= 0, rowOverflow);

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
