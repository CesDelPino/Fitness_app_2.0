# Routine Assignment System Architecture

## Overview

This document outlines the architecture for the trainer-to-client routine assignment system in LOBA Tracker. The system enables fitness professionals to create, customize, and assign workout routines to their clients, with support for AI-assisted routine generation.

---

## Core Concepts

### Terminology Glossary

| Term | Definition | Example |
|------|------------|---------|
| **Programme** | A multi-day workout plan containing one or more sessions. Stored as a single `routine_blueprint` with exercises organized by `day_number`. | "PPL Split" - 3 sessions over 3 days |
| **Session** | A single day's workout within a programme. Derived from exercises with the same `day_number`. This is what clients see and log. | "Day 1: Push" - chest, shoulders, triceps |
| **Routine Blueprint** | The database entity storing programme metadata (name, goal, duration, etc.) | A row in `routine_blueprints` table |
| **Routine Version** | A versioned snapshot of exercises within a programme. Enables draft/review workflow. | Version 1 of "PPL Split" |
| **Assignment** | Links a programme version to a client with start/end dates | Client X has "PPL Split v1" assigned |
| **Session Occurrence** | A single instance of completing a session on a specific date | Client X completed "Day 1: Push" on Nov 30 |

**Key Distinction:**
- **Programme** = The container/plan (what trainers create and assign)
- **Session** = The daily workout (what clients see and log)
- A programme with 3 days contains 3 sessions
- The client workout logger operates on sessions, not programmes

---

### Session-Based API Contract

When fetching an assigned programme, the API returns sessions as an array for client consumption:

```typescript
// GET /api/client/assignments/:id
{
  assignment: {
    id: "uuid",
    status: "active",
    start_date: "2024-01-01",
    end_date: "2024-03-01",
    notes: "Focus on form"
  },
  programme: {
    id: "uuid",
    name: "Push Pull Legs Split",
    description: "Classic 3-day split for hypertrophy",
    goal: "Hypertrophy",
    duration_weeks: 8,
    sessions_per_week: 3
  },
  sessions: [
    {
      session_id: "version-uuid-d1",  // Derived: ${versionId}-d${day_number}
      day_number: 1,
      focus: "Push (Chest, Shoulders, Triceps)",
      exercises: [
        {
          id: "uuid",
          name: "Bench Press",
          sets: 4,
          reps_min: 8,
          reps_max: 12,
          rest_seconds: 90,
          notes: "Focus on controlled eccentric"
        },
        // ... more exercises
      ]
    },
    {
      session_id: "version-uuid-d2",
      day_number: 2,
      focus: "Pull (Back, Biceps)",
      exercises: [...]
    },
    {
      session_id: "version-uuid-d3",
      day_number: 3,
      focus: "Legs",
      exercises: [...]
    }
  ]
}
```

**Session ID Format:** `${routine_version_id}-d${day_number}`
- Provides a stable identifier for tracking completion
- Derived at query time (no additional table needed initially)
- Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890-d1`

---

### Routine Ownership Model

| Owner Type | Description | Created By | Editable By |
|------------|-------------|------------|-------------|
| **platform** | System library templates | Admins only | Admins only |
| **professional** | Pro-created or customized routines | Professionals | Owning professional |
| **client_proxy** | AI-generated for unaffiliated clients | Platform (on behalf of client) | Client (limited), inheriting Pro |

**Key Rules:**
- System templates are platform IP - professionals can clone but not modify originals
- Pro-created routines belong to that professional
- Client AI-created routines are platform-owned but linked to the client via `created_for_client_id`
- When a client connects with a pro, the pro inherits management of the client's routines

---

## Routine Creation Paths

### Path 1: Manual Creation (Professionals Only)
- Pro builds routine from scratch using exercise library
- Selects exercises, sets, reps, rest periods
- Assigns directly to client (no review needed)
- Status flow: `draft` → `active`

### Path 2: Template Selection (Professionals Only)
- Pro browses system library OR their own saved routines
- Clones template to create a new version
- Modifies as needed for specific client
- Assigns to client
- Status flow: `draft` → `active`

### Path 3: AI-Assisted Creation (Professionals & Unaffiliated Clients)
- User provides:
  - Routine description (free text)
  - Equipment available (structured selection)
  - Goal focus (hypertrophy, max load, endurance, etc.)
  - Duration/frequency preferences
- AI generates draft routine
- **For Professionals:** Review, modify, then assign
- **For Unaffiliated Clients:** Review, accept, use independently
- Status flow: `draft` → `pending_review` → `active`

---

## Data Model

### New Tables

#### `exercise_library`
Central repository of exercises (ready for future video integration).

```
id                  UUID PRIMARY KEY
name                TEXT NOT NULL
category            TEXT (strength, cardio, flexibility, etc.)
muscle_groups       TEXT[] (primary muscles targeted)
equipment_tags      TEXT[] (required equipment)
difficulty_level    TEXT (beginner, intermediate, advanced)
instructions        TEXT
video_url           TEXT (nullable - future use)
thumbnail_url       TEXT (nullable - future use)
demonstration_notes TEXT (nullable - future use)
is_system           BOOLEAN DEFAULT true
created_by          UUID REFERENCES profiles(id)
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

#### `equipment_options`
Structured equipment list for selection UI.

```
id                  UUID PRIMARY KEY
name                TEXT NOT NULL (e.g., "Dumbbells")
category            TEXT NOT NULL (free_weights, machines, cardio, bodyweight, other)
display_order       INTEGER
is_active           BOOLEAN DEFAULT true
```

#### `goal_types`
Training goal definitions.

```
id                  UUID PRIMARY KEY
name                TEXT NOT NULL (e.g., "Hypertrophy")
description         TEXT
default_rep_range   TEXT (e.g., "8-12")
default_rest_seconds INTEGER
display_order       INTEGER
is_active           BOOLEAN DEFAULT true
```

#### `routine_blueprints`
Master routine definitions.

