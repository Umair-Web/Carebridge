const LabReferral = require('../models/LabReferral');
const Laboratory = require('../models/Laboratory');
const Consultant = require('../models/Consultant');
const LabPayout = require('../models/LabPayout');
const PlatformSettings = require('../models/PlatformSettings');
const commissionService = require('./commissionService');

/**
 * Finalizes a lab referral's billing (mirror of billingService.finalizeAdmission):
 * 1. Recomputes discount-aware totals
 * 2. Marks the LabReferral 'closed'
 * 3. Accrues a LabPayout for the consultant (status 'accrued')
 *
 * Consultant balances are NOT auto-credited — they are officially credited once the
 * manual weekly lab settlement receipt/verification cycle completes (same as hospitals).
 */
exports.finalizeLabReferral = async (referralId, io) => {
  const referral = await LabReferral.findById(referralId);
  if (!referral || referral.status === 'closed') return referral;

  // 1. Recompute totals from services + the consultant-offered discount
  const gross = (referral.services || []).reduce((sum, s) => sum + (s.amountPaisa || 0), 0);
  const discountPct = referral.discountPercentage || 0;
  const discountAmt = Math.round(gross * (discountPct / 100));
  const billTotal = Math.max(0, gross - discountAmt);

  referral.grossAmountPaisa = gross;
  referral.discountAmountPaisa = discountAmt;
  referral.billTotalPaisa = billTotal;

  // 2. Resolve splits via the single commission engine. Legacy doctors reproduce the
  //    original nested numbers; additive (v2) doctors get a per-test doctorCommission +
  //    platformCharge. The engine recomputes the discounted bill identically.
  const settings = await PlatformSettings.findOne().sort({ updatedAt: -1 });
  const lab = await Laboratory.findById(referral.targetLaboratoryId);
  const consultant = await Consultant.findById(referral.consultantId);

  const split = commissionService.computeLabSplit({
    tests: referral.services || [],
    discountPercentage: discountPct,
    consultant,
    lab,
    settings,
  });
  const consultantSharePaisa = split.doctorCommissionPaisa;

  // 3. Finalize the referral
  referral.status = 'closed';
  referral.completedAt = new Date();
  referral.closedAt = new Date();
  await referral.save();

  // 4. Accrue payout with full split audit details (legacy + additive snapshot).
  await LabPayout.create({
    consultantId: referral.consultantId,
    labReferralId: referral._id,
    laboratoryId: referral.targetLaboratoryId,
    amountPaisa: consultantSharePaisa,
    totalBillPaisa: billTotal,
    discountPercentage: discountPct,
    // legacy-compatible fields
    deductionPercentage: split.deductionPercentage,
    platformCutPaisa: split.platformCutPaisa,
    commissionPercentage: split.commissionPercentage,
    adminSharePaisa: split.adminSharePaisa,
    // additive (v2) snapshot
    commissionModel: split.commissionModel,
    commissionType: split.commissionType,
    fixedCommissionPaisa: split.fixedCommissionPaisa,
    platformChargeType: split.platformChargeType,
    platformChargePercentage: split.platformChargePercentage,
    fixedPlatformChargePaisa: split.fixedPlatformChargePaisa,
    testCount: split.testCount,
    doctorCommissionPaisa: split.doctorCommissionPaisa,
    platformChargePaisa: split.platformChargePaisa,
    totalCutPaisa: split.totalCutPaisa,
    status: 'accrued',
    note:
      split.commissionModel === 'additive'
        ? `Lab case closed — bill ${billTotal / 100} PKR (Additive per-test: doctor ${split.doctorCommissionPaisa / 100} + platform ${split.platformChargePaisa / 100} = ${split.totalCutPaisa / 100} PKR over ${split.testCount} test(s), Discount: ${discountPct}%)`
        : `Lab case closed — bill ${billTotal / 100} PKR (Lab Cut: ${split.deductionPercentage}%, Consultant split: ${split.commissionPercentage}%, Discount: ${discountPct}%)`,
  });

  console.log(
    `[LAB_BILLING] Accrued payout of ${consultantSharePaisa / 100} PKR for Consultant ${referral.consultantId} (LabReferral: ${referral._id})`
  );

  // 5. Emit real-time updates
  if (io) {
    io.to(`consultant:${referral.consultantId.toString()}`).emit('LAB_STATUS_UPDATE', {
      referralId: referral._id.toString(),
      status: 'closed',
    });
    if (referral.targetLaboratoryId) {
      io.to(`lab:${referral.targetLaboratoryId.toString()}`).emit('LAB_STATUS_UPDATE', {
        referralId: referral._id.toString(),
        status: 'closed',
      });
    }
  }

  return referral;
};
