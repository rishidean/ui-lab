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
 * it changed on cleanup (unmount), so an exit choreography stays inert
 * until the surface is gone — consumers return focus in
 * onExitComplete, which fires after cleanup.
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
