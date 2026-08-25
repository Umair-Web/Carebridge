/** Effective external (consultant/hospital) patient-details view access. */
function effectiveDetailsViewAccess(referral) {
  if (!referral) return 'suspended';
  if (referral.status === 'closed') {
    // Closed stays suspended unless admin explicitly re-activates.
    return referral.detailsViewAccess === 'active' ? 'active' : 'suspended';
  }
  if (referral.detailsViewAccess === 'suspended') return 'suspended';
  return 'active';
}

/** Strip sensitive patient fields from list payloads when external view is suspended. */
function redactReferralDetailsIfSuspended(referral) {
  const access = effectiveDetailsViewAccess(referral);
  const base = { ...referral, detailsViewAccess: access };
  if (access === 'active') return base;
  return {
    ...base,
    phone: undefined,
    cnic: undefined,
    guardianName: undefined,
    guardianRelation: undefined,
    area: undefined,
    symptomsText: undefined,
    symptomTags: [],
    summaryNotes: undefined,
    diagnosisText: undefined,
    notes: undefined,
    attachments: [],
    clinicalNotes: [],
  };
}

module.exports = {
  effectiveDetailsViewAccess,
  redactReferralDetailsIfSuspended,
};
