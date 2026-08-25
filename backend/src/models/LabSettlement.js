const mongoose = require('mongoose');

/** Weekly settlement for a laboratory. Mirrors WeeklySettlement (same 5-state machine). */
const LabSettlementSchema = new mongoose.Schema(
  {
    laboratoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Laboratory', required: true },
    billingPeriodStart: { type: Date, required: true },
    billingPeriodEnd: { type: Date, required: true },

    // Lab referrals aggregated in this weekly summary
    labReferralIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LabReferral' }],

    // Aggregated monetary values (in paisa)
    grossAmountPaisa: { type: Number, required: true, min: 0 },
    deductionPercentage: { type: Number }, // Snapshot (legacy single %); optional under per-doctor additive
    // calculatedPlatformCutPaisa = the TOTAL the lab owes the platform for this cycle
    // (legacy: Σ platform cut; additive: Σ (doctor commission + platform charge)).
    calculatedPlatformCutPaisa: { type: Number, required: true, min: 0 },

    // ── Additive (v2) breakdown — Σ over the cycle's payout snapshots ──
    doctorCommissionTotalPaisa: { type: Number, default: 0, min: 0 },
    platformChargeTotalPaisa: { type: Number, default: 0, min: 0 },
    facilityTotalPayablePaisa: { type: Number, default: 0, min: 0 },

    // Optional weekly bill summary document. No longer collected at creation —
    // each referral's own patientBillFileUrl is auto-attached via labReferralIds.
    // Kept (optional) for backward compatibility with older settlements.
    billSummaryFileUrl: { type: String },

    // Lab manual payment receipt details
    labReceiptFileUrl: { type: String },
    labPaidAt: { type: Date },
    rejectionReason: { type: String }, // Populated if admin rejects the lab receipt

    // Overall status of this settlement cycle
    status: {
      type: String,
      enum: [
        'pending_payment', // Summary uploaded, lab has not uploaded payment receipt
        'pending_admin_verification', // Lab paid, uploaded receipt, awaiting admin verification
        'paid_pending_consultant_payout', // Admin verified lab payment, admin needs to pay consultants
        'paid_pending_consultant_verification', // Admin paid consultants & uploaded receipts, waiting for consultant verification
        'completed', // All consultants confirmed receiving payout
      ],
      default: 'pending_payment',
    },

    adminVerifiedAt: { type: Date },
    adminVerifierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Breakdown of payouts for consultants in this cycle
    consultantPayouts: [
      {
        consultantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultant', required: true },
        amountPaisa: { type: Number, required: true },
        commissionPercentage: { type: Number, required: true }, // Snapshotted from the LabPayout snapshot at creation
        commissionType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' }, // display badge
        fixedCommissionPaisa: { type: Number, default: 0 }, // display badge (additive fixed)
        payoutReceiptFileUrl: { type: String },
        paidAt: { type: Date },
        status: {
          type: String,
          enum: ['pending_payout', 'pending_verification', 'verified'],
          default: 'pending_payout',
        },
        verifiedAt: { type: Date },
      },
    ],
    notes: { type: String },
  },
  { timestamps: true }
);

LabSettlementSchema.index({ laboratoryId: 1, billingPeriodStart: -1 });

module.exports = mongoose.model('LabSettlement', LabSettlementSchema);
