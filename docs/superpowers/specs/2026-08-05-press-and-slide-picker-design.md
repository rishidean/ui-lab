# PressAndSlidePicker: Functional Spec

**Component:** `PressAndSlidePicker`
**Author:** Rishi Dean
**Status:** Implemented, shipping in personal projects
**Reference model:** Facebook/Meta Reactions picker

---

## Why this exists

The most frequent operation in a task management tool is changing status. In every task app I've used, that operation is a dropdown: tap to open, scan the options, tap to select. Three discrete actions, a modal overlay that obscures the list, and a context switch that breaks whatever flow you were in. For something you do dozens of times a day, that tax compounds.

PressAndSlidePicker replaces the dropdown with a single continuous gesture. Long-press a status chip, slide your finger to the new status, release. One motion, roughly one second, no overlay. The task list stays visible the entire time.

The interaction model comes directly from Facebook's Reactions picker, where you long-press the Like button and slide to the reaction you want. That's the only precedent I know of for this pattern, and there's no component library implementation of it. This is custom.

## What it's for

Any small, finite set of mutually exclusive options that changes frequently. The component is generic; it doesn't know about tasks. Three applications so far:

- **Status** (To Do → In Progress → Delegated → Done)
- **Priority** (Low → Medium → High → Critical)
- **T-shirt sizing** (XS → S → M → L → XL)

The sweet spot is 3-6 options. Below 3, a toggle is simpler. Above 6, the strip gets too wide for comfortable thumb reach on a phone, and the item widths start compressing. The component handles compression gracefully (auto-shrinks items to a 40px floor), but the interaction starts to suffer.

## Design principles

### Speed over ceremony

The entire point is eliminating friction from a high-frequency action. Every design decision serves that. The 275ms long-press threshold is tuned to be fast enough for power users while staying below the accidental-trigger line. The strip animates in over 280ms with a spring curve that reads as intentional but doesn't make you wait. The dismiss takes 150ms. Total round-trip from press to commit is under two seconds.

### Flow preservation

Nothing leaves the page. The strip renders as a fixed overlay directly below (or above) the triggering chip. No modal, no dropdown menu that covers other tasks, no navigation to a detail view. Your eyes stay on the task list. You can see the task title while you're changing its status. That matters more than it sounds like it should.

### One gesture, not three

The press-and-slide is a single continuous touch event. Your finger goes down, the strip appears, you slide to the option, your finger comes up. You never lift to tap a second target. The gesture has the same feel as scrubbing a video timeline or adjusting a slider; it's manipulation, not navigation.

### The tap fallback

Not every interaction is a long-press. Sometimes you just want to tap. Tapping the chip opens the same option strip as a static menu, and you tap the option you want. Two taps instead of one gesture; still faster than a dropdown because there's no scroll, no search, no animation delay on open. The fallback also covers desktop use (click-hold + drag simulates the gesture, but a simple click opens the menu).

## Interaction contract

### Gesture mode (primary)

1. User touches a chip and holds for 275ms.
2. A dark floating strip appears below the chip showing all options horizontally.
3. The current value is pre-highlighted. The strip does not jump to whatever is under the finger; selection only begins tracking once the finger enters the strip's hit zone.
4. Sliding horizontally across the strip changes the active selection. Each boundary crossing fires a light haptic pulse.
5. Releasing the finger commits the active selection. If the value changed, a heavy haptic confirms it.
6. Dragging vertically away from the strip (36px threshold) cancels without committing.

### Tap mode (fallback)

1. User taps the chip (no hold).
2. The same option strip appears as a fixed menu below the chip.
3. User taps the desired option.
4. Tapping outside the menu dismisses it without changing the value.

### Keyboard

Arrow keys navigate options. Enter or Space selects. Escape dismisses.

## Positioning logic

Both the gesture strip and the tap fallback use viewport-clamped fixed positioning:

- The strip centers horizontally on the triggering chip, then clamps to stay within 8px of both viewport edges.
- If the strip is wider than the viewport (narrow phones, many options), individual item widths shrink proportionally down to a 40px floor. Font size drops from 11px to 10px when items go below 60px.
- Vertical placement prefers below the chip. If there isn't room below, it flips above.
- The tap fallback uses the same clamping logic, measuring its own expected width and applying the same edge constraints.

## Visual design

### The chip (trigger)

An inline pill showing a colored dot and the current option label. Background is the option's `bg` color (light tint); text and dot are the option's `color`. When the gesture strip is active, the chip gets a colored border to indicate engagement.

