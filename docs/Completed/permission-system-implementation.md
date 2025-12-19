# Granular Permission System Implementation Plan

## Overview
Migrate from role-based permissions (nutritionist/trainer/coach) to a granular, client-controlled permission system where:
- Clients explicitly approve specific permissions
- Some permissions are exclusive (only one professional can hold at a time)
- Admins can configure policies and force connections when needed

---

## Phase 1: Immediate Fix + Foundation ✅ COMPLETED

**Goal:** Fix the check-in assignment visibility issue while laying groundwork for granular permissions

- [x] **1.1** Create `permission_definitions` table in Supabase
  - Columns: id, slug, display_name, description, category, permission_type, is_exclusive, is_enabled, requires_verification, sort_order
  
- [x] **1.2** Create `client_permissions` table in Supabase
  - Columns: id, relationship_id, permission_slug, status, granted_at, granted_by, revoked_at, admin_notes, **client_id** (denormalized for unique index)
  
- [x] **1.3** Seed initial permission definitions
  - **Shared (Read) Permissions:**
    - view_nutrition - View food logs and intake history
    - view_workouts - View completed workout sessions
    - view_weight - View weigh-ins and measurements
    - view_progress_photos - View uploaded progress photos
    - view_fasting - View fasting history
    - view_checkins - View submitted check-ins
    - view_profile - View profile information
  - **Exclusive (Write) Permissions:**
    - set_nutrition_targets - Set calorie/macro/micro goals
    - set_weight_targets - Set goal weight
    - assign_programmes - Create and assign workout plans
    - assign_checkins - Assign check-in templates
    - set_fasting_schedule - Configure fasting windows

- [x] **1.4** Create migration script for existing relationships
  - Nutritionist → view_nutrition, view_weight, set_nutrition_targets
  - Trainer → view_workouts, view_weight, assign_programmes, assign_checkins
  - Coach → all permissions
  
- [x] **1.5** PostgreSQL RPC functions for atomic grants
  - `grant_exclusive_permission()` - Revokes previous holder atomically
  - `grant_shared_permission()` - Simple upsert for non-exclusive permissions
  
- [x] **1.6** Database-level exclusivity enforcement
  - Partial unique index on `(client_id, permission_slug)` for exclusive permissions
  - Trigger to auto-populate `client_id` from relationship
  - **NOT NULL constraint on `client_id`** - Prevents index bypass via NULLs

- [x] **1.7** Update TypeScript types in shared/supabase-types.ts

- [x] **1.8** API endpoints for permission management

---

## Phase 2: Client Permission Management ✅ COMPLETED

**Goal:** Give clients control over their permissions through an intuitive mobile-first UI

### Architect Review Notes
- ✅ Accordion-by-category layout approved for mobile
- ✅ Exclusive transfers should be single atomic action (backend handles revoke+grant)
- ✅ Defer notifications to Phase 3; use inline status banners instead
- ✅ Summary card added before accordion for quick overview
- ✅ Edge cases handled: disabled definitions, inactive relationships, network failures, zero pros

### Implementation Summary

**Files Created/Modified:**
- `client/src/components/PermissionManager.tsx` - Main orchestration component
- `client/src/components/PermissionToggle.tsx` - Individual toggle with confirmation dialogs
- `client/src/components/PermissionCategoryAccordion.tsx` - Category-grouped accordion
- `client/src/components/ExclusiveTransferDialog.tsx` - Transfer confirmation dialog
- `client/src/lib/permissions.ts` - Client-side permission utilities and hooks
- `client/src/pages/Train.tsx` - Integration point for permission management

**Key Technical Decisions:**
- Advisory locks (`pg_advisory_xact_lock`) for serialized exclusive permission grants
- Optimistic updates with automatic rollback on conflict detection
- Conflict-aware error handling with auto-refetch on race conditions
- 48px minimum touch targets on all interactive elements
- `data-testid` attributes on all interactive elements for e2e testing

### 2.1 Client Dashboard - "My Pro" Tab Enhancement ✅

- [x] **2.1.0** Permission Summary Card (Mobile-First)
  - Quick overview before detailed accordion
  - Show total granted vs available permissions
  - Highlight key exclusive permissions and their holders
  - Tappable to expand full management view

- [x] **2.1.1** Permission List Component
  - Fetch permissions via `GET /api/client/permissions`
  - Group permissions by category (nutrition, workouts, weight, etc.)
  - Show permission icon, name, description, and current status
  - Visual distinction between "granted" and "revoked" states
  - **Empty state:** If no connected pros, show friendly message instead of accordion

- [x] **2.1.2** Permission Category Accordion
  - Collapsible sections for each permission category
  - Category header shows count of granted permissions (e.g., "Nutrition (2/3)")
  - Expand to show individual permission toggles
  - **No nested accordions** - keep flat structure for mobile usability
  - Tappable headers with proper touch targets (min-h-14)

- [x] **2.1.3** Permission Toggle Switch
  - Use existing Switch component with **48px minimum touch target**
  - Disabled state for pending mutations (prevents double-submits)
  - Visual indicator for exclusive permissions (Lock badge)
  - **Pending state** with loading spinner
  - Toggles disabled during mutation

### 2.2 Permission Revocation Flow ✅

- [x] **2.2.1** Revocation Confirmation Dialog
  - Show permission name and professional name
  - Explain what the professional will lose access to
  - "Revoke" and "Cancel" buttons (min-h-12)
  - For exclusive permissions: "This will allow another professional to request this permission"

- [x] **2.2.2** API Integration
  - Call `PATCH /api/client/permissions/:relationshipId` with `{ revoke: ['permission_slug'] }`
  - Optimistic UI update with rollback on failure
  - Success toast: "Permission revoked"
  - Error handling with conflict detection and auto-refetch

- [x] **2.2.3** Professional View Update
  - Refresh-based update via React Query cache invalidation
  - Client permissions update immediately after mutation success

### 2.3 Exclusive Permission Transfer (Single Atomic Action) ✅

**Key Design:** Backend RPC uses advisory lock to serialize access. Frontend calls grant once.

- [x] **2.3.1** Pre-Grant Current Holder Check
  - Prefetch current holder info for messaging purposes
  - Use `GET /api/client/permissions` to identify who holds exclusive permissions
  - Display holder info in UI before user clicks grant

- [x] **2.3.2** Transfer Confirmation Dialog (ExclusiveTransferDialog)
  - Show both professionals: current holder and new grantee
  - Explain what will happen with avatars and visual indicators
  - Include permission description for context
  - "Transfer Permission" and "Cancel" buttons (min-h-12)
  - **Single API call:** `PATCH /api/client/permissions/:relationshipId` with `{ grant: ['permission_slug'] }`

- [x] **2.3.3** Post-Transfer UI Update
  - Use `previous_holder_id` from API response for final state
  - Update permission status for both professionals via cache invalidation
  - Toast message: "Permission transferred from [Previous Holder]"
  - Handle `unique_violation` with conflict-aware error handling

### 2.4 Permission Grant Flow (Client-Initiated) ✅

- [x] **2.4.1** Grant Confirmation Dialog
  - Show permission details and what the professional will be able to do
  - For exclusive: Check and show if this will transfer from another pro
  - "Grant Permission" and "Cancel" buttons

