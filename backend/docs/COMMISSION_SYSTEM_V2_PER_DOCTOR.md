# Commission & Platform Charges — v2 (Per-Doctor, Additive)

**Status:** Design / implementation plan (not yet implemented)
**Scope:** Hospitals (per referral) + Laboratories (per test) — payout calculation & weekly settlement
**Supersedes:** `COMMISSION_SYSTEM_ADDITIVE.md` and `COMMISSION_SYSTEM_DESIGN.md`
**Driven by:** two stakeholder messages — "Admin Portal – Commission" (lab/per-test) and
"Admin Portal Commission & Platform Charges Setup" (hospital/per-doctor).
**Last updated:** 2026-06-30

---

## 1. What changed from v1 (`COMMISSION_SYSTEM_ADDITIVE.md`)

The additive principle is kept; two structural things change, plus a granularity split:

| | v1 (ADDITIVE.md) | **v2 (this doc)** |
|---|---|---|
| Who owns the platform charge | the **facility** (`Hospital`/`Lab.deductionPercentage`) | the **doctor** (per-doctor, negotiated per facility) |
| Fixed fee unit (lab) | flat per **referral**, bill-independent | flat per **test** (× number of tests) |
| Fixed fee unit (hospital) | flat per referral | flat per referral *(unchanged)* |
| "Volume-based higher cut" | not modeled | a **per-doctor platform-charge amount** the admin sets manually, informed by referral volume — no auto-tier engine |
| Calculation grain | whole bill | **hospital = per referral**, **lab = per test** (auto-summed) |

Everything still resolves to the same headline rule:

```
Total Cut (facility owes) = Doctor Commission + Platform Charge
Admin keeps the FULL Platform Charge.   Doctor gets the FULL Doctor Commission.
(No nesting, no subsidy, admin share never negative.)
```

---

## 2. The model

### 2.0 Ownership (corrected per stakeholder)

Money flows **Hospital → Admin → Consultant**. Two parties are configured separately:

- The **CONSULTANT** owns the **doctor commission** (one deal per scope: percentage of the
  bill OR fixed). Set on the Consultant.
- The **FACILITY** (Hospital / Laboratory) owns the **platform charge**, set by the admin to
  **ONE type — percentage OR fixed** — applied to every referral at that facility regardless
  of the consultant.

A single weekly settlement still mixes fixed- and percentage-**commission** consultants — that
variation lives on the consultant side and is frozen into each case's snapshot at finalization,
so the settlement simply sums the frozen rows. The facility's platform charge is uniform.

A **per-doctor × per-facility override** (`Consultant.facilityPlatformOverrides[]`) can force a
specific platform charge (type + value) for a high-volume doctor at a specific facility.

**Worked mix — City Hospital on a fixed Rs 3,000/referral platform charge, bill Rs 50,000:**

| Consultant | Commission | Platform charge | Commission | Platform | Hospital owes |
|---|---|---|---|---|---|
| Dr. Fixed | Fixed Rs 10,000 | Rs 3,000 (fixed) | 10,000 | 3,000 | **13,000** |
| Dr. Percent | 15% of bill | Rs 3,000 (fixed) | 7,500 | 3,000 | **10,500** |

Both coexist in the same settlement; the hospital's weekly due = Σ (commission + platform),
and that same total is shown to the hospital (preview + history) and to the admin.

### 2.1 Two scopes, two components, two types

| Scope | Component | Owned by | `percentage` means | `fixed` means |
|---|---|---|---|---|
| Hospital | Doctor commission | **Consultant** | % of the admission bill | flat PKR **per referral** |
| Hospital | Platform charge | **Hospital** | % of the admission bill | flat PKR **per patient** |
| Lab | Doctor commission | **Consultant** | % of each test price | flat PKR **per test** (× count) |
| Lab | Platform charge | **Laboratory** | % of each test price | flat PKR **per test** (× count) |

- All four are **optional** and **both values are always stored**; a `*Type` flag only
  selects the active one (switching modes never erases the other number).
- Money is stored in **paisa** (1 PKR = 100 paisa). Rupee inputs convert at the admin
  API boundary; rounding happens once, inside the engine.

### 2.2 "Volume-based higher cut" = a per-doctor platform amount

There is **no automatic volume tier**. The admin sets each doctor's platform charge
manually, "finalized with the hospital/lab based on the doctor's referral volume."
A high-volume doctor simply gets a higher per-doctor amount:

