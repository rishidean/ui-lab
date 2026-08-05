import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4999/utility-modal");
await page.waitForTimeout(800);

const results = [];

await page.locator("text=Open takeover").click();
await page.waitForTimeout(1600); // clear-out + circle grow

const active1 = await page.evaluate(() => ({
  tag: document.activeElement?.tagName,
  inDialog: !!document.activeElement?.closest('[role="dialog"]'),
}));
results.push(["initial focus in dialog", active1.inDialog, active1]);

await page.keyboard.press("Escape");
await page.waitForTimeout(1400); // contraction + onExitComplete

const after = await page.evaluate(() => {
  const trigger = Array.from(document.querySelectorAll("button")).find(b =>
    b.textContent?.includes("Open takeover")
  );
  return {
    inert: document.querySelectorAll("[inert]").length,
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    focusIsTrigger: document.activeElement === trigger,
    activeTag: document.activeElement?.tagName,
  };
});
results.push(["inert restored after close", after.inert === 0, after]);
results.push(["dialog unmounted", after.dialogs === 0, after]);
results.push(["focus returned to trigger", after.focusIsTrigger, after]);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
