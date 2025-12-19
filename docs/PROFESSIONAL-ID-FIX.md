# Professional ID Standardization Plan

## Problem Statement

There's a fundamental inconsistency in what `professional_id` stores across the database:

- **Migration 027** documents that `professional_client_relationships.professional_id` should be the **auth user ID** (`profiles.id`)
- **Migration 021** (`create_invitation_with_permissions`) stores `professional_profiles.id` instead
- This mismatch causes "Unknown Professional" errors and inconsistent behavior

## Decision

**Standardize on auth user ID (`profiles.id`)** for all `professional_id` columns.

### Rationale

| Factor | Auth User ID ✅ | Professional Profile ID ❌ |
|--------|-----------------|---------------------------|
| Always exists | Yes | No (profile might not exist yet) |
| Supabase auth alignment | Matches `auth.uid()` | Requires extra join |
| Current RLS policies | Already expect this (migration 027) | Would require rewriting |
| Foreign key safety | Can FK to `profiles(id)` | Profile might not exist |

---

## Affected Tables

1. **invitations** - `professional_id` column
2. **professional_client_relationships** - `professional_id` column

---

## Account Closure Scenario

**Question:** What happens to relationships when a professional closes their account?

### Current State
- No explicit handling exists
- If professional's profile is deleted, orphaned relationships would remain

---

### Professional Account Closure Workflow

#### Step 1: Closure Confirmation (UI)

When pro clicks "Close Account", show explicit warning:

> **You are about to close your account**
> 
> This will result in:
> - Forfeiture of any pending payouts ($X.XX)
> - Termination of X active client relationships
> - Loss of access to client data and history
> - Removal of your storefront from the marketplace
> - Refunds issued to clients with active subscriptions
> 
> Your account will enter a 30-day quarantine period. During this time:
> - You cannot access the platform
> - Clients will be notified and offered alternatives
> - You may contact support to restore your account
> 
> After 30 days, closure becomes permanent.
> 
> [Cancel] [I Understand, Close My Account]

#### Step 2: Quarantine Period (30 Days)

| Aspect | During Quarantine |
|--------|-------------------|
| **Pro account status** | `quarantined` (new status) |
| **Relationships** | `suspended` (new status) |
| **Storefront** | Hidden from marketplace |
| **Client data access** | Revoked |
| **Platform login** | Blocked |
| **Pending payouts** | Frozen |

#### Step 3: Client Impact & Remediation

When pro enters quarantine:

1. **Immediate Actions**
   - Notify all connected clients via email/in-app
   - Suspend all active relationships
   - End any in-progress programs/assignments

2. **Refund Handling**
   - Calculate unused portion of active subscriptions
   - Issue prorated refunds to affected clients
   - Deduct from pro's pending payouts if available

3. **Alternative Matching (Optional - Admin Assisted)**
   - Flag affected clients for admin review
   - Suggest alternative professionals based on:
     - Same specialties
     - Similar location/timezone
     - Available capacity
   - Admin can reach out to offer alternatives

#### Step 4: Admin Involvement

**Admin Dashboard - Quarantined Accounts Queue:**

| Pro Name | Quarantine Date | Clients Affected | Refunds Pending | Actions |
|----------|-----------------|------------------|-----------------|---------|
| John Doe | Dec 10, 2024    | 15               | $450            | [View] [Restore] [Force Close] |

**Admin Actions:**
- **View:** See full closure impact (clients, refunds, payouts)
- **Restore:** Reactivate account, restore relationships, cancel refunds
- **Force Close:** Skip quarantine, immediate permanent closure
- **Contact Pro:** Reach out to understand situation
- **Match Clients:** Manually assign alternative pros

#### Step 5: After Quarantine (30+ Days)

If pro doesn't restore within 30 days:

1. **Account Status** → `closed` (permanent)
2. **Relationships** → `terminated` with reason `professional_account_closed`
3. **Pending Payouts** → Forfeited (or refunded to clients)
4. **Profile Data** → Anonymized or archived (GDPR compliance)
5. **Client Data** → Preserved (belongs to clients)

#### Step 6: Restoration (Within 30 Days)

If pro contacts support to restore:

1. **Verify Identity** - Confirm it's the account owner
2. **Restore Account** - Set status back to `active`
3. **Relationship Options:**
   - Auto-restore relationships that were `suspended`
   - OR notify clients: "Your pro is back - reconnect?"
4. **Cancel Pending Refunds** - If not yet processed
5. **Resume Payouts** - Unfreeze pending amounts

---

### New Database Fields Required

**profiles table:**
```sql
account_status ENUM ('active', 'quarantined', 'closed') DEFAULT 'active'
quarantined_at TIMESTAMPTZ
closed_at TIMESTAMPTZ
closure_reason TEXT
```

