# Account opening: field dictionary

Generated from `docs/design/console-prototype/js/onboarding.js` by `tools/account-opening-fields.mjs`. Do not edit by hand: change the catalogue and run the tool again.

The catalogues drive the prototype's individual onboarding and business account opening: the form, field checks, the risk score, the review step and approval routing. They are the starting point for the backend's customer and account-opening model. Regulatory reasons are for compliance and counsel to confirm; risk weights and bands are the bank's to set.

**Sources:** `record` Customer record, `dopa` DOPA, `ndid` NDID, `dbd` DBD, `system` Screening, `staff` Staff, `customer` Customer. **Why:** `kyc` KYC (AMLO), `aml` AML/CFT (AMLO), `fatca` FATCA and CRS, `pdpa` PDPA consent, `conduct` BOT market conduct, `contract` The account terms, `ops` Operations, `dpa` Deposit protection, `tax` Revenue Department, `related` BOT related-party rules, `risk` Customer risk rating.


213 fields across both journeys.

## Individual onboarding (ONB-7731)

98 fields.

### Identity

**Identity document**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `docType` | Document | เอกสาร | choice | Yes |  | Staff | KYC (AMLO) | thai-id, passport, alien |
| `citizenId` | Citizen ID | เลขประจำตัวประชาชน | 13-digit ID (checksum), read-only | Yes | docType = "thai-id" | DOPA | KYC (AMLO) |  |
| `laser` | Laser code (back of the card) | รหัสหลังบัตร | text, read-only | Yes | docType = "thai-id" | DOPA | KYC (AMLO) |  |
| `passportNo` | Passport number | เลขหนังสือเดินทาง | text | Yes | document is not a Thai ID card | Customer | KYC (AMLO) |  |
| `passportCountry` | Issued by | ประเทศที่ออก | choice | Yes | document is not a Thai ID card | Customer | KYC (AMLO) | TH, MM, LA, KH, CN, HK, SG, JP, US, GB, IR, KP, OT |
| `visaType` | Visa | ประเภทวีซ่า | choice | Yes | docType = "passport" | Customer | KYC (AMLO) | b, o, ret, ltr, tourist |
| `workPermit` | Work permit number | เลขใบอนุญาตทำงาน | text | Yes | docType = "passport" and visaType = "b" | Customer | KYC (AMLO) |  |
| `idIssued` | Issued | วันออก | date, read-only | Yes |  | DOPA | KYC (AMLO) |  |
| `idExpiry` | Expires | วันหมดอายุ | date | Yes |  | DOPA | KYC (AMLO) |  |

**Verification**: Read from the card and checked with DOPA and NDID; the customer sees the same results on the tablet.

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `method` | How identity was verified | วิธียืนยันตัวตน | choice | Yes |  | Staff | KYC (AMLO) | branch, ndid, video |
| `dopaResult` | DOPA check | ผลตรวจกรมการปกครอง | text, read-only |  | docType = "thai-id" | DOPA | KYC (AMLO) |  |
| `faceScore` | Face match score | คะแนนเทียบใบหน้า | text, read-only |  |  | Screening | KYC (AMLO) |  |
| `liveness` | Liveness | การตรวจว่ามีชีวิต | text, read-only |  |  | Screening | KYC (AMLO) |  |
| `ndidIal` | NDID assurance level | ระดับความน่าเชื่อถือ NDID | choice | Yes | method = "ndid" | NDID | KYC (AMLO) | 2.3, 2.2, 2.1 |

### Personal details

**Name and birth**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `title` | Title | คำนำหน้า | choice | Yes |  | DOPA | KYC (AMLO) | mr, mrs, miss |
| `firstTh` | First name (Thai) | ชื่อ (ไทย) | text | When docType = "thai-id" |  | DOPA | KYC (AMLO) |  |
| `lastTh` | Last name (Thai) | นามสกุล (ไทย) | text | When docType = "thai-id" |  | DOPA | KYC (AMLO) |  |
| `firstEn` | First name (English) | ชื่อ (อังกฤษ) | text | Yes |  | DOPA | KYC (AMLO) |  |
| `lastEn` | Last name (English) | นามสกุล (อังกฤษ) | text | Yes |  | DOPA | KYC (AMLO) |  |
| `prevName` | Previous name, if changed | ชื่อเดิม (หากเปลี่ยนชื่อ) | text |  |  | Customer | AML/CFT (AMLO) |  |
| `dob` | Date of birth | วันเกิด | date, read-only | Yes |  | DOPA | KYC (AMLO) |  |
| `gender` | Sex | เพศ | choice | Yes |  | DOPA | KYC (AMLO) | f, m |
| `nationality` | Nationality | สัญชาติ | choice | Yes |  | DOPA | KYC (AMLO) | TH, MM, LA, KH, CN, HK, SG, JP, US, GB, IR, KP, OT |
| `nationality2` | Second nationality | สัญชาติที่สอง | choice |  |  | Customer | FATCA and CRS | TH, MM, LA, KH, CN, HK, SG, JP, US, GB, IR, KP, OT |
| `marital` | Marital status | สถานภาพสมรส | choice | Yes |  | Customer | KYC (AMLO) | single, married, divorced, widowed |
| `education` | Education | การศึกษา | choice |  |  | Customer | KYC (AMLO) | below, bachelor, master |

