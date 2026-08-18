import { useState, useEffect, useCallback } from 'react';
import { Users, Eye, Search, CheckCircle, XCircle, Stethoscope, FileText, Wallet, Clock, TrendingUp, MapPin, Building, Activity, Shield, Download } from 'lucide-react';
import { downloadPdf } from '../../utils/downloadFile';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import DetailModal from '../../components/DetailModal';
import Loader from '../../components/Loader';

const statusBadge = (status) => {
  const map = {
    active: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-amber-50 text-amber-700',
    suspended: 'bg-red-50 text-red-600',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
};

const Field = ({ label, value }) => (
  <div>
    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
    <p className="text-sm font-medium text-slate-800">{value || '—'}</p>
  </div>
);

/** One additive deal row: a percentage/fixed toggle revealing the relevant input. */
const DealRow = ({ label, hint, type, onType, pct, onPct, fixed, onFixed, fixedUnit }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
    <div>
      <p className="text-xs font-bold text-slate-800">{label}</p>
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
        <input type="radio" checked={type === 'percentage'} onChange={() => onType('percentage')} />
        Percentage
      </label>
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
        <input type="radio" checked={type === 'fixed'} onChange={() => onType('fixed')} />
        Fixed
      </label>
      <div className="ml-auto flex items-center gap-1.5">
        {type === 'percentage' ? (
          <>
            <input
              type="number" min="0" max="100"
              value={pct}
              onChange={(e) => onPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              className="w-20 px-2 py-1.5 text-center text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <span className="text-xs font-bold text-slate-400">%</span>
          </>
        ) : (
          <>
            <span className="text-xs font-bold text-slate-400">Rs</span>
            <input
              type="number" min="0"
              value={fixed}
              onChange={(e) => onFixed(Math.max(0, Number(e.target.value) || 0))}
              className="w-24 px-2 py-1.5 text-center text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <span className="text-[10px] font-medium text-slate-400">{fixedUnit}</span>
          </>
        )}
      </div>
    </div>
  </div>
);

const AdminConsultants = () => {
  const [consultants, setConsultants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [actionId, setActionId] = useState(null);
  
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState('performance'); // performance or logs
  const [commForm, setCommForm] = useState(null);
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [consultantEditOpen, setConsultantEditOpen] = useState(false);
  const [consultantEditForm, setConsultantEditForm] = useState({});

  useEffect(() => {
    const p = profileData?.profile;
    if (!p) { setCommForm(null); return; }
    setCommForm({
      commissionModel: p.commissionModel || 'legacy',
      commissionPercentage: p.commissionPercentage ?? 60,
      hospitalCommissionType: p.hospitalCommissionType || 'percentage',
      hospitalCommissionPercentage: p.hospitalCommissionPercentage ?? 0,
      hospitalFixedCommissionRupees: (p.hospitalFixedCommissionPaisa || 0) / 100,
      labCommissionType: p.labCommissionType || 'percentage',
      labCommissionPercentage: p.labCommissionPercentage ?? 0,
      labFixedCommissionRupeesPerTest: (p.labFixedCommissionPaisaPerTest || 0) / 100,
    });
  }, [profileData]);

  const setCf = (patch) => setCommForm((f) => ({ ...f, ...patch }));

  const saveCommission = async () => {
    if (!commForm) return;
    try {
      setActionId(selected._id);
      await api.post(`/admin/consultants/${selected._id}/commission`, commForm);
      toast.success('Commission settings updated');
      const res = await api.get(`/admin/consultants/${selected._id}/profile`);
      if (res.data.success) setProfileData(res.data.data);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update commission');
    } finally {
      setActionId(null);
    }
  };

  useEffect(() => {
    if (!selected) {
      setProfileData(null);
      return;
    }
    const fetchProfile = async () => {
      try {
        setLoadingProfile(true);
        const res = await api.get(`/admin/consultants/${selected._id}/profile`);
        if (res.data.success) {
          setProfileData(res.data.data);
        }
      } catch (err) {
        toast.error('Failed to load full consultant profile details');
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [selected]);

  useEffect(() => {
    if (!selected?._id) {
      setPatients([]);
      return;
    }
    setPatientsLoading(true);
    api.get(`/admin/consultants/${selected._id}/patients`)
      .then((res) => {
        if (res.data.success) setPatients(res.data.data || []);
      })
      .catch(() => toast.error('Failed to load referred patients'))
      .finally(() => setPatientsLoading(false));
  }, [selected?._id]);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/users?role=consultant');
      if (res.data.success) setConsultants(res.data.data || []);
    } catch (e) {
      toast.error('Failed to load consultants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    setActionId(userId);
    try {
      await api.patch(`/admin/users/${userId}`, { status: newStatus });
      toast.success(`User ${newStatus === 'active' ? 'activated' : 'suspended'}`);
      if (selected?._id === userId) setSelected(prev => ({ ...prev, status: newStatus }));
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Are you absolutely sure you want to permanently delete this user? This cannot be undone.')) {
      setActionId(userId);
      try {
        const res = await api.delete(`/admin/users/${userId}`);
        if (res.data.success) {
          toast.success('User deleted successfully');
          setSelected(null);
          await load();
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to delete user');
      } finally {
        setActionId(null);
      }
    }
  };

  const openConsultantEdit = () => {
    const p = profileData?.profile || selected?.profile || {};
    setConsultantEditForm({
      specialty: p.specialty || '',
      clinicName: p.clinicName || '',
      clinicAddress: p.clinicAddress || '',
      city: p.city || '',
      cnic: p.cnic || '',
      commissionPercentage: p.commissionPercentage ?? 60,
      maxLabDiscountPercentage: p.maxLabDiscountPercentage ?? 15,
      isVerified: p.isVerified === true,
    });
    setConsultantEditOpen(true);
  };

  const saveConsultantEdit = async () => {
    setActionId(selected._id);
    try {
      await api.patch(`/admin/consultants/${selected._id}`, consultantEditForm);
      toast.success('Consultant profile updated');
      setConsultantEditOpen(false);
      const res = await api.get(`/admin/consultants/${selected._id}/profile`);
      if (res.data.success) setProfileData(res.data.data);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setActionId(null);
    }
  };

  const handleChangePassword = async (userId) => {
    const newPass = window.prompt('Enter new password for this user (minimum 6 characters):');
    if (newPass) {
      if (newPass.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
      setActionId(userId);
      try {
        const res = await api.post(`/admin/users/${userId}/change-password`, { password: newPass });
        if (res.data.success) {
          toast.success('Password updated successfully');
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to update password');
      } finally {
        setActionId(null);
      }
    }
  };

  const filtered = consultants.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.profile?.pmdcNumber?.toLowerCase().includes(search.toLowerCase()) ||
    c.profile?.specialty?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Loader message="Loading consultants..." />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-blue-100 text-blue-600"><Users className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Consultants</h1>
          <p className="text-slate-500 text-sm mt-1">Manage all registered consultants on the platform.</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search by name, email, PMDC, specialty…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-5 py-3.5 font-semibold">Consultant</th>
              <th className="px-5 py-3.5 font-semibold">PMDC / Specialty</th>
              <th className="px-5 py-3.5 font-semibold">Phone</th>
              <th className="px-5 py-3.5 font-semibold">Wallet Balance</th>
              <th className="px-5 py-3.5 font-semibold">Status</th>
              <th className="px-5 py-3.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">No consultants found.</td></tr>
            ) : filtered.map(c => (
              <tr key={c._id}
                className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                onClick={() => setSelected(c)}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
                      {c.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <p className="font-mono text-xs font-medium text-slate-700">{c.profile?.pmdcNumber || '—'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{c.profile?.specialty || '—'}</p>
                </td>
                <td className="px-5 py-4 text-slate-600 text-xs">{c.phone || '—'}</td>
                <td className="px-5 py-4 font-semibold text-slate-800 text-xs">
                  PKR {((c.profile?.walletBalance || 0) / 100).toLocaleString()}
                </td>
                <td className="px-5 py-4">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg capitalize ${statusBadge(c.status)}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setSelected(c)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors">
                      <Eye size={16} />
                    </button>
                    <button onClick={() => downloadPdf(`/exports/admin/consultants/${c._id}`, `Consultant_${(c.name || 'file').replace(/\s+/g, '_')}.pdf`)}
                      title="Download complete file"
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors">
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => toggleStatus(c._id, c.status)}
                      disabled={actionId === c._id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                        c.status === 'active'
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      {actionId === c._id ? '…' : c.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Slide-over */}
      <DetailModal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name || ''}
        subtitle={`Consultant · ${selected?.email}`}
      >
        {selected && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 font-black text-xl flex items-center justify-center shrink-0">
                    {selected.name?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{selected.name}</h3>
                    <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md capitalize ${statusBadge(selected.status)}`}>
                      {selected.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleStatus(selected._id, selected.status)}
                    disabled={actionId === selected._id}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      selected.status === 'active'
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {actionId === selected._id ? '…' : selected.status === 'active' ? 'Suspend' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={openConsultantEdit}
                    className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all"
                  >
                    Edit profile
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPdf(`/exports/admin/consultants/${selected._id}`, `Consultant_${(selected.name || 'file').replace(/\s+/g, '_')}.pdf`)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-xs font-bold transition-all"
                  >
                    <Download size={14} /> Download File
                  </button>
                  <button
                    onClick={() => handleChangePassword(selected._id)}
                    className="px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition-all"
                  >
                    🔑 Password
                  </button>
                  <button
                    onClick={() => handleDelete(selected._id)}
                    className="px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>

            {loadingProfile ? (
              <Loader message="Analyzing profile aggregates & logs..." />
            ) : profileData ? (
              <div className="space-y-6">
                {/* 1. Basic Information Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Stethoscope size={14} className="text-blue-500" /> Basic & Clinic Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl">
                    <Field label="Full Name" value={profileData.user.name} />
                    <Field label="PMDC Number" value={profileData.profile.pmdcNumber} />
                    <Field label="Specialization" value={profileData.profile.specialty} />
                    <Field label="City" value={profileData.profile.city || 'Karachi'} />
                    <Field label="Contact Phone" value={profileData.user.phone} />
                    <Field label="Contact Email" value={profileData.user.email} />
                    <Field label="Clinic Location(s)" value={profileData.profile.clinicAddress || profileData.profile.clinicName || 'Not Provided'} />
                    <Field label="Joined Network" value={new Date(profileData.user.createdAt).toLocaleDateString('en-PK', { dateStyle: 'medium' })} />
                  </div>
                </div>

                {/* 2. Documents Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Shield size={14} className="text-emerald-500" /> Uploaded Verification Documents
                  </h4>
                  {(profileData.profile.verificationDocuments || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg">No documents uploaded during registration.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {profileData.profile.verificationDocuments.map((doc, idx) => (
                        <a
                          key={idx}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:text-blue-600 transition-all"
                        >
                          <div className="min-w-0 mr-2">
                            <p className="text-xs font-bold text-slate-800 truncate">{doc.name || 'Certificate'}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                          </div>
                          <span className="text-[10px] font-bold text-blue-600 shrink-0">View File →</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Performance & Logs Tab Selector */}
                <div className="flex border-b border-slate-200">
                  <button
                    onClick={() => setActiveTab('performance')}
                    className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${activeTab === 'performance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    <TrendingUp size={14} /> Performance & Wallet
                  </button>
                  <button
                    onClick={() => setActiveTab('logs')}
                    className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${activeTab === 'logs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    <Activity size={14} /> Activity Logs
                  </button>
                </div>

                {activeTab === 'performance' ? (
                  <div className="space-y-6">
                    {/* 3. Referral Performance Section */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Referral Performance Metrics</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Lifetime Referrals</p>
                          <p className="text-xl font-extrabold text-slate-900 mt-1">{profileData.profile.performance.totalReferrals}</p>
                        </div>
                        <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100/50">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase">Accepted Cases</p>
                          <p className="text-xl font-extrabold text-emerald-700 mt-1">{profileData.profile.performance.acceptedReferrals}</p>
                        </div>
                        <div className="bg-red-50/50 p-3.5 rounded-xl border border-red-100/50">
                          <p className="text-[10px] font-bold text-red-600 uppercase">Rejected Cases</p>
                          <p className="text-xl font-extrabold text-red-700 mt-1">{profileData.profile.performance.rejectedReferrals}</p>
                        </div>
                        <div className="bg-orange-50/50 p-3.5 rounded-xl border border-orange-100/50">
                          <p className="text-[10px] font-bold text-orange-600 uppercase">Emergency Cases</p>
                          <p className="text-xl font-extrabold text-orange-700 mt-1">{profileData.profile.performance.emergencyReferrals}</p>
                        </div>
                        <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100/50">
                          <p className="text-[10px] font-bold text-blue-600 uppercase">Average SLA</p>
                          <p className="text-xl font-extrabold text-blue-700 mt-1">{profileData.profile.performance.averageSlaResponseTime}</p>
                        </div>
                        <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100/50">
                          <p className="text-[10px] font-bold text-indigo-600 uppercase">Success Rate</p>
                          <p className="text-xl font-extrabold text-indigo-700 mt-1">{profileData.profile.performance.successRate}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Referred patients</h4>
                      {patientsLoading ? (
                        <p className="text-xs text-slate-500">Loading patients…</p>
                      ) : patients.length === 0 ? (
                        <p className="text-xs text-slate-500">No referrals yet.</p>
                      ) : (
                        <div className="rounded-xl border border-slate-100 overflow-x-auto max-h-48 overflow-y-auto">
                          <table className="min-w-full text-xs">
                            <thead className="bg-slate-50 text-slate-500 sticky top-0">
                              <tr>
                                <th className="px-2 py-1.5 text-left">Code</th>
                                <th className="px-2 py-1.5 text-left">Patient</th>
                                <th className="px-2 py-1.5 text-left">Hospital</th>
                                <th className="px-2 py-1.5 text-left">Dept</th>
                                <th className="px-2 py-1.5 text-left">Room/Bed</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {patients.map((p) => (
                                <tr key={p._id}>
                                  <td className="px-2 py-1.5 font-mono text-blue-600">{p.referralCode}</td>
                                  <td className="px-2 py-1.5">{p.patientName}</td>
                                  <td className="px-2 py-1.5">{p.targetHospitalId?.hospitalName || '—'}</td>
                                  <td className="px-2 py-1.5">{p.admission?.admissionDepartment || p.department || '—'}</td>
                                  <td className="px-2 py-1.5">
                                    {p.admission ? `R${p.admission.roomNumber} B${p.admission.bedNumber}` : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* 4. Wallet Section */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                        <Wallet size={14} className="text-indigo-500" /> Financial Wallet Center
                      </h4>
                      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-lg space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Current Available Balance</p>
                            <p className="text-2xl font-black mt-1">PKR {((profileData.profile.wallet.currentBalancePaisa || 0) / 100).toLocaleString()}</p>
                          </div>
                          <span className="text-[10px] bg-slate-700/60 border border-slate-600 px-3 py-1 rounded-full font-bold uppercase tracking-wider text-slate-300">
                            PKR WALLET
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-700/50 text-xs">
                          <div>
                            <p className="text-slate-400 font-medium">Pending Clearance</p>
                            <p className="text-sm font-bold text-amber-400 mt-0.5">PKR {((profileData.profile.wallet.pendingAmountPaisa || 0) / 100).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 font-medium">Historical Withdrawn</p>
                            <p className="text-sm font-bold text-slate-200 mt-0.5">PKR {((profileData.profile.wallet.withdrawnAmountPaisa || 0) / 100).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="pt-2 text-[10px] text-slate-400 bg-slate-950/30 rounded-xl p-3 border border-slate-800 flex items-center justify-between">
                          <span className="font-semibold uppercase tracking-wider">Commission Model</span>
                          <span className="font-bold text-indigo-400 uppercase">{profileData.profile.wallet.commissionStructure}</span>
                        </div>
                      </div>
                    </div>

                    {/* Commission & Platform Charges Configuration (v2 per-doctor) */}
                    {commForm && (
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                        <Shield size={14} className="text-indigo-500" /> Commission & Platform Charges
                      </h4>

                      {/* Model toggle */}
                      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-slate-800">Commission model</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Lifetime referrals: <span className="font-bold text-slate-600">{profileData.profile.performance?.totalReferrals ?? 0}</span> — use this to negotiate a higher platform charge for high-volume doctors.
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                              <input type="radio" checked={commForm.commissionModel === 'legacy'} onChange={() => setCf({ commissionModel: 'legacy' })} />
                              Legacy (nested %)
                            </label>
                            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                              <input type="radio" checked={commForm.commissionModel === 'additive'} onChange={() => setCf({ commissionModel: 'additive' })} />
                              Additive (per-doctor)
                            </label>
                          </div>
                        </div>

                        {commForm.commissionModel === 'legacy' ? (
                          <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold text-slate-800">Commission share (%)</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">Split of the platform cut (original nested model).</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number" min="0" max="100"
                                value={commForm.commissionPercentage}
                                onChange={(e) => setCf({ commissionPercentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                                className="w-20 px-2 py-1.5 text-center text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                              <span className="text-xs font-bold text-slate-400">%</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Hospital commission (per referral)</p>
                            <DealRow
                              label="Doctor commission"
                              hint="% of the patient bill, or a flat amount per referral."
                              type={commForm.hospitalCommissionType}
                              onType={(t) => setCf({ hospitalCommissionType: t })}
                              pct={commForm.hospitalCommissionPercentage}
                              onPct={(v) => setCf({ hospitalCommissionPercentage: v })}
                              fixed={commForm.hospitalFixedCommissionRupees}
                              onFixed={(v) => setCf({ hospitalFixedCommissionRupees: v })}
                              fixedUnit="/ referral"
                            />
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 pt-1">Lab commission (per test)</p>
                            <DealRow
                              label="Doctor commission"
                              hint="% of each test, or a flat amount per test."
                              type={commForm.labCommissionType}
                              onType={(t) => setCf({ labCommissionType: t })}
                              pct={commForm.labCommissionPercentage}
                              onPct={(v) => setCf({ labCommissionPercentage: v })}
                              fixed={commForm.labFixedCommissionRupeesPerTest}
                              onFixed={(v) => setCf({ labFixedCommissionRupeesPerTest: v })}
                              fixedUnit="/ test"
                            />
                            <p className="text-[10px] text-slate-400">
                              The <span className="font-bold">platform charge</span> is set on the hospital / lab. The facility pays the admin
                              <span className="font-bold"> commission + platform charge</span>; the admin forwards this commission to the doctor.
                            </p>
                          </div>
                        )}

                        <div className="flex justify-end">
                          <button
                            onClick={saveCommission}
                            disabled={actionId === selected._id}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                          >
                            {actionId === selected._id ? 'Saving…' : 'Save commission settings'}
                          </button>
                        </div>
                      </div>
                    </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* 5. Activity Logs */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 mb-2">
                          <Clock size={14} className="text-amber-500" /> Recent Logins & Device History
                        </h4>
                        {(profileData.profile.loginHistory || []).length === 0 ? (
                          <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg">No login logs recorded.</p>
                        ) : (
                          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                            {profileData.profile.loginHistory.map((log, idx) => (
                              <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                                <div>
                                  <p className="font-semibold text-slate-800">{log.ip}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]" title={log.device}>{log.device}</p>
                                </div>
                                <span className="text-[10px] font-bold text-slate-500 shrink-0">{new Date(log.time).toLocaleString('en-PK')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 mb-2">
                          <Activity size={14} className="text-blue-500" /> Referral Action Events
                        </h4>
                        {(profileData.profile.referralActionsLog || []).length === 0 ? (
                          <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg">No referral events recorded.</p>
                        ) : (
                          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                            {profileData.profile.referralActionsLog.map((log, idx) => (
                              <div key={idx} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-blue-600 uppercase tracking-wider text-[10px]">{log.action}</span>
                                  <span className="text-[10px] font-bold text-slate-400">{new Date(log.time).toLocaleString('en-PK')}</span>
                                </div>
                                {log.details && Object.keys(log.details).length > 0 && (
                                  <p className="text-[10px] text-slate-500 font-mono bg-white p-1.5 rounded border border-slate-200/50 break-all">
                                    {JSON.stringify(log.details)}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-red-500 text-sm">Failed to compile details.</div>
            )}
          </div>
        )}
      </DetailModal>

      {consultantEditOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">Edit consultant</h3>
            <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Specialty" value={consultantEditForm.specialty || ''} onChange={(e) => setConsultantEditForm({ ...consultantEditForm, specialty: e.target.value })} />
            <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="CNIC" value={consultantEditForm.cnic || ''} onChange={(e) => setConsultantEditForm({ ...consultantEditForm, cnic: e.target.value })} />
            <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Clinic name" value={consultantEditForm.clinicName || ''} onChange={(e) => setConsultantEditForm({ ...consultantEditForm, clinicName: e.target.value })} />
            <textarea className="w-full border rounded-xl px-3 py-2 text-sm" rows={2} placeholder="Clinic address" value={consultantEditForm.clinicAddress || ''} onChange={(e) => setConsultantEditForm({ ...consultantEditForm, clinicAddress: e.target.value })} />
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Commission %</label>
              <input className="w-full border rounded-xl px-3 py-2 text-sm" type="number" placeholder="Commission %" value={consultantEditForm.commissionPercentage ?? ''} onChange={(e) => setConsultantEditForm({ ...consultantEditForm, commissionPercentage: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Max lab discount % (patient discount this consultant may offer on lab referrals)</label>
              <input className="w-full border rounded-xl px-3 py-2 text-sm" type="number" min="0" max="100" placeholder="Max lab discount %" value={consultantEditForm.maxLabDiscountPercentage ?? ''} onChange={(e) => setConsultantEditForm({ ...consultantEditForm, maxLabDiscountPercentage: Number(e.target.value) })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={consultantEditForm.isVerified === true} onChange={(e) => setConsultantEditForm({ ...consultantEditForm, isVerified: e.target.checked })} />
              PMDC / profile verified
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConsultantEditOpen(false)} className="px-4 py-2 text-sm text-slate-500">Cancel</button>
              <button type="button" onClick={saveConsultantEdit} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminConsultants;
