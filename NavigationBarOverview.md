# Floating Navigation Control

Design spec and implementation record for the NavigationBar — the flagship
component of Rishi's UI Lab. Live at the deployed site; source in
`client/src/components/navigation-bar/NavigationBar.tsx`, demo stage in
`client/src/stages/NavigationBarStage.tsx`. See `HANDOFF.md` for session
continuity and open work.

Everything below is implemented and verified frame-by-frame unless marked
**[SPEC — not yet implemented]**.

## Purpose

A persistent floating control that combines:

- Primary "tab" navigation
- Contextual actions or filters
- A high-value utility, such as Search, Export, AI Chat

The component stays accessible while minimizing obstruction during scrolling.

## Structure

### Left: NavigationButton

- Displays the icon for the current tab (a brand logo is the no-tab fallback).
- Opens the primary navigation menu when pressed.
- The navigation menu is anchored to the circle — its bottom-left corner sits
  at the circle's center — and highlights the current tab.
- Selecting a tab closes the menu and navigates to that view.

### Center: ContextualActionBar

The center region changes based on the current view.

#### Workflow Actions (ActionButtons)

- Contains one or more actions, such as Deposit and Withdraw.
- Action chips are **text-only verbs** — icons belong to the circular
  left/right buttons, never the pill.
- Chips are ghost labels at rest; the select-pill appears only for
  hover/pressed/engaged states. **Pill = state**, not decoration.
- With more actions than fit (e.g. five on Trade), the row scrolls
  horizontally with edge-fade affordances instead of squishing labels.
- Selecting an action opens its workflow in an Action Sheet (see Motion
  Design → Workflow Actions).

#### Filter Actions

- Displays the current filter value with a chevron, such as `Complete ▾`,
  in medium weight — a control cue, distinct from the heavier action verbs.
- Selecting it expands the filter options in place.
- The chosen filter applies directly to the current view.

### Right: UtilityButton

Contains one high-value, contextual utility per tab, such as:

- Search (the bar itself morphs into the field)
- AI assistant (the bar itself morphs into a chat input, then stretches
  upward into a conversation card)
- Export (bottom sheet)
- Scan (modal takeover)

## Collapsed State

When the user scrolls down, the control collapses into the left circular
button.

- The Utility button fades out first ("undotting the i").
- The Action Bar collapses right-to-left, absorbed into the left circle.
- As the bar lands, the NavigationButton's border emits a brief glow and
  settles — the circle visibly "catches" the absorbed bar.
- The Navigation button continues to display the current tab icon.
- A small upward scroll expands the full control; a tap on the collapsed
  circle expands it too (opening the menu then requires a second,
  deliberate tap).
- Scroll hysteresis prevents flapping: collapsing requires a decisive
  downward pull (~56px), expanding only a small upward nudge (~16px), with
  a jitter floor, a toggle cooldown, and an always-expanded zone near the
  top of the page.
- When any regrow lands, the bar forces a one-frame invisible repaint of
  the pill: its backdrop-filter keeps it permanently GPU-composited, and
  because the labels fade in during the regrow, Chromium can otherwise
  keep the mid-scale text raster (blurry labels) until an unrelated
  repaint refreshes it.

## Motion System

One grammar governs every transition:

- **Every surface grows out of the control that owns it.** Menu ← left
  circle. Search ← the bar morphs in place. Workflow sheets and the
  Export utility sheet share one launch grammar: the bar recedes (both
  circles gone, labels faded) to full width, then the sheet grows from
  that footprint. The Scan utility modal recedes the same way, but
  reveals as a circle from the pressed button's center (captured before
  it recedes) — a takeover, not a grow-from-bar.
- **Strictly serial beats.** Confirm → clear-out → geometry → title → body.
  Motions overlap only where the spec says "simultaneously."
- **Undot / dot the horizontal "i".** In any absorb, the right button pops
  out first; in any regrow, it returns last, after the bar has landed.
- **Easing:** ease-out for reveals, ease-in for collapses, a shared standard
  curve for symmetric moves. No overshoot anywhere.
