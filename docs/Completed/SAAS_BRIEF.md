# LOBA Multi-Tenant SaaS Platform - Product Brief

## Executive Summary

LOBA is evolving from a single-user health tracking PWA into a **multi-tenant marketplace platform** that connects health & fitness clients with multiple professionals (trainers, nutritionists, kinesiologists, yoga instructors, etc.).

**Unique Value Proposition:**
- **For Clients:** One platform to track everything (food, workouts, weight, fasting) while working with multiple specialized professionals
- **For Professionals:** Free/low-cost client management tools + built-in marketplace for client acquisition
- **For LOBA:** Dual revenue streams (client subscriptions + transaction fees on premium services)

---

## Product Vision

### The Problem We Solve

**For Clients:**
- Managing health requires multiple apps (MyFitnessPal for food, Trainerize for workouts, separate apps for each coach)
- Expensive to hire professionals ($100-300/month per coach)
- Hard to find qualified professionals in their area
- Data fragmented across platforms

**For Professionals:**
- Client acquisition is expensive (ads, referrals, networking)
- Existing tools (TrueCoach, Trainerize) are just software - they don't bring clients
- Managing clients manually (spreadsheets, texts, emails) is time-consuming
- Hard to scale beyond 20-30 1-on-1 clients

### Our Solution

**One unified platform where:**
- Clients track all health metrics ($10/month)
- Clients discover and hire professionals through marketplace
- Professionals manage clients with powerful tools (free for basic, paid for premium features)
- Multiple professionals can collaborate on one client's journey
- LOBA handles all payments, billing, and scheduling

---

## User Types & Permissions

### 1. Clients (Primary Revenue Source)

**Subscription:** $10/month

**What They Get:**
- Full access to tracking tools (food logs, workouts, weight, fasting, measurements)
- AI-powered nutrition analysis (text and photo)
- Barcode scanning for food logging
- Progress analytics and charts
- Ability to work with unlimited professionals simultaneously
- Search and discover professionals in marketplace
- Booking/scheduling with professionals
- Mobile PWA experience

**Data Ownership:**
- Client owns ALL their data (food logs, workouts, weight history, photos, etc.)
- Can view all professional notes and recommendations
- Must approve goal/target changes from professionals
- Keeps data even if professionals leave

### 2. Professionals (Marketplace Participants)

**Subscription:** Freemium Model
- **Free Tier:** Up to 5 active clients, basic features
- **Pro Tier:** $29/month for unlimited clients + premium features
- **Enterprise Tier:** $99/month for multi-location gyms/studios

**What They Get:**
- Client management dashboard
- Access to client data (based on role permissions - see below)
- Professional profile in marketplace (searchable by clients)
- Booking/scheduling calendar
- Payment processing (LOBA takes 15-20% of premium services)
- Templates for workouts, meal plans, check-ins
- Analytics (client progress, retention, revenue)
- Automated check-in reminders
- Goal setting and tracking for clients

**Revenue Model for Professionals:**
- Charge clients for premium services:
  - Custom workout programming: $30-60/month
  - Personalized meal planning: $20-50/month
  - Weekly check-ins: $20-40/month
  - One-time services (form checks, consultations): $25-100
- LOBA processes payments and takes 15-20% transaction fee
- Professional receives 80-85% of what they charge

**Marketplace Features:**
- Professional profile page (bio, credentials, pricing, reviews)
- Specialty tags (vegan nutrition, powerlifting, injury rehab, etc.)
- Location-based search
- Client reviews and ratings
- Featured listings (pay $20/month to appear first in search)
- "Looking for" request board (clients post needs, pros apply)

### 3. Admin (LOBA Team)

**What They Can Do:**
- View aggregate/anonymized analytics
- Manage professional verification/credentials
- Handle disputes between clients and professionals
- Access specific accounts with permission (support/debugging)
- Feature professionals in marketplace
- Set platform-wide policies and rules

