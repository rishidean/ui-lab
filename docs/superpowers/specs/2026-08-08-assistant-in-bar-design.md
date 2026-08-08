# NavigationBar Assistant Mode: Design Spec

**Component:** `NavigationBar` (assistant mode)
**Author:** Rishi Dean
**Status:** Approved design, not yet implemented
**Replaces:** The "AI" utility's draggable `BottomSheet` (62% height) in the demo stage

---

## Why this exists

The NavigationBar's premise is one morphing surface: navigation, actions, and utilities all grow out of the bar rather than appearing over it. Search honors that — the bar itself becomes the search field. The assistant doesn't: pressing "AI" runs the utility clear-out and mounts a separate bottom sheet, a different surface with different physics.

This change makes the assistant a sibling of search. Pressing the AI utility morphs the bar into a chat input using the exact search grammar. On the first send, the bar itself stretches upward into a conversation card — the same glass element, taller. Each exchange grows it further until it hits a ceiling and scrolls internally. Closing contracts it back down into the action bar. Every button press morphs the bar directly into the context you need; nothing is layered on top.

## Decisions already made

These were settled in brainstorming and are not open questions:

- **Open morph mirrors search exactly** — same choreography, timing bands, and focus behavior. Only the glyph (sparkle), placeholder ("Ask anything…"), and transcript differ.
- **The bar itself stretches** into the chat card — a real height animation on the center pill, not an attached panel and not a hand-off to a sheet.
- **Stretch begins on first send**, not on open. The assistant opens as a plain input, indistinguishable in shape from search.
- **Conversation is preserved for the session.** Closing never discards messages; reopening restores and re-stretches.
- **The assistant BottomSheet is deleted** from the demo stage, along with its ghost-bubble content and the `openUtilitySheet("assistant")` routing.

## Component API

Assistant mode is shaped exactly like search mode: the consumer owns the open flag and the data; the component owns every pixel of the morph.

```ts
// New NavigationBar props
isAssistantOpen?: boolean;
onAssistantClose?: () => void;
onAssistantSubmit?: (text: string) => void;
assistantMessages?: AssistantMessage[];
assistantPlaceholder?: string; // default "Ask anything…"

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Renders the shimmer/typing bubble; aria-hidden until text lands. */
  pending?: boolean;
};
```

**Ownership split.** The consumer flips `isAssistantOpen`, appends the user's message when `onAssistantSubmit` fires, and produces replies however it likes (the demo stage fakes them with a canned delay; a real app streams them by updating the array). The component renders the input row, Cancel, the transcript, and runs the stretch choreography. Persistence falls out for free: the consumer keeps `assistantMessages` across closes.

**Exclusivity.** Assistant mode follows search's rules: opening it closes the menu, the filter strip, and search; sheets and takeovers can't open while it's up; scroll-collapse is disabled while open (stage's `overlayOpenRef` gains the flag). Tab change closes the assistant, as it does search — the transcript survives because the consumer holds it.

## Choreography

All timings run through the existing `dur`/`del` helpers (× `TEMPO`, collapsed to 0 under reduced motion) and reuse the established bands: direct interactions 180–240ms, full transforms 240–320ms.

### Open — identical to search

Both circles recede (left width → 0, utility width → 0), the assistant row wipes in right-to-left from the utility button's edge (`clipPath`, 0.24 band + 0.06 delay), and focus lands after the field has mostly widened (~220ms × TEMPO) so the mobile keyboard never jumps mid-morph. Row content, left to right: sparkle glyph (where search's magnifier sits), the input, a Clear × when there's text, Cancel. Pixel-for-pixel search otherwise.

### First send

The message commits, the input clears, and the pill animates its **height** from 48px toward fit-content — a real height animation, never `scaleY`, so text doesn't distort. Growth is upward automatically because the bar is bottom-anchored. Border-radius stays at the pill's constant; the card reading comes from proportions. The transcript renders above the input row inside the same `glass-nav` element: the user bubble right-aligned, then a pending shimmer bubble. Growth uses the full-transform band (≈0.3s, `EASE_OUT`) — the same weight class as the search morph itself.

### Each exchange

Transcript content height is measured (ref + ResizeObserver, the filter-highlight pattern) and the pill animates to the new height per message, capped at **62% of viewport height** — the old sheet's height, kept as the ceiling. Past the cap the transcript scrolls internally, pinned to the newest message. New bubbles fade and rise in ~20px on the direct band. The cap re-clamps on window resize so rotation doesn't strand an over-tall card.

### Close — serial beats, reversing the grammar

1. Transcript fades out.
2. The card contracts down onto the input row (`EASE_IN`).
3. The standard search-close runs: row wipes out, circles return, focus returns to the utility button.

Geometry then labels; nothing fades while moving.

### Reopen with history

Two beats, not one: the normal open morph lands the plain input bar first, then — a beat later — the card stretches to fit the preserved transcript. Every open looks the same; the history arrives as a second movement.

## Accessibility

- The input reuses search's focus machinery verbatim: programmatic focus after the widen, `data-kbd` keyboard-modality ring, focus returned to the utility button on close via the existing falling-edge effect extended to assistant mode.
- The transcript is a `role="log"` region with `aria-live="polite"`. Replies are announced when their text lands; the pending bubble is `aria-hidden` until then, so shimmer states don't spam screen readers.
- Escape closes from anywhere inside the pill (input or scrolled transcript) — the menu/filter pattern, not search's input-only handler.
- Like search, the utility button unmounts during the mode, so it carries no `aria-expanded`.

## Edge cases

- Empty or whitespace-only submits are ignored (trimmed).
- Cancel mid-pending closes immediately; the consumer's reply still lands in the array and appears on reopen.
- Rapid open/close retargets from current animated values (framer default); nothing snaps.
- Reduced motion: every duration and delay is 0; height changes are instant.

## Demo stage changes

- The "AI" utility branch flips `isAssistantOpen` instead of calling `openUtilitySheet("assistant")`.
- The stage owns `assistantMessages` state and fakes replies: on submit, append the user message plus a pending assistant bubble, then resolve it with canned text after a short delay (long enough that the pending → reply → stretch beat is visible).
- The assistant `BottomSheet` block, its ghost bubbles, and any now-unused CSS are deleted. Export and Scan keep their existing surfaces untouched.

## Verification

No test suite exists in this repo. Verification is a clean TypeScript build plus a browser pass on the dev server covering: open/close symmetry with search, first-send stretch, multi-exchange growth to the cap and internal scroll, reopen-with-history two-beat, Escape / Cancel / tab-change closes, reduced-motion instant states, and dark mode.
