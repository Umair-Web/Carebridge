import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Search, X } from 'lucide-react';
import { SPECIALTY_CATEGORIES, DEFAULT_SPECIALTY, ALL_SPECIALTIES } from '../utils/specialties';

/**
 * Searchable specialty picker with category groupings.
 * Users can also submit a custom specialty if it is not in the catalog.
 * value / onChange use the specialty string (same as a native <select>).
 */
const SpecialtySearchSelect = ({
  value = DEFAULT_SPECIALTY,
  onChange,
  name = 'specialty',
  required = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  const trimmedQuery = query.trim();

  const filtered = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    if (!q) return SPECIALTY_CATEGORIES;

    return SPECIALTY_CATEGORIES.map((group) => {
      const categoryMatch = group.category.toLowerCase().includes(q);
      const specialties = categoryMatch
        ? group.specialties
        : group.specialties.filter((s) => s.toLowerCase().includes(q));
      return specialties.length ? { ...group, specialties } : null;
    }).filter(Boolean);
  }, [trimmedQuery]);

  const totalMatches = useMemo(
    () => filtered.reduce((n, g) => n + g.specialties.length, 0),
    [filtered]
  );

  const exactMatch = useMemo(() => {
    if (!trimmedQuery) return null;
    const q = trimmedQuery.toLowerCase();
    return ALL_SPECIALTIES.find((s) => s.toLowerCase() === q) || null;
  }, [trimmedQuery]);

  const canUseCustom = trimmedQuery.length >= 2 && !exactMatch;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  const pick = (spec) => {
    const next = String(spec || '').trim();
    if (!next) return;
    onChange?.({ target: { name, value: next } });
    setOpen(false);
    setQuery('');
  };

  const onSearchKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (exactMatch) {
      pick(exactMatch);
    } else if (canUseCustom) {
      pick(trimmedQuery);
    }
  };

  const isCustomSelected =
    value && !ALL_SPECIALTIES.some((s) => s.toLowerCase() === String(value).toLowerCase());

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {/* Hidden input so native form required validation still works */}
      <input type="text" name={name} value={value || ''} required={required} readOnly tabIndex={-1} className="sr-only" aria-hidden />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm bg-white text-left flex items-center justify-between gap-2"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`text-sm truncate ${value ? 'text-slate-900' : 'text-slate-400'}`}>
          {value || 'Search or select specialty…'}
          {isCustomSelected && (
            <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">Custom</span>
          )}
        </span>
        <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 mt-1.5 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Type to search or add your specialty…"
                className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 px-1">
              {trimmedQuery
                ? `${totalMatches} match${totalMatches === 1 ? '' : 'es'}${canUseCustom ? ' · Enter to add custom' : ''}`
                : 'Browse by category, search, or type a custom specialty'}
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto overscroll-contain" role="listbox">
            {canUseCustom && (
              <button
                type="button"
                role="option"
                onClick={() => pick(trimmedQuery)}
                className="w-full text-left px-4 py-3 text-sm border-b border-slate-100 bg-blue-50/80 hover:bg-blue-50 text-blue-800 flex items-start gap-2"
              >
                <Plus size={16} className="mt-0.5 shrink-0 text-blue-600" />
                <span>
                  <span className="font-bold">Add custom specialty</span>
                  <span className="block text-blue-700/90 mt-0.5">“{trimmedQuery}”</span>
                </span>
              </button>
            )}

            {filtered.length === 0 && !canUseCustom ? (
              <p className="px-4 py-6 text-sm text-slate-500 text-center">
                Type at least 2 characters to add a custom specialty.
              </p>
            ) : (
              filtered.map((group) => (
                <div key={group.category}>
                  <p className="sticky top-0 z-[1] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-100">
                    {group.category}
                  </p>
                  {group.specialties.map((spec) => {
                    const selected = spec === value;
                    return (
                      <button
                        key={spec}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => pick(spec)}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          selected
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {spec}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpecialtySearchSelect;
