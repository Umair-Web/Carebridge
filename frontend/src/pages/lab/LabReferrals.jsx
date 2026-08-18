import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Upload, X, FlaskConical, CheckCircle2, FileCheck2, Receipt, Percent, Search, Download,
} from 'lucide-react';
import api from '../../utils/api';
import { formatPkr } from '../../utils/formatPkr';
import toast from 'react-hot-toast';
import Loader from '../../components/Loader';
import { downloadPdf } from '../../utils/downloadFile';
import { ageLabel } from '../../utils/dob';

const STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  accepted: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  reported: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  closed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
};

const uploadFile = async (file) => {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  if (!res.data.success) throw new Error('Upload failed');
  return res.data.url;
};

const ManageModal = ({ referral, onClose, onChanged }) => {
  // Bill lines are the consultant's referred tests — descriptions are fixed, the lab only sets amounts.
  const referredTests = referral.recommendedTests?.length ? referral.recommendedTests : [];
  const [amounts, setAmounts] = useState({}); // index -> PKR string the lab has edited
  const [patientBillFileUrl, setPatientBillFileUrl] = useState(referral.patientBillFileUrl || '');
  const [reportFiles, setReportFiles] = useState(referral.reportFiles || []);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingKey, setUploadingKey] = useState(null); // which test row is currently uploading

  // The lab's own catalog — used to auto-fill each referred test's price.
  const { data: catalog = [] } = useQuery({
    queryKey: ['lab-tests'],
    queryFn: async () => (await api.get('/labs/tests')).data.data || [],
  });

  // Default amount for a test: a previously-saved bill line, else the catalog price, else blank.
  const defaultAmountPkr = (name) => {
    const prior = (referral.services || []).find((s) => s.description?.trim().toLowerCase() === name.trim().toLowerCase());
    if (prior) return prior.amountPaisa / 100;
    const hit = catalog.find((t) => t.testName.trim().toLowerCase() === name.trim().toLowerCase());
    return hit ? hit.price / 100 : '';
  };

  // Derived lines — amount is the lab's edit if present, otherwise the auto-filled default.
  const lines = referredTests.map((t, i) => ({
    description: t.testName,
    note: t.note || '',
    amountPkr: amounts[i] !== undefined ? amounts[i] : defaultAmountPkr(t.testName),
  }));

  const discountPct = referral.discountPercentage || 0;
  const grossPaisa = lines.reduce((s, x) => s + (Math.round(Number(x.amountPkr) * 100) || 0), 0);
  const discountPaisa = Math.round(grossPaisa * (discountPct / 100));
  const netPaisa = Math.max(0, grossPaisa - discountPaisa);

  const setLineAmount = (i, value) => setAmounts((prev) => ({ ...prev, [i]: value }));

  const servicesPayload = () =>
    lines
      .filter((l) => String(l.description || '').trim())
      .map((l) => ({ description: l.description.trim(), amountPaisa: Math.round(Number(l.amountPkr) * 100) || 0 }));

  // Upload one or more report files, optionally tagged to a specific recommended test.
  const handleReportUpload = async (e, testName = '') => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const key = testName || '__other__';
    try {
      setUploading(true);
      setUploadingKey(key);
      const uploaded = [];
      for (const file of files) {
        const url = await uploadFile(file);
        uploaded.push({ name: file.name, url, testName: testName || undefined });
      }
      const res = await api.post(`/lab-referrals/${referral._id}/reports`, { reportFiles: uploaded });
      if (res.data.success) {
        setReportFiles(res.data.data.reportFiles);
        toast.success(files.length > 1 ? `${files.length} reports uploaded` : 'Report uploaded');
        onChanged();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload report');
    } finally {
      setUploading(false);
      setUploadingKey(null);
      e.target.value = '';
    }
  };

  const handleBillFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploading(true);
      const url = await uploadFile(file);
      setPatientBillFileUrl(url);
      toast.success('Patient bill uploaded');
    } catch {
      toast.error('Failed to upload bill');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const saveBill = async () => {
    try {
      setBusy(true);
      const res = await api.patch(`/lab-referrals/${referral._id}/bill`, {
        services: servicesPayload(),
        patientBillFileUrl,
      });
      if (res.data.success) {
        toast.success('Bill saved');
        onChanged();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save bill');
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    if (reportFiles.length === 0) return toast.error('Upload the test report(s) first');
    if (grossPaisa <= 0) return toast.error('Enter the amount for at least one referred test');
    if (!patientBillFileUrl) return toast.error('Upload the patient bill document');
    try {
      setBusy(true);
      // Persist latest bill first
      await api.patch(`/lab-referrals/${referral._id}/bill`, {
        services: servicesPayload(),
        patientBillFileUrl,
      });
      const res = await api.patch(`/lab-referrals/${referral._id}/finalize`);
      if (res.data.success) {
        toast.success('Case finalized — consultant payout accrued');
        onChanged();
        onClose();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to finalize');
    } finally {
      setBusy(false);
    }
  };

  const isClosed = referral.status === 'closed';
  const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-sky-500 outline-none';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-50">{referral.patientName}</h2>
            <p className="font-mono text-xs text-sky-600 dark:text-sky-400">{referral.referralCode}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-6">
          {/* Reports — one or more report files per recommended test */}
          <section>
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-50 mb-1 flex items-center gap-1.5"><FileCheck2 size={16} className="text-sky-500" /> Test Reports</h3>
            <p className="text-xs text-slate-400 mb-3">Upload a report for each test below. You can attach more than one file per test.</p>

            <div className="space-y-3">
              {referredTests.length === 0 && reportFiles.length === 0 && (
                <p className="text-xs text-slate-400">No tests on this referral.</p>
              )}

              {/* One block per recommended test */}
              {referredTests.map((t, ti) => {
                const testReports = reportFiles.filter((f) => (f.testName || '') === t.testName);
                return (
                  <div key={ti} className="border border-slate-100 dark:border-slate-800 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{t.testName}</p>
                        {t.note && <p className="text-xs text-slate-400 truncate">{t.note}</p>}
                      </div>
                      {!isClosed && (
                        <label className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 font-bold text-xs rounded-lg cursor-pointer hover:bg-sky-100">
                          <Upload size={13} /> {uploadingKey === t.testName ? 'Uploading…' : 'Upload'}
                          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleReportUpload(e, t.testName)} disabled={uploading} className="hidden" />
                        </label>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      {testReports.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No report uploaded yet.</p>
                      ) : (
                        testReports.map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-sky-700 dark:text-sky-400 font-semibold hover:underline">
                            <FileText size={14} /> {f.name || `Report ${i + 1}`}
                          </a>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Reports not tied to any listed test */}
              {(() => {
                const testNames = referredTests.map((t) => t.testName);
                const others = reportFiles.filter((f) => !f.testName || !testNames.includes(f.testName));
                if (others.length === 0 && referredTests.length > 0 && isClosed) return null;
                return (
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Other reports</p>
                      {!isClosed && (
                        <label className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 font-bold text-xs rounded-lg cursor-pointer hover:bg-sky-100">
                          <Upload size={13} /> {uploadingKey === '__other__' ? 'Uploading…' : 'Upload'}
                          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleReportUpload(e, '')} disabled={uploading} className="hidden" />
                        </label>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      {others.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No additional reports.</p>
                      ) : (
                        others.map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-sky-700 dark:text-sky-400 font-semibold hover:underline">
                            <FileText size={14} /> {f.name || `Report ${i + 1}`}
                          </a>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>

          {/* Billing */}
          <section>
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-50 mb-2 flex items-center gap-1.5"><Receipt size={16} className="text-sky-500" /> Bill — Referred Tests</h3>
            <p className="text-xs text-slate-400 mb-2">Tests requested by the consultant. Amounts are pre-filled from your catalog where available — adjust if needed.</p>
            <div className="space-y-2">
              {lines.length === 0 && <p className="text-xs text-slate-400">No referred tests on this referral.</p>}
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{l.description}</p>
                    {l.note && <p className="text-xs text-slate-400 truncate">{l.note}</p>}
                  </div>
                  <input
                    type="number"
                    min={0}
                    className={`${inputClass} w-28`}
                    placeholder="PKR"
                    value={l.amountPkr}
                    onChange={(e) => setLineAmount(i, e.target.value)}
                    disabled={isClosed}
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 bg-slate-900 text-white rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Gross</span><span className="font-bold tabular-nums">{formatPkr(grossPaisa)}</span></div>
              <div className="flex justify-between text-emerald-400">
                <span className="flex items-center gap-1"><Percent size={12} /> Discount ({discountPct}%)</span>
                <span className="font-bold tabular-nums">- {formatPkr(discountPaisa)}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2"><span className="text-slate-300 font-black">Net (patient pays)</span><span className="font-black text-sky-400 tabular-nums">{formatPkr(netPaisa)}</span></div>
            </div>

            {!isClosed && (
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-500 mb-1">Patient bill document</label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 font-bold text-xs rounded-lg cursor-pointer hover:bg-slate-200">
                    <Upload size={14} /> {patientBillFileUrl ? 'Replace file' : 'Upload bill'}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleBillFileUpload} className="hidden" />
                  </label>
                  {patientBillFileUrl && <a href={patientBillFileUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-600 font-semibold hover:underline">View</a>}
                </div>
              </div>
            )}
          </section>
        </div>

        {!isClosed && (
          <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900">
            <button onClick={saveBill} disabled={busy} className="px-4 py-2 border border-slate-200 dark:border-slate-700 font-bold text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">Save draft</button>
            <button onClick={finalize} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg disabled:opacity-60">
              <CheckCircle2 size={16} /> Finalize bill
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const LabReferrals = () => {
  const queryClient = useQueryClient();
  const [active, setActive] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ['lab-referrals'],
    queryFn: async () => (await api.get('/lab-referrals/lab-all')).data.data,
  });

  const search = searchTerm.trim().toLowerCase();
  const filteredReferrals = search
    ? referrals.filter((r) => r.referralCode?.toLowerCase().includes(search))
    : referrals;

  // Keep the open modal's data fresh after mutations
  useEffect(() => {
    if (active) {
      const updated = referrals.find((r) => r._id === active._id);
      if (updated) setActive(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referrals]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['lab-referrals'] });
    queryClient.invalidateQueries({ queryKey: ['lab-dashboard'] });
  };

  if (isLoading) return <Loader message="Loading referrals..." />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-md">
          <FlaskConical className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50">Referrals & Billing</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Upload reports and finalize bills for your cases.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Referral ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all dark:text-slate-100"
          />
        </div>
        <button
          type="button"
          onClick={() => downloadPdf('/exports/lab/records', 'Lab_Records.pdf')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-sky-600 rounded-xl shadow-sm hover:bg-sky-700 transition-all shrink-0"
        >
          <Download size={16} /> Download All Records
        </button>
      </div>

      {filteredReferrals.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-400">
          <FlaskConical className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
          <p className="text-sm font-bold">{search ? 'No referrals match your search.' : 'No referrals yet.'}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950/40 text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Code</th>
                <th className="text-left px-4 py-3 font-semibold">Patient</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Bill</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredReferrals.map((r) => (
                <tr key={r._id}>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-sky-600 dark:text-sky-400">{r.referralCode}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{r.patientName}</span>
                    <span className="text-slate-400 text-xs"> • {ageLabel(r)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.billTotalPaisa ? formatPkr(r.billTotalPaisa) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {['accepted', 'reported', 'closed'].includes(r.status) ? (
                        <button onClick={() => setActive(r)} className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg transition-colors">
                          {r.status === 'closed' ? 'View' : 'Manage'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">{r.status === 'pending' ? 'In inbox' : '—'}</span>
                      )}
                      <button
                        onClick={() => downloadPdf(`/exports/lab/referrals/${r._id}`, `Lab_Record_${r.referralCode}.pdf`)}
                        title="Download record PDF"
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600 transition-colors"
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active && <ManageModal referral={active} onClose={() => setActive(null)} onChanged={refresh} />}
    </div>
  );
};

export default LabReferrals;
