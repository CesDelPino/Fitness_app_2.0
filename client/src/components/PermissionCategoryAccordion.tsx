import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { PermissionToggle } from "./PermissionToggle";
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
import type { 
  PermissionDefinition, 
  RelationshipPermissions,
} from "@/lib/permissions";
import { 
  groupPermissionsByCategory, 
  getCategoryLabel,
  countGrantedByCategory,
  findExclusiveHolder,
} from "@/lib/permissions";
import type { PermissionSlug, PermissionCategory } from "@shared/supabase-types";

const CATEGORY_ICONS: Record<PermissionCategory, typeof Apple> = {
  nutrition: Apple,
  workouts: Dumbbell,
  weight: Scale,
  photos: Camera,
  checkins: ClipboardCheck,
  fasting: Clock,
  profile: User,
};

interface PermissionCategoryAccordionProps {
  definitions: PermissionDefinition[];
  grantedPermissions: PermissionSlug[];
  professionalName: string;
  relationshipId: string;
  allRelationships: RelationshipPermissions[];
  pendingPermissions: Set<PermissionSlug>;
  onGrant: (slug: PermissionSlug) => void;
  onRevoke: (slug: PermissionSlug) => void;
  onTransfer: (slug: PermissionSlug) => void;
}

export function PermissionCategoryAccordion({
  definitions,
  grantedPermissions,
  professionalName,
  relationshipId,
  allRelationships,
  pendingPermissions,
  onGrant,
  onRevoke,
  onTransfer,
}: PermissionCategoryAccordionProps) {
  const grouped = groupPermissionsByCategory(definitions);
  const categories = Array.from(grouped.keys());
  
  return (
    <Accordion type="multiple" className="w-full" data-testid="permission-accordion">
      {categories.map((category) => {
        const permissions = grouped.get(category) || [];
        const Icon = CATEGORY_ICONS[category] || Settings;
        const { granted, total } = countGrantedByCategory(category, definitions, grantedPermissions);
        
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
                <span className="font-medium" data-testid={`text-category-${category}`}>{getCategoryLabel(category)}</span>
                <Badge 
                  variant={granted === total ? "default" : "secondary"} 
                  className="ml-auto mr-2"
                  data-testid={`badge-category-count-${category}`}
                >
                  {granted}/{total}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="divide-y">
                {permissions.map((permission) => {
                  const isGranted = grantedPermissions.includes(permission.slug);
                  const isPending = pendingPermissions.has(permission.slug);
                  const currentHolder = permission.is_exclusive 
                    ? findExclusiveHolder(permission.slug, allRelationships, relationshipId)
                    : null;
                  
                  return (
                    <PermissionToggle
                      key={permission.slug}
                      permission={permission}
                      isGranted={isGranted}
                      professionalName={professionalName}
                      isPending={isPending}
                      currentHolder={currentHolder}
                      onGrant={onGrant}
                      onRevoke={onRevoke}
                      onTransfer={onTransfer}
                    />
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
