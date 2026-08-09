/**
 * Site chrome: fixed-height shell with a slim header. Press H (or add
 * ?recording=1 to the URL) to hide all chrome for clean screen recordings.
 */
import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Github, Moon, Sun } from "lucide-react";
import { GITHUB_URL, LAB_NAME, labComponents } from "@/lab/registry";
import { useRecordingMode } from "@/lab/recording";
import { useTheme } from "@/contexts/ThemeContext";

export function LabShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const chromeHidden = useRecordingMode();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex h-dvh flex-col bg-[var(--bg-canvas)] font-sans">
      {!chromeHidden && (
        <header className="z-50 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-overlay)] backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-[0.95rem] font-semibold tracking-tight text-[var(--text-primary)]"
            >
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 rounded-full"
                style={{
                  background: "var(--gradient-brand)",
                  boxShadow:
                    "0 0 0 3px color-mix(in oklab, var(--accent-soft) 25%, transparent), inset 0 1px 1px rgba(255,255,255,0.6)",
                }}
              />
              {LAB_NAME}
            </Link>

            <nav
              className="flex items-center gap-1 overflow-x-auto"
              aria-label="Components"
            >
              {labComponents.map(c => {
                const href = `/${c.slug}`;
                const isActive =
                  location === href ||
                  c.aliases?.some(a => location === `/${a}`);
                return (
                  <Link
                    key={c.slug}
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--select-bg)] text-[var(--select-fg)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--action-ghost-bg-hover)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {c.name}
                  </Link>
                );
              })}
              {toggleTheme && (
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={
                    theme === "dark"
                      ? "Switch to Aurora (light) theme"
                      : "Switch to Ink (dark) theme"
                  }
                  title={theme === "dark" ? "Aurora theme" : "Ink theme"}
                  className="ml-1 rounded-full p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--action-ghost-bg-hover)] hover:text-[var(--text-primary)]"
                >
                  {theme === "dark" ? (
                    <Sun className="h-[18px] w-[18px]" />
                  ) : (
                    <Moon className="h-[18px] w-[18px]" />
                  )}
                </button>
              )}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="View on GitHub"
                className="rounded-full p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--action-ghost-bg-hover)] hover:text-[var(--text-primary)]"
              >
                <Github className="h-[18px] w-[18px]" />
              </a>
            </nav>
          </div>
        </header>
      )}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
