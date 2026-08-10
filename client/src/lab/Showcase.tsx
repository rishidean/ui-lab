/**
 * Showcase — the redesigned component page (from the Claude Design
 * "Custom Component Showcase Redesign" project, UI Lab.dc.html).
 *
 * Desktop (≥1024px) renders the full lab bench: framed card with header,
 * index sidebar, Demo/Code/Props tabs, a Desktop/Mobile viewport toggle,
 * problem/solution copy, the lab grid, and — where a component defines
 * presentation beats — a 1920×1080 presentation stage for recording
 * walkthroughs (click it or hit Present, then ← / → to step beats).
 *
 * Below 1024px, with ?embed=1, or in recording mode (H) the route renders
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
  type ComponentType,
} from "react";
import { Link } from "wouter";
import {
  AUTHOR_URL,
  labComponents,
  type LabComponent,
  type PresentationBeat,
  type PropRow,
} from "@/lab/registry";
import { useRecordingMode } from "@/lab/recording";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/lab/ThemeToggle";
import { PickerBeatVisual, PickerDemo } from "@/lab/PickerShowcase";
import { pad2, PALETTES } from "@/lab/labTheme";
import "./Showcase.css";

const BEAT_MS = 2600;

/** Per-slug presentation visuals (scripted, beat-driven). */
const BEAT_VISUALS: Record<
  string,
  ComponentType<{ beat: PresentationBeat }>
> = {
  "press-and-slide-picker": PickerBeatVisual,
};

/** Per-slug interactive Demo-tab surfaces; others embed their Stage. */
const DEMOS: Record<string, ComponentType<{ mobile: boolean }>> = {
  "press-and-slide-picker": PickerDemo,
};

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

/** Code tab body — the component source and its usage snippet. */
function CodePanels({ component }: { component: LabComponent }) {
  return (
    <div className="lab-code-stack">
      <div className="lab-code">
        <div className="lab-code__head">
          <span>{component.sourceFile}</span>
          <CopyChip text={component.source} />
        </div>
        <pre className="lab-code__pre">{component.source}</pre>
      </div>
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

  // Presentation mode.
  const beats = component.showcase.beats;
  const [beat, setBeat] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [stageLive, setStageLive] = useState(false);
  const stageOuterRef = useRef<HTMLDivElement | null>(null);
  const [stageScale, setStageScale] = useState(0.75);

  const stepBeat = useCallback(
    (dir: number) => {
      const n = beats?.length ?? 0;
      if (n) setBeat(b => (b + dir + n) % n);
    },
    [beats]
  );

  useEffect(() => {
    if (!stageLive || !beats) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        stepBeat(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepBeat(-1);
      } else if (e.key === "Escape") {
        setStageLive(false);
        setPlaying(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stageLive, beats, stepBeat]);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => stepBeat(1), BEAT_MS);
    return () => window.clearInterval(t);
  }, [playing, stepBeat]);

  useEffect(() => {
    const el = stageOuterRef.current;
    if (!el) return;
    const measure = () => setStageScale(el.clientWidth / 1920);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isDesktop, embedded, chromeHidden, beats]);

  const { Stage } = component;

  // Truly bare stage: iframe embeds and recording mode (H).
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
  const Demo = DEMOS[component.slug];
  const BeatVisual = BEAT_VISUALS[component.slug];
  const currentBeat = beats?.[beat];

  const present = () => {
    setStageLive(true);
    stageOuterRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  return (
    <div className="lab" style={PALETTES[theme] as React.CSSProperties}>
      <div className={`lab__wrap ${beats ? "" : "lab__wrap--plain"}`}>
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
              {beats && (
                <button
                  type="button"
                  className="lab-btn lab-header__present"
                  onClick={present}
                >
                  present
                </button>
              )}
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
                <div className="lab-tabs__group lab-tabs__group--views">
                  {VIEWS.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={view === v.id}
                      className={`lab-btn lab-tab ${
                        view === v.id ? "lab-tab--active" : ""
                      }`}
                      onClick={() => setView(v.id)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lab-canvas-wrap">
                <div className="lab-canvas">
                  {/* Demo stays mounted across tab switches. */}
                  <div
                    className={`lab-canvas__keep ${
                      tab === "demo" ? "" : "lab-canvas__keep--hidden"
                    }`}
                  >
                    {Demo ? (
                      <Demo mobile={view === "mobile"} />
                    ) : (
                      <iframe
                        key={theme}
                        src={`/${component.slug}?embed=1`}
                        title={`${component.name} demo`}
                        className={`lab-frame ${
                          view === "mobile" ? "lab-frame--mobile" : ""
                        }`}
                      />
                    )}
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

        {/* Presentation mode */}
        {beats && currentBeat && (
          <>
            <div className="lab-present-label">
              <span>Presentation mode · 1920 × 1080</span>
            </div>
            <div
              ref={stageOuterRef}
              className="lab-stage-outer"
              style={{ height: Math.round(1080 * stageScale) }}
              onClick={() => setStageLive(true)}
            >
              <div
                className="lab-stage"
                style={{ transform: `scale(${stageScale})` }}
              >
                <div className="lab-stage__brand">
                  <span aria-hidden="true" className="lab-stage__brand-logo" />
                  <span>rishi's ui lab / component {number}</span>
                </div>
                <div
                  className={`lab-stage__live ${
                    stageLive ? "lab-stage__live--on" : ""
                  }`}
                >
                  {stageLive ? "live · ← → to step" : "click to take control"}
                </div>

                <div>
                  <div aria-hidden="true" className="lab-stage__rule" />
                  <div className="lab-stage__beatbox">
                    <h2 key={beat} className="lab-stage__beat-title">
                      {currentBeat.title}
                    </h2>
                    <p className="lab-stage__beat-sub">{currentBeat.sub}</p>
                  </div>
                </div>

                <div className="lab-stage__visual">
                  {BeatVisual && <BeatVisual beat={currentBeat} />}
                </div>

                <div className="lab-stage__dots">
                  {beats.map((b, i) => (
                    <button
                      key={b.title}
                      type="button"
                      aria-label={`Beat ${i + 1}: ${b.title}`}
                      aria-current={i === beat}
                      className={`lab-btn lab-stage__dot ${
                        i === beat ? "lab-stage__dot--active" : ""
                      }`}
                      onClick={() => {
                        setStageLive(true);
                        setBeat(i);
                      }}
                    />
                  ))}
                </div>

                <div className="lab-stage__ctrl">
                  <button
                    type="button"
                    className="lab-btn lab-stage__play"
                    onClick={e => {
                      e.stopPropagation();
                      setStageLive(true);
                      setPlaying(p => !p);
                    }}
                  >
                    {playing ? "pause" : "play"}
                  </button>
                  <button
                    type="button"
                    aria-label="Previous beat"
                    className="lab-btn lab-stage__prev"
                    onClick={() => stepBeat(-1)}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    aria-label="Next beat"
                    className="lab-btn lab-stage__next"
                    onClick={() => stepBeat(1)}
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
            <div className="lab-stage-caption">
              Click the stage, then use ← / → to step beats. Play runs it
              hands-free for recording.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