### Contact and address

**Contact**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `mobile` | Mobile | โทรศัพท์มือถือ | phone | Yes |  | Customer | Operations |  |
| `mobileOtp` | Mobile confirmed by one-time code | ยืนยันเบอร์มือถือด้วยรหัส OTP | yes/no (tick) | Yes |  | Screening | Operations |  |
| `email` | Email | อีเมล | email | When estatement = "email" |  | Customer | Operations |  |
| `lineId` | LINE ID | LINE ID | text |  |  | Customer | Operations |  |
| `lang` | Language for documents | ภาษาของเอกสาร | choice | Yes |  | Customer | BOT market conduct | th, en |

**Address on the house registration** (when docType = "thai-id")

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `regNo` | House number | บ้านเลขที่ | text, read-only | Yes |  | DOPA | KYC (AMLO) |  |
| `regSub` | Subdistrict | แขวง/ตำบล | text, read-only | Yes |  | DOPA | KYC (AMLO) |  |
| `regDist` | District | เขต/อำเภอ | text, read-only | Yes |  | DOPA | KYC (AMLO) |  |
| `regProv` | Province | จังหวัด | choice, read-only | Yes |  | DOPA | KYC (AMLO) | Bangkok, Nonthaburi, Pathum Thani, Samut Prakan, Chon Buri, Chiang Mai, Khon Kaen, Nakhon Ratchasima, Phuket, Songkhla, Other |
| `regPost` | Postcode | รหัสไปรษณีย์ | postcode | Yes |  | DOPA | KYC (AMLO) |  |

**Where the customer lives**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `curSame` | Same as the house registration | เหมือนที่อยู่ตามทะเบียนบ้าน | yes/no (tick) |  | docType = "thai-id" | Customer | KYC (AMLO) |  |
| `curLine` | Address | ที่อยู่ | text | Yes | !isThai(f) or !curSame | Customer | KYC (AMLO) |  |
| `curProv` | Province | จังหวัด | choice | Yes | !isThai(f) or !curSame | Customer | KYC (AMLO) | Bangkok, Nonthaburi, Pathum Thani, Samut Prakan, Chon Buri, Chiang Mai, Khon Kaen, Nakhon Ratchasima, Phuket, Songkhla, Other |
| `curPost` | Postcode | รหัสไปรษณีย์ | postcode | Yes | !isThai(f) or !curSame | Customer | KYC (AMLO) |  |
| `residence` | Home is | ลักษณะที่อยู่อาศัย | choice | Yes |  | Customer | KYC (AMLO) | own, rent, family, employer |
| `mailTo` | Send letters to | ที่อยู่ส่งเอกสาร | choice | Yes |  | Customer | Operations | registered, current, work |

### Occupation and income

**Occupation**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `occType` | Occupation | อาชีพ | choice | Yes |  | Customer | KYC (AMLO) | salaried, civil, self, freelance, student, homemaker, retired, none |
| `employer` | Employer or business name | ชื่อนายจ้างหรือกิจการ | text | When !["student", "homemaker", "retired", "none"].includes(occType) | !["student", "homemaker", "retired", "none"].includes(occType) | Customer | KYC (AMLO) |  |
| `industry` | Industry | ประเภทธุรกิจ | choice | When !["student", "homemaker", "retired", "none"].includes(occType) | !["student", "homemaker", "retired", "none"].includes(occType) | Customer | AML/CFT (AMLO) | logistics, manufacturing, retail, finance, government, health, tech, construction, hospitality, agriculture, gems, moneyx, gaming, arms, antiques, usedcar, realestate, ngo, other |
| `position` | Position | ตำแหน่ง | text | When ["salaried", "civil"].includes(occType) | !["student", "homemaker", "retired", "none"].includes(occType) | Customer | KYC (AMLO) |  |
| `workProv` | Workplace province | จังหวัดที่ทำงาน | choice |  | !["student", "homemaker", "retired", "none"].includes(occType) | Customer | KYC (AMLO) | Bangkok, Nonthaburi, Pathum Thani, Samut Prakan, Chon Buri, Chiang Mai, Khon Kaen, Nakhon Ratchasima, Phuket, Songkhla, Other |
| `school` | School or university | สถานศึกษา | text | Yes | occType = "student" | Customer | KYC (AMLO) |  |

**Income**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `incomeBand` | Monthly income | รายได้ต่อเดือน | choice | Yes |  | Customer | AML/CFT (AMLO) | b1, b2, b3, b4, b5, b6 |
| `incomeSource` | Main source of income | แหล่งรายได้หลัก | choice | Yes |  | Customer | AML/CFT (AMLO) | salary, business, family, pension, investment, other |
| `incomeOther` | Other source, in the customer's words | แหล่งรายได้อื่น | text | Yes | incomeSource = "other" | Customer | AML/CFT (AMLO) |  |

