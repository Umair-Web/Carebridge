/**
 * Smart Scoring Engine (SRS §8) — factor maxima come from admin ScoringConfig (sum 100).
 */
const { DEFAULTS: DEFAULT_WEIGHTS } = require('../services/scoringWeightsService');
const { getActiveDepartmentNames, isDepartmentActive } = require('./hospitalDepartments');

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * @param {object} weights - specialtyMatch, bedAvailability, distance, costFit, slaHistory, preference
 */
const scoreHospital = (hospital, referralData, consultant, weights = DEFAULT_WEIGHTS) => {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  let totalScore = 0;
  const breakdown = {};

  const targetWard = referralData.urgency === 'emergency' ? 'ICU' : 'General';
  const wardInventory = hospital.bedsInventory.find((b) => b.ward === targetWard);
  if (!wardInventory || wardInventory.availableBeds <= 0 || wardInventory.totalBeds <= 0) {
    return null;
  }

  let specialtyScore = 0;
  if (isDepartmentActive(hospital, referralData.department)) {
    specialtyScore = w.specialtyMatch;
  } else {
    return null;
  }
  totalScore += specialtyScore;
  breakdown.specialty = specialtyScore;

  const bedScore = Math.round(
    (wardInventory.availableBeds / wardInventory.totalBeds) * w.bedAvailability
  );
  totalScore += bedScore;
  breakdown.beds = bedScore;

  const distance = calculateDistance(
    referralData.location.lat,
    referralData.location.lng,
    hospital.location.coordinates[1],
    hospital.location.coordinates[0]
  );
  const maxRadius = 30;
  const distanceScore = Math.max(0, Math.round(w.distance * (1 - distance / maxRadius)));
  totalScore += distanceScore;
  breakdown.distance = distanceScore;

  const relevantPackage = hospital.ratePackages.find((p) => p.department === referralData.department);
  let costScore = 0;
  if (relevantPackage) {
    if (relevantPackage.maxPrice <= referralData.budgetMax) costScore = w.costFit;
    else if (relevantPackage.minPrice <= referralData.budgetMax) costScore = Math.round(w.costFit / 2);
  }
  totalScore += costScore;
  breakdown.cost = costScore;

  let slaRaw = Math.max(0, Math.min(10, Math.round(10 - (hospital.avgResponseTime / 60) * 5)));
  slaRaw = Math.round((slaRaw + (hospital.acceptanceRate / 100) * 10) / 2);
  const slaScore = Math.round((slaRaw / 10) * w.slaHistory);
  totalScore += slaScore;
  breakdown.sla = slaScore;

  const isPreferred =
    consultant &&
    consultant.preferredHospitals &&
    consultant.preferredHospitals.some((id) => id.toString() === hospital._id.toString());
  
  /** Auto-learning preference (Q5) */
  const historicalCount = (consultant && consultant.referralHistoryCount && consultant.referralHistoryCount.get(hospital._id.toString())) || 0;
  const historyBonus = Math.min(w.preference, historicalCount * 2); // 2 points per past referral, max out at preference weight

  const prefScore = isPreferred ? w.preference : historyBonus;
  totalScore += prefScore;
  breakdown.preference = prefScore;

  return {
    hospitalId: hospital._id,
    hospitalName: hospital.hospitalName,
    totalScore: Math.min(100, totalScore),
    breakdown,
    distance: `${distance.toFixed(1)} km`,
    departments: getActiveDepartmentNames(hospital),
  };
};

module.exports = { scoreHospital, calculateDistance };
