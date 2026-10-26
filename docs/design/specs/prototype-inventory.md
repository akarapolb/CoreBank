# Prototype inventory

Generated on 26 Oct 2026 from the running console prototype (`docs/design/console-prototype`), all 23 scripts loaded. It lists what the specs in this folder describe: the systems and sections, every record page, every action (flow) and the file that defines it, and the authority matrix the actions are checked against.

## Roles

| Role id | Sample person | Title |
|---|---|---|
| `ops` | Ploy Chaiyaporn | Operations checker |
| `collector` | Nok Saelim | Collector |
| `credit` | Wanida Kaewmanee | Credit officer |
| `product` | Krit Sombat | Product maker |
| `finance` | Arunee Thongdee | Finance controller |
| `teller` | Somsak Jaidee | Teller · Branch 0123 |
| `manager` | Rattikorn Boonsri | Branch manager · Branch 0123 |

## Authority matrix

An action above the person's limit goes to the second approver named on the right. `—` means no authority of their own (always sent on). For `credit` the officer's limit comes from the credit policy's levels and the second approver is named by amount: credit officer, head of retail credit (to ฿10m), credit committee. Values are samples for the bank to set in the credit and operations policy.

| Action key | What it covers | `ops` | `collector` | `credit` | `product` | `finance` | `teller` | `manager` | Second approver |
|---|---|---|---|---|---|---|---|---|---|
| `credit` | Credit approval | — | — | ฿2,000,000 | — | — | — | — | by amount (see above) |
| `settle` | Early settlement | ฿2,000,000 | — | ฿5,000,000 | — | — | ฿1,000,000 | ฿1,000,000 | Credit officer |
| `payout` | Payouts and dealer payoffs | ฿5,000,000 | — | — | — | ฿10,000,000 | — | — | Head of operations |
| `cash` | Cash at the counter | ฿2,000,000 | — | — | — | — | ฿500,000 | ฿5,000,000 | Branch manager |
| `restructure` | Restructuring | — | — | ฿5,000,000 | — | — | — | — | Credit committee |
| `fx` | FX deals | — | — | — | — | — | — | — | Head of dealing |
| `journal` | Manual journals | ฿1,000,000 | — | — | — | ฿50,000,000 | — | — | Finance controller |
| `service` | Loan servicing changes | ฿5,000,000 | — | ฿20,000,000 | — | — | — | — | Credit officer |
| `waive` | Fee waivers | ฿5,000 | — | ฿20,000 | — | — | ฿500 | ฿5,000 | Head of operations |
| `drawdown` | Drawdowns within approved limits | ฿20,000,000 | — | ฿50,000,000 | — | — | — | — | Head of operations |
| `waiver` | Covenant waivers | — | — | ฿50,000,000 | — | — | — | — | Credit committee |
| `hardship` | Hardship programmes | — | ฿150,000 | ฿2,000,000 | — | — | — | — | Collections manager |
| `writeoff` | Write-offs and debt sales | — | — | ฿200,000 | — | — | — | — | Chief credit officer |
| `closesign` | Closing the month | — | — | — | — | — | — | — | Chief financial officer |
| `override` | Decisions against a risk score | — | — | — | — | — | — | — | Head of retail credit |
| `limit` | Temporary limit increases | — | — | ฿10,000,000 | — | — | — | — | Head of retail credit |
| `trade` | Trade payments and claims | ฿100,000,000 | — | — | — | — | — | — | Head of trade operations |
| `rtgs` | Large-value transfers | ฿50,000,000 | — | — | — | ฿500,000,000 | — | — | Head of operations |
| `alco` | Contingency funding actions | — | — | — | — | — | — | — | Asset and liability committee chair |
| `agency` | Agency distributions | ฿1,000,000,000 | — | — | — | — | — | — | Head of loan agency |
| `cashin` | Large cash deposits | — | — | — | — | — | ฿1,999,999 | ฿10,000,000 | Branch manager |
| `overshort` | Teller differences | — | — | — | — | — | — | ฿1,000 | Branch manager |
| `branchclose` | Closing the branch day | — | — | — | — | — | — | ฿1 | Branch manager |

## Systems and sections

