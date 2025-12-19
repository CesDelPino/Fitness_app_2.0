# Professional Data Consolidation Plan

## Problem Statement

Professional users currently have **two separate forms** for editing their public profile information, which causes data inconsistency:

1. **Pro Profile Setup** (`/pro/profile`) - Writes to `professional_profiles` table
2. **My Storefront** (`/pro/storefront`) - Writes to `trainer_storefronts` table

When a professional updates their headline in one form, it doesn't update in the other. The marketplace reads from `trainer_storefronts`, so data edited in Profile Setup may never appear publicly.

---

## Current State (Post-Phase 2): Consolidated Data

### Tables Storing Professional Data

| Field | `profiles` | `professional_profiles` | `trainer_storefronts` |
|-------|:----------:|:-----------------------:|:---------------------:|
| display_name | ✅ | - | - |
| profile_photo_path | ✅ | ⚠️ (deprecated) | - |
| headline | - | ⚠️ (deprecated) | ✅ **Source of Truth** |
| bio | - | ⚠️ (deprecated) | ✅ **Source of Truth** |
| specialties | - | ⚠️ (deprecated) | ✅ **Source of Truth** |
| experience_years | - | ⚠️ (deprecated) | ✅ **Source of Truth** |
| accepting_new_clients | - | ⚠️ (deprecated) | ✅ **Source of Truth** |
| location_city | - | ⚠️ (deprecated) | ✅ **Source of Truth** |
| location_state | - | ⚠️ (deprecated) | ✅ **Source of Truth** |
| location_country | - | ⚠️ (deprecated) | ✅ **Source of Truth** |
| verification_status | - | ✅ **Active** | - |
| business_name | - | - | ✅ |
| timezone | - | - | ✅ |
| languages | - | - | ✅ |
| credentials | - | - | ✅ |
| social_links | - | - | ✅ |

### Forms and Their Targets (After Phase 2)

**ProProfileSetup.tsx** now collects (identity only):
- Display name → `profiles.display_name`
- Photo → `profiles.profile_photo_path`
- City, State → `trainer_storefronts.location_city/state` (with dual-write to professional_profiles during transition)

**ProStorefront.tsx** collects (all public data):
- Headline → `trainer_storefronts.headline`
- Bio → `trainer_storefronts.bio`
- Specialties → `trainer_storefronts.specialties`
- Experience years → `trainer_storefronts.experience_years`
- Business name → `trainer_storefronts.business_name`
- Timezone → `trainer_storefronts.timezone`
- Languages → `trainer_storefronts.languages`
- Credentials → `trainer_storefronts.credentials`
- Social links → `trainer_storefronts.social_links`

---

## Target State: Consolidated Data Flow

### Source of Truth by Table

| Table | Purpose | Fields |
|-------|---------|--------|
| `profiles` | Core user identity | display_name, profile_photo_path |
| `professional_profiles` | Verification & status | verification_status, (deprecated fields) |
| `trainer_storefronts` | **All public professional data** | headline, bio, specialties, experience_years, accepting_new_clients, business_name, timezone, languages, credentials, social_links, location_city, location_state, location_country |

### Consolidated Form Responsibilities

**ProProfileSetup.tsx (Identity Only):**
```
┌─────────────────────────────────────────────────┐
│  Profile Setup                                  │
├─────────────────────────────────────────────────┤
│  📷 Profile Photo                               │
│  👤 Display Name                                │
│  📍 Location (City, State, Country)             │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ 💡 To edit your public profile,        │    │
│  │    go to "My Storefront"               │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  [Save]                                         │
└─────────────────────────────────────────────────┘
```

**ProStorefront.tsx (All Public Data):**
```
┌─────────────────────────────────────────────────┐
│  My Storefront                                  │
├─────────────────────────────────────────────────┤
│  Profile Tab:                                   │
│  • Business Name                                │
│  • Headline                                     │
│  • Bio                                          │
│  • Specialties                                  │
│  • Experience Years                             │
│  • Credentials                                  │
│  • Accepting New Clients toggle                 │
│  • Timezone                                     │
│  • Languages                                    │
│                                                 │
│  Branding Tab: accent color, hero, etc.         │
│  Content Tab: services, testimonials, etc.      │
└─────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Database Schema Alignment

**Status:** ✅ COMPLETED (December 12, 2024)

**Goal:** Add location fields to `trainer_storefronts` and backfill existing data.

**Completed Steps:**
- [x] Migration `069_storefront_location_fields.sql` created and executed
- [x] Added `location_city`, `location_state`, `location_country` columns to `trainer_storefronts`
- [x] Backfilled existing data from `professional_profiles`
- [x] Updated TypeScript types in `client/src/hooks/useMarketplace.ts` (ProfessionalDetail interface)
- [x] Updated server interface in `server/supabase-storefront-data.ts` (ProfessionalDetail interface)
- [x] Backend `getProfessionalDetail` returns new location fields
- [x] Frontend `ProfessionalDetail.tsx` displays location with timezone difference
- [x] Existing RLS policies verified to cover new columns

**Migration File:** `supabase/migrations/069_storefront_location_fields.sql`
```sql
BEGIN;

