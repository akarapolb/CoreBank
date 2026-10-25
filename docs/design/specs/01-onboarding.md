# 01 · Onboarding

Opening a new individual customer with a savings account (ONB-7731, Weerapong Chaisiri at branch 0123) and a business customer with current and FCD accounts (AO-26-0412, Lanna Craft Export Co., Ltd.), plus the periodic KYC refresh queue. Source: `console-prototype/js/onboarding.js`, the lists in `js/data.js` and `js/deposits.js`. Field-level spec: [account-opening-fields.md](../account-opening-fields.md) (98 individual fields in 9 steps, 115 business fields in 10 steps), generated from the same catalogue the screens use.

## 1. Scope and users

| In scope | Out of scope (other specs) |
|---|---|
| Individual opening at the branch (card reader, DOPA, NDID or video) | Lending applications (02) |
| Business opening by an RM (company, directors, owners, mandate) | Legal orders, dormancy on existing accounts (07) |
| Live completeness, cross-checks and customer-risk score | Sanctions case handling after a true match (AML, 11) |
| Routing by risk: open now, branch manager or head of business banking, compliance | Product setup of the savings and current accounts (Product Factory) |
| KYC refresh queue (periodic review, ownership change, adverse media, address change) | |

| Role | May |
|---|---|
| Teller / ops (`ops`) | Start and complete an individual opening; open low-risk at once |
| RM (`credit` in the prototype, an RM role in production) | Start and complete a business opening |
| Branch manager | Approve a medium-risk individual |
| Head of business banking | Approve a medium-risk business |
| Compliance (`compliance-analyst` in the core) | Enhanced due diligence for high risk; release a party held for review |
| Senior manager | Second approval on high risk after compliance |

## 2. Screens

| Screen | Route / id | Facts and content |
|---|---|---|
| Onboarding list | `customers/onboarding` | Application, applicant, channel (Branch 0123, App, RM), step reached, time waiting, state. ONB-7731 shows "Due diligence · 4 min · In progress"; ONB-7690 Korat Isuzu "Beneficial owners · 2 days · Documents missing". |
| Account opening list | `deposits/opening` | Business and individual openings with risk band and percent complete, computed live. |
| KYC reviews | `customers/kyc` | Customer, reason, risk, due date, owner. Sample: Malee Wongsa periodic (Low, 31 Oct), Siam Energy ownership change (Medium, 28 Oct), Pacific Import Trading adverse media (High, 25 Oct), Anan Chaiyo address changed (Low, 6 Nov). |
| Individual opening | `ONB-7731` | Header: "New customer: Weerapong Chaisiri", "Branch 0123, counter 3 · started 09:31", percent complete. Tabs = steps: Identity, Personal details, Contact and address, Occupation and income, Purpose and activity, Due diligence, Accounts and services, Consents, Review and open. A sticky summary card on every step: completeness, risk band and score with the factors, what is missing. |
| Business opening | `AO-26-0412` | Header: "Lanna Craft Export Co., Ltd.", "Business account opening · RM Pakorn T., Chiang Mai branch · started 22 Oct". Tabs: Company, Documents, Directors and signatories, Owners, Expected activity, Due diligence, Accounts and services, Signing mandate, Declarations, Review and open. Same summary card. |

**Every field** shows its source tag (DOPA, NDID, DBD, Staff, Customer, Record) and, when invalid after a check, an inline error. **Review and open** lists every missing or wrong answer with a *Fix* link that opens the step and focuses the field, the cross-checks, the risk factors, and the route.

**After opening**, the review step shows the outcome: individual "Opened: SAV-77310" with "debit card printed · PromptPay linked · app enrolment sent by SMS" (each only if chosen); business "Opened: CUR-B4471 and FCD-B4471", "Signing mandate and internet banking users set up; first KYC review in 2028." A routed application shows "With the branch manager" / "With the head of business banking" / "With compliance for enhanced due diligence".

Editing any answer after a route clears the routed state (the application must be submitted again).

## 3. Fields

The form fields are specified in [account-opening-fields.md](../account-opening-fields.md). Only one action dialog exists:

