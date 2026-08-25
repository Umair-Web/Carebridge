const mongoose = require('mongoose');
const Counter = require('./Counter');
const { encrypt, decrypt } = require('../utils/crypto');

const ReferralSchema = new mongoose.Schema(
  {
    referralCode: { type: String, unique: true }, // CB-2024-0001
    consultantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultant', required: true },
    // Patient Info
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
      get: decrypt 
    }, 
    guardianName: { type: String },
    /** Relation of the named person to the patient: S/O, D/O, W/O */
    guardianRelation: { type: String, enum: ['S/O', 'D/O', 'W/O'], default: 'S/O' },
    // Clinical Info
    urgency: { type: String, enum: ['emergency', 'urgent', 'routine'], required: true },
    symptomsText: { type: String },
    summaryNotes: { type: String }, // Consultant's clinical summary
    symptomTags: [{ type: String }],
    department: { type: String },
    /** Department head routing (FR-23) — set when hospital accepts. */
    assignedDepartment: { type: String, trim: true },
    diagnosisText: { type: String },
    notes: { type: String },
    attachments: [{ type: String }], // Cloudinary URLs
    
    /** 
     * Chronological clinical logs added during treatment (Nursing/Consultant tickets)
     * as per Care bridge portal.docx
     */
    clinicalNotes: [
      {
        type: { type: String, enum: ['nursing', 'consultant'], required: true },
        content: { type: String, required: true },
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        authorName: { type: String }, // cached for quick display
        createdAt: { type: Date, default: Date.now }
      }
    ],

    budgetMin: { type: Number }, // in paisa
    budgetMax: { type: Number }, // in paisa
    /** Predefined brackets (Q6) */
    budgetBracket: { type: String, enum: ['5k-10k', '10k-50k', '50k-1lac', '1lac-3lac', '3lac+'] },
    // Hospital & Status
    targetHospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    referralType: { type: String, enum: ['hospital'], default: 'hospital' },
    /** Refer to a specific doctor (Q4) */
    targetDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalDoctor' },
    /** Top hospitals from scoring at submission time (escalation order). */
    rankedHospitalIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' }],
    /** Per-hospital department + optional doctor (used on escalation). */
    rankedHospitalPreferences: [
      {
        hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
        department: { type: String, required: true, trim: true },
        targetDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'HospitalDoctor' },
      },
    ],
    /** Index into rankedHospitalIds for the hospital currently responsible (SLA). */
    currentRankIndex: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'admitted', 'closed'],
      default: 'pending',
    },
    rejectionReason: { type: String },
    promoCode: { type: String },
    scoringData: { type: Object }, // snapshot of scoring at time of referral
    slaDeadline: { type: Date },
    // Timeline
    acceptedAt: { type: Date },
    admittedAt: { type: Date },
    closedAt: { type: Date },

    /**
     * Password gate for viewing full patient/referral details (admin + unlocked roles).
     * Default password is set to "123456" at create time (hashed).
     */
    detailsPasswordHash: { type: String, select: false },
    /**
     * When `active`, consultant/hospital may view patient details.
     * When `suspended`, only admin can view (via password).
     * Defaults to active; auto-set to suspended when referral is closed.
     */
    detailsViewAccess: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
  },
  { 
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

// Auto-generate referral code (atomic per year)
ReferralSchema.pre('save', async function () {
  if (!this.referralCode) {
    const year = new Date().getFullYear();
    const doc = await Counter.findOneAndUpdate(
      { _id: `referralCode_${year}` },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.referralCode = `CB-${year}-${String(doc.seq).padStart(4, '0')}`;
  }
  // Closed referrals lock patient details for consultant/hospital by default.
  if (this.isModified('status') && this.status === 'closed') {
    this.detailsViewAccess = 'suspended';
  }
});

module.exports = mongoose.model('Referral', ReferralSchema);