### Purpose and activity

**Why the account**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `purpose` | Main purpose | วัตถุประสงค์หลัก | choice | Yes |  | Customer | AML/CFT (AMLO) | salary, savings, bills, business, family, other |
| `purposeOther` | Purpose, in the customer's words | วัตถุประสงค์ | text | Yes | purpose = "other" | Customer | AML/CFT (AMLO) |  |

**Expected activity**: This becomes the customer's expected profile; monitoring alerts when activity departs from it.

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `depBand` | Money in each month | เงินเข้าต่อเดือน | choice | Yes |  | Customer | AML/CFT (AMLO) | b1, b2, b3, b4, b5, b6 |
| `txBand` | Transactions each month | จำนวนรายการต่อเดือน | choice | Yes |  | Customer | AML/CFT (AMLO) | t1, t2, t3 |
| `cash` | Cash use | การใช้เงินสด | choice | Yes |  | Customer | AML/CFT (AMLO) | none, some, large |
| `intl` | Money sent or received abroad | รับหรือโอนเงินต่างประเทศ | choice | Yes |  | Customer | AML/CFT (AMLO) | no, yes |
| `intlCountry` | Main country | ประเทศหลัก | choice | Yes | intl = "yes" | Customer | AML/CFT (AMLO) | TH, MM, LA, KH, CN, HK, SG, JP, US, GB, IR, KP, OT |
| `intlWhy` | Why | เหตุผล | text | Yes | intl = "yes" | Customer | AML/CFT (AMLO) |  |

**First deposit**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `initAmount` | Amount | จำนวนเงิน | money (THB) | Yes |  | Customer | AML/CFT (AMLO) |  |
| `initSource` | The money comes from | ที่มาของเงิน | choice | Yes |  | Customer | AML/CFT (AMLO) | savings, salary, sale, gift, loan, other |
| `initHow` | Paid by | ฝากโดย | choice | Yes |  | Customer | AML/CFT (AMLO) | cash, transfer, cheque |

### Due diligence

**Politically exposed persons**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `pep` | Holds or held a prominent public position | เป็นหรือเคยเป็นบุคคลที่มีสถานภาพทางการเมือง | choice | Yes |  | Customer | AML/CFT (AMLO) | no, self, family, associate |
| `pepDetail` | Position, country and dates | ตำแหน่ง ประเทศ และช่วงเวลา | text | Yes | pep and pep ≠ "no" | Customer | AML/CFT (AMLO) |  |

**Who the account is for**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `actingFor` | The customer opens it for | ลูกค้าเปิดบัญชีเพื่อ | choice | Yes |  | Customer | AML/CFT (AMLO) | self, other |
| `actingName` | For whom, and why | เพื่อใคร และเหตุผล | text | Yes | actingFor = "other" | Customer | AML/CFT (AMLO) |  |

**Tax residence**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `usPerson` | US citizen, green-card holder or born in the US | เป็นพลเมืองสหรัฐ ผู้ถือกรีนการ์ด หรือเกิดในสหรัฐ | choice | Yes |  | Customer | FATCA and CRS | no, yes |
| `usTin` | US taxpayer number | เลขประจำตัวผู้เสียภาษีสหรัฐ | text | Yes | usPerson = "yes" | Customer | FATCA and CRS |  |
| `taxOther` | Tax resident outside Thailand | มีถิ่นที่อยู่ทางภาษีนอกประเทศไทย | choice | Yes |  | Customer | FATCA and CRS | no, yes |
| `taxCountry` | Country | ประเทศ | choice | Yes | taxOther = "yes" | Customer | FATCA and CRS | TH, MM, LA, KH, CN, HK, SG, JP, US, GB, IR, KP, OT |
| `taxTin` | Tax number there | เลขผู้เสียภาษีในประเทศนั้น | text | When taxNoTin ≠ "yes" | taxOther = "yes" | Customer | FATCA and CRS |  |
| `taxNoTin` | That country issues no tax number | ประเทศนั้นไม่ออกเลขผู้เสียภาษี | choice |  | taxOther = "yes" | Customer | FATCA and CRS | no, yes |

**Related parties and screening**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `relatedBank` | Related to the bank's directors or executives | เกี่ยวข้องกับกรรมการหรือผู้บริหารของธนาคาร | choice | Yes |  | Customer | BOT related-party rules | no, yes |
| `staff` | Employee of the bank | พนักงานของธนาคาร | choice | Yes |  | Customer | BOT related-party rules | no, yes |
| `screening` | Sanctions, PEP and adverse media screening | ผลตรวจรายชื่อคว่ำบาตร PEP และข่าวเชิงลบ | text, read-only |  |  | Screening | AML/CFT (AMLO) |  |
| `muleCheck` | Mule-account check (shared watchlist and device) | ตรวจบัญชีม้า (รายชื่อร่วมและอุปกรณ์) | text, read-only |  |  | Screening | AML/CFT (AMLO) |  |

### Accounts and services