```
id                  UUID PRIMARY KEY
name                TEXT NOT NULL
description         TEXT
owner_type          TEXT NOT NULL (platform, professional, client_proxy)
owner_id            UUID (professional's user_id, null for platform)
created_for_client_id UUID (for client_proxy type only)
creation_method     TEXT NOT NULL (manual, template, ai_assisted)
source_blueprint_id UUID (if cloned from another blueprint)
goal_type_id        UUID REFERENCES goal_types(id)
equipment_profile   JSONB (selected equipment)
duration_weeks      INTEGER
sessions_per_week   INTEGER
ai_prompt           TEXT (original prompt if AI-created)
ai_response         JSONB (AI's raw response for audit)
is_template         BOOLEAN DEFAULT false (for system library)
is_archived         BOOLEAN DEFAULT false
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

#### `routine_versions`
Version control for routines (enables draft/review workflow).

```
id                  UUID PRIMARY KEY
blueprint_id        UUID REFERENCES routine_blueprints(id)
version_number      INTEGER NOT NULL
status              TEXT NOT NULL (draft, pending_review, active, archived)
notes               TEXT (version notes/changes)
created_at          TIMESTAMPTZ DEFAULT now()
published_at        TIMESTAMPTZ
```

#### `routine_version_exercises`
Exercises within a routine version with dual-value weight storage.

```
id                    UUID PRIMARY KEY
routine_version_id    UUID REFERENCES routine_versions(id)
exercise_id           UUID REFERENCES exercise_library(id)
custom_exercise_name  TEXT (fallback for AI-generated exercises not in library)
day_number            INTEGER (which day of the routine)
order_in_day          INTEGER
sets                  INTEGER
reps_min              INTEGER
reps_max              INTEGER
rest_seconds          INTEGER
notes                 TEXT
superset_group        TEXT (nullable - for supersets)
target_weight_kg      NUMERIC(6,2) (canonical weight in kg)
entered_weight_value  NUMERIC(6,2) (user's entered value)
entered_weight_unit   TEXT ('kg' | 'lbs')
load_directive        TEXT (e.g., 'RPE 8', '60% 1RM', 'bodyweight')
special_instructions  TEXT (form cues, tempo, etc.)
```

**Dual-Value Weight Contract:**
The system stores both the canonical kg value and the original user entry to prevent conversion drift:
- `target_weight_kg`: Always stores weight in kilograms (source of truth for calculations)
- `entered_weight_value`: Stores the exact value the user entered
- `entered_weight_unit`: Records which unit was used ('kg' or 'lbs')

**Conversion Utilities (shared/units.ts):**

The unit conversion system preserves precision at storage while providing user-friendly display values:

```typescript
// Storage: Always store kg at high precision (3 decimal places)
// This preserves fractional plate weights (1.25kg, 2.5kg, etc.)
parseWeightInput(input, inputUnit) → {
  valueKg: number,        // Rounded to 3 decimals for storage
  enteredValue: number,   // Original entry rounded to 2 decimals
  enteredUnit: WeightUnit // 'kg' or 'lbs'
}

// Conversion: Uses precise constant (2.20462)
lbsToKg(lbs) → lbs / 2.20462
kgToLbs(kg)  → kg * 2.20462

// Smart rounding for display - prefers clean increments
// Snaps to nearest whole if within 0.05, then nearest 0.5
smartRoundForDisplay(value, unit) → cleanValue

// Format with automatic precision and unit handling
formatWeight(valueKg, displayUnit, {
  enteredValue?,     // Use original if unit matches
  enteredUnit?,
  precision?,
  showUnit?
}) → "22.5 kg" or "50 lbs"
```

**Why High Precision for kg?**  
Gym weight plates often come in 1.25kg or 0.5kg increments. Storing at 3 decimal places prevents cumulative drift when users switch units repeatedly.

**Display Logic:**
When displaying weight to users:
1. If `entered_weight_unit` matches user preference → show `entered_weight_value` (preserves original entry)
2. Otherwise → convert `target_weight_kg` and apply `smartRoundForDisplay()` for clean values

**Frontend Hook (useWeightUnits.ts):**
```typescript
const { formatValue, convertFromKg, toKg, unit, isReady, isLoading } = useWeightUnits();
// unit: 'kg' or 'lbs' from user preferences
// isReady: true when user preferences have loaded (safe to convert/save)
// isLoading: true while preferences are still loading

// formatValue(22.68, 'kg', {}) → "22.7 kg"
// formatValue(null, 'lbs') → "-"

// convertFromKg(22.68) → 50 (if user prefers lbs)
// toKg(50, 'lbs') → 22.68
```

**Race Condition Guard:**
Components that save weight values MUST check `isReady` before persisting:
```typescript
// In ProProgrammeEdit.tsx handleSaveExercise:
if (!weightUnits.isReady && (updates.target_weight_kg || updates.entered_weight_value)) {
  toast({ title: "Please wait", description: "Loading preferences..." });
  return;
}
```
This prevents incorrect unit conversions when user profile hasn't finished loading (e.g., after page refresh or session timeout recovery).

#### `routine_assignments`
Links routines to clients.

```
id                  UUID PRIMARY KEY
routine_version_id  UUID REFERENCES routine_versions(id)
client_id           UUID REFERENCES profiles(id) NOT NULL
assigned_by_pro_id  UUID REFERENCES profiles(id) (null if self-assigned)
status              TEXT NOT NULL (active, paused, completed, cancelled)
start_date          DATE
end_date            DATE
notes               TEXT
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

#### `routine_ai_requests`
Audit trail for AI routine generation.

```
id                  UUID PRIMARY KEY
requester_id        UUID REFERENCES profiles(id) NOT NULL
requester_role      TEXT NOT NULL (professional, client)
for_client_id       UUID REFERENCES profiles(id) (if pro requesting for client)
prompt_text         TEXT NOT NULL
equipment_selected  TEXT[]
goal_type_id        UUID REFERENCES goal_types(id)
additional_params   JSONB
ai_response         JSONB
resulting_blueprint_id UUID REFERENCES routine_blueprints(id)
status              TEXT (pending, completed, failed)
created_at          TIMESTAMPTZ DEFAULT now()
completed_at        TIMESTAMPTZ
```

---

## Row-Level Security (RLS) Policies

### exercise_library
- **SELECT**: All authenticated users
- **INSERT/UPDATE/DELETE**: Admins only (or creator if `is_system = false`)

### equipment_options & goal_types
- **SELECT**: All authenticated users
- **INSERT/UPDATE/DELETE**: Admins only

### routine_blueprints
- **SELECT**:
  - Admins: All
  - Professionals: Where `owner_id = auth.uid()` OR `owner_type = 'platform'` OR client is linked via relationships
  - Clients: Where `created_for_client_id = auth.uid()` OR assigned via routine_assignments
- **INSERT**:
  - Admins: Any
  - Professionals: Where `owner_type = 'professional'` AND `owner_id = auth.uid()`
  - Clients: Where `owner_type = 'client_proxy'` AND `created_for_client_id = auth.uid()`
- **UPDATE/DELETE**:
  - Admins: Any
  - Professionals: Where `owner_id = auth.uid()`

### routine_versions
- Inherits access from parent blueprint

### routine_assignments
- **SELECT**:
  - Clients: Where `client_id = auth.uid()`
  - Professionals: Where `assigned_by_pro_id = auth.uid()` OR client linked via relationships
  - Admins: All
- **INSERT/UPDATE**:
  - Professionals: For their linked clients
  - Clients: Can update status on their own assignments (pause, etc.)

---

## Equipment Selection UI

### For Professionals (Structured Multi-Select)

**Free Weights**
- [ ] Dumbbells
- [ ] Barbells
- [ ] Kettlebells
- [ ] Weight Plates
- [ ] EZ Curl Bar

**Machines**
- [ ] Cable Stack
- [ ] Smith Machine
- [ ] Leg Press
- [ ] Lat Pulldown
- [ ] Chest Press Machine
- [ ] Leg Curl/Extension

**Racks & Benches**
- [ ] Squat Rack
- [ ] Flat Bench
- [ ] Adjustable Bench
- [ ] Pull-up Bar
- [ ] Dip Station

**Cardio**
- [ ] Treadmill
- [ ] Stationary Bike
- [ ] Rowing Machine
- [ ] Stair Climber
- [ ] Elliptical

**Other**
- [ ] Resistance Bands
- [ ] TRX/Suspension Trainer
- [ ] Medicine Ball
- [ ] Foam Roller
- [ ] Yoga Mat

### For Unaffiliated Clients (Simplified Presets)

- **Full Gym**: Complete commercial gym access
- **Home Basics**: Dumbbells, resistance bands, pull-up bar
- **Bodyweight Only**: No equipment needed
- **Dumbbells Only**: Just dumbbells (various weights)
- **Custom**: Free text description

---

## Goal Types

| Goal | Description | Typical Rep Range | Rest Period |
|------|-------------|-------------------|-------------|
| **Hypertrophy** | Muscle size/growth | 8-12 reps | 60-90 sec |
| **Strength** | Maximum force output | 3-6 reps | 2-5 min |
| **Endurance** | Muscular stamina | 15-20+ reps | 30-45 sec |
| **Power** | Explosive strength | 3-5 reps (explosive) | 2-3 min |
| **Fat Loss** | Caloric burn focus | 12-15 reps | 30-60 sec |
| **General Fitness** | Balanced approach | 10-15 reps | 60 sec |

---

## API Endpoints

### Admin Routes (`/api/admin/...`)
- `GET/POST /api/admin/exercises` - Exercise library CRUD
- `GET/POST /api/admin/routines` - System routine templates CRUD
- `POST /api/admin/routines/ai-generate` - AI-assisted system routine creation
- `GET/PUT /api/admin/equipment` - Equipment options management
- `GET/PUT /api/admin/goals` - Goal types management

### Professional Routes (`/api/pro/...`)

> **Security Requirement:** All pro routes require `requireProfessional` middleware that:
> 1. Validates Supabase auth token
> 2. Confirms user has professional profile
> 3. Injects `req.professionalId` for downstream use

**Routine Management:**
- `GET /api/pro/routines` - List pro's own routines + system templates
- `POST /api/pro/routines` - Create new routine (manual)
- `POST /api/pro/routines/clone/:id` - Clone from template
- `POST /api/pro/routines/ai-generate` - AI-assisted creation
- `GET /api/pro/routines/pending-review` - Routines awaiting pro review
- `PUT /api/pro/routines/:id` - Update routine (ownership check)
- `DELETE /api/pro/routines/:id` - Archive routine (ownership check)

**Assignment Management:**
- `POST /api/pro/routines/:id/assign` - Assign routine to client
- `GET /api/pro/assignments` - List all assignments made by this pro
- `GET /api/pro/assignments/:id` - Get assignment with sessions
- `PUT /api/pro/assignments/:id` - Update assignment (dates, notes, status)
- `DELETE /api/pro/assignments/:id` - Cancel/remove assignment

**Client-Specific Views:**
- `GET /api/pro/clients/:clientId/assignments` - Client's assigned routines
- `GET /api/pro/clients` - List pro's connected clients (from relationships table)

### Client Routes (`/api/client/...`)
- `GET /api/client/routines` - My assigned routines
- `POST /api/client/routines/ai-generate` - Request AI routine (unaffiliated)
- `PUT /api/client/routines/:id/status` - Update assignment status
- `GET /api/client/my-pro` - Get connected professional info

---

## UI Components

### Admin Panel Additions
1. **Exercise Library Manager**
   - List/search exercises
   - Add/edit exercise details
   - Placeholder for video upload (future)

2. **System Routine Builder**
   - Manual routine creation
   - AI-assisted creation
   - Template management

### Professional Portal
1. **Routine Library Tab**
   - My Routines (pro-created)
   - System Templates
   - Create New button (→ creation wizard)

2. **Routine Creation Wizard**
   - Step 1: Choose method (Manual / Template / AI)
   - Step 2a (Manual): Build exercises
   - Step 2b (Template): Select & customize
   - Step 2c (AI): Enter description, equipment, goals
   - Step 3: Review & assign

3. **Client Routine Manager**
   - Per-client routine list
   - Assignment history
   - Progress tracking (future)

4. **Review Queue**
   - AI-generated routines pending review
   - Quick approve/modify actions

### Client App
1. **"My Pro" Tab**
   - Shows connected professional (if any)
   - Professional's contact info, specialties
   - "Find a Pro" CTA if unaffiliated

2. **Assigned Routines**
   - List of current routines
   - Status indicators
   - Start workout button

3. **AI Routine Creator** (Unaffiliated Only)
   - Simple equipment preset selection
   - Goal selection
   - Description text box
   - Generate & review flow

---

## Implementation Phases

### Phase 1: Database Foundation ✅ COMPLETE
- [x] Create Supabase migrations for all new tables (008, 009, 010)
- [x] Set up RLS policies
- [x] Seed equipment_options (40+ items across 5 categories)
- [x] Seed goal_types (6 training goals)
- [x] Seed initial exercise_library (67 exercises)

### Phase 2: Admin Tools ✅ COMPLETE
- [x] Exercise Library Manager UI (search, filter, pagination, CRUD)
- [x] Equipment/Goal management (CRUD with data sanitization)
- [x] System Programme Builder (manual) - 4-step wizard
- [x] System Programme Builder (AI-assisted) - 3-step wizard with editable review
- [x] Programme library grid with View Details, Clone, Archive actions

### Phase 3: Assignment Backend ✅ COMPLETE
Backend infrastructure for programme assignments (no user-facing UI in this phase).

- [x] Architecture: Session-based API contract documented
- [x] Architecture: Programme/Session terminology glossary
- [x] Backend: Session derivation logic (`deriveSessionsFromExercises()`)
- [x] Backend: Assignment CRUD operations in `supabase-routine-data.ts`
- [x] Backend: `inferSessionFocus()` for intelligent session naming
- [x] API: Assignment endpoints with sessions array response

> **Note:** Admin panel assignment tooling exists for internal QA/testing only. 
> The production assignment flow is in Phase 4 (Professional Portal).

### Phase 4: Professional Portal - Programme Management ✅ COMPLETE
User-facing programme management for fitness professionals.

**4A: Pro Routine Library** ✅ COMPLETE
- [x] Pro-scoped API routes (`/api/pro/routines`, `/api/pro/routines/:id`, PUT `/api/pro/routines/:id`)
- [x] `requireProfessional` middleware with Supabase auth + professional profile validation
- [x] React Query hooks: `useProRoutines`, `useProRoutine`, `useCreateProRoutine`, `useUpdateProRoutine`
- [x] Routine library view in ProDashboard with tabbed interface (Clients | Programmes)
- [x] Programme creation page (`/pro/programmes/new`) with metadata form
- [x] Programme edit page (`/pro/programmes/:id/edit`) with inline metadata editing
- [x] Save & Exit workflow persists changes via mutation before navigation
- [x] Full exercise/session editing (add, remove, reorder exercises within sessions)
- [x] Template cloning with pro ownership transfer (`POST /api/pro/routines/clone/:id`)
- [x] AI-assisted creation for pros (`POST /api/pro/routines/ai-generate`) with mandatory review

**Key Files (Phase 4A):**
- `client/src/pages/pro/ProDashboard.tsx` - Tabbed dashboard with Programmes tab
- `client/src/pages/pro/ProProgrammeNew.tsx` - New programme creation form with Manual/Template/AI tabs
- `client/src/pages/pro/ProProgrammeEdit.tsx` - Programme editing with inline exercise parameter editing
- `client/src/components/AddExerciseModal.tsx` - Modal for adding exercises to sessions
- `client/src/lib/pro-routines.ts` - React Query hooks for pro routine operations
- `server/routes.ts` - Pro-scoped API routes with requireProfessional middleware
- `shared/units.ts` - Weight unit conversion utilities (dual-value system)
- `client/src/hooks/useWeightUnits.ts` - React hook for weight display/formatting

**4B: Programme Assignment Flow** ✅ COMPLETE
- [x] Pro-scoped assignment API (`POST /api/pro/routines/:id/assign`)
- [x] Relationship validation (pro can only assign to their clients)
- [x] Assignment UI in ProClientView (client detail page)
- [x] Client's assigned routines view (`GET /api/pro/clients/:clientId/assignments`)
- [x] Assignment status management (pause, resume, complete, cancel)
- [x] AssignProgrammeModal with programme selector, date picker, notes
- [x] Cache invalidation for assignment mutations (multi-key pattern)

**Key Files (Phase 4B):**
- `client/src/components/AssignProgrammeModal.tsx` - Programme assignment modal with search
- `client/src/pages/pro/ProClientView.tsx` - Client detail with Programmes tab
- `client/src/lib/pro-routines.ts` - Assignment hooks: `useAssignRoutine`, `useUpdateProAssignment`, `useCancelProAssignment`, `useClientAssignments`
- `server/routes.ts` - Assignment endpoints: POST assign, GET assignments, PUT status, DELETE cancel
- `server/supabase-routine-data.ts` - Assignment data operations with relationship validation

**4C: Review & Management** ✅ COMPLETE
- [x] Review queue for AI-generated routines (draft/pending_review status filter)
- [x] Review tab in ProDashboard with pending count badge
- [x] Amber-highlighted review cards with exercise count, goal, schedule info
- [x] Inline Edit and Approve buttons for quick actions
- [x] Approve mutation changes version status to 'active' and sets published_at
- [x] Assignment event tracking via `routine_assignment_events` table
- [x] Assignment history API endpoints (`GET /api/pro/assignments/:id/history`)
- [x] Client history timeline (`GET /api/pro/clients/:clientId/history`)

**Key Files (Phase 4C):**
- `client/src/pages/pro/ProDashboard.tsx` - Review tab with queue display
- `client/src/lib/pro-routines.ts` - Review hooks: `useProReviewQueue`, `useApproveProRoutine`, `useAssignmentHistory`, `useClientHistory`
- `server/routes.ts` - Review endpoints: GET review-queue, POST approve, GET history
- `server/supabase-routine-data.ts` - `getProReviewQueue()` with exercises, `approveRoutineVersion()`
- `supabase/migrations/012_routine_assignment_events.sql` - Event tracking table with auto-capture trigger

**Review Queue API Contract:**

```typescript
// GET /api/pro/routines/review-queue
// Returns programmes with draft/pending_review versions
{
  id: string;                    // Blueprint ID
  name: string;
  description: string | null;
  creation_method: 'ai_assisted';
  sessions_per_week: number | null;
  duration_weeks: number | null;
  latest_version: {
    id: string;
    status: 'draft' | 'pending_review';
    exercises: RoutineVersionExercise[];
  };
  goal: {
    id: string;
    name: string;
  } | null;
}[]

// POST /api/pro/routines/:id/approve
// Blueprint ID in URL, approves latest version
Request: { notes?: string }
Response: { version: RoutineVersion, message: string }
```

**Assignment Event Tracking:**

The `routine_assignment_events` table auto-captures all assignment changes:
- `created` - Initial assignment
- `status_changed` - Active/paused/completed/cancelled transitions
- `dates_updated` - Start or end date modifications
- `notes_updated` - Assignment notes changed
- `reassigned` - (Future) Client transferred to different pro

Events are captured via PostgreSQL trigger on `routine_assignments` table updates.

### Phase 5: Client Experience
Client-facing features for viewing, accepting, and using assigned programmes.

---

#### Two-Tier Client Model

Clients operate in one of two tiers based on their relationship status:

| Tier | Description | AI Access | Pro Programmes |
|------|-------------|-----------|----------------|
| **Normal** | Unaffiliated client | 1x per month limit | None |
| **Pro-Connected** | Has active relationship with professional | Via pro only | Assigned by pro |

**Tier Resolver:** Entitlements are determined by checking both `profiles.subscription_tier` and active `relationships` records. Tier changes automatically adjust permissions.

---

#### Programme Acceptance Flow

When a professional assigns a programme, the client must explicitly accept it before sessions become available:

```
Pro assigns → pending_acceptance → Client accepts → Sessions materialized → active
                                 ↘ Client declines → rejected (visible 7 days, then deleted)
```

**Assignment Status Values:**
- `pending_acceptance` - Awaiting client response (NEW)
- `rejected` - Client declined (auto-delete after 7 days) (NEW)
- `active` - Accepted and in use
- `paused` - Temporarily suspended
- `completed` - Programme finished
- `cancelled` - Terminated by pro

**Programme Update Notifications:**
When a pro updates a programme after client acceptance:
1. Client receives notification of available update
2. Client can choose to accept new version or keep current
3. Current sessions remain functional until client decides
4. Accepting update re-materializes sessions from new version

---

#### Session Materialization

On acceptance, programme sessions are materialized into a dedicated table for workout logging:

**New Table: `routine_assignment_sessions`**
```
id                      UUID PRIMARY KEY
routine_assignment_id   UUID REFERENCES routine_assignments(id)
routine_version_id      UUID REFERENCES routine_versions(id)
day_number              INTEGER NOT NULL
session_focus           TEXT (derived from exercises)
materialized_at         TIMESTAMPTZ DEFAULT now()
is_current              BOOLEAN DEFAULT true (false when superseded by update)
```

**Session ID Format:** `${routine_version_id}-d${day_number}`

Sessions appear alongside client's own routines in the workout picker, enabling seamless integration with existing workout logger.

---

**5A: Programme Acceptance & Session Integration** ✅ COMPLETE

*Database & State Machine:*
- [x] Add `pending_acceptance` and `rejected` status to assignment state machine
- [x] Add `rejected_at`, `has_pending_update` columns to `routine_assignments`
- [x] Create `routine_assignment_sessions` table for materialized sessions
- [x] Migration: `013_client_programme_acceptance.sql`

*Tier Resolver:*
- [x] `getClientTier(userId)` - checks `professional_client_relationships` for active connections
- [x] `getClientProfessional(userId)` - returns connected professional info
- [x] Returns `normal` or `pro_connected` based on relationship status
- [x] Entitlements: `can_use_ai_programmes`, `ai_programmes_per_month`, `can_receive_pro_assignments`

*API Endpoints:*
- [x] `GET /api/client/programmes` - List pending + active assignments
- [x] `POST /api/client/programmes/:id/accept` - Accept and materialize sessions (returns `{ assignment, sessions }`)
- [x] `POST /api/client/programmes/:id/reject` - Decline with optional reason
- [x] `GET /api/client/tier` - Get tier info and entitlements

*Session Materialization:*
- [x] `materializeSessionsForAssignment()` creates session records with `is_current = true`
- [x] Uses `deriveSessionsFromExercises()` for session extraction from version exercises
- [x] Session records stored in `routine_assignment_sessions` table

*Event Tracking:*
- [x] Events captured via existing `routine_assignment_events` trigger on assignment changes

*Rejected Assignment Cleanup:*
- [x] On-read pruning via `cleanupOldRejectedAssignments()` 
- [x] Deletes assignments with `rejected_at` > 7 days when fetching client assignments
- [x] No scheduled job required - cleanup happens naturally during reads

*Frontend:*
- [x] React Query hooks with `keepPreviousData` to prevent UI flicker during refetches
- [x] `PendingProgrammes` component integrated into client Dashboard
- [x] Empty state messaging based on tier (normal vs pro_connected)
- [x] Accept/Decline UI with rejection reason dialog
- [x] Loading skeleton states during initial data fetch

**Key Files (Phase 5A):**
- `supabase/migrations/013_client_programme_acceptance.sql` - Schema changes for acceptance flow
- `server/supabase-routine-data.ts` - getClientTier, getClientProfessional, getClientAssignments, acceptAssignment, rejectAssignment, materializeSessionsForAssignment, cleanupOldRejectedAssignments
- `server/routes.ts` - Client-scoped API routes (`/api/client/programmes`, `/api/client/tier`)
- `client/src/lib/client-programmes.ts` - React Query hooks: useClientTier, useClientProgrammes, useAcceptProgramme, useRejectProgramme
- `client/src/components/programmes/PendingProgrammes.tsx` - Pending programmes UI with Accept/Decline buttons
- `client/src/pages/Dashboard.tsx` - PendingProgrammes component integration point

**Technical Note:**
The `professional_client_relationships` table (not `relationships`) is used for tier detection. Query patterns use separate lookups for profile and professional_profile data to avoid complex join issues with Supabase's PostgREST schema cache.

**5B: My Pro Tab** ✅ COMPLETE

*Overview:*
A "My Pro" card on the client Dashboard showing connected professional info with tier-aware states for affiliated vs unaffiliated clients.

*Backend:*
- [x] Add `GET /api/client/my-pro` endpoint aggregating professional profile + active programme count
- [x] Reuse existing `getClientProfessional()` and `getClientAssignments()` functions
- [x] Return consistent schema: `{ professional, relationshipSince, activeProgrammeCount }` (all nullable for unaffiliated)

*Frontend:*
- [x] Create `useClientProOverview` hook in `client/src/lib/client-programmes.ts`
- [x] Create `MyProCard` component in `client/src/components/programmes/`
- [x] Pro-connected state: Show pro's avatar (initials), name, headline, specialties, active programme count
- [x] Unaffiliated state: Show "Find a Pro" CTA with benefits messaging
- [x] Skeleton loading state during fetch
- [x] Error state for failed requests

*Dashboard Integration:*
- [x] Place `MyProCard` above `PendingProgrammes` in Dashboard programmes section
- [x] Both components use tier-aware rendering

*Dependencies:*
- Reuses `professional_client_relationships` table (same as tier detection)
- Leverages existing `professional_profiles` data
- No database changes needed

**Key Files (Phase 5B):**
- `server/routes.ts` - `/api/client/my-pro` endpoint with consistent response schema
- `client/src/lib/client-programmes.ts` - `useClientProOverview` hook with `ClientProOverview` interface
- `client/src/components/programmes/MyProCard.tsx` - Tier-aware component with loading/error/empty/connected states
- `client/src/pages/Dashboard.tsx` - Integration point above PendingProgrammes

**API Contract:**
```typescript
// GET /api/client/my-pro
Response: {
  professional: {
    id: string;
    display_name: string;
    headline: string | null;
    specialties: string[];
    contact_email: string | null;
  } | null;
  relationshipSince: string | null;
  activeProgrammeCount: number;
}
```

**5C: Programme Update Flow**

*Overview:*
When a trainer updates a programme that's already assigned to a client, the client receives a notification and can choose to accept the update (re-materializing sessions) or keep their current version.

**5C-1: Schema & Triggers**
- [x] Add `pending_version_id` to `routine_assignments` (nullable UUID reference)
- [x] Add `pending_created_at` timestamp for when update was pushed
- [x] Add `pending_notes` text for trainer notes about changes
- [x] Add `parent_version_id` to `routine_versions` for version lineage
- [x] Create `routine_assignment_update_events` audit table
- [x] Update triggers to emit update events
- [x] RLS policies for new columns/table

**5C-2: Backend APIs**
- [x] `POST /api/pro/assignments/:id/push-update` - Pro pushes new version to client
- [x] `GET /api/client/programmes` - Include pending update info in response
- [x] `POST /api/client/programmes/:id/accept-update` - Accept and re-materialize sessions
- [x] `POST /api/client/programmes/:id/decline-update` - Keep current version
- [x] Transactional session swap (mark old `is_current=false`, create new `is_current=true`)

**5C-3: Frontend**
- [x] Pro: "Push Update" button on assigned programme (ProClientView)
- [x] Pro: Update notes dialog before pushing
- [x] Client: Pending update banner on PendingProgrammes component
- [x] Client: Update details modal showing what changed
- [x] Client: Accept/Decline buttons with confirmation

**5C-4: Background/Cleanup**
- [x] Expire stale pending updates after N days (configurable via PENDING_UPDATE_EXPIRY_DAYS, default 14)
- [x] Notification when update expires unused (ExpiredUpdatesNotification on Pro Dashboard)

*Session Update State Machine:*
```
Pro creates new version → routine_assignments.pending_version_id = new_version_id
                        → pending_created_at = now()
                        → Event: 'update_offered'
                        ↓
Client accepts update → Mark old sessions is_current = false
                      → Create new sessions with is_current = true
                      → Clear pending_version_id, pending_created_at
                      → Update current_version_id to new version
                      → Event: 'update_accepted'
                        ↓
Client declines update → Clear pending_version_id, pending_created_at
                       → Old sessions remain is_current = true
                       → Event: 'update_declined'
```

*Concurrency Handling:*
- Only one pending update allowed per assignment at a time
- If pro creates another update while one is pending, it supersedes the previous (old pending discarded)
- Workout logger always filters `is_current = true` so no data conflicts
- Historical sessions (is_current = false) preserved for workout history
- Paused/completed assignments ignore new updates
- Accept/decline wrapped in serializable transaction to prevent race conditions

*Edge Cases:*
- Client mid-workout when update arrives: Logger continues with current sessions
- Trainer spam revisions: Each new push supersedes previous pending
- Programme reassigned while pending: Cancel pending update on reassignment

*Database Schema Changes:*
```sql
-- Add pending update tracking to routine_assignments
ALTER TABLE routine_assignments 
  ADD COLUMN pending_version_id UUID REFERENCES routine_versions(id),
  ADD COLUMN pending_created_at TIMESTAMPTZ,
  ADD COLUMN pending_notes TEXT;

-- Add version lineage
ALTER TABLE routine_versions
  ADD COLUMN parent_version_id UUID REFERENCES routine_versions(id);

-- Audit table for update events
CREATE TABLE routine_assignment_update_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES routine_assignments(id) ON DELETE CASCADE,
  from_version_id UUID REFERENCES routine_versions(id),
  to_version_id UUID REFERENCES routine_versions(id),
  event_type TEXT NOT NULL, -- 'update_offered', 'update_accepted', 'update_declined', 'update_expired'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**API Contracts (Phase 5C):**

```typescript
// POST /api/pro/assignments/:id/push-update
Request: { version_id: string; notes?: string }
Response: { success: true; pending_version_id: string }

// POST /api/client/programmes/:id/accept-update
Response: { 
  assignment: RoutineAssignment;
  sessions: Array<{ session_id, day_number, focus }>;
  message: "Update accepted" 
}

// POST /api/client/programmes/:id/decline-update
Response: { message: "Update declined, keeping current version" }
```

**Key Files (Phase 5C):**
- `supabase/migrations/014_programme_update_flow.sql` - Schema changes
- `supabase/migrations/015_expire_pending_update_rpc.sql` - Transactional RPC for atomic expiration
- `server/supabase-routine-data.ts` - pushUpdate, acceptUpdate, declineUpdate, expireStalePendingUpdates, getProExpiredUpdates
- `server/routes.ts` - API endpoints including `/api/pro/expired-updates`
- `client/src/lib/pro-routines.ts` - usePushUpdate, useProExpiredUpdates hooks
- `client/src/lib/client-programmes.ts` - useAcceptUpdate, useDeclineUpdate hooks
- `client/src/components/programmes/PendingUpdateBanner.tsx` - Client update notification
- `client/src/components/programmes/ExpiredUpdatesNotification.tsx` - Pro dashboard notification for expired updates

**5D & 5E: Deferred to Feature Backlog**

The following features have been moved to the feature backlog as "nice to have":
- **5D: AI Routine Creator for Normal Clients** - Self-service AI programme generation with monthly quota
- **5E: Tier Transitions** - Handling when clients connect/disconnect from professionals

---

### Phase 5.5: Weekly Check-in System ⭐ PRIORITY

*Overview:*
Enable structured weekly check-ins from clients to trainers with auto-populated metrics, customizable questions, and AI-assisted analysis (premium feature). This creates a regular touchpoint for trainer-client accountability.

**Core Concepts:**
- **Check-in Template**: Trainer-defined form structure with auto-metrics + custom questions
- **Check-in Submission**: Client's weekly response with captured data
- **AI Analysis**: Premium feature providing summary, risk scoring, and suggested trainer responses

---

#### 5.5A: Database Schema

**Tables:**

```sql
-- Trainer-defined check-in templates
CREATE TABLE check_in_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES profiles(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cadence TEXT NOT NULL DEFAULT 'weekly', -- 'weekly', 'biweekly'
  active_version_id UUID, -- Current published version
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Versioned template content (enables template editing without breaking history)
CREATE TABLE check_in_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES check_in_templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'archived'
  created_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);

-- Custom questions within a template version (max 8 per version)
CREATE TABLE check_in_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id UUID REFERENCES check_in_template_versions(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  field_type TEXT NOT NULL, -- 'short_text', 'long_text', 'single_select', 'multi_select', 'scale_1_5', 'boolean'
  options JSONB, -- For select fields: ["Option A", "Option B"]
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER NOT NULL,
  CONSTRAINT max_questions_per_version CHECK (display_order <= 8)
);

-- Links template to specific clients with scheduling
CREATE TABLE check_in_template_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_id UUID REFERENCES check_in_template_versions(id),
  client_id UUID REFERENCES profiles(id) NOT NULL,
  professional_id UUID REFERENCES profiles(id) NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'weekly',
  anchor_weekday INTEGER NOT NULL, -- 0=Sunday, 1=Monday, etc.
  start_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, professional_id) -- One active assignment per pro-client pair
);

