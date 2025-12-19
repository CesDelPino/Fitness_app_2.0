import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  CreditCard, 
  Users, 
  Wrench, 
  Target, 
  Dumbbell, 
  ClipboardList, 
  BadgeCheck, 
  UserCircle, 
  FileSearch, 
  UserPlus, 
  Shield, 
  Sparkles, 
  Store, 
  Package,
  ChevronDown,
  ChevronRight,
  Settings
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type SectionItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

type Section = {
  id: string;
  label: string;
  icon: React.ElementType;
  items: SectionItem[];
};

const sections: Section[] = [
  {
    id: "business",
    label: "Business",
    icon: BarChart3,
    items: [
      { label: "Stats", href: "/admin/business/stats", icon: Target },
      { label: "Subscriptions", href: "/admin/business/subscriptions", icon: CreditCard },
      { label: "Marketplace", href: "/admin/business/marketplace", icon: Store },
      { label: "Products", href: "/admin/business/products", icon: Package },
    ],
  },
  {
    id: "users",
    label: "Users",
    icon: Users,
    items: [
      { label: "Users", href: "/admin/users/list", icon: Users },
      { label: "Avatars", href: "/admin/users/avatars", icon: UserCircle },
      { label: "Verification", href: "/admin/users/verification", icon: BadgeCheck },
      { label: "Connections", href: "/admin/users/connections", icon: UserPlus },
      { label: "Audit", href: "/admin/users/audit", icon: FileSearch },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    icon: Dumbbell,
    items: [
      { label: "Equipment", href: "/admin/catalog/equipment", icon: Wrench },
      { label: "Goals", href: "/admin/catalog/goals", icon: Target },
      { label: "Exercises", href: "/admin/catalog/exercises", icon: Dumbbell },
      { label: "Routines", href: "/admin/catalog/routines", icon: ClipboardList },
      { label: "Presets", href: "/admin/catalog/presets", icon: Shield },
      { label: "Foods", href: "/admin/catalog/foods", icon: Sparkles },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: Settings,
    items: [
      { label: "Policy", href: "/admin/system/policy", icon: Shield },
      { label: "Features", href: "/admin/system/features", icon: Target },
    ],
  },
];

export function AdminSidebar() {
  const [location] = useLocation();
  const [expandedSections, setExpandedSections] = useState<string[]>(["business", "users", "catalog", "system"]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const isActive = (href: string) => location === href;
  const isSectionActive = (section: Section) => section.items.some((item) => location.startsWith(item.href.split("/").slice(0, -1).join("/")));

  return (
    <aside className="w-64 border-r bg-card flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">Admin Panel</h2>
        <p className="text-sm text-muted-foreground">v2</p>
      </div>
      <ScrollArea className="flex-1 p-2">
        <nav className="space-y-1">
          {sections.map((section) => {
            const isExpanded = expandedSections.includes(section.id);
            const SectionIcon = section.icon;
            
            return (
              <div key={section.id}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-between px-3 py-2 h-auto",
                    isSectionActive(section) && "bg-accent"
                  )}
                  onClick={() => toggleSection(section.id)}
                  data-testid={`sidebar-section-${section.id}`}
                >
                  <div className="flex items-center gap-2">
                    <SectionIcon className="w-4 h-4" />
                    <span>{section.label}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
                
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {section.items.map((item) => {
                      const ItemIcon = item.icon;
                      const itemKey = item.label.toLowerCase().replace(/\s+/g, "-");
                      return (
                        <Link 
                          key={item.href} 
                          href={item.href}
                          data-testid={`link-admin-${itemKey}`}
                        >
                          <Button
                            variant={isActive(item.href) ? "secondary" : "ghost"}
                            className={cn(
                              "w-full justify-start px-3 py-2 h-auto text-sm",
                              isActive(item.href) && "bg-secondary"
                            )}
                            data-testid={`sidebar-item-${itemKey}`}
                          >
                            <ItemIcon className="w-4 h-4 mr-2" />
                            {item.label}
                          </Button>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}
