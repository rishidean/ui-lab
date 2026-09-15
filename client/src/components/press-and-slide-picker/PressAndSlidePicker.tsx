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
  Fragment,
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
  layout: StripLayout;
}

/**
 * Where the strip goes and how its items are ordered. The selected option
 * always sits at the end nearest the chip (the finger), then a divider,
 * then the rest in their natural order; the strip grows away from the
 * chip in whichever direction has room. Horizontal is preferred (labels
 * read naturally); vertical is used when a horizontal strip would have to
 * squeeze labels below C.minLegibleIw.
 */
interface StripLayout {
  axis: "x" | "y";
  /** +1: grows right / down from the chip. -1: grows left / up. */
  dir: 1 | -1;
  /** Option indices in display order along the axis. */
  order: number[];
  /** Display slot of the selected (current) option. */
  selSlot: number;
  /** Slot after which the divider sits (in display order). */
  dividerAfter: number;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Item size along the axis (effective item width, or item height). */
  itemLen: number;
  /** Item size across the axis. */
  itemCross: number;
  /** Horizontal only: items too narrow for dot + label — drop the dot,
   *  12px label — rather than clip or go vertical. */
  compact: boolean;
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
  // Divider between the selected option and the rest: gap + line + gap.
  dividerGap: 3,
  dividerLine: 1,
  // Below this per-item width a horizontal strip stops being legible;
  // the layout switches to a vertical strip instead of squeezing labels.
  minLegibleIw: 64,
  // JS unmount timer must match the CSS exit animation, or the exit gets
  // clipped/overrun whenever TEMPO is retuned.
  dismissMs: Math.round(DUR.stripOut * TEMPO * 1000),
};

// ═══════════════════════════════════════════
// Viewport-aware positioning
// ═══════════════════════════════════════════

/** Start of display slot `k` along the strip's axis, inside its border box. */
function slotStart(layout: Pick<StripLayout, "itemLen" | "dividerAfter">, k: number) {
  const pad = C.padX;
  const extra = k > layout.dividerAfter ? C.dividerGap * 2 + C.dividerLine : 0;
  return pad + k * (layout.itemLen + C.stripGap) + extra;
}

/** Widest label in the set, in px — memoised per set. Measured with the
 *  item's own font; a canvas is cheap and honest. */
const labelNeedCache = new Map<string, number>();
function widestLabel(options: PickerOption[]) {
  const key = options.map(o => o.label).join("\u0000");
  const hit = labelNeedCache.get(key);
  if (hit !== undefined) return hit;
  let widest = 0;
  const ctx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (ctx) {
    ctx.font = '500 13px "DM Sans", ui-sans-serif, system-ui, sans-serif';
    for (const o of options) widest = Math.max(widest, ctx.measureText(o.label).width);
  } else {
    for (const o of options) widest = Math.max(widest, o.label.length * 6.2);
  }
  labelNeedCache.set(key, Math.ceil(widest));
  return Math.ceil(widest);
}

function stripLength(n: number, itemLen: number) {
  return n * itemLen + (n - 1) * C.stripGap + C.padX * 2 + C.dividerGap * 2 + C.dividerLine;
}

/**
 * Pick the placement. Tries, in order: horizontal growing right, then
 * left (each first at the requested item width, then compressed down to
 * minLegibleIw); then vertical growing down, then up; then a compressed
 * horizontal centred on the chip as the last resort.
 */
