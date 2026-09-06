import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  Plus, User, Stethoscope, Phone, Mail, Trash2, Edit2, CheckCircle, XCircle,
  Eye, X, KeyRound, Lock, Shield,
} from 'lucide-react';
import Loader from '../components/Loader';

const emptyForm = {
  name: '',
  specialty: '',
  pmdcNumber: '',
  consultationFee: '',
  phone: '',
  email: '',
  isAvailable: true,
};

const DoctorManagement = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockTarget, setUnlockTarget] = useState(null);
  const [unlocking, setUnlocking] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [unlockToken, setUnlockToken] = useState(null);
  const [sidebarTab, setSidebarTab] = useState('details'); // details | edit | passwords

  const [doctorNewPassword, setDoctorNewPassword] = useState('');
  const [accessCurrentPassword, setAccessCurrentPassword] = useState('');
  const [accessNewPassword, setAccessNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const unlockHeaders = () =>
    unlockToken ? { 'X-Doctor-Profile-Unlock': unlockToken } : {};

  const fetchDoctors = async () => {
    try {
      const res = await api.get('/hospitals/doctors');
      if (res.data.success) {
        setDoctors(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  const openUnlock = (doc) => {
    setUnlockTarget(doc);
    setUnlockPassword('');
    setUnlockOpen(true);
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!unlockPassword.trim()) {
      return toast.error('Enter hospital doctor-access password');
    }
    setUnlocking(true);
    try {
      const res = await api.post(`/hospitals/doctors/${unlockTarget._id}/verify-access`, {
        password: unlockPassword,
        doctorId: unlockTarget._id,
      });
      if (!res.data.success) {
        return toast.error(res.data.message || 'Incorrect password');
      }
      setUnlockToken(res.data.data.unlockToken);
      setSelectedDoctor(unlockTarget);
      setSidebarTab('details');
      setSidebarOpen(true);
      setUnlockOpen(false);
      setUnlockPassword('');
      toast.success('Access granted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect access password');
    } finally {
      setUnlocking(false);
    }
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    setSelectedDoctor(null);
    setUnlockToken(null);
    setSidebarTab('details');
    setDoctorNewPassword('');
    setAccessCurrentPassword('');
    setAccessNewPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDoctor) {
        if (!unlockToken) {
          return toast.error('Unlock doctor profile first');
        }
        const res = await api.patch(
          `/hospitals/doctors/${editingDoctor._id}`,
          formData,
          { headers: unlockHeaders() }
        );
        if (res.data.success) {
          setSelectedDoctor(res.data.data);
          toast.success('Doctor updated');
        }
      } else {
        await api.post('/hospitals/doctors', formData);
        toast.success('Doctor added');
      }
      setShowModal(false);
      setEditingDoctor(null);
      setFormData(emptyForm);
      setSidebarTab('details');
      fetchDoctors();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save doctor details');
    }
  };

  const handleDelete = async () => {
    if (!selectedDoctor || !unlockToken) return;
    if (!window.confirm(`Remove ${selectedDoctor.name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/hospitals/doctors/${selectedDoctor._id}`, {
        headers: unlockHeaders(),
      });
      toast.success('Doctor removed');
      closeSidebar();
      fetchDoctors();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete doctor');
    }
  };

  const startEditFromSidebar = () => {
    if (!selectedDoctor) return;
    setEditingDoctor(selectedDoctor);
    setFormData({
      name: selectedDoctor.name || '',
      specialty: selectedDoctor.specialty || '',
      pmdcNumber: selectedDoctor.pmdcNumber || '',
      consultationFee: (selectedDoctor.consultationFee || 0) / 100,
      phone: selectedDoctor.phone || '',
      email: selectedDoctor.email || '',
      isAvailable: selectedDoctor.isAvailable !== false,
    });
    setSidebarTab('edit');
  };

  const toggleAvailability = async (doctor) => {
    try {
      await api.patch(`/hospitals/doctors/${doctor._id}/availability`, {
        isAvailable: !doctor.isAvailable,
      });
      fetchDoctors();
      if (selectedDoctor?._id === doctor._id) {
        setSelectedDoctor({ ...selectedDoctor, isAvailable: !doctor.isAvailable });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update availability');
    }
  };

  const handleChangeDoctorPassword = async (e) => {
    e.preventDefault();
    if (!doctorNewPassword || doctorNewPassword.length < 4) {
      return toast.error('Doctor password must be at least 4 characters');
    }
    setSavingPassword(true);
    try {
      await api.patch(
        `/hospitals/doctors/${selectedDoctor._id}/password`,
        { newPassword: doctorNewPassword },
        { headers: unlockHeaders() }
      );
      toast.success('Doctor password updated');
      setDoctorNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update doctor password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleChangeAccessPassword = async (e) => {
    e.preventDefault();
    if (!accessCurrentPassword || !accessNewPassword) {
      return toast.error('Enter current and new hospital access passwords');
    }
    if (accessNewPassword.length < 4) {
      return toast.error('New password must be at least 4 characters');
    }
    setSavingPassword(true);
    try {
      await api.patch(
        '/hospitals/doctors/access-password',
        {
          currentPassword: accessCurrentPassword,
          newPassword: accessNewPassword,
        },
        { headers: unlockHeaders() }
      );
      toast.success('Hospital doctor-access password updated');
      setAccessCurrentPassword('');
      setAccessNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update access password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return <Loader message="Fetching doctors list..." />;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Doctor Management</h1>
          <p className="text-slate-500 mt-1">
            View unlocks with the hospital doctor-access password (default <span className="font-mono text-slate-700">123456</span>).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingDoctor(null);
            setFormData(emptyForm);
            setShowModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-200"
        >
          <Plus size={20} />
          Add New Doctor
        </button>
      </div>

      {doctors.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center">
          <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
            <User size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No Doctors Listed</h3>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto">Add your specialist doctors so consultants can target them for referrals.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doc) => (
            <div key={doc._id} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
              <div className={`pointer-events-none absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-[0.03] transition-transform group-hover:scale-150 ${doc.isAvailable ? 'bg-green-600' : 'bg-red-600'}`} />

              <div className="relative z-10 flex justify-between items-start mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${doc.isAvailable ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  <User size={28} strokeWidth={2.5} />
                </div>
                <button
                  type="button"
                  onClick={() => openUnlock(doc)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <Eye size={14} />
                  View
                </button>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{doc.name}</h3>
                <div className="flex items-center gap-1.5 text-slate-500 font-medium mt-1">
                  <Stethoscope size={14} className="text-blue-500" />
                  {doc.specialty}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Mail size={14} className="text-slate-400" />
                  {doc.email || 'No email'}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-bold text-slate-900">{(doc.consultationFee || 0) / 100} PKR</span>
                  <button
                    type="button"
                    onClick={() => toggleAvailability(doc)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${doc.isAvailable ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                  >
                    {doc.isAvailable ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {doc.isAvailable ? 'Active' : 'Unavailable'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unlock password modal */}
      {unlockOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <form
            onSubmit={handleUnlock}
            className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl space-y-5"
          >
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
                <Lock size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Unlock doctor profile</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Enter the <span className="font-semibold">hospital doctor-access password</span> to view{' '}
                  <span className="font-semibold text-slate-700">{unlockTarget?.name}</span>.
                  This is not the hospital portal login.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Access password</label>
              <input
                type="password"
                autoFocus
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter access password"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setUnlockOpen(false); setUnlockPassword(''); }}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={unlocking}
                className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-bold disabled:opacity-50"
              >
                {unlocking ? 'Checking…' : 'Unlock'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Doctor profile sidebar */}
      {sidebarOpen && selectedDoctor && (
        <div className="fixed inset-0 z-[55] flex justify-end">
          <button type="button" className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={closeSidebar} aria-label="Close" />
          <aside className="relative h-full w-full max-w-md bg-white shadow-2xl border-l border-slate-100 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Doctor profile</p>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">{selectedDoctor.name}</h2>
                <p className="text-sm text-slate-500">{selectedDoctor.specialty}</p>
              </div>
              <button type="button" onClick={closeSidebar} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pt-4 flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setSidebarTab('details')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${sidebarTab === 'details' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                View details
              </button>
              <button
                type="button"
                onClick={startEditFromSidebar}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${sidebarTab === 'edit' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                <Edit2 size={12} /> Edit
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('passwords')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${sidebarTab === 'passwords' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                <KeyRound size={12} /> Passwords
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 bg-red-50 text-red-700 hover:bg-red-100"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {sidebarTab === 'details' && (
                <div className="space-y-4 text-sm">
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">PMDC</p>
                      <p className="font-semibold text-slate-800">{selectedDoctor.pmdcNumber || '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Mail size={14} className="text-slate-400" />
                      {selectedDoctor.email || 'No email'}
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Phone size={14} className="text-slate-400" />
                      {selectedDoctor.phone || 'No phone'}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <span className="font-bold text-slate-900">{(selectedDoctor.consultationFee || 0) / 100} PKR</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${selectedDoctor.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {selectedDoctor.isAvailable ? 'Active' : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {sidebarTab === 'edit' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Full Name</label>
                    <input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">PMDC Number</label>
                    <input required value={formData.pmdcNumber} onChange={(e) => setFormData({ ...formData, pmdcNumber: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Specialty</label>
                      <input required value={formData.specialty} onChange={(e) => setFormData({ ...formData, specialty: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Fee (PKR)</label>
                      <input type="number" required value={formData.consultationFee} onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Phone</label>
                    <input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Email</label>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={formData.isAvailable !== false} onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })} />
                    Available for referrals
                  </label>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl">
                    Save changes
                  </button>
                </form>
              )}

              {sidebarTab === 'passwords' && (
                <div className="space-y-6">
                  <form onSubmit={handleChangeDoctorPassword} className="rounded-2xl border border-slate-100 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <KeyRound size={16} className="text-blue-600" />
                      Change doctor password
                    </div>
                    <p className="text-xs text-slate-500">Sets this doctor&apos;s credential (default for new doctors: 123456).</p>
                    <input
                      type="password"
                      value={doctorNewPassword}
                      onChange={(e) => setDoctorNewPassword(e.target.value)}
                      placeholder="New doctor password"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button type="submit" disabled={savingPassword} className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
                      Update doctor password
                    </button>
                  </form>

                  <form onSubmit={handleChangeAccessPassword} className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <Shield size={16} className="text-amber-600" />
                      Change hospital access password
                    </div>
                    <p className="text-xs text-slate-500">
                      Password used to open any doctor profile (not portal login).
                    </p>
                    <input
                      type="password"
                      value={accessCurrentPassword}
                      onChange={(e) => setAccessCurrentPassword(e.target.value)}
                      placeholder="Current access password"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    />
                    <input
                      type="password"
                      value={accessNewPassword}
                      onChange={(e) => setAccessNewPassword(e.target.value)}
                      placeholder="New access password"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    />
                    <button type="submit" disabled={savingPassword} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
                      Update access password
                    </button>
                  </form>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Add doctor modal (no unlock required) */}
      {showModal && !editingDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Register New Doctor</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Full Name</label>
                <input
                  type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all font-medium"
                  placeholder="e.g. Dr. Ahmed Khan"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">PMDC Number</label>
                <input
                  type="text" required value={formData.pmdcNumber} onChange={(e) => setFormData({ ...formData, pmdcNumber: e.target.value })}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all font-medium"
                  placeholder="e.g. 12345-P"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Specialty</label>
                  <input
                    type="text" required value={formData.specialty} onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all font-medium"
                    placeholder="e.g. Cardiology"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Fee (PKR)</label>
                  <input
                    type="number" required value={formData.consultationFee} onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all font-medium"
                    placeholder="1500"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Contact Phone</label>
                <input
                  type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Email Address</label>
                <input
                  type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all font-medium"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all">Cancel</button>
                <button type="submit" className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-blue-100">
                  Add to Faculty
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorManagement;
