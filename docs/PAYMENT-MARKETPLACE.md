# LOBA Tracker - Payment & Marketplace System

## Overview

This document outlines the implementation plan for integrating Stripe payments, premium subscriptions, and a trainer marketplace into LOBA Tracker. The system enables monetization through premium subscriptions while providing trainers a free platform to sell their products and services.

**Document Status:** Architect Approved (Dec 2024)

**Test Accounts:** See [TEST_ACCOUNTS_LOGIN.md](./TEST_ACCOUNTS_LOGIN.md) for test credentials including:
- Client account (lilly@delpino.com)
- Professional account (cesar@delpino.com)  
- Admin account (LOBAFIT / FIT2025)

---

## 1. Business Model

### Revenue Strategy

| Revenue Source | Description | Who Pays |
|----------------|-------------|----------|
| **Premium Subscriptions** | Primary revenue - clients pay for premium features | Clients pay LOBA |
| **Trainer Products** | Trainers keep 100% (minus Stripe fees ~2.9%) | Clients pay Trainers |
| **Affiliate Commissions** | Affiliates bring clients, paid by trainers | Trainers pay Affiliates |

### Key Principle
> LOBA provides the marketplace infrastructure for FREE to trainers. This attracts trainers who bring paying clients. Clients must be Premium members to access trainer features, driving subscription revenue.

---

## 2. User Classes

| User Class | Description | Access Level | Revenue Impact |
|------------|-------------|--------------|----------------|
| **Free Client** | Basic app features, can browse trainers | Limited | Acquisition funnel |
| **Premium Client** | Full features, trainer connections | Full | **$9.99/month** |
| **Professional (Trainer)** | Creates products, serves clients | Full + Pro tools | Indirect (brings clients) |
| **Affiliate** (Future) | Markets trainer products | Limited | Paid by trainers |
| **Admin** | Platform management | Administrative | N/A |

---

## 3. Pricing Structure

### Premium Subscription Tiers

| Plan | Duration | Base Price | Discount | Monthly Rate |
|------|----------|------------|----------|--------------|
| Monthly | 1 month | $9.99 | - | $9.99/mo |
| Quarterly | 3 months | TBD (admin-set) | ~17% | ~$8.33/mo |
| Semi-Annual | 6 months | TBD (admin-set) | ~25% | ~$7.50/mo |
| Annual | 12 months | TBD (admin-set) | ~33% | ~$6.67/mo |

*All prices are admin-controlled and can be adjusted at any time.*

### Free Trial
- **Duration:** 7 days
- **Frequency:** Once per 12 calendar months
- **Requires:** Credit card upfront
- **Behavior:** Auto-converts to paid subscription on day 8

### Grace Period
- **Duration:** 3 days after payment failure
- **Behavior:** Full access during grace period, then downgrade

---

## 4. Feature Matrix

### Food & Nutrition Features

| Feature | Free | Premium | Implementation Status |
|---------|------|---------|----------------------|
| Manual food entry | ✅ | ✅ | Built |
| Text food search (FDA) | ✅ | ✅ | Built |
| Barcode scanning | ✅ | ✅ | Built |
| Basic macros (cal/protein/carbs/fat) | ✅ | ✅ | Built |
| Fiber & sugar display | ❌ | ✅ | Built (gated) |
| Micronutrients (vitamins/minerals) | ❌ | ✅ | Built (gated) |
| Detailed fats | ❌ | ✅ | Built (gated) |
| AI photo recognition | ❌ | ✅ (50/month) | Built (gated) |
| AI Nutrition Coach | ❌ | ✅ | Future |

### Workout Features

| Feature | Free | Premium | Implementation Status |
|---------|------|---------|----------------------|
| Basic workout logging | ✅ | ✅ | Built |
| Template workouts | ✅ (limited) | ✅ (all) | Needs admin control |
| AI Custom Workout Builder | ❌ | ✅ (3-5/month, 1 active) | Built (needs client access) |
| AI Progress Monitoring | ❌ | ✅ | Future |

### Tracking Features

| Feature | Free | Premium | Implementation Status |
|---------|------|---------|----------------------|
| Fasting tracker | ✅ | ✅ | Built |
| Weight/measurements | ✅ | ✅ | Built |

### Trainer Marketplace Features

| Feature | Free | Premium | Implementation Status |
|---------|------|---------|----------------------|
| View trainer pages | ✅ | ✅ | Built |
| View trainer products | ✅ | ✅ | Built |
| Teaser messages (4 per trainer) | ✅ | - | Phase 7 |
| Unlimited messaging | ❌ | ✅ | Built |
| Audio/video/media in chat | ❌ | ✅ | Built |
| Connect with trainer | ❌ | ✅ | Built |
| Access trainer products | ❌ | ✅ | Phase 4-5 |

---

## 5. AI Usage Limits

### Premium Tier Limits

| AI Feature | Monthly Limit | Reset | Enforcement |
|------------|---------------|-------|-------------|
| AI Photo Recognition | 50 calls | 1st of month | Hard cap with counter UI |
| AI Workout Builder | 3-5 calls | 1st of month | Hard cap |
| AI Nutrition Coach | TBD | TBD | Future |
| AI Progress Monitoring | Weekly/Monthly | N/A | Batch processing |

### Additional Constraints
- **AI Workout Builder:** Maximum 1 active program at a time
- **Counter Display:** Users see "X of 50 photo scans used this month"

### Implementation Notes
- Store usage counters per user per month
- Reset counters on 1st of each month (UTC)
- Show warning at 80% usage
- Block with upgrade prompt at 100%

---

## 6. Subscription Lifecycle

### States

| State | Description | Feature Access |
|-------|-------------|----------------|
| `trialing` | In 7-day free trial | Full premium |
| `active` | Paid and current | Full premium |
| `past_due` | Payment failed (grace period) | Full premium (3 days) |
| `canceled` | User canceled or payment failed | Downgraded to free |
| `expired` | Subscription ended | Downgraded to free |

### Downgrade Behavior

When a premium user downgrades (cancellation or payment failure after grace period):

| Area | Behavior | Rationale |
|------|----------|-----------|
| **AI-generated workout program** | Frozen - visible but can't generate new | Preserve their investment |
| **Micronutrient history** | Hidden completely - only macros shown | Premium value protection |
| **Trainer connection** | Completely broken temporarily | Premium feature |
| **Trainer products - content** | Accessible (frozen at last version) | They paid for content |
| **Trainer products - communication** | Blocked | Premium feature |
| **Trainer products - updates** | Not received (frozen) | Premium feature |

### Upgrade Prompts

When lapsed user attempts premium action:
> "Your premium subscription has expired. Renew now to [specific action]."
> [Renew Premium - $9.99/month]

---

## 7. Payment Infrastructure

### Stripe Integration

| Component | Implementation |
|-----------|----------------|
| **Account Type** | Platform account with Connect |
| **Trainer Accounts** | Express (managed onboarding, simplified dashboard) |
| **Checkout** | Stripe Checkout (hosted) or Payment Elements |
| **Webhooks** | payment_intent.succeeded, customer.subscription.*, etc. |

### Payment Methods

| Method | Support | Notes |
|--------|---------|-------|
| Credit/Debit Cards | ✅ | Visa, Mastercard, Amex, Discover |
| Apple Pay | ✅ | Via Payment Request API |
| Google Pay | ✅ | Via Payment Request API |
| PayPal | ✅ | Stripe PayPal integration (verify availability) |
| Link (Stripe 1-click) | ✅ | Saved payment info |

### PWA + App Store Strategy

| Scenario | Payment Flow | Store Fee |
|----------|--------------|-----------|
| PWA via browser | Direct Stripe checkout | None (only Stripe ~2.9%) |
| Wrapped iOS app | Deep-link to web checkout | None |
| Wrapped Android app | Deep-link to web checkout | None |

**Key Principle:** All payments happen on the web to avoid 30% app store fees.

---

## 8. Promo Codes

### Types

| Type | Description | Example |
|------|-------------|---------|
| Percentage discount | X% off subscription | SAVE20 = 20% off |
| Fixed amount | $X off subscription | FIVE = $5 off |
| Free trial extension | Extra trial days | EXTRA7 = 14 days trial |
| Plan-specific | Only for certain plans | ANNUAL50 = 50% off annual only |

### Admin Controls

- Create/edit/delete promo codes
- Set expiry dates
- Set usage limits (total or per-user)
- Track redemptions
- View analytics (conversions per code)

### Validation Rules

- One promo code per subscription
- Cannot combine with other offers (unless configured)
- Some codes may be first-time subscribers only

---

## 9. Trainer Marketplace

### Stripe Connect Model

| Aspect | Implementation |
|--------|----------------|
| Account Type | Express (recommended) |
| Onboarding | Embedded in LOBA, Stripe-hosted forms |
| KYC/Verification | Handled by Stripe |
| Payouts | Automatic, configurable schedule |
| Tax Forms | Stripe generates 1099s (US) |

### Revenue Split

```
Client pays: $100 for trainer product
├── Stripe processing fee (~3%): $3
├── Platform commission: $0 (we don't take commission)
└── Trainer receives: $97
```

### Product Types

| Type | Billing | Example |
|------|---------|---------|
| One-time purchase | Single payment | 12-week program ($199) |
| Recurring subscription | Monthly/yearly | Online coaching ($99/month) |
| Session packages | Credit-based | 10 PT sessions ($500) |
| Free lead magnets | No charge | Free meal plan template |
| Video courses | One-time or subscription | Form mastery course ($49) |

