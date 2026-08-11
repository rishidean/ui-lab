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
// stranded exit value (branch clip at inset 100%, transcript at opacity
// 0, or the input row left faded by the collapse-first close's third
// beat) keeps every bubble in the DOM while showing an empty card.
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
      // The row that holds the sparkle, the field, and Cancel — faded as
      // beat three of a stretched close, so it must come back on reopen.
      rowOpacity: input.parentElement
        ? Number(getComputedStyle(input.parentElement).opacity)
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
  ],
  [
    "Reopen lands input row visible",
    reopened.rowOpacity !== null && reopened.rowOpacity > 0.99,
    reopened,
  ]
);

// 6. Rapid reopen (regression): Escape, then reopen 200ms later. With a
//    transcript present that lands mid-collapse (beat two, the card
//    contracting), so this covers interrupting the collapse-first close
//    as well as the wipe. A delayed AnimatePresence exit on the keyed
//    branch used to strand the transcript at opacity 0 here (tall empty
//    card); every open must land the input, row, AND transcript visibly.
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
  [
    "Rapid reopen (200ms) lands input row visible",
    rapid.rowOpacity !== null && rapid.rowOpacity > 0.99,
    rapid,
  ],
  ["Rapid reopen keeps both bubbles", rapid.bubbles === 2, rapid]
);

// 7. Collapse-first close (regression): a STRETCHED card unwinds in four
//    serial beats — transcript out, card contracts to the resting row,
//    the row's contents fade, then the bar wipes back. They all used to
//    key off the same prop flip and moved at once. Sampled at three
//    checkpoints; each asserts what must have happened and what must NOT
//    have started yet.
const probeBeats = () =>
  page.evaluate(() => {
    const input = document.querySelector(
      'input[aria-label="Ask the assistant"]'
    );
    if (!input) return { mounted: false };
    const row = input.parentElement;
    const branch = row?.parentElement;
    const card = branch?.parentElement;
    const transcript = document.querySelector('[role="log"]');
    return {
      mounted: true,
      transcriptOpacity: transcript
        ? Number(getComputedStyle(transcript).opacity)
        : null,
      cardH: card ? Math.round(card.getBoundingClientRect().height) : null,
      rowOpacity: row ? Number(getComputedStyle(row).opacity) : null,
      clip: branch ? getComputedStyle(branch).clipPath : "",
    };
  });
const unclipped = c => /^(none|inset\(0px 0px 0px 0(px|%)?\))$/.test(c ?? "");

const stretchedH = (await probeBeats()).cardH;
// Cancel, not the AI button — the utility control is intentionally inert
// while the bar is in an input mode.
await page.locator("button", { hasText: /^Cancel$/ }).click();
await page.waitForTimeout(120);
const beat1 = await probeBeats();
await page.waitForTimeout(400); // ≈520ms in
const beat2 = await probeBeats();
await page.waitForTimeout(180); // ≈700ms in
const beat3 = await probeBeats();

results.push(
  [
    "Beat 1: transcript fades while the card is still tall",
    beat1.transcriptOpacity < 0.9 && beat1.cardH > stretchedH - 30,
    { stretchedH, beat1 },
  ],
  [
    "Beat 2: card is back to the resting row, transcript gone",
    beat2.cardH <= 56 && beat2.transcriptOpacity < 0.05,
    beat2,
  ],
  [
    "Beat 2: the row is still legible while the card contracts",
    beat2.rowOpacity > 0.9,
    beat2,
  ],
  [
    "Beat 3: the row fades before the bar wipes",
    beat3.rowOpacity < 0.3 && unclipped(beat3.clip),
    beat3,
  ]
);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
