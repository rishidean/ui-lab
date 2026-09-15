import type { LabExample } from "@/examples/navigation-bar";
import Minimal from "./01-minimal";
import List from "./02-list";
import CustomChip from "./03-custom-chip";
import minimalSrc from "./01-minimal.tsx?raw";
import listSrc from "./02-list.tsx?raw";
import customChipSrc from "./03-custom-chip.tsx?raw";

export const pressAndSlidePickerExamples: LabExample[] = [
  { id: "01-minimal", title: "01 · Minimal", source: minimalSrc, Component: Minimal },
  { id: "02-list", title: "02 · In a list", source: listSrc, Component: List },
  { id: "03-custom-chip", title: "03 · Custom chip + placement", source: customChipSrc, Component: CustomChip },
];
