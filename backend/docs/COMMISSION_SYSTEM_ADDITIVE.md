# Additive Commission System — Fixed & Percentage (No Subsidy)

**Status:** Design / implementation plan (not yet implemented)
**Scope:** Hospitals, Laboratories, Consultants — payout calculation & weekly settlement
**Supersedes:** the nested/subsidy model in `COMMISSION_SYSTEM_DESIGN.md`
**Last updated:** 2026-06-29

---

## 1. Purpose

Replace the single percentage-only payout model with a model where **each party**
(a specific hospital, a specific lab, a specific consultant) can be set to
**percentage** *or* **fixed price**, independently. The two amounts are **additive**,
not nested — which eliminates the "platform subsidy / negative admin share" problem
entirely.

### Confirmed product decisions (from stakeholder)

1. **Additive structure, not nested.** The consultant fee is a separate cost paid by
   the facility, *on top of* the platform cut — it is **not** carved out of the platform
   cut. Therefore the admin always keeps the full platform cut; the admin share can
   never go negative. **No subsidy system.**
2. **Consultant percentage = % of the patient bill** (not % of the platform cut).
3. **Fixed fees are bill-independent and always paid in full.** Once a referral is
   admitted, the facility owes `platform cut + consultant fee` per each party's
   settings — regardless of how large or small the patient bill is. No cap.
4. **Both values are always stored.** A `commissionType` flag (`percentage` | `fixed`)
   only selects which stored value is active; switching modes never erases the other.
5. **One hospital may have a mix** of fixed-fee and percentage consultants in the same
   weekly settlement; the settlement total is computed automatically by summing
   per-case snapshots.
6. **Mirror everything for laboratories.**

---

## 2. The model

### 2.1 Core rule (per finalized case)

```
Admin Fee (platform cut) = facility setting:    fixed OR  % of bill
Consultant Fee           = consultant setting:  fixed OR  % of bill
Facility Payable         = Admin Fee + Consultant Fee      ← facility owes this
Facility Keeps           = Bill − Facility Payable         ← informational, may be negative

Admin keeps the FULL Admin Fee.  Consultant gets the FULL Consultant Fee.
```

- **Fixed** parties ignore the bill entirely.
- **Percentage** parties compute their amount **from the patient bill**.
- Money is stored in **paisa** (1 PKR = 100 paisa). Rounding happens once, in the
  engine; callers never re-round.

### 2.2 Difference from the old nested model

| | Old (nested) | New (additive) |
|---|---|---|
| Structure | Consultant share **carved out of** platform cut | Consultant fee **added on top of** platform cut |
| Admin share | `platformCut − consultantShare` (could go negative) | always equals the full platform cut (≥ 0) |
| Consultant % basis | % of the platform cut | **% of the patient bill** |
| Facility pays | platform cut only | **platform cut + consultant fee** |
| Subsidy possible? | Yes (admin absorbs) | **No, ever** |

---

## 3. Worked examples

### 3.1 The 4 base combinations — single case, Bill = Rs 10,000

| # | Facility setting | Consultant setting | Admin Fee | Consultant Fee | **Facility Pays** | Facility Keeps |
|---|---|---|---|---|---|---|
| 1 | 20% | 10% | 2,000 | 1,000 | **3,000** | 7,000 |
| 2 | 20% | Fixed 1,500 | 2,000 | 1,500 | **3,500** | 6,500 |
| 3 | Fixed 2,500 | 10% | 2,500 | 1,000 | **3,500** | 6,500 |
| 4 | Fixed 2,500 | Fixed 1,500 | 2,500 | 1,500 | **4,000** | 6,000 |

### 3.2 Large bill — fixed consultant unaffected (Bill = Rs 50,000)

| Facility | Consultant | Admin Fee | Consultant Fee | Facility Pays |
|---|---|---|---|---|
| 20% | Fixed 1,500 | 10,000 | **1,500** (bill ignored) | 11,500 |
| Fixed 2,500 | Fixed 1,500 | 2,500 | 1,500 | 4,000 (fully bill-independent) |

### 3.3 Tiny bill — fees still paid in full (locked rule), Bill = Rs 1,000

