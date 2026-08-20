import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, FileText, Pencil, Save, Plus, Trash2 } from 'lucide-react';
import api from '../utils/api';
import { formatPkr } from '../utils/formatPkr';
import toast from 'react-hot-toast';
import DobPicker from './DobPicker';
import { ageFromDob, formatDob, formatAge, ageLabel } from '../utils/dob';
import { labDetailsViewAccessOf } from '../utils/referralAccess';

const STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  accepted: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  reported: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  closed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
};

const Field = ({ label, children }) => (
  <div>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{children ?? '—'}</p>
  </div>
);

const input = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-sky-500 outline-none';

const toLocalDT = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const off = dt.getTimezoneOffset();
  return new Date(dt.getTime() - off * 60000).toISOString().slice(0, 16);
};

/**
 * Full lab-referral detail. Read-only for consultants; admins (editable=true) get an inline edit form
 * that saves via PATCH /admin/labs/referrals/:id. Admin can Activate/Suspend consultant view (no password).
 */
const LabReferralDetailModal = ({ referralId, editable = false, onClose, onSaved }) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [togglingAccess, setTogglingAccess] = useState(false);

  const { data: referral, isLoading, isError, error } = useQuery({
    queryKey: ['lab-referral-detail', referralId],
    queryFn: async () => (await api.get(`/lab-referrals/${referralId}`)).data.data,
    retry: false,
  });

  useEffect(() => {
    if (referral && !form) {
      setForm({
        patientName: referral.patientName || '',
        dateOfBirth: referral.dateOfBirth || '',
        age: referral.age ?? '',
        gender: referral.gender || 'male',
        phone: referral.phone || '',
        area: referral.area || '',
        guardianName: referral.guardianName || '',
        guardianRelation: referral.guardianRelation || 'S/O',
        urgency: referral.urgency || 'routine',
        status: referral.status || 'pending',
        summaryNotes: referral.summaryNotes || '',
        notes: referral.notes || '',
        discountPercentage: referral.discountPercentage || 0,
        expectedReportAt: toLocalDT(referral.expectedReportAt),
        recommendedTests: referral.recommendedTests?.length ? referral.recommendedTests : [{ testName: '', note: '' }],
        services: referral.services?.length ? referral.services.map((s) => ({ ...s })) : [],
      });
    }
  }, [referral, form]);

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const toggleDetailsViewAccess = async () => {
    if (!referral?._id) return;
    const next = labDetailsViewAccessOf(referral) === 'active' ? 'suspended' : 'active';
    try {
      setTogglingAccess(true);
      const res = await api.patch(`/admin/labs/referrals/${referral._id}/details-view-access`, {
        detailsViewAccess: next,
      });
      if (res.data.success) {
        queryClient.setQueryData(['lab-referral-detail', referralId], (prev) =>
          prev ? { ...prev, detailsViewAccess: next } : prev
        );
        queryClient.invalidateQueries({ queryKey: ['admin-lab-referrals'] });
        queryClient.invalidateQueries({ queryKey: ['my-lab-referrals'] });
        toast.success(res.data.message || `Consultant view set to ${next}`);
        onSaved?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update view access');
    } finally {
      setTogglingAccess(false);
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      const payload = {
        ...form,
        age: Number(form.age),
        discountPercentage: Number(form.discountPercentage) || 0,
        expectedReportAt: form.expectedReportAt || undefined,
        recommendedTests: form.recommendedTests.filter((t) => t.testName.trim()),
        services: form.services.filter((s) => String(s.description || '').trim()),
      };
      const res = await api.patch(`/admin/labs/referrals/${referralId}`, payload);
      if (res.data.success) {
        toast.success('Referral updated');
        setEditing(false);
        queryClient.invalidateQueries({ queryKey: ['lab-referral-detail', referralId] });
        onSaved?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update referral');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-50">{referral?.patientName || 'Lab Referral'}</h2>
            <p className="font-mono text-xs text-sky-600 dark:text-sky-400">{referral?.referralCode}</p>
          </div>
          <div className="flex items-center gap-2">
            {editable && !editing && referral && (
              <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg"><Pencil size={13} /> Edit</button>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={18} /></button>
          </div>
        </div>

        {isError ? (
          <div className="p-10 text-center text-sm text-amber-700 dark:text-amber-400">
            {error?.response?.data?.message || 'Patient details viewing is suspended by admin'}
          </div>
        ) : isLoading || !referral || !form ? (
          <div className="p-10 text-center text-slate-400 text-sm">Loading…</div>
        ) : !editing ? (
          // ── Read-only ──
          <div className="p-5 space-y-6">
            {editable && (
              <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                  labDetailsViewAccessOf(referral) === 'active'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                }`}>
                  Consultant view: {labDetailsViewAccessOf(referral)}
                </span>
                <button
                  type="button"
                  onClick={toggleDetailsViewAccess}
                  disabled={togglingAccess}
                  className={`inline-flex h-9 items-center gap-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all disabled:opacity-50 ${
                    labDetailsViewAccessOf(referral) === 'active'
                      ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400'
                  }`}
                >
                  {togglingAccess ? '…' : labDetailsViewAccessOf(referral) === 'active' ? 'Suspend' : 'Activate'}
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${STATUS_BADGE[referral.status]}`}>{referral.status}</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{referral.urgency}</span>
            </div>

            <section className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Patient">{referral.patientName}</Field>
              <Field label="Date of Birth">{formatDob(referral.dateOfBirth) || '—'}</Field>
              <Field label="Age / Gender">{ageLabel(referral)} • {referral.gender}</Field>
              <Field label="Phone">{referral.phone}</Field>
              <Field label="CNIC">{referral.cnic}</Field>
              <Field label="Area">{referral.area}</Field>
              <Field label="Guardian">{referral.guardianName ? `${referral.guardianRelation} ${referral.guardianName}` : '—'}</Field>
              <Field label="Laboratory">{referral.targetLaboratoryId?.labName}</Field>
              <Field label="Consultant">{referral.consultantId?.userId?.name}</Field>
              <Field label="Discount">{referral.discountPercentage || 0}%</Field>
              <Field label="Expected Report">{referral.expectedReportAt ? new Date(referral.expectedReportAt).toLocaleString() : '—'}</Field>
              <Field label="Created">{new Date(referral.createdAt).toLocaleString()}</Field>
              <Field label="Closed">{referral.closedAt ? new Date(referral.closedAt).toLocaleString() : '—'}</Field>
            </section>

            <section>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Recommended Tests</p>
              <div className="flex flex-wrap gap-1.5">
                {(referral.recommendedTests || []).map((t, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 text-xs font-semibold" title={t.note}>{t.testName}</span>
                ))}
              </div>
            </section>

            {referral.summaryNotes && <section><Field label="Clinical Summary">{referral.summaryNotes}</Field></section>}
            {referral.rejectionReason && <p className="text-xs text-red-600">Declined: {referral.rejectionReason}</p>}

            <section>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reports</p>
              {referral.reportFiles?.length ? (
                <div className="flex flex-wrap gap-2">
                  {referral.reportFiles.map((f, i) => (
                    <a key={i} href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-100">
                      <FileText size={13} />
                      {f.testName ? <span className="font-black">{f.testName}:</span> : null} {f.name || `Report ${i + 1}`}
                    </a>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-400">No reports uploaded.</p>}
            </section>

            {(editable || referral.status !== 'closed') && (referral.services?.length > 0 || referral.billTotalPaisa != null) && (
              <section className="bg-slate-900 text-white rounded-xl p-4 space-y-2 text-sm">
                {(referral.services || []).map((s, i) => (
                  <div key={i} className="flex justify-between text-slate-300"><span>{s.description}</span><span className="tabular-nums">{formatPkr(s.amountPaisa)}</span></div>
                ))}
                <div className="flex justify-between border-t border-white/10 pt-2"><span className="text-slate-400">Gross</span><span className="font-bold tabular-nums">{formatPkr(referral.grossAmountPaisa || 0)}</span></div>
                <div className="flex justify-between text-emerald-400"><span>Discount ({referral.discountPercentage || 0}%)</span><span className="tabular-nums">- {formatPkr(referral.discountAmountPaisa || 0)}</span></div>
                <div className="flex justify-between border-t border-white/10 pt-2"><span className="font-black">Net</span><span className="font-black text-sky-400 tabular-nums">{formatPkr(referral.billTotalPaisa || 0)}</span></div>
                {referral.patientBillFileUrl && <a href={referral.patientBillFileUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-400 underline">View patient bill</a>}
              </section>
            )}
          </div>
        ) : (
          // ── Admin edit ──
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="text-xs font-bold text-slate-500">Patient name</label><input className={input} value={form.patientName} onChange={(e) => setF('patientName', e.target.value)} /></div>
              <div className="sm:col-span-2"><label className="text-xs font-bold text-slate-500">Date of Birth</label><DobPicker value={form.dateOfBirth} onChange={(iso) => setForm((p) => ({ ...p, dateOfBirth: iso, age: ageFromDob(iso) }))} className={input} /></div>
              <div><label className="text-xs font-bold text-slate-500">Age (auto)</label><input type="text" readOnly disabled title="Auto-calculated from date of birth" className={`${input} bg-slate-50 dark:bg-slate-800/60 cursor-not-allowed`} value={formatAge(form.dateOfBirth)} /></div>
              <div><label className="text-xs font-bold text-slate-500">Gender</label><select className={input} value={form.gender} onChange={(e) => setF('gender', e.target.value)}><option value="male">male</option><option value="female">female</option><option value="other">other</option></select></div>
              <div><label className="text-xs font-bold text-slate-500">Phone</label><input className={input} value={form.phone} onChange={(e) => setF('phone', e.target.value)} /></div>
              <div><label className="text-xs font-bold text-slate-500">Area</label><input className={input} value={form.area} onChange={(e) => setF('area', e.target.value)} /></div>
              <div><label className="text-xs font-bold text-slate-500">Urgency</label><select className={input} value={form.urgency} onChange={(e) => setF('urgency', e.target.value)}><option value="routine">routine</option><option value="urgent">urgent</option><option value="emergency">emergency</option></select></div>
              <div><label className="text-xs font-bold text-slate-500">Status</label><select className={input} value={form.status} onChange={(e) => setF('status', e.target.value)}>{['pending', 'accepted', 'reported', 'closed', 'rejected'].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              <div><label className="text-xs font-bold text-slate-500">Discount %</label><input type="number" min={0} max={100} className={input} value={form.discountPercentage} onChange={(e) => setF('discountPercentage', e.target.value)} /></div>
              <div className="sm:col-span-2"><label className="text-xs font-bold text-slate-500">Expected report</label><input type="datetime-local" className={input} value={form.expectedReportAt} onChange={(e) => setF('expectedReportAt', e.target.value)} /></div>
              <div className="sm:col-span-2"><label className="text-xs font-bold text-slate-500">Clinical summary</label><textarea className={`${input} h-16`} value={form.summaryNotes} onChange={(e) => setF('summaryNotes', e.target.value)} /></div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">Recommended tests</label>
              <div className="space-y-2 mt-1">
                {form.recommendedTests.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input className={input} placeholder="Test" value={t.testName} onChange={(e) => setForm((p) => ({ ...p, recommendedTests: p.recommendedTests.map((x, idx) => idx === i ? { ...x, testName: e.target.value } : x) }))} />
                    <input className={`${input} flex-1`} placeholder="Note" value={t.note || ''} onChange={(e) => setForm((p) => ({ ...p, recommendedTests: p.recommendedTests.map((x, idx) => idx === i ? { ...x, note: e.target.value } : x) }))} />
                    <button onClick={() => setForm((p) => ({ ...p, recommendedTests: p.recommendedTests.filter((_, idx) => idx !== i) }))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
                  </div>
                ))}
                <button onClick={() => setForm((p) => ({ ...p, recommendedTests: [...p.recommendedTests, { testName: '', note: '' }] }))} className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600"><Plus size={14} /> Add test</button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <button onClick={() => setEditing(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 font-bold text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg disabled:opacity-60"><Save size={16} /> Save</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LabReferralDetailModal;
