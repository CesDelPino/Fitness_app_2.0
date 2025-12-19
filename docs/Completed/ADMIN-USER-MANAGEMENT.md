# Admin User Management Features

**Status:** ✅ Implemented  
**Created:** December 9, 2025  
**Implemented:** December 9, 2025  
**Priority:** High (needed for testing phase)

> **Note:** For test account credentials, see [TEST_ACCOUNTS_LOGIN.md](./TEST_ACCOUNTS_LOGIN.md)

---

## Overview

The admin panel now includes comprehensive user management capabilities for managing users at scale. The "All Users" tab provides:

1. ✅ **Grant Premium Access** - Admin override for testing without Stripe
2. ✅ **Delete Users** - Soft-delete with dependency preview
3. ✅ **User Search/Lookup** - Debounced search with filters and pagination

---

## 1. Premium Override (Implemented)

### Purpose
Allow admins to manually give users premium subscription status for testing purposes without requiring them to go through Stripe checkout.

### Implementation

**Database Column (profiles table):**
```sql
admin_premium_override jsonb DEFAULT NULL
```

**JSONB Structure:**
```json
{
  "active": true,
  "granted_by": "LOBAFIT",
  "granted_at": "2025-12-09T12:00:00Z",
  "expires_at": null,
  "reason": "Testing premium features"
}
```

**API Endpoint:**
- `POST /api/admin/users/:id/premium`
- Request body: `{ "grant": true, "reason": "Testing" }`
- Response: `{ "success": true }`

**Feature Access Integration:**
- `getUserFeatures()` in `server/feature-access.ts` checks `admin_premium_override.active` first
- Override takes precedence over Stripe subscription status
- Cache stores override status and expiry for automatic downgrade when expired
- Cache is invalidated immediately on grant/revoke for instant UI updates

**Admin UI:**
- Toggle button on each user row to grant/revoke premium
- Visual indicator showing "Admin Override" vs "Stripe Premium" vs "Free"

---

## 2. User Delete (Implemented)

### Purpose
Allow admins to remove test users and clean up accounts that are no longer needed.

### Implementation

**Database Columns (profiles table):**
```sql
deleted_at timestamptz DEFAULT NULL
deleted_by text DEFAULT NULL  
deleted_reason text DEFAULT NULL
```

**API Endpoints:**
- `GET /api/admin/users/:id/dependencies` - Preview dependencies before deletion
  ```json
  {
    "userId": "xxx",
    "email": "user@example.com",
    "dependencies": {
      "messages": 12,
      "conversations": 2,
      "purchases": 3,
      "products": 0
    }
  }
  ```
- `DELETE /api/admin/users/:id` - Soft-delete user
  - Request body: `{ "reason": "Test cleanup" }`
  - Response: `{ "success": true }`

**Soft-Delete Approach:**
- Sets `deleted_at`, `deleted_by`, `deleted_reason` on profile
- Users with `deleted_at IS NOT NULL` are excluded from user queries
- Preserves audit trail and analytics data
- Can be extended to hard-delete after retention period

**Admin UI:**
- Delete button on each user row
- Confirmation dialog showing dependency counts
- Reason field for audit trail

---

## 3. User Search/Lookup (Implemented)

### Purpose
Replace the flat list with a scalable search interface.

### Implementation

**API Endpoint:**
- `GET /api/admin/users`
- Query params:
  - `search` - Fuzzy match on email and display name
  - `role` - Filter: `all` | `client` | `professional`
  - `premium` - Filter: `all` | `premium` | `free`
  - `page` - Page number (default: 1)
  - `limit` - Results per page (default: 20)
- Response:
  ```json
  {
    "users": [...],
    "total": 100,
    "page": 1,
    "totalPages": 5
  }
  ```

**Database Indexes (added via migration):**
```sql
CREATE INDEX idx_profiles_deleted_at ON profiles(deleted_at);
CREATE INDEX idx_profiles_admin_override ON profiles((admin_premium_override->>'active'));
```

**Admin UI:**
- Debounced search input (300ms delay)
- Filter dropdowns for role and premium status
- Pagination controls (Previous/Next buttons)
- "Showing X of Y users" indicator
- Loading states during search
- Empty state for no results

---

## Database Migration

Run in Supabase SQL Editor:

```sql
-- File: supabase/migrations/061_admin_user_management.sql

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS admin_premium_override jsonb DEFAULT NULL;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS deleted_by text DEFAULT NULL;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS deleted_reason text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_profiles_admin_override ON profiles((admin_premium_override->>'active'));
```

---

## Security Considerations

- ✅ All endpoints require admin authentication (existing admin auth middleware)
- ✅ Audit logging for admin actions via existing portal_audit_logs
- ✅ Confirmation dialogs for destructive actions
- ✅ Soft-delete preserves data integrity
- ✅ Cache invalidation on premium override changes

---

## Future Enhancements

1. **Hard delete option** - Permanently purge after soft-delete retention period (30 days)
2. **Bulk operations** - Delete multiple test users at once
3. **Export before delete** - Offer data export for user being deleted
4. **Premium expiry picker** - Allow setting expiration date for temporary premium access
5. **RLS policy updates** - Add `deleted_at IS NULL` to profile-based policies

---

## Related Documentation

- [TEST_ACCOUNTS_LOGIN.md](./TEST_ACCOUNTS_LOGIN.md) - Test account credentials
- [PORTAL-ARCHITECTURE.md](./PORTAL-ARCHITECTURE.md) - Portal context system
- [PAYMENT-MARKETPLACE.md](./PAYMENT-MARKETPLACE.md) - Stripe integration details

---

## Technical References

- `server/feature-access.ts` - Premium override logic in `getUserFeatures()`
- `server/routes.ts` - Admin user management endpoints
- `client/src/pages/AdminPage.tsx` - UsersTab component with UI
- `supabase/migrations/061_admin_user_management.sql` - Database migration