**What They CANNOT Do:**
- View individual client data without permission
- Change client-professional relationships without consent

---

## Role-Based Permissions (Data Access)

### Permission Model

**Example:** Client "Sarah" works with Trainer John and Nutritionist Amy.

#### Trainer John's Access:

**READ Access:**
- ✅ Sarah's weight history
- ✅ Sarah's workout logs
- ✅ Sarah's goals (overall)
- ✅ Sarah's measurements
- ✅ Sarah's progress photos
- ✅ Nutritionist Amy's notes (collaboration)

**WRITE Access:**
- ✅ Create/edit workout routines for Sarah
- ✅ Log workouts on Sarah's behalf
- ✅ Add notes/comments (visible to Sarah and other pros)
- ✅ **Propose** new goals (requires Sarah's approval)

**NO ACCESS:**
- ❌ Sarah's food logs (that's nutritionist territory)
- ❌ Sarah's macro targets (unless Sarah shares)

#### Nutritionist Amy's Access:

**READ Access:**
- ✅ Sarah's weight history
- ✅ Sarah's food logs
- ✅ Sarah's macro/calorie targets
- ✅ Sarah's goals (overall)
- ✅ Trainer John's notes (collaboration)

**WRITE Access:**
- ✅ Create/edit meal plans for Sarah
- ✅ Log food entries on Sarah's behalf
- ✅ Add notes/comments (visible to Sarah and other pros)
- ✅ **Propose** new macro targets (requires Sarah's approval)

**NO ACCESS:**
- ❌ Sarah's workout programs (unless Sarah shares)

#### Cross-Professional Collaboration:

- ✅ Professionals can see each other's names and specialties
- ✅ All notes are shared (promotes collaboration)
- ✅ Professionals can @mention each other in notes
- ✅ Clients must approve conflicting goals (if Trainer sets 2500 cal, Nutritionist sets 2000 cal, client chooses)

#### When Relationship Ends:

- ❌ Professional loses ALL access to client data immediately
- ❌ No data export for professionals
- ✅ Client keeps all historical data (food logs, workouts, notes, everything)
- ✅ Client can re-invite professional later if desired

---

## Revenue Model

### Client Revenue: $10/month Base Subscription

**What Clients Pay For:**
- Unlimited tracking (food, workouts, weight, fasting)
- AI nutrition analysis
- Progress analytics
- Access to professional marketplace
- Ability to work with unlimited professionals

**Projections:**
- 1,000 clients = $10,000/month = $120K/year
- 10,000 clients = $100,000/month = $1.2M/year
- 100,000 clients = $1M/month = $12M/year

### Professional Revenue: Transaction Fees (15-20%)

**What Professionals Charge:**
- Custom workout programming: $30-60/month → LOBA earns $4.50-12/month
- Meal planning: $20-50/month → LOBA earns $3-10/month
- Weekly check-ins: $20-40/month → LOBA earns $3-8/month
- One-time services: $25-100 → LOBA earns $3.75-20 per transaction

**Example Revenue Per Client:**
- Client pays LOBA: $10/month (base subscription)
- Client also pays Trainer: $50/month (LOBA takes 15% = $7.50)
- Client also pays Nutritionist: $40/month (LOBA takes 15% = $6)
- **Total LOBA Revenue:** $10 + $7.50 + $6 = **$23.50/month per client**

**Projections (assuming 50% of clients hire professionals):**
- 1,000 clients (500 hire pros) = $10K base + ~$7K transaction fees = $17K/month
- 10,000 clients (5,000 hire pros) = $100K base + ~$70K transaction fees = $170K/month

### Professional Subscription (Optional):

**Freemium Model:**
- **Free:** Up to 5 active clients, basic features
- **Pro ($29/month):** Unlimited clients, templates, analytics
- **Enterprise ($99/month):** Multi-location, team accounts, white-label branding

**Why This Works:**
- New professionals can try platform risk-free
- Successful professionals upgrade as they grow
- Creates viral loop (free tier users invite clients to platform)

---

## Key Features by Priority

### Phase 1: MVP Foundation (Must-Have - Priority 1)

**For Clients:**
1. ✅ **Client tracking** (food, workouts, weight, fasting) - Already built
2. **Progress analytics** (charts/graphs showing weight trends, macro adherence, workout volume)
3. **Goal setting** (professionals propose goals, client approves)
4. **Check-ins** (weekly forms for clients to fill out, professionals can create custom forms)
5. **Scheduling/calendar** (book sessions with professionals, sync with Google Calendar)

**For Professionals:**
1. **Professional dashboard** (view all clients, at-a-risk clients, revenue metrics)
2. **Client detail view** (see individual client's data, progress, history)
3. **Goal management** (set/propose macro targets, weight goals, workout frequency)
4. **Notes system** (add notes to client profiles, visible to all professionals)
5. **Invoicing** (automatic billing through Stripe Connect)

**Platform Infrastructure:**
1. **Multi-tenancy** (organizations, professional-client relationships)
2. **Row-Level Security (RLS)** (data isolation per user/role)
3. **Authentication** (email/password, social logins via Supabase Auth)
4. **Payment processing** (Stripe Connect for marketplace payments)

### Phase 2: Marketplace & Discovery (Priority 1)

**For Clients:**
1. **Professional search** (filter by location, specialty, price, reviews)
2. **Professional profiles** (bio, credentials, before/after photos, pricing, reviews)
3. **Booking system** (request consultation with professionals)
4. **Reviews & ratings** (5-star system, written reviews)

**For Professionals:**
1. **Profile builder** (create professional profile, upload credentials, set pricing)
2. **Availability calendar** (set hours, block off times, manage bookings)
3. **Lead notifications** (get alerts when clients view profile or request consultation)
4. **Pricing tiers** (create packages: Bronze/Silver/Gold service levels)

**Platform:**
1. **Matching algorithm** (suggest professionals based on client needs)
2. **Featured listings** (paid promotion for professionals)
3. **Verification badges** (certified trainer, registered dietitian, etc.)

### Phase 3: Automation & Templates (Priority 3)

**For Professionals:**
1. **Workout programming** (create custom workout routines, assign to clients)
2. **Workout templates** (save common routines, reuse across clients)
3. **Batch operations** (assign same workout to multiple clients)
4. **Onboarding sequences** (automated welcome messages, initial forms)
5. **Progress milestones** (automated celebrations when client hits goals)

### Phase 4: Advanced Features (Priority 5 - Nice-to-Have)

**For Professionals:**
1. **Meal planning** (create custom meal plans with recipes, macros)
2. **Content library** (upload workout videos, PDFs, recipes for client access)
3. **Messaging** (1-on-1 chat between professional and client)
4. **Group programs** (12-week challenges with multiple clients)

**For Clients:**
1. **Social features** (connect with other clients, accountability partners)
2. **Challenges** (join community challenges, compete on leaderboards)

---

## Database Architecture (High-Level)

### Core Entities

#### Users Table
```
- id (UUID, primary key)
- email (unique)
- password_hash
- role (client | professional | admin)
- current_weight_kg
- height_cm
- birthdate
- gender
- activity_multiplier
- subscription_status (active | cancelled | trial)
- subscription_tier (free | pro | enterprise) [for professionals]
- created_at
- updated_at
```

#### Organizations Table (Future: for gyms/studios)
```
- id (UUID, primary key)
- name
- owner_id (references users)
- subscription_tier
- white_label_settings (JSONB: logo, colors, domain)
- created_at
```

#### Professional Profiles Table
```
- id (UUID, primary key)
- user_id (references users, unique)
- bio (text)
- specialties (array: ['weight_loss', 'strength_training', 'sports_nutrition'])
- credentials (JSONB: certifications, education)
- location (city, state, country)
- pricing_tiers (JSONB: service packages and prices)
- availability (JSONB: calendar settings)
- featured (boolean, default false)
- verification_status (pending | verified | rejected)
- created_at
- updated_at
```

#### Professional-Client Relationships Table
```
- id (UUID, primary key)
- professional_id (references users)
- client_id (references users)
- role_type (trainer | nutritionist | yoga_instructor | etc.)
- status (active | pending | ended)
- started_at
- ended_at
- notes (text, professional's private notes)
```

#### Food Logs Table (Existing - Scoped to User)
```
- id (UUID, primary key)
- user_id (references users) -- Client who owns this log
- logged_by_user_id (references users) -- Could be client or professional
- food_name
- quantity_value
- quantity_unit
- calories
- protein
- carbs
- fat
- fiber
- sugar
- micronutrients (JSONB)
- logged_at
```

#### Goals Table (New)
```
- id (UUID, primary key)
- client_id (references users)
- proposed_by_user_id (references users) -- Professional who proposed
- goal_type (weight | macros | workout_frequency | etc.)
- target_value (JSONB: flexible schema for different goal types)
- status (pending | approved | active | completed | rejected)
- approved_at
- created_at
- updated_at
```

#### Check-Ins Table (New)
```
- id (UUID, primary key)
- client_id (references users)
- professional_id (references users)
- form_template_id (references check-in templates)
- responses (JSONB: question/answer pairs)
- submitted_at
```

#### Bookings Table (New)
```
- id (UUID, primary key)
- client_id (references users)
- professional_id (references users)
- booking_type (consultation | session | check_in)
- scheduled_at
- duration_minutes
- status (pending | confirmed | cancelled | completed)
- notes
- created_at
```

#### Reviews Table (New)
```
- id (UUID, primary key)
- client_id (references users)
- professional_id (references users)
- rating (1-5)
- review_text
- response_text (professional's response)
- created_at
- updated_at
```

#### Transactions Table (New)
```
- id (UUID, primary key)
- client_id (references users)
- professional_id (references users)
- amount_cents
- platform_fee_cents (15-20% of amount)
- professional_net_cents
- stripe_payment_intent_id
- description (what service was charged)
- status (pending | succeeded | failed | refunded)
- created_at
```

### Row-Level Security (RLS) Policies

**Supabase RLS Examples:**

**Food Logs:**
- Clients can read/write their own logs
- Professionals can read logs of their active clients (if role permits - nutritionist yes, trainer maybe not)
- Professionals can write logs on behalf of clients

**Goals:**
- Clients can read all their goals
- Professionals can propose goals (insert with status=pending)
- Only clients can approve goals (update status to approved)

**Reviews:**
- Anyone can read reviews
- Only clients who worked with professional can write reviews
- Professionals can respond to reviews

**Transactions:**
- Clients can see their payment history
- Professionals can see their earnings
- Admin can see all transactions

---

## Tech Stack

### Frontend
- **React** + **TypeScript** - Component library and type safety
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** + **shadcn/ui** - Design system and component library
- **React Query (TanStack Query)** - Server state management and caching
- **Wouter** - Lightweight routing
- **PWA** - Installable mobile experience

### Backend
- **Supabase** - All-in-one backend platform:
  - **PostgreSQL** - Primary database with built-in RLS
  - **Auth** - Email/password + social logins (Google, Apple)
  - **Storage** - File uploads (profile pics, meal photos, workout videos)
  - **Real-time** - Live updates (professional sees client's food log in real-time)
  - **Edge Functions** - Serverless API endpoints (TypeScript/Deno)

### Payment Processing
- **Stripe Connect** - Marketplace payments (clients → professionals)
- **Stripe Subscriptions** - Client subscriptions ($10/month)

### AI/ML
- **OpenAI API** - Food analysis from text/images (existing integration)

### Infrastructure
- **Development:** Replit (current environment)
- **Production:** Vercel or Railway (seamless Supabase integration)
- **Monitoring:** Sentry (error tracking), PostHog (product analytics)

### Why This Stack?

| Requirement | Solution | Why |
|-------------|----------|-----|
| Multi-tenancy | Supabase RLS | Automatic data isolation, prevents leaks |
| Scalability | Supabase + Vercel | Auto-scaling, handles millions of users |
| Native apps | Supabase SDKs | Official React Native, Flutter, Swift SDKs |
| Real-time | Supabase | Built-in WebSocket subscriptions |
| Speed | React + Vite | Fast development, great DX |
| Payments | Stripe Connect | Industry standard for marketplaces |
| Security | RLS + JWT | Database-level security, impossible to bypass |

---

## Marketplace Strategy

### Professional Acquisition (Supply Side)

**Phase 1: Seed the Marketplace (Months 1-3)**
1. **Manual outreach:** Recruit 20-30 professionals in 2-3 cities (Austin, Miami, Denver)
2. **Offer:** Free Pro tier for 6 months + $500 signing bonus
3. **Goal:** Each professional brings 5-10 existing clients to platform
4. **Result:** 100-300 clients + 20-30 professionals to start flywheel

**Phase 2: Referral Program (Months 3-6)**
1. **Professional referrals:** $100 credit for each professional they refer
2. **Client referrals:** Professionals earn $25 for each new client signup
3. **Featured listings:** Early professionals get free featured placement

**Phase 3: Organic Growth (Months 6+)**
1. **SEO:** Professional profiles rank in Google ("best trainer in Austin")
2. **Content marketing:** Guest blog posts, podcasts with successful professionals
3. **Paid ads:** Target fitness professionals with "Get more clients" messaging

### Client Acquisition (Demand Side)

**Phase 1: Existing Clients (Months 1-3)**
1. Professionals bring their existing clients
2. Word-of-mouth within professional's community
3. **Result:** 100-300 clients from professional networks

**Phase 2: Marketplace Launch (Months 3-6)**
1. **SEO:** Rank for "nutritionist near me", "personal trainer Austin"
2. **Content:** Free resources (macro calculator, workout generator) to drive traffic
3. **Free tier:** 30-day free trial of premium tracking features
4. **Result:** 500-1,000 organic signups

**Phase 3: Paid Acquisition (Months 6-12)**
1. **Facebook/Instagram ads:** Target fitness enthusiasts, New Year's resolution crowd
2. **Influencer partnerships:** Fitness YouTubers, TikTokers promote platform
3. **Corporate partnerships:** Sell to companies as wellness benefit
4. **Result:** 5,000-10,000 clients

### Flywheel Activation

```
Client signs up → Discovers professionals → Hires professional → 
Professional earns revenue → Professional refers more clients → 
More clients join → More professionals join → Better marketplace → 
More clients sign up...
```

**Key Metrics to Track:**
- **Supply-demand ratio:** 1 professional per 20-50 clients (ideal)
- **Activation rate:** % of clients who hire at least 1 professional (target: 30-50%)
- **Retention rate:** % of clients still active after 3 months (target: 60%+)
- **Professional earnings:** Average monthly revenue per professional (target: $500+)

---

## Competitive Positioning

### Direct Competitors

| Competitor | What They Do | LOBA's Advantage |
|------------|--------------|------------------|
| **MyFitnessPal** | Food tracking + community | No professional marketplace, no coaching tools |
| **Trainerize** | Trainer software | No client marketplace, professionals must bring own clients |
| **TrueCoach** | Trainer software | Same as Trainerize - no marketplace |
| **Future** | 1-on-1 training app | Single trainer only, expensive ($150/month), no multi-professional |
| **Mindbody** | Booking + payments for studios | Studio-focused, not individual professionals, no tracking |
| **Nudge Coach** | Coaching platform | No marketplace, basic tracking |

### LOBA's Unique Value

**The Only Platform That:**
1. ✅ Has built-in client tracking tools (food, workouts, weight)
2. ✅ Connects clients with MULTIPLE professionals (trainer + nutritionist + yoga teacher)
3. ✅ Provides marketplace for professional discovery
4. ✅ Handles payments end-to-end (Stripe Connect)
5. ✅ Allows professionals to collaborate on same client

**Tagline Ideas:**
- "Your health team, all in one place"
- "Track everything. Work with anyone."
- "The marketplace for health & fitness professionals"

---

## Launch Roadmap

### Phase 1: MVP Foundation (Months 1-3)
**Goal:** Build multi-tenant platform with basic features

**Deliverables:**
- Multi-tenant database with RLS
- Professional and client dashboards
- Goal setting and approvals
- Check-in forms
- Basic scheduling
- Stripe integration (subscriptions + Connect)
- Professional profiles (basic)
- Client search (basic)

**Success Metrics:**
- 20 professionals onboarded
- 100 clients using platform
- $1,000 MRR ($10/client * 100 clients)

### Phase 2: Marketplace Launch (Months 3-6)
**Goal:** Launch full marketplace with discovery and payments

**Deliverables:**
- Advanced professional search (filters, location, specialties)
- Reviews and ratings
- Featured listings
- Booking system
- Payment processing for professional services
- Professional analytics dashboard
- Automated onboarding sequences

**Success Metrics:**
- 50 professionals
- 500 clients
- 30% of clients hire at least 1 professional
- $10K MRR ($5K subscriptions + $5K transaction fees)

### Phase 3: Automation & Scale (Months 6-9)
**Goal:** Add professional tools to improve retention

**Deliverables:**
- Workout programming tools
- Workout templates
- Batch operations
- Progress milestones
- Enhanced analytics
- Mobile app improvements

**Success Metrics:**
- 100 professionals
- 2,000 clients
- 40% activation rate
- $35K MRR

### Phase 4: Advanced Features (Months 9-12)
**Goal:** Build moat with unique features

**Deliverables:**
- Meal planning tools
- Content library
- Messaging system
- Group programs
- Referral system
- White-label branding (custom domains)

**Success Metrics:**
- 200 professionals
- 5,000 clients
- 50% activation rate
- $100K MRR
- Break-even or profitable

---

## Open Questions & Decisions

### 1. Pricing Refinement
- Final decision on transaction fee: 15% vs 20%?
- Should there be a minimum transaction fee? (e.g., $2 minimum even on $10 service)
- Volume discounts for high-earning professionals? (10% fee if they earn $5K+/month)

### 2. White-Labeling Details
- Custom domain pricing: Free vs $20/month add-on?
- Can professionals completely hide LOBA branding on paid tier?
- Multi-location gyms: One account with multiple trainers under same brand?

### 3. Professional Verification
- Who verifies credentials? LOBA staff or third-party service?
- Background check requirements?
- Insurance requirements?

### 4. Dispute Resolution
- What happens if client requests refund from professional?
- Chargeback policy?
- Professional-client conflict mediation?

### 5. Data Exports & Portability
- Should clients be able to export their data to competitors?
- API access for third-party integrations (Strava, Fitbit, Apple Health)?

### 6. Geographic Expansion
- Start US-only or international from day 1?
- Multi-currency support?
- Localization (Spanish, French, etc.)?

---

## Next Steps

1. **Finalize open questions** (pricing, verification, policies)
2. **Create detailed technical specification** (database schema, API endpoints)
3. **Design mockups** (professional dashboard, client search, booking flow)
4. **Set up development environment** (Supabase project, Stripe accounts)
5. **Begin Phase 1 development** (multi-tenant architecture, auth, basic dashboards)

---

## Contact & Team

**Product Owner:** [Your Name]
**Development Stack:** React + TypeScript + Supabase + Stripe
**Target Launch:** [Target Date]
**Initial Budget:** [Budget if applicable]

---

*This brief is a living document. Updates will be made as decisions are finalized and product evolves.*
