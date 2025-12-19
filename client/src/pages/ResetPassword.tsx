import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import logoUrl from "@assets/loba-logo.png";

type ResetState = "loading" | "ready" | "success" | "error" | "expired";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<ResetState>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleRecoveryToken = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = new URLSearchParams(window.location.search);
      
      const accessToken = hashParams.get("access_token");
      const type = hashParams.get("type") || queryParams.get("type");
      const code = queryParams.get("code");

      if (type === "recovery" && accessToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hashParams.get("refresh_token") || "",
        });
        
        if (error) {
          console.error("Session error:", error);
          setState("expired");
        } else {
          setState("ready");
        }
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          console.error("Code exchange error:", error);
          setState("expired");
        } else {
          setState("ready");
        }
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setState("ready");
        } else {
          setState("expired");
        }
      }
    };

    handleRecoveryToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) throw error;
      
      setState("success");
      
      setTimeout(() => {
        setLocation("/");
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    switch (state) {
      case "loading":
        return (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Verifying your reset link...</p>
          </div>
        );

      case "expired":
        return (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold">Link Expired or Invalid</h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              This password reset link has expired or is invalid. Please request a new one.
            </p>
            <Button onClick={() => setLocation("/")} data-testid="button-back-home">
              Back to Login
            </Button>
          </div>
        );

      case "success":
        return (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold">Password Reset Successfully</h3>
            <p className="text-sm text-muted-foreground text-center">
              Your password has been updated. Redirecting you to the app...
            </p>
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        );

      case "ready":
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Create New Password</h3>
              <p className="text-sm text-muted-foreground">
                Enter your new password below. Make sure it's at least 6 characters.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
                minLength={6}
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                required
                data-testid="input-confirm-password"
              />
            </div>
            {error && (
              <div className="text-sm text-destructive" data-testid="text-reset-error">
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !password || !confirmPassword}
              data-testid="button-reset-password"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <img 
                src={logoUrl} 
                alt="LOBA Logo" 
                className="h-16 w-auto"
                data-testid="img-logo"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-center">Reset Password</CardTitle>
            <CardDescription className="text-center">
              LOBA Tracker
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
