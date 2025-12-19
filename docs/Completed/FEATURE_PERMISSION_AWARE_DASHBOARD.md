# Feature: Permission-Aware Professional Dashboard

## Status: Planning
**Created:** December 2024  
**Last Updated:** December 2024  
**Priority:** Critical (blocked by database fix)

---

## Problem Statement

### Current Issues

1. **Database Integrity Bug (Critical Blocker)**
   - Migration 021 incorrectly stores `professional_profiles.id` instead of the user's auth ID (`profiles.id`) in:
     - `invitations.professional_id`
     - `professional_client_relationships.professional_id`
   - Result: All professional-client queries return empty ("No connected clients")
   - Root cause: `create_invitation_with_permissions` and `finalize_invitation_permissions` RPCs use wrong ID

2. **UX Gap: No Quick Actions**
   - Trainers must navigate to separate client page for every action
   - No visibility into which permissions are granted vs. missing
   - Permission requests require multiple clicks

### Impact
- Professionals cannot see their clients after invitation acceptance
- Workflow friction slows down common tasks (assign program, set macros)
- No clear path to request missing permissions

---

## Solution Overview

A hybrid approach combining:

1. **Database fix** to restore client-professional connections
2. **Dashboard quick actions** for fast, permission-aware workflows
3. **Enhanced client view** with full permission visibility

### Design Principles
- Permission state visible at a glance (granted/locked/pending)
- Common actions accessible without page navigation
- Request flow is one-tap from any locked action
- Data sections gated by read permissions

---

## Implementation Phases

### Phase 1: Database Integrity Fix
**Goal:** Restore working client-professional connections

#### Migration 027 Scope

1. **Fix RPCs to use correct ID going forward:**
   ```sql
   -- create_invitation_with_permissions
   -- BEFORE: SELECT id INTO v_professional_id FROM professional_profiles
   -- AFTER:  Use auth.uid() directly as professional_id
   
   -- finalize_invitation_permissions  
   -- Fix JOIN to use pp.user_id instead of pp.id
   ```

2. **Fix RLS policies:**
   - Update joins from `pp.id = pcr.professional_id` 
   - To: `pp.user_id = pcr.professional_id`

3. **Backfill existing data:**
   ```sql
   -- Fix invitations
   UPDATE invitations i
   SET professional_id = pp.user_id
   FROM professional_profiles pp
   WHERE i.professional_id = pp.id;
   
   -- Fix relationships
   UPDATE professional_client_relationships pcr
   SET professional_id = pp.user_id
   FROM professional_profiles pp
   WHERE pcr.professional_id = pp.id;
   ```

4. **Verify other RPCs not affected:**
   - `force_connect` (admin)
   - `accept_invitation` (legacy)

#### Success Criteria
- [ ] Clients appear in professional dashboard after invitation acceptance
- [ ] `getProClients()` returns correct relationships
- [ ] Existing relationships restored via backfill
- [ ] No FK constraint violations

#### Dependencies
- Migration 026 (rename notes→message) should be applied first

---

### Phase 2: Dashboard Quick Actions
**Goal:** Enable fast, permission-aware actions from client list

#### UI Changes (ProDashboard.tsx)

Each client card gains a quick actions row:

```
┌─────────────────────────────────────────────────┐
│ Sarah Johnson                        [Coach]    │
│ Last active: 2 days ago                         │
│                                                 │
│ ┌──────────────────────────────────────────┐   │
│ │ [📋 Assign] [🍎 Macros🔒] [✓ Check-in]  │   │
│ └──────────────────────────────────────────┘   │
│                              [View Profile →]   │
└─────────────────────────────────────────────────┘
```

#### Action States
| State | Icon | Behavior |
|-------|------|----------|
| Granted | Solid icon | Opens action modal |
| Missing | Lock icon + "Request" | Opens permission request |
| Pending | Clock icon | Shows "Awaiting approval" |
| Denied | X icon | Option to re-request |

#### Data Requirements
- Fetch permissions per relationship on dashboard load
- Endpoint: `GET /api/pro/clients/:clientId/permissions`
- Optimize: Batch fetch for all visible clients

#### Success Criteria
- [ ] Quick actions visible on each client card
- [ ] Correct permission states displayed
- [ ] One-tap to request missing permission
- [ ] Pending requests show badge

---

### Phase 3: Enhanced ProClientView
**Goal:** Full permission visibility and action bar on client detail page

#### UI Changes (ProClientView.tsx)

Add Quick Actions Bar below header:

```
┌─────────────────────────────────────────────────────────┐
│ ← Back to Dashboard                                     │
│                                                         │
│ Sarah Johnson                                  [Coach]  │
│ Your coach client since Jan 15, 2024                    │
├─────────────────────────────────────────────────────────┤
│ QUICK ACTIONS                    [1 pending request]    │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │ Assign  │ │  Set    │ │ Check-in│ │ Weight  │ ...    │
│ │ Program │ │ Macros  │ │ Template│ │  Goal   │        │
│ │   ✓     │ │   🔒    │ │   ✓     │ │   🔒    │        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
├─────────────────────────────────────────────────────────┤
│ [Vitals] [Programmes] [Food] [Workouts] [Check-Ins]     │
└─────────────────────────────────────────────────────────┘
```

