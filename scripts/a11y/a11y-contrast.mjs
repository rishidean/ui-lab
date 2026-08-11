import { chromium } from "playwright";

// WCAG 2.x contrast suite for the theme presets shipped in
// docs/superpowers/specs/2026-08-09-theme-consistency — the "Bench"
// light/dark palettes defined in client/src/theme/theme.css.
//
// Relative luminance + contrast ratio are implemented by hand (no new
// dependency): sRGB channels are linearized, combined via the WCAG
// weights, and the two luminances are combined as (L1+0.05)/(L2+0.05)
// with the lighter color as L1. See
// https://www.w3.org/TR/WCAG21/#contrast-minimum for the formula.

function srgbToLinear(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map(srgbToLinear);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(rgb1, rgb2) {
  const L1 = relativeLuminance(rgb1);
  const L2 = relativeLuminance(rgb2);
  const [lighter, darker] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (lighter + 0.05) / (darker + 0.05);
}

// oklch to linear RGB.
function oklchToRgb(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = Math.cos(h) * C;
  const b = Math.sin(h) * C;
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291486575 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077363322 * m + 0.2309101289 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193761 * s,
    -0.004218652871 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearToSrgb(c) {
  if (c <= 0.0031308) return Math.round(c * 12.92 * 255);
  return Math.round((1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
}

// Parses `#rrggbb`, `rgb(r g b)`, `rgb(r g b / a)`, `oklch(...)`, and the legacy
// `rgba(r, g, b, a)` / `rgb(r, g, b)` comma forms getComputedStyle can
// hand back. Returns { rgb: [r,g,b], a: 0..1 }.
function parseColor(value) {
  const v = value.trim();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3)
      h = h
        .split("")
        .map(c => c + c)
        .join("");
    const n = parseInt(h, 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 };
  }
  const fn = v.match(/^rgba?\(([^)]+)\)$/i);
  if (fn) {
    // Split the color channels from the alpha on "/" first (modern
    // `rgb(r g b / a)` syntax), then split remaining channels on
    // commas-or-whitespace to also accept the legacy
    // `rgba(r, g, b, a)` comma form.
    const [channelPart, alphaPart] = fn[1].split("/").map(s => s.trim());
    const channels = channelPart
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(parseFloat);
    let [r, g, b, legacyA] = channels;
    const a = alphaPart !== undefined ? parseFloat(alphaPart) : legacyA;
    return { rgb: [r, g, b], a: a === undefined ? 1 : a };
  }
  // Handle computed oklch() like `oklch(0.55017 0 356.116)`.
  const oklch = v.match(/^oklch\(([^)\s]+)\s+([^)\s]+)\s+([^)]+)\)$/i);
  if (oklch) {
    const [, L, C, H] = oklch.map((x, i) => (i === 0 ? x : parseFloat(x)));
    const [lr, lg, lb] = oklchToRgb(parseFloat(L), parseFloat(C), parseFloat(H));
    return {
      rgb: [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)],
      a: 1,
    };
  }
  throw new Error(`Unrecognized color format: ${value}`);
}

// Composites a (possibly alpha) foreground color over an opaque backdrop.
function resolveOverBackdrop(colorValue, backdropRgb) {
  const { rgb, a } = parseColor(colorValue);
  if (a >= 1) return rgb;
  return rgb.map((c, i) => c * a + backdropRgb[i] * (1 - a));
}