- [x] **2.4.2** API Integration
  - Call `PATCH /api/client/permissions/:relationshipId` with `{ grant: ['permission_slug'] }`
  - Handle exclusive permission conflicts gracefully with conflict detection

### 2.5 Edge Case Handling ✅

- [x] **2.5.1** Inactive Relationship State
  - Only active relationships returned by API
  - PermissionManager only renders for active relationships

- [x] **2.5.2** Network Failure Recovery
  - Optimistic UI updates with rollback on API failure
  - Show error toast with specific conflict messaging
  - Auto-refetch on conflict detection
  - Restore previous toggle state via pending state removal

- [x] **2.5.3** Server-Disabled Permissions
  - API only returns `is_enabled = TRUE` permission definitions
  - No additional client-side filtering needed

- [x] **2.5.4** Zero Connected Professionals
  - Empty state with message instead of accordion
  - "No connected professionals" display
  - PermissionsList handles zero relationships gracefully

### 2.6 State Management ✅

- [x] **2.6.1** PermissionManager State Machine
  - States: `idle` → `loading` → `ready` / `error`
  - Per-toggle states: `idle` → `pending` → `success` / `error`
  - Optimistic update pattern with automatic rollback on conflict

- [x] **2.6.2** Cache Invalidation
  - After permission change, invalidate `/api/client/permissions`
  - Auto-refetch on conflict detection for race condition recovery
  - Use React Query's `queryClient.invalidateQueries`

### 2.7 Concurrency Control ✅

**Critical Fix:** Advisory locks prevent race conditions during exclusive permission transfers.

- [x] **2.7.1** Advisory Lock Implementation
  - `pg_advisory_xact_lock(hashtext(client_id || permission_slug))` serializes access
  - Lock acquired before checking current holder, released at transaction end
  - Prevents window where exclusive permission is temporarily unassigned

- [x] **2.7.2** Conflict Detection & Recovery
  - Partial unique index as safety net for any advisory lock bypass
  - Frontend detects conflict errors and auto-refetches current state
  - User-friendly toast: "Another change was made. Refreshing data..."

### 2.8 Notifications (DEFERRED TO PHASE 3)

**Phase 2 Interim UX:** Toast messages for immediate feedback. Professionals refresh their views.

- [ ] **2.8.1** _(Phase 3)_ In-App Notification System
- [ ] **2.8.2** _(Phase 3)_ Permission Change Push Notifications

---

### Phase 2 File Changes ✅

| File | Changes |
|------|---------|
| `client/src/pages/Train.tsx` | Added PermissionsList component integration |
| `client/src/components/PermissionManager.tsx` | Summary card + accordion list + transfer orchestration |
| `client/src/components/PermissionCategoryAccordion.tsx` | Category accordion with permission toggles |
| `client/src/components/PermissionToggle.tsx` | Switch with pending state + grant/revoke dialogs |
| `client/src/components/ExclusiveTransferDialog.tsx` | Modal for exclusive permission transfers |
| `client/src/lib/permissions.ts` | Permission utilities, hooks, category grouping |
| `server/supabase-permissions.ts` | Backend permission API endpoints |
| `shared/supabase-types.ts` | PermissionSlug, PermissionCategory types |
| `supabase/migrations/020_permission_system.sql` | Advisory lock fix for RPC functions |

### Phase 2 API Dependencies ✅

All required endpoints implemented:
- `GET /api/client/permissions` - Fetch client's permissions with all relationship info
- `PATCH /api/client/permissions/:relationshipId` - Grant/revoke permissions (returns transfer info)

### Phase 2 Success Criteria ✅

1. ✅ Mobile-first: Summary card visible, 48px touch targets, no nested accordions
2. ✅ Client can view all their permissions grouped by category
3. ✅ Client can revoke any granted permission with confirmation dialog
4. ✅ Client can grant permissions they previously revoked
5. ✅ Exclusive permission transfers use single atomic API call with advisory locking
6. ✅ UI updates immediately (optimistic) with rollback on conflict
7. ✅ Toast messages confirm changes; auto-refetch on conflict
8. ✅ Edge cases handled: inactive relationships, disabled permissions, zero pros, network errors
9. ✅ Race conditions prevented via pg_advisory_xact_lock

### Phase 2 Architect Review ✅

**Final Review Status:** PASSED

**Advisory Lock Implementation Verified:**
- `grant_exclusive_permission` derives per-client/permission advisory lock key using `hashtext(client_id || ':' || permission_slug)`
- `pg_advisory_xact_lock` guarantees single-writer serialization during transfers
- Partial unique index remains as safety net; `unique_violation` trapped and returns conflict-specific message
- React handler inspects conflict-centric error strings and triggers immediate `refetch()`
- These changes collectively remove the window where exclusives could be briefly unassigned

**Recommended Post-Deploy Actions:**
1. Ensure API surface propagates conflict message without alteration so client recognizes it
2. Add regression coverage (integration or unit tests) exercising concurrent exclusive grants
3. Monitor logs post-deploy for any residual conflict spikes to confirm advisory lock behavior

---

## Phase 3: Professional Invitation Flow ✅ COMPLETED

**Goal:** Professionals request specific permissions upfront during invitation, and clients review/approve permissions during acceptance.

### Architect Review Notes
- ✅ Create `invitation_permissions` junction table for invitation-time requests
- ✅ Create `permission_requests` table for post-connection pending items
- ✅ Reuse PermissionCategoryAccordion in request-selection mode
- ✅ Advisory locks for exclusive permission handling during invitation
- ✅ Backfill existing invitations from role_type defaults
- ✅ Handle clients declining all permissions (connection saved, permissions granted later)

### Implementation Summary

**Files Created/Modified:**
- `supabase/migrations/021_invitation_permissions.sql` - New tables, RLS policies, RPC functions
- `server/routes.ts` - New API endpoints for invitation flow and permission requests
- `client/src/components/InvitationPermissionSelector.tsx` - Reusable permission picker for both request and review modes
- `client/src/pages/pro/ProInvite.tsx` - Permission customization with Collapsible expand
- `client/src/pages/pro/ProAcceptInvite.tsx` - Multi-step auth → permission review → accept flow
- `client/src/components/PendingPermissionRequests.tsx` - Compact and full layouts with approve/deny actions
- `client/src/lib/permissions.ts` - New hooks: `useInvitationDetails`, `useClientPermissionRequests`, `useRespondToPermissionRequest`, `useAcceptInvitation`
- `shared/supabase-types.ts` - `InvitationDetailsResponse`, `PermissionRequestWithDetails` types

**Key Technical Decisions:**
- `create_invitation_with_permissions` RPC validates permission slugs and persists to `invitation_permissions`
- `finalize_invitation_permissions` RPC handles acceptance transactionally with advisory locks for exclusive permissions
- `fetch_invitation_details` RPC returns invitation, professional, and requested permissions with exclusivity status
- InvitationPermissionSelector supports both "request" mode (professional selecting) and "review" mode (client approving)
- Cache invalidation on mutations: `/api/client/permissions`, `/api/client/permission-requests`, `/api/client/assignments`

### 3.1 Database Schema Changes ✅

