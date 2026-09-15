// Drift guard: every CSS custom property the NavigationBar folder reads
// must be defined either by the folder itself or by theme.css presets;
// and the README's generated block must match what the collector renders.
import { readFileSync } from "node:fs";
import { collectVars, NAV_BAR_VAR_INPUTS, renderVarBlock } from "../registry/collect-vars.mjs";

const out = collectVars(NAV_BAR_VAR_INPUTS);

const README_FILE = "client/src/components/navigation-bar/README.md";
const readme = readFileSync(README_FILE, "utf8");
const fenced = readme.match(/```css\n([\s\S]*?)```/);
const readmeBlock = fenced ? fenced[1].trim() : null;
const generatedBlock = renderVarBlock(out).trim();
const readmeMatches = readmeBlock === generatedBlock;

const results = [
  ["every read variable resolves", out.unresolved.length === 0, out.unresolved],
  ["required list is non-trivial", out.required.length >= 20, out.required.length],
  ["light and dark cover the same names",
    out.required.every(n => n in out.light && n in out.dark),
    out.required.filter(n => !(n in out.light && n in out.dark))],
  ["README's CSS block matches the generated block", readmeMatches,
    readmeMatches ? "" : "run: node scripts/registry/collect-vars.mjs > block; paste into README"],
];
for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
process.exit(results.every(r => r[1]) ? 0 : 1);
