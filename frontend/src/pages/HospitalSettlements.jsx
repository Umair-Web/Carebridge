import { useState, useEffect, useCallback } from 'react';
import { 
  Receipt, Calendar, Info, Upload, Check, AlertCircle, Clock, 
  ArrowRight, FileText, Download, Landmark, ArrowUpRight, CheckCircle2 
} from 'lucide-react';
import api from '../utils/api';
import { formatPkr } from '../utils/formatPkr';
import toast from 'react-hot-toast';
import Loader from '../components/Loader';

const HospitalSettlements = () => {
  const [pendingAdmissions, setPendingAdmissions] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selection state
  const [selectedAdmissionIds, setSelectedAdmissionIds] = useState([]);
  const [billingStart, setBillingStart] = useState('');
  const [billingEnd, setBillingEnd] = useState('');
  const [summaryFile, setSummaryFile] = useState(null);
  const [uploadingSummary, setUploadingSummary] = useState(false);
  const [notes, setNotes] = useState('');

  // Receipt upload state
  const [receiptFile, setReceiptFile] = useState({});
  const [uploadingReceipt, setUploadingReceipt] = useState({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [pendingRes, settlementsRes] = await Promise.all([
        api.get('/settlements/pending-admissions'),
        api.get('/settlements/hospital')
      ]);

      if (pendingRes.data.success) {
        setPendingAdmissions(pendingRes.data.data || []);
      }
      if (settlementsRes.data.success) {
        setSettlements(settlementsRes.data.data || []);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load settlements workspace data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // When a billing date range is provided, only the cases that fall within it are
  // shown/selectable. With no range, every pending case is available for manual picking.
  const admInRange = useCallback((adm) => {
    if (!billingStart || !billingEnd) return true;
    const ref = new Date(adm.completedAt || adm.updatedAt);
    const start = new Date(billingStart); start.setHours(0, 0, 0, 0);
    const end = new Date(billingEnd); end.setHours(23, 59, 59, 999);
    return ref >= start && ref <= end;
  }, [billingStart, billingEnd]);

  const visibleAdmissions = pendingAdmissions.filter(admInRange);

  // Selecting a date range auto-selects the cases that fall inside it.
  useEffect(() => {
    if (billingStart && billingEnd) {
      setSelectedAdmissionIds(pendingAdmissions.filter(admInRange).map(a => a._id));
    }
  }, [billingStart, billingEnd, pendingAdmissions, admInRange]);

  // Handle Admission Checkbox Toggle
  const toggleAdmission = (id) => {
    setSelectedAdmissionIds(prev =>
      prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]
    );
  };

  // Select all currently visible admissions
  const handleSelectAll = () => {
    if (selectedAdmissionIds.length === visibleAdmissions.length) {
      setSelectedAdmissionIds([]);
    } else {
      setSelectedAdmissionIds(visibleAdmissions.map(a => a._id));
    }
  };

  // Upload summary document
  const handleSummaryUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadingSummary(true);
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setSummaryFile(res.data.url);
        toast.success('Bill summary document uploaded successfully!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploadingSummary(false);
    }
  };

  // Upload payment receipt for a settlement
  const handleReceiptUpload = async (settlementId, file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadingReceipt(prev => ({ ...prev, [settlementId]: true }));
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        // Now submit it to the settlement
        const submitRes = await api.post(`/settlements/${settlementId}/upload-receipt`, {
          hospitalReceiptFileUrl: res.data.url
        });
        if (submitRes.data.success) {
          toast.success('Manual payment receipt submitted successfully!');
          fetchData();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload payment receipt');
    } finally {
      setUploadingReceipt(prev => ({ ...prev, [settlementId]: false }));
    }
  };

  // Submit new weekly settlement
  const handleCreateSettlement = async (e) => {
    e.preventDefault();
    if (selectedAdmissionIds.length === 0) {
      return toast.error('Select at least one completed case to settle');
    }
    if (!summaryFile) {
      return toast.error('Please upload your Weekly Bill Summary document');
    }

    // When no date range is chosen, derive the billing period from the selected cases.
    let periodStart = billingStart;
    let periodEnd = billingEnd;
    if (!periodStart || !periodEnd) {
      const refDates = selectedAdmissionsObjects.map(a => new Date(a.completedAt || a.updatedAt).getTime());
      if (refDates.length) {
        if (!periodStart) periodStart = new Date(Math.min(...refDates)).toISOString();
        if (!periodEnd) periodEnd = new Date(Math.max(...refDates)).toISOString();
      }
    }

    try {
      const res = await api.post('/settlements', {
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        admissionIds: selectedAdmissionIds,
        billSummaryFileUrl: summaryFile,
        notes
      });

      if (res.data.success) {
        toast.success('Settlement summary compiled and uploaded successfully!');
        // Reset inputs
        setSelectedAdmissionIds([]);
        setBillingStart('');
        setBillingEnd('');
        setSummaryFile(null);
        setNotes('');
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate weekly settlement');
    }
  };

  // Calculate totals for currently selected items — summed from the backend's per-case
  // snapshot (platform charge + doctor commission) so the preview == the created settlement.
  const selectedAdmissionsObjects = pendingAdmissions.filter(a => selectedAdmissionIds.includes(a._id));
  const selectedGrossPaisa = selectedAdmissionsObjects.reduce((sum, a) => sum + (a.billTotalPaisa || 0), 0);
  const selectedPlatformPaisa = selectedAdmissionsObjects.reduce((sum, a) => sum + (a.platformChargePaisa || 0), 0);
  const selectedCommissionPaisa = selectedAdmissionsObjects.reduce((sum, a) => sum + (a.doctorCommissionPaisa || 0), 0);
  // Total the hospital owes the platform = platform charge + doctor commission
  const calculatedPlatformCutPaisa = selectedAdmissionsObjects.reduce(
    (sum, a) => sum + (a.calculatedPlatformCutPaisa || 0), 0
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending_payment':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
            <Clock size={12} className="animate-pulse" /> Pending Manual Pay
          </span>
        );
      case 'pending_admin_verification':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
            <Info size={12} /> Under Admin Verification
          </span>
        );
      case 'paid_pending_consultant_payout':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400">
            <Landmark size={12} /> Hospital Paid, Distributing Payouts
          </span>
        );
      case 'paid_pending_consultant_verification':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400">
            <Clock size={12} /> Payouts Dispatched, Waiting Doctors
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
            <CheckCircle2 size={12} /> Settlement Fully Billed
          </span>
        );
      default:
        return null;
    }
  };

  if (loading && settlements.length === 0 && pendingAdmissions.length === 0) {
    return <Loader message="Loading weekly manual settlements workspace..." />;
  }

  return (
    <div className="space-y-8 sm:space-y-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5 transition-colors">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50 transition-colors">Weekly Settlement</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">Upload weekly bill summaries, calculate platform cuts, and submit transfer screenshots.</p>
          </div>
        </div>
      </div>

      {/* Grid: Create Settlement Left, Bank details / Info Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Core Generator Form (2 Columns span) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm transition-colors">
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-teal-500" />
              1. Compile New Billing Period
            </h2>
            
            <form onSubmit={handleCreateSettlement} className="space-y-6">
              {/* Date pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Billing Start Date <span className="text-slate-400 normal-case font-medium">(optional)</span></label>
                  <input
                    type="date"
                    value={billingStart}
                    onChange={e => setBillingStart(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Billing End Date <span className="text-slate-400 normal-case font-medium">(optional)</span></label>
                  <input
                    type="date"
                    value={billingEnd}
                    onChange={e => setBillingEnd(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Admissions table selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Select Completed Cases to Include ({selectedAdmissionIds.length} chosen)
                  </label>
                  {visibleAdmissions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-bold"
                    >
                      {selectedAdmissionIds.length === visibleAdmissions.length ? 'Deselect All' : 'Select All Pending'}
                    </button>
                  )}
                </div>

                <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/20">
                  {visibleAdmissions.length === 0 ? (
                    <div className="px-5 py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                      {pendingAdmissions.length === 0
                        ? 'All discharged admissions are currently settled! No new cases pending settlement.'
                        : 'No completed cases fall within the selected date range. Adjust or clear the dates to see all pending cases.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {visibleAdmissions.map(adm => {
                        const isChecked = selectedAdmissionIds.includes(adm._id);
                        return (
                          <div 
                            key={adm._id}
                            onClick={() => toggleAdmission(adm._id)}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${isChecked ? 'bg-teal-50/20 dark:bg-teal-950/10' : ''}`}
                          >
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by div click
                              className="w-4 h-4 rounded border-slate-300 dark:border-slate-800 text-teal-600 focus:ring-teal-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400 truncate">
                                  {adm.referralId?.referralCode}
                                </span>
                                <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                                  {formatPkr(adm.billTotalPaisa)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-0.5">
                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  Patient: {adm.referralId?.patientName}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                  {adm.completedAt ? new Date(adm.completedAt).toLocaleDateString() : new Date(adm.updatedAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Aggregated Totals Preview Card */}
              {selectedAdmissionIds.length > 0 && (
                <div className="bg-slate-900 text-white rounded-xl p-5 space-y-3 shadow-md border border-slate-850">
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <span className="text-xs text-slate-400 font-bold">Aggregated Gross Billed</span>
                    <span className="text-lg font-black tabular-nums">{formatPkr(selectedGrossPaisa)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Platform Charge</span>
                    <span className="font-bold text-slate-200 tabular-nums">{formatPkr(selectedPlatformPaisa)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Doctor Commission</span>
                    <span className="font-bold text-slate-200 tabular-nums">{formatPkr(selectedCommissionPaisa)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-dashed border-white/10 pt-3">
                    <span className="text-xs text-slate-350 font-black">Total Due to Platform (You Pay Manually)</span>
                    <span className="text-xl font-extrabold text-teal-400 tabular-nums">{formatPkr(calculatedPlatformCutPaisa)}</span>
                  </div>
                </div>
              )}

              {/* Upload PDF summary */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  2. Upload Weekly Bill Summary Document (Image or PDF)
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-2" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {uploadingSummary ? 'Uploading file...' : summaryFile ? 'File attached successfully' : 'Browse Weekly Summary Statement'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">Accepts PDF, JPG, PNG (Max 5MB)</span>
                    <input 
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleSummaryUpload}
                      disabled={uploadingSummary}
                      className="hidden"
                    />
                  </label>
                  
                  {summaryFile && (
                    <div className="p-3 bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 rounded-xl border border-teal-100/50 flex items-center gap-2">
                      <FileText size={18} />
                      <a href={summaryFile} target="_blank" rel="noreferrer" className="text-xs font-bold underline hover:text-teal-800">
                        View Uploaded Document
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Remarks / Notes</label>
                <textarea
                  placeholder="Include any additional context or transaction remarks..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-colors h-20"
                />
              </div>

              {/* Generate button */}
              <button
                type="submit"
                disabled={selectedAdmissionIds.length === 0 || !summaryFile}
                className="w-full flex items-center justify-center gap-2 py-3 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm rounded-xl shadow-md disabled:bg-slate-200 dark:disabled:bg-slate-850 disabled:text-slate-450 dark:disabled:text-slate-500 transition-all cursor-pointer active:scale-[0.98]"
              >
                Submit Settlement & Await Verification
                <ArrowRight size={16} />
              </button>

            </form>
          </div>
        </div>

        {/* Instructions Panel Right */}
        <div className="space-y-6">
          
          {/* Bank Instructions */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-4 shadow-lg border border-slate-850 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl -mr-16 -mt-16" />
            
            <h3 className="text-sm font-black text-slate-350 uppercase tracking-widest flex items-center gap-2 relative z-10">
              <Landmark size={16} className="text-teal-400" />
              Platform Transfer Accounts
            </h3>
            
            <p className="text-xs text-slate-400 leading-relaxed relative z-10">
              Please transfer the calculated <strong>Platform Cut</strong> manually via online banking or dynamic cash wallets to the official CareBridge accounts listed below:
            </p>

            <div className="space-y-4 pt-2 relative z-10">
              {/* Account 1 */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-1">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Official Bank Account</p>
                <p className="text-xs font-black text-slate-100">CareBridge Private Limited</p>
                <div className="flex justify-between items-center text-xs mt-2">
                  <span className="text-slate-450 font-medium">Bank Alfalah Ltd</span>
                  <span className="font-bold font-mono text-teal-400">0129-1008273928</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-450 font-medium">Branch Code</span>
                  <span className="font-bold text-slate-300">0129 (Karachi Main)</span>
                </div>
              </div>

              {/* Account 2 */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-1">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">JazzCash Merchant Account</p>
                <p className="text-xs font-black text-slate-100">CareBridge Digital Settlement</p>
                <div className="flex justify-between items-center text-xs mt-2">
                  <span className="text-slate-450 font-medium">Wallet Till ID</span>
                  <span className="font-bold font-mono text-teal-400">928132</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-450 font-medium">Mobile Wallet</span>
                  <span className="font-bold text-slate-300">+92 300 1234567</span>
                </div>
              </div>
            </div>

            <div className="bg-teal-950/30 border border-teal-900/50 p-4 rounded-xl flex gap-3 text-xs leading-normal text-teal-300">
              <Info size={18} className="shrink-0 text-teal-400" />
              <span>
                Upload the payment receipt screenshot directly to the specific billing row in the history queue below to initiate admin verification.
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Settlements History Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 transition-colors">Settlement Log & Progress Tracker</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">Monitor manual collection approvals, payout dispatches, and verification signatures.</p>

        {settlements.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-400 dark:text-slate-500 transition-colors">
            <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-sm font-bold">No settlements submitted yet.</p>
            <p className="text-xs mt-1">Once you submit your weekly bill summary, your records will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {settlements.map(settlement => (
              <div 
                key={settlement._id} 
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 transition-colors"
              >
                {/* Header section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-50 dark:border-slate-800 pb-3 transition-colors">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Billing Period</p>
                    <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800 dark:text-slate-200">
                      <span>{new Date(settlement.billingPeriodStart).toLocaleDateString()}</span>
                      <ArrowRight size={14} className="text-slate-400" />
                      <span>{new Date(settlement.billingPeriodEnd).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div>
                    {getStatusBadge(settlement.status)}
                  </div>
                </div>

                {/* Grid details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Platform Charge</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">{formatPkr(settlement.platformChargeTotalPaisa ?? settlement.calculatedPlatformCutPaisa)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Doctor Commission</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">{formatPkr(settlement.doctorCommissionTotalPaisa ?? 0)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Total Due</span>
                    <span className="font-black text-teal-600 dark:text-teal-400 tabular-nums">{formatPkr(settlement.facilityTotalPayablePaisa ?? settlement.calculatedPlatformCutPaisa)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Cases Included</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{settlement.admissionIds?.length || 0} Admissions</span>
                  </div>
                </div>

                {/* Rejection Note */}
                {settlement.rejectionReason && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 p-4 rounded-xl flex gap-3 text-xs leading-normal text-red-700 dark:text-red-400">
                    <AlertCircle size={18} className="shrink-0 text-red-500" />
                    <div>
                      <p className="font-black">Manual payment receipt was rejected by admin:</p>
                      <p className="mt-0.5">{settlement.rejectionReason}</p>
                      <p className="text-[10px] text-red-500/85 mt-2">Please double-check your transfer bank details, perform the transaction again, and upload the updated receipt proof below.</p>
                    </div>
                  </div>
                )}

                {/* Upload action box for manual payment */}
                {settlement.status === 'pending_payment' && (
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
                    <div className="space-y-1">
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Landmark size={14} className="text-teal-600 dark:text-teal-400" />
                        Transfer Platform Fee manually & attach proof receipt
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                        Please pay {formatPkr(settlement.calculatedPlatformCutPaisa)} to our bank details above, then upload the transaction screenshot receipt.
                      </p>
                    </div>
                    <div className="shrink-0">
                      <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-lg shadow-sm cursor-pointer transition-colors active:scale-95">
                        <Upload size={14} />
                        {uploadingReceipt[settlement._id] ? 'Uploading...' : 'Upload Transfer Receipt'}
                        <input 
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={e => handleReceiptUpload(settlement._id, e.target.files[0])}
                          disabled={uploadingReceipt[settlement._id]}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* Document details */}
                <div className="flex flex-wrap gap-3 text-xs pt-2">
                  <a 
                    href={settlement.billSummaryFileUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-250 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold transition-all"
                  >
                    <FileText size={13} className="text-teal-600 dark:text-teal-400" />
                    Weekly Summary Bill
                  </a>
                  
                  {settlement.hospitalReceiptFileUrl && (
                    <a 
                      href={settlement.hospitalReceiptFileUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-250 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold transition-all"
                    >
                      <ArrowUpRight size={13} className="text-teal-600 dark:text-teal-400" />
                      Hospital Payment Receipt
                    </a>
                  )}
                </div>

                {/* Consultant payouts detail tracker */}
                {settlement.consultantPayouts?.length > 0 && (
                  <div className="border-t border-slate-50 dark:border-slate-850 pt-4 space-y-2.5 transition-colors">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Doctor Commissions Distribution Tracker</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {settlement.consultantPayouts.map(pay => (
                        <div 
                          key={pay._id} 
                          className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 p-3 rounded-xl flex items-center justify-between gap-3 text-xs transition-colors"
                        >
                          <div>
                            <p className="font-bold text-slate-700 dark:text-slate-300">
                              Dr. {pay.consultantId?.userId?.name || 'Accredited Consultant'}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                              Calculated Share: <span className="font-bold text-slate-650 dark:text-slate-400">{formatPkr(pay.amountPaisa)}</span> ({pay.commissionPercentage}%)
                            </p>
                          </div>
                          <div>
                            {pay.status === 'pending_payout' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-bold text-[9px] uppercase tracking-wider">
                                Awaiting Payout
                              </span>
                            )}
                            {pay.status === 'pending_verification' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-550/10 text-amber-700 dark:text-amber-400 font-bold text-[9px] uppercase tracking-wider animate-pulse">
                                Paid, Verification Pending
                              </span>
                            )}
                            {pay.status === 'verified' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold text-[9px] uppercase tracking-wider">
                                Verified & Signed Off
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default HospitalSettlements;
