# LOBA Tracker - Backlog

Ideas and features for future development, organized by priority and status.

---

## Priority Legend

- **P1 (High)** - Bugs or issues affecting data quality, fix soon
- **P2 (Medium)** - Important features that improve core functionality
- **P3 (Low)** - Nice-to-have improvements and polish

---

## Future Phases (Payment/Marketplace Roadmap)

These phases continue the payment and marketplace evolution from PAYMENT-MARKETPLACE.md (Phases 1-7 complete).

### Phase 8: Affiliate System (Est. 2+ weeks)

**Dependencies:** Phases 2-5 stable (Stripe Connect, Trainer Marketplace)

**Purpose:** Enable trainers to reward affiliates for client referrals.

**Note:** Only begin after marketplace is proven stable with real transactions.

**Scope:**
1. Affiliate user class
2. Referral link generation
3. Tracking and attribution
4. Commission configuration (per trainer)
5. Payout through Connect
6. Analytics dashboard

**Acceptance Criteria:**
- [ ] Affiliates can generate referral links
- [ ] Purchases tracked to referring affiliate
- [ ] Trainers set commission rates
- [ ] Affiliate payouts via Stripe Connect
- [ ] Dashboard shows referral analytics

---

### Phase 9: AI Nutrition Coach (Est. 5-7 days)

**Dependencies:** Phase 1 (Premium Subscriptions), Phase 6 (AI Quotas)

**Purpose:** Provide AI-powered nutrition guidance through a chat interface.

