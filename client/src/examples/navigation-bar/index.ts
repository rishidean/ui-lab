/**
 * Runnable NavigationBar examples. Each one is a complete host page: it
 * owns the fixed shell, the scroll area, and the state the bar reads.
 * They render on the Code tab and at /navigation-bar?example=<id>.
 */
import type { ComponentType } from "react";
import Minimal from "./01-minimal";
import CollapseOnScroll from "./02-collapse-on-scroll";
import SearchExample from "./03-search";
import WorkflowSheet from "./04-workflow-sheet";
import Assistant from "./05-assistant";
import minimalSrc from "./01-minimal.tsx?raw";
import collapseSrc from "./02-collapse-on-scroll.tsx?raw";
import searchSrc from "./03-search.tsx?raw";
import sheetSrc from "./04-workflow-sheet.tsx?raw";
import assistantSrc from "./05-assistant.tsx?raw";

export type LabExample = {
  id: string;
  title: string;
  source: string;
  Component: ComponentType;
};

export const navigationBarExamples: LabExample[] = [
  {
    id: "01-minimal",
    title: "01 · Minimal",
    source: minimalSrc,
    Component: Minimal,
  },
  {
    id: "02-collapse-on-scroll",
    title: "02 · Collapse on scroll",
    source: collapseSrc,
    Component: CollapseOnScroll,
  },
  {
    id: "03-search",
    title: "03 · Search",
    source: searchSrc,
    Component: SearchExample,
  },
  {
    id: "04-workflow-sheet",
    title: "04 · Workflow sheet",
    source: sheetSrc,
    Component: WorkflowSheet,
  },
  {
    id: "05-assistant",
    title: "05 · Assistant",
    source: assistantSrc,
    Component: Assistant,
  },
];
