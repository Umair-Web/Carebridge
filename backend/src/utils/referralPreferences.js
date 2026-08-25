const mongoose = require('mongoose');
const HospitalDoctor = require('../models/HospitalDoctor');
const { getDepartmentNames, isDepartmentActive } = require('./hospitalDepartments');

/**
 * Apply department + target doctor for the active hospital from rankedHospitalPreferences.
 */
function applyPreferenceForHospital(referral, hospitalId) {
  if (!hospitalId || !referral.rankedHospitalPreferences?.length) return;

  const hid = hospitalId.toString();
  const pref = referral.rankedHospitalPreferences.find(
    (p) => p.hospitalId && p.hospitalId.toString() === hid
  );
  if (!pref) return;

  if (pref.department) {
    referral.department = String(pref.department).trim();
  }
  if (pref.targetDoctorId) {
    referral.targetDoctorId = pref.targetDoctorId;
  } else {
    referral.targetDoctorId = undefined;
  }
}

/**
 * Validate and normalize rankedHospitalPreferences against ranked hospitals.
 * @returns {{ preferences: Array, error: string|null }}
 */
async function normalizeRankedHospitalPreferences(rawPreferences, rankedHospitalDocs, fallbackDepartment) {
  const hospitalById = new Map(rankedHospitalDocs.map((h) => [h._id.toString(), h]));
  const rankedIds = rankedHospitalDocs.map((h) => h._id.toString());

  if (!Array.isArray(rawPreferences) || rawPreferences.length === 0) {
    if (!fallbackDepartment) {
      return { preferences: [], error: 'Department is required for referral routing' };
    }
    const preferences = rankedHospitalDocs.map((h) => ({
      hospitalId: h._id,
      department: fallbackDepartment,
      targetDoctorId: undefined,
    }));
    return { preferences, error: null };
  }

  const preferences = [];
  const seen = new Set();

  for (const raw of rawPreferences) {
    const hospitalId = raw.hospitalId;
    if (!hospitalId || !mongoose.Types.ObjectId.isValid(hospitalId)) {
      return { preferences: [], error: 'Invalid hospital in preferences' };
    }
    const hid = hospitalId.toString();
    if (!hospitalById.has(hid)) {
      return { preferences: [], error: 'Preference hospital must be in ranked list' };
    }
    if (seen.has(hid)) continue;
    seen.add(hid);

    const hospital = hospitalById.get(hid);
    const department = String(raw.department || fallbackDepartment || '').trim();
    if (!department) {
      return { preferences: [], error: `Department is required for ${hospital.hospitalName}` };
    }

    const knownDepts = getDepartmentNames(hospital);
    if (knownDepts.length) {
      if (knownDepts.includes(department)) {
        if (!isDepartmentActive(hospital, department)) {
          return {
            preferences: [],
            error: `Department "${department}" is currently inactive at ${hospital.hospitalName}`,
          };
        }
      } else if (department !== fallbackDepartment) {
        return {
          preferences: [],
          error: `Department "${department}" is not offered by ${hospital.hospitalName}`,
        };
      }
    }

    let targetDoctorId;
    if (raw.targetDoctorId && mongoose.Types.ObjectId.isValid(raw.targetDoctorId)) {
      const doctor = await HospitalDoctor.findOne({
        _id: raw.targetDoctorId,
        hospitalId: hospital._id,
      });
      if (!doctor) {
        return { preferences: [], error: 'Selected doctor does not belong to the chosen hospital' };
      }
      targetDoctorId = doctor._id;
    }

    preferences.push({
      hospitalId: hospital._id,
      department,
      ...(targetDoctorId ? { targetDoctorId } : {}),
    });
  }

  for (const hid of rankedIds) {
    if (!seen.has(hid)) {
      const hospital = hospitalById.get(hid);
      const department = String(fallbackDepartment || '').trim();
      if (!department) {
        return { preferences: [], error: `Department is required for ${hospital.hospitalName}` };
      }
      preferences.push({
        hospitalId: hospital._id,
        department,
        targetDoctorId: undefined,
      });
    }
  }

  preferences.sort(
    (a, b) => rankedIds.indexOf(a.hospitalId.toString()) - rankedIds.indexOf(b.hospitalId.toString())
  );

  return { preferences, error: null };
}

module.exports = {
  applyPreferenceForHospital,
  normalizeRankedHospitalPreferences,
};
