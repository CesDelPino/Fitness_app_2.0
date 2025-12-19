# LOBA SaaS - Supabase Migration Plan

## Overview

Migrate LOBA from single-tenant MVP (Neon + Drizzle) to multi-tenant SaaS platform (Supabase) using a **full migration approach**.

**Status:** Professional portal built on Supabase. Ready for full migration.

---

## Strategy: Full Migration (Updated)

> **Previous approach:** Parallel build with two separate auth systems
> **New approach:** Complete migration to Supabase as the single platform

| Before (Neon + Drizzle) | After (Supabase) |
|-------------------------|------------------|
| Express sessions for auth | Supabase Auth for everyone |
| Drizzle ORM queries | Supabase client with RLS |
| Two separate user tables | Single `profiles` table |
| Manual API authorization | Row-Level Security policies |

**Why full migration?**
- Two auth systems create identity fragmentation
- Invitation flow breaks when client needs both accounts
- Simpler long-term architecture
- RLS provides automatic multi-tenant security

**What stays the same:**
- React + Vite + Tailwind + shadcn/ui frontend
- Express server for AI endpoints (OpenAI calls)
- Same UI/UX patterns

---

## Prototype Scope

**Goal:** One professional can invite and manage 5 clients with real data isolation.

**Core Features:**
1. User roles (client vs professional)
2. Professional-client relationships (many-to-many supported)
3. Role-based data access (nutritionist sees food, trainer sees workouts)
4. Professional dashboard (view all clients)
5. Client invitation flow (professional shares link manually)
6. Client detail view (professional views client's data)
7. Professional logging on behalf of clients

**Not in Prototype:**
- Stripe Connect payments (manual billing for now)
- Marketplace search/discovery
- Reviews and ratings
- Booking/scheduling
- Check-in forms
- Notes system

---

## Professional Types (Prototype)

Three types with distinct permission sets:

| Type | Sees Food | Sees Workouts | Sees Weight/Body | Can Log For Client |
|------|-----------|---------------|------------------|-------------------|
| **Nutritionist** | Yes | No | Yes | Food only |
| **Trainer** | No | Yes | Yes | Workouts only |
| **Coach** (holistic) | Yes | Yes | Yes | Both |

- "Coach" is catch-all for professionals who need full visibility
- Stored as `role_type` string on relationship - extensible later
- Permission logic lives in RLS policies via shared SQL helper functions
- **A client CAN work with multiple professionals of same type** (two trainers allowed)

---

## Resolved Design Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Admin table? | Merge into Supabase role metadata | Single identity source, simpler |
| Access revocation? | Immediate when relationship ends | Simpler, safer for client privacy |
| Multiple same-type pros? | Yes, allow it | Don't restrict client choice |
| Auth system? | Single Supabase Auth for all users | Eliminates dual-identity problem |
| Auth provider approach? | Enhance SupabaseAuthContext with legacy fields | Single provider, adapter pattern if needed |

---

## What's Already Built (Professional Portal)

### Completed
- [x] Supabase project created and configured
- [x] Supabase client library installed
- [x] Core SaaS tables created (profiles, professional_profiles, invitations, relationships)
- [x] RLS policies for professional/client access
- [x] SupabaseAuthContext for React
- [x] Professional signup flow with `promote_to_professional` RPC
- [x] Professional login page (/pro/login)
- [x] Professional profile setup
- [x] Professional dashboard with client list
- [x] Invitation creation with shareable links
- [x] Client data viewer (role-based)
- [x] Access control (isProfessionalCandidate, isProfessional)

### Key RPC Functions Created
- `promote_to_professional` - Promotes new signup to professional role
- `create_invitation` - Creates invitation with hashed token
- `accept_invitation` - Validates token and creates relationship

---

## Database Schema

### Tables Already in Supabase
- `profiles` - User profiles with role field
- `professional_profiles` - Professional-specific data
- `invitations` - Pending client invitations
- `professional_client_relationships` - Active professional-client links

### Tables to Create in Supabase (Health Tracking Data)

**food_logs**
```sql
- id (UUID, primary key)
- user_id (UUID, references profiles)
- logged_by_user_id (UUID, references profiles, nullable)
- food_name (text)
- quantity_value (numeric)
- quantity_unit (text)
- calories (integer)
- protein_g (numeric)
- carbs_g (numeric)
- fat_g (numeric)
- fiber_g (numeric)
- sugar_g (numeric)
- calories_per_unit (numeric)
- protein_per_unit (numeric)
- carbs_per_unit (numeric)
- fat_per_unit (numeric)
- micronutrients_dump (jsonb)
- meal_type (text)
- breaks_fast (boolean)
- barcode (text)
- logged_at (timestamptz)
- created_at (timestamptz)
```

**workout_sessions**
```sql
- id (UUID, primary key)
- user_id (UUID, references profiles)
- logged_by_user_id (UUID, references profiles, nullable)
- date (date)
- routine_id (UUID, references workout_routines, nullable)
- routine_name (text)
- workout_type (text)
- duration_minutes (integer)
- notes (text)
- activity_name (text)
- intensity (integer)
- calories_burned (integer)
- created_at (timestamptz)
```

**workout_sets** (child of workout_sessions)
```sql
- id (UUID, primary key)
- session_id (UUID, references workout_sessions)
- exercise_name (text)
- set_number (integer)
- reps (integer)
- weight (numeric)
- notes (text)
```

**workout_routines**
```sql
- id (UUID, primary key)
- user_id (UUID, references profiles)
- name (text)
- type (text)
- archived (boolean, default false)
- last_used_at (timestamptz)
- created_at (timestamptz)
```

**routine_exercises** (child of workout_routines)
```sql
- id (UUID, primary key)
- routine_id (UUID, references workout_routines)
- exercise_name (text)
- order_index (integer)
- target_sets (integer)
- target_reps (integer)
```

**weigh_ins**
```sql
- id (UUID, primary key)
- user_id (UUID, references profiles)
- date (date)
- weight_kg (numeric)
- notes (text)
- waist_cm (numeric)
- hips_cm (numeric)
- bust_chest_cm (numeric)
- thigh_cm (numeric)
- arm_cm (numeric)
- calf_cm (numeric)
- neck_cm (numeric)
- created_at (timestamptz)
```

**fasts** (fasting_windows)
```sql
- id (UUID, primary key)
- user_id (UUID, references profiles)
- start_time (timestamptz)
- end_time (timestamptz)
- actual_end_time (timestamptz, nullable)
- status ('active' | 'ended')
- breaking_food_log_id (UUID, references food_logs, nullable)
- planned_duration_minutes (integer)
- fast_mode ('duration' | 'target_time')
```

**daily_summaries**
```sql
- id (UUID, primary key)
- user_id (UUID, references profiles)
- date (date)
- finalized (boolean)
- finalized_at (timestamptz)
- total_calories (integer)
- total_protein_g (numeric)
- total_carbs_g (numeric)
- total_fat_g (numeric)
- UNIQUE(user_id, date)
```

**foods** (cached food database)
```sql
- id (UUID, primary key)
- canonical_name (text)
- brand (text, nullable)
- source ('barcode' | 'ai_text' | 'ai_image' | 'manual' | 'imported')
- verification_status ('verified' | 'user_contributed' | 'pending')
- calories_per_100g (numeric)
- protein_per_100g (numeric)
- carbs_per_100g (numeric)
- fat_per_100g (numeric)
- fiber_per_100g (numeric)
- sugar_per_100g (numeric)
- default_serving_size (text)
- default_serving_grams (numeric)
- calories_per_serving (numeric)
- protein_per_serving (numeric)
- carbs_per_serving (numeric)
- fat_per_serving (numeric)
- times_used (integer, default 0)
- created_at (timestamptz)
- updated_at (timestamptz)
```

**food_barcodes**
```sql
- id (UUID, primary key)
- food_id (UUID, references foods)
- barcode (text, unique)
- created_at (timestamptz)
```

**food_aliases**
```sql
- id (UUID, primary key)
- food_id (UUID, references foods)
- alias_text (text)
- normalized_text (text)
- created_at (timestamptz)
```

**cardio_activities** (system-level)
```sql
- id (UUID, primary key)
- name (text, unique)
- base_met (numeric)
- category (text)
```

**user_custom_activities**
```sql
- id (UUID, primary key)
- user_id (UUID, references profiles)
- activity_name (text)
- estimated_met (numeric)
- created_at (timestamptz)
- UNIQUE(user_id, activity_name)
```

---

## Row-Level Security (RLS) Policies

### Already Implemented
- profiles (own data access)
- professional_profiles (owner write, public read)
- invitations (professional create/read)
- professional_client_relationships (professional/client access)

### RLS Policy Matrix for Health Data

| Table | Owner Access | Professional Read | Professional Write |
|-------|--------------|-------------------|-------------------|
| food_logs | Full CRUD | nutritionist, coach | nutritionist, coach |
| workout_sessions | Full CRUD | trainer, coach | trainer, coach |
| workout_sets | Full CRUD | trainer, coach | trainer, coach |
| workout_routines | Full CRUD | trainer, coach | No |
| routine_exercises | Full CRUD | trainer, coach | No |
| weigh_ins | Full CRUD | nutritionist, trainer, coach | No |
| fasts | Full CRUD | No | No |
| daily_summaries | Full CRUD | nutritionist, coach | No |
| foods | Read | Read | Insert only |
| food_barcodes | Read | Read | Insert only |
| food_aliases | Read | Read | Insert only |
| cardio_activities | Read | Read | No |
| user_custom_activities | Full CRUD | No | No |

### Shared Helper Function
```sql
CREATE OR REPLACE FUNCTION has_active_relationship(
  p_professional_id UUID,
  p_client_id UUID,
  p_allowed_roles text[]
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM professional_client_relationships
    WHERE professional_id = p_professional_id
    AND client_id = p_client_id
    AND status = 'active'
    AND role_type = ANY(p_allowed_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Authentication Migration

### Current State
- `/pro/*` routes use `SupabaseAuthContext` (Supabase Auth)
- `/` routes use `AuthContext` (Express sessions + Neon)

### Target State
- All routes use `SupabaseAuthContext` (Supabase Auth)
- Remove `AuthContext` and Express session auth
- Keep Express server only for AI endpoints

### Auth Provider Strategy (Architect Recommendation)

**Option A: Enhance SupabaseAuthContext (Recommended)**
- Add all legacy user fields to `profiles` table
- Extend SupabaseAuthContext to expose those fields
- Dashboard code can access user settings via `profile` object

**Option B: Adapter Pattern**
- Create thin wrapper around SupabaseAuthContext
- Expose `user` object that matches legacy `User` type
- Minimal changes to dashboard components

**Decision:** Option A - extend SupabaseAuthContext and profiles table

### Profile Fields to Add
Map Neon `users` fields to Supabase `profiles`:
- username → display_name (already exists)
- password_hash → handled by Supabase Auth
- height_cm → add to profiles
- current_weight_kg → add to profiles
- birthdate → add to profiles
- gender → add to profiles
- activity_multiplier → add to profiles
- daily_calorie_target → add to profiles
- preferred_unit_system → add to profiles
- macro_input_type → add to profiles
- protein_target_g, carbs_target_g, fat_target_g → add to profiles
- manual_calorie_target → add to profiles
- show_bmi_tape → add to profiles

---

## Frontend Migration

### Pages Using Neon (Need Migration)
- Dashboard (`/`) - food logs, workouts, weight
- Food logging pages - AI analysis, barcode scan, manual entry
- Workout pages - routines, active workout, history
- Weigh-in page
- Fasting page
- Analytics page
- Settings page

### API Calls to Replace
| Current (Express/Drizzle) | Target (Supabase) |
|---------------------------|-------------------|
| `GET /api/food-logs` | `supabase.from('food_logs').select()` |
| `POST /api/food-logs` | `supabase.from('food_logs').insert()` |
| `GET /api/workout-sessions` | `supabase.from('workout_sessions').select()` |
| `GET /api/weigh-ins` | `supabase.from('weigh_ins').select()` |
| `GET /api/fasts/active` | `supabase.from('fasts').select()` |
| etc. | RLS handles authorization |

### React Query Key Updates
When migrating, update query keys to reflect new data source:
- `['/api/food-logs']` → `['food_logs', userId]`
- `['/api/workouts']` → `['workout_sessions', userId]`
- Ensure cache invalidation uses new keys

### What Stays on Express
- `POST /api/analyze-food` - OpenAI integration (needs server-side API key)
- `POST /api/analyze-food-image` - OpenAI vision (needs server-side API key)

---

## Backend Changes

### Express Endpoints to Keep
- `/api/analyze-food` - AI text analysis
- `/api/analyze-food-image` - AI image analysis
- These need Supabase JWT validation instead of session auth

### Express Endpoints to Remove (After Phase 3)
- All CRUD endpoints (`/api/food-logs`, `/api/workouts`, etc.)
- Auth endpoints (`/api/login`, `/api/register`, `/api/logout`, `/api/auth/me`)
- User settings endpoints

### Supabase JWT Validation Middleware
```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function validateSupabaseJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.user = user;
  next();
}
```

---

## Migration Phases (Revised with Architect Recommendations)

### Phase 1: Health Data Tables + JWT Bridge
**Goal:** Create all tables in Supabase, add JWT middleware so Express works with Supabase tokens

- [ ] **1a. Add missing user fields to `profiles` table**
  - height_cm, current_weight_kg, birthdate, gender
  - activity_multiplier, daily_calorie_target
  - preferred_unit_system, macro_input_type
  - protein_target_g, carbs_target_g, fat_target_g
  - manual_calorie_target, show_bmi_tape

- [ ] **1b. Create all health data tables**
  - food_logs (with logged_by_user_id for professional logging)
  - workout_sessions
  - workout_sets
  - workout_routines
  - routine_exercises
  - weigh_ins
  - fasts
  - daily_summaries
  - foods, food_barcodes, food_aliases
  - cardio_activities, user_custom_activities

- [ ] **1c. Write RLS policies for all tables**
  - Use policy matrix above
  - Test each policy with different user roles

- [ ] **1d. Regenerate Supabase TypeScript types**
  - Run Supabase CLI to generate types
  - Update `shared/supabase-types.ts`

- [ ] **1e. Add JWT validation middleware to Express**
  - Create `validateSupabaseJWT` middleware
  - Apply to AI endpoints (`/api/analyze-food`, `/api/analyze-food-image`)
  - Keep session auth working in parallel (don't remove yet)

### Phase 2: Client App Auth Migration
**Goal:** Switch main app from Express sessions to Supabase Auth

- [ ] **2a. Enhance SupabaseAuthContext**
  - Add all user settings fields from profile
  - Ensure isProfessional/isProfessionalCandidate work for clients too
  - Add `updateProfile` method for settings changes

- [ ] **2b. Create unified login/signup page**
  - Replace `/login` with Supabase Auth version
  - Support both client and professional signup flows
  - Handle invitation tokens in signup flow

- [ ] **2c. Update App.tsx routing**
  - Wrap entire app with SupabaseAuthProvider
  - Remove AuthProvider
  - Update protected route checks

- [ ] **2d. Update all components using `useAuth()`**
  - Find all imports of `useAuth` from AuthContext
  - Replace with `useSupabaseAuth()`
  - Update field access (e.g., `user.username` → `profile.display_name`)

- [ ] **2e. Verify invitation acceptance works end-to-end**
  - Client clicks invite link
  - Signs up with Supabase Auth
  - Relationship created correctly
  - Can access main app

### Phase 3: Data Layer Migration
**Goal:** Switch all data fetching from Express/Neon to Supabase

- [ ] **3a. Create Supabase data hooks**
  - `useFoodLogs()` - replaces Express fetch
  - `useWorkoutSessions()` - replaces Express fetch
  - `useWeighIns()` - replaces Express fetch
  - `useFasts()` - replaces Express fetch
  - etc.

- [ ] **3b. Update Dashboard page**
  - Switch to Supabase data hooks
  - Update query keys for cache invalidation
  - Test data displays correctly

- [ ] **3c. Update Food logging pages**
  - Food log list
  - AI analysis (keep Express endpoint, update auth header)
  - Barcode scan
  - Manual entry
  - Food database search

- [ ] **3d. Update Workout pages**
  - Routines list
  - Active workout
  - Workout history
  - Cardio logging

- [ ] **3e. Update other pages**
  - Weigh-in page
  - Fasting page
  - Analytics page
  - Settings page (read/write to profiles)

- [ ] **3f. Test all CRUD operations**
  - Create, read, update, delete for each data type
  - Verify RLS policies work as expected

### Phase 4: Express Cleanup
**Goal:** Remove legacy code, finalize AI endpoint security

- [ ] **4a. Verify JWT validation works on AI endpoints**
  - Test `/api/analyze-food` with Supabase token
  - Test `/api/analyze-food-image` with Supabase token
  - Add rate limiting if needed

- [ ] **4b. Remove legacy Express endpoints**
  - Delete all CRUD endpoints from routes.ts
  - Delete auth endpoints
  - Delete user settings endpoints

- [ ] **4c. Remove legacy middleware**
  - Remove session middleware configuration
  - Remove Express session store
  - Remove passport if used

- [ ] **4d. Remove Neon/Drizzle dependencies**
  - Remove database connection code
  - Keep Drizzle types for reference (optional)
  - Remove Neon environment variables from production

- [ ] **4e. Clean up unused code**
  - Delete AuthContext.tsx
  - Delete legacy login/register pages
  - Remove unused imports

### Phase 5: Testing & Launch
**Goal:** End-to-end validation and public deployment

- [ ] **5a. Professional flow testing**
  - Sign up as professional
  - Complete profile setup
  - Create invitation
  - View dashboard

- [ ] **5b. Client flow testing**
  - Accept invitation link
  - Sign up via Supabase Auth
  - Verify relationship created
  - Log food, workouts, weight
  - Check professional can view data

- [ ] **5c. Cross-role testing**
  - Nutritionist sees food only
  - Trainer sees workouts only
  - Coach sees everything

- [ ] **5d. Edge case testing**
  - Multiple professionals per client
  - Relationship ended = access revoked
  - Settings save and persist

- [ ] **5e. Deploy and verify**
  - Publish app with public URL
  - Test invitation links work externally
  - Verify all features work in production

---

## Data Migration (If Needed)

If existing Neon data needs to be preserved:

1. Export from Neon using Drizzle queries
2. Transform UUIDs and timestamps
3. Create users in Supabase Auth
4. Insert profiles with matching IDs
5. Import health data to new tables
6. Verify counts match

**Rehearsal Plan:**
- [ ] Write export scripts before Phase 3
- [ ] Test import on staging/dev Supabase project
- [ ] Verify row counts match
- [ ] Test unit conversions (if any)

For prototype: May be simpler to start fresh with test data.

---

## Risk Mitigation (Expanded)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking client app during Phase 2-3 | High | High | Keep Express session auth working until Phase 3 complete. Add JWT middleware first. |
| Missing RLS policies on new tables | Medium | High | Create policy matrix (above). Test each policy before moving on. |
| Data migration failures (IDs/units) | Medium | Medium | Rehearse migration on dev. Verify row counts. Keep Neon data as backup. |
| AI endpoints lose auth coverage | Medium | High | Add JWT middleware in Phase 1, before removing sessions. Test thoroughly. |
| Query cache invalidation breaks | Low | Medium | Update all query keys systematically. Document old → new mappings. |
| Performance regression with RLS | Low | Medium | Test with realistic data volumes. Index critical columns. |

### Critical Safeguards
1. **Never remove session auth until JWT middleware is tested and working**
2. **Never delete Neon data until Supabase version is fully validated**
3. **Feature freeze during Phases 2-3** - no new features, only migration work
4. **Daily backups of Supabase during migration**

---

## Supabase Configuration

**Project URL:** https://mghrhoqqpojdjsjptjfc.supabase.co
**Environment Variables:** Configured in Replit secrets

---

## Related Documents

- `replit.md` - Technical architecture and patterns
- `SAAS_BRIEF.md` - Full product vision and roadmap
- `FEATURE_BACKLOG.md` - Features to build after prototype

---

*This plan covers the full migration to Supabase. The goal is a unified auth system and data layer before launching the prototype publicly.*
