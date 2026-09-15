/**
 * PressAndSlidePicker
 * Part of Rishi's UI Lab — © 2026 Rishi Dean (rishidean.com)
 * MIT license · github.com/rishidean/ui-lab
 *
 * Facebook Reactions-style press-and-slide gesture picker.
 * Long-press a chip -> slide to an option -> release. Tap opens the same
 * strip as a static listbox fallback; keyboard gets arrows/Enter/Escape.
 *
 * Mount contract: the strip, fallback listbox, and click-away overlay are
 * portaled to document.body. The original spec avoided portals for
 * artifact-renderer portability; in the lab a portal is required so
 * `position: fixed` resolves against the real viewport — a transformed
 * ancestor (e.g. a scaled demo stage) would otherwise become the
 * containing block and re-base the strip far from the chip.
 *
 * Surfaces take the lab's `.glass-overlay` treatment (theme/glass.css) and the
 * site motion grammar (EASE family, TEMPO) — no overshoot.
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "./lib";
import "./PressAndSlidePicker.css";

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface PickerOption {
  /** Unique identifier used as the value */
  key: string;
  /** Display text shown in the chip and strip */
  label: string;
  /** Primary color (dot, text, active background) — hex string */
  color: string;
  /** Chip background color when inactive — hex string */
  bg?: string;
}

export interface PressAndSlidePickerProps {
  /** Array of selectable options */
  options: PickerOption[];
  /** Currently selected option key */
  value: string;
  /** Fires with the new key when selection changes */
  onChange: (key: string) => void;
  /** Width of each option zone in the strip, in px (default: 80) */
  itemWidth?: number;
  /** Long-press threshold in ms before gesture activates (default: 275) */
  longPressDuration?: number;
  /** Custom chip renderer. Receives the current option and whether the strip is active */
  renderChip?: (option: PickerOption, isActive: boolean) => ReactNode;
  /** Whether the picker is disabled */
  disabled?: boolean;
}

interface StripState {
  anchorRect: DOMRect;
  activeIndex: number;
  currentIndex: number;
}

// ═══════════════════════════════════════════
// Haptics
// ═══════════════════════════════════════════

function haptic(style: "light" | "medium" | "heavy" = "light") {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(style === "heavy" ? 20 : style === "medium" ? 12 : 6);
  }
}

// ═══════════════════════════════════════════
// Motion — site grammar (see NavigationBar)
// ═══════════════════════════════════════════

const EASE = "cubic-bezier(0.2, 0, 0, 1)"; // symmetric: item highlight
const EASE_OUT = "cubic-bezier(0, 0, 0.2, 1)"; // reveals: strip/fallback in
const EASE_IN = "cubic-bezier(0.4, 0, 1, 1)"; // collapses: strip out
const TEMPO = 1.3;
const DUR = { stripIn: 0.2, stripOut: 0.14, item: 0.14 };

/** Stamped on the portal roots so the CSS reads the same table. */
const MOTION_VARS = {
  "--psp-dur-in": `${DUR.stripIn * TEMPO}s`,
  "--psp-dur-out": `${DUR.stripOut * TEMPO}s`,
  "--psp-dur-item": `${DUR.item * TEMPO}s`,
  "--psp-ease": EASE,
  "--psp-ease-out": EASE_OUT,
  "--psp-ease-in": EASE_IN,
} as CSSProperties;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// ═══════════════════════════════════════════
// Layout constants
// ═══════════════════════════════════════════

const C = {
  stripGap: 2,
  padX: 4,
  padY: 4,
  itemH: 34,
  vpPad: 8,
  haloX: 8,
  haloY: 16,
  escY: 36,
  // Thumb magnetism: while sliding, the pill follows the finger but is
  // pulled toward the nearest slot's centre — 0 would be a free slider,
  // 1 would be the old discrete hop. It locks fully on lift or leave.
  thumbPull: 0.35,
  // JS unmount timer must match the CSS exit animation, or the exit gets
  // clipped/overrun whenever TEMPO is retuned.
  dismissMs: Math.round(DUR.stripOut * TEMPO * 1000),
};

// ═══════════════════════════════════════════
// Viewport-aware positioning
// ═══════════════════════════════════════════

/** Left edge of slot `i` inside the strip's border box. */
function slotLeft(i: number, iw: number) {
  return C.padX + i * (iw + C.stripGap);
}

