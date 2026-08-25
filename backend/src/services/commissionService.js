/**
 * commissionService — the single source of truth for splitting a finalized bill into
 * the doctor (consultant) commission and the platform charge (admin revenue).
 *
 * Two modes, selected per-doctor by `consultant.commissionModel`:
 *
 *   'legacy'  (default) — the original NESTED model, preserved EXACTLY so nothing
 *                         changes for existing doctors until an admin opts them in:
 *                            platformCut       = bill * facility.deductionPercentage
 *                            doctorCommission  = platformCut * consultant.commissionPercentage
 *                            platformCharge    = platformCut - doctorCommission   (admin keeps)
 *                            facility owes (totalCut) = platformCut
 *
 *   'additive' (v2)     — the per-doctor ADDITIVE model (COMMISSION_SYSTEM_V2_PER_DOCTOR.md):
 *                            doctorCommission  = % of bill  OR  fixed (per referral / per test)
 *                            platformCharge    = % of bill  OR  fixed (per referral / per test)
 *                            facility owes (totalCut) = doctorCommission + platformCharge
 *                         Admin always keeps the FULL platformCharge (never negative; no subsidy).
 *
 * The unifying identity holds in BOTH modes:
 *
 *      totalCut === doctorCommission + platformCharge
 *
 * so every downstream snapshot/settlement aggregation is mode-agnostic.
 *
 * Money is always paisa (integers). Rounding happens here; callers never re-round.
 */

const DEFAULT_DEDUCTION_PCT = 20; // facility platform cut (legacy fallback)
const DEFAULT_COMMISSION_PCT = 60; // consultant share of platform cut (legacy fallback)

/** Clamp a percentage to [0, 100]; non-numeric -> 0. */
const clampPct = (n) => Math.min(100, Math.max(0, Number(n) || 0));

/** Coerce to a non-negative integer paisa value. */
const toPaisaInt = (n) => Math.max(0, Math.round(Number(n) || 0));

/** Convert a rupee amount (admin UI boundary) to integer paisa. Negatives/NaN -> 0. */
const rupeesToPaisa = (rupees) => {
  const n = Number(rupees);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
};

/** True when this doctor has been explicitly migrated to the additive v2 model. */
const isAdditive = (consultant) => !!consultant && consultant.commissionModel === 'additive';

/**
 * One additive component (doctor commission OR platform charge) on a base amount.
 * @param {'percentage'|'fixed'} type
 * @param {number} fixedPaisa  flat amount when type === 'fixed'
 * @param {number} pct         percentage when type === 'percentage'
 * @param {number} basePaisa   the bill (hospital) or per-test price (lab) to apply % to
 */
const component = (type, fixedPaisa, pct, basePaisa) =>
  type === 'fixed'
    ? toPaisaInt(fixedPaisa)
    : Math.round(toPaisaInt(basePaisa) * (clampPct(pct) / 100));

/**
 * Look up this consultant's platform-charge override for a specific facility, if the admin has
 * set one (consultant.facilityPlatformOverrides[]). Returns null when there is no override, so
 * callers fall back to the facility's own platform charge. This is the ONLY thing that varies
 * the platform fee per consultant — the doctor's commission is never affected.
 * @returns {{ type:'percentage'|'fixed', fixedPaisa:number, pct:number } | null}
 */
const findFacilityOverride = (scope, consultant, facility) => {
  const facilityId = facility && facility._id ? String(facility._id) : null;
  const overrides = Array.isArray(consultant?.facilityPlatformOverrides)
    ? consultant.facilityPlatformOverrides
    : [];
  const ov = overrides.find(
    (o) => o && o.facilityType === scope && facilityId && String(o.facilityId) === facilityId && o.platformChargeType
  );
  if (!ov) return null;
  return {
    type: ov.platformChargeType,
    fixedPaisa: ov.fixedPlatformChargePaisa || 0,
    pct: ov.platformChargePercentage || 0,
  };
};

