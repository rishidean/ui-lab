/**
 * 03 — Your own trigger, and a fixed direction. renderChip replaces the
 * default pill (the hold ring still draws around whatever you render);
 * placement forces where the strip opens when it fits.
 */
import { useState, type CSSProperties } from "react";
import { PressAndSlidePicker, type PickerOption } from "@/components/press-and-slide-picker";

const sizes: PickerOption[] = [
  { key: "s", label: "S", color: "#3B82F6" },
  { key: "m", label: "M", color: "#22C55E" },
  { key: "l", label: "L", color: "#F59E0B" },
  { key: "xl", label: "XL", color: "#EF4444" },
];

export default function CustomChip() {
  const [value, setValue] = useState("m");
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <PressAndSlidePicker
        options={sizes}
        value={value}
        onChange={setValue}
        placement="down"
        itemWidth={72}
        renderChip={(option, isActive) => (
          <span
            style={
              {
                display: "inline-grid",
                placeItems: "center",
                width: 44,
                height: 44,
                borderRadius: 12,
                fontWeight: 700,
                color: option.color,
                background: `color-mix(in oklab, ${option.color} ${isActive ? 22 : 12}%, transparent)`,
                border: `1px solid color-mix(in oklab, ${option.color} ${isActive ? 40 : 24}%, transparent)`,
              } as CSSProperties
            }
          >
            {option.label}
          </span>
        )}
      />
    </div>
  );
}