-- Individual check-in submissions
CREATE TABLE check_in_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES check_in_template_assignments(id) ON DELETE CASCADE,
  template_version_id UUID REFERENCES check_in_template_versions(id),
  client_id UUID REFERENCES profiles(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'submitted', 'missed'
  due_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  auto_marked_missed_at TIMESTAMPTZ,
  metrics_snapshot JSONB, -- Auto-populated data at submission time
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Client answers to custom questions
CREATE TABLE check_in_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES check_in_submissions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES check_in_questions(id),
  answer_value TEXT, -- Stored as text, parsed based on field_type
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cached weekly metrics for fast form population
CREATE TABLE check_in_metrics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) NOT NULL,
  week_start DATE NOT NULL, -- Monday of the week
  metrics JSONB NOT NULL, -- Aggregated data
  refreshed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, week_start)
);

-- AI analysis results (premium feature)
CREATE TABLE check_in_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES check_in_submissions(id) ON DELETE CASCADE UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  summary TEXT,
  risk_score INTEGER, -- 0-100
  flags JSONB, -- Array of { severity, category, issue, data_points }
  wins JSONB, -- Array of positive observations
  suggested_response TEXT,
  coaching_notes TEXT,
  data_quality JSONB,
  ai_model TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```

**Metrics Snapshot Structure:**
```typescript
interface MetricsSnapshot {
  weight: {
    current_kg: number | null;
    delta_kg: number | null;
    trend_4_week: 'gaining' | 'losing' | 'stable' | null;
  };
  training: {
    sessions_completed: number;
    sessions_assigned: number;
    adherence_percent: number;
    missed_days: string[];
    notable_performances: string[];
  };
  nutrition: {
    avg_calories: number | null;
    target_calories: number | null;
    avg_protein_g: number | null;
    target_protein_g: number | null;
    days_logged: number;
    adherence_percent: number | null;
  };
  cardio: {
    total_minutes: number;
    activities: string[];
  };
  fasting: {
    fasts_completed: number;
    avg_duration_hours: number | null;
    adherence_percent: number | null;
  };
  data_quality: {
    missing_data: string[];
    reliability: 'high' | 'medium' | 'low';
  };
}
```

---

#### 5.5B: Auto-Metrics Pipeline

**Nightly Aggregation (Supabase Cron):**
- Runs daily at 2:00 AM UTC
- Aggregates previous 7 days of data per client into `check_in_metrics_cache`
- Sources: `weigh_ins`, `workout_sessions`, `food_logs`, `cardio_activities`, `fasts`

**On-Demand Refresh:**
- Triggered when client opens check-in form
- Only refreshes if cache is >24 hours stale
- Bounded to current + prior week only

**Overdue Handling:**
- Cron job marks submissions as `missed` if:
  - Status is `scheduled` or `in_progress`
  - `due_at` is more than 3 days ago
- Sets `auto_marked_missed_at` timestamp
- Trainer notified via dashboard indicator

---

#### 5.5C: Trainer Customization (Guardrails)

**Fixed Elements:**
- Auto-metrics section (always included, always first)
- Maximum 8 custom questions per template
- Approved field types only

**Customizable Elements:**
- Question text (free text)
- Field type selection:
  - `short_text` - Single line input
  - `long_text` - Multi-line textarea
  - `single_select` - Radio buttons from options
  - `multi_select` - Checkboxes from options
  - `scale_1_5` - 1-5 rating
  - `boolean` - Yes/No toggle
- Required/optional per question
- Display order (drag to reorder)

**Predefined Picklists (for select fields):**
- Energy: ["Very Low", "Low", "Moderate", "High", "Very High"]
- Stress: ["Minimal", "Low", "Moderate", "High", "Overwhelming"]
- Recovery: ["Poor", "Below Average", "Average", "Good", "Excellent"]
- Sleep Quality: ["Terrible", "Poor", "Fair", "Good", "Excellent"]
- Motivation: ["None", "Low", "Moderate", "High", "Very High"]

---

#### 5.5D: AI Analysis (Premium Feature)

**Trigger:** Submission status changes to `submitted`

**Input Payload:**
- Full metrics snapshot
- All question answers
- Historical context (previous 4 weeks of submissions)
- Client profile (goals, programme info)
- Previous trainer feedback

**AI Prompt Structure:**
```
You are a fitness coaching assistant helping personal trainers review 
their clients' weekly check-ins. Analyze ALL available data and provide 
actionable insights.

