/**
 * DemoControls — a LAB affordance shared by the demo stages, not part of
 * any component. The panel shell plus three row primitives (range,
 * select, checkbox); each stage composes the rows it needs. Someone
 * copying a component into their own app gets none of this.
 *
 * Open/closed is controlled by the stage (see useDemoControls): embedded
 * in the lab site it renders headless — no summary row, hidden when
 * closed but still in the DOM so scripts that drive its inputs keep
 * working; standalone it is a <details>.
 */
import type { ChangeEvent, ReactNode } from "react";
import "./DemoControls.css";

interface DemoControlsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headless?: boolean;
  /** Fieldset legend, e.g. "NavigationBar tunables". */
  legend: string;
  /** Which corner the panel hangs from. Right by default; a stage whose
   *  live controls sit at the right edge (the picker's chips) uses left. */
  align?: "left" | "right";
  children: ReactNode;
}

export default function DemoControls({
  open,
  onOpenChange,
  headless = false,
  legend,
  align = "right",
  children,
}: DemoControlsProps) {
  const alignClass = align === "left" ? " demo-controls--left" : "";
  const fieldset = (
    <fieldset className="demo-controls__fieldset">
      <legend className="demo-controls__legend">{legend}</legend>
      {children}
    </fieldset>
  );
  if (headless) {
    return (
      <div
        className={"demo-controls demo-controls--headless" + alignClass}
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
      className={"demo-controls" + alignClass}
      open={open}
      onToggle={event => onOpenChange(event.currentTarget.open)}
    >
      <summary className="demo-controls__summary">Demo controls</summary>
      {fieldset}
    </details>
  );
}

// ── Rows ──────────────────────────────────────────────────────────────

export function RangeRow({
  id,
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  /** Formatted value shown at the right of the label. */
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="demo-controls__row">
      <label htmlFor={id} className="demo-controls__label">
        <span>{label}</span>
        <span className="demo-controls__value">{display}</span>
      </label>
      <input
        id={id}
        className="demo-controls__range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(Number(event.target.value))
        }
      />
    </div>
  );
}

export function SelectRow<T extends string>({
  id,
  label,
  value,
  display,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  display?: string;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="demo-controls__row">
      <label htmlFor={id} className="demo-controls__label">
        <span>{label}</span>
        {display && <span className="demo-controls__value">{display}</span>}
      </label>
      <select
        id={id}
        className="demo-controls__select"
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange(event.target.value as T)
        }
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CheckRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="demo-controls__row demo-controls__row--checkbox">
      <input
        id={id}
        className="demo-controls__checkbox"
        type="checkbox"
        checked={checked}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.checked)
        }
      />
      <label
        htmlFor={id}
        className="demo-controls__label demo-controls__label--inline"
      >
        {label}
      </label>
    </div>
  );
}
