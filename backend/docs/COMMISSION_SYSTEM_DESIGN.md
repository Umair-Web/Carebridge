# Dual Commission System — Percentage & Fixed Price

**Status:** Design (not yet implemented)
**Author:** Design draft for CareBridge
**Scope:** Hospitals, Consultants, Laboratories — payout calculation & settlement
**Last updated:** 2026-06-28

---

## 1. Purpose

Today every payout on CareBridge is calculated as a **percentage** of the patient
bill. This document specifies adding a second, parallel **fixed-price-per-referral**
model that the admin can enable **per individual party** (a specific hospital, a
specific consultant, a specific lab), while **percentage remains the default**.

The goal: some hospitals/consultants/labs are commercially negotiated as a
percentage split, others as a flat fee per referral. The platform must support
both side by side, switchable from the admin panel, with a complete and honest
audit trail.

### Confirmed product decisions (from stakeholder)

1. **Admin absorbs shortfalls.** A consultant's fixed fee is always paid in full,
   even if it exceeds the platform cut collected from the facility. The admin
   share may go **negative** (platform subsidizes that referral). Negative admin
   share is recorded and surfaced as a "platform subsidy", never silently hidden.
2. **Consultant has two independent deals** — one for **hospital** referrals and a
   separate one for **lab** referrals. Each is independently percentage *or* fixed.
3. **Both values are always stored.** The `type` flag only selects which stored
   value (`percentage` or `fixed`) is active. Switching modes never erases the
   other number.

---

## 2. Current system (baseline)

### 2.1 The split chain

Money moves **only at finalization** — when a hospital admission is billed
(`billingService.finalizeAdmission`) or a lab referral is closed
(`labBillingService.finalizeLabReferral`). The split is a **two-stage nested chain**:

```
Patient Bill (billTotalPaisa)
   │
   ├─►  Platform Cut   = Bill × facility.deductionPercentage      (default 20%)
   │         │
   │         ├─►  Consultant Share = Platform Cut × consultant.commissionPercentage  (default 60%)
   │         └─►  Admin Share      = Platform Cut − Consultant Share
   │
   └─►  Facility keeps = Bill − Platform Cut
```

Worked example — Bill Rs 10,000:

| Party | Amount | Formula |
|---|---|---|
| Platform Cut | Rs 2,000 | 20% × 10,000 |
| Consultant | Rs 1,200 | 60% × 2,000 |
| Admin | Rs 800 | 2,000 − 1,200 |
| Hospital keeps | Rs 8,000 | 10,000 − 2,000 |

> **Money is stored in paisa** everywhere (1 PKR = 100 paisa).

### 2.2 Where the math lives today (duplication — a key risk)

The same split is computed in **four** places. Any new model must unify these or
they will drift:

| Location | What it does |
|---|---|
| `services/billingService.js` (`finalizeAdmission`) | Hospital case → writes `Payout` |
| `services/labBillingService.js` (`finalizeLabReferral`) | Lab case → writes `LabPayout` (subtracts consultant discount first) |
| `controllers/settlementController.js` (`listPendingAdmissions`) | **Preview** recompute `calculatedPlatformCutPaisa = bill × deduction%/100` |
| `controllers/labSettlementController.js` (preview) | Lab equivalent of the same preview recompute |

The first two write the authoritative numbers into `Payout`/`LabPayout`. The
settlement layer then **sums those snapshots** (good — it does not recompute the
split), **except** the two preview spots above which recompute from `%` and
**will break under fixed pricing**.

### 2.3 Where rates are stored & edited today

| Field | Model | Default | Admin endpoint |
|---|---|---|---|
| `deductionPercentage` | `Hospital` | 20 | `adminUpdateHospitalDeduction` |
| `deductionPercentage` | `Laboratory` | 20 | `labAdminController.updateLab` |
| `commissionPercentage` | `Consultant` | 60 | `adminUpdateConsultantCommission` |
| `defaultHospitalDeductionPercentage` | `PlatformSettings` | 20 | `updatePlatformSettings` |
| `defaultConsultantCommissionPercentage` | `PlatformSettings` | 60 | `updatePlatformSettings` |
| `defaultLabDeductionPercentage` | `PlatformSettings` | 20 | `updatePlatformSettings` |
| `defaultLabCommissionPercentage` | `PlatformSettings` | 60 | `updatePlatformSettings` |