ALTER TABLE trainer_storefronts 
ADD COLUMN IF NOT EXISTS location_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS location_state VARCHAR(100),
ADD COLUMN IF NOT EXISTS location_country VARCHAR(100);

UPDATE trainer_storefronts ts
SET 
  location_city = pp.location_city,
  location_state = pp.location_state,
  location_country = pp.location_country
FROM professional_profiles pp
WHERE ts.trainer_id = pp.user_id
  AND ts.location_city IS NULL
  AND pp.location_city IS NOT NULL;

COMMIT;
```

### Phase 2: Form Consolidation

**Status:** ✅ COMPLETED (December 12, 2024)

**Goal:** Remove duplicate field collection from ProProfileSetup; location writes to `trainer_storefronts` only.

**Completed Steps:**
- [x] Removed fields from ProProfileSetup: headline, bio, specialties, experience_years, accepting_new_clients
- [x] Kept fields: display_name, photo, city, state
- [x] Added: Info banner with "My Storefront" button directing users to /pro/storefront for public profile editing
- [x] Updated save logic:
  - Writes location fields to `trainer_storefronts` via PUT /api/pro/storefront
  - Temporary dual-write to `professional_profiles` for Phase 3 transition safety
- [x] Added locationCity, locationState, locationCountry to updateTrainerStorefrontSchema
- [x] Updated storefrontService.ts to handle location field updates
- [x] Added location fields to API whitelist in routes.ts PUT /api/pro/storefront
- [x] React Query cache invalidation includes storefront key

**Edge Cases Handled:**
1. Storefront doesn't exist yet → PUT /api/pro/storefront creates one automatically (upsert behavior)
2. Pro saves location before publishing storefront → Location stored in auto-created storefront
3. Location sourced from storefront query on form load (single source of truth)
4. Auto-generated slugs use sanitized display name + userId prefix, max 50 chars

### Phase 3: Backend & API Updates + Column Cleanup

**Status:** ✅ FULLY COMPLETED (December 12, 2024) - Migration 070 executed

**Goal:** Migrate all server queries to read from trainer_storefronts, then drop redundant columns.

#### Audit Findings (Architect Approved)

**Columns That MUST Stay in professional_profiles:**
| Column | Usage |
|--------|-------|
| id | Primary key, used everywhere |
| user_id | Foreign key for lookups |
| verification_status | Auth/portal/verification checks |
| verification_submitted_at/reviewed_at/notes | Verification system |
| credentials | Certifications (JSON) |
| profile_photo_path | Messaging avatars |
| created_at, updated_at | Timestamps |

**Columns Migrated to trainer_storefronts:**
| Column | Previous Source | New Source |
|--------|-----------------|------------|
| headline | professional_profiles | trainer_storefronts |
| specialties | professional_profiles | trainer_storefronts |
| contact_email | professional_profiles | trainer_storefronts |

**Columns Safe to Drop (No Active Readers):**
- bio, experience_years, accepting_new_clients, pricing_summary
- location_city, location_state, location_country (now in trainer_storefronts)

#### Implementation Steps

**Step 1: Update Server Queries (Code) ✅ COMPLETED**
- [x] supabase-routine-data.ts - Changed `getProfessionalProfile()` to only select verification columns (id, user_id, verification_status)
- [x] supabase-routine-data.ts - Updated `getClientProfessional()` to fetch headline/specialties from trainer_storefronts
- [x] supabase-routine-data.ts - Updated `getClientAssignments()` to fetch headline from trainer_storefronts
- [x] routes.ts - Updated `/api/client/permissions` endpoint to fetch headline from trainer_storefronts
- [x] Fixed middleware bug: Changed `is_suspended` check to `verification_status === 'rejected'`

**Step 2: Verification Testing ✅ COMPLETED**
- [x] App builds and runs without errors
- [x] HMR updates applied successfully
- [x] ProProfileSetup.tsx loads storefront data for location fields

**Step 3: Create Drop Migration ✅ COMPLETED**
- [x] Created migration `070_drop_deprecated_professional_profiles_columns.sql`
- [x] Migration drops: headline, bio, specialties, experience_years, accepting_new_clients, pricing_summary, location_city, location_state, location_country, contact_email, display_name

**Step 4: Cleanup ✅ COMPLETED**
- [x] Removed dual-write from ProProfileSetup.tsx (lines 279-289 removed)
- [x] ProProfileSetup.tsx now writes location only to trainer_storefronts via API
- [x] Added storefront query to source location for form initial values
- [x] Updated useEffect to read location from storefrontData instead of professionalProfile

**Migration File Ready:** `supabase/migrations/070_drop_deprecated_professional_profiles_columns.sql`
- Execute in Supabase Dashboard when ready to finalize consolidation

**Cache Invalidation:**
- Update React Query keys if payload structure changes
- Ensure storefront mutations invalidate marketplace queries

---

## Data Flow After Consolidation

```
Pro edits in Profile Setup:
  display_name, photo → profiles table
  city, state, country → trainer_storefronts table

