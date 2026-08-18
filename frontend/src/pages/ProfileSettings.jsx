import { useState, useEffect } from 'react';
import { User, CreditCard, ShieldCheck, Save, Loader2, KeyRound, Eye, EyeOff, Building2, Palette, X } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../features/auth/AuthContext';
import Loader from '../components/Loader';
import ProfileDocumentUpload from '../components/ProfileDocumentUpload';

const ProfileSettings = () => {
  const { user: authUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [data, setData] = useState({
    user: { name: '', phone: '' },
    profile: {}
  });

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [newDeptInput, setNewDeptInput] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  const handleAddDepartment = async () => {
    const trimmed = newDeptInput.trim();
    if (!trimmed) return;
    const currentDepts = data.profile.departments || [];
    if (currentDepts.includes(trimmed)) {
      toast.error('Department already listed');
      return;
    }
    const updatedDepts = [...currentDepts, trimmed];
    
    try {
      const res = await api.patch('/hospitals/departments', { departments: updatedDepts });
      if (res.data.success) {
        setData(prev => ({
          ...prev,
          profile: { ...prev.profile, departments: res.data.data }
        }));
        setNewDeptInput('');
        toast.success('Department added successfully');
      }
    } catch (err) {
      toast.error('Failed to add department');
    }
  };

  const handleRemoveDepartment = async (dept) => {
    const currentDepts = data.profile.departments || [];
    const updatedDepts = currentDepts.filter(d => d !== dept);
    
    try {
      const res = await api.patch('/hospitals/departments', { departments: updatedDepts });
      if (res.data.success) {
        setData(prev => ({
          ...prev,
          profile: { ...prev.profile, departments: res.data.data }
        }));
        toast.success('Department removed successfully');
      }
    } catch (err) {
      toast.error('Failed to remove department');
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/profile/me');
      if (res.data.success) {
        const payload = res.data.data;
        if (payload.profile && authUser?.role === 'hospital' && !payload.profile.branding) {
          payload.profile.branding = { primaryColor: '#2980b9', logoUrl: '' };
        }
        setData(payload);
      }
    } catch (err) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (up.data.success) {
        setData((prev) => ({
          ...prev,
          profile: {
            ...prev.profile,
            branding: { ...prev.profile.branding, logoUrl: up.data.url },
          },
        }));
        toast.success('Logo uploaded — save profile to apply');
      }
    } catch {
      toast.error('Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  };

  const refreshDocuments = (docs) => {
    if (authUser.role === 'consultant') {
      setData((prev) => ({ ...prev, profile: { ...prev.profile, verificationDocuments: docs } }));
    } else {
      setData((prev) => ({ ...prev, profile: { ...prev.profile, registrationDocuments: docs } }));
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: data.user.name,
        phone: data.user.phone,
        ...data.profile
      };
      const res = await api.put('/profile/me', payload);
      setData(res.data.data);
      if (authUser.role === 'hospital') {
        window.dispatchEvent(new Event('hospital-branding-changed'));
      }
      toast.success('Profile saved successfully');
    } catch (err) {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwords.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await api.post('/profile/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      if (res.data.success) {
        toast.success('Password changed successfully');
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) return <Loader message="Fetching profile details..." />;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Profile & Security</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your professional credentials, update profile details, and maintain secure access.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Basic Info & Direct Change Password */}
        <div className="lg:col-span-1 space-y-8">
          
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
              <User size={16} className="text-blue-600" />
              Account Identity
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Full Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium text-slate-800"
                  value={data.user.name}
                  onChange={(e) => setData({ ...data, user: { ...data.user, name: e.target.value } })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Email Address</label>
                <input 
                  type="email" disabled
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-100 text-slate-400 outline-none text-sm font-medium cursor-not-allowed"
                  value={data.user.email}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Phone Number</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium text-slate-800"
                  value={data.user.phone}
                  onChange={(e) => setData({ ...data, user: { ...data.user, phone: e.target.value } })}
                />
              </div>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
              <KeyRound size={16} className="text-indigo-600" />
              Security & Credentials
            </div>
             <form onSubmit={handleChangePassword} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Current Password</label>
                <div className="relative">
                  <input 
                    type={showCurrent ? "text" : "password"}
                    className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-50 border border-slate-100 focus:border-indigo-600 focus:bg-white outline-none transition-all text-sm font-medium"
                    placeholder="••••••••"
                    value={passwords.currentPassword}
                    onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    onClick={() => setShowCurrent(!showCurrent)}
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">New Password</label>
                <div className="relative">
                  <input 
                    type={showNew ? "text" : "password"}
                    className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-50 border border-slate-100 focus:border-indigo-600 focus:bg-white outline-none transition-all text-sm font-medium"
                    placeholder="••••••••"
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    onClick={() => setShowNew(!showNew)}
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Confirm New Password</label>
                <div className="relative">
                  <input 
                    type={showConfirm ? "text" : "password"}
                    className="w-full px-4 py-2.5 pr-10 rounded-xl bg-slate-50 border border-slate-100 focus:border-indigo-600 focus:bg-white outline-none transition-all text-sm font-medium"
                    placeholder="••••••••"
                    value={passwords.confirmPassword}
                    onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={changingPassword}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-100 text-xs disabled:opacity-50"
              >
                {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound size={14} />}
                Update Password
              </button>
            </form>
          </div>

        </div>

        {/* RIGHT COLUMN: Role-Specific Settings (Consultant or Hospital) */}
        <div className="lg:col-span-2 space-y-8">
          
          <form onSubmit={handleSaveProfile} className="space-y-8">
            
            {/* Consultant Profile Details */}
            {authUser.role === 'consultant' && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <User size={16} className="text-teal-600" />
                    Clinical Credentials & Practice Details
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
                    
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">PMDC Number (Read-only)</label>
                        <input 
                          type="text" disabled
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-100 text-slate-400 outline-none text-sm font-mono cursor-not-allowed"
                          value={data.profile.pmdcNumber || ''}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">CNIC (Read-only)</label>
                        <input 
                          type="text" disabled
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-100 text-slate-400 outline-none text-sm font-mono cursor-not-allowed"
                          value={data.profile.cnic || ''}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Specialization</label>
                        <input 
                          type="text"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium"
                          value={data.profile.specialty || ''}
                          onChange={(e) => setData({
                            ...data,
                            profile: { ...data.profile, specialty: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Clinic Name</label>
                        <input 
                          type="text"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium"
                          value={data.profile.clinicName || ''}
                          onChange={(e) => setData({
                            ...data,
                            profile: { ...data.profile, clinicName: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">City</label>
                        <input 
                          type="text"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium"
                          value={data.profile.city || ''}
                          onChange={(e) => setData({
                            ...data,
                            profile: { ...data.profile, city: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Clinic Address(es)</label>
                        <textarea 
                          rows={2}
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium resize-none"
                          value={data.profile.clinicAddress || ''}
                          onChange={(e) => setData({
                            ...data,
                            profile: { ...data.profile, clinicAddress: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Consultant Wallet / Payout Settings */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <CreditCard size={16} className="text-emerald-600" />
                    Preferred Payout Account
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Account Type</label>
                        <div className="flex gap-3">
                          {['jazzcash', 'easypaisa', 'bank'].map(type => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setData({
                                ...data,
                                profile: {
                                  ...data.profile,
                                  payoutAccount: { ...data.profile.payoutAccount, accountType: type }
                                }
                              })}
                              className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase transition-all ${
                                data.profile.payoutAccount?.accountType === type 
                                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' 
                                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Account Number</label>
                        <input 
                          type="text"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium"
                          placeholder="e.g. 03XXXXXXXXX"
                          value={data.profile.payoutAccount?.accountNumber || ''}
                          onChange={(e) => setData({
                            ...data,
                            profile: {
                              ...data.profile,
                              payoutAccount: { ...data.profile.payoutAccount, accountNumber: e.target.value }
                            }
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Account Holder Name</label>
                        <input 
                          type="text"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium"
                          placeholder="Full name as on account"
                          value={data.profile.payoutAccount?.accountHolder || ''}
                          onChange={(e) => setData({
                            ...data,
                            profile: {
                              ...data.profile,
                              payoutAccount: { ...data.profile.payoutAccount, accountHolder: e.target.value }
                            }
                          })}
                        />
                      </div>
                      {data.profile.payoutAccount?.accountType === 'bank' && (
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-bold text-slate-400 uppercase">Bank Name & Branch</label>
                          <input 
                            type="text"
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium"
                            placeholder="e.g. HBL - I.I Chundrigar Road"
                            value={data.profile.payoutAccount?.bankName || ''}
                            onChange={(e) => setData({
                              ...data,
                              profile: {
                                ...data.profile,
                                payoutAccount: { ...data.profile.payoutAccount, bankName: e.target.value }
                              }
                            })}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheck size={16} className="text-rose-600" />
                    Verification Documents
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                    <ProfileDocumentUpload
                      docName="PMDC Certificate"
                      documents={data.profile.verificationDocuments}
                      onUpdated={refreshDocuments}
                      locked={!!data.profile.isVerified}
                    />
                    <ProfileDocumentUpload
                      docName="CNIC"
                      documents={data.profile.verificationDocuments}
                      onUpdated={refreshDocuments}
                      locked={!!data.profile.isVerified}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Hospital Profile Details */}
            {authUser.role === 'hospital' && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <Building2 size={16} className="text-teal-600" />
                    Facility Details & Registrations
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
                    
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Hospital Name</label>
                        <input 
                          type="text"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium"
                          value={data.profile.hospitalName || ''}
                          onChange={(e) => setData({
                            ...data,
                            profile: { ...data.profile, hospitalName: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Registration Number</label>
                        <input 
                          type="text"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium"
                          value={data.profile.registrationNumber || ''}
                          onChange={(e) => setData({
                            ...data,
                            profile: { ...data.profile, registrationNumber: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Representative CNIC</label>
                        <input
                          type="text"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-mono font-medium"
                          value={data.profile.representativeCnic || ''}
                          onChange={(e) => setData({
                            ...data,
                            profile: { ...data.profile, representativeCnic: e.target.value },
                          })}
                          placeholder="42101-XXXXXXX-X"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">City</label>
                        <input 
                          type="text"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium"
                          value={data.profile.city || ''}
                          onChange={(e) => setData({
                            ...data,
                            profile: { ...data.profile, city: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Area / Locality</label>
                        <input 
                          type="text"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium"
                          value={data.profile.area || ''}
                          onChange={(e) => setData({
                            ...data,
                            profile: { ...data.profile, area: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Avg Response Time (minutes)</label>
                        <input 
                          type="number"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium"
                          value={data.profile.avgResponseTime || ''}
                          onChange={(e) => setData({
                            ...data,
                            profile: { ...data.profile, avgResponseTime: parseInt(e.target.value, 10) || 0 }
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Latitude</label>
                        <input 
                          type="number" step="any"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium"
                          value={data.profile.location?.coordinates?.[1] ?? ''}
                          onChange={(e) => {
                            const newCoords = [...(data.profile.location?.coordinates || [67.0099, 24.8607])];
                            newCoords[1] = parseFloat(e.target.value) || 0;
                            setData({
                              ...data,
                              profile: {
                                ...data.profile,
                                location: { ...data.profile.location, type: 'Point', coordinates: newCoords }
                              }
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Longitude</label>
                        <input 
                          type="number" step="any"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium"
                          value={data.profile.location?.coordinates?.[0] ?? ''}
                          onChange={(e) => {
                            const newCoords = [...(data.profile.location?.coordinates || [67.0099, 24.8607])];
                            newCoords[0] = parseFloat(e.target.value) || 0;
                            setData({
                              ...data,
                              profile: {
                                ...data.profile,
                                location: { ...data.profile.location, type: 'Point', coordinates: newCoords }
                              }
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Physical Address</label>
                        <textarea 
                          rows={2}
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all text-sm font-medium resize-none"
                          value={data.profile.address || ''}
                          onChange={(e) => setData({
                            ...data,
                            profile: { ...data.profile, address: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Department Management Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <Building2 size={16} className="text-blue-600" />
                    Department Management
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <p className="text-xs text-slate-500 leading-relaxed bg-blue-50/50 p-3 rounded-xl border border-blue-100/50">
                      Add or remove department specialties offered by your facility.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(data.profile.departments || []).map((dept) => (
                        <span key={dept} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-100">
                          {dept}
                          <button
                            type="button"
                            onClick={() => handleRemoveDepartment(dept)}
                            className="p-0.5 hover:bg-blue-100 rounded-full transition-colors text-blue-500 hover:text-blue-700"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      {(data.profile.departments || []).length === 0 && (
                        <p className="text-xs text-slate-400 italic">No departments listed.</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add new department (e.g. Cardiology)"
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newDeptInput}
                        onChange={(e) => setNewDeptInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddDepartment();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddDepartment}
                        className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <Palette size={16} className="text-violet-600" />
                    White-Label Branding
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
                    <p className="text-xs text-slate-500">
                      Customize your hospital portal sidebar and accent color. Platform login pages keep global CareBridge branding.
                    </p>
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Hospital logo</label>
                        <div className="flex items-center gap-4">
                          {data.profile.branding?.logoUrl ? (
                            <img src={data.profile.branding.logoUrl} alt="Logo" className="w-16 h-16 rounded-xl object-cover border" />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-xs">No logo</div>
                          )}
                          <label className="cursor-pointer">
                            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
                            <span className="px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl">
                              {logoUploading ? 'Uploading…' : 'Upload logo'}
                            </span>
                          </label>
                        </div>
                      </div>
                      <div className="space-y-2 flex-1 min-w-[200px]">
                        <label className="text-xs font-bold text-slate-400 uppercase">Primary accent color</label>
                        <div className="flex gap-3 items-center">
                          <input
                            type="color"
                            value={data.profile.branding?.primaryColor || '#2980b9'}
                            onChange={(e) =>
                              setData({
                                ...data,
                                profile: {
                                  ...data.profile,
                                  branding: { ...data.profile.branding, primaryColor: e.target.value },
                                },
                              })
                            }
                            className="w-12 h-12 rounded-lg border-0 cursor-pointer"
                          />
                          <input
                            type="text"
                            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
                            value={data.profile.branding?.primaryColor || '#2980b9'}
                            onChange={(e) =>
                              setData({
                                ...data,
                                profile: {
                                  ...data.profile,
                                  branding: { ...data.profile.branding, primaryColor: e.target.value },
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheck size={16} className="text-rose-600" />
                    Registration Documents
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                    <ProfileDocumentUpload
                      docName="SHCC License"
                      documents={data.profile.registrationDocuments}
                      onUpdated={refreshDocuments}
                    />
                    <ProfileDocumentUpload
                      docName="CNIC"
                      documents={data.profile.registrationDocuments}
                      onUpdated={refreshDocuments}
                    />
                    <ProfileDocumentUpload
                      docName="Rate List"
                      documents={data.profile.registrationDocuments}
                      onUpdated={refreshDocuments}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Admin Badge */}
            {authUser.role === 'admin' && (
              <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <ShieldCheck size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Administrator Privilege Active</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                    You have complete master administrator credentials. To secure your account, ensure your password remains highly complex and unique.
                  </p>
                </div>
              </div>
            )}

            {/* Save Profile Button */}
            {authUser.role !== 'admin' && (
              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 text-sm"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save size={18} />}
                  Save Profile Changes
                </button>
              </div>
            )}

          </form>

        </div>

      </div>
    </div>
  );
};

export default ProfileSettings;