function metrics(anchor: DOMRect, n: number, iw: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxStripW = vw - C.vpPad * 2;
  const idealW = n * iw + (n - 1) * C.stripGap + C.padX * 2;
  let effectiveIw = iw;
  if (idealW > maxStripW) {
    effectiveIw = Math.max(
      40,
      Math.floor((maxStripW - C.padX * 2 - (n - 1) * C.stripGap) / n)
    );
  }
  const sw = n * effectiveIw + (n - 1) * C.stripGap + C.padX * 2;
  const chipCenterX = anchor.left + anchor.width / 2;
  let left = chipCenterX - sw / 2;
  left = Math.max(C.vpPad, Math.min(left, vw - sw - C.vpPad));
  const sh = C.itemH + C.padY * 2;
  const below = vh - anchor.bottom;
  const top =
    below >= sh + C.stripGap || below >= anchor.top
      ? anchor.bottom + C.stripGap
      : Math.max(C.vpPad, anchor.top - sh - C.stripGap);
  return { left, top, sw, sh, effectiveIw };
}

// ═══════════════════════════════════════════
// Strip (gesture mode)
// ═══════════════════════════════════════════

interface StripProps {
  stripRef: React.RefObject<HTMLDivElement | null>;
  anchor: DOMRect | null;
  options: PickerOption[];
  activeIndex: number;
  currentIndex: number;
  iw: number;
  dismissing: boolean;
}

