import { chromium } from "playwright";
import { mkdirSync } from "fs";

mkdirSync("scripts/a11y/shots", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4999/navigation-bar");
await page.waitForTimeout(1500);

const results = [];

// Helper: press real Tab keypresses until document.activeElement matches
// the given evaluate-predicate, or bail after maxTabs.
async function tabUntil(matchFn, maxTabs = 30) {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");
    const matched = await page.evaluate(matchFn);
    if (matched) return true;
  }
  return false;
}

async function outlineOf(selector) {
  return page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth };
  }, selector);
}

async function zoomedScreenshot(selector, path) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) return false;
  const pad = 12;
  await page.screenshot({
    path,
    clip: {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    },
  });
  return true;
}

// ---------------------------------------------------------------------
// (a) NavigationButton — button[aria-haspopup="menu"]. Tab to it with
// real keypresses (Tab focus does NOT trigger its onClick, so the menu
// stays closed — this exercises the plain :focus-visible ring on the
// trigger itself).
// ---------------------------------------------------------------------
const reachedNavButton = await tabUntil(() => {
  const btn = document.querySelector('button[aria-haspopup="menu"]');
  return document.activeElement === btn;
});
results.push([
  "Tab reaches NavigationButton",
  reachedNavButton,
  reachedNavButton,
]);

let navOutline = await outlineOf('button[aria-haspopup="menu"]');
results.push([
  "NavigationButton :focus-visible outline solid",
  navOutline?.outlineStyle === "solid",
  navOutline,
]);
await zoomedScreenshot(
  'button[aria-haspopup="menu"]',
  "scripts/a11y/shots/ring-navigation-button.png"
);

// ---------------------------------------------------------------------
// (b) Menu item — open the menu (mouse click), then establish keyboard
// modality with a real Tab press elsewhere, then focus the active
// menuitem programmatically. Per the brief, a bare click->focus() chain
// won't satisfy :focus-visible, but a real Tab keypress beforehand puts
// the browser in keyboard modality so the subsequent focus() call still
// renders the ring.
// ---------------------------------------------------------------------
await page.locator('button[aria-haspopup="menu"]').click();
await page.waitForTimeout(900);

// Real keyboard input to establish keyboard modality (ArrowDown is also
// a keyboard event and moves roving focus onto the next menu item using
// the component's own native focus() call — this satisfies the "driven
// by a real keypress" requirement directly, no synthetic focus() needed).
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(150);

let menuItemOutline = await page.evaluate(() => {
  const el = document.activeElement;
  const cs = getComputedStyle(el);
  return {
    role: el?.getAttribute("role"),
    className: el?.className,
    outlineStyle: cs.outlineStyle,
  };
});
results.push([
  "Menu item reached via ArrowDown has role=menuitemradio",
  menuItemOutline.role === "menuitemradio",
  menuItemOutline,
]);
results.push([
  "Menu item :focus-visible outline solid",
  menuItemOutline.outlineStyle === "solid",
  menuItemOutline,
]);
await zoomedScreenshot(
  '[role="menuitemradio"]:focus',
  "scripts/a11y/shots/ring-menu-item.png"
);

await page.keyboard.press("Escape");
await page.waitForTimeout(700);

// ---------------------------------------------------------------------
// (c) Utility button — ref={utilityButtonRef}; aria-expanded only when the
// action opensDialog (gated like aria-haspopup).
// On Home the utility button is "AI", which now opens an in-bar mode (like
// Search) and carries neither attribute — switch to Transactions, where
// "Export" still opensDialog, to exercise this gated ring.
// ---------------------------------------------------------------------
await page.locator('button[aria-haspopup="menu"]').click();
await page.waitForTimeout(900);
await page
  .locator('[role="menuitemradio"]', { hasText: "Transactions" })
  .click();
await page.waitForTimeout(1900);

const reachedUtilityButton = await tabUntil(() => {
  const btn = document.querySelector(
    'button[aria-expanded][aria-haspopup="dialog"]'
  );
  return !!btn && document.activeElement === btn;
});
results.push([
  "Tab reaches utility button",
  reachedUtilityButton,
  reachedUtilityButton,
]);

let utilityOutline = await outlineOf(
  'button[aria-expanded][aria-haspopup="dialog"]'
);
results.push([
  "Utility button :focus-visible outline solid",
  utilityOutline?.outlineStyle === "solid",
  utilityOutline,
]);
await zoomedScreenshot(
  'button[aria-expanded][aria-haspopup="dialog"]',
  "scripts/a11y/shots/ring-utility-button.png"
);

// Back to Home for the pointer-flow control below (needs the Deposit chip).
await page.locator('button[aria-haspopup="menu"]').click();
await page.waitForTimeout(900);
await page.locator('[role="menuitemradio"]', { hasText: "Home" }).click();
await page.waitForTimeout(1900);

// ---------------------------------------------------------------------
// Pointer-flow control: click the Home chip with the mouse. No ring
// should appear — outlineStyle must NOT be "solid".
// ---------------------------------------------------------------------
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(300);

// "Home chip area" = the Deposit action chip, visible on the Home tab
// (Home itself is the active tab label, not an action chip).
const homeChip = page
  .locator(".nav-action-chip", { hasText: "Deposit" })
  .first();
await homeChip.click();
await page.waitForTimeout(400);

let pointerOutline = await page.evaluate(() => {
  const el = document.activeElement;
  const cs = el ? getComputedStyle(el) : null;
  return {
    tag: el?.tagName,
    className: el?.className,
    outlineStyle: cs?.outlineStyle,
  };
});
results.push([
  "Pointer click shows NO focus ring",
  pointerOutline.outlineStyle !== "solid",
  pointerOutline,
]);
await page.screenshot({
  path: "scripts/a11y/shots/ring-pointer-flow-no-ring.png",
  clip: { x: 0, y: 700, width: 390, height: 144 },
});

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
