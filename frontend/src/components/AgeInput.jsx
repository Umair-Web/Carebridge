import { useEffect, useRef, useState } from 'react';
import { AGE_UNITS, ageInputToIso, isoToAgeInput } from '../utils/dob';

/**
 * Manual age entry: a numeric box (accepts decimals like 1.5) plus a unit combo
 * box (Years / Months / Days). DOB remains the platform-wide source of truth, so
 * the typed amount + unit is converted to an approximate date of birth and the
 * parent receives that ISO string — keeping every age display across the app
 * consistent without any backend change.
 *
 * Props:
 *  - value:     current DOB as an ISO string (or '' / Date) — controlled.
 *  - onChange:  called with (isoDob, { amount, unit }); isoDob is '' when empty.
 *  - className: optional class applied to both the input and the select.
 *  - disabled:  optional, disables both controls.
 */
const AgeInput = ({ value, onChange, className = '', disabled = false }) => {
  const [amount, setAmount] = useState(() => isoToAgeInput(value).amount);
  const [unit, setUnit] = useState(() => isoToAgeInput(value).unit);
  // Remember the ISO we last emitted so we ignore the parent echoing it back.
  const emittedIso = useRef(ageInputToIso(isoToAgeInput(value).amount, isoToAgeInput(value).unit));

  // Re-sync when the parent replaces the value externally (form reset / edit populate).
  useEffect(() => {
    if ((value || '') === emittedIso.current) return;
    const next = isoToAgeInput(value);
    setAmount(next.amount);
    setUnit(next.unit);
    emittedIso.current = value || '';
  }, [value]);

  const emit = (nextAmount, nextUnit) => {
    const iso = ageInputToIso(nextAmount, nextUnit);
    emittedIso.current = iso;
    onChange(iso, { amount: nextAmount, unit: nextUnit });
  };

  const base =
    className ||
    'w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white';

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={amount}
          disabled={disabled}
          placeholder="e.g. 1.5"
          onChange={(e) => {
            setAmount(e.target.value);
            emit(e.target.value, unit);
          }}
          className={`${base} w-full`}
        />
      </div>
      <div className="w-32 flex-none">
        <select
          value={unit}
          disabled={disabled}
          onChange={(e) => {
            setUnit(e.target.value);
            emit(amount, e.target.value);
          }}
          className={`${base} w-full`}
        >
          {AGE_UNITS.map((u) => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default AgeInput;
