import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-card/60 p-1 backdrop-blur",
        className,
      )}
      role="group"
      aria-label="Color theme"
    >
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={theme === "dark"}
        title="Dark — black with yellow → orange → red"
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full transition-all",
          theme === "dark"
            ? "bg-gradient-brand text-background shadow-[var(--shadow-glow)]"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Moon className="h-3.5 w-3.5" />
        <span className="sr-only">Dark theme</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={theme === "light"}
        title="Light — blue → green → violet"
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full transition-all",
          theme === "light"
            ? "bg-gradient-brand text-background shadow-[var(--shadow-glow)]"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Sun className="h-3.5 w-3.5" />
        <span className="sr-only">Light theme</span>
      </button>
    </div>
  );
}
