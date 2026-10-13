# 09 — Open decisions

Decisions that shape Phase 0. Each has a recommended default; the plan is written against the defaults.

| # | Decision | Options | Recommended default | Why it matters |
|---|---|---|---|---|
| 1 | **Launch market** | Thailand, other ASEAN, multi-market from day one | Thailand first, jurisdiction packs for the rest | Drives regulation, tax (VAT on HP), payments (PromptPay), data residency |
| 2 | **Business model** | Build our own bank, sell the core as SaaS to banks, or both | SaaS core with a design-partner bank (virtual bank or leasing company) | Determines multi-tenancy priority and go-to-market |
| 3 | **First customer / design partner** | Virtual bank, leasing/HP company, SME bank | Leasing/HP company or virtual bank | A real book to parallel-run against de-risks correctness |
| 4 | **Hosting** | Public cloud (in-region), bank private cloud, hybrid | Public cloud in-country region, deployable on private cloud | Regulator cloud rules, cost, speed |
| 5 | **Primary language** | Kotlin/JVM, Go, Rust, Java | Kotlin/JVM | Talent, decimals, ecosystem ([ADR-0001](adr/0001-language-and-runtime.md)) |
| 6 | **Ledger store** | PostgreSQL sharded, TigerBeetle, custom | PostgreSQL first, benchmark-driven switch | ([ADR-0002](adr/0002-ledger-storage.md)) |
| 7 | **Product logic** | Typed blocks + CEL, Python smart contracts, code per product | Typed blocks + CEL | ([ADR-0003](adr/0003-product-definition.md)) |
| 8 | **Cards** | Out of scope, integrate a processor, build | Integrate a processor | Large scope; PCI DSS |
| 9 | **LLM providers and residency** | Single provider, model gateway, self-hosted for PII | Model gateway, PII tokenized before external calls | Data residency and vendor risk |
| 10 | **Team and budget** | Lean (~15) vs full (~30+) | ~25–35 for the 20-month plan | Timeline in [07](07-roadmap.md) assumes this |
