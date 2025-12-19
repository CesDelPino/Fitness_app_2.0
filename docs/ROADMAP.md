# LOBA Tracker Roadmap

## In Progress

### Professional ID Standardization
- **Status:** Planning complete, ready to implement
- **Doc:** [PROFESSIONAL-ID-FIX.md](./PROFESSIONAL-ID-FIX.md)
- **Summary:** Fix professional_id inconsistency causing "Unknown Professional" errors
- **Scope:** Coaching relationships only (one pro per role type: trainer, nutritionist, coach)

---

## Planned

### Delayed Payout Model
- **Status:** Architecture documented
- **Doc:** [PAYOUT-MODEL.md](./PAYOUT-MODEL.md)
- **Summary:** Collect payment immediately, pay pros at end of service period
- **Effort:** 22-32 hours

### Account Closure Workflows (Pro & Client)
- **Status:** Architecture documented
- **Doc:** [PROFESSIONAL-ID-FIX.md](./PROFESSIONAL-ID-FIX.md) (Account Closure sections)
- **Summary:** Formal closure processes for both professionals and clients with grace periods, notifications, and data handling

**Professional Closure:**
- 30-day quarantine before permanent closure
- Prorated refunds to affected clients
- Admin dashboard for managing closures
- Relationship suspension/restoration option

**Client Closure:**
- 7-day grace period before permanent deletion
- GDPR-compliant data deletion
- Data export option before closure
- Professional notification
- Subscription cancellation and refunds

**Shared Components:**
- Audit trail for compliance
- Relationship termination reasons
- Account status management

- **Effort:** 12-16 hours

---

## Future Ideas

### Content Subscription Model
- **Status:** Concept only
- **Summary:** Allow pros to sell access to content libraries (videos, workout plans, courses) without requiring a coaching relationship
- **Key Points:**
  - Separate from coaching relationships
  - No one-per-role constraint (client can subscribe to unlimited content creators)
  - No permissions/check-ins/messaging (just content access)
  - New `content_subscriptions` table (or similar)
  - Platform monetization via commission on content sales
- **Questions to Answer:**
  - What content types? (videos, plans, courses)
  - Content storage? (Supabase Storage, external links)
  - Same commission structure as coaching?
  - Can overlap with coaching relationship?

---

## Completed

*(Move items here as they're finished)*
