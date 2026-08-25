/** Lab referral consultant-view access (default active; no auto-suspend on closed). */
function labDetailsViewAccessOf(referral) {
  return referral?.detailsViewAccess === 'suspended' ? 'suspended' : 'active';
}

/** Strip sensitive fields from consultant list payloads when view is suspended. */
function redactLabReferralIfSuspended(referral) {
  const access = labDetailsViewAccessOf(referral);
  const base = { ...(referral.toObject ? referral.toObject() : referral), detailsViewAccess: access };
  let out = base;
  if (access !== 'active') {
    out = {
      ...base,
      phone: undefined,
      cnic: undefined,
      guardianName: undefined,
      guardianRelation: undefined,
      area: undefined,
      summaryNotes: undefined,
      symptomsText: undefined,
      notes: undefined,
      attachments: [],
      reportFiles: [],
      services: [],
      patientBillFileUrl: undefined,
      recommendedTests: (base.recommendedTests || []).map((t) => ({ testName: t.testName, note: undefined })),
    };
  }
  // Closed referrals: hide billing from consultant views.
  if (base.status === 'closed') {
    out = {
      ...out,
      services: [],
      grossAmountPaisa: undefined,
      discountAmountPaisa: undefined,
      billTotalPaisa: undefined,
      paymentMethod: undefined,
      paymentReference: undefined,
      patientBillFileUrl: undefined,
    };
  }
  return out;
}

module.exports = {
  labDetailsViewAccessOf,
  redactLabReferralIfSuspended,
};
