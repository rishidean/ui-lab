/**
 * 01 — Minimal. One picker, three options, controlled value. This is the
 * whole required surface: options, value, onChange.
 */
import { useState } from "react";
import { PressAndSlidePicker, type PickerOption } from "@/components/press-and-slide-picker";

const status: PickerOption[] = [
  { key: "todo", label: "To Do", color: "#3B82F6", bg: "#DBEAFE" },
  { key: "in-progress", label: "In Progress", color: "#F59E0B", bg: "#FEF3C7" },
  { key: "done", label: "Done", color: "#22C55E", bg: "#DCFCE7" },
];

export default function Minimal() {
  const [value, setValue] = useState("todo");
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ display: "grid", gap: "1rem", justifyItems: "center" }}>
        <PressAndSlidePicker options={status} value={value} onChange={setValue} />
        <p data-example-log style={{ margin: 0, opacity: 0.6 }}>value: {value}</p>
      </div>
    </div>
  );
}