> **Important asymmetry:** the consultant's single `commissionPercentage` is used
> for **both** hospital and lab payouts today. The new model splits this into two
> independent deals (see §4.3).

---

## 3. Target model — per-party mode toggle

Two **independent** switches, each `percentage` (default) or `fixed`:

- **Facility side** (hospital *or* lab) decides the **Platform Cut**.
- **Consultant side** decides the **Consultant Share** (separately for hospital vs lab).
- **Admin Share = Platform Cut − Consultant Share** (unchanged formula; may be negative).

The nested chain structure is **unchanged** — only *how each of the two numbers
is produced* changes.

### 3.1 Combination matrix (hospital example, Bill = B)

| Facility mode | Consultant mode | Platform Cut | Consultant Share | Admin Share |
|---|---|---|---|---|
| % (d) | % (c) | B × d | Cut × c | Cut − Consultant |
| % (d) | Fixed F | B × d | F | Cut − F |
| Fixed P | % (c) | P | P × c | P − Consultant |
| Fixed P | Fixed F | P | F | P − F |

### 3.2 Worked examples (Bill Rs 10,000)

| Facility deal | Consultant deal | Platform cut | Consultant | Admin | Facility keeps |
|---|---|---|---|---|---|
| 20% | 60% | 2,000 | 1,200 | 800 | 8,000 |
| Fixed 1,500 | 60% | 1,500 | 900 | 600 | 8,500 |
| 20% | Fixed 1,000 | 2,000 | 1,000 | 1,000 | 8,000 |
| Fixed 1,500 | Fixed 1,000 | 1,500 | 1,000 | 500 | 8,500 |
| 20% | Fixed 3,000 | 2,000 | 3,000 | **−1,000** (subsidy) | 8,000 |

---

## 4. Data model changes

All new fields **default to today's percentage behavior**, so existing records and
in-flight settlements are unaffected (see §9 migration).

### 4.1 `Hospital`

```js
commissionType:        { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
deductionPercentage:   { type: Number, default: 20 },   // EXISTING — kept
fixedDeductionPaisa:   { type: Number, default: 0, min: 0 },  // NEW — flat platform cut per admission
```

### 4.2 `Laboratory`

```js
commissionType:        { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
deductionPercentage:   { type: Number, default: 20 },   // EXISTING — kept
fixedDeductionPaisa:   { type: Number, default: 0, min: 0 },  // NEW — flat platform cut per lab referral
```

### 4.3 `Consultant` (two independent deals)

```js
// ── Hospital deal (reuses existing commissionPercentage as the % value) ──
hospitalCommissionType:       { type: String, enum: ['percentage','fixed'], default: 'percentage' },
commissionPercentage:         { type: Number, default: 60 },  // EXISTING — kept (= hospital %)
hospitalFixedCommissionPaisa: { type: Number, default: 0, min: 0 },  // NEW

// ── Lab deal ──
labCommissionType:            { type: String, enum: ['percentage','fixed'], default: 'percentage' },
labCommissionPercentage:      { type: Number, default: 60 },  // NEW (migrates from commissionPercentage)
labFixedCommissionPaisa:      { type: Number, default: 0, min: 0 },  // NEW
```

> Rationale for reusing `commissionPercentage` as the hospital `%`: zero data
> migration risk for the most common field, and `getConsultantEarnings`/admin
> overview already read it. `labCommissionPercentage` is seeded from it on
> migration so behavior is identical until the admin changes it.

### 4.4 `PlatformSettings` — defaults for new sign-ups

```js
// Hospital facility default
defaultHospitalCommissionType:        { type: String, enum: ['percentage','fixed'], default: 'percentage' },
defaultHospitalDeductionPercentage:   { type: Number, default: 20 },   // EXISTING
defaultHospitalFixedDeductionPaisa:   { type: Number, default: 0 },    // NEW

// Lab facility default
defaultLabCommissionType:             { type: String, enum: ['percentage','fixed'], default: 'percentage' },
defaultLabDeductionPercentage:        { type: Number, default: 20 },   // EXISTING
defaultLabFixedDeductionPaisa:        { type: Number, default: 0 },    // NEW

// Consultant — hospital deal default
defaultConsultantHospitalCommissionType:  { type: String, enum: ['percentage','fixed'], default: 'percentage' },
defaultConsultantCommissionPercentage:    { type: Number, default: 60 },  // EXISTING (hospital %)
defaultConsultantHospitalFixedPaisa:      { type: Number, default: 0 },   // NEW

// Consultant — lab deal default
defaultConsultantLabCommissionType:   { type: String, enum: ['percentage','fixed'], default: 'percentage' },
defaultLabCommissionPercentage:       { type: Number, default: 60 },   // EXISTING (lab %)
defaultConsultantLabFixedPaisa:       { type: Number, default: 0 },    // NEW
```

