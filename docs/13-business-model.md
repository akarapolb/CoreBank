# 13 — Business and revenue model

How Fabor OS makes money while the core is open source ([ADR-0009](adr/0009-open-core-model.md)). Prices are **hypotheses to validate with design partners**, not a price list.

## 1. Principles

1. **Banks pay for accountability, currency and speed, not for code.** Support with SLAs, certified releases, current regulatory content, managed operations, and faster go-live.
2. **Revenue grows with the customer.** Usage-based pricing means a virtual bank starts small and pays more as it grows.
3. **Recurring over one-off.** Target 80% or more of revenue from subscriptions and usage; implementation is mostly done by partners.
4. **Land with one product, expand with modules.** Leasing first, then deposits; commercial lending first, then trade and treasury.

## 2. Editions

| Edition | For | What is included | How it is priced |
|---|---|---|---|
| **Community** | Developers, fintech pilots, universities, small lenders | All open code, generic reference rule pack, community support | Free (Apache 2.0) |
| **Enterprise** (self-managed) | Banks that run Fabor OS in their own data centre or cloud | Certified LTS releases, security patch SLAs, 24/7 support, indemnity, one jurisdiction pack, operations tooling | Annual subscription scaled by accounts and contracts under management |
| **Cloud** (managed) | Virtual banks, fintechs, leasing companies, banks without a core team | Everything in Enterprise, operated by us in-country, with availability SLAs | Platform fee plus usage |

Regulators generally expect critical systems to have accountable vendor support, so banks that start on Community move to Enterprise or Cloud before going live.

## 3. Price metrics (indicative, ASEAN)

| Component | Metric | Indicative range |
|---|---|---|
| Cloud platform fee | Per bank per year, by environment and region count | $150k – $1M |
| Deposit accounts | Per active account per month | $0.03 – $0.15 |
| Loans, leases, hire purchase | Per active contract per month | $0.25 – $1.00 |
| Commercial facilities | Per active facility per month | $10 – $50 |
| Trade instruments | Per LC or guarantee issued, plus per active instrument per month | $15 – $40 issued, $2 – $5 per month |
| Syndicated facilities | Per facility per year (agent role) | $10k – $40k |
| Enterprise subscription | Per year, by accounts under management | $250k for a small lender to $3M+ for a large bank |
| Volume discounts | Tiered by total active accounts | Up to 60% at 10M+ accounts |

Contracts include an annual minimum commitment, so revenue is predictable while usage grows above it.

## 4. Add-ons

| Add-on | Metric | Indicative range |
|---|---|---|
| Additional jurisdiction pack | Per country per year | $100k – $300k |
| Master Builder template library (market) | Per country per year, often bundled with the pack | $30k – $80k |
| Product copilot | Per seat per month for product teams | $500 – $1,500 |
| AI agents (customer assistant, ops, collections, RM) | Per completed agent task or AI decision | $0.02 – $0.50 |
| Credit and fraud decisioning | Per decision | $0.05 – $1.00 |
| Multi-region and cell operations | Per region per year | $150k – $500k |
| Migration factory | Per programme, plus per account migrated | $250k – $3M |
| Premium support | Named technical account manager, faster response | 15–20% on top of the subscription |

## 5. Services and ecosystem

- **Implementation** is delivered mainly by certified partners. We keep a small expert team for architecture assurance and first-of-a-kind projects. Target: services below 15–20% of revenue.
- **Partner programme:** certification exams, training and partner tiers (annual fees), with deal registration.
- **Integration marketplace:** eKYC, credit bureaus, fraud data, insurers, payment providers listed as certified connectors; revenue share of 10–20% on marketplace subscriptions.
- **Training and certification** for bank staff and partners.

## 6. Example customers (year 3, illustrative)

| Customer | Usage | Annual revenue |
|---|---|---|
| Thai leasing and hire-purchase company | 400k active contracts at $0.40, platform $250k, AI collections $120k | ≈ $2.3M |
| Virtual bank, year 3 | 1.5M deposit accounts at $0.06, 150k loans at $0.50, platform $200k, assistant $250k | ≈ $2.4M |
| Regional commercial bank, Enterprise | Subscription $1.5M, trade and treasury usage $0.6M, extra jurisdiction pack $0.2M | ≈ $2.3M |
| Fintech lender on Cloud, year 1 | 60k loans at $0.60, platform $150k (minimum commitment) | ≈ $0.6M |