#### 3.1.1 invitation_permissions Table
```sql
CREATE TABLE invitation_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  permission_slug VARCHAR(50) NOT NULL REFERENCES permission_definitions(slug) ON DELETE CASCADE,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  requested_by VARCHAR(20) DEFAULT 'professional', -- professional, admin
  UNIQUE(invitation_id, permission_slug)
);
```

#### 3.1.2 permission_requests Table (Post-Connection)
```sql
CREATE TABLE permission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES professional_client_relationships(id) ON DELETE CASCADE,
  permission_slug VARCHAR(50) NOT NULL REFERENCES permission_definitions(slug) ON DELETE CASCADE,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  responded_at TIMESTAMP WITH TIME ZONE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(relationship_id, permission_slug) WHERE status = 'pending'
);
```

#### 3.1.3 Backfill Migration ✅
- Existing pending invitations: derive permission set from role_type defaults
- Legacy accept RPCs: treat missing invitation_permissions rows as full-role fallback

### 3.2 Supabase RPC Updates ✅

- [x] **3.2.1** `create_invitation_with_permissions` RPC
  - Accepts array of permission slugs parameter (nullable for role-based defaults)
  - Validates against enabled permission definitions
  - Persists rows into invitation_permissions within transaction
  - Returns success, invitation_id, and permissions_requested array

- [x] **3.2.2** `fetch_invitation_details` RPC
  - Input: invitation token
  - Returns: invitation info, professional info, requested permissions with exclusivity status
  - Includes permission category, type, and is_exclusive flag for UI display

- [x] **3.2.3** `finalize_invitation_permissions` RPC
  - Input: token, approved[], rejected[]
  - Uses advisory lock (`pg_advisory_xact_lock`) for exclusive permission serialization
  - Grants approved permissions via existing grant helpers
  - Records rejected permissions in permission_requests as 'denied'
  - Marks relationship as active
  - Returns relationship_id, approved_count, rejected_count

### 3.3 API Endpoint Changes ✅

- [x] **3.3.1** `GET /api/invitations/:token`
  - Fetches invitation details with requested permissions
  - Returns professional profile info (name, user_id)
  - Includes permission metadata for review UI

- [x] **3.3.2** `POST /api/invitations/:token/accept`
  - Accepts `{ approved: PermissionSlug[], rejected: PermissionSlug[] }`
  - Calls finalize_invitation_permissions RPC
  - Returns relationship_id and final permission counts

- [x] **3.3.3** `GET /api/client/permission-requests`
  - Fetches pending permission requests for authenticated client
  - Returns requests with professional name, permission details, exclusivity status
  - Used for PendingPermissionRequests component

- [x] **3.3.4** `PATCH /api/client/permission-requests/:requestId`
  - Accepts `{ action: 'approve' | 'deny' }`
  - Routes through existing grant/revoke logic with advisory locks
  - Updates permission_request status and responded_at

### 3.4 ProInvite.tsx UI Overhaul ✅

- [x] **3.4.1** Permission Selection Component (InvitationPermissionSelector)
  - Reuses PermissionCategoryAccordion patterns in "request mode"
  - All toggles default OFF (professional selects what to request)
  - 48px touch targets on all interactive elements
  - Category badges show selected count

- [x] **3.4.2** Exclusivity Warnings
  - Lock badge on exclusive permissions
  - Amber visual indicator for exclusive permissions

- [x] **3.4.3** Role Presets
  - Visual role cards for Nutritionist, Trainer, Coach
  - Role selection determines default permission context
  - Collapsible "Customize Permissions" section for overrides

- [x] **3.4.4** Validation
  - When customizing: blocks submission until at least one permission is selected
  - Shows toast on validation failure

### 3.5 ProAcceptInvite.tsx UI Updates ✅

- [x] **3.5.1** Permission Review Screen
  - Fetches invitation details via `GET /api/invitations/:token`
  - Displays professional name with Shield icon header
  - Shows requested permissions using InvitationPermissionSelector in "review" mode

- [x] **3.5.2** Permission Approval Toggles
  - Uses InvitationPermissionSelector with toggles
  - Default state: all requested permissions ON (approved)
  - Client can toggle OFF to decline specific permissions
  - 48px touch targets

- [x] **3.5.3** Multi-Step Flow
  - Step 1: Auth (signup/signin forms)
  - Step 2: Permission Review (after auth, before acceptance)
  - Step 3: Accepting (loading state during RPC call)
  - Step 4: Accepted (success with "Go to LOBA Tracker" CTA)

- [x] **3.5.4** Acceptance Flow
  - "Accept Connection (N permissions)" button submits approved permissions
  - Declining ALL permissions: shows "(No Permissions)" message, can grant later
  - Success state shows confirmation and Settings reminder

### 3.6 Client Dashboard Integration ✅

- [x] **3.6.1** Pending Permission Requests Panel (PendingPermissionRequests)
  - Two modes: compact (for inline display) and full (for dedicated section)
  - Shows outstanding requests from permission_requests table
  - Category icons for visual identification
  - Approve/Deny buttons with 48px touch targets

- [x] **3.6.2** Notification Badge
  - `usePendingPermissionRequestsCount()` hook for badge display
  - Updates on permission request changes via cache invalidation

- [x] **3.6.3** Request Approval Flow
  - Approve: grants permission via existing grant logic with advisory locks
  - Deny: updates permission_request status to 'denied'
  - Toast confirmation on action
  - Exclusive permission warnings with amber AlertTriangle icon

### 3.7 Edge Cases & Error Handling ✅

- [x] **3.7.1** Invitations Without Permission Rows
  - Default to role_type presets for legacy invitations
  - RPC falls back gracefully when no invitation_permissions exist

- [x] **3.7.2** Exclusive Permission Already Held
  - During acceptance: advisory locks prevent race conditions
  - UI shows Lock badge and transfer warning

- [x] **3.7.3** Expired/Invalid Token
  - Renders invalid/expired state with XCircle icon
  - Clear error messaging

- [x] **3.7.4** Client Declines All Permissions
  - Connection established with zero permissions
  - Message: "You can grant permissions later from Settings"
  - Client can grant later via PermissionManager

---

### Phase 3 File Changes ✅

| File | Changes |
|------|---------|
| `supabase/migrations/021_invitation_permissions.sql` | New tables, RLS policies, 3 RPC functions |
| `server/routes.ts` | 4 new API endpoints for invitation and permission request flows |
| `client/src/components/InvitationPermissionSelector.tsx` | New reusable permission picker component |
| `client/src/pages/pro/ProInvite.tsx` | Role selection + customizable permission requests |
| `client/src/pages/pro/ProAcceptInvite.tsx` | Multi-step auth → review → accept flow |
| `client/src/components/PendingPermissionRequests.tsx` | New dashboard component with compact/full modes |
| `client/src/lib/permissions.ts` | 4 new hooks for invitation and request management |
| `shared/supabase-types.ts` | New types for invitation details and permission requests |

### Phase 3 API Dependencies ✅

All required endpoints implemented:
- `GET /api/invitations/:token` - Fetch invitation details with permissions
- `POST /api/invitations/:token/accept` - Accept invitation with permission selections
- `GET /api/client/permission-requests` - Fetch pending requests for client
- `PATCH /api/client/permission-requests/:requestId` - Approve or deny request

