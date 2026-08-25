const Consultant = require('../models/Consultant');
const Payout = require('../models/Payout');
const PlatformSettings = require('../models/PlatformSettings');

/**
 * Handles wallet credits and payout release logic (Q14/Q16)
 */
exports.creditConsultantWallet = async (consultantId, referralId, amountPaisa) => {
  try {
    const consultant = await Consultant.findById(consultantId);
    if (!consultant) return;

    // Auto-learn preference (Q5)
    const referral = await require('../models/Referral').findById(referralId);
    if (referral && referral.targetHospitalId) {
      const hospitalIdStr = referral.targetHospitalId.toString();
      const currentCount = consultant.referralHistoryCount.get(hospitalIdStr) || 0;
      consultant.referralHistoryCount.set(hospitalIdStr, currentCount + 1);
    }

    const Hospital = require('../models/Hospital');
    const hospital = referral?.targetHospitalId ? await Hospital.findById(referral.targetHospitalId) : null;
    const settings = await PlatformSettings.findOne().sort({ updatedAt: -1 });

    const defaultHospitalCut = settings?.defaultHospitalDeductionPercentage ?? 20;
    const defaultConsultantCut = settings?.defaultConsultantCommissionPercentage ?? 60;

    const deductionPercentage = hospital?.deductionPercentage ?? defaultHospitalCut;
    const commissionPercentage = consultant?.commissionPercentage ?? defaultConsultantCut;

    // Use amountPaisa as total bill if no Admission is found, or default
    const totalBillPaisa = amountPaisa || 100000; 
    const platformCutPaisa = Math.round(totalBillPaisa * (deductionPercentage / 100));
    const consultantSharePaisa = Math.round(platformCutPaisa * (commissionPercentage / 100));
    const adminSharePaisa = platformCutPaisa - consultantSharePaisa;

    const actualConsultantPayout = consultantSharePaisa;

    // Credit the wallet (Q14)
    consultant.walletBalance = (consultant.walletBalance || 0) + actualConsultantPayout;
    consultant.totalEarnings = (consultant.totalEarnings || 0) + actualConsultantPayout;

    await consultant.save();

    // Create a payout record as 'accrued'
    await Payout.create({
      consultantId,
      referralId,
      amountPaisa: actualConsultantPayout,
      totalBillPaisa,
      deductionPercentage,
      platformCutPaisa,
      commissionPercentage,
      adminSharePaisa,
      status: 'accrued',
      note: `Referral completed — bill ${totalBillPaisa/100} PKR (Hospital Cut: ${deductionPercentage}%, Consultant split: ${commissionPercentage}%)`
    });

    // Check if threshold is reached for release (Q16)
    await exports.checkAndReleasePayouts(consultant);
  } catch (error) {
    console.error('Error crediting wallet:', error);
  }
};

exports.checkAndReleasePayouts = async (consultant) => {
  const settings = await PlatformSettings.findOne() || { walletThresholdPaisa: 1000000, walletInitialHoldPaisa: 950000 };
  
  /**
   * Q16: Release only if balance >= 10,000 PKR
   * Initially 9,500 PKR is held once it reaches 10,000 PKR.
   */
  if (consultant.walletBalance >= settings.walletThresholdPaisa) {
    const releaseAmount = consultant.walletBalance - settings.walletInitialHoldPaisa;
    
    if (releaseAmount > 0) {
      // In a real app, this would trigger JazzCash/Bank transfer
      console.log(`[PAYOUT] Releasing ${releaseAmount/100} PKR to Consultant ${consultant._id}`);
      
      // Update wallet
      consultant.walletBalance = settings.walletInitialHoldPaisa; // Keep the hold amount
      await consultant.save();

      // Create a 'paid' payout record for the release
      await Payout.create({
        consultantId: consultant._id,
        amountPaisa: releaseAmount,
        status: 'paid',
        note: `Auto-released wallet balance (exceeding ${settings.walletThresholdPaisa/100} PKR threshold).`
      });
    }
  }
};
