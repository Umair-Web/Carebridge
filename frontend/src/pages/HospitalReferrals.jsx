import { useState } from 'react';
import { FileText, Search, ChevronDown, ChevronUp, Clock, User, Phone, Shield, Calendar, CreditCard, Download } from 'lucide-react';
import { useHospitalReferrals } from '../hooks/useReferrals';
import api from '../utils/api';
import ClinicalNotesLog from '../components/ClinicalNotesLog';
import Loader from '../components/Loader';
import { downloadPdf } from '../utils/downloadFile';
import { ageLabel } from '../utils/dob';
import { detailsViewAccessOf } from '../utils/referralAccess';
import toast from 'react-hot-toast';

const urgencyStyles = {
  emergency: { card: 'border-red-200',   badge: 'bg-red-50 text-red-600 border-red-100',    text: 'text-red-600' },
  urgent:    { card: 'border-orange-200', badge: 'bg-orange-50 text-orange-600 border-orange-100', text: 'text-orange-600' },
  routine:   { card: 'border-slate-100',  badge: 'bg-blue-50 text-blue-600 border-blue-100',  text: 'text-blue-600' },
};

const statusStyles = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  admitted: 'bg-blue-50 text-blue-700 border-blue-200',
  closed: 'bg-slate-50 text-slate-700 border-slate-200',
};

const Field = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{value || '—'}</p>
  </div>
);

