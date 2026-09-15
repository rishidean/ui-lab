/**
 * useDemoControls — shared plumbing for a stage's DemoControls panel.
 * Lab-only; no component ships this.
 *
 * Embedded in the lab site's demo canvas (?embed=1), the site's toolbar
 * pill opens and closes the panel via postMessage and the panel renders
 * headless (no summary row). Standalone (phones, the bare route) it is a
 * <details> that starts open on wide viewports.
 *
 * Initial values can ride the URL so a recording — where the panel is
 * hidden — can still pin them: see `demoParam` / `demoParamEnum`.
 */
import { useEffect, useState } from "react";

const search = () => new URLSearchParams(window.location.search);

/** Numeric override from the query string, clamped to the control's own
 *  range; falls back when absent or unparsable. */
export function demoParam(
  name: string,
  fallback: number,
  min: number,
  max: number
) {
  const raw = search().get(name);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Enum override from the query string, validated against `allowed`. */
export function demoParamEnum<T extends string>(
  name: string,
  fallback: T,
  allowed: readonly T[]
): T {
  const raw = search().get(name);
  return raw !== null && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

export function useDemoControls() {
  const [embedded] = useState(() => search().has("embed"));
  const [open, setOpen] = useState(() => !embedded && window.innerWidth >= 640);
  useEffect(() => {
    if (!embedded) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; open?: unknown };
      if (data?.type === "lab:demo-controls" && typeof data.open === "boolean")
        setOpen(data.open);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embedded]);
  return { open, setOpen, headless: embedded };
}
