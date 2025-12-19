import { useState, useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Lock } from "lucide-react";
import { 
  Apple, 
  Dumbbell, 
  Scale, 
  Camera, 
  ClipboardCheck, 
  Clock, 
  User,
  Settings
} from "lucide-react";
import type { PermissionDefinition } from "@/lib/permissions";
import { groupPermissionsByCategory, getCategoryLabel } from "@/lib/permissions";
import type { PermissionSlug, PermissionCategory, ProfessionalRoleType } from "@shared/supabase-types";

const CATEGORY_ICONS: Record<PermissionCategory, typeof Apple> = {
  nutrition: Apple,
  workouts: Dumbbell,
  weight: Scale,
  photos: Camera,
  checkins: ClipboardCheck,
  fasting: Clock,
  profile: User,
};

const ROLE_PERMISSION_MAP: Record<ProfessionalRoleType, PermissionSlug[]> = {
  nutritionist: ['view_nutrition', 'view_weight', 'view_profile', 'set_nutrition_targets'],
  trainer: ['view_workouts', 'view_weight', 'view_profile', 'assign_programmes', 'assign_checkins'],
  coach: [
    'view_nutrition', 'view_workouts', 'view_weight', 'view_progress_photos', 
    'view_fasting', 'view_checkins', 'view_profile', 'set_nutrition_targets', 
    'set_weight_targets', 'assign_programmes', 'assign_checkins', 'set_fasting_schedule'
  ],
};

interface InvitationPermissionSelectorProps {
  definitions: PermissionDefinition[];
  selectedPermissions: PermissionSlug[];
  onPermissionsChange: (permissions: PermissionSlug[]) => void;
  roleType?: ProfessionalRoleType;
  mode?: 'request' | 'review';
}

export function InvitationPermissionSelector({
  definitions,
  selectedPermissions,
  onPermissionsChange,
  roleType,
  mode = 'request',
}: InvitationPermissionSelectorProps) {
  const grouped = groupPermissionsByCategory(definitions);
  const categories = Array.from(grouped.keys());
  
  useEffect(() => {
    if (roleType && mode === 'request' && selectedPermissions.length === 0) {
      const defaults = ROLE_PERMISSION_MAP[roleType] || [];
      onPermissionsChange(defaults);
    }
  }, [roleType, mode]);

  const togglePermission = (slug: PermissionSlug) => {
    if (selectedPermissions.includes(slug)) {
      onPermissionsChange(selectedPermissions.filter(p => p !== slug));
    } else {
      onPermissionsChange([...selectedPermissions, slug]);
    }
  };

  const countSelectedByCategory = (category: PermissionCategory): { selected: number; total: number } => {
    const categoryPerms = definitions.filter(d => d.category === category);
    const selected = categoryPerms.filter(d => selectedPermissions.includes(d.slug)).length;
    return { selected, total: categoryPerms.length };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{mode === 'request' ? 'Select permissions to request' : 'Requested permissions'}</span>
        <Badge variant="outline" data-testid="badge-total-selected">
          {selectedPermissions.length} selected
        </Badge>
      </div>
      
      <Accordion 
        type="multiple" 
        defaultValue={categories}
        className="w-full"
        data-testid="invitation-permission-accordion"
      >
        {categories.map((category) => {
          const permissions = grouped.get(category) || [];
          const Icon = CATEGORY_ICONS[category] || Settings;
          const { selected, total } = countSelectedByCategory(category);
          
          return (
            <AccordionItem 
              key={category} 
              value={category}
              data-testid={`accordion-${category}`}
            >
              <AccordionTrigger 
                className="hover:no-underline min-h-14 py-4"
                data-testid={`accordion-trigger-${category}`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{getCategoryLabel(category)}</span>
                  <Badge 
                    variant={selected > 0 ? "default" : "secondary"} 
                    className="ml-auto mr-2"
                    data-testid={`badge-category-count-${category}`}
                  >
                    {selected}/{total}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="divide-y">
                  {permissions.map((permission) => {
                    const isSelected = selectedPermissions.includes(permission.slug);
                    
                    return (
                      <div 
                        key={permission.slug}
                        className="flex items-center justify-between py-4 px-1 min-h-[60px]"
                        data-testid={`permission-row-${permission.slug}`}
                      >
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-2">
                            <Label 
                              htmlFor={`perm-${permission.slug}`}
                              className="font-medium cursor-pointer"
                            >
                              {permission.display_name}
                            </Label>
                            {permission.is_exclusive && (
                              <Badge 
                                variant="outline" 
                                className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20"
                                data-testid={`badge-exclusive-${permission.slug}`}
                              >
                                <Lock className="h-3 w-3 mr-1" />
                                Exclusive
                              </Badge>
                            )}
                            {permission.permission_type === 'write' && (
                              <Badge 
                                variant="outline"
                                className="text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/20"
                              >
                                Write
                              </Badge>
                            )}
                          </div>
                          {permission.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {permission.description}
                            </p>
                          )}
                          {permission.is_exclusive && isSelected && mode === 'request' && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              If client has another provider for this, they'll need to transfer it to you
                            </p>
                          )}
                        </div>
                        <Switch
                          id={`perm-${permission.slug}`}
                          checked={isSelected}
                          onCheckedChange={() => togglePermission(permission.slug)}
                          className="shrink-0"
                          data-testid={`switch-${permission.slug}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      
      {selectedPermissions.length === 0 && mode === 'request' && (
        <p className="text-sm text-destructive flex items-center gap-2" data-testid="text-no-permissions-warning">
          <AlertTriangle className="h-4 w-4" />
          Select at least one permission to request
        </p>
      )}
    </div>
  );
}
