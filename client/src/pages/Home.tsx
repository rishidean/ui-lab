/**
 * Landing page — the gallery. Everything renders from the registry.
 */
import { Link } from "wouter";
import { ArrowUpRight, Github } from "lucide-react";
import {
  AUTHOR_URL,
  GITHUB_URL,
  LAB_TAGLINE,
  labComponents,
} from "@/lab/registry";

export default function Home() {
  return (
    <div className="h-full overflow-auto">
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
        {/* Hero */}
        <section className="max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight text-[#211a2c] sm:text-5xl">
            Components you
            <br />
            haven't seen before.
          </h1>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-[#625a6d]">
            {LAB_TAGLINE}
          </p>
          <div className="mt-6 flex items-center gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#211a2c] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85"
            >
              <Github className="h-4 w-4" />
              View the code
            </a>
            <span className="text-sm text-[#9c95a4]">
              MIT licensed · copy freely
            </span>
          </div>
        </section>

        {/* Gallery */}
        <section className="mt-12 grid gap-5 sm:grid-cols-2">
          {labComponents.map(c => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className="group flex flex-col overflow-hidden rounded-3xl border border-[#e7e3ee] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div
                aria-hidden="true"
                className="relative h-36 overflow-hidden"
                style={{ background: c.accent }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(255_255_255/0.55),transparent_55%)]" />
                <span className="absolute bottom-4 left-5 rounded-full bg-white/85 px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-[#4b4456] backdrop-blur-sm">
                  {c.status}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold tracking-tight text-[#211a2c]">
                    {c.name}
                  </h2>
                  <ArrowUpRight className="h-5 w-5 shrink-0 text-[#b7b0c0] transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#5b21b6]" />
                </div>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[#625a6d]">
                  {c.tagline}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {c.tags.map(tag => (
                    <span
                      key={tag}
                      className="rounded-full bg-[#f1eef6] px-2.5 py-1 text-[0.6875rem] font-medium text-[#625a6d]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}

          {/* More coming */}
          <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-3xl border border-dashed border-[#d9d4e2] p-8 text-center">
            <span className="text-2xl" aria-hidden="true">
              ⚗️
            </span>
            <p className="mt-3 text-sm font-medium text-[#625a6d]">
              More experiments brewing
            </p>
            <p className="mt-1 text-xs text-[#9c95a4]">
              New components land here as they graduate from side projects.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-[#e7e3ee] pt-6 text-sm text-[#9c95a4]">
          <span>
            Built by{" "}
            <a
              href={AUTHOR_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#625a6d] underline-offset-2 hover:underline"
            >
              Rishi Dean
            </a>
          </span>
          <span>
            Tip: press{" "}
            <kbd className="rounded border border-[#d9d4e2] bg-white px-1.5 py-0.5 font-mono text-xs">
              H
            </kbd>{" "}
            on any demo to hide the chrome for recordings
          </span>
        </footer>
      </main>
    </div>
  );
}
