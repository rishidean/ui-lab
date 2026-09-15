/**
 * useCollapseOnScroll — the scroll hysteresis that folds the bar to its
 * logo. Every consumer needs this wiring, so it ships with the bar.
 *
 * Collapsing requires a decisive downward pull (COLLAPSE_AFTER_PX past
 * the anchor); expanding only a small upward nudge (EXPAND_AFTER_PX).
 * Movements under MIN_SCROLL_DELTA are ignored, a short cooldown stops
 * rapid toggling around a boundary, and nothing toggles while an overlay
 * (sheet, search, assistant, utility) is open — the anchor is kept fresh
 * so closing the overlay doesn't inherit stale scroll distance. Above
 * ALWAYS_EXPANDED_ABOVE the bar is always expanded.
 *
 * Feed it your scroll container's onScroll, or adapt window scroll:
 *   window.addEventListener("scroll", () =>
 *     onScroll({ currentTarget: { scrollTop: window.scrollY } }));
 *
 * `expand()` re-anchors at the last scroll position seen.
 */
import { useCallback, useRef, useState } from "react";

const COLLAPSE_AFTER_PX = 56;
const EXPAND_AFTER_PX = 16;
const MIN_SCROLL_DELTA = 10;
const TOGGLE_COOLDOWN_MS = 350;
const ALWAYS_EXPANDED_ABOVE = 20;

export type CollapseScrollEvent = { currentTarget: { scrollTop: number } };

export function useCollapseOnScroll({
  overlayOpen,
  onChange,
}: {
  /** True while a sheet / search / assistant / utility surface is open. */
  overlayOpen: boolean;
  /** Fired when the bar collapses (true) or expands (false). */
  onChange?: (collapsed: boolean) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const anchorRef = useRef(0);
  const lastScrollTopRef = useRef(0);
  const collapsedRef = useRef(false);
  const lastToggleAtRef = useRef(0);
  const overlayRef = useRef(overlayOpen);
  overlayRef.current = overlayOpen;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const set = useCallback((next: boolean, anchor: number) => {
    collapsedRef.current = next;
    anchorRef.current = anchor;
    lastToggleAtRef.current = Date.now();
    setIsCollapsed(next);
    onChangeRef.current?.(next);
  }, []);

  const onScroll = useCallback(
    (event: CollapseScrollEvent) => {
      const scrollTop = event.currentTarget.scrollTop;
      lastScrollTopRef.current = scrollTop;

      if (scrollTop < ALWAYS_EXPANDED_ABOVE) {
        if (collapsedRef.current) set(false, scrollTop);
        anchorRef.current = scrollTop;
        return;
      }

      const delta = scrollTop - anchorRef.current;
      if (Math.abs(delta) < MIN_SCROLL_DELTA) return; // jitter

      if (overlayRef.current) {
        anchorRef.current = scrollTop;
        return;
      }

      const cooling = Date.now() - lastToggleAtRef.current < TOGGLE_COOLDOWN_MS;
      if (!collapsedRef.current) {
        if (delta > COLLAPSE_AFTER_PX && !cooling) set(true, scrollTop);
        else if (delta < 0) anchorRef.current = scrollTop; // ratchet up
      } else {
        if (delta < -EXPAND_AFTER_PX && !cooling) set(false, scrollTop);
        else if (delta > 0) anchorRef.current = scrollTop; // ratchet down
      }
    },
    [set]
  );

  const expand = useCallback(() => set(false, lastScrollTopRef.current), [set]);

  return { isCollapsed, onScroll, expand };
}