- **Tempo:** all durations and delays run through a single global multiplier
  (currently 1.3×) so the whole system can be tuned by feel on device.
- **Reduced motion:** every duration and delay collapses to 0; surfaces use
  opacity-only transitions, no geometry.

## Motion Design

### Navigation

#### Opening the NavigationMenu

- The Utility button fades out.
- The Action Bar collapses right-to-left, absorbed into the left circle.
- As the bar lands, the NavigationButton's border pulses briefly (the
  same absorb cue as the scroll collapse).
- The Navigation menu expands out of the left button as the bar finishes —
  origin-based reveal (upward expansion, corner-radius settle, elevation
  rising as it clears the button).
- Within the menu, the current tab is highlighted; rows stagger in.

#### Selecting a tab

- The selected row briefly confirms the press — the highlight moves to it
  and holds (~200ms) while the menu is still up.
- Brief delay.
- The navigation menu collapses into the left button.
- The left icon simultaneously transitions to that of the newly selected tab.
- Brief delay.
- The corresponding Action Bar expands out left-to-right.
- Brief delay.
- The corresponding Utility button fades in.
- The last two motions are "dotting a horizontal i."

Closing the menu without selecting (tap the circle, Escape, tap outside)
runs the same serial close without the confirmation hold. A pending
selection is abandoned cleanly if the menu closes by another path.

### Workflow Actions

When an Action Button is clicked:

- Both Navigation & Utility circles recede simultaneously — the bar's
  clear-out, triggered by flipping `isSheetOpen`.
- Action labels — selected and unselected — fade out a beat later (the
  pressed chip keeps its select-pill state as it goes), leaving the
  full-width glass bar as the seed the sheet grows out of.
- Once `SHEET_CLEAROUT_MS` elapses, the bar is measured — its rect now
  spans the full row — and the Action Sheet mounts there. Because the
  origin is already sheet-width, the sheet's own widen beat is skipped;
  it goes straight into the vertical stretch to its initial height — a
  floating card that never welds to the viewport edge.
- The grab bar and title fade in together once the geometry lands.
- Brief delay.
- The rest of the bottom sheet content fades in.

Closing the Action Sheet reverses this order: content out, the sheet
drops to bar height and settles back onto the bar's footprint, then the
labels and both circles return together — the same simultaneous
both-ends return as search-close.

(The sheet surface itself is the lab's shared `BottomSheet` component —
`client/src/components/bottom-sheet/` — which owns the scrim, morph
beats, Escape, and drag; the bar contributes only its clear-out and the
origin rect.)

### Filtering

The filter strip claims the RIGHT button's space — the left navigation
button never moves — and the page dims behind it while it is open.

#### Bring up filter options

- The active filter control gets immediate pressed feedback.
- The RHS utility button fades out first (undotting the i).
- Its vacated width collapses so the filter control expands horizontally
  into the space; the left navigation button stays fixed.
- The selected filter label fades once the strip has landed.
- The underlying page dims slightly as the label clears — lighter than the
  sheet scrims; the bar itself stays bright.
- The filter options reveal with a light stagger, the current value
  highlighted by the measured sliding pill, visible throughout.

#### Selecting a Filter

- The selection highlight slides from the old value to the new value.
- The option labels trade colors only once the pill lands — an immediate
  recolor would make the slide's first frames read as "nothing moved."
  (`aria-checked` updates immediately; only the coloring waits for the
  choreography.)
- It holds briefly on the new value for confirmation.
- The option list fades out; the center label updates (to the new value)
  while the strip is still at full width.
- The strip contracts to its default footprint.
- The RHS utility button fades back in last (dotting the i).
- The main view runs a short content transition during the collapse.

Dismissal (tap the scrim, tap outside, Escape) runs the same serial close
without the confirmation hold or label change.

### Search

When the right utility is Search:

- Pressing Search fades out the left navigation button.
- The Search control fades out while the center action bar expands
  horizontally into a search field, taking up the full width including the
  LHS & RHS space (a right-to-left wipe, so the morph reads as one motion
  from the trigger).
