import { useEffect, useState, useCallback } from 'react';
import { Banknote, Eye } from 'lucide-react';
import api from '../../utils/api';
import { formatPkr } from '../../utils/formatPkr';
import DetailModal from '../../components/DetailModal';

const statusBadge = (status) => {
  const map = {
    pending:  'bg-amber-50 text-amber-700',
    paid:     'bg-emerald-50 text-emerald-700',
    failed:   'bg-red-50 text-red-600',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
};

const Field = ({ label, value }) => (
  <div>
    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
    <p className="text-sm font-medium text-slate-800">{value || '—'}</p>
  </div>
);

const AdminPayouts = () => {
  const [rows, setRows]     = useState([]);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/payouts');
      if (res.data.success) setRows(res.data.data || []);
    } catch {/* silent */}
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
          <Banknote className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payout Log</h1>
          <p className="text-slate-500 text-sm mt-1">
            Consultant accruals triggered on case completion. Click any row to see details.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-5 py-3.5 font-semibold">Date</th>
              <th className="px-5 py-3.5 font-semibold">Consultant</th>
              <th className="px-5 py-3.5 font-semibold">Referral Code</th>
              <th className="px-5 py-3.5 font-semibold">Amount</th>
              <th className="px-5 py-3.5 font-semibold">Status</th>
              <th className="px-5 py-3.5 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                  No payouts yet.
                </td>
              </tr>
            ) : rows.map((p) => (
              <tr key={p._id}
                className="hover:bg-emerald-50/30 transition-colors cursor-pointer"
                onClick={() => setSelected(p)}
              >
                <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 text-xs">
                  {new Date(p.createdAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-slate-800">{p.consultantId?.userId?.name || '—'}</p>
                  <p className="text-xs text-slate-400 font-mono">{p.consultantId?.pmdcNumber || ''}</p>
                </td>
                <td className="px-5 py-3.5 font-mono text-xs font-medium text-blue-600">
                  {p.referralId?.referralCode || '—'}
                </td>
                <td className="px-5 py-3.5 font-bold text-emerald-700 tabular-nums">
                  {formatPkr(p.amountPaisa)}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize ${statusBadge(p.status)}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelected(p); }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-colors"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Slide-over */}
      <DetailModal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Payout Details"
        subtitle={selected ? `${selected.referralId?.referralCode || 'N/A'} · ${formatPkr(selected.amountPaisa)}` : ''}
      >
        {selected && (
          <div className="space-y-6">
            {/* Amount Banner */}
            <div className="bg-emerald-50 rounded-xl p-5 text-center">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Payout Amount</p>
              <p className="text-4xl font-black text-emerald-700 tabular-nums">{formatPkr(selected.amountPaisa)}</p>
              <span className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-bold capitalize ${statusBadge(selected.status)}`}>
                {selected.status}
              </span>
            </div>

            {/* Consultant */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Consultant</p>
              <div className="bg-slate-50 p-4 rounded-xl grid grid-cols-2 gap-4">
                <Field label="Name"        value={selected.consultantId?.userId?.name} />
                <Field label="PMDC"        value={selected.consultantId?.pmdcNumber} />
                <Field label="Specialty"   value={selected.consultantId?.specialty} />
                <Field label="Promo Code"  value={selected.consultantId?.promoCode} />
              </div>
            </div>

            {/* Referral */}
            {selected.referralId && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Linked Referral</p>
                <div className="bg-slate-50 p-4 rounded-xl grid grid-cols-2 gap-4">
                  <Field label="Referral Code" value={selected.referralId.referralCode} />
                  <Field label="Patient"       value={selected.referralId.patientName} />
                  <Field label="Status"        value={selected.referralId.status} />
                  <Field label="Submitted"     value={selected.referralId.createdAt
                    ? new Date(selected.referralId.createdAt).toLocaleDateString('en-PK')
                    : null}
                  />
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Timestamps</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Created" value={new Date(selected.createdAt).toLocaleString('en-PK')} />
                {selected.paidAt && <Field label="Paid At" value={new Date(selected.paidAt).toLocaleString('en-PK')} />}
              </div>
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  );
};

export default AdminPayouts;