- Hospital: high-volume doctor = Rs 4,000/patient; others = Rs 3,000/patient.
- Lab: high-volume doctor = Rs 150/test; others = Rs 100/test.

The portal **surfaces each doctor's referral volume** to inform the admin's decision,
but the rate itself is an explicit admin setting (auditable), not a computed tier.

### 2.3 Platform-charge resolution order

```
1. per-doctor × this-facility override   (optional — for deals struck "with the hospital/lab")
2. per-doctor default (the doctor's scope setting)        ← primary path
3. platform default (PlatformSettings)                    ← fallback for unset doctors
```
`Hospital.deductionPercentage` / `Laboratory.deductionPercentage` are **demoted to a
legacy fallback default** only; the doctor-level value is authoritative.

---

## 3. Worked examples (reconciling both messages)

### 3.1 Hospital — per referral (message 2)

| Doctor | Commission setting | Platform setting | Bill | Doctor Commission | Platform Charge | **Hospital Owes** |
|---|---|---|---|---|---|---|
| A | Fixed 10,000 | Fixed 3,000 | any | 10,000 | 3,000 | **13,000** |
| B | 15% | Fixed 4,000 | 50,000 | 7,500 | 4,000 | **11,500** |
| C | 15% | 10% | 50,000 | 7,500 | 5,000 | **12,500** |

Hospital portal shows `Total Bill = Doctor Commission + Platform Charge` live, per case.

### 3.2 Lab — per test (message 1)

Bill = 3 tests at Rs 2,000 each (gross Rs 6,000).

| Doctor | Commission/test | Platform/test | Doctor Commission (×3) | Platform Charge (×3) | **Total Cut** |
|---|---|---|---|---|---|
| Normal-volume | Fixed 100 | Fixed 100 | 300 | 300 | **600** |
| High-volume | Fixed 100 | **Fixed 150** | 300 | 450 | **750** |
| Percentage | 10% | 20% | 600 | 1,200 | **1,800** |

Only the platform charge rises for the high-volume doctor; the doctor commission is
unchanged — exactly as the stakeholder specified.

### 3.3 Mixed weekly lab settlement (auto-total)

Each closed referral snapshots its own `doctorCommissionPaisa` + `platformChargePaisa`;
the settlement sums them: `facilityTotalPayable = Σ doctorCommission + Σ platformCharge`.
Fixed-per-test and percentage doctors coexist in one settlement.

### 3.4 Edge cases

- **Zero/blank bill, percentage component** → that component = 0. A **fixed** component is
  still owed (per referral for hospital; per test × count for lab).
- **Tiny bill, fixed > bill** → honored; `facilityKeeps` may be negative (informational).
  Admin keeps the platform charge regardless; admin share never negative.
- **Mid-week rate change** → no effect on already-finalized cases (snapshot frozen);
  only future cases use the new setting.
- **Lab with 0 services** → fixed-per-test × 0 = 0; finalize guard still requires a bill.

---

## 4. Data model changes (all additive; defaults reproduce today's % behavior)

### 4.1 `Consultant` (the doctor — four deals)

```js
// ── Hospital scope ──
hospitalCommissionType:        { type: String, enum: ['percentage','fixed'], default: 'percentage' },
commissionPercentage:          { type: Number, default: 60 },     // EXISTING — now = % OF BILL (hospital)
hospitalFixedCommissionPaisa:  { type: Number, default: 0, min: 0 },

hospitalPlatformChargeType:        { type: String, enum: ['percentage','fixed'], default: 'fixed' },
hospitalPlatformChargePercentage:  { type: Number, default: 20 },
hospitalFixedPlatformChargePaisa:  { type: Number, default: 0, min: 0 },  // flat per patient/referral

// ── Lab scope (per test) ──
labCommissionType:                 { type: String, enum: ['percentage','fixed'], default: 'percentage' },
labCommissionPercentage:           { type: Number, default: 60 },
labFixedCommissionPaisaPerTest:    { type: Number, default: 0, min: 0 },

labPlatformChargeType:             { type: String, enum: ['percentage','fixed'], default: 'fixed' },
labPlatformChargePercentage:       { type: Number, default: 20 },
labFixedPlatformChargePaisaPerTest:{ type: Number, default: 0, min: 0 },  // flat per test

// ── Optional per-facility override (deals struck "with the hospital/lab") — phase 2 ──
facilityPlatformOverrides: [{
  facilityType:             { type: String, enum: ['hospital','lab'] },
  facilityId:               { type: mongoose.Schema.Types.ObjectId },
  platformChargeType:       { type: String, enum: ['percentage','fixed'] },
  platformChargePercentage: { type: Number },
  fixedPlatformChargePaisa: { type: Number, min: 0 },   // per referral (hospital) / per test (lab)
}],
```

