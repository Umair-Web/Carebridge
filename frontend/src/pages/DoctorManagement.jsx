import { useState, useEffect } from 'react';
import api from '../utils/api';
import { Plus, User, Stethoscope, Phone, Mail, Trash2, Edit2, CheckCircle, XCircle } from 'lucide-react';
import Loader from '../components/Loader';

const DoctorManagement = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    pmdcNumber: '',
    consultationFee: '',
    phone: '',
    email: '',
    isAvailable: true
  });

  useEffect(() => {
    fetchDoctors();
  }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDoctor) {
        await api.patch(`/hospitals/doctors/${editingDoctor._id}`, formData);
      } else {
        await api.post('/hospitals/doctors', formData);
      }
      setShowModal(false);
      setEditingDoctor(null);
      setFormData({ name: '', specialty: '', pmdcNumber: '', consultationFee: '', phone: '', email: '', isAvailable: true });
      fetchDoctors();
    } catch (err) {
      alert('Failed to save doctor details');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this doctor?')) return;
    try {
      await api.delete(`/hospitals/doctors/${id}`);
      fetchDoctors();
    } catch (err) {
      alert('Failed to delete doctor');
    }
  };

  const toggleAvailability = async (doctor) => {
    try {
      await api.patch(`/hospitals/doctors/${doctor._id}`, { isAvailable: !doctor.isAvailable });
      fetchDoctors();
    } catch (err) {
      alert('Failed to update availability');
    }
  };

  if (loading) return <Loader message="Fetching doctors list..." />;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Doctor Management</h1>
          <p className="text-slate-500 mt-1">Manage your facility's specialized healthcare providers.</p>
        </div>
        <button 
          onClick={() => {
            setEditingDoctor(null);
            setFormData({ name: '', specialty: '', pmdcNumber: '', consultationFee: '', phone: '', email: '', isAvailable: true });
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
              <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-[0.03] transition-transform group-hover:scale-150 ${doc.isAvailable ? 'bg-green-600' : 'bg-red-600'}`}></div>
              
              <div className="flex justify-between items-start mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${doc.isAvailable ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  <User size={28} strokeWidth={2.5} />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingDoctor(doc); setFormData({ name: doc.name || '', specialty: doc.specialty || '', pmdcNumber: doc.pmdcNumber || '', consultationFee: doc.consultationFee / 100, phone: doc.phone || '', email: doc.email || '', isAvailable: doc.isAvailable }); setShowModal(true); }} className="p-2 hover:bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl transition-colors">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(doc._id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{doc.name}</h3>
                <div className="flex items-center gap-1.5 text-slate-500 font-medium mt-1">
                  <Stethoscope size={14} className="text-blue-500" />
                  {doc.specialty}
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">PMDC: {doc.pmdcNumber}</div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Mail size={14} className="text-slate-400" />
                  {doc.email || 'No email'}
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Phone size={14} className="text-slate-400" />
                  {doc.phone || 'No phone'}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-bold text-slate-900">{doc.consultationFee / 100} PKR</span>
                  <button 
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-black text-slate-900 mb-6">{editingDoctor ? 'Edit Doctor' : 'Register New Doctor'}</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Full Name</label>
                <input 
                  type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all font-medium"
                  placeholder="e.g. Dr. Ahmed Khan"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">PMDC Number</label>
                <input 
                  type="text" required value={formData.pmdcNumber} onChange={(e) => setFormData({...formData, pmdcNumber: e.target.value})}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all font-medium"
                  placeholder="e.g. 12345-P"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Specialty</label>
                  <input 
                    type="text" required value={formData.specialty} onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all font-medium"
                    placeholder="e.g. Cardiology"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Fee (PKR)</label>
                  <input 
                    type="number" required value={formData.consultationFee} onChange={(e) => setFormData({...formData, consultationFee: e.target.value})}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all font-medium"
                    placeholder="1500"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Contact Phone</label>
                <input 
                  type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Email Address</label>
                <input 
                  type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-blue-600 focus:bg-white outline-none transition-all font-medium"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all">Cancel</button>
                <button type="submit" className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-blue-100">
                  {editingDoctor ? 'Update Provider' : 'Add to Faculty'}
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
