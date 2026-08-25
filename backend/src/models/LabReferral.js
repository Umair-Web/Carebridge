const mongoose = require('mongoose');
const Counter = require('./Counter');
const { encrypt, decrypt } = require('../utils/crypto');

/** A billed line item on the lab bill (paisa). Mirrors Admission.ServiceLineSchema. */
const ServiceLineSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    amountPaisa: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const LabReferralSchema = new mongoose.Schema(
  {
    referralCode: { type: String, unique: true }, // LAB-2024-0001
    consultantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultant', required: true },
    // Patient Info (mirrors Referral)
    patientName: { type: String, required: true },
    /** Source of truth for patient age; `age` is derived from this. */
    dateOfBirth: { type: Date },
    age: { type: Number, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    phone: { type: String, required: true },
    area: { type: String },
    cnic: {
      type: String,
      set: encrypt,
      get: decrypt,
    },
    guardianName: { type: String },
    guardianRelation: { type: String, enum: ['S/O', 'D/O', 'W/O'], default: 'S/O' },
    // Clinical / test info
    urgency: { type: String, enum: ['emergency', 'urgent', 'routine'], default: 'routine' },
    /** Tests the consultant recommends. */
    recommendedTests: [
      {
        testName: { type: String, required: true, trim: true },
        note: { type: String, trim: true },
      },
    ],
    symptomsText: { type: String },
    summaryNotes: { type: String }, // Consultant's clinical summary
    notes: { type: String },
    attachments: [{ type: String }], // Cloudinary URLs

    // Target lab (single — manual re-refer if declined)
    targetLaboratoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Laboratory' },

    /** Consultant-offered patient discount % (capped by consultant.maxLabDiscountPercentage). */
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 },

    status: {
      type: String,
      enum: ['pending', 'accepted', 'reported', 'closed', 'rejected'],
      default: 'pending',
    },
    rejectionReason: { type: String },

    /** When the lab expects to have reports ready (set on accept). */
    expectedReportAt: { type: Date },
    /** Report files uploaded by the lab; visible to consultant + admin. */
    reportFiles: [
      {
        name: { type: String },
        url: { type: String, required: true },
        testName: { type: String }, // Which recommended test this report belongs to (optional)
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // Billing block (folded in — labs have no separate "admission" doc)
    services: [ServiceLineSchema],
    grossAmountPaisa: { type: Number, min: 0 }, // sum of services before discount
    discountAmountPaisa: { type: Number, min: 0, default: 0 },
    billTotalPaisa: { type: Number, min: 0 }, // net amount patient pays (gross - discount)
    paymentMethod: {
      type: String,
      enum: ['pending', 'cash', 'jazzcash', 'easypaisa', 'bank_transfer', 'manual'],
      default: 'pending',
    },
    paymentReference: { type: String, trim: true },
    patientBillFileUrl: { type: String }, // uploaded bill receipt/document

    /** Snapshot of nearest-lab scoring/distance at submission. */
    scoringData: { type: Object },

    weeklySettlementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabSettlement',
      default: null,
    },

    /**
     * When `active` (default), the referring consultant may view patient details.
     * When `suspended`, consultant view is blocked; admin (and lab) still have access.
     * Unlike hospital referrals, closed lab referrals do NOT auto-suspend.
     */
    detailsViewAccess: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },

    // Timeline
    acceptedAt: { type: Date },
    reportedAt: { type: Date },
    completedAt: { type: Date },
    closedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

// Auto-generate lab referral code (atomic per year): LAB-YYYY-NNNN
LabReferralSchema.pre('save', async function () {
  if (!this.referralCode) {
    const year = new Date().getFullYear();
    const doc = await Counter.findOneAndUpdate(
      { _id: `labReferralCode_${year}` },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.referralCode = `LAB-${year}-${String(doc.seq).padStart(4, '0')}`;
  }
});

module.exports = mongoose.model('LabReferral', LabReferralSchema);
