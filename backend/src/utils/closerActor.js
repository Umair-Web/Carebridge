const User = require('../models/User');
const Hospital = require('../models/Hospital');
const Laboratory = require('../models/Laboratory');

/**
 * Resolve who closed a patient/referral for audit display.
 * @param {{ id?: string, role?: string, name?: string }|null} reqUser
 * @returns {Promise<{ closedBy: import('mongoose').Types.ObjectId|null, closedByName: string, closedByKind: string }>}
 */
async function resolveCloserActor(reqUser) {
  if (!reqUser?.id) {
    return { closedBy: null, closedByName: 'System', closedByKind: 'system' };
  }

  const user = await User.findById(reqUser.id).select('name role hospitalId labId').lean();
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

  if (user.role === 'laboratory') {
    const ownsLab = await Laboratory.exists({ userId: user._id });
    if (ownsLab) {
      return {
        closedBy: user._id,
        closedByName: user.name || 'Lab Admin',
        closedByKind: 'lab_owner',
      };
    }
    if (user.labId) {
      return {
        closedBy: user._id,
        closedByName: user.name || 'Lab Team',
        closedByKind: 'lab_team',
      };
    }
    return {
      closedBy: user._id,
      closedByName: user.name || 'Lab User',
      closedByKind: 'lab_owner',
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

/** Lab referrals only store closedBy + closedByName (no closedByKind). */
function applyCloserToLabReferral(referral, actor) {
  if (!referral || !actor) return;
  referral.closedBy = actor.closedBy || undefined;
  referral.closedByName = actor.closedByName;
}

const CLOSER_KIND_LABELS = {
  hospital_owner: 'Hospital Admin',
  hospital_team: 'Hospital Team',
  lab_owner: 'Lab Admin',
  lab_team: 'Lab Team',
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
  applyCloserToLabReferral,
  closerKindLabel,
  CLOSER_KIND_LABELS,
};
