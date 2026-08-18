import { useState, useEffect } from 'react';
import { Wallet, TrendingUp, Eye, FileText, Check, Clock, ExternalLink, AlertCircle, Landmark } from 'lucide-react';
import api from '../utils/api';
import { formatPkr } from '../utils/formatPkr';
import toast from 'react-hot-toast';
import DetailModal from '../components/DetailModal';
import { generateEarningsPDF } from '../utils/pdfGenerator';

const ConsultantEarnings = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [manualPayouts, setManualPayouts] = useState([]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      const [earningsRes, manualRes] = await Promise.all([
        api.get('/referrals/earnings'),
        api.get('/settlements/consultant')
      ]);
      if (earningsRes.data.success) setData(earningsRes.data.data);
      if (manualRes.data.success) setManualPayouts(manualRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch earnings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmManualPayout = async (settlementId) => {
    try {
      const res = await api.post(`/settlements/consultant/${settlementId}/verify`);
      if (res.data.success) {
        toast.success('Payout receipt successfully confirmed and verified!');
        fetchEarnings(); // Refresh wallet balances and listings
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm payout');
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500 dark:text-slate-400">
        <Wallet className="w-8 h-8 animate-pulse text-blue-500" />
      </div>
    );
  }
  if (!data) {
    return <div className="text-center text-red-600 dark:text-red-400 py-12">Could not load earnings.</div>;
  }

  const payouts = data.payouts || [];

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50 transition-colors">Earnings</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">Accrued payouts when hospitals close billed cases (§12.2).</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (data) {
                try {
                  const headers = ['Date', 'Referral', 'Patient', 'Status', 'Amount (PKR)'];
                  const rows = (data.payouts || []).map(p => [
                    new Date(p.createdAt).toLocaleDateString(),
                    p.referralId?.referralCode || 'N/A',
                    p.referralId?.patientName || 'N/A',
                    p.status,
                    (p.amountPaisa / 100).toFixed(2)
                  ]);
                  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Earnings_Statement_${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  toast.success('CSV Statement downloaded');
                } catch (e) {
                  console.error(e);
                  toast.error('Failed to generate CSV');
                }
              }
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-850 shadow-sm transition-all"
          >
            <FileText size={16} className="text-green-600 dark:text-green-400" />
            CSV
          </button>
          <button
            onClick={async () => {
              if (data) {
                try {
                  await generateEarningsPDF(data.consultant || {}, data.referrals || [], data.payouts || []);
                  toast.success('PDF Statement downloaded');
                } catch (e) {
                  console.error(e);
                  toast.error('Failed to generate PDF');
                }
              }
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-850 shadow-sm transition-all"
          >
            <FileText size={16} className="text-blue-600 dark:text-blue-400" />
            PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Lifetime Earnings Card */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 shadow-sm relative overflow-hidden transition-colors">
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">Lifetime Earnings</p>
          <p className="text-3xl font-black mt-2 text-slate-900 dark:text-slate-50 tabular-nums transition-colors">{formatPkr(data.totalEarningsPaisa)}</p>
        </div>

        {/* This Month's Earnings Card */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 shadow-sm relative overflow-hidden transition-colors">
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">This Month's Earnings</p>
          <p className="text-3xl font-black mt-2 text-slate-900 dark:text-slate-50 tabular-nums transition-colors">{formatPkr(data.monthlyEarningsPaisa)}</p>
        </div>

        {/* Active Referrals Card */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex items-center gap-5 transition-colors">
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 shadow-inner">
            <TrendingUp className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Active Referrals</p>
            <p className="text-3xl font-black text-slate-900 dark:text-slate-50 mt-1 transition-colors">{data.referralCount}</p>
          </div>
        </div>
      </div>
 
      {/* Manual settlements payouts section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-colors">
        <div className="px-5 sm:px-8 py-5 border-b border-slate-100 dark:border-slate-800 transition-colors">
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Landmark size={20} className="text-blue-500" />
            Weekly Settlement Payouts
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Manual commissions processed and distributed by the platform admin (§12.4).</p>
        </div>
 
        <div className="p-5 sm:p-8 space-y-4">
          {manualPayouts.length === 0 ? (
            <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-6">
              No manual settlements payouts dispatched to your account yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {manualPayouts.map(item => (
                <div 
                  key={item.myPayoutId}
                  className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">
                        {item.hospitalName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap">
                        ({new Date(item.billingPeriodStart).toLocaleDateString()} - {new Date(item.billingPeriodEnd).toLocaleDateString()})
                      </span>
                    </div>
 
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-slate-455 dark:text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-0.5">Amount Dispatched</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatPkr(item.amountPaisa)}</span>
                      </div>
                      <div>
                        <span className="text-slate-455 dark:text-slate-500 block text-[10px] font-bold uppercase tracking-wider mb-0.5">Workflow Status</span>
                        {item.status === 'pending_payout' && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-[9px] uppercase tracking-wider">
                            <Clock size={10} /> Disbursing Payment
                          </span>
                        )}
                        {item.status === 'pending_verification' && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-[9px] uppercase tracking-wider animate-pulse">
                            <AlertCircle size={10} /> Paid, Pending Sign-off
                          </span>
                        )}
                        {item.status === 'verified' && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold text-[9px] uppercase tracking-wider">
                            <Check size={10} /> Verified & Signed Off
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
 
                  {/* Actions right */}
                  <div className="shrink-0 flex items-center flex-wrap gap-2.5">
                    {item.payoutReceiptFileUrl && (
                      <a 
                        href={item.payoutReceiptFileUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350 rounded-xl font-bold text-xs shadow-sm transition-all"
                      >
                        <ExternalLink size={13} /> View Receipt Proof
                      </a>
                    )}
                    
                    {item.status === 'pending_verification' && (
                      <button
                        onClick={() => handleConfirmManualPayout(item.settlementId)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                      >
                        <Check size={14} /> Confirm Receipt of Funds
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
 
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="px-5 sm:px-8 py-5 border-b border-slate-100 dark:border-slate-800 transition-colors">
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-50">Payout history</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Per-case accruals from completed admissions</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[480px]">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider transition-colors border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-5 sm:px-8 py-3.5">Date</th>
                <th className="px-5 sm:px-8 py-3.5">Referral</th>
                <th className="px-5 sm:px-8 py-3.5">Patient</th>
                <th className="px-5 sm:px-8 py-3.5">Status</th>
                <th className="px-5 sm:px-8 py-3.5 text-right">Amount</th>
                <th className="px-5 sm:px-8 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-10 text-center text-slate-500 dark:text-slate-400">
                    No payouts yet — completed cases will appear here.
                  </td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p._id}
                    className="hover:bg-blue-50/30 dark:hover:bg-slate-850/50 transition-colors cursor-pointer"
                    onClick={() => setSelected(p)}
                  >
                    <td className="px-5 sm:px-8 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap text-sm">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 sm:px-8 py-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      {p.referralId?.referralCode || '—'}
                    </td>
                    <td className="px-5 sm:px-8 py-4 text-sm font-semibold text-slate-600 dark:text-slate-200">
                      {p.referralId?.patientName || '—'}
                    </td>
                    <td className="px-5 sm:px-8 py-4">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 text-xs font-bold transition-colors">
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 sm:px-8 py-4 text-right font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatPkr(p.amountPaisa)}
                    </td>
                    <td className="px-3 py-4" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelected(p)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payout Detail Slide-over */}
      <DetailModal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Payout Details"
        subtitle={selected ? `${selected.referralId?.referralCode || 'N/A'} · ${formatPkr(selected.amountPaisa)}` : ''}
      >
        {selected && (
          <div className="space-y-6">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-5 text-center transition-colors">
              <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Amount Earned</p>
              <p className="text-4xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">{formatPkr(selected.amountPaisa)}</p>
              <span className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 transition-colors">
                {selected.status}
              </span>
            </div>

            {selected.referralId && (
              <div>
                <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Linked Referral</p>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-xl grid grid-cols-2 gap-4 transition-colors">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Referral Code</p>
                    <p className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">{selected.referralId.referralCode}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Patient</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{selected.referralId.patientName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Status</p>
                    <p className="text-sm font-medium capitalize text-slate-800 dark:text-slate-100">{selected.referralId.status || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Submitted</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{selected.referralId.createdAt ? new Date(selected.referralId.createdAt).toLocaleDateString('en-PK') : '—'}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-slate-100 dark:border-slate-800 pt-5 transition-colors">
              <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Payout Timeline</p>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Accrued On</p><p className="text-sm font-medium text-slate-800 dark:text-slate-100">{new Date(selected.createdAt).toLocaleString('en-PK')}</p></div>
                {selected.paidAt && <div><p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Paid At</p><p className="text-sm font-medium text-slate-800 dark:text-slate-100">{new Date(selected.paidAt).toLocaleString('en-PK')}</p></div>}
              </div>
            </div>
          </div>
        )}
      </DetailModal>


    </div>
  );
};

export default ConsultantEarnings;
