const test = require('node:test');
const assert = require('node:assert');
const svc = require('../src/services/commissionService');

const settings = {
  defaultHospitalDeductionPercentage: 20,
  defaultConsultantCommissionPercentage: 60,
  defaultLabDeductionPercentage: 20,
  defaultLabCommissionPercentage: 60,
};

// ───────────────────────── helpers ─────────────────────────
test('rupeesToPaisa converts and guards', () => {
  assert.strictEqual(svc.rupeesToPaisa(1500), 150000);
  assert.strictEqual(svc.rupeesToPaisa('1500'), 150000);
  assert.strictEqual(svc.rupeesToPaisa(0), 0);
  assert.strictEqual(svc.rupeesToPaisa(-5), 0);
  assert.strictEqual(svc.rupeesToPaisa('abc'), 0);
  assert.strictEqual(svc.rupeesToPaisa(15.5), 1550);
});

test('clampPct bounds to [0,100]', () => {
  assert.strictEqual(svc.clampPct(150), 100);
  assert.strictEqual(svc.clampPct(-10), 0);
  assert.strictEqual(svc.clampPct(33), 33);
  assert.strictEqual(svc.clampPct('x'), 0);
});

// ───────────── LEGACY hospital == original nested math ─────────────
test('legacy hospital reproduces nested numbers exactly (bill 10,000)', () => {
  const hospital = { deductionPercentage: 20 };
  const consultant = { commissionPercentage: 60 }; // no commissionModel -> legacy
  const r = svc.computeHospitalSplit({ billPaisa: 1000000, consultant, hospital, settings });
  assert.strictEqual(r.platformCutPaisa, 200000);
  assert.strictEqual(r.doctorCommissionPaisa, 120000);
  assert.strictEqual(r.platformChargePaisa, 80000);
  assert.strictEqual(r.adminSharePaisa, 80000);
  assert.strictEqual(r.totalCutPaisa, 200000);
  assert.strictEqual(r.totalCutPaisa, r.doctorCommissionPaisa + r.platformChargePaisa);
});

test('legacy lab reproduces nested numbers with discount', () => {
  const lab = { deductionPercentage: 20 };
  const consultant = { commissionPercentage: 60 };
  const tests = [{ amountPaisa: 600000 }, { amountPaisa: 400000 }];
  const r = svc.computeLabSplit({ tests, discountPercentage: 10, consultant, lab, settings });
  assert.strictEqual(r.billPaisa, 900000);
  assert.strictEqual(r.platformCutPaisa, 180000);
  assert.strictEqual(r.doctorCommissionPaisa, 108000);
  assert.strictEqual(r.platformChargePaisa, 72000);
  assert.strictEqual(r.totalCutPaisa, r.doctorCommissionPaisa + r.platformChargePaisa);
});

// ── ADDITIVE: commission on the CONSULTANT; platform charge is the FACILITY's ONE chosen
//    type (percentage OR fixed), applied to every referral regardless of consultant. ──

test('additive hospital on FIXED platform: applies to every consultant', () => {
  const hospital = { platformChargeType: 'fixed', deductionPercentage: 20, fixedPlatformChargePaisa: 300000 }; // Rs 3,000/referral
  const docFixed = { commissionModel: 'additive', hospitalCommissionType: 'fixed', hospitalFixedCommissionPaisa: 1000000 };
  const docPct = { commissionModel: 'additive', hospitalCommissionType: 'percentage', hospitalCommissionPercentage: 15 };
  const a = svc.computeHospitalSplit({ billPaisa: 5000000, consultant: docFixed, hospital, settings });
  const b = svc.computeHospitalSplit({ billPaisa: 5000000, consultant: docPct, hospital, settings });
  assert.strictEqual(a.platformChargePaisa, 300000); // fixed for everyone
  assert.strictEqual(b.platformChargePaisa, 300000);
  assert.strictEqual(a.totalCutPaisa, 1300000); // 10,000 + 3,000
  assert.strictEqual(b.totalCutPaisa, 1050000); // 7,500 + 3,000
});

