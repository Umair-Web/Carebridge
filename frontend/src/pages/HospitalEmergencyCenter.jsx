import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../utils/api';
import { SOCKET_URL } from '../config';
import DetailModal from '../components/DetailModal';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import Loader from '../components/Loader';
import { ageLabel } from '../utils/dob';

const HospitalEmergencyCenter = () => {
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const fetchEmergencies = useCallback(async () => {
    try {
      const res = await api.get('/referrals/inbox');
      if (res.data.success) {
        // Filter for only emergency and urgent referrals
        const urgentCases = res.data.data.filter(r => 
          r.urgency === 'emergency' && r.status === 'pending'
        );
        setEmergencies(urgentCases);
      }
    } catch (err) {
      console.error('Failed to fetch emergencies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEmergencies();
  }, [fetchEmergencies]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socket.emit('join_hospital', { token });
    
    socket.on('NEW_REFERRAL', () => {
      fetchEmergencies();
      // Optional: Play a loud sound here for emergencies
    });
    socket.on('REFERRAL_ESCALATED', fetchEmergencies);
    socket.on('STATUS_UPDATE', fetchEmergencies);
    
    return () => socket.disconnect();
  }, [fetchEmergencies]);

  const updateStatus = async (id, status) => {
    try {
      const res = await api.patch(`/referrals/${id}/status`, { status });
      if (res.data.success) {
        toast.success(`Emergency case marked as ${status}`);
        setSelected(null);
        fetchEmergencies();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    }
  };

  if (loading) return <Loader message="Fetching critical emergency cases..." />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-start gap-4 p-6 bg-red-600 rounded-2xl text-white shadow-lg shadow-red-600/20">
        <div className="p-3 bg-white/20 rounded-xl animate-pulse">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Emergency Center</h1>
          <p className="text-red-100 font-medium mt-1">High-priority incoming cases requiring immediate response.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {emergencies.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-500 font-medium">
            No pending emergency cases at this time.
          </div>
        ) : (
          emergencies.map(r => (
            <div 
              key={r._id} 
              onClick={() => setSelected(r)}
              className="bg-white border-2 border-red-500 rounded-2xl p-5 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              </div>
              <div className="text-xs font-bold text-red-600 uppercase tracking-widest mb-1">Critical Priority</div>
              <h3 className="text-xl font-black text-slate-900">{r.patientName}</h3>
              <p className="text-sm text-slate-500 font-medium mb-4">{ageLabel(r)} · {r.gender} · {r.department || 'General'}</p>
              
              <div className="p-3 bg-red-50 rounded-xl mb-4 border border-red-100">
                <p className="text-xs font-bold text-red-800 uppercase mb-1">Primary Symptoms</p>
                <p className="text-sm text-red-900 line-clamp-2">{r.symptomsText || 'Check details'}</p>
              </div>

              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-500 flex items-center gap-1">
                  <Clock size={14} />
                  {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-xs font-black text-blue-600 uppercase">
                  View Details &rarr;
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <DetailModal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Emergency Case Details"
        subtitle={selected?.patientName}
      >
        {selected && (
          <div className="space-y-6">
            <div className="bg-red-50 p-4 rounded-xl border border-red-200">
              <h3 className="font-black text-red-800 mb-2">Clinical Summary</h3>
              <p className="text-red-900 text-sm">{selected.summaryNotes || 'No summary provided.'}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact</p>
                <p className="text-sm font-bold text-slate-800">{selected.phone}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Guardian</p>
                <p className="text-sm font-bold text-slate-800">{[selected.guardianRelation, selected.guardianName].filter(Boolean).join(' ') || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Referred By</p>
                <p className="text-sm font-bold text-slate-800">Dr. {selected.consultantId?.userId?.name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Patient Location</p>
                <p className="text-sm font-bold text-slate-800">{selected.area}</p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => updateStatus(selected._id, 'rejected')}
                className="flex-1 py-3 bg-slate-100 hover:bg-red-100 hover:text-red-700 text-slate-700 font-bold rounded-xl transition-colors"
              >
                Reject (No Capacity)
              </button>
              <button 
                onClick={() => updateStatus(selected._id, 'accepted')}
                className="flex-[2] py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg shadow-red-600/30 transition-all active:scale-95"
              >
                Accept Emergency
              </button>
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  );
};

export default HospitalEmergencyCenter;