### Phase 3 Success Criteria ✅

1. ✅ Professional can select specific permissions when creating invitation
2. ✅ Exclusive permission indicators shown during invitation creation
3. ✅ Client sees requested permissions during invitation acceptance
4. ✅ Client can approve/deny individual permissions
5. ✅ Exclusive transfers handled with advisory locks
6. ✅ Pending permission requests visible on client dashboard
7. ✅ Legacy invitations without permissions fall back to role defaults
8. ✅ Advisory locks prevent race conditions during acceptance
9. ✅ Mobile-first UI with 48px touch targets throughout

### Phase 3 Architect Review ✅

**Final Review Status:** PASSED

**Key Validations:**
- Schema cleanly separates invitation-time selections (`invitation_permissions`) from post-connection follow-ups (`permission_requests`)
- Exclusivity guarantees preserved via advisory locks in `finalize_invitation_permissions` RPC
- RPC/API layering mirrors Phase 2 patterns, reusing existing grant helpers
- UI components reused for consistency (InvitationPermissionSelector based on PermissionCategoryAccordion patterns)
- Cache invalidation properly configured for React Query

**Recommended Post-Deploy Actions:**
1. Add automated integration tests covering concurrent `finalize_invitation_permissions` calls
2. Monitor Supabase RPC logs for any duplicate permission_request accumulation
3. Consider adding professional-side notification when permissions are approved/denied

---

## Phase 4: Admin Policy Controls ✅ COMPLETED (4.0-4.2)

**Goal:** Platform-level configuration, professional verification, and override capabilities with comprehensive audit logging.

### Architect Review Notes
- ✅ Audit logging implemented FIRST (all admin actions depend on it)
- ✅ Exclusivity enforcement refactored to support admin toggles via trigger-maintained column
- ✅ Service-role JWT authentication on all admin endpoints
- ✅ Audit log tamper resistance via append-only RLS policies
- ✅ Advisory locks apply to admin grants same as client grants
- ⚠️ Role-based permission presets deferred to Phase 4.3+
- ⚠️ Professional verification system deferred to Phase 4.3+

### Implementation Summary

**Migration Files:**
- `supabase/migrations/022_audit_logging.sql` - Audit log table, RLS policies, updated grant/revoke RPCs with logging
- `supabase/migrations/023_exclusivity_refactor.sql` - Trigger-maintained exclusivity column, dynamic index, toggle RPCs

**Key Technical Decisions:**
- `target_professional_id` references `profiles(id)` since professionals are stored in profiles table with role='professional'
- Old function signatures dropped before recreating with extended 5-parameter versions (handle VARCHAR/TEXT variations)
- All exclusivity changes logged as `policy_change` events with mandatory 10+ character reason
- Advisory locks used consistently for both client and admin-initiated grants

### 4.0 Audit Event Logging ✅ COMPLETED

- [x] **4.0.1** Create `permission_audit_log` table
  ```sql
  CREATE TABLE permission_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL, -- grant, revoke, transfer, admin_override, policy_change
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('client', 'professional', 'admin', 'system')),
    actor_id UUID NOT NULL,
    target_client_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    target_relationship_id UUID REFERENCES professional_client_relationships(id) ON DELETE SET NULL,
    target_professional_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Professional's profile ID
    permission_slug VARCHAR(50) REFERENCES permission_definitions(slug) ON DELETE SET NULL,
    previous_state JSONB,
    new_state JSONB,
    reason TEXT, -- required for admin actions (10+ char minimum)
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    CONSTRAINT admin_actions_require_reason CHECK (
      actor_type != 'admin' OR (reason IS NOT NULL AND LENGTH(TRIM(reason)) >= 10)
    )
  );
  ```
  - RLS: Append-only (INSERT blocked for clients, only via SECURITY DEFINER RPCs)
  - RLS: Read access restricted to service_role only

- [x] **4.0.2** Create audit logging RPC helper
  - `log_permission_event(p_event_type, p_actor_type, p_actor_id, ...)` - SECURITY DEFINER function
  - Validates actor_type and reason requirements
  - Called internally by grant/revoke RPCs (not directly exposed to clients)

- [x] **4.0.3** Update existing RPCs to call audit logger
  - `grant_exclusive_permission` extended with `p_actor_id UUID`, `p_reason TEXT` parameters
  - `grant_shared_permission` extended with same parameters
  - `revoke_permission` created with audit logging
  - Old function signatures dropped: `(UUID, VARCHAR, VARCHAR)` and `(UUID, TEXT, TEXT)` variants
  - All RPCs capture previous_state and new_state for full auditability

- [x] **4.0.4** Admin audit log viewer
  - API: `GET /api/admin/audit-log` - Paginated with filters (actor_type, event_type, client_id, permission_slug, date range)
  - RPC: `get_audit_log()` - Returns entries with resolved actor/client/professional names
  - RPC: `count_audit_log()` - For pagination
  - UI: AuditLogTab in AdminPage with color-coded event badges, expandable entries, filter controls

### 4.1 Exclusivity Enforcement Refactor ✅ COMPLETED

**Problem Solved:** Previous partial unique index hard-coded exclusive permission slugs, preventing admin toggles.

**Solution:** Trigger-maintained `perm_is_exclusive` column with dynamic partial unique index.

- [x] **4.1.1** Add `perm_is_exclusive` column to `client_permissions` with triggers
  - Column added with DEFAULT FALSE
  - Backfill existing rows from permission_definitions
  - `sync_perm_is_exclusive()` trigger on INSERT/UPDATE
  - `cascade_exclusivity_change()` trigger cascades changes from permission_definitions

- [x] **4.1.2** Replace hard-coded partial index with dynamic index
  ```sql
  DROP INDEX IF EXISTS idx_exclusive_permission_one_holder;
  CREATE UNIQUE INDEX idx_exclusive_permission_dynamic
  ON client_permissions (client_id, permission_slug)
  WHERE status = 'granted' AND perm_is_exclusive = TRUE;
  ```

- [x] **4.1.3** Service-role access for exclusivity management
  - `toggle_permission_exclusivity` RPC with SECURITY DEFINER
  - Verifies `(SELECT auth.jwt() ->> 'role') = 'service_role'`
  - Logs `policy_change` event with before/after state

- [x] **4.1.4** Handle exclusivity toggle edge cases
  - **Exclusive → Shared:** Immediate, no conflicts
  - **Shared → Exclusive:** `check_exclusivity_conflicts()` RPC returns clients with multiple grants
  - Admin must resolve conflicts before enabling exclusivity (API returns error with conflict list)

### 4.2 Permission Policy Admin Page ✅ COMPLETED

- [x] **4.2.1** Admin API endpoints (service-role + admin session required)
  - `GET /api/admin/permissions/definitions` - All definitions with is_enabled, is_exclusive, requires_verification
  - `GET /api/admin/permissions/definitions/:slug` - Single permission details
  - `PATCH /api/admin/permissions/definitions/:slug` - Update is_enabled (exclusivity changes blocked)
  - `POST /api/admin/permissions/definitions/:slug/toggle-exclusivity` - Toggle with mandatory reason (10+ chars trimmed)
  - `GET /api/admin/permissions/stats` - Grant counts, relationship counts per permission

