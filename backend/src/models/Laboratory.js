const mongoose = require('mongoose');

/** A single test the lab offers, with its price (paisa). Mirrors Hospital.ratePackages. */
const TestCatalogSchema = new mongoose.Schema({
  testName: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 }, // in paisa
  turnaroundHours: { type: Number, default: 24 },
});

const LaboratorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    labName: { type: String, required: true },
    registrationNumber: { type: String },
    /** Authorized representative / admin CNIC (text) */
    representativeCnic: { type: String, trim: true },
    /** Set when admin approves registration */
    isRegistrationVerified: { type: Boolean, default: false },
    /** Supporting documents for registration */
    registrationDocuments: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    /** Custom branding for white-labeling */
    branding: {
      primaryColor: { type: String, default: '#0ea5e9' },
      logoUrl: { type: String },
    },
    city: { type: String, default: 'Karachi' },
    area: { type: String },
    address: { type: String },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [67.0099, 24.8607] }, // [lng, lat] - default Karachi
    },
    /** Tests offered by this lab (with prices). */
    testCatalog: [TestCatalogSchema],
    avgResponseTime: { type: Number, default: 60 }, // in minutes
    acceptanceRate: { type: Number, default: 80 }, // percentage
    rating: { type: Number, default: 4.0, min: 0, max: 5 },
    isActive: { type: Boolean, default: false },
    // ── Platform charge (Lab → Admin) — additive v2; percentage of bill OR flat fee per test ──
    deductionPercentage: { type: Number, default: 20 }, // platform charge % (also legacy nested cut)
    platformChargeType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    fixedPlatformChargePaisaPerTest: { type: Number, default: 0, min: 0 }, // flat platform charge per test
    /** Individual JazzCash Merchant Credentials (optional, parallels Hospital). */
    paymentGatewayCredentials: {
      merchantId: { type: String, trim: true },
      password: { type: String, trim: true },
      integritySalt: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

LaboratorySchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Laboratory', LaboratorySchema);