### Product Approval Workflow

1. Trainer creates product (draft)
2. Admin reviews in approval queue
3. Admin approves or requests changes
4. Product goes live on trainer's storefront
5. Clients can purchase

### Trainer Storefronts

Each trainer gets a public marketing page:
- Custom URL: `loba.app/trainer/[username]`
- Profile photo, bio, credentials
- Testimonials/reviews
- Product catalog with pricing
- Contact/purchase CTAs

---

## 10. Teaser Messaging (Free Users)

### Model

| User Type | Messaging Capability |
|-----------|---------------------|
| Free client → Trainer | 4 messages per trainer relationship (one-time allowance) |
| Trainer → Free client | 4 replies per free client relationship (one-time allowance) |
| Premium client | Unlimited text, audio, media |

### Behavior

- Free client sends messages 1, 2, 3, 4 to a trainer
- After message 4: "Upgrade to Premium to continue messaging"
- Trainer gets 4 replies to each free client (conversion opportunity)
- After trainer's 4 replies: Free client must upgrade to receive more
- Counter does NOT reset if user upgrades then downgrades (one-time allowance)

---

## 11. Affiliate System (Future)

### Model

```
Affiliate shares trainer's product link
    ↓
New user signs up via link
    ↓
User becomes Premium + purchases product
    ↓
Trainer pays affiliate commission (trainer-defined %)
    ↓
Platform earns premium subscription
```

### Key Rules

- Affiliates are a separate user class
- Trainers set their own commission rates
- Tracking via referral codes/links
- Payouts handled through Stripe Connect
- Platform takes no cut of affiliate payments

---

## 12. Admin Dashboard Additions

### Subscription Management

| Feature | Description |
|---------|-------------|
| Pricing control | Set prices for all billing cycles |
| Promo code manager | Create, edit, track promo codes |
| Subscriber list | View all subscribers, filter by status |
| Revenue metrics | MRR, ARR, churn rate, LTV |
| Trial analytics | Conversion rate, trial starts |

### Template Workout Manager

| Feature | Description |
|---------|-------------|
| Create templates | Build workout templates |
| Assign to free tier | Select which are available to free users |
| Usage analytics | Which templates are most popular |

### Product Approval

| Feature | Description |
|---------|-------------|
| Approval queue | Pending products from trainers |
| Review interface | View product details, approve/reject |
| Rejection reasons | Communicate issues to trainer |

### Usage Monitoring

| Feature | Description |
|---------|-------------|
| AI usage per user | Photo scans, workout generations |
| Cost tracking | Estimated OpenAI costs |
| Abuse detection | Users hitting limits repeatedly |

---

## 13. Database Schema Additions

### Subscription Tables

```
subscriptions
├── id: UUID (PK)
├── user_id: UUID (FK to profiles)
├── stripe_subscription_id: VARCHAR
├── stripe_customer_id: VARCHAR
├── plan_code: VARCHAR (monthly, quarterly, semi_annual, annual)
├── status: VARCHAR (trialing, active, past_due, canceled, expired)
├── current_period_start: TIMESTAMP
├── current_period_end: TIMESTAMP
├── trial_start: TIMESTAMP (nullable)
├── trial_end: TIMESTAMP (nullable)
├── canceled_at: TIMESTAMP (nullable)
├── cancel_at_period_end: BOOLEAN
├── created_at: TIMESTAMP
├── updated_at: TIMESTAMP
```

```
subscription_prices
├── id: UUID (PK)
├── plan_code: VARCHAR (monthly, quarterly, semi_annual, annual)
├── stripe_price_id: VARCHAR
├── amount_cents: INTEGER
├── currency: VARCHAR (default 'usd')
├── interval: VARCHAR (month, year)
├── interval_count: INTEGER (1, 3, 6, 12)
├── is_active: BOOLEAN
├── created_at: TIMESTAMP
├── updated_at: TIMESTAMP
```

```
promo_codes
├── id: UUID (PK)
├── code: VARCHAR (unique, uppercase)
├── stripe_coupon_id: VARCHAR
├── discount_type: VARCHAR (percent, fixed)
├── discount_value: INTEGER (percent or cents)
├── applicable_plans: TEXT[] (nullable = all plans)
├── max_redemptions: INTEGER (nullable = unlimited)
├── times_redeemed: INTEGER (default 0)
├── first_time_only: BOOLEAN
├── expires_at: TIMESTAMP (nullable)
├── is_active: BOOLEAN
├── created_at: TIMESTAMP
```

```
promo_redemptions
├── id: UUID (PK)
├── promo_code_id: UUID (FK)
├── user_id: UUID (FK)
├── subscription_id: UUID (FK)
├── redeemed_at: TIMESTAMP
```

### AI Usage Tracking

```
ai_usage_logs
├── id: UUID (PK)
├── user_id: UUID (FK)
├── feature_code: VARCHAR (ai_photo_recognition, ai_workout_builder, etc.)
├── usage_month: DATE (first of month for grouping)
├── usage_count: INTEGER
├── last_used_at: TIMESTAMP
├── created_at: TIMESTAMP
├── UNIQUE(user_id, feature_code, usage_month)
```

### Trial Tracking

```
trial_history
├── id: UUID (PK)
├── user_id: UUID (FK)
├── trial_started_at: TIMESTAMP
├── trial_ended_at: TIMESTAMP
├── converted: BOOLEAN
├── created_at: TIMESTAMP
```

### Stripe Connect Tables

```
connected_accounts
├── id: UUID (PK)
├── user_id: UUID (FK to profiles, trainer)
├── stripe_account_id: VARCHAR
├── account_type: VARCHAR (express)
├── charges_enabled: BOOLEAN
├── payouts_enabled: BOOLEAN
├── onboarding_complete: BOOLEAN
├── created_at: TIMESTAMP
├── updated_at: TIMESTAMP
```

### Trainer Products

```
trainer_products
├── id: UUID (PK)
├── trainer_id: UUID (FK to profiles)
├── name: VARCHAR
├── description: TEXT
├── product_type: VARCHAR (one_time, subscription, package, free)
├── status: VARCHAR (draft, pending_approval, approved, rejected, archived)
├── rejection_reason: TEXT (nullable)
├── media_urls: TEXT[]
├── features_included: TEXT[] (feature codes this unlocks)
├── created_at: TIMESTAMP
├── updated_at: TIMESTAMP
├── published_at: TIMESTAMP (nullable)
```

```
product_pricing
├── id: UUID (PK)
├── product_id: UUID (FK)
├── stripe_price_id: VARCHAR
├── amount_cents: INTEGER
├── currency: VARCHAR
├── billing_interval: VARCHAR (nullable for one-time)
├── interval_count: INTEGER (nullable)
├── is_active: BOOLEAN
├── created_at: TIMESTAMP
```

```
product_purchases
├── id: UUID (PK)
├── product_id: UUID (FK)
├── client_id: UUID (FK to profiles)
├── trainer_id: UUID (FK to profiles)
├── stripe_payment_intent_id: VARCHAR
├── amount_cents: INTEGER
├── status: VARCHAR (pending, completed, refunded)
├── purchased_at: TIMESTAMP
├── access_expires_at: TIMESTAMP (nullable)
├── frozen_at: TIMESTAMP (nullable, when premium lapsed)
```

### Trainer Storefronts

```
trainer_storefronts
├── id: UUID (PK)
├── trainer_id: UUID (FK to profiles)
├── slug: VARCHAR (unique, URL-safe username)
├── headline: VARCHAR
├── bio: TEXT
├── profile_image_url: VARCHAR
├── cover_image_url: VARCHAR
├── testimonials: JSONB
├── is_published: BOOLEAN
├── created_at: TIMESTAMP
├── updated_at: TIMESTAMP
```

### Template Workouts

```
template_workout_access
├── id: UUID (PK)
├── template_id: UUID (FK to workout templates)
├── access_tier: VARCHAR (free, premium, all)
├── display_order: INTEGER
├── is_active: BOOLEAN
├── created_at: TIMESTAMP
```

### Teaser Messages

```
teaser_message_usage
├── id: UUID (PK)
├── user_id: UUID (FK)
├── messages_sent: INTEGER (max 3)
├── last_message_at: TIMESTAMP
├── created_at: TIMESTAMP
```

---

## 14. Webhook Events

### Stripe Webhooks to Handle

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create subscription record, update user plan |
| `customer.subscription.created` | Log subscription start |
| `customer.subscription.updated` | Update status, handle plan changes |
| `customer.subscription.deleted` | Mark canceled, trigger downgrade |
| `invoice.paid` | Confirm payment, extend access |
| `invoice.payment_failed` | Start grace period, send notification |
| `customer.subscription.trial_will_end` | Send reminder email (2 days before) |
| `account.updated` (Connect) | Update trainer account status |
| `payment_intent.succeeded` (Connect) | Record product purchase |

---

## 15. Phased Implementation Plan

### Phase 1: Premium Subscriptions (Est. 5-7 days) 🔴 CRITICAL

**Status:** COMPLETE (Dec 2024) - Full Phase 1 Premium Subscription System including admin billing management

**Dependencies:** Stripe integration setup (Test API keys)

#### Implementation Summary (Dec 2024)

