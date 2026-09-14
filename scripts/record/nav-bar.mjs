/**
 * Records the NavigationBar click-through as a video via Playwright.
 * Usage: node scripts/record/nav-bar.mjs <outDir> [query]   (dev server on :4999)
 *   query defaults to "depth=0.65&tempo=1.5&rm=0" — the stage's demo-control
 *   overrides. Pauses scale with tempo so the beats stay in step.
 * Writes <outDir>/nav-bar.webm. A tap indicator is drawn at every click.
 *
 * Post-processing used for demos/navigation-bar (all ffmpeg):
 *   mp4:    -i nav-bar.webm -c:v libx264 -pix_fmt yuv420p -crf 17 -movflags +faststart -an full.mp4
 *   1.25×:  -i full.mp4 -vf "setpts=PTS/1.25" -r 30 … full-1.25x.mp4
 *   bar crop (bottom 360px; sheets top out at y≈600 so 540 leaves headroom):
 *           -i full-1.25x.mp4 -vf "crop=430:360:0:540" … bar-1.25x.mp4
 *   then trim the Scan beat (full-screen, clips in the crop) with trim/concat.
 */
import { chromium } from "playwright";
import { rename } from "node:fs/promises";

const outDir = process.argv[2] ?? ".";
const query = process.argv[3] ?? "depth=0.65&tempo=1.5&rm=0";
const tempo = Number(new URLSearchParams(query).get("tempo") ?? 1.3);
// Pauses were tuned at tempo 1.3; stretch them with the bar's own clock.
const SCALE = tempo / 1.3;
const W = 430;
const H = 900;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  colorScheme: "light",
  // Playwright only ever scales a recording DOWN, so 1× is the ceiling.
  recordVideo: { dir: outDir, size: { width: W, height: H } },
});
const page = await context.newPage();
await page.goto(`http://localhost:4999/navigation-bar?recording=1&${query}`);

// Tap indicator: a soft ring that blooms and fades at the click point.
await page.addStyleTag({
  content: `
    .rec-tap {
      position: fixed; z-index: 2147483647; pointer-events: none;
      width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%;
      background: rgb(194 42 117 / 0.22);
      border: 2.5px solid rgb(194 42 117 / 0.85);
      box-shadow: 0 0 0 3px rgb(255 255 255 / 0.9), 0 6px 18px rgb(194 42 117 / 0.25);
      animation: rec-tap 700ms cubic-bezier(0.2, 0, 0, 1) forwards;
    }
    @keyframes rec-tap {
      0%   { transform: scale(0.5); opacity: 0; }
      15%  { transform: scale(1);   opacity: 1; }
      55%  { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(1.4); opacity: 0; }
    }`,
});
const wait = ms => page.waitForTimeout(Math.round(ms * SCALE));
const ripple = (x, y) =>
  page.evaluate(([x, y]) => {
    const el = document.createElement("div");
    el.className = "rec-tap";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }, [x, y]);
const tapAt = async (x, y) => {
  await ripple(x, y);
  await page.waitForTimeout(140);
  await page.mouse.click(x, y);
};
const tap = async locator => {
  const box = await locator.first().boundingBox();
  if (!box) throw new Error(`no box for ${locator}`);
  await tapAt(box.x + box.width / 2, box.y + box.height / 2);
};
const menu = () => page.locator('button[aria-haspopup="menu"]');
const menuRow = name => page.locator('[role="menuitemradio"]', { hasText: name });
const util = label => page.locator(`button[aria-label="${label}"]`);
const shellBtn = text => page.locator(".navigation-demo__nav-shell button", { hasText: text });
const scrim = () => tapAt(W / 2, 110); // the sheet's page-dimming scrim
const wheelSteps = async (x, y, dx, dy, steps) => {
  await page.mouse.move(x, y);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(dx, dy);
    await wait(40);
  }
};

// 0. Rest — let the bar go dormant before the first touch.
await wait(3200);

// 1. Home · assistant: input morph, send, stretch, unwind.
await tap(util("AI"));
await wait(1100);
await page.keyboard.type("How much did I spend on dining?", { delay: 55 });
await wait(600);
await page.keyboard.press("Enter");
await wait(3200);
await tap(page.locator("button", { hasText: /^Cancel$/ }));
await wait(2200);

// 2. Home · Deposit: the bar grows into the workflow sheet, scrim closes it.
await tap(shellBtn("Deposit"));
await wait(2400);
await scrim();
await wait(2000);

// 3. Menu → Spend.
await tap(menu());
await wait(1300);
await tap(menuRow("Spend"));
await wait(2000);

// 4. Spend · Scan takeover: permission → active → close.
await tap(util("Scan"));
await wait(1800);
await tap(page.locator("button", { hasText: /^Allow$/ }));
await wait(1800);
await tap(page.locator('button[aria-label="Close scanner"]'));
await wait(1800);

// 5. Menu → Trade, then swipe the five-action row both ways.
await tap(menu());
await wait(1300);
await tap(menuRow("Trade"));
await wait(2000);
const row = page.locator(".navigation-demo__nav-shell .overflow-x-auto").first();
const rb = await row.boundingBox();
await wheelSteps(rb.x + rb.width / 2, rb.y + rb.height / 2, 14, 0, 14);
await wait(900);
await wheelSteps(rb.x + rb.width / 2, rb.y + rb.height / 2, -14, 0, 14);
await wait(1000);

// 6. Trade · Search: the bar becomes a search field.
await tap(util("Search"));
await wait(1100);
await page.keyboard.type("eth", { delay: 120 });
await wait(900);
await tap(page.locator("button", { hasText: /^Cancel$/ }));
await wait(1800);

// 7. Menu → Transactions, filter expand, pick Scheduled.
await tap(menu());
await wait(1300);
await tap(menuRow("Transactions"));
await wait(2000);
await tap(shellBtn("Pending"));
await wait(1600);
await tap(shellBtn("Scheduled"));
await wait(2000);

// 8. Transactions · Export: compact sheet from the button, scrim closes it.
await tap(util("Export"));
await wait(2200);
await scrim();
await wait(1800);

// 9. Scroll down to collapse, hold, scroll up to expand.
await wheelSteps(W / 2, H / 2, 0, 24, 16);
await wait(1800);
await wheelSteps(W / 2, H / 2, 0, -24, 16);
await wait(1500);

// 10. Rest — dormant again.
await page.mouse.move(W / 2, 40);
await wait(3200);

await context.close();
const path = await page.video().path();
await browser.close();
await rename(path, `${outDir}/nav-bar.webm`);
console.log(`${outDir}/nav-bar.webm`);
