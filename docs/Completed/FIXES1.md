# Performance Fixes Plan (December 2024)

## Overview
This document outlines the prioritized plan to address recurring performance issues identified before alpha testing.

## Issues Identified

| Issue | Root Cause | Impact |
|-------|------------|--------|
| Sent to login randomly | 5-second session timeout | Users lose their place |
| Analytics slow to load | N+1 query pattern (100+ API calls) | Long wait times |
| Sign out not responding | No timeout on signOut call | UI appears frozen |
| General sluggishness | AdminPage.tsx too large (344KB) | Slow initial bundle load |

---

## Phase 1: Fix Analytics Page Slow Loading
**Priority:** High  
**Impact:** Immediate, significant speed improvement  
**Risk:** Low  
**Complexity:** Moderate

### Problem
The Analytics page makes 100+ separate data requests:
- Fetches up to 100 workout sessions
- Then makes an individual API call for each session's details
- This "N+1 query pattern" causes 10-30+ second load times

### Solution
- Create a single database query (Supabase RPC or view) that returns workout sessions WITH their set data in one call
- Update the client-side fetch to use this consolidated query
- Add proper TypeScript typing for the response

### Success Criteria
- Analytics page loads in 1-2 seconds instead of 10-30+ seconds
- Single network request for workout data instead of 100+

### Files Affected
- `client/src/pages/Analytics.tsx`
- `client/src/lib/supabase-data.ts` (or similar data fetching utilities)
- Supabase: new RPC function or database view

---

## Phase 2: Fix Random Logouts
**Priority:** High  
**Impact:** Major stability improvement  
**Risk:** Moderate  
**Complexity:** Moderate

### Problem
The SupabaseAuthContext has a 5-second timeout for session fetching. If Supabase is slow to respond (network issues, cold starts), it:
- Clears all stored authentication data
- Signs the user out
- Redirects to login page

### Solution
- Increase session fetch timeout to be more forgiving (e.g., 15-20 seconds)
- Add exponential backoff retry logic before giving up
- Only force logout on explicit authentication errors, not transient delays
- Add telemetry/logging around timeout events

### Success Criteria
- Users not randomly kicked to login page
- Only genuine auth failures trigger logout

### Files Affected
- `client/src/contexts/SupabaseAuthContext.tsx`

---

## Phase 3: Fix Sign Out Freezing
**Priority:** Medium  
**Impact:** Better user experience  
**Risk:** Low  
**Complexity:** Low

### Problem
The sign out function calls `supabase.auth.signOut()` without any timeout protection. If Supabase is slow, the UI hangs indefinitely with no feedback.

### Solution
- Wrap signOut in a race with a rejection timer (~12 seconds to match Phase 2 Supabase latency expectations)
- Implement optimistic UI state change (clear local state immediately for instant feedback)
- Add `isSigningOut` state flag to context for UI loading indicators
- Show loading indicator on sign-out button while signing out
- Display toast message if timeout/error occurs (user still logged out locally)

### Success Criteria
- Sign out clears local state immediately (instant UI feedback)
- Supabase call has 12-second timeout with graceful handling
- User sees loading indicator during sign out process
- Toast notification if timeout/error occurs

### Files Affected
- `client/src/contexts/SupabaseAuthContext.tsx`
- Components that call signOut (ClientHeader, Settings, etc.)

---

## Phase 4: Split Admin Page
**Priority:** Medium-High (revised after Phase 5 completion)  
**Impact:** Admin load time improvement, major maintainability gains  
**Risk:** Mitigated via parallel development approach  
**Complexity:** High

### Context Update (Post-Phase 5)
Phase 5 lazy loading resolved the **initial bundle size** problem - the login screen now loads fast because pages are loaded on-demand. However, Phase 4 remains important for two reasons:

1. **Admin-specific load time**: AdminPage still ships as a single ~340KB chunk. When an admin opens the panel, they download all 8,000+ lines at once, even if they only need one tab.

