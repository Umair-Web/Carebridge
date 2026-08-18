import { useState, useEffect, useCallback } from 'react';
import { 
  Receipt, FileText, CheckCircle2, AlertCircle, Landmark, Upload, 
  ExternalLink, Eye, ArrowRight, UserCheck, XCircle, Search, CreditCard 
} from 'lucide-react';
import api from '../../utils/api';
import { formatPkr } from '../../utils/formatPkr';
import toast from 'react-hot-toast';
import Loader from '../../components/Loader';

const AdminSettlements = () => {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modals / Details states
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Consultant payout receipt upload state
  const [payoutReceipts, setPayoutReceipts] = useState({});
  const [uploadingPayout, setUploadingPayout] = useState({});

  const fetchSettlements = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/settlements/admin');
      if (res.data.success) {
        setSettlements(res.data.data || []);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to retrieve manual settlements queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  // Handle Approve or Reject Hospital Receipt
  const handleVerifyHospitalReceipt = async (settlementId, action) => {
    if (action === 'reject' && !rejectionReason.trim()) {
      return toast.error('Please specify a rejection reason for the hospital');
    }

    try {
      const res = await api.post(`/settlements/admin/${settlementId}/verify`, {
        action,
        rejectionReason: action === 'reject' ? rejectionReason : undefined
      });

      if (res.data.success) {
        toast.success(`Settlement manually ${action}d successfully!`);
        setShowRejectInput(false);
        setRejectionReason('');
        setSelectedSettlement(null);
        fetchSettlements();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process verification');
    }
  };

  // Upload payout receipt proof to consultant
  const handleUploadPayoutReceipt = async (settlementId, consultantId, file) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadingPayout(prev => ({ ...prev, [`${settlementId}-${consultantId}`]: true }));
      const uploadRes = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (uploadRes.data.success) {
        const payoutRes = await api.post(`/settlements/admin/${settlementId}/payout`, {
          consultantId,
          payoutReceiptFileUrl: uploadRes.data.url
        });

        if (payoutRes.data.success) {
          toast.success('Payout receipt uploaded and doctor notified!');
          
          // Update local details if viewing modal
          if (selectedSettlement && selectedSettlement._id === settlementId) {
            setSelectedSettlement(payoutRes.data.data);
          }
          fetchSettlements();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to dispatch payout receipt');
    } finally {
      setUploadingPayout(prev => ({ ...prev, [`${settlementId}-${consultantId}`]: false }));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_payment':
        return 'text-amber-500 bg-amber-50 dark:bg-amber-950/20 border-amber-250 dark:border-amber-900';
      case 'pending_admin_verification':
        return 'text-blue-500 bg-blue-50 dark:bg-blue-950/20 border-blue-250 dark:border-blue-900';
      case 'paid_pending_consultant_payout':
        return 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 border-indigo-250 dark:border-indigo-900';
      case 'paid_pending_consultant_verification':
        return 'text-purple-500 bg-purple-50 dark:bg-purple-950/20 border-purple-250 dark:border-purple-900';
      case 'completed':
        return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-900';
      default:
        return 'text-slate-500 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending_payment': return 'Awaiting Payment Upload';
      case 'pending_admin_verification': return 'Pending Approval';
      case 'paid_pending_consultant_payout': return 'Disbursing Commissions';
      case 'paid_pending_consultant_verification': return 'Pending Doctor Sign-offs';
      case 'completed': return 'Fully Completed';
      default: return status;
    }
  };

  const filtered = settlements.filter(s =>
    s.hospitalId?.hospitalName?.toLowerCase().includes(search.toLowerCase()) ||
    s.status?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading && settlements.length === 0) {
    return <Loader message="Accessing manual settlements approvals queue..." />;
  }

  return (
    <div className="space-y-8 sm:space-y-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5 transition-colors">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-md">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50 transition-colors">Settlements Queue</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors">Audit manual hospital collections, verify billing summary PDFs, and verify payout proofs to physicians.</p>
          </div>
        </div>
      </div>

      {/* Quick Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
        <input
          type="text"
          placeholder="Filter by Hospital name or settlement status..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 placeholder-slate-500 dark:placeholder-slate-400 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-colors"
        />
      </div>

      {/* Main Settlements Table Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[800px]">
            <thead className="bg-slate-50/60 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider transition-colors border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Upload Date</th>
                <th className="px-6 py-4">Hospital</th>
                <th className="px-6 py-4">Period</th>
                <th className="px-6 py-4 text-right">Gross Total</th>
                <th className="px-6 py-4 text-right">Fee cut due</th>
                <th className="px-6 py-4">Workflow Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                    No weekly manual settlements registered in this queue.
                  </td>
                </tr>
              ) : (
                filtered.map(s => (
                  <tr 
                    key={s._id}
                    onClick={() => setSelectedSettlement(s)}
                    className="hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-slate-550 dark:text-slate-400">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                      {s.hospitalId?.hospitalName}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {new Date(s.billingPeriodStart).toLocaleDateString()} - {new Date(s.billingPeriodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right font-extrabold text-slate-800 dark:text-slate-200 tabular-nums">
                      {formatPkr(s.grossAmountPaisa)}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                      {formatPkr(s.calculatedPlatformCutPaisa)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusColor(s.status)}`}>
                        {getStatusLabel(s.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedSettlement(s)}
                        className="flex items-center gap-1 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <Eye size={14} /> Review Work
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Master Settlement Detail Slide-Over Modal */}
      {selectedSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-2xl h-screen bg-white dark:bg-slate-900 shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between transition-colors animate-in slide-in-from-right duration-350">
            
            {/* Modal Scroll Content */}
            <div className="space-y-6 flex-1">
              
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-50">Settlement Workspace Audit</h3>
                  <p className="text-xs text-slate-450 mt-1 uppercase tracking-wider font-bold">
                    Hospital: {selectedSettlement.hospitalId?.hospitalName}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedSettlement(null);
                    setShowRejectInput(false);
                  }}
                  className="px-3 py-1 text-xs font-black bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-350 rounded-lg text-slate-650 transition-colors"
                >
                  Close
                </button>
              </div>

              {/* Grid: Split Amounts (platform charge + doctor commission = total the hospital owes) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-950 text-white rounded-xl p-4 shadow-sm border border-slate-850">
                <div className="text-center sm:border-r border-white/10">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gross Billing</p>
                  <p className="text-lg font-black tabular-nums text-slate-100 mt-1">{formatPkr(selectedSettlement.grossAmountPaisa)}</p>
                </div>
                <div className="text-center sm:border-r border-white/10">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Platform Charge</p>
                  <p className="text-lg font-bold tabular-nums text-slate-200 mt-1">{formatPkr(selectedSettlement.platformChargeTotalPaisa ?? selectedSettlement.calculatedPlatformCutPaisa)}</p>
                </div>
                <div className="text-center sm:border-r border-white/10">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Doctor Commission</p>
                  <p className="text-lg font-bold tabular-nums text-slate-200 mt-1">{formatPkr(selectedSettlement.doctorCommissionTotalPaisa ?? 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-teal-400 font-bold uppercase tracking-widest">Total Due</p>
                  <p className="text-lg font-black tabular-nums text-teal-400 mt-1">{formatPkr(selectedSettlement.facilityTotalPayablePaisa ?? selectedSettlement.calculatedPlatformCutPaisa)}</p>
                </div>
              </div>

              {/* View Files Panel */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest">Uploaded Proof and Statements</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <a
                    href={selectedSettlement.billSummaryFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 rounded-xl hover:bg-slate-100 transition-all font-bold text-xs text-slate-700 dark:text-slate-300"
                  >
                    <span className="flex items-center gap-2"><FileText size={16} className="text-indigo-500" /> Weekly Summary Bill</span>
                    <ExternalLink size={14} className="text-slate-450" />
                  </a>

                  {selectedSettlement.hospitalReceiptFileUrl ? (
                    <a
                      href={selectedSettlement.hospitalReceiptFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 rounded-xl hover:bg-slate-100 transition-all font-bold text-xs text-slate-700 dark:text-slate-300"
                    >
                      <span className="flex items-center gap-2"><Landmark size={16} className="text-emerald-500" /> Hospital Payment Receipt</span>
                      <ExternalLink size={14} className="text-slate-450" />
                    </a>
                  ) : (
                    <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-950/15 border border-amber-100 dark:border-amber-900/50 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-400">
                      <AlertCircle size={16} /> Awaiting manual payment transfer...
                    </div>
                  )}
                </div>
              </div>

              {/* Individual Patient Bills */}
              {selectedSettlement.admissionIds?.length > 0 && (
                <div className="space-y-3 pt-3">
                  <h4 className="text-xs font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest">Individual Patient Bills</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedSettlement.admissionIds.map(adm => (
                      <div key={adm._id} className="p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                           <span className="font-bold text-xs text-slate-700 dark:text-slate-300">Patient: {adm.referralId?.patientName || 'Unknown'}</span>
                           <span className="font-mono text-[10px] text-slate-500">{adm.referralId?.referralCode}</span>
                        </div>
                        {adm.patientBillFileUrl ? (
                          <a href={adm.patientBillFileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[11px] font-bold text-indigo-500 hover:text-indigo-700 underline">
                            <FileText size={14} /> View Patient Receipt
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic flex items-center gap-1">
                            <AlertCircle size={12} /> No receipt uploaded
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit Action Bar: Verify Hospital payment */}
              {(selectedSettlement.status === 'pending_admin_verification' || selectedSettlement.status === 'pending_payment') && (
                <div className="bg-slate-50 dark:bg-slate-950/40 p-4 border border-slate-150 dark:border-slate-800 rounded-xl space-y-4 transition-colors">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-indigo-550 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200">Hospital Platform Cut Receipt Auditing</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5">Please check if the manual transfer screenshot exactly matches our Bank Alfalah / JazzCash Till records for the amount of <strong>{formatPkr(selectedSettlement.calculatedPlatformCutPaisa)}</strong>.</p>
                    </div>
                  </div>

                  {!showRejectInput ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleVerifyHospitalReceipt(selectedSettlement._id, 'approve')}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
                      >
                        Approve & Lock Receipt
                      </button>
                      <button
                        onClick={() => setShowRejectInput(true)}
                        className="px-4 py-2 border border-red-200 hover:bg-red-50 text-red-600 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="block text-[10px] font-black text-red-600 uppercase tracking-wider">Provide rejection reason feedback for hospital:</label>
                      <textarea
                        required
                        placeholder="e.g. Transaction reference ID missing or amount does not match Platform Cut..."
                        value={rejectionReason}
                        onChange={e => setRejectionReason(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 text-xs focus:ring-2 focus:ring-red-500 outline-none transition-colors h-16"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleVerifyHospitalReceipt(selectedSettlement._id, 'reject')}
                          className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
                        >
                          Confirm Rejection
                        </button>
                        <button
                          onClick={() => setShowRejectInput(false)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Consultant payouts detail panel: Admin uploads payout screenshots */}
              {selectedSettlement.consultantPayouts?.length > 0 && (
                <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-5 transition-colors">
                  <h4 className="text-xs font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest">Manual Doctor Payout Approvals Grid</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-1 leading-normal">Transfer commissions manually to each doctor's preferred account. Then upload payout transfer screenshots.</p>
                  
                  <div className="space-y-4">
                    {selectedSettlement.consultantPayouts.map(pay => {
                      const uploadKey = `${selectedSettlement._id}-${pay.consultantId._id}`;
                      const isUploading = uploadingPayout[uploadKey];
                      const payoutAccount = pay.consultantId?.userId?.payoutAccount || {};
                      
                      return (
                        <div 
                          key={pay._id} 
                          className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 p-4 rounded-xl space-y-3 transition-colors"
                        >
                          {/* Top part: Consultant name, commission share */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-850 pb-2 transition-colors">
                            <div>
                              <p className="font-extrabold text-slate-850 dark:text-slate-250">
                                Dr. {pay.consultantId?.userId?.name || 'Physician'}
                              </p>
                              <p className="text-[10px] font-bold font-mono text-indigo-500 dark:text-indigo-400 mt-0.5">
                                PMDC: {pay.consultantId?.pmdcNumber}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-indigo-650 dark:text-indigo-400 tabular-nums">
                                Share: {formatPkr(pay.amountPaisa)}
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">Commission Rate: {pay.commissionPercentage}%</span>
                            </div>
                          </div>

                          {/* Bank details panel */}
                          <div className="bg-white/85 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-lg grid grid-cols-2 gap-3 text-xs leading-normal transition-colors">
                            <div>
                              <span className="text-slate-400 font-bold block text-[10px] uppercase">Preferred Account Type</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">{payoutAccount.accountType || 'JazzCash'}</span>
                            </div>
                            {payoutAccount.bankName && (
                              <div>
                                <span className="text-slate-400 font-bold block text-[10px] uppercase">Bank Name</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{payoutAccount.bankName}</span>
                              </div>
                            )}
                            <div>
                              <span className="text-slate-400 font-bold block text-[10px] uppercase">Account Title</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">{payoutAccount.accountHolder || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold block text-[10px] uppercase">Account Number / Wallet</span>
                              <span className="font-extrabold text-indigo-600 dark:text-indigo-400 font-mono select-all">{payoutAccount.accountNumber || 'N/A'}</span>
                            </div>
                          </div>

                          {/* Action area: Upload receipt proof */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                            <div>
                              {pay.status === 'pending_payout' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-[9px] uppercase tracking-wider">
                                  Payout Needed
                                </span>
                              )}
                              {pay.status === 'pending_verification' && (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-[9px] uppercase tracking-wider animate-pulse">
                                    Proof Dispatched, Awaiting Doctor
                                  </span>
                                  {pay.payoutReceiptFileUrl && (
                                    <a href={pay.payoutReceiptFileUrl} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-500 font-bold block underline hover:text-indigo-700">
                                      View Uploaded Transfer Proof
                                    </a>
                                  )}
                                  <label className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                                    <Upload size={11} /> {isUploading ? 'Uploading...' : 'Re-upload receipt'}
                                    <input
                                      type="file"
                                      accept=".pdf,.png,.jpg,.jpeg"
                                      onChange={e => handleUploadPayoutReceipt(selectedSettlement._id, pay.consultantId._id, e.target.files[0])}
                                      disabled={isUploading}
                                      className="hidden"
                                    />
                                  </label>
                                </div>
                              )}
                              {pay.status === 'verified' && (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold text-[9px] uppercase tracking-wider">
                                    Verified & Confirmed by Doctor
                                  </span>
                                  {pay.payoutReceiptFileUrl && (
                                    <a href={pay.payoutReceiptFileUrl} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-500 font-bold block underline hover:text-indigo-700">
                                      View Uploaded Transfer Proof
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Uploader */}
                            {pay.status === 'pending_payout' && (
                              <div>
                                {['paid_pending_consultant_payout', 'paid_pending_consultant_verification'].includes(selectedSettlement.status) ? (
                                  <label className="flex items-center justify-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-lg shadow-sm cursor-pointer transition-colors active:scale-95">
                                    <Upload size={13} />
                                    {isUploading ? 'Uploading...' : 'Attach Transfer Receipt'}
                                    <input
                                      type="file"
                                      accept=".pdf,.png,.jpg,.jpeg"
                                      onChange={e => handleUploadPayoutReceipt(selectedSettlement._id, pay.consultantId._id, e.target.files[0])}
                                      disabled={isUploading}
                                      className="hidden"
                                    />
                                  </label>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic font-bold text-right block">
                                    Verify hospital payment first to unlock upload
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Bottom Sign-off */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-end gap-3 transition-colors shrink-0">
              <button
                onClick={() => {
                  setSelectedSettlement(null);
                  setShowRejectInput(false);
                }}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer hover:bg-slate-800 transition-colors active:scale-95"
              >
                Close Audit Workspace
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default AdminSettlements;
