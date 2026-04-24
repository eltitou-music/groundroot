import { Link, Outlet } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import logo from "@/assets/pio-near-logo.png";

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between px-4 pt-4 md:px-6">
        <Link
          to="/welcome"
          className="pointer-events-auto flex items-center gap-2"
        >
          <img src={logo} alt="Pio - Near" className="h-9 w-9 object-contain" />
          <span className="font-display text-lg text-gradient-brand-strong">
            Pio - Near
          </span>
        </Link>
        <div className="pointer-events-auto">
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