2. **Maintainability debt**: The 8,000-line monolith is the largest technical debt in the codebase. Adding features, fixing bugs, or onboarding new developers is significantly harder with this file size.

### Problem
AdminPage.tsx is 344KB / 8,413 lines - a massive monolith with 17 tabs that:
- Loads entirely when admin panel is opened (admin-first-paint is slow)
- Causes React re-render churn
- Triggers Babel deoptimization warnings
- Mixes authentication, product moderation, subscription analytics, routines, etc.
- Makes maintenance difficult (8,400 lines to scroll through)

**Note:** Initial bundle size is no longer a concern (addressed by Phase 5 lazy loading).

### Solution: Feature-Flagged Parallel Development

**Strategy:** Build new `/admin-v2/*` routes alongside the existing `/admin` page. Old admin stays untouched until new system is validated. This eliminates risk of breaking production admin access.

#### Target Architecture: Hybrid Route + Logical Grouping

Split into 4 lazily loaded route-level pages, each containing related tabs:

| Route | Tabs | Purpose | Est. Lines |
|-------|------|---------|------------|
| `/admin-v2/business` | Stats, Subscriptions, Marketplace, Products | Revenue & commerce | ~1,500-2,000 |
| `/admin-v2/users` | Users, Avatars, Verification, Connections, Audit | User lifecycle & actions | ~2,500-3,000 |
| `/admin-v2/catalog` | Equipment, Goals, Exercises, Routines, Presets, Foods | Workout & nutrition data | ~2,500-3,000 |
| `/admin-v2/system` | Policy, Features | Platform configuration | ~500-800 |

#### Key Design Decisions
- **Foods → Catalog**: Same CRUD patterns as equipment/exercises, shared helpers
- **Audit → Users**: Logs primarily consulted when investigating user issues, shares filter patterns
- **Verification & Connections → Users**: Both manage human accounts/relationships; splitting would create cross-route data dependencies
- **Avatars → Users**: Profile-level assets tied to user accounts
- **System stays lean**: Just Policy and Features (platform config)

---

### Implementation Plan

#### Stage 1: Scaffolding
1. Add feature flag mechanism:
   - Environment variable `VITE_ADMIN_V2_ENABLED` (default: false)
   - Admin allowlist for early access testing
2. Create shared admin layout shell:
   - `client/src/components/admin-v2/AdminLayout.tsx` (sidebar nav, header)
   - Sidebar with links to all 4 sections
3. Create empty route files:
   - `client/src/pages/admin-v2/AdminBusinessPage.tsx`
   - `client/src/pages/admin-v2/AdminUsersPage.tsx`
   - `client/src/pages/admin-v2/AdminCatalogPage.tsx`
   - `client/src/pages/admin-v2/AdminSystemPage.tsx`
4. Register routes in `App.tsx` with `React.lazy()` behind feature flag

#### Stage 2: Migrate Tab Groups (One at a Time)
Order by **highest churn first** - tackle the tabs that change most often to realize maintainability gains early:

**Step 2a: Business (4 tabs) - HIGH PRIORITY**
- Extract: Stats, Subscriptions, Marketplace, Products
- These tabs see frequent updates (product approval, marketplace features)
- Test with trusted admin
- Validate feature parity

**Step 2b: Users (5 tabs) - HIGH PRIORITY**
- Extract: Users, Avatars, Verification, Connections, Audit
- User management is frequently accessed and modified
- Test with trusted admin
- Validate feature parity

**Step 2c: Catalog (6 tabs) - MEDIUM PRIORITY**
- Extract: Equipment, Goals, Exercises, Routines, Presets, Foods
- Identify shared CRUD patterns → extract to `client/src/components/admin-v2/shared/`
- These tabs share similar list/edit/delete patterns - extract shared primitives
- Test with trusted admin
- Validate feature parity

