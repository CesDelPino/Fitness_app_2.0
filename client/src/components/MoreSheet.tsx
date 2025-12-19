import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, MessageCircle, Settings, Store, LogOut } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

interface MoreSheetProps {
  trigger?: React.ReactNode;
}

export default function MoreSheet({ trigger }: MoreSheetProps) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { user } = useSupabaseAuth();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-count-total"],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data, error } = await supabase.rpc("get_total_unread_count" as never, {
        p_user_id: user.id,
      } as never);
      if (error) {
        console.error("Failed to get unread count:", error);
        return 0;
      }
      return (data as number) || 0;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const handleNavigate = (path: string) => {
    setOpen(false);
    setLocation(path);
  };

  const handleLogout = async () => {
    setOpen(false);
    await supabase.auth.signOut();
    setLocation("/login");
  };

  const menuItems = [
    {
      id: "messaging",
      label: "Messages",
      icon: MessageCircle,
      path: "/messages",
      badge: unreadCount > 0 ? unreadCount : undefined,
      visible: true,
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      path: "/settings",
      visible: true,
    },
    {
      id: "marketplace",
      label: "Marketplace",
      icon: Store,
      path: "/marketplace",
      badge: "Coming Soon",
      visible: false,
    },
  ];

  const visibleItems = menuItems.filter((item) => item.visible);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative"
            data-testid="button-more-menu"
            aria-label="More options"
          >
            <MoreVertical className="w-5 h-5" />
            {unreadCount > 0 && (
              <span 
                className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center"
                data-testid="badge-more-unread"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className="w-[280px] sm:w-[320px]"
        aria-describedby="more-sheet-description"
      >
        <SheetHeader>
          <SheetTitle>More Options</SheetTitle>
          <p id="more-sheet-description" className="sr-only">
            Access additional features like messages and settings
          </p>
        </SheetHeader>
        <nav className="mt-6 space-y-2" role="navigation" aria-label="More options">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.path)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover-elevate active-elevate-2 text-left"
                data-testid={`menu-item-${item.id}`}
              >
                <Icon className="w-5 h-5 text-muted-foreground" />
                <span className="flex-1 font-medium">{item.label}</span>
                {typeof item.badge === "number" && item.badge > 0 && (
                  <Badge variant="default" className="min-w-[20px] h-5 text-xs">
                    {item.badge > 99 ? "99+" : item.badge}
                  </Badge>
                )}
                {typeof item.badge === "string" && (
                  <Badge variant="secondary" className="text-xs">
                    {item.badge}
                  </Badge>
                )}
              </button>
            );
          })}
          
          <div className="border-t my-4" />
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover-elevate active-elevate-2 text-left text-destructive"
            data-testid="menu-item-logout"
          >
            <LogOut className="w-5 h-5" />
            <span className="flex-1 font-medium">Log Out</span>
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
