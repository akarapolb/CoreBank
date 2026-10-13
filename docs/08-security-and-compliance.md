# 08 — Security, risk and compliance

## Security architecture

- **Zero trust**: mTLS between all services (service mesh), workload identity, no shared secrets, network policies deny-by-default.
- **Identity and access**: OIDC for staff and customers; fine-grained authorization with a policy engine (OPA or Cedar); roles, attributes and delegated authority limits; step-up authentication for sensitive actions.
- **Maker-checker**: configurable per operation (product publish, GL mapping change, manual posting, limit override, fee waiver above threshold, write-off).
- **Data protection**: encryption in transit (TLS 1.3) and at rest (KMS/HSM-managed keys, per-tenant keys); PII in a tokenization vault; field-level encryption for national ID, account numbers in logs are masked.
- **Tamper-evident audit**: append-only audit log with hash chaining, shipped to WORM storage; covers human, system and AI agent actions.
- **Secure SDLC**: threat modeling per service, SAST/DAST/SCA in CI, signed artifacts (SLSA), SBOMs, dependency pinning, secret scanning, annual pentests plus continuous bug bounty after launch.
- **Resilience**: multi-AZ, DR region, regular failover drills, backup restore tests, chaos engineering on the posting path.

## Regulatory mapping (initial assumption: Thailand launch, multi-jurisdiction design)

> Confirm the launch market in [09](09-open-decisions.md). The design keeps regulation in **jurisdiction packs** (calendars, tax, disclosure rules, caps, reports) so other markets are configuration.

| Area | Requirement (Thailand example) | Platform capability |
|---|---|---|
| Virtual bank licensing | Bank of Thailand virtual bank framework | Full core, IT risk documentation, outsourcing controls, cloud governance |
| IT risk | BOT IT risk, cyber resilience and cloud computing guidelines | Security architecture above, DR drills, incident reporting |
| Data privacy | PDPA | Consent registry, purpose limitation, data subject rights workflows, retention policies |
| Accounting | TFRS 9 (financial instruments), TFRS 16 (leases) | EIR engine, ECL engine, lessor accounting |
| Market conduct | BOT market conduct rules, responsible lending | Affordability checks, disclosures, fee caps, complaint handling, collections conduct rules |
| Hire purchase | Auto hire-purchase rules (effective rate disclosure, rate caps, early settlement rebates) | Product engine caps, annuity-from-flat with EIR disclosure, rebate formulas |
| Tax | VAT on HP installments, withholding tax on deposit interest, e-Tax invoice | Tax blocks in product engine, invoice generation |
| AML/CFT | AMLO requirements | Screening, monitoring, case management integration, reporting |
| Payments | PromptPay / ITMX, ISO 20022 | Payments hub adapters |
| Regulatory reporting | BOT data management system (DMS) returns | Reporting data marts fed from events |
| Deposit protection | DPA reporting | Per-depositor aggregation reports |

## Operational risk controls built into the core

- Daily automated reconciliations: ledger ↔ GL, ledger ↔ payment rails, ledger ↔ card processor, suspense aging.
- Exception queues with SLAs and ownership; AI drafts explanations and fixes for maker-checker.
- Four-eyes on manual journal entries with reason codes.
- Product and pricing changes always simulated and approved before publish.