### The strip (overlay)

Dark translucent background (`rgba(28,28,30, 0.96)`) with a 20px backdrop blur. 16px border radius. Shadow with 40px blur for depth separation. Each option zone is `itemWidth` pixels wide (default 80, configurable) with a colored dot, a label, and a subtle dot indicator on the current value. The active option gets a filled background in its color and scales up 7%.

### Animation

Entrance: 3-keyframe sequence over 280ms. Scales from 88% to 102% (overshoot) to 100%, with 8px of vertical travel. The overshoot creates a spring feel that reads as physical without being bouncy. Exit: 150ms scale-down to 95% with 4px drop and fade. `prefers-reduced-motion` disables both.

### Color system

Colors are per-option, passed through the `options` array. Each option defines a `color` (primary, used for dots, text, active backgrounds) and an optional `bg` (light tint for the chip's resting state). Pre-built sets are exported for convenience:

| Set                | Options                             | Colors                        |
| ------------------ | ----------------------------------- | ----------------------------- |
| `STATUS_OPTIONS`   | To Do, In Progress, Delegated, Done | Gray, Blue, Purple, Green     |
| `PRIORITY_OPTIONS` | Low, Medium, High, Critical         | Gray, Orange, Red, Pink       |
| `SIZE_OPTIONS`     | XS, S, M, L, XL                     | Gray, Cyan, Blue, Purple, Red |

## Gesture discrimination

The component handles several conflict scenarios:

- **Scroll vs. long-press.** If the finger moves more than 10px in any direction during the 275ms hold window, the long-press is canceled and the touch passes through to the scroll handler.
- **Enter-gate.** After the strip opens, selection tracking doesn't begin until the finger physically enters the strip's hit zone. This prevents the strip from jumping to whatever option happens to be under the finger at the moment it appears.
- **Halo zones.** The strip's hit zone extends 8px horizontally and 16px vertically beyond its visual bounds. This forgiveness zone makes it easier to slide into and stay within the strip on imprecise touches.
- **Escape-Y cancel.** If the finger moves more than 36px vertically away from the starting point while outside the strip zone, the gesture cancels. This is the "I changed my mind" bail-out.
- **Suppressed click.** After a long-press gesture, the subsequent click event is suppressed so it doesn't also open the tap fallback.

## API

```jsx
import { PressAndSlidePicker, STATUS_OPTIONS } from "./PressAndSlidePicker";

<PressAndSlidePicker
  options={STATUS_OPTIONS} // Array<{ key, label, color, bg? }>
  value="in_progress" // Currently selected key
  onChange={key => {}} // Fires on commit
  itemWidth={80} // Strip item width in px (default: 80)
  longPressDuration={275} // Hold threshold in ms (default: 275)
  renderChip={(option, isActive) => <CustomChip />} // Optional
/>;
```

The `renderChip` prop lets you replace the default pill with a custom trigger element. The component manages all gesture handling, positioning, and state; your custom chip just needs to render.

## Implementation notes

- **Singleton styles.** One `<style data-psp>` tag injected into the document head on first render, no matter how many picker instances exist. Avoids the N-duplicate-style-blocks problem.
- **No portal dependency.** Uses inline `position: fixed` instead of `createPortal`. Works in any React environment, including sandboxed previews and artifact renderers that don't expose `react-dom`.
- **Stable refs.** `onChange`, `value`, and `options` are stored in refs and read inside event handlers. This prevents stale closures in the touch/mouse event listeners without requiring them in dependency arrays.
- **Body scroll lock.** `document.body.style.overflow = "hidden"` during gesture to prevent the page from scrolling while the user slides across the strip. Restored on dismiss.
- **Haptic API.** Uses `navigator.vibrate()` with duration-coded intensity (6ms light, 12ms medium, 20ms heavy). Works on Android/Chrome. No-ops silently on iOS Safari, which doesn't support the Vibration API; real iOS haptics would require a native bridge.
- **Zero external dependencies.** React only. No animation libraries, no gesture libraries, no positioning libraries.

## What this doesn't do (yet)

- **Reorder options.** The set is static. Drag-to-reorder within the strip isn't a goal.
- **Multi-select.** This is a single-value picker. Tags or multi-select have different interaction needs.
- **Nested options.** No sub-menus, no hierarchy. The strip is flat by design.
- **Animated value transitions.** When the chip updates after a commit, it snaps to the new color. A brief color-morph transition could make the commit feel more connected to the gesture.