**Completed Infrastructure:**
- Two-database architecture: Local PostgreSQL (stripe schema via `stripe-replit-sync`) + Supabase (user data, subscriptions)
- Stripe client initialization with automatic schema management
- Secure webhook endpoint with signature verification before processing
- Idempotent webhook handlers using `maybeSingle()` and upsert with `onConflict`
- Paginated, case-insensitive email fallback for customer correlation (with uniqueness check)
- Atomic grace period enforcement via Supabase RPC function (`enforce_grace_period_expiry`)
- Critical event sync failure guard (aborts to trigger Stripe retry)
- Feature cache invalidation on subscription state changes

**Key Files:**
- `server/stripeClient.ts` - Stripe client and sync initialization
- `server/stripeInit.ts` - Server startup Stripe setup
- `server/webhookHandlers.ts` - Webhook processing with idempotency
- `server/feature-access.ts` - Feature gating with grace period enforcement
- `server/stripeService.ts` - Checkout session and subscription APIs
- `server/routes.ts` - API endpoints for Stripe operations
- `supabase/migrations/052_subscription_tables.sql` - Subscription tables and RPC functions
- `client/src/pages/Subscription.tsx` - Plan selection and checkout UI

#### Track 1A: Platform Foundation ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 1A.1 | Configure Stripe test API keys as secrets | ✅ |
| 1A.2 | Create database migrations (subscriptions, prices, promos, trials) | ✅ |
| 1A.3 | Update shared/schema.ts with new tables | ✅ |
| 1A.4 | Create Stripe Products/Prices seeding script | ✅ |
| 1A.5 | Implement Stripe customer creation strategy (on first checkout) | ✅ |

#### Track 1B: Webhook & Billing State Machine ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 1B.1 | Create webhook endpoint with signature verification | ✅ |
| 1B.2 | Implement idempotent webhook handlers (idempotency keys) | ✅ |
| 1B.3 | Handle checkout.session.completed → create subscription | ✅ |
| 1B.4 | Handle subscription lifecycle events (created, updated, deleted) | ✅ |
| 1B.5 | Handle invoice events (paid, payment_failed) | ✅ |
| 1B.6 | Implement grace period logic (3-day timer, RPC-based enforcement) | ✅ |
| 1B.7 | Integrate with feature gating (invalidateFeatureCache on changes) | ✅ |

#### Track 1C: Checkout Flow ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 1C.1 | Create plan selection UI component | ✅ |
| 1C.2 | Implement promo code validation (backend) | ✅ |
| 1C.3 | Create Stripe Checkout session API endpoint | ✅ |
| 1C.4 | Handle success/cancel redirects with session verification | ✅ |
| 1C.5 | Add "Upgrade to Premium" buttons throughout app | ✅ |
| 1C.6 | Implement trial period logic (7 days, once per 12 months) | ✅ |

#### Track 1D: Client Account Management ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 1D.1 | Create subscription status display in settings | ✅ |
| 1D.2 | Fetch billing history from Stripe invoices | ✅ |
| 1D.3 | Implement cancel subscription flow | ✅ |
| 1D.4 | Implement reactivate subscription flow | ✅ |

#### Track 1E: Admin Dashboard ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 1E.1 | Create pricing control panel (CRUD backed by Stripe Prices) | ✅ |
| 1E.2 | Create promo code management UI | ✅ |
| 1E.3 | Create subscriber list with filtering | ✅ |
| 1E.4 | Create revenue metrics dashboard (MRR, trials, churn) | ✅ |

**Implemented (Dec 2024):**
- SubscriptionsTab component in AdminPage.tsx with four sections: Metrics, Subscribers, Promo Codes, Pricing
- Metrics dashboard showing active, trialing, past_due, canceled counts + MRR/revenue insights
- Paginated subscriber list with status filtering (all/active/trialing/past_due/canceled/unpaid)
- Promo code CRUD: create codes (percent/fixed discount, max redemptions, expiry, first-time-only), toggle active/inactive
- Pricing control panel: view all Stripe products/prices, inline price editing (creates new price, deactivates old since Stripe prices are immutable)
- **Price tier toggle (Dec 2024):** Admins can enable/disable individual price tiers via Switch toggles:
  - Inactive prices are grayed out with "Inactive" badge
  - Edit button disabled for inactive prices (must enable first)
  - Server-side guardrail prevents deactivating the last active price for a product
  - Existing subscribers on a deactivated tier continue billing normally (only affects new signups)
  - Toast notifications clearly communicate the impact on new vs existing customers

#### Architecture Notes (Implemented)

**Webhook Design:**
- All handlers are idempotent (use `stripe_webhook_events` table with upsert)
- Retry-safe processing with `maybeSingle()` for existence checks
- Critical event sync failures abort to trigger Stripe retry
- Grace period expiry via Supabase RPC for atomicity

**Customer Strategy:**
- Stripe Customer created on first checkout attempt
- `stripe_customer_id` stored in profiles table
- Paginated email lookup fallback with uniqueness enforcement

**Two-Database Architecture:**
- Local PostgreSQL: `stripe` schema managed by `stripe-replit-sync`
- Supabase: `user_subscriptions`, `trial_history`, `promo_codes`, `stripe_webhook_events`
- Webhook routing registers before `express.json()` for raw body access

**Promo Code Sync:**
- Promo codes sync to Stripe Coupons to prevent billing drift
- Validation via backend before creating Checkout session

**Payment Methods (Phase 1):**
- Cards + Apple Pay + Google Pay (wallet methods enabled in test)
- PayPal deferred until Stripe availability confirmed

**Acceptance Criteria:**
- [x] User can subscribe to premium via Stripe Checkout
- [x] Cards and wallet methods (Apple Pay, Google Pay) work in test mode
- [x] Trial period (7 days, card required) starts and converts correctly
- [x] Trial eligibility tracked (once per 12 calendar months)
- [x] Promo codes apply discounts correctly (synced to Stripe Coupons)
- [x] Failed payments trigger 3-day grace period
- [x] Grace period expiry handled by RPC function
- [x] Subscription cancellation and reactivation work
- [x] Features unlock immediately after payment success
- [x] Feature cache invalidated on subscription changes
- [x] Admin can set prices (creates Stripe Prices) - Track 1E.1 complete
- [x] Admin can create/manage promo codes - Track 1E.2 complete
- [x] Revenue metrics display in admin dashboard - Track 1E.4 complete
- [x] All webhook events processed idempotently

---

### Phase 2: Stripe Connect Foundation (Est. 2-3 weeks) 🔴 CRITICAL

**Status:** COMPLETE (Dec 2024) - Architect Approved & Deployed

**Dependencies:** Phase 1 (Complete), Migration 052 executed

**Purpose:** Enable trainers to receive payments by onboarding them to Stripe Connect Express accounts.

#### Implementation Summary (Dec 2024)

**Completed Infrastructure:**
- Two-tier database: Migration 053 creates `connected_accounts` table, Migration 054 adds FK to profiles
- Stripe Connect Express account creation with automatic onboarding link generation
- Webhook infrastructure extended for Connect events (`account.updated`, `account.application.deauthorized`)
- Professional role verification on all Connect endpoints (401 for unauthenticated, 403 for non-professionals)
- Admin dashboard with Connect Accounts section showing metrics and account list
- Stripe v20 API compatibility (subscription item-level `current_period_end`)

**Key Files:**
- `supabase/migrations/053_stripe_connect_accounts.sql` - Connected accounts table
- `supabase/migrations/054_connected_accounts_profile_fk.sql` - Foreign key relationship
- `server/stripeService.ts` - Connect account creation, onboarding links, account retrieval
- `server/routes.ts` - Connect API endpoints with role verification
- `client/src/components/pro/StripeConnectSetup.tsx` - Trainer onboarding UI
- `client/src/pages/AdminPage.tsx` - Admin Connect Accounts dashboard

#### Prerequisites
- [x] Execute Supabase migration `052_subscription_tables.sql`
- [x] Execute Supabase migration `053_stripe_connect_accounts.sql`
- [x] Execute Supabase migration `054_connected_accounts_profile_fk.sql`
- [x] Design trainer KYC/identity data collection for pre-filling Connect onboarding
- [x] Extend webhook infrastructure for Connect events

#### Track 2A: Connect Account Infrastructure
| Task | Description | Status |
|------|-------------|--------|
| 2A.1 | Create `connected_accounts` table migration (if not in 052) | ✅ |
| 2A.2 | Implement Stripe Connect Express account creation endpoint | ✅ |
| 2A.3 | Create account onboarding link generation (stripe.accountLinks.create) | ✅ |
| 2A.4 | Build onboarding return/refresh URL handlers | ✅ |
| 2A.5 | Store Connect account IDs securely in Supabase | ✅ |

#### Track 2B: Connect Webhooks
| Task | Description | Status |
|------|-------------|--------|
| 2B.1 | Register separate Connect webhook endpoint | ✅ |
| 2B.2 | Handle `account.updated` - sync charges_enabled, payouts_enabled | ✅ |
| 2B.3 | Handle `account.application.deauthorized` - mark account disconnected | ✅ |
| 2B.4 | Implement idempotent Connect event processing | ✅ |
| 2B.5 | Add retry-safe error handling for Connect events | ✅ |

#### Track 2C: Trainer Onboarding UX
| Task | Description | Status |
|------|-------------|--------|
| 2C.1 | Create "Set Up Payments" CTA in trainer dashboard | ✅ |
| 2C.2 | Build onboarding status component (pending/complete/restricted) | ✅ |
| 2C.3 | Handle incomplete onboarding flow (resume link) | ✅ |
| 2C.4 | Display payout schedule and account status | ✅ |
| 2C.5 | Show "Payouts Enabled" badge once verified | ✅ |