**Account**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `product` | Account type | ประเภทบัญชี | choice | Yes |  | Customer | The account terms | sav, savapp, fixed, current |
| `fixedTerm` | Term | ระยะเวลา | choice | Yes | product = "fixed" | Customer | The account terms | 3, 6, 12, 24 |
| `currency` | Currency | สกุลเงิน | choice | Yes |  | Customer | The account terms | THB, USD |
| `ownership` | Held by | ผู้ถือบัญชี | choice | Yes |  | Customer | The account terms | single, and, or |
| `jointName` | Joint holder | ผู้ถือบัญชีร่วม | text | Yes | ownership ≠ "single" | Customer | KYC (AMLO) |  |
| `jointId` | Joint holder's citizen ID | เลขประจำตัวประชาชนผู้ถือบัญชีร่วม | 13-digit ID (checksum) | Yes | ownership ≠ "single" | Customer | KYC (AMLO) |  |

**Services**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `passbook` | Passbook | สมุดบัญชี | choice | Yes | product = "sav" | Customer | Operations | no, yes |
| `card` | Debit card | บัตรเดบิต | choice | Yes | product ≠ "fixed" | Customer | The account terms | none, std, plus |
| `cardAck` | Told that the card's insurance is optional: the standard card is available without it | แจ้งแล้วว่าประกันในบัตรเป็นทางเลือก บัตรมาตรฐานไม่มีประกัน | yes/no (tick) | Yes | card = "plus" | Staff | BOT market conduct |  |
| `cardPrint` | Card issued | การออกบัตร | choice | Yes | card and card ≠ "none" | Customer | Operations | instant, post |
| `promptpay` | Link to PromptPay | ผูกพร้อมเพย์ | choice | Yes | product ≠ "fixed" and currency = "THB" | Customer | Operations | none, id, mobile |
| `app` | Mobile banking | โมบายแบงก์กิ้ง | choice | Yes |  | Customer | Operations | no, yes |
| `sms` | SMS alerts, ฿20 a month | แจ้งเตือน SMS เดือนละ ฿20 | choice | Yes |  | Customer | The account terms | no, yes |
| `estatement` | Statements by | รับรายการเดินบัญชีทาง | choice | Yes |  | Customer | Operations | app, email, post |
| `cheque` | Cheque book | สมุดเช็ค | choice | Yes | product = "current" | Customer | Operations | no, yes |

### Consents

**Terms and notices**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `terms` | Account terms read and accepted, in the customer's language | อ่านและยอมรับเงื่อนไขบัญชีในภาษาของลูกค้าแล้ว | yes/no (tick) | Yes |  | Customer | BOT market conduct |  |
| `fees` | Fee schedule shown, including the dormant-account fee | แสดงตารางค่าธรรมเนียม รวมค่าธรรมเนียมบัญชีไม่เคลื่อนไหวแล้ว | yes/no (tick) | Yes |  | Staff | BOT market conduct |  |
| `dpa` | Told that deposits are protected up to ฿1,000,000 per depositor per bank | แจ้งแล้วว่าเงินฝากได้รับความคุ้มครองไม่เกิน ฿1,000,000 ต่อผู้ฝากต่อธนาคาร | yes/no (tick) | Yes |  | Staff | Deposit protection |  |

**Personal data**: Optional: the account does not depend on these.

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `pdpaMarketing` | Offers from the bank | ข้อเสนอจากธนาคาร | choice | Yes |  | Customer | PDPA consent | no, yes |
| `pdpaGroup` | Offers from the bank's group companies | ข้อเสนอจากบริษัทในกลุ่ม | choice | Yes |  | Customer | PDPA consent | no, yes |
| `pdpaPartners` | Offers from partners | ข้อเสนอจากพันธมิตร | choice | Yes |  | Customer | PDPA consent | no, yes |

**Confirmation**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `certify` | The customer confirms the information is true, the account is for their own use, and they will not let anyone else use it | ลูกค้ารับรองว่าข้อมูลถูกต้อง เปิดบัญชีเพื่อใช้เอง และจะไม่ให้ผู้อื่นใช้บัญชี | yes/no (tick) | Yes |  | Customer | AML/CFT (AMLO) |  |


## Business account opening (AO-26-0412)

115 fields.

### Company

**Registration**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `regNo` | Registration number | เลขทะเบียนนิติบุคคล | 13-digit ID (checksum), read-only | Yes |  | DBD | KYC (AMLO) |  |
| `nameTh` | Name (Thai) | ชื่อ (ไทย) | text, read-only | Yes |  | DBD | KYC (AMLO) |  |
| `nameEn` | Name (English) | ชื่อ (อังกฤษ) | text | Yes |  | DBD | KYC (AMLO) |  |
| `entity` | Type | ประเภทนิติบุคคล | choice | Yes |  | DBD | KYC (AMLO) | co, pcl, lp, rp, foundation, branch |
| `regDate` | Registered | วันจดทะเบียน | date, read-only | Yes |  | DBD | KYC (AMLO) |  |
| `capital` | Registered capital | ทุนจดทะเบียน | money (THB) | Yes |  | DBD | KYC (AMLO) |  |
| `paidUp` | Paid-up capital | ทุนชำระแล้ว | money (THB) | Yes |  | DBD | KYC (AMLO) |  |
| `status` | DBD status | สถานะที่กรมพัฒนาธุรกิจการค้า | text, read-only |  |  | DBD | KYC (AMLO) |  |