## CLIENT PROFILE
- Name: {{client_name}}
- Goals: {{client_goals}}
- Current Programme: {{programme_name}} ({{sessions_per_week}} sessions/week)
- Relationship duration: {{weeks_with_trainer}} weeks

## THIS WEEK'S DATA (Auto-pulled)
[Full metrics snapshot]

## CLIENT'S CHECK-IN RESPONSES
[All question/answer pairs]

## HISTORICAL CONTEXT
[Previous weeks' data and trends]

## YOUR TASK
Analyze this client's week holistically. Return JSON with:
- summary: 2-3 sentence overview
- risk_score: 0-100 (0=excellent, 100=critical)
- flags: Array of concerns with severity
- wins: Positive observations
- suggested_response: Ready-to-send message for trainer
- coaching_notes: Private notes for trainer only
- data_quality: Missing data and reliability assessment
```

**Entitlement Gating:**
- AI analysis is a premium feature
- Trainers must have premium subscription
- Graceful degradation: Check-ins work without AI, just no analysis

---

#### 5.5E: API Endpoints

**Trainer Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pro/check-ins/templates` | List trainer's templates |
| POST | `/api/pro/check-ins/templates` | Create new template |
| PATCH | `/api/pro/check-ins/templates/:id` | Update template metadata |
| POST | `/api/pro/check-ins/templates/:id/publish` | Publish draft version |
| GET | `/api/pro/check-ins/templates/:id/versions` | List template versions |
| POST | `/api/pro/check-ins/assignments` | Assign template to client |
| DELETE | `/api/pro/check-ins/assignments/:id` | Remove assignment |
| GET | `/api/pro/check-ins/clients/:clientId/schedule` | Client's check-in schedule |
| GET | `/api/pro/check-ins/submissions` | All submissions (with filters) |
| GET | `/api/pro/check-ins/submissions/:id` | Submission detail with analysis |

**Client Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/client/check-ins/upcoming` | Next due check-in |
| POST | `/api/client/check-ins/:submissionId/start` | Begin check-in (creates draft) |
| POST | `/api/client/check-ins/:submissionId/save-draft` | Autosave progress |
| POST | `/api/client/check-ins/:submissionId/submit` | Final submission |

**Metrics Endpoint:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/client/check-ins/metrics` | Current week's auto-metrics |
| POST | `/api/client/check-ins/metrics/refresh` | Force cache refresh |

**AI Endpoint (Premium):**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/check-ins/:submissionId/analyze` | Trigger AI analysis |

---

#### 5.5F: UI Components

**Trainer Portal:**
1. **Check-Ins Tab** in ProDashboard
   - Template list with create/edit actions
   - Client submission overview (grouped by client or date)
   - AI status indicators (analyzed/pending/no-premium)

2. **Template Builder Wizard**
   - Step 1: Name, description, cadence
   - Step 2: Add/edit custom questions (drag to reorder)
   - Step 3: Preview and publish

3. **Submission Review Panel**
   - Auto-metrics display (charts/badges)
   - Client answers
   - AI analysis section (if premium):
     - Summary and risk score
     - Flags with severity colors
     - Suggested response (copy button)
     - Private coaching notes

**Client App:**
1. **Check-in Card** on Train page
   - Shows next due date
   - "Complete Check-in" CTA
   - Status: upcoming / due today / overdue

2. **Check-in Form**
   - Auto-metrics section (read-only display of their data)
   - Custom questions
   - Autosave indicator
   - Submit button

---

#### 5.5G: Implementation Tasks

**Phase 5.5 Task Breakdown:**

| # | Task | Depends On | Complexity |
|---|------|------------|------------|
| 1 | Database migration: Create all check-in tables | - | Medium |
| 2 | Metrics aggregation service + nightly cron | 1 | High |
| 3 | On-demand metrics refresh helper | 2 | Low |
| 4 | Submission lifecycle (scheduling, due dates, overdue) | 1 | Medium |
| 5 | Trainer API: Templates CRUD | 1 | Medium |
| 6 | Trainer API: Assignments + submissions | 4, 5 | Medium |
| 7 | Client API: Upcoming, start, save, submit | 4 | Medium |
| 8 | React Query hooks for trainer check-ins | 5, 6 | Medium |
| 9 | React Query hooks for client check-ins | 7 | Medium |
| 10 | Trainer UI: Check-Ins tab + template builder | 8 | High |
| 11 | Trainer UI: Submission review panel | 8 | Medium |
| 12 | Client UI: Check-in card on Train page | 9 | Medium |
| 13 | Client UI: Check-in form with autosave | 9 | High |
| 14 | AI analysis pipeline (premium) | 6 | High |
| 15 | Entitlement gating for AI features | 14 | Low |

**Estimated Total:** 3-4 sprints (6-8 weeks)

---

### Phase 6: In-App Communication

> **Full specification:** [`docs/COMMUNICATIONS.md`](./COMMUNICATIONS.md)

*Overview:*
Enable direct communication between trainers and clients within the app, supporting text messages, voice memos, and real-time notifications.

**Estimated Effort:** 6-7 weeks (single developer)

**Confirmed MVP Scope:**
- Text messaging with real-time WebSocket delivery
- Voice memos (2-min limit, 14-day expiry, then auto-delete)
- In-app notification center with unread badges
- Push notifications (FCM for Android/Chrome)
- Messaging is implicit with any active connection (no separate permission)
- Free for all users

**Deferred to V2:**
- Typing indicators, read receipts, file attachments, message reactions, message editing, group messaging

**Dependencies:**
- Phase 5.5 (Check-ins) - AI suggestions can be sent as messages
- Professional Marketplace - "Contact" button needs messaging
- Active professional-client relationships

**Status:** Scope confirmed, ready for implementation

---

#### Phase 5 API Contracts

**GET `/api/client/assignments`**
List client's pending and active programme assignments.

```typescript
Response: {
  pending: Array<{
    id: string;
    programme: { id, name, description, goal };
    assigned_by: { id, name, headline };
    assigned_at: string;
  }>;
  active: Array<{
    id: string;
    programme: { id, name, description, goal, sessions_per_week };
    sessions: Array<{ session_id, day_number, focus }>;
    start_date: string | null;
    end_date: string | null;
  }>;
}
```

**POST `/api/client/assignments/:id/accept`**
Accept a pending assignment, materializing sessions.

```typescript
Response: {
  assignment: RoutineAssignment;
  sessions: Array<{ session_id, day_number, focus, exercises: [...] }>;
  message: "Programme accepted";
}
```

**POST `/api/client/assignments/:id/reject`**
Decline a pending assignment.

```typescript
Request: { reason?: string }
Response: { message: "Programme declined" }
```

**GET `/api/client/my-pro`**
Get connected professional info (or null if unaffiliated).

```typescript
Response: {
  professional: {
    id: string;
    display_name: string;
    headline: string;
    specialties: string[];
    contact_email: string | null;
  } | null;
  relationship_since: string | null;
}
```

---

#### Key Files (Phase 5)

- `client/src/pages/ClientProgrammes.tsx` - Pending/active assignments view
- `client/src/pages/MyPro.tsx` - Connected professional info
- `client/src/components/AcceptProgrammeModal.tsx` - Accept/reject UI
- `client/src/lib/client-routines.ts` - React Query hooks for client operations
- `server/routes.ts` - Client assignment endpoints
- `server/supabase-routine-data.ts` - Session materialization, tier resolver
- `supabase/migrations/013_routine_assignment_sessions.sql` - New table + status updates

### Phase 6: Polish & Integration
- [ ] AI prompt optimization
- [ ] Audit trail improvements
- [ ] Analytics/reporting
- [ ] Video library integration prep

---

## Phase 4 Detailed Plan: Professional Portal Programme Management

### Overview

Phase 4 enables fitness professionals to manage programmes and assign them to clients through the `/pro` portal. This is the production user-facing workflow (not the admin panel).

### Prerequisites

- Professional must be authenticated via Supabase
- Professional must have a `professional_profiles` record
- Client must have an active `relationships` record linking them to the professional

### Relationship Validation

Before any assignment, the system must verify:

```typescript
// Check pro-client relationship exists and is active
async function verifyProClientRelationship(proId: string, clientId: string): Promise<boolean> {
  const { data } = await supabase
    .from('relationships')
    .select('id')
    .eq('professional_id', proId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single();
  
  return !!data;
}
```

### API Contracts

#### POST `/api/pro/routines/:id/assign`

Assign a programme to a connected client.

**Request:**
```typescript
{
  client_id: string;       // UUID - must be pro's client
  start_date?: string;     // ISO date
  end_date?: string;       // ISO date
  notes?: string;          // Max 500 chars
}
```

**Response (201):**
```typescript
{
  id: string;              // Assignment UUID
  routine_version_id: string;
  client_id: string;
  assigned_by_pro_id: string;
  status: 'active';
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}
```

**Errors:**
- `400` - Invalid request body (Zod validation)
- `403` - Client is not connected to this professional
- `404` - Routine not found or no active version

#### GET `/api/pro/clients/:clientId/assignments`

Get all assignments for a specific client.

**Validation:** Must verify `clientId` is connected to requesting professional.

**Response (200):**
```typescript
{
  assignments: Array<{
    id: string;
    programme: {
      id: string;
      name: string;
      description: string;
      goal: string;
    };
    status: 'active' | 'paused' | 'completed' | 'cancelled';
    start_date: string | null;
    end_date: string | null;
    created_at: string;
  }>;
}
```

#### GET `/api/pro/clients`

List all clients connected to this professional.

**Response (200):**
```typescript
{
  clients: Array<{
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    relationship_since: string;
    active_assignments: number;  // Count of active programme assignments
  }>;
}
```

### UI Flow

```
ProDashboard
├── Clients Tab (existing)
│   └── Client Card → Click → ProClientView
│       └── "Programmes" section
│           ├── Assigned Programmes list
│           └── "Assign Programme" button → AssignProgrammeModal
│               ├── Programme selector (My Programmes + Templates)
│               ├── Date range picker
│               ├── Notes field
│               └── Confirm button
│
└── Programmes Tab (new)
    ├── My Programmes grid
    ├── System Templates grid
    └── "Create Programme" button → Creation Wizard
        ├── Manual Builder (reuse from admin)
        ├── Template Clone
        └── AI-Assisted
```

### Cache Invalidation Strategy

Assignment mutations use a multi-key invalidation pattern to ensure UI consistency across different views:

**Query Keys:**
- `/api/pro/assignments` - Global assignments list (ProDashboard overview)
- `/api/pro/clients` - Client list (may include assignment counts)
- `/api/pro/clients/${clientId}/assignments` - Client-specific assignments (ProClientView Programmes tab)

**Mutation Hooks:**

```typescript
// useAssignRoutine - On success, invalidates all three keys
onSuccess: (_, variables) => {
  queryClient.invalidateQueries({ queryKey: ['/api/pro/assignments'] });
  queryClient.invalidateQueries({ queryKey: ['/api/pro/clients'] });
  queryClient.invalidateQueries({ queryKey: ['/api/pro/clients', variables.client_id, 'assignments'] });
}

// useUpdateProAssignment & useCancelProAssignment - Accept optional clientId for targeted invalidation
onSuccess: (_, variables) => {
  queryClient.invalidateQueries({ queryKey: ['/api/pro/assignments'] });
  queryClient.invalidateQueries({ queryKey: ['/api/pro/clients'] });
  if (variables.clientId) {
    queryClient.invalidateQueries({ queryKey: ['/api/pro/clients', variables.clientId, 'assignments'] });
  }
}
```

**Why Multi-Key Invalidation?**
- ProClientView uses a client-specific query key for assignments, separate from the global assignments query
- Without targeted invalidation, the Programmes tab wouldn't refresh after status changes
- The pattern ensures consistency regardless of which view initiated the mutation

### Middleware: `requireProfessional`

New middleware for pro routes:

```typescript
async function requireProfessional(req, res, next) {
  // 1. Validate Supabase auth (reuse requireSupabaseAuth)
  const user = await validateSupabaseToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  
  // 2. Check professional profile exists
  const { data: proProfile } = await supabase
    .from('professional_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();
  
  if (!proProfile) {
    return res.status(403).json({ error: 'Professional profile required' });
  }
  
  // 3. Inject into request
  req.supabaseUser = user;
  req.professionalId = proProfile.id;
  next();
}
```

### Implementation Sequence

```
Step 1: Backend Middleware ✅
    └── Create requireProfessional middleware
    └── Add getProClients() to supabase-routine-data.ts

Step 2: Pro Routine Routes ✅
    └── GET /api/pro/routines (list own + templates)
    └── GET /api/pro/clients (list connected clients)
    
Step 3: Pro Assignment Routes ✅
    └── POST /api/pro/routines/:id/assign (with relationship check)
    └── GET /api/pro/clients/:clientId/assignments
    └── PUT/DELETE assignment management

Step 4: Frontend - ProDashboard Updates ✅
    └── Add "Programmes" tab
    └── Programme grid component (reuse from admin)
    
Step 5: Frontend - ProClientView Updates ✅
    └── Add "Programmes" section
    └── AssignProgrammeModal component
    └── Assignment list with status badges
    └── Cache invalidation for assignment mutations

Step 6: Frontend - Programme Builder (PENDING)
    └── Reuse builder wizard from admin
    └── Adapt for pro ownership context
```

---

## Phase 2 Remaining Work: System Routine Builder (Detailed Plan)

### Overview

The System Routine Builder enables platform admins to create workout routine templates via two methods:
1. **Manual Builder**: Multi-step wizard for building routines exercise-by-exercise
2. **AI-Assisted Builder**: AI generates routine from description, lands in shared review screen

Both paths converge on a shared Review & Activation screen before saving.

---

### Implementation Sequence

```
Step 1: Backend Data Layer
    └── Extend supabase-routine-data.ts with blueprint/version CRUD
    
Step 2: Backend API Routes  
    └── Add Express routes with Zod validation
    
Step 3: Admin UI - Routines Tab
    └── Add "Routines" tab to AdminPage with template listing
    
Step 4: Manual Builder Wizard
    └── Multi-step form: Metadata → Sessions → Review
    
Step 5: AI-Assisted Builder
    └── Prompt form → AI call → lands in Review step
    
Step 6: Review & Activation
    └── Shared review screen, edit exercises, activate routine
```

---

### Step 1: Backend Data Layer

**File:** `server/supabase-routine-data.ts`

**New Functions:**

```typescript
// Routine Blueprints
getRoutineBlueprints(filters?: { ownerType?, isTemplate?, isArchived? })
getRoutineBlueprint(id: string)
createRoutineBlueprint(data: InsertRoutineBlueprint)
updateRoutineBlueprint(id: string, updates: Partial<RoutineBlueprint>)
deleteRoutineBlueprint(id: string)
cloneRoutineBlueprint(sourceId: string, newOwnerId?: string)

// Routine Versions
getRoutineVersions(blueprintId: string)
getRoutineVersion(id: string)
createRoutineVersion(data: InsertRoutineVersion)
updateRoutineVersion(id: string, updates: Partial<RoutineVersion>)
activateRoutineVersion(id: string)  // Sets status to 'active', archives others

// Routine Version Exercises
getVersionExercises(versionId: string)
setVersionExercises(versionId: string, exercises: InsertVersionExercise[])
// Note: Replaces all exercises atomically (delete + insert in transaction)

// AI Requests
createAIRoutineRequest(data: InsertAIRequest)
updateAIRoutineRequest(id: string, updates: Partial<AIRequest>)
```

**Data Integrity Rules:**
- Empty strings for required fields (name) are rejected
- Blueprint ownership fields (owner_type, owner_id) are immutable after creation
- Version status transitions: `draft` → `pending_review` → `active` (no backward)
- Deleting a blueprint cascades to versions and exercises

---

### Step 2: Backend API Routes

**File:** `server/routes.ts`

**Admin Routine Routes (14 endpoints):**

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| GET | `/api/admin/routines` | List system templates | Query: `?isTemplate=true&isArchived=false` |
| GET | `/api/admin/routines/:id` | Get blueprint with active version | - |
| POST | `/api/admin/routines` | Create new blueprint + draft version | See schema below |
| PUT | `/api/admin/routines/:id` | Update blueprint metadata | See schema below |
| DELETE | `/api/admin/routines/:id` | Soft-delete (archive) blueprint | - |
| POST | `/api/admin/routines/:id/clone` | Clone blueprint for editing | - |
| GET | `/api/admin/routines/:id/versions` | List all versions | - |
| POST | `/api/admin/routines/:id/versions` | Create new version | Version data |
| PUT | `/api/admin/routines/versions/:versionId` | Update version metadata | See schema below |
| DELETE | `/api/admin/routines/versions/:versionId` | Delete draft version | - |
| POST | `/api/admin/routines/versions/:versionId/activate` | Activate version | - |
| GET | `/api/admin/routines/versions/:versionId/exercises` | Get exercises | - |
| PUT | `/api/admin/routines/versions/:versionId/exercises` | Replace exercises | Exercise array |
| POST | `/api/admin/routines/ai-generate` | AI-assisted generation | AI request data |

**Request Schemas (Zod):**

```typescript
// Create Blueprint
const createBlueprintSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  goal_type_id: z.string().uuid().optional(),
  equipment_profile: z.array(z.string()).optional(),
  duration_weeks: z.number().int().min(1).max(52).optional(),
  sessions_per_week: z.number().int().min(1).max(7).optional(),
  is_template: z.boolean().default(true),
  creation_method: z.enum(['manual', 'template', 'ai_assisted']),
});

// Update Blueprint (partial, immutable fields excluded)
const updateBlueprintSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  goal_type_id: z.string().uuid().optional(),
  equipment_profile: z.array(z.string()).optional(),
  duration_weeks: z.number().int().min(1).max(52).optional(),
  sessions_per_week: z.number().int().min(1).max(7).optional(),
  is_archived: z.boolean().optional(),
  // Note: owner_type, owner_id, creation_method are IMMUTABLE
});

