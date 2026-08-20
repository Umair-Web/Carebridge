import { useState, useEffect, useCallback } from 'react';
import { Inbox, X, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useInbox } from '../hooks/useReferrals';
import ClinicalNotesLog from '../components/ClinicalNotesLog';
import Loader from '../components/Loader';
import { formatDob, ageLabel } from '../utils/dob';
import { detailsViewAccessOf } from '../utils/referralAccess';

function formatSlaCountdown(deadline, now) {
  if (!deadline) return '—';
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return 'OVERDUE';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const urgencyStyles = {
  emergency: { card: 'border-red-200',   badge: 'bg-red-50 text-red-600',    sla: 'text-red-600' },
  urgent:    { card: 'border-orange-200', badge: 'bg-orange-50 text-orange-600', sla: 'text-orange-600' },
  routine:   { card: 'border-slate-100',  badge: 'bg-blue-50 text-blue-600',  sla: 'text-blue-600' },
};

const Field = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
    <p className="text-sm font-medium text-slate-700">{value || '—'}</p>
  </div>
);

const ReferralInbox = () => {
  const { data: referrals = [], isLoading, refetch } = useInbox();
  const [departments, setDepartments] = useState([]);
  const [now, setNow]               = useState(() => Date.now());
  const [expandedId, setExpandedId] = useState(null);   // expanded detail card
  const [expandedData, setExpandedData] = useState({});
  const [acceptFor, setAcceptFor]   = useState(null);   // accept modal
  const [deptChoice, setDeptChoice] = useState('');
  const [rejectFor, setRejectFor]   = useState(null);   // reject modal
  const [rejectReason, setRejectReason] = useState('');

  const requestExpand = async (referral) => {
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

  const loadDepartments = useCallback(async () => {
    try {
      const res = await api.get('/hospitals/dashboard');
      if (res.data.success) setDepartments(res.data.data.departments || []);
    } catch { setDepartments([]); }
  }, []);

  useEffect(() => { loadDepartments(); }, [loadDepartments]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const submitAccept = async () => {
    if (departments.length && !deptChoice) { toast.error('Select a department for routing.'); return; }
    try {
      const body = { status: 'accepted', assignedDepartment: deptChoice || departments[0] || undefined };
      const res = await api.patch(`/referrals/${acceptFor}/status`, body);
      if (res.data.success) {
        toast.success('Referral accepted!');
        setAcceptFor(null); setDeptChoice(''); 
        refetch();
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Accept failed'); }
  };

  const submitReject = async () => {
    if (!rejectReason.trim()) { toast.error('Rejection reason is required.'); return; }
    try {
      const res = await api.patch(`/referrals/${rejectFor}/status`, { status: 'rejected', reason: rejectReason });
      if (res.data.success) {
        toast.success('Referral rejected.');
        setRejectFor(null); setRejectReason(''); 
        refetch();
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Reject failed'); }
  };

  if (isLoading) return <Loader message="Fetching pending inbox..." />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-blue-100 text-blue-600"><Inbox className="w-7 h-7" /></div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Referral Inbox</h1>
          <p className="text-slate-500 text-sm mt-1">Click a referral to expand patient & clinical details.</p>
        </div>
      </div>

      <div className="space-y-3">
        {referrals.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center text-slate-500">
            No pending referrals in your inbox.
          </div>
        ) : referrals.map((referral) => {
          const styles        = urgencyStyles[referral.urgency] || urgencyStyles.routine;
          const slaText       = formatSlaCountdown(referral.slaDeadline, now);
          const isExpanded    = expandedId === referral._id;
          const detail        = expandedData[referral._id];
          const canViewDetails = detailsViewAccessOf(referral) === 'active' && !!detail;
          const consultantName = referral.consultantId?.userId?.name || 'Referring consultant';

          return (
            <div key={referral._id}
              className={`bg-white border-2 rounded-2xl shadow-sm transition-all ${styles.card} ${isExpanded && canViewDetails ? 'shadow-md' : 'hover:shadow-md'}`}
            >
              {/* Card Header — always visible, click to expand */}
              <div
                className="p-5 sm:p-6 cursor-pointer select-none"
                onClick={() => requestExpand(referral)}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex gap-4 min-w-0">
                    {/* Urgency pill */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-[10px] font-black uppercase shrink-0 ${styles.badge}`}>
                      {referral.urgency}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold text-slate-900">{referral.patientName}</h3>
                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
                          {referral.referralCode}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        From <span className="font-semibold text-slate-700">{consultantName}</span>
                        {' · '}{ageLabel(referral)} · {referral.gender}
                      </p>
                      {referral.department && (
                        <span className="inline-block mt-1.5 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          {referral.department}
                        </span>
                      )}
                      {referral.targetDoctorId && (
                        <span className="inline-block mt-1.5 ml-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          To: Dr. {referral.targetDoctorId.name.replace(/^Dr\.\s*/i, '')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SLA</p>
                      <p className={`text-base font-mono font-bold ${slaText === 'OVERDUE' ? 'text-red-600' : styles.sla}`}>
                        {slaText}
                      </p>
                    </div>
                    {isExpanded && canViewDetails ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                  </div>
                </div>
              </div>

              {/* Expanded details — only after server confirms active access */}
              {isExpanded && canViewDetails && (
                <div className="border-t border-slate-100 px-5 pb-6 pt-4 space-y-5">
                  {/* Patient + Clinical grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl">
                    <Field label="Patient Name"   value={detail.patientName} />
                    <Field label="Date of Birth"  value={formatDob(detail.dateOfBirth) || null} />
                    <Field label="Age / Gender"   value={`${ageLabel(detail)} · ${detail.gender}`} />
                    <Field label="Phone"          value={detail.phone} />
                    <Field label="Patient CNIC"   value={detail.cnic} />
                    <Field label="Guardian"       value={[detail.guardianRelation, detail.guardianName].filter(Boolean).join(' ')} />
                    <Field label="Area"           value={detail.area} />
                    <Field label="Department"     value={detail.department} />
                  </div>

                  {detail.summaryNotes && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Clinical Summary (Consultant)</p>
                      <p className="text-sm text-slate-700 italic border-l-4 border-blue-200 pl-3 py-2 bg-blue-50/30 rounded-r-xl">{detail.summaryNotes}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {detail.symptomsText && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Symptoms</p>
                        <p className="text-sm text-slate-700 bg-slate-50 rounded-xl px-4 py-3">{detail.symptomsText}</p>
                      </div>
                    )}

                    {detail.diagnosisText && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Provisional Diagnosis</p>
                        <p className="text-sm text-slate-700 bg-slate-50 rounded-xl px-4 py-3">{detail.diagnosisText}</p>
                      </div>
                    )}
                  </div>

                  {detail.notes && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Internal Notes</p>
                      <p className="text-sm text-slate-700 bg-slate-50 rounded-xl px-4 py-3">{detail.notes}</p>
                    </div>
                  )}

                  {detail.attachments && detail.attachments.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Uploaded Medical Reports & Attachments</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {detail.attachments.map((url, idx) => {
                          const name = url.split('/').pop() || `Attachment_${idx + 1}`;
                          return (
                            <a 
                              key={idx} 
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-all font-semibold text-xs text-slate-700 truncate"
                            >
                              📄 {name.slice(-30)}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Clinical Notes Log (Interactive) */}
                  <div className="border-t border-slate-100 pt-5">
                    <ClinicalNotesLog 
                      referralId={referral._id} 
                      initialNotes={detail.clinicalNotes || []} 
                      onNoteAdded={() => refetch()} 
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setRejectFor(referral._id); }}
                      className="flex-1 py-2.5 border-2 border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 text-sm transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAcceptFor(referral._id); setDeptChoice(referral.department || departments[0] || ''); }}
                      className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 text-sm shadow-sm transition-colors"
                    >
                      Accept
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Accept Modal */}
      {acceptFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">Accept Referral</h3>
              <button onClick={() => { setAcceptFor(null); setDeptChoice(''); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-600">Assign a clinical department for internal routing.</p>
            {departments.length > 0 ? (
              <select
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                value={deptChoice}
                onChange={e => setDeptChoice(e.target.value)}
              >
                <option value="">Select department…</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3">No departments configured — add in hospital settings.</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setAcceptFor(null); setDeptChoice(''); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm">Cancel</button>
              <button onClick={submitAccept} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700">Confirm Accept</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">Reject Referral</h3>
              <button onClick={() => { setRejectFor(null); setRejectReason(''); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-600">Provide a documented reason for rejection (required by SRS §3.3 FR-22).</p>
            <textarea
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-red-400 outline-none"
              rows={4}
              placeholder="E.g. No available beds in required department…"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => { setRejectFor(null); setRejectReason(''); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm">Cancel</button>
              <button onClick={submitReject} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700">Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralInbox;
