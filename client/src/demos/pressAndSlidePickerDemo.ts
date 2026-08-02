/**
 * Gallery Plinth demo data: vivid, familiar status colors make the picker’s
 * press-and-slide state change legible in a quiet screen recording.
 */
import type { PickerOption } from "@/components/press-and-slide-picker";

export const statusPickerOptions: PickerOption[] = [
  { key: "todo", label: "To Do", color: "#3B82F6", bg: "#DBEAFE" },
  { key: "in-progress", label: "In Progress", color: "#F59E0B", bg: "#FEF3C7" },
  { key: "done", label: "Done", color: "#22C55E", bg: "#DCFCE7" },
  { key: "blocked", label: "Blocked", color: "#EF4444", bg: "#FEE2E2" },
];
