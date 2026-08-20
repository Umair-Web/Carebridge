import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FlaskConical, Plus, Trash2, MapPin, Percent, FileText, RefreshCw, Wallet, CheckCircle2, Send, Download,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../utils/api';
import { formatPkr } from '../utils/formatPkr';
import toast from 'react-hot-toast';
import Loader from '../components/Loader';
import LabReferralDetailModal from '../components/LabReferralDetailModal';
import AgeInput from '../components/AgeInput';
import { ageFromDob } from '../utils/dob';
import { downloadPdf as downloadRecordPdf } from '../utils/downloadFile';
import { labDetailsViewAccessOf } from '../utils/referralAccess';

const TABS = [
  { key: 'new', label: 'New Referral' },
  { key: 'mine', label: 'My Referrals' },
  { key: 'earnings', label: 'Lab Earnings' },
];

const STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  accepted: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  reported: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  closed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
};

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-sky-500 outline-none';

// ── New referral form ──────────────────────────────────────────────────────────
const NewReferral = ({ onCreated }) => {
  const [patient, setPatient] = useState({ patientName: '', dateOfBirth: '', age: '', gender: 'male', phone: '', cnic: '', area: '', urgency: 'routine', summaryNotes: '' });
  const [tests, setTests] = useState([{ testName: '', note: '' }]);
  const [coords, setCoords] = useState({ lat: '24.8607', lng: '67.0099' });
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedLab, setSelectedLab] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // All registered laboratories — powers the "select by name" dropdown.
  const { data: allLabs = [], isLoading: loadingAllLabs } = useQuery({
    queryKey: ['all-labs'],
    queryFn: async () => (await api.get('/lab-referrals/suggestions')).data.suggestions || [],
  });

  // The consultant's own admin-set max patient discount (per-consultant cap,
  // not per-lab). Applies to every lab this consultant refers to.
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get('/profile/me')).data.data,
  });
  const maxDiscount = me?.profile?.maxLabDiscountPercentage ?? 0;

  const setField = (k, v) => setPatient((p) => ({ ...p, [k]: v }));
  const setTest = (i, k, v) => setTests((p) => p.map((t, idx) => (idx === i ? { ...t, [k]: v } : t)));
  const addTest = () => setTests((p) => [...p, { testName: '', note: '' }]);
  const removeTest = (i) => setTests((p) => p.filter((_, idx) => idx !== i));

  const detectLocation = () => {
    if (!navigator.geolocation) return toast.error('Geolocation not supported');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) });
        toast.success('Location detected');
      },
      () => toast.error('Could not detect location; enter manually')
    );
  };

  const findNearestLabs = async () => {
    const lat = parseFloat(coords.lat);
    const lng = parseFloat(coords.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return toast.error('Enter valid coordinates');
    try {
      setLoadingSuggestions(true);
      const res = await api.get('/lab-referrals/suggestions', { params: { lat, lng } });
      setSuggestions(res.data.suggestions || []);
      if ((res.data.suggestions || []).length === 0) toast('No matching active labs found', { icon: 'ℹ️' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to find labs');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const pickLab = (lab) => {
    setSelectedLab(lab);
    if (discount > maxDiscount) setDiscount(maxDiscount);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!selectedLab) return toast.error('Select a laboratory');
    if (!patient.dateOfBirth) return toast.error('Enter the patient’s age');
    const cleanTests = tests.filter((t) => t.testName.trim());
    if (cleanTests.length === 0) return toast.error('Add at least one recommended test');
    try {
      setSubmitting(true);
      const res = await api.post('/lab-referrals', {
        ...patient,
        age: Number(patient.age),
        recommendedTests: cleanTests,
        targetLaboratoryId: selectedLab.laboratoryId,
        discountPercentage: Number(discount) || 0,
      });
      if (res.data.success) {
        toast.success('Lab referral created');
        setPatient({ patientName: '', dateOfBirth: '', age: '', gender: 'male', phone: '', cnic: '', area: '', urgency: 'routine', summaryNotes: '' });
        setTests([{ testName: '', note: '' }]);
        setSelectedLab(null);
        setSuggestions([]);
        setDiscount(0);
        onCreated();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create referral');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Patient */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-50">Patient Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className={inputClass} placeholder="Patient name *" value={patient.patientName} onChange={(e) => setField('patientName', e.target.value)} required />
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Age *</label>
            <AgeInput
              value={patient.dateOfBirth}
              onChange={(iso) => setPatient((p) => ({ ...p, dateOfBirth: iso, age: ageFromDob(iso) }))}
              className={inputClass}
            />
          </div>
          <select className={inputClass} value={patient.gender} onChange={(e) => setField('gender', e.target.value)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          <input className={inputClass} placeholder="Phone (03XXXXXXXXX) *" value={patient.phone} onChange={(e) => setField('phone', e.target.value)} required />
          <input className={inputClass} placeholder="CNIC (optional) XXXXX-XXXXXXX-X" value={patient.cnic} onChange={(e) => setField('cnic', e.target.value)} />
          <input className={inputClass} placeholder="Area" value={patient.area} onChange={(e) => setField('area', e.target.value)} />
          <select className={inputClass} value={patient.urgency} onChange={(e) => setField('urgency', e.target.value)}>
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>
        <textarea className={`${inputClass} h-16`} placeholder="Clinical summary / notes (optional)" value={patient.summaryNotes} onChange={(e) => setField('summaryNotes', e.target.value)} />
      </div>

      {/* Tests */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-50">Recommended Tests</h3>
        <p className="text-xs text-slate-400">
          {selectedLab ? 'Pick from the lab’s catalog or type a custom test.' : 'Select a lab below to load its test catalog — you can also type any test.'}
        </p>
        <datalist id="lab-test-options">
          {(selectedLab?.testCatalog || []).map((t, i) => (
            <option key={i} value={t.testName}>{formatPkr(t.price)}</option>
          ))}
        </datalist>
        {tests.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <input list="lab-test-options" className={`${inputClass} flex-1`} placeholder="Test name (type or pick)" value={t.testName} onChange={(e) => setTest(i, 'testName', e.target.value)} />
            <button type="button" onClick={() => removeTest(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
          </div>
        ))}
        <button type="button" onClick={addTest} className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700"><Plus size={14} /> Add test</button>
      </div>

      {/* Lab picker */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-50">Choose Laboratory</h3>

        {/* Select by name (dropdown of all registered labs) */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">Select laboratory by name</label>
          <select
            className={inputClass}
            value={allLabs.some((l) => String(l.laboratoryId) === String(selectedLab?.laboratoryId)) ? selectedLab.laboratoryId : ''}
            onChange={(e) => {
              const lab = allLabs.find((l) => String(l.laboratoryId) === e.target.value);
              if (lab) pickLab(lab);
            }}
            disabled={loadingAllLabs}
          >
            <option value="">{loadingAllLabs ? 'Loading laboratories…' : 'Choose a registered laboratory…'}</option>
            {allLabs.map((lab) => (
              <option key={lab.laboratoryId} value={lab.laboratoryId}>
                {lab.labName || '(Unnamed laboratory)'}{lab.area || lab.city ? ` — ${lab.area || lab.city}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Or by nearest */}
        <div className="flex flex-wrap items-end gap-2 border-t border-slate-50 dark:border-slate-800 pt-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Latitude</label>
            <input className={`${inputClass} w-32`} value={coords.lat} onChange={(e) => setCoords((c) => ({ ...c, lat: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Longitude</label>
            <input className={`${inputClass} w-32`} value={coords.lng} onChange={(e) => setCoords((c) => ({ ...c, lng: e.target.value }))} />
          </div>
          <button type="button" onClick={detectLocation} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"><MapPin size={14} /> Detect</button>
          <button type="button" onClick={findNearestLabs} disabled={loadingSuggestions} className="inline-flex items-center gap-1.5 px-3 py-2 border border-sky-200 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/20 rounded-lg text-xs font-bold disabled:opacity-60">
            {loadingSuggestions ? 'Searching…' : 'Find nearest'}
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map((lab) => (
              <label key={lab.laboratoryId} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedLab?.laboratoryId === lab.laboratoryId ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20' : 'border-slate-200 dark:border-slate-800 hover:border-sky-300'}`}>
                <input type="radio" name="lab" checked={selectedLab?.laboratoryId === lab.laboratoryId} onChange={() => pickLab(lab)} className="text-sky-600 focus:ring-sky-500" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{lab.labName || '(Unnamed laboratory)'}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin size={11} className="shrink-0" /> {lab.area || lab.city} • {lab.distanceKm} km
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}

        {selectedLab && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1"><Percent size={13} /> Patient discount % (your max {maxDiscount}%)</label>
            <input
              type="number"
              min={0}
              max={maxDiscount}
              value={discount}
              onChange={(e) => {
                const v = Math.min(Number(e.target.value) || 0, maxDiscount);
                setDiscount(v);
              }}
              className={`${inputClass} w-32`}
            />
            <p className="text-[11px] text-slate-400 mt-1">Your maximum discount is set by the platform admin.</p>
          </div>
        )}
      </div>

      <button type="submit" disabled={submitting || !selectedLab} className="w-full flex items-center justify-center gap-2 py-3 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-sm rounded-xl disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 transition-all">
        <Send size={16} /> {submitting ? 'Submitting…' : 'Create Lab Referral'}
      </button>
    </form>
  );
};

// ── My referrals ────────────────────────────────────────────────────────────────
const MyReferrals = () => {
  const queryClient = useQueryClient();
  const [detailId, setDetailId] = useState(null);
  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['my-lab-referrals'],
    queryFn: async () => (await api.get('/lab-referrals/mine')).data.data,
  });

  const reRefer = async (id) => {
    const lat = 24.8607, lng = 67.0099;
    try {
      const res = await api.get('/lab-referrals/suggestions', { params: { lat, lng } });
      const labs = res.data.suggestions || [];
      if (labs.length === 0) return toast.error('No alternative labs available');
      const choice = window.prompt(
        `Re-refer to which lab? Enter a number:\n${labs.map((l, i) => `${i + 1}. ${l.labName} (${l.distanceKm} km)`).join('\n')}`
      );
      const idx = Number(choice) - 1;
      if (!labs[idx]) return;
      await api.patch(`/lab-referrals/${id}/re-refer`, { targetLaboratoryId: labs[idx].laboratoryId });
      toast.success('Re-referred');
      queryClient.invalidateQueries({ queryKey: ['my-lab-referrals'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to re-refer');
    }
  };

  if (isLoading) return <Loader message="Loading your lab referrals..." />;

  if (referrals.length === 0)
    return <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-400"><p className="text-sm font-bold">No lab referrals yet.</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => downloadRecordPdf('/exports/consultant/lab-referrals', 'My_Lab_Referrals.pdf')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-sky-600 rounded-xl shadow-sm hover:bg-sky-700 transition-all"
        >
          <Download size={16} /> Download All
        </button>
      </div>
      {referrals.map((r) => {
        const isSuspended = labDetailsViewAccessOf(r) === 'suspended';
        return (
        <div
          key={r._id}
          onClick={() => {
            if (isSuspended) {
              toast.error('Patient details viewing is suspended by admin');
              return;
            }
            setDetailId(r._id);
          }}
          className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 transition-colors ${
            isSuspended
              ? 'cursor-not-allowed opacity-80'
              : 'cursor-pointer hover:border-sky-300 dark:hover:border-sky-700'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">{r.referralCode}</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 ml-2">{r.patientName}</span>
            </div>
            <div className="flex items-center gap-2">
              {isSuspended && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                  View suspended
                </span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${STATUS_BADGE[r.status]}`}>{r.status}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(r.recommendedTests || []).map((t, i) => (
              <span key={i} className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 text-xs font-semibold">{t.testName}</span>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div><span className="text-slate-400 font-bold uppercase block">Lab</span><span className="font-semibold text-slate-700 dark:text-slate-300">{r.targetLaboratoryId?.labName || '—'}</span></div>
            <div><span className="text-slate-400 font-bold uppercase block">Discount</span><span className="font-semibold">{r.discountPercentage || 0}%</span></div>
            <div>
              <span className="text-slate-400 font-bold uppercase block">Bill</span>
              <span className="font-semibold tabular-nums">
                {r.status === 'closed' ? '—' : (r.billTotalPaisa ? formatPkr(r.billTotalPaisa) : '—')}
              </span>
            </div>
            <div><span className="text-slate-400 font-bold uppercase block">Expected Report</span><span className="font-semibold">{r.expectedReportAt ? new Date(r.expectedReportAt).toLocaleString() : '—'}</span></div>
          </div>

          {r.rejectionReason && <p className="text-xs text-red-600">Declined: {r.rejectionReason}</p>}

          {!isSuspended && r.reportFiles?.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-slate-50 dark:border-slate-800 pt-3">
              {r.reportFiles.map((f, i) => (
                <a key={i} href={f.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-100">
                  <FileText size={13} /> {f.name || `Report ${i + 1}`}
                </a>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-slate-400">
              {isSuspended ? 'Details locked by admin' : 'Click for full details'}
            </span>
            <div className="flex items-center gap-3">
              {['pending', 'rejected'].includes(r.status) && (
                <button onClick={(e) => { e.stopPropagation(); reRefer(r._id); }} className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700"><RefreshCw size={13} /> Re-refer to another lab</button>
              )}
              {!isSuspended && (
                <button onClick={(e) => { e.stopPropagation(); downloadRecordPdf(`/exports/consultant/lab-referrals/${r._id}`, `Lab_Record_${r.referralCode}.pdf`); }} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-sky-700"><Download size={13} /> Download PDF</button>
              )}
            </div>
          </div>
        </div>
        );
      })}

      {detailId && <LabReferralDetailModal referralId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
};

// ── Lab earnings ────────────────────────────────────────────────────────────────
const LabEarnings = () => {
  const queryClient = useQueryClient();
  const { data: earnings, isLoading: l1 } = useQuery({
    queryKey: ['lab-earnings'],
    queryFn: async () => (await api.get('/lab-settlements/consultant/earnings')).data.data,
  });
  const { data: payouts = [], isLoading: l2 } = useQuery({
    queryKey: ['lab-consultant-payouts'],
    queryFn: async () => (await api.get('/lab-settlements/consultant')).data.data,
  });

  const verify = async (settlementId) => {
    try {
      await api.post(`/lab-settlements/${settlementId}/consultant-verify`);
      toast.success('Payout confirmed');
      queryClient.invalidateQueries({ queryKey: ['lab-consultant-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['lab-earnings'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm');
    }
  };

  const STATUS_LABEL = {
    verified: 'Received',
    pending_verification: 'Pending confirmation',
    pending_payout: 'Awaiting payout',
  };

  const downloadCsv = () => {
    if (payouts.length === 0) return toast.error('No earning records to download');
    try {
      const headers = ['Laboratory', 'Amount (PKR)', 'Period Start', 'Period End', 'Status'];
      const rows = payouts.map((p) => [
        `"${(p.labName || '').replace(/"/g, '""')}"`,
        (p.amountPaisa / 100).toFixed(2),
        new Date(p.billingPeriodStart).toLocaleDateString(),
        new Date(p.billingPeriodEnd).toLocaleDateString(),
        STATUS_LABEL[p.status] || p.status,
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Lab_Earnings_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate CSV');
    }
  };

  const downloadPdf = () => {
    if (payouts.length === 0) return toast.error('No earning records to download');
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59);
      doc.text('CareBridge Health', 14, 22);
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('Laboratory Earnings Report', 14, 28);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 28, { align: 'right' });

      doc.setDrawColor(226, 232, 240);
      doc.line(14, 32, pageWidth - 14, 32);

      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(`Total: ${formatPkr(earnings?.totalPaisa || 0)}`, 14, 40);
      doc.text(`Paid: ${formatPkr(earnings?.paidPaisa || 0)}`, 14, 45);
      doc.text(`Accrued (pending): ${formatPkr(earnings?.accruedPaisa || 0)}`, 14, 50);

      const rows = payouts.map((p) => [
        p.labName || '—',
        formatPkr(p.amountPaisa),
        `${new Date(p.billingPeriodStart).toLocaleDateString()} - ${new Date(p.billingPeriodEnd).toLocaleDateString()}`,
        STATUS_LABEL[p.status] || p.status,
      ]);

      autoTable(doc, {
        startY: 58,
        head: [['Laboratory', 'Amount', 'Billing Period', 'Status']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [14, 165, 233] },
        styles: { fontSize: 9 },
      });

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pageCount} - CareBridge Health System - Confidential`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      }

      doc.save(`Lab_Earnings_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF downloaded');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate PDF');
    }
  };

  if (l1 && l2) return <Loader message="Loading lab earnings..." />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 text-white rounded-2xl p-5">
          <Wallet className="w-6 h-6 text-sky-400 mb-2" />
          <p className="text-xs text-slate-400 font-bold uppercase">Total</p>
          <p className="text-2xl font-black text-sky-400 tabular-nums">{formatPkr(earnings?.totalPaisa || 0)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400 font-bold uppercase">Paid</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatPkr(earnings?.paidPaisa || 0)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-xs text-slate-400 font-bold uppercase">Accrued (pending)</p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{formatPkr(earnings?.accruedPaisa || 0)}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-50">Settlement Payouts</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCsv}
              disabled={payouts.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} className="text-emerald-600 dark:text-emerald-400" /> CSV
            </button>
            <button
              onClick={downloadPdf}
              disabled={payouts.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText size={14} className="text-red-600 dark:text-red-400" /> PDF
            </button>
          </div>
        </div>
        {payouts.length === 0 ? (
          <p className="text-sm text-slate-400">No lab settlement payouts yet.</p>
        ) : (
          payouts.map((p) => (
            <div key={p.settlementId} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{p.labName}</p>
                <p className="text-xs text-slate-500">{formatPkr(p.amountPaisa)} • {new Date(p.billingPeriodStart).toLocaleDateString()} → {new Date(p.billingPeriodEnd).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {p.payoutReceiptFileUrl && (
                  <a
                    href={p.payoutReceiptFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    <FileText size={14} /> View receipt
                  </a>
                )}
                {p.status === 'verified' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 size={14} /> Received</span>
                ) : p.status === 'pending_verification' ? (
                  <button onClick={() => verify(p.settlementId)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg">Confirm received</button>
                ) : (
                  <span className="text-xs font-bold text-slate-400">Awaiting payout</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const ConsultantLaboratory = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('new');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start gap-3 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-md">
          <FlaskConical className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50">Laboratory</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Refer patients for tests, track reports, and view your lab commissions.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-full sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${tab === t.key ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'new' && <NewReferral onCreated={() => { queryClient.invalidateQueries({ queryKey: ['my-lab-referrals'] }); setTab('mine'); }} />}
      {tab === 'mine' && <MyReferrals />}
      {tab === 'earnings' && <LabEarnings />}
    </div>
  );
};

export default ConsultantLaboratory;