**Step 2d: System (smallest - 2 tabs) - LOWER PRIORITY**
- Extract: Policy, Features
- Platform config rarely changes
- Test with trusted admin
- Validate feature parity

#### Stage 3: Validation & Rollout
1. Enable feature flag for 1-2 trusted admins
2. Run parallel testing (old vs new) for 1-2 weeks
3. Create regression checklist:
   - [ ] All CRUD operations work per tab
   - [ ] Search/filter functionality preserved
   - [ ] Pagination works correctly
   - [ ] Modal dialogs function properly
   - [ ] Toast notifications display
   - [ ] Error handling works
4. Gather feedback, fix issues

#### Stage 4: Cutover
1. Change default route from `/admin` to `/admin-v2`
2. Add redirect from `/admin` → `/admin-v2/business` (default landing)
3. Add redirects for old tab hashes to new URLs
4. Monitor for issues (keep old code available for emergency rollback)

#### Stage 5: Cleanup
1. After 2-4 weeks of stable operation, delete old AdminPage.tsx
2. Rename `/admin-v2/*` routes to `/admin/*`
3. Remove feature flag code
4. Update any remaining references

---

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking production admin | Old admin untouched until cutover |
| Data inconsistencies | Both versions use same Supabase queries |
| Missed functionality | Tab-by-tab parity checklist |
| Rushed rollout | Feature flag allows controlled access |
| Emergency issues | Instant rollback by disabling flag |

---

### Integration with Phase 5 Lazy Loading
The new `/admin-v2/*` routes integrate seamlessly with the existing lazy loading infrastructure:
- Each admin section becomes its own lazy-loaded chunk (using `React.lazy()`)
- Routes plug into the existing admin Suspense boundary in `App.tsx`
- Shared hooks/utilities should remain in non-lazy modules to avoid duplication across chunks
- Rollback remains trivial - just disable the feature flag

### Success Criteria
- [ ] Admin-first-paint improved (only 1 of 4 sections loads per visit)
- [ ] Each admin section loads independently via code splitting
- [ ] No Babel deoptimization warnings
- [ ] Each file under 3,000 lines (maintainability goal)
- [ ] 100% feature parity with old admin
- [ ] Zero downtime during migration
- [ ] Old bookmarks redirect properly
- [ ] Shared CRUD primitives extracted and reusable

---

### Files Affected

**New Files:**
- `client/src/pages/admin-v2/AdminBusinessPage.tsx`
- `client/src/pages/admin-v2/AdminUsersPage.tsx`
- `client/src/pages/admin-v2/AdminCatalogPage.tsx`
- `client/src/pages/admin-v2/AdminSystemPage.tsx`
- `client/src/components/admin-v2/AdminLayout.tsx`
- `client/src/components/admin-v2/AdminSidebar.tsx`
- `client/src/components/admin-v2/shared/` (shared types, hooks, utilities)

**Modified Files:**
- `client/src/App.tsx` (new lazy routes behind feature flag)

**Unchanged Until Cutover:**
- `client/src/pages/AdminPage.tsx` (old admin stays as-is)

**Deleted After Successful Rollout:**
- `client/src/pages/AdminPage.tsx` (old monolith)

---

## Implementation Order

1. **Phase 1: Analytics query fix** ✅ - Biggest user-facing improvement, lowest risk
2. **Phase 2: Session timeout fix** ✅ - Stops frustrating random logouts
3. **Phase 3: Sign out protection** ✅ - Quick win, builds on auth improvements
4. **Phase 5: Lazy load pages** ✅ - Fast login screen, low risk (see `docs/FIXES2.md`)
5. **Phase 4: Admin page split** - Maintainability focus, do before adding more admin features

**Note:** Phase 5 was completed before Phase 4. With lazy loading in place, Phase 4's goal shifts from "reduce initial bundle" to "improve admin maintainability and admin-specific load time."

---