- A clear (×) button appears once there's a query; a Cancel button sits at
  the field's end.
- The field receives focus and opens the keyboard — focus lands only after
  the field has reached most of its width, so the keyboard doesn't jump the
  viewport mid-morph.
- The field's focus ring is modality-gated: text inputs match
  `:focus-visible` on ANY focus (a browser heuristic, unlike buttons), so
  the bar tracks the last input modality and shows the ring only for
  keyboard-driven focus — pointer opens stay ring-free like every other
  control.
- Enter commits the query and closes the field.
- Clearing or cancelling Search restores the navigation button and
  contextual action bar in reverse order.

### Assistant

When the right utility is AI, pressing it runs the identical Search
morph — same choreography, timing bands, and focus behavior — with a
sparkle glyph and an "Ask anything…" placeholder standing in for the
magnifier. The assistant opens as a plain input, indistinguishable in
shape from Search; the bar only starts to look like a chat surface once
there's something to show.

- On first send, the input clears and the bar itself runs a real height
  animation — never `scaleY`, so text never distorts — growing from 48px
  toward fit-content. Growth reads as upward because the bar is
  bottom-anchored.
- The transcript renders above the input row, inside the same glass
  surface: the user's message right-aligned, a shimmer bubble on the
  left for the pending reply, which resolves to text in place.
- Each exchange re-measures the transcript and grows the card further,
  capped at 62% of viewport height — the old Assistant sheet's stop,
  kept on as the chat card's ceiling. Past the cap the transcript
  scrolls internally, pinned to the newest message; the cap re-clamps on
  window resize.
- Closing from the plain input mirrors Search-close exactly: the row
  wipes out on the same band while both circles return together.
- Closing a card that has STRETCHED unwinds it in reverse of how it
  grew, in four serial beats: the transcript fades → the card contracts
  back to the resting input row → the row's own contents (sparkle,
  placeholder, Cancel) fade → the bar returns exactly as it does from
  the un-stretched state. The bar is held in input mode for the first
  three beats, so that last beat is the ordinary Search-close, not a
  variant of it. Reduced motion skips the collapse entirely.
- Escape closes from anywhere inside the pill — the input or a scrolled
  transcript — a wider net than Search's input-only handler.
- The conversation is preserved for the session: closing never discards
  messages. Reopening replays two beats instead of one — the plain input
  lands first, then, a beat later, the card stretches to fit the
  restored transcript.

### Utility Action Sheet

Some utility actions are performed in a Bottom Sheet — anything that
benefits from staying attached to the current page. Export is the
remaining example; the Assistant used to share this surface but now
morphs the bar directly (see Assistant, above) — a sibling of Search
rather than a sheet.

- The Utility button shows its pressed state.
- Both the Navigation and Utility circles recede — the same clear-out as
  a Workflow Action — leaving the full-width bar as the seed the sheet
  grows out of.
- Once the clear-out completes, the bar is measured at full width and
  the Export sheet mounts there. As with Workflow Actions, the
  already-full-width origin skips the sheet's own widen beat and goes
  straight into the vertical stretch to its initial height.
- Fade in the title & "Done" button (the grab bar arrives with them).
- Brief delay.
- Fade in the rest of the bottom sheet content.

Closing or completing the workflow invokes the sequence in reverse: the
sheet drops to bar height and settles back onto the bar's footprint,
then the labels and both circles return together, mirroring
search-close.

Export is a `BottomSheet` instance too (auto height), so it carries the
component's two-stop model: a chevron header control and the grab-bar
drag extend it to full screen (94%, still a floating card) and back — no
mid heights. Drag arms only after the entrance completes; dragging down
past the threshold at the initial height dismisses. (This two-stop drag
is specific to `BottomSheet`; the Assistant's card doesn't drag — its
own 62% figure is a hard height cap, not a stop, per Assistant above.)

### Utility Modal

Some utility actions are performed in a Modal view — a focused task with
its own internal state, such as:

