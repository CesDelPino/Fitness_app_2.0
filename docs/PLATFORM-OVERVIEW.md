# LOBA Tracker - Complete Platform Documentation

## Table of Contents
1. [Platform Overview](#platform-overview)
2. [User Classes & Roles](#user-classes--roles)
3. [Authentication & Access Control](#authentication--access-control)
4. [All Pages & Views](#all-pages--views)
5. [User Interaction Flows](#user-interaction-flows)
6. [Data Model & Relationships](#data-model--relationships)
7. [Technical Architecture](#technical-architecture)
8. [Third-Party Integrations](#third-party-integrations)

---

## Platform Overview

LOBA Tracker is a **mobile-first Progressive Web App (PWA)** for comprehensive health and fitness tracking. It serves as a multi-tenant SaaS platform connecting fitness professionals (trainers, nutritionists, coaches) with their clients.

### Core Value Proposition
- **For Clients**: Track nutrition, workouts, weight, measurements, and fasting with AI-powered food logging (text, image, barcode scanning)
- **For Professionals**: Manage clients, assign programs, review check-ins, sell products/services through a marketplace
- **For Admins**: Oversee platform operations, manage users, approve products, monitor business metrics

### Target Market
Health and fitness enthusiasts seeking comprehensive tracking, and fitness professionals looking to scale their coaching businesses with digital tools.

---

## User Classes & Roles

### 1. Client (Regular User)
**Description**: End users who track their health metrics and may work with fitness professionals.

**Capabilities**:
- Log food intake (AI text/image analysis, barcode scanning, manual entry)
- Track workouts (strength training, cardio, custom activities)
- Record weight and body measurements
- View fasting analytics
- Set and track nutrition targets
- Browse the trainer marketplace
- Request to work with professionals
- Accept invitations from professionals
- Submit weekly check-ins to assigned professionals
- Purchase products/services from professionals
- Subscribe to premium features

**Access Level**: Standard authenticated access to client portal

---

### 2. Professional (Trainer/Nutritionist/Coach)
**Description**: Fitness industry professionals who manage and coach clients through the platform.

**Subtypes**:
- `trainer` - Personal trainers focused on workout programming
- `nutritionist` - Nutrition specialists focused on diet planning
- `coach` - Holistic coaches who may do both

**Capabilities**:
- Manage client roster and relationships
- Send invitations to new clients
- View client data (with permission)
- Assign workout programs and routines
- Set nutrition/macro targets for clients
- Create and manage check-in templates
- Review client check-in submissions
- Create and sell products (one-time, subscription, packages)
- Build and customize public storefront
- Use AI to generate workout routines
- Send messages to connected clients
- Access professional portal with dedicated UI

**Access Level**: Must have `professional_profiles` record with `verification_status = 'approved'`

**Verification States**:
- `pending` - Application submitted, awaiting admin review
- `approved` - Full access to professional features
- `rejected` - Application denied

---

### 3. Admin
**Description**: Platform operators with elevated privileges for system management.

**Capabilities**:
- View business analytics (GMV, trainer earnings, sales metrics)
- Manage users (search, filter, ban, override premium status)
- Review and approve professional verification requests
- Approve/reject trainer products for marketplace
- Manage system catalog (exercises, equipment, goals, activities)
- Monitor webhook health and system status
- Force-connect or disconnect client-professional relationships
- View audit trails and activity logs

**Access Level**: Separate authentication via session cookies (not Supabase JWT)

---

### 4. Public (Unauthenticated Visitors)
**Description**: Users browsing public-facing pages without an account.

**Can Access**:
- Public storefront pages (`/s/:slug`)
- Marketplace demo pages
- Login/signup pages

---

## Authentication & Access Control

### Authentication Methods

| User Type | Method | Storage |
|-----------|--------|---------|
| Client/Professional | Supabase Auth (JWT) | Browser storage + cookies |
| Admin | Session-based | Server-side session |

### Portal Context System

The platform uses a **dual-portal architecture** allowing users to switch between client and professional views:

```
User Login → Check Available Roles → Set Portal Context Cookie → Access Appropriate Portal
```

**Portal Modes**:
- `client` - Access client-specific routes and features
- `pro` - Access professional-specific routes and features

**Context Switching**:
- Users with both roles can switch between portals
- Context stored in signed cookie (`loba_portal_ctx`)
- Each portal has dedicated header, navigation, and feature set

### Route Protection Middleware

| Middleware | Purpose |
|------------|---------|
| `requireSupabaseAuth` | Validates JWT token, attaches user to request |
| `requireClientPortalContext` | Ensures client mode active |
| `requireProPortalContext` | Ensures professional mode active |
| `requireAdmin` | Validates admin session |

---

## All Pages & Views

### Client Portal Routes (`/`)

| Route | Page Component | Description |
|-------|----------------|-------------|
| `/` | Dashboard | Home screen with daily summary, macros, water intake |
| `/log` | Analytics | Detailed nutrition and activity analytics |
| `/train` | Train | Workout logging, routines, exercise history |
| `/weigh-in` | WeighIn | Weight and measurement tracking |
| `/settings` | Settings | User preferences, units, account settings |
| `/messages` | Messages | Chat with connected professionals |
| `/messages/:id` | Messages | Specific conversation thread |
| `/messages/preferences` | MessagingPreferences | Notification and messaging settings |
| `/marketplace` | Marketplace | Browse available professionals |
| `/marketplace/pro/:id` | ProfessionalDetail | View professional's detail page |
| `/marketplace/request/:id` | ClientRequestConnection | Send request to work with professional |
| `/trainer/:slug` | TrainerStorefront | Public storefront (in-app view) |
| `/check-in/:id` | CheckInForm | Submit weekly check-in to professional |
| `/subscription` | Subscription | Manage premium subscription |
| `/subscription/success` | SubscriptionSuccess | Post-payment success page |
| `/subscription/cancel` | SubscriptionCancel | Subscription cancellation |

---

### Professional Portal Routes (`/pro/*`)

| Route | Page Component | Description |
|-------|----------------|-------------|
| `/pro` | ProDashboard | Overview of clients, pending tasks, stats |
| `/pro/profile` | ProProfileSetup | Professional identity setup (name, photo, location) |
| `/pro/invite` | ProInvite | Send invitations to potential clients |
| `/pro/client/:clientId` | ProClientView | View specific client's data and progress |
| `/pro/messages` | Messages | Client messaging interface |
| `/pro/messages/:id` | Messages | Specific client conversation |
| `/pro/programmes/new` | ProProgrammeNew | Create new workout program |
| `/pro/programmes/:id` | ProProgrammeEdit | Edit existing program |
| `/pro/check-ins/templates` | ProCheckInTemplates | Manage check-in question templates |
| `/pro/check-ins/templates/new` | ProCheckInTemplateEdit | Create check-in template |
| `/pro/check-ins/templates/:id` | ProCheckInTemplateEdit | Edit check-in template |
| `/pro/check-ins/submissions/:id` | ProCheckInSubmissionView | Review client check-in submission |
| `/pro/products` | ProProducts | Manage products and pricing |
| `/pro/storefront` | ProStorefront | Configure public storefront |
| `/pro/storefront-preview` | StorefrontPreview | Preview storefront as public visitor |

---

### Admin Routes (`/admin/*`)

| Route | Page Component | Description |
|-------|----------------|-------------|
| `/admin/login` | AdminLoginPage | Admin authentication |
| `/admin/business/*` | AdminBusinessPage | Business analytics, GMV, sales, webhooks |
| `/admin/users/*` | AdminUsersPage | User management, verification, banning |
| `/admin/catalog/*` | AdminCatalogPage | Exercise library, equipment, goals |
| `/admin/system/*` | AdminSystemPage | System settings, permissions, presets |

---

### Public Routes (No Auth Required)

| Route | Page Component | Description |
|-------|----------------|-------------|
| `/s/:slug` | PublicStorefront | Professional's public storefront page |
| `/s/demo/:template` | StorefrontTemplates | Storefront template demos |
| `/marketplace/demo` | MarketplaceDemo | Marketplace preview for non-users |
| `/marketplace/trainer/:id` | TrainerProfileDemo | Trainer profile demo view |
| `/pro/accept/:token` | ProAcceptInvite | Accept invitation link (token-based) |
| `/reset-password` | ResetPassword | Password reset flow |

---

## User Interaction Flows

### Flow 1: Client-Professional Connection (via Invitation)

```
Professional                          Client
     |                                   |
     |-- Creates invitation ------------>|
     |   (email, role type, permissions) |
     |                                   |
     |   <--- Receives email/link -------|
     |                                   |
     |   <--- Clicks accept link --------|
     |                                   |
     |-- Relationship created -----------|
     |   (permissions granted)           |
     |                                   |
     |<-- Client visible in roster ------|
```

### Flow 2: Client-Professional Connection (via Request)

```
Client                                Professional
   |                                       |
   |-- Browses marketplace --------------->|
   |                                       |
   |-- Views professional profile -------->|
   |                                       |
   |-- Clicks "Request to Work Together"-->|
   |   (sends message)                     |
   |                                       |
   |   <---- Receives request notification-|
   |                                       |
   |   <---- Reviews request --------------|
   |                                       |
   |   <---- Sends invitation (if approved)|
   |                                       |
   |-- Accepts invitation ---------------->|
   |                                       |
   |<-- Relationship established ----------|
```

### Flow 3: Program Assignment

```
Professional                          Client
     |                                   |
     |-- Creates program ----------------|
     |   (AI-assisted or manual)         |
     |                                   |
     |-- Assigns to client --------------|
     |                                   |
     |   <-- Client sees pending --------|
     |       program                     |
     |                                   |
     |   <-- Client accepts program -----|
     |                                   |
     |<-- Program now active ------------|
     |    (visible in Train section)     |
```

### Flow 4: Weekly Check-In

```
Professional                          Client
     |                                   |
     |-- Configures check-in template ---|
     |   (questions, schedule)           |
     |                                   |
     |   <-- Check-in notification ------|
     |       (weekly)                    |
     |                                   |
     |   <-- Client submits check-in ----|
     |       (answers, photos, weight)   |
     |                                   |
     |-- Reviews submission -------------|
     |   (in Pro dashboard queue)        |
     |                                   |
     |-- Provides feedback --------------|
     |   (via messages)                  |
```

### Flow 5: Product Purchase

```
Client                           Professional             Stripe
   |                                  |                      |
   |-- Views storefront ------------->|                      |
   |                                  |                      |
   |-- Selects product -------------->|                      |
   |                                  |                      |
   |-- Clicks purchase -------------->|                      |
   |                                  |                      |
   |------------------------ Checkout session created ------>|
   |                                  |                      |
   |<----------------------- Redirect to Stripe checkout ----|
   |                                  |                      |
   |-- Completes payment ---------------------------------->|
   |                                  |                      |
   |<----------------------- Webhook: payment success -------|
   |                                  |                      |
   |<-- Access granted --------------|<-- Earnings credited-|
```

### Flow 6: Professional Verification

```
User                              Admin
  |                                  |
  |-- Submits pro application ------>|
  |   (credentials, experience)      |
  |                                  |
  |   <-- Appears in review queue ---|
  |                                  |
  |   <-- Admin reviews -------------|
  |                                  |
  |   <-- Approved/Rejected ---------|
  |                                  |
  |-- If approved: full pro access ->|
```

---

## Data Model & Relationships

### Core User Tables

```
profiles (Supabase auth users)
├── id (UUID) - matches auth.users.id
├── display_name
├── role ('client' | 'professional')
├── photo_url
├── unit preferences (weight, distance, volume)
└── timezone, location

professional_profiles
├── id (UUID)
├── user_id → profiles.id
├── role_type ('trainer' | 'nutritionist' | 'coach')
├── verification_status
├── Stripe Connect account info
└── accepting_new_clients (boolean)

trainer_storefronts (single source of truth for pro public info)
├── id (UUID)
├── trainer_id → professional_profiles.user_id
├── slug (URL-friendly identifier)
├── headline, bio, specialties
├── cover_image_url
├── location (city, state, country)
├── is_published
└── social links
```

### Relationship & Permission Tables

```
client_professional_relationships
├── id (UUID)
├── client_id → profiles.id
├── professional_id → profiles.id
├── status ('active' | 'terminated')
└── created_at

client_permissions
├── id (UUID)
├── relationship_id → client_professional_relationships.id
├── permission_slug
├── status ('granted' | 'revoked' | 'pending')
├── granted_by ('client' | 'admin' | 'system')
└── granted_at, revoked_at

permission_definitions
├── slug (unique identifier)
├── display_name
├── description
├── category
├── is_exclusive (only one pro can hold)
└── is_enabled

invitations
├── id (UUID)
├── professional_id
├── client_email
├── token (unique)
├── role_type
├── status ('pending' | 'accepted' | 'expired')
└── expires_at

client_connection_requests
├── id (UUID)
├── client_id → profiles.id
├── professional_id → profiles.id
├── message (optional)
├── status ('pending' | 'accepted' | 'rejected' | 'expired')
└── created_at
```

### Health Tracking Tables

```
food_logs
├── id, user_id
├── food_name, quantity, unit
├── calories, protein, carbs, fat, fiber
├── meal_type, logged_at
├── barcode, food_item_id
└── nutrient_snapshot (JSON)

weight_logs
├── id, user_id
├── weight_kg (stored in metric)
├── measured_at
└── notes

body_measurements
├── id, user_id
├── measurement_type
├── value_cm (stored in metric)
└── measured_at

workout_sessions
├── id, user_id
├── date, workout_type
├── routine_id, routine_name
├── duration_minutes, notes
└── calories_burned

workout_sets
├── id, session_id
├── exercise_name
├── weight_kg, reps
├── set_number
└── is_warmup
```

### Program & Routine Tables

```
workout_routines
├── id, user_id
├── name, type
├── archived (boolean)
├── created_at, last_used_at

routine_exercises
├── id, routine_id
├── exercise_name
├── order_index
├── target_sets, target_reps

assigned_programmes (from pro to client)
├── id
├── client_id, professional_id
├── name, description
├── status ('pending' | 'active' | 'completed')
├── routine_data (JSON)
└── ai_generated (boolean)
```

### Marketplace & Commerce Tables

```
trainer_products
├── id, trainer_id
├── stripe_product_id
├── name, description
├── product_type ('one_time' | 'subscription' | 'package')
├── status ('draft' | 'pending_review' | 'approved' | 'rejected')
├── media_urls, features_included
└── approval metadata

product_pricing
├── id, product_id
├── stripe_price_id
├── amount_cents, currency
├── billing_interval, interval_count
└── is_primary

product_purchases
├── id
├── product_id, pricing_id
├── client_id, trainer_id
├── stripe_checkout_session_id
├── amount_total_cents
├── status ('pending' | 'completed' | 'refunded')
└── purchased_at

user_subscriptions (platform subscription)
├── id, user_id
├── stripe_subscription_id
├── status, current_period_start/end
└── trial_start/end
```

### AI & Feature Gating Tables

```
ai_usage_counters
├── id, user_id
├── feature_code
├── usage_month
└── usage_count

ai_feature_quotas
├── feature_code
├── monthly_limit
├── is_active
└── description

subscription_plans
├── id, name
├── stripe_price_id
├── tier ('free' | 'premium' | 'pro')
└── features (JSON)
```

---

## Technical Architecture

### Frontend Stack

```
React 18 + TypeScript + Vite
├── UI Framework: Shadcn/ui (Radix primitives)
├── Styling: Tailwind CSS
├── Routing: Wouter
├── State Management: TanStack Query (React Query v5)
├── Forms: React Hook Form + Zod validation
├── Icons: Lucide React
└── Animations: Framer Motion
```

### Backend Stack

```
Express.js + TypeScript
├── Database: PostgreSQL (via Supabase)
├── ORM: Raw Supabase client (not Drizzle for queries)
├── Schema Validation: Zod
├── Session: express-session + memorystore
├── Auth: Supabase Auth + JWT validation
└── File Uploads: Multer → Supabase Storage
```

### Key Server Modules

| Module | Purpose |
|--------|---------|
| `server/routes.ts` | All API endpoints (~11,000 lines) |
| `server/supabase-admin.ts` | Supabase admin client initialization |
| `server/supabase-permissions.ts` | Permission system logic |
| `server/portal-context.ts` | Portal switching and context management |
| `server/supabase-admin-data.ts` | Admin authentication and data access |
| `server/openai-service.ts` | OpenAI API integration for AI features |
| `server/stripe-service.ts` | Stripe payment processing |

### API Route Organization

```
/api/auth/*          - Authentication, portal context
/api/admin/*         - Admin operations
/api/pro/*           - Professional portal endpoints
/api/client/*        - Client portal endpoints
/api/marketplace/*   - Public marketplace data
/api/nutrition/*     - Food logging, targets
/api/workout/*       - Exercise, sessions, routines
/api/messages/*      - Real-time messaging
/api/stripe/*        - Payment webhooks
/api/ai/*            - AI feature endpoints
```

---

## Third-Party Integrations

### Supabase
- **PostgreSQL Database**: All data storage
- **Authentication**: User signup, login, password reset
- **Row-Level Security (RLS)**: Database-level access control
- **Storage**: Image uploads (profile photos, check-in images)

### Stripe
- **Stripe Connect**: Professional onboarding and payouts
- **Checkout Sessions**: Product purchases
- **Subscriptions**: Recurring payments for products and platform
- **Webhooks**: Payment event handling
- **Destination Charges**: Platform takes commission on sales

### OpenAI
- **GPT-4o**: AI food analysis from text/images
- **Workout Generation**: AI-assisted routine creation
- **Image Analysis**: Food photo recognition

### Other Services
- **Google Fonts**: Typography (Inter font family)
- **Barcode APIs**: Food barcode lookup (FDA API)

---

## Environment Variables

### Required Secrets
```
DATABASE_URL          - PostgreSQL connection string
SUPABASE_URL         - Supabase project URL
SUPABASE_ANON_KEY    - Supabase anonymous key
SUPABASE_SERVICE_KEY - Supabase service role key
OPENAI_API_KEY       - OpenAI API key
STRIPE_SECRET_KEY    - Stripe secret key
STRIPE_WEBHOOK_SECRET - Stripe webhook signing secret
SESSION_SECRET       - Express session encryption
ADMIN_PASSWORD       - Platform admin password
FDA_API_KEY          - FDA food database API
```

---

## Development Notes

### Running Locally
```bash
npm run dev          # Starts both frontend (Vite) and backend (Express)
```

### Database Migrations
Migrations are in `supabase/migrations/` directory, numbered sequentially (e.g., `072_client_connection_requests.sql`).

### Key Design Decisions
1. **Metric Storage**: All weights/measurements stored in metric internally, converted for display
2. **Single Source of Truth**: `trainer_storefronts` is the authoritative source for professional public info
3. **Portal Architecture**: Users switch contexts rather than having separate accounts
4. **Permission System**: Granular, explicit permissions rather than role-based
5. **AI Quotas**: Feature usage tracked monthly with configurable limits

---

*Document generated December 2024*