| System | Sections |
|---|---|
| `workbench` Workbench | Today, Approvals, My tasks, Recently viewed, Before and after |
| `customers` Customers | Overview, Customer 360, Directory, Onboarding, KYC reviews |
| `branch` Branch & Teller | Counter, Cash drawer, Vault, Branch queue, End of day |
| `deposits` Deposits | Overview, Accounts, Account opening, Holds and orders, Dormant accounts, Term deposits, Interest and fees, Statements |
| `lending` Lending | Overview, Applications, Credit review, Credit committee, Loans, Facilities, Monitoring, Servicing, Restructuring, Disbursements |
| `leasing` Leasing & Asset Finance | Overview, Leases, Hire purchase, Dealer quotes, Registration books, Lease ends, Fleet agreements, Floor plan, Assets, Dealers |
| `collections` Collections & Recovery | Overview, Queue, Promises, Hardship and restructuring, Legal, Repossessions, Write-offs, Strategy |
| `payments` Payments | Overview, Held payments, Transfers, PromptPay, Reconciliation, Bulk files, Standing orders, Recalls, Limits |
| `channels` Customer App | App preview, Releases |
| `trade` Trade Finance | Overview, Letters of credit, Guarantees, Documentary collections |
| `treasury` Treasury | Overview, Liquidity, Interest-rate risk, Deals, FX positions, Nostro accounts |
| `syndication` Syndication | Overview, Deals, Participants, Notices, Lender votes, Fees |
| `products` Product Factory | Overview, Catalogue, Master Builder, Product Studio, Simulations, Credit policy, Approvals |
| `finance` Finance & Risk | Overview, Month-end close, General ledger, Loss allowance, Sub-ledger vs GL, Regulatory reports |
| `compliance` Compliance & AML | Alerts, Cases, Reports to AMLO |
| `analytics` Reports & Analytics | Portfolio, Vintage, Roll rates, Scheduled reports |
| `ops` Operations | Overview, Exception centre, Scheduler, Audit trail, Incidents |
| `agents` AI Agents | Overview, Proposals, Policies, Activity |
| `admin` Admin | Users and roles, Limits and authorities, Tenants, Branding, Integrations, Bank settings |
| `account` My account | Settings |

## Tenants

| Tenant | Systems |
|---|---|
| Demo Virtual Bank | 14: workbench, customers, deposits, lending, collections, payments, channels, products, finance, compliance, analytics, ops, agents, admin |
| Demo Retail Bank | 17: workbench, customers, branch, deposits, lending, leasing, collections, payments, channels, treasury, products, finance, compliance, analytics, ops, agents, admin |
| Demo Commercial Bank | 19: workbench, customers, branch, deposits, lending, leasing, collections, payments, channels, trade, treasury, syndication, products, finance, compliance, analytics, ops, agents, admin |

## Record pages

54 records.

