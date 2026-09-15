// Collects the CSS custom properties a set of files READ (`var(--x)`),
// subtracts the ones those files DEFINE (`--x:`), and resolves the rest
// against theme.css's `:root` (light) and `.dark` blocks.
import { readFileSync } from "node:fs";

const READ_RE = /var\(\s*(--[a-zA-Z0-9-]+)/g;
// Matches CSS declarations and quoted keys in a TSX style object (the size vars are written inline by the component).
const DEF_RE = /^\s*"?(--[a-zA-Z0-9-]+)"?\s*:/gm;

/** Returns `{ [name]: value }` for one `selector { ... }` block. */
function block(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return {};
  let depth = 0, i = css.indexOf("{", start);
  for (; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) break;
  }
  const body = css.slice(css.indexOf("{", start) + 1, i);
  const out = {};
  for (const m of body.matchAll(/^\s*(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/gm))
    out[m[1]] = m[2].replace(/\s+/g, " ").trim();
  return out;
}

export function collectVars({ files, themeFile }) {
  const sources = files.map(f => readFileSync(f, "utf8"));
  const read = new Set(), defined = new Set();
  for (const s of sources) {
    for (const m of s.matchAll(READ_RE)) read.add(m[1]);
    for (const m of s.matchAll(DEF_RE)) defined.add(m[1]);
  }
  const theme = readFileSync(themeFile, "utf8");
  const rootVars = block(theme, ":root");
  const darkVars = block(theme, ".dark");
  const required = [...read].filter(n => !defined.has(n)).sort();
  const light = {}, dark = {}, unresolved = [];
  for (const n of required) {
    if (n in rootVars) light[n] = rootVars[n];
    if (n in darkVars) dark[n] = darkVars[n];
    else if (n in rootVars) dark[n] = rootVars[n]; // light value carries
    if (!(n in rootVars)) unresolved.push(n);
  }
  return { required, defined: [...defined].sort(), light, dark, unresolved };
}

// The NavigationBar folder's inputs to the collector, shared by the CLI
// below and the drift test (a11y-tokens.mjs) so neither keeps its own
// copy of the file list.
const FOLDER = "client/src/components/navigation-bar";
export const NAV_BAR_VAR_INPUTS = {
  files: [`${FOLDER}/NavigationBar.tsx`, `${FOLDER}/navigation-bar.css`, "client/src/theme/glass.css"],
  themeFile: "client/src/theme/theme.css",
};

/** Renders the exact `:root { … }` / `.dark { … }` block the CLI prints
 *  and the README documents — the drift test asserts the README's fenced
 *  block equals this, trimmed. */
export function renderVarBlock(out) {
  const lines = [":root {"];
  for (const n of out.required) lines.push(`  ${n}: ${out.light[n]};`);
  lines.push("}", "", ".dark {");
  for (const n of out.required) if (out.dark[n] !== out.light[n]) lines.push(`  ${n}: ${out.dark[n]};`);
  lines.push("}");
  return lines.join("\n");
}

// CLI: node scripts/registry/collect-vars.mjs → prints the README block.
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = collectVars(NAV_BAR_VAR_INPUTS);
  console.log(renderVarBlock(out));
  if (out.unresolved.length) {
    console.error("UNRESOLVED:", out.unresolved.join(" "));
    process.exit(1);
  }
}