### 4.2 `Hospital.js` / `Laboratory.js`

`deductionPercentage` kept but **demoted to fallback default** (used only when the
doctor has no platform-charge setting). No new required fields.

### 4.3 `PlatformSettings` — defaults for new doctors

```js
defaultHospitalCommissionType, defaultHospitalFixedCommissionPaisa,
defaultHospitalPlatformChargeType, defaultHospitalFixedPlatformChargePaisa, defaultHospitalPlatformChargePercentage,
defaultLabCommissionType, defaultLabFixedCommissionPaisaPerTest,
defaultLabPlatformChargeType, defaultLabFixedPlatformChargePaisaPerTest, defaultLabPlatformChargePercentage,
```
(existing `defaultHospitalDeductionPercentage` / `defaultConsultantCommissionPercentage` /
lab equivalents remain as the percentage values + legacy fallback.)

### 4.4 `Payout` / `LabPayout` — snapshot the applied deal

```js
commissionType:            { type: String, enum: ['percentage','fixed'], default: 'percentage' },
fixedCommissionPaisa:      { type: Number, default: 0 },   // per-test value for lab
platformChargeType:        { type: String, enum: ['percentage','fixed'], default: 'percentage' },
fixedPlatformChargePaisa:  { type: Number, default: 0 },
testCount:                 { type: Number, default: 0 },   // lab only (for per-test fixed reconciliation)
doctorCommissionPaisa:     { type: Number, default: 0 },   // == amountPaisa (consultant fee)
platformChargePaisa:       { type: Number, default: 0 },   // == admin revenue (replaces platformCut/adminShare semantics)
totalCutPaisa:             { type: Number, default: 0 },   // doctorCommission + platformCharge (facility owes)
```
(`amountPaisa`, `totalBillPaisa`, `deductionPercentage`, `commissionPercentage` remain;
`adminSharePaisa` == `platformChargePaisa` and is always ≥ 0.)

### 4.5 `WeeklySettlement` / `LabSettlement`

```js
deductionPercentage:          { type: Number },             // make OPTIONAL (no single % per doctor)
doctorCommissionTotalPaisa:   { type: Number, default: 0 }, // Σ doctorCommission
platformChargeTotalPaisa:     { type: Number, default: 0 }, // Σ platformCharge (== calculatedPlatformCutPaisa)
facilityTotalPayablePaisa:    { type: Number, default: 0 }, // doctorCommissionTotal + platformChargeTotal
// consultantPayouts[] subdoc: add commissionType + fixedCommissionPaisa for display badges
```

---

## 5. Calculation engine — `services/commissionService.js` (new, pure, no DB writes)

```js
// Hospital — per referral
computeHospitalSplit({ billPaisa, consultant, settings, facilityOverride }) → {
  doctorCommissionPaisa, platformChargePaisa, totalCutPaisa, facilityKeepsPaisa, ...snapshot
}

// Lab — per test
computeLabSplit({ tests /* [{amountPaisa}] */, discountPercentage, consultant, settings, facilityOverride }) → {
  doctorCommissionPaisa, platformChargePaisa, totalCutPaisa, testCount, ...snapshot
}
```

Reference algorithm:

```js
const clampPct = (n) => Math.min(100, Math.max(0, Number(n) || 0));

// component = 'fixed' ? flat : round(base * pct/100)
function comp(type, fixedPaisa, pct, basePaisa) {
  return type === 'fixed'
    ? Math.max(0, Math.round(fixedPaisa || 0))
    : Math.round(basePaisa * clampPct(pct) / 100);
}

// Hospital
const bill = Math.max(0, Math.round(billPaisa || 0));
doctorCommission = comp(c.hospitalCommissionType, c.hospitalFixedCommissionPaisa, c.commissionPercentage, bill);
platformCharge   = resolveHospitalPlatform(consultant, facilityOverride, settings, bill);  // fixed/% via resolution order §2.3
totalCut = doctorCommission + platformCharge;

// Lab — iterate test line items
for (const t of tests) {
  const base = Math.max(0, Math.round(t.amountPaisa || 0));   // pre/post-discount: see §7 Q5
  doctorCommission += comp(c.labCommissionType, c.labFixedCommissionPaisaPerTest, c.labCommissionPercentage, base);
  platformCharge   += comp(labPlatType, labPlatFixedPerTest,                       labPlatPct,                base);
}
testCount = tests.length;
totalCut  = doctorCommission + platformCharge;
```

