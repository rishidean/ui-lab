/**
 * Component detail page — shadcn-style Preview / Code / Usage tabs
 * rendered from a registry entry.
 */
import { useState } from "react";
import { CodeBlock, CopyButton } from "@/lab/CodeBlock";
import type { LabComponent } from "@/lab/registry";
import { useRecordingMode } from "@/lab/recording";

type TabId = "preview" | "code" | "usage";

const TABS: { id: TabId; label: string }[] = [
  { id: "preview", label: "Preview" },
  { id: "code", label: "Code" },
  { id: "usage", label: "Usage" },
];

export function ComponentPage({ component }: { component: LabComponent }) {
  const [tab, setTab] = useState<TabId>("preview");
  const chromeHidden = useRecordingMode();
  const { Stage } = component;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!chromeHidden && (
        <div className="z-40 shrink-0 border-b border-[#e7e3ee] bg-white/70 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-semibold tracking-tight text-[#211a2c]">
                  {component.name}
                </h1>
                <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-emerald-700">
                  {component.status}
                </span>
              </div>
              <p className="hidden truncate text-xs text-[#77727c] sm:block">
                {component.tagline}
              </p>
            </div>

            <div
              className="flex shrink-0 items-center gap-0.5 rounded-full border border-[#e4e0ea] bg-[#f6f4fa] p-0.5"
              role="tablist"
              aria-label={`${component.name} views`}
            >
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                    tab === id
                      ? "bg-white text-[#211a2c] shadow-sm"
                      : "text-[#625a6d] hover:text-[#211a2c]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {/* The stage stays mounted across tab switches so demo state survives. */}
        <div className={tab === "preview" ? "h-full" : "hidden"}>
          <Stage />
        </div>

        {tab === "code" && (
          <div className="mx-auto h-full w-full max-w-6xl p-4 sm:p-6">
            <CodeBlock
              code={component.source}
              filename={component.sourceFile}
            />
          </div>
        )}

        {tab === "usage" && (
          <div className="h-full overflow-auto">
            <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
              <h2 className="text-lg font-semibold tracking-tight text-[#211a2c]">
                About this component
              </h2>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-[#4b4456]">
                {component.description}
              </p>

              <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[#77727c]">
                Try it
              </h3>
              <ul className="mt-3 space-y-2">
                {component.tryIt.map(hint => (
                  <li
                    key={hint}
                    className="flex gap-2.5 text-[0.9375rem] text-[#4b4456]"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: component.accent }}
                    />
                    {hint}
                  </li>
                ))}
              </ul>

              <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-[#77727c]">
                Dependencies
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {component.dependencies.map(dep => (
                  <span
                    key={dep}
                    className="rounded-full border border-[#e4e0ea] bg-white px-3 py-1 font-mono text-xs text-[#4b4456]"
                  >
                    {dep}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[#77727c]">
                  Wiring it up
                </h3>
                <CopyButton text={component.usage} label="Copy example" />
              </div>
              <pre className="mt-3 overflow-x-auto rounded-2xl border border-[#e4e0ea] bg-white p-4 font-mono text-[0.8125rem] leading-relaxed text-[#38313f] shadow-sm">
                {component.usage}
              </pre>

              <p className="mt-8 pb-8 text-sm text-[#77727c]">
                Grab the full implementation from the{" "}
                <button
                  type="button"
                  onClick={() => setTab("code")}
                  className="font-semibold text-[#5b21b6] underline-offset-2 hover:underline"
                >
                  Code tab
                </button>{" "}
                — it's a single self-contained file.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