- Destructive or high-attention tasks
- Too wide or complex for a sheet
- Better treated as temporarily replacing the page context
- Example: invoking the camera to scan a QR code

The animation sequence:

- The Utility button shows its pressed state; its center point is
  captured now, at press time, since the button itself is about to
  recede.
- Both the Navigation and Utility circles recede — the same clear-out as
  a workflow or Export sheet.
- The modal view circle-reveals from the captured center point — a
  full-screen takeover, the one grammar that doesn't grow from the bar.

Completing or closing the modal performs the reverse sequence — the circle
contracts back to the button's center, then the labels and both
circles return together, mirroring search-close.

The Scan demo shows the modal's internal states: permission request,
denied/unavailable, and the active viewfinder.

### Dormancy

The bar is chrome until you use it. At rest, colour drains out; engage
any surface and it returns.

One scalar drives both channels: `--nav-engage`, animated from 0 (rest)
to 1 (engaged). CSS derives everything else from it in `theme/theme.css`
— the component never writes a colour.

- **The glass.** `.glass-nav`'s `backdrop-filter` saturation runs from
  `1.45` (engaged — the appearance the bar has always had) down to `0.3`
  at full dormancy, so page colour passing under the pill reads gray at
  rest and blooms back on engagement.
- **The tab glyph.** Its ink runs from the accent to `--accent-dormant`,
  a colour held at the accent's exact lightness with the chroma stripped
  (`oklch(from var(--accent-700) l 0 h)`) — so going neutral cannot change
  the icon's contrast against the circle, by construction rather than by
  hand-tuning.

Both channels are scaled by `--nav-dormancy-depth` (0 disables dormancy
entirely, 1 is the full effect above); the lab's demo exposes it as a
slider.

Engaged means any non-rest bar state: the navigation menu, the filter
strip, search, the assistant, a sheet, or a pressed action.
Scroll-collapse counts as REST — a collapsed bar is already getting out
of the way, and staying quiet there is the same intent as the dormancy
itself. A committed filter chip keeps its accent wash in every state:
dormancy never hides state, only the chrome around it.

The glass channel shipped only after a mistake got corrected. The
component used to paint a "dock wash" behind the floating cluster — a
170px gradient fading the canvas up to `--bg-canvas` so the bar read
against scrolling content. It was full-bleed while the cluster it sits
behind is a centered `max-w-lg` group, and its bottom 26% was solid
canvas colour laid exactly where the bar sits — between the page and the
glass. `backdrop-filter` was sampling the wash, not the page: a
saturation swing moved the rendered pill by 1/255, indistinguishable
from noise, which read as "the channel doesn't work." Deleting the
wash — the bar now floats directly over page content rather than over a
canvas fade — fixed the measurement: the same swing now moves 15/255.
The glass composites to roughly 90% opacity on its own, so legibility
over scrolling content doesn't depend on the wash being there.

The control panel that exposes dormancy depth, tempo, and a
reduced-motion override (`client/src/stages/DemoControls.tsx`) is a lab
affordance for this demo stage. It has no equivalent in
`NavigationBar.tsx` — copying the component elsewhere gets none of it.

## Core States

- Default (expanded)
- Collapsed on scroll
- Navigation menu open
- Workflow bottom sheet open
- Filter menu open
- Search active
- Assistant active (input, then stretched into a conversation card)
- Utility bottom sheet open (Export)
- Utility modal open (Scan)

## Visual Rules

- The accent indicates the active navigation state — reserved for navigation;
  actions are ink.
- The select-pill marks state (engaged, selected, pressed) and is
  never decorative.
- Workflow actions use verbs; icons never appear on action chips.
- Filters display the current value with a chevron menu indicator, in
  medium weight.
- Shared surface, border, highlight, and shadow treatments make all regions
  feel like one component — the sheets and modal reuse the bar's glass
  treatment so morphs read as the same object changing shape.
- Hover, pressed, focus, and disabled states are defined for every
  interactive region; loading, permission, error, and unavailable states
  are demonstrated in the utility surfaces.