test('additive hospital on PERCENTAGE platform: applies to every consultant', () => {
  const hospital = { platformChargeType: 'percentage', deductionPercentage: 20, fixedPlatformChargePaisa: 300000 };
  const docFixed = { commissionModel: 'additive', hospitalCommissionType: 'fixed', hospitalFixedCommissionPaisa: 1000000 };
  const docPct = { commissionModel: 'additive', hospitalCommissionType: 'percentage', hospitalCommissionPercentage: 15 };
  const a = svc.computeHospitalSplit({ billPaisa: 5000000, consultant: docFixed, hospital, settings });
  const b = svc.computeHospitalSplit({ billPaisa: 5000000, consultant: docPct, hospital, settings });
  assert.strictEqual(a.platformChargePaisa, 1000000); // 20% of bill for everyone
  assert.strictEqual(b.platformChargePaisa, 1000000);
  assert.strictEqual(a.totalCutPaisa, 2000000); // 10,000 + 10,000
  assert.strictEqual(b.totalCutPaisa, 1750000); // 7,500 + 10,000
});

// ───────────── ADDITIVE lab per-test (lab's single chosen type) ─────────────
const tests3 = [{ amountPaisa: 200000 }, { amountPaisa: 200000 }, { amountPaisa: 200000 }]; // 6,000

test('additive lab on FIXED platform: Rs/test for every consultant', () => {
  const lab = { platformChargeType: 'fixed', deductionPercentage: 20, fixedPlatformChargePaisaPerTest: 10000 };
  const consultant = { commissionModel: 'additive', labCommissionType: 'fixed', labFixedCommissionPaisaPerTest: 10000 };
  const r = svc.computeLabSplit({ tests: tests3, discountPercentage: 0, consultant, lab, settings });
  assert.strictEqual(r.doctorCommissionPaisa, 30000); // 100 x 3
  assert.strictEqual(r.platformChargePaisa, 30000); // lab fixed 100 x 3
  assert.strictEqual(r.totalCutPaisa, 60000);
});

test('additive lab on PERCENTAGE platform: %/test for every consultant', () => {
  const lab = { platformChargeType: 'percentage', deductionPercentage: 20, fixedPlatformChargePaisaPerTest: 10000 };
  const consultant = { commissionModel: 'additive', labCommissionType: 'percentage', labCommissionPercentage: 10 };
  const r = svc.computeLabSplit({ tests: tests3, discountPercentage: 0, consultant, lab, settings });
  assert.strictEqual(r.doctorCommissionPaisa, 60000); // 10% of 6,000
  assert.strictEqual(r.platformChargePaisa, 120000); // lab 20% of 6,000
  assert.strictEqual(r.totalCutPaisa, 180000);
});

test('additive lab high-volume: per-facility override raises platform/test, commission unchanged', () => {
  const lab = { _id: 'lab1', deductionPercentage: 20, fixedPlatformChargePaisaPerTest: 10000 };
  const consultant = {
    commissionModel: 'additive',
    labCommissionType: 'fixed',
    labFixedCommissionPaisaPerTest: 10000,
    facilityPlatformOverrides: [
      { facilityType: 'lab', facilityId: 'lab1', platformChargeType: 'fixed', fixedPlatformChargePaisa: 15000 },
    ],
  };
  const r = svc.computeLabSplit({ tests: tests3, discountPercentage: 0, consultant, lab, settings });
  assert.strictEqual(r.doctorCommissionPaisa, 30000); // unchanged
  assert.strictEqual(r.platformChargePaisa, 45000); // override 150 x 3
  assert.strictEqual(r.totalCutPaisa, 75000);
});

// ───────────── per-consultant hospital platform-fee override ─────────────

