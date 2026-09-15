/**
 * Gallery Plinth reminder: keep the picker and its single guidance line at the
 * visual center of a clean recording canvas; add no surrounding app UI.
 * The stage supplies a larger renderChip for recording prominence — never a
 * CSS transform (a transformed ancestor would re-base the fixed strip).
 */
import { PressAndSlidePicker } from "@/components/press-and-slide-picker";
import { statusPickerOptions } from "@/demos/pressAndSlidePickerDemo";
import { useState, type CSSProperties } from "react";
import "./PressAndSlidePickerStage.css";

export default function PressAndSlidePickerStage() {
  const [status, setStatus] = useState("todo");

  return (
    <main
      className="picker-demo"
      aria-label="Press and Slide Picker component demo"
    >
      <div className="picker-demo__stage">
        <p className="picker-demo__instruction">
          Long press (or click) the chip to open the picker, then slide to
          select
        </p>
        <div className="picker-demo__object">
          <PressAndSlidePicker
            options={statusPickerOptions}
            value={status}
            onChange={setStatus}
            itemWidth={92}
            renderChip={(option, isActive) => (
              <span
                className={
                  "picker-demo__chip" +
                  (isActive ? " picker-demo__chip--engaged" : "")
                }
                style={{ "--psp-option-color": option.color } as CSSProperties}
              >
                <span className="picker-demo__chip-dot" />
                {option.label}
              </span>
            )}
          />
        </div>
      </div>
    </main>
  );
}
