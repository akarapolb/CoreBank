# Loan application: field dictionary

Generated from `docs/design/console-prototype/js/appform.js` by `tools/application-fields.mjs`. Do not edit by hand: change the catalogue and run the tool again.

The same catalogue drives the prototype's form, its checks, the document list and the review step, so this list is what the screens ask. It is the starting point for the backend's application model; the values for limits (debt service ratio, LTV, minimum income, automatic-approval bands) are credit policy that the bank sets, and the regulatory notes are for counsel and compliance to confirm.

**Columns.** *Required*: "Yes" when shown; a field that is only shown in some cases is required only then. *Shown when*: the condition on other answers (or the product). *Source*: where the value comes from; anything other than "Customer" is prefilled or fetched and shown with a tag. *Why*: the reason the bank collects it.

**Products:** `personal` Personal loan, `home` Home loan, `car` Car hire purchase.

**Sources:** `record` Customer record, `dopa` DOPA, `ncb` NCB, `statement` Statements, `appraiser` Appraiser, `system` Price guide, `staff` Staff, `customer` Customer.


166 fields in 24 sections; 144 of them required when shown.

## Loan

### Loan requested

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `amount` | Amount | วงเงินที่ขอ | money (THB) | Yes |  | Customer | Credit policy |  |
| `term` | Term, months | ระยะเวลา (เดือน) | number | Yes |  | Customer | Credit policy |  |
| `purpose` | Purpose | วัตถุประสงค์ | choice | Yes |  | Customer | BOT responsible lending | personal: education, medical, home-improvement, refinance, wedding, other; home: buy-new, buy-resale, build, refinance; car: buy, refinance |
| `purposeDetail` | Purpose, in the customer's words | รายละเอียดวัตถุประสงค์ | text | Yes | purpose = "other" | Customer | BOT responsible lending |  |
| `refiLender` | Lender to pay off | สถาบันการเงินที่จะปิดหนี้ | choice | Yes | purpose = "refinance" | Customer | Credit policy | this, kbank, scb, bbl, ktb, bay, ttb, other |
| `refiAmount` | Payoff amount | ยอดปิดหนี้ | money (THB) | Yes | purpose = "refinance" | Customer | Credit policy |  |
| `ratePackage` | Rate package | แพ็กเกจอัตราดอกเบี้ย | choice | Yes |  | Customer | The contract | personal: fixed15; home: fix3, float; car: fixed |
| `repayDay` | Due day each month | วันครบกำหนดชำระ | choice | Yes |  | Customer | The contract | 1, 5, 10, 15, 25, 28 |
| `repayMethod` | How instalments are paid | วิธีชำระค่างวด | choice | Yes |  | Customer | Operations | dd, edda, payroll, transfer |
| `repayAccount` | Account to debit | บัญชีที่หัก | text | Yes | repayMethod = "dd" or repayMethod = "edda" | Customer | Operations |  |
| `disburseTo` | Pay the loan to | จ่ายเงินกู้เข้า | choice | Yes |  | Customer | Operations | personal: own, other, lender; home: seller, developer; car: dealer |
| `disburseAccount` | Bank and account number | ธนาคารและเลขบัญชี | text | Yes | disburseTo = "other" | Customer | AML/CFT (AMLO) |  |

### Insurance

Optional cover is never a condition of the loan, and the customer chooses the insurer.

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `creditLife` | Credit life cover | ประกันคุ้มครองสินเชื่อ | choice | Yes |  | Customer | BOT market conduct | none, financed, cash, assigned |
| `insOptionalAck` | Told that this cover is optional and not a condition | ได้แจ้งลูกค้าว่าประกันนี้เป็นทางเลือก ไม่ใช่เงื่อนไข | yes/no (tick) | Yes | creditLife and creditLife ≠ "none" | Staff | BOT market conduct |  |
| `fireInsurer` | Fire insurance | ประกันอัคคีภัย | choice | Yes | product is home | Customer | Collateral and title | own, partner |
| `motorClass` | Motor insurance | ประกันภัยรถยนต์ | choice | Yes | product is car | Customer | Collateral and title | 1, 2+, 3+ |

