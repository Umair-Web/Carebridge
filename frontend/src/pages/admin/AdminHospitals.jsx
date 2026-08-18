import { useState, useEffect, useCallback } from 'react';
import { Building2, Eye, Search, BedDouble, Stethoscope, Download } from 'lucide-react';
import { downloadPdf } from '../../utils/downloadFile';
import api from '../../utils/api';
import Loader from '../../components/Loader';
import toast from 'react-hot-toast';
import DetailModal from '../../components/DetailModal';

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

const AdminHospitals = () => {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [platformForm, setPlatformForm] = useState({ platformChargeType: 'percentage', deductionPercentage: 20, fixedPlatformChargeRupees: 0 });
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [adminDoctors, setAdminDoctors] = useState([]);
  const [newDoctor, setNewDoctor] = useState({ name: '', specialty: '', consultationFee: '' });
  // Per-consultant platform-fee overrides for the selected hospital.
  const [ovList, setOvList] = useState([]);
  const [ovLoading, setOvLoading] = useState(false);
  const [ovSearch, setOvSearch] = useState('');
  const [ovDraft, setOvDraft] = useState({}); // consultantId -> { type, pct, rupees }
  const [ovSavingId, setOvSavingId] = useState(null);

  useEffect(() => {
    const p = selected?.profile;
    if (!p) return;
    setPlatformForm({
      platformChargeType: p.platformChargeType || 'percentage',
      deductionPercentage: p.deductionPercentage ?? 20,
      fixedPlatformChargeRupees: (p.fixedPlatformChargePaisa || 0) / 100,
    });
  }, [selected]);

  const savePlatformCharge = async () => {
    try {
      setActionId(selected._id);
      await api.post(`/admin/hospitals/${selected._id}/deduction`, {
        platformChargeType: platformForm.platformChargeType,
        deductionPercentage: Number(platformForm.deductionPercentage) || 0,
        fixedPlatformChargeRupees: Number(platformForm.fixedPlatformChargeRupees) || 0,
      });
      toast.success('Platform charge updated');
      setSelected((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          platformChargeType: platformForm.platformChargeType,
          deductionPercentage: Number(platformForm.deductionPercentage) || 0,
          fixedPlatformChargePaisa: Math.round((Number(platformForm.fixedPlatformChargeRupees) || 0) * 100),
        },
      }));
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update platform charge');
    } finally {
      setActionId(null);
    }
  };

  const loadOverrides = useCallback(async (hospitalRef) => {
    if (!hospitalRef) return;
    setOvLoading(true);
    try {
      const res = await api.get(`/admin/hospitals/${hospitalRef}/consultant-overrides`);
      if (res.data.success) {
        const list = res.data.data || [];
        setOvList(list);
        const draft = {};
        for (const c of list) {
          draft[c.consultantId] = c.override
            ? { type: c.override.platformChargeType, pct: c.override.platformChargePercentage || 0, rupees: c.override.fixedPlatformChargeRupees || 0 }
            : { type: 'percentage', pct: 0, rupees: 0 };
        }
        setOvDraft(draft);
      }
    } catch {
      toast.error('Failed to load consultant platform fees');
    } finally {
      setOvLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected?._id && selected?.profile?._id) loadOverrides(selected._id);
    else { setOvList([]); setOvDraft({}); setOvSearch(''); }
  }, [selected?._id, selected?.profile?._id, loadOverrides]);

  const setDraft = (consultantId, patch) =>
    setOvDraft((m) => ({ ...m, [consultantId]: { ...(m[consultantId] || { type: 'percentage', pct: 0, rupees: 0 }), ...patch } }));

  const saveOverride = async (consultantId) => {
    const d = ovDraft[consultantId] || { type: 'percentage', pct: 0, rupees: 0 };
    setOvSavingId(consultantId);
    try {
      await api.post(`/admin/hospitals/${selected._id}/consultant-overrides`, {
        consultantId,
        platformChargeType: d.type,
        platformChargePercentage: d.type === 'percentage' ? Number(d.pct) || 0 : 0,
        fixedPlatformChargeRupees: d.type === 'fixed' ? Number(d.rupees) || 0 : 0,
      });
      toast.success('Special platform fee saved');
      await loadOverrides(selected._id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save platform fee');
    } finally {
      setOvSavingId(null);
    }
  };

  const clearOverride = async (consultantId) => {
    setOvSavingId(consultantId);
    try {
      await api.post(`/admin/hospitals/${selected._id}/consultant-overrides`, { consultantId, remove: true });
      toast.success('Reverted to the hospital default fee');
      await loadOverrides(selected._id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revert');
    } finally {
      setOvSavingId(null);
    }
  };

  useEffect(() => {
    const hospitalId = selected?.profile?._id;
    if (!hospitalId) {
      setPatients([]);
      return;
    }
    setPatientsLoading(true);
    api.get(`/admin/hospitals/${hospitalId}/patients`)
      .then((res) => {
        if (res.data.success) setPatients(res.data.data || []);
      })
      .catch(() => toast.error('Failed to load patient list'))
      .finally(() => setPatientsLoading(false));
  }, [selected?.profile?._id]);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/users?role=hospital');
      if (res.data.success) setHospitals(res.data.data || []);
    } catch (e) {
      toast.error('Failed to load hospitals');
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
      toast.success(`Hospital ${newStatus === 'active' ? 'activated' : 'suspended'}`);
      if (selected?._id === userId) setSelected(prev => ({ ...prev, status: newStatus }));
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Are you absolutely sure you want to permanently delete this hospital? This cannot be undone.')) {
      setActionId(userId);
      try {
        const res = await api.delete(`/admin/users/${userId}`);
        if (res.data.success) {
          toast.success('Hospital deleted successfully');
          setSelected(null);
          await load();
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to delete hospital');
      } finally {
        setActionId(null);
      }
    }
  };

  const loadAdminDoctors = async (hospitalId) => {
    if (!hospitalId) return;
    try {
      const res = await api.get(`/admin/hospitals/${hospitalId}/doctors`);
      if (res.data.success) setAdminDoctors(res.data.data || []);
    } catch {
      setAdminDoctors([]);
    }
  };

  const openFacilityEdit = () => {
    if (!selected?.profile) return;
    const p = selected.profile;
    setEditForm({
      hospitalName: p.hospitalName || '',
      registrationNumber: p.registrationNumber || '',
      representativeCnic: p.representativeCnic || '',
      address: p.address || '',
      city: p.city || '',
      area: p.area || '',
      departments: (p.departments || []).join(', '),
      isActive: p.isActive !== false,
      deductionPercentage: p.deductionPercentage ?? 20,
      ratePackages: p.ratePackages || [],
    });
    loadAdminDoctors(p._id);
    setEditOpen(true);
  };

  const saveFacilityEdit = async () => {
    const hospitalId = selected?.profile?._id;
    if (!hospitalId) return;
    setActionId(selected._id);
    try {
      const departments = editForm.departments
        ? String(editForm.departments).split(',').map((d) => d.trim()).filter(Boolean)
        : [];
      await api.patch(`/admin/hospitals/${hospitalId}`, {
        hospitalName: editForm.hospitalName,
        registrationNumber: editForm.registrationNumber,
        representativeCnic: editForm.representativeCnic,
        address: editForm.address,
        city: editForm.city,
        area: editForm.area,
        departments,
        isActive: editForm.isActive,
        deductionPercentage: Number(editForm.deductionPercentage),
        ratePackages: editForm.ratePackages,
      });
      toast.success('Hospital updated');
      setEditOpen(false);
      await load();
      const refreshed = (await api.get('/admin/users?role=hospital')).data.data?.find((h) => h._id === selected._id);
      if (refreshed) setSelected(refreshed);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setActionId(null);
    }
  };

  const addAdminDoctor = async () => {
    const hospitalId = selected?.profile?._id;
    if (!hospitalId || !newDoctor.name || !newDoctor.specialty) {
      return toast.error('Doctor name and specialty required');
    }
    try {
      await api.post(`/admin/hospitals/${hospitalId}/doctors`, {
        name: newDoctor.name,
        specialty: newDoctor.specialty,
        consultationFee: Number(newDoctor.consultationFee) || 0,
      });
      toast.success('Doctor added');
      setNewDoctor({ name: '', specialty: '', consultationFee: '' });
      loadAdminDoctors(hospitalId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add doctor');
    }
  };

  const removeAdminDoctor = async (doctorId) => {
    const hospitalId = selected?.profile?._id;
    if (!window.confirm('Remove this doctor?')) return;
    try {
      await api.delete(`/admin/hospitals/${hospitalId}/doctors/${doctorId}`);
      toast.success('Doctor removed');
      loadAdminDoctors(hospitalId);
    } catch (err) {
      toast.error('Failed to remove doctor');
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

  const filtered = hospitals.filter(h =>
    h.name?.toLowerCase().includes(search.toLowerCase()) ||
    h.email?.toLowerCase().includes(search.toLowerCase()) ||
    h.profile?.hospitalName?.toLowerCase().includes(search.toLowerCase()) ||
    h.profile?.address?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Loader message="Loading hospitals..." />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-teal-100 text-teal-600"><Building2 className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Hospitals</h1>
          <p className="text-slate-500 text-sm mt-1">Manage all registered hospital facilities on the platform.</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search by hospital name, admin email, address…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 outline-none shadow-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-5 py-3.5 font-semibold">Hospital</th>
              <th className="px-5 py-3.5 font-semibold">Reg. No.</th>
              <th className="px-5 py-3.5 font-semibold">Departments</th>
              <th className="px-5 py-3.5 font-semibold">Beds Available</th>
              <th className="px-5 py-3.5 font-semibold">Status</th>
              <th className="px-5 py-3.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">No hospitals found.</td></tr>
            ) : filtered.map(h => {
              const availableBeds = h.profile?.bedsInventory?.reduce((acc, curr) => acc + (curr.availableBeds || 0), 0) || 0;
              return (
                <tr key={h._id}
                  className="hover:bg-teal-50/30 transition-colors cursor-pointer"
                  onClick={() => setSelected(h)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 font-bold text-sm flex items-center justify-center shrink-0">
                        {(h.profile?.hospitalName || h.name)?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{h.profile?.hospitalName || h.name}</p>
                        <p className="text-xs text-slate-500">{h.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-700">{h.profile?.registrationNumber || '—'}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(h.profile?.departments || []).slice(0, 2).map(d => (
                        <span key={d} className="px-2 py-0.5 bg-teal-50 text-teal-700 text-[10px] font-semibold rounded-full">{d}</span>
                      ))}
                      {(h.profile?.departments || []).length > 2 && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-semibold rounded-full">
                          +{(h.profile?.departments || []).length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-semibold text-xs text-slate-700">
                    <span className={availableBeds > 0 ? 'text-emerald-600' : 'text-red-500'}>
                      {availableBeds} beds available
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg capitalize ${statusBadge(h.status)}`}>
                      {h.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setSelected(h)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-teal-600 transition-colors">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => downloadPdf(`/exports/admin/hospitals/${h._id}`, `Hospital_${(h.profile?.hospitalName || h.name || 'file').replace(/\s+/g, '_')}.pdf`)}
                        title="Download complete file"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-teal-600 transition-colors">
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => toggleStatus(h._id, h.status)}
                        disabled={actionId === h._id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                          h.status === 'active'
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {actionId === h._id ? '…' : h.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Slide-over */}
      <DetailModal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.profile?.hospitalName || selected?.name || ''}
        subtitle={`Hospital · Admin: ${selected?.name} · ${selected?.email}`}
        wide
      >
        {selected && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 font-black text-xl flex items-center justify-center shrink-0">
                    {(selected.profile?.hospitalName || selected.name)?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{selected.profile?.hospitalName || selected.name}</h3>
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
                    onClick={openFacilityEdit}
                    className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all"
                  >
                    Edit facility
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPdf(`/exports/admin/hospitals/${selected._id}`, `Hospital_${(selected.profile?.hospitalName || selected.name || 'file').replace(/\s+/g, '_')}.pdf`)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white hover:bg-teal-700 rounded-xl text-xs font-bold transition-all"
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

            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl">
              <Field label="Admin Name" value={selected.name} />
              <Field label="Email" value={selected.email} />
              <Field label="Phone" value={selected.phone} />
              <Field label="Registered On" value={new Date(selected.createdAt).toLocaleDateString('en-PK', { dateStyle: 'medium' })} />
            </div>

            {selected.profile && (
              <>
                <div className="space-y-4 border-t border-slate-100 pt-5">
                  <div className="flex items-center gap-2 text-teal-700 font-bold text-sm mb-2">
                    <Building2 size={16} /> Facility Details
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Hospital Name" value={selected.profile.hospitalName} />
                    <Field label="Reg. Number" value={selected.profile.registrationNumber} />
                    <Field label="Representative CNIC" value={selected.profile.representativeCnic} />
                    <Field label="Registration verified" value={selected.profile.isRegistrationVerified ? 'Yes' : 'No'} />
                    <Field label="Address" value={selected.profile.address} />
                  </div>
                </div>

                {selected.profile.departments?.length > 0 && (
                  <div className="border-t border-slate-100 pt-5">
                    <div className="flex items-center gap-2 text-teal-700 font-bold text-sm mb-3">
                      <Stethoscope size={16} /> Departments
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selected.profile.departments.map(d => (
                        <span key={d} className="px-3 py-1.5 bg-teal-50 text-teal-700 text-xs font-semibold rounded-full">{d}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selected.profile.bedsInventory?.length > 0 && (
                  <div className="border-t border-slate-100 pt-5">
                    <div className="flex items-center gap-2 text-slate-700 font-bold text-sm mb-3">
                      <BedDouble size={16} /> Bed Inventory
                    </div>
                    <div className="rounded-xl border border-slate-100 overflow-hidden">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-4 py-2.5 text-left font-semibold">Ward</th>
                            <th className="px-4 py-2.5 text-left font-semibold">Total</th>
                            <th className="px-4 py-2.5 text-left font-semibold">Available</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selected.profile.bedsInventory.map(b => (
                            <tr key={b.ward}>
                              <td className="px-4 py-2.5 font-medium text-slate-700">{b.ward}</td>
                              <td className="px-4 py-2.5 text-slate-600">{b.totalBeds}</td>
                              <td className="px-4 py-2.5">
                                <span className={`font-bold ${b.availableBeds > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {b.availableBeds}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-5">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm mb-3">
                    Patients & bed placement
                  </div>
                  {patientsLoading ? (
                    <p className="text-sm text-slate-500">Loading patients…</p>
                  ) : patients.length === 0 ? (
                    <p className="text-sm text-slate-500">No referrals for this hospital yet.</p>
                  ) : (
                    <div className="rounded-xl border border-slate-100 overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left">Code</th>
                            <th className="px-3 py-2 text-left">Patient</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Dept</th>
                            <th className="px-3 py-2 text-left">Doctor</th>
                            <th className="px-3 py-2 text-left">Room / Bed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {patients.map((p) => (
                            <tr key={p._id}>
                              <td className="px-3 py-2 font-mono text-blue-600">{p.referralCode}</td>
                              <td className="px-3 py-2 font-medium">{p.patientName}</td>
                              <td className="px-3 py-2 capitalize">{p.status}</td>
                              <td className="px-3 py-2">{p.admission?.admissionDepartment || p.assignedDepartment || p.department || '—'}</td>
                              <td className="px-3 py-2">
                                {p.admission?.treatingDoctorId?.name
                                  ? `Dr. ${p.admission.treatingDoctorId.name.replace(/^Dr\.\s*/i, '')}`
                                  : p.targetDoctorId?.name
                                    ? `Dr. ${p.targetDoctorId.name.replace(/^Dr\.\s*/i, '')} (target)`
                                    : '—'}
                              </td>
                              <td className="px-3 py-2">
                                {p.admission
                                  ? `R${p.admission.roomNumber} · B${p.admission.bedNumber}`
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Platform charge settings (Hospital → Admin) */}
                <div className="border-t border-slate-100 pt-5">
                  <div className="flex items-center gap-2 text-teal-700 font-bold text-sm mb-3">
                    🛡️ Platform Charge Configuration
                  </div>
                  <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-3">
                    <div>
                      <p className="text-xs font-bold text-slate-800">What this hospital pays the platform</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Choose <span className="font-semibold">one</span> type — a percentage of each bill, or a fixed price per
                        referral. It applies to every patient at this hospital. The hospital's weekly total is this platform charge
                        <span className="font-semibold"> plus</span> each consultant's commission.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                        <input type="radio" checked={platformForm.platformChargeType === 'percentage'} onChange={() => setPlatformForm((f) => ({ ...f, platformChargeType: 'percentage' }))} />
                        Percentage
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                        <input type="radio" checked={platformForm.platformChargeType === 'fixed'} onChange={() => setPlatformForm((f) => ({ ...f, platformChargeType: 'fixed' }))} />
                        Fixed per referral
                      </label>
                      <div className="ml-auto flex items-center gap-1.5">
                        {platformForm.platformChargeType === 'percentage' ? (
                          <>
                            <input
                              type="number" min="0" max="100"
                              value={platformForm.deductionPercentage}
                              onChange={(e) => setPlatformForm((f) => ({ ...f, deductionPercentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))}
                              className="w-20 px-2 py-1.5 text-center text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                            />
                            <span className="text-xs font-bold text-slate-400">% of bill</span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs font-bold text-slate-400">Rs</span>
                            <input
                              type="number" min="0"
                              value={platformForm.fixedPlatformChargeRupees}
                              onChange={(e) => setPlatformForm((f) => ({ ...f, fixedPlatformChargeRupees: Math.max(0, Number(e.target.value) || 0) }))}
                              className="w-24 px-2 py-1.5 text-center text-sm font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                            />
                            <span className="text-[10px] font-medium text-slate-400">/ referral</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={savePlatformCharge}
                        disabled={actionId === selected._id}
                        className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                      >
                        {actionId === selected._id ? 'Saving…' : 'Update platform charge'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Special platform fee for specific consultants (overrides the hospital default) */}
                <div className="border-t border-slate-100 pt-5">
                  <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm mb-1">
                    🎯 Special Platform Fee for Specific Consultants
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Optionally charge <span className="font-semibold">certain consultants</span> a different platform fee for their
                    referrals to this hospital. The doctor's commission never changes — only the platform fee (and so the hospital's
                    total) differs. Consultants without a special fee keep the hospital default above. Applies to new referrals only.
                  </p>

                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      value={ovSearch}
                      onChange={(e) => setOvSearch(e.target.value)}
                      placeholder="Search consultants by name or specialty…"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  {ovLoading ? (
                    <p className="text-xs text-slate-400 py-4 text-center">Loading consultants…</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {ovList
                        .filter((c) => {
                          const q = ovSearch.trim().toLowerCase();
                          if (!q) return true;
                          return c.name.toLowerCase().includes(q) || (c.specialty || '').toLowerCase().includes(q);
                        })
                        .map((c) => {
                          const d = ovDraft[c.consultantId] || { type: 'percentage', pct: 0, rupees: 0 };
                          const hasOverride = !!c.override;
                          return (
                            <div
                              key={c.consultantId}
                              className={`rounded-xl p-3 border ${hasOverride ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200 bg-white'}`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-800 truncate">{c.name}</p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    {c.specialty || '—'} · <span className="font-semibold text-slate-500">{c.referralCount}</span> referrals here
                                  </p>
                                </div>
                                {hasOverride ? (
                                  <span className="shrink-0 text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                                    Special: {c.override.platformChargeType === 'percentage' ? `${c.override.platformChargePercentage}%` : `Rs ${c.override.fixedPlatformChargeRupees}`}
                                  </span>
                                ) : (
                                  <span className="shrink-0 text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Default fee</span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600 cursor-pointer">
                                  <input type="radio" checked={d.type === 'percentage'} onChange={() => setDraft(c.consultantId, { type: 'percentage' })} />
                                  %
                                </label>
                                <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600 cursor-pointer">
                                  <input type="radio" checked={d.type === 'fixed'} onChange={() => setDraft(c.consultantId, { type: 'fixed' })} />
                                  Fixed
                                </label>
                                {d.type === 'percentage' ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number" min="0" max="100"
                                      value={d.pct}
                                      onChange={(e) => setDraft(c.consultantId, { pct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                                      className="w-16 px-2 py-1 text-center text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <span className="text-[10px] font-bold text-slate-400">% of bill</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-bold text-slate-400">Rs</span>
                                    <input
                                      type="number" min="0"
                                      value={d.rupees}
                                      onChange={(e) => setDraft(c.consultantId, { rupees: Math.max(0, Number(e.target.value) || 0) })}
                                      className="w-20 px-2 py-1 text-center text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <span className="text-[10px] font-medium text-slate-400">/ referral</span>
                                  </div>
                                )}
                                <div className="ml-auto flex items-center gap-1.5">
                                  {hasOverride && (
                                    <button
                                      onClick={() => clearOverride(c.consultantId)}
                                      disabled={ovSavingId === c.consultantId}
                                      className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-red-600 disabled:opacity-50"
                                    >
                                      Clear
                                    </button>
                                  )}
                                  <button
                                    onClick={() => saveOverride(c.consultantId)}
                                    disabled={ovSavingId === c.consultantId}
                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm disabled:opacity-50"
                                  >
                                    {ovSavingId === c.consultantId ? 'Saving…' : hasOverride ? 'Update' : 'Set fee'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      {ovList.length === 0 && (
                        <p className="text-xs text-slate-400 py-4 text-center">No consultants found.</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </DetailModal>

      {editOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Edit hospital facility</h3>
            <div className="grid gap-3">
              <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Hospital name" value={editForm.hospitalName || ''} onChange={(e) => setEditForm({ ...editForm, hospitalName: e.target.value })} />
            <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Registration number" value={editForm.registrationNumber || ''} onChange={(e) => setEditForm({ ...editForm, registrationNumber: e.target.value })} />
            <input className="w-full border rounded-xl px-3 py-2 text-sm font-mono" placeholder="Representative CNIC" value={editForm.representativeCnic || ''} onChange={(e) => setEditForm({ ...editForm, representativeCnic: e.target.value })} />
            <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Address" value={editForm.address || ''} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded-xl px-3 py-2 text-sm" placeholder="City" value={editForm.city || ''} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                <input className="border rounded-xl px-3 py-2 text-sm" placeholder="Area" value={editForm.area || ''} onChange={(e) => setEditForm({ ...editForm, area: e.target.value })} />
              </div>
              <textarea className="w-full border rounded-xl px-3 py-2 text-sm" rows={2} placeholder="Departments (comma-separated)" value={editForm.departments || ''} onChange={(e) => setEditForm({ ...editForm, departments: e.target.value })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.isActive !== false} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
                Active for referrals
              </label>
            </div>
            <div className="border-t pt-4 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase">Rate packages (PKR)</p>
              {(editForm.ratePackages || []).map((pkg, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-1 text-xs">
                  <input className="border rounded px-2 py-1" placeholder="Dept" value={pkg.department || ''}
                    onChange={(e) => {
                      const ratePackages = [...editForm.ratePackages];
                      ratePackages[idx] = { ...ratePackages[idx], department: e.target.value };
                      setEditForm({ ...editForm, ratePackages });
                    }} />
                  <input className="border rounded px-2 py-1" placeholder="Service" value={pkg.serviceName || ''}
                    onChange={(e) => {
                      const ratePackages = [...editForm.ratePackages];
                      ratePackages[idx] = { ...ratePackages[idx], serviceName: e.target.value };
                      setEditForm({ ...editForm, ratePackages });
                    }} />
                  <input className="border rounded px-2 py-1" type="number" placeholder="Min" value={pkg.minPrice ? pkg.minPrice / 100 : ''}
                    onChange={(e) => {
                      const ratePackages = [...editForm.ratePackages];
                      ratePackages[idx] = { ...ratePackages[idx], minPrice: Math.round(Number(e.target.value) * 100) };
                      setEditForm({ ...editForm, ratePackages });
                    }} />
                  <input className="border rounded px-2 py-1" type="number" placeholder="Max" value={pkg.maxPrice ? pkg.maxPrice / 100 : ''}
                    onChange={(e) => {
                      const ratePackages = [...editForm.ratePackages];
                      ratePackages[idx] = { ...ratePackages[idx], maxPrice: Math.round(Number(e.target.value) * 100) };
                      setEditForm({ ...editForm, ratePackages });
                    }} />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setEditForm({
                    ...editForm,
                    ratePackages: [
                      ...(editForm.ratePackages || []),
                      { department: '', serviceName: '', minPrice: 0, maxPrice: 0 },
                    ],
                  })
                }
                className="text-xs font-bold text-blue-600"
              >
                + Add rate package
              </button>
            </div>
            <div className="border-t pt-4">
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Doctors roster</p>
              <ul className="space-y-1 max-h-32 overflow-y-auto text-sm mb-3">
                {adminDoctors.map((d) => (
                  <li key={d._id} className="flex justify-between items-center bg-slate-50 px-2 py-1 rounded">
                    <span>Dr. {d.name} ({d.specialty})</span>
                    <button type="button" onClick={() => removeAdminDoctor(d._id)} className="text-red-600 text-xs font-bold">Remove</button>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-3 gap-2">
                <input className="border rounded-lg px-2 py-1.5 text-xs" placeholder="Name" value={newDoctor.name} onChange={(e) => setNewDoctor({ ...newDoctor, name: e.target.value })} />
                <input className="border rounded-lg px-2 py-1.5 text-xs" placeholder="Specialty" value={newDoctor.specialty} onChange={(e) => setNewDoctor({ ...newDoctor, specialty: e.target.value })} />
                <input className="border rounded-lg px-2 py-1.5 text-xs" placeholder="Fee PKR" type="number" value={newDoctor.consultationFee} onChange={(e) => setNewDoctor({ ...newDoctor, consultationFee: e.target.value })} />
              </div>
              <button type="button" onClick={addAdminDoctor} className="mt-2 text-xs font-bold text-blue-600">+ Add doctor</button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-500">Cancel</button>
              <button type="button" onClick={saveFacilityEdit} disabled={actionId === selected?._id} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHospitals;
