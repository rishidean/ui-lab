# Accessibility Pass — NavigationBar, BottomSheet, UtilityModal

**Date:** 2026-08-04
**Scope:** Flagship + shared surfaces: NavigationBar (menu, tabs, search,
filter strip, action chips, collapsed bar), BottomSheet, UtilityModal, and
the stage's wiring (focus return, live announcements). Other lab components
(PressAndSlidePicker, shell, other stages) are out of scope for this pass.
**Standard:** Full WAI-ARIA APG patterns for composite widgets.

## What already exists (do not rebuild)

- Escape dismissal on every surface (menu, filter strip, search, BottomSheet,
  UtilityModal).
- `role="dialog"` + `aria-modal="true"` + `aria-label` on BottomSheet and
  UtilityModal.
- Focus return for utility surfaces via the stage's `onExitComplete`
  (focuses `utilityButtonRef`), and for the menu via `closeMenu(true)`.
- One sr-only `aria-live="polite"` region in NavigationBarStage.
- Reduced-motion handling (0 durations, opacity-only surfaces).
- `aria-hidden` on decorative icons; `aria-label` on icon-only controls
  (utility button, clear search, close, expand/collapse, collapsed bar).

## 1. Modal containment — `inert`

New hook `useInertOutside(ref, active)` in `client/src/lib/a11y.ts`:

- While `active` and the ref is mounted, climb from the dialog element to
  `document.body`; at each level set the `inert` attribute on every sibling
  that doesn't already have it. Record which elements were changed; restore
  exactly those on cleanup.
- Native `inert` provides focus containment, click blocking, and
  screen-reader hiding in one attribute. No keydown Tab-cycling trap.
- The hook stays active through the exit choreography (cleanup on unmount).
  Focus return happens in the consumer's `onExitComplete`, which fires after
  unmount — i.e. after `inert` is lifted — so return focus always lands on a
  focusable element.
- `a11y.ts` becomes a documented file dependency of BottomSheet and
  UtilityModal (like `theme.css`); registry usage snippets list it.

## 2. BottomSheet + UtilityModal

- Both call `useInertOutside` on their dialog element.
- Initial focus: the dialog container gets `tabIndex={-1}` and is focused on
  mount, so screen readers announce the `aria-label` immediately without
  interfering with the entrance choreography. No autofocus of inner
  controls (skeleton bodies have none).
- Everything else (role, aria-modal, Escape, scrim, drag) unchanged.

## 3. NavigationMenu — APG menu pattern

- Trigger (NavigationButton): `aria-haspopup="menu"`, `aria-expanded`,
  `aria-controls` pointing at the menu's id.
- Menu container: `role="menu"`; rows: `role="menuitem"`.
- Roving tabindex: exactly one item has `tabIndex=0` (the active tab's row
  on open; focus moves there when the menu opens). ArrowDown/ArrowUp cycle
  with wraparound; Home/End jump to first/last. Enter/Space activate
  (native button behavior).
- Escape close + focus return to NavigationButton already exist.
- Roving-focus logic lives in-file in NavigationBar.tsx (drop-in-first rule:
  only the menu needs it; no shared abstraction).

## 4. Filter strip — radiogroup

- Filter chip: `aria-expanded` reflecting `isFilterExpanded`.
- Options row: `role="radiogroup"` with `aria-label` from the filter
  action's label. Options: `role="radio"` + `aria-checked`.
- Roving tabindex with ArrowLeft/ArrowRight (and ArrowUp/ArrowDown as
  synonyms), wraparound; focus moves to the currently-selected option when
  the strip opens. Arrow keys move focus only; Enter/Space select — selection
  triggers the confirm-hold choreography, so focus-follows-selection would
  fire it on every keystroke.
- Escape dismissal exists; add focus return to the filter chip on close
  (currently missing). Selection close also returns focus to the chip.

## 5. Triggers, search, utility button

- Utility button: `aria-haspopup="dialog"`, `aria-expanded` true while its
  sheet/modal is up.
- Search: wrapper gets `role="search"`; input keeps its delayed focus (timed
  to the morph). On close (Escape or clear-out), focus returns to the
  utility button — search is opened via `onUtilityClick` in the stage, so
  the utility button is the origin control. Input gets an `aria-label`.
- Collapsed bar button: labeled already; no change.

## 6. Focus visibility

- Add `:focus-visible` ring styles using existing theme tokens (e.g.
  `--select-bg` / border tokens) to: NavigationButton, UtilityButton, action
  chips, filter chip, filter options, menu items, tab rows, Done, expand
  chevron, close buttons, search input/clear.
- `:focus-visible` only — mouse/touch interaction visuals unchanged.
- Rings must not alter layout (box-shadow or outline-offset, no border-width
  changes) so frame captures stay pixel-identical for pointer flows.

## 7. Announcements

- Extend the stage's existing sr-only live region: announce tab changes
  ("<Tab> selected") and filter application ("Filtered by <option>").
  Nothing else — no announcement of open/close (dialog semantics already
  cover that).

## 8. Verification

- `pnpm check` (tsc) + `pnpm build`.
- Headless Playwright keyboard scripts (in /tmp/pw, per house convention):
  1. Open each sheet/modal, Tab repeatedly, assert focus never lands
     outside the dialog.
  2. Menu: open, assert focus on active item; arrow through all items with
     wraparound; Home/End; Enter selects; Escape returns focus to the
     NavigationButton.
  3. Filter: open, assert focus on selected radio; arrow roving; Enter
     selects and focus returns to chip; Escape dismisses and returns focus.
  4. Search open/close focus return.
- Frame captures at the usual timestamps to confirm the choreography is
  visually unchanged.

## Out of scope

- Other lab components and the shell (theme toggle, registry nav).
- Screen-reader-specific tuning beyond ARIA correctness (no VoiceOver
  scripting).
- Focus trapping via keydown interception (superseded by `inert`).