- [x] **4.2.2** Permission definitions management UI (PermissionPolicyTab)
  - Card grid view of all 12 permissions grouped by type (Shared/Exclusive)
  - Enable/disable toggle per permission
  - Exclusivity toggle with confirmation dialog and reason textarea
  - Stats display: grant count and relationship count per permission
  - Loading states and error handling with toast notifications
  - Cache invalidation on mutations: `/api/admin/permissions/definitions`, `/api/admin/permissions/stats`

### 4.3 Professional Verification System ✅ COMPLETED

**Goal:** Allow professionals to submit verification documents and admins to review/approve them.

#### 4.3.1 Database Schema Changes

- [x] **Extend `professional_profiles` table:**
  ```sql
  ALTER TABLE professional_profiles ADD COLUMN
    verification_status VARCHAR(20) DEFAULT 'unverified' 
      CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
    verification_submitted_at TIMESTAMPTZ,
    verification_reviewed_at TIMESTAMPTZ,
    verification_reviewed_by UUID REFERENCES profiles(id),
    verification_notes TEXT;
  ```

- [x] **Create `verification_documents` table:**
  ```sql
  CREATE TABLE verification_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- 'certification', 'license', 'id_verification'
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    review_status VARCHAR(20) DEFAULT 'pending'
  );
  ```

- [x] **RLS Policies for `verification_documents`:**
  - Professionals can INSERT/SELECT their own documents
  - Service-role can SELECT all (for admin review via signed URLs)

#### 4.3.2 Supabase Storage Design

- [x] **Create bucket:** `verification-documents`

- [x] **Storage RLS Policies:**
  - Professionals can upload to their own folder: `verification-documents/{user_id}/*`
  - Only service-role can read (admins access via signed URLs with 60-minute expiry)

- [x] **Signed URL Flow:**
  - Admin requests document → Backend generates signed URL (60-minute expiry)
  - Frontend displays document via signed URL
  - No direct bucket access for admin users

#### 4.3.3 Supabase RPCs (all SECURITY DEFINER)

- [x] **`submit_verification_request()`**
  - Input: document_ids[] (already uploaded)
  - Updates professional_profiles.verification_status = 'pending'
  - Logs event: `log_permission_event('verification_submit', 'professional', auth.uid(), ...)`

- [x] **`review_verification_request(p_user_id, p_decision, p_admin_id, p_reason)`**
  - Validates service-role JWT
  - Validates reason length ≥10 chars
  - Updates professional_profiles verification fields
  - Logs event: `log_permission_event('verification_review', 'admin', p_admin_id, ..., p_reason)`

- [x] **`list_pending_verifications()`**
  - Validates service-role JWT
  - Returns professionals with verification_status = 'pending'
  - Includes document metadata (not URLs - those come via separate signed URL endpoint)

#### 4.3.4 API Endpoints

| Method | Endpoint | Auth | Audit |
|--------|----------|------|-------|
| POST | `/api/professionals/verification/request` | Supabase auth | Yes |
| GET | `/api/admin/verification/requests` | Service-role + admin session | No (read-only) |
| GET | `/api/admin/verification/requests/:id` | Service-role + admin session | No (read-only) |
| GET | `/api/admin/verification/documents/:docId/url` | Service-role + admin session | No (signed URL) |
| PATCH | `/api/admin/verification/requests/:id` | Service-role + admin session | Yes (reason required) |

#### 4.3.5 UI Components

- [x] **Professional-facing:**
  - Verification status banner on profile/dashboard
  - Document upload form (drag-drop, file type validation)
  - Status tracker: Unverified → Pending → Verified/Rejected

- [x] **Admin-facing (VerificationTab):**
  - Queue table with professional name, submitted date, document count
  - Detail drawer with:
    - Professional info summary
    - Document viewer (via signed URLs)
    - Decision buttons: Approve / Reject
    - Mandatory reason textarea (10+ chars)
  - Filters: status, date range

#### 4.3 Migration
- Migration: `supabase/migrations/024_verification_system.sql`

---

### 4.4 Role-Based Permission Presets ✅ COMPLETED

**Goal:** Simplify permission management with reusable preset templates.

#### 4.4.1 Database Schema Changes

- [x] **Create `permission_presets` table:**
  ```sql
  CREATE TABLE permission_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE, -- System presets can't be deleted
    is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete support
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

- [x] **Create `preset_permissions` junction table:**
  ```sql
  CREATE TABLE preset_permissions (
    preset_id UUID NOT NULL REFERENCES permission_presets(id) ON DELETE CASCADE,
    permission_slug VARCHAR(50) NOT NULL REFERENCES permission_definitions(slug) ON DELETE CASCADE,
    PRIMARY KEY (preset_id, permission_slug)
  );
  ```

- [x] **Seed system presets:**
  - Nutritionist: view_nutrition, view_weight, set_nutrition_targets
  - Trainer: view_workouts, view_weight, assign_programmes, assign_checkins
  - Coach: all permissions

- [x] **RLS Policies:**
  - Authenticated can read presets
  - Only service-role can modify

#### 4.4.2 Supabase RPCs (all SECURITY DEFINER)

- [x] **`list_permission_presets()`**
  - Returns all presets with their permission slugs
  - Public read access

- [x] **`upsert_permission_preset(p_name, p_description, p_permission_slugs[], p_admin_id, p_reason)`**
  - Validates service-role JWT
  - Validates reason length ≥10 chars
  - Creates/updates preset and junction rows
  - Logs: `log_permission_event('preset_change', 'admin', p_admin_id, ..., p_reason)`

- [x] **`delete_permission_preset(p_preset_id, p_admin_id, p_reason)`**
  - Validates not a system preset
  - Validates service-role JWT
  - Soft delete (sets is_deleted = TRUE)
  - Logs deletion event

- [x] **`apply_permission_preset(p_relationship_id, p_preset_id, p_admin_id, p_reason)`**
  - Grants all permissions in preset using existing grant_* functions
  - Uses advisory locks for exclusive permissions
  - Logs each grant with preset context in metadata

#### 4.4.3 API Endpoints

| Method | Endpoint | Auth | Audit |
|--------|----------|------|-------|
| GET | `/api/admin/permission-presets` | Service-role + admin session | No |
| POST | `/api/admin/permission-presets` | Service-role + admin session | Yes (reason required) |
| DELETE | `/api/admin/permission-presets/:id` | Service-role + admin session | Yes (reason required) |
| POST | `/api/admin/permission-presets/:id/apply` | Service-role + admin session | Yes (reason required) |

#### 4.4.4 UI Components

- [x] **Admin-facing (PresetsTab):**
  - Preset list with name, description, permission count
  - Create/Edit dialog:
    - Name and description fields
    - Permission matrix (checkboxes for all 12 permissions)
    - System preset indicator (non-editable)
    - Reason textarea for changes
  - Delete confirmation with reason input
  - "Apply to Relationship" action (used by Force-Connection in 4.6)

#### 4.4 Migration
- Migration: `supabase/migrations/025_permission_presets.sql`

---

### 4.5 Admin Operational Dashboard ✅ COMPLETED

**Goal:** Provide admins with a comprehensive view of platform activity and quick actions.

#### 4.5.1 Database Functions (all SECURITY DEFINER)

- [x] **`get_admin_kpis()`**
  - Validates service-role JWT
  - Returns 10 metrics: total_clients, total_professionals, verified_professionals, pending_verifications, active_connections, total_permission_grants, exclusive_grants, shared_grants, recent_grants_7d, recent_revokes_7d

- [x] **`get_permission_activity_feed(p_limit, p_offset)`**
  - Validates service-role JWT
  - Returns paginated audit log summaries with actor names and event details

- [x] **`get_permission_trends(p_days)`**
  - Validates service-role JWT
  - Returns time-series data for charts: grants and revokes by day

#### 4.5.2 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/dashboard/kpis` | Service-role + admin session | KPI metrics |
| GET | `/api/admin/dashboard/activity` | Service-role + admin session | Recent audit activity feed |
| GET | `/api/admin/dashboard/trends` | Service-role + admin session | Time-series permission data |

