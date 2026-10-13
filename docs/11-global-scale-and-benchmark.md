# 11 — Global scale and competitive benchmark

Two questions: can CoreBank run a global bank, and where does it stand against what global banks and the leading core banking platforms offer today?

## 1. What "global bank" means in numbers

The design point is a tier-1 universal bank operating in many countries. These are sizing assumptions to design and test against, not claims about any specific bank.

| Dimension | Design point | Stretch (headroom) |
|---|---|---|
| Customers | 150 million | 300 million |
| Accounts and contracts | 1 billion | 2 billion |
| Legal entities and countries | 60 entities, 40 countries, 30 currencies | 100 entities |
| Postings per day | 1 billion batches | 2 billion |
| Sustained peak | 100,000 batches/s globally | 250,000 batches/s burst (salary day, shopping festivals) |
| Posting latency, within a cell | p99 < 50 ms | p99 < 30 ms |
| Cross-region transfer | p99 < 300 ms | — |
| Availability, posting path | 99.995% per region | 99.999% with cell isolation |
| Zone loss | RPO 0, RTO < 5 min (automatic) | — |
| Region loss | RPO ≤ 60 s, RTO ≤ 30 min | RPO 0 for designated critical cells via synchronous paired regions |
| Online history | 13 months in OLTP, 10+ years queryable | — |

These replace the earlier single-region targets (RTO 15 min, region RPO 5 min, RTO 4 h) for the global tier. A single-country virtual bank can still run the smaller profile.

## 2. Where performance comes from

Throughput at this scale is a design property, not a tuning exercise. The language and database are not the bottleneck; contention, round trips and unnecessary writes are.

### 2.1 Scale out by cells, not by bigger machines

- A **cell** is a complete stack (services, ledger shards, databases, Kafka partitions) serving a set of tenants or a range of accounts. Cells share nothing on the posting path.
- **Design point: 10,000 batches/s per cell at 60% utilization headroom**, so a cell is provisioned for about 16,000/s.
- **Global sizing:** 100,000/s ÷ 6,000/s usable per cell ≈ 17 cells, plus one spare cell per region. Four regions of five cells covers the design point; the stretch target adds cells, not redesign.
- A **global directory** maps every account and tenant to its home region and cell. It is cached at every gateway, so routing costs no extra network hop.

### 2.2 The ledger write path

| Technique | What it does | Effect |
|---|---|---|
| Single-shard batches | All accounts of one contract live on one shard | Over 95% of postings are one local transaction |
| Group commit | Batches arriving within ~1 ms on a shard commit in one database transaction | One disk flush for many batches; throughput rises sharply under load while p99 stays inside budget |
| Ordered row locks | Balance rows locked in ascending account id | No deadlocks, same behavior on PostgreSQL and Oracle |
| Asynchronous internal balances | Customer accounts check available balance synchronously; internal and GL accounts (suspense, settlement, income) only append postings and are summed asynchronously | Removes the classic hot-account bottleneck: a bank's settlement account no longer serializes millions of transfers |
| Hot customer accounts | Very busy customer accounts (a payment processor, a large merchant) are striped into sub-accounts with a reserve pool | Parallel posting on one logical account |
| Prepared, batched SQL | Multi-row inserts, no ORM, minimal indexes on hot tables | Fewer round trips and less write amplification |
| Date partitioning and tiering | Postings partitioned by booking date; partitions older than 13 months move to Iceberg, still queryable | OLTP tables stay small and fast |

### 2.3 Accrual and scheduling for a billion accounts

The original design used one durable workflow timer per account. That is elegant for thousands of contracts and wrong for a billion: it would mean a billion long-lived workflows. The global design separates three things:

1. **Account-level accrual is computed, not posted daily.** Accrued interest is a deterministic function of the balance history and the product version, kept in an accumulator on the account. It is posted to the ledger when it matters: on billing, capitalization, payoff, rate change, balance change on a tiered product, or month end.
2. **GL-level accrual is posted daily in aggregate**, per product, entity and currency. The general ledger is correct every day without a billion daily postings.
3. **Due work is scheduled by a partitioned time-wheel**, not by workflows. Each shard keeps a due-queue indexed by time bucket; workers on that shard drain it. One billion daily events is about 11,600 per second globally, spread across all shards. Temporal stays for long-running business processes (origination, restructuring, repossession), where it fits.

Month-end and salary-day peaks are handled by **spreading booking time while keeping the value date**: capitalization for 500 million savings accounts carries a value date of the 30th but is booked across the night by shard, with jitter.

See [ADR-0007](adr/0007-scheduling-and-accrual-at-scale.md).

### 2.4 Multi-region topology