#### Track 2D: Admin Connect Dashboard
| Task | Description | Status |
|------|-------------|--------|
| 2D.1 | Create Connected Accounts section in Admin Panel | ✅ |
| 2D.2 | List all trainer Connect accounts with status | ✅ |
| 2D.3 | Show onboarding completion rate metrics | ✅ |
| 2D.4 | Display restricted/disabled account alerts | ✅ |
| 2D.5 | Link to Stripe Dashboard for account details | ✅ |

#### Architectural Considerations
- **Multi-tenant security:** Store Connect account IDs per trainer, never expose to other users
- **Compliance:** Handle disabled_account states, surface verification requirements
- **Guardrails:** Block product creation until Connect onboarding complete
- **KYC pre-fill:** Collect trainer identity data to streamline Stripe onboarding
- **Authorization:** Professional role verification returns 403 for non-professionals on all Connect routes
- **Database efficiency:** `listConnectedAccounts` fetches profiles separately to avoid FK dependency issues

**Acceptance Criteria:**
- [x] Trainer can initiate Connect onboarding from dashboard
- [x] Onboarding completes and account status tracked in database
- [x] Webhook events update account status in real-time
- [x] Admin can view all connected accounts and their status
- [x] Incomplete onboarding can be resumed
- [x] Disabled/restricted accounts surface appropriate warnings

---

### Phase 3: Marketplace Payments & Products (Est. 3-4 weeks) ✅ COMPLETE

**Status:** COMPLETE (Dec 2024) - All tracks complete, MVP functional

**Dependencies:** Phase 2 (Stripe Connect) - COMPLETE

**Purpose:** Enable trainers to create products and receive payments from clients.

#### Prerequisites
- [x] Phase 2 complete (Stripe Connect Foundation)
- [x] Confirm trainer `charges_enabled` before allowing product publishing
- [x] Decide on product media storage (recommend: Supabase Storage) - Deferred to Phase 4 enhancement
- [x] Update shared/schema.ts to mirror new Supabase tables

#### Recommended Build Order (Architect Validated)
1. **Track 3A** - Database foundation (tables, RLS, schemas) ✅
2. **Track 3B** - Trainer CRUD (without publish capability initially) ✅
3. **Track 3C** - Admin review workflow ✅
4. **Track 3D** - Checkout & payment webhooks ✅
5. **Track 3E** - Fulfillment, refunds, analytics ✅

#### Track 3A: Product Data Model ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 3A.1 | Create `trainer_products` table migration (include stripe_product_id, status enum, publish_at) | ✅ |
| 3A.2 | Create `product_pricing` table migration (include is_primary flag, billing_interval, stripe_price_id) | ✅ |
| 3A.3 | Create `product_purchases` table migration (include checkout_session_id, platform_fee_cents, fulfilled_at/frozen_at) | ✅ |
| 3A.4 | Define product status state machine (draft→pending_review→approved/rejected→archived) | ✅ |
| 3A.5 | Add RLS policies for product access (trainers see own, clients see own purchases) | ✅ |
| 3A.6 | Create `purchase_access` view for fast entitlement checks | ✅ |
| 3A.7 | Add composite indexes for (client_id, status) and (trainer_id, status) | ✅ |

**Migration:** `supabase/migrations/055_trainer_products_marketplace.sql`
**Zod Schemas:** `shared/schema.ts` (TrainerProduct, ProductPricing, ProductPurchase, PurchaseAccess types)

#### Track 3B: Product CRUD for Trainers ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 3B.1 | Create product creation endpoint with Stripe Product/Price sync | ✅ |
| 3B.2 | Implement product editing (creates new Price if amount changes, lock approved products) | ✅ |
| 3B.3 | Build product archival flow (trainer can archive, reverts to pending_review on core field edits) | ✅ |
| 3B.4 | Create trainer product management UI | ✅ |
| 3B.5 | Add media upload for product images (Supabase Storage) | ⏳ (Deferred to Phase 4) |
| 3B.6 | Block publish unless trainer has charges_enabled + payouts_enabled | ✅ |

**Backend Files:**
- `server/productService.ts` - Product database operations
- `server/stripeService.ts` - Extended with Stripe Product/Price/Checkout methods
- `server/routes.ts` - Added 18 new product API endpoints

#### Track 3C: Admin Approval Workflow ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 3C.1 | Create admin approval queue UI | ✅ |
| 3C.2 | Implement approve/reject endpoints with reason | ✅ |
| 3C.3 | Notify trainer of approval decision | ⏳ (Deferred - notifications system) |
| 3C.4 | Track approval metrics (pending count, avg review time) | ✅ |
| 3C.5 | Add content policy violation flags | ⏳ (Deferred - moderation enhancement) |

**Admin API Endpoints:**
- `GET /api/admin/products` - List all products with filtering
- `GET /api/admin/products/pending` - Get pending review queue
- `POST /api/admin/products/:id/approve` - Approve product
- `POST /api/admin/products/:id/reject` - Reject with reason
- `GET /api/admin/products/metrics` - Get marketplace metrics
- `POST /api/admin/purchases/:id/refund` - Process refund

#### Track 3D: Checkout & Purchase Flow ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 3D.1 | Create product checkout endpoint using destination charges (transfer_data.destination + on_behalf_of) | ✅ |
| 3D.2 | Implement Stripe Checkout with connected account (Premium-only gating server-side) | ✅ |
| 3D.3 | Handle `checkout.session.completed` webhook for purchases (idempotent via stripe_connect_webhook_events) | ✅ |
| 3D.4 | Record purchase in database after webhook confirmation only | ✅ |
| 3D.5 | Grant product access only after payment confirmed | ✅ |
| 3D.6 | Add metadata hooks for future platform fee/commission splits | ✅ |

**Client API Endpoints:**
- `POST /api/products/:id/checkout` - Create checkout session (Premium-only)
- `GET /api/client/purchases` - Get client's purchased products
- `GET /api/client/products/:id/access` - Check product access

#### Track 3E: Purchase Fulfillment ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 3E.1 | Create purchase history for clients | ✅ |
| 3E.2 | Implement product access checks using purchase_access view | ✅ |
| 3E.3 | Handle subscription product renewals | ⏳ (Deferred - requires invoice webhook handling) |
| 3E.4 | Implement refund flow (manual, admin-initiated, platform controls refunds with destination charges) | ✅ |
| 3E.5 | Track trainer earnings and payout history | ✅ |

**Trainer API Endpoints:**
- `GET /api/trainer/products` - Get trainer's products
- `POST /api/trainer/products` - Create product with Stripe sync
- `PATCH /api/trainer/products/:id` - Update product
- `POST /api/trainer/products/:id/submit` - Submit for review
- `POST /api/trainer/products/:id/archive` - Archive product
- `POST /api/trainer/products/:id/pricing` - Add pricing option
- `GET /api/trainer/sales` - Get trainer's sales history

**Public API Endpoints:**
- `GET /api/products` - Get approved products for marketplace
- `GET /api/products/:id` - Get single product with pricing

#### Product State Machine (Architect Validated)

```
┌─────────┐     submit      ┌────────────────┐
│  draft  │ ───────────────▶│ pending_review │
└─────────┘                 └────────────────┘
     ▲                            │
     │ edit core fields           │ admin action
     │                            ▼
     │                    ┌───────────────┐
     └────────────────────│   approved    │──────▶ LIVE (approved + active price)
                          └───────────────┘
                                  │
                          trainer │ archive
                                  ▼
                          ┌───────────────┐
                          │   archived    │
                          └───────────────┘

                          ┌───────────────┐
           admin reject   │   rejected    │ (trainer can edit and resubmit)
                          └───────────────┘
```

**State Rules:**
- Trainers can only edit products in `draft` or `pending_review` status
- Approved products are locked except for price toggles (creates new pricing rows)
- Editing core fields on approved product reverts to `pending_review`
- Product is "live" when status = approved AND at least one active price exists

#### Architectural Considerations
- **Destination charges:** Use `transfer_data.destination` + `on_behalf_of` to route payments (keeps refunds under platform control)
- **Platform fee:** Set to 0% initially, but `platform_fee_cents` field ready for future commission splits
- **Transactional consistency:** Only grant access after webhook confirms payment
- **State machines:** Products have draft/pending_review/approved/rejected/archived states
- **Idempotency:** Handle duplicate webhook deliveries via stripe_connect_webhook_events table
- **Premium gating:** Validate premium status server-side before initiating checkout

#### Security Requirements
- **RLS policies:** Trainers only see own products; clients only see own purchases
- **Connect guardrails:** Require charges_enabled + payouts_enabled before product publish
- **Premium enforcement:** Server-side premium check before checkout session creation
- **Webhook protection:** Signature verification + event replay protection

**Acceptance Criteria:**
- [x] Trainer can create products (all types: one-time, subscription, package)
- [x] Products require admin approval before going live
- [x] Admin can approve/reject with reasons
- [x] Clients (Premium only) can purchase products
- [x] Trainer receives payment minus Stripe fees (~3%)
- [x] Client gets access to product after confirmed payment
- [x] Product state machine enforces valid transitions
- [x] Refunds handled by platform (destination charge benefit)

---

### Phase 4: Trainer Storefronts & Access Control (Est. 2 weeks) ✅ COMPLETE

**Dependencies:** Phase 3 (Products) - COMPLETE