### 4.5 Snapshot fields (audit integrity)

The whole point of `Payout`/`LabPayout`/settlement records is to **freeze** the
deal that applied at finalization. They must record **which mode** was used, not
just the resulting amount.

`Payout` — add:
```js
facilityCommissionType:   { type: String, enum: ['percentage','fixed'], default: 'percentage' },
fixedDeductionPaisa:      { type: Number, default: 0 },
consultantCommissionType: { type: String, enum: ['percentage','fixed'], default: 'percentage' },
fixedCommissionPaisa:     { type: Number, default: 0 },
adminSubsidyPaisa:        { type: Number, default: 0 },   // = max(0, -adminShare); >0 means platform subsidized
```
(`deductionPercentage`, `commissionPercentage`, `platformCutPaisa`,
`amountPaisa`, `adminSharePaisa` already exist and remain.)

`LabPayout` — same additions.

`WeeklySettlement.consultantPayouts[]` & `LabSettlement.consultantPayouts[]` — add:
```js
commissionType:       { type: String, enum: ['percentage','fixed'], default: 'percentage' },
fixedCommissionPaisa: { type: Number, default: 0 },
```
(`commissionPercentage` and `amountPaisa` already exist.)

> **`adminSharePaisa` must allow negatives.** Any `min: 0` constraint on admin
> share in schemas/aggregations must be removed for the subsidy case. Consultant
> `amountPaisa` stays `min: 0` (a payout is never negative; the existing negative
> withdrawal hack is unaffected — see §8.5).

---

## 5. The single calculation engine

New module: **`services/commissionService.js`**. **All** split math routes through it.

```js
/**
 * @param {object}  args
 * @param {number}  args.billPaisa      Finalized bill (after lab discount, if any).
 * @param {object}  args.facility       Hospital or Laboratory doc.
 * @param {object}  args.consultant     Consultant doc.
 * @param {'hospital'|'lab'} args.scope Which consultant deal applies.
 * @param {object}  args.settings       PlatformSettings (for fallbacks).
 * @returns {object} full breakdown + snapshot fields.
 */
function computeSplit({ billPaisa, facility, consultant, scope, settings }) { ... }
```

Returns:
```js
{
  platformCutPaisa,        // facility → platform
  consultantSharePaisa,    // platform → consultant
  adminSharePaisa,         // platform retains (may be < 0)
  adminSubsidyPaisa,       // max(0, -adminSharePaisa)
  facilityKeepsPaisa,      // bill − platformCut

  // snapshot of the applied deal:
  facilityCommissionType, deductionPercentage, fixedDeductionPaisa,
  consultantCommissionType, commissionPercentage, fixedCommissionPaisa,
}
```

### 5.1 Reference algorithm

```js
const bill = Math.max(0, Math.round(billPaisa || 0));

// ── Facility side → Platform Cut ──
const fType = facility.commissionType
  || (scope === 'lab' ? settings?.defaultLabCommissionType : settings?.defaultHospitalCommissionType)
  || 'percentage';
let platformCut;
if (fType === 'fixed') {
  platformCut = Math.max(0, Math.round(facility.fixedDeductionPaisa || 0));
  // NOTE: not capped to the bill — honors the negotiated flat fee (see §6.2).
} else {
  const d = facility.deductionPercentage ?? defaultFacilityPct(scope, settings) ?? 20;
  platformCut = Math.round(bill * (clampPct(d) / 100));
}

// ── Consultant side → Consultant Share ──
const cType = (scope === 'lab' ? consultant.labCommissionType : consultant.hospitalCommissionType)
  || 'percentage';
let consultantShare;
if (cType === 'fixed') {
  consultantShare = Math.max(0, Math.round(
    scope === 'lab' ? consultant.labFixedCommissionPaisa : consultant.hospitalFixedCommissionPaisa
  ));
  // Paid in full even if > platformCut (admin absorbs — decision #1).
} else {
  const c = (scope === 'lab' ? consultant.labCommissionPercentage : consultant.commissionPercentage)
            ?? defaultConsultantPct(scope, settings) ?? 60;
  consultantShare = Math.round(platformCut * (clampPct(c) / 100));
}

const adminShare = platformCut - consultantShare;       // may be negative
const adminSubsidy = Math.max(0, -adminShare);
```