/**
 * Resolve the platform charge (facility → admin) for one referral. The charge is owned by the
 * FACILITY (Hospital/Laboratory), which the admin sets to ONE type — percentage OR fixed —
 * applied to every referral at that facility regardless of the consultant. Resolution order:
 *   1. per-doctor × this-facility override (consultant.facilityPlatformOverrides[]) — e.g. a
 *      higher charge negotiated for a high-volume doctor (forces its own type+value).
 *   2. the facility's chosen platform charge: `platformChargeType` selects percentage of the
 *      bill OR a flat fee (hospital = per referral, lab = per test).
 * @returns {{ type:'percentage'|'fixed', fixedPaisa:number, pct:number }}
 */
const resolvePlatformCharge = (scope, consultant, facility, settings) => {
  const ov = findFacilityOverride(scope, consultant, facility);
  if (ov) return ov;

  const fallbackPct =
    (scope === 'lab' ? settings?.defaultLabDeductionPercentage : settings?.defaultHospitalDeductionPercentage) ??
    DEFAULT_DEDUCTION_PCT;

  return {
    type: facility?.platformChargeType || 'percentage',
    fixedPaisa:
      scope === 'lab' ? (facility?.fixedPlatformChargePaisaPerTest || 0) : (facility?.fixedPlatformChargePaisa || 0),
    pct: facility?.deductionPercentage ?? fallbackPct,
  };
};

/** Shape returned by both split functions (paisa). */
const makeResult = (o) => ({
  doctorCommissionPaisa: o.doctorCommissionPaisa,
  platformChargePaisa: o.platformChargePaisa,
  totalCutPaisa: o.doctorCommissionPaisa + o.platformChargePaisa,
  facilityKeepsPaisa: o.billPaisa - (o.doctorCommissionPaisa + o.platformChargePaisa),
  billPaisa: o.billPaisa,
  testCount: o.testCount || 0,
  // ── snapshot of the applied deal ──
  commissionModel: o.commissionModel,
  commissionType: o.commissionType,
  commissionPercentage: o.commissionPercentage,
  fixedCommissionPaisa: o.fixedCommissionPaisa || 0,
  platformChargeType: o.platformChargeType,
  platformChargePercentage: o.platformChargePercentage,
  fixedPlatformChargePaisa: o.fixedPlatformChargePaisa || 0,
  deductionPercentage: o.deductionPercentage || 0,
  // ── legacy-compatible mirror fields (so existing reads/UIs keep working) ──
  platformCutPaisa: o.platformCutPaisa, // legacy "platform cut"; == platformCharge in additive
  adminSharePaisa: o.platformChargePaisa, // admin keeps the full platform charge (>= 0)
});

/**
 * Hospital admission split (per referral).
 * @param {{ billPaisa:number, consultant:object, hospital:object, settings:object }} args
 */