**Purpose:** Public trainer pages for marketing and premium gating for marketplace access.

**Status:** COMPLETE (Dec 2024) - All tracks complete, architect approved

#### Implementation Summary (Dec 2024)

**Completed Infrastructure:**
- Database migration `056_trainer_storefronts.sql` with trainer_storefronts table and `storefront_with_products` view
- View joins profiles table using correct column names (`profile_photo_path`, `preset_avatar_id`)
- RLS policies for trainer ownership and public read access
- Slug uniqueness enforced at database level with unique constraint
- StorefrontService backend with full CRUD operations

**Key Files:**
- `supabase/migrations/056_trainer_storefronts.sql` - Database schema and RLS
- `server/storefrontService.ts` - Backend service for storefront operations
- `server/routes.ts` - API endpoints for storefronts
- `client/src/pages/TrainerStorefront.tsx` - Public storefront page at `/trainer/:slug`
- `client/src/pages/pro/ProStorefront.tsx` - Trainer storefront editor in Pro Portal
- `shared/schema.ts` - TrainerStorefront, StorefrontWithProducts types

#### Prerequisites (Architect Validated)
- [x] Phase 3 complete (Marketplace Products & Payments)
- [x] Resolve media storage strategy (using profile_photo_path from profiles table)
- [x] Define slug generation rules (lowercase, alphanumeric, hyphens, 3-50 chars)

#### Recommended Build Order (Architect Validated)
1. **Track 4A** - Data layer (schema, RLS, slug generation, APIs) ✅
2. **Track 4B** - Public storefront page with SEO ✅
3. **Track 4C** - Trainer editor UI (MVP: bio, hero image, products) ✅
4. **Track 4D** - Premium gating & freeze logic ✅
5. QA + analytics hooks ✅

#### Track 4A: Data Layer & Backend ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 4A.1 | Create `trainer_storefronts` table migration with slug, bio, cover_image_url, published | ✅ |
| 4A.2 | Add RLS policies (trainers own, public read for published) | ✅ |
| 4A.3 | Implement auto-slug generation from display_name with uniqueness | ✅ |
| 4A.4 | Create storefront CRUD API endpoints (GET /trainer/:slug, PATCH /trainer/storefront) | ✅ |
| 4A.5 | Update shared/schema.ts with TrainerStorefront types | ✅ |
| 4A.6 | Add storefront → approved products join query (only approved + active priced) | ✅ |

#### Track 4B: Public Storefront Page ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 4B.1 | Build public storefront page at `/trainer/:slug` | ✅ |
| 4B.2 | Display trainer bio, credentials, profile photo | ✅ |
| 4B.3 | Show approved product catalog with pricing | ✅ |
| 4B.4 | Implement SEO meta tags (title, description, OG tags) | ✅ |
| 4B.5 | Link storefront to Marketplace for discovery | ✅ |
| 4B.6 | Add "View Storefront" link from Marketplace product cards | ✅ |

#### Track 4C: Trainer Storefront Editor ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 4C.1 | Create storefront editing UI in Pro Portal | ✅ |
| 4C.2 | Implement cover/hero image upload (Supabase Storage) | ⏳ (Deferred - using profile photo from profiles table) |
| 4C.3 | Build bio/description editor | ✅ |
| 4C.4 | Add slug customization with validation + 409 conflict handling | ✅ |
| 4C.5 | Preview mode before publishing | ✅ |
| 4C.6 | Publish/unpublish toggle | ✅ |

**Deferred to Later:**
- Testimonial management → Phase 5 enhancement
- Complex frozen access UX → Phase 5 enhancement
- Cover image upload → Future enhancement

#### Track 4D: Premium Gating & Freeze Logic ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 4D.1 | Verify premium gating on checkout (already in Phase 3) | ✅ |
| 4D.2 | Show upgrade prompts for free users on purchase CTAs | ✅ |
| 4D.3 | Implement `frozen_at` timestamp logic for lapsed Premium | ⏳ (Deferred - Phase 5) |
| 4D.4 | Handle purchase access when Premium lapses (read-only mode) | ⏳ (Deferred - Phase 5) |
| 4D.5 | Restore full access when Premium reactivated | ⏳ (Deferred - Phase 5) |
| 4D.6 | Add freeze status indicator in client purchase history | ⏳ (Deferred - Phase 5) |

#### Architectural Considerations
- **Anonymous reads:** Supabase RLS allows public reads for published storefronts
- **Product filtering:** Only display products with status='approved' AND at least one active price
- **Slug uniqueness:** Enforced at database level with unique constraint; 409 conflict response on duplicates
- **Avatar system:** Uses existing profile_photo_path and preset_avatar_id from profiles table
- **SEO:** Dynamic meta tags for social sharing and search indexing
- **Premium gating:** Button disabled for non-premium, "Upgrade to Purchase" label shown

#### Security Requirements
- **RLS policies:** Trainers can only edit own storefront; published storefronts readable by all
- **Slug validation:** Alphanumeric and hyphens only, 3-50 chars, unique constraint
- **Premium enforcement:** Server-side check before creating checkout sessions

**Acceptance Criteria (MVP):**
- [x] Each trainer has public page at /trainer/[slug]
- [x] Page displays bio, profile photo, and approved products with pricing
- [x] Trainer can edit storefront from Pro Portal
- [x] Free users see upgrade prompt when trying to purchase (disabled button + "Upgrade to Purchase" label)
- [x] Premium users can purchase and access products
- [x] Lapsed Premium users see frozen status on their purchases (Implemented in Phase 5)

---

### Phase 5: Operational Tooling (Est. 1-2 weeks) ✅ COMPLETE

**Dependencies:** Phase 3-4 (COMPLETE)

**Purpose:** Admin dashboards, error alerting, and audit logging for marketplace operations.

**Status:** COMPLETE (Dec 2024) - Architect Approved

**Priority Justification:** Phase 5 proceeds before Phase 6 (Feature Gating) because the marketplace is live and requires operational visibility, financial telemetry, and alerting before adjusting feature gates.

#### Implementation Summary (Dec 2024)

**Completed Infrastructure:**
- Database migration `057_marketplace_analytics.sql` with 7 analytics views and 2 RPC functions
- MarketplaceAnalyticsService backend with GMV, earnings, product sales, checkout, and webhook metrics
- MarketplaceTab admin UI with revenue cards, trainer earnings table, and recent purchases
- ProductApprovalQueue enhanced with status filtering and product sales metrics
- Freeze/unfreeze automation via RPC functions called from webhook handlers
- Checkout session tracking table for abandonment analytics

**Key Files:**
- `supabase/migrations/057_marketplace_analytics.sql` - Analytics views, freeze RPCs, checkout_sessions_log table
- `server/marketplaceAnalyticsService.ts` - Backend service for all marketplace analytics
- `client/src/components/admin/MarketplaceTab.tsx` - Admin marketplace dashboard
- `client/src/components/admin/ProductApprovalQueue.tsx` - Enhanced with status filtering
- `shared/schema.ts` - Analytics types (MarketplaceGMVMetrics, TrainerEarningsSummary, etc.)

**Database Views Created:**
- `marketplace_gmv_metrics` - Aggregate GMV, refunds, platform fees, unique clients
- `marketplace_gmv_daily` - Daily GMV trends for charts
- `trainer_earnings_summary` - Per-trainer revenue, sales, refunds, unique clients
- `product_sales_metrics` - Per-product sales performance
- `recent_purchases_admin` - Detailed purchase list with freeze status
- `checkout_abandonment_metrics` - Session completion rates
- `webhook_events_summary` - Webhook processing health

**RPC Functions:**
- `freeze_user_purchases(p_user_id)` - Sets frozen_at on completed purchases when Premium lapses
- `unfreeze_user_purchases(p_user_id)` - Clears frozen_at when Premium reactivates

#### Prerequisites
- [x] Phase 4 complete (Trainer Storefronts)
- [x] Existing AdminPage with Subscriptions tab (Phase 1)
- [x] stripe_webhook_events table for audit logging
- [x] product_purchases table for revenue tracking

#### Bundled Items from Phase 4 (Now Complete)
- [x] `frozen_at` state transitions for lapsed Premium users
- [x] Freeze status indicator in client purchase history
- Storefront testimonials (optional enhancement - deferred)

#### Recommended Build Order (Architect Approved)
1. **Track 5-Foundation** - Data layer (views, functions for GMV/earnings/frozen_at) ✅
2. **Track 5B** - Purchase & Revenue APIs/services ✅
3. **Track 5A** - Admin Product Dashboard UI (reuse AdminPage patterns) ✅
4. **Track 5C** - Error Alerting & Logging ✅

#### Reusable Infrastructure
- AdminPage subscriptions tab patterns (React Query, table components, metrics cards)
- Existing webhook processing pipeline (stripe_webhook_events)
- Supabase audit tables for consolidated logging

#### Track 5-Foundation: Data Layer ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 5F.1 | Create Supabase view for marketplace GMV (sum of completed purchases) | ✅ |
| 5F.2 | Create Supabase view for trainer earnings by period | ✅ |
| 5F.3 | Implement `frozen_at` state transitions when Premium lapses | ✅ |
| 5F.4 | Clear `frozen_at` when Premium reactivates | ✅ |
| 5F.5 | Add refund tracking fields to product_purchases | ✅ (already in Phase 3) |

