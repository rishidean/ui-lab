// Drift guard: every CSS custom property the NavigationBar folder reads
// must be defined either by the folder itself or by theme.css presets.
import { collectVars } from "../registry/collect-vars.mjs";

const FOLDER = "client/src/components/navigation-bar";
const out = collectVars({
  files: [
    `${FOLDER}/NavigationBar.tsx`,
    `${FOLDER}/navigation-bar.css`,
    "client/src/theme/glass.css",
  ],
  themeFile: "client/src/theme/theme.css",
});

const results = [
  ["every read variable resolves", out.unresolved.length === 0, out.unresolved],
  ["required list is non-trivial", out.required.length >= 20, out.required.length],
  ["light and dark cover the same names",
    out.required.every(n => n in out.light && n in out.dark),
    out.required.filter(n => !(n in out.light && n in out.dark))],
];
for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
process.exit(results.every(r => r[1]) ? 0 : 1);
