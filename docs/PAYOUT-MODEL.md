# Delayed Payout Model for Marketplace

## Business Requirement

- **Collect immediately:** Charge client's card when they purchase a subscription
- **Pay later:** Release funds to professional at end of each service period
- **Example:** Client buys yearly plan ($1200) → Platform collects $1200 upfront → Pro receives $100/month (minus platform fee)

---

## Why Delay Payouts?

1. **Service Fulfillment Protection** - Ensures professional delivers before being paid
2. **Refund Buffer** - Funds available if client requests refund
3. **Cash Flow Management** - Platform holds funds, improving financial position
4. **Reduced Chargebacks** - Less risk of paying out then losing funds to disputes

---

## Stripe Connect Options

### Current Setup
- Using **Destination Charges** with Stripe Connect
- Funds go directly to connected account (immediate payout)

### Options for Delayed Payouts

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **Manual Payouts** | Disable automatic payouts on connected accounts, trigger manually | Full control | Requires managing payout schedule |
| **Separate Charges + Transfers** | Charge to platform, transfer to pro later | Most flexible | More complex accounting |
| **Hold Period via Stripe** | Use Stripe's built-in payout schedule | Simple | Limited to Stripe's options (daily/weekly/monthly) |

**Recommendation:** Use **Separate Charges + Transfers** for maximum control over timing.

---

## Proposed Architecture

### 1. Charge Flow (Immediate)

```
Client Purchase → Stripe Charge → Platform Account → Record in Ledger
```

### 2. Payout Flow (Scheduled)

```
Cron Job (monthly) → Calculate Earned Amount → Stripe Transfer → Connected Account
```

---

## Database Schema (New Tables)

### `payout_ledger`
Tracks every charge and its payout status.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| professional_id | UUID | FK to profiles |
| client_id | UUID | FK to profiles |
| purchase_id | UUID | FK to trainer_purchases |
| stripe_charge_id | VARCHAR | Stripe charge ID |
| gross_amount | DECIMAL | Total charged to client |
| platform_fee | DECIMAL | Platform's cut |
| net_amount | DECIMAL | Amount owed to pro |
| service_period_start | TIMESTAMP | When service period begins |
| service_period_end | TIMESTAMP | When service period ends |
| payout_eligible_at | TIMESTAMP | When funds can be released |
| payout_status | ENUM | 'pending', 'eligible', 'paid', 'refunded', 'clawed_back' |
| payout_run_id | UUID | FK to payout_run when paid |
| created_at | TIMESTAMP | Record creation |

### `payout_schedule`
Per-professional payout configuration.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| professional_id | UUID | FK to profiles |
| frequency | ENUM | 'weekly', 'biweekly', 'monthly' |
| next_payout_date | DATE | Next scheduled payout |
| minimum_payout | DECIMAL | Minimum balance to trigger payout |
| stripe_account_id | VARCHAR | Connected account ID |
| is_active | BOOLEAN | Whether payouts are enabled |
| created_at | TIMESTAMP | Record creation |

### `payout_run`
Audit trail of each payout execution.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| professional_id | UUID | FK to profiles |
| stripe_transfer_id | VARCHAR | Stripe transfer ID |
| amount | DECIMAL | Total transferred |
| ledger_entries | INTEGER | Number of entries included |
| period_start | DATE | Earliest service period |
| period_end | DATE | Latest service period |
| status | ENUM | 'pending', 'processing', 'completed', 'failed' |
| error_message | TEXT | If failed, why |
| created_at | TIMESTAMP | When payout was initiated |
| completed_at | TIMESTAMP | When transfer confirmed |

---

## Refund Handling

### Scenario: Client Cancels Mid-Period

1. **Calculate Earned vs Unearned**
   - Yearly plan: $1200
   - Client cancels after 3 months
   - Earned: 3/12 × $1200 = $300
   - Unearned: $900 (refundable)

2. **Ledger Updates**
   - Mark unearned months as 'refunded'
   - Issue partial refund to client via Stripe
   - Pro keeps earned portion

### Scenario: Client Disputes (Chargeback)

1. **If funds not yet paid to pro**
   - Mark ledger entries as 'clawed_back'
   - No action needed on pro side

2. **If funds already paid to pro**
   - Create negative ledger entry
   - Deduct from next payout
   - If pro has insufficient future earnings, flag for manual resolution

---

## Legal/Compliance Considerations

### Hong Kong Context

The platform is based in Hong Kong. Key considerations:

| Concern | Assessment |
|---------|------------|
| **MSO License** | Likely NOT required - MSO covers remittance/money changing, not marketplace payments |
| **Stripe as Regulated Entity** | Stripe holds the money transmission licenses, not the platform |
| **Funds in Stripe Account** | Delayed payouts stay within Stripe's ecosystem (platform balance → connected account) |
| **Platform Terms** | Must clearly disclose delayed payout schedule to professionals |

### Why MSO Likely Doesn't Apply

1. **You're a marketplace** - Facilitating payments between buyers (clients) and sellers (pros)
2. **Stripe handles transmission** - Actual fund movement is done by Stripe, a licensed entity
3. **No direct fund holding** - Funds sit in Stripe's infrastructure, not your bank account

### Still Recommended

- **Disclosure:** Clearly state payout timing in professional onboarding/terms
- **Stripe Agreement:** Review Stripe Connect platform agreement for any payout timing restrictions
- **Brief Legal Check:** A quick consult with a HK commercial lawyer to confirm (low risk, but worth verifying)

---

## Implementation Phases

### Phase 1: Schema & Basic Tracking
- Create ledger tables
- Record all purchases in ledger
- Track service periods

### Phase 2: Payout Calculation
- Build payout eligibility logic
- Calculate earned amounts per period
- Admin dashboard for pending payouts

### Phase 3: Automated Payouts
- Cron job for scheduled payouts
- Stripe Transfer API integration
- Email notifications to pros

### Phase 4: Refund Integration
- Partial refund calculation
- Ledger adjustment logic
- Negative balance handling

---

## Open Questions

1. **What payout frequency?** Monthly is suggested, but weekly/biweekly options?
2. **Minimum payout threshold?** e.g., Don't pay out if balance < $50
3. **Pro visibility?** Should pros see pending/earned amounts in real-time?
4. **Dispute handling?** How aggressive on claw-backs if pro already paid?
5. **Legal review?** Who will review money transmitter requirements?

---

## Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1 | 4-6 hours | Schema design approval |
| Phase 2 | 6-8 hours | Phase 1 |
| Phase 3 | 8-12 hours | Phase 2, Stripe testing |
| Phase 4 | 4-6 hours | Phase 3 |
| Legal Review | External | Before Phase 3 go-live |

**Total: 22-32 hours** (plus legal consultation)

---

## Related Documents

- [Professional ID Fix](./PROFESSIONAL-ID-FIX.md) - Related database cleanup
- [PRO-DATA.md](./PRO-DATA.md) - Data consolidation context
