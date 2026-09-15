/**
 * 02 — In a list. One picker per row, values kept in a map keyed by row
 * id. Each picker positions its own strip, so rows near the edges or the
 * bottom open in whichever direction has room.
 */
import { useState } from "react";
import { PressAndSlidePicker, type PickerOption } from "@/components/press-and-slide-picker";

const priority: PickerOption[] = [
  { key: "low", label: "Low", color: "#64748B", bg: "#E2E8F0" },
  { key: "medium", label: "Medium", color: "#F59E0B", bg: "#FEF3C7" },
  { key: "high", label: "High", color: "#EF4444", bg: "#FEE2E2" },
];

const tasks = [
  { id: "t1", title: "Write the release notes" },
  { id: "t2", title: "Fix the flaky sheet test" },
  { id: "t3", title: "Review the design tokens PR" },
  { id: "t4", title: "Ship the picker examples" },
];

export default function List() {
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: "2rem 1rem", display: "grid", gap: "0.75rem" }}>
      {tasks.map(task => (
        <li
          key={task.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            padding: "1rem 1.25rem",
            border: "1px solid rgb(0 0 0 / 0.08)",
            borderRadius: "1.25rem",
          }}
        >
          <span>{task.title}</span>
          <PressAndSlidePicker
            options={priority}
            value={values[task.id] ?? "medium"}
            onChange={key => setValues(v => ({ ...v, [task.id]: key }))}
          />
        </li>
      ))}
    </ul>
  );
}
