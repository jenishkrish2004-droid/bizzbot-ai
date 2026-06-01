import { Moon, Sun } from "lucide-react";

import { useTheme } from "../../contexts/ThemeContext";
import { cn } from "../../utils/cn";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-card/75 text-muted-foreground shadow-soft backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
    >
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