Pro edits in My Storefront:
  headline, bio, specialties, credentials,
  experience, accepting_clients, timezone,
  languages, business_name → trainer_storefronts table

Marketplace reads:
  All public data ← trainer_storefronts (single source)
  Display name, photo ← profiles (via join)
```

---

## Marketplace Detail Page Redesign

After consolidation, the marketplace professional detail page (`/marketplace/pro/:id`) will display:

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────┐                                                   │
│  │AVATAR│   Display Name                                    │
│  │      │   "Business Name"  ← trainer_storefronts          │
│  └──────┘   "Headline"  ← trainer_storefronts               │
│                                                             │
│             📍 Chicago, IL · 3 hours ahead                  │
│             ⏱ 8+ years  ·  👥 24 active clients             │
│             ⭐ 4.9 (47 reviews)                              │
│             🌐 💼 📸  (social icons)                        │
│                                                             │
│  ┌────────────────────┐                                     │
│  │ 🟢 Accepting Clients│  (if accepting_new_clients=true)   │
│  └────────────────────┘                                     │
│                                                             │
│  [Request to Work Together]  [Message]  (non-connected)     │
│  OR                                                         │
│  [Connected ✓]  [Message]  (connected clients)              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [ About ]  [ Products ]  [ Reviews ]  [ Results ]          │
├─────────────────────────────────────────────────────────────┤
│  About: bio, specialties, credentials                       │
│  Products: trainer_products for purchase                    │
│  Reviews: testimonials only                                 │
│  Results: transformations (before/after)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Files Affected

### Database/Backend
- `shared/supabase-types.ts` - Add location fields to storefront type
- `server/supabase-storefront-data.ts` - Update queries
- Migration file for schema changes

### Frontend Forms
- `client/src/pages/pro/ProProfileSetup.tsx` - Remove duplicate fields, add redirect
- `client/src/pages/pro/ProStorefront.tsx` - No major changes needed

### Marketplace Display
- `client/src/pages/ProfessionalDetail.tsx` - UI redesign with new layout
- `client/src/hooks/useMarketplace.ts` - Update if data shape changes

---

## Success Criteria

1. ✅ Professionals edit public profile info in ONE place (My Storefront) - Phase 2 COMPLETE
2. ✅ Profile Setup only handles identity (name, photo, location) - Phase 2 COMPLETE
3. ✅ Marketplace always shows current, consistent data - reads from trainer_storefronts
4. ⏳ No duplicate fields stored across tables - Phase 3 (cleanup)
5. ✅ Location displays on marketplace detail page - Phase 1 COMPLETE
6. ✅ Active client count displays on marketplace detail page - Phase 1 COMPLETE
7. ✅ Timezone difference displays on marketplace detail page - Phase 1 COMPLETE
8. ✅ "Accepting Clients" badge displays for non-connected pros - Phase 1 COMPLETE
9. ✅ "Request to Work Together" button for non-connected clients - Phase 1 COMPLETE
10. ✅ Reordered tabs: About > Products > Reviews > Results - Phase 1 COMPLETE
11. ✅ Info banner in Profile Setup links to My Storefront - Phase 2 COMPLETE
