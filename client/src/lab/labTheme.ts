/**
 * Shared bits of the lab redesign (Showcase + Home): the design's
 * dark/light palettes as --lab-* custom properties.
 */

/** Design palettes (pink accent). */
export const PALETTES: Record<"dark" | "light", Record<string, string>> = {
  dark: {
    "--lab-bg": "#131417",
    "--lab-panel": "#191b1f",
    "--lab-raised": "#21242a",
    "--lab-pop": "#262a31",
    "--lab-line": "#2b2f36",
    "--lab-text": "#e8e9ec",
    "--lab-muted": "#9aa0a9",
    "--lab-faint": "#61676f",
    "--lab-dots": "radial-gradient(#2b2f36 1px, transparent 1px)",
    "--lab-card-shadow": "0 40px 90px rgba(0,0,0,0.35)",
    "--lab-demo-shadow": "0 24px 60px rgba(0,0,0,0.4)",
    "--lab-pop-shadow": "0 28px 60px rgba(0,0,0,0.55)",
    "--lab-readout-bg": "rgba(19,20,23,0.7)",
    "--lab-acc": "#ff5fa8",
    "--lab-acc-ink": "#12140c",
    "--lab-accdim": "rgba(255,95,168,0.12)",
    "--lab-press-bg": "rgba(255,95,168,0.06)",
  },
  light: {
    "--lab-bg": "#fbfbf9",
    "--lab-panel": "#f3f3ef",
    "--lab-raised": "#ffffff",
    "--lab-pop": "#ffffff",
    "--lab-line": "#e2e2dc",
    "--lab-text": "#181a16",
    "--lab-muted": "#5c5f56",
    "--lab-faint": "#95988c",
    "--lab-dots": "radial-gradient(#e2e2dc 1px, transparent 1px)",
    "--lab-card-shadow": "0 30px 70px rgba(20,20,10,0.08)",
    "--lab-demo-shadow": "0 18px 40px rgba(20,20,10,0.08)",
    "--lab-pop-shadow": "0 22px 50px rgba(20,20,10,0.16)",
    "--lab-readout-bg": "rgba(255,255,255,0.7)",
    "--lab-acc": "#c22a75",
    "--lab-acc-ink": "#ffffff",
    "--lab-accdim": "rgba(194,42,117,0.08)",
    "--lab-press-bg": "rgba(194,42,117,0.06)",
  },
};

export const pad2 = (n: number) => String(n).padStart(2, "0");
