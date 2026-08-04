/**
 * Shared a11y helpers for Rishi's UI Lab dialogs.
 * Part of Rishi's UI Lab — © 2026 Rishi Dean (rishidean.com)
 * MIT license · github.com/rishidean/ui-lab
 *
 * Copy this file alongside BottomSheet / UtilityModal — it is a file
 * dependency of both, the way theme/theme.css is.
 */
import { useEffect } from "react";
import type React from "react";

/**
 * While `active`, everything in the document EXCEPT the elements in
 * `keepRefs` (and their ancestors/descendants) is made `inert` — native
 * focus containment, click blocking, and screen-reader hiding in one
 * attribute. Climbs from the first kept element to document.body,
 * inerting each level's other siblings. Restores exactly the elements
 * it changed on cleanup (unmount).
 *
 * Timing note for consumers: that cleanup runs in the exiting surface's
 * own passive-effect teardown, which is NOT guaranteed to have committed
 * by the time an owning `<AnimatePresence onExitComplete>` fires — in
 * practice `onExitComplete` can run a frame or more before the `inert`
 * lid actually lifts. A same-tick `el.focus()` on the origin control in
 * `onExitComplete` can therefore land on a still-inert element and
 * silently no-op. Use `focusWhenClear` below to return focus safely
 * instead of calling `.focus()` directly.
 */
export function useInertOutside(
  active: boolean,
  ...keepRefs: React.RefObject<HTMLElement | null>[]
) {
  useEffect(() => {
    if (!active) return;
    const kept = keepRefs
      .map(r => r.current)
      .filter((el): el is HTMLElement => el !== null);
    if (kept.length === 0) return;
    const changed: Element[] = [];
    let node: HTMLElement = kept[0];
    while (node.parentElement && node !== document.body) {
      const parent = node.parentElement;
      for (const sibling of Array.from(parent.children)) {
        if (sibling === node) continue;
        if (kept.some(k => sibling === k || sibling.contains(k))) continue;
        if (sibling.hasAttribute("inert")) continue;
        sibling.setAttribute("inert", "");
        changed.push(sibling);
      }
      node = parent;
    }
    return () => {
      for (const el of changed) el.removeAttribute("inert");
    };
    // keepRefs are stable RefObjects; contents are read inside the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

/**
 * Focus `el` once it is no longer covered by an `[inert]` ancestor,
 * polling up to `attempts` animation frames before giving up silently.
 *
 * Pair with `useInertOutside`: call this from an owning
 * `<AnimatePresence onExitComplete>` to return focus to the control
 * that opened a sheet/modal. `onExitComplete` can fire before the
 * exiting surface's `useInertOutside` cleanup commits (see the timing
 * note above), so a same-tick `el.focus()` there can silently no-op —
 * this polls instead of guessing a fixed delay. Always resolves to
 * `{ preventScroll: true }`, per this lab's focus-management contract.
 */
export function focusWhenClear(el: HTMLElement | null, attempts = 5) {
  if (!el) return;
  if (!el.closest("[inert]")) {
    el.focus({ preventScroll: true });
    return;
  }
  if (attempts <= 0) return;
  requestAnimationFrame(() => focusWhenClear(el, attempts - 1));
}
