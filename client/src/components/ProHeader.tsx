import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
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
import { Briefcase, LogOut, MessageCircle, Settings, Store, User } from "lucide-react";

export default function ProHeader() {
  const { user, profile, signOut } = useSupabaseAuth();
  const [, setLocation] = useLocation();

  const handleSignOut = async () => {
    await signOut();
    setLocation("/pro");
  };

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link href="/pro" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <Briefcase className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold" data-testid="text-logo">LOBA Pro</span>
          </Link>
          <Badge variant="secondary" className="text-xs" data-testid="badge-portal-context">
            Pro Portal
          </Badge>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-user-menu">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              {profile?.display_name || user?.email || "Professional"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/pro/profile" className="cursor-pointer w-full">
                <Settings className="mr-2 h-4 w-4" />
                Edit Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/pro/messages" className="cursor-pointer w-full" data-testid="link-messages">
                <MessageCircle className="mr-2 h-4 w-4" />
                Messages
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/pro/storefront" className="cursor-pointer w-full" data-testid="link-storefront">
                <Store className="mr-2 h-4 w-4" />
                My Storefront
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
