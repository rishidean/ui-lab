import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4999/navigation-bar");
await page.waitForTimeout(1500);

const results = [];

// 1. Open: click AI → the assistant input receives focus (deferred ~290ms
//    so the field has mostly widened before the mobile keyboard appears).
await page.locator('button[aria-label="AI"]').click();
await page.waitForTimeout(900);
let focused = await page.evaluate(
  () => document.activeElement?.getAttribute("aria-label")
);
results.push([
  "Assistant input focused on open",
  focused === "Ask the assistant",
  focused,
]);

// 2. Submit: transcript appears as role=log aria-live=polite; the
//    pending assistant bubble is aria-hidden (reply lands later).
await page.keyboard.type("What did I spend this month?");
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
let log = await page.evaluate(() => {
  const el = document.querySelector('[role="log"]');
  return {
    exists: !!el,
    live: el?.getAttribute("aria-live"),
    pendingHidden: !!el?.querySelector(
      '.nav-assistant-bubble[aria-hidden="true"]'
    ),
  };
});
results.push(
  ["Transcript is role=log", log.exists, log],
  ["Transcript aria-live=polite", log.live === "polite", log],
  ["Pending bubble aria-hidden", log.pendingHidden, log]
);

// 3. Reply lands (canned, ~1.4s after submit): pending clears, bubble has
//    text, and no third bubble is added (the pending bubble resolves
//    in place).
await page.waitForTimeout(2000);
let replied = await page.evaluate(() => {
  const bubbles = [...document.querySelectorAll(".nav-assistant-bubble")];
  const last = bubbles[bubbles.length - 1];
  return {
    count: bubbles.length,
    lastHasText: (last?.textContent ?? "").length > 0,
    lastHidden: last?.getAttribute("aria-hidden"),
  };
});
results.push(
  ["Two bubbles after reply", replied.count === 2, replied],
  ["Reply bubble has text", replied.lastHasText, replied],
  ["Reply bubble not aria-hidden", replied.lastHidden === null, replied]
);

// 4. Escape closes; focus returns to the AI utility button.
await page.keyboard.press("Escape");
await page.waitForTimeout(1200);
let returned = await page.evaluate(
  () => document.activeElement?.getAttribute("aria-label")
);
results.push(["Focus returns to AI button on Escape", returned === "AI", returned]);

// 5. Reopen: transcript is preserved (the stage owns it across close/open).
await page.locator('button[aria-label="AI"]').click();
await page.waitForTimeout(1400);
let preserved = await page.evaluate(
  () => document.querySelectorAll(".nav-assistant-bubble").length
);
results.push(["Transcript preserved on reopen", preserved === 2, preserved]);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
