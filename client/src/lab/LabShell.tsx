/**
 * Site chrome: fixed-height shell with a slim header. Press H (or add
 * ?recording=1 to the URL) to hide all chrome for clean screen recordings.
 */
import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Github } from "lucide-react";
import { GITHUB_URL, LAB_NAME, labComponents } from "@/lab/registry";
import { useRecordingMode } from "@/lab/recording";

export function LabShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const chromeHidden = useRecordingMode();

  return (
    <div className="flex h-dvh flex-col bg-[#f5f5f5] font-sans">
      {!chromeHidden && (
        <header className="z-50 shrink-0 border-b border-[#e7e3ee] bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-[0.95rem] font-semibold tracking-tight text-[#211a2c]"
            >
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 rounded-full"
                style={{
                  background:
                    "linear-gradient(135deg, #c4b5fd 0%, #f0abfc 46%, #a5b4fc 100%)",
                  boxShadow: "0 0 0 3px rgb(196 181 253 / 0.25)",
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
                        ? "bg-[#ede9fe] text-[#5b21b6]"
                        : "text-[#625a6d] hover:bg-[#f1eef6] hover:text-[#211a2c]"
                    }`}
                  >
                    {c.name}
                  </Link>
                );
              })}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="View on GitHub"
                className="ml-1 rounded-full p-2 text-[#625a6d] transition-colors hover:bg-[#f1eef6] hover:text-[#211a2c]"
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
