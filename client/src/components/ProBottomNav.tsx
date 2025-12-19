import { Link, useLocation } from "wouter";
import { LayoutDashboard, MessageSquare, Package, Store } from "lucide-react";

export default function ProBottomNav() {
  const [location] = useLocation();

  const navItems = [
    { path: "/pro", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/pro/messages", icon: MessageSquare, label: "Messages" },
    { path: "/pro/products", icon: Package, label: "Products" },
    { path: "/pro/storefront", icon: Store, label: "Storefront" },
  ];

  const isActive = (path: string) => {
    if (path === "/pro") {
      return location === "/pro";
    }
    return location.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-card-border z-50">
      <div className="flex items-center justify-around h-full max-w-2xl mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              href={item.path}
              className="flex flex-col items-center justify-center gap-1 min-h-12 px-4 hover-elevate active-elevate-2 rounded-md"
              data-testid={`nav-pro-${item.label.toLowerCase()}`}
            >
              <Icon
                className={`w-6 h-6 ${active ? "text-primary" : "text-muted-foreground"}`}
              />
              <span
                className={`text-xs font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
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