function computeLayout(
  anchor: DOMRect,
  options: PickerOption[],
  currentIndex: number,
  iw: number
): StripLayout {
  const n = options.length;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // A horizontal item must still fit its longest label (measured, not
  // guessed). Full: dot + gap + label + air. Compact: no dot, 12px label.
  // Below compact, prefer a vertical strip over clipping — the finger
  // reads a column as easily as a row.
  const widest = widestLabel(options);
  const needFull = Math.ceil(widest + 8 + 6.4 + 8);
  const needCompact = Math.max(C.minLegibleIw, Math.ceil(widest * (12 / 13) + 8));
  const cx = anchor.left + anchor.width / 2;
  const cy = anchor.top + anchor.height / 2;
  const rest = Array.from({ length: n }, (_, i) => i).filter(i => i !== currentIndex);
  const crossH = C.itemH + C.padY * 2;

  // Horizontal: the strip sits below the chip (above if no room below);
  // its near end aligns the selected slot's centre with the chip's centre.
  const top =
    vh - anchor.bottom >= crossH + C.stripGap || vh - anchor.bottom >= anchor.top
      ? anchor.bottom + C.stripGap
      : Math.max(C.vpPad, anchor.top - crossH - C.stripGap);
  const horizontal = (dir: 1 | -1, itemLen: number, compact = false): StripLayout | null => {
    const len = stripLength(n, itemLen);
    const near = cx - C.padX - itemLen / 2; // x of the near end for dir +1
    const left = dir === 1 ? near : cx + C.padX + itemLen / 2 - len;
    if (left < C.vpPad || left + len > vw - C.vpPad) return null;
    return {
      axis: "x",
      dir,
      order: dir === 1 ? [currentIndex, ...rest] : [...rest, currentIndex],
      selSlot: dir === 1 ? 0 : n - 1,
      dividerAfter: dir === 1 ? 0 : n - 2,
      left,
      top,
      width: len,
      height: crossH,
      itemLen,
      itemCross: C.itemH,
      compact,
    };
  };
  // Vertical: centred on the chip's x (clamped), growing down or up from it.
  const vertical = (dir: 1 | -1): StripLayout | null => {
    const len = stripLength(n, C.itemH);
    const width = iw + C.padX * 2;
    const vtop = dir === 1 ? anchor.bottom + C.stripGap : anchor.top - C.stripGap - len;
    if (vtop < C.vpPad || vtop + len > vh - C.vpPad) return null;
    const left = Math.max(C.vpPad, Math.min(cx - width / 2, vw - width - C.vpPad));
    return {
      axis: "y",
      dir,
      order: dir === 1 ? [currentIndex, ...rest] : [...rest, currentIndex],
      selSlot: dir === 1 ? 0 : n - 1,
      dividerAfter: dir === 1 ? 0 : n - 2,
      left,
      top: vtop,
      width,
      height: len,
      itemLen: C.itemH,
      itemCross: iw,
      compact: false,
    };
  };
  // Widest item that lets a horizontal strip fit on the given side. The
  // strip's near end sits half an item past the chip's centre, so the
  // length budget is (room from the centre to the edge) + itemLen/2 + padX:
  //   n·itemLen + fixed ≤ room + itemLen/2 + padX  →  itemLen ≤ (room + padX − fixed) / (n − ½)
  const fitIw = (dir: 1 | -1) => {
    const room = dir === 1 ? vw - C.vpPad - cx : cx - C.vpPad;
    const fixed = (n - 1) * C.stripGap + C.padX * 2 + C.dividerGap * 2 + C.dividerLine;
    return Math.floor((room + C.padX - fixed) / (n - 0.5));
  };

  for (const dir of [1, -1] as const) {
    const h = horizontal(dir, iw);
    if (h) return h;
  }
  for (const dir of [1, -1] as const) {
    const w = Math.min(iw, fitIw(dir));
    if (w >= needFull) {
      const h = horizontal(dir, w);
      if (h) return h;
    }
  }
  for (const dir of [1, -1] as const) {
    const w = Math.min(iw, fitIw(dir));
    if (w >= needCompact) {
      const h = horizontal(dir, w, true);
      if (h) return h;
    }
  }
  for (const dir of [1, -1] as const) {
    const v = vertical(dir);
    if (v) return v;
  }
  // Last resort: compressed horizontal, centred and clamped.
  const maxLen = vw - C.vpPad * 2;
  const fixed = (n - 1) * C.stripGap + C.padX * 2 + C.dividerGap * 2 + C.dividerLine;
  const itemLen = Math.max(40, Math.min(iw, Math.floor((maxLen - fixed) / n)));
  const len = stripLength(n, itemLen);
  const left = Math.max(C.vpPad, Math.min(cx - len / 2, vw - len - C.vpPad));
  return {
    axis: "x",
    dir: 1,
    order: [currentIndex, ...rest],
    selSlot: 0,
    dividerAfter: 0,
    left,
    top,
    width: len,
    height: crossH,
    itemLen,
    itemCross: C.itemH,
    compact: true,
  };
}

