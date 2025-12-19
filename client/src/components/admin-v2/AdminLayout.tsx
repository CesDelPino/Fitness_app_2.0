import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { AdminSidebar } from "./AdminSidebar";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";
import { Redirect, useLocation } from "wouter";
import type { AdminUser } from "./types";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [, setLocation] = useLocation();
  
  const { data: admin, isLoading } = useQuery<AdminUser | null>({
    queryKey: ["/api/admin/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/admin/me"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
      setLocation("/admin/login");
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!admin) {
    return <Redirect to="/admin/login" />;
  }

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b flex items-center justify-between px-4 bg-card">
          <div className="text-sm text-muted-foreground">
            Logged in as <span className="font-medium text-foreground">{admin.username}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            data-testid="button-admin-logout"
          >
            {logoutMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4 mr-2" />
            )}
            Logout
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
