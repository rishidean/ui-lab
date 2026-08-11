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

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