## Status Tracking

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| 1 | Complete | Dec 9, 2024 | Dec 9, 2024 | Single query replaces 100+ API calls. Tested OK. |
| 2 | Complete | Dec 9, 2024 | Dec 9, 2024 | fetchSessionWithRetry (3 attempts, 15s timeout, backoff), smart logout (only on auth errors), 5s recovery window for onAuthStateChange |
| 3 | Complete | Dec 9, 2024 | Dec 9, 2024 | Optimistic clear, 12s timeout, isSigningOut flag, loading UI, toast on timeout |
| 4 | Not Started | - | - | Admin page split - **revised goals**: maintainability + admin load time (bundle size addressed by Phase 5) |
| 5 | Complete | Dec 9, 2024 | Dec 9, 2024 | Lazy load pages - see `docs/FIXES2.md` for details |

---

## Completed Work Summary

### Phase 1: Analytics N+1 Query Fix (Dec 9, 2024)
**Problem:** Analytics page made 100+ separate API calls (one per workout session), causing 10-30 second load times.

**Solution:** Used Supabase nested select pattern `.select('*, workout_sets(*)')` to fetch all workout sessions with their sets in a single query.

**Key Changes:**
- `client/src/lib/supabase-data.ts`: New `fetchWorkoutSessionsWithSets()` function using nested select
- `client/src/pages/Analytics.tsx`: Updated to use single-query approach with proper mappers
- Added `mapWorkoutSessionRow()` and `mapWorkoutSetRow()` for snake_case to camelCase conversion

**Result:** Analytics loads in 1-2 seconds instead of 10-30+ seconds.

---

### Phase 2: Random Logout Fix (Dec 9, 2024)
**Problem:** 5-second session timeout caused random logouts when Supabase had cold starts (5-10 seconds).

**Solution:** Implemented `fetchSessionWithRetry()` with exponential backoff and smart logout logic.

**Key Changes:**
- `client/src/contexts/SupabaseAuthContext.tsx`:
  - 3 retry attempts with 15-second per-attempt timeout
  - Exponential backoff delays: 0s, 2s, 4s between attempts
  - Only forces logout on explicit auth errors (401, 403, invalid_grant, etc.)
  - 5-second recovery window for `onAuthStateChange` to restore session
  - Keeps loading state during retries instead of prematurely logging out

**Result:** Users stay logged in through Supabase cold starts and transient network issues.

---

### Phase 3: Sign Out Freezing Fix (Dec 9, 2024)
**Problem:** Sign out had no timeout protection - if Supabase was slow, UI hung indefinitely.

**Solution:** Implemented optimistic state clearing with 12-second timeout and loading UI.

**Key Changes:**
- `client/src/contexts/SupabaseAuthContext.tsx`:
  - Added `isSigningOut` state flag exposed via context
  - Optimistically clears local state immediately (session, user, profile, professionalProfile)
  - Races `supabase.auth.signOut()` against 12-second timeout
  - Shows toast notification if timeout/error occurs
- `client/src/components/ClientHeader.tsx`:
  - Sign out button shows loading spinner during process
  - Button disabled while signing out
  - Text changes to "Signing out..." during process

**Result:** Sign out feels instant (local state cleared immediately), with graceful handling of slow server responses.

---

### Phase 5: Lazy Load Pages (Dec 9, 2024)
**Problem:** All 30+ pages were eagerly imported, causing ~500KB+ to be parsed before login screen appeared.

**Solution:** Implemented React.lazy() code splitting with Suspense boundaries per portal.

**Key Changes:**
- `client/src/components/PageLoader.tsx`: New full-screen loading spinner component
- `client/src/App.tsx`:
  - Converted 27 pages to React.lazy() imports
  - Kept LoginPage, ResetPassword, NotFound, ProLoginPage as eager imports
  - Added Suspense boundaries around Router (client), ProRouter (pro), AdminPage, ProAcceptInvite, and ProProfileSetup

**Result:** Login screen appears faster, pages load on-demand. See `docs/FIXES2.md` for detailed implementation notes.
