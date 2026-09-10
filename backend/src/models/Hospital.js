const mongoose = require('mongoose');

const BedInventorySchema = new mongoose.Schema({
  ward: {
    type: String,
    required: true,
    trim: true,
  },
  totalBeds: { type: Number, default: 0 },
  occupiedBeds: { type: Number, default: 0 },
  availableBeds: { type: Number, default: 0 },
});

const RatePackageSchema = new mongoose.Schema({
  department: { type: String, required: true },
  serviceName: { type: String, required: true },
  minPrice: { type: Number, required: true }, // in paisa
  maxPrice: { type: Number, required: true }, // in paisa
  effectiveDate: { type: Date, default: Date.now },
});

const HospitalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    hospitalName: { type: String, required: true },
    registrationNumber: { type: String },
    /** Authorized representative / admin CNIC (text) */
    representativeCnic: { type: String, trim: true },
    /** Set when admin approves registration */
    isRegistrationVerified: { type: Boolean, default: false },
    /** Supporting documents for registration (Q3) */
    registrationDocuments: [
      {
        name: { type: String, required: true }, // e.g. "SHCC License", "Rate List"
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      }
    ],
    /** Custom branding for white-labeling (Q28) */
    branding: {
      primaryColor: { type: String, default: '#2980b9' },
      logoUrl: { type: String },
    },
    city: { type: String, default: 'Karachi' },
    area: { type: String },
    address: { type: String },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [67.0099, 24.8607] }, // [lng, lat] - default Karachi
    },
    departments: [{ type: String }], // e.g. ['Cardiology', 'Orthopedics', 'Neurology']
    /** Names from `departments` that are temporarily off (e.g. no beds) — hidden from referral intake */
    inactiveDepartments: [{ type: String }],
    bedsInventory: [BedInventorySchema],
    ratePackages: [RatePackageSchema],
    avgResponseTime: { type: Number, default: 60 }, // in minutes
    acceptanceRate: { type: Number, default: 80 }, // percentage
    rating: { type: Number, default: 4.0, min: 0, max: 5 },
    isActive: { type: Boolean, default: false },
    // ── Platform charge (Hospital → Admin) — additive v2 (COMMISSION_SYSTEM_V2_PER_DOCTOR.md) ──
    // The facility owns the platform charge; it may be a percentage of the bill OR a flat
    // fee per patient. A single hospital's weekly settlement can mix fixed- and percentage-
    // commission consultants — each case is snapshotted at finalization.
    deductionPercentage: { type: Number, default: 20 }, // platform charge % (also legacy nested cut)
    platformChargeType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    fixedPlatformChargePaisa: { type: Number, default: 0, min: 0 }, // flat platform charge per patient/referral
    /**
     * Password for hospital staff to unlock doctor profiles (view/edit/delete).
     * Separate from the hospital portal login. Default plaintext on first use: 123456.
     */
    doctorProfileAccessPasswordHash: { type: String },
    /** Individual JazzCash Merchant Credentials (SRS §12.3) */
    paymentGatewayCredentials: {
      merchantId: { type: String, trim: true },
      password: { type: String, trim: true },
      integritySalt: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

HospitalSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Hospital', HospitalSchema);