**Scope:**
1. Chat interface for nutrition questions
2. OpenAI integration for responses
3. Context-aware advice (based on user's logs)
4. Usage limits (monthly quota)
5. Premium gating

**Acceptance Criteria:**
- [ ] Chat UI for nutrition questions
- [ ] AI responses use user's food log context
- [ ] Monthly usage limit enforced
- [ ] Premium-only feature

---

### Phase 10: AI Progress Monitoring (Est. 4-5 days)

**Dependencies:** Phase 1 (Premium Subscriptions), Phase 6 (AI Quotas)

**Purpose:** Automated AI analysis of user progress with personalized insights.

**Scope:**
1. Trend analysis algorithms
2. Weekly/monthly insights generation
3. Notification system
4. Dashboard display
5. Premium gating

**Acceptance Criteria:**
- [ ] AI generates weekly progress summaries
- [ ] Insights displayed on dashboard
- [ ] Notification when new insights available
- [ ] Premium-only feature

---

## P1 - High Priority

### 1.0 Portal Architecture: Hard Fence Between Pro and Client Modes
**Status:** ✅ Architect Approved | **Tracking Doc:** [PORTAL-ARCHITECTURE.md](./PORTAL-ARCHITECTURE.md)

Implement explicit portal-context architecture that keeps professional and client sessions isolated. Same Supabase user can have both roles, but the app enforces which "portal" they're operating in.

**Scope:**
- Track A: Portal Context Foundation (signed cookie, role detection RPC, route guards)
- Track B: Navigation Isolation (conditional nav, role switcher, cache clearing)
- Track C: Backend Validation (context middleware, route protection)
- Track D: Storefront Preview Fix (preview frame, disabled CTAs, preview banner)

**Estimated Effort:** 6-10 hours

**Why P1:** Blocks proper storefront preview functionality and enforces clean role separation for the platform.

---

### 1.1 Programme vs Routine Terminology & Session-Based API
**Status:** 🔄 Incorporated into Client Experience work

Multi-day workout plans should be called "programmes" (a combination of routines for different days). The client expects one routine per workout session.

**Current state:** AI generates a "programme" with multiple days stored as one blueprint with `day_number` field. Client-side workout logger expects individual routines per session.

**Required changes:**
1. Define API contract: `GET /api/client/assignments/:id` returns `{ programme: {...}, sessions: [{ id, focus, exercises }] }`
2. Each `day_number` becomes a virtual "session" the client can select for a workout
3. Update terminology in UI from "routine" to "programme" where appropriate
4. Track workout completion per session/date against routine_assignments

---

### 1.2 Add Exercises to AI-Generated Programmes (Unaffiliated Clients)
**Status:** ❓ Scope TBD

For professionals, full exercise editing is complete (Phase 4A). Decision needed for unaffiliated clients:

- **Option A:** Accept/reject AI output only (simpler UX)
- **Option B:** Full editing like pros (more complex)

---

### 1.3 Similar Coercion Patterns (Audit Findings)
**Status:** Pending

The `parseFloat(value) || 0` pattern exists in several files and should be fixed using react-hook-form + Zod validation.

**Files affected:**
1. `client/src/components/ManualEntryModal.tsx` (lines 47-76) - Nutrition inputs
2. `client/src/components/EditFoodModal.tsx` (lines 123, 211, 223, 235, 247) - Nutrition inputs
3. `client/src/components/ActiveWorkoutSession.tsx` (line 323) - Reps input
4. `client/src/components/FastSetup.tsx` (lines 52-53) - Hours/minutes (acceptable for time)

---

### 1.4 WebSocket End-to-End QA Testing
**Status:** Pending

Comprehensive manual testing of the messaging WebSocket across different environments.

**Test Environments:**
1. Replit Preview - Development
2. Production Deployment - After publishing
3. Mobile Browser - iOS Safari, Android Chrome

**Test Cases:**

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Connection after login | Console shows authenticated successfully |
| 2 | Real-time message delivery | Messages appear instantly without refresh |
| 3 | Unread badge update | Badge increments in real-time |
| 4 | Mark as read sync | Badge clears when conversation opened |
| 5 | Reconnection after disconnect | Auto-reconnects after network loss |
| 6 | Tab switch recovery | Connection maintained or auto-reconnects |
| 7 | Multiple tabs same user | All tabs receive updates simultaneously |

---

### 1.5 User-Facing Toast for WebSocket Connection Errors
**Status:** Pending

When WebSocket connection fails, show a user-friendly notification instead of silent failure.

**Scenarios:**

| Scenario | Toast Message |
|----------|---------------|
| Invalid URL configuration | "Real-time messaging unavailable" |
| Connection failed after retries | "Connection lost. Messages may be delayed." |
| Reconnected successfully | "Connected" (brief) |

---

### 1.6 Conversation List Lock Indicator (Track 7C.4)
**Status:** Pending

Reflect teaser message lock state in the conversation list for free users who have exhausted their message quota with a trainer.

---

## P2 - Medium Priority

### 2.1 Recipe Analyzer (Multi-Ingredient Nutrition Aggregation)
**Status:** Planned  
**Dependencies:** FDA Nutrition System (Complete)

Allow users to create recipes by combining multiple ingredients, aggregate FDA nutritional data for all 31 tracked nutrients, and save with a "serves X" value for per-serving calculations.

**Business Value:**
- Enables accurate nutrition tracking for home-cooked meals
- Premium feature opportunity (feature gate: `recipe_builder`)
- Differentiator from competitors that only support single-food logging
- Reuses existing FDA nutrition infrastructure

**Implementation Phases:**
1. Core Recipe CRUD (~2-3 hours)
2. Ingredient Management (~3-4 hours)
3. Nutrition Aggregation (~2-3 hours)
4. Meal Logging Integration (~1-2 hours)
5. Polish (~2-3 hours)

---

### 2.2 Password Reset via Email
**Status:** Planned  
**Dependencies:** None (Supabase built-in)

Allow users to reset their password via email.

**Implementation:**
1. Add "Forgot Password?" link on LoginPage.tsx
2. Create email input form that calls `supabase.auth.resetPasswordForEmail()`
3. Create ResetPassword page to handle magic link
4. Add redirect URL to Supabase Auth settings

**No backend changes needed** - Supabase handles email sending and token verification.

---

### 2.3 Progress Photo Watermarking for Professional Viewing
**Status:** Planned

When professionals view client progress photos, apply a diagonal watermark to protect client privacy.

**Watermark specification:**
- Text: "Progress photo for [Professional Name] [Date]"
- Style: White text with black outline
- Position: Diagonal across the image
- Only applied when viewed by professionals

**Technical approach:** Server-side watermarking using Sharp library.

---

### 2.4 Unmatched Exercise Queue for Admins
**Status:** Planned

When trainers create routines, exercise names may not match existing database entries. Create a queue for admin review.

**Features:**
1. Capture unmatched exercises to a queue
2. Admin review interface with quick actions:
   - "Add to Library" - Opens exercise creation form
   - "Mark as Duplicate/Alias" - Links to existing exercise
   - "Dismiss" - Marks as reviewed but not added

---

### 2.5 Copy Meal from Past Day
**Status:** Planned

Copy all food items from a past meal to another day.

**User flow:**
1. Browse to a past date
2. Tap "Copy" on a meal card
3. Pick a target date within the backfill window
4. All items get added to that day's corresponding meal

---

### 2.6 Admin Minimum Age Policy
**Status:** Planned

Admin-configurable policy setting for minimum age allowed to use the platform.

**Features:**
- `app_settings` database table for platform-wide configuration
- `min_user_age` setting with initial default of 15 years
- Admin UI to view and update the setting
- Frontend and backend validation during signup

---

## P3 - Low Priority

### 3.1 WebSocket Security Hardening
**Status:** Planned

Add security hardening to the messaging WebSocket server.

**Features:**
1. **Origin Allowlist** - Validate Origin header, reject unauthorized origins
2. **Per-IP Connection Limits** - Limit connections per IP (e.g., 10)
3. **Rate Limiting** - Limit messages per connection per minute

---

### 3.2 Query Key Naming Convention Cleanup
**Status:** Planned

Normalize React Query keys to strict camelCase for consistency.

**Current:** Kebab-case (e.g., `["fasts-history"]`, `["workout-session-details", id]`)
**Proposed:** CamelCase (e.g., `["fastsHistory"]`, `["workoutSessionDetails", id]`)

**Priority:** Low (cosmetic consistency, no functional impact)

---

## Completed Features

### ✅ FDA/USDA Nutrition System (Phase 6)
FDA FoodData Central integration complete with:
- 31 tracked nutrients as single source of truth
- `useFDASearch`, `useFDAFood` hooks
- Nutrient snapshot pattern for storing complete profiles
- Write-through cache in `fda_foods_cache`
- Feature gating for subscription plans

---

### ✅ Avatar System
Users can select preset avatars or upload profile photos:
- Unified `profile-photos` bucket in Supabase Storage
- Avatar picker with preset options
- Profile photo upload with size limits
- Shadcn Avatar component with fallback initials

---

### ✅ Trainer Marketplace (Phases 3-4)
Complete trainer product marketplace:
- Product creation and management
- Admin approval queue
- Client-facing marketplace page
- Trainer storefronts with customizable profiles
- Premium gating for purchases

---

### ✅ Professional Food Logging Form UX
Replaced `parseFloat(value) || 0` coercion with react-hook-form + Zod validation.

**File:** `client/src/pages/pro/ProClientView.tsx`

---

### ✅ Edit Saved Programmes (Phase 4A)
Trainers can fully edit saved programmes:
- Modify name, description, goal, duration, sessions/week
- Add/remove/reorder exercises
- Adjust sets/reps/rest/weight inline

---

### ✅ Add Exercises to AI-Generated Programmes (Professionals)
Trainers can add exercises to AI-generated programmes during review:
- Add Exercise button in AI review step
- Reuses exercise selector from Manual Builder
- Can add to any day in the programme

---

### ✅ Teaser Messaging (Phase 7)
Limited messaging for free users to sample trainer communication:
- 4 messages per side (client→trainer, trainer→free client)
- One-time allowance (no reset)
- Premium bypass for unlimited messaging
- Counter display and upgrade prompt in chat UI

---

## Archive (No Longer Applicable)

### Professional Marketplace (Original Concept)
**Status:** ✅ Superseded by Phases 3-4

Original concept for professional discovery has been replaced by the Trainer Marketplace and Storefronts implementation in PAYMENT-MARKETPLACE.md Phases 3-4.

---

### Payments-Based Relationship Validation Layer
**Status:** ✅ Incorporated into Phase 1-7

Payment system is now complete with:
- Premium subscriptions (Phase 1)
- Stripe Connect (Phase 2)
- Marketplace integration (Phases 3-5)
- Feature gating (Phase 6)
- Teaser messaging (Phase 7)

---

### USDA FoodData Central Integration (Original)
**Status:** ✅ Implemented as FDA Nutrition System

The original USDA integration proposal has been implemented as the FDA Nutrition System in Phase 6 with comprehensive nutrient tracking.