test('additive hospital: per-consultant override changes ONLY the platform fee, commission unchanged', () => {
  const hospital = { _id: 'h1', platformChargeType: 'fixed', deductionPercentage: 20, fixedPlatformChargePaisa: 300000 }; // default Rs 3,000
  const base = { commissionModel: 'additive', hospitalCommissionType: 'percentage', hospitalCommissionPercentage: 15 };
  const overridden = {
    ...base,
    facilityPlatformOverrides: [
      { facilityType: 'hospital', facilityId: 'h1', platformChargeType: 'fixed', fixedPlatformChargePaisa: 500000 }, // Rs 5,000
    ],
  };
  const a = svc.computeHospitalSplit({ billPaisa: 5000000, consultant: base, hospital, settings });
  const b = svc.computeHospitalSplit({ billPaisa: 5000000, consultant: overridden, hospital, settings });
  // Same doctor commission (15% of 50,000 = 7,500) in both cases.
  assert.strictEqual(a.doctorCommissionPaisa, 750000);
  assert.strictEqual(b.doctorCommissionPaisa, 750000);
  // Platform fee: default 3,000 vs override 5,000.
  assert.strictEqual(a.platformChargePaisa, 300000);
  assert.strictEqual(b.platformChargePaisa, 500000);
  // Hospital pays commission + platform fee.
  assert.strictEqual(a.totalCutPaisa, 1050000);
  assert.strictEqual(b.totalCutPaisa, 1250000);
});

test('legacy hospital: per-consultant override applies additively, nested commission preserved', () => {
  const hospital = { _id: 'h1', deductionPercentage: 20 };
  const base = { commissionPercentage: 60 }; // legacy
  const overridden = {
    ...base,
    facilityPlatformOverrides: [
      { facilityType: 'hospital', facilityId: 'h1', platformChargeType: 'percentage', platformChargePercentage: 10 },
    ],
  };
  const a = svc.computeHospitalSplit({ billPaisa: 1000000, consultant: base, hospital, settings });
  const b = svc.computeHospitalSplit({ billPaisa: 1000000, consultant: overridden, hospital, settings });
  // Doctor commission is the SAME nested value (bill 20% cut, 60% of it = 120,000) with or without override.
  assert.strictEqual(a.doctorCommissionPaisa, 120000);
  assert.strictEqual(b.doctorCommissionPaisa, 120000);
  // Platform fee: default nested admin share (80,000) vs override 10% of bill (100,000).
  assert.strictEqual(a.platformChargePaisa, 80000);
  assert.strictEqual(b.platformChargePaisa, 100000);
  // With override the hospital owes commission + fee (additive-shaped).
  assert.strictEqual(b.totalCutPaisa, 220000);
  assert.strictEqual(b.totalCutPaisa, b.doctorCommissionPaisa + b.platformChargePaisa);
});

test('override for a DIFFERENT hospital does not apply', () => {
  const hospital = { _id: 'h1', platformChargeType: 'percentage', deductionPercentage: 20 };
  const consultant = {
    commissionModel: 'additive', hospitalCommissionType: 'percentage', hospitalCommissionPercentage: 15,
    facilityPlatformOverrides: [
      { facilityType: 'hospital', facilityId: 'h2', platformChargeType: 'fixed', fixedPlatformChargePaisa: 999999 },
    ],
  };
  const r = svc.computeHospitalSplit({ billPaisa: 5000000, consultant, hospital, settings });
  assert.strictEqual(r.platformChargePaisa, 1000000); // hospital default 20% of 50,000, override ignored
});

// ───────────── per-consultant LAB platform-fee override (per test) ─────────────