### Where the application came from

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `channel` | Channel | ช่องทาง | choice | Yes |  | Staff | Operations | branch, app, dealer, rm, telesales, broker |
| `branch` | Branch | สาขา | text | Yes | channel = "branch" | Staff | Operations |  |
| `staffCode` | Staff code | รหัสพนักงาน | text, read-only | Yes |  | Staff | Operations |  |
| `dealerCode` | Dealer code | รหัสดีลเลอร์ | text | Yes | product is car | Staff | Operations |  |
| `campaign` | Campaign code | รหัสแคมเปญ | text |  |  | Staff | Operations |  |
| `referrer` | Referred by | ผู้แนะนำ | text |  |  | Staff | Operations |  |


## Applicant

### Identity

From the customer record and the DOPA check; changes to identity go through KYC.

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `title` | Title | คำนำหน้า | choice | Yes |  | Customer record | KYC (AMLO) | mr, mrs, miss, other |
| `firstTh` | First name (Thai) | ชื่อ (ไทย) | text | Yes |  | Customer record | KYC (AMLO) |  |
| `lastTh` | Last name (Thai) | นามสกุล (ไทย) | text | Yes |  | Customer record | KYC (AMLO) |  |
| `firstEn` | First name (English) | ชื่อ (อังกฤษ) | text | Yes |  | Customer record | KYC (AMLO) |  |
| `lastEn` | Last name (English) | นามสกุล (อังกฤษ) | text | Yes |  | Customer record | KYC (AMLO) |  |
| `citizenId` | Citizen ID | เลขประจำตัวประชาชน | citizen ID (13 digits, checksum), read-only | Yes |  | DOPA | KYC (AMLO) |  |
| `idIssued` | ID issued | วันออกบัตร | date, read-only | Yes |  | DOPA | KYC (AMLO) |  |
| `idExpiry` | ID expires | วันบัตรหมดอายุ | date, read-only | Yes |  | DOPA | KYC (AMLO) |  |
| `dob` | Date of birth | วันเกิด | date, read-only | Yes |  | DOPA | Credit policy |  |
| `gender` | Sex | เพศ | choice | Yes |  | Customer record | KYC (AMLO) | f, m |
| `nationality` | Nationality | สัญชาติ | choice | Yes |  | Customer record | KYC (AMLO) | th, other |
| `passport` | Passport number | เลขหนังสือเดินทาง | text | Yes | nationality = "other" | Customer | KYC (AMLO) |  |
| `workPermit` | Work permit number | เลขใบอนุญาตทำงาน | text | Yes | nationality = "other" | Customer | Credit policy |  |
| `marital` | Marital status | สถานภาพสมรส | choice | Yes |  | Customer | Credit policy | single, married-reg, married, divorced, widowed |
| `spouseName` | Spouse's name | ชื่อคู่สมรส | text | Yes | marital = "married-reg" | Customer | The contract |  |
| `spouseId` | Spouse's citizen ID | เลขประจำตัวประชาชนคู่สมรส | citizen ID (13 digits, checksum) | Yes | marital = "married-reg" | Customer | The contract |  |
| `dependants` | Dependants | จำนวนผู้อยู่ในอุปการะ | number | Yes |  | Customer | Credit policy |  |
| `education` | Education | การศึกษา | choice | Yes |  | Customer | Credit policy | below, bachelor, master, doctorate |

### Contact

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `mobile` | Mobile | โทรศัพท์มือถือ | phone | Yes |  | Customer record | Operations |  |
| `email` | Email | อีเมล | email | Yes |  | Customer record | Operations |  |
| `lineId` | LINE ID | LINE ID | text |  |  | Customer | Operations |  |
| `contactLang` | Language for letters | ภาษาของเอกสาร | choice | Yes |  | Customer | BOT market conduct | th, en |
| `contactPref` | Preferred channel | ช่องทางที่สะดวก | choice | Yes |  | Customer | BOT market conduct | app, sms, email, phone |