#### 4.5.3 UI Components

- [x] **Admin-facing (AdminStatsTab - default admin landing page):**
  - **KPI Cards Row:**
    - Total Clients | Total Professionals | Verified Pros | Pending Verifications
    - Active Connections | Permission Grants | Recent Grants (7d) | Recent Revokes (7d)
  - **Recent Activity Feed:**
    - Last 10 audit log entries with:
      - Event type badge (color-coded)
      - Actor and target names
      - Timestamp (relative)
      - Expandable entry details

#### 4.5 Migration
- Included in: `supabase/migrations/025_permission_presets.sql`

---

### 4.6 Force-Connection Capability ✅ COMPLETED

**Goal:** Allow admins to create connections and grant permissions on behalf of clients/professionals.

#### 4.6.1 Database Schema Changes

- [x] **Extend `professional_client_relationships`:**
  ```sql
  ALTER TABLE professional_client_relationships ADD COLUMN
    forced_by_admin BOOLEAN DEFAULT FALSE,
    forced_reason TEXT,
    forced_at TIMESTAMPTZ;
  ```

#### 4.6.2 Supabase RPCs (all SECURITY DEFINER)

- [x] **`force_connect(p_client_id, p_professional_id, p_preset_id, p_admin_id, p_reason)`**
  - Validates service-role JWT
  - Validates reason length ≥10 chars
  - Creates/reactivates relationship (status = 'active', forced_by_admin = TRUE)
  - Optional preset application with advisory locks for exclusive permissions
  - Logs: `log_permission_event('admin_force_connect', 'admin', p_admin_id, ..., p_reason)`
  - Returns: relationship_id, is_new, preset_applied

- [x] **`force_disconnect(p_relationship_id, p_admin_id, p_reason)`**
  - Validates service-role JWT
  - Validates reason length ≥10 chars
  - Revokes all permissions for relationship
  - Sets relationship status = 'ended'
  - Logs: `log_permission_event('admin_force_disconnect', 'admin', p_admin_id, ..., p_reason)`

#### 4.6.3 API Endpoints

| Method | Endpoint | Auth | Audit |
|--------|----------|------|-------|
| GET | `/api/admin/relationships` | Service-role + admin session | No |
| GET | `/api/admin/users/clients` | Service-role + admin session | No |
| GET | `/api/admin/users/professionals` | Service-role + admin session | No |
| POST | `/api/admin/force-connect` | Service-role + admin session | Yes (reason required) |
| POST | `/api/admin/force-disconnect` | Service-role + admin session | Yes (reason required) |

#### 4.6.4 UI Components

- [x] **Admin-facing (ForceConnectionTab):**
  - **Create Connection Form:**
    1. Client Search - Searchable dropdown for clients
    2. Professional Search - Searchable dropdown for professionals
       - Show verification badge if verified
    3. Permission Selection - Select preset (from Phase 4.4)
    4. Reason Input - Textarea, minimum 10 characters, required
  - **Relationship List:**
    - Shows all professional-client relationships
    - Forced connections highlighted with badge
    - Disconnect button with confirmation dialog
  - **Success State:**
    - Toast confirmation message
    - Relationship list refreshes

#### 4.6 Migration
- Included in: `supabase/migrations/025_permission_presets.sql`

---

### Phase 4 Security Requirements

| Requirement | Implementation Status |
|-------------|----------------------|
| Admin authentication | ✅ Service-role JWT + admin session verification |
| Endpoint protection | ✅ All `/api/admin/*` routes require admin auth middleware |
| Audit immutability | ✅ RLS prevents UPDATE/DELETE on audit table |
| Advisory locks | ✅ Apply to admin grants same as client grants |
| Reason capture | ✅ 10+ character trimmed reason required for admin actions |

### Phase 4 File Changes

| File | Status | Changes |
|------|--------|---------|
| `supabase/migrations/022_audit_logging.sql` | ✅ | Audit log table, RLS, updated grant/revoke RPCs with logging |
| `supabase/migrations/023_exclusivity_refactor.sql` | ✅ | Trigger-maintained column, dynamic index, toggle RPCs |
| `supabase/migrations/024_verification_system.sql` | ✅ | Professional verification columns, documents table, Storage bucket, signed URL RPCs |
| `supabase/migrations/025_permission_presets.sql` | ✅ | Presets tables, dashboard RPCs, force-connection columns and RPCs |
| `server/routes.ts` | ✅ | All admin endpoints: definitions, stats, exclusivity, audit, verification, presets, dashboard, force-connection |
| `client/src/pages/AdminPage.tsx` | ✅ | AuditLogTab, PermissionPolicyTab, VerificationTab, PresetsTab, AdminStatsTab, ForceConnectionTab components |

### Phase 4 Success Criteria (4.0-4.2)

1. ✅ All permission changes logged with actor, timestamp, before/after state
2. ✅ Admin can toggle permission exclusivity with immediate effect via triggers
3. ✅ Conflict detection prevents shared→exclusive when duplicates exist
4. ✅ All admin endpoints protected by service-role + session authentication
5. ✅ Audit log append-only (RLS blocks direct INSERT, UPDATE, DELETE from clients)
6. ✅ Admin UI shows permission definitions with enable/disable and exclusivity controls
7. ✅ Exclusivity changes require mandatory 10+ character reason
8. ✅ Stats display grant counts and relationship counts per permission

### Phase 4.3-4.6 Success Criteria ✅

**4.3 Verification:**
1. ✅ Professionals can upload verification documents to secure Storage bucket
2. ✅ Documents accessible only via time-limited signed URLs (60-minute expiry)
3. ✅ Admins can view pending verifications in VerificationTab queue
4. ✅ Approve/reject actions require 10+ character reason and are audit-logged
5. ✅ RLS prevents direct document access without signed URLs

**4.4 Presets:**
1. ✅ System presets seeded: Nutritionist, Personal Trainer, Coach
2. ✅ Admin can create/edit custom presets via PresetsTab
3. ✅ System presets protected from deletion
4. ✅ Preset application uses advisory locks for exclusive permissions
5. ✅ All preset changes audit-logged with reason

**4.5 Dashboard:**
1. ✅ KPI cards display real-time metrics (clients, pros, connections, grants)
2. ✅ Activity feed shows recent permission events with actor names
3. ✅ AdminStatsTab is default landing page for admin panel

