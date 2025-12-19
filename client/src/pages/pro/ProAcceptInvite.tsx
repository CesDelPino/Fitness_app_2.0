import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { supabase } from "@/lib/supabase";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InvitationPermissionSelector } from "@/components/InvitationPermissionSelector";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Loader2, CheckCircle, XCircle, UserPlus, Shield, AlertTriangle } from "lucide-react";
import type { PermissionSlug, InvitationDetailsResponse } from "@shared/supabase-types";
import type { PermissionDefinition } from "@/lib/permissions";

export default function ProAcceptInvite() {
  const { user, signUp, signIn } = useSupabaseAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [step, setStep] = useState<"auth" | "permissions" | "accepting" | "accepted">("auth");
  const [approvedPermissions, setApprovedPermissions] = useState<PermissionSlug[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t);
  }, []);

  const { data: invitationDetails, isLoading: isLoadingDetails, error: detailsError } = useQuery<InvitationDetailsResponse>({
    queryKey: ['/api/invitations', token],
    queryFn: async () => {
      const res = await fetch(`/api/invitations/${token}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch invitation');
      }
      return res.json();
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: async (data: { approved: PermissionSlug[]; rejected: PermissionSlug[] }) => {
      const res = await apiRequest('POST', `/api/invitations/${token}/accept`, data);
      return res.json();
    },
    onSuccess: () => {
      setStep("accepted");
      queryClient.invalidateQueries({ queryKey: ['/api/client/permissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/client/assignments'] });
      toast({
        title: "Connected!",
        description: "You are now connected with your professional.",
      });
    },
    onError: (err: any) => {
      setError(err.message || "Failed to accept invitation");
      setStep("permissions");
    },
  });

  useEffect(() => {
    if (user && token && invitationDetails?.success && step === "auth") {
      if (invitationDetails.permissions?.length) {
        const allSlugs = invitationDetails.permissions.map(p => p.slug);
        setApprovedPermissions(allSlugs);
        setStep("permissions");
      } else {
        handleAccept([]);
      }
    }
  }, [user, token, invitationDetails, step]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        await signUp(email, password, fullName);
        toast({
          title: "Account Created",
          description: "Please check your email to verify your account, then sign in.",
        });
        setMode("signin");
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (approved: PermissionSlug[]) => {
    if (!token || !user) return;
    
    setStep("accepting");
    setError(null);
    
    const allRequested = invitationDetails?.permissions?.map(p => p.slug) || [];
    const rejected = allRequested.filter(slug => !approved.includes(slug));
    
    acceptMutation.mutate({ approved, rejected });
  };

  const handleAcceptWithSelections = () => {
    handleAccept(approvedPermissions);
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <p className="text-lg font-medium">Invalid Invitation</p>
            <p className="text-muted-foreground mt-2">
              This invitation link is invalid or has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingDetails) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-lg font-medium">Loading Invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (detailsError || (invitationDetails && !invitationDetails.success)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <p className="text-lg font-medium">Invitation Not Found</p>
            <p className="text-muted-foreground mt-2">
              This invitation link is invalid or has already been used.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "accepted") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium">You're Connected!</p>
            <p className="text-muted-foreground mt-2 mb-4">
              Your professional can now access the data you've approved.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              You can manage permissions anytime from your Settings.
            </p>
            <Button onClick={() => setLocation("/")} data-testid="button-go-to-app">
              Go to LOBA Tracker
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "accepting") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-lg font-medium">Accepting Invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "permissions" && user && invitationDetails) {
    const professionalName = invitationDetails.professional?.name || "Your professional";
    const permissions = invitationDetails.permissions || [];
    
    const definitions: PermissionDefinition[] = permissions.map(p => ({
      id: p.slug,
      slug: p.slug,
      display_name: p.display_name,
      description: p.description,
      category: p.category as any,
      permission_type: p.permission_type as 'read' | 'write',
      is_exclusive: p.is_exclusive,
      is_enabled: true,
      sort_order: 0,
    }));

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
                <Shield className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <CardTitle>Review Permission Request</CardTitle>
            <CardDescription>
              {professionalName} has requested access to your health data. Review and approve the permissions below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {permissions.length > 0 ? (
              <InvitationPermissionSelector
                definitions={definitions}
                selectedPermissions={approvedPermissions}
                onPermissionsChange={setApprovedPermissions}
                mode="review"
              />
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No specific permissions requested. Default role permissions will be granted.
              </p>
            )}

            {error && (
              <div className="text-sm text-destructive flex items-center gap-2" data-testid="text-error">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="space-y-3">
              <Button
                onClick={handleAcceptWithSelections}
                className="w-full"
                disabled={acceptMutation.isPending}
                data-testid="button-accept-invitation"
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : approvedPermissions.length > 0 ? (
                  `Accept Connection (${approvedPermissions.length} permissions)`
                ) : (
                  "Accept Connection (No Permissions)"
                )}
              </Button>
              
              {approvedPermissions.length === 0 && permissions.length > 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  You can grant permissions later from Settings
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
              <UserPlus className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle>You've Been Invited!</CardTitle>
          <CardDescription>
            {invitationDetails?.professional?.name 
              ? `${invitationDetails.professional.name} wants to connect with you`
              : mode === "signup"
              ? "Create an account to connect with your fitness professional"
              : "Sign in to accept your invitation"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isLoading}
                  required
                  data-testid="input-fullname"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="The email your professional invited"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                data-testid="input-email"
              />
              <p className="text-xs text-muted-foreground">
                Use the same email your professional used when inviting you
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder={mode === "signup" ? "Create a password" : "Enter your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                minLength={6}
                data-testid="input-password"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive" data-testid="text-error">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-submit"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {mode === "signup" ? "Creating Account..." : "Signing In..."}
                </>
              ) : mode === "signup" ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {mode === "signup" ? (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setMode("signin")}
                  data-testid="link-signin"
                >
                  Sign in
                </button>
              </p>
            ) : (
              <p>
                Don't have an account?{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setMode("signup")}
                  data-testid="link-signup"
                >
                  Create one
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