#### Track 5A: Admin Product Dashboard ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 5A.1 | Create Products tab in Admin Panel (reuse tab pattern) | ✅ (ProductApprovalQueue enhanced) |
| 5A.2 | List all products with status filtering (draft/pending/approved/rejected/archived) | ✅ |
| 5A.3 | Show product sales metrics (units sold, revenue per product) | ✅ |
| 5A.4 | Add product search and trainer filtering | ✅ |
| 5A.5 | Display freeze status for purchases with lapsed Premium | ✅ |

#### Track 5B: Purchase & Revenue Tracking ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 5B.1 | Create Marketplace tab in Admin Panel | ✅ |
| 5B.2 | Display marketplace GMV (Gross Merchandise Value) with period selector | ✅ |
| 5B.3 | Track trainer earnings by period (daily/weekly/monthly) | ✅ |
| 5B.4 | Show refund rates and dispute metrics | ✅ |
| 5B.5 | List recent purchases with client/trainer/product details | ✅ |

#### Track 5C: Error Alerting & Logging ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 5C.1 | Display Connect webhook events in admin (leverage stripe_webhook_events) | ✅ |
| 5C.2 | Surface failed payout alerts in admin dashboard | ✅ (via webhook_events_requiring_attention view) |
| 5C.3 | Track checkout abandonment (sessions created vs completed) | ✅ |
| 5C.4 | Monitor webhook processing failures with retry status | ✅ |
| 5C.5 | Add notification hooks placeholder (email/Slack - future) | ⏳ (Deferred to future enhancement) |

#### Architectural Considerations
- **Data views:** Create Supabase views for GMV, earnings, and refund metrics to optimize queries
- **Frozen state:** Implement via webhook handler when subscription status changes to canceled/expired
- **Reactivation:** Clear `frozen_at` when subscription becomes active again
- **Audit consolidation:** Use existing stripe_webhook_events + Supabase audit tables
- **UI patterns:** Reuse AdminPage tab framework, metrics cards, and table components from Phase 1

#### Security Requirements
- **Admin-only access:** All Phase 5 endpoints require admin authentication
- **Financial data:** Ensure proper RLS on revenue/earnings views
- **Audit immutability:** Webhook events are append-only

**Acceptance Criteria:**
- [x] Admin can view all products and their status with filtering
- [x] Admin can see marketplace GMV and trainer earnings metrics
- [x] Failed operations (payouts, webhooks) surface in admin dashboard
- [x] Audit trail exists for all financial operations via stripe_webhook_events
- [x] Frozen status shows for purchases when client's Premium lapses
- [x] Premium reactivation clears frozen status

---

### Phase 6: Feature Gating Updates (Est. 2-3 days) ✅ COMPLETE

**Dependencies:** Phase 1 (Premium Subscriptions), Phase 5 (Operational Tooling)

**Purpose:** Implement AI usage limits, template access controls, and downgrade behavior for the freemium model.

**Status:** COMPLETE (Dec 2024) - Architect Approved

**Scope:**
1. Update feature gates for new free/premium split
2. AI usage limit tracking (counters, reset logic)
3. Usage limit UI (show remaining scans)
4. Template workout admin control
5. Assign templates to free tier
6. Downgrade behavior implementation

#### Implementation Summary (Dec 2024)

**Completed Infrastructure:**
- Migration `058_ai_usage_tracking.sql` with complete AI quota system
- Atomic quota RPCs with row-level locking for concurrent usage safety
- Backend quota enforcement integrated with feature-access.ts
- Client-side quota hooks and UI components for usage display

**Key Files:**
- `supabase/migrations/058_ai_usage_tracking.sql` - AI usage tables, RPCs, views
- `server/feature-access.ts` - Extended with quota management (assertQuota, consumeQuota, checkQuota, requireQuota middleware)
- `server/routes.ts` - Quota status API endpoints and enforcement on AI endpoints
- `client/src/hooks/useFeatureAccess.ts` - useQuotaStatus hook with isAtLimit, isNearLimit helpers
- `client/src/components/QuotaUsageDisplay.tsx` - Usage display and warning banner components
- `shared/schema.ts` - AI usage tracking Zod schemas

**Database Tables Created:**
- `ai_usage_counters` - Monthly usage tracking per user per feature
- `ai_feature_quotas` - Configurable quota limits (50 photo, 5 workout)
- `active_ai_programs` - Enforces max 1 active AI program per user

**RPC Functions:**
- `increment_ai_usage` - Atomic counter increment with limit check before incrementing
- `get_ai_usage_status` - Returns current usage, limits, remaining, reset date
- `set_active_ai_program` - Activates program, deactivates previous
- `get_active_ai_program` - Returns user's active AI program

#### Prerequisites
- [x] Phase 1 complete (Premium Subscriptions with feature-access.ts)
- [x] Phase 5 complete (Operational Tooling)
- [x] Existing AI photo recognition feature
- [x] Existing AI workout builder in Pro Portal

#### Recommended Build Order (Architect Approved)
1. **Track 6F** - Usage Data Foundation (migrations + reset job) ✅
2. **Track 6B** - Backend feature gate and quota enforcement ✅
3. **Track 6A** - Admin template config UI + client usage displays ✅ (partial - template admin deferred)
4. **Track 6D** - Downgrade UX/automation validation ✅

#### Track 6F: Usage Data Foundation ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 6F.1 | Create `ai_usage_counters` table (user_id, feature_code, usage_month, count) | ✅ |
| 6F.2 | Create `ai_feature_quotas` table for configurable limits | ✅ |
| 6F.3 | Create `get_ai_usage_status` RPC for remaining quotas per user | ✅ |
| 6F.4 | Implement RPC for atomic counter increment with row-level locking | ✅ |
| 6F.5 | Monthly counter auto-reset via usage_month key (1st of month UTC) | ✅ |
| 6F.6 | Update shared/schema.ts with usage tracking types | ✅ |
| 6F.7 | Create `active_ai_programs` table for max 1 active program constraint | ✅ |
| 6F.8 | Create `ai_usage_analytics` view for admin reporting | ✅ |

#### Track 6B: Backend Quota Enforcement ✅ COMPLETE
| Task | Description | Status |
|------|-------------|--------|
| 6B.1 | Add QuotaFeatureCode type in feature-access.ts | ✅ |
| 6B.2 | Implement `assertQuota`, `consumeQuota`, `checkQuota` helpers with RPC | ✅ |
| 6B.3 | Create `getQuotaStatus` API endpoint for frontend (GET /api/quota/status) | ✅ |
| 6B.4 | Create `requireQuota` middleware for endpoint protection | ✅ |
| 6B.5 | Add quota checks to AI photo recognition endpoint (/api/analyze/image, /api/food/identify) | ✅ |
| 6B.6 | Add quota checks to AI workout builder endpoint (/api/pro/routines/ai-generate) | ✅ |
| 6B.7 | Enforce max 1 active AI program constraint via set_active_ai_program RPC | ✅ |
| 6B.8 | Proper error classification (403 for quota/plan limits, 500 for infrastructure errors) | ✅ |

#### Track 6A: Admin & Client UI ✅ COMPLETE (Partial)
| Task | Description | Status |
|------|-------------|--------|
| 6A.1 | Create template workout access control in admin panel | ⏳ (Deferred) |
| 6A.2 | Build template assignment UI (free/premium tier toggle) | ⏳ (Deferred) |
| 6A.3 | Display usage counters in client UI (e.g., "12 of 50 photo scans used") | ✅ |
| 6A.4 | Show warning at 80% usage threshold | ✅ |
| 6A.5 | Block with upgrade prompt at 100% usage | ✅ |
| 6A.6 | Add React Query hooks for quota status (useQuotaStatus) | ✅ |
| 6A.7 | Defensive error handling for missing quota data | ✅ |

#### Track 6D: Downgrade Behavior ✅ COMPLETE (Already Implemented)
| Task | Description | Status |
|------|-------------|--------|
| 6D.1 | Freeze AI-generated workout programs on downgrade | ✅ (via freeze_user_purchases RPC) |
| 6D.2 | Hide micronutrient history on downgrade (only show macros) | ✅ (via filterNutrientsByFeatures) |
| 6D.3 | Block trainer connection/messaging on downgrade | ✅ (via feature gating) |
| 6D.4 | Preserve trainer product content access (they paid for it) | ✅ (frozen_at preserves access) |
| 6D.5 | Block trainer product updates/communication on downgrade | ✅ (frozen_at blocks updates) |
| 6D.6 | Verify upgrade restores full access correctly | ✅ (via unfreeze_user_purchases RPC) |

**Note:** Downgrade behavior was already implemented in Phase 5 via webhookHandlers.ts and feature-access.ts.

#### Database Schema

```sql
-- AI Usage Counters (monthly rolling)
CREATE TABLE ai_usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  feature_code TEXT NOT NULL,  -- 'ai_photo_recognition', 'ai_workout_builder'
  usage_month DATE NOT NULL,   -- First of month for grouping
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feature_code, usage_month)
);

-- RPC for atomic increment
CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id UUID,
  p_feature_code TEXT,
  p_limit INTEGER
) RETURNS JSONB ...
```

#### Quota Limits

| Feature | Monthly Limit | Reset | Enforcement |
|---------|---------------|-------|-------------|
| AI Photo Recognition | 50 calls | 1st of month (UTC) | Hard cap with counter UI |
| AI Workout Builder | 5 calls | 1st of month (UTC) | Hard cap + max 1 active |