const computeHospitalSplit = ({ billPaisa, consultant, hospital, settings }) => {
  const bill = toPaisaInt(billPaisa);

  if (!isAdditive(consultant)) {
    // ── LEGACY (nested) — byte-for-byte the original billingService math ──
    const deductionPercentage = (hospital && hospital.deductionPercentage) || (settings?.defaultHospitalDeductionPercentage ?? DEFAULT_DEDUCTION_PCT);
    const commissionPercentage = (consultant && consultant.commissionPercentage) || (settings?.defaultConsultantCommissionPercentage ?? DEFAULT_COMMISSION_PCT);
    const platformCutPaisa = Math.round(bill * (deductionPercentage / 100));
    const doctorCommissionPaisa = Math.round(platformCutPaisa * (commissionPercentage / 100));

    // Per-consultant platform-fee override: the admin has set a special platform fee for this
    // doctor at this hospital. It changes ONLY the platform charge (admin revenue) and therefore
    // the hospital's total — the doctor's nested commission above is preserved exactly. The case
    // becomes additive-shaped (facility owes commission + platform fee). Without an override the
    // math is byte-for-byte the original nested split.
    const override = findFacilityOverride('hospital', consultant, hospital);
    if (override) {
      const platformChargePaisa = component(override.type, override.fixedPaisa, override.pct, bill);
      return makeResult({
        billPaisa: bill,
        doctorCommissionPaisa,
        platformChargePaisa,
        platformCutPaisa: platformChargePaisa, // additive-shaped mirror == admin revenue
        commissionModel: 'legacy',
        commissionType: 'percentage',
        commissionPercentage,
        platformChargeType: override.type,
        platformChargePercentage: override.type === 'percentage' ? clampPct(override.pct) : 0,
        fixedPlatformChargePaisa: override.type === 'fixed' ? toPaisaInt(override.fixedPaisa) : 0,
        deductionPercentage: override.type === 'percentage' ? clampPct(override.pct) : 0,
      });
    }

    const platformChargePaisa = platformCutPaisa - doctorCommissionPaisa;
    return makeResult({
      billPaisa: bill,
      doctorCommissionPaisa,
      platformChargePaisa,
      platformCutPaisa, // legacy: facility owes the platform cut (== commission + charge)
      commissionModel: 'legacy',
      commissionType: 'percentage',
      commissionPercentage,
      platformChargeType: 'percentage',
      platformChargePercentage: 0,
      deductionPercentage,
    });
  }

  // ── ADDITIVE (v2, per referral) ──
  const cType = consultant.hospitalCommissionType || 'percentage';
  const cPct = consultant.hospitalCommissionPercentage ?? 0;
  const cFix = consultant.hospitalFixedCommissionPaisa || 0;
  const doctorCommissionPaisa = component(cType, cFix, cPct, bill);

  // Platform charge = the hospital's single chosen type (percentage of bill OR fixed per referral).
  const plat = resolvePlatformCharge('hospital', consultant, hospital, settings);
  const platformChargePaisa = component(plat.type, plat.fixedPaisa, plat.pct, bill);

  return makeResult({
    billPaisa: bill,
    doctorCommissionPaisa,
    platformChargePaisa,
    platformCutPaisa: platformChargePaisa, // additive: legacy mirror == admin revenue
    commissionModel: 'additive',
    commissionType: cType,
    commissionPercentage: cType === 'percentage' ? clampPct(cPct) : 0,
    fixedCommissionPaisa: cType === 'fixed' ? toPaisaInt(cFix) : 0,
    platformChargeType: plat.type,
    platformChargePercentage: plat.type === 'percentage' ? clampPct(plat.pct) : 0,
    fixedPlatformChargePaisa: plat.type === 'fixed' ? toPaisaInt(plat.fixedPaisa) : 0,
    deductionPercentage: plat.type === 'percentage' ? clampPct(plat.pct) : 0,
  });
};

/**
 * Lab referral split. Legacy = nested on the discounted bill. Additive = per-test.
 * @param {{ tests:Array<{amountPaisa:number}>, discountPercentage:number,
 *           consultant:object, lab:object, settings:object }} args
 */
