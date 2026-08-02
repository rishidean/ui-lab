/**
 * PressAndSlidePicker — Production TypeScript port
 *
 * Facebook Reactions-style press-and-slide gesture picker.
 * Long-press a chip -> slide to an option -> release.
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

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
// Singleton styles
// ═══════════════════════════════════════════

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  // Guard against HMR duplicating the tag (module flag resets but DOM persists)
  if (document.querySelector("style[data-psp]")) {
    stylesInjected = true;
    return;
  }
  stylesInjected = true;
  const s = document.createElement("style");
  s.setAttribute("data-psp", "");
  // Aura motion: quiet fade + glide, ease-standard, no overshoot/bounce.
  s.textContent = `
    @keyframes psp-in {
      0%   { opacity:0; transform:scale(.92) translateY(6px) }
      100% { opacity:1; transform:scale(1) translateY(0) }
    }
    @keyframes psp-out {
      from { opacity:1; transform:scale(1) translateY(0) }
      to   { opacity:0; transform:scale(.96) translateY(4px) }
    }
    @media(prefers-reduced-motion:reduce){
      .psp-anim{ animation:none!important; transition:none!important }
    }
  `;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════
// Layout constants
// ═══════════════════════════════════════════

const C = {
  stripGap: 6,
  padX: 8,
  padY: 6,
  itemH: 56,
  vpPad: 8,
  haloX: 8,
  haloY: 16,
  escY: 36,
  dismissMs: 140,
  animIn: "psp-in .22s cubic-bezier(.2,0,0,1) both",
  animOut: "psp-out .14s cubic-bezier(.2,0,0,1) both",
};

// ═══════════════════════════════════════════
// Viewport-aware positioning
// ═══════════════════════════════════════════

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
  if (!anchor) return null;
  const { left, top, effectiveIw } = metrics(anchor, options.length, iw);
  return (
    <div
      ref={stripRef}
      className="psp-anim"
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 9999,
        display: "flex",
        gap: C.stripGap,
        padding: `${C.padY}px ${C.padX}px`,
        borderRadius: 16,
        background: "var(--surface-overlay)",
        backdropFilter: "saturate(1.5) blur(16px)",
        WebkitBackdropFilter: "saturate(1.5) blur(16px)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.6)",
        animation: dismissing ? C.animOut : C.animIn,
        touchAction: "none",
        userSelect: "none",
        pointerEvents: dismissing ? "none" : "auto",
      }}
    >
      {options.map((o, i) => {
        const act = i === activeIndex;
        const cur = i === currentIndex;
        return (
          <div
            key={o.key}
            data-idx={i}
            style={{
              width: effectiveIw,
              height: C.itemH,
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              position: "relative",
              background: act ? o.color : "transparent",
              transform: act ? "scale(1.07)" : "scale(1)",
              transition:
                "transform .14s cubic-bezier(.2,0,0,1),background .14s cubic-bezier(.2,0,0,1)",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: act ? "rgba(255,255,255,.95)" : o.color,
                transition: "all .14s cubic-bezier(.2,0,0,1)",
                boxShadow: act ? `0 0 10px ${o.color}` : "none",
              }}
            />
            <span
              style={{
                fontSize: effectiveIw < 60 ? 10 : 11,
                fontWeight: 600,
                fontFamily: "-apple-system,system-ui,sans-serif",
                color: act ? "var(--text-primary)" : "var(--text-secondary)",
                letterSpacing: ".01em",
                textAlign: "center",
                lineHeight: 1.15,
                whiteSpace: "nowrap",
              }}
            >
              {o.label}
            </span>
            {cur && !act && (
              <div
                style={{
                  position: "absolute",
                  bottom: 5,
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  background: "var(--text-quaternary)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════
// DefaultChip (dark theme)
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
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-all duration-150",
        "text-[10px] font-semibold uppercase tracking-wider",
        isActive && "ring-1 ring-white/20"
      )}
      style={{
        background: isActive ? `${option.color}33` : `${option.color}1A`,
        color: option.color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: option.color }}
      />
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
  useEffect(() => {
    injectStyles();
  }, []);

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
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
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

  const updateActive = useCallback((idx: number | null) => {
    if (idx === null || idx === activeIdx.current) return;
    activeIdx.current = idx;
    haptic("light");
    setStripState(prev => (prev ? { ...prev, activeIndex: idx } : prev));
  }, []);

  const dismissStrip = useCallback((commit: boolean) => {
    if (!isOpenRef.current) return;
    isOpenRef.current = false;
    if (commit) {
      const key = optionsRef.current[activeIdx.current]?.key;
      if (key && key !== valueRef.current) {
        onChangeRef.current(key);
        haptic("heavy");
      }
    }
    setDismissing(true);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      setStripState(null);
      setDismissing(false);
    }, C.dismissMs);
  }, []);

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
      longPressTimer.current = setTimeout(() => openStrip(), longPressDuration);
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
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
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
      if (!isInZone(t.clientX, t.clientY)) return;
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
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
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
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, [
    openStrip,
    dismissStrip,
    updateActive,
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
      longPressTimer.current = setTimeout(() => openStrip(), longPressDuration);
      const onMouseMove = (me: MouseEvent) => {
        if (!isOpenRef.current) {
          if (
            Math.abs(me.clientX - startX.current) > 8 ||
            Math.abs(me.clientY - startY.current) > 8
          ) {
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
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
        if (!isInZone(me.clientX, me.clientY)) return;
        updateActive(indexAtX(me.clientX));
      };
      const onMouseUp = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
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
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
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
    const fbItemW = Math.max(72, itemWidth - 4);
    const fbW = options.length * fbItemW + (options.length - 1) * 4 + 12;
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

  return (
    <>
      <div style={{ position: "relative", display: "inline-flex" }}>
        <div
          ref={chipRef}
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
          style={{
            touchAction: "pan-y",
            WebkitUserSelect: "none",
            userSelect: "none",
            WebkitTapHighlightColor: "transparent",
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? "default" : "pointer",
          }}
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
      {fallbackOpen && !sliding && (
        <div
          role="listbox"
          aria-orientation="horizontal"
          className="psp-anim"
          style={{
            position: "fixed",
            top: fallbackPos.top,
            left: fallbackPos.left,
            zIndex: 9999,
            background: "var(--surface-overlay)",
            backdropFilter: "saturate(1.5) blur(16px)",
            WebkitBackdropFilter: "saturate(1.5) blur(16px)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            boxShadow: "var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.6)",
            padding: 6,
            display: "flex",
            gap: 4,
            minWidth: "max-content",
            animation: C.animIn,
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
                style={{
                  border: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  width: Math.max(72, itemWidth - 4),
                  minHeight: 56,
                  padding: "8px 10px",
                  borderRadius: 10,
                  cursor: "pointer",
                  userSelect: "none",
                  background: selected ? o.color : "transparent",
                  color: selected
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                  outline:
                    fallbackFocusIdx === i ? `2px solid ${o.color}` : "none",
                  outlineOffset: 1,
                  transition:
                    "background .14s cubic-bezier(.2,0,0,1),color .14s cubic-bezier(.2,0,0,1)",
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: selected ? "rgba(255,255,255,.98)" : o.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: 1.15,
                    fontFamily: "-apple-system,system-ui,sans-serif",
                    whiteSpace: "nowrap",
                  }}
                >
                  {o.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {(sliding || dismissing) && (
        <Strip
          stripRef={stripRef}
          anchor={stripState?.anchorRect ?? anchorRect.current}
          options={options}
          activeIndex={stripState?.activeIndex ?? activeIdx.current}
          currentIndex={stripState?.currentIndex ?? currentIndex}
          iw={itemWidth}
          dismissing={dismissing}
        />
      )}
      {fallbackOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9998 }}
          onClick={e => {
            e.stopPropagation();
            closeFallback();
          }}
          aria-hidden="true"
        />
      )}
    </>
  );
}

export default PressAndSlidePicker;
