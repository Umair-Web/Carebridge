const Admission = require('../models/Admission');
const Referral = require('../models/Referral');
const Consultant = require('../models/Consultant');
const Payout = require('../models/Payout');
const PlatformSettings = require('../models/PlatformSettings');
const commissionService = require('./commissionService');

/**
 * Finalizes an admission:
 * 1. Marks Admission as 'billed'
 * 2. Marks Referral as 'closed'
 * 3. Accrues Payout for Consultant
 * 4. Updates Consultant balances
 */
exports.finalizeAdmission = async (admissionId, paymentMethod, paymentReference, io) => {
  const admission = await Admission.findById(admissionId).populate('referralId');
  if (!admission || admission.status === 'billed') return admission;

  const bill = admission.billTotalPaisa || 0;
  const pm = paymentMethod || admission.paymentMethod || 'manual';

  // 1. Get platform settings & calculate the split via the single commission engine.
  //    Legacy doctors reproduce the original nested numbers exactly; doctors an admin
  //    has moved to the additive (v2) model get doctorCommission + platformCharge.
  const settings = await PlatformSettings.findOne().sort({ updatedAt: -1 });
  const Hospital = require('../models/Hospital');
  const hospital = await Hospital.findById(admission.hospitalId);
  const consultant = await Consultant.findById(admission.consultantId);

  const totalBillPaisa = bill;
  const split = commissionService.computeHospitalSplit({
    billPaisa: totalBillPaisa,
    consultant,
    hospital,
    settings,
  });
  const payoutAmount = split.doctorCommissionPaisa;

  // 2. Finalize Admission
  admission.status = 'billed';
  admission.paymentMethod = pm;
  admission.paymentReference = paymentReference || admission.paymentReference;
  admission.completedAt = new Date();
  await admission.save();

  // 3. Finalize Referral
  const refId = admission.referralId?._id || admission.referralId;
  const referral = await Referral.findById(refId);
  if (referral) {
    referral.status = 'closed';
    referral.closedAt = new Date();
    await referral.save();
  }

  // 4. Create Payout record with full split audit details (legacy + additive snapshot).
  await Payout.create({
    consultantId: admission.consultantId,
    referralId: refId,
    admissionId: admission._id,
    amountPaisa: payoutAmount,
    totalBillPaisa,
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
    doctorCommissionPaisa: split.doctorCommissionPaisa,
    platformChargePaisa: split.platformChargePaisa,
    totalCutPaisa: split.totalCutPaisa,
    status: 'accrued',
    note:
      split.commissionModel === 'additive'
        ? `Case closed — bill ${bill / 100} PKR (Additive: doctor ${split.doctorCommissionPaisa / 100} + platform ${split.platformChargePaisa / 100} = ${split.totalCutPaisa / 100} PKR)`
        : `Case closed — bill ${bill / 100} PKR (Hospital Cut: ${split.deductionPercentage}%, Consultant split: ${split.commissionPercentage}%)`,
  });

  // 5. Consultant wallet balance auto-credits are disabled under the manual weekly settlement workflow.
  // Payout is created in 'accrued' status above, and balance will be officially credited and paid
  // once the manual weekly settlement receipt upload and verification cycle completes.
  if (consultant) {
    // Only log the accrual for audit purposes
    console.log(`[BILLING] Accrued manual payout of ${payoutAmount/100} PKR for Consultant ${consultant._id} (Admission: ${admission._id})`);
  }

  // 6. Emit Socket updates
  if (io) {
    if (referral) {
      io.to(`consultant:${admission.consultantId.toString()}`).emit('STATUS_UPDATE', {
        referralId: referral._id.toString(),
        status: 'closed',
      });
      io.to(`hospital:${admission.hospitalId.toString()}`).emit('STATUS_UPDATE', {
        referralId: referral._id.toString(),
        status: 'closed',
      });
    }
  }

  return admission;
};
