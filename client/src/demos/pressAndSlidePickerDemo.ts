/**
 * PressAndSlidePicker demo data: three small, finite option sets the
 * picker is built for — status, priority, t-shirt sizing. Vivid, familiar
 * colors keep the press-and-slide state change legible in a recording.
 */
import type { PickerOption } from "@/components/press-and-slide-picker";

export const statusPickerOptions: PickerOption[] = [
  { key: "todo", label: "To Do", color: "#3B82F6", bg: "#DBEAFE" },
  { key: "in-progress", label: "In Progress", color: "#F59E0B", bg: "#FEF3C7" },
  { key: "done", label: "Done", color: "#22C55E", bg: "#DCFCE7" },
  { key: "blocked", label: "Blocked", color: "#EF4444", bg: "#FEE2E2" },
];

export const priorityPickerOptions: PickerOption[] = [
  { key: "low", label: "Low", color: "#64748B", bg: "#E2E8F0" },
  { key: "medium", label: "Medium", color: "#F59E0B", bg: "#FEF3C7" },
  { key: "high", label: "High", color: "#EF4444", bg: "#FEE2E2" },
];

export const sizePickerOptions: PickerOption[] = [
  { key: "xs", label: "XS", color: "#8B5CF6", bg: "#EDE9FE" },
  { key: "s", label: "S", color: "#3B82F6", bg: "#DBEAFE" },
  { key: "m", label: "M", color: "#22C55E", bg: "#DCFCE7" },
  { key: "l", label: "L", color: "#F59E0B", bg: "#FEF3C7" },
  { key: "xl", label: "XL", color: "#EF4444", bg: "#FEE2E2" },
];

/** Long labels: at phone width a row cannot hold these, so the strip
 *  turns vertical (down, or up near the bottom of the list). */
export const workflowPickerOptions: PickerOption[] = [
  { key: "backlog", label: "Backlog", color: "#64748B", bg: "#E2E8F0" },
  { key: "in-review", label: "In review", color: "#3B82F6", bg: "#DBEAFE" },
  { key: "needs-changes", label: "Needs changes", color: "#F59E0B", bg: "#FEF3C7" },
  { key: "approved", label: "Approved", color: "#22C55E", bg: "#DCFCE7" },
  { key: "shipped", label: "Shipped", color: "#8B5CF6", bg: "#EDE9FE" },
];