**Business**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `industry` | Industry | ประเภทธุรกิจ | choice | Yes |  | Customer | AML/CFT (AMLO) | logistics, manufacturing, retail, finance, government, health, tech, construction, hospitality, agriculture, gems, moneyx, gaming, arms, antiques, usedcar, realestate, ngo, other |
| `tsic` | TSIC code | รหัส TSIC | text | Yes |  | DBD | AML/CFT (AMLO) |  |
| `describe` | What the business does | ลักษณะธุรกิจ | long text | Yes |  | Customer | AML/CFT (AMLO) |  |
| `employees` | Employees | จำนวนพนักงาน | choice | Yes |  | Customer | KYC (AMLO) | e1, e2, e3, e4 |
| `revenue` | Revenue last year | รายได้ปีล่าสุด | choice | Yes |  | Customer | AML/CFT (AMLO) | m1, m2, m3, m4, m5 |
| `vat` | VAT registered | จดทะเบียนภาษีมูลค่าเพิ่ม | choice | Yes |  | Customer | Revenue Department | no, yes |
| `listed` | Listed on a stock exchange | จดทะเบียนในตลาดหลักทรัพย์ | choice | Yes |  | Customer | KYC (AMLO) | no, yes |

**Addresses and contact**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `regAddr` | Registered office | ที่ตั้งสำนักงานใหญ่ | text, read-only | Yes |  | DBD | KYC (AMLO) |  |
| `opSame` | Operates from the registered office | ประกอบการที่สำนักงานใหญ่ | yes/no (tick) |  |  | Customer | KYC (AMLO) |  |
| `opAddr` | Where it operates | สถานที่ประกอบการ | text | Yes | opSame is not ticked | Customer | KYC (AMLO) |  |
| `visit` | Premises visited by the RM | RM ไปเยี่ยมสถานประกอบการแล้ว | choice | Yes |  | Staff | AML/CFT (AMLO) | yes, photos, no |
| `phone` | Office phone | โทรศัพท์สำนักงาน | phone | Yes |  | Customer | Operations |  |
| `email` | Email | อีเมล | email | Yes |  | Customer | Operations |  |
| `website` | Website | เว็บไซต์ | text |  |  | Customer | AML/CFT (AMLO) |  |

### Documents

**Received**: Each is checked against the DBD record; certified copies signed by an authorised director, with the company seal if the affidavit requires one.

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `affDate` | Company affidavit dated | วันที่ของหนังสือรับรองบริษัท | date | Yes |  | DBD | KYC (AMLO) |  |
| `docMoa` | Memorandum and articles | หนังสือบริคณห์สนธิและข้อบังคับ | yes/no (tick) | When entity ≠ "rp" and entity ≠ "lp" |  | Staff | KYC (AMLO) |  |
| `docShare` | Shareholder list (BOJ.5), under 3 months | บัญชีรายชื่อผู้ถือหุ้น (บอจ.5) อายุไม่เกิน 3 เดือน | yes/no (tick) | When ["co", "pcl"].includes(entity) |  | Staff | KYC (AMLO) |  |
| `docResolution` | Board resolution to open the accounts, naming the signatories | มติกรรมการให้เปิดบัญชีและระบุผู้มีอำนาจลงนาม | yes/no (tick) | Yes |  | Staff | The account terms |  |
| `docVat` | VAT certificate (Por Por 20) | ภ.พ.20 | yes/no (tick) | Yes | vat = "yes" | Staff | Revenue Department |  |
| `docAccounts` | Latest financial statements | งบการเงินล่าสุด | yes/no (tick) | When ["co", "pcl"].includes(entity) |  | Staff | AML/CFT (AMLO) |  |
| `docUboIds` | Identity documents for every beneficial owner | เอกสารแสดงตนของผู้รับผลประโยชน์ที่แท้จริงทุกคน | yes/no (tick) | Yes |  | Staff | KYC (AMLO) |  |
| `seal` | The affidavit requires the company seal | หนังสือรับรองกำหนดให้ประทับตรา | choice | Yes |  | DBD | The account terms | no, yes |

### Directors and signatories

**Director 1**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `dir1Name` | Name | ชื่อ-นามสกุล | text | Yes |  | DBD | KYC (AMLO) |  |
| `dir1Id` | Citizen ID or passport | เลขประจำตัวหรือหนังสือเดินทาง | text | Yes |  | Customer | KYC (AMLO) |  |
| `dir1Nat` | Nationality | สัญชาติ | choice | Yes |  | Customer | KYC (AMLO) | TH, MM, LA, KH, CN, HK, SG, JP, US, GB, IR, KP, OT |
| `dir1Role` | Role | ตำแหน่ง | choice | Yes |  | DBD | KYC (AMLO) | md, fd, dir |
| `dir1Sign` | Authorised to sign | ผู้มีอำนาจลงนาม | choice | Yes |  | DBD | The account terms | a, b, no |
| `dir1Kyc` | Identity verified | ยืนยันตัวตนแล้ว | choice | Yes |  | Staff | KYC (AMLO) | ndid, branch, pending |

