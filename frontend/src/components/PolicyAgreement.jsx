import { useState } from 'react';
import { ShieldCheck, Maximize2 } from 'lucide-react';

/**
 * Privacy & Policy (SOP) agreement gate shown before the register button.
 * Displays the SOP document image and a required consent checkbox. The parent
 * uses `agreed` to enable/disable submission.
 *
 * accent: tailwind color key used by the register page ('blue' | 'sky' | 'teal').
 */
const ACCENTS = {
  blue: { ring: 'focus:ring-blue-500', text: 'text-blue-600', accent: 'accent-blue-600', border: 'border-blue-200', bg: 'bg-blue-50' },
  sky: { ring: 'focus:ring-sky-500', text: 'text-sky-600', accent: 'accent-sky-600', border: 'border-sky-200', bg: 'bg-sky-50' },
  teal: { ring: 'focus:ring-teal-500', text: 'text-teal-600', accent: 'accent-teal-600', border: 'border-teal-200', bg: 'bg-teal-50' },
};

const PolicyAgreement = ({ agreed, onChange, accent = 'blue' }) => {
  const c = ACCENTS[accent] || ACCENTS.blue;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Privacy &amp; Policy</h3>
        <div className="flex-1 h-px bg-slate-100"></div>
      </div>

      <div className={`rounded-2xl border ${c.border} ${c.bg} p-4`}>
        <p className="text-xs text-slate-600 font-medium mb-3">
          Please review the Standard Operating Procedures and Privacy Policy below before continuing.
        </p>

        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white">
          <img
            src="/SOP.jpeg"
            alt="Standard Operating Procedures and Privacy Policy"
            className="w-full max-h-72 object-contain object-top bg-white"
          />
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="absolute top-2 right-2 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/60 text-white text-xs font-semibold hover:bg-black/75 transition-colors"
          >
            <Maximize2 size={13} /> View full
          </button>
        </div>

        <label className="flex items-start gap-3 mt-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => onChange(e.target.checked)}
            className={`mt-0.5 h-5 w-5 rounded ${c.accent} ${c.ring} cursor-pointer`}
          />
          <span className="text-sm text-slate-700">
            I have read and agree to the{' '}
            <span className={`font-semibold ${c.text} inline-flex items-center gap-1`}>
              <ShieldCheck size={14} /> Privacy Policy &amp; Standard Operating Procedures
            </span>
            .
          </span>
        </label>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setExpanded(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-auto rounded-xl bg-white" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-bold hover:bg-black/80"
            >
              Close ✕
            </button>
            <img src="/SOP.jpeg" alt="Standard Operating Procedures and Privacy Policy" className="w-full h-auto" />
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyAgreement;
