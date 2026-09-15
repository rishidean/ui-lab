// Drift guard, per component: every CSS custom property the folder reads
// without a fallback must resolve in theme.css, light and dark must cover
// the same names, and the README's generated block must match what the
// collector renders.
import { readFileSync } from "node:fs";
import { collectVars, renderVarBlock, VAR_INPUTS } from "../registry/collect-vars.mjs";

const results = [];
for (const [slug, inputs] of Object.entries(VAR_INPUTS)) {
  const out = collectVars(inputs);
  const readme = readFileSync(`client/src/components/${slug}/README.md`, "utf8");
  const block = readme.match(/```css\n([\s\S]*?)```/)?.[1] ?? "";
  const readmeMatches = block.trim() === renderVarBlock(out).trim();
  results.push(
    [`${slug}: every read variable resolves`, out.unresolved.length === 0, out.unresolved],
    [`${slug}: required list is non-trivial`, out.required.length + (out.optional?.length ?? 0) >= 4, out.required.length],
    [`${slug}: light and dark cover the same names`,
      [...out.required, ...out.optional].every(n => n in out.light && n in out.dark),
      [...out.required, ...out.optional].filter(n => !(n in out.light && n in out.dark))],
    [`${slug}: README's CSS block matches the generated block`, readmeMatches,
      readmeMatches ? "" : `run: node scripts/registry/collect-vars.mjs ${slug} > block; paste into README`]
  );
}
for (const [name, pass, detail] of results)
  console.log(pass ? "PASS" : "FAIL", name, pass ? "" : JSON.stringify(detail));
process.exit(results.every(r => r[1]) ? 0 : 1);
