# Console specs for engineering

These specs turn the clickable console prototype (`docs/design/console-prototype`) into the backlog for the production console (`web/apps/console`, ADR 0011) and the core services behind it. There is one spec per area. Each says what to build: the screens, the fields, the actions with their rules and approvals, the values the bank configures, and the core call behind every action, either an endpoint that exists today or one marked **New**.

The prototype is the reference for behaviour and wording; where a spec and the prototype disagree, the spec wins and the prototype is fixed. Every figure in the prototype is sample data. Every regulatory rule is the prototype's reading and is marked *to confirm*: counsel and compliance confirm the reading, and the bank sets the values through configuration, never in code.

## Files

| File | What it is |
|---|---|
| [core-api-inventory.md](core-api-inventory.md) | Every endpoint the core exposes today, generated from the controllers |
| [prototype-inventory.md](prototype-inventory.md) | Every record page, action and approval rule in the prototype, generated from the running page |
| [00-cross-cutting.md](00-cross-cutting.md) | What every screen shares: roles and authority, maker-checker, the action dialog, history, idempotency, languages and dates, tenants, the Workbench, approvals, exceptions, Copilot |
| [01-onboarding.md](01-onboarding.md) | Individual and business account opening, KYC refresh |
| [02-retail-lending.md](02-retail-lending.md) | Loan application, credit review, credit committee, approval to payout, home-loan servicing, the credit policy |
| [03-business-banking.md](03-business-banking.md) | Commercial credit, the relationship view, monitoring and early warning, commercial facilities |
| [04-trade-and-syndication.md](04-trade-and-syndication.md) | Letters of credit, guarantees, syndicated loans as agent |
| [05-collections.md](05-collections.md) | Strategy, contact and promises, hardship and restructuring, legal and write-off, repossession and auction |
| [06-leasing-and-auto-finance.md](06-leasing-and-auto-finance.md) | Hire purchase from quote to registration book, leases, fleet, floor plan, dealers |
| [07-deposits.md](07-deposits.md) | Accounts, legal orders, dormancy and unclaimed money, term deposits and withholding tax, statements |
| [08-payments.md](08-payments.md) | Rails and cut-offs, large-value and SWIFT transfers, payroll files, standing orders, recalls, held payments |
| [09-branch.md](09-branch.md) | The counter, the cash drawer, the vault, end of day |
| [10-treasury.md](10-treasury.md) | Liquidity, interest-rate risk, FX deals, nostro reconciliation |
| [11-finance-and-control.md](11-finance-and-control.md) | Loss allowance, BOT data sets, reconciliation, month-end close, the ledger, the exception centre |
| [backlog.md](backlog.md) | Every **New** core call and screen from the specs in one list, grouped into deliverable slices |

The two field dictionaries already generated from the prototype stay where they are and are the field-level spec for their forms: [loan-application-fields.md](../loan-application-fields.md) and [account-opening-fields.md](../account-opening-fields.md).

## The template every area spec follows

1. **Scope and users.** What the area covers and leaves out; the roles that use it and what each may do.
2. **Screens.** Each list section and record page: its route, the record id pattern, the facts strip, each tab and the data it needs. Prototype record ids are named so a reader can open them.
3. **Fields.** For every form or action dialog: field, English label, Thai label, type, required, source (customer, staff, a register such as DOPA or NCB, the core, a calculation), validation. A form that already has a field dictionary links to it instead.
4. **Actions.** One table row per action: who may start it; when it is refused or blocked (and the message); what the review step must show; the approval rule (action key from the authority matrix, or a named rule such as maker-checker, dual control or a vote); the effect (state change, postings, notices sent); and the **core call**: an endpoint from the inventory, or **New** with a proposed method and path.
5. **States.** The lifecycle of each record as a table of state, how it is entered, what may happen next.
6. **Postings.** Where an action moves money or changes a balance: debit and credit accounts by GL code where the prototype names one.
7. **Configurable values.** Key, the prototype's sample value, who sets it (*bank* for appetite and fees; *regulator, locked* for values the bank may tighten but not loosen), and the rule it comes from, marked *to confirm*.
8. **Acceptance criteria.** Given / when / then, taken from the prototype's tests and blocked paths, so a story is done when the console behaves this way against the real core.
9. **Gaps against the core.** The **New** calls and any domain module that does not exist yet.
10. **Open questions.** Decisions for the bank, counsel or engineering.

## Conventions

- Money is THB with two decimals unless the record's currency says otherwise; amounts in the core are minor units.
- Dates are business dates in Asia/Bangkok; screens show Buddhist years in Thai. The prototype's business date is Saturday 24 Oct 2026.
- Every action is idempotent: the dialog's reference (shown as `IDEM-…`) is sent as the request's `reference` field, which the core already uses as the posting's idempotency key (for example `MoneyMove.reference` in `BankingController`).
- **New** endpoints follow the existing style: `/api/v1/<resource>/{id}/<verb-noun>` for actions, plural nouns for collections.