| Facility | Consultant | Admin Fee | Consultant Fee | Facility Pays | Facility Keeps |
|---|---|---|---|---|---|
| Fixed 500 | Fixed 1,500 | 500 | 1,500 | **2,000** | **−1,000** (facility's outcome; admin protected) |

UI shows a soft warning, but the math stands: once admitted, the facility owes 2,000.

### 3.4 ★ Mixed-consultant weekly settlement (key requirement)

**City Hospital — platform cut = 20% (percentage). Four admissions this week:**

| Admission | Consultant | Consultant setting | Bill | Admin Fee (20%) | Consultant Fee | Facility Owes |
|---|---|---|---|---|---|---|
| #1 | Dr. A | **10%** | 10,000 | 2,000 | 1,000 | 3,000 |
| #2 | Dr. A | **10%** | 20,000 | 4,000 | 2,000 | 6,000 |
| #3 | Dr. B | **Fixed 1,500** | 8,000 | 1,600 | 1,500 | 3,100 |
| #4 | Dr. B | **Fixed 1,500** | 50,000 | 10,000 | 1,500 | 11,500 |

**Settlement auto-totals:**
- Gross bills (info) = **88,000**
- Admin Fee total (platform cut) = 2,000 + 4,000 + 1,600 + 10,000 = **17,600**
- Dr. A payout = 1,000 + 2,000 = **3,000** · Dr. B payout = 1,500 + 1,500 = **3,000**
- Consultant payouts total = **6,000**
- **Hospital Total Payable = 17,600 + 6,000 = 23,600**
  (= Σ Facility-Owes 3,000 + 6,000 + 3,100 + 11,500 = 23,600 ✓)

Fixed and percentage consultants coexist in one settlement; each is summed from its
own immutable snapshot.

### 3.5 Same week, but hospital on a FIXED admin fee (Rs 2,000/admission)

Admin Fee = 2,000 per admission regardless of bill → Admin Fee total = 4 × 2,000 =
**8,000**; consultant payouts unchanged at **6,000** → **Hospital Total Payable = 14,000**.

### 3.6 Edge cases

- **Zero/blank bill + percentage party** → that party's fee = 0. A **fixed** party is
  still owed its flat fee. (Finalize bill-guard becomes mode-aware.)
- **Multiple admissions, same consultant** → grouped into one payout row (existing
  `consultantMap` logic already sums them).
- **Mid-week rate change** → no effect on already-finalized cases (snapshot frozen in
  `Payout`); only future cases use the new setting.
- **Re-opened / rejected settlement** → recomputed from the same immutable snapshots.

---

## 4. Implementation plan

### 4.1 New calculation engine — `services/commissionService.js`

Pure, no DB writes; the single source of truth.

```js
computeSplit({ billPaisa, facility, consultant, scope, settings }) → {
  platformCutPaisa,        // admin fee (admin revenue)
  consultantFeePaisa,      // consultant fee
  adminSharePaisa,         // == platformCutPaisa (admin keeps the whole cut)
  hospitalOwesPaisa,       // platformCut + consultantFee
  hospitalKeepsPaisa,      // bill − owed (informational; may be negative)
  // snapshot of the applied deal:
  facilityCommissionType, deductionPercentage, fixedDeductionPaisa,
  consultantCommissionType, commissionPercentage, fixedCommissionPaisa,
}
```

Reference algorithm:

```js
const bill = Math.max(0, Math.round(billPaisa || 0));

// Admin fee
platformCut = facility.commissionType === 'fixed'
  ? Math.max(0, Math.round(facility.fixedDeductionPaisa || 0))   // flat, not capped
  : Math.round(bill * clampPct(facility.deductionPercentage ?? default) / 100);

// Consultant fee — % is of the BILL (locked decision #2)
const cType = scope === 'lab' ? consultant.labCommissionType : consultant.hospitalCommissionType;
const cPct  = scope === 'lab' ? consultant.labCommissionPercentage : consultant.commissionPercentage;
const cFix  = scope === 'lab' ? consultant.labFixedCommissionPaisa : consultant.hospitalFixedCommissionPaisa;
consultantFee = cType === 'fixed'
  ? Math.max(0, Math.round(cFix || 0))
  : Math.round(bill * clampPct(cPct ?? default) / 100);

hospitalOwes = platformCut + consultantFee;
```

Also export `rupeesToPaisa(rupees)` (× 100, integer-validated) for the admin API
boundary, and helpers `clampPct`, `toPaisa`.

### 4.2 Data model changes (all additive, default to today's % behavior)

**`models/Hospital.js`**
```js
commissionType:      { type: String, enum: ['percentage','fixed'], default: 'percentage' },
deductionPercentage: { type: Number, default: 20 },         // EXISTING — kept (% value)
fixedDeductionPaisa: { type: Number, default: 0, min: 0 },  // NEW — flat admin fee/admission
```

**`models/Laboratory.js`** — same three fields (flat admin fee per lab referral).

**`models/Consultant.js`** (two independent deals)
```js
// Hospital deal
hospitalCommissionType:       { type: String, enum: ['percentage','fixed'], default: 'percentage' },
commissionPercentage:         { type: Number, default: 60 },        // EXISTING — now means % OF BILL
hospitalFixedCommissionPaisa: { type: Number, default: 0, min: 0 }, // NEW
// Lab deal
labCommissionType:            { type: String, enum: ['percentage','fixed'], default: 'percentage' },
labCommissionPercentage:      { type: Number, default: 60 },        // NEW
labFixedCommissionPaisa:      { type: Number, default: 0, min: 0 }, // NEW
```

**`models/PlatformSettings.js`** — defaults for new sign-ups:
`defaultHospitalCommissionType`, `defaultHospitalFixedDeductionPaisa`,
`defaultLabCommissionType`, `defaultLabFixedDeductionPaisa`,
`defaultConsultantHospitalCommissionType`, `defaultConsultantHospitalFixedPaisa`,
`defaultConsultantLabCommissionType`, `defaultConsultantLabFixedPaisa`.

**`models/Payout.js`** & **`models/LabPayout.js`** — snapshot additions:
```js
facilityCommissionType:   { type: String, enum: ['percentage','fixed'], default: 'percentage' },
fixedDeductionPaisa:      { type: Number, default: 0 },
consultantCommissionType: { type: String, enum: ['percentage','fixed'], default: 'percentage' },
fixedCommissionPaisa:     { type: Number, default: 0 },
hospitalOwesPaisa:        { type: Number, default: 0 },   // platformCut + amount
```
(`amountPaisa` = consultant fee, `platformCutPaisa` = admin fee, `adminSharePaisa` =
platformCutPaisa already exist and remain.)

**`models/WeeklySettlement.js`** & **`models/LabSettlement.js`**
```js
deductionPercentage:         { type: Number },             // make OPTIONAL (no single % in fixed mode)
calculatedPlatformCutPaisa:  { type: Number, min: 0 },     // Σ admin fees
consultantPayoutsTotalPaisa: { type: Number, default: 0 }, // NEW = Σ consultant fees
hospitalTotalPayablePaisa:   { type: Number, default: 0 }, // NEW = platformCut + consultant total ← facility transfers THIS
// consultantPayouts[] subdoc: add commissionType + fixedCommissionPaisa (for display badges)
```
(`grossAmountPaisa` stays as the informational sum of patient bills.)

### 4.3 Refactor the 4 math sites onto the engine

| File | Change |
|---|---|
| `services/billingService.js` `finalizeAdmission` | replace inline split (lines ~27–38) with `computeSplit({scope:'hospital'})`; write new snapshot fields + `hospitalOwesPaisa` into the `Payout`. Make the "no bill → can't finalize" guard mode-aware (fixed mode may finalize without a bill). |
| `services/labBillingService.js` `finalizeLabReferral` | replace inline split (lines ~35–43) with `computeSplit({scope:'lab', billPaisa: gross − discount})`; keep discount logic unchanged. |
| `controllers/settlementController.js` `listPendingAdmissions` (line ~32) | **stop** recomputing `bill × deduction%`; read the `Payout` snapshot (`platformCutPaisa`) so preview == final. |
| `controllers/labSettlementController.js` `listPendingReferrals` (line ~28) | same fix using `LabPayout` snapshot. |

### 4.4 Settlement aggregation (the "automatic" part)

In `settlementController.createSettlement` (lines ~76–111) and
`labSettlementController.createSettlement` (lines ~74–110):

```js
calculatedPlatformCutPaisa   = Σ payout.platformCutPaisa          // admin fees
consultantPayouts[c].amountPaisa = Σ payout.amountPaisa           // per consultant, any type
consultantPayoutsTotalPaisa  = Σ all consultant amounts
hospitalTotalPayablePaisa    = calculatedPlatformCutPaisa + consultantPayoutsTotalPaisa
```
Snapshot each consultant's `commissionType` / `fixedCommissionPaisa` into the subdoc.
Drop the `deductionPercentage: hospital.deductionPercentage` line (no longer a single
number). Keep the existing per-consultant grouping and the lab's amount-hiding logic.

### 4.5 Admin API + setters

- `adminController.adminUpdateHospitalDeduction` — accept `commissionType` +
  `fixedDeductionPaisa`; convert rupees→paisa at the boundary; validate
  (type ∈ enum, % ∈ [0,100], fixed ≥ 0 integer); extend `AuditLog` details.
- `adminController.adminUpdateConsultantCommission` — accept both deals
  (`hospitalCommissionType`, `commissionPercentage`, `hospitalFixedCommissionPaisa`,
  `labCommissionType`, `labCommissionPercentage`, `labFixedCommissionPaisa`).
- `labAdminController.updateLab` — accept `commissionType`, `fixedDeductionPaisa`
  alongside existing `deductionPercentage`, `maxConsultantDiscountPercentage`.
- `adminController.updatePlatformSettings` — accept the new default fields.

### 4.6 Frontend

- **Toggles** (`pages/admin/AdminHospitals.jsx`, `AdminConsultants.jsx` — two blocks
  hospital + lab, `AdminLaboratory.jsx`, `AdminSettings.jsx`): radio
  `( ● Percentage   ○ Fixed price )` reveals the relevant input; inactive value
  preserved; rupee input shown, paisa stored; soft warning on fixed+0 or an
  unusually large flat fee; show the current effective mode as a badge.
- **Displays** (`pages/HospitalSettlements.jsx`, `admin/AdminSettlements.jsx`,
  `ConsultantEarnings.jsx`, `lab/LabSettlements.jsx`): headline **Total Payable**,
  a breakdown row "Admin fee Σ + Consultant fees Σ", and per-consultant rows with a
  type badge ("Fixed Rs 1,500" or "10%").

### 4.7 Migration / rollout

1. Schema deploy — additive fields with defaults; existing records behave as
   `percentage` with `fixed = 0`.
2. **⚠ Behavior note (not a no-op migration):** the old `commissionPercentage` meant
   "% of the platform cut"; it now means "% of the **bill**." Existing percentage
   consultants will compute differently. Recommended: ship defaults, then have the
   admin **review** consultant percentages. A blind auto-conversion is unreliable
   because one consultant refers to many facilities with different deduction %s.
3. In-flight settlements are unaffected (they sum immutable snapshots).
4. Feature is invisible until an admin flips a toggle.
5. Rollback — fields are additive; reverting the engine leaves data intact.

### 4.8 Tests — `tests/commissionService.test.js`

- All 4 combinations × {hospital, lab} scope.
- Mixed-settlement reconciliation: `Σ consultantFee + Σ adminFee === Σ hospitalOwes`.
- Tiny bill (negative facility-keeps), zero/blank bill.
- `rupeesToPaisa` off-by-100 guard; percentage clamping [0,100]; rounding.

---

## 5. Files touched (build checklist)

**New:** `services/commissionService.js`, `tests/commissionService.test.js`.

**Models:** `Hospital.js`, `Laboratory.js`, `Consultant.js`, `PlatformSettings.js`,
`Payout.js`, `LabPayout.js`, `WeeklySettlement.js`, `LabSettlement.js`.

**Services:** `billingService.js`, `labBillingService.js`.

**Controllers:** `settlementController.js` (preview + createSettlement),
`labSettlementController.js` (preview + createSettlement),
`adminController.js` (hospital deduction, consultant commission, platform settings),
`labAdminController.js` (`updateLab`).

**Frontend:** `pages/admin/AdminHospitals.jsx`, `AdminConsultants.jsx`,
`AdminLaboratory.jsx`, `AdminSettings.jsx`; `pages/HospitalSettlements.jsx`,
`admin/AdminSettlements.jsx`, `ConsultantEarnings.jsx`, `lab/LabSettlements.jsx`.