Helpers: `clampPct(n)` → bound to `[0,100]`; `defaultFacilityPct`/
`defaultConsultantPct` → pick the right `PlatformSettings` default by scope.

### 5.2 Rounding rule (single source)

- Percentage math uses `Math.round` at **each** stage (matches current code).
- Apply rounding **inside** `computeSplit` only; callers never re-round.
- `adminShare` is computed by **subtraction** (`platformCut − consultantShare`),
  never independently rounded, so the three shares always reconcile exactly:
  `consultantShare + adminShare === platformCut` (subsidy case: still exact, admin negative).

### 5.3 Callers to refactor onto the engine

1. `billingService.finalizeAdmission` → `computeSplit({ scope: 'hospital' })`.
2. `labBillingService.finalizeLabReferral` → `computeSplit({ scope: 'lab' })`
   (pass `billPaisa = gross − discount`, unchanged discount logic).
3. `settlementController.listPendingAdmissions` preview → use the engine (or read
   the already-accrued `Payout.platformCutPaisa`) instead of `bill × deduction%`.
4. `labSettlementController` preview → same.

---

## 6. Edge cases & loopholes (exhaustive)

### 6.1 Consultant fixed fee > platform cut → negative admin share
**Decision:** pay in full, admin absorbs. `adminSharePaisa` negative;
`adminSubsidyPaisa = −adminShare`. **Loophole guard:** every aggregation that
sums admin revenue (`adminController` overview, reports, exports) must use signed
arithmetic and **display subsidies distinctly** (e.g. red "−Rs X subsidy"), never
`Math.abs` or `min:0` which would inflate platform revenue.

### 6.2 Facility fixed fee > bill (tiny/zero bill)
A flat platform fee can exceed a small bill, so `facilityKeeps = bill − platformCut`
goes **negative** (facility owes the platform more than it billed the patient).
**Decision:** honor the flat fee (not capped). **Guards:**
- This is only reachable if an admin sets a flat facility fee larger than typical
  bills — surface a soft warning in the admin UI ("flat fee exceeds typical bill").
- The settlement the facility owes (`calculatedPlatformCutPaisa`) is still the flat
  fee; the facility-keeps figure is informational only and may be shown negative.
- *Alternative if undesirable later:* `platformCut = min(fixed, bill)`. Documented
  here so the choice is explicit and reversible in one line of the engine.

### 6.3 Zero bill / bill not yet entered
If `billTotalPaisa` is 0 or null at finalization: percentage mode → all shares 0;
fixed mode → platformCut/consultantShare = the flat fees (subsidy likely). Existing
finalize guards already block closing without a bill (hospital admission requires
`billTotalPaisa`; lab requires `gross > 0` and a patient bill file) — **keep these**.
A fixed-fee facility with a legitimately small bill is allowed; a *zero* bill is not.

### 6.4 Mid-deal rate change (snapshot integrity)
An admin may change a party's deal **after** some cases were finalized but **before**
they are settled. **Guard:** the split is snapshotted into `Payout`/`LabPayout` at
finalization and the settlement **sums those snapshots** — it must **never**
recompute from the live entity. The two preview recomputations (§2.2) are the only
violators and are fixed in §5.3. Verify no other code recomputes from
`facility.deductionPercentage`/`consultant.*Percentage` at settlement time.