**Director 2**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `dir2Name` | Name | ชื่อ-นามสกุล | text | Yes |  | DBD | KYC (AMLO) |  |
| `dir2Id` | Citizen ID or passport | เลขประจำตัวหรือหนังสือเดินทาง | text | Yes |  | Customer | KYC (AMLO) |  |
| `dir2Nat` | Nationality | สัญชาติ | choice | Yes |  | Customer | KYC (AMLO) | TH, MM, LA, KH, CN, HK, SG, JP, US, GB, IR, KP, OT |
| `dir2Role` | Role | ตำแหน่ง | choice | Yes |  | DBD | KYC (AMLO) | md, fd, dir |
| `dir2Sign` | Authorised to sign | ผู้มีอำนาจลงนาม | choice | Yes |  | DBD | The account terms | a, b, no |
| `dir2Kyc` | Identity verified | ยืนยันตัวตนแล้ว | choice | Yes |  | Staff | KYC (AMLO) | ndid, branch, pending |

**More directors**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `dir3On` | Add a third director | เพิ่มกรรมการคนที่สาม | yes/no (tick) |  |  | Customer | KYC (AMLO) |  |

**Director 3** (when dir3On)

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `dir3Name` | Name | ชื่อ-นามสกุล | text | Yes |  | DBD | KYC (AMLO) |  |
| `dir3Id` | Citizen ID or passport | เลขประจำตัวหรือหนังสือเดินทาง | text | Yes |  | Customer | KYC (AMLO) |  |
| `dir3Nat` | Nationality | สัญชาติ | choice | Yes |  | Customer | KYC (AMLO) | TH, MM, LA, KH, CN, HK, SG, JP, US, GB, IR, KP, OT |
| `dir3Role` | Role | ตำแหน่ง | choice | Yes |  | DBD | KYC (AMLO) | md, fd, dir |
| `dir3Sign` | Authorised to sign | ผู้มีอำนาจลงนาม | choice | Yes |  | DBD | The account terms | a, b, no |
| `dir3Kyc` | Identity verified | ยืนยันตัวตนแล้ว | choice | Yes |  | Staff | KYC (AMLO) | ndid, branch, pending |

### Owners

**Shareholder 1**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `sh1Name` | Name | ชื่อ | text | Yes |  | DBD | KYC (AMLO) |  |
| `sh1Type` | Is a | ประเภท | choice | Yes |  | DBD | KYC (AMLO) | person, company |
| `sh1Pct` | Shares held, % | สัดส่วนหุ้น % | percent | Yes |  | DBD | KYC (AMLO) |  |
| `sh1Country` | Country | ประเทศ | choice | Yes |  | DBD | AML/CFT (AMLO) | TH, MM, LA, KH, CN, HK, SG, JP, US, GB, IR, KP, OT |

**Shareholder 2**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `sh2Name` | Name | ชื่อ | text | Yes |  | DBD | KYC (AMLO) |  |
| `sh2Type` | Is a | ประเภท | choice | Yes |  | DBD | KYC (AMLO) | person, company |
| `sh2Pct` | Shares held, % | สัดส่วนหุ้น % | percent | Yes |  | DBD | KYC (AMLO) |  |
| `sh2Country` | Country | ประเทศ | choice | Yes |  | DBD | AML/CFT (AMLO) | TH, MM, LA, KH, CN, HK, SG, JP, US, GB, IR, KP, OT |

**Shareholder 3**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `sh3Name` | Name | ชื่อ | text | Yes |  | DBD | KYC (AMLO) |  |
| `sh3Type` | Is a | ประเภท | choice | Yes |  | DBD | KYC (AMLO) | person, company |
| `sh3Pct` | Shares held, % | สัดส่วนหุ้น % | percent | Yes |  | DBD | KYC (AMLO) |  |
| `sh3Country` | Country | ประเทศ | choice | Yes |  | DBD | AML/CFT (AMLO) | TH, MM, LA, KH, CN, HK, SG, JP, US, GB, IR, KP, OT |

**Ownership checks**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `nominee` | Any shareholder holds for someone else (nominee) | มีผู้ถือหุ้นแทนบุคคลอื่น (นอมินี) | choice | Yes |  | Customer | AML/CFT (AMLO) | no, yes |
| `layers` | Layers of companies to reach the owners | จำนวนชั้นนิติบุคคลถึงผู้ถือหุ้นจริง | number | Yes |  | Staff | AML/CFT (AMLO) |  |

