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

const emptyBedRow = (ward) => ({
  ward,
  totalBeds: 0,
  occupiedBeds: 0,
  availableBeds: 0,
});

const findBedRow = (inventory, ward) => {
  const name = String(ward || '').trim().toLowerCase();
  if (!name) return undefined;
  return (inventory || []).find((b) => String(b.ward || '').trim().toLowerCase() === name);
};

/**
 * Keep `bedsInventory` aligned with configured departments:
 * one row per department, drop leftover ward-type rows.
 * Returns true when the inventory was mutated.
 */
const syncBedsInventoryWithDepartments = (hospital) => {
  if (!hospital) return false;
  const names = getDepartmentNames(hospital);
  const nameSet = new Set(names);
  const existing = Array.isArray(hospital.bedsInventory) ? [...hospital.bedsInventory] : [];

  const byName = new Map();
  for (const row of existing) {
    const ward = String(row.ward || '').trim();
    if (!ward || !nameSet.has(ward) || byName.has(ward)) continue;
    byName.set(ward, row);
  }

  const next = names.map((name) => byName.get(name) || emptyBedRow(name));
  const changed =
    existing.length !== next.length ||
    existing.some((row, i) => String(row.ward || '').trim() !== names[i]);

  if (changed) {
    hospital.bedsInventory = next;
  }
  return changed;
};

const getActiveBedsInventory = (hospital) => {
  const active = new Set(getActiveDepartmentNames(hospital));
  return (hospital.bedsInventory || []).filter((b) => active.has(String(b.ward || '').trim()));
};

module.exports = {
  asNameList,
  getDepartmentNames,
  getActiveDepartmentNames,
  isDepartmentActive,
  normalizeDepartmentsUpdate,
  emptyBedRow,
  findBedRow,
  syncBedsInventoryWithDepartments,
  getActiveBedsInventory,
};