| Record | System / section | Kind | Tabs |
|---|---|---|---|
| `LN-A-C10` | lending / loans | Personal loan | Summary, Schedule, Payments, Collections, Recovery, Postings, What if |
| `C10` | customers / directory | Customer | Overview, Accounts and contracts, Contact history, Consents, KYC |
| `FP-DEMO` | leasing / floorplan | Floor plan line | Vehicles, Stock audit, Interest, Dealer |
| `HP-2025-004812` | leasing / hp | Hire purchase | Summary, Schedule, Early settlement, Vehicle and insurance, Servicing, Registration book |
| `TPL-HP-VEHICLE` | products / master | Product template | Building blocks, Parameters, Rule pack, Products |
| `AUTO_HP_USED_v2` | products / builder | Product draft | Setup, Simulation, Approvals, Changes from v1 |
| `SAV-C10` | deposits / accounts | Savings account | Transactions, Holds, Interest, Statement |
| `F2` | leasing / leases | Finance lease | Summary, Schedule, Accounting, Asset |
| `MA-1` | leasing / fleet | Fleet master agreement | Schedules, Invoices, Covenants |
| `DLR-1` | leasing / dealers | Dealer | Lines, Performance, Agreement, Scorecard, Clawback |
| `TD-88140` | deposits / term | Term deposit | Summary, Interest |
| `BG-26-1102` | trade / guarantees | Bank guarantee | Summary, Security, Claims, Charges |
| `AML-2026-0418` | compliance / cases | AML case | Alert, Investigation, Decision |
| `TR-9918210` | payments / held | Held payment | Payment, Screening, Decision |
| `APP-30413` | lending / applications | Loan application | Application, Credit assessment, Decision, Disbursement |
| `GL-1300` | finance / gl | General ledger account | Balance, Journals, Reconciliation |
| `LN-77120` | lending / loans | Home loan | Summary, Schedule, Payments, Servicing, Letters |
| `FAC-B2031` | lending / facilities | Credit facilities | Limits, Drawdowns, Covenants, Collateral, Annual review |
| `APP-30416` | lending / applications | Loan application | Loan, Applicant, Work and income, Debts and assets, Co-borrower, Security, Declarations, Documents, Review and submit, Offer and signature |
| `APP-30409` | lending / credit | Credit review | Summary, Applicants, Income and debts, Credit bureau, Collateral, Policy and deviations, Credit memo, Decision |
| `CC-2026-21` | lending / committee | Credit committee | Agenda, Members and quorum, Minutes |
| `LN-A-C11` | collections / queue | Collections case | Arrears, Contact, Promises, Hardship, Restructure |
| `LN-A-C14` | collections / legal | Legal and write-off | Legal, Write-off, Recovery |
| `R-A4` | collections / repossessions | Repossession | Vehicle, Notices, Auction, Settlement |
| `DSB-30409` | lending / disbursements | Disbursement | Overview, Conditions, e-Contract, Insurance, Land Office, Payout |
| `POL-RETAIL` | products / policy | Credit policy | Affordability, Collateral, Authority, Collections, Regulatory, Impact, Changes |
| `ECL-2026-10` | finance / ecl | Loss allowance run | Summary, Loans, Staging rules, Overlays, Movement |
| `REC-2026-10` | finance / recon | Reconciliation | Breaks, Ledgers |
| `DS-LOAN-2026-10` | finance / reports | Regulatory report | Validation, Contracts, Submission |
| `ORD-26-0187` | deposits / orders | Legal order | Order |
| `ORD-26-0191` | deposits / orders | Legal order | Order |
| `ORD-26-0193` | deposits / orders | Legal order | Order |
| `SAV-30988` | deposits / dormant | Dormant account | Account, All dormant accounts |
| `TD-88102` | deposits / term | Term deposit | Summary |
| `TD-88201` | deposits / term | Term deposit | Summary |
| `STM-2026-10` | deposits / statements | Statement run | Checks, Exceptions |
| `ONB-7731` | customers / onboarding | Onboarding | Identity, Personal details, Contact and address, Occupation and income, Purpose and activity, Due diligence, Accounts and services, Consents, Review and open |
| `AO-26-0412` | deposits / opening | Account opening | Company, Documents, Directors and signatories, Owners, Expected activity, Due diligence, Accounts and services, Signing mandate, Declarations, Review and open |
| `APP-30414` | lending / credit | Commercial credit application | Request, Financials, Repayment capacity, Security, Rating and pricing, Term sheet, Credit memo, Drawdowns |
| `B-0414` | customers / directory | Business customer | Limits and accounts, Calendar, Profitability, Call reports, People and group |
| `EW-B3107` | lending / monitoring | Early-warning case | Signals, Account conduct, Action plan, Decision |
| `LC-26-0412` | trade / lc | Import letter of credit | Summary, Examination, Decision, Payment, Amendments, Charges |
| `BG-26-1108` | trade / guarantees | Bank guarantee | Demand, Applicant's side, Recovery, Terms |
| `TR-9918231` | payments / transfers | Large-value transfer | Instruction, Checks, Liquidity |
| `TR-9918203` | payments / transfers | Outgoing SWIFT transfer | Message, Screening, Tracker |
| `PAY-26-10-0414` | payments / batches | Payroll file | Validation, Payday, File |
| `RCL-26-1024-03` | payments / recalls | Recall request | Case, Process |
| `LCR-2026-10` | treasury / liquidity | Liquidity coverage ratio | Liquid assets, Cash flows, Stress, Contingency plan |
| `ALM-2026-10` | treasury / alm | Interest-rate risk | Repricing gap, Rate shocks |
| `FX-26-10-0918` | treasury / deals | FX forward | Deal, Credit line, Confirmations, Settlement plan, Mark-to-market |
| `NOS-EUR-01` | treasury / nostro | Nostro reconciliation | Statement lines, Journal |
| `HPQ-26-1031` | leasing / quotes | Hire-purchase deal | Quote, Credit, Contract, Dealer payment, Registration book |
| `O1` | leasing / ends | Operating lease | Return inspection, Options, Lessor accounting |
| `SYN-001` | syndication / deals | Syndicated facility | Facility, Lenders, Drawdowns, Interest, Fees, Payment waterfall, Lender votes, Transfers |

## Actions (flows)

123 actions, each a three-step dialog: enter, review and confirm, done. The review step states the consequence and, where an action key applies, checks the authority matrix.