// ═══════════════════════════════════════════
// Strip (gesture mode)
// ═══════════════════════════════════════════

interface StripProps {
  stripRef: React.RefObject<HTMLDivElement | null>;
  layout: StripLayout | null;
  options: PickerOption[];
  activeIndex: number;
  currentIndex: number;
  dismissing: boolean;
}

function Strip({
  stripRef,
  layout,
  options,
  activeIndex,
  currentIndex,
  dismissing,
}: StripProps) {
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const restStart = layout ? slotStart(layout, layout.selSlot) : 0;
  const axis = layout?.axis ?? "x";
  // Mount only: after that the pointer handlers own the transform.
  useLayoutEffect(() => {
    if (thumbRef.current)
      thumbRef.current.style.transform =
        axis === "x" ? `translateX(${restStart}px)` : `translateY(${restStart}px)`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!layout) return null;
  const vertical = layout.axis === "y";
  const compact = layout.compact;
  return (
    <div
      ref={stripRef}
      className={cn(
        "glass-overlay psp-strip",
        vertical && "psp-strip--vertical",
        dismissing && "psp-strip--out"
      )}
      style={{
        ...MOTION_VARS,
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
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
            width: vertical ? layout.itemCross : layout.itemLen,
            height: vertical ? layout.itemLen : layout.itemCross,
            top: vertical ? 0 : C.padY,
            left: vertical ? C.padX : 0,
            "--psp-option-color": options[activeIndex]?.color,
          } as CSSProperties
        }
      />
      {layout.order.map((optIdx, k) => {
        const o = options[optIdx];
        const act = optIdx === activeIndex;
        const cur = optIdx === currentIndex;
        const pos = slotStart(layout, k);
        return (
          <Fragment key={o.key}>
            {k === layout.dividerAfter + 1 && (
              <div
                aria-hidden="true"
                className="psp-divider"
                style={
                  vertical
                    ? { top: pos - C.dividerGap - C.dividerLine, left: C.padX, width: layout.itemCross }
                    : { left: pos - C.dividerGap - C.dividerLine, top: C.padY, height: layout.itemCross }
                }
              />
            )}
            <div
              data-idx={optIdx}
              data-slot={k}
              className={cn(
                "psp-item",
                act && "psp-item--active",
                cur && "psp-item--current",
                compact && "psp-item--compact"
              )}
              style={
                {
                  position: "absolute",
                  left: vertical ? C.padX : pos,
                  top: vertical ? pos : C.padY,
                  width: vertical ? layout.itemCross : layout.itemLen,
                  height: vertical ? layout.itemLen : layout.itemCross,
                  "--psp-option-color": o.color,
                } as CSSProperties
              }
            >
              <div className="psp-item__dot" />
              <span className="psp-item__label">{o.label}</span>
            </div>
          </Fragment>
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
  const layoutRef = useRef<StripLayout | null>(null);
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

  /** Option index under a viewport point, or null when off the strip. */
  const indexAt = useCallback((x: number, y: number): number | null => {
    const l = layoutRef.current;
    if (!l) return null;
    const p = l.axis === "x" ? x - l.left : y - l.top;
    for (let k = 0; k < l.order.length; k++) {
      const start = slotStart(l, k);
      if (p >= start - 4 && p <= start + l.itemLen + 4) return l.order[k];
    }
    return null;
  }, []);

  const isInZone = useCallback((x: number, y: number): boolean => {
    const l = layoutRef.current;
    if (!l) return false;
    const hx = l.axis === "x" ? C.haloX : C.haloY;
    const hy = l.axis === "x" ? C.haloY : C.haloX;
    return (
      x >= l.left - hx && x <= l.left + l.width + hx && y >= l.top - hy && y <= l.top + l.height + hy
    );
  }, []);

  /** Distance from the press point across the strip's axis — the "walked
   *  away" measure that cancels the gesture outside the zone. */
  const crossDistance = useCallback((x: number, y: number): number => {
    const l = layoutRef.current;
    return l?.axis === "y" ? Math.abs(x - startX.current) : Math.abs(y - startY.current);
  }, []);

  // The sliding pill. trackThumb follows the finger (magnetised toward
  // the nearest slot); settleThumb locks it into a slot with the longer
  // ease — on lift, on leaving the zone, and while the strip dismisses.
  const thumbEl = () =>
    stripRef.current?.querySelector<HTMLElement>(".psp-thumb") ?? null;
  const thumbTransform = (l: StripLayout, pos: number) =>
    l.axis === "x" ? `translateX(${pos}px)` : `translateY(${pos}px)`;
  const trackThumb = useCallback((x: number, y: number) => {
    const l = layoutRef.current;
    const el = thumbEl();
    if (!l || !el || prefersReducedMotion()) return;
    const p = l.axis === "x" ? x - l.left : y - l.top;
    const n = l.order.length;
    // Nearest slot by centre, then pull the pill part-way toward the finger.
    let k = 0;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(p - (slotStart(l, i) + l.itemLen / 2));
      if (d < best) { best = d; k = i; }
    }
    const center = slotStart(l, k) + l.itemLen / 2;
    const pulled = center + (p - center) * C.thumbPull;
    const pos = Math.max(slotStart(l, 0), Math.min(slotStart(l, n - 1), pulled - l.itemLen / 2));
    el.classList.remove("psp-thumb--settle");
    el.style.transform = thumbTransform(l, pos);
  }, []);
  const settleThumb = useCallback((optIdx: number) => {
    const l = layoutRef.current;
    const el = thumbEl();
    if (!l || !el) return;
    const k = Math.max(0, l.order.indexOf(optIdx));
    el.classList.add("psp-thumb--settle");
    el.style.transform = thumbTransform(l, slotStart(l, k));
  }, []);

  const openStrip = useCallback(() => {
    if (!chipRef.current || disabled) return;
    const rect = chipRef.current.getBoundingClientRect();
    const idx = optionIndexMap[valueRef.current] ?? 0;
    anchorRect.current = rect;
    layoutRef.current = computeLayout(rect, options, idx, itemWidth);
    activeIdx.current = idx;
    isOpenRef.current = true;
    enteredStrip.current = false;
    suppressClick.current = true;
    setFallbackOpen(false);
    haptic("medium");
    setStripState({
      anchorRect: rect,
      activeIndex: idx,
      currentIndex: idx,
      layout: layoutRef.current,
    });
    setDismissing(false);
  }, [optionIndexMap, disabled, options, itemWidth]);
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
      if (crossDistance(t.clientX, t.clientY) > C.escY && !isInZone(t.clientX, t.clientY)) {
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
      trackThumb(t.clientX, t.clientY);
      updateActive(indexAt(t.clientX, t.clientY));
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
    indexAt,
    crossDistance,
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
        if (crossDistance(me.clientX, me.clientY) > C.escY && !isInZone(me.clientX, me.clientY)) {
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
        trackThumb(me.clientX, me.clientY);
        updateActive(indexAt(me.clientX, me.clientY));
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
    indexAt,
    crossDistance,
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
            layout={stripState?.layout ?? layoutRef.current}
            options={options}
            activeIndex={stripState?.activeIndex ?? activeIdx.current}
            currentIndex={stripState?.currentIndex ?? currentIndex}
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
