# LOBA Tracker

## Overview
LOBA Tracker is a mobile-first Progressive Web App (PWA) for comprehensive health tracking. It offers multi-user authentication, AI-powered nutrition analysis (text, image, barcode), workout logging, weight/measurement tracking, and fasting analytics. The project's vision is to become an intuitive, scalable multi-tenant SaaS platform for personal health management, targeting the health and fitness market.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
LOBA Tracker is a PWA built with React 18, TypeScript, and Vite for the frontend, and an Express.js backend. Supabase serves as the sole data platform, managing PostgreSQL, authentication, Row-Level Security (RLS), and Storage.

### UI/UX Decisions
The frontend emphasizes accessibility and a mobile-first design, using Shadcn/ui (Radix UI) and Tailwind CSS. Key components include a color-coded BMI Tape Gauge and streamlined interfaces for food logging and workout progression. A "My Pro" tab on the client dashboard displays professional information or a "Find a Trainer" call to action.

### Technical Implementations
- **Authentication & Authorization:** Robust Supabase authentication with session management, timeout protection, and role-based access control (RBAC) via `admin_users` and RLS. A portal architecture provides distinct navigation and secure context switching between professional and client portals.
- **Data Management:** Supabase handles PostgreSQL, authentication, RLS, and Storage. A dual-value weight system prevents unit conversion drift. All internal data is stored in metric, with display/input converted to user preferences per domain (body weight, measurements, exercise weights, cardio distance, food weight, food volume).
- **AI Integration:** Features a 3-stage progressive fallback for food logging (AI analysis -> text re-description -> manual entry) and leverages OpenAI GPT-4o for AI routine generation. AI usage is managed by quotas and feature gating.
- **Workout & Nutrition:** Provides workout management with routine archiving and performance data. Professionals can send macro targets, and clients can log water intake.
- **Client-Professional Interaction:** Supports program acceptance, weekly check-ins, routine assignment (manual, template, AI-assisted), and a professional portal for enhanced profile management, review queues, and client interaction.
- **E-commerce & Monetization:** Integrates Stripe for premium subscriptions (free trial, grace periods) and Stripe Connect for trainers to onboard and create storefronts to sell products (one-time, subscription, packages) through a marketplace with admin approval and destination charges.
- **Operational Tooling:** An admin dashboard features analytics (GMV, trainer earnings, product sales), purchase state management, and webhook health monitoring.
- **Feature Gating:** Implements AI quotas (e.g., photo recognition, workout builder) with monthly resets, and active AI program constraints. Free users have limited teaser messaging for client-trainer communication.
- **Admin User Management:** Comprehensive admin capabilities including user search, role/premium filters, pagination, premium override, dependency preview, and soft deletion with an audit trail.
- **Performance Optimizations:** Analytics N+1 query fix, robust session fetching with retry logic to prevent random logouts, optimistic state clearing for sign-out, and lazy loading of pages.
- **Professional Storefront:** Enables trainers to create customizable public storefronts with profiles, branding, hero media, services, testimonials, and transformations. Includes a public marketplace for client discovery, with filtering and pagination.
- **Dual-View Architecture:** Public storefronts (`/s/{slug}`) for marketing/sharing use `storefront_services`, while authenticated in-app detail pages (`/marketplace/pro/:id`) display purchasable `trainer_products` with Stripe checkout integration.

### Feature Specifications
- **Admin Panel:** Manages system entities like users, equipment, goals, and exercises.
- **Professional Profiles:** Detailed profiles for professionals, including photos, experience, availability, and certifications.
- **Review Queue (Pro Portal):** AI-generated programs await trainer review before client assignment.
- **AI Routine Generation:** Utilizes OpenAI GPT-4o for generating workout routines.

## Recent Changes (December 2024)

### Client Connection Requests (Migration 072)
- **New Feature:** Clients can now request to work with professionals from the marketplace
- **Route:** `/marketplace/request/:id` - ClientRequestConnection page
- **Backend:** `POST /api/client/connection-requests` endpoint with proper validation
- **Database:** `client_connection_requests` table with partial unique index (only one pending request per client-professional pair)
- **Flow:** Client sends request with optional message → Professional receives and reviews → Professional can send invitation
- **Error Handling:** Proper HTTP status codes (503 for unavailable, 400 for duplicates, 500 for server errors)