| Dialog | Fields |
|---|---|
| Open / route (`obOpen`) | None. The dialog states "Checks every answer, then opens or routes the application by its risk." |

Validation rules carried by the catalogue and needed in the backend: Thai national id checksum (13 digits, mod-11), company registration number checksum (13 digits), required-when conditions, dates not in the future, age bands, shareholdings and beneficial owners (below).

**Business cross-checks** (`bizCross`), shown on review and blocking:

| Check | Message |
|---|---|
| Shareholdings sum to 100% (±0.01) | "Shareholdings add up to {n}%, not 100%" |
| A corporate shareholder with 25% or more must have its natural-person beneficial owner named | "Shareholder 2 is a company with 25% or more: name the person behind it" |

## 4. Actions

| Action | Who | Refused / blocked when | Review shows | Approval rule | Effect | Core call |
|---|---|---|---|---|---|---|
| Save an answer | Maker | — | — | — | Field saved; summary and risk recalculated; any route cleared | **New** `PUT /api/v1/onboarding/{id}/answers` (partial, by field key) |
| Start an opening | Teller, RM | — | — | — | Draft created with an id (ONB-…, AO-…) and channel | **New** `POST /api/v1/onboarding` `{type: individual|business, channel, branch}` |
| Read the ID card / DOPA check | Teller | DOPA says the card is not valid | — | — | Identity fields filled and tagged DOPA | **New** `POST /api/v1/onboarding/{id}/identity/verify` (adapter to DOPA / card reader) |
| NDID / video identity | Customer (app), Teller | IAL below the product's need | — | — | Identity tagged NDID | **New** `POST /api/v1/onboarding/{id}/identity/ndid` |
| DBD company lookup | RM | Registration number fails checksum | — | — | Company fields, directors, registered capital filled, tagged DBD | **New** `GET /api/v1/registries/dbd/{regNo}` |
| Sanctions and PEP screening | System on save of each person | — | Near matches with score | Clearing a near match: maker clears with a reason, compliance on high | Screening state per person | Inside `POST /api/v1/customers` today (`SanctionsScreener.screen` at register); **New** `POST /api/v1/onboarding/{id}/screening` to screen before submission and `POST /api/v1/onboarding/{id}/screening/{hitId}/clear` |
| Open / route (`obOpen`) | Maker | Any required answer missing or invalid, or a cross-check fails: "{n} things to fix" with the first six, "Close this and use Fix on the review step." | "Customer risk: {band} · {score}", and the route text | By risk band (below) | Low: party ACTIVE, accounts opened, card/PromptPay/app as chosen, second-person check queued for the same day. Medium/High: routed, state "routed" | Individual low risk: `POST /api/v1/customers` (register: consents, PII tokenised, eKYC, sanctions, savings account). Routed: **New** `POST /api/v1/onboarding/{id}/submit` returning the route; business: **New** `POST /api/v1/business-customers` (party, mandate, accounts) |
| Approve a routed opening | Branch manager / head of business banking | Approver is the maker | Answers, risk factors, documents | Medium: one approver by type; High: compliance then senior manager | Party ACTIVE, accounts opened | **New** `POST /api/v1/onboarding/{id}/approve`; for a party already registered and held: `POST /api/v1/customers/{id}/release` (compliance-analyst) |
| Reject | Approver | — | Reason | — | Application closed, reasons kept; customer told without tipping off where AML-related | **New** `POST /api/v1/onboarding/{id}/reject` |
| Withdraw a consent | Customer, ops | — | — | — | Consent withdrawn with time and channel | `POST /api/v1/customers/{id}/consents/{purpose}/withdraw` |
| Second-person check on a low-risk opening | Ops (not the maker) | Checker is the maker | Answers and scans | Maker-checker | Check recorded or the account restricted | **New** `POST /api/v1/onboarding/{id}/check` |
| Start a KYC refresh | System by schedule or trigger, RM | — | — | — | A refresh case pre-filled from the party, due date by risk | **New** `POST /api/v1/customers/{id}/kyc-reviews` |
| Complete a KYC refresh | RM / KYC team | Missing documents (e.g. ONB-7690 beneficial owners' IDs) | Changes since last review, new risk | As opening, by new band | Next review date set; restrictions lifted or added | **New** `POST /api/v1/kyc-reviews/{id}/complete` |

**Route by risk** (`routeFor`):

| Band | Score | Route text | Button | Next review |
|---|---|---|---|---|
| Low | 0–3 | "Low risk: opens now, checked by a second person within the day; reviewed every 3 years." | Open the account | 3 years |
| Medium | 4–7 | "Medium risk: the branch manager approves; reviewed every 2 years." (business: head of business banking) | Send to the branch manager / head of business banking | 2 years |
| High | 8+ | "High risk: enhanced due diligence, then compliance and a senior manager approve." | Send to compliance | Yearly (to confirm) |

**Risk factors, individual** (`indFactors`; points add up):

| Factor | Points |
|---|---|
| Foreign national (nationality ≠ TH) | 2 |
| Opened without meeting in person (NDID or video) | 1 |
| Higher-risk industry (gems, money exchange, gaming, arms, antiques, used cars, real estate, NGO) | 3 |
| Money in well above the stated income (deposit band ≥ income band + 2) | 2 |
| Large regular cash | 2 |
| Transfers abroad / with a high-risk country (IR, KP, MM) | 1 / 4 |
| Politically exposed (self, family or associate) | 4 |
| Opening for someone else | 4 |
| First deposit from a loan or other source | 1 |

**Risk factors, business** (`bizFactors`):

| Factor | Points |
|---|---|
| Entity type: public company 0, company / partnership 1, branch of a foreign company 2, foundation 3 | 0–3 |
| Foreign owner (any shareholder or beneficial owner not TH) | 2 |
| Cross-border payments / with a high-risk country | 2 / 4 |
| Higher-risk industry | 3 |
| Large cash deposits | 2 |
| A beneficial owner is politically exposed | 4 |
| Adverse media | 3 |
| Nominee shareholders | 4 |
| Shell-company signs | 4 |
| Ownership through two or more layers | 2 |
| Passive entity (FATCA/CRS) | 1 |
| Registered less than a year ago | 1 |
| Premises not checked | 1 |

## 5. States

| Record | State | Entered by | Next |
|---|---|---|---|
| Opening | Draft (in progress) | Start | Save answers; Open/route |
| | Opened | Open, low risk | Second-person check |
| | Routed: approver / compliance | Open, medium/high | Approve, reject; any edit returns to Draft |
| | Rejected | Reject | — |
| Party (core `Party.Status`) | ACTIVE | Register passes eKYC and screening; release | Lending, KYC refresh |
| | UNDER_REVIEW | Register with a screening hit | Release by compliance |
| | REJECTED, KYC_FAILED | Register | — |
| KYC review | Due, In progress, Documents missing, Complete | Schedule or trigger | Complete sets next due date |

## 6. Postings

Opening posts nothing. An initial deposit is a normal deposit (07): `POST /api/v1/accounts/{id}/deposits`.

## 7. Configurable values

| Key | Sample | Set by | Rule |
|---|---|---|---|
| Risk factor points (each row above) | as listed | Bank (compliance) | AMLO customer risk assessment, *to confirm* |
| Band thresholds | Medium ≥ 4, High ≥ 8 | Bank (compliance) | *to confirm* |
| High-risk countries | IR, KP, MM | Regulator list (FATF), locked | AMLO / FATF, *to confirm* |
| Higher-risk industries | gems, moneyx, gaming, arms, antiques, usedcar, realestate, ngo | Bank (compliance) | *to confirm* |
| Review cycle by band | Low 3 years, Medium 2 years, High yearly | Bank, within regulator minimum | AMLO CDD, *to confirm* |
| Approver by band and customer type | branch manager / head of business banking / compliance + senior manager | Bank | Delegation of authority |
| Beneficial-owner threshold | 25% | Regulator, locked | AMLO, *to confirm* |
| Ownership layers that add risk | 2 | Bank | *to confirm* |
| Second-person check window for low risk | same day | Bank | *to confirm* |
| Consent purposes and versions | KYC_PROCESSING, SCREENING, CREDIT_BUREAU, marketing, partners | Bank, PDPA | PDPA, *to confirm* |

## 8. Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| 1 | ONB-7731 with required answers missing | Open | Blocked: "{n} things to fix", first six named, "Close this and use Fix on the review step." |
| 2 | ONB-7731 complete, no factors | Open | Review shows "Customer risk: Low · 0"; confirm opens SAV-77310; outcome lists card, PromptPay and app only as chosen |
| 3 | ONB-7731 complete, opening for someone else (4) and transfers with Myanmar (4) | Open | Band High · 8; button "Send to compliance"; state "With compliance for enhanced due diligence" |
| 4 | ONB-7731 routed | Any answer is edited | The route is cleared and the application must be submitted again |
| 5 | AO-26-0412 with shareholdings totalling 115% | Open | Blocked with "Shareholdings add up to 115%, not 100%" |
| 6 | AO-26-0412 with a 25%+ corporate shareholder and no beneficial owner named | Open | Blocked with "Shareholder 2 is a company with 25% or more: name the person behind it" |
| 7 | AO-26-0412 complete, medium risk | Open | Button "Send to the head of business banking"; state "With the head of business banking" |
| 8 | AO-26-0412 complete, a beneficial owner is a PEP | Open | Band High; route to compliance |
| 9 | Any field is a Thai national id or company registration number | A wrong checksum is entered | The field error shows and the step counts it as missing |
| 10 | A party held UNDER_REVIEW | Compliance releases it | `POST /customers/{id}/release` sets ACTIVE and opens the deposit account |
| 11 | A low-risk opening by ops user A | User A tries the second-person check | Refused: the checker must be someone else |

## 9. Gaps against the core

| Gap | Notes |
|---|---|
| An onboarding application resource with draft answers, completeness and routing | Today `POST /api/v1/customers` registers and opens in one call with six identity fields; the 98/115-field catalogue, routing and approvals have no home |
| Business customers: company, directors, shareholders, beneficial owners, signing mandate, multiple accounts (current, FCD) | No business party model in `onboarding/` |
| Risk scoring service with configurable factors and bands | Not in the core |
| Registry adapters: DOPA card check, NDID, DBD | `Ports.EkycProvider` exists for eKYC; DOPA/NDID/DBD adapters do not |
| Screening before submission, and clearing near matches with a reason | Screening runs only inside register |
| Maker-checker on approval and second-person check | Not modelled |
| KYC refresh cases and the review calendar | Not in the core |
| Field dictionary as an API (labels, Thai, required-when) so the console renders from the server | Today only in the prototype catalogue |

New calls, in one place: `POST /api/v1/onboarding`, `PUT /api/v1/onboarding/{id}/answers`, `POST /api/v1/onboarding/{id}/identity/verify`, `POST /api/v1/onboarding/{id}/identity/ndid`, `GET /api/v1/registries/dbd/{regNo}`, `POST /api/v1/onboarding/{id}/screening`, `POST /api/v1/onboarding/{id}/screening/{hitId}/clear`, `POST /api/v1/onboarding/{id}/submit`, `POST /api/v1/onboarding/{id}/approve`, `POST /api/v1/onboarding/{id}/reject`, `POST /api/v1/onboarding/{id}/check`, `POST /api/v1/business-customers`, `POST /api/v1/customers/{id}/kyc-reviews`, `POST /api/v1/kyc-reviews/{id}/complete`.

## 10. Open questions

| Question | For |
|---|---|
| Review cycle for high-risk customers (yearly assumed) and whether medium is 2 years | Compliance |
| Does a low-risk opening by the teller need any checker before the account is usable, or only the same-day check? | Compliance, operations |
| May a medium-risk individual be approved by the branch manager who is also the maker's supervisor at a one-manager branch? | Operations |
| Which consents are mandatory to open versus optional (marketing, partners)? | PDPA counsel |
| Where does the field catalogue live in production: product configuration, or a versioned onboarding schema per tenant? | Engineering |
| Should the business opening's "Accounts and services" create the internet-banking users in the same call or as a follow-up? | Engineering, digital |