- Each customer and account has a **home region**, chosen by the tenant's data residency rules. All writes for an account happen in its home region; there is no multi-master write conflict to resolve.
- **Cross-region transfers** use the same reserve → commit saga as cross-shard transfers, through regional clearing accounts. Expected p99 under 300 ms.
- Each region has a **paired DR region** within the same residency boundary, fed by continuous replication (RPO ≤ 60 s). Designated critical cells can use synchronous replication to a nearby paired region for RPO 0, at a latency cost.
- A **global control plane** (product catalog, directory, configuration, model registry) is replicated read-only to every region, so a region keeps working if the control plane is unreachable.

See [ADR-0008](adr/0008-global-multi-region-topology.md).

### 2.5 Reads never compete with writes

- Balance checks for payments go to the primary. Everything else (app balance display, history, statements, analytics) goes to replicas, a read model, or the lakehouse.
- Transaction history beyond recent days is served from ClickHouse or Iceberg, not the OLTP database.
- Statements, regulatory reports and model training never touch the posting path.

### 2.6 Latency budget for one payment (p99)

| Hop | Budget |
|---|---|
| Edge gateway, authentication, idempotency check | 5 ms |
| Domain service logic | 5 ms |
| Fraud score (in parallel with limit check) | 15 ms |
| Ledger: lock, validate, write, commit | 20 ms |
| Network and serialization | 5 ms |
| **Total** | **≤ 50 ms** |

### 2.7 How we prove it

- **Phase 0 exit:** one cell sustains 10,000 batches/s at p99 < 50 ms on PostgreSQL, with an Oracle baseline recorded.
- **Scale-out test (new, Phase 1):** 10 cells reach 100,000 batches/s with at least 90% linear scaling efficiency, using a realistic mix (payments, card holds, transfers, loan repayments, hot internal accounts).
- **Billion-account test (new, Phase 3):** a synthetic book of 1 billion accounts; month-end capitalization completes within the night window per region; zone and region failover drills meet RPO and RTO.
- Every release: load test at 2× peak, 72-hour soak, chaos on the posting path, and a hard CI gate on p99 regressions.

## 3. Global bank capability check

Status: Covered = in the current plan · Partial = partly covered · Gap = not planned before this review. "Phase" is when CoreBank delivers it after the changes below.

| # | Capability a global bank needs | CoreBank status | Phase | Action |
|---|---|---|---|---|
| 1 | Billion-account scale, 100k/s postings | Partial → covered | 0–3 | Section 2 design, scale-out and billion-account tests |
| 2 | Multi-region active-active with data residency | Partial → covered | 3–4 | Home-region routing, paired DR regions (ADR-0008) |
| 3 | 24/7, no end-of-day freeze, per-entity business dates and time zones | Covered | 1 | Already core; add per-entity cut-off calendars |
| 4 | Multi-entity, multi-currency, multi-GAAP (local GAAP and IFRS group reporting) | Partial | 3 | Add parallel ledgers by accounting book |
| 5 | Deposits, lending, leasing, hire purchase, fleet, floor plan | Covered | 1–2 | — |
| 6 | Risk-free-rate lending (SOFR, SONIA, €STR, THOR compounded in arrears, lookback, observation shift) | Gap | 3 | Add RFR compounding block to the product engine |
| 7 | Syndicated and agency loans | Gap → planned native | 3–5 | Native `syndication` service: lender role in Phase 3, agent in Phase 4 ([12](12-trade-treasury-syndication.md)) |
| 8 | Trade finance (letters of credit, guarantees, collections, supply-chain finance) | Gap → planned native | 3–5 | Native `trade-finance` service on a contingent ledger ([12](12-trade-treasury-syndication.md)) |
| 9 | Global cash management: cross-border pooling, virtual accounts, ISO 20022 statements | Partial | 3–4 | Extend sweeps to cross-currency and cross-entity pooling |
| 10 | Treasury: FX positions, deals, nostro reconciliation, liquidity (LCR and NSFR inputs) | Gap → planned native | 3–4 | Native `treasury` and `market-data` services ([12](12-trade-treasury-syndication.md)) |
| 11 | Correspondent banking and SWIFT gpi tracking | Partial | 4 | gpi status in payments-hub, vostro accounts |
| 12 | Card issuing at scale | Partial | 2 | Through processors; holds and clearing already designed |
| 13 | Sanctions screening at payment speed | Partial | 1 | Screening inside the 50 ms budget, with case management |
| 14 | Regulatory capital and risk data (Basel III and IV inputs, BCBS 239 lineage) | Partial | 3–4 | Lineage from every report figure back to postings |
| 15 | Multi-jurisdiction packs (Thailand, Singapore, Hong Kong, EU, UK, US) | Partial | 4–5 | One jurisdiction pack per market: tax, disclosure, caps, reporting |
| 16 | Islamic banking (murabaha, ijarah, wakalah, profit-sharing deposits) | Gap | 5 | Product-engine blocks for profit-based contracts; needed for Malaysia and Indonesia |
| 17 | Open banking APIs (consent, third-party access) | Partial | 3 | Consent registry exists; add standard API profiles per market |
| 18 | Operational resilience rules (EU DORA, UK operational resilience, BOT) | Partial | 3 | Impact tolerances, severe-scenario testing, third-party register |
| 19 | Migration from legacy cores at scale | Partial | 4 | Migration factory: mapping, parallel run, cut-over by product, branch or country |
| 20 | Certifications and references (SOC 2, ISO 27001, PCI DSS, live tier-1 reference) | Gap | 3–5 | Certify early; win one design-partner bank as the reference |

