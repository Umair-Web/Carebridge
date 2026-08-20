/** Effective external (consultant/hospital) patient-details view access. */
export function detailsViewAccessOf(referral) {
  if (referral?.status === 'closed') {
    // Closed stays suspended unless admin explicitly re-activates.
    return referral.detailsViewAccess === 'active' ? 'active' : 'suspended';
  }
  if (referral?.detailsViewAccess === 'suspended') return 'suspended';
  return 'active';
}

/**
 * Lab referral consultant-view access.
 * Default is active (including missing field). Closed does NOT auto-suspend.
 */
export function labDetailsViewAccessOf(referral) {
  return referral?.detailsViewAccess === 'suspended' ? 'suspended' : 'active';
}
