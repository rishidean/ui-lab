import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4999/navigation-bar");
await page.waitForTimeout(1500);

// Navigate to Transactions (menu → row), then open the filter chip.
await page.locator('button[aria-haspopup="menu"]').click();
await page.waitForTimeout(900);
await page
  .locator('[role="menuitemradio"]', { hasText: "Transactions" })
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
results.push([
  "focus on selected radio",
  a.role === "radio" && a.text === "Pending",
  a,
]);
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
