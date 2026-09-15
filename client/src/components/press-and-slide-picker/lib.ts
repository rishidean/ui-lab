/**
 * The one helper the picker needs, copied in so the folder is
 * self-contained. Byte-for-byte the lab's `@/lib/utils` cn; if you
 * already have a `cn`, point the import in PressAndSlidePicker.tsx at
 * yours and delete this file.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
