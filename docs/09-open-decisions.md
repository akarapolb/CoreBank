# 09 — Open decisions

Decisions that shape Phase 0. Each has a recommended default; the plan is written against the defaults.

| # | Decision | Options | Recommended default | Why it matters |
|---|---|---|---|---|
| 1 | **Launch market** | Thailand, other ASEAN, multi-market from day one | Thailand first, jurisdiction packs for the rest | Drives regulation, tax (VAT on HP), payments (PromptPay), data residency |
| 2 | **Business model** | Build our own bank, sell the core as SaaS to banks, or both | SaaS core with a design-partner bank (virtual bank or leasing company) | Determines multi-tenancy priority and go-to-market |
| 3 | **First customer / design partner** | Virtual bank, leasing/HP company, SME bank | Leasing/HP company or virtual bank | A real book to parallel-run against de-risks correctness |
| 4 | **Hosting** | Public cloud (in-region), bank private cloud, hybrid | Public cloud in-country region, deployable on private cloud | Regulator cloud rules, cost, speed |
| 5 | **Primary language** | Java, Kotlin, Go, C#/.NET | Java 21 + Spring Boot | Bank-approved stacks, decimals, talent ([ADR-0001](adr/0001-language-and-runtime.md)) |
| 5a | **Design-partner bank's approved stack** | Their technology standards list | Certify our defaults against it; swap via ports ([ADR-0004](adr/0004-bank-stack-compatibility.md)) | Database (Oracle?), platform (OpenShift?), messaging (IBM MQ?) |
| 6 | **Ledger store** | PostgreSQL sharded, TigerBeetle, custom | PostgreSQL first, benchmark-driven switch | ([ADR-0002](adr/0002-ledger-storage.md)) |
| 6a | **Databases supported** | PostgreSQL only, multi-database | **Decided:** multi-database, PostgreSQL default, Oracle certified, SQL Server / Db2 on demand | ([ADR-0005](adr/0005-multi-database-support.md)) |
| 7 | **Product logic** | Typed blocks + CEL, Python smart contracts, code per product | Typed blocks + CEL | ([ADR-0003](adr/0003-product-definition.md)) |
| 8 | **Cards** | Out of scope, integrate a processor, build | Integrate a processor | Large scope; PCI DSS |
| 9 | **LLM providers and residency** | Self-hosted open-weight models only, or also commercial model APIs | Open-source gateway; self-hosted OSI-licensed open-weight models by default, commercial APIs optional with PII tokenized | Open-source policy, data residency, quality on Thai-language tasks |
| 11 | **Open-source policy** | — | **Decided:** open source only, OSI licences, enforced in CI ([ADR-0006](adr/0006-open-source-only.md)) | Bank-licensed infrastructure (e.g. Oracle) stays optional and customer-provided |
| 12 | **Product and company name** | Plinth, Bilanx, Equora, Zenqo Core, Akorn Core, Favor OS, Fabor OS | **Decided:** **Fabor OS**, "The Financial and Banking Operator"; company **Fabor**. Pending trademark clearance (TH, SG, EU, US; classes 9, 36, 42), domains and GitHub organisation | Needed before the open-source launch and for the trademark policy |
| 10 | **Team and budget** | Lean (~15) vs full (~30+) | ~25–35 for the 20-month plan | Timeline in [07](07-roadmap.md) assumes this |
