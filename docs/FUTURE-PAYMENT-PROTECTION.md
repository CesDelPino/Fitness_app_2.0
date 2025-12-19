# Future Payment Protection Features

This document outlines payment protection features to implement as LOBA scales and transaction volume increases.

## Priority Matrix

| Feature | Priority | Trigger to Build |
|---------|----------|------------------|
| Trainer deactivation cascade | High | First paid subscription complaint |
| Chargeback webhook handler | Medium | First chargeback received |
| Refunds audit table | Medium | Need for dispute resolution |
| Daily earnings accrual | Low | Complex payout calculations needed |

---

## 1. Trainer Deactivation Cascade (HIGH)

**Problem:** When a trainer is banned/deleted, their active client subscriptions continue charging.

**Solution:**
```
When trainer.active = false OR trainer.banned_until is set:
1. Query all active subscriptions where seller_id = trainer_id
2. For each subscription:
   a. Calculate prorated refund for unused days
   b. Issue refund via Stripe API
   c. Mark subscription as terminated_due_to_seller_exit
   d. Notify client
3. Archive trainer's storefront and products
```

**Tables to add:**
- `subscription_terminations` (subscription_id, reason, refund_amount, processed_at)

---

## 2. Chargeback/Dispute Handling (MEDIUM)

**Problem:** Platform has no visibility into Stripe disputes.

**Solution:**
1. Add webhook listeners for:
   - `charge.dispute.created`
   - `charge.dispute.closed`
   - `charge.dispute.updated`

2. On dispute created:
   - Mark related payout as `withheld`
   - Flag trainer account for review
   - Log to audit table

3. On dispute closed:
   - If won: release held funds
   - If lost: update trainer's dispute rate

**Tables to add:**
- `disputes` (stripe_dispute_id, charge_id, trainer_id, client_id, amount, status, reason, created_at, resolved_at)

---

## 3. Refunds Audit Table (MEDIUM)

**Problem:** No structured tracking of refund reasons beyond Stripe.

**Solution:**
```sql
CREATE TABLE refunds (
  id UUID PRIMARY KEY,
  subscription_id UUID REFERENCES subscriptions,
  client_id UUID REFERENCES profiles,
  trainer_id UUID REFERENCES profiles,
  amount_cents INTEGER,
  trigger_event TEXT, -- 'seller_cancellation', 'client_request', 'chargeback', 'admin_override'
  stripe_refund_id TEXT,
  notes TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID -- admin who processed, if manual
);
```

**Use cases:**
- Dispute resolution with evidence
- Trainer reliability scoring
- Platform analytics

---

## 4. Daily Earnings Accrual (LOW)

**Problem:** Lump-sum payments make it hard to calculate "earned" vs "unearned" revenue.

**Current approach:** Rely on Stripe's transaction records.

**Future approach (when needed):**
```sql
CREATE TABLE earnings (
  id UUID PRIMARY KEY,
  subscription_id UUID,
  trainer_id UUID,
  date DATE,
  accrued_amount_cents INTEGER,
  status TEXT -- 'pending', 'settled', 'withheld'
);
```

Daily cron job calculates: `earned = (days_elapsed / cycle_length) * total_amount`

**Benefits:**
- Precise prorated refund calculations
- Better chargeback defense
- Accurate trainer earnings reports

---

## RLS Considerations

When implementing these features, add RLS policies:
- Only server role can mark refunds/payouts as completed
- Trainers can view but not modify their earnings/disputes
- Block all inserts/updates for banned/deleted users

---

## Current State (December 2024)

- **Trainer banning:** Implemented via Supabase `ban_duration`
- **Soft deletion:** Implemented with `deleted_at` field
- **Stripe Connect:** Destination charges configured
- **Webhook basics:** `/api/stripe/webhook` exists for product/subscription sync

## When to Revisit

Revisit this document when:
1. First paid subscription complaint about inactive trainer
2. First chargeback received
3. Monthly transaction volume exceeds $10,000
4. Multiple trainers with active subscriptions
