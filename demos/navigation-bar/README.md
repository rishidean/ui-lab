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
| `navigation-bar-bar-1.25x.mp4` | 1.25× take cropped to the bottom 360px so the bar fills the frame (49s). The full-screen Scan beat is cut out — it clips badly in that crop. |

Regenerate: `npm run dev` on port 4999, then
`node scripts/record/nav-bar.mjs <outDir>` and the ffmpeg steps in the
script's header comment.