// Create Version
const createVersionSchema = z.object({
  notes: z.string().max(500).optional(),
});

// Update Version
const updateVersionSchema = z.object({
  notes: z.string().max(500).optional(),
  status: z.enum(['draft', 'pending_review']).optional(),
  // Note: 'active' status only via /activate endpoint
});

// Version Exercises (batch replace)
const versionExercisesSchema = z.array(z.object({
  exercise_id: z.string().uuid(),
  day_number: z.number().int().min(1),
  order_in_day: z.number().int().min(1),
  sets: z.number().int().min(1).max(20),
  reps_min: z.number().int().min(1).max(100),
  reps_max: z.number().int().min(1).max(100),
  rest_seconds: z.number().int().min(0).max(600),
  notes: z.string().max(500).optional(),
  superset_group: z.string().max(50).optional(),
}));

// AI Generation Request
const aiGenerateSchema = z.object({
  prompt_text: z.string().min(10).max(1000),
  equipment_selected: z.array(z.string()),
  goal_type_id: z.string().uuid(),
  sessions_per_week: z.number().int().min(1).max(7).default(3),
  duration_weeks: z.number().int().min(1).max(12).default(4),
});
```

**API Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Validation failure | `{ error: "Validation error", details: [...] }` |
| 404 | Resource not found | `{ error: "Blueprint not found" }` |
| 409 | Invalid state transition | `{ error: "Cannot delete active version" }` |
| 500 | Server/database error | `{ error: "Internal server error" }` |

---

### Step 3: Admin UI - Routines Tab

**File:** `client/src/pages/AdminPage.tsx`

Add fifth tab "Routines" to existing admin panel:

```
┌─────────────────────────────────────────────────────────────┐
│  Users  │  Equipment  │  Goals  │  Exercises  │  Routines  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [+ Create Routine]  [+ AI Generate]                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Name              │ Goal       │ Sessions │ Status  │   │
│  ├───────────────────┼────────────┼──────────┼─────────┤   │
│  │ PPL Hypertrophy   │ Hypertrophy│ 6/week   │ Active  │   │
│  │ Full Body Starter │ General    │ 3/week   │ Draft   │   │
│  │ ...               │            │          │         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Edit] [Clone] [Archive]                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- List all system templates (`owner_type = 'platform'`, `is_template = true`)
- Display routine name, goal, sessions/week, current version status
- Actions: Edit, Clone, Archive (soft-delete)
- "Create Routine" opens Manual Builder wizard
- "AI Generate" opens AI Builder form