**4.6 Force-Connection:**
1. ✅ Admin can create/reactivate professional-client relationships
2. ✅ Optional preset application during force-connect
3. ✅ Force-disconnect revokes all permissions and ends relationship
4. ✅ All force operations require 10+ char reason and are audit-logged
5. ✅ Advisory locks prevent race conditions on exclusive permissions

### Phase 4.0-4.2 Architect Review ✅

**Final Review Status:** PASSED

**Key Validations:**
- Migration 022 correctly references `profiles(id)` for `target_professional_id` (professionals stored in profiles table)
- Old function signatures dropped before recreating extended versions (handles VARCHAR/TEXT variations)
- `get_audit_log` RPC joins directly with `profiles` for professional names
- `check_exclusivity_conflicts` RPC joins with `profiles` for professional names
- All admin endpoints verify both service-role JWT and admin session
- Exclusivity toggle uses `toggle_permission_exclusivity` RPC with proper conflict checking

**Recommended Post-Deploy Actions:**
1. Run `supabase migration up` to apply migrations 022 and 023
2. Test exclusivity toggle on permissions with active grants
3. Verify audit log entries appear for permission changes
4. Monitor for any function signature ambiguity errors

### Phase 4.3-4.6 Security Checklist ✅

| Requirement | 4.3 | 4.4 | 4.5 | 4.6 |
|-------------|-----|-----|-----|-----|
| Service-role JWT verification | ✅ | ✅ | ✅ | ✅ |
| Admin session validation | ✅ | ✅ | ✅ | ✅ |
| Reason ≥10 chars for write ops | ✅ | ✅ | N/A (read-only) | ✅ |
| Admin ID passed to audit log | ✅ | ✅ | N/A | ✅ |
| RLS policies on new tables | ✅ | ✅ | ✅ | ✅ |
| Storage bucket RLS | ✅ | N/A | N/A | N/A |
| Signed URLs for sensitive docs | ✅ | N/A | N/A | N/A |
| Advisory locks for exclusives | N/A | ✅ | N/A | ✅ |

### Phase 4.3-4.6 Architect Review ✅

**Final Review Status:** PASSED

**Key Validations:**
- Migration 024 correctly implements verification system with Storage bucket RLS
- Migration 025 correctly implements presets, dashboard RPCs, and force-connection
- All RPCs verify service-role JWT before executing
- All write operations require ≥10 character reason for audit trail
- Advisory locks used consistently for exclusive permission handling
- No component duplication in AdminPage.tsx (11 tabs correctly configured)

**Recommended Post-Deploy Actions:**
1. Test preset application with exclusive permissions to verify advisory lock behavior
2. Verify force-connect/disconnect with existing relationships
3. Monitor audit log for any unexpected events

### Phase 4.3-4.6 Dependencies

```
┌─────────────────┐     ┌─────────────────┐
│  Phase 4.3      │     │  Phase 4.4      │
│  Verification   │     │  Presets        │
│  (4-5 days)     │     │  (3-4 days)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
         ┌─────────────────────┐
         │  Phase 4.5          │
         │  Dashboard          │
         │  (2-3 days)         │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │  Phase 4.6          │
         │  Force-Connection   │
         │  (4-5 days)         │
         └─────────────────────┘
```

**Notes:**
- 4.3 and 4.4 can be implemented in parallel
- 4.5 depends on 4.3 (verification stats) and 4.4 (preset stats)
- 4.6 benefits from 4.3 (verification gating) and 4.4 (preset selection)

### Phase 4 Effort Summary (4.3-4.6)

| Task | Effort | Status |
|------|--------|--------|
| 4.3 Verification System | 4-5 days | ✅ COMPLETED |
| 4.4 Role Presets | 3-4 days | ✅ COMPLETED |
| 4.5 Admin Dashboard | 2-3 days | ✅ COMPLETED |
| 4.6 Force-Connection | 4-5 days | ✅ COMPLETED |
| **Total** | **13-17 days** | ✅ COMPLETED |

---

## Database Schema

### permission_definitions
```sql
CREATE TABLE permission_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR UNIQUE NOT NULL,
  display_name VARCHAR NOT NULL,
  description TEXT,
  category VARCHAR NOT NULL, -- nutrition, workouts, weight, photos, checkins, fasting, profile
  permission_type VARCHAR NOT NULL, -- read, write
  is_exclusive BOOLEAN DEFAULT FALSE,
  is_enabled BOOLEAN DEFAULT TRUE,
  requires_verification BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### client_permissions (Updated in Phase 4)
```sql
CREATE TABLE client_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID REFERENCES professional_client_relationships(id) ON DELETE CASCADE,
  permission_slug VARCHAR REFERENCES permission_definitions(slug),
  status VARCHAR DEFAULT 'granted', -- pending, granted, revoked
  granted_at TIMESTAMP DEFAULT NOW(),
  granted_by VARCHAR DEFAULT 'client', -- client, admin, professional
  revoked_at TIMESTAMP,
  admin_notes TEXT,
  client_id UUID NOT NULL REFERENCES profiles(id), -- Denormalized for unique index
  perm_is_exclusive BOOLEAN DEFAULT FALSE, -- Trigger-maintained from permission_definitions
  UNIQUE(relationship_id, permission_slug)
);

-- Dynamic partial unique index for exclusive permission enforcement (Phase 4)
CREATE UNIQUE INDEX idx_exclusive_permission_dynamic
ON client_permissions (client_id, permission_slug)
WHERE status = 'granted' AND perm_is_exclusive = TRUE;
```

### permission_audit_log (Phase 4)
```sql
CREATE TABLE permission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL, -- grant, revoke, transfer, admin_override, policy_change
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('client', 'professional', 'admin', 'system')),
  actor_id UUID NOT NULL,
  target_client_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_relationship_id UUID REFERENCES professional_client_relationships(id) ON DELETE SET NULL,
  target_professional_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  permission_slug VARCHAR(50) REFERENCES permission_definitions(slug) ON DELETE SET NULL,
  previous_state JSONB,
  new_state JSONB,
  reason TEXT, -- required for admin actions (10+ char minimum)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  CONSTRAINT admin_actions_require_reason CHECK (
    actor_type != 'admin' OR (reason IS NOT NULL AND LENGTH(TRIM(reason)) >= 10)
  )
);
```

### permission_requests (Phase 3)
```sql
CREATE TABLE permission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID REFERENCES professional_client_relationships(id) ON DELETE CASCADE,
  permission_slug VARCHAR REFERENCES permission_definitions(slug),
  requested_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR DEFAULT 'pending', -- pending, approved, denied
  responded_at TIMESTAMP,
  UNIQUE(relationship_id, permission_slug, status)
);
```

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Migration approach | Full role parity | Grant all permissions the role would have had |
| Keep role_type? | Yes, for now | Backward compatibility during transition |
| Exclusive enforcement | Application level | Allows warning + confirmation UX |
| Notifications | In-app first | Real-time can be added later |

---

## API Endpoints

### Permission Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/permissions/definitions` | Supabase | Get all enabled permission definitions |
| GET | `/api/pro/clients/:clientId/permissions` | Professional | Get permissions for a specific client |
| GET | `/api/pro/clients/by-permission/:permission` | Professional | Get clients with specific permission |
| GET | `/api/client/permissions` | Client | Get all permissions for the current client |
| PUT | `/api/client/permissions/:relationshipId` | Client | Update permissions (grant/revoke) |
| POST | `/api/admin/permissions/migrate-relationship` | Admin | Migrate single relationship to permissions |
| POST | `/api/admin/permissions/migrate-all` | Admin | Migrate all active relationships |

