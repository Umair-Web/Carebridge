const mongoose = require('mongoose');

const PlatformSettingsSchema = new mongoose.Schema(
  {
    defaultHospitalDeductionPercentage: { type: Number, default: 20 },
    defaultConsultantCommissionPercentage: { type: Number, default: 60 },
    /** Laboratory module defaults */
    defaultLabDeductionPercentage: { type: Number, default: 20 },
    defaultLabCommissionPercentage: { type: Number, default: 60 },
    defaultMaxConsultantDiscountPercentage: { type: Number, default: 15 },
    /** Default commission model applied to brand-new doctors (legacy keeps current behavior). */
    defaultCommissionModel: { type: String, enum: ['legacy', 'additive'], default: 'legacy' },
    /** Minimum accumulated amount for release (Q14/Q16) - default 10,000 PKR */
    walletThresholdPaisa: { type: Number, default: 1000000 },
    /** Initial hold amount for first-time release - default 9,500 PKR */
    walletInitialHoldPaisa: { type: Number, default: 950000 },
    /** Withdrawal request TAT in days - default 3 */
    payoutTATDays: { type: Number, default: 3 },
    platformName: { type: String, default: 'CareBridge' },
    logoUrl: { type: String },
    primaryColor: { type: String, default: '#4f46e5' },
    accentColor: { type: String, default: '#06b6d4' },
    faviconUrl: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSettings', PlatformSettingsSchema);