const HospitalReferrals = () => {
  const { data: referrals = [], isLoading, refetch } = useHospitalReferrals();
  const [expandedId, setExpandedId] = useState(null);
  const [expandedData, setExpandedData] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const toggleExpand = async (referral) => {
    const id = referral._id;
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    if (detailsViewAccessOf(referral) !== 'active') {
      toast.error('Patient details viewing is suspended by admin');
      setExpandedId(null);
      setExpandedData((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    // Always re-check with the server so a mid-session Suspend cannot leave details open.
    try {
      const res = await api.get(`/referrals/${id}`);
      if (res.data.success) {
        setExpandedData((prev) => ({ ...prev, [id]: res.data.data }));
        setExpandedId(id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Patient details viewing is suspended by admin');
      setExpandedId(null);
      setExpandedData((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  if (isLoading) return <Loader message="Loading hospital referral history..." />;

  const filteredReferrals = referrals.filter((ref) => {
    const matchesStatus = statusFilter === 'all' || ref.status === statusFilter;
    const matchesSearch = 
      ref.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ref.referralCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ref.department?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
          <FileText className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">All Referrals</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Complete historical log of referrals sent to your facility. Click any referral to view full detail or add clinical notes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadPdf('/exports/hospital/records', 'Hospital_Records.pdf')}
          className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl shadow-sm hover:bg-blue-700 transition-all shrink-0"
        >
          <Download size={16} /> Download All Records
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by patient name, code, department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-slate-100"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-1 bg-slate-50 dark:bg-slate-800/40 p-1 rounded-xl">
          {['all', 'pending', 'accepted', 'rejected', 'admitted', 'closed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                statusFilter === status
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Referrals List */}
      <div className="space-y-4">
        {filteredReferrals.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400">
            No referrals found matching your search and filter criteria.
          </div>
        ) : (
          filteredReferrals.map((referral) => {
            const styles = urgencyStyles[referral.urgency] || urgencyStyles.routine;
            const isExpanded = expandedId === referral._id;
            const detail = expandedData[referral._id];
            const canViewDetails = detailsViewAccessOf(referral) === 'active' && !!detail;
            const consultantName = referral.consultantId?.userId?.name || 'Referring consultant';

            return (
              <div
                key={referral._id}
                className={`bg-white dark:bg-slate-900 border-2 rounded-2xl shadow-sm transition-all overflow-hidden ${
                  styles.card
                } ${isExpanded && canViewDetails ? 'shadow-md ring-1 ring-blue-500/20' : 'hover:shadow-md'}`}
              >
                {/* Header Section (Always Visible) */}
                <div
                  className="p-5 sm:p-6 cursor-pointer select-none"
                  onClick={() => toggleExpand(referral)}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex gap-4 min-w-0">
                      {/* Urgency Badge */}
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-[10px] font-black uppercase shrink-0 border ${styles.badge}`}
                      >
                        {referral.urgency}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                            {referral.patientName}
                          </h3>
                          <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-300">
                            {referral.referralCode}
                          </span>
                          <span
                            className={`px-2 py-0.5 border rounded-full text-[10px] font-bold uppercase ${
                              statusStyles[referral.status] || ''
                            }`}
                          >
                            {referral.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          From <span className="font-semibold text-slate-700 dark:text-slate-300">{consultantName}</span>
                          {' · '}{ageLabel(referral)} · {referral.gender}
                        </p>
                        <div className="flex gap-2 flex-wrap mt-2">
                          {referral.department && (
                            <span className="inline-block text-[11px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400 px-2.5 py-0.5 rounded-full">
                              {referral.department}
                            </span>
                          )}
                          {referral.targetDoctorId && (
                            <span className="inline-block text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/50">
                              To: Dr. {referral.targetDoctorId.name.replace(/^Dr\.\s*/i, '')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          Created
                        </p>
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {new Date(referral.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {isExpanded && canViewDetails ? (
                        <ChevronUp size={18} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={18} className="text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Section — only after server unlock/active check */}
                {isExpanded && canViewDetails && (
                  <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/10 p-6 space-y-6">
                    {/* Download this record */}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadPdf(`/exports/hospital/referrals/${referral._id}`, `Patient_Record_${referral.referralCode}.pdf`);
                        }}
                        className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400 rounded-xl hover:bg-blue-100 transition-all"
                      >
                        <Download size={14} /> Download Record PDF
                      </button>
                    </div>

                    {/* Patient & Financial Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm">
                      <Field label="Phone Number" value={detail.phone} />
                      <Field label="Patient CNIC" value={detail.cnic} />
                      <Field label="Guardian" value={[detail.guardianRelation, detail.guardianName].filter(Boolean).join(' ')} />
                      <Field label="Area / Location" value={detail.area} />
                    </div>

                    {/* Clinical Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Shield size={14} className="text-blue-600" /> Clinical Presentation
                        </h4>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            Symptoms Description
                          </p>
                          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                            {detail.symptomsText || 'No symptom descriptions provided.'}
                          </p>
                        </div>
                        {detail.symptomTags && detail.symptomTags.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                              Symptom Tags
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {detail.symptomTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            Diagnosis / Notes
                          </p>
                          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                            {detail.diagnosisText || 'No diagnosis notes entered.'}
                          </p>
                        </div>
                      </div>

                      {/* Timeline / Dates */}
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar size={14} className="text-blue-600" /> Action Logs & Timeline
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-medium">Created At:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {new Date(detail.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {detail.acceptedAt && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-medium">Accepted At:</span>
                              <span className="font-bold text-emerald-600">
                                {new Date(detail.acceptedAt).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {detail.admittedAt && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-medium">Admitted At:</span>
                              <span className="font-bold text-blue-600">
                                {new Date(detail.admittedAt).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {detail.closedAt && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400 font-medium">Closed At:</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {new Date(detail.closedAt).toLocaleString()}
                              </span>
                            </div>
                          )}
                          {detail.status === 'rejected' && detail.rejectionReason && (
                            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 rounded-xl space-y-1">
                              <span className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
                                Rejection Reason:
                              </span>
                              <p className="text-sm font-medium text-red-900 dark:text-red-300 leading-relaxed">
                                {detail.rejectionReason}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Clinical Notes Timeline / Log */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <ClinicalNotesLog
                        referralId={referral._id}
                        initialNotes={detail.clinicalNotes || []}
                        onNoteAdded={() => refetch()}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default HospitalReferrals;