### Address on the house registration

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `regNo` | House number | บ้านเลขที่ | text | Yes |  | DOPA | KYC (AMLO) |  |
| `regMoo` | Moo | หมู่ | text |  |  | DOPA | KYC (AMLO) |  |
| `regVillage` | Village or building | หมู่บ้าน/อาคาร | text |  |  | DOPA | KYC (AMLO) |  |
| `regSoi` | Soi | ซอย | text |  |  | DOPA | KYC (AMLO) |  |
| `regRoad` | Road | ถนน | text |  |  | DOPA | KYC (AMLO) |  |
| `regSub` | Subdistrict | แขวง/ตำบล | text | Yes |  | DOPA | KYC (AMLO) |  |
| `regDist` | District | เขต/อำเภอ | text | Yes |  | DOPA | KYC (AMLO) |  |
| `regProv` | Province | จังหวัด | choice | Yes |  | DOPA | KYC (AMLO) | Bangkok, Nonthaburi, Pathum Thani, Samut Prakan, Chon Buri, Chiang Mai, Khon Kaen, Nakhon Ratchasima, Phuket, Songkhla, Other |
| `regPost` | Postcode | รหัสไปรษณีย์ | postcode (5 digits) | Yes |  | DOPA | KYC (AMLO) |  |

### Where the applicant lives

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `curSame` | Same as the house registration | เหมือนที่อยู่ตามทะเบียนบ้าน | yes/no (tick) |  |  | Customer | KYC (AMLO) |  |
| `curNo` | House number | บ้านเลขที่ | text | Yes | curSame is not ticked | Customer | KYC (AMLO) |  |
| `curSub` | Subdistrict | แขวง/ตำบล | text | Yes | curSame is not ticked | Customer | KYC (AMLO) |  |
| `curDist` | District | เขต/อำเภอ | text | Yes | curSame is not ticked | Customer | KYC (AMLO) |  |
| `curProv` | Province | จังหวัด | choice | Yes | curSame is not ticked | Customer | KYC (AMLO) | Bangkok, Nonthaburi, Pathum Thani, Samut Prakan, Chon Buri, Chiang Mai, Khon Kaen, Nakhon Ratchasima, Phuket, Songkhla, Other |
| `curPost` | Postcode | รหัสไปรษณีย์ | postcode (5 digits) | Yes | curSame is not ticked | Customer | KYC (AMLO) |  |
| `residence` | Home is | ลักษณะที่อยู่อาศัย | choice | Yes |  | Customer | Credit policy | own, mortgage, rent, family, employer |
| `yearsAt` | Years at this address | อาศัยมา (ปี) | number | Yes |  | Customer | Credit policy |  |
| `rent` | Monthly rent | ค่าเช่าต่อเดือน | money (THB) | Yes | residence = "rent" | Customer | Credit policy |  |
| `mailTo` | Send letters to | ที่อยู่ส่งเอกสาร | choice | Yes |  | Customer | Operations | registered, current, work |

### Emergency contact

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `emName` | Name | ชื่อ-นามสกุล | text | Yes |  | Customer | Operations |  |
| `emRel` | Relationship | ความสัมพันธ์ | choice | Yes |  | Customer | Operations | parent, sibling, spouse, child, relative, friend, colleague |
| `emMobile` | Mobile | โทรศัพท์มือถือ | phone | Yes |  | Customer | Operations |  |
| `emDiffAddr` | Does not live with the applicant | ไม่ได้อาศัยอยู่กับผู้กู้ | yes/no (tick) | Yes |  | Customer | Operations |  |


## Work and income

### Occupation

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `occType` | Occupation | อาชีพ | choice | Yes |  | Customer | Credit policy | salaried, civil, state, professional, owner, freelance, retired |

### Employer (when occType is salaried, civil or state)

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `employer` | Employer | ชื่อนายจ้าง | text | Yes |  | Customer | Credit policy |  |
| `industry` | Industry | ประเภทธุรกิจ | choice | Yes |  | Customer | Credit policy | logistics, manufacturing, retail, finance, government, health, tech, construction, hospitality, agriculture, other |
| `employerReg` | Employer's registration number | เลขทะเบียนนิติบุคคลของนายจ้าง | text |  |  | Customer | Credit policy |  |
| `position` | Position | ตำแหน่ง | text | Yes |  | Customer | Credit policy |  |
| `department` | Department | แผนก | text |  |  | Customer | Credit policy |  |
| `empType` | Employment | ประเภทการจ้าง | choice | Yes |  | Customer | Credit policy | permanent, contract, probation |
| `startDate` | Started | วันเริ่มงาน | date | Yes |  | Customer | Credit policy |  |
| `workPhone` | Work phone | โทรศัพท์ที่ทำงาน | phone | Yes |  | Customer | Credit policy |  |
| `workProv` | Workplace province | จังหวัดที่ทำงาน | choice | Yes |  | Customer | Credit policy | Bangkok, Nonthaburi, Pathum Thani, Samut Prakan, Chon Buri, Chiang Mai, Khon Kaen, Nakhon Ratchasima, Phuket, Songkhla, Other |

