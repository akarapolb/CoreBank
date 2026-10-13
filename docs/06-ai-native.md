# 06 — AI-native layer

"AI-native" means three things here:

1. **The bank is operable by agents.** Every capability is a typed, permissioned tool. An AI agent can do anything a human operator can do, through the same controls, and nothing more.
2. **Decisions are model-driven and governed.** Credit, fraud, AML, pricing, collections and ECL use ML models that are registered, explainable, monitored and challengeable.
3. **Data is AI-ready by construction.** Every state change is an event with a schema, so features, training sets and audit trails come for free.

## Agent architecture

```
  Agent (customer assistant / ops agent / RM copilot / product copilot)
        │ tool call
        ▼
  Agent gateway
   ├─ Tool registry (MCP manifests generated from OpenAPI contracts)
   ├─ Identity: agent identity + human principal it acts for ("on_behalf_of")
   ├─ Delegated authority: per-tool, per-amount, per-risk limits for each agent role
   ├─ Policy engine (OPA/Cedar): entitlements, maker-checker, step-up auth, cooling-off
   ├─ Guardrails: PII redaction, prompt-injection defenses, output validation
   ├─ Human-in-the-loop queue for actions above authority
   └─ Audit: prompt, retrieved context, tool calls, model version, outcome
        │
        ▼
  Domain service APIs (same ones the apps use)
```

Rules:

- Agents never get database access or a privileged API. They call the public APIs as a constrained principal.
- **Read tools** are broadly available; **write tools** are tiered: *propose* (creates a draft for a human), *execute within authority* (e.g. waive a late fee up to a limit), *never* (e.g. change GL mapping).
- Every write by an agent carries `actor.type = AGENT`, the agent id, model version, and the human or customer on whose behalf it acted.
- Tool responses to agents are filtered by data classification and the principal's entitlements.

## Use cases by priority

### Tier 1 (launch)

| Use case | Who | What the AI does |
|---|---|---|
| **Credit decisioning** | Retail, virtual bank | Scores applicants with bureau + alternative data (transaction history, e-wallet, telco with consent), returns decision, limit, price and reason codes |
| **Document intelligence** | Onboarding, SME lending, leasing | Extracts and verifies ID, payslips, bank statements, financial statements, vehicle registration, invoices |
| **Fraud and AML** | All | Real-time transaction scoring on the posting path (< 30 ms budget), graph analytics for mule networks, alert triage with drafted narratives (SAR drafts for human filing) |
| **Customer assistant** | Virtual bank | Answers balance/transaction/loan questions, explains fees, initiates servicing (payment holiday request, early settlement quote) through tools |
| **Ops copilot** | Back office | Investigates breaks, explains why a balance is what it is (traces postings), drafts corrections for maker-checker |

### Tier 2

| Use case | What the AI does |
|---|---|
| **Collections** | Propensity-to-pay, best channel/time, treatment selection, AI voice/chat agents for soft collections within conduct rules, promise-to-pay tracking |
| **RM copilot (commercial)** | Customer 360, credit memo drafting, covenant monitoring from uploaded financials, cross-sell signals |
| **Product copilot** | Drafts product definitions from a natural-language brief, runs simulations, flags regulatory caps and disclosure issues |
| **Dynamic pricing** | Risk- and elasticity-based pricing within approved corridors |
| **IFRS 9 SICR and PD/LGD** | Early-warning signals for staging, model challenger for ECL |
| **Reconciliation agent** | Matches external statements, proposes adjusting entries |

### Tier 3

- Cash-flow forecasting and lending for SMEs from transaction data
- Residual value prediction for leasing assets
- Regulatory reporting assistant (maps requests to data, drafts returns for review)
- Natural-language analytics for management ("what drove NPL increase in motorcycle HP last month?")

## Model risk management

Aligned with SR 11-7 style MRM and local regulator expectations (e.g. Bank of Thailand guidance on risk management of AI/ML, if Thailand is the launch market):

- **Model inventory** with owner, purpose, tier, data lineage, approval status.
- **Validation** independent of development; challenger models; bias and fairness testing on protected attributes.
- **Explainability**: reason codes for every adverse credit decision (customers have a right to know); SHAP-based explanations stored with the decision.
- **Monitoring**: drift, stability (PSI), performance vs outcome, override rates; automatic fallback to rule-based policy on breach.
- **LLM-specific**: evaluation suites per agent (accuracy, refusal correctness, tool-call correctness, injection resistance), red-teaming before release, versioned prompts, kill switch per agent.
- **Data residency**: model routing honors tenant data residency; PII is tokenized before reaching external model providers unless a compliant deployment is used.

## Data foundation

- Domain events (Avro/Protobuf, schema registry) → Kafka → lakehouse (Iceberg).
- Feature store with point-in-time correct joins for training and the same features online for serving.
- Customer consent registry gates which data may be used for which purpose (PDPA/GDPR purpose limitation).
- Vector index over product terms, policies, procedures and regulations for retrieval-augmented agents, with citation of sources in answers.
