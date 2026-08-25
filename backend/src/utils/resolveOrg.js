/**
 * Org resolvers — map an authenticated user to their Hospital / Laboratory.
 *
 * Historically every portal endpoint did `Hospital.findOne({ userId: req.user.id })`,
 * which assumes a strict 1:1 between a User and its facility. With team sub-users
 * (staff logins added from inside a portal) that assumption no longer holds: a
 * sub-user owns no facility document and is instead linked via `User.hospitalId`
 * / `User.labId`.
 *
 * These helpers preserve the original fast path for owner accounts (a single
 * findOne, identical to before — zero behaviour/perf change for existing users)
 * and only fall back to the sub-user linkage when the caller owns no facility.
 *
 * Both return a live Mongoose document (never `.lean()`), so callers may still
 * mutate and `.save()` the result exactly as they did before.
 */

const User = require('../models/User');
const Hospital = require('../models/Hospital');
const Laboratory = require('../models/Laboratory');

/**
 * Resolve the Hospital for the authenticated request user.
 * @param {{ id: string }} reqUser - the decoded JWT payload (req.user)
 * @returns {Promise<import('mongoose').Document|null>}
 */
async function getHospitalForUser(reqUser) {
  const userId = reqUser?.id;
  if (!userId) return null;

  // Owner fast path — unchanged from the original behaviour.
  const owned = await Hospital.findOne({ userId });
  if (owned) return owned;

  // Sub-user path — resolve via the linked facility id on the User document.
  const linked = await User.findById(userId).select('hospitalId').lean();
  if (linked?.hospitalId) {
    return Hospital.findById(linked.hospitalId);
  }
  return null;
}

/**
 * Resolve the Laboratory for the authenticated request user.
 * @param {{ id: string }} reqUser - the decoded JWT payload (req.user)
 * @returns {Promise<import('mongoose').Document|null>}
 */
async function getLabForUser(reqUser) {
  const userId = reqUser?.id;
  if (!userId) return null;

  const owned = await Laboratory.findOne({ userId });
  if (owned) return owned;

  const linked = await User.findById(userId).select('labId').lean();
  if (linked?.labId) {
    return Laboratory.findById(linked.labId);
  }
  return null;
}

module.exports = { getHospitalForUser, getLabForUser };