#### Architectural Considerations
- **Concurrent increments:** Use Supabase RPC with row-level locking (`FOR UPDATE`)
- **Reset timing:** Align with UTC month boundaries for consistency
- **Template assignments:** Must respect premium gating and RLS
- **Downgrade state:** Frozen programs/hidden nutrients must not violate purchase entitlements
- **React Query:** Maintain cache consistency for quota endpoints

#### Security Requirements
- **RLS policies:** Users can only view/update own usage counters
- **Rate limiting:** Protect quota increment RPC from abuse
- **Admin-only:** Template access controls require admin authentication

**Acceptance Criteria:**
- [x] AI photo recognition limited to 50/month (Premium only)
- [x] AI workout builder limited to 5/month, 1 active program (Premium only)
- [x] Usage counters display in UI (QuotaUsageDisplay component)
- [x] Counters auto-reset on 1st of month (UTC via usage_month key)
- [x] Warning displayed at 80% usage threshold
- [x] Upgrade prompt shown at 100% usage
- [ ] Admin can assign templates to free tier (Deferred)
- [x] Downgrade behavior works correctly (frozen programs, hidden nutrients, restored on reactivation)
- [x] Proper error handling (403 for quota/plan limits, 500 for infrastructure errors)

---

### Phase 7: Teaser Messaging (Est. 1-2 days) ✅ COMPLETE

**Dependencies:** Existing messaging system, Phase 1 (Premium Subscriptions)

**Purpose:** Enable free users to sample trainer messaging with a limited allowance, driving premium conversions.

**Status:** Completed Dec 2024

**Scope:**
1. Message counter for free users (4 messages per trainer relationship)
2. Block after 4 messages with upgrade prompt
3. Trainers get 4 teaser replies per free client
4. Premium users have unlimited messaging

#### Design Decisions (Architect Approved)
- **Counter Scope:** Per-trainer relationship (not global) - allows clients to reach out to multiple trainers
- **Bidirectional Limits:** Free clients get 4 messages per trainer, trainers get 4 replies per free client
- **One-Time Allowance:** No monthly reset - once exhausted, must upgrade to continue
- **Premium Bypass:** Active/trialing premium clients have unlimited messaging
- **Persistence:** Counter persists even after premium downgrade (no reset)

#### Prerequisites
- [x] Existing messaging system (WebSocket layer, conversations, RPC functions)
- [x] Premium subscription system (Phase 1)
- [x] Feature gating system (Phase 6)

#### Recommended Build Order (Architect Approved)
1. **Track 7F** - Data Foundation (migration, schemas, RLS, view)
2. **Track 7B** - Backend Enforcement (quota helper, messaging service integration)
3. **Track 7C** - Frontend UX (counter display, disable at limit, upgrade prompt)
4. **Track 7D** - QA & Telemetry (tests, admin metrics)

#### Track 7F: Data Foundation
| Task | Description | Status |
|------|-------------|--------|
| 7F.1 | Create `teaser_message_usage` table (client_id, trainer_id, client_messages_sent, trainer_messages_sent) | ✅ |
| 7F.2 | Add RLS policies (users see own usage) | ✅ |
| 7F.3 | Create Supabase view for remaining messages per relationship | ✅ |
| 7F.4 | Update shared/schema.ts with Zod schemas | ✅ |

#### Track 7B: Backend Enforcement
| Task | Description | Status |
|------|-------------|--------|
| 7B.1 | Create teaser quota check helper (reuse Phase 6 pattern) | ✅ |
| 7B.2 | Create atomic increment RPC with `count < 4` guard | ✅ |
| 7B.3 | Wire into message send pipeline | ✅ |
| 7B.4 | Premium/trialing users bypass limit | ✅ |
| 7B.5 | Return structured 403 error when limit exceeded | ✅ |
| 7B.6 | Create API endpoint for teaser usage status | ✅ |

#### Track 7C: Frontend UX
| Task | Description | Status |
|------|-------------|--------|
| 7C.1 | Display remaining messages in ChatComposer ("3 of 4 messages left") | ✅ |
| 7C.2 | Disable input when quota exhausted | ✅ |
| 7C.3 | Show upgrade prompt CTA when blocked | ✅ |
| 7C.4 | Reflect lock state in conversation list | ⏳ |
| 7C.5 | Handle 403 errors gracefully with toast | ✅ |

#### Track 7D: QA & Telemetry
| Task | Description | Status |
|------|-------------|--------|
| 7D.1 | Test free client flow (4 messages → blocked) | ⏳ |
| 7D.2 | Test trainer reply flow (4 replies to free client → blocked) | ⏳ |
| 7D.3 | Test premium user flow (unlimited) | ⏳ |
| 7D.4 | Add admin metrics for teaser conversion rates | ✅ |

#### Database Schema

```sql
CREATE TABLE teaser_message_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_messages_sent INTEGER NOT NULL DEFAULT 0 CHECK (client_messages_sent >= 0),
  trainer_messages_sent INTEGER NOT NULL DEFAULT 0 CHECK (trainer_messages_sent >= 0),
  client_last_message_at TIMESTAMPTZ,
  trainer_last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, trainer_id)
);
```

#### Teaser Limits

| User Type | Messages Allowed | Reset |
|-----------|------------------|-------|
| Free Client → Trainer | 4 per trainer | Never (one-time) |
| Trainer → Free Client | 4 per client | Never (one-time) |
| Premium Client | Unlimited | N/A |

#### Architectural Considerations
- **Atomic increments:** Use RPC with row-level locking to prevent race conditions
- **Premium check:** Verify subscription status before applying limits
- **Bidirectional tracking:** Separate counters for client→trainer and trainer→client
- **Error semantics:** Return 403 with structured payload for frontend handling

#### Security Requirements
- **RLS policies:** Users can only view/update their own teaser usage
- **Premium verification:** Server-side check before applying limits
- **Rate limiting:** Protect increment RPC from abuse

**Acceptance Criteria:**
- [x] Free users limited to 4 messages per trainer relationship
- [x] Trainers limited to 4 replies per free client relationship
- [x] Counter shows remaining messages in chat UI
- [x] Upgrade prompt displayed after limit reached
- [x] Premium users have unlimited messaging
- [x] Counter persists after premium downgrade (one-time allowance, no reset)

---

> **Future Phases (8-10)** have been moved to [BACKLOG.md](./BACKLOG.md) for better organization. See the "Future Phases" section there for Affiliate System, AI Nutrition Coach, and AI Progress Monitoring.

---

## 16. Environment Variables

### Required Secrets

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (frontend) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Connect webhook verification |

### Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `STRIPE_MODE` | sandbox or live | sandbox |
| `PREMIUM_TRIAL_DAYS` | Trial duration | 7 |
| `PREMIUM_GRACE_DAYS` | Grace period | 3 |
| `AI_PHOTO_LIMIT_MONTHLY` | Photo scans per month | 50 |
| `AI_WORKOUT_LIMIT_MONTHLY` | Workout generations per month | 5 |

---

## 17. Security Considerations

### Payment Security
- All payments through Stripe (PCI compliant)
- Never store card numbers
- Webhook signature verification required
- HTTPS only for all payment flows

### Access Control
- Verify subscription status on every premium action
- Server-side feature gating (not just UI)
- Rate limiting on AI endpoints
- Audit logging for subscription changes

### Stripe Connect
- Verify account ownership before payouts
- Monitor for suspicious activity
- Implement fraud detection hooks

---

## 18. Monitoring & Alerts

### Key Metrics

| Metric | Alert Threshold |
|--------|-----------------|
| Failed payments | > 5% of attempts |
| Trial conversion rate | < 20% |
| Churn rate | > 10% monthly |
| Webhook failures | Any failure |
| AI API errors | > 1% of calls |

### Dashboards

- Revenue (MRR, ARR, growth)
- Subscriptions (active, trials, churned)
- Trainer marketplace (products, sales)
- AI usage (costs, limits hit)

---

## 19. Development Prerequisites

### What's Needed to Start Coding

| Requirement | Needed Now? | Notes |
|-------------|-------------|-------|
| Stripe account (any status) | ✅ Yes | Even unverified works for test mode |
| Stripe Test API keys | ✅ Yes | `sk_test_*` and `pk_test_*` from Dashboard |
| Verified Stripe account | ❌ No | Only needed before going live |
| Bank account connected | ❌ No | Only needed before going live |
| Final app name | ❌ No | Using "LOBA Tracker" as placeholder |

### Development vs Production

| Phase | Mode | API Keys | Real Money? |
|-------|------|----------|-------------|
| **Development** | Test/Sandbox | `sk_test_*`, `pk_test_*` | No |
| **Staging** | Test/Sandbox | `sk_test_*`, `pk_test_*` | No |
| **Production** | Live | `sk_live_*`, `pk_live_*` | Yes |

### Stripe Test Resources

