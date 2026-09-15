// Each example route must mount the bar, run its headline interaction,
// and log no console errors.
import { chromium } from "playwright";

const browser = await chromium.launch();
const results = [];
const push = (name, pass, detail) => results.push([name, pass, detail]);

async function open(id) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("console", m => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(`http://localhost:4999/navigation-bar?example=${id}`);
  await page.waitForTimeout(1200);
  const mounted = (await page.locator(".nav-circle-surface").count()) > 0;
  push(`${id}: bar mounts`, mounted, null);
  return { page, errors };
}
async function done(id, { page, errors }) {
  push(`${id}: no console errors`, errors.length === 0, errors);
  await page.close();
}

{ // 01 — tapping an action reports it
  const s = await open("01-minimal");
  await s.page.locator('button:has-text("Deposit")').click();
  await s.page.waitForTimeout(300);
  const text = await s.page.locator("[data-example-log]").textContent();
  push("01-minimal: onActionClick fires", (text ?? "").includes("Deposit"), text);
  await done("01-minimal", s);
}
{ // 02 — scrolling collapses
  const s = await open("02-collapse-on-scroll");
  await s.page.evaluate(() => {
    const el = document.querySelector("[data-example-scroll]");
    el.scrollTop = 30;
  });
  await s.page.waitForTimeout(100);
  await s.page.evaluate(() => {
    const el = document.querySelector("[data-example-scroll]");
    el.scrollTop = 140;
  });
  await s.page.waitForTimeout(700);
  const collapsed = (await s.page.locator('button[aria-label="Open controls"]').count()) === 1;
  push("02-collapse-on-scroll: collapses on scroll", collapsed, null);
  await done("02-collapse-on-scroll", s);
}
{ // 03 — search echoes
  const s = await open("03-search");
  await s.page.locator('button[aria-label="Search"]').click();
  await s.page.waitForTimeout(900);
  await s.page.keyboard.type("eth");
  await s.page.waitForTimeout(200);
  const text = await s.page.locator("[data-example-log]").textContent();
  push("03-search: query echoes", (text ?? "").includes("eth"), text);
  await done("03-search", s);
}
{ // 04 — sheet opens from Deposit
  const s = await open("04-workflow-sheet");
  await s.page.locator('button:has-text("Deposit")').click();
  await s.page.waitForTimeout(1800);
  const dialog = await s.page.locator('[role="dialog"]').count();
  push("04-workflow-sheet: sheet opens", dialog === 1, dialog);
  await s.page.keyboard.press("Escape");
  await s.page.waitForTimeout(1600);
  await done("04-workflow-sheet", s);
}
{ // 05 — assistant reply lands
  const s = await open("05-assistant");
  await s.page.locator('button[aria-label="AI"]').click();
  await s.page.waitForTimeout(1000);
  await s.page.keyboard.type("hi");
  await s.page.keyboard.press("Enter");
  await s.page.waitForTimeout(2500);
  const log = await s.page.locator('[role="log"]').textContent();
  push("05-assistant: reply appears", (log ?? "").includes("You said"), log);
  await s.page.locator("button", { hasText: /^Cancel$/ }).click();
  await s.page.waitForTimeout(1200);
  await done("05-assistant", s);
}

// Picker examples: each mounts a chip; 01 opens the strip on a long press.
async function openPicker(id) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("console", m => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(`http://localhost:4999/press-and-slide-picker?example=${id}`);
  await page.waitForTimeout(1000);
  push(`picker ${id}: chip mounts`, (await page.locator(".psp-chip").count()) > 0, null);
  return { page, errors };
}
{
  const s = await openPicker("01-minimal");
  const b = await s.page.locator(".psp-chip").first().boundingBox();
  await s.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await s.page.mouse.down();
  await s.page.waitForTimeout(400);
  push("picker 01-minimal: long press opens the strip", (await s.page.locator(".psp-strip").count()) === 1, null);
  await s.page.mouse.up();
  await s.page.waitForTimeout(300);
  push("picker 01-minimal: no console errors", s.errors.length === 0, s.errors);
  await s.page.close();
}
{
  const s = await openPicker("02-list");
  push("picker 02-list: four rows, four pickers", (await s.page.locator(".psp-chip").count()) === 4, null);
  push("picker 02-list: no console errors", s.errors.length === 0, s.errors);
  await s.page.close();
}
{
  const s = await openPicker("03-custom-chip");
  push("picker 03-custom-chip: custom trigger renders", (await s.page.locator(".psp-chip-pill").count()) === 0, null);
  const b = await s.page.locator(".psp-chip").first().boundingBox();
  await s.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await s.page.mouse.down();
  await s.page.waitForTimeout(400);
  push("picker 03-custom-chip: forced 'down' opens a column", (await s.page.locator(".psp-strip--vertical").count()) === 1, null);
  await s.page.mouse.up();
  await s.page.waitForTimeout(300);
  push("picker 03-custom-chip: no console errors", s.errors.length === 0, s.errors);
  await s.page.close();
}

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
