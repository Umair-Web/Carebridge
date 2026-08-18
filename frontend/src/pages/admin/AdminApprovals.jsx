import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Eye, X, CheckCircle, XCircle, Mail, Phone, Building2, UserCheck, Stethoscope, FileText } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import DetailModal from '../../components/DetailModal';
import Loader from '../../components/Loader';

const Field = ({ label, value }) => (
  <div>
    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
    <p className="text-sm font-medium text-slate-800">{value || '—'}</p>
  </div>
);

const AdminApprovals = () => {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/users/pending');
      if (res.data.success) setPending(res.data.data || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load pending users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (userId) => {
    setActionId(userId);
    try {
      await api.patch(`/admin/users/${userId}`, { status: 'active' });
      toast.success('Approved — phone, email, and profile verification marked complete.');
      setSelected(null);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Approve failed');
    } finally {
      setActionId(null);
    }
  };

  const reject = async () => {
    if (!rejectReason.trim()) { toast.error('Please provide a rejection reason.'); return; }
    setActionId(rejectModal);
    try {
      await api.patch(`/admin/users/${rejectModal}`, { status: 'suspended', reason: rejectReason });
      toast.success('Registration rejected.');
      setRejectModal(null);
      setRejectReason('');
      setSelected(null);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Reject failed');
    } finally {
      setActionId(null);
    }
  };

  const urgencyBadge = (role) => {
    const colors = { consultant: 'bg-blue-50 text-blue-700', hospital: 'bg-teal-50 text-teal-700' };
    return colors[role] || 'bg-slate-100 text-slate-600';
  };

  if (loading) return <Loader message="Loading approvals..." />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-blue-100 text-blue-600"><ShieldCheck className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Pending Approvals</h1>
          <p className="text-slate-500 text-sm mt-1">Review PMDC numbers and facility details before activating accounts.</p>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-16 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">All clear!</p>
          <p className="text-slate-500 text-sm mt-1">No pending registrations at the moment.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.map((u) => (
            <li key={u._id}
              className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:border-blue-200 hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelected(u)}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg shrink-0">
                    {u.name?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{u.name}</p>
                    <p className="text-sm text-slate-500 truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${urgencyBadge(u.role)}`}>
                    {u.role}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelected(u); }}
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); approve(u._id); }}
                    disabled={actionId === u._id}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                  >
                    {actionId === u._id ? 'Approving…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setRejectModal(u._id); }}
                    className="px-4 py-2 rounded-xl border border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Detail Modal */}
      <DetailModal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name || ''}
        subtitle={`${selected?.role?.toUpperCase()} · ${selected?.email}`}
      >
        {selected && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email" value={selected.email} />
              <Field label="Phone" value={selected.phone} />
              <Field label="Role" value={selected.role} />
              <Field label="Account Status" value={selected.status} />
              <Field label="Registered On" value={new Date(selected.createdAt).toLocaleDateString('en-PK', { dateStyle: 'long' })} />
            </div>

            {selected.role === 'consultant' && selected.profile && (
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                  <Stethoscope size={16} /> Consultant Details
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="PMDC Number" value={selected.profile.pmdcNumber} />
                  <Field label="CNIC" value={selected.profile.cnic} />
                  <Field label="Specialty" value={selected.profile.specialty} />
                  <Field label="Clinic Name" value={selected.profile.clinicName} />
                  <Field label="Clinic Address" value={selected.profile.clinicAddress} />
                  <Field label="Verified" value={selected.profile.isVerified ? 'Yes' : 'Pending'} />
                </div>
                {/* Consultant Verification Documents (Q1) */}
                <div className="border-t border-slate-50 pt-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Verification Documents</p>
                  <div className="space-y-2">
                    {(selected.profile.verificationDocuments || []).length === 0 ? (
                      <p className="text-xs text-red-500 italic">No documents uploaded</p>
                    ) : (
                      selected.profile.verificationDocuments.map((doc, idx) => (
                        <a key={idx} href={doc.url} target="_blank" rel="noreferrer"
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-300 transition-all group">
                          <div className="flex items-center gap-3">
                            <FileText size={16} className="text-blue-600" />
                            <span className="text-sm font-semibold text-slate-700">{doc.name}</span>
                          </div>
                          <span className="text-[10px] font-bold text-blue-600 uppercase opacity-0 group-hover:opacity-100 transition-opacity">View Certificate</span>
                        </a>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {selected.role === 'hospital' && selected.profile && (
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <div className="flex items-center gap-2 text-teal-700 font-bold text-sm">
                  <Building2 size={16} /> Hospital Details
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Hospital Name" value={selected.profile.hospitalName} />
                  <Field label="Reg. Number" value={selected.profile.registrationNumber} />
                  <Field label="Representative CNIC" value={selected.profile.representativeCnic} />
                  <Field label="Address" value={selected.profile.address} />
                  <Field label="Phone verified" value={selected.isPhoneVerified ? 'Yes' : 'No'} />
                  <Field label="Email verified" value={selected.isEmailVerified ? 'Yes' : 'No'} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Departments</p>
                  <div className="flex flex-wrap gap-2">
                    {(selected.profile.departments || []).map(d => (
                      <span key={d} className="px-3 py-1 bg-teal-50 text-teal-700 text-xs font-semibold rounded-full">{d}</span>
                    ))}
                  </div>
                </div>
                {/* Registration Documents (Q3) */}
                <div className="border-t border-slate-50 pt-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Verification Documents</p>
                  <div className="space-y-2">
                    {(selected.profile.registrationDocuments || []).length === 0 ? (
                      <p className="text-xs text-red-500 italic">No documents uploaded</p>
                    ) : (
                      selected.profile.registrationDocuments.map((doc, idx) => (
                        <a key={idx} href={doc.url} target="_blank" rel="noreferrer"
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-300 transition-all group">
                          <div className="flex items-center gap-3">
                            <FileText size={16} className="text-blue-600" />
                            <span className="text-sm font-semibold text-slate-700">{doc.name}</span>
                          </div>
                          <span className="text-[10px] font-bold text-blue-600 uppercase opacity-0 group-hover:opacity-100 transition-opacity">View Document</span>
                        </a>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => approve(selected._id)}
                disabled={actionId === selected._id}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} />
                {actionId === selected._id ? 'Approving…' : 'Approve Account'}
              </button>
              <button
                onClick={() => { setRejectModal(selected._id); }}
                className="flex-1 py-3 rounded-xl border-2 border-red-200 text-red-600 font-bold hover:bg-red-50 flex items-center justify-center gap-2"
              >
                <XCircle size={16} /> Reject
              </button>
            </div>
          </div>
        )}
      </DetailModal>

      {/* Reject Reason Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">Reject Registration</h3>
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-600">Provide a reason for rejecting this registration. This will be logged.</p>
            <textarea
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-red-400 outline-none"
              rows={4}
              placeholder="E.g. Invalid PMDC number, incomplete documents…"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm">
                Cancel
              </button>
              <button onClick={reject} disabled={actionId === rejectModal}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-50">
                {actionId === rejectModal ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminApprovals;

