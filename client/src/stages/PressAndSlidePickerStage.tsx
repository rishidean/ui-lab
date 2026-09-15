/**
 * PressAndSlidePicker demo stage — a task list, the picker's home turf.
 *
 * Sibling of the NavigationBar stage: the same quiet canvas and gradient
 * tiles standing in for app content, the same DemoControls panel (lab
 * affordance; hidden in recording mode, driven by the site's toolbar
 * when embedded). Each row carries one picker; the status chip is the
 * only real control on the page. No transforms anywhere above the
 * picker — a transformed ancestor becomes the containing block for its
 * fixed-position strip.
 */
import {
  PressAndSlidePicker,
  type PickerOption,
  type PickerPlacement,
} from "@/components/press-and-slide-picker";
import {
  priorityPickerOptions,
  sizePickerOptions,
  statusPickerOptions,
  workflowPickerOptions,
} from "@/demos/pressAndSlidePickerDemo";
import { useRecordingMode } from "@/lab/recording";
import { useState } from "react";
import DemoControls, { RangeRow, SelectRow } from "./DemoControls";
import { demoParam, demoParamEnum, useDemoControls } from "./useDemoControls";
import "./PressAndSlidePickerStage.css";

type OptionSet = "status" | "priority" | "size" | "workflow";
const PLACEMENTS: readonly PickerPlacement[] = ["auto", "right", "left", "down", "up"];
const OPTION_SETS: Record<OptionSet, { label: string; options: PickerOption[] }> = {
  status: { label: "Status (4)", options: statusPickerOptions },
  priority: { label: "Priority (3)", options: priorityPickerOptions },
  size: { label: "T-shirt size (5)", options: sizePickerOptions },
  workflow: { label: "Workflow (5, long labels)", options: workflowPickerOptions },
};

/** Eight rows; each remembers its own value per option set. Title
 *  widths vary so the list reads as somebody's data. */
const ROWS = [
  { id: "r1", width: 62, initial: 0 },
  { id: "r2", width: 44, initial: 1 },
  { id: "r3", width: 78, initial: 1 },
  { id: "r4", width: 55, initial: 2 },
  { id: "r5", width: 68, initial: 0 },
  { id: "r6", width: 38, initial: 3 },
  { id: "r7", width: 71, initial: 2 },
  { id: "r8", width: 50, initial: 0 },
];

export default function PressAndSlidePickerStage() {
  const chromeHidden = useRecordingMode();
  const controls = useDemoControls();
  const [optionSet, setOptionSet] = useState<OptionSet>(() =>
    demoParamEnum("set", "size", Object.keys(OPTION_SETS) as OptionSet[])
  );
  const [holdMs, setHoldMs] = useState(() => demoParam("hold", 275, 150, 600));
  const [itemWidth, setItemWidth] = useState(() => demoParam("item", 92, 64, 120));
  const [placement, setPlacement] = useState<PickerPlacement>(() =>
    demoParamEnum("open", "auto", PLACEMENTS)
  );

  const { options } = OPTION_SETS[optionSet];
  // Values keyed by row and option set, so switching sets does not
  // invent a selection the user never made.
  const [values, setValues] = useState<Record<string, string>>({});
  const valueFor = (row: (typeof ROWS)[number]) =>
    values[`${optionSet}:${row.id}`] ??
    options[Math.min(row.initial, options.length - 1)].key;

  return (
    <main className="picker-demo" aria-label="Press and Slide Picker component demo">
      {!chromeHidden && (
        <DemoControls
          legend="PressAndSlidePicker tunables"
          align="left"
          open={controls.open}
          onOpenChange={controls.setOpen}
          headless={controls.headless}
        >
          <SelectRow
            id="demo-controls-set"
            label="Option set"
            value={optionSet}
            options={(Object.keys(OPTION_SETS) as OptionSet[]).map(k => ({
              value: k,
              label: OPTION_SETS[k].label,
            }))}
            onChange={setOptionSet}
          />
          <SelectRow
            id="demo-controls-open"
            label="Opens"
            value={placement}
            options={PLACEMENTS.map(p => ({ value: p, label: p }))}
            onChange={setPlacement}
          />
          <RangeRow
            id="demo-controls-hold"
            label="Long-press hold"
            value={holdMs}
            display={`${holdMs}ms`}
            min={150}
            max={600}
            step={25}
            onChange={setHoldMs}
          />
          <RangeRow
            id="demo-controls-item"
            label="Option width"
            value={itemWidth}
            display={`${itemWidth}px`}
            min={64}
            max={120}
            step={4}
            onChange={setItemWidth}
          />
        </DemoControls>
      )}

      <div className="picker-demo__scroll-area">
        <div className="picker-demo__content">
          <p className="picker-demo__instruction">
            Long-press a status, slide, release. Or click it for the
            keyboard-friendly list.
          </p>
          <ul className="picker-demo__list" aria-label="Tasks">
            {ROWS.map(row => (
              <li key={row.id} className="picker-demo__row">
                <span
                  className="picker-demo__title"
                  style={{ width: `${row.width}%` }}
                  aria-hidden="true"
                />
                <span className="picker-demo__meta" aria-hidden="true" />
                <PressAndSlidePicker
                  options={options}
                  value={valueFor(row)}
                  onChange={key =>
                    setValues(v => ({ ...v, [`${optionSet}:${row.id}`]: key }))
                  }
                  itemWidth={itemWidth}
                  longPressDuration={holdMs}
                  placement={placement}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
