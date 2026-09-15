// Guards the CSS split: theme.css holds tokens only; shared glass
// primitives live in glass.css; the bar's rules live in its folder.
import { readFileSync, existsSync } from "node:fs";

const read = p => (existsSync(p) ? readFileSync(p, "utf8") : "");
const theme = read("client/src/theme/theme.css");
const glass = read("client/src/theme/glass.css");
const nav = read("client/src/components/navigation-bar/navigation-bar.css");

const selectors = css =>
  [...css.matchAll(/^(\.[^{\n]+?)\s*\{/gm)].map(m => m[1].trim());
const themeSel = selectors(theme);
const glassSel = selectors(glass);
const navSel = selectors(nav);

const results = [];
const push = (name, pass, detail) => results.push([name, pass, detail]);

push(
  "theme.css has no glass primitives",
  !themeSel.some(s => /glass-rim|glass-overlay|scrollbar-hide/.test(s)),
  themeSel.filter(s => /glass-rim|glass-overlay|scrollbar-hide/.test(s))
);
push(
  "glass.css defines the three primitives",
  ["glass-rim::before", "glass-overlay", "dark .glass-overlay", "scrollbar-hide"].every(
    s => glassSel.some(g => g.includes(s))
  ),
  glassSel
);
// Task 2 turns these two on; they fail until then and that is expected
// only while Task 2 is in progress — never commit with them failing.
push(
  "theme.css has no NavigationBar rules",
  !themeSel.some(s => /glass-nav|\.nav-/.test(s)),
  themeSel.filter(s => /glass-nav|\.nav-/.test(s))
);
push(
  "navigation-bar.css holds the bar's rules",
  ["glass-nav", "nav-circle-surface", "nav-action-chip", "nav-assistant-bubble"].every(
    s => navSel.some(n => n.includes(s))
  ),
  navSel.slice(0, 10)
);

for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
process.exit(results.every(r => r[1]) ? 0 : 1);
