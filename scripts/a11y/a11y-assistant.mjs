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
let focused = await page.evaluate(() =>
  document.activeElement?.getAttribute("aria-label")
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
let returned = await page.evaluate(() =>
  document.activeElement?.getAttribute("aria-label")
);
results.push([
  "Focus returns to AI button on Escape",
  returned === "AI",
  returned,
]);

// The reopen checks must assert VISIBILITY, not just DOM presence — a
// stranded exit value (branch clip at inset 100%, or transcript at
// opacity 0) keeps every bubble in the DOM while showing an empty card.
const probeAssistantVisible = () =>
  page.evaluate(() => {
    const input = document.querySelector(
      'input[aria-label="Ask the assistant"]'
    );
    if (!input) return { mounted: false };
    const branch = input.parentElement?.parentElement;
    const cs = branch ? getComputedStyle(branch) : null;
    const transcript = document.querySelector('[role="log"]');
    const clip = cs?.clipPath ?? "";
    return {
      mounted: true,
      clipOpen:
        clip === "none" ||
        /^inset\(0(px)?\)$/.test(clip) ||
        /^inset\(0px 0px 0px 0(px|%)?\)$/.test(clip),
      branchOpacity: Number(cs?.opacity ?? 0),
      transcriptOpacity: transcript
        ? Number(getComputedStyle(transcript).opacity)
        : null,
      bubbles: document.querySelectorAll(".nav-assistant-bubble").length,
    };
  });

// 5. Reopen: transcript is preserved (the stage owns it across close/open)
//    AND the branch + transcript are actually visible.
await page.locator('button[aria-label="AI"]').click();
await page.waitForTimeout(1400);
let reopened = await probeAssistantVisible();
results.push(
  ["Transcript preserved on reopen", reopened.bubbles === 2, reopened],
  [
    "Reopen lands branch visible (clip open, opacity 1)",
    reopened.mounted && reopened.clipOpen && reopened.branchOpacity > 0.99,
    reopened,
  ],
  [
    "Reopen lands transcript visible",
    reopened.transcriptOpacity !== null && reopened.transcriptOpacity > 0.99,
    reopened,
  ]
);

// 6. Rapid reopen (regression): Escape, then reopen 200ms later — while the
//    close wipe is still in flight. A delayed AnimatePresence exit on the
//    keyed branch used to strand the transcript at opacity 0 here (tall
//    empty card); every open must land the input AND transcript visibly.
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
await page.evaluate(() =>
  document.querySelector('button[aria-label="AI"]')?.click()
);
await page.waitForTimeout(2500);
let rapid = await probeAssistantVisible();
results.push(
  [
    "Rapid reopen (200ms) lands branch visible",
    rapid.mounted && rapid.clipOpen && rapid.branchOpacity > 0.99,
    rapid,
  ],
  [
    "Rapid reopen (200ms) lands transcript visible",
    rapid.transcriptOpacity !== null && rapid.transcriptOpacity > 0.99,
    rapid,
  ],
  ["Rapid reopen keeps both bubbles", rapid.bubbles === 2, rapid]
);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
