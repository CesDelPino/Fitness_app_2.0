import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield } from "lucide-react";
import { Link, Redirect, useLocation } from "wouter";
import adminHeroImage from "@assets/Admin_landing_1764602198317.png";

type AdminUser = { id: string; username: string };

export default function AdminLoginPage() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const { data: currentAdmin, isLoading } = useQuery<AdminUser | null>({
    queryKey: ["/api/admin/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/login", { username, password });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
      toast({ title: "Logged in successfully" });
      setLocation("/admin/business/stats");
    },
    onError: () => {
      toast({ title: "Invalid credentials", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (currentAdmin) {
    return <Redirect to="/admin/business/stats" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${adminHeroImage})` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" aria-hidden="true" />
      <Card className="w-full max-w-sm relative z-10 backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center">
          <Shield className="w-12 h-12 mx-auto text-primary mb-2" />
          <CardTitle>Admin Login</CardTitle>
          <CardDescription>LOBA Tracker Administration</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loginMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="admin-username">Username</Label>
              <Input
                id="admin-username"
                data-testid="input-admin-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Admin username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                data-testid="input-admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
              data-testid="button-admin-login"
            >
              {loginMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Login
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/" className="hover:underline" data-testid="link-client-login">
              Go to client login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