### Request/Response Examples

**GET /api/client/permissions**
```json
{
  "relationships": [{
    "relationship_id": "uuid",
    "professional_id": "uuid",
    "professional_name": "John Trainer",
    "professional_avatar": "url",
    "professional_headline": "Certified Personal Trainer",
    "role_type": "trainer",
    "granted_permissions": ["view_workouts", "view_weight", "assign_programmes"]
  }],
  "permission_definitions": [...]
}
```

**PUT /api/client/permissions/:relationshipId**
```json
// Request
{ "grant": ["view_nutrition"], "revoke": ["view_weight"] }

// Response
{
  "message": "Permissions updated successfully",
  "granted_permissions": ["view_workouts", "view_nutrition", "assign_programmes"],
  "available_permissions": [...]
}
```

---

## Exclusive Permission Enforcement

### Primary Approach: Transactional PostgreSQL RPC

The preferred method uses transactional PostgreSQL functions that provide atomic exclusive permission grants:

**`grant_exclusive_permission(p_relationship_id, p_permission_slug, p_granted_by)`**
- Locks the existing permission row with `FOR UPDATE`
- Revokes any current holder within the same transaction
- Grants permission to the new holder
- Returns: `{ success, previous_holder_revoked, previous_holder_id }`

**`grant_shared_permission(p_relationship_id, p_permission_slug, p_granted_by)`**
- Simple upsert for non-exclusive permissions
- Returns: `{ success, error }`

### Database-Level Exclusivity Guarantee

A partial unique index on `client_permissions` makes duplicate exclusive grants **impossible**:

```sql
CREATE UNIQUE INDEX idx_exclusive_permission_one_holder
ON client_permissions (client_id, permission_slug)
WHERE status = 'granted' AND permission_slug IN (
  'set_nutrition_targets', 'set_weight_targets', 'assign_programmes', 
  'assign_checkins', 'set_fasting_schedule'
);
```

This ensures:
- Concurrent inserts for the same exclusive permission → one succeeds, one fails with unique violation
- The RPC catches the exception and returns a retry-able error
- No post-grant cleanup required for race conditions

### Fallback: Optimistic Concurrency Pattern

If RPC functions are unavailable (pre-migration), the system falls back to application-level enforcement:

1. **Pre-grant check**: Check for existing holder before granting
2. **Revoke previous holder**: If exists, revoke their permission
3. **Grant new permission**: Insert/update the new grant (with client_id for unique index)
4. **Handle unique violation**: If error code 23505, return retry-able error message
5. **Post-grant validation**: Count holders and resolve any duplicates

### Admin Cleanup Endpoint

`POST /api/admin/permissions/resolve-duplicates` scans all clients and resolves any duplicate exclusive permissions, keeping the earliest grant by `granted_at` timestamp.

---

## Progress Log

| Date | Phase | Items Completed | Notes |
|------|-------|-----------------|-------|
| 2024-12-02 | 1 | 1.1, 1.2, 1.3, 1.4, 1.6 | SQL migration script created, TypeScript types added, permission helper functions created |
| 2024-12-02 | 1 | API endpoints | Added permission management endpoints to routes.ts |
| 2024-12-02 | 1 | Race condition handling | Added post-grant validation and duplicate resolution for exclusive permissions |
| 2024-12-02 | 1 | Transactional RPC | Added PostgreSQL RPC functions (grant_exclusive_permission, grant_shared_permission) for atomic operations |
| 2024-12-02 | 1 | Database constraint | Added partial unique index on (client_id, permission_slug) for database-level exclusivity enforcement |
| 2024-12-02 | 1 | Denormalization | Added client_id column to client_permissions with auto-populate trigger for efficient unique index |
| 2024-12-02 | 1 | NOT NULL constraint | **IMPORTANT:** Added NOT NULL constraint to client_id column - must be applied manually (see Post-Migration Fix below) |
| 2024-12-02 | 1 | Migration executed | SQL migration run in Supabase - Phase 1 complete |
| 2024-12-02 | 4.0-4.2 | Audit, Exclusivity, Policy | Audit logging, dynamic exclusivity, permission policy admin UI |
| 2024-12-02 | 4.3 | Verification System | Professional verification with Storage bucket and signed URLs |
| 2024-12-02 | 4.4 | Permission Presets | Presets tables, system defaults (Nutritionist/Trainer/Coach), preset application |
| 2024-12-02 | 4.5 | Admin Dashboard | KPI cards, activity feed, AdminStatsTab as default admin landing |
| 2024-12-02 | 4.6 | Force-Connection | Force connect/disconnect RPCs, ForceConnectionTab UI |

## Post-Migration Fix Required

The migration was executed before the NOT NULL constraint fix was added.

### How to Apply the Fix

1. **Open Supabase Dashboard** → Go to your project
2. **Navigate to SQL Editor** (left sidebar, looks like a terminal icon)
3. **Run these queries:**

```sql
-- Step 1: Verify no NULL values exist
SELECT COUNT(*) FROM client_permissions WHERE client_id IS NULL;

-- Step 2: If count is 0, apply NOT NULL constraint
ALTER TABLE client_permissions ALTER COLUMN client_id SET NOT NULL;

-- Step 3: Verify the constraint was applied
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'client_permissions' AND column_name = 'client_id';
-- Should return: is_nullable = 'NO'
```

### Why This Matters

This is critical for the partial unique index to properly enforce exclusivity. PostgreSQL allows multiple NULLs in unique indexes, so without the NOT NULL constraint, the exclusivity guarantee can be bypassed.

### Status: ✅ Complete

- [x] NOT NULL constraint applied in Supabase SQL Editor (2024-12-02)

## Next Steps

1. ✅ ~~Execute SQL Migration~~ - Completed
2. ✅ ~~Apply NOT NULL fix~~ - Completed
3. ✅ ~~Test Permission Grants~~ - Completed
4. ✅ ~~Test Migration~~ - Completed
5. ✅ ~~Verify Check-in Visibility~~ - Completed
6. ✅ ~~Phase 2: Client Permission Management UI~~ - Completed
7. ✅ ~~Phase 3: Professional Invitation Flow~~ - Completed
8. ✅ ~~Phase 4.0-4.2: Audit, Exclusivity, Policy~~ - Completed
9. ✅ ~~Phase 4.3: Professional Verification~~ - Completed
10. ✅ ~~Phase 4.4: Permission Presets~~ - Completed
11. ✅ ~~Phase 4.5: Admin Dashboard~~ - Completed
12. ✅ ~~Phase 4.6: Force-Connection~~ - Completed

**All phases complete!** The granular permission system is fully implemented with:
- Client-controlled permissions with exclusive/shared types
- Professional invitation flow with permission requests
- Admin controls for verification, presets, dashboard, and force-connection
- Comprehensive audit logging for all permission events