### 6.5 Mode flag set but value missing
e.g. `commissionType = 'fixed'` but `fixedDeductionPaisa = 0`. Engine treats it as
a 0 flat fee (valid: platform takes nothing). **Guard:** admin save validation
warns when switching to `fixed` with a 0 amount ("this party will be charged Rs 0
per referral — confirm").

### 6.6 Percentage out of range / non-numeric
All percentage inputs clamped to `[0,100]`; all paisa inputs coerced to
`Math.max(0, Math.round(Number(x)))`. Reject `NaN`/negative at the API with 400.

### 6.7 Fixed amount unit confusion (rupees vs paisa)
The admin UI shows **rupees** ("Rs 1,500 per referral"); the API/DB store **paisa**.
**Guard:** convert at the controller boundary (`× 100`), validate it's an integer
number of paisa, and label the input clearly. A single off-by-100 here silently
turns Rs 1,500 into Rs 15 — add a unit test for the conversion.

### 6.8 Lab discount interaction
The consultant's patient discount is subtracted from gross **before** the split
(unchanged). With a **fixed** lab platform fee, the discount no longer affects the
platform cut (it's flat) but still reduces what the patient pays and the lab keeps.
Confirm the order: `billPaisa = gross − discount` is passed to the engine; the flat
fee applies to that already-discounted bill conceptually but is bill-independent in
fixed mode. Document this in the lab payout `note` string.

### 6.9 Consultant scope leakage
A consultant spans both hospital and lab. **Guard:** `computeSplit` must receive the
correct `scope` and read the matching deal fields. A hospital admission must never
read `labFixedCommissionPaisa` and vice versa. Covered by explicit `scope` param +
tests for both paths.

### 6.10 Backward-compat with historical records
Old `Payout`/`LabPayout` rows lack the new snapshot fields. **Guard:** new fields
default such that old rows read as `percentage` with `fixed = 0`; display logic must
tolerate missing fields (`?? 'percentage'`, `?? 0`). No backfill of historical rows
required — their `amountPaisa`/`platformCutPaisa` are already authoritative.

### 6.11 Settlement preview vs final mismatch
`listPendingAdmissions` shows a **preview** platform cut. If it recomputes from `%`
while the actual `Payout` was fixed, the preview disagrees with the settled amount.
**Guard:** preview must read `Payout.platformCutPaisa` (the snapshot), or call the
engine with the same snapshot inputs — never `bill × live deduction%`.

### 6.12 Concurrency / double-finalize
Existing finalize functions are idempotent (`if (status === 'billed'/'closed') return`).
The engine is pure (no writes), so adding it doesn't change concurrency behavior.
Keep the idempotency guard ahead of `computeSplit`.

### 6.13 Negative numbers entering settlement sums
`WeeklySettlement.grossAmountPaisa` and `calculatedPlatformCutPaisa` have `min: 0`.
Platform cut stays ≥ 0 in all modes, so those are safe. But any **admin-revenue**
rollup must not assume per-case admin share ≥ 0 (see §6.1).

### 6.14 Withdrawal / wallet logic
`createWithdrawalRequest` and `consultantVerifyPayout` credit
`walletBalance/totalEarnings` from `amountPaisa`, which is always ≥ 0 regardless of
mode. No change needed; fixed mode just produces a different (still non-negative)
`amountPaisa`.

### 6.15 Default seeding for brand-new parties
Registration creates Hospital/Lab/Consultant without setting commission fields →
schema defaults apply (`percentage`, today's percentages). New `PlatformSettings`
defaults only affect parties created **after** an admin sets non-default platform
defaults; existing parties keep their stored values. Document that platform-default
changes are **not** retroactive.

---

## 7. Admin panel UX

Same control pattern in four places. Toggle reveals the relevant input; the
inactive field is preserved (decision #3).

```
Commission mode:  ( ● Percentage    ○ Fixed price )

   ── if Percentage ──            ── if Fixed ──
   [ 60 ] %                       Rs [ 1,500 ] per referral
```

| Page | Controls |
|---|---|
| `AdminHospitals` | One toggle: hospital platform-cut mode (% or flat). |
| `AdminLaboratory` | One toggle: lab platform-cut mode. |
| `AdminConsultants` | **Two** blocks: "Hospital referrals" deal + "Lab referrals" deal, each its own toggle. |
| `AdminSettings` | Four default blocks (hospital, lab, consultant-hospital, consultant-lab) for new sign-ups. |

UX guards: warn on fixed+0 (§6.5); warn on flat facility fee that exceeds a typical
bill (§6.2); show rupee input, store paisa (§6.7); show current effective mode as a
badge ("Fixed Rs 1,500/referral" or "60%").

---

## 8. API changes

### 8.1 `adminUpdateHospitalDeduction` (extend)
Accept `commissionType` and `fixedDeductionPaisa` (paisa) in addition to
`deductionPercentage`. Validate: type ∈ enum; percentage ∈ [0,100]; fixed ≥ 0
integer. Persist all; only `commissionType` decides active value.

### 8.2 `adminUpdateConsultantCommission` (extend)
Accept a `scope` (`hospital`|`lab`) **or** accept both deals in one payload:
`{ hospitalCommissionType, commissionPercentage, hospitalFixedCommissionPaisa,
labCommissionType, labCommissionPercentage, labFixedCommissionPaisa }`. Validate
each. (Prefer one combined endpoint to keep the two deals editable together.)

### 8.3 `labAdminController.updateLab` (extend)
Accept `commissionType`, `fixedDeductionPaisa` alongside existing
`deductionPercentage`, `maxConsultantDiscountPercentage`.

### 8.4 `updatePlatformSettings` (extend)
Accept the new default fields (§4.4). Same validation.

### 8.5 Audit logging
Each setter already writes an `AuditLog`. Extend `details` to include the new
fields (`commissionType`, fixed amounts) so deal changes are fully traceable.

---

## 9. Migration & rollout

1. **Schema deploy** — add fields with defaults. No write migration strictly
   required (defaults reproduce current behavior).
2. **Optional backfill script** (idempotent): for every `Consultant`, set
   `labCommissionPercentage = commissionPercentage` if unset, so the lab `%`
   exactly mirrors today. Set all `*CommissionType = 'percentage'`. (Mirrors the
   pattern of existing `scripts/` like `seedAdmin`, `cleanupLegacySeedHospitals`.)
3. **No settlement freeze needed** — in-flight settlements read snapshots; only
   the two preview recomputes change, and they become *more* correct.
4. **Feature is invisible until used** — every party stays `percentage` until an
   admin flips a toggle.
5. **Rollback** — fields are additive; reverting the engine to the old inline math
   leaves data intact (extra columns ignored).

---

## 10. Test plan

### 10.1 Unit — `commissionService.computeSplit` (Node built-in `node:test`)
Cover all 4 combinations × {hospital, lab} scope:
- %/%  → matches legacy numbers exactly (regression lock).
- %/fixed, fixed/%, fixed/fixed → table in §3.2.
- Subsidy case (consultant fixed > platform cut) → negative admin, correct subsidy.
- Facility fixed > bill → negative facility-keeps, platform cut = flat fee.
- Zero/var percentages, clamping, rounding reconciliation
  (`consultant + admin === platformCut`).
- Rupee→paisa conversion helper (off-by-100 guard).

### 10.2 Integration
- Finalize hospital admission in each mode → assert `Payout` snapshot fields.
- Finalize lab referral in each mode (with & without discount) → assert `LabPayout`.
- Create weekly settlement after fixed-mode finalizations → assert summed amounts
  equal snapshots, preview equals final.
- Admin overview revenue with a subsidy case → assert signed total, subsidy shown.

### 10.3 Manual / QA
- Toggle each party in admin UI, switch back and forth → both values retained.
- Rupee input stores correct paisa.
- Consultant hospital-deal vs lab-deal independent.

---

## 11. Files touched (implementation checklist — for the build phase)

**Models:** `Hospital.js`, `Laboratory.js`, `Consultant.js`, `PlatformSettings.js`,
`Payout.js`, `LabPayout.js`, `WeeklySettlement.js`, `LabSettlement.js`.

**New:** `services/commissionService.js`.

**Refactor:** `services/billingService.js`, `services/labBillingService.js`,
`controllers/settlementController.js` (preview), `controllers/labSettlementController.js` (preview).

**API:** `controllers/adminController.js` (hospital deduction, consultant commission,
platform settings), `controllers/labAdminController.js` (`updateLab`).

**Frontend:** `pages/admin/AdminHospitals.jsx`, `AdminLaboratory.jsx`,
`AdminConsultants.jsx`, `AdminSettings.jsx`; display labels on
`ConsultantEarnings.jsx`, `admin/AdminOverview.jsx`, `admin/AdminSettlements.jsx`,
`pages/HospitalSettlements.jsx`, lab settlement views.

**Script (optional):** `scripts/migrateCommissionDeals.js` (backfill, idempotent).

**Tests:** `tests/commissionService.test.js` (+ integration as feasible).

---

## 12. Open questions / future

- **Per-department or per-referral-type fixed fees?** Out of scope now; the engine
  signature (`scope`, full docs passed in) leaves room to extend without changing callers.
- **Tiered/min-max fixed (e.g. flat fee but min % floor)?** Not required; note that
  the "honor the deal" choices in §6.1/§6.2 are single-line reversible in the engine.
- **Retroactive platform-default application?** Currently no (§6.15). Add a one-off
  "apply defaults to all existing parties" admin action only if requested.
