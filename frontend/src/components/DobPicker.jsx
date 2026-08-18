import { useEffect, useState } from 'react';
import { DAYS, MONTHS, yearOptions, partsToIso, isoToParts } from '../utils/dob';

/**
 * Three Day / Month / Year combo boxes that emit a single ISO 'YYYY-MM-DD'
 * string. Used everywhere a patient's date of birth is captured so the
 * behaviour stays identical across the app.
 *
 * Props:
 *  - value:    current DOB as an ISO string (or '' / Date) — controlled.
 *  - onChange: called with the ISO string ('' while the date is incomplete).
 *  - className: optional class applied to each <select>.
 *  - disabled:  optional, disables all three selects.
 */
const DobPicker = ({ value, onChange, className = '', disabled = false }) => {
  // Hold partial parts internally so a half-finished selection isn't lost
  // (partsToIso returns '' until all three fields are set).
  const [parts, setParts] = useState(() => isoToParts(value));

  // Re-sync when the parent supplies a different complete value (e.g. edit form
  // is populated). Skip when the parent simply echoes back what we emitted.
  useEffect(() => {
    if (partsToIso(parts) !== (value || '')) {
      setParts(isoToParts(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const update = (key, v) => {
    const next = { ...parts, [key]: v };
    setParts(next);
    onChange(partsToIso(next));
  };

  const base =
    className ||
    'w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white';

  return (
    <div className="grid grid-cols-3 gap-2">
      <select value={parts.day} onChange={(e) => update('day', e.target.value)} className={base} disabled={disabled}>
        <option value="">Day</option>
        {DAYS.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select value={parts.month} onChange={(e) => update('month', e.target.value)} className={base} disabled={disabled}>
        <option value="">Month</option>
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
      <select value={parts.year} onChange={(e) => update('year', e.target.value)} className={base} disabled={disabled}>
        <option value="">Year</option>
        {yearOptions().map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
};

export default DobPicker;