---

### Step 4: Manual Builder Wizard

**Component:** `RoutineBuilderWizard` (within AdminPage or separate dialog)

**State Management:** React Context (`RoutineBuilderContext`)

```typescript
interface RoutineBuilderState {
  step: 'metadata' | 'sessions' | 'review';
  blueprint: Partial<RoutineBlueprint>;
  exercises: VersionExercise[];  // Grouped by day_number
  isDirty: boolean;
  errors: Record<string, string>;
}
```

**Step 1: Metadata**
```
┌─────────────────────────────────────────────────────────────┐
│  Create New Routine                              Step 1/3   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Routine Name *        [________________________]           │
│                                                             │
│  Description           [________________________]           │
│                        [________________________]           │
│                                                             │
│  Training Goal         [▼ Select Goal          ]           │
│                                                             │
│  Duration              [4 ] weeks                           │
│  Sessions per Week     [3 ] days                            │
│                                                             │
│  Equipment Available   ☑ Dumbbells  ☑ Barbell               │
│  (multi-select)        ☑ Cable      ☐ Machines              │
│                        ☑ Bench      ☑ Pull-up Bar           │
│                                                             │
│                               [Cancel]  [Next: Sessions →]  │
└─────────────────────────────────────────────────────────────┘
```

**Step 2: Sessions (Exercise Grid)**
```
┌─────────────────────────────────────────────────────────────┐
│  Build Sessions                                  Step 2/3   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Day 1 ────────────────────────────────────────────┐    │
│  │ 1. Bench Press       4x8-12  90s  [Edit] [Remove]  │    │
│  │ 2. Incline DB Press  3x10-12 60s  [Edit] [Remove]  │    │
│  │ 3. Cable Flyes       3x12-15 45s  [Edit] [Remove]  │    │
│  │                            [+ Add Exercise]         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─ Day 2 ────────────────────────────────────────────┐    │
│  │ (empty - click to add exercises)                    │    │
│  │                            [+ Add Exercise]         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  [+ Add Day]                                                │
│                                                             │
│                    [← Back]  [Cancel]  [Next: Review →]    │
└─────────────────────────────────────────────────────────────┘
```