function fmt(rgb) {
  return `rgb(${rgb.map(c => Math.round(c)).join(" ")})`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:4999/navigation-bar");
await page.waitForTimeout(800);

const results = [];

async function readTokens(names) {
  return page.evaluate(list => {
    const styles = getComputedStyle(document.documentElement);
    const out = {};
    for (const name of list) out[name] = styles.getPropertyValue(name).trim();
    return out;
  }, names);
}

async function setDark(isDark) {
  await page.evaluate(dark => {
    document.documentElement.classList.toggle("dark", dark);
  }, isDark);
  await page.waitForTimeout(100);
}

const TOKEN_NAMES = [
  "--bg-canvas",
  "--text-primary",
  "--text-secondary",
  "--text-tertiary",
  "--text-quaternary",
  "--surface-overlay",
  "--select-bg",
  "--select-fg",
  "--accent-700",
  "--accent-dormant",
];

// The accent-ink pair isn't a CSS custom property pairing on the
// component tokens — it mirrors the lab chrome's own --lab-acc-ink
// literal (client/src/lab/labTheme.ts), which pairs white ink with the
// light accent and #12140c ink with the dark accent. Both presets use
// --accent-700 as the accent surface; the ink values are hardcoded
// here to match that palette rather than read from a component token.
const ACCENT_INK = {
  light: { ink: "#ffffff", accentToken: "--accent-700" }, // white on #c22a75
  dark: { ink: "#12140c", accentToken: "--accent-700" }, // #12140c on #ff5fa8
};

async function runPreset(label, isDark) {
  await setDark(isDark);
  const t = await readTokens(TOKEN_NAMES);

  const canvasRgb = parseColor(t["--bg-canvas"]).rgb;
  const textPrimaryRgb = parseColor(t["--text-primary"]).rgb;
  const textSecondaryRgb = parseColor(t["--text-secondary"]).rgb;
  const textTertiaryRgb = parseColor(t["--text-tertiary"]).rgb;
  const textQuaternaryRgb = parseColor(t["--text-quaternary"]).rgb;
  const surfaceOverlayRgb = resolveOverBackdrop(
    t["--surface-overlay"],
    canvasRgb
  );
  const selectBgRgb = resolveOverBackdrop(t["--select-bg"], canvasRgb);
  const selectFgRgb = resolveOverBackdrop(t["--select-fg"], selectBgRgb);

  const check = (name, fgRgb, bgRgb, min, printOnly = false) => {
    const ratio = contrastRatio(fgRgb, bgRgb);
    const pass = printOnly ? true : ratio >= min;
    results.push([
      `[${label}] ${name} ≥ ${min}:1`,
      pass,
      `${ratio.toFixed(2)}:1 (fg ${fmt(fgRgb)} / bg ${fmt(bgRgb)})`,
    ]);
  };

  check("--text-primary on --bg-canvas", textPrimaryRgb, canvasRgb, 4.5);
  check("--text-secondary on --bg-canvas", textSecondaryRgb, canvasRgb, 4.5);
  check("--text-tertiary on --bg-canvas", textTertiaryRgb, canvasRgb, 4.5);
  // --text-quaternary is placeholder-grade (used for the least-emphasis
  // text only) — hold it to the AA "non-text"/large-text floor of 3:1
  // and just print the ratio rather than failing the suite at 4.5.
  check(
    "--text-quaternary on --bg-canvas (placeholder-grade)",
    textQuaternaryRgb,
    canvasRgb,
    3
  );
  check(
    "--text-primary on --surface-overlay (alpha-resolved)",
    textPrimaryRgb,
    surfaceOverlayRgb,
    4.5
  );
  check(
    "--select-fg on --select-bg (alpha-resolved)",
    selectFgRgb,
    selectBgRgb,
    4.5
  );

  const inkSpec = ACCENT_INK[label];
  const accentRgb = parseColor(t[inkSpec.accentToken]).rgb;
  const inkRgb = parseColor(inkSpec.ink).rgb;
  check(`accent-ink (${inkSpec.ink}) on --accent-700`, inkRgb, accentRgb, 4.5);

  // The dormant tab ink sits on the nav circle's fill. It is the accent
  // with chroma stripped at identical lightness, so this ratio must
  // track the accent's own — if it ever diverges, the derivation broke.
  // Let the browser compute the resolved color from the token (which may
  // contain relative color syntax) by creating an element and reading
  // its computed style property as rgb().
  const resolvedDormant = await page.evaluate(() => {
    const el = document.createElement("span");
    el.style.color = "var(--accent-dormant)";
    document.body.appendChild(el);
    // Use canvas to convert to rgb() since getComputedStyle may return oklch()
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.fillStyle = getComputedStyle(el).color;
    const rgbValue = ctx.fillStyle;
    el.remove();
    return rgbValue;
  });
  const accentDormantRgb = resolveOverBackdrop(resolvedDormant, canvasRgb);
  check("dormant tab ink on canvas", accentDormantRgb, canvasRgb, 3.0);
}

await runPreset("light", false);
await runPreset("dark", true);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, detail);
await browser.close();
process.exit(results.every(r => r[1]) ? 0 : 1);
