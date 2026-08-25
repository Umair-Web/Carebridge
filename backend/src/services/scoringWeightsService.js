const ScoringConfig = require('../models/ScoringConfig');

const DEFAULTS = {
  specialtyMatch: 30,
  bedAvailability: 25,
  distance: 15,
  costFit: 10,
  slaHistory: 10,
  preference: 10,
};

async function getScoringWeights() {
  const doc = await ScoringConfig.findOne().sort({ updatedAt: -1 }).lean();
  if (!doc) return { ...DEFAULTS };
  return {
    specialtyMatch: doc.specialtyMatch ?? DEFAULTS.specialtyMatch,
    bedAvailability: doc.bedAvailability ?? DEFAULTS.bedAvailability,
    distance: doc.distance ?? DEFAULTS.distance,
    costFit: doc.costFit ?? DEFAULTS.costFit,
    slaHistory: doc.slaHistory ?? DEFAULTS.slaHistory,
    preference: doc.preference ?? DEFAULTS.preference,
  };
}

module.exports = { getScoringWeights, DEFAULTS };