### Professional Detail Page Redesign
- **Business Name Display:** Shows business name below professional name
- **Location with Time Difference:** Displays city/state with calculated timezone difference (e.g., "3h behind")
- **Accepting Clients Badge:** Green badge shown for non-connected professionals accepting new clients
- **Active Clients Count:** Shows number of active clients in stats row
- **Request to Work Together Button:** Green CTA button for non-connected clients when pro is accepting
- **Reordered Tabs:** About > Products > Reviews > Results (was Products > Reviews > About)
- **Dedicated Results Tab:** Client transformations (before/after photos) moved from Reviews to new Results tab

### Data Consolidation Plan
- PRO-DATA.md documents 3-phase plan to make trainer_storefronts single source of truth
- **Phase 1 COMPLETE:** Migration executed, location fields (city, state, country) added to trainer_storefronts
- **Phase 2 COMPLETE:** Form consolidation - ProProfileSetup.tsx now identity-only (display name, photo, location), removed duplicate fields (headline, bio, specialties, experience, accepting clients), added info banner linking to My Storefront
- **Phase 3 FULLY COMPLETE:** All backend API reads migrated to trainer_storefronts. ProProfileSetup.tsx dual-write removed; location now sources only from storefront API. Migration 070 executed - deprecated columns dropped from professional_profiles (bio, headline, specialties, experience_years, accepting_new_clients, pricing_summary, location_city, location_state, location_country).

### Professional ID Standardization Fix (Migration 071)
- **Root Cause:** `professional_id` stored `professional_profiles.id` in some places but RLS/joins expected auth user ID (`profiles.id`)
- **Result:** "Unknown Professional" errors and broken relationship lookups
- **Fix:** Migration 071 standardized all RPC functions and RLS policies to use auth user ID consistently
- **Fixed Functions:** create_invitation_with_permissions, fetch_invitation_details, finalize_invitation_permissions, get_client_permission_requests, create_permission_request
- **Fixed RLS:** 5 policies across invitations, invitation_permissions, and permission_requests tables
- **Documentation:** See docs/PROFESSIONAL-ID-FIX.md for full details
- **Note:** Existing test relationships must be deleted before creating new ones

### Admin Panel Fixes (December 2024)
- **Admin Logout Fix:** Added query cache invalidation (`queryClient.setQueryData` + `invalidateQueries`) before redirect to ensure proper logout
- **User Banning:** Supabase Auth `ban_duration` used for user lockout - safer than deletion when foreign key constraints exist
- **User Deletion Limitation:** Full deletion fails if user has related data (foreign keys); banning is the recommended approach

### Supabase User Management Options
- **Ban:** Set `ban_duration` (e.g., "24h", "876000h" for ~100 years), reversible with "none"
- **Delete:** Completely removes auth credentials, fails if user has related data
- **Note:** Bans don't immediately log users out - JWT valid until expiry (~1 hour)

### Known Admin Panel Issues (Pending Fix)
- Several admin endpoints return 500 errors due to `full_name` → `display_name` column rename from Migration 070
- Affected: `/api/admin/verification/requests`, `/api/admin/relationships`, `/api/admin/dashboard/activity`, `/api/admin/permission-presets`
- RPC functions need updating to use `display_name` column

### Future Payment Protection (Documented)
- See `docs/FUTURE-PAYMENT-PROTECTION.md` for deferred features:
  - Trainer deactivation cascade (auto-refunds)
  - Chargeback webhook handling
  - Refunds audit table
  - Daily earnings accrual
- These are intentionally deferred until transaction volume justifies implementation

## External Dependencies
*   **Supabase:** Primary database (PostgreSQL), Authentication, and Storage.
*   **OpenAI API:** Used for AI-driven food analysis and workout routine generation.
*   **Google Fonts:** Provides the "Inter" font family.
*   **Stripe:** Payment processing, subscription management, and Stripe Connect for trainer onboarding and marketplace.
*   **Key NPM Packages:** `@supabase/supabase-js`, `openai`, `@radix-ui/`, `@tanstack/react-query`, `date-fns`, `wouter`, `zod`.