## 4. Against the leading platforms

This compares CoreBank with the **typical public positioning** of two groups of platforms. It is a planning aid, not a vendor evaluation; each point must be validated in proper due diligence.

- **Established global cores**, such as Temenos Transact, Oracle FLEXCUBE, Infosys Finacle and TCS BaNCS: very broad functionality and decades of tier-1 deployments, historically built around end-of-day batch processing and heavy customization.
- **Cloud-native cores**, such as Thought Machine Vault, Mambu and 10x SuperCore: modern architectures, real-time processing and configurable products, with narrower coverage of commercial, trade and treasury functions.

| Dimension | Established global cores | Cloud-native cores | CoreBank target | How we win |
|---|---|---|---|---|
| Functional breadth | Very broad, incl. trade and treasury | Retail and SME focus | Retail, SME, commercial, leasing, fleet, floor plan, trade finance, treasury operations, syndication | Native on one ledger and limit tree, so trade, FX and syndicated exposure are real time and in one customer view |
| Processing model | Often batch close of business | Real time | Real time, no end-of-day, at billion-account scale | Computed accrual and time-wheel scheduling (ADR-0007) |
| Product change | Configuration plus code and releases | Configuration or smart-contract code | Typed blocks plus CEL, simulated and approved in days | Business users change products without code, with golden tests |
| AI | Add-on tools | Add-on tools | Agents operate the bank through governed tools, with delegated authority and audit | The only design where AI is a first-class, controlled operator |
| Determinism and replay | Varies | Strong | Bitemporal ledger, deterministic replay, simulation | Back-valuation and what-if without manual fixes |
| Asian lending specifics | Via localization | Via localization | Built in: flat-to-EIR, VAT per installment, HP rate caps, floor plan, fleet | Faster to market in ASEAN, where hire purchase is large |
| Database and stack | Often tied to a commercial database | Vendor cloud or specific stack | Open source; PostgreSQL default, Oracle certified; runs on the bank's approved stack | Passes bank technology governance with no lock-in |
| Licence cost | High licence and maintenance | Subscription | No licence fees for the stack; services and support model | Lower total cost of ownership |
| Deployment | On-premises or managed | Mostly SaaS | SaaS, bank private cloud or on-premises | The bank chooses, including in-country hosting |
| Track record | Many tier-1 banks | Growing list | None yet | Biggest gap: needs a design partner and certifications |

### Where we must not be beaten

1. **Correctness:** no unbalanced posting, ever; daily reconciliation at zero.
2. **Real-time at scale:** no batch window even at month end for a billion accounts.
3. **Speed of change:** a new product variant in days, safely.
4. **Governed AI:** every agent action within authority and fully auditable.

### Where we are behind today, and the plan

1. **Proven references.** Win one design-partner bank, run a parallel run against a real book, and publish benchmark results with an independent auditor.
2. **Trade finance, treasury and syndication.** Built natively from Phase 3, complete in Phase 4 ([12](12-trade-treasury-syndication.md)).
3. **Jurisdiction breadth.** Build one jurisdiction pack per target market, starting with Thailand, then Singapore, Malaysia and Indonesia.
4. **Certifications.** SOC 2 Type II and ISO 27001 before the first production launch; PCI DSS where card data is in scope.

## 5. Roadmap impact

- **Phase 1:** scale-out test to 100,000/s across 10 cells; sanctions screening inside the payment latency budget.
- **Phase 3:** RFR compounding, multi-GAAP books, open banking profiles, operational resilience controls, billion-account test.
- **Phase 3 and 4:** native trade finance, treasury operations and syndication ([12](12-trade-treasury-syndication.md)).
- **Phase 4:** multi-region active-active, migration factory.
- **Phase 5, new (months 30–42): global bank.** Additional jurisdiction packs, Islamic banking, cross-border pooling, digital trade, tier-1 certification and reference program.
