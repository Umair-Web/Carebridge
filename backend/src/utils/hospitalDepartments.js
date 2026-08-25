/**
 * Hospital departments are stored as string names on `hospital.departments`.
 * Availability is controlled via `hospital.inactiveDepartments` (names listed there are off).
 */

const asNameList = (raw) => {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .map((d) => {
          if (typeof d === 'string') return d.trim();
          if (d && typeof d === 'object' && d.name != null) return String(d.name).trim();
          return '';
        })
        .filter(Boolean)
    ),
  ];
};

const getInactiveSet = (hospitalOrInactive) => {
  const list = Array.isArray(hospitalOrInactive)
    ? hospitalOrInactive
    : hospitalOrInactive?.inactiveDepartments;
  return new Set(asNameList(list));
};

/** All configured department names (active + inactive). */
const getDepartmentNames = (hospital) => asNameList(hospital?.departments);

/** Departments currently accepting referrals. */
const getActiveDepartmentNames = (hospital) => {
  const inactive = getInactiveSet(hospital);
  return getDepartmentNames(hospital).filter((name) => !inactive.has(name));
};

const isDepartmentActive = (hospital, departmentName) => {
  const name = String(departmentName || '').trim();
  if (!name) return false;
  const names = getDepartmentNames(hospital);
  if (!names.includes(name)) return false;
  return !getInactiveSet(hospital).has(name);
};

/**
 * Normalize PATCH body. Accepts string[] departments and optional inactiveDepartments.
 * Prunes inactive entries that are no longer in departments.
 */
const normalizeDepartmentsUpdate = (departmentsInput, inactiveInput) => {
  const departments = asNameList(departmentsInput);
  const inactiveDepartments = asNameList(inactiveInput).filter((name) => departments.includes(name));
  return { departments, inactiveDepartments };
};

module.exports = {
  asNameList,
  getDepartmentNames,
  getActiveDepartmentNames,
  isDepartmentActive,
  normalizeDepartmentsUpdate,
};