**Add Exercise Dialog:**
```
┌─────────────────────────────────────────────────────────────┐
│  Add Exercise to Day 1                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Search: [_______________] [Filter: Chest ▼]               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ○ Bench Press (Barbell) - Chest                     │   │
│  │ ○ Incline Bench Press - Chest                       │   │
│  │ ● Dumbbell Flyes - Chest                            │   │
│  │ ○ Push-ups - Chest, Triceps                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Sets: [3 ]    Reps: [10] - [12]    Rest: [60 ] sec        │
│                                                             │
│  Notes: [________________________________]                  │
│                                                             │
│                               [Cancel]  [Add Exercise]      │
└─────────────────────────────────────────────────────────────┘
```

---

### Step 5: AI-Assisted Builder

**Flow:**
1. Admin clicks "AI Generate"
2. Opens prompt form (similar to Metadata but with free-text description)
3. Submit calls `/api/admin/routines/ai-generate`
4. Backend logs request to `routine_ai_requests`, calls OpenAI
5. AI response parsed, creates draft blueprint + version + exercises
6. User lands directly on Step 3 (Review) with AI-generated content

**AI Prompt Form:**
```
┌─────────────────────────────────────────────────────────────┐
│  AI-Assisted Routine Generation                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Describe the routine you want: *                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ A 4-day upper/lower split for intermediate lifters  │   │
│  │ focusing on progressive overload with compound      │   │
│  │ movements. Include accessory work for arms.         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Training Goal         [▼ Hypertrophy       ]              │
│                                                             │
│  Sessions per Week     [4 ]                                 │
│  Duration              [8 ] weeks                           │
│                                                             │
│  Equipment Available   ☑ Full Gym (all equipment)          │
│                        ☐ Custom selection...                │
│                                                             │
│                     [Cancel]  [Generate Routine →]          │
│                                                             │
│  ⚠️ AI generation typically takes 10-15 seconds            │
└─────────────────────────────────────────────────────────────┘
```

