import { useState, useEffect } from "react";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { usePortalContext } from "@/context/PortalContext";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";
import { Heart, LogOut, MessageCircle, Settings, User, ArrowLeftRight, CreditCard, Store, Moon, Sun, Loader2 } from "lucide-react";

export default function ClientHeader() {
  const { user, profile, signOut, isSigningOut } = useSupabaseAuth();
  const { availableRoles, setPortalMode } = usePortalContext();
  const { isPremium } = useFeatureAccess();
  const [, setLocation] = useLocation();
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    const initial = stored || "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

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

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  const canSwitchToPro = availableRoles && 
    availableRoles.availableRoles.includes("pro") && 
    availableRoles.proProfileId &&
    availableRoles.proProfileStatus === "active";
  
  const handleSwitchToPro = async () => {
    if (!availableRoles?.proProfileId) return;
    try {
      await setPortalMode("pro", availableRoles.proProfileId);
      setLocation("/pro");
    } catch (error) {
      console.error("Failed to switch to pro portal:", error);
    }
  };

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold" data-testid="text-logo">LOBA</span>
          </Link>
          <Badge variant="outline" className="text-xs" data-testid="badge-portal-context">
            {isPremium ? "Premium Member" : "Standard Member"}
          </Badge>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" data-testid="button-user-menu">
              <User className="h-5 w-5" />
              {unreadCount > 0 && (
                <span 
                  className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center"
                  data-testid="badge-unread-count"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={toggleTheme}
              className="cursor-pointer"
              data-testid="button-theme-toggle"
            >
              {theme === "light" ? (
                <Moon className="mr-2 h-4 w-4" />
              ) : (
                <Sun className="mr-2 h-4 w-4" />
              )}
              {theme === "light" ? "Dark Mode" : "Light Mode"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>
              {profile?.display_name || user?.email || "User"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer w-full">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/messages" className="cursor-pointer w-full flex items-center justify-between" data-testid="link-messages">
                <span className="flex items-center">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Messages
                </span>
                {unreadCount > 0 && (
                  <Badge variant="default" className="ml-2 min-w-[20px] h-5 text-xs">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/subscription" className="cursor-pointer w-full" data-testid="link-subscription">
                <CreditCard className="mr-2 h-4 w-4" />
                Subscription
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/marketplace" className="cursor-pointer w-full" data-testid="link-marketplace">
                <Store className="mr-2 h-4 w-4" />
                Marketplace
              </Link>
            </DropdownMenuItem>
            {canSwitchToPro && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleSwitchToPro}
                  className="cursor-pointer"
                  data-testid="button-switch-portal"
                >
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Switch to Pro
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleSignOut} 
              className="cursor-pointer"
              disabled={isSigningOut}
              data-testid="button-sign-out"
            >
              {isSigningOut ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              {isSigningOut ? "Signing out..." : "Sign Out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
