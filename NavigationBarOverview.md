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

### Left: Navigation (Nav Button or LHS Button)

- Displays the icon for the current tab (a brand logo is the no-tab fallback).
- Opens the primary navigation menu when pressed.
- The navigation menu is anchored to the circle — its bottom-left corner sits
  at the circle's center — and highlights the current tab.
- Selecting a tab closes the menu and navigates to that view.

### Center: Contextual Action (Action Bar)

The center region changes based on the current view.

#### Workflow Actions (Action Button)

- Contains one or more actions, such as Deposit and Withdraw.
- Action chips are **text-only verbs** — icons belong to the circular
  left/right buttons, never the pill.
- Chips are ghost labels at rest; the lavender select-pill appears only for
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

### Right: Utility (Utility Button, or RHS)

Contains one high-value, contextual utility per tab, such as:

- Search (the bar itself morphs into the field)
- AI assistant (bottom sheet)
- Export (bottom sheet)
- Scan (modal takeover)

## Collapsed State

When the user scrolls down, the control collapses into the left circular
button.

- The Utility button fades out first ("undotting the i").
- The Action Bar collapses right-to-left, absorbed into the left circle.
- The Navigation button continues to display the current tab icon.
- A small upward scroll expands the full control; a tap on the collapsed
  circle expands it too (opening the menu then requires a second,
  deliberate tap).
- Scroll hysteresis prevents flapping: collapsing requires a decisive
  downward pull (~56px), expanding only a small upward nudge (~16px), with
  a jitter floor, a toggle cooldown, and an always-expanded zone near the
  top of the page.

## Motion System

One grammar governs every transition:

- **Every surface grows out of the control that owns it.** Menu ← left
  circle. Workflow sheet ← center bar. Utility sheets and modals ← right
  button. Search ← the bar morphs in place.
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

#### Opening the Navigation menu

- The Utility button fades out.
- The Action Bar collapses right-to-left, absorbed into the left circle.
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

- Both Navigation & Utility buttons fade out simultaneously.
- Brief delay.
- Action labels — selected and unselected — fade out (the pressed chip
  keeps its lavender state as it goes).
- Brief delay.
- The emptied Action Bar expands horizontally outward to the bottom sheet's
  full width, staying at bar height.
- Brief delay.
- The Action Sheet grows upward & downward simultaneously to its initial
  height — a floating card that never welds to the viewport edge.
- The grab bar and title fade in together once the geometry lands.
- Brief delay.
- The rest of the bottom sheet content fades in.

Closing the Action Sheet reverses this order: content out, drop to bar
height, narrow back onto the bar's footprint, then the labels and circles
return.

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
- Enter commits the query and closes the field.
- Clearing or cancelling Search restores the navigation button and
  contextual action bar in reverse order.

### Utility Action Sheet

Some utility actions are performed in a Bottom Sheet — anything that
benefits from staying attached to the current page (Export, AI Assistant).

- The Utility button shows its pressed state.
- The Navigation button fades out.
- The Action Bar collapses inward, left edge sweeping right into the
  Utility button.
- The Utility button fades out while the Action Sheet appears by expanding
  first outward to the full width (like the recently collapsed Action Bar,
  emerging from the button's footprint).
- The Action Sheet then grows upward & downward simultaneously to its
  initial height.
- Fade in the title & "Done" button (the grab bar arrives with them).
- Brief delay.
- Fade in the rest of the bottom sheet content.

Closing or completing the workflow invokes the sequence in reverse: the
sheet lands back on the button as the button fades in beneath it, the bar
regrows out of the right side, and the navigation circle returns last.

The AI Assistant sheet additionally drags between half and full height
(drag enabled only after the entrance completes); dragging down past the
threshold at half height dismisses it.

### Utility Modal

Some utility actions are performed in a Modal view — a focused task with
its own internal state, such as:

- Destructive or high-attention tasks
- Too wide or complex for a sheet
- Better treated as temporarily replacing the page context
- Example: invoking the camera to scan a QR code

The animation sequence:

- The Utility button shows its pressed state.
- The Navigation button fades out.
- The Action Bar collapses inward from left to right.
- The Utility button fades out.
- The modal view expands as a circle from the Utility button's center point.

Completing or closing the modal performs the reverse sequence — the circle
contracts back to the button's center, then the button, bar, and
navigation circle restore in order.

The Scan demo shows the modal's internal states: permission request,
denied/unavailable, and the active viewfinder.

## Core States

- Default (expanded)
- Collapsed on scroll
- Navigation menu open
- Workflow bottom sheet open
- Filter menu open
- Search active
- Utility bottom sheet open (Export, Assistant)
- Utility modal open (Scan)

## Visual Rules

- Purple indicates the active navigation state — reserved for navigation;
  actions are ink.
- The lavender select-pill marks state (engaged, selected, pressed) and is
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