#### Permission-Gated Sections

| Read Permission | Controls |
|-----------------|----------|
| `view_nutrition` | Food tab, Today's Nutrition card |
| `view_workouts` | Workouts tab, workout history |
| `view_weight` | Weight tab, BMI gauge, vitals |
| `view_progress_photos` | Progress photos section |
| `view_fasting` | Fasting data section |
| `view_checkins` | Check-ins tab content |
| `view_profile` | Full profile details |

| Write Permission | Action Button |
|------------------|---------------|
| `assign_programmes` | Assign Program |
| `assign_checkins` | Assign Check-in |
| `set_nutrition_targets` | Set Macros |
| `set_weight_targets` | Set Weight Goal |
| `set_fasting_schedule` | Set Fasting Schedule |

#### Missing Permission UI
When a section requires a permission the trainer doesn't have:

```
┌─────────────────────────────────────────────┐
│ 🔒 Nutrition Data                           │
│                                             │
│ You need "View Nutrition" permission to     │
│ see this client's food logs.                │
│                                             │
│ [Request Permission]                        │
└─────────────────────────────────────────────┘
```

#### Success Criteria
- [ ] Quick actions bar with all 5 write permissions
- [ ] Pending request count visible
- [ ] Data sections gated by read permissions
- [ ] Clear messaging for missing permissions
- [ ] One-tap permission request from any locked section

---

### Phase 4: Testing & Polish
**Goal:** Validate all flows work correctly end-to-end

#### Test Scenarios

1. **Invitation Flow**
   - Create invitation with permissions
   - Client accepts with subset of permissions
   - Verify relationship created with correct professional_id
   - Verify granted permissions appear in dashboard

2. **Permission Request Flow**
   - Trainer requests missing permission from dashboard
   - Request appears in client's pending queue
   - Client approves → action button unlocks
   - Client denies → trainer can re-request with message

3. **Quick Actions Flow**
   - Dashboard quick action → modal opens
   - Action completes successfully
   - Cache invalidates, UI updates

4. **Data Backfill Verification**
   - Existing relationships visible after migration
   - No orphaned invitations or relationships
   - All foreign keys valid

#### Edge Cases
- Professional with no clients
- Client with multiple professionals (different permissions each)
- Exclusive permission already held by another professional
- Pending invitation not yet accepted
- Ended/inactive relationships

#### Success Criteria
- [ ] E2E tests pass for all critical flows
- [ ] No console errors in production
- [ ] Mobile responsive
- [ ] Loading states for all async operations

---

## Technical Details

### Affected Files

| File | Changes |
|------|---------|
| `supabase/migrations/027_fix_professional_id.sql` | New migration |
| `client/src/pages/pro/ProDashboard.tsx` | Add quick actions row |
| `client/src/pages/pro/ProClientView.tsx` | Add quick actions bar, gate sections |
| `server/routes.ts` | Possibly batch permissions endpoint |
| `client/src/components/ProPermissionsCard.tsx` | Reuse for request modals |

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/pro/clients/:clientId/permissions` | Get permissions for single client |
| `POST /api/pro/permission-requests` | Request permissions (existing) |
| `GET /api/pro/dashboard/permissions` | Batch fetch all client permissions (new, optional) |

### Database Changes

Migration 027:
- Updates 2 RPCs
- Fixes RLS policies
- Backfills 2 tables
- No schema changes (column types unchanged)

---

## Future Considerations

### Payments-Based Validation (Planned)
- Validate professional-client relationships against payment status
- Free tier limits on number of clients
- Premium features gated by subscription

### Permission Presets on Dashboard
- Quick-apply role presets from dashboard
- "Make Coach" button that requests all coach permissions

### Bulk Actions
- Select multiple clients, request same permission for all
- Batch assign programs to filtered client list

---

## Appendix

### Permission Reference

**Shared (Read) Permissions:**
| Slug | Description |
|------|-------------|
| `view_nutrition` | View food logs and nutrition data |
| `view_workouts` | View workout sessions and history |
| `view_weight` | View weigh-ins and measurements |
| `view_progress_photos` | View progress photos |
| `view_fasting` | View fasting windows and history |
| `view_checkins` | View check-in responses |
| `view_profile` | View full profile information |

**Exclusive (Write) Permissions:**
| Slug | Description |
|------|-------------|
| `set_nutrition_targets` | Set macro/calorie targets |
| `set_weight_targets` | Set weight goals |
| `assign_programmes` | Assign workout programmes |
| `assign_checkins` | Assign check-in templates |
| `set_fasting_schedule` | Set fasting windows |

### Related Documents
- `docs/FEATURE_BACKLOG.md` - Full feature backlog
- `replit.md` - Project architecture and context
