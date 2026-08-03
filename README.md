# Rishi's UI Lab

Original interaction components with live demos and copyable source. Built by [Rishi Dean](https://rishidean.com).

Each component here was invented for a real product, then extracted into a single self-contained file you can drop into your own project. The site gives every component a shadcn-style detail page: a full-bleed **Preview**, the complete **Code** with copy-to-clipboard, and a **Usage** guide with a minimal wiring example.

## Components

| Component                | What it is                                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Navigation Bar**       | A glass bottom bar where navigation, actions, and filters share one morphing surface. Collapses on scroll down, expands on scroll up, with fully choreographed transitions.         |
| **Press & Slide Picker** | Facebook-Reactions-style selection: long-press a chip, slide to an option, release to commit — with haptics, viewport-aware positioning, and an accessible click/keyboard fallback. |

## Run locally

```bash
pnpm install
pnpm dev
```

Open the URL Vite prints (normally `http://localhost:3000`).

| Command      | Purpose                                                  |
| ------------ | -------------------------------------------------------- |
| `pnpm dev`   | Start the Vite dev server                                |
| `pnpm check` | TypeScript check                                         |
| `pnpm build` | Production build (client bundle + static Express server) |
| `pnpm start` | Serve the production build                               |

## Deploy (Railway)

The repo deploys via the included `Dockerfile` (pinned to Node 22): a build stage runs `pnpm build`, and a slim runtime stage serves `dist/` on `$PORT` through a small Express server. Create a Railway service from this GitHub repo and it deploys with no extra configuration (`railway.json` points Railway at the Dockerfile). Every push to `main` auto-deploys.

## Project structure

```
client/src/
  components/<component-name>/   # the actual component source — self-contained
  stages/                        # full-bleed demo stages (state + canvas per component)
  lab/registry.tsx               # single source of truth: metadata, source, usage docs
  lab/                           # site chrome: shell, tabs, code viewer, recording mode
  pages/                         # landing page + 404
server/index.ts                  # static file server for production
```

## Adding a component

1. Put the source in `client/src/components/<component-name>/` (keep it self-contained).
2. Build a demo stage in `client/src/stages/`.
3. Register it in `client/src/lab/registry.tsx` — routes, nav, the landing card, and the code viewer all derive from the registry.

## Recording mode

Press `H` on any page (or append `?recording=1`) to hide all site chrome for clean screen captures. Press `H` again to bring it back.

## License

MIT — take what you like.