**professional_client_relationships table:**
```sql
-- Add 'suspended' to status enum
status ENUM ('pending', 'active', 'suspended', 'terminated', 'ended')
suspended_at TIMESTAMPTZ
suspended_reason TEXT
terminated_reason TEXT
```

**New table: account_closure_queue**
```sql
id UUID PRIMARY KEY
professional_id UUID REFERENCES profiles(id)
initiated_at TIMESTAMPTZ
quarantine_ends_at TIMESTAMPTZ
affected_clients INTEGER
pending_refunds DECIMAL
admin_notes TEXT
status ENUM ('quarantined', 'restored', 'closed')
processed_by UUID REFERENCES profiles(id) -- admin who handled
processed_at TIMESTAMPTZ
```

---

### Edge Case: Pro Wants to Come Back After 30 Days

If a pro contacts support after permanent closure:

1. **Cannot auto-restore** - Account is closed, data may be archived
2. **Options:**
   - Create new account (fresh start)
   - Admin-assisted data recovery (case by case)
   - Former clients must re-invite (no auto-reconnect)

---

## Client Account Closure Workflow

Client closures differ from professional closures - they are simpler but have stronger data deletion requirements.

### Key Differences: Pro vs Client Closure

| Aspect | Professional Closure | Client Closure |
|--------|---------------------|----------------|
| **Quarantine Period** | 30 days | 7 days (shorter grace period) |
| **Financial Impact** | Forfeits payouts, issues refunds | Cancels subscriptions, may receive refund |
| **Data Ownership** | Pro loses access to client data | Client's data is DELETED |
| **Relationships** | Suspended → Terminated | Immediately terminated |
| **Notification** | Clients notified, offered alternatives | Pros notified, relationship ends |
| **GDPR/Right to Erasure** | Archive/anonymize | Full deletion required |

---

### Client Closure Workflow

#### Step 1: Closure Confirmation (UI)

When client clicks "Close Account", show explicit warning:

> **You are about to close your account**
> 
> This will result in:
> - Cancellation of X active subscriptions
> - Termination of X professional relationships
> - **Permanent deletion of all your data:**
>   - Workout logs and history
>   - Nutrition logs and food entries
>   - Weight and measurement history
>   - Progress photos
>   - Messages with professionals
>   - Check-in submissions
> 
> You have 7 days to change your mind. After that, deletion is permanent and cannot be undone.
> 
> **Before closing:** [Download My Data]
> 
> [Cancel] [I Understand, Close My Account]

#### Step 2: Grace Period (7 Days)

| Aspect | During Grace Period |
|--------|---------------------|
| **Client account status** | `pending_deletion` |
| **Relationships** | Terminated immediately |
| **Platform login** | Blocked |
| **Data** | Preserved but inaccessible |
| **Subscriptions** | Cancelled, refunds processed |

#### Step 3: Professional Notification

When client enters closure:

1. **Notify all connected professionals**
   - "Your client [Name] has closed their account"
   - Relationship marked as `terminated` with reason `client_account_closed`
   - Pro loses access to client's historical data immediately

2. **Dashboard Update**
   - Client removed from pro's active client list
   - Historical data access revoked

#### Step 4: Financial Handling

1. **Cancel Active Subscriptions**
   - Halt all future billing
   - Cancel Stripe subscriptions

2. **Process Refunds (if applicable)**
   - Calculate unused portion of prepaid services
   - Issue prorated refunds
   - Void any pending invoices

3. **Notify Payment System**
   - Update Stripe customer status
   - Ensure no future charges

#### Step 5: After Grace Period (7+ Days)

If client doesn't restore within 7 days:

