/**
 * Syntax-highlighted, copyable code panel.
 * The highlighter is lazy-loaded so demo routes stay light.
 */
import { lazy, Suspense, useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

const Highlighter = lazy(async () => {
  const [{ default: PrismLight }, { default: tsx }, { default: oneLight }] =
    await Promise.all([
      import("react-syntax-highlighter/dist/esm/prism-light"),
      import("react-syntax-highlighter/dist/esm/languages/prism/tsx"),
      import("react-syntax-highlighter/dist/esm/styles/prism/one-light"),
    ]);
  PrismLight.registerLanguage("tsx", tsx);
  return {
    default: ({ code }: { code: string }) => (
      <PrismLight
        language="tsx"
        style={oneLight}
        showLineNumbers
        wrapLongLines={false}
        customStyle={{
          margin: 0,
          padding: "1.25rem 1rem 2rem",
          background: "transparent",
          fontSize: "0.8125rem",
          lineHeight: 1.6,
        }}
        lineNumberStyle={{ color: "#b7b0c0", minWidth: "2.75em" }}
      >
        {code}
      </PrismLight>
    ),
  };
});

export function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [text]);

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#e4e0ea] bg-white px-3 py-1.5 text-xs font-semibold text-[#4b4456] shadow-sm transition-colors hover:bg-[#f6f4fa] hover:text-[#211a2c]"
      aria-live="polite"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}

export function CodeBlock({
  code,
  filename,
}: {
  code: string;
  filename?: string;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#e4e0ea] bg-white shadow-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-[#eeebf3] px-4 py-2.5">
        <span className="font-mono text-xs text-[#77727c]">{filename}</span>
        <CopyButton text={code} label="Copy source" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <Suspense
          fallback={
            <pre className="p-4 font-mono text-[0.8125rem] leading-relaxed text-[#4b4456]">
              {code}
            </pre>
          }
        >
          <Highlighter code={code} />
        </Suspense>
      </div>
    </div>
  );
}