**Backend AI Flow:**

```
1. POST /api/admin/routines/ai-generate
   ↓
2. Insert into routine_ai_requests (status: 'pending')
   ↓
3. Call OpenAI with system prompt + user prompt
   ↓
4. Parse JSON response, validate against exercise_library
   ↓
5. Create routine_blueprint (creation_method: 'ai_assisted')
   ↓
6. Create routine_version (status: 'draft')
   ↓
7. Insert routine_version_exercises
   ↓
8. Update routine_ai_requests (status: 'completed', resulting_blueprint_id)
   ↓
9. Return blueprint ID → Frontend loads Review step
```

---

### Step 6: Review & Activation (Shared)

Both Manual and AI paths end here. This is Step 3 of the wizard.

```
┌─────────────────────────────────────────────────────────────┐
│  Review & Activate                               Step 3/3   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Summary ──────────────────────────────────────────┐    │
│  │ Name: PPL Hypertrophy Program                       │    │
│  │ Goal: Hypertrophy (8-12 reps, 60-90s rest)         │    │
│  │ Duration: 8 weeks, 6 sessions/week                  │    │
│  │ Equipment: Full Gym                                 │    │
│  │ Created via: AI-Assisted                            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─ Day 1: Push ──────────────────────────────────────┐    │
│  │ 1. Bench Press       4x8-12  90s  [Edit]           │    │
│  │ 2. Overhead Press    4x8-10  90s  [Edit]           │    │
│  │ 3. Incline DB Press  3x10-12 60s  [Edit]           │    │
│  │ 4. Lateral Raises    3x12-15 45s  [Edit]           │    │
│  │ 5. Tricep Pushdowns  3x12-15 45s  [Edit]           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─ Day 2: Pull ──────────────────────────────────────┐    │
│  │ ...                                                 │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│         [← Back to Edit]  [Save as Draft]  [Activate →]    │
└─────────────────────────────────────────────────────────────┘
```

**Actions:**
- **Back to Edit**: Return to Sessions step (Step 2)
- **Save as Draft**: Save blueprint + version with `status: 'draft'`
- **Activate**: Set version `status: 'active'`, make template available

---

### Success Criteria

#### Backend Data Layer
| Test | Pass Condition |
|------|----------------|
| Create blueprint | Returns valid UUID, `owner_type='platform'`, `is_template=true` |
| Create blueprint with empty name | Returns 400 error, no record created |
| Update blueprint | Only specified fields updated, immutable fields unchanged |
| Delete blueprint | Sets `is_archived=true`, does not delete record |
| Create version | Creates with `version_number=1`, `status='draft'` |
| Activate version | Sets `status='active'`, archives previous active version |
| Delete active version | Returns 409 error, version unchanged |
| Set version exercises | Replaces all exercises atomically, old exercises removed |

#### API Routes
| Test | Pass Condition |
|------|----------------|
| GET /routines | Returns only `is_template=true`, `is_archived=false` by default |
| POST /routines with invalid data | Returns 400 with Zod error details |
| PUT /routines/:id with immutable field | Field ignored, other updates applied |
| DELETE /versions/:id on draft | Deletes version and exercises |
| DELETE /versions/:id on active | Returns 409, no deletion |
| POST /ai-generate | Creates ai_request record, returns blueprint ID |

#### Routines Tab UI
| Test | Pass Condition |
|------|----------------|
| Load tab | Displays list of system templates with name, goal, sessions, status |
| Click Create Routine | Opens Manual Builder wizard at Step 1 |
| Click AI Generate | Opens AI prompt form |
| Click Edit on routine | Opens wizard with pre-filled data |
| Click Archive | Routine disappears from list (soft-deleted) |

#### Manual Builder Wizard
| Test | Pass Condition |
|------|----------------|
| Step 1 → Step 2 | Name required, transitions with metadata saved in context |
| Add exercise to day | Exercise appears in day list with correct details |
| Remove exercise | Exercise removed, order_in_day renumbered |
| Step 2 → Step 3 | Transitions to review with all exercises visible |
| Save as Draft | Creates blueprint + version + exercises, returns to list |
| Activate | Sets version active, template appears in list as Active |

#### AI Builder
| Test | Pass Condition |
|------|----------------|
| Submit AI prompt | Loading state shown, request logged in routine_ai_requests |
| AI success | Creates blueprint with `creation_method='ai_assisted'`, lands in review |
| AI returns unknown exercise | Logs warning, substitutes closest match or skips |
| AI request timeout | Shows error message, allows retry, logs failure status |

#### End-to-End Flow
| Test | Pass Condition |
|------|----------------|
| Manual: Create → Edit → Activate | Template visible in list, status=Active |
| AI: Generate → Review → Activate | Template visible in list, ai_request logged |
| Clone template | New blueprint created, original unchanged |

---

### Risk Mitigations

#### 1. Partial Saves / Orphan Data

**Risk:** Multi-table inserts (blueprint + version + exercises) fail partway, leaving orphan records.

**Mitigation:**
- Use Supabase RPC function for atomic multi-insert OR
- Implement cleanup: on version save failure, delete blueprint created in same request
- Frontend tracks `isDirty` state, prompts user before abandoning unsaved wizard

**Rollback Strategy:**
```typescript
try {
  const blueprint = await createBlueprint(data);
  const version = await createVersion(blueprint.id, versionData);
  await setVersionExercises(version.id, exercises);
} catch (error) {
  // Cleanup: delete blueprint if version/exercises failed
  if (blueprint?.id) await deleteBlueprint(blueprint.id);
  throw error;
}
```

#### 2. AI Response Validation

**Risk:** OpenAI returns exercise names not in our exercise_library.

**Mitigation:**
- Post-process AI response: for each exercise name, search exercise_library
- Use fuzzy matching (Levenshtein distance) to find closest match
- If match score < 80%, log warning and skip exercise
- Return `warnings` array in response for admin review

**Validation Flow:**
```typescript
for (const aiExercise of aiResponse.exercises) {
  const match = findClosestExercise(aiExercise.exercise_name);
  if (match.score >= 0.8) {
    exercises.push({ ...aiExercise, exercise_id: match.id });
  } else {
    warnings.push(`Unknown exercise: ${aiExercise.exercise_name}`);
  }
}
```

#### 3. AI Request Failures

**Risk:** OpenAI API timeout, rate limit, or error response.

**Mitigation:**
- Set 30-second timeout on API call
- Catch errors, update routine_ai_requests with `status='failed'`, `error_message`
- Return user-friendly error: "AI generation failed. Please try again."
- Implement retry button that creates new ai_request record
- Rate limit: max 10 AI requests per admin per hour

#### 4. Large Exercise Lists

**Risk:** 67+ exercises causing slow UI when selecting.

**Mitigation:**
- Implement pagination (20 exercises per page) in exercise picker
- Add search filter (by name, category, muscle group)
- Use React virtualization for long lists (react-window)
- Cache exercise list in React Query (stale time: 5 min)

#### 5. Concurrent Edits

**Risk:** Two admins editing same routine simultaneously, overwrites.

**Mitigation:**
- Include `version_number` in update requests
- Backend checks: if request.version_number !== db.version_number, return 409
- Frontend shows "Routine was modified by another user. Reload to continue."
- Consider: lock routine for 5 min while in wizard (future enhancement)

---

## AI Prompt Structure

### System Prompt (for OpenAI)
```
You are a certified personal trainer creating workout routines.
Generate a structured workout routine based on the user's requirements.

Output format: JSON with the following structure:
{
  "name": "Routine name",
  "description": "Brief description",
  "sessions_per_week": 3,
  "duration_weeks": 4,
  "days": [
    {
      "day_number": 1,
      "focus": "Upper Body Push",
      "exercises": [
        {
          "exercise_name": "Bench Press",
          "sets": 4,
          "reps_min": 8,
          "reps_max": 12,
          "rest_seconds": 90,
          "notes": "Focus on controlled eccentric"
        }
      ]
    }
  ]
}
```

### User Prompt Template
```
Create a workout routine with these specifications:
- Goal: {goal_type}
- Equipment available: {equipment_list}
- Sessions per week: {sessions}
- Duration: {weeks} weeks
- Additional notes: {user_description}
```

---

## Security Considerations

1. **AI Request Rate Limiting**: Limit AI routine generation per user/day
2. **Content Moderation**: Validate AI responses before storing
3. **Audit Trail**: Log all routine creation/modification actions
4. **Data Isolation**: Strict RLS to prevent cross-tenant data access
5. **Pro Verification**: Ensure professional role before accessing pro features

---

## Future Enhancements

1. **Exercise Video Library**
   - Admin video upload
   - CDN integration
   - In-app video player

2. **Routine Analytics**
   - Completion rates
   - Client feedback
   - Popular exercises

3. **Routine Marketplace**
   - Pros sell routine templates
   - Revenue sharing

4. **Progressive Overload Tracking**
   - Automatic weight/rep progression
   - Deload recommendations

---

## Document Version

- **Created**: November 30, 2025
- **Last Updated**: November 30, 2025
- **Status**: Planning Complete - Ready for Implementation
