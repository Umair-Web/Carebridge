const Referral = require('../models/Referral');
const Hospital = require('../models/Hospital');

/**
 * Recalculates dynamic performance stats for a hospital.
 * Factor 5 (SLA History) in SRS §10.
 */
const updateHospitalStats = async (hospitalId) => {
  try {
    const referrals = await Referral.find({
      targetHospitalId: hospitalId,
      status: { $in: ['accepted', 'rejected', 'admitted', 'closed'] },
    });

    if (referrals.length === 0) return;

    const acceptedCount = referrals.filter(r => ['accepted', 'admitted', 'closed'].includes(r.status)).length;
    const totalCount = referrals.length;
    
    // 1. Acceptance Rate
    const acceptanceRate = Math.round((acceptedCount / totalCount) * 100);

    // 2. Average Response Time (in minutes)
    const responseTimes = referrals
      .filter(r => r.acceptedAt)
      .map(r => {
        const diffMs = new Date(r.acceptedAt).getTime() - new Date(r.createdAt).getTime();
        return diffMs / (1000 * 60); // minutes
      });

    let avgResponseTime = 60; // default
    if (responseTimes.length > 0) {
      avgResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
    }

    await Hospital.findByIdAndUpdate(hospitalId, {
      acceptanceRate,
      avgResponseTime: Math.max(1, avgResponseTime), // Minimum 1 minute
    });
  } catch (err) {
    console.error('Update Hospital Stats Error:', err);
  }
};

module.exports = { updateHospitalStats };