function Strip({
  stripRef,
  anchor,
  options,
  activeIndex,
  currentIndex,
  iw,
  dismissing,
}: StripProps) {
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const n = options.length;
  const m = anchor ? metrics(anchor, n, iw) : null;
  const restX = m ? slotLeft(activeIndex, m.effectiveIw) : 0;
  // Mount only: after that the pointer handlers own the transform.
  useLayoutEffect(() => {
    if (thumbRef.current) thumbRef.current.style.transform = `translateX(${restX}px)`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!anchor || !m) return null;
  const { left, top, effectiveIw } = m;
  return (
    <div
      ref={stripRef}
      className={cn("glass-overlay psp-strip", dismissing && "psp-strip--out")}
      style={{
        ...MOTION_VARS,
        left,
        top,
        gap: C.stripGap,
        padding: `${C.padY}px ${C.padX}px`,
      }}
    >
      {/* One pill slides under the labels (transform is written straight
          to the DOM by the pointer handlers, so it never fights React);
          only its hue is React-driven, crossfading as the finger crosses
          an option. Its resting slot is set once on mount. */}
      <div
        ref={thumbRef}
        className="psp-thumb"
        style={
          {
            width: effectiveIw,
            height: C.itemH,
            top: C.padY,
            "--psp-option-color": options[activeIndex]?.color,
          } as CSSProperties
        }
      />
      {options.map((o, i) => {
        const act = i === activeIndex;
        const cur = i === currentIndex;
        return (
          <div
            key={o.key}
            data-idx={i}
            className={cn(
              "psp-item",
              act && "psp-item--active",
              cur && "psp-item--current",
              effectiveIw < 60 && "psp-item--compact"
            )}
            style={
              {
                width: effectiveIw,
                height: C.itemH,
                "--psp-option-color": o.color,
              } as CSSProperties
            }
          >
            <div className="psp-item__dot" />
            <span className="psp-item__label">{o.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════
// DefaultChip
// ═══════════════════════════════════════════

function DefaultChip({
  option,
  isActive,
}: {
  option: PickerOption;
  isActive: boolean;
}) {
  return (
    <span
      className={cn("psp-chip-pill", isActive && "psp-chip-pill--engaged")}
      style={{ "--psp-option-color": option.color } as CSSProperties}
    >
      <span className="psp-chip-pill__dot" />
      {option.label}
    </span>
  );
}

// ═══════════════════════════════════════════
// PressAndSlidePicker
// ═══════════════════════════════════════════

export function PressAndSlidePicker({
  options,
  value,
  onChange,
  itemWidth = 80,
  longPressDuration = 275,
  renderChip,
  disabled = false,
}: PressAndSlidePickerProps) {
  const optionIndexMap = useMemo(
    () => Object.fromEntries(options.map((o, i) => [o.key, i])),
    [options]
  );
  const currentIndex = optionIndexMap[value] ?? 0;
  const currentOption = options[currentIndex];

  const chipRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const fallbackRefs = useRef<(HTMLElement | null)[]>([]);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hold affordance: while the long-press timer runs, the chip carries
  // data-priming and a ring sweeps around it over exactly the hold time,
  // so a first-time user sees the hold registering (the honest weakness
  // of press-and-slide is that nothing says "hold"). Cleared whenever the
  // timer is — move, lift, cancel — and when the strip opens.
  const hold = useRef({ arm: () => {}, disarm: () => {} });
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIdx = useRef(currentIndex);
  const anchorRect = useRef<DOMRect | null>(null);
  const isOpenRef = useRef(false);
  const enteredStrip = useRef(false);
  const touchId = useRef<number | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const suppressClick = useRef(false);
  // Track window-level mouse listeners for cleanup on unmount
  const windowMouseMove = useRef<((e: MouseEvent) => void) | null>(null);
  const windowMouseUp = useRef<(() => void) | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const optionsRef = useRef(options);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const [stripState, setStripState] = useState<StripState | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [fallbackFocusIdx, setFallbackFocusIdx] = useState(currentIndex);
  const sliding = stripState !== null;

  useEffect(() => {
    if (!sliding) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sliding]);
  useEffect(
    () => () => {
      hold.current.disarm();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      // Clean up any dangling window-level mouse listeners (unmount mid-drag)
      if (windowMouseMove.current)
        window.removeEventListener("mousemove", windowMouseMove.current);
      if (windowMouseUp.current)
        window.removeEventListener("mouseup", windowMouseUp.current);
    },
    []
  );
  useEffect(() => {
    if (fallbackOpen) {
      const btn = fallbackRefs.current[fallbackFocusIdx];
      if (btn) btn.focus();
    }
  }, [fallbackOpen, fallbackFocusIdx]);

  const indexAtX = useCallback(
    (x: number): number | null => {
      const strip = stripRef.current;
      if (strip) {
        const els = Array.from(
          strip.querySelectorAll<HTMLElement>("[data-idx]")
        );
        for (const el of els) {
          const rect = el.getBoundingClientRect();
          if (x >= rect.left - 4 && x <= rect.right + 4)
            return +el.dataset.idx!;
        }
        return null;
      }
      const anchor = anchorRect.current;
      if (!anchor) return null;
      const { left, effectiveIw } = metrics(anchor, options.length, itemWidth);
      for (let i = 0; i < options.length; i++) {
        const l = left + C.padX + i * (effectiveIw + C.stripGap);
        if (x >= l - 4 && x <= l + effectiveIw + 4) return i;
      }
      return null;
    },
    [options.length, itemWidth]
  );

  const isInZone = useCallback(
    (x: number, y: number): boolean => {
      const strip = stripRef.current;
      if (strip) {
        const rect = strip.getBoundingClientRect();
        return (
          x >= rect.left - C.haloX &&
          x <= rect.right + C.haloX &&
          y >= rect.top - C.haloY &&
          y <= rect.bottom + C.haloY
        );
      }
      const anchor = anchorRect.current;
      if (!anchor) return false;
      const { left, top, sw, sh } = metrics(anchor, options.length, itemWidth);
      return (
        x >= left - C.haloX &&
        x <= left + sw + C.haloX &&
        y >= top - C.haloY &&
        y <= top + sh + C.haloY
      );
    },
    [options.length, itemWidth]
  );

  // The sliding pill. trackThumb follows the finger (magnetised toward
  // the nearest slot); settleThumb locks it into a slot with the longer
  // ease — on lift, on leaving the zone, and while the strip dismisses.
  const thumbEl = () =>
    stripRef.current?.querySelector<HTMLElement>(".psp-thumb") ?? null;
  const trackThumb = useCallback(
    (x: number) => {
      const strip = stripRef.current;
      const el = thumbEl();
      const anchor = anchorRect.current;
      if (!strip || !el || !anchor || prefersReducedMotion()) return;
      const n = options.length;
      const { effectiveIw: iw } = metrics(anchor, n, itemWidth);
      const pitch = iw + C.stripGap;
      const lx = x - strip.getBoundingClientRect().left;
      const i = Math.max(0, Math.min(n - 1, Math.round((lx - C.padX - iw / 2) / pitch)));
      const center = slotLeft(i, iw) + iw / 2;
      const pulled = center + (lx - center) * C.thumbPull;
      const left = Math.max(C.padX, Math.min(slotLeft(n - 1, iw), pulled - iw / 2));
      el.classList.remove("psp-thumb--settle");
      el.style.transform = `translateX(${left}px)`;
    },
    [options.length, itemWidth]
  );
  const settleThumb = useCallback(
    (idx: number) => {
      const el = thumbEl();
      const anchor = anchorRect.current;
      if (!el || !anchor) return;
      const { effectiveIw: iw } = metrics(anchor, options.length, itemWidth);
      el.classList.add("psp-thumb--settle");
      el.style.transform = `translateX(${slotLeft(idx, iw)}px)`;
    },
    [options.length, itemWidth]
  );

  const openStrip = useCallback(() => {
    if (!chipRef.current || disabled) return;
    const rect = chipRef.current.getBoundingClientRect();
    const idx = optionIndexMap[valueRef.current] ?? 0;
    anchorRect.current = rect;
    activeIdx.current = idx;
    isOpenRef.current = true;
    enteredStrip.current = false;
    suppressClick.current = true;
    setFallbackOpen(false);
    haptic("medium");
    setStripState({ anchorRect: rect, activeIndex: idx, currentIndex: idx });
    setDismissing(false);
  }, [optionIndexMap, disabled]);
  hold.current = {
    arm: () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      chipRef.current?.setAttribute("data-priming", "");
      longPressTimer.current = setTimeout(() => {
        chipRef.current?.removeAttribute("data-priming");
        openStrip();
      }, longPressDuration);
    },
    disarm: () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      chipRef.current?.removeAttribute("data-priming");
    },
  };

  const updateActive = useCallback((idx: number | null) => {
    if (idx === null || idx === activeIdx.current) return;
    activeIdx.current = idx;
    haptic("light");
    setStripState(prev => (prev ? { ...prev, activeIndex: idx } : prev));
  }, []);

  const dismissStrip = useCallback((commit: boolean) => {
    settleThumb(activeIdx.current);
    if (!isOpenRef.current) return;
    isOpenRef.current = false;
    if (commit) {
      const key = optionsRef.current[activeIdx.current]?.key;
      if (key && key !== valueRef.current) {
        onChangeRef.current(key);
        haptic("heavy");
      }
    }
    // Reduced motion: the CSS exit animation is disabled, so unmount now
    // instead of holding a frozen strip for the timer's duration.
    if (prefersReducedMotion()) {
      setStripState(null);
      setDismissing(false);
      return;
    }
    setDismissing(true);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      setStripState(null);
      setDismissing(false);
    }, C.dismissMs);
  }, [settleThumb]);

  // Any ancestor scroll or a resize invalidates the captured anchor rect —
  // dismiss rather than chase it. Capture phase is required because the lab
  // shell scrolls an inner container, not the window (the body overflow
  // lock doesn't stop it). Neither surface scrolls internally, so no
  // exclusion logic is needed.
  useEffect(() => {
    if (!sliding && !fallbackOpen) return;
    const onInvalidate = () => {
      dismissStrip(false);
      setFallbackOpen(false);
    };
    window.addEventListener("scroll", onInvalidate, { capture: true });
    window.addEventListener("resize", onInvalidate);
    return () => {
      window.removeEventListener("scroll", onInvalidate, { capture: true });
      window.removeEventListener("resize", onInvalidate);
    };
  }, [sliding, fallbackOpen, dismissStrip]);

  // Touch
  useEffect(() => {
    const chip = chipRef.current;
    if (!chip || disabled) return;
    const onTouchStart = (e: TouchEvent) => {
      if (touchId.current !== null) return;
      const t = e.changedTouches[0];
      touchId.current = t.identifier;
      startX.current = t.clientX;
      startY.current = t.clientY;
      enteredStrip.current = false;
      suppressClick.current = false;
      hold.current.arm();
    };
    const onTouchMove = (e: TouchEvent) => {
      let t: Touch | null = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId.current) {
          t = e.changedTouches[i];
          break;
        }
      }
      if (!t) return;
      if (!isOpenRef.current) {
        if (
          Math.abs(t.clientX - startX.current) > 10 ||
          Math.abs(t.clientY - startY.current) > 10
        ) {
          hold.current.disarm();
          touchId.current = null;
        }
        return;
      }
      e.preventDefault();
      if (
        Math.abs(t.clientY - startY.current) > C.escY &&
        !isInZone(t.clientX, t.clientY)
      ) {
        dismissStrip(false);
        touchId.current = null;
        return;
      }
      if (!enteredStrip.current) {
        if (isInZone(t.clientX, t.clientY)) enteredStrip.current = true;
        else return;
      }
      if (!isInZone(t.clientX, t.clientY)) {
        settleThumb(activeIdx.current);
        return;
      }
      trackThumb(t.clientX);
      updateActive(indexAtX(t.clientX));
    };
    const onTouchEnd = (e: TouchEvent) => {
      let t: Touch | null = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId.current) {
          t = e.changedTouches[i];
          break;
        }
      }
      if (!t) return;
      hold.current.disarm();
      touchId.current = null;
      if (isOpenRef.current) dismissStrip(true);
    };
    chip.addEventListener("touchstart", onTouchStart, { passive: true });
    chip.addEventListener("touchmove", onTouchMove, { passive: false });
    chip.addEventListener("touchend", onTouchEnd, { passive: true });
    chip.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      chip.removeEventListener("touchstart", onTouchStart);
      chip.removeEventListener("touchmove", onTouchMove);
      chip.removeEventListener("touchend", onTouchEnd);
      chip.removeEventListener("touchcancel", onTouchEnd);
      hold.current.disarm();
    };
  }, [
    openStrip,
    dismissStrip,
    updateActive,
    trackThumb,
    settleThumb,
    isInZone,
    indexAtX,
    longPressDuration,
    disabled,
  ]);

  // Mouse
  useEffect(() => {
    const chip = chipRef.current;
    if (!chip || disabled) return;
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      startX.current = e.clientX;
      startY.current = e.clientY;
      suppressClick.current = false;
      enteredStrip.current = false;
      hold.current.arm();
      const onMouseMove = (me: MouseEvent) => {
        if (!isOpenRef.current) {
          if (
            Math.abs(me.clientX - startX.current) > 8 ||
            Math.abs(me.clientY - startY.current) > 8
          ) {
            hold.current.disarm();
          }
          return;
        }
        if (
          Math.abs(me.clientY - startY.current) > C.escY &&
          !isInZone(me.clientX, me.clientY)
        ) {
          dismissStrip(false);
          return;
        }
        if (!enteredStrip.current) {
          if (isInZone(me.clientX, me.clientY)) enteredStrip.current = true;
          else return;
        }
        if (!isInZone(me.clientX, me.clientY)) {
          settleThumb(activeIdx.current);
          return;
        }
        trackThumb(me.clientX);
        updateActive(indexAtX(me.clientX));
      };
      const onMouseUp = () => {
        hold.current.disarm();
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        windowMouseMove.current = null;
        windowMouseUp.current = null;
        if (isOpenRef.current) dismissStrip(true);
      };
      // Track window listeners for cleanup on unmount mid-drag
      windowMouseMove.current = onMouseMove;
      windowMouseUp.current = onMouseUp;
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissStrip(false);
    };
    chip.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      chip.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    openStrip,
    dismissStrip,
    updateActive,
    trackThumb,
    settleThumb,
    isInZone,
    indexAtX,
    longPressDuration,
    disabled,
  ]);

  const handleChipClick = useCallback(() => {
    if (disabled) return;
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    hold.current.disarm();
    setFallbackFocusIdx(optionIndexMap[valueRef.current] ?? 0);
    setFallbackOpen(prev => !prev);
  }, [optionIndexMap, disabled]);

  const closeFallback = useCallback(() => {
    setFallbackOpen(false);
    chipRef.current?.focus?.();
  }, []);
  const selectFallback = useCallback((key: string) => {
    onChangeRef.current(key);
    setFallbackOpen(false);
  }, []);
  const handleFallbackKeyDown = useCallback(
    (e: React.KeyboardEvent, idx: number) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setFallbackFocusIdx((idx + 1) % options.length);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setFallbackFocusIdx((idx - 1 + options.length) % options.length);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeFallback();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectFallback(options[idx].key);
      }
    },
    [options, closeFallback, selectFallback]
  );

  // Fallback positioning (viewport-clamped)
  const [fallbackPos, setFallbackPos] = useState({ left: 0, top: 0 });
  useEffect(() => {
    if (!fallbackOpen || !chipRef.current) return;
    const rect = chipRef.current.getBoundingClientRect();
    // Must mirror the fallback CSS: 2px gap, 4px capsule padding each side.
    const fbItemW = Math.max(72, itemWidth - 4);
    const fbW = options.length * fbItemW + (options.length - 1) * 2 + 8;
    const chipCx = rect.left + rect.width / 2;
    let left = chipCx - fbW / 2;
    left = Math.max(C.vpPad, Math.min(left, window.innerWidth - fbW - C.vpPad));
    setFallbackPos({ left, top: rect.bottom + 6 });
  }, [fallbackOpen, options.length, itemWidth]);

  const chip = renderChip ? (
    renderChip(currentOption, sliding)
  ) : (
    <DefaultChip option={currentOption} isActive={sliding} />
  );

  const canPortal = typeof document !== "undefined";

  return (
    <>
      <div style={{ position: "relative", display: "inline-flex" }}>
        <div
          ref={chipRef}
          className="psp-chip"
          onClick={e => {
            e.stopPropagation();
            handleChipClick();
          }}
          onPointerDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-haspopup="listbox"
          aria-expanded={fallbackOpen || sliding}
          aria-label={`${currentOption.label}. Long press or click to change.`}
          aria-disabled={disabled}
          style={
            {
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? "default" : "pointer",
              "--psp-hold": `${longPressDuration}ms`,
            } as CSSProperties
          }
          onKeyDown={e => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fallbackOpen ? closeFallback() : handleChipClick();
            }
            if (e.key === "ArrowDown" || e.key === "ArrowRight") {
              e.preventDefault();
              if (!fallbackOpen) {
                setFallbackFocusIdx(optionIndexMap[valueRef.current] ?? 0);
                setFallbackOpen(true);
              }
            }
            if (e.key === "Escape") {
              e.preventDefault();
              closeFallback();
            }
          }}
        >
          {chip}
        </div>
      </div>
      {canPortal &&
        fallbackOpen &&
        !sliding &&
        createPortal(
          <div
            role="listbox"
            aria-orientation="horizontal"
            className="glass-overlay psp-fallback"
            style={{
              ...MOTION_VARS,
              top: fallbackPos.top,
              left: fallbackPos.left,
            }}
          >
            {options.map((o, i) => {
              const selected = i === currentIndex;
              // Rendered as a div (not <button>) so the picker can be safely
              // nested inside other interactive elements (e.g. card-as-button).
              // Keyboard + a11y are preserved via role="option", tabIndex, and
              // the existing keydown handler.
              return (
                <div
                  key={o.key}
                  ref={el => {
                    fallbackRefs.current[i] = el;
                  }}
                  role="option"
                  aria-selected={selected}
                  tabIndex={0}
                  onClick={e => {
                    e.stopPropagation();
                    selectFallback(o.key);
                  }}
                  onKeyDown={e => handleFallbackKeyDown(e, i)}
                  onMouseEnter={() => setFallbackFocusIdx(i)}
                  className="psp-fallback__option"
                  style={
                    {
                      width: Math.max(72, itemWidth - 4),
                      "--psp-option-color": o.color,
                    } as CSSProperties
                  }
                >
                  <div className="psp-fallback__dot" />
                  {o.label}
                </div>
              );
            })}
          </div>,
          document.body
        )}
      {canPortal &&
        (sliding || dismissing) &&
        createPortal(
          <Strip
            stripRef={stripRef}
            anchor={stripState?.anchorRect ?? anchorRect.current}
            options={options}
            activeIndex={stripState?.activeIndex ?? activeIdx.current}
            currentIndex={stripState?.currentIndex ?? currentIndex}
            iw={itemWidth}
            dismissing={dismissing}
          />,
          document.body
        )}
      {canPortal &&
        fallbackOpen &&
        createPortal(
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9998 }}
            onClick={e => {
              e.stopPropagation();
              closeFallback();
            }}
            aria-hidden="true"
          />,
          document.body
        )}
    </>
  );
}

export default PressAndSlidePicker;
