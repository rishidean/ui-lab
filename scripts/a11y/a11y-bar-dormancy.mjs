import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4999/navigation-bar?embed=1", {
  waitUntil: "networkidle",
});
await page.waitForTimeout(900);

const results = [];

// The CSS contract: one scalar drives glass saturation and icon ink.
// Probed on a detached node carrying the same classes, so this asserts
// the stylesheet itself rather than whatever state the bar is in.
const contract = await page.evaluate(() => {
  const el = document.createElement("div");
  el.className = "glass-nav nav-tab-ink";
  document.body.appendChild(el);
  const at = v => {
    el.style.setProperty("--nav-engage", String(v));
    const cs = getComputedStyle(el);
    return { filter: cs.backdropFilter, color: cs.color };
  };
  const rows = { rest: at(0), mid: at(0.5), engaged: at(1) };
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent-700")
    .trim();
  el.remove();
  return { ...rows, accent };
});

results.push(
  [
    "glass saturation is 1.45 at engage=1 (today's appearance)",
    /saturate\(1\.45\)/.test(contract.engaged.filter),
    contract.engaged,
  ],
  [
    "glass saturation drops to 0.3 at engage=0",
    /saturate\(0\.3\)/.test(contract.rest.filter),
    contract.rest,
  ],
  [
    "glass saturation interpolates at engage=0.5",
    /saturate\(0\.875\)/.test(contract.mid.filter),
    contract.mid,
  ],
  [
    "icon ink has zero chroma at engage=0",
    (() => {
      const m = contract.rest.color.match(/oklch\(([\d.]+)\s+([\d.]+)/);
      return m ? Number(m[2]) < 0.001 : false;
    })(),
    contract.rest,
  ],
  [
    "dormant ink keeps the accent's lightness (contrast preserved)",
    (() => {
      const rest = contract.rest.color.match(/oklch\(([\d.]+)/);
      const eng = contract.engaged.color.match(/oklch\(([\d.]+)/);
      if (!rest || !eng) return false;
      return Math.abs(Number(rest[1]) - Number(eng[1])) < 0.005;
    })(),
    { rest: contract.rest.color, engaged: contract.engaged.color },
  ]
);

// The state machine: --nav-engage is 0 only at true rest.
// Read it off the pill AND the tab glyph — they inherit from the same
// animated ancestor, so if these two ever disagree the cascade broke.
const engageOf = () =>
  page.evaluate(() => {
    const read = sel => {
      const el = document.querySelector(sel);
      return el
        ? Number(getComputedStyle(el).getPropertyValue("--nav-engage"))
        : null;
    };
    const pill = read(".glass-nav");
    const ink = read(".nav-tab-ink");
    if (pill === null || ink === null) return null;
    if (Math.abs(pill - ink) > 0.001)
      throw new Error(`channels drifted: pill=${pill} ink=${ink}`);
    return pill;
  });
const settle = () => page.waitForTimeout(900);

await settle();
results.push([
  "at rest, --nav-engage is 0",
  (await engageOf()) < 0.02,
  {
    value: await engageOf(),
  },
]);

// Menu open — engaged.
await page.locator(".nav-circle-trigger").first().click();
await settle();
results.push([
  "menu open engages the bar",
  (await engageOf()) > 0.98,
  {
    value: await engageOf(),
  },
]);

// Escape back to rest.
await page.keyboard.press("Escape");
await settle();
results.push([
  "menu close returns to rest",
  (await engageOf()) < 0.02,
  {
    value: await engageOf(),
  },
]);

// Search (Trade tab's utility) — engaged.
await page.locator(".nav-circle-trigger").first().click();
await settle();
await page.locator("[role=menuitemradio]", { hasText: "Trade" }).click();
await settle();
await page.locator('button[aria-label="Search"]').click();
await settle();
results.push([
  "search engages the bar",
  (await engageOf()) > 0.98,
  {
    value: await engageOf(),
  },
]);
await page.keyboard.press("Escape");
await settle();

// Scroll-collapsed counts as REST, per the spec.
await page.evaluate(() => window.scrollTo(0, 600));
await page.waitForTimeout(1200);
results.push([
  "scroll-collapsed reads as rest",
  (await engageOf()) < 0.02,
  {
    value: await engageOf(),
  },
]);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1200);

// The committed filter chip's wash must never move.
await page.locator(".nav-circle-trigger").first().click();
await settle();
await page.locator("[role=menuitemradio]", { hasText: "Transactions" }).click();
await settle();
const chipWash = () =>
  page.evaluate(() => {
    const chip = [...document.querySelectorAll(".nav-action-chip")].find(
      c => getComputedStyle(c).backgroundColor !== "rgba(0, 0, 0, 0)"
    );
    return chip ? getComputedStyle(chip).backgroundColor : null;
  });
const washAtRest = await chipWash();
await page.locator(".nav-circle-trigger").first().click();
await settle();
const washEngaged = await chipWash();
await page.keyboard.press("Escape");
await settle();
results.push([
  "committed chip wash is identical at rest and engaged",
  washAtRest === washEngaged,
  { washAtRest, washEngaged },
]);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
