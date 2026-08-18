import { useState, useEffect, useCallback } from 'react';
import { Landmark, Search, Eye, FileText } from 'lucide-react';
import api from '../utils/api';
import { formatPkr } from '../utils/formatPkr';
import toast from 'react-hot-toast';
import DetailModal from '../components/DetailModal';
import Loader from '../components/Loader';

const HospitalLedger = () => {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const fetchLedger = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/hospitals/financial-ledger');
      if (res.data.success) {
        setPayouts(res.data.data || []);
      }
    } catch (err) {
      toast.error('Failed to load financial ledger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // Calculations
  const totalBilled = payouts.reduce((acc, curr) => acc + (curr.totalBillPaisa || 0), 0);
  const totalPlatformCut = payouts.reduce((acc, curr) => acc + (curr.platformCutPaisa || 0), 0);
  const totalHospitalNet = totalBilled - totalPlatformCut;

  const filtered = payouts.filter(p =>
    p.referralId?.referralCode?.toLowerCase().includes(search.toLowerCase()) ||
    p.referralId?.patientName?.toLowerCase().includes(search.toLowerCase()) ||
    p.consultantId?.userId?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCSV = () => {
    try {
      const headers = ['Date', 'Case Code', 'Patient', 'Consultant', 'Billed Amount (PKR)', 'Platform Cut (PKR)', 'Net Revenue (PKR)'];
      const rows = payouts.map(p => {
        const hNet = (p.totalBillPaisa || 0) - (p.platformCutPaisa || 0);
        return [
          new Date(p.createdAt).toLocaleDateString(),
          p.referralId?.referralCode || 'N/A',
          p.referralId?.patientName || 'N/A',
          p.consultantId?.userId?.name || 'N/A',
          ((p.totalBillPaisa || 0) / 100).toFixed(2),
          ((p.platformCutPaisa || 0) / 100).toFixed(2),
          (hNet / 100).toFixed(2)
        ];
      });
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Hospital_Financial_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('Ledger statement CSV downloaded');
    } catch (e) {
      toast.error('Failed to export CSV');
    }
  };

  if (loading) return <Loader message="Loading ledger..." />;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-teal-100 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 shadow-md">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50 transition-colors">Financial Ledger</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">Audit complete dynamic billing splits, platform cuts, and doctor shares.</p>
          </div>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all shrink-0 active:scale-95"
        >
          <FileText size={16} className="text-teal-600 dark:text-teal-400" />
          Export Statement
        </button>
      </div>

      {/* Grid of metrics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-1.5 transition-colors">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Gross Billing</p>
          <p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-50 tabular-nums transition-colors">{formatPkr(totalBilled)}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Total payments collected</p>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-900 dark:bg-teal-950/20 border border-slate-800 dark:border-teal-900/40 p-5 rounded-2xl shadow-lg space-y-1.5 text-white dark:text-slate-100 transition-colors">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Platform Cut</p>
          <p className="text-2xl sm:text-3xl font-black text-slate-100 dark:text-teal-400 tabular-nums transition-colors">{formatPkr(totalPlatformCut)}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Automatically deducted cut</p>
        </div>

        {/* Metric 3 */}
        <div className="bg-teal-50/50 dark:bg-slate-900 border border-teal-100/60 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-1.5 transition-colors">
          <p className="text-[10px] font-black text-teal-700 dark:text-teal-400 uppercase tracking-widest">Net Revenue</p>
          <p className="text-2xl sm:text-3xl font-black text-teal-800 dark:text-teal-300 tabular-nums transition-colors">{formatPkr(totalHospitalNet)}</p>
          <p className="text-[10px] text-teal-600/80 dark:text-teal-400/80">Hospital net profit kept</p>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by case code, patient name, doctor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 placeholder-slate-500 dark:placeholder-slate-400 text-sm focus:ring-2 focus:ring-teal-500 outline-none shadow-sm transition-colors"
          />
        </div>

        {/* Table representation */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[700px]">
              <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider transition-colors border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Case Code</th>
                  <th className="px-5 py-3.5">Patient</th>
                  <th className="px-5 py-3.5">Consultant</th>
                  <th className="px-5 py-3.5 text-right">Billed Amount</th>
                  <th className="px-5 py-3.5 text-right">Platform Cut</th>
                  <th className="px-5 py-3.5 text-right">Net Kept</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-slate-400 dark:text-slate-500">
                      No financial transactions logged yet. Completed cases will appear here.
                    </td>
                  </tr>
                ) : (
                  filtered.map(p => {
                    const hospitalNet = (p.totalBillPaisa || 0) - (p.platformCutPaisa || 0);
                    return (
                      <tr
                        key={p._id}
                        onClick={() => setSelected(p)}
                        className="hover:bg-teal-50/20 dark:hover:bg-teal-950/10 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {new Date(p.createdAt).toLocaleDateString('en-PK')}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap">
                          {p.referralId?.referralCode || '—'}
                        </td>
                        <td className="px-5 py-4 text-slate-700 dark:text-slate-200 whitespace-nowrap font-semibold">
                          {p.referralId?.patientName || '—'}
                        </td>
                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          Dr. {p.consultantId?.userId?.name || '—'}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                          {formatPkr(p.totalBillPaisa)}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold tabular-nums text-red-500 dark:text-red-400">
                          -{formatPkr(p.platformCutPaisa)}
                        </td>
                        <td className="px-5 py-4 text-right font-extrabold tabular-nums text-teal-600 dark:text-teal-400">
                          {formatPkr(hospitalNet)}
                        </td>
                        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setSelected(p)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                          >
                            <Eye size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Hospital Payout Split Details Slide-over */}
      <DetailModal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Transaction & Split Ledger"
        subtitle={selected ? `${selected.referralId?.referralCode || 'N/A'} · ${formatPkr(selected.totalBillPaisa)}` : ''}
      >
        {selected && (
          <div className="space-y-6">
            {/* Split breakdown */}
            <div className="bg-slate-950 dark:bg-slate-900 border border-slate-800 dark:border-slate-800 rounded-2xl p-5 text-white space-y-4 relative overflow-hidden transition-colors">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl -mr-16 -mt-16" />
              
              <div className="relative z-10 text-center border-b border-white/10 dark:border-slate-800 pb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Bill Paid</p>
                <p className="text-3xl font-black text-white dark:text-teal-400 tabular-nums mt-1">{formatPkr(selected.totalBillPaisa)}</p>
              </div>

              <div className="relative z-10 space-y-3 pt-2">
                {/* Hospital Kept */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Hospital Revenue Kept ({100 - (selected.deductionPercentage || 20)}%)</span>
                  <span className="font-extrabold text-teal-400">{formatPkr((selected.totalBillPaisa || 0) - (selected.platformCutPaisa || 0))}</span>
                </div>

                {/* Total Platform Fee */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Platform Total Cut ({selected.deductionPercentage || 20}%)</span>
                  <span className="font-semibold text-red-400">{formatPkr(selected.platformCutPaisa)}</span>
                </div>
              </div>
            </div>

            {/* Referral Info */}
            {selected.referralId && (
              <div className="space-y-3">
                <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Patient & Case Details</p>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl grid grid-cols-2 gap-4 text-xs transition-colors">
                  <div>
                    <p className="text-slate-400 dark:text-slate-500 font-bold">Patient Name</p>
                    <p className="font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">{selected.referralId.patientName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 dark:text-slate-500 font-bold">Case Code</p>
                    <p className="font-mono font-bold text-teal-600 dark:text-teal-400 mt-0.5">{selected.referralId.referralCode}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 dark:text-slate-500 font-bold">Department</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">{selected.referralId.department || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 dark:text-slate-500 font-bold">Urgency Level</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5 capitalize">{selected.referralId.urgency || '—'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Doctor Info */}
            {selected.consultantId && (
              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-5 transition-colors">
                <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Accredited Physician</p>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between text-xs transition-colors">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100">Dr. {selected.consultantId.userId?.name || '—'}</p>
                    <p className="text-slate-400 dark:text-slate-500 mt-0.5">{selected.consultantId.userId?.email || '—'}</p>
                  </div>
                  <span className="bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-400 px-2.5 py-1 rounded font-black text-[10px] tracking-wider uppercase">
                    {selected.consultantId.pmdcNumber || '—'}
                  </span>
                </div>
              </div>
            )}

            {/* Timeline info */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-5 text-xs text-slate-400 dark:text-slate-500 flex justify-between transition-colors">
              <span>Billed & Discharged on:</span>
              <span className="font-bold text-slate-600 dark:text-slate-300">{new Date(selected.createdAt).toLocaleString('en-PK')}</span>
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  );
};

export default HospitalLedger;
