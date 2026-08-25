const Referral = require('../models/Referral');
const Hospital = require('../models/Hospital');
const { slaDeadlineFromUrgency } = require('../utils/sla');
const { updateHospitalStats } = require('../services/statsService');
const { applyPreferenceForHospital } = require('../utils/referralPreferences');

/**
 * Move pending referrals past SLA to the next hospital in rankedHospitalIds, or reject if none left.
 */
async function processReferralEscalations(io) {
  const now = new Date();
  const overdue = await Referral.find({
    status: 'pending',
    slaDeadline: { $lt: now },
  });

  for (const ref of overdue) {
    const ranked =
      ref.rankedHospitalIds?.length > 0 ? ref.rankedHospitalIds : [ref.targetHospitalId].filter(Boolean);

    if (!ranked.length || !ref.targetHospitalId) {
      continue;
    }

    const prevHospitalId = ref.targetHospitalId.toString();
    let idx = typeof ref.currentRankIndex === 'number' ? ref.currentRankIndex : 0;

    if (idx + 1 < ranked.length) {
      idx += 1;
      ref.currentRankIndex = idx;
      ref.targetHospitalId = ranked[idx];
      applyPreferenceForHospital(ref, ranked[idx]);
      ref.slaDeadline = slaDeadlineFromUrgency(ref.urgency);
      await ref.save();
      
      // Update stats for the hospital that failed to respond
      await updateHospitalStats(prevHospitalId);

      if (io) {
        io.to(`hospital:${ref.targetHospitalId.toString()}`).emit('NEW_REFERRAL', {
          referralId: ref._id.toString(),
          hospitalId: ref.targetHospitalId.toString(),
        });
        io.to(`hospital:${prevHospitalId}`).emit('REFERRAL_ESCALATED', {
          referralId: ref._id.toString(),
        });
        io.to(`consultant:${ref.consultantId.toString()}`).emit('REFERRAL_ESCALATED', {
          referralId: ref._id.toString(),
          message: 'Referral escalated to next hospital (SLA)',
        });
      }
    } else if (ref.urgency === 'emergency') {
      /** Q7: In Emergency -> Auto escalate instantly to the nearest facility from consultant address. */
      const currentHospital = await Hospital.findById(prevHospitalId);
      if (currentHospital && currentHospital.location) {
        const nearest = await Hospital.findOne({
          _id: { $nin: ranked }, // Not one we already tried
          isActive: true,
          location: {
            $near: {
              $geometry: currentHospital.location,
              $maxDistance: 20000 // 20km
            }
          }
        });

        if (nearest) {
          ref.targetHospitalId = nearest._id;
          ref.slaDeadline = slaDeadlineFromUrgency('emergency');
          await ref.save();

          if (io) {
            io.to(`hospital:${nearest._id.toString()}`).emit('NEW_REFERRAL', {
              referralId: ref._id.toString(),
              hospitalId: nearest._id.toString(),
            });
            io.to(`consultant:${ref.consultantId.toString()}`).emit('REFERRAL_ESCALATED', {
              referralId: ref._id.toString(),
              message: 'EMERGENCY: Escalated to nearest alternative facility.',
            });
          }
          continue;
        }
      }
      
      // If no nearest found, fall through to rejection
      ref.status = 'rejected';
      ref.rejectionReason = 'SLA expired — no remaining hospital in queue or nearby';
      await ref.save();
    } else {
      ref.status = 'rejected';
      ref.rejectionReason = 'SLA expired — no remaining hospital in queue';
      await ref.save();
    }
  }
}

module.exports = { processReferralEscalations };
