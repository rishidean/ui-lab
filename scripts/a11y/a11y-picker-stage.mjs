// The PressAndSlidePicker stage: a task list where each row's status chip
// is a picker. Long-press opens the strip, sliding highlights, release
// commits; the demo controls change the hold time and option set.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
await page.goto("http://localhost:4999/press-and-slide-picker?embed=1");
await page.waitForTimeout(1200);
const results = [];
const push = (name, pass, detail) => results.push([name, pass, detail]);

const rows = await page.locator(".picker-demo__row").count();
push("stage renders a task list", rows === 8, rows);
const chips = await page.locator(".psp-chip").count();
push("every row has a picker chip", chips === rows, chips);

// Long-press the first chip, slide to the last option, release.
const chip = page.locator(".psp-chip").first();
const before = (await chip.textContent())?.trim();
const b = await chip.boundingBox();
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
await page.mouse.down();
await page.waitForTimeout(120);
push("hold affordance: chip is priming during the hold", (await page.locator(".psp-chip[data-priming]").count()) === 1, null);
await page.waitForTimeout(280);
push("hold affordance: priming clears once the strip opens", (await page.locator(".psp-chip[data-priming]").count()) === 0, null);
const stripOpen = (await page.locator(".psp-strip").count()) === 1;
push("long-press opens the strip", stripOpen, null);
const items = page.locator(".psp-strip .psp-item");
const n = await items.count();
push("strip lists the option set (4)", n === 4, n);
const last = await items.nth(n - 1).boundingBox();
await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2, { steps: 12 });
await page.waitForTimeout(150);
await page.mouse.up();
await page.waitForTimeout(400);
const after = (await chip.textContent())?.trim();
push("release commits the option under the finger", after !== before && after?.includes("Blocked"), { before, after });
push("strip closes on release", (await page.locator(".psp-strip").count()) === 0, null);

// Demo controls (headless when embedded, so open it the way the site does).
await page.evaluate(() => window.postMessage({ type: "lab:demo-controls", open: true }, window.location.origin));
await page.waitForTimeout(200);
push("panel opens on the site's message", (await page.locator(".demo-controls:not([hidden])").count()) === 1, null);
await page.selectOption("#demo-controls-set", "priority");
await page.waitForTimeout(200);
const chip2 = page.locator(".psp-chip").first();
const b2 = await chip2.boundingBox();
await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
await page.mouse.down();
await page.waitForTimeout(400);
const n2 = await page.locator(".psp-strip .psp-item").count();
push("option set switches the strip (priority: 3)", n2 === 3, n2);
await page.keyboard.press("Escape");
await page.mouse.up();
await page.waitForTimeout(300);

// A longer hold must NOT open on a 300ms press.
await page.evaluate(() => {
  const el = document.querySelector("#demo-controls-hold");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(el, "600");
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.waitForTimeout(150);
await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
await page.mouse.down();
await page.waitForTimeout(300);
push("600ms hold: a 300ms press does not open", (await page.locator(".psp-strip").count()) === 0, null);
await page.waitForTimeout(450);
push("600ms hold: it opens after 600ms", (await page.locator(".psp-strip").count()) === 1, null);
await page.keyboard.press("Escape");
await page.mouse.up();

push("no page errors", errors.length === 0, errors);
for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
