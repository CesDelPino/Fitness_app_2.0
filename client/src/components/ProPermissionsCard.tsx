import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { 
  useProClientPermissions, 
  useCreatePermissionRequests,
  groupPermissionsByCategory,
  getCategoryLabel,
  PERMISSION_CATEGORIES,
  type PermissionDefinition,
} from "@/lib/permissions";
import { 
  Shield, 
  ChevronDown, 
  ChevronUp, 
  Lock, 
  AlertCircle, 
  RefreshCw, 
  Check, 
  Clock, 
  Plus,
  Send,
  Loader2,
  Apple,
  Dumbbell,
  Scale,
  Camera,
  ClipboardCheck,
  User,
  Settings,
} from "lucide-react";
import type { PermissionSlug, PermissionCategory } from "@shared/supabase-types";

const CATEGORY_ICONS: Record<PermissionCategory, React.ElementType> = {
  nutrition: Apple,
  workouts: Dumbbell,
  weight: Scale,
  photos: Camera,
  checkins: ClipboardCheck,
  fasting: Clock,
  profile: User,
};

interface ProPermissionsCardProps {
  clientId: string;
  clientName?: string;
}

export function ProPermissionsCard({ clientId, clientName }: ProPermissionsCardProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRequestPanel, setShowRequestPanel] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<PermissionSlug>>(new Set());
  const [message, setMessage] = useState("");
  
  const { data, isLoading, isError, refetch } = useProClientPermissions(clientId);
  const createRequestsMutation = useCreatePermissionRequests(clientId);
  
  const definitions = data?.permission_definitions || [];
  const grantedPermissions = data?.granted_permissions || [];
  const pendingPermissions = data?.pending_permissions || [];
  const relationshipId = data?.relationship_id;
  
  const groupedPermissions = useMemo(() => {
    return groupPermissionsByCategory(definitions);
  }, [definitions]);
  
  const availableToRequest = useMemo(() => {
    return definitions.filter(
      d => !grantedPermissions.includes(d.slug) && !pendingPermissions.includes(d.slug)
    );
  }, [definitions, grantedPermissions, pendingPermissions]);
  
  const totalPermissions = definitions.length;
  const grantedCount = grantedPermissions.length;
  const pendingCount = pendingPermissions.length;
  const exclusiveGrantedCount = definitions.filter(
    d => d.is_exclusive && grantedPermissions.includes(d.slug)
  ).length;
  
  const handleTogglePermission = (slug: PermissionSlug) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };
  
  const handleSubmitRequests = async () => {
    if (!relationshipId || selectedPermissions.size === 0) return;
    
    try {
      const result = await createRequestsMutation.mutateAsync({
        relationship_id: relationshipId,
        permission_slugs: Array.from(selectedPermissions),
        message: message.trim() || undefined,
      });
      
      if (result.created_count > 0) {
        toast({
          title: "Request sent",
          description: `Requested ${result.created_count} permission${result.created_count > 1 ? 's' : ''} from ${clientName || 'client'}.`,
        });
        setSelectedPermissions(new Set());
        setMessage("");
        setShowRequestPanel(false);
      }
      
      if (result.failed_count > 0) {
        const failedSlugs = result.results.filter(r => !r.success).map(r => r.slug);
        toast({
          title: "Some requests failed",
          description: `Failed to request: ${failedSlugs.join(', ')}`,
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      toast({
        title: "Failed to send request",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };
  
  if (isLoading) {
    return (
      <Card data-testid="loading-pro-permissions">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (isError) {
    return (
      <Card data-testid="error-pro-permissions">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">Failed to load permissions</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-pro-permissions">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!data) {
    return null;
  }
  
  return (
    <Card data-testid="pro-permissions-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permissions
          </CardTitle>
          <Badge variant="secondary" data-testid="badge-pro-permission-count">
            {grantedCount}/{totalPermissions}
          </Badge>
        </div>
        <CardDescription>
          Your access to {clientName || "this client"}'s data
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <button 
          type="button"
          className="flex items-center justify-between w-full p-4 min-h-14 bg-muted/50 rounded-lg cursor-pointer hover-elevate text-left"
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid="pro-permission-summary-card"
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="flex items-center gap-1" data-testid="text-pro-granted-count">
              <Check className="h-4 w-4 text-green-600" />
              {grantedCount} granted
            </span>
            {pendingCount > 0 && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400" data-testid="text-pro-pending-count">
                  <Clock className="h-4 w-4" />
                  {pendingCount} pending
                </span>
              </>
            )}
            {exclusiveGrantedCount > 0 && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="flex items-center gap-1" data-testid="text-pro-exclusive-count">
                  <Lock className="h-4 w-4" />
                  {exclusiveGrantedCount} exclusive
                </span>
              </>
            )}
          </div>
          <span className="p-2 shrink-0" data-testid="icon-toggle-pro-permissions">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </span>
        </button>
        
        {isExpanded && (
          <div className="space-y-4">
            <Accordion type="multiple" className="w-full" data-testid="pro-permission-accordion">
              {Array.from(groupedPermissions.entries()).map(([category, permissions]) => {
                const Icon = CATEGORY_ICONS[category] || Settings;
                const granted = permissions.filter(p => grantedPermissions.includes(p.slug)).length;
                const pending = permissions.filter(p => pendingPermissions.includes(p.slug)).length;
                
                return (
                  <AccordionItem 
                    key={category} 
                    value={category}
                    data-testid={`pro-accordion-${category}`}
                  >
                    <AccordionTrigger 
                      className="hover:no-underline min-h-14 py-4"
                      data-testid={`pro-accordion-trigger-${category}`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{getCategoryLabel(category)}</span>
                        <div className="flex items-center gap-1 ml-auto mr-2">
                          <Badge 
                            variant={granted === permissions.length ? "default" : "secondary"}
                            data-testid={`badge-pro-category-count-${category}`}
                          >
                            {granted}/{permissions.length}
                          </Badge>
                          {pending > 0 && (
                            <Badge 
                              variant="outline" 
                              className="text-amber-600 border-amber-600"
                              data-testid={`badge-pro-category-pending-${category}`}
                            >
                              {pending} pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="divide-y">
                        {permissions.map((permission) => {
                          const isGranted = grantedPermissions.includes(permission.slug);
                          const isPending = pendingPermissions.includes(permission.slug);
                          
                          return (
                            <div 
                              key={permission.slug}
                              className="flex items-center justify-between py-3 px-1"
                              data-testid={`pro-permission-item-${permission.slug}`}
                            >
                              <div className="flex-1 min-w-0 pr-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">
                                    {permission.display_name}
                                  </span>
                                  {permission.is_exclusive && (
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      <Lock className="h-3 w-3 mr-1" />
                                      Exclusive
                                    </Badge>
                                  )}
                                </div>
                                {permission.description && (
                                  <p className="text-sm text-muted-foreground mt-0.5">
                                    {permission.description}
                                  </p>
                                )}
                              </div>
                              
                              <div className="shrink-0">
                                {isGranted ? (
                                  <Badge 
                                    className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                    data-testid={`badge-status-granted-${permission.slug}`}
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Granted
                                  </Badge>
                                ) : isPending ? (
                                  <Badge 
                                    variant="outline" 
                                    className="text-amber-600 border-amber-600"
                                    data-testid={`badge-status-pending-${permission.slug}`}
                                  >
                                    <Clock className="h-3 w-3 mr-1" />
                                    Pending
                                  </Badge>
                                ) : (
                                  <Badge 
                                    variant="secondary" 
                                    className="text-muted-foreground"
                                    data-testid={`badge-status-not-granted-${permission.slug}`}
                                  >
                                    Not granted
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
            
            {availableToRequest.length > 0 && (
              <div className="pt-2">
                {!showRequestPanel ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowRequestPanel(true)}
                    data-testid="button-request-permissions"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Request Additional Permissions
                  </Button>
                ) : (
                  <div className="border rounded-lg p-4 space-y-4" data-testid="request-permissions-panel">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Request Permissions</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowRequestPanel(false);
                          setSelectedPermissions(new Set());
                          setMessage("");
                        }}
                        data-testid="button-cancel-request"
                      >
                        Cancel
                      </Button>
                    </div>
                    
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {availableToRequest.map((permission) => (
                        <div 
                          key={permission.slug}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50"
                        >
                          <Checkbox
                            id={`request-${permission.slug}`}
                            checked={selectedPermissions.has(permission.slug)}
                            onCheckedChange={() => handleTogglePermission(permission.slug)}
                            className="mt-0.5"
                            data-testid={`checkbox-request-${permission.slug}`}
                          />
                          <div className="flex-1 min-w-0">
                            <Label 
                              htmlFor={`request-${permission.slug}`}
                              className="font-medium text-sm cursor-pointer flex items-center gap-2"
                            >
                              {permission.display_name}
                              {permission.is_exclusive && (
                                <Lock className="h-3 w-3 text-muted-foreground" />
                              )}
                            </Label>
                            {permission.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {permission.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="request-message" className="text-sm">
                        Message (optional)
                      </Label>
                      <Textarea
                        id="request-message"
                        placeholder="Why do you need these permissions?"
                        value={message}
                        onChange={(e) => setMessage(e.target.value.slice(0, 200))}
                        maxLength={200}
                        className="resize-none h-20"
                        data-testid="textarea-request-message"
                      />
                      <p 
                        className="text-xs text-muted-foreground text-right"
                        data-testid="text-message-char-count"
                      >
                        {message.length}/200
                      </p>
                    </div>
                    
                    <Button
                      className="w-full"
                      onClick={handleSubmitRequests}
                      disabled={selectedPermissions.size === 0 || createRequestsMutation.isPending}
                      data-testid="button-submit-request"
                    >
                      {createRequestsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Send Request ({selectedPermissions.size})
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
