const User = require('../models/User');
const Hospital = require('../models/Hospital');

/**
 * Resolve who closed a patient/referral for audit display.
 * @param {{ id?: string, role?: string, name?: string }|null} reqUser
 * @returns {Promise<{ closedBy: import('mongoose').Types.ObjectId|null, closedByName: string, closedByKind: string }>}
 */
async function resolveCloserActor(reqUser) {
  if (!reqUser?.id) {
    return { closedBy: null, closedByName: 'System', closedByKind: 'system' };
  }

  const user = await User.findById(reqUser.id).select('name role hospitalId').lean();
  if (!user) {
    return {
      closedBy: reqUser.id,
      closedByName: reqUser.name || 'Unknown user',
      closedByKind: reqUser.role === 'admin' ? 'admin' : 'system',
    };
  }

  if (user.role === 'admin') {
    return {
      closedBy: user._id,
      closedByName: user.name || 'Admin',
      closedByKind: 'admin',
    };
  }

  if (user.role === 'hospital') {
    const ownsHospital = await Hospital.exists({ userId: user._id });
    if (ownsHospital) {
      return {
        closedBy: user._id,
        closedByName: user.name || 'Hospital Admin',
        closedByKind: 'hospital_owner',
      };
    }
    if (user.hospitalId) {
      return {
        closedBy: user._id,
        closedByName: user.name || 'Hospital Team',
        closedByKind: 'hospital_team',
      };
    }
    return {
      closedBy: user._id,
      closedByName: user.name || 'Hospital User',
      closedByKind: 'hospital_owner',
    };
  }

  return {
    closedBy: user._id,
    closedByName: user.name || 'User',
    closedByKind: user.role || 'system',
  };
}

function applyCloserToReferral(referral, actor) {
  if (!referral || !actor) return;
  referral.closedBy = actor.closedBy || undefined;
  referral.closedByName = actor.closedByName;
  referral.closedByKind = actor.closedByKind;
}

const CLOSER_KIND_LABELS = {
  hospital_owner: 'Hospital Admin',
  hospital_team: 'Hospital Team',
  admin: 'Admin',
  system: 'System',
  jazzcash: 'JazzCash Payment',
};

function closerKindLabel(kind) {
  return CLOSER_KIND_LABELS[kind] || kind || 'Unknown';
}

module.exports = {
  resolveCloserActor,
  applyCloserToReferral,
  closerKindLabel,
  CLOSER_KIND_LABELS,
};
