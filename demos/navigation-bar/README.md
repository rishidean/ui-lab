# NavigationBar demo videos

Recorded headlessly by `scripts/record/nav-bar.mjs` against the lab's
recording mode (`/navigation-bar?recording=1&depth=0.65&tempo=1.5&rm=0`),
430 × 900 viewport, light theme, with a tap ring drawn at every click.
Playwright caps recordings at 1×, so these are soft on a Retina display;
for a crisp take, screen-record the same URL with QuickTime.

| File | What it is |
| --- | --- |
| `navigation-bar-full.mp4` | The ten-beat click-through, phone height, real time (67s). |
| `navigation-bar-full-1.25x.mp4` | Same take, uniform 1.25× speed-up (54s). |
| `navigation-bar-bar-1.25x.mp4` | A second take with the bar raised 88px off the viewport edge (`RAISE=88`), at 1.25×, cropped to the bottom 448px so the bar fills the frame with canvas running under it (50s). Posted players draw their controls over the bottom edge; the gap keeps the bar clear of them. The full-screen Scan beat is cut out — it clips badly in that crop. |

Regenerate: `npm run dev` on port 4999, then
`RAISE=88 node scripts/record/nav-bar.mjs <outDir>` and
`scripts/record/post-nav-bar.sh <outDir>/nav-bar.webm <outDir>` for the
three MP4s (omit `RAISE` for the flush-to-edge full-height takes). The
Scan cut is found by blackdetect, not a timestamp — takes drift by a
second or two run to run.
