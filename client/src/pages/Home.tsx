/**
 * Landing page — the lab redesign's Home (UI Lab - Home.dc.html).
 * Full-bleed: header strip, hero, the 9-slot index grid, the
 * fair-warning banner, and the footer. Everything renders from the
 * registry via lab/labTheme; palette + type ride Showcase.css.
 */
import { Link } from "wouter";
import { AUTHOR_URL, labComponents, PLANNED_COUNT } from "@/lab/registry";
import { labRows, pad2, PALETTES } from "@/lab/labTheme";
import { useTheme } from "@/contexts/ThemeContext";
import "@/lab/Showcase.css";

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const rows = labRows();
  const first = labComponents[0];

  return (
    <div className="lab" style={PALETTES[theme] as React.CSSProperties}>
      <header className="lab-home-header">
        <div className="lab-header__brand">
          <span aria-hidden="true" className="lab-logo" />
          <span className="lab-header__title">rishi's ui lab</span>
        </div>
        <div className="lab-header__right">
          <span className="lab-header__kbd">
            find component <kbd>⌘K</kbd>
          </span>
          {toggleTheme && (
            <button
              type="button"
              className="lab-btn lab-header__theme"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
            >
              {theme === "dark" ? "☾ dark" : "☀ light"}
            </button>
          )}
          <a
            href={AUTHOR_URL}
            target="_blank"
            rel="noreferrer"
            className="lab-header__theme lab-home-header__site"
          >
            rishidean.com →
          </a>
        </div>
      </header>

      <main>
        <section className="lab-home-hero">
          <div className="lab-home-hero__eyebrow">
            a personal component lab · by rishi dean
          </div>
          <h1 className="lab-home-hero__title">
            Interactions worth{" "}
            <span className="lab-home-hero__steal">stealing.</span>
          </h1>
          <p className="lab-home-hero__lede">
            I build one interaction at a time, mostly to feel it in my own
            hands. Every one here is live, dissectible, and free to copy — code,
            props, and all.
          </p>
          <div className="lab-home-hero__row">
            <Link href={`/${first.slug}`} className="lab-home-hero__cta">
              open the first one
            </Link>
            <span className="lab-home-hero__chip">
              {pad2(labComponents.length)} built · {pad2(PLANNED_COUNT)} planned
            </span>
          </div>
        </section>

        <section
          className="lab-home-index"
          aria-label={`Index of ${PLANNED_COUNT} components`}
        >
          <div className="lab-home-index__head">
            <span>index / {pad2(PLANNED_COUNT)} components</span>
            <span className="lab-home-index__hint">click any row to open</span>
          </div>
          <div className="lab-home-grid">
            {rows.map(row =>
              row.component ? (
                <Link
                  key={row.num}
                  href={`/${row.component.slug}`}
                  className="lab-home-card"
                >
                  <div className="lab-home-card__meta">
                    <span className="lab-home-card__num">{row.num}</span>
                    <span className="lab-home-card__status">shipped</span>
                  </div>
                  <div>
                    <div className="lab-home-card__name">
                      {row.component.name}
                    </div>
                    <div className="lab-home-card__desc">
                      {row.component.showcase.blurb}
                    </div>
                  </div>
                </Link>
              ) : (
                <div
                  key={row.num}
                  className="lab-home-card lab-home-card--oven"
                >
                  <div className="lab-home-card__meta">
                    <span className="lab-home-card__num">{row.num}</span>
                    <span className="lab-home-card__status">in the oven</span>
                  </div>
                  <div>
                    <div className="lab-home-card__name">Unnamed</div>
                    <div className="lab-home-card__desc">In the oven.</div>
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        <section className="lab-home-banner-wrap">
          <div className="lab-home-banner">
            <div>
              <div className="lab-home-banner__tag">
                not a frontend developer
              </div>
              <p className="lab-home-banner__copy">
                I vibe-code these out of my head because I want to feel the idea
                before I argue about it. They work. Steal them, break them, ship
                them better.
              </p>
            </div>
            <a
              href={AUTHOR_URL}
              target="_blank"
              rel="noreferrer"
              className="lab-home-banner__link"
            >
              more of my thinking →
            </a>
          </div>
        </section>
      </main>

      <footer className="lab-home-foot">
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
      </footer>
    </div>
  );
}
