import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { PillarTaxi } from "@/components/layout/PillarTaxi";
import logo from "@/assets/groundroot-logo.png";

export function AppShell() {
  const { pathname } = useLocation();
  // The full chrome (logo, wordmark, color palette, theme toggle) only appears
  // on the welcome surface — every pillar gets the cleaner taxi-only header.
  const isWelcome = pathname === "/" || pathname.startsWith("/welcome");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {isWelcome ? (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between px-4 pt-4 md:px-6">
          <Link
            to="/welcome"
            className="pointer-events-auto flex items-center gap-2"
          >
            <img src={logo} alt="GroundRoot" className="h-9 w-9 object-contain" width={36} height={36} />
            <span className="font-display text-lg text-gradient-brand-strong">
              GroundRoot
            </span>
          </Link>
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </header>
      ) : (
        <PillarTaxi />
      )}

      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