**Beneficial owner 1**: Every person who owns or controls 25% or more, directly or through companies.

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `ubo1Name` | Name | ชื่อ-นามสกุล | text | Yes |  | Customer | KYC (AMLO) |  |
| `ubo1Id` | Citizen ID or passport | เลขประจำตัวหรือหนังสือเดินทาง | text | Yes |  | Customer | KYC (AMLO) |  |
| `ubo1Nat` | Nationality | สัญชาติ | choice | Yes |  | Customer | KYC (AMLO) | TH, MM, LA, KH, CN, HK, SG, JP, US, GB, IR, KP, OT |
| `ubo1Pct` | Effective ownership, % | สัดส่วนที่แท้จริง % | percent | Yes |  | Customer | KYC (AMLO) |  |
| `ubo1How` | Held through | ถือผ่าน | text |  |  | Customer | KYC (AMLO) |  |
| `ubo1Pep` | Politically exposed | บุคคลที่มีสถานภาพทางการเมือง | choice | Yes |  | Customer | AML/CFT (AMLO) | no, yes |
| `ubo1Wealth` | Source of wealth | แหล่งที่มาของความมั่งคั่ง | text | When ubonPep = "yes" or (ubonNat and ubonNat ≠ "TH") |  | Customer | AML/CFT (AMLO) |  |

**More beneficial owners**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `ubo2On` | Add a second beneficial owner | เพิ่มผู้รับผลประโยชน์รายที่สอง | yes/no (tick) |  |  | Customer | KYC (AMLO) |  |

**Beneficial owner 2** (when ubo2On)

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `ubo2Name` | Name | ชื่อ-นามสกุล | text | Yes |  | Customer | KYC (AMLO) |  |
| `ubo2Id` | Citizen ID or passport | เลขประจำตัวหรือหนังสือเดินทาง | text | Yes |  | Customer | KYC (AMLO) |  |
| `ubo2Nat` | Nationality | สัญชาติ | choice | Yes |  | Customer | KYC (AMLO) | TH, MM, LA, KH, CN, HK, SG, JP, US, GB, IR, KP, OT |
| `ubo2Pct` | Effective ownership, % | สัดส่วนที่แท้จริง % | percent | Yes |  | Customer | KYC (AMLO) |  |
| `ubo2How` | Held through | ถือผ่าน | text |  |  | Customer | KYC (AMLO) |  |
| `ubo2Pep` | Politically exposed | บุคคลที่มีสถานภาพทางการเมือง | choice | Yes |  | Customer | AML/CFT (AMLO) | no, yes |
| `ubo2Wealth` | Source of wealth | แหล่งที่มาของความมั่งคั่ง | text | When ubonPep = "yes" or (ubonNat and ubonNat ≠ "TH") |  | Customer | AML/CFT (AMLO) |  |

### Expected activity

**Money in and out**: The expected profile for monitoring.

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `inMonth` | Money in each month | เงินเข้าต่อเดือน | choice | Yes |  | Customer | AML/CFT (AMLO) | m1, m2, m3, m4, m5 |
| `outMonth` | Money out each month | เงินออกต่อเดือน | choice | Yes |  | Customer | AML/CFT (AMLO) | m1, m2, m3, m4, m5 |
| `cashIn` | Cash deposits each month | เงินสดฝากต่อเดือน | choice | Yes |  | Customer | AML/CFT (AMLO) | none, small, large |
| `intl` | Cross-border payments | ธุรกรรมข้ามประเทศ | choice | Yes |  | Customer | AML/CFT (AMLO) | no, yes |
| `intlCountries` | Main countries | ประเทศหลัก | text | Yes | intl = "yes" | Customer | AML/CFT (AMLO) |  |
| `customers` | Main customers | ลูกค้าหลัก | text | Yes |  | Customer | AML/CFT (AMLO) |  |
| `suppliers` | Main suppliers | ผู้ขายหลัก | text | Yes |  | Customer | AML/CFT (AMLO) |  |
| `otherBanks` | Accounts at other banks | บัญชีที่ธนาคารอื่น | choice |  |  | Customer | AML/CFT (AMLO) | this, kbank, scb, bbl, ktb, bay, ttb, other |

**First deposit**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `initAmount` | Amount | จำนวนเงิน | money (THB) | Yes |  | Customer | AML/CFT (AMLO) |  |
| `initSource` | Comes from | ที่มาของเงิน | choice | Yes |  | Customer | AML/CFT (AMLO) | trading, capital, loan, other |

### Due diligence

**Tax classification**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `fatcaClass` | FATCA and CRS classification | การจัดประเภทตาม FATCA และ CRS | choice | Yes |  | Customer | FATCA and CRS | active, passive, ffi |
| `giin` | GIIN | GIIN | text | Yes | fatcaClass = "ffi" | Customer | FATCA and CRS |  |
| `ctrlTax` | Controlling persons' tax residences | ถิ่นที่อยู่ทางภาษีของผู้มีอำนาจควบคุม | text | Yes | fatcaClass = "passive" | Customer | FATCA and CRS |  |

