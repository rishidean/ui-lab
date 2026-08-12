import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4999/navigation-bar?embed=1", {
  waitUntil: "networkidle",
});
await page.waitForTimeout(900);

const results = [];

// The CSS contract: one scalar drives the tab ink, scaled by depth.
// Probed on a detached node carrying the same classes, so this asserts
// the stylesheet itself rather than whatever state the bar is in.
//
// Two channels ride the scalar: the glass's backdrop saturation and the
// tab glyph's ink, both scaled by --nav-dormancy-depth.
//
// The glass channel was once measured as dead and reverted. That
// measurement was wrong: the component painted a full-bleed canvas wash
// BETWEEN the page and the bar, so backdrop-filter was sampling the wash
// rather than the page. With the wash removed, a saturation swing moves
// the rendered pill 15/255 instead of 1/255. If anyone reintroduces an
// opaque layer under the cluster, this channel dies silently — which is
// what the render-level assertion at the end of this file guards.
const contract = await page.evaluate(() => {
  const el = document.createElement("div");
  el.className = "glass-nav nav-tab-ink";
  document.body.appendChild(el);
  const at = (v, depth = 1) => {
    el.style.setProperty("--nav-engage", String(v));
    el.style.setProperty("--nav-dormancy-depth", String(depth));
    const cs = getComputedStyle(el);
    return { filter: cs.backdropFilter, color: cs.color };
  };
  const rows = {
    rest: at(0),
    mid: at(0.5),
    engaged: at(1),
    restNoDepth: at(0, 0),
    restHalfDepth: at(0, 0.5),
  };
  el.remove();
  return rows;
});