| Flow | Defined in |
|---|---|
| `appDisburse` | appform.js |
| `appOffer` | appform.js |
| `appSubmit` | appform.js |
| `approveProduct` | flows.js |
| `bgAmend` | trade.js |
| `bgClaim` | trade.js |
| `bgDecide` | trade.js |
| `bgNotify` | trade.js |
| `bnApprove` | payments.js |
| `bnCallback` | payments.js |
| `brBigIn` | branch.js |
| `brBigOut` | branch.js |
| `brClose` | branch.js |
| `brCount` | branch.js |
| `brDiff` | branch.js |
| `brFake` | branch.js |
| `brSellBack` | branch.js |
| `brVault` | branch.js |
| `brVaultCount` | branch.js |
| `bulk` | flows.js |
| `ccVote` | underwriting.js |
| `cfpInvoke` | treasury.js |
| `closeCase` | flows.js |
| `closeSignoff` | finance.js |
| `colContact` | collections.js |
| `colPromise` | collections.js |
| `colRestructure` | collections.js |
| `comDraw` | commercial.js |
| `comSubmit` | commercial.js |
| `covTest` | lending.js |
| `covWaiver` | lending.js |
| `decideApp` | flows.js |
| `deposit` | flows.js |
| `disburseApp` | flows.js |
| `dlrRun` | leasing.js |
| `dormFee` | deposits.js |
| `dormReactivate` | deposits.js |
| `dormTrace` | deposits.js |
| `dsbInsure` | disbursement.js |
| `dsbPay` | disbursement.js |
| `dsbRegister` | disbursement.js |
| `dsbSend` | disbursement.js |
| `dsbWaive` | disbursement.js |
| `eclOverlay` | finance.js |
| `eclRun` | finance.js |
| `ewClassify` | corporate.js |
| `ewFreeze` | corporate.js |
| `facDraw` | lending.js |
| `facReview` | lending.js |
| `fileSTR` | flows.js |
| `fpPayoff` | flows.js |
| `fxDeal` | flows.js |
| `fxResolve` | treasury.js |
| `hmDueDate` | lending.js |
| `hmHoliday` | lending.js |
| `hmLetter` | lending.js |
| `hmMandate` | lending.js |
| `hmPrepay` | lending.js |
| `hmReprice` | lending.js |
| `hmWaive` | lending.js |
| `hpIns` | leasing.js |
| `hpReg` | leasing.js |
| `hpRelease` | leasing.js |
| `hpSettle` | flows.js |
| `hpqApprove` | leasing.js |
| `hpqBook` | leasing.js |
| `hpqPay` | leasing.js |
| `hpqSign` | leasing.js |
| `hpqTerms` | leasing.js |
| `kiCall` | corporate.js |
| `kiExcess` | corporate.js |
| `kitCourt` | collections.js |
| `kitRecover` | collections.js |
| `kitSell` | collections.js |
| `kitWriteOff` | collections.js |
| `lcAnswer` | trade.js |
| `lcRefuse` | trade.js |
| `lcSettle` | trade.js |
| `lcWaiver` | trade.js |
| `leEnd` | leasing.js |
| `logContact` | flows.js |
| `nosApprove` | treasury.js |
| `nosMatch` | treasury.js |
| `nosPost` | treasury.js |
| `obOpen` | onboarding.js |
| `ordApply` | deposits.js |
| `ordCheck` | deposits.js |
| `ordVerify` | deposits.js |
| `polApprove` | policy.js |
| `polPublish` | policy.js |
| `polReject` | policy.js |
| `polSubmit` | policy.js |
| `pyRelease` | payments.js |
| `rcOutcome` | payments.js |
| `rcSend` | payments.js |
| `recExplain` | finance.js |
| `rejectPayment` | flows.js |
| `releasePayment` | flows.js |
| `repoAuction` | collections.js |
| `repoNotice` | collections.js |
| `requestChanges` | flows.js |
| `resolveExc` | flows.js |
| `restructure` | flows.js |
| `rptGenerate` | finance.js |
| `rptSubmit` | finance.js |
| `stmRun` | deposits.js |
| `swClear` | payments.js |
| `swSend` | payments.js |
| `synCountVote` | syndication.js |
| `synDistribute` | syndication.js |
| `synKyc` | syndication.js |
| `synNotice` | syndication.js |
| `synRegister` | syndication.js |
| `synVote` | syndication.js |
| `tdInstruction` | flows.js |
| `tdRoll` | deposits.js |
| `uwApprove` | underwriting.js |
| `uwCommittee` | underwriting.js |
| `uwCounter` | underwriting.js |
| `uwDecline` | underwriting.js |
| `uwInfo` | underwriting.js |
| `uwVerify` | underwriting.js |
| `withdraw` | flows.js |