### Business (when occType is professional, owner or freelance)

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `bizName` | Business name | ชื่อกิจการ | text | Yes |  | Customer | Credit policy |  |
| `bizReg` | Registration number | เลขทะเบียนพาณิชย์/นิติบุคคล | text | Yes | occType = "owner" | Customer | KYC (AMLO) |  |
| `bizType` | Industry | ประเภทธุรกิจ | choice | Yes |  | Customer | AML/CFT (AMLO) | logistics, manufacturing, retail, finance, government, health, tech, construction, hospitality, agriculture, other |
| `bizStart` | Trading since | เริ่มกิจการ | date | Yes |  | Customer | Credit policy |  |
| `bizRevenue` | Monthly revenue | รายได้ต่อเดือน | money (THB) | Yes |  | Statements | Credit policy |  |
| `bizProfit` | Monthly net profit | กำไรสุทธิต่อเดือน | money (THB) | Yes |  | Customer | Credit policy |  |
| `taxForm` | Personal tax return | แบบแสดงรายการภาษี | choice | Yes |  | Customer | Credit policy | pnd90, pnd91, none |

### Pension (when occType = "retired")

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `pension` | Monthly pension | บำนาญต่อเดือน | money (THB) | Yes |  | Statements | Credit policy |  |
| `pensionSource` | Paid by | ผู้จ่ายบำนาญ | text | Yes |  | Customer | Credit policy |  |

### Income (when occType ≠ "retired")

Variable income is counted at 70% and other income at 50%, by credit policy.

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `salary` | Monthly salary | เงินเดือน | money (THB) | Yes | occType is salaried, civil or state | Statements | Credit policy |  |
| `allowance` | Fixed allowances | ค่าตอบแทนประจำอื่น | money (THB) |  | occType is salaried, civil or state | Statements | Credit policy |  |
| `variable` | Overtime, commission, bonus (6-month average) | ค่าล่วงเวลา คอมมิชชัน โบนัส (เฉลี่ย 6 เดือน) | money (THB) |  | occType is salaried, civil or state | Statements | Credit policy |  |
| `otherInc` | Other income | รายได้อื่น | money (THB) |  |  | Customer | Credit policy |  |
| `otherSrc` | Other income from | ที่มาของรายได้อื่น | text | Yes | otherInc > 0 | Customer | AML/CFT (AMLO) |  |
| `payrollBank` | Salary paid into | ธนาคารที่รับเงินเดือน | choice | Yes | occType is salaried, civil or state | Statements | Credit policy | this, kbank, scb, bbl, ktb, bay, ttb, other |
| `incomeProof` | Income verified by | ยืนยันรายได้โดย | choice | Yes |  | Staff | BOT responsible lending | statement-api, payslip, cert, eslip, tax |


## Debts and assets

### Debts the credit bureau does not show

Ask about these: they are common and change the debt service ratio.

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `coopLoan` | Savings cooperative loan, monthly | เงินกู้สหกรณ์ ต่อเดือน | money (THB) |  |  | Customer | BOT responsible lending |  |
| `studentLoan` | Student loan (SLF), monthly | กยศ. ต่อเดือน | money (THB) |  |  | Customer | BOT responsible lending |  |
| `informal` | Informal or family loans, monthly | หนี้นอกระบบหรือในครอบครัว ต่อเดือน | money (THB) |  |  | Customer | BOT responsible lending |  |
| `otherObl` | Other obligations, monthly | ภาระอื่น ต่อเดือน | money (THB) |  |  | Customer | BOT responsible lending |  |
| `livingCost` | Living costs, monthly | ค่าใช้จ่ายในการครองชีพ ต่อเดือน | money (THB) | Yes |  | Customer | BOT responsible lending |  |

