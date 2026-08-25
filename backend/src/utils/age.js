/**
 * Date-of-birth helpers. DOB is the source of truth for a patient's age across
 * the platform; `age` is always derived from it so the two never drift.
 */

/**
 * Whole-year age from a date of birth.
 * @param {Date|string} dob - Date object or ISO 'YYYY-MM-DD' string.
 * @returns {number|null} Age in years, or null when dob is missing/invalid.
 */
function ageFromDob(dob) {
  if (!dob) return null;
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - date.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < date.getUTCDate())) {
    age--;
  }
  return age >= 0 && age <= 150 ? age : null;
}

/**
 * Elapsed age broken into { years, months, days }.
 * @returns {{years:number, months:number, days:number}|null}
 */
function ageParts(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();
  if (birth.getTime() > now.getTime()) return null;

  let years = now.getUTCFullYear() - birth.getUTCFullYear();
  let months = now.getUTCMonth() - birth.getUTCMonth();
  let days = now.getUTCDate() - birth.getUTCDate();

  if (days < 0) {
    months -= 1;
    // Days in the month before the current one.
    days += new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

/**
 * Human-friendly age that adapts its unit to the patient's age:
 * days for under a month, months for under a year, otherwise years.
 * @returns {string} e.g. "5 days", "3 months", "2 years" ('' when invalid).
 */
function formatAge(dob) {
  const parts = ageParts(dob);
  if (!parts) return '';
  if (parts.years >= 1) return parts.years === 1 ? '1 year' : `${parts.years} years`;
  if (parts.months >= 1) return parts.months === 1 ? '1 month' : `${parts.months} months`;
  return parts.days === 1 ? '1 day' : `${parts.days} days`;
}

module.exports = { ageFromDob, ageParts, formatAge };
