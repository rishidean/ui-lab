/**
 * Showcase surfaces for the Press & Slide Picker — the interactive demo
 * card (hosting the real component) and the scripted presentation-mode
 * beat visual. Both read the --lab-* palette set by lab/Showcase.tsx.
 */
import { useState } from "react";
import {
  PressAndSlidePicker,
  type PickerOption,
} from "@/components/press-and-slide-picker";
import type { PresentationBeat } from "@/lab/registry";

/** Demo option set — mid-tone colors that hold up on both lab palettes. */
export const frequencyOptions: PickerOption[] = [
  {
    key: "never",
    label: "Never",
    color: "#8a8f98",
    bg: "rgba(138,143,152,0.16)",
  },
  {
    key: "hourly",
    label: "Hourly",
    color: "#38bdf8",
    bg: "rgba(56,189,248,0.16)",
  },
  {
    key: "daily",
    label: "Daily",
    color: "#a3e635",
    bg: "rgba(163,230,53,0.16)",
  },
  {
    key: "weekly",
    label: "Weekly",
    color: "#ff5fa8",
    bg: "rgba(255,95,168,0.16)",
  },
  {
    key: "monthly",
    label: "Monthly",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.16)",
  },
];

const ITEM_WIDTH = 92;

/**
 * The Demo-tab card: digest-frequency scenario around the real picker,
 * with a live readout panel beside it.
 */
export function PickerDemo({ mobile }: { mobile: boolean }) {
  const [value, setValue] = useState("weekly");
  const [lastEvent, setLastEvent] = useState("idle");
  const index = frequencyOptions.findIndex(o => o.key === value);

  return (
    <div className="lab-picker-demo">
      <div
        className="lab-picker-demo__card"
        style={{ width: mobile ? 390 : 520 }}
      >
        {mobile && (
          <div aria-hidden="true" className="lab-picker-demo__handle" />
        )}
        <div className="lab-picker-demo__eyebrow">digest frequency</div>
        <div className="lab-picker-demo__question">
          How often should we write?
        </div>
        <PressAndSlidePicker
          options={frequencyOptions}
          value={value}
          onChange={key => {
            setValue(key);
            setLastEvent("change");
          }}
          itemWidth={ITEM_WIDTH}
        />
      </div>

      <div className="lab-picker-demo__readout">
        <div className="lab-picker-demo__readout-title">readout</div>
        {[
          {
            k: "value",
            v: frequencyOptions[index]?.label ?? "—",
            cls: "lab-picker-demo__readout-value--acc",
          },
          { k: "index", v: `${index} / ${frequencyOptions.length - 1}` },
          { k: "last event", v: lastEvent },
          {
            k: "px per option",
            v: `${ITEM_WIDTH}px`,
            cls: "lab-picker-demo__readout-value--muted",
          },
        ].map(row => (
          <div key={row.k} className="lab-picker-demo__readout-row">
            <span className="lab-picker-demo__readout-key">{row.k}</span>
            <span className={`lab-picker-demo__readout-value ${row.cls ?? ""}`}>
              {row.v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Presentation-mode visual: a scripted, non-interactive replica of the
 * picker mid-gesture — chip below, option strip above, driven per beat.
 */
export function PickerBeatVisual({ beat }: { beat: PresentationBeat }) {
  const sel = frequencyOptions[beat.sel];
  return (
    <div className="lab-beat-card">
      <div className="lab-beat-card__eyebrow">digest frequency</div>
      <div className="lab-beat-card__question">How often should we write?</div>
      <div className="lab-beat-card__picker">
        {beat.open && (
          <div className="lab-beat-card__strip">
            {frequencyOptions.map((o, i) => (
              <div
                key={o.key}
                className={`lab-beat-card__option ${
                  i === beat.active ? "lab-beat-card__option--active" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="lab-beat-card__dot"
                  style={{
                    background: i === beat.active ? "currentColor" : o.color,
                  }}
                />
                {o.label}
              </div>
            ))}
          </div>
        )}
        <div
          className={`lab-beat-card__trigger ${
            beat.open ? "lab-beat-card__trigger--open" : ""
          }`}
        >
          <span className="lab-beat-card__trigger-label">
            <span
              aria-hidden="true"
              className="lab-beat-card__dot lab-beat-card__dot--lg"
              style={{ background: sel.color }}
            />
            {sel.label}
          </span>
          <span aria-hidden="true" className="lab-beat-card__glyph">
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    </div>
  );
}
