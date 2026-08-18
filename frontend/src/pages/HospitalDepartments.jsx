import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, X, RefreshCw, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Loader from '../components/Loader';

const HospitalDepartments = () => {
  const queryClient = useQueryClient();
  const [newDept, setNewDept] = useState('');

  // Fetch hospital profile to get departments
  const { data: hospital, isLoading, error } = useQuery({
    queryKey: ['hospital-profile'],
    queryFn: async () => {
      const res = await api.get('/profile/me');
      return res.data.data.profile;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (departments) => {
      const res = await api.patch('/hospitals/departments', { departments });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Departments updated successfully');
      queryClient.invalidateQueries({ queryKey: ['hospital-profile'] });
    },
    onError: () => {
      toast.error('Failed to update departments');
    }
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newDept.trim()) return;
    
    const currentDepts = hospital?.departments || [];
    if (currentDepts.includes(newDept.trim())) {
      toast.error('Department already exists');
      return;
    }
    
    const updated = [...currentDepts, newDept.trim()];
    updateMutation.mutate(updated);
    setNewDept('');
  };

  const handleRemove = (dept) => {
    const currentDepts = hospital?.departments || [];
    const updated = currentDepts.filter(d => d !== dept);
    updateMutation.mutate(updated);
  };

  if (isLoading) return <Loader message="Fetching departments..." />;

  if (error) {
    return <div className="text-red-500 text-center py-10">Failed to load hospital profile.</div>;
  }

  const departments = hospital?.departments || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Manage Departments</h1>
          <p className="text-slate-500 mt-1 text-sm">Configure the medical specialties and departments available at your facility.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Add New Department</h2>
        <form onSubmit={handleAdd} className="flex gap-3 max-w-md">
          <input
            type="text"
            value={newDept}
            onChange={(e) => setNewDept(e.target.value)}
            placeholder="e.g. Cardiology, Pediatrics..."
            className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button 
            type="submit"
            disabled={updateMutation.isLoading || !newDept.trim()}
            className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            <Plus size={18} /> Add
          </button>
        </form>

        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Activity size={18} className="text-blue-500" />
            Active Departments ({departments.length})
          </h2>
          
          {departments.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-500">
              No departments configured yet. Add your first department above to start receiving relevant referrals.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {departments.map((dept, idx) => (
                <div key={idx} className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg group hover:border-blue-300 hover:bg-blue-50 transition-colors">
                  <span className="font-semibold text-slate-700 group-hover:text-blue-700">{dept}</span>
                  <button 
                    onClick={() => handleRemove(dept)}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors ml-2"
                    title="Remove Department"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HospitalDepartments;
