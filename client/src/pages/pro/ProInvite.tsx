import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InvitationPermissionSelector } from "@/components/InvitationPermissionSelector";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ArrowLeft, Copy, Check, UserPlus, Apple, Dumbbell, Scale, ChevronDown, Settings2 } from "lucide-react";
import type { ProfessionalRoleType, PermissionSlug } from "@shared/supabase-types";
import type { PermissionDefinition } from "@/lib/permissions";

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
}

export default function ProInvite() {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [roleType, setRoleType] = useState<ProfessionalRoleType>("trainer");
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionSlug[]>([]);
  const [showCustomPermissions, setShowCustomPermissions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: definitionsData } = useQuery<{ definitions: PermissionDefinition[] }>({
    queryKey: ['/api/permissions/definitions'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/permissions/definitions');
      const data = await res.json();
      return { definitions: data };
    },
    staleTime: 5 * 60 * 1000,
  });

  const definitions = definitionsData?.definitions || [];

  useEffect(() => {
    setSelectedPermissions([]);
    setShowCustomPermissions(false);
  }, [roleType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (showCustomPermissions && selectedPermissions.length === 0) {
      toast({
        title: "No Permissions Selected",
        description: "Please select at least one permission to request.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setInviteLink(null);

    try {
      const token = generateToken();
      
      const { data, error } = await supabase.rpc("create_invitation_with_permissions" as any, {
        p_email: email,
        p_role_type: roleType,
        p_token: token,
        p_permissions: showCustomPermissions ? selectedPermissions : null,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; invitation_id?: string; error?: string; permissions_requested?: string[] };
      
      if (!result.success) {
        throw new Error(result.error || "Failed to create invitation");
      }

      const link = `${window.location.origin}/pro/accept?token=${token}`;
      setInviteLink(link);
      
      toast({
        title: "Invitation Created",
        description: `Share the link with your client. ${result.permissions_requested?.length || 0} permissions requested.`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to create invitation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!inviteLink) return;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Invitation link copied to clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Please select and copy the link manually.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEmail("");
    setInviteLink(null);
    setCopied(false);
    setSelectedPermissions([]);
    setShowCustomPermissions(false);
  };

  return (
    <div className="container mx-auto p-4 max-w-lg">
      <Link href="/pro" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Invite a Client
          </CardTitle>
          <CardDescription>
            Create an invitation link to send to your client. They'll use this link to sign up and connect with you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!inviteLink ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Client Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="client@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                  data-testid="input-client-email"
                />
                <p className="text-sm text-muted-foreground">
                  Your client must use this exact email when signing up.
                </p>
              </div>

              <div className="space-y-3">
                <Label>Your Role with This Client</Label>
                <RadioGroup
                  value={roleType}
                  onValueChange={(v) => setRoleType(v as ProfessionalRoleType)}
                  className="grid gap-3"
                  data-testid="radio-role-type"
                >
                  <Label
                    htmlFor="nutritionist"
                    className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover-elevate [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5"
                  >
                    <RadioGroupItem value="nutritionist" id="nutritionist" />
                    <Apple className="w-5 h-5 text-green-600" />
                    <div className="flex-1">
                      <p className="font-medium">Nutritionist</p>
                      <p className="text-sm text-muted-foreground">
                        Access to food logs and weight data
                      </p>
                    </div>
                  </Label>
                  
                  <Label
                    htmlFor="trainer"
                    className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover-elevate [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5"
                  >
                    <RadioGroupItem value="trainer" id="trainer" />
                    <Dumbbell className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium">Trainer</p>
                      <p className="text-sm text-muted-foreground">
                        Access to workouts and weight data
                      </p>
                    </div>
                  </Label>
                  
                  <Label
                    htmlFor="coach"
                    className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover-elevate [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5"
                  >
                    <RadioGroupItem value="coach" id="coach" />
                    <Scale className="w-5 h-5 text-purple-600" />
                    <div className="flex-1">
                      <p className="font-medium">Coach</p>
                      <p className="text-sm text-muted-foreground">
                        Full access: food, workouts, and weight
                      </p>
                    </div>
                  </Label>
                </RadioGroup>
              </div>

              <Collapsible 
                open={showCustomPermissions} 
                onOpenChange={setShowCustomPermissions}
                className="border rounded-lg"
              >
                <CollapsibleTrigger 
                  className="flex items-center justify-between w-full p-4 min-h-14"
                  data-testid="button-customize-permissions"
                >
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Customize Permissions</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showCustomPermissions ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Select specific permissions to request from your client. By default, role-based permissions will be used.
                  </p>
                  {definitions.length > 0 && (
                    <InvitationPermissionSelector
                      definitions={definitions}
                      selectedPermissions={selectedPermissions}
                      onPermissionsChange={setSelectedPermissions}
                      roleType={roleType}
                      mode="request"
                    />
                  )}
                </CollapsibleContent>
              </Collapsible>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || (showCustomPermissions && selectedPermissions.length === 0)}
                data-testid="button-create-invitation"
              >
                {isLoading ? "Creating..." : "Create Invitation Link"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                  Invitation created successfully!
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Share this link with {email}. The link expires in 7 days.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Invitation Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={inviteLink}
                    readOnly
                    className="font-mono text-xs"
                    data-testid="input-invite-link"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyToClipboard}
                    data-testid="button-copy-link"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={resetForm}
                  data-testid="button-invite-another"
                >
                  Invite Another
                </Button>
                <Link href="/pro" className="flex-1">
                  <Button className="w-full" data-testid="button-back-dashboard">
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