### Assets

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `depositsOther` | Deposits at other banks | เงินฝากธนาคารอื่น | money (THB) |  |  | Customer | Credit policy |  |
| `investments` | Investments | เงินลงทุน | money (THB) |  |  | Customer | Credit policy |  |
| `propertyOwned` | Property owned | อสังหาริมทรัพย์ที่มี | choice | Yes |  | Customer | BOT LTV measure | none, one, more |
| `vehicles` | Vehicles owned | จำนวนรถยนต์ที่มี | number |  |  | Customer | Credit policy |  |


## Co-borrower

### Co-borrower (when product is home or car)

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `hasCo` | Add a co-borrower | มีผู้กู้ร่วม | choice | Yes |  | Customer | Credit policy | no, yes |
| `coRel` | Relationship | ความสัมพันธ์ | choice | Yes | hasCo = "yes" | Customer | Credit policy | spouse, parent, sibling, child |
| `coName` | Name | ชื่อ-นามสกุล | text | Yes | hasCo = "yes" | Customer | KYC (AMLO) |  |
| `coId` | Citizen ID | เลขประจำตัวประชาชน | citizen ID (13 digits, checksum) | Yes | hasCo = "yes" | Customer | KYC (AMLO) |  |
| `coDob` | Date of birth | วันเกิด | date | Yes | hasCo = "yes" | Customer | Credit policy |  |
| `coMobile` | Mobile | โทรศัพท์มือถือ | phone | Yes | hasCo = "yes" | Customer | Operations |  |
| `coOcc` | Occupation | อาชีพ | choice | Yes | hasCo = "yes" | Customer | Credit policy | salaried, civil, state, professional, owner, freelance, retired |
| `coEmployer` | Employer or business | นายจ้างหรือกิจการ | text | Yes | hasCo = "yes" | Customer | Credit policy |  |
| `coIncome` | Monthly income | รายได้ต่อเดือน | money (THB) | Yes | hasCo = "yes" | Statements | Credit policy |  |
| `coDebts` | Monthly debt payments | ภาระหนี้ต่อเดือน | money (THB) | Yes | hasCo = "yes" | NCB | BOT responsible lending |  |
| `coNcb` | Co-borrower gave credit bureau consent | ผู้กู้ร่วมให้ความยินยอมตรวจเครดิตบูโรแล้ว | yes/no (tick) | Yes | hasCo = "yes" | Customer | Credit bureau (NCB) Act |  |

### Guarantor (when product is car)

A guarantor's liability is limited to the borrower's debt, under the Civil and Commercial Code.

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `hasGu` | Add a guarantor | มีผู้ค้ำประกัน | choice | Yes |  | Customer | Credit policy | no, yes |
| `guName` | Name | ชื่อ-นามสกุล | text | Yes | hasGu = "yes" | Customer | KYC (AMLO) |  |
| `guId` | Citizen ID | เลขประจำตัวประชาชน | citizen ID (13 digits, checksum) | Yes | hasGu = "yes" | Customer | KYC (AMLO) |  |
| `guMobile` | Mobile | โทรศัพท์มือถือ | phone | Yes | hasGu = "yes" | Customer | Operations |  |
| `guIncome` | Monthly income | รายได้ต่อเดือน | money (THB) | Yes | hasGu = "yes" | Statements | Credit policy |  |
| `guNcb` | Guarantor gave credit bureau consent | ผู้ค้ำประกันให้ความยินยอมตรวจเครดิตบูโรแล้ว | yes/no (tick) | Yes | hasGu = "yes" | Customer | Credit bureau (NCB) Act |  |


## Security

