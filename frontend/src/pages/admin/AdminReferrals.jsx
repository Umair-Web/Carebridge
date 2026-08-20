import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertCircle, Search, Edit2, Trash2, X, Check, Eye, Download, KeyRound } from 'lucide-react';
import { downloadPdf } from '../../utils/downloadFile';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import Loader from '../../components/Loader';
import DetailModal from '../../components/DetailModal';
import DobPicker from '../../components/DobPicker';
import ReferralDetailsPasswordGate from '../../components/ReferralDetailsPasswordGate';
import { ageFromDob, formatDob, formatAge, ageLabel } from '../../utils/dob';
import { detailsViewAccessOf } from '../../utils/referralAccess';

const AdminReferrals = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRef, setSelectedRef] = useState(null);
  const [pendingUnlock, setPendingUnlock] = useState(null);
  const [detailsUnlocked, setDetailsUnlocked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0); // 0: none, 1: first click, 2: typing name
  const [changingDetailsPassword, setChangingDetailsPassword] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    patientName: '',
    dateOfBirth: '',
    age: '',
    gender: 'male',
    phone: '',
    area: '',
    cnic: '',
    guardianRelation: 'S/O',
    guardianName: '',
    urgency: 'routine',
    symptomsText: '',
    summaryNotes: '',
    department: '',
    diagnosisText: '',
    status: 'pending',
    // Admission details
    roomNumber: '',
    bedNumber: '',
    admissionDepartment: '',
    treatingDoctorId: '',
  });

  const [hospitalDoctors, setHospitalDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  const { data: referrals, isLoading, error } = useQuery({
    queryKey: ['admin-referrals'],
    queryFn: async () => {
      const res = await api.get('/admin/referrals');
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  // Fetch hospital doctors when editing an admitted referral
  useEffect(() => {
    if (isEditing && editForm.status === 'admitted' && selectedRef?.targetHospitalId?._id) {
      const fetchDoctors = async () => {
        setLoadingDoctors(true);
        try {
          const res = await api.get(`/referrals/hospitals/${selectedRef.targetHospitalId._id}/doctors`);
          if (res.data.success) {
            setHospitalDoctors(res.data.data);
          }
        } catch (err) {
          console.error('Failed to fetch hospital doctors:', err);
          toast.error('Failed to load doctors list for this hospital');
        } finally {
          setLoadingDoctors(false);
        }
      };
      fetchDoctors();
    } else {
      setHospitalDoctors([]);
    }
  }, [isEditing, editForm.status, selectedRef?.targetHospitalId?._id]);

  const closeDetail = () => {
    setSelectedRef(null);
    setDetailsUnlocked(false);
    setIsEditing(false);
    setDeleteConfirmStep(0);
    setChangingDetailsPassword(false);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const res = await api.patch(`/admin/referrals/${id}`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Referral updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-referrals'] });
      closeDetail();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update referral');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/admin/referrals/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Referral deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-referrals'] });
      closeDetail();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete referral');
    },
  });

  const requestView = (ref) => {
    setPendingUnlock(ref);
  };

  const toggleDetailsViewAccess = async () => {
    if (!selectedRef?._id) return;
    const next = detailsViewAccessOf(selectedRef) === 'active' ? 'suspended' : 'active';
    try {
      const res = await api.patch(`/admin/referrals/${selectedRef._id}/details-view-access`, {
        detailsViewAccess: next,
      });
      if (res.data.success) {
        setSelectedRef((prev) => ({ ...prev, detailsViewAccess: next }));
        queryClient.invalidateQueries({ queryKey: ['admin-referrals'] });
        toast.success(res.data.message || `View access set to ${next}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update view access');
    }
  };

  const handleChangeDetailsPassword = async () => {
    if (!selectedRef?._id) return;
    const newPass = window.prompt('Enter new patient details password (minimum 6 characters):');
    if (newPass == null) return;
    if (newPass.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setChangingDetailsPassword(true);
    try {
      const res = await api.post(`/admin/referrals/${selectedRef._id}/change-details-password`, {
        password: newPass,
      });
      if (res.data.success) toast.success('Patient details password updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingDetailsPassword(false);
    }
  };

  if (isLoading) {
    return <Loader message="Loading referrals..." />;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        Failed to load referrals
      </div>
    );
  }

  const filteredReferrals = referrals?.filter((r) =>
    r.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.referralCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.targetHospitalId?.hospitalName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.consultantName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted': return 'bg-green-50 text-green-700 border-green-200';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
      case 'admitted': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'closed': return 'bg-slate-50 text-slate-700 border-slate-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'emergency': return 'bg-red-500 text-white animate-pulse';
      case 'urgent': return 'bg-orange-500 text-white';
      default: return 'bg-blue-500 text-white';
    }
  };

  const startEdit = (ref) => {
    setEditForm({
      patientName: ref.patientName || '',
      dateOfBirth: ref.dateOfBirth || '',
      age: ref.age || '',
      gender: ref.gender || 'male',
      phone: ref.phone || '',
      area: ref.area || '',
      cnic: ref.cnic || '',
      guardianRelation: ref.guardianRelation || 'S/O',
      guardianName: ref.guardianName || '',
      urgency: ref.urgency || 'routine',
      symptomsText: ref.symptomsText || '',
      summaryNotes: ref.summaryNotes || '',
      department: ref.department || '',
      diagnosisText: ref.diagnosisText || '',
      status: ref.status || 'pending',
      // Admission overrides
      roomNumber: ref.admission?.roomNumber || '',
      bedNumber: ref.admission?.bedNumber || '',
      admissionDepartment: ref.admission?.admissionDepartment || '',
      treatingDoctorId: ref.admission?.treatingDoctorId?._id || ref.admission?.treatingDoctorId || '',
    });
    setIsEditing(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    updateMutation.mutate({ id: selectedRef._id, payload: editForm });
  };

  const handleDelete = () => {
    if (deleteConfirmStep === 0) {
      setDeleteConfirmStep(1);
    } else if (deleteConfirmStep === 1) {
      deleteMutation.mutate(selectedRef._id);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Referral Management Center
          </h1>
          <p className="text-slate-500 text-sm mt-1">Live monitoring and override controls for all network referrals.</p>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search referrals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Consultant</th>
                <th className="px-4 py-3 font-medium">Target Hospital</th>
                <th className="px-4 py-3 font-medium">Urgency</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReferrals?.map((ref) => {
                return (
                  <tr key={ref._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{ref.referralCode}</td>
                    <td className="px-4 py-3 text-slate-900 font-semibold">{ref.patientName}</td>
                    <td className="px-4 py-3 text-slate-600">{ref.consultantName}</td>
                    <td className="px-4 py-3 text-slate-600">{ref.targetHospitalId?.hospitalName || 'Pending Assignment'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getPriorityColor(ref.urgency)}`}>
                        {ref.urgency}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 border rounded-full text-xs font-bold capitalize ${getStatusColor(ref.status)}`}>
                        {ref.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => requestView(ref)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </button>
                        <button
                          onClick={() => downloadPdf(`/exports/admin/referrals/${ref._id}`, `Patient_Record_${ref.referralCode}.pdf`)}
                          title="Download patient record PDF"
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" /> PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredReferrals?.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                    No referrals found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pendingUnlock && (
        <ReferralDetailsPasswordGate
          referral={pendingUnlock}
          verifyPath={`/admin/referrals/${pendingUnlock._id}/verify-details-password`}
          onClose={() => setPendingUnlock(null)}
          onUnlocked={() => {
            setSelectedRef(pendingUnlock);
            setDetailsUnlocked(true);
            setIsEditing(false);
            setDeleteConfirmStep(0);
            setPendingUnlock(null);
          }}
        />
      )}

      {/* Details Slide-Over */}
      <DetailModal
        isOpen={!!selectedRef && detailsUnlocked}
        onClose={closeDetail}
        title={`Referral Details`}
        subtitle={selectedRef ? `${selectedRef.patientName} (${selectedRef.referralCode})` : ''}
        wide={isEditing}
      >
        {selectedRef && (
          <div className="space-y-6">
            {!isEditing ? (
              // View Mode
              <>
                <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100">
                  <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                    detailsViewAccessOf(selectedRef) === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    External view: {detailsViewAccessOf(selectedRef)}
                  </span>
                  <button
                    type="button"
                    onClick={toggleDetailsViewAccess}
                    className={`inline-flex h-9 items-center gap-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      detailsViewAccessOf(selectedRef) === 'active'
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {detailsViewAccessOf(selectedRef) === 'active' ? 'Suspend' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={handleChangeDetailsPassword}
                    disabled={changingDetailsPassword}
                    className="inline-flex h-9 items-center gap-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    <KeyRound size={14} /> {changingDetailsPassword ? '…' : 'Change password'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-sm border border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Patient Name</span>
                    <span className="font-semibold text-slate-800">{selectedRef.patientName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Date of Birth</span>
                    <span className="font-semibold text-slate-800">{formatDob(selectedRef.dateOfBirth) || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Age & Gender</span>
                    <span className="font-semibold text-slate-800">{ageLabel(selectedRef)} · {selectedRef.gender}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Contact Number</span>
                    <span className="font-semibold text-slate-800">{selectedRef.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Patient CNIC</span>
                    <span className="font-semibold text-slate-800">{selectedRef.cnic || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Guardian</span>
                    <span className="font-semibold text-slate-800">{[selectedRef.guardianRelation, selectedRef.guardianName].filter(Boolean).join(' ') || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Area / Locality</span>
                    <span className="font-semibold text-slate-800">{selectedRef.area || '—'}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Clinical Details</h3>
                  <div className="bg-slate-50 p-4 rounded-xl text-sm border border-slate-100 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">AI Department Selection</span>
                      <span className="font-semibold text-slate-800">{selectedRef.department || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Provisional Diagnosis</span>
                      <span className="font-semibold text-slate-800">{selectedRef.diagnosisText || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Symptoms</span>
                      <span className="text-slate-800 font-medium block whitespace-pre-wrap">{selectedRef.symptomsText || '—'}</span>
                    </div>
                    {selectedRef.summaryNotes && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Summary / Notes</span>
                        <p className="text-slate-700 italic border-l-4 border-blue-200 pl-3 py-1 bg-blue-50/50 rounded-r-lg">{selectedRef.summaryNotes}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Facility & Assignment Details</h3>
                  <div className="bg-slate-50 p-4 rounded-xl text-sm border border-slate-100 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Referring Consultant</span>
                      <span className="font-semibold text-slate-800 block">{selectedRef.consultantName}</span>
                      {selectedRef.consultantId?.userId && (
                        <span className="text-xs text-slate-500 block">{selectedRef.consultantId.userId.email} · {selectedRef.consultantId.userId.phone}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Target Hospital</span>
                      <span className="font-semibold text-slate-800">{selectedRef.targetHospitalId?.hospitalName || 'Pending assignment'}</span>
                    </div>
                    {selectedRef.targetDoctorId && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Requested Doctor</span>
                        <span className="font-semibold text-slate-800">Dr. {selectedRef.targetDoctorId.name} ({selectedRef.targetDoctorId.specialty})</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Admission Info (Active or Billing/Closed cases) */}
                {selectedRef.admission && (
                  <div>
                    <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">Active Admission Details</h3>
                    <div className="bg-blue-50/50 p-4 rounded-xl text-sm border border-blue-100/50 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Admission Department</span>
                          <span className="font-bold text-slate-800">{selectedRef.admission.admissionDepartment || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Room & Bed Details</span>
                          <span className="font-bold text-slate-800">Room: {selectedRef.admission.roomNumber || '—'} · Bed: {selectedRef.admission.bedNumber || '—'}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Treating Doctor</span>
                        <span className="font-bold text-slate-800">
                          {selectedRef.admission.treatingDoctorId?.name ? `Dr. ${selectedRef.admission.treatingDoctorId.name.replace(/^Dr\.\s*/i, '')} (${selectedRef.admission.treatingDoctorId.specialty || 'N/A'})` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Control Actions */}
                <div className="flex gap-3 justify-end pt-6 border-t border-slate-100">
                  <div className="mr-auto">
                    {deleteConfirmStep === 0 ? (
                      <button
                        onClick={handleDelete}
                        className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" /> Remove Referral
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-red-600">Permanently delete?</span>
                        <button
                          onClick={() => setDeleteConfirmStep(0)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDelete}
                          className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 text-xs font-bold"
                        >
                          Confirm delete
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => startEdit(selectedRef)}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Edit2 className="w-4 h-4" /> Edit Referral
                  </button>
                </div>
              </>
            ) : (
              // Edit Mode Form
              <form onSubmit={handleSave} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Patient Name</label>
                    <input
                      type="text" required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      value={editForm.patientName}
                      onChange={(e) => setEditForm({ ...editForm, patientName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Age (auto)</label>
                    <input
                      type="text" readOnly disabled
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
                      value={formatAge(editForm.dateOfBirth)}
                      title="Auto-calculated from date of birth"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Date of Birth</label>
                    <DobPicker
                      value={editForm.dateOfBirth}
                      onChange={(iso) => setEditForm({ ...editForm, dateOfBirth: iso, age: ageFromDob(iso) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Gender</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                      value={editForm.gender}
                      onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Phone</label>
                    <input
                      type="text" required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Patient CNIC</label>
                    <input
                      type="text" required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      value={editForm.cnic}
                      onChange={(e) => setEditForm({ ...editForm, cnic: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Area / Locality</label>
                    <input
                      type="text" required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      value={editForm.area}
                      onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Relation</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                      value={editForm.guardianRelation}
                      onChange={(e) => setEditForm({ ...editForm, guardianRelation: e.target.value })}
                    >
                      <option value="S/O">S/O (Son of)</option>
                      <option value="D/O">D/O (Daughter of)</option>
                      <option value="W/O">W/O (Wife of)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Father / Husband Name</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      value={editForm.guardianName}
                      onChange={(e) => setEditForm({ ...editForm, guardianName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <h4 className="text-xs font-black text-slate-800 uppercase">Clinical overrides</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Urgency</label>
                      <select
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                        value={editForm.urgency}
                        onChange={(e) => setEditForm({ ...editForm, urgency: e.target.value })}
                      >
                        <option value="routine">Routine</option>
                        <option value="urgent">Urgent</option>
                        <option value="emergency">Emergency</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Target Department</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        value={editForm.department}
                        onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Diagnosis Summary</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        value={editForm.diagnosisText}
                        onChange={(e) => setEditForm({ ...editForm, diagnosisText: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Symptoms Description</label>
                    <textarea
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      value={editForm.symptomsText}
                      onChange={(e) => setEditForm({ ...editForm, symptomsText: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Internal Clinical Summary</label>
                    <textarea
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      value={editForm.summaryNotes}
                      onChange={(e) => setEditForm({ ...editForm, summaryNotes: e.target.value })}
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <h4 className="text-xs font-black text-slate-800 uppercase">Flow & Status overrides</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Referral Status</label>
                      <select
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white font-bold"
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      >
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                        <option value="admitted">Admitted</option>
                        <option value="closed">Closed / Finalized</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Admitted Overrides Section */}
                {(editForm.status === 'admitted' || selectedRef.admission) && (
                  <div className="border-t border-slate-100 pt-4 space-y-4">
                    <h4 className="text-xs font-black text-blue-600 uppercase">Admission & Bed Overrides</h4>
                    <div className="grid grid-cols-2 gap-4 bg-blue-50/20 p-4 rounded-xl border border-blue-100/40">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Room Number</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                          value={editForm.roomNumber}
                          placeholder="e.g. Room 102"
                          onChange={(e) => setEditForm({ ...editForm, roomNumber: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Bed Number</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                          value={editForm.bedNumber}
                          placeholder="e.g. Bed A"
                          onChange={(e) => setEditForm({ ...editForm, bedNumber: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Admitted Department</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                          value={editForm.admissionDepartment}
                          placeholder="e.g. Cardiology"
                          onChange={(e) => setEditForm({ ...editForm, admissionDepartment: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Treating Consultant / Doctor</label>
                        {loadingDoctors ? (
                          <div className="text-xs text-slate-400 py-2">Loading hospital doctors list...</div>
                        ) : (
                          <select
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                            value={editForm.treatingDoctorId}
                            onChange={(e) => setEditForm({ ...editForm, treatingDoctorId: e.target.value })}
                          >
                            <option value="">-- Choose Doctor --</option>
                            {hospitalDoctors.map(doc => (
                              <option key={doc._id} value={doc._id}>
                                Dr. {doc.name} ({doc.specialty})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-semibold text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </DetailModal>
    </div>
  );
};

export default AdminReferrals;