const computeLabSplit = ({ tests, discountPercentage, consultant, lab, settings }) => {
  const lines = Array.isArray(tests) ? tests : [];
  const gross = lines.reduce((sum, t) => sum + toPaisaInt(t && t.amountPaisa), 0);
  const discountPct = clampPct(discountPercentage);
  const discountAmt = Math.round(gross * (discountPct / 100));
  const billTotal = Math.max(0, gross - discountAmt);

  if (!isAdditive(consultant)) {
    // ── LEGACY (nested) — byte-for-byte the original labBillingService math ──
    const deductionPercentage = (lab && lab.deductionPercentage) || (settings?.defaultLabDeductionPercentage ?? DEFAULT_DEDUCTION_PCT);
    const commissionPercentage = (consultant && consultant.commissionPercentage) || (settings?.defaultLabCommissionPercentage ?? DEFAULT_COMMISSION_PCT);
    const platformCutPaisa = Math.round(billTotal * (deductionPercentage / 100));
    const doctorCommissionPaisa = Math.round(platformCutPaisa * (commissionPercentage / 100));

    // Per-consultant platform-fee override (per test): changes ONLY the platform charge for this
    // doctor at this lab; the nested doctor commission above is preserved exactly. Without an
    // override the math is byte-for-byte the original nested split.
    const override = findFacilityOverride('lab', consultant, lab);
    if (override) {
      const discFactor = 1 - discountPct / 100;
      let platformChargePaisa = 0;
      for (const t of lines) {
        const base = Math.round(toPaisaInt(t && t.amountPaisa) * discFactor); // discounted line price
        platformChargePaisa += component(override.type, override.fixedPaisa, override.pct, base);
      }
      return makeResult({
        billPaisa: billTotal,
        doctorCommissionPaisa, // nested, unchanged
        platformChargePaisa,
        platformCutPaisa: platformChargePaisa, // additive-shaped mirror == admin revenue
        testCount: lines.length,
        commissionModel: 'legacy',
        commissionType: 'percentage',
        commissionPercentage,
        platformChargeType: override.type,
        platformChargePercentage: override.type === 'percentage' ? clampPct(override.pct) : 0,
        fixedPlatformChargePaisa: override.type === 'fixed' ? toPaisaInt(override.fixedPaisa) : 0,
        deductionPercentage: override.type === 'percentage' ? clampPct(override.pct) : 0,
      });
    }

    const platformChargePaisa = platformCutPaisa - doctorCommissionPaisa;
    return makeResult({
      billPaisa: billTotal,
      doctorCommissionPaisa,
      platformChargePaisa,
      platformCutPaisa,
      testCount: lines.length,
      commissionModel: 'legacy',
      commissionType: 'percentage',
      commissionPercentage,
      platformChargeType: 'percentage',
      platformChargePercentage: 0,
      deductionPercentage,
    });
  }

  // ── ADDITIVE (v2, per test) ──
  const cType = consultant.labCommissionType || 'percentage';
  const cPct = consultant.labCommissionPercentage ?? 0;
  const cFix = consultant.labFixedCommissionPaisaPerTest || 0;
  // Platform charge per test = the lab's single chosen type (percentage OR fixed per test).
  const plat = resolvePlatformCharge('lab', consultant, lab, settings);
  const discFactor = 1 - discountPct / 100;

  let doctorCommissionPaisa = 0;
  let platformChargePaisa = 0;
  for (const t of lines) {
    const base = Math.round(toPaisaInt(t && t.amountPaisa) * discFactor); // discounted line price
    doctorCommissionPaisa += component(cType, cFix, cPct, base);
    platformChargePaisa += component(plat.type, plat.fixedPaisa, plat.pct, base);
  }

  return makeResult({
    billPaisa: billTotal,
    doctorCommissionPaisa,
    platformChargePaisa,
    platformCutPaisa: platformChargePaisa,
    testCount: lines.length,
    commissionModel: 'additive',
    commissionType: cType,
    commissionPercentage: cType === 'percentage' ? clampPct(cPct) : 0,
    fixedCommissionPaisa: cType === 'fixed' ? toPaisaInt(cFix) : 0,
    platformChargeType: plat.type,
    platformChargePercentage: plat.type === 'percentage' ? clampPct(plat.pct) : 0,
    fixedPlatformChargePaisa: plat.type === 'fixed' ? toPaisaInt(plat.fixedPaisa) : 0,
    deductionPercentage: plat.type === 'percentage' ? clampPct(plat.pct) : 0,
  });
};

module.exports = {
  computeHospitalSplit,
  computeLabSplit,
  rupeesToPaisa,
  clampPct,
  toPaisaInt,
  isAdditive,
  findFacilityOverride,
  DEFAULT_DEDUCTION_PCT,
  DEFAULT_COMMISSION_PCT,
};