### Property (when product is home)

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `propType` | Property type | ประเภททรัพย์ | choice | Yes |  | Customer | Collateral and title | condo, townhouse, detached, land, shophouse |
| `project` | Project | โครงการ | text | Yes |  | Customer | Collateral and title |  |
| `developer` | Developer or seller | ผู้พัฒนาโครงการหรือผู้ขาย | text | Yes |  | Customer | AML/CFT (AMLO) |  |
| `unitNo` | Unit or house number | เลขที่ห้องชุด/บ้านเลขที่ | text | Yes |  | Customer | Collateral and title |  |
| `deedType` | Title document | เอกสารสิทธิ์ | choice | Yes |  | Customer | Collateral and title | chanote, ns3g, condo |
| `deedNo` | Title number | เลขที่เอกสารสิทธิ์ | text | Yes |  | Customer | Collateral and title |  |
| `size` | Size | ขนาด | text | Yes |  | Customer | Collateral and title |  |
| `propProv` | Province | จังหวัด | choice | Yes |  | Customer | Collateral and title | Bangkok, Nonthaburi, Pathum Thani, Samut Prakan, Chon Buri, Chiang Mai, Khon Kaen, Nakhon Ratchasima, Phuket, Songkhla, Other |
| `price` | Purchase price | ราคาซื้อขาย | money (THB) | Yes |  | Customer | BOT LTV measure |  |
| `booking` | Deposit already paid | เงินจองและเงินทำสัญญาที่จ่ายแล้ว | money (THB) |  |  | Customer | Credit policy |  |
| `downSource` | Down payment comes from | ที่มาของเงินดาวน์ | choice | Yes |  | Customer | AML/CFT (AMLO) | savings, gift, sale, other |
| `mortgageNo` | This is the customer's | สัญญาจำนองที่อยู่อาศัยนี้เป็น | choice | Yes |  | NCB | BOT LTV measure | 1, 2, 3 |
| `firstMortgageDate` | First contract dated | วันที่ทำสัญญาแรก | date | Yes | mortgageNo ≠ "1" | NCB | BOT LTV measure |  |
| `appraisal` | Appraised value | ราคาประเมิน | money (THB), read-only | Yes |  | Appraiser | BOT LTV measure |  |
| `appraiser` | Appraisal report | รายงานการประเมิน | text, read-only |  |  | Appraiser | Collateral and title |  |
| `transferDate` | Transfer at the Land Office | วันโอนที่สำนักงานที่ดิน | date | Yes |  | Customer | Operations |  |
| `landOffice` | Land Office | สำนักงานที่ดิน | text | Yes |  | Customer | Operations |  |

### Vehicle (when product is car)

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `carCond` | New or used | รถใหม่หรือรถใช้แล้ว | choice | Yes |  | Customer | Credit policy | new, used |
| `make` | Make | ยี่ห้อ | choice | Yes |  | Customer | Collateral and title | Toyota, Honda, Isuzu, Mitsubishi, Mazda, Nissan, BYD, MG, Other |
| `model` | Model | รุ่น | text | Yes |  | Customer | Collateral and title |  |
| `year` | Model year | ปีรุ่น | number | Yes |  | Customer | Credit policy |  |
| `fuel` | Power | เชื้อเพลิง | choice | Yes |  | Customer | Collateral and title | petrol, diesel, hybrid, ev |
| `chassis` | Chassis number | เลขตัวถัง | text | Yes | carCond = "used" | Customer | Collateral and title |  |
| `plate` | Registration | ทะเบียนรถ | text | Yes | carCond = "used" | Customer | Collateral and title |  |
| `carPrice` | Cash price | ราคาเงินสด | money (THB) | Yes |  | Customer | Credit policy |  |
| `carDown` | Down payment | เงินดาวน์ | money (THB) | Yes |  | Customer | Credit policy |  |
| `redbook` | Market value (price guide) | ราคากลางตลาด | money (THB), read-only | Yes | carCond = "used" | Price guide | Credit policy |  |
| `carUse` | Used for | การใช้งาน | choice | Yes |  | Customer | Credit policy | personal, commercial |


## Declarations

### Credit bureau and personal data

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `ncbConsent` | Credit bureau (NCB) consent | ความยินยอมตรวจข้อมูลเครดิต (NCB) | yes/no (tick), read-only | Yes |  | Customer | Credit bureau (NCB) Act |  |
| `pdpaMarketing` | Marketing by the bank | การตลาดโดยธนาคาร | choice | Yes |  | Customer | PDPA consent | no, yes |
| `pdpaPartners` | Share with partners for offers | ส่งข้อมูลให้พันธมิตรเพื่อเสนอสิทธิประโยชน์ | choice | Yes |  | Customer | PDPA consent | no, yes |

