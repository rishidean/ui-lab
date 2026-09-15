/**
 * Showcase — the redesigned component page (from the Claude Design
 * "Custom Component Showcase Redesign" project, UI Lab.dc.html).
 *
 * Desktop (≥1024px) renders the full lab bench: framed card with header,
 * index sidebar, Demo/Code/Props tabs, a Desktop/Mobile viewport toggle,
 * problem/solution copy, and the lab grid.
 *
 * Below 1024px, with ?embed=1, ?example=<id>, or in recording mode (H) the route renders
 * the bare Stage full-viewport — phones get the component itself, and the
 * desktop demo canvas embeds that same bare route in an iframe so the
 * stages' fixed-position choreography runs in a true nested viewport.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "wouter";
import { Monitor, SlidersHorizontal, Smartphone } from "lucide-react";
import {
  AUTHOR_URL,
  labComponents,
  type LabComponent,
  type LabInstall,
  type PropRow,
} from "@/lab/registry";
import { useRecordingMode } from "@/lab/recording";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/lab/ThemeToggle";
import { pad2, PALETTES } from "@/lab/labTheme";
import "./Showcase.css";

const TABS = [
  { id: "demo", label: "Demo" },
  { id: "code", label: "Code" },
  { id: "props", label: "Props" },
] as const;

const VIEWS = [
  { id: "desktop", label: "Desktop" },
  { id: "mobile", label: "Mobile" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type ViewId = (typeof VIEWS)[number]["id"];

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="lab-btn lab-code__copy"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

/** Desktop / phone viewport toggle, pinned to the demo canvas. */
function ViewToggle({
  view,
  onChange,
}: {
  view: ViewId;
  onChange: (v: ViewId) => void;
}) {
  return (
    <div className="lab-view-toggle" role="group" aria-label="Demo viewport">
      {VIEWS.map(v => {
        const Icon = v.id === "mobile" ? Smartphone : Monitor;
        return (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            aria-label={`${v.label} viewport`}
            title={`${v.label} viewport`}
            className={`lab-btn lab-view-toggle__btn ${
              view === v.id ? "lab-view-toggle__btn--active" : ""
            }`}
            onClick={() => onChange(v.id)}
          >
            <Icon aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

/** One-command install: the served registry manifest, or the zip. */
function InstallPanel({ install, name }: { install: LabInstall; name: string }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const command = `npx shadcn@latest add ${origin}${install.manifest}`;
  return (
    <div className="lab-code lab-install">
      <div className="lab-code__head">
        <span>install</span>
        <CopyChip text={command} />
      </div>
      <pre className="lab-code__pre lab-install__cmd" data-install-command>
        {command}
      </pre>
      <p className="lab-install__note">
        One command copies the {name} folder into your project, adds{" "}
        <code>{install.npm.join(", ")}</code>, and injects its CSS variables.
        {install.tailwind ? " Needs Tailwind v4." : " No Tailwind needed."} No CLI?{" "}
        <a className="lab-install__zip" href={install.zip} download>
          download the folder as a zip
        </a>{" "}
        — the same files plus a <code>tokens.css</code>.
      </p>
    </div>
  );
}

/** Code tab body — the install panel, the component source, examples, usage. */
function CodePanels({ component }: { component: LabComponent }) {
  return (
    <div className="lab-code-stack">
      {component.install && (
        <InstallPanel install={component.install} name={component.name} />
      )}
      <div className="lab-code">
        <div className="lab-code__head">
          <span>{component.sourceFile}</span>
          <CopyChip text={component.source} />
        </div>
        <pre className="lab-code__pre">{component.source}</pre>
      </div>
      {component.examples?.map(ex => (
        <div className="lab-code" key={ex.id}>
          <div className="lab-code__head">
            <span>
              {ex.title}
              <a
                className="lab-code__open"
                href={`/${component.slug}?example=${ex.id}`}
                target="_blank"
                rel="noreferrer"
              >
                open ↗
              </a>
            </span>
            <CopyChip text={ex.source} />
          </div>
          <pre className="lab-code__pre">{ex.source}</pre>
        </div>
      ))}
      <div className="lab-code">
        <div className="lab-code__head">
          <span>usage</span>
          <CopyChip text={component.usage} />
        </div>
        <pre className="lab-code__pre">{component.usage}</pre>
      </div>
    </div>
  );
}

/** Props tab body. */
function PropsTable({ rows }: { rows: PropRow[] }) {
  return (
    <div className="lab-props">
      <div className="lab-props__head" aria-hidden="true">
        <span>prop</span>
        <span>type</span>
        <span>default</span>
        <span>notes</span>
      </div>
      {rows.map(p => (
        <div key={p.name} className="lab-props__row">
          <span className="lab-props__name">{p.name}</span>
          <span className="lab-props__type">{p.type}</span>
          <span className="lab-props__def">{p.def}</span>
          <span className="lab-props__note">{p.note}</span>
        </div>
      ))}
    </div>
  );
}

export function Showcase({ component }: { component: LabComponent }) {
  const { theme } = useTheme();
  const chromeHidden = useRecordingMode();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const embedded = useMemo(
    () => new URLSearchParams(window.location.search).has("embed"),
    []
  );

  const [tab, setTab] = useState<TabId>("demo");
  const [view, setView] = useState<ViewId>("desktop");

  // The stage's DemoControls panel lives inside the embedded iframe; the
  // toolbar pill above the canvas drives it over postMessage (same
  // origin). Re-sent on iframe load, since the theme toggle re-keys it.
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const postControls = useCallback((open: boolean) => {
    frameRef.current?.contentWindow?.postMessage(
      { type: "lab:demo-controls", open },
      window.location.origin
    );
  }, []);
  useEffect(() => {
    postControls(controlsOpen);
  }, [controlsOpen, postControls]);


  const { Stage } = component;
  const exampleId = useMemo(
    () => new URLSearchParams(window.location.search).get("example"),
    []
  );
  const Example = component.examples?.find(e => e.id === exampleId)?.Component;

  // Truly bare: example routes, iframe embeds, and recording mode (H).
  if (Example) {
    return (
      <div className="lab-bare">
        <Example />
      </div>
    );
  }
  if (embedded || chromeHidden) {
    return (
      <div className="lab-bare">
        <Stage />
      </div>
    );
  }

  // Phone / portrait tablet: compact chrome — component index strip and
  // Demo/Code/Props tabs — around the full-viewport stage. (No
  // Desktop/Mobile view toggle: you're already on the device.)
  if (!isDesktop) {
    return (
      <div
        className="lab lab-mobile"
        style={PALETTES[theme] as React.CSSProperties}
      >
        <header className="lab-mobile__header">
          <Link href="/" className="lab-header__brand">
            <span aria-hidden="true" className="lab-logo" />
            <span className="lab-header__title">rishi's ui lab</span>
          </Link>
          <ThemeToggle />
        </header>

        <nav className="lab-mobile__comps" aria-label="Components">
          {labComponents.map((c, i) => {
            const isCurrent = c.slug === component.slug;
            return (
              <Link
                key={c.slug}
                href={`/${c.slug}`}
                className={`lab-mobile__comp ${
                  isCurrent ? "lab-mobile__comp--current" : ""
                }`}
                aria-current={isCurrent ? "page" : undefined}
              >
                <span className="lab-mobile__comp-num">{pad2(i + 1)}</span>
                {c.name}
              </Link>
            );
          })}
        </nav>

        <div
          className="lab-mobile__tabs"
          role="tablist"
          aria-label={`${component.name} views`}
        >
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`lab-btn lab-tab ${
                tab === t.id ? "lab-tab--active" : ""
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="lab-mobile__content">
          {/* Stage stays mounted across tab switches. */}
          <div
            className={`lab-mobile__stage ${
              tab === "demo" ? "" : "lab-mobile__stage--hidden"
            }`}
          >
            <Stage />
          </div>
          {tab === "code" && (
            <div className="lab-mobile__scroll">
              <CodePanels component={component} />
            </div>
          )}
          {tab === "props" && (
            <div className="lab-mobile__scroll">
              <PropsTable rows={component.showcase.propRows} />
            </div>
          )}
        </div>
      </div>
    );
  }

  const number = pad2(
    labComponents.findIndex(c => c.slug === component.slug) + 1
  );
  const meta = component.showcase;
  return (
    <div className="lab" style={PALETTES[theme] as React.CSSProperties}>
      <div className="lab__wrap lab__wrap--plain">
        <div className="lab__card">
          {/* Header */}
          <div className="lab-header">
            <div className="lab-header__brand">
              <span aria-hidden="true" className="lab-logo" />
              <Link href="/" className="lab-header__title">
                rishi's ui lab
              </Link>
            </div>
            <div className="lab-header__right">
              <ThemeToggle />
            </div>
          </div>

          <div className="lab-body">
            {/* Index sidebar */}
            <nav className="lab-side" aria-label="Components">
              <div className="lab-side__label">index</div>
              {labComponents.map((c, i) => (
                <Link
                  key={c.slug}
                  href={`/${c.slug}`}
                  className={`lab-side__row ${
                    c.slug === component.slug ? "lab-side__row--current" : ""
                  }`}
                  aria-current={c.slug === component.slug ? "page" : undefined}
                >
                  <span className="lab-side__num">{pad2(i + 1)}</span>
                  <span className="lab-side__name">{c.name}</span>
                </Link>
              ))}
              <div className="lab-side__foot">
                <a
                  href={AUTHOR_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="lab-side__site"
                >
                  rishidean.com →
                </a>
                <span className="lab-side__mit">mit · free forever</span>
              </div>
            </nav>

            {/* Main column */}
            <div className="lab-main">
              <div className="lab-hero">
                <div className="lab-hero__category">
                  component {number} / {meta.category}
                </div>
                <h1 className="lab-hero__title">{component.name}</h1>
                <p className="lab-hero__lede">{meta.lede}</p>
              </div>

              <div className="lab-tabs">
                <div
                  className="lab-tabs__group"
                  role="tablist"
                  aria-label={`${component.name} views`}
                >
                  {TABS.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={tab === t.id}
                      className={`lab-btn lab-tab ${
                        tab === t.id ? "lab-tab--active" : ""
                      }`}
                      onClick={() => setTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lab-canvas-wrap">
                {tab === "demo" && (
                  <div className="lab-canvas-tools">
                    <ViewToggle view={view} onChange={setView} />
                    {component.demoControls && (
                      <button
                        type="button"
                        aria-pressed={controlsOpen}
                        aria-label="Demo controls"
                        title="Demo controls"
                        className={`lab-btn lab-tool-pill ${
                          controlsOpen ? "lab-tool-pill--active" : ""
                        }`}
                        onClick={() => setControlsOpen(o => !o)}
                      >
                        <SlidersHorizontal aria-hidden="true" />
                        <span>controls</span>
                      </button>
                    )}
                  </div>
                )}
                <div className="lab-canvas">
                  {/* Demo stays mounted across tab switches. */}
                  <div
                    className={`lab-canvas__keep ${
                      tab === "demo" ? "" : "lab-canvas__keep--hidden"
                    }`}
                  >
                    <iframe
                      key={theme}
                      ref={frameRef}
                      onLoad={() => postControls(controlsOpen)}
                      src={`/${component.slug}?embed=1`}
                      title={`${component.name} demo`}
                      className={`lab-frame ${
                        view === "mobile" ? "lab-frame--mobile" : ""
                      }`}
                    />
                  </div>

                  {tab === "code" && <CodePanels component={component} />}

                  {tab === "props" && <PropsTable rows={meta.propRows} />}
                </div>

                {tab === "demo" && (
                  <div className="lab-tryit">
                    {component.tryIt.map(hint => (
                      <div key={hint} className="lab-tryit__hint">
                        {hint}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lab-cols">
                <div className="lab-col">
                  <div className="lab-col__label">the problem</div>
                  <p>{meta.problem}</p>
                </div>
                <div className="lab-col">
                  <div className="lab-col__label">what I did</div>
                  <p>{meta.solution}</p>
                </div>
              </div>

              <div className="lab-caveat-wrap">
                <div className="lab-caveat">
                  <div className="lab-caveat__tag">fair warning</div>
                  <p>
                    I am not a frontend developer. I vibe-coded this out of my
                    head because I wanted to feel it, not argue about it. It
                    works. Steal it, break it, ship it better.
                  </p>
                </div>
              </div>

              <div className="lab-foot">
                <span className="lab-foot__license">
                  free · mit · no attribution needed
                </span>
                <a
                  href={AUTHOR_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="lab-foot__link"
                >
                  rishidean.com →
                </a>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