**Screening and risk indicators**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `screening` | Sanctions and PEP screening of the company, directors and owners | ผลตรวจรายชื่อคว่ำบาตรและ PEP ของนิติบุคคล กรรมการ และผู้ถือหุ้น | choice | Yes |  | Screening | AML/CFT (AMLO) | clear, near, cleared, hit |
| `nearNote` | How the near match was cleared | วิธีตรวจชื่อใกล้เคียง | text | Yes | screening = "cleared" | Staff | AML/CFT (AMLO) |  |
| `adverse` | Adverse media found | พบข่าวเชิงลบ | choice | Yes |  | Screening | AML/CFT (AMLO) | no, yes |
| `shell` | Signs of a shell company (no staff, no premises, mail-drop address) | สัญญาณบริษัทเปลือก (ไม่มีพนักงาน ไม่มีสถานประกอบการ ใช้ที่อยู่รับจดหมาย) | choice | Yes |  | Staff | AML/CFT (AMLO) | no, yes |
| `relatedBank` | Related to the bank's directors or executives | เกี่ยวข้องกับกรรมการหรือผู้บริหารของธนาคาร | choice | Yes |  | Customer | BOT related-party rules | no, yes |

### Accounts and services

**Accounts**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `current` | Business current account (THB) | บัญชีกระแสรายวันธุรกิจ (บาท) | choice | Yes |  | Customer | The account terms | no, yes |
| `cheque` | Cheque book | สมุดเช็ค | choice | Yes | current = "yes" | Customer | Operations | no, yes |
| `savings` | Business savings account | บัญชีออมทรัพย์ธุรกิจ | choice | Yes |  | Customer | The account terms | no, yes |
| `fcd` | Foreign currency deposit | บัญชีเงินฝากเงินตราต่างประเทศ | choice | Yes |  | Customer | The account terms | none, USD, EUR, CNY |

**Corporate internet banking**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `ib` | Corporate internet banking | อินเทอร์เน็ตแบงก์กิ้งนิติบุคคล | choice | Yes |  | Customer | Operations | no, yes |
| `ibAdmin1` | Administrator 1 | ผู้ดูแลระบบคนที่ 1 | text | Yes | ib = "yes" | Customer | Operations |  |
| `ibAdmin2` | Administrator 2 | ผู้ดูแลระบบคนที่ 2 | text | Yes | ib = "yes" | Customer | Operations |  |
| `ibUsers` | Other users | ผู้ใช้อื่น | number | Yes | ib = "yes" | Customer | Operations |  |
| `ibLimit` | Daily transfer limit | วงเงินโอนต่อวัน | money (THB) | Yes | ib = "yes" | Customer | Operations |  |
| `payroll` | Payroll service | บริการจ่ายเงินเดือน | choice | Yes |  | Customer | Operations | no, yes |
| `stmt` | Statements | รายการเดินบัญชี | choice | Yes |  | Customer | Operations | monthly, daily |

### Signing mandate

**Who may sign**: From the board resolution and the affidavit; the console enforces it on every channel.

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `band1` | Up to | ไม่เกิน | money (THB) | Yes |  | Customer | The account terms |  |
| `rule1` | Below that amount | ต่ำกว่าวงเงินนี้ | choice | Yes |  | Customer | The account terms | a1, any1, ab |
| `rule2` | Above that amount | เกินวงเงินนี้ | choice | Yes |  | Customer | The account terms | ab, aa, all |
| `mandateSeal` | With the company seal | ประทับตราบริษัท | choice | Yes |  | Customer | The account terms | no, yes |

### Declarations

**Declarations**

| Field | Label | Thai | Type | Required | Shown when | Source | Why | Values |
|---|---|---|---|---|---|---|---|---|
| `terms` | Business account terms and the fee schedule accepted | ยอมรับเงื่อนไขบัญชีนิติบุคคลและตารางค่าธรรมเนียมแล้ว | yes/no (tick) | Yes |  | Customer | BOT market conduct |  |
| `ownersTrue` | The ownership given is complete, and changes will be reported within 30 days | ข้อมูลผู้ถือหุ้นครบถ้วน และจะแจ้งการเปลี่ยนแปลงภายใน 30 วัน | yes/no (tick) | Yes |  | Customer | KYC (AMLO) |  |
| `pdpa` | Directors and owners were told how their personal data is used | แจ้งกรรมการและผู้ถือหุ้นเรื่องการใช้ข้อมูลส่วนบุคคลแล้ว | yes/no (tick) | Yes |  | Staff | PDPA consent |  |
| `certify` | Signed by the authorised directors, under the mandate above | ลงนามโดยกรรมการผู้มีอำนาจตามเงื่อนไขข้างต้น | yes/no (tick) | Yes |  | Customer | The account terms |  |

## Derived, not asked

- **Customer risk** adds points for the answers that raise risk (foreign nationality or ownership, opening remotely, higher-risk industries, deposits well above income, large cash, cross-border flows and high-risk countries, politically exposed persons, acting for someone else, nominees, shell signs, layered ownership, adverse media). 0–3 is low (opens at once, checked the same day, reviewed every 3 years), 4–7 medium (a manager approves, reviewed every 2 years), 8 or more high (enhanced due diligence, compliance and a senior manager approve).
- **Cross-checks** for businesses: shareholdings add up to 100%, and a company shareholder of 25% or more has the person behind it named.
