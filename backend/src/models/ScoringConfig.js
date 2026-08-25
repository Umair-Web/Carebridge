const mongoose = require('mongoose');

/** Single row — six SRS factors, must sum to 100. */
const ScoringConfigSchema = new mongoose.Schema(
  {
    specialtyMatch: { type: Number, default: 30 },
    bedAvailability: { type: Number, default: 25 },
    distance: { type: Number, default: 15 },
    costFit: { type: Number, default: 10 },
    slaHistory: { type: Number, default: 10 },
    preference: { type: Number, default: 10 },
  },
  { timestamps: true }
);

ScoringConfigSchema.pre('save', function validateSum() {
  const sum =
    (this.specialtyMatch || 0) +
    (this.bedAvailability || 0) +
    (this.distance || 0) +
    (this.costFit || 0) +
    (this.slaHistory || 0) +
    (this.preference || 0);
  if (Math.abs(sum - 100) > 0.01) {
    throw new Error('Scoring weights must sum to 100');
  }
});

module.exports = mongoose.model('ScoringConfig', ScoringConfigSchema);
