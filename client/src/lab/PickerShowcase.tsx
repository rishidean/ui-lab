/**
 * Showcase surfaces for the Press & Slide Picker — the interactive demo
 * card (hosting the real component) and the scripted presentation-mode
 * beat visual. Both read the --lab-* palette set by lab/Showcase.tsx.
 */
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
