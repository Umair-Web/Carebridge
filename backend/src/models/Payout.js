const mongoose = require('mongoose');

const PayoutSchema = new mongoose.Schema(
  {
    consultantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultant', required: true },
    referralId: { type: mongoose.Schema.Types.ObjectId, ref: 'Referral', required: true },
    admissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admission' },
    amountPaisa: { type: Number, required: true, min: 0 },
    totalBillPaisa: { type: Number, default: 0 },
    deductionPercentage: { type: Number, default: 0 },
    platformCutPaisa: { type: Number, default: 0 },
    commissionPercentage: { type: Number, default: 0 },
    adminSharePaisa: { type: Number, default: 0 },

    // ── Additive (v2) snapshot — frozen deal at finalization (COMMISSION_SYSTEM_V2_PER_DOCTOR.md) ──
    commissionModel: { type: String, enum: ['legacy', 'additive'], default: 'legacy' },
    commissionType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    fixedCommissionPaisa: { type: Number, default: 0 },
    platformChargeType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    platformChargePercentage: { type: Number, default: 0 },
    fixedPlatformChargePaisa: { type: Number, default: 0 },
    doctorCommissionPaisa: { type: Number, default: 0 }, // == amountPaisa (the consultant fee)
    platformChargePaisa: { type: Number, default: 0 }, // admin revenue (== adminSharePaisa, >= 0)
    totalCutPaisa: { type: Number, default: 0 }, // what the facility owes for this case

    status: { type: String, enum: ['accrued', 'paid', 'pending_withdrawal'], default: 'accrued' },
    note: { type: String, trim: true },
    weeklySettlementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WeeklySettlement',
      default: null
    },
  },
  { timestamps: true }
);

PayoutSchema.index({ consultantId: 1, createdAt: -1 });

module.exports = mongoose.model('Payout', PayoutSchema);
