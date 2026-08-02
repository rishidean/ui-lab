/**
 * Gallery Plinth reminder: keep the picker and its single guidance line at the
 * visual center of a clean off-white recording canvas; add no surrounding app UI.
 */
import { PressAndSlidePicker } from "@/components/press-and-slide-picker";
import { statusPickerOptions } from "@/demos/pressAndSlidePickerDemo";
import { useState } from "react";
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
          />
        </div>
      </div>
    </main>
  );
}
