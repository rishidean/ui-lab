// Site-level checks for the showcase page: the install artifacts are
// built and served, the install panel shows the right command, and the
// viewport toggle lives on the demo canvas only.
import { chromium } from "playwright";
import { readdirSync, readFileSync } from "node:fs";
import { buildNavBarRegistry } from "../registry/build.mjs";

const results = [];
const push = (name, pass, detail) => results.push([name, pass, detail]);

// 1. Build artifacts and check them against the source folder.
const { manifest, zipEntries } = buildNavBarRegistry();
const folder = readdirSync("client/src/components/navigation-bar")
  .filter(f => !f.startsWith("."))
  .map(f => `components/navigation-bar/${f}`)
  .sort();
const manifestPaths = manifest.files.map(f => f.path).sort();
push(
  "manifest lists every file in the folder plus glass.css",
  JSON.stringify(manifestPaths) === JSON.stringify([...folder, "styles/glass.css"].sort()),
  { manifestPaths, folder }
);
push(
  "zip holds the manifest's files plus tokens.css",
  JSON.stringify([...zipEntries].sort()) ===
    JSON.stringify([...manifestPaths, "styles/navigation-bar.tokens.css"].sort()),
  zipEntries
);
push(
  "manifest cssVars are non-empty and prefix-free",
  Object.keys(manifest.cssVars.light).length >= 20 &&
    Object.keys(manifest.cssVars.light).every(k => !k.startsWith("--")),
  Object.keys(manifest.cssVars.light).slice(0, 5)
);
push(
  "manifest file contents match the source",
  manifest.files.every(f =>
    f.content ===
    readFileSync(
      f.path === "styles/glass.css" ? "client/src/theme/glass.css" : `client/src/${f.path}`,
      "utf8"
    )
  ),
  null
);
// The zip's central directory must count exactly the entries we wrote.
const zip = readFileSync("client/public/r/navigation-bar.zip");
let cdCount = 0;
for (let i = 0; i + 4 <= zip.length; i++) if (zip.readUInt32LE(i) === 0x02014b50) cdCount++;
push("zip central directory has one record per entry", cdCount === zipEntries.length, cdCount);

// 2. The served site.
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
await page.goto("http://localhost:4999/navigation-bar");
await page.waitForTimeout(1200);

for (const path of ["/r/navigation-bar.json", "/r/navigation-bar.zip"]) {
  const res = await page.request.get(`http://localhost:4999${path}`);
  push(`${path} is served (200)`, res.status() === 200, res.status());
}

const toggleOnDemo = await page.locator(".lab-canvas-tools .lab-view-toggle").count();
push("viewport toggle is in the toolbar above the canvas", toggleOnDemo === 1, toggleOnDemo);
const gap = await page.evaluate(() => {
  const tools = document.querySelector(".lab-canvas-tools").getBoundingClientRect();
  const canvas = document.querySelector(".lab-canvas").getBoundingClientRect();
  return Math.round(canvas.top - tools.bottom);
});
push("toolbar sits clear of the canvas (≥ 12px)", gap >= 12, gap);

// Demo-controls pill drives the panel inside the embedded stage.
const frame = page.frameLocator("iframe.lab-frame");
await page.waitForTimeout(800);
push("embedded stage starts with the panel closed", (await frame.locator(".demo-controls:not([hidden])").count()) === 0, null);
push("embedded stage shows no summary row", (await frame.locator(".demo-controls__summary").count()) === 0, null);
await page.locator(".lab-tool-pill").click();
await page.waitForTimeout(300);
push("controls pill opens the panel in the iframe", (await frame.locator(".demo-controls--headless:not([hidden])").count()) === 1, null);
push("controls pill reads aria-pressed", (await page.locator(".lab-tool-pill").getAttribute("aria-pressed")) === "true", null);
await page.locator(".lab-tool-pill").click();
await page.waitForTimeout(300);
push("controls pill closes the panel again", (await frame.locator(".demo-controls:not([hidden])").count()) === 0, null);
push(
  "no viewport buttons in the tab row",
  (await page.locator('.lab-tabs [aria-pressed]').count()) === 0,
  null
);
await page.locator('.lab-view-toggle button[aria-label="Mobile viewport"]').click();
await page.waitForTimeout(400);
push(
  "phone toggle switches the frame to mobile",
  (await page.locator("iframe.lab-frame--mobile").count()) === 1,
  null
);
push(
  "phone button reads aria-pressed",
  (await page.locator('.lab-view-toggle button[aria-label="Mobile viewport"]').getAttribute("aria-pressed")) === "true",
  null
);

await page.locator('[role="tab"]', { hasText: "Code" }).click();
await page.waitForTimeout(300);
push("toolbar is gone on the Code tab", (await page.locator(".lab-canvas-tools").count()) === 0, null);
const mainW = await page.evaluate(() => Math.round(document.querySelector(".lab-main").getBoundingClientRect().width));
push("Code tab does not stretch the page past the viewport", mainW <= 1280, mainW);
const cmd = (await page.locator("[data-install-command]").textContent()) ?? "";
push(
  "install command points at this origin's manifest",
  cmd === "npx shadcn@latest add http://localhost:4999/r/navigation-bar.json",
  cmd
);
const zipHref = await page.locator(".lab-install__zip").getAttribute("href");
push("zip link points at the served zip", zipHref === "/r/navigation-bar.zip", zipHref);

await page.locator('[role="tab"]', { hasText: "Props" }).click();
await page.waitForTimeout(300);
push("toolbar is gone on the Props tab", (await page.locator(".lab-canvas-tools").count()) === 0, null);
push("no page errors", errors.length === 0, errors);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
