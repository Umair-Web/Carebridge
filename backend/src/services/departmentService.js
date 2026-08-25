const DepartmentCatalog = require('../models/DepartmentCatalog');

const FALLBACK = 'Internal Medicine';

const STATIC_FALLBACK = {
  'chest pain': 'Cardiology',
  'shortness of breath': 'Cardiology',
  fracture: 'Orthopedics',
  'bone pain': 'Orthopedics',
  headache: 'Neurology',
  seizure: 'Neurology',
  'stomach ache': 'Gastroenterology',
  fever: 'Internal Medicine',
};

/**
 * Map free-text symptoms to a department name using catalog keywords, then static fallback.
 */
async function resolveDepartmentFromSymptoms(symptomsText) {
  const raw = typeof symptomsText === 'string' ? symptomsText.trim() : '';
  if (!raw) {
    const def = await DepartmentCatalog.findOne({ isActive: true, name: FALLBACK }).select('name').lean();
    return def?.name || FALLBACK;
  }

  const lower = raw.toLowerCase();
  const catalog = await DepartmentCatalog.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();

  if (catalog.length > 0) {
    for (const row of catalog) {
      for (const kw of row.keywords || []) {
        if (kw && lower.includes(String(kw).toLowerCase())) {
          return row.name;
        }
      }
    }
    const internal = catalog.find((d) => d.name === FALLBACK);
    if (internal) return internal.name;
    return catalog[0].name;
  }

  const parts = lower.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    if (STATIC_FALLBACK[p]) return STATIC_FALLBACK[p];
  }
  return FALLBACK;
}

module.exports = { resolveDepartmentFromSymptoms, FALLBACK };
