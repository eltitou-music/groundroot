import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Sparkles, Layers, Music, Library, Sliders, Info, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import logo from "@/assets/groundroot-logo.png";

type NavItem = {
  label: string;
  to?: string;
  icon: typeof Sparkles;
  comingSoon?: boolean;
};

const navItems: NavItem[] = [
  { label: "Intro", to: "/", icon: Sparkles },
  { label: "Beatmaker", to: "/beatmaker", icon: Music },
  { label: "Library", to: "/library", icon: Library },
  { label: "Mastering", to: "/mastering", icon: Sliders },
  { label: "Assembly", to: "/assembly", icon: Layers },
  { label: "About", to: "/about", icon: Info },
];

export function AppShell() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-56 flex-col border-r border-border bg-sidebar px-3 py-6 md:flex">
        <div className="px-3 pb-8">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={logo}
              alt="GroundRoot"
              className="h-8 w-8 object-contain"
            />
            <span className="font-display text-lg text-gradient-brand-strong">
              GroundRoot
            </span>
          </Link>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = item.to && location.pathname === item.to;
            const Icon = item.icon;

            if (item.comingSoon) {
              return (
                <div
                  key={item.label}
                  className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
                  title="Coming soon"
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  <Lock className="h-3 w-3 opacity-60" />
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                to={item.to!}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-sidebar-foreground hover:bg-accent/50",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-3 pt-6 text-xs text-muted-foreground/70">
          Phase 1 · Assembly
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="pointer-events-none sticky top-0 z-40 flex justify-end px-4 pt-4 md:px-6">
          <div className="pointer-events-auto">
            <ThemeToggle />
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}