`adminShare == platformCharge` (always ≥ 0). Also export `rupeesToPaisa`, `clampPct`.

---

## 6. Refactor the math sites onto the engine

| File | Change |
|---|---|
| `services/billingService.js` `finalizeAdmission` | replace inline nested split with `computeHospitalSplit`; write new snapshot fields + `totalCutPaisa`. Make the no-bill guard mode-aware (fixed may finalize without a bill). |
| `services/labBillingService.js` `finalizeLabReferral` | replace inline split with `computeLabSplit` over `services[]`; keep discount logic. |
| `controllers/settlementController.js` `listPendingAdmissions` | **stop** recomputing `bill × deduction%`; read the `Payout` snapshot so preview == final. |
| `controllers/labSettlementController.js` `listPendingReferrals` | same fix from `LabPayout` snapshot. |
| `controllers/settlementController.js` / `labSettlementController.js` `createSettlement` | aggregate from snapshots: `doctorCommissionTotal = Σ doctorCommissionPaisa`, `platformChargeTotal = Σ platformChargePaisa`, `facilityTotalPayable = sum`. **Stop** reading live `consultant.commissionPercentage`. |

---

## 7. Open questions to confirm with the stakeholder

1. **Per-doctor global, or per-doctor × facility?** A doctor refers to many facilities;
   the platform charge is "finalized with the hospital/lab." Model as a per-doctor default
   with an optional per-facility override (§4.1)? (Recommended.)
2. **Lab "per test" source:** is each `services[]` line one test (count = `services.length`),
   or should per-test reference the structured `testCatalog`? Free-text lines can be bundled.
3. **Volume:** confirm it is **admin-set per doctor** (manual), not an automatic threshold tier.
4. **Hospital platform-charge type:** examples are fixed-only — also allow `percentage`
   (kept for flexibility), defaulting to fixed?
5. **% basis vs discount (lab):** for `percentage` per test, is it % of the test price
   **before** or **after** the consultant's patient discount?
6. **Fixed semantics:** confirm hospital fixed commission ignores the bill entirely, and
   lab fixed commission/platform multiply by **test count**.
7. **Who pays "Total Bill":** the **facility** pays the platform `doctorCommission +
   platformCharge`; the platform forwards the commission to the doctor and keeps the
   platform charge (standard additive settlement). Confirm.

---

## 8. Migration / rollout

1. Schema deploy — additive fields with defaults; existing doctors read as `percentage`
   with `fixed = 0`, platform charge falling back to the facility/platform default.
2. **⚠ Behavior change (not a no-op):** old `commissionPercentage` meant "% of the platform
   cut"; it now means "% of the **bill**." And the platform charge moves from the facility
   to the doctor. Ship defaults, then have the admin **review** each doctor's commission %
   and set per-doctor platform charges. No reliable blind auto-conversion.
3. In-flight settlements unaffected (they sum immutable snapshots).
4. Feature is invisible until an admin sets a non-default per-doctor value.
5. Rollback — fields are additive; reverting the engine leaves data intact.

---

## 9. Files touched (build checklist)

**New:** `services/commissionService.js`, `tests/commissionService.test.js`.

**Models:** `Consultant.js`, `PlatformSettings.js`, `Payout.js`, `LabPayout.js`,
`WeeklySettlement.js`, `LabSettlement.js` (`Hospital.js`/`Laboratory.js` only comment the demotion).

**Services:** `billingService.js`, `labBillingService.js`.

**Controllers:** `settlementController.js`, `labSettlementController.js`,
`adminController.js` (per-doctor commission + platform charge setters, platform settings),
`labAdminController.js`.

**Frontend:** `pages/admin/AdminConsultants.jsx` (per-doctor: hospital + lab blocks, each
commission + platform-charge toggle, with the doctor's referral-volume shown),
`AdminSettings.jsx` (defaults); displays on `HospitalSettlements.jsx`,
`admin/AdminSettlements.jsx`, `ConsultantEarnings.jsx`, `lab/LabSettlements.jsx`
(headline **Total Payable** = commission Σ + platform Σ, per-doctor rows with type badges).
</content>
</invoke>
