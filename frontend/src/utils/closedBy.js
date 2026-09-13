/** Human-readable labels for referral.closedByKind */
export const CLOSER_KIND_LABELS = {
  hospital_owner: 'Hospital Admin',
  hospital_team: 'Hospital Team',
  admin: 'Admin',
  system: 'System',
  jazzcash: 'JazzCash Payment',
};

export function closerKindLabel(kind) {
  return CLOSER_KIND_LABELS[kind] || kind || '';
}

/** e.g. "Ali Khan (Hospital Team)" or "JazzCash Payment" */
export function formatClosedBy(referral) {
  if (!referral) return null;
  const name = referral.closedByName?.trim();
  const kind = closerKindLabel(referral.closedByKind);
  if (!name && !kind) return null;
  if (name && kind && name !== kind) return `${name} (${kind})`;
  return name || kind;
}
