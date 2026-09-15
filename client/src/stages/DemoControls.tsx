/**
 * DemoControls — a LAB affordance for this stage only, not part of the
 * NavigationBar component. It lets the demo page tune dormancy depth,
 * tempo, size, and a reduced-motion override live. Someone copying
 * NavigationBar.tsx (and theme.css) into their own app gets none of
 * this — it has no equivalent in the component itself.
 */
import type { ChangeEvent } from "react";
import {
  NAV_SIZE_SPECS,
  type NavigationBarSize,
} from "@/components/navigation-bar";
import "./DemoControls.css";

interface DemoControlsProps {
  depth: number;
  onDepth: (value: number) => void;
  tempo: number;
  onTempo: (value: number) => void;
  reducedMotion: boolean;
  onReducedMotion: (value: boolean) => void;
  size: NavigationBarSize;
  onSize: (value: NavigationBarSize) => void;
  /** Controlled: the stage owns open/closed (the lab site drives it
   *  through postMessage when the stage is embedded). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Embedded in the lab site: no summary row — the site's own toolbar
   *  pill opens and closes the panel, so only the fieldset renders. */
  headless?: boolean;
}

export default function DemoControls({
  depth,
  onDepth,
  tempo,
  onTempo,
  reducedMotion,
  onReducedMotion,
  size,
  onSize,
  open,
  onOpenChange,
  headless = false,
}: DemoControlsProps) {
  const fieldset = (
      <fieldset className="demo-controls__fieldset">
        <legend className="demo-controls__legend">
          NavigationBar tunables
        </legend>

        <div className="demo-controls__row">
          <label htmlFor="demo-controls-depth" className="demo-controls__label">
            <span>Dormancy depth</span>
            <span className="demo-controls__value">
              {Math.round(depth * 100)}%
            </span>
          </label>
          <input
            id="demo-controls-depth"
            className="demo-controls__range"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={depth}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onDepth(Number(event.target.value))
            }
          />
        </div>

        <div className="demo-controls__row">
          <label htmlFor="demo-controls-tempo" className="demo-controls__label">
            <span>Tempo</span>
            <span className="demo-controls__value">{tempo.toFixed(1)}×</span>
          </label>
          <input
            id="demo-controls-tempo"
            className="demo-controls__range"
            type="range"
            min={0.6}
            max={3}
            step={0.1}
            value={tempo}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onTempo(Number(event.target.value))
            }
          />
        </div>

        <div className="demo-controls__row">
          <label htmlFor="demo-controls-size" className="demo-controls__label">
            <span>Size</span>
            <span className="demo-controls__value">
              {NAV_SIZE_SPECS[size].circle}px
            </span>
          </label>
          <select
            id="demo-controls-size"
            className="demo-controls__select"
            value={size}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              onSize(event.target.value as NavigationBarSize)
            }
          >
            {(Object.keys(NAV_SIZE_SPECS) as NavigationBarSize[]).map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="demo-controls__row demo-controls__row--checkbox">
          <input
            id="demo-controls-reduced-motion"
            className="demo-controls__checkbox"
            type="checkbox"
            checked={reducedMotion}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onReducedMotion(event.target.checked)
            }
          />
          <label
            htmlFor="demo-controls-reduced-motion"
            className="demo-controls__label demo-controls__label--inline"
          >
            Reduced motion override
          </label>
        </div>
      </fieldset>
  );
  if (headless) {
    // Stays in the DOM while closed (like a closed <details>), so the
    // a11y scripts that drive these inputs on the embedded route keep
    // working; `hidden` removes it from layout and the a11y tree.
    return (
      <div
        className="demo-controls demo-controls--headless"
        role="group"
        aria-label="Demo controls"
        hidden={!open}
      >
        {fieldset}
      </div>
    );
  }
  return (
    <details
      className="demo-controls"
      open={open}
      onToggle={event => onOpenChange(event.currentTarget.open)}
    >
      <summary className="demo-controls__summary">Demo controls</summary>
      {fieldset}
    </details>
  );
}
