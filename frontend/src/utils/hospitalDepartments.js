/** Active department names for hospital profile / suggestion payloads. */
export function getActiveDepartments(hospitalOrDepts, inactiveMaybe) {
  const departments = Array.isArray(hospitalOrDepts)
    ? hospitalOrDepts
    : hospitalOrDepts?.departments || [];
  const inactive = Array.isArray(inactiveMaybe)
    ? inactiveMaybe
    : hospitalOrDepts?.inactiveDepartments || [];
  const inactiveSet = new Set(inactive);
  return (departments || []).filter((d) => typeof d === 'string' && !inactiveSet.has(d));
}
