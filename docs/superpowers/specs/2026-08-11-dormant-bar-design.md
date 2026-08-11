# Dormant Until Engaged: Design Spec

**Component:** `NavigationBar` (resting appearance), `theme/theme.css` (tokens)
**Author:** Rishi Dean
**Status:** Approved design, not yet implemented
**Branch:** `nav-glass-activation`

---

## Why this exists

Rishi's read, from an iOS 26 tab bar: the bar could sit translucent and
monochrome when left alone, then activate with colour when you interact
with it. The bar at rest is chrome, not content — it should defer to the
page. The moment you operate it, it becomes the thing you are using and
earns its colour back.

The idea turned out to be half-true already, which shaped the design.

## What the audit found

The resting bar was measured for chroma in both presets (every computed
`color`, `background-color`, and `border-color` in the bar's subtree,
filtered to anything with meaningful channel spread). The result:

- **The left circle's tab icon** — `--accent-700`, full strength
  (`rgb(194 42 117)` light, `rgb(255 95 168)` dark).
- **A committed filter chip's background** — the accent at 9% alpha.
  Faint enough that it barely registers as colour.
- **Nothing else.** Labels, the utility glyph, the glass, every border
  and shadow are already neutral. The theme consistency pass left the
  bar with almost no chroma to remove.

`.glass-nav` is likewise **already translucent** — a white gradient at
0.78/0.6 alpha over a 0.66-alpha warm neutral, with
`backdrop-filter: saturate(1.45) blur(var(--blur-lg))`.

So "translucent and monochrome at rest" describes roughly where the bar
already sits. The live lever is the `saturate(1.45)`, which is what lets
page colour bloom through the glass.

## Decisions already made

- **Engaged means any non-rest bar state**, derived from state the
  component already computes. Not hover (the demo's primary target is a
  390×844 phone), not a pointer listener, not an idle timer.
- **Scroll-collapsed counts as REST.** Scroll-collapse is the bar
  getting out of the way; the collapsed puck staying quiet doubles down
  on the same intent.
- **The state pill keeps its colour, always.** This is why the icon
  animates its `color` rather than sitting under a `filter`: a filter
  applies to every descendant and has no inverse, so an exemption would
  be impossible. Animating the token means the chip's wash is untouched
  by construction rather than by special-casing.
- **Reduced motion follows house convention:** the state still changes,
  at duration 0. Consistent with every other transition in the file.
- **The engaged appearance is today's appearance.** Nothing about the
  bar in use changes; only the resting state is new. This keeps the
  diff honest and makes the change trivially revertible.

## Mechanism

Framer cannot interpolate `var()` strings — a documented gotcha in this
codebase (animated shadows stay literal for the same reason). So the
component animates **one unitless scalar**, `--nav-engage` (0 at rest, 1
engaged), and CSS derives both channels from it. Everything below was
verified in-browser before speccing.

```css
/* channel one — the glass */
backdrop-filter: saturate(calc(0.3 + 1.15 * var(--nav-engage))) blur(var(--blur-lg));

/* channel two — the tab icon */
color: color-mix(
  in oklab,
  var(--accent-700) calc(var(--nav-engage) * 100%),
  var(--accent-dormant)
);
```

Measured at three points: `--nav-engage: 0` → `saturate(0.3)` and a
zero-chroma ink; `0.5` → `saturate(0.875)` and a half-mixed ink; `1` →
`saturate(1.45)` and full `--accent-700`. A custom property also
interpolates smoothly on its own (`0.502` at the midpoint of a 200ms
run), so framer setting it per frame is sufficient —
`CSS.registerProperty` is not required.

One scalar for both channels means the two can never drift out of sync,
and the component animates a single value.

### The dormant token

```css
--accent-dormant: #6d6a6b; /* fallback for older engines */
--accent-dormant: oklch(from var(--accent-700) l 0 h);
```

Relative colour syntax takes the accent's own lightness and strips
chroma to zero. Verified per preset: `#c22a75` → `oklch(0.55017 0 …)`,
`#ff5fa8` → `oklch(0.712872 0 …)`.

This makes the WCAG constraint **provable rather than hand-tuned** — the
dormant ink is the accent's exact lightness by construction, so
neutralizing the hue cannot change the icon's contrast against the
circle in either preset. The plain-hex first declaration is a fallback
for engines without relative colour syntax; the repo already depends on
`color-mix(in oklab, …)` throughout, so the support floor is comparable.

### Timing

| direction | duration | ease | delay |
|---|---|---|---|
| engage | `DUR.direct` | `EASE_OUT` | none |
| rest | `DUR.expand` | `EASE_IN` | short |

Engage is eager so the bar reads as answering you. The return is slower
and delayed, which also debounces travel between two engaged states —
closing the menu to open the filter must not flash gray in between.

## Scope

**In:** the two channels above, the `--accent-dormant` token, the
`--nav-engage` scalar, the derived `isBarEngaged`, a contrast pair for
the dormant icon, and the Overview + registry copy.

**Out:** opacity or shadow changes at rest (option C in the discussion —
rejected because resting label legibility would start depending on
whatever scrolls underneath, trading a WCAG guarantee for drama). The
committed filter chip's wash. Every engaged appearance. Any other
component.

## Verification

- **Headless Playwright** for the state machine: computed
  `--nav-engage` and icon colour at rest and in each engaged state
  (menu, filter, search, assistant, sheet, pressed action), plus an
  assertion that the chip's wash never moves, and that a collapsed bar
  reads as rest.
- **`a11y-contrast.mjs`** gains the dormant-icon pair in both presets.
- **Real Chrome via claude-in-chrome** for raster behaviour. Animated
  `backdrop-filter` on a permanently composited surface is the exact
  class of artifact headless software rasterization cannot reproduce —
  this component's blurry-label bug had to be verified the same way.

## Risks

- **Raster artifacts.** The pill is permanently composited and already
  carries a re-raster nudge for a related bug. Animated saturation may
  need the same treatment; the real-Chrome pass is what will tell us.
- **Cost.** `backdrop-filter` animation is expensive. If it drops
  frames on the phone viewport, the fallback is to animate the icon
  only (option A) and accept the smaller effect.
- **It may simply be too subtle to keep.** That is an acceptable
  outcome — the branch exists so it can be judged on screen, and the
  design is deliberately shaped so reverting is a small diff.