- **Test card numbers:** `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (decline)
- **Test webhook events:** Can be triggered from Stripe Dashboard
- **Test clock:** Simulate subscription renewals and expirations

### Before Going Live Checklist

- [ ] Verify Stripe account (identity, business info)
- [ ] Connect bank account for payouts
- [ ] Finalize app name and branding
- [ ] Update all Stripe product/price descriptions
- [ ] Switch to Live API keys
- [ ] Test with real card (small amount, refund immediately)
- [ ] Enable production webhooks

---

## 20. Migration Strategy

### From Current State

1. **Existing users:** Remain free, can upgrade anytime
2. **Existing trainers:** Prompted to connect Stripe
3. **Existing feature access:** Respected until subscription logic enabled
4. **Data migration:** None required (new tables only)

### Rollout Plan

1. Deploy Phase 1 to staging
2. Test all payment flows
3. Deploy to production (hidden behind feature flag)
4. Enable for beta testers
5. Monitor metrics
6. Full rollout

---

## 21. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Trial start rate | 30% of signups | Analytics |
| Trial conversion | 40% | Stripe data |
| Monthly churn | < 5% | Stripe data |
| Trainer signup | 100 in first 3 months | Database |
| Product purchases | 500 in first 6 months | Database |
| MRR | $10K in 6 months | Stripe dashboard |

---

## 22. Refund Policy

### Platform Subscriptions (Premium)

| Scenario | Policy |
|----------|--------|
| Cancel within 24 hours | Full refund, no questions asked |
| Cancel within first 7 days | Full refund (if started with trial, no refund since trial was free) |
| Cancel after 7 days | No refund, but access continues until period ends |
| Annual plan cancel | No refund for unused time |
| Payment dispute/chargeback | Immediate account suspension |

**Policy Statement:**
> "Cancel anytime. If you cancel within 7 days of your first paid billing, we'll refund you in full. After that, you keep access until your billing period ends, but no refunds for unused time."

### Trainer Products

| Scenario | Policy |
|----------|--------|
| Digital products (programs, courses) | No refunds once accessed |
| Subscription coaching | Cancel anytime, no refund for current period |
| Session packages | Refund for unused sessions (minus 10% admin fee) |
| Dispute resolution | Platform mediates between client and trainer |

**Policy Statement:**
> "Trainer products are non-refundable once accessed. For subscription products, you can cancel anytime but won't receive a refund for the current billing period. If you have a dispute with a trainer, contact support and we'll help mediate."

---

## 23. Product Categories

| Category | Description | Examples |
|----------|-------------|----------|
| **Training Programs** | Structured workout plans | 12-week muscle building, 8-week fat loss |
| **Nutrition Plans** | Meal plans and guides | Macro-based meal plan, Keto guide |
| **Coaching Packages** | Ongoing 1:1 support | Monthly coaching, weekly check-ins |
| **Session Packs** | Individual or bundled sessions | 1 PT session, 10-session pack |
| **Video Courses** | Educational content | Form masterclass, Nutrition 101 |
| **E-Books & Guides** | Downloadable resources | Recipe book, Training manual |
| **Challenges** | Time-limited programs | 30-day transformation, 6-week shred |
| **Templates** | Reusable resources | Workout log template, Meal prep guide |

---

## 24. Trainer Verification

### Verification Process

| Step | Description | Who Does It |
|------|-------------|-------------|
| 1. **Application** | Trainer fills out profile + credentials | Trainer |
| 2. **Document Upload** | Certification proof, ID verification | Trainer |
| 3. **Admin Review** | Review credentials, approve/reject | Admin |
| 4. **Stripe Connect** | Complete payment setup | Trainer |
| 5. **Ready to Sell** | Can create and publish products | System |

### Verification Requirements

Trainers must provide ONE of the following:
- Valid fitness certification (ACE, NASM, ISSA, NSCA, etc.)
- Relevant degree (Exercise Science, Nutrition, Kinesiology, etc.)
- Proof of professional experience (gym employment letter, client testimonials)

### Badge System

| Badge | Criteria |
|-------|----------|
| ✅ **Verified Trainer** | Passed basic verification |
| ⭐ **Certified Professional** | Has recognized certification on file |
| 🏆 **Top Trainer** | High ratings, many clients (Future) |

---

## 25. Reviews & Ratings (Future)

*To be implemented once trainer base is established.*

| Feature | Description | Priority |
|---------|-------------|----------|
| Star ratings | 1-5 stars on products | Medium |
| Written reviews | Text feedback from clients | Medium |
| Verified purchase badge | Only buyers can review | High |
| Trainer response | Trainers can reply to reviews | Low |
| Review moderation | Flag inappropriate content | Medium |

---

## 26. Resolved Questions

| Question | Decision | Date |
|----------|----------|------|
| Currency support | USD only initially | Dec 2024 |
| Refund policy | See Section 21 | Dec 2024 |
| Trainer verification | Required before selling | Dec 2024 |
| Product categories | 8 categories defined | Dec 2024 |
| Reviews/ratings | Future feature | Dec 2024 |

---

## 27. Appendix: Stripe API Reference

### Key Endpoints

| Operation | Stripe API |
|-----------|------------|
| Create checkout session | `stripe.checkout.sessions.create()` |
| Get subscription | `stripe.subscriptions.retrieve()` |
| Cancel subscription | `stripe.subscriptions.cancel()` |
| Create promo code | `stripe.coupons.create()` |
| Create Connect account | `stripe.accounts.create()` |
| Create account link | `stripe.accountLinks.create()` |
| Create transfer | `stripe.transfers.create()` |

### Webhook Event Types

```
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
customer.subscription.trial_will_end
account.updated
payment_intent.succeeded
```

---

## 28. Document History

| Date | Author | Changes |
|------|--------|---------|
| Dec 2024 | Agent | Initial document creation |
| Dec 2024 | Architect | Plan approved with clarifications |
| Dec 2024 | Agent | Added refund policy, product categories, trainer verification, resolved questions |
| Dec 2024 | Agent | Added development prerequisites section |
| Dec 2024 | Architect | Phase 1 approved with detailed task breakdown |
| Dec 2024 | Agent | Phase 1 complete - all tracks 1A-1E including price toggle feature |
| Dec 2024 | Architect | Phase 2-5 roadmap reviewed and approved with detailed task breakdown |
| Dec 2024 | Agent | Updated phases 2-10 with detailed tracks, prerequisites, and acceptance criteria |
| Dec 2024 | Agent | Phase 2 complete - all tracks 2A-2D (Stripe Connect Foundation) |
| Dec 2024 | Architect | Phase 2 reviewed and approved for deployment |
| Dec 2024 | Architect | Phase 3 plan reviewed - added state machine, security requirements, build order |
| Dec 2024 | Agent | Updated Phase 3 documentation with architect recommendations |
| Dec 2024 | Agent | Phase 3 Backend Implementation: Track 3A-3E backend services complete. Migration 055 created. |
| Dec 2024 | Agent | Phase 3 Complete: All tracks 3A-3E implemented. ProProducts.tsx, ProductApprovalQueue.tsx, Marketplace.tsx, BottomNav "Shop" link added. Profile loading bug fixed with /api/auth/ensure-profile endpoint. |
| Dec 2024 | Agent | Phases 4-7 marked complete. Future phases (8-10) moved to BACKLOG.md for better organization. |

---

## 29. Phase Completion Status

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| Phase 1 | ✅ Complete | Dec 2024 | Premium Subscriptions (all tracks 1A-1E) |
| Phase 2 | ✅ Complete | Dec 2024 | Stripe Connect Foundation (all tracks 2A-2D) |
| Phase 3 | ✅ Complete | Dec 2024 | Marketplace MVP complete. Products CRUD, admin approval queue, marketplace browse/purchase, webhook handling. |
| Phase 4 | ✅ Complete | Dec 2024 | Trainer Storefronts with customizable profiles, slug-based URLs, publish toggle |
| Phase 5 | ✅ Complete | Dec 2024 | Operational Tooling - GMV analytics, freeze/unfreeze automation, admin dashboard |
| Phase 6 | ✅ Complete | Dec 2024 | Feature Gating & AI Quotas - usage limits, quota enforcement, downgrade behavior |
| Phase 7 | ✅ Complete | Dec 2024 | Teaser Messaging - 4 msg limit per relationship, premium bypass, upgrade prompts |

> **Phases 8-10 (Future)** have been moved to [BACKLOG.md](./BACKLOG.md)

---

## 30. Phase 2 Implementation Roadmap (COMPLETE - Dec 2024)

### Overview
Phase 2 establishes the Stripe Connect foundation that enables the entire trainer marketplace. This is a critical infrastructure phase that all subsequent marketplace features depend on.

**Completion Status:** All tracks (2A-2D) implemented, tested, and architect-approved for production.

### Estimated Timeline
- **Phase 2 (Stripe Connect):** 2-3 weeks
- **Phase 3 (Marketplace Payments):** 3-4 weeks
- **Phase 4 (Storefronts):** 2 weeks
- **Phase 5 (Operational Tooling):** 1-2 weeks
- **Total Marketplace MVP:** ~10-12 weeks

### Build Order Rationale
1. **Connect First:** Without Connect accounts, trainers can't receive payments
2. **Products Second:** Products require Connect accounts to create Stripe Prices
3. **Storefronts Third:** Public pages need products to display
4. **Tooling Fourth:** Admin tools built after core flows work
5. **Affiliate Last:** Requires stable marketplace with proven transaction volume

### Key Technical Decisions
- **Express Accounts:** Lower friction onboarding, Stripe handles compliance
- **Destination Charges:** Route payments directly to trainers, platform takes no cut
- **Webhook-Driven:** All payment confirmations via webhooks for reliability
- **Idempotent Processing:** All handlers safe for retry/replay

### Risk Mitigation
- **Compliance:** Stripe handles KYC/AML for Express accounts
- **Multi-tenant:** Strict isolation of Connect account IDs per trainer
- **State Machines:** Clear product lifecycle prevents invalid states
- **Graceful Degradation:** Platform continues if trainer payouts fail