test('additive lab: per-consultant override changes ONLY the per-test platform fee', () => {
  const lab = { _id: 'lab1', platformChargeType: 'fixed', deductionPercentage: 20, fixedPlatformChargePaisaPerTest: 10000 }; // default Rs 100/test
  const base = { commissionModel: 'additive', labCommissionType: 'fixed', labFixedCommissionPaisaPerTest: 10000 };
  const overridden = {
    ...base,
    facilityPlatformOverrides: [
      { facilityType: 'lab', facilityId: 'lab1', platformChargeType: 'fixed', fixedPlatformChargePaisa: 15000 }, // Rs 150/test
    ],
  };
  const a = svc.computeLabSplit({ tests: tests3, discountPercentage: 0, consultant: base, lab, settings });
  const b = svc.computeLabSplit({ tests: tests3, discountPercentage: 0, consultant: overridden, lab, settings });
  assert.strictEqual(a.doctorCommissionPaisa, 30000); // 100 x 3, unchanged
  assert.strictEqual(b.doctorCommissionPaisa, 30000);
  assert.strictEqual(a.platformChargePaisa, 30000); // default 100 x 3
  assert.strictEqual(b.platformChargePaisa, 45000); // override 150 x 3
  assert.strictEqual(b.totalCutPaisa, 75000);
});

test('legacy lab: per-consultant override applies per-test additively, commission preserved', () => {
  const lab = { _id: 'lab1', deductionPercentage: 20 };
  const base = { commissionPercentage: 60 }; // legacy
  const overridden = {
    ...base,
    facilityPlatformOverrides: [
      { facilityType: 'lab', facilityId: 'lab1', platformChargeType: 'fixed', fixedPlatformChargePaisa: 20000 }, // Rs 200/test
    ],
  };
  // 3 tests of Rs 2,000 = 6,000 gross, no discount.
  const a = svc.computeLabSplit({ tests: tests3, discountPercentage: 0, consultant: base, lab, settings });
  const b = svc.computeLabSplit({ tests: tests3, discountPercentage: 0, consultant: overridden, lab, settings });
  // Nested commission: cut = 6,000 x 20% = 1,200; doctor = 60% = 720 -> 72000 paisa. Same both.
  assert.strictEqual(a.doctorCommissionPaisa, 72000);
  assert.strictEqual(b.doctorCommissionPaisa, 72000);
  assert.strictEqual(b.platformChargePaisa, 60000); // 200 x 3 tests
  assert.strictEqual(b.totalCutPaisa, b.doctorCommissionPaisa + b.platformChargePaisa);
});

// ───────────── reconciliation & edge cases ─────────────
test('identity totalCut === doctorCommission + platformCharge across modes', () => {
  const cases = [
    { consultant: { commissionPercentage: 60 }, hospital: { deductionPercentage: 25 }, bill: 1234567 },
    {
      consultant: { commissionModel: 'additive', hospitalCommissionType: 'percentage', hospitalCommissionPercentage: 13 },
      hospital: { deductionPercentage: 18, fixedPlatformChargePaisa: 333333 },
      bill: 987654,
    },
  ];
  for (const c of cases) {
    const r = svc.computeHospitalSplit({ billPaisa: c.bill, consultant: c.consultant, hospital: c.hospital, settings });
    assert.strictEqual(r.totalCutPaisa, r.doctorCommissionPaisa + r.platformChargePaisa);
    assert.ok(r.platformChargePaisa >= 0, 'admin charge never negative');
  }
});

test('zero bill: percentage parties -> 0', () => {
  const r = svc.computeHospitalSplit({ billPaisa: 0, consultant: { commissionPercentage: 60 }, hospital: { deductionPercentage: 20 }, settings });
  assert.strictEqual(r.totalCutPaisa, 0);
  assert.strictEqual(r.doctorCommissionPaisa, 0);
});

test('additive fixed platform still owed on tiny bill (facilityKeeps may be negative)', () => {
  const consultant = { commissionModel: 'additive', hospitalCommissionType: 'fixed', hospitalFixedCommissionPaisa: 150000 };
  const hospital = { platformChargeType: 'fixed', deductionPercentage: 20, fixedPlatformChargePaisa: 50000 };
  const r = svc.computeHospitalSplit({ billPaisa: 100000, consultant, hospital, settings });
  assert.strictEqual(r.platformChargePaisa, 50000); // facility fixed platform
  assert.strictEqual(r.totalCutPaisa, 200000);
  assert.strictEqual(r.facilityKeepsPaisa, -100000);
});