results.push(
  [
    "glass saturation is 1.45 when engaged (shipped appearance)",
    /saturate\(1\.45\)/.test(contract.engaged.filter),
    contract.engaged,
  ],
  [
    "glass saturation drops to 0.3 at full dormancy",
    /saturate\(0\.3\)/.test(contract.rest.filter),
    contract.rest,
  ],
  [
    "depth 0 disables the glass channel too",
    /saturate\(1\.45\)/.test(contract.restNoDepth.filter),
    contract.restNoDepth,
  ],
  [
    "depth 0 disables dormancy — rest ink equals engaged ink",
    contract.restNoDepth.color === contract.engaged.color,
    {
      restNoDepth: contract.restNoDepth.color,
      engaged: contract.engaged.color,
    },
  ],
  [
    "depth 0.5 lands the rest ink between the two extremes",
    (() => {
      const c = s => Number(s.match(/oklch\([\d.]+\s+([\d.]+)/)?.[1] ?? NaN);
      const half = c(contract.restHalfDepth.color);
      const full = c(contract.engaged.color);
      return half > 0.001 && half < full - 0.001;
    })(),
    { half: contract.restHalfDepth.color, engaged: contract.engaged.color },
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

// The panel is a lab affordance, but it must still be operable and
// labelled — it renders inside the same stage the a11y suites cover.
const panel = await page.evaluate(() => {
  const q = s => document.querySelector(s);
  const depth = q('input[type="range"][id*="depth"]');
  const tempo = q('input[type="range"][id*="tempo"]');
  const rm = q('input[type="checkbox"][id*="reduced"]');
  const labelled = el =>
    !!el &&
    !!document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim();
  return {
    present: !!depth && !!tempo && !!rm,
    allLabelled: labelled(depth) && labelled(tempo) && labelled(rm),
    depthRange: depth && [depth.min, depth.max],
    tempoRange: tempo && [tempo.min, tempo.max],
  };
});
results.push(
  ["control panel renders all three controls", panel.present, panel],
  ["every control has an associated label", panel.allLabelled, panel],
  [
    "ranges match the spec",
    JSON.stringify(panel.depthRange) === '["0","1"]' &&
      JSON.stringify(panel.tempoRange) === '["0.6","3"]',
    panel,
  ]
);

// Dragging depth to 0 must switch dormancy off entirely: the resting
// tab ink becomes the full accent.
const setRange = (sel, value) =>
  page.evaluate(
    ([s, v]) => {
      const el = document.querySelector(s);
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      ).set;
      setter.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    [sel, value]
  );
const inkNow = () =>
  page.evaluate(
    () => getComputedStyle(document.querySelector(".nav-tab-ink")).color
  );

await setRange('input[type="range"][id*="depth"]', "0");
await page.waitForTimeout(700);
const inkDepth0 = await inkNow();
await setRange('input[type="range"][id*="depth"]', "1");
await page.waitForTimeout(700);
const inkDepth1 = await inkNow();
const chromaOf = s => Number(s.match(/oklch\([\d.]+\s+([\d.]+)/)?.[1] ?? NaN);
results.push([
  "depth 0 switches dormancy off (resting ink regains chroma)",
  chromaOf(inkDepth0) > 0.1 && chromaOf(inkDepth1) < 0.001,
  { inkDepth0, inkDepth1 },
]);

// RENDER-LEVEL guard. Every other assertion here reads computed style,
// which stayed perfectly correct for weeks while the effect was in fact
// invisible — a canvas wash sat between the page and the bar, so the
// backdrop-filter sampled the wash. Computed style cannot see that. This
// puts a vivid element behind the pill, swings the saturation, and
// requires the PIXELS to move. It is the assertion that would have
// caught the original bug.
{
  await page.evaluate(() => {
    const p = document.querySelector(".glass-nav").getBoundingClientRect();
    const d = document.createElement("div");
    d.id = "dormancy-probe";
    d.style.cssText =
      `position:fixed;left:0;top:${p.top - 30}px;width:100%;` +
      `height:${p.height + 60}px;z-index:1;` +
      `background:linear-gradient(90deg,#7c3aed,#0ea5e9,#f59e0b);`;
    document.querySelector(".navigation-demo").prepend(d);
  });
  await page.waitForTimeout(400);

  const box = await page.evaluate(() => {
    const r = document.querySelector(".glass-nav").getBoundingClientRect();
    return {
      x: Math.round(r.x + 14),
      y: Math.round(r.y + 8),
      width: Math.round(r.width - 28),
      height: Math.round(r.height - 16),
    };
  });
  const frames = [];
  for (const f of ["saturate(0.3)", "saturate(1.45)"]) {
    await page.evaluate(v => {
      document.querySelector(".glass-nav").style.backdropFilter =
        `${v} blur(var(--blur-lg))`;
    }, f);
    await page.waitForTimeout(320);
    frames.push((await page.screenshot({ clip: box })).toString("base64"));
  }
  await page.evaluate(() => {
    document.querySelector(".glass-nav").style.backdropFilter = "";
    document.getElementById("dormancy-probe")?.remove();
  });

  const delta = await page.evaluate(async ([a, b]) => {
    const load = s =>
      new Promise(r => {
        const i = new Image();
        i.onload = () => r(i);
        i.src = "data:image/png;base64," + s;
      });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const c = document.createElement("canvas");
    c.width = ia.width;
    c.height = ia.height;
    const x = c.getContext("2d");
    x.drawImage(ia, 0, 0);
    const da = x.getImageData(0, 0, c.width, c.height).data;
    x.clearRect(0, 0, c.width, c.height);
    x.drawImage(ib, 0, 0);
    const db = x.getImageData(0, 0, c.width, c.height).data;
    let m = 0;
    for (let i = 0; i < da.length; i += 4)
      m = Math.max(
        m,
        Math.abs(da[i] - db[i]),
        Math.abs(da[i + 1] - db[i + 1]),
        Math.abs(da[i + 2] - db[i + 2])
      );
    return m;
  }, frames);

  results.push([
    "glass dormancy actually reaches the pixels (nothing opaque under the bar)",
    delta >= 8,
    {
      maxChannelDelta: delta,
      note: "1/255 = something is masking the backdrop",
    },
  ]);
}

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
