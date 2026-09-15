/**
 * Two helpers the NavigationBar needs, copied in so the folder is
 * self-contained. They are byte-for-byte the lab's `@/lib/utils` (cn)
 * and `@/lib/a11y` (focusWhenClear); if you already have a `cn`, point
 * the import in NavigationBar.tsx at yours and delete this one.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Focus `el` once it is no longer inside an `[inert]` subtree. Surfaces
 * that contain focus (BottomSheet, UtilityModal) mark everything outside
 * themselves inert while open and lift it on exit; a same-tick
 * `el.focus()` there can silently no-op, so this polls a few frames
 * instead of guessing a delay. Always `{ preventScroll: true }`.
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