## 7. Target revenue mix and unit economics (year 5)

| Line | Share of revenue |
|---|---|
| Subscriptions and usage (Enterprise, Cloud) | 70% |
| Add-ons (jurisdiction packs, AI, multi-region, migration tooling) | 15% |
| Services and training | 10% |
| Marketplace and partner programme | 5% |

| Metric | Target |
|---|---|
| Gross margin, blended | 75% or higher |
| Net revenue retention | 125–140% |
| Logo churn | Below 3% a year |
| CAC payback | Under 24 months |
| Time to go live | 3–6 months for greenfield; product-by-product for incumbents |

## 8. Why this beats incumbent pricing

- **Lower entry cost:** no upfront licence; a bank can prove the core on Community before buying.
- **Pay as you grow:** usage pricing fits virtual banks and fintechs that start small.
- **No lock-in premium:** open code and open data formats make the bank's exit cost low, which removes a major objection in procurement.
- **Faster payback:** Master Builder and partner delivery cut implementation cost, the largest part of a core replacement budget.

## 9. Path to unicorn scale

A valuation of $1B or more at today's infrastructure-software multiples (roughly 10–15× ARR) needs about **$70–100M ARR**, or about $50M with growth above 60% and strong expansion. Comparable core banking platforms (for example Thought Machine and Mambu) were reported above $1B in the 2021–22 funding rounds, at higher multiples than today.

### Illustrative mix at about $80M ARR (year 5–6)

| Segment | Typical annual contract | Customers | ARR |
|---|---|---|---|
| Virtual banks, fintechs, BNPL, leasing companies | ~$1M | 20 | $20M |
| Regional and mid-size banks | ~$5M | 8 | $40M |
| Tier-1 bank, one product line first | ~$20M | 1 | $20M |

### Go-to-market sequence

1. **Beachhead: Thailand, then ASEAN.** Greenfield buyers that decide in months: virtual banks, leasing and hire-purchase companies, digital brands of incumbents. Built-in hire purchase, fleet and floor plan is the wedge.
2. **Progressive modernization of incumbents.** One product line next to the legacy core (digital savings, SME lending, a leasing book), then the migration factory for the rest.
3. **Regional expansion:** Singapore, Malaysia, Indonesia, the Philippines, Vietnam, then the Middle East, one jurisdiction pack per market.
4. **Tier 1 last,** starting with one product line, on the strength of references and audited benchmarks.

### Scaling delivery without a services army

- AI does much of the implementation work: Master Builder and the product copilot configure products, AI proposes migration mappings, the simulator generates tests. Target go-live in **3–6 months** for greenfield instead of 18–24.
- Certified local partners deliver projects; our services stay below 20% of revenue.
- The open-source launch with reproducible benchmarks builds a developer-led pipeline inside banks.

### Moat

Correctness record and audited parallel runs; jurisdiction packs maintained with update guarantees; the integration marketplace per market; governed AI that regulators can accept; and expansion from one module to many inside each customer.

### Milestones and funding (indicative)

| Stage | Product (roadmap) | Business proof | Funding |
|---|---|---|---|
| Year 0–1 | Phases 0–1, open-source launch with the 10,000/s benchmark | 1–2 design partners; first bank live | Seed / Series A, $5–15M |
| Year 2 | Phases 2–3, SOC 2 and ISO 27001 | 3–5 live customers, $5–10M ARR, first integrator partners | Series A/B, $30–50M |
| Year 3–4 | Phase 4, migration factory, multi-region | 15–25 customers in 3+ countries, $25–40M ARR, net retention above 130% | Series B/C, $80–150M |
| Year 5–6 | Phase 5, billion-account certification | $70–100M ARR, first tier-1 reference, regulator acceptance in 5+ markets | Series C/D at $1B+ valuation |

### Organization

From about 30 to 300–500 people. Product engineering stays the largest group; customer success and partner enablement grow early; regulatory specialists are hired per region; a correctness and reliability group reports to the CTO.

### Top risks

| Risk | Mitigation |
|---|---|
| Long bank sales cycles | Start with greenfield and leasing buyers; product-by-product adoption for incumbents |
| Regulator acceptance | Engage early; IT risk documentation from Phase 0 |
| A correctness incident | Ledger invariants, property-based tests, parallel runs, chaos testing |
| Competitor response | Win on time to go live, cost, ASEAN lending depth and governed AI |
| Running out of funding before references | Raise enough to reach two live banks |