1. **Account Status** → `deleted`
2. **Data Deletion (GDPR Compliance):**
   - Delete: workout_sessions, food_entries, weight_logs, measurements
   - Delete: progress_photos (including storage files)
   - Delete: check_in_submissions, fasting_sessions
   - Anonymize: messages (strip personal identifiers, keep for pro's records)
   - Retain: audit logs (for compliance, anonymized)

3. **Profile Handling**
   - Anonymize display_name → "Deleted User"
   - Remove email, phone, personal details
   - Keep anonymized record for FK integrity

#### Step 6: Restoration (Within 7 Days)

If client contacts support to restore:

1. **Verify Identity** - Confirm account ownership
2. **Restore Account** - Set status back to `active`
3. **Relationships** - Already terminated, must re-connect with pros
4. **Data** - Still intact, restore access
5. **Subscriptions** - Must re-subscribe (cancellation was processed)

---

### New Database Fields for Client Closure

**profiles table (additions):**
```sql
-- Extend account_status enum
account_status ENUM ('active', 'quarantined', 'pending_deletion', 'closed', 'deleted')
deletion_requested_at TIMESTAMPTZ
deletion_scheduled_at TIMESTAMPTZ  -- deletion_requested_at + 7 days
deleted_at TIMESTAMPTZ
```

**professional_client_relationships table:**
```sql
-- terminated_reason covers both pro and client closures
terminated_reason ENUM (
  'professional_account_closed',
  'client_account_closed', 
  'ended_by_professional',
  'ended_by_client',
  'admin_terminated'
)
```

---

### Data Export (GDPR Right to Portability)

Before deletion, clients should be able to download their data:

**Export Package Contents:**
- Profile information (JSON)
- Workout history (CSV)
- Nutrition logs (CSV)
- Weight/measurement history (CSV)
- Progress photos (ZIP)
- Messages (JSON, anonymized pro names optional)

---

### Audit Trail

Both pro and client closures should log:

```sql
CREATE TABLE account_closure_audit (
  id UUID PRIMARY KEY,
  user_id UUID,
  user_type ENUM ('professional', 'client'),
  action ENUM ('closure_requested', 'grace_period_started', 'restored', 'permanently_closed', 'data_deleted'),
  performed_at TIMESTAMPTZ,
  performed_by UUID,  -- user themselves or admin
  metadata JSONB  -- affected relationships, refund amounts, etc.
);
```

---

## Fix Plan

### Prerequisites
- Delete existing test accounts/relationships (user preference)
- No data migration needed

### Phase 1: Database Migration (Single Transaction)

Create new migration that:

1. **Fix `create_invitation_with_permissions` RPC**
   - Change: `SELECT id INTO v_professional_id` → `SELECT user_id INTO v_professional_id`
   - This ensures invitations store auth user ID

2. **Fix `fetch_invitation_details` RPC**
   - Update join: `pp.id = i.professional_id` → `pp.user_id = i.professional_id`

3. **Fix `finalize_invitation_permissions` RPC**
   - Update the SELECT to get `pp.user_id` instead of `pp.id`
   - Relationship INSERT already uses `v_invitation.professional_id` (now correct)

4. **Fix `get_client_permission_requests` RPC**
   - Update join: `pp.id = pcr.professional_id` → `pp.user_id = pcr.professional_id`

5. **Fix invitation RLS policies**
   - "Professionals can view their invitation permissions"
   - "Professionals can insert invitation permissions"
   - Both need: `pp.id = i.professional_id` → `pp.user_id = i.professional_id`

6. **Add FK constraint** (optional but recommended)
   ```sql
   ALTER TABLE professional_client_relationships
   ADD CONSTRAINT fk_professional_id_profiles
   FOREIGN KEY (professional_id) REFERENCES profiles(id);
   ```

### Phase 2: Server Code Updates

Review and update any server helpers that might be using wrong ID:
- `server/supabase-relationships.ts`
- `server/supabase-permissions.ts`

### Phase 3: Add Account Closure Handling

1. Add `terminated_reason` column to relationships
2. Create trigger/function for professional account deletion
3. Update client UI to handle terminated relationships gracefully

---

## Testing Checklist

After implementation:

- [ ] Professional creates invitation → uses auth user ID
- [ ] Client accepts invitation → relationship has correct professional_id
- [ ] Professional can view their clients
- [ ] Client can view their professional (no "Unknown Professional")
- [ ] Permissions work correctly
- [ ] Professional account deletion terminates relationships cleanly
- [ ] Client sees appropriate message for terminated relationship

---

## Files to Modify

### Database (new migration)
- `supabase/migrations/071_fix_professional_id_standardization.sql`

### Server (if needed)
- `server/supabase-relationships.ts`
- `server/supabase-permissions.ts`

---

## Timeline

- Phase 1: ✅ COMPLETE (Migration 071)
- Phase 2: ~30 minutes (server code review)
- Phase 3: ~1 hour (account closure handling)
- Testing: ~1 hour

**Total: ~4-5 hours**

---

## Implementation Status

### Phase 1 Complete ✅ (December 2024)

**Migration 071 deployed** - Fixed all RPC functions and RLS policies:

| Component | Status | Change |
|-----------|--------|--------|
| `create_invitation_with_permissions` | ✅ Fixed | Stores user_id instead of pp.id |
| `fetch_invitation_details` | ✅ Fixed | Join on pp.user_id = i.professional_id |
| `finalize_invitation_permissions` | ✅ Fixed | Join on pp.user_id, gets user_id |
| `get_client_permission_requests` | ✅ Fixed | Join on pp.user_id = pcr.professional_id |
| `create_permission_request` | ✅ Fixed | Join on pp.user_id = pcr.professional_id |
| invitation_permissions RLS (2 policies) | ✅ Fixed | Join on pp.user_id |
| permission_requests RLS (1 policy) | ✅ Fixed | Join on pp.user_id |
| invitations RLS (2 policies) | ✅ Fixed | Join on pp.user_id |

**Note:** Existing test data must be deleted before creating new relationships.
