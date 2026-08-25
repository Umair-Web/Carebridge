const mongoose = require('mongoose');

const ConsultantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    pmdcNumber: { type: String, required: true, unique: true },
    cnic: { type: String },
    specialty: { type: String, required: true },
    clinicName: { type: String },
    clinicAddress: { type: String },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [67.0099, 24.8607] }, // [lng, lat] - default Karachi
    },
    city: { type: String, default: 'Karachi' },
    promoCode: { type: String, unique: true, sparse: true },
    preferredHospitals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' }],
    /** Automated preference learning (Q5) - Hospital ID string -> Count */
    referralHistoryCount: {
      type: Map,
      of: Number,
      default: {},
    },
    /** Wallet for PKR payouts (Q14/Q16) */
    walletBalance: { type: Number, default: 0 }, // in paisa
    totalEarnings: { type: Number, default: 0 }, // stored in paisa
    monthlyEarnings: { type: Number, default: 0 },
    /** PMDC certificate and other verification files (Q1) */
    verificationDocuments: [
      {
        name: { type: String },
        url: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      }
    ],
    isVerified: { type: Boolean, default: false },
    commissionPercentage: { type: Number, default: 60 }, // consultant commission split percentage (e.g. 60%)

    /**
     * Commission model selector (COMMISSION_SYSTEM_V2_PER_DOCTOR.md).
     *   'legacy'   — original nested split (platformCut * commissionPercentage). Default; nothing changes.
     *   'additive' — per-doctor additive split: facility owes doctorCommission + platformCharge.
     * A doctor only moves to 'additive' when an admin explicitly configures the v2 deal.
     */
    commissionModel: { type: String, enum: ['legacy', 'additive'], default: 'legacy' },

    // ── Doctor COMMISSION (Admin → Consultant). The consultant owns ONE commission deal per
    //    scope: a percentage of the patient bill OR a flat amount (per referral / per test).
    //    The PLATFORM CHARGE lives on the facility (Hospital/Laboratory), not here. ──
    hospitalCommissionType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    hospitalCommissionPercentage: { type: Number, default: 0, min: 0, max: 100 }, // % OF BILL
    hospitalFixedCommissionPaisa: { type: Number, default: 0, min: 0 }, // flat per referral

    labCommissionType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    labCommissionPercentage: { type: Number, default: 0, min: 0, max: 100 }, // % of each test
    labFixedCommissionPaisaPerTest: { type: Number, default: 0, min: 0 }, // flat per test

    /**
     * Optional per-doctor x per-facility platform-charge override (e.g. a higher platform
     * charge negotiated for a high-volume doctor). Takes precedence over the facility's own
     * platform charge for that facility only.
     */
    facilityPlatformOverrides: [
      {
        facilityType: { type: String, enum: ['hospital', 'lab'] },
        facilityId: { type: mongoose.Schema.Types.ObjectId },
        platformChargeType: { type: String, enum: ['percentage', 'fixed'] },
        platformChargePercentage: { type: Number, min: 0, max: 100 },
        fixedPlatformChargePaisa: { type: Number, min: 0 }, // per referral (hospital) / per test (lab)
        _id: false,
      },
    ],

    /**
     * Max patient discount % this consultant may offer when creating a lab referral
     * (admin-controlled, per consultant). Caps LabReferral.discountPercentage.
     */
    maxLabDiscountPercentage: { type: Number, default: 15, min: 0, max: 100 },
    /** Payout details (Q16) */
    payoutAccount: {
      accountType: { type: String, enum: ['jazzcash', 'easypaisa', 'bank'], default: 'jazzcash' },
      accountNumber: { type: String, trim: true },
      accountHolder: { type: String, trim: true },
      bankName: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

ConsultantSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Consultant', ConsultantSchema);
