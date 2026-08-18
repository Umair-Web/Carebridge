import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Receipt, Calendar, Upload, FileText, ArrowRight, Clock, Info, Landmark, CheckCircle2, AlertCircle,
} from 'lucide-react';
import api from '../../utils/api';
import { formatPkr } from '../../utils/formatPkr';
import toast from 'react-hot-toast';
import Loader from '../../components/Loader';

const STATUS_BADGE = (status) => {
  const map = {
    pending_payment: ['bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400', Clock, 'Pending Manual Pay'],
    pending_admin_verification: ['bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400', Info, 'Under Admin Verification'],
    paid_pending_consultant_payout: ['bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400', Landmark, 'Paid, Distributing Payouts'],
    paid_pending_consultant_verification: ['bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400', Clock, 'Payouts Dispatched'],
    completed: ['bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400', CheckCircle2, 'Completed'],
  };
  const [cls, Icon, label] = map[status] || ['bg-slate-100 text-slate-600', Info, status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${cls}`}>
      <Icon size={12} /> {label}
    </span>
  );
};

const uploadFile = async (file) => {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  if (!res.data.success) throw new Error('Upload failed');
  return res.data.url;
};

const LabSettlements = () => {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [uploadingNewReceipt, setUploadingNewReceipt] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState({});

  const { data: pending = [], isLoading: l1 } = useQuery({
    queryKey: ['lab-pending-referrals'],
    queryFn: async () => (await api.get('/lab-settlements/pending-referrals')).data.data,
  });
  const { data: settlements = [], isLoading: l2 } = useQuery({
    queryKey: ['lab-settlements-mine'],
    queryFn: async () => (await api.get('/lab-settlements/mine')).data.data,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['lab-pending-referrals'] });
    queryClient.invalidateQueries({ queryKey: ['lab-settlements-mine'] });
    queryClient.invalidateQueries({ queryKey: ['lab-dashboard'] });
  };

  const toggle = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const selectedObjs = pending.filter((r) => selected.includes(r._id));
  const grossPaisa = selectedObjs.reduce((s, r) => s + (r.billTotalPaisa || 0), 0);
  const platformChargePaisa = selectedObjs.reduce((s, r) => s + (r.platformChargePaisa || 0), 0);
  const commissionPaisa = selectedObjs.reduce((s, r) => s + (r.doctorCommissionPaisa || 0), 0);
  const platformCutPaisa = selectedObjs.reduce((s, r) => s + (r.calculatedPlatformCutPaisa || 0), 0);

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploadingNewReceipt(true);
      setReceiptFile(await uploadFile(file));
      toast.success('Receipt uploaded');
    } catch {
      toast.error('Failed to upload receipt');
    } finally {
      setUploadingNewReceipt(false);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (selected.length === 0) return toast.error('Select at least one closed case');
    if (!receiptFile) return toast.error('Upload your payment receipt');
    let periodStart = start;
    let periodEnd = end;
    if (!periodStart || !periodEnd) {
      const dates = selectedObjs.map((r) => new Date(r.completedAt || r.updatedAt).getTime());
      if (dates.length) {
        if (!periodStart) periodStart = new Date(Math.min(...dates)).toISOString();
        if (!periodEnd) periodEnd = new Date(Math.max(...dates)).toISOString();
      }
    }
    try {
      const res = await api.post('/lab-settlements', {
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        labReferralIds: selected,
        labReceiptFileUrl: receiptFile,
        notes,
      });
      if (res.data.success) {
        toast.success('Settlement submitted');
        setSelected([]); setStart(''); setEnd(''); setReceiptFile(null); setNotes('');
        refresh();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create settlement');
    }
  };

  const uploadReceipt = async (settlementId, file) => {
    if (!file) return;
    try {
      setUploadingReceipt((s) => ({ ...s, [settlementId]: true }));
      const url = await uploadFile(file);
      const res = await api.post(`/lab-settlements/${settlementId}/receipt`, { labReceiptFileUrl: url });
      if (res.data.success) {
        toast.success('Receipt submitted');
        refresh();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload receipt');
    } finally {
      setUploadingReceipt((s) => ({ ...s, [settlementId]: false }));
    }
  };

  if (l1 && l2) return <Loader message="Loading settlements..." />;

  const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-sky-500 outline-none';

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-start gap-3 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-md">
          <Receipt className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50">Weekly Settlement</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Compile closed cases, pay the platform fee, and upload your receipt.</p>
        </div>
      </div>

      {/* Create */}
      <form onSubmit={create} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-50 flex items-center gap-2"><Calendar size={18} className="text-sky-500" /> Compile New Billing Period</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Start (optional)</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">End (optional)</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Closed cases ({selected.length} chosen)</label>
          <p className="text-[11px] text-slate-400 mb-2">Selecting a case automatically attaches its patient bill — no separate summary needed.</p>
          <div className="border border-slate-100 dark:border-slate-800 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {pending.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-slate-400">No closed-but-unsettled cases.</div>
            ) : (
              pending.map((r) => (
                <label key={r._id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <input type="checkbox" checked={selected.includes(r._id)} onChange={() => toggle(r._id)} className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500" />
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">{r.referralCode}</span>
                      <span className="text-xs text-slate-500 ml-2">{r.patientName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {r.patientBillFileUrl && (
                        <a
                          href={r.patientBillFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline"
                        >
                          <FileText size={12} /> Bill
                        </a>
                      )}
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200 tabular-nums">{formatPkr(r.billTotalPaisa)}</span>
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {selected.length > 0 && (
          <div className="bg-slate-900 text-white rounded-xl p-5 space-y-3">
            <div className="flex justify-between border-b border-white/10 pb-3"><span className="text-xs text-slate-400 font-bold">Gross Billed</span><span className="text-lg font-black tabular-nums">{formatPkr(grossPaisa)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-400">Platform Charge</span><span className="font-bold text-slate-200 tabular-nums">{formatPkr(platformChargePaisa)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-400">Doctor Commission</span><span className="font-bold text-slate-200 tabular-nums">{formatPkr(commissionPaisa)}</span></div>
            <div className="flex justify-between border-t border-dashed border-white/10 pt-3"><span className="text-xs text-slate-300 font-black">Total Due to Platform</span><span className="text-xl font-extrabold text-sky-400 tabular-nums">{formatPkr(platformCutPaisa)}</span></div>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Upload paid receipt</label>
          <p className="text-[11px] text-slate-400 mb-2">Pay the platform fee shown above, then attach your payment receipt here to submit in one step.</p>
          <div className="flex items-center gap-4">
            <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40">
              <Upload className="w-7 h-7 text-slate-400 mb-2" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{uploadingNewReceipt ? 'Uploading…' : receiptFile ? 'Receipt attached' : 'Browse receipt (PDF/JPG/PNG)'}</span>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleReceiptUpload} disabled={uploadingNewReceipt} className="hidden" />
            </label>
            {receiptFile && <a href={receiptFile} target="_blank" rel="noreferrer" className="text-xs text-sky-600 font-bold underline">View</a>}
          </div>
        </div>

        <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} h-20`} />

        <button type="submit" disabled={selected.length === 0 || !receiptFile} className="w-full flex items-center justify-center gap-2 py-3 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-sm rounded-xl disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 transition-all">
          Submit Settlement & Await Verification <ArrowRight size={16} />
        </button>
      </form>

      {/* History */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-50">Settlement Log</h2>
        {settlements.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-400">
            <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-sm font-bold">No settlements submitted yet.</p>
          </div>
        ) : (
          settlements.map((s) => (
            <div key={s._id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800 dark:text-slate-200">
                  <span>{new Date(s.billingPeriodStart).toLocaleDateString()}</span>
                  <ArrowRight size={14} className="text-slate-400" />
                  <span>{new Date(s.billingPeriodEnd).toLocaleDateString()}</span>
                </div>
                {STATUS_BADGE(s.status)}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div><span className="text-slate-400 font-bold uppercase block mb-0.5">Platform</span><span className="font-bold tabular-nums">{formatPkr(s.platformChargeTotalPaisa ?? s.calculatedPlatformCutPaisa)}</span></div>
                <div><span className="text-slate-400 font-bold uppercase block mb-0.5">Commission</span><span className="font-bold tabular-nums">{formatPkr(s.doctorCommissionTotalPaisa ?? 0)}</span></div>
                <div><span className="text-slate-400 font-bold uppercase block mb-0.5">Total Due</span><span className="font-black text-sky-600 dark:text-sky-400 tabular-nums">{formatPkr(s.facilityTotalPayablePaisa ?? s.calculatedPlatformCutPaisa)}</span></div>
                <div><span className="text-slate-400 font-bold uppercase block mb-0.5">Cases</span><span className="font-bold">{s.labReferralIds?.length || 0}</span></div>
              </div>

              {s.rejectionReason && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 p-3 rounded-xl flex gap-2 text-xs text-red-700 dark:text-red-400">
                  <AlertCircle size={16} className="shrink-0 text-red-500" />
                  <div><span className="font-black">Receipt rejected:</span> {s.rejectionReason}</div>
                </div>
              )}

              {s.status === 'pending_payment' && (
                <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400">Pay {formatPkr(s.calculatedPlatformCutPaisa)} to the platform, then upload your receipt.</p>
                  <label className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-lg cursor-pointer">
                    <Upload size={14} /> {uploadingReceipt[s._id] ? 'Uploading…' : 'Upload Receipt'}
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => uploadReceipt(s._id, e.target.files[0])} disabled={uploadingReceipt[s._id]} className="hidden" />
                  </label>
                </div>
              )}

              <div className="flex flex-wrap gap-3 text-xs pt-1">
                {(s.labReferralIds || []).filter((r) => r && r.patientBillFileUrl).map((r) => (
                  <a key={r._id} href={r.patientBillFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-800"><FileText size={13} className="text-sky-600" /> Bill · {r.referralCode}</a>
                ))}
                {s.billSummaryFileUrl && <a href={s.billSummaryFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-800"><FileText size={13} className="text-sky-600" /> Bill Summary</a>}
                {s.labReceiptFileUrl && <a href={s.labReceiptFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg font-bold hover:bg-slate-50 dark:hover:bg-slate-800"><FileText size={13} className="text-sky-600" /> Payment Receipt</a>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LabSettlements;
