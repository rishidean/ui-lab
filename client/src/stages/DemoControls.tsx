/**
 * DemoControls — a LAB affordance for this stage only, not part of the
 * NavigationBar component. It lets the demo page tune dormancy depth,
 * tempo, and a reduced-motion override live. Someone copying
 * NavigationBar.tsx (and theme.css) into their own app gets none of
 * this — it has no equivalent in the component itself.
 */
import type { ChangeEvent } from "react";
import "./DemoControls.css";

interface DemoControlsProps {
  depth: number;
  onDepth: (value: number) => void;
  tempo: number;
  onTempo: (value: number) => void;
  reducedMotion: boolean;
  onReducedMotion: (value: boolean) => void;
  /** Read once by the stage (e.g. from window.innerWidth) — this
   *  component never touches `window` itself. */
  defaultOpen: boolean;
}

export default function DemoControls({
  depth,
  onDepth,
  tempo,
  onTempo,
  reducedMotion,
  onReducedMotion,
  defaultOpen,
}: DemoControlsProps) {
  return (
    <details className="demo-controls" open={defaultOpen}>
      <summary className="demo-controls__summary">Demo controls</summary>

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
    </details>
  );
}
