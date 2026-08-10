/**
 * Theme toggle — two-segment sun | moon pill shared by Home and Showcase
 * (desktop + mobile) headers. The active preset's segment is highlighted
 * so both states stay visible and it's unambiguous which one is current;
 * clicking the inactive segment (or its icon) switches presets.
 */
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  if (!toggleTheme) return null;

  const setLight = () => {
    if (theme !== "light") toggleTheme();
  };
  const setDark = () => {
    if (theme !== "dark") toggleTheme();
  };

  return (
    <div className="lab-theme-toggle" role="group" aria-label="Theme">
      <button
        type="button"
        className={`lab-btn lab-theme-toggle__seg ${
          theme === "light" ? "lab-theme-toggle__seg--active" : ""
        }`}
        aria-pressed={theme === "light"}
        aria-label="Light theme"
        onClick={setLight}
      >
        <Sun size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={`lab-btn lab-theme-toggle__seg ${
          theme === "dark" ? "lab-theme-toggle__seg--active" : ""
        }`}
        aria-pressed={theme === "dark"}
        aria-label="Dark theme"
        onClick={setDark}
      >
        <Moon size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
