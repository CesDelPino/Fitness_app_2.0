import { Link, useLocation } from "wouter";
import { NotebookPen, LineChart, Dumbbell, Scale, Store } from "lucide-react";

export default function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", icon: NotebookPen, label: "Daily Log" },
    { path: "/log", icon: LineChart, label: "Stats" },
    { path: "/train", icon: Dumbbell, label: "Train" },
    { path: "/weigh-in", icon: Scale, label: "Weigh-In" },
    { path: "/marketplace", icon: Store, label: "Shop" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-card-border z-50">
      <div className="flex items-center justify-around h-full max-w-2xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              className="flex flex-col items-center justify-center gap-1 min-h-12 px-4 hover-elevate active-elevate-2 rounded-md"
              data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
            >
              <Icon
                className={`w-6 h-6 ${isActive ? "text-primary" : "text-muted-foreground"}`}
              />
              <span
                className={`text-xs font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