### Politically exposed persons and source of funds

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `pep` | Holds or held a prominent public position | เป็นหรือเคยเป็นบุคคลที่มีสถานภาพทางการเมือง | choice | Yes |  | Customer | AML/CFT (AMLO) | no, self, family, associate |
| `pepDetail` | Position and country | ตำแหน่งและประเทศ | text | Yes | pep and pep ≠ "no" | Customer | AML/CFT (AMLO) |  |
| `fundsSource` | Repayments come from | แหล่งเงินที่ใช้ชำระ | choice | Yes |  | Customer | AML/CFT (AMLO) | salary, business, pension, family, other |
| `beneficiary` | Who benefits from the loan | ผู้รับประโยชน์จากสินเชื่อ | choice | Yes |  | Customer | AML/CFT (AMLO) | self, other |
| `beneficiaryName` | Beneficiary's name and relationship | ชื่อผู้รับประโยชน์และความสัมพันธ์ | text | Yes | beneficiary = "other" | Customer | AML/CFT (AMLO) |  |

### Tax residence

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `usPerson` | US citizen, green-card holder or born in the US | เป็นพลเมืองสหรัฐ ผู้ถือกรีนการ์ด หรือเกิดในสหรัฐ | choice | Yes |  | Customer | FATCA and CRS | no, yes |
| `usTin` | US taxpayer number | เลขประจำตัวผู้เสียภาษีสหรัฐ | text | Yes | usPerson = "yes" | Customer | FATCA and CRS |  |
| `taxResOther` | Tax resident outside Thailand | มีถิ่นที่อยู่ทางภาษีนอกประเทศไทย | choice | Yes |  | Customer | FATCA and CRS | no, yes |
| `taxCountry` | Country and tax number | ประเทศและเลขผู้เสียภาษี | text | Yes | taxResOther = "yes" | Customer | FATCA and CRS |  |

### Related parties and legal history

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `relatedBank` | Related to the bank's directors, executives or major shareholders | เกี่ยวข้องกับกรรมการ ผู้บริหาร หรือผู้ถือหุ้นรายใหญ่ของธนาคาร | choice | Yes |  | Customer | BOT related-party lending | no, director, executive, shareholder, family |
| `staff` | Employee of the bank | เป็นพนักงานของธนาคาร | choice | Yes |  | Customer | BOT related-party lending | no, yes |
| `bankrupt` | Bankrupt, or in debt restructuring by court, in the last 5 years | เคยล้มละลายหรือฟื้นฟูกิจการโดยศาลใน 5 ปี | choice | Yes |  | Customer | Credit policy | no, yes |
| `litigation` | Being sued over a debt | อยู่ระหว่างถูกฟ้องเกี่ยวกับหนี้ | choice | Yes |  | Customer | Credit policy | no, yes |
| `legalDetail` | Details | รายละเอียด | long text | Yes | bankrupt = "yes" or litigation = "yes" | Customer | Credit policy |  |

### Confirmation

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `certify` | The applicant confirms the information is true and complete, and knows a false statement can end the loan | ผู้กู้รับรองว่าข้อมูลถูกต้องครบถ้วน และทราบว่าการให้ข้อมูลเท็จอาจเป็นเหตุให้ยกเลิกสินเชื่อ | yes/no (tick) | Yes |  | Customer | The contract |  |


## Derived, not asked

- **Income counted**: salary + fixed allowances + 70% of variable income + 50% of other income (employees); net profit + 50% of other income (self-employed); the pension (retired); plus the co-borrower's income when there is one.
- **Debt payments**: the credit bureau (NCB) accounts, the declared debts the bureau does not show (cooperative, student loan, informal, other) and the co-borrower's debts.
- **Policy checks**: debt service ratio, minimum income, the BOT personal-loan cap (5 times income at ฿30,000 a month or more, 1.5 times below it), LTV by mortgage contract number (or vehicle condition), age at the end of the loan, time in the job or business, bureau score and arrears, bankruptcy. Politically exposed persons, related parties and debt litigation are referred to a person rather than declined.
- **Documents**: the list follows occupation, marital status, co-borrower, guarantor, product and purpose; required documents not yet received become conditions before disbursement